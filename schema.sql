-- ============================================================
-- GymFlow — Supabase SQL Schema
-- Ejecutar este script completo en el SQL Editor de Supabase
-- ============================================================

-- 0. Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. TABLAS
-- ============================================================

-- Gimnasios
CREATE TABLE public.gyms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  direccion TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Perfiles de usuario (se crea automáticamente al registrarse)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  nombre TEXT NOT NULL,
  username TEXT UNIQUE,
  cedula TEXT,
  telefono TEXT,
  email TEXT,
  fecha_ingreso DATE DEFAULT CURRENT_DATE,
  gym_id UUID REFERENCES public.gyms(id) ON DELETE SET NULL,
  foto_url TEXT,
  fecha_nacimiento DATE,
  sexo TEXT CHECK (sexo IN ('masculino', 'femenino')),
  altura_cm NUMERIC(5,1),
  peso_kg NUMERIC(5,1),
  nivel_entrenamiento TEXT CHECK (nivel_entrenamiento IN ('principiante', 'intermedio', 'avanzado')),
  objetivo_principal TEXT CHECK (objetivo_principal IN ('hipertrofia', 'fuerza', 'perdida_grasa', 'recomposicion')),
  frecuencia_dias INTEGER CHECK (frecuencia_dias BETWEEN 1 AND 7),
  duracion_minutos INTEGER CHECK (duracion_minutos BETWEEN 15 AND 180),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Planes de membresía
CREATE TABLE public.planes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  duracion_dias INTEGER NOT NULL CHECK (duracion_dias > 0),
  precio NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Membresías
CREATE TABLE public.membresias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.planes(id) ON DELETE RESTRICT,
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin DATE NOT NULL,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'por_vencer', 'vencido')),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Asistencias
CREATE TABLE public.asistencias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fecha_entrada TIMESTAMPTZ NOT NULL DEFAULT now(),
  gym_id UUID NOT NULL REFERENCES public.gyms(id) ON DELETE CASCADE
);

-- ============================================================
-- 2. ÍNDICES
-- ============================================================

CREATE INDEX idx_profiles_gym ON public.profiles(gym_id);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE UNIQUE INDEX idx_profiles_username ON public.profiles(username) WHERE username IS NOT NULL;
CREATE INDEX idx_planes_gym ON public.planes(gym_id);
CREATE INDEX idx_membresias_member ON public.membresias(member_id);
CREATE INDEX idx_membresias_gym ON public.membresias(gym_id);
CREATE INDEX idx_membresias_estado ON public.membresias(estado);
CREATE INDEX idx_membresias_fecha_fin ON public.membresias(fecha_fin);
CREATE INDEX idx_asistencias_member ON public.asistencias(member_id);
CREATE INDEX idx_asistencias_gym ON public.asistencias(gym_id);
CREATE INDEX idx_asistencias_fecha ON public.asistencias(fecha_entrada);

-- ============================================================
-- 3. FUNCIONES Y TRIGGERS
-- ============================================================

-- 3a. Actualizar estados de membresía automáticamente
--     Se puede llamar periódicamente o antes de consultas clave
CREATE OR REPLACE FUNCTION public.actualizar_estados_membresias()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Marcar como vencidas
  UPDATE public.membresias
  SET estado = 'vencido'
  WHERE fecha_fin < CURRENT_DATE
    AND estado != 'vencido';

  -- Marcar como por_vencer (5 días o menos)
  UPDATE public.membresias
  SET estado = 'por_vencer'
  WHERE fecha_fin >= CURRENT_DATE
    AND fecha_fin <= CURRENT_DATE + INTERVAL '5 days'
    AND estado = 'activo';

  -- Reactivar si se renovó y ahora está vigente (más de 5 días)
  UPDATE public.membresias
  SET estado = 'activo'
  WHERE fecha_fin > CURRENT_DATE + INTERVAL '5 days'
    AND estado IN ('vencido', 'por_vencer');
END;
$$;

-- 3b. Trigger: actualizar estado al insertar o actualizar membresía
CREATE OR REPLACE FUNCTION public.trigger_set_estado_membresia()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.fecha_fin < CURRENT_DATE THEN
    NEW.estado := 'vencido';
  ELSIF NEW.fecha_fin <= CURRENT_DATE + INTERVAL '5 days' THEN
    NEW.estado := 'por_vencer';
  ELSE
    NEW.estado := 'activo';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_membresia_estado
BEFORE INSERT OR UPDATE ON public.membresias
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_estado_membresia();

