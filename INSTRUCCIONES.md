# GymFlow — Instrucciones de Despliegue

## 1. Configurar Supabase

### Crear proyecto
1. Ve a [supabase.com](https://supabase.com) y crea una cuenta / nuevo proyecto
2. Anota la **Project URL** y la **anon public key** (Settings > API)

### Ejecutar el esquema SQL
1. En tu proyecto de Supabase, ve a **SQL Editor**
2. Copia y pega todo el contenido de `schema.sql`
3. Haz clic en **Run** para ejecutar
4. Verifica que las tablas se crearon en **Table Editor**

### Configurar autenticación
1. Ve a **Authentication > Settings**
2. Asegúrate de que "Enable email confirmations" esté **desactivado** para pruebas rápidas (o configura un proveedor SMTP para producción)

## 2. Configurar el proyecto local

### Actualizar credenciales
Edita `supabaseClient.js` y reemplaza:
```js
const SUPABASE_URL = 'https://tu-proyecto.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGci...tu-clave-aqui';
```

### Instalar dependencias y ejecutar
```bash
npm install
npm run dev
```
La app estará disponible en `http://localhost:5173`

## 3. Primer uso

1. Abre la app y crea una cuenta como **Administrador**
2. Se creará automáticamente un gimnasio con 3 planes por defecto
3. Desde el panel admin, registra miembros con el botón "Nuevo Miembro"
4. Asigna membresías y registra asistencias

## 4. Desplegar en Vercel

### Opción A: Desde GitHub
1. Sube el proyecto a un repositorio de GitHub
2. Ve a [vercel.com](https://vercel.com) e importa el repositorio
3. Vercel detectará Vite automáticamente
4. Haz clic en **Deploy**

### Opción B: Desde CLI
```bash
npm install -g vercel
vercel
```

## 5. Desplegar en Netlify

### Opción A: Desde GitHub
1. Sube el proyecto a GitHub
2. Ve a [netlify.com](https://netlify.com) > "Add new site" > "Import from Git"
3. Configura:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Haz clic en **Deploy site**

### Opción B: Desde CLI
```bash
npm run build
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

### Configurar redirecciones (SPA)
Crea un archivo `public/_redirects` con:
```
/*    /index.html   200
```

## Estructura de archivos

```
gymflow/
├── index.html          ← Punto de entrada HTML
├── main.jsx            ← Bootstrap de React
├── App.jsx             ← Toda la lógica de la aplicación
├── supabaseClient.js   ← Configuración de Supabase
├── schema.sql          ← Script SQL para Supabase
├── package.json        ← Dependencias del proyecto
├── vite.config.js      ← Configuración de Vite
└── INSTRUCCIONES.md    ← Este archivo
```