-- 3c. Crear perfil automáticamente al registrarse un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, nombre, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'member'),
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 3d. Crear gym automáticamente cuando un admin se registra
CREATE OR REPLACE FUNCTION public.handle_admin_gym()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'admin' AND NEW.gym_id IS NULL THEN
    INSERT INTO public.gyms (nombre, owner_id)
    VALUES (NEW.nombre || ' Gym', NEW.id)
    RETURNING id INTO NEW.gym_id;

    -- Insertar planes por defecto
    INSERT INTO public.planes (nombre, duracion_dias, precio, gym_id) VALUES
      ('Mensual', 30, 29.99, NEW.gym_id),
      ('Trimestral', 90, 74.99, NEW.gym_id),
      ('Anual', 365, 249.99, NEW.gym_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_admin_gym
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_admin_gym();

-- ============================================================
-- 4. HELPER FUNCTIONS FOR RLS (avoid circular references)
-- ============================================================

-- Get current user's gym_id without going through RLS
CREATE OR REPLACE FUNCTION public.get_my_gym_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gym_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Check if current user is admin without going through RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membresias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asistencias ENABLE ROW LEVEL SECURITY;

-- ---- GYMS ----
CREATE POLICY "Owners can manage their gym"
  ON public.gyms FOR ALL
  USING (owner_id = auth.uid());

CREATE POLICY "Members can view their gym"
  ON public.gyms FOR SELECT
  USING (id = public.get_my_gym_id());

-- ---- PROFILES ----
-- Los usuarios pueden ver y editar su propio perfil
CREATE POLICY "Users manage own profile"
  ON public.profiles FOR ALL
  USING (id = auth.uid());

-- Admins ven todos los perfiles de su gym
CREATE POLICY "Admins see gym profiles"
  ON public.profiles FOR SELECT
  USING (gym_id = public.get_my_gym_id() AND public.is_admin());

-- Admins pueden crear/editar/eliminar perfiles de su gym
CREATE POLICY "Admins manage gym profiles"
  ON public.profiles FOR ALL
  USING (gym_id = public.get_my_gym_id() AND public.is_admin());

-- ---- PLANES ----
-- Cualquiera del gym puede ver planes
CREATE POLICY "Gym users see plans"
  ON public.planes FOR SELECT
  USING (gym_id = public.get_my_gym_id());

-- Solo admins gestionan planes
CREATE POLICY "Admins manage plans"
  ON public.planes FOR ALL
  USING (gym_id = public.get_my_gym_id() AND public.is_admin());

-- ---- MEMBRESÍAS ----
-- Admins ven todas las membresías de su gym
CREATE POLICY "Admins see gym memberships"
  ON public.membresias FOR SELECT
  USING (gym_id = public.get_my_gym_id() AND public.is_admin());

-- Admins gestionan membresías
CREATE POLICY "Admins manage memberships"
  ON public.membresias FOR ALL
  USING (gym_id = public.get_my_gym_id() AND public.is_admin());

-- Miembros ven sus propias membresías
CREATE POLICY "Members see own memberships"
  ON public.membresias FOR SELECT
  USING (member_id = auth.uid());

-- ---- ASISTENCIAS ----
-- Admins ven asistencias de su gym
CREATE POLICY "Admins see gym attendance"
  ON public.asistencias FOR SELECT
  USING (gym_id = public.get_my_gym_id() AND public.is_admin());

-- Admins registran asistencias
CREATE POLICY "Admins manage attendance"
  ON public.asistencias FOR ALL
  USING (gym_id = public.get_my_gym_id() AND public.is_admin());

-- Miembros ven su propia asistencia
CREATE POLICY "Members see own attendance"
  ON public.asistencias FOR SELECT
  USING (member_id = auth.uid());

-- ============================================================
-- 5. FUNCIÓN RPC: actualizar estados (llamar desde el frontend)
-- ============================================================

-- Exponer como RPC para llamar desde el cliente
CREATE OR REPLACE FUNCTION public.refresh_membership_states(p_gym_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.membresias
  SET estado = 'vencido'
  WHERE gym_id = p_gym_id
    AND fecha_fin < CURRENT_DATE
    AND estado != 'vencido';

  UPDATE public.membresias
  SET estado = 'por_vencer'
  WHERE gym_id = p_gym_id
    AND fecha_fin >= CURRENT_DATE
    AND fecha_fin <= CURRENT_DATE + INTERVAL '5 days'
    AND estado = 'activo';
END;
$$;

-- ============================================================
-- 6. FUNCIÓN PÚBLICA: buscar email por nombre de usuario
--    Permite login con username sin estar autenticado
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE username = p_username LIMIT 1;
$$;
