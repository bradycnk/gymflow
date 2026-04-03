import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase } from './supabaseClient.js';

// ============================================================
// CONTEXTO GLOBAL
// ============================================================
const AppContext = createContext();
function useApp() { return useContext(AppContext); }

const SUPABASE_URL = 'https://lhoawtgvtehewwexatej.supabase.co';

// ============================================================
// TASA BCV — se refresca cada 8 horas
// ============================================================
const BCV_CACHE_KEY = 'gymflow_bcv_rate';
const BCV_REFRESH_MS = 8 * 60 * 60 * 1000; // 8 horas

function getBcvCache() {
  try {
    const raw = localStorage.getItem(BCV_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.ts < BCV_REFRESH_MS) return cached;
    return null;
  } catch { return null; }
}

async function fetchBcvRate() {
  const cached = getBcvCache();
  if (cached) return cached;
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial');
    if (!res.ok) throw new Error('BCV API error');
    const json = await res.json();
    const rate = json.promedio || json.venta || json.compra;
    if (!rate || rate <= 0) throw new Error('Invalid rate');
    const data = { rate, fecha: json.fechaActualizacion, ts: Date.now() };
    localStorage.setItem(BCV_CACHE_KEY, JSON.stringify(data));
    return data;
  } catch (err) {
    console.warn('BCV fetch failed:', err.message);
    // Try stale cache as fallback
    try {
      const raw = localStorage.getItem(BCV_CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }
}

function useBcvRate() {
  const [bcv, setBcv] = useState(() => getBcvCache());
  useEffect(() => {
    fetchBcvRate().then((data) => { if (data) setBcv(data); });
    const interval = setInterval(() => {
      fetchBcvRate().then((data) => { if (data) setBcv(data); });
    }, BCV_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);
  return bcv;
}

function formatBs(usd, rate) {
  if (!rate || !usd) return null;
  const bs = Number(usd) * rate;
  return `Bs ${bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Price display component: shows USD + Bs
function Price({ amount, className = '', size = 'md' }) {
  const { bcv } = useApp();
  const usd = Number(amount || 0);
  const sizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-2xl', xl: 'text-3xl' };
  const bsSizes = { sm: 'text-[10px]', md: 'text-xs', lg: 'text-sm', xl: 'text-sm' };
  return (
    <span className={className}>
      <span className={sizes[size]}>${usd.toFixed(2)}</span>
      {bcv?.rate && <span className={`${bsSizes[size]} text-gray-500 ml-1`}>({formatBs(usd, bcv.rate)})</span>}
    </span>
  );
}

// ============================================================
// COMPONENTES UTILITARIOS PRO
// ============================================================

function Spinner() {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="relative">
        <div className="w-10 h-10 border-3 border-white/10 border-t-brand-500 rounded-full animate-spin"></div>
        <div className="absolute inset-0 w-10 h-10 border-3 border-transparent border-b-brand-400/30 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
      </div>
    </div>
  );
}

function ErrorMsg({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="animate-fadeIn bg-red-500/10 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl mb-4 flex justify-between items-center">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span className="text-sm">{message}</span>
      </div>
      {onClose && <button onClick={onClose} className="text-red-400 hover:text-red-300 ml-4 text-lg">&times;</button>}
    </div>
  );
}

function SuccessMsg({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="animate-fadeIn bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-4 py-3 rounded-xl mb-4 flex justify-between items-center">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span className="text-sm">{message}</span>
      </div>
      {onClose && <button onClick={onClose} className="text-emerald-400 hover:text-emerald-300 ml-4 text-lg">&times;</button>}
    </div>
  );
}

function ConfirmModal({ open, title, message, onConfirm, onCancel, confirmText = 'Eliminar', confirmColor = 'bg-red-600 hover:bg-red-500' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="animate-scaleIn glass-strong rounded-2xl max-w-md w-full p-4 sm:p-6">
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400 mb-4 sm:mb-6 text-sm">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-gray-400 hover:text-white border border-white/10 rounded-xl hover:bg-white/5 transition">Cancelar</button>
          <button onClick={onConfirm} className={`px-4 py-2 text-white rounded-xl transition ${confirmColor}`}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

function Badge({ estado }) {
  const styles = {
    activo: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    por_vencer: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    vencido: 'bg-red-500/15 text-red-400 border-red-500/20',
  };
  const labels = { activo: 'Activo', por_vencer: 'Por vencer', vencido: 'Vencido' };
  return (
    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${styles[estado] || 'bg-white/5 text-gray-400 border-white/10'}`}>
      {labels[estado] || estado}
    </span>
  );
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Stat card component
function StatCard({ label, value, icon, color, subtext }) {
  return (
    <div className="glass rounded-2xl p-5 card-hover animate-fadeIn">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </div>
      </div>
    </div>
  );
}

// Gym Logo component — shows uploaded logo or default icon
function GymLogo({ gym, size = 'md', className = '' }) {
  const sizes = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-16 h-16' };
  const iconSizes = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-8 h-8' };
  const roundedSizes = { sm: 'rounded-lg', md: 'rounded-xl', lg: 'rounded-2xl' };
  if (gym?.logo_url) {
    return <img src={gym.logo_url} alt={gym.nombre || 'Gym'} className={`${sizes[size]} ${roundedSizes[size]} object-cover ${className}`} />;
  }
  return (
    <div className={`${sizes[size]} bg-gradient-to-br from-brand-500 to-amber-600 ${roundedSizes[size]} flex items-center justify-center shadow-lg shadow-brand-500/20 ${className}`}>
      <svg className={`${iconSizes[size]} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
    </div>
  );
}

// ============================================================
// AUTH: LOGIN / REGISTRO
// ============================================================

function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [loginInput, setLoginInput] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [role, setRole] = useState('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showResend, setShowResend] = useState(false);
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  function translateError(msg) {
    const map = {
      'Invalid login credentials': 'Credenciales incorrectas. Verifica tu usuario y contraseña.',
      'Email not confirmed': 'Tu email aún no ha sido confirmado. Revisa tu bandeja de entrada o spam.',
      'User already registered': 'Este email ya está registrado. Intenta iniciar sesión.',
      'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
      'Unable to validate email address: invalid format': 'El formato del email no es válido.',
      'Email rate limit exceeded': 'Demasiados intentos. Espera unos minutos.',
      'For security purposes, you can only request this after': 'Por seguridad, debes esperar antes de solicitar otro email.',
    };
    for (const [key, val] of Object.entries(map)) { if (msg.includes(key)) return val; }
    return msg;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setSuccess(''); setShowResend(false); setLoading(true);
    try {
      if (isLogin) {
        let loginEmail = loginInput.trim();
        if (!loginEmail.includes('@')) {
          const { data, error: lookupError } = await supabase.from('profiles').select('email').eq('username', loginEmail.toLowerCase()).single();
          if (lookupError || !data?.email) throw new Error('Invalid login credentials');
          loginEmail = data.email;
        }
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) { if (error.message.includes('Email not confirmed')) setShowResend(true); throw error; }
      } else {
        if (!nombre.trim()) { setLoading(false); setError('El nombre es obligatorio.'); return; }
        if (password.length < 6) { setLoading(false); setError('La contraseña debe tener al menos 6 caracteres.'); return; }
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nombre: nombre.trim(), role } } });
        if (error) { if (error.message.includes('already registered')) setShowResend(false); throw error; }
        if (data?.user && data.user.identities && data.user.identities.length === 0) { setError('Este email ya está registrado.'); setShowResend(true); setLoading(false); return; }
        if (data?.user && !data.session) { setSuccess('Cuenta creada. Revisa tu email para confirmar.'); setShowResend(true); setLoading(false); return; }
        if (data?.session) setSuccess('Cuenta creada exitosamente. Redirigiendo...');
      }
    } catch (err) { setError(translateError(err.message)); } finally { setLoading(false); }
  }

  async function handleResendConfirmation() {
    if (!email) { setError('Ingresa tu email primero.'); return; }
    setResending(true); setError('');
    try { const { error } = await supabase.auth.resend({ type: 'signup', email }); if (error) throw error; setSuccess('Email reenviado. Revisa tu bandeja.'); }
    catch (err) { setError(translateError(err.message)); } finally { setResending(false); }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    if (!forgotEmail) { setError('Ingresa tu email.'); return; }
    setForgotLoading(true); setError(''); setSuccess('');
    try { const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail); if (error) throw error; setSuccess('Enlace de recuperación enviado a tu email.'); }
    catch (err) { setError(translateError(err.message)); } finally { setForgotLoading(false); }
  }

  const inputClass = "w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 outline-none transition text-sm";

  if (showForgot) {
    return (
      <div className="min-h-screen bg-[#0f0f13] flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-600/10 rounded-full blur-[120px]"></div>
        </div>
        <div className="animate-scaleIn glass-strong rounded-3xl max-w-md w-full p-8 relative z-10">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-4">
              <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-white">Recuperar contraseña</h2>
            <p className="text-gray-500 mt-1 text-sm">Te enviaremos un enlace para restablecer tu contraseña.</p>
          </div>
          <ErrorMsg message={error} onClose={() => setError('')} />
          <SuccessMsg message={success} onClose={() => setSuccess('')} />
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label><input type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className={inputClass} placeholder="tu@email.com" /></div>
            <button type="submit" disabled={forgotLoading} className="w-full py-3 bg-brand-600 text-white rounded-xl font-semibold hover:bg-brand-500 disabled:opacity-50 transition text-sm">{forgotLoading ? 'Enviando...' : 'Enviar enlace'}</button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-6"><button onClick={() => { setShowForgot(false); setError(''); setSuccess(''); }} className="text-brand-400 hover:text-brand-300 font-medium">Volver al inicio de sesión</button></p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f13] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-600/10 rounded-full blur-[120px]"></div>
      </div>
      <div className="animate-scaleIn glass-strong rounded-3xl max-w-md w-full p-8 relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-brand-500 to-amber-600 rounded-2xl mb-4 shadow-lg shadow-brand-500/25">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">GymFlow</h1>
          <p className="text-gray-500 mt-1 text-sm">Sistema de gestión profesional</p>
        </div>

        <ErrorMsg message={error} onClose={() => setError('')} />
        <SuccessMsg message={success} onClose={() => setSuccess('')} />

        {showResend && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-4">
            <p className="text-sm text-blue-300 font-medium">¿No recibiste el email?</p>
            <button onClick={handleResendConfirmation} disabled={resending} className="mt-1 text-sm text-blue-400 hover:text-blue-300 underline disabled:opacity-50">{resending ? 'Reenviando...' : 'Reenviar email de confirmación'}</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div><label className="block text-sm font-medium text-gray-400 mb-1.5">Nombre completo</label><input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} placeholder="Tu nombre" /></div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Tipo de cuenta</label>
                <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass + " bg-[#0f0f13]"}>
                  <option value="admin">Administrador (dueño de gym)</option>
                  <option value="member">Miembro (cliente)</option>
                </select>
              </div>
            </>
          )}
          <div>
            {isLogin ? (
              <><label className="block text-sm font-medium text-gray-400 mb-1.5">Usuario o Email</label><input type="text" required value={loginInput} onChange={(e) => setLoginInput(e.target.value)} className={inputClass} placeholder="tu usuario o email" /></>
            ) : (
              <><label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="tu@email.com" /></>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Contraseña</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass + " pr-12"} placeholder="Mínimo 6 caracteres" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition">
                {showPassword ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l18 18" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-brand-600 to-amber-600 text-white rounded-xl font-semibold hover:from-brand-500 hover:to-amber-500 disabled:opacity-50 transition flex items-center justify-center gap-2 shadow-lg shadow-brand-600/20 text-sm">
            {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
            {loading ? 'Procesando...' : isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </form>

        {isLogin && <p className="text-center mt-3"><button onClick={() => { setShowForgot(true); setForgotEmail(loginInput.includes('@') ? loginInput : ''); setError(''); setSuccess(''); }} className="text-sm text-gray-500 hover:text-brand-400 transition">¿Olvidaste tu contraseña?</button></p>}

        <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div><div className="relative flex justify-center"><span className="bg-transparent px-3 text-xs text-gray-600 uppercase">o</span></div></div>

        <p className="text-center text-sm text-gray-500">
          {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); setShowResend(false); }} className="text-brand-400 hover:text-brand-300 font-medium">{isLogin ? 'Regístrate aquí' : 'Inicia sesión'}</button>
        </p>
      </div>
    </div>
  );
}

// ============================================================
// LAYOUT / NAVEGACIÓN PRO
// ============================================================

function Sidebar({ currentView, setView, profile, onLogout }) {
  const { gym } = useApp();
  const isAdmin = profile?.role === 'admin';
  const adminLinks = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
    { id: 'members', label: 'Miembros', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { id: 'plans', label: 'Planes', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { id: 'memberships', label: 'Membresías', icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z' },
    { id: 'attendance', label: 'Asistencia', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  ];
  const memberLinks = [
    { id: 'my-membership', label: 'Mi Membresía', icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z' },
    { id: 'my-attendance', label: 'Mi Asistencia', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'available-plans', label: 'Planes', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { id: 'my-profile', label: 'Mi Perfil', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  ];
  const links = isAdmin ? adminLinks : memberLinks;

  return (
    <aside className="w-64 bg-[#12121a] border-r border-white/5 min-h-screen flex flex-col">
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <GymLogo gym={gym} size="md" />
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-white text-sm truncate">{gym?.nombre || 'GymFlow'}</h2>
            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{isAdmin ? 'Admin Panel' : 'Miembro'}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider px-3 py-2">{isAdmin ? 'Gestión' : 'Menu'}</p>
        {links.map((link) => (
          <button key={link.id} onClick={() => setView(link.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              currentView === link.id
                ? 'bg-brand-600/15 text-brand-400 border border-brand-500/20 shadow-sm shadow-brand-500/5'
                : 'text-gray-500 hover:bg-white/5 hover:text-gray-300 border border-transparent'
            }`}>
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={link.icon} /></svg>
            {link.label}
          </button>
        ))}
      </nav>

      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-9 h-9 bg-gradient-to-br from-brand-500/30 to-amber-500/30 rounded-xl flex items-center justify-center text-sm font-bold text-brand-300 border border-brand-500/20">
            {profile?.nombre?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{profile?.nombre}</p>
            <p className="text-[11px] text-gray-500 truncate">{profile?.email}</p>
          </div>
          {isAdmin && (
            <button onClick={() => setView('settings')} className="p-1.5 text-gray-600 hover:text-brand-400 hover:bg-brand-500/10 rounded-lg transition" title="Configuración">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          )}
        </div>
        <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

function MobileSidebar({ currentView, setView, profile, onLogout, open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>
      <div className="fixed left-0 top-0 bottom-0 w-64 animate-slideIn"><Sidebar currentView={currentView} setView={(v) => { setView(v); onClose(); }} profile={profile} onLogout={onLogout} /></div>
    </div>
  );
}

function BottomNav({ currentView, setView, profile, onLogout, onMore }) {
  const isAdmin = profile?.role === 'admin';
  const adminLinks = [
    { id: 'dashboard', label: 'Inicio', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
    { id: 'members', label: 'Miembros', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { id: 'memberships', label: 'Membresías', icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z' },
    { id: 'attendance', label: 'Asistencia', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'more', label: 'Más', icon: 'M4 6h16M4 12h16M4 18h16' },
  ];
  const memberLinks = [
    { id: 'my-membership', label: 'Membresía', icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z' },
    { id: 'my-attendance', label: 'Asistencia', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'my-profile', label: 'Mi Perfil', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 'more', label: 'Más', icon: 'M4 6h16M4 12h16M4 18h16' },
  ];
  const links = isAdmin ? adminLinks : memberLinks;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-[#12121a]/95 backdrop-blur-xl border-t border-white/5">
      <div className="flex items-center justify-around px-2 py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {links.map((link) => {
          const isActive = link.id === 'more' ? false : currentView === link.id;
          return (
            <button
              key={link.id}
              onClick={() => link.id === 'more' ? onMore() : setView(link.id)}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-all min-w-[60px] ${
                isActive
                  ? 'text-brand-400'
                  : 'text-gray-500 active:text-gray-300'
              }`}
            >
              <div className={`relative ${isActive ? '' : ''}`}>
                {isActive && <div className="absolute -inset-1.5 bg-brand-500/15 rounded-lg"></div>}
                <svg className="w-5 h-5 relative" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2.5 : 1.5} d={link.icon} /></svg>
              </div>
              <span className={`text-[10px] font-medium ${isActive ? 'text-brand-400' : ''}`}>{link.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function MobileMoreMenu({ open, onClose, setView, profile, onLogout }) {
  if (!open) return null;
  const isAdmin = profile?.role === 'admin';
  const extraLinks = isAdmin
    ? [{ id: 'plans', label: 'Planes', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
       { id: 'settings', label: 'Configuración', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' }]
    : [{ id: 'available-plans', label: 'Planes', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' }];

  return (
    <div className="fixed inset-0 z-[60] lg:hidden">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="fixed bottom-0 left-0 right-0 animate-slideUp bg-[#1a1a24] border-t border-white/10 rounded-t-2xl p-4 pb-[max(4.5rem,env(safe-area-inset-bottom))]">
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4"></div>
        <div className="flex items-center gap-3 px-2 py-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-amber-600 rounded-xl flex items-center justify-center text-sm font-bold text-white">
            {profile?.nombre?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{profile?.nombre}</p>
            <p className="text-xs text-gray-500 truncate">{profile?.email}</p>
          </div>
        </div>
        {extraLinks.map((link) => (
          <button key={link.id} onClick={() => { setView(link.id); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/5 transition">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={link.icon} /></svg>
            {link.label}
          </button>
        ))}
        <div className="border-t border-white/5 mt-2 pt-2">
          <button onClick={() => { onLogout(); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/5 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ADMIN: DASHBOARD
// ============================================================

function AdminDashboard() {
  const { profile, bcv: bcvData } = useApp();
  const [stats, setStats] = useState({ total: 0, activos: 0, vencidosHoy: 0, ingresos: 0, porVencer: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!profile?.gym_id) return;
      setLoading(true);
      await supabase.rpc('refresh_membership_states', { p_gym_id: profile.gym_id });
      const [membersRes, membresiasRes, porVencerRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact' }).eq('gym_id', profile.gym_id).eq('role', 'member'),
        supabase.from('membresias').select('*, planes(precio)').eq('gym_id', profile.gym_id),
        supabase.from('membresias').select('*, profiles(nombre)').eq('gym_id', profile.gym_id).eq('estado', 'por_vencer'),
      ]);
      const total = membersRes.count || 0;
      const membresias = membresiasRes.data || [];
      const activos = membresias.filter((m) => m.estado === 'activo' || m.estado === 'por_vencer').length;
      const today = new Date().toISOString().split('T')[0];
      const vencidosHoy = membresias.filter((m) => m.fecha_fin === today && m.estado === 'vencido').length;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const ingresos = membresias.filter((m) => m.created_at >= monthStart && m.planes).reduce((sum, m) => sum + Number(m.planes.precio || 0), 0);
      setStats({ total, activos, vencidosHoy, ingresos, porVencer: porVencerRes.data || [] });
      setLoading(false);
    }
    load();
  }, [profile?.gym_id]);

  if (loading) return <Spinner />;

  return (
    <div className="animate-fadeIn">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Resumen general de tu gimnasio</p>
      </div>

      {stats.porVencer.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/15 rounded-2xl p-4 mb-6 animate-fadeIn">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            <span className="font-semibold text-amber-300 text-sm">Membresías por vencer ({stats.porVencer.length})</span>
          </div>
          <div className="space-y-1">{stats.porVencer.map((m) => <p key={m.id} className="text-sm text-amber-400/80">{m.profiles?.nombre || 'Miembro'} — vence el {formatDate(m.fecha_fin)}</p>)}</div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Miembros" value={stats.total} color="bg-blue-600" icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        <StatCard label="Activas" value={stats.activos} color="bg-emerald-600" icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        <StatCard label="Vencidas Hoy" value={stats.vencidosHoy} color="bg-red-600" icon="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <StatCard label="Ingresos Mes" value={`$${stats.ingresos.toFixed(2)}`} subtext={bcvData?.rate ? formatBs(stats.ingresos, bcvData.rate) : null} color="bg-brand-600" icon="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </div>
    </div>
  );
}

// ============================================================
// ADMIN: GESTIÓN DE MIEMBROS
// ============================================================

function MembersPage() {
  const { profile, bcv: bcvData } = useApp();
  const [members, setMembers] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({ nombre: '', username: '', password: '', cedula: '', telefono: '', email: '', plan_id: '' });

  const loadData = useCallback(async () => {
    if (!profile?.gym_id) return;
    setLoading(true);
    const [membersRes, planesRes, membresiasRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('gym_id', profile.gym_id).eq('role', 'member').order('nombre'),
      supabase.from('planes').select('*').eq('gym_id', profile.gym_id).eq('activo', true),
      supabase.from('membresias').select('*').eq('gym_id', profile.gym_id),
    ]);
    const membersWithStatus = (membersRes.data || []).map((m) => {
      const latestMembership = (membresiasRes.data || []).filter((mb) => mb.member_id === m.id).sort((a, b) => new Date(b.fecha_fin) - new Date(a.fecha_fin))[0];
      return { ...m, membership: latestMembership };
    });
    setMembers(membersWithStatus);
    setPlanes(planesRes.data || []);
    setLoading(false);
  }, [profile?.gym_id]);

  useEffect(() => { loadData(); }, [loadData]);

  function resetForm() { setForm({ nombre: '', username: '', password: '', cedula: '', telefono: '', email: '', plan_id: '' }); setEditing(null); setShowForm(false); }

  async function handleSave(e) {
    e.preventDefault(); setError('');
    try {
      if (editing) {
        const { error } = await supabase.from('profiles').update({ nombre: form.nombre, cedula: form.cedula, telefono: form.telefono, email: form.email }).eq('id', editing.id);
        if (error) throw error;
        setSuccess('Miembro actualizado');
      } else {
        if (!form.username.trim()) { setError('El nombre de usuario es obligatorio.'); return; }
        if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
        const { data, error: rpcError } = await supabase.rpc('admin_create_member', { p_email: form.email, p_password: form.password, p_nombre: form.nombre, p_username: form.username.trim(), p_cedula: form.cedula || null, p_telefono: form.telefono || null, p_plan_id: form.plan_id || null });
        if (rpcError) throw rpcError;
        setSuccess(`Miembro registrado. Usuario: ${form.username.trim().toLowerCase()}`);
      }
      resetForm(); loadData();
    } catch (err) { setError(err.message); }
  }

  async function handleDelete(member) {
    try { const { error } = await supabase.from('profiles').delete().eq('id', member.id); if (error) throw error; setSuccess('Miembro eliminado'); setConfirmDelete(null); loadData(); }
    catch (err) { setError(err.message); }
  }

  const filtered = members.filter((m) => {
    const matchesSearch = m.nombre?.toLowerCase().includes(search.toLowerCase()) || m.username?.toLowerCase().includes(search.toLowerCase()) || m.cedula?.toLowerCase().includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase());
    if (filter === 'all') return matchesSearch;
    if (filter === 'activo') return matchesSearch && (m.membership?.estado === 'activo' || m.membership?.estado === 'por_vencer');
    if (filter === 'vencido') return matchesSearch && m.membership?.estado === 'vencido';
    if (filter === 'pendiente') return matchesSearch && !m.membership;
    return matchesSearch;
  });

  if (loading) return <Spinner />;

  const inputClass = "w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 outline-none transition text-sm";

  return (
    <div className="animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div><h1 className="text-2xl font-bold text-white">Miembros</h1><p className="text-gray-500 text-sm mt-0.5">{members.length} registrados</p></div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-600 to-amber-600 text-white rounded-xl hover:from-brand-500 hover:to-amber-500 transition text-sm font-semibold shadow-lg shadow-brand-600/20">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nuevo Miembro
        </button>
      </div>

      <ErrorMsg message={error} onClose={() => setError('')} />
      <SuccessMsg message={success} onClose={() => setSuccess('')} />

      {showForm && (
        <div className="glass rounded-2xl p-6 mb-6 animate-fadeIn">
          <h2 className="text-lg font-semibold text-white mb-4">{editing ? 'Editar Miembro' : 'Nuevo Miembro'}</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-400 mb-1.5">Nombre *</label><input type="text" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-gray-400 mb-1.5">Email *</label><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} disabled={!!editing} /></div>
            {!editing && (
              <>
                <div><label className="block text-sm font-medium text-gray-400 mb-1.5">Usuario *</label><input type="text" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className={inputClass} placeholder="ej: juan123" /><p className="text-[11px] text-gray-600 mt-1">Para iniciar sesión</p></div>
                <div><label className="block text-sm font-medium text-gray-400 mb-1.5">Contraseña *</label><input type="text" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} placeholder="Mínimo 6 caracteres" /></div>
              </>
            )}
            <div><label className="block text-sm font-medium text-gray-400 mb-1.5">Cédula/ID</label><input type="text" value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-gray-400 mb-1.5">Teléfono</label><input type="text" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className={inputClass} /></div>
            {!editing && (
              <div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-400 mb-1.5">Plan (opcional)</label>
                <select value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value })} className={inputClass + " bg-[#0f0f13]"}>
                  <option value="">Sin plan por ahora</option>{planes.map((p) => { const pf = Number(p.descuento) > 0 ? (Number(p.precio) * (1 - Number(p.descuento) / 100)).toFixed(2) : Number(p.precio).toFixed(2); return <option key={p.id} value={p.id}>{p.nombre} — ${pf}{Number(p.descuento) > 0 ? ` (-${p.descuento}%)` : ''} ({p.duracion_dias} días)</option>; })}
                </select>
              </div>
            )}
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" className="px-6 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-500 transition text-sm font-semibold">{editing ? 'Guardar' : 'Registrar'}</button>
              <button type="button" onClick={resetForm} className="px-6 py-2.5 border border-white/10 text-gray-400 rounded-xl hover:bg-white/5 transition text-sm">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1"><input type="text" placeholder="Buscar por nombre, usuario, cédula..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:ring-2 focus:ring-brand-500/50 outline-none transition text-sm" /></div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-300 focus:ring-2 focus:ring-brand-500/50 outline-none text-sm bg-[#0f0f13]">
          <option value="all">Todos</option><option value="activo">Activos</option><option value="vencido">Vencidos</option><option value="pendiente">Sin membresía</option>
        </select>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/5">
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden sm:table-cell">Usuario</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden sm:table-cell">Cédula</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden md:table-cell">Teléfono</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Estado</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Acciones</th>
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 ? (
                <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-600">No se encontraron miembros</td></tr>
              ) : filtered.map((m) => (
                <tr key={m.id} className="hover:bg-white/[0.02] transition">
                  <td className="px-4 py-3"><div className="font-medium text-white">{m.nombre}</div><div className="text-[11px] text-gray-600">{m.email}</div></td>
                  <td className="px-4 py-3 text-gray-400 hidden sm:table-cell font-mono text-xs">{m.username || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{m.cedula || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{m.telefono || '—'}</td>
                  <td className="px-4 py-3">{m.membership ? <Badge estado={m.membership.estado} /> : <span className="text-xs text-gray-600">Sin membresía</span>}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setForm({ nombre: m.nombre, cedula: m.cedula || '', telefono: m.telefono || '', email: m.email || '', plan_id: '', username: '', password: '' }); setEditing(m); setShowForm(true); }} className="w-9 h-9 flex items-center justify-center text-brand-400 bg-brand-500/10 border border-brand-500/20 rounded-full hover:bg-brand-500/20 transition" title="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => setConfirmDelete(m)} className="w-9 h-9 flex items-center justify-center text-red-400 bg-red-500/10 border border-red-500/20 rounded-full hover:bg-red-500/20 transition" title="Eliminar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ConfirmModal open={!!confirmDelete} title="Eliminar Miembro" message={`¿Eliminar a ${confirmDelete?.nombre}? Esta acción no se puede deshacer.`} onConfirm={() => handleDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
    </div>
  );
}

// ============================================================
// ADMIN: PLANES
// ============================================================

function PlansPage() {
  const { profile, bcv: bcvData } = useApp();
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({ nombre: '', duracion_dias: '', precio: '', categoria: 'individual', descuento: '0', descripcion: '' });

  const CATEGORIAS = [
    { id: 'inscripcion', label: 'Inscripción', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', color: 'emerald' },
    { id: 'sesion', label: 'Sesiones', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'blue' },
    { id: 'individual', label: 'Planes Individuales', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', color: 'brand' },
    { id: 'grupal', label: 'Planes Grupales', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', color: 'violet' },
    { id: 'asesoria', label: 'Asesorías Personalizadas', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', color: 'amber' },
  ];
  const catColors = { inscripcion: 'emerald', sesion: 'blue', individual: 'brand', grupal: 'violet', asesoria: 'amber' };

  const loadPlanes = useCallback(async () => {
    if (!profile?.gym_id) return;
    setLoading(true);
    const { data } = await supabase.from('planes').select('*').eq('gym_id', profile.gym_id).order('precio');
    setPlanes(data || []); setLoading(false);
  }, [profile?.gym_id]);

  useEffect(() => { loadPlanes(); }, [loadPlanes]);

  function resetForm() { setForm({ nombre: '', duracion_dias: '', precio: '', categoria: 'individual', descuento: '0', descripcion: '' }); setEditing(null); setShowForm(false); }

  async function handleSave(e) {
    e.preventDefault(); setError('');
    try {
      const payload = { nombre: form.nombre, duracion_dias: parseInt(form.duracion_dias), precio: parseFloat(form.precio), categoria: form.categoria, descuento: parseFloat(form.descuento || 0), descripcion: form.descripcion.trim() || null };
      if (editing) {
        const { error } = await supabase.from('planes').update(payload).eq('id', editing.id);
        if (error) throw error; setSuccess('Plan actualizado');
      } else {
        const { error } = await supabase.from('planes').insert({ ...payload, gym_id: profile.gym_id });
        if (error) throw error; setSuccess('Plan creado');
      }
      resetForm(); loadPlanes();
    } catch (err) { setError(err.message); }
  }

  async function handleToggle(plan) {
    try {
      const { error } = await supabase.from('planes').update({ activo: !plan.activo }).eq('id', plan.id);
      if (error) throw error;
      setSuccess(plan.activo ? 'Plan desactivado' : 'Plan activado');
      setConfirmDelete(null); loadPlanes();
    } catch (err) { setError(err.message); }
  }

  async function handleQuickDiscount(plan, descuento) {
    try {
      const { error } = await supabase.from('planes').update({ descuento: parseFloat(descuento) }).eq('id', plan.id);
      if (error) throw error;
      setSuccess(`Descuento actualizado: ${descuento}%`);
      loadPlanes();
    } catch (err) { setError(err.message); }
  }

  if (loading) return <Spinner />;
  const inputClass = "w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 outline-none transition text-sm";
  const selectClass = "w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 outline-none transition text-sm appearance-none";

  function getPrecioFinal(plan) {
    const p = Number(plan.precio);
    const d = Number(plan.descuento || 0);
    return d > 0 ? p * (1 - d / 100) : p;
  }

  return (
    <div className="animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div><h1 className="text-2xl font-bold text-white">Planes</h1><p className="text-gray-500 text-sm mt-0.5">Configura precios, descuentos y categorías</p></div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-600 to-amber-600 text-white rounded-xl hover:from-brand-500 hover:to-amber-500 transition text-sm font-semibold shadow-lg shadow-brand-600/20">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nuevo Plan
        </button>
      </div>

      <ErrorMsg message={error} onClose={() => setError('')} />
      <SuccessMsg message={success} onClose={() => setSuccess('')} />

      {showForm && (
        <div className="glass rounded-2xl p-6 mb-6 animate-fadeIn">
          <h2 className="text-lg font-semibold text-white mb-4">{editing ? 'Editar Plan' : 'Nuevo Plan'}</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium text-gray-400 mb-1.5">Nombre *</label><input type="text" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={inputClass} placeholder="Ej: 1 Mes Full" /></div>
            <div><label className="block text-sm font-medium text-gray-400 mb-1.5">Categoría *</label>
              <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className={selectClass}>
                {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div><label className="block text-sm font-medium text-gray-400 mb-1.5">Duración (días) *</label><input type="number" required min="1" value={form.duracion_dias} onChange={(e) => setForm({ ...form, duracion_dias: e.target.value })} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-gray-400 mb-1.5">Precio ($) *</label><input type="number" required min="0" step="0.01" value={form.precio} onChange={(e) => setForm({ ...form, precio: e.target.value })} className={inputClass} /></div>
            <div><label className="block text-sm font-medium text-gray-400 mb-1.5">Descuento (%)</label><input type="number" min="0" max="100" step="1" value={form.descuento} onChange={(e) => setForm({ ...form, descuento: e.target.value })} className={inputClass} placeholder="0" /></div>
            <div><label className="block text-sm font-medium text-gray-400 mb-1.5">Descripción</label><input type="text" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className={inputClass} placeholder="Ej: Acceso completo" /></div>
            <div className="sm:col-span-2 lg:col-span-3 flex gap-3">
              <button type="submit" className="px-6 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-500 transition text-sm font-semibold">{editing ? 'Guardar' : 'Crear Plan'}</button>
              <button type="button" onClick={resetForm} className="px-6 py-2.5 border border-white/10 text-gray-400 rounded-xl hover:bg-white/5 transition text-sm">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Plans by category */}
      {CATEGORIAS.map((cat) => {
        const catPlans = planes.filter((p) => (p.categoria || 'individual') === cat.id && p.activo);
        if (catPlans.length === 0) return null;
        const c = cat.color;
        return (
          <div key={cat.id} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c === 'brand' ? 'bg-brand-600/15 border-brand-500/20' : c === 'emerald' ? 'bg-emerald-600/15 border-emerald-500/20' : c === 'blue' ? 'bg-blue-600/15 border-blue-500/20' : c === 'violet' ? 'bg-violet-600/15 border-violet-500/20' : 'bg-amber-600/15 border-amber-500/20'} border`}>
                <svg className={`w-4.5 h-4.5 ${c === 'brand' ? 'text-brand-400' : c === 'emerald' ? 'text-emerald-400' : c === 'blue' ? 'text-blue-400' : c === 'violet' ? 'text-violet-400' : 'text-amber-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={cat.icon} /></svg>
              </div>
              <h2 className="text-lg font-bold text-white">{cat.label}</h2>
              <span className="text-xs text-gray-600">{catPlans.length} {catPlans.length === 1 ? 'plan' : 'planes'}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {catPlans.map((plan) => {
                const finalPrice = getPrecioFinal(plan);
                const hasDiscount = Number(plan.descuento) > 0;
                return (
                  <div key={plan.id} className="glass rounded-2xl p-5 card-hover">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-white truncate">{plan.nombre}</h3>
                        {plan.descripcion && <p className="text-xs text-gray-500 mt-0.5">{plan.descripcion}</p>}
                      </div>
                      {hasDiscount && <span className="ml-2 px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-bold shrink-0">-{Number(plan.descuento)}%</span>}
                    </div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xl font-bold text-white">${finalPrice.toFixed(2)}</span>
                      {hasDiscount && <span className="text-sm text-gray-600 line-through">${Number(plan.precio).toFixed(2)}</span>}
                    </div>
                    {bcvData?.rate && <p className="text-[11px] text-gray-500">{formatBs(finalPrice, bcvData.rate)}</p>}
                    <p className="text-xs text-gray-600 mt-1">{plan.duracion_dias} {plan.duracion_dias === 1 ? 'día' : 'días'}</p>

                    {/* Quick discount */}
                    <div className="mt-3 flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-600 uppercase font-medium">Desc:</span>
                      <input
                        type="number" min="0" max="100" step="1"
                        defaultValue={plan.descuento || 0}
                        onBlur={(e) => { const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)); if (v !== Number(plan.descuento || 0)) handleQuickDiscount(plan, v); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.target.blur(); } }}
                        className="w-14 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-xs text-center focus:ring-1 focus:ring-brand-500/50 outline-none"
                      />
                      <span className="text-[10px] text-gray-600">%</span>
                    </div>

                    <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                      <button onClick={() => { setForm({ nombre: plan.nombre, duracion_dias: plan.duracion_dias.toString(), precio: plan.precio.toString(), categoria: plan.categoria || 'individual', descuento: (plan.descuento || 0).toString(), descripcion: plan.descripcion || '' }); setEditing(plan); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="flex-1 px-3 py-2 text-xs text-brand-400 border border-brand-500/20 rounded-lg hover:bg-brand-500/10 transition font-medium">Editar</button>
                      <button onClick={() => setConfirmDelete(plan)} className="px-3 py-2 text-xs text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/10 transition">Desactivar</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Inactive plans */}
      {planes.filter((p) => !p.activo).length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3">Planes desactivados</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {planes.filter((p) => !p.activo).map((plan) => (
              <div key={plan.id} className="glass rounded-2xl p-4 opacity-50">
                <h3 className="text-sm font-semibold text-gray-400">{plan.nombre}</h3>
                <p className="text-xs text-gray-600">${Number(plan.precio).toFixed(2)} — {plan.duracion_dias} días</p>
                <button onClick={() => handleToggle(plan)} className="mt-2 px-3 py-1.5 text-xs text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/10 transition">Reactivar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {planes.filter((p) => p.activo).length === 0 && <p className="text-gray-600 text-center py-8">No hay planes creados</p>}
      <ConfirmModal open={!!confirmDelete} title="Desactivar Plan" message={`¿Desactivar "${confirmDelete?.nombre}"? Los miembros con este plan no se verán afectados.`} onConfirm={() => handleToggle(confirmDelete)} onCancel={() => setConfirmDelete(null)} confirmText="Desactivar" />
    </div>
  );
}

// ============================================================
// ADMIN: MEMBRESÍAS
// ============================================================

function MembershipsPage() {
  const { profile, bcv: bcvData } = useApp();
  const [membresias, setMembresias] = useState([]);
  const [members, setMembers] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState({ member_id: '', plan_id: '' });
  const [confirmAssign, setConfirmAssign] = useState(null);

  const loadData = useCallback(async () => {
    if (!profile?.gym_id) return;
    setLoading(true);
    await supabase.rpc('refresh_membership_states', { p_gym_id: profile.gym_id });
    const [membRes, planesRes, membresiasRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('gym_id', profile.gym_id).eq('role', 'member').order('nombre'),
      supabase.from('planes').select('*').eq('gym_id', profile.gym_id).eq('activo', true),
      supabase.from('membresias').select('*, profiles(nombre), planes(nombre, precio, duracion_dias)').eq('gym_id', profile.gym_id).order('created_at', { ascending: false }),
    ]);
    setMembers(membRes.data || []); setPlanes(planesRes.data || []); setMembresias(membresiasRes.data || []); setLoading(false);
  }, [profile?.gym_id]);

  useEffect(() => { loadData(); }, [loadData]);

  function getDaysRemaining(fechaFin) { const t = new Date(); t.setHours(0,0,0,0); const e = new Date(fechaFin); e.setHours(0,0,0,0); return Math.ceil((e - t) / 86400000); }

  function handleFormSubmit(e) {
    e.preventDefault(); setError('');
    const plan = planes.find((p) => p.id === form.plan_id);
    const member = members.find((m) => m.id === form.member_id);
    if (!plan || !member) { setError('Selecciona miembro y plan'); return; }
    const existingActive = membresias.find((m) => m.member_id === form.member_id && (m.estado === 'activo' || m.estado === 'por_vencer'));
    setConfirmAssign({ member, plan, existingActive });
  }

  async function executeAssign() {
    const { member, plan, existingActive } = confirmAssign;
    setConfirmAssign(null); setError('');
    try {
      if (existingActive) { const { error: updateError } = await supabase.from('membresias').update({ estado: 'vencido' }).eq('id', existingActive.id); if (updateError) throw updateError; }
      const fechaInicio = new Date().toISOString().split('T')[0];
      const fechaFin = new Date(Date.now() + plan.duracion_dias * 86400000).toISOString().split('T')[0];
      const { error } = await supabase.from('membresias').insert({ member_id: member.id, plan_id: plan.id, fecha_inicio: fechaInicio, fecha_fin: fechaFin, gym_id: profile.gym_id });
      if (error) throw error;
      setSuccess(existingActive ? `Membresía renovada para ${member.nombre}` : `Membresía asignada a ${member.nombre}`);
      setShowForm(false); setForm({ member_id: '', plan_id: '' }); loadData();
    } catch (err) { setError(err.message); }
  }

  async function viewHistory(memberId) {
    const member = members.find((m) => m.id === memberId);
    setSelectedMember(member);
    const { data } = await supabase.from('membresias').select('*, planes(nombre, precio)').eq('member_id', memberId).order('fecha_inicio', { ascending: false });
    setHistory(data || []); setShowHistory(true);
  }

  if (loading) return <Spinner />;

  const latestByMember = {};
  membresias.forEach((m) => { if (!latestByMember[m.member_id] || new Date(m.created_at) > new Date(latestByMember[m.member_id].created_at)) latestByMember[m.member_id] = m; });
  const latestMembresias = Object.values(latestByMember);
  const porVencer = latestMembresias.filter((m) => m.estado === 'por_vencer');
  const vencidas = latestMembresias.filter((m) => m.estado === 'vencido');
  const inputClass = "w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:ring-2 focus:ring-brand-500/50 outline-none transition text-sm bg-[#0f0f13]";

  return (
    <div className="animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div><h1 className="text-2xl font-bold text-white">Membresías</h1><p className="text-gray-500 text-sm mt-0.5">Gestión y renovación</p></div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-600 to-amber-600 text-white rounded-xl hover:from-brand-500 hover:to-amber-500 transition text-sm font-semibold shadow-lg shadow-brand-600/20">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Asignar / Renovar
        </button>
      </div>

      <ErrorMsg message={error} onClose={() => setError('')} />
      <SuccessMsg message={success} onClose={() => setSuccess('')} />

      {porVencer.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/15 rounded-2xl p-4 mb-4"><div className="flex items-center gap-2 mb-2"><svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg><span className="font-semibold text-amber-300 text-sm">Por vencer ({porVencer.length})</span></div>
          {porVencer.map((m) => <p key={m.id} className="text-sm text-amber-400/80">{m.profiles?.nombre} — {getDaysRemaining(m.fecha_fin)} días restantes</p>)}</div>
      )}
      {vencidas.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/15 rounded-2xl p-4 mb-4"><div className="flex items-center gap-2 mb-2"><svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span className="font-semibold text-red-300 text-sm">Vencidas ({vencidas.length})</span></div>
          {vencidas.map((m) => <p key={m.id} className="text-sm text-red-400/80">{m.profiles?.nombre} — venció {formatDate(m.fecha_fin)}</p>)}</div>
      )}

      {showForm && (
        <div className="glass rounded-2xl p-6 mb-6 animate-fadeIn">
          <h2 className="text-lg font-semibold text-white mb-4">Asignar o Renovar</h2>
          <form onSubmit={handleFormSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-400 mb-1.5">Miembro *</label><select required value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })} className={inputClass}><option value="">Seleccionar</option>{members.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-400 mb-1.5">Plan *</label><select required value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value })} className={inputClass}><option value="">Seleccionar</option>{planes.map((p) => { const pf = Number(p.descuento) > 0 ? (Number(p.precio) * (1 - Number(p.descuento) / 100)).toFixed(2) : Number(p.precio).toFixed(2); return <option key={p.id} value={p.id}>{p.nombre} — ${pf}{Number(p.descuento) > 0 ? ` (-${p.descuento}%)` : ''}</option>; })}</select></div>
            <div className="sm:col-span-2 flex gap-3">
              <button type="submit" className="px-6 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-500 transition text-sm font-semibold">Asignar</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 border border-white/10 text-gray-400 rounded-xl hover:bg-white/5 transition text-sm">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Confirm modal */}
      {confirmAssign && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="animate-scaleIn glass-strong rounded-2xl max-w-md w-full p-4 sm:p-6">
            <h3 className="text-lg font-bold text-white mb-3">{confirmAssign.existingActive ? 'Renovar Membresía' : 'Asignar Membresía'}</h3>
            <div className="text-gray-400 mb-4 space-y-2 text-sm">
              <p><span className="text-gray-500">Miembro:</span> <span className="text-white">{confirmAssign.member.nombre}</span></p>
              <p><span className="text-gray-500">Plan:</span> <span className="text-white">{confirmAssign.plan.nombre} — ${confirmAssign.plan.precio}{bcvData?.rate && <span className="text-gray-500 ml-1">({formatBs(confirmAssign.plan.precio, bcvData.rate)})</span>}</span></p>
              {confirmAssign.existingActive && <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-amber-300 text-xs">La membresía actual pasará al historial.</div>}
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmAssign(null)} className="px-4 py-2 text-gray-400 border border-white/10 rounded-xl hover:bg-white/5 transition">Cancelar</button>
              <button onClick={executeAssign} className="px-4 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-500 transition">{confirmAssign.existingActive ? 'Renovar' : 'Asignar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* History modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="animate-scaleIn glass-strong rounded-2xl max-w-lg w-full p-4 sm:p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white truncate mr-2">Historial — {selectedMember?.nombre}</h3>
              <button onClick={() => setShowHistory(false)} className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 rounded-full transition shrink-0">&times;</button>
            </div>
            {history.length === 0 ? <p className="text-gray-600 text-center py-4">Sin historial</p> : (
              <div className="space-y-3">{history.map((h, i) => (
                <div key={h.id} className={`border rounded-xl p-3 ${i === 0 && (h.estado === 'activo' || h.estado === 'por_vencer') ? 'border-brand-500/30 bg-brand-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2"><span className="font-medium text-white text-sm">{h.planes?.nombre}</span>{i === 0 && (h.estado === 'activo' || h.estado === 'por_vencer') && <span className="text-[10px] bg-brand-500/20 text-brand-300 px-1.5 py-0.5 rounded font-semibold">ACTUAL</span>}</div>
                    <Badge estado={h.estado} />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(h.fecha_inicio)} — {formatDate(h.fecha_fin)} | ${Number(h.planes?.precio || 0).toFixed(2)}{bcvData?.rate && ` (${formatBs(h.planes?.precio, bcvData.rate)})`}</p>
                  {(h.estado === 'activo' || h.estado === 'por_vencer') && <p className="text-xs text-brand-400 mt-1 font-medium">{getDaysRemaining(h.fecha_fin)} días restantes</p>}
                </div>
              ))}</div>
            )}
          </div>
        </div>
      )}

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/5">
              <th className="text-left px-2 sm:px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Miembro</th>
              <th className="text-left px-2 sm:px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden sm:table-cell">Plan</th>
              <th className="text-left px-2 sm:px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden sm:table-cell">Inicio</th>
              <th className="text-left px-2 sm:px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Vencimiento</th>
              <th className="text-left px-2 sm:px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden sm:table-cell">Días</th>
              <th className="text-left px-2 sm:px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden sm:table-cell">Estado</th>
              <th className="text-right px-2 sm:px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Acciones</th>
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {latestMembresias.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-600">Sin membresías</td></tr>
              ) : latestMembresias.map((m) => {
                const days = getDaysRemaining(m.fecha_fin);
                return (
                  <tr key={m.id} className="hover:bg-white/[0.02] transition">
                    <td className="px-2 sm:px-4 py-3"><div className="font-medium text-white">{m.profiles?.nombre}</div><div className="text-[11px] text-gray-500 sm:hidden">{m.planes?.nombre} · <Badge estado={m.estado} /></div></td>
                    <td className="px-2 sm:px-4 py-3 text-gray-400 hidden sm:table-cell">{m.planes?.nombre}</td>
                    <td className="px-2 sm:px-4 py-3 text-gray-500 hidden sm:table-cell">{formatDate(m.fecha_inicio)}</td>
                    <td className="px-2 sm:px-4 py-3 text-gray-400">{formatDate(m.fecha_fin)}</td>
                    <td className="px-2 sm:px-4 py-3 hidden sm:table-cell">{m.estado === 'vencido' ? <span className="text-red-400 font-medium">Vencida</span> : <span className={`font-semibold ${days <= 5 ? 'text-amber-400' : 'text-emerald-400'}`}>{days}d</span>}</td>
                    <td className="px-2 sm:px-4 py-3 hidden sm:table-cell"><Badge estado={m.estado} /></td>
                    <td className="px-2 sm:px-4 py-3 text-right"><button onClick={() => viewHistory(m.member_id)} className="w-9 h-9 inline-flex items-center justify-center text-brand-400 bg-brand-500/10 border border-brand-500/20 rounded-full hover:bg-brand-500/20 transition" title="Historial"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ADMIN: ASISTENCIA
// ============================================================

function AttendancePage() {
  const { profile } = useApp();
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);

  const loadData = useCallback(async () => {
    if (!profile?.gym_id) return;
    setLoading(true);
    const [membersRes, attendanceRes] = await Promise.all([
      supabase.from('profiles').select('*, membresias(estado, fecha_fin)').eq('gym_id', profile.gym_id).eq('role', 'member'),
      supabase.from('asistencias').select('*, profiles(nombre, cedula)').eq('gym_id', profile.gym_id).gte('fecha_entrada', dateFilter + 'T00:00:00').lte('fecha_entrada', dateFilter + 'T23:59:59').order('fecha_entrada', { ascending: false }),
    ]);
    setMembers(membersRes.data || []); setAttendance(attendanceRes.data || []); setLoading(false);
  }, [profile?.gym_id, dateFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  async function registerAttendance(member) {
    setError('');
    try {
      const latestMembership = member.membresias?.filter((m) => m.estado === 'activo' || m.estado === 'por_vencer').sort((a, b) => new Date(b.fecha_fin) - new Date(a.fecha_fin))[0];
      if (!latestMembership) { setError(`${member.nombre} no tiene membresía vigente`); return; }
      const { error } = await supabase.from('asistencias').insert({ member_id: member.id, gym_id: profile.gym_id });
      if (error) throw error;
      setSuccess(`Entrada registrada: ${member.nombre}`); setSearch(''); loadData();
    } catch (err) { setError(err.message); }
  }

  const searchResults = search.length >= 2 ? members.filter((m) => m.nombre?.toLowerCase().includes(search.toLowerCase()) || m.cedula?.toLowerCase().includes(search.toLowerCase())) : [];

  if (loading) return <Spinner />;

  return (
    <div className="animate-fadeIn">
      <h1 className="text-2xl font-bold text-white mb-6">Control de Asistencia</h1>
      <ErrorMsg message={error} onClose={() => setError('')} />
      <SuccessMsg message={success} onClose={() => setSuccess('')} />

      <div className="glass rounded-2xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Registrar Entrada</h2>
        <div className="relative">
          <input type="text" placeholder="Buscar miembro..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:ring-2 focus:ring-brand-500/50 outline-none transition text-sm" />
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 glass-strong rounded-xl mt-1 z-10 max-h-60 overflow-y-auto">
              {searchResults.map((m) => {
                const hasActive = m.membresias?.some((mb) => mb.estado === 'activo' || mb.estado === 'por_vencer');
                return (
                  <button key={m.id} onClick={() => registerAttendance(m)} className="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0 flex justify-between items-center transition">
                    <div><span className="font-medium text-white text-sm">{m.nombre}</span><span className="text-gray-500 text-xs ml-2">{m.cedula || ''}</span></div>
                    {hasActive ? <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">Vigente</span> : <span className="text-[10px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full font-semibold">Sin membresía</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="font-semibold text-white text-sm">Asistencias del día</h2>
          <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-300 text-sm focus:ring-2 focus:ring-brand-500/50 outline-none" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/5"><th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">#</th><th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Miembro</th><th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase hidden sm:table-cell">Cédula</th><th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Hora</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {attendance.length === 0 ? <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-600">Sin asistencias</td></tr> : attendance.map((a, i) => (
                <tr key={a.id} className="hover:bg-white/[0.02] transition"><td className="px-4 py-3 text-gray-600">{i + 1}</td><td className="px-4 py-3 font-medium text-white">{a.profiles?.nombre}</td><td className="px-4 py-3 text-gray-400 hidden sm:table-cell">{a.profiles?.cedula || '—'}</td><td className="px-4 py-3 text-gray-400">{formatDateTime(a.fecha_entrada)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-white/5 text-sm text-gray-500">Total: {attendance.length} entrada{attendance.length !== 1 ? 's' : ''}</div>
      </div>
    </div>
  );
}

// ============================================================
// HELPERS: CÁLCULOS FITNESS
// ============================================================

function calcAge(fechaNac) {
  if (!fechaNac) return null;
  const birth = new Date(fechaNac);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function calcBMI(pesoKg, alturaCm) {
  if (!pesoKg || !alturaCm) return null;
  return pesoKg / ((alturaCm / 100) ** 2);
}

function calcBodyFat(bmi, age, sexo) {
  if (!bmi || !age || !sexo) return null;
  // Fórmula Deurenberg
  return sexo === 'masculino'
    ? (1.20 * bmi + 0.23 * age - 16.2)
    : (1.20 * bmi + 0.23 * age - 5.4);
}

function getTrainingPlan(profile) {
  const { nivel_entrenamiento, objetivo_principal, frecuencia_dias, duracion_minutos } = profile;
  if (!nivel_entrenamiento || !objetivo_principal || !frecuencia_dias) return null;

  const objetivoLabels = { hipertrofia: 'Hipertrofia', fuerza: 'Fuerza', perdida_grasa: 'Pérdida de grasa', recomposicion: 'Recomposición corporal' };
  const nivelLabels = { principiante: 'Principiante', intermedio: 'Intermedio', avanzado: 'Avanzado' };

  // Distribución de días según frecuencia y objetivo
  const splits = {
    hipertrofia: {
      2: ['Tren superior', 'Tren inferior'],
      3: ['Push (pecho/hombro/tríceps)', 'Pull (espalda/bíceps)', 'Piernas'],
      4: ['Pecho + Tríceps', 'Espalda + Bíceps', 'Hombros + Core', 'Piernas'],
      5: ['Pecho', 'Espalda', 'Hombros + Trapecios', 'Piernas', 'Brazos + Core'],
      6: ['Push', 'Pull', 'Piernas', 'Push', 'Pull', 'Piernas'],
    },
    fuerza: {
      2: ['Sentadilla + Press banca', 'Peso muerto + Press militar'],
      3: ['Sentadilla + Accesorios', 'Press banca + Accesorios', 'Peso muerto + Press militar'],
      4: ['Sentadilla', 'Press banca', 'Peso muerto', 'Press militar + Accesorios'],
      5: ['Sentadilla pesada', 'Press banca pesado', 'Peso muerto pesado', 'Sentadilla volumen', 'Press banca volumen'],
      6: ['Sentadilla pesada', 'Press banca pesado', 'Peso muerto pesado', 'Sentadilla volumen', 'Press banca volumen', 'Accesorios'],
    },
    perdida_grasa: {
      2: ['Full body + HIIT', 'Full body + Cardio'],
      3: ['Full body + HIIT', 'Tren superior + Cardio', 'Tren inferior + HIIT'],
      4: ['Tren superior + HIIT', 'Tren inferior + Cardio', 'Full body circuito', 'Cardio + Core'],
      5: ['Push + HIIT', 'Pull + Cardio', 'Piernas + HIIT', 'Full body circuito', 'Cardio activo'],
      6: ['Push + HIIT', 'Pull + Cardio', 'Piernas + HIIT', 'Push + Cardio', 'Pull + HIIT', 'Piernas + Cardio'],
    },
    recomposicion: {
      2: ['Fuerza tren superior', 'Fuerza tren inferior'],
      3: ['Push + Cardio moderado', 'Pull + Core', 'Piernas + HIIT'],
      4: ['Push pesado', 'Pull pesado', 'Piernas pesado', 'Full body + Cardio'],
      5: ['Push pesado', 'Pull pesado', 'Piernas pesado', 'Tren superior volumen', 'Tren inferior + HIIT'],
      6: ['Push pesado', 'Pull pesado', 'Piernas pesado', 'Push volumen', 'Pull volumen', 'Piernas + HIIT'],
    },
  };

  const freq = Math.max(2, Math.min(6, frecuencia_dias));
  const days = (splits[objetivo_principal] || splits.hipertrofia)[freq] || [];

  // Tips según objetivo y nivel
  const tips = [];
  if (objetivo_principal === 'hipertrofia') {
    tips.push('Enfócate en la conexión mente-músculo y contracción controlada');
    tips.push('Series de 8-12 repeticiones con descansos de 60-90 segundos');
    if (nivel_entrenamiento === 'principiante') tips.push('Prioriza aprender la técnica correcta antes de subir peso');
    if (nivel_entrenamiento === 'avanzado') tips.push('Incluye técnicas de intensidad: drop sets, superseries, rest-pause');
  } else if (objetivo_principal === 'fuerza') {
    tips.push('Series de 3-6 repeticiones con descansos de 3-5 minutos');
    tips.push('Progresión lineal: aumenta peso cada semana o cada dos semanas');
    if (nivel_entrenamiento === 'principiante') tips.push('Empieza con pesos moderados y perfecciona la técnica');
  } else if (objetivo_principal === 'perdida_grasa') {
    tips.push('Mantén la intensidad alta para maximizar el gasto calórico');
    tips.push('Descansos cortos (30-60s) entre series para mantener la frecuencia cardíaca');
    tips.push('El déficit calórico es clave — combina con buena alimentación');
  } else if (objetivo_principal === 'recomposicion') {
    tips.push('Entrena pesado para mantener masa muscular mientras pierdes grasa');
    tips.push('Prioriza proteína: 1.6-2.2g por kg de peso corporal');
    tips.push('Mantén un déficit calórico moderado, no agresivo');
  }

  if (duracion_minutos && duracion_minutos < 45) tips.push('Con sesiones cortas, prioriza ejercicios compuestos multiarticulares');
  if (duracion_minutos && duracion_minutos >= 90) tips.push('Sesiones largas: incluye calentamiento completo y movilidad al final');

  return {
    objetivo: objetivoLabels[objetivo_principal],
    nivel: nivelLabels[nivel_entrenamiento],
    dias: days,
    tips,
    frecuencia: frecuencia_dias,
    duracion: duracion_minutos,
  };
}

// ============================================================
// MEMBER: CONFIGURACIÓN PERSONAL
// ============================================================

function MemberSettingsPage() {
  const { profile, reloadProfile } = useApp();
  const [tab, setTab] = useState('personal');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [photoPreview, setPhotoPreview] = useState(profile?.foto_url || null);

  const [personal, setPersonal] = useState({
    telefono: profile?.telefono || '',
  });

  const [training, setTraining] = useState({
    fecha_nacimiento: profile?.fecha_nacimiento || '',
    sexo: profile?.sexo || '',
    altura_cm: profile?.altura_cm || '',
    peso_kg: profile?.peso_kg || '',
  });

  const [goals, setGoals] = useState({
    nivel_entrenamiento: profile?.nivel_entrenamiento || '',
    objetivo_principal: profile?.objetivo_principal || '',
    frecuencia_dias: profile?.frecuencia_dias || '',
    duracion_minutos: profile?.duracion_minutos || '',
  });

  useEffect(() => {
    setPersonal({ telefono: profile?.telefono || '' });
    setTraining({
      fecha_nacimiento: profile?.fecha_nacimiento || '',
      sexo: profile?.sexo || '',
      altura_cm: profile?.altura_cm || '',
      peso_kg: profile?.peso_kg || '',
    });
    setGoals({
      nivel_entrenamiento: profile?.nivel_entrenamiento || '',
      objetivo_principal: profile?.objetivo_principal || '',
      frecuencia_dias: profile?.frecuencia_dias || '',
      duracion_minutos: profile?.duracion_minutos || '',
    });
    setPhotoPreview(profile?.foto_url || null);
  }, [profile]);

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('La imagen no debe superar 2MB.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Formato no soportado. Usa JPG, PNG o WebP.'); return; }

    setUploading(true); setError('');
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${profile.id}/avatar.${ext}`;
      await supabase.storage.from('profile-photos').remove([filePath]);
      const { error: uploadError } = await supabase.storage.from('profile-photos').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('profile-photos').getPublicUrl(filePath);
      const fotoUrl = publicUrl + '?t=' + Date.now();
      const { error: updateError } = await supabase.from('profiles').update({ foto_url: fotoUrl }).eq('id', profile.id);
      if (updateError) throw updateError;
      setPhotoPreview(fotoUrl);
      await reloadProfile();
      setSuccess('Foto actualizada');
    } catch (err) { setError(err.message); } finally { setUploading(false); }
  }

  async function handleRemovePhoto() {
    setUploading(true); setError('');
    try {
      const { data: files } = await supabase.storage.from('profile-photos').list(profile.id);
      if (files?.length) await supabase.storage.from('profile-photos').remove(files.map(f => `${profile.id}/${f.name}`));
      const { error } = await supabase.from('profiles').update({ foto_url: null }).eq('id', profile.id);
      if (error) throw error;
      setPhotoPreview(null);
      await reloadProfile();
      setSuccess('Foto eliminada');
    } catch (err) { setError(err.message); } finally { setUploading(false); }
  }

  async function handleSavePersonal(e) {
    e.preventDefault(); setError(''); setSuccess('');
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({
        telefono: personal.telefono.trim() || null,
      }).eq('id', profile.id);
      if (error) throw error;
      await reloadProfile();
      setSuccess('Datos personales guardados');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function handleSaveTraining(e) {
    e.preventDefault(); setError(''); setSuccess('');
    if (!training.fecha_nacimiento) { setError('La fecha de nacimiento es obligatoria.'); return; }
    if (!training.sexo) { setError('Selecciona tu sexo.'); return; }
    if (!training.altura_cm || training.altura_cm < 100 || training.altura_cm > 250) { setError('Altura debe estar entre 100 y 250 cm.'); return; }
    if (!training.peso_kg || training.peso_kg < 30 || training.peso_kg > 300) { setError('Peso debe estar entre 30 y 300 kg.'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({
        fecha_nacimiento: training.fecha_nacimiento,
        sexo: training.sexo,
        altura_cm: parseFloat(training.altura_cm),
        peso_kg: parseFloat(training.peso_kg),
      }).eq('id', profile.id);
      if (error) throw error;
      await reloadProfile();
      setSuccess('Configuración de entrenamiento guardada');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function handleSaveGoals(e) {
    e.preventDefault(); setError(''); setSuccess('');
    if (!goals.nivel_entrenamiento) { setError('Selecciona tu nivel de entrenamiento.'); return; }
    if (!goals.objetivo_principal) { setError('Selecciona tu objetivo principal.'); return; }
    if (!goals.frecuencia_dias) { setError('Indica cuántos días puedes entrenar.'); return; }
    if (!goals.duracion_minutos) { setError('Indica la duración de tus sesiones.'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({
        nivel_entrenamiento: goals.nivel_entrenamiento,
        objetivo_principal: goals.objetivo_principal,
        frecuencia_dias: parseInt(goals.frecuencia_dias),
        duracion_minutos: parseInt(goals.duracion_minutos),
      }).eq('id', profile.id);
      if (error) throw error;
      await reloadProfile();
      setSuccess('Objetivos guardados');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  const age = calcAge(training.fecha_nacimiento);
  const bmi = calcBMI(parseFloat(training.peso_kg), parseFloat(training.altura_cm));
  const bodyFat = calcBodyFat(bmi, age, training.sexo);

  const inputClass = "w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 outline-none transition text-sm";
  const selectClass = "w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 outline-none transition text-sm appearance-none";

  const tabs = [
    { id: 'personal', label: 'Personal', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 'training', label: 'Cuerpo', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
    { id: 'goals', label: 'Objetivos', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  ];

  return (
    <div className="animate-fadeIn max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Mi Perfil</h1>
        <p className="text-gray-500 text-sm mt-1">Configura tus datos personales y de entrenamiento</p>
      </div>

      <ErrorMsg message={error} onClose={() => setError('')} />
      <SuccessMsg message={success} onClose={() => setSuccess('')} />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/[0.03] rounded-xl p-1 border border-white/5">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-brand-600/20 text-brand-400 border border-brand-500/20' : 'text-gray-500 hover:text-gray-300 border border-transparent'
            }`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.icon} /></svg>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* TAB: Personal */}
      {tab === 'personal' && (
        <div>
          {/* Photo */}
          <div className="glass rounded-2xl p-4 sm:p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Foto de Perfil</h2>
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="relative group">
                {photoPreview ? (
                  <img src={photoPreview} alt="Foto" className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-white/10" />
                ) : (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-brand-500/30 to-amber-500/30 rounded-2xl flex items-center justify-center border border-brand-500/20">
                    <span className="text-2xl font-bold text-brand-300">{profile?.nombre?.charAt(0)?.toUpperCase() || '?'}</span>
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-400 mb-3">JPG, PNG o WebP. Máximo 2MB.</p>
                <div className="flex gap-2">
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600/15 text-brand-400 border border-brand-500/20 rounded-xl hover:bg-brand-600/25 transition text-sm font-medium cursor-pointer">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    {photoPreview ? 'Cambiar' : 'Subir foto'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} className="hidden" disabled={uploading} />
                  </label>
                  {photoPreview && (
                    <button onClick={handleRemovePhoto} disabled={uploading} className="px-4 py-2 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition text-sm font-medium">Eliminar</button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Phone */}
          <div className="glass rounded-2xl p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Datos de Contacto</h2>
            <form onSubmit={handleSavePersonal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Nombre</label>
                <input type="text" value={profile?.nombre || ''} disabled className={`${inputClass} opacity-50 cursor-not-allowed`} />
                <p className="text-xs text-gray-600 mt-1">Contacta al administrador para cambiar tu nombre</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
                <input type="text" value={profile?.email || ''} disabled className={`${inputClass} opacity-50 cursor-not-allowed`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Teléfono</label>
                <input type="text" value={personal.telefono} onChange={(e) => setPersonal({ ...personal, telefono: e.target.value })} className={inputClass} placeholder="Ej: +58 412-1234567" />
              </div>
              <div className="pt-2">
                <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-600 to-amber-600 text-white rounded-xl hover:from-brand-500 hover:to-amber-500 disabled:opacity-50 transition text-sm font-semibold shadow-lg shadow-brand-600/20">
                  {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB: Training Config */}
      {tab === 'training' && (
        <div>
          <div className="glass rounded-2xl p-4 sm:p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Datos Corporales</h2>
            <form onSubmit={handleSaveTraining} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Fecha de Nacimiento *</label>
                  <input type="date" value={training.fecha_nacimiento} onChange={(e) => setTraining({ ...training, fecha_nacimiento: e.target.value })} className={inputClass} max={new Date().toISOString().split('T')[0]} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Sexo *</label>
                  <select value={training.sexo} onChange={(e) => setTraining({ ...training, sexo: e.target.value })} className={selectClass}>
                    <option value="">Seleccionar...</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Altura (cm) *</label>
                  <input type="number" step="0.1" min="100" max="250" value={training.altura_cm} onChange={(e) => setTraining({ ...training, altura_cm: e.target.value })} className={inputClass} placeholder="Ej: 175" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1.5">Peso (kg) *</label>
                  <input type="number" step="0.1" min="30" max="300" value={training.peso_kg} onChange={(e) => setTraining({ ...training, peso_kg: e.target.value })} className={inputClass} placeholder="Ej: 75" />
                </div>
              </div>
              <div className="pt-2">
                <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-600 to-amber-600 text-white rounded-xl hover:from-brand-500 hover:to-amber-500 disabled:opacity-50 transition text-sm font-semibold shadow-lg shadow-brand-600/20">
                  {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>

          {/* Calculated metrics */}
          {(age || bmi) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {age && (
                <div className="glass rounded-2xl p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Edad</p>
                  <p className="text-2xl font-bold text-white mt-1">{age}</p>
                  <p className="text-xs text-gray-600">años</p>
                </div>
              )}
              {bmi && (
                <div className="glass rounded-2xl p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">IMC</p>
                  <p className={`text-2xl font-bold mt-1 ${bmi < 18.5 ? 'text-blue-400' : bmi < 25 ? 'text-emerald-400' : bmi < 30 ? 'text-amber-400' : 'text-red-400'}`}>{bmi.toFixed(1)}</p>
                  <p className="text-xs text-gray-600">{bmi < 18.5 ? 'Bajo peso' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Sobrepeso' : 'Obesidad'}</p>
                </div>
              )}
              {bodyFat && bodyFat > 0 && (
                <div className="glass rounded-2xl p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">% Grasa</p>
                  <p className="text-2xl font-bold text-brand-400 mt-1">{bodyFat.toFixed(1)}%</p>
                  <p className="text-xs text-gray-600">corporal</p>
                </div>
              )}
              {training.peso_kg && training.altura_cm && (
                <div className="glass rounded-2xl p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Masa magra</p>
                  <p className="text-2xl font-bold text-cyan-400 mt-1">{bodyFat && bodyFat > 0 ? (parseFloat(training.peso_kg) * (1 - bodyFat / 100)).toFixed(1) : '—'}</p>
                  <p className="text-xs text-gray-600">kg estimados</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB: Goals */}
      {tab === 'goals' && (
        <div className="glass rounded-2xl p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Nivel y Objetivos</h2>
          <form onSubmit={handleSaveGoals} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Nivel de Entrenamiento *</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'principiante', label: 'Principiante', desc: '0-1 año' },
                  { value: 'intermedio', label: 'Intermedio', desc: '1-3 años' },
                  { value: 'avanzado', label: 'Avanzado', desc: '3+ años' },
                ].map((opt) => (
                  <button key={opt.value} type="button" onClick={() => setGoals({ ...goals, nivel_entrenamiento: opt.value })}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      goals.nivel_entrenamiento === opt.value
                        ? 'bg-brand-600/20 border-brand-500/30 text-brand-400'
                        : 'bg-white/[0.03] border-white/5 text-gray-400 hover:border-white/10'
                    }`}>
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Objetivo Principal *</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'hipertrofia', label: 'Hipertrofia', icon: '💪', desc: 'Ganar masa muscular' },
                  { value: 'fuerza', label: 'Fuerza', icon: '🏋️', desc: 'Aumentar fuerza máxima' },
                  { value: 'perdida_grasa', label: 'Pérdida de grasa', icon: '🔥', desc: 'Reducir grasa corporal' },
                  { value: 'recomposicion', label: 'Recomposición', icon: '⚡', desc: 'Ganar músculo y perder grasa' },
                ].map((opt) => (
                  <button key={opt.value} type="button" onClick={() => setGoals({ ...goals, objetivo_principal: opt.value })}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      goals.objetivo_principal === opt.value
                        ? 'bg-brand-600/20 border-brand-500/30 text-brand-400'
                        : 'bg-white/[0.03] border-white/5 text-gray-400 hover:border-white/10'
                    }`}>
                    <p className="text-lg mb-1">{opt.icon}</p>
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Frecuencia (días/semana) *</label>
                <select value={goals.frecuencia_dias} onChange={(e) => setGoals({ ...goals, frecuencia_dias: e.target.value })} className={selectClass}>
                  <option value="">Seleccionar...</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{d} {d === 1 ? 'día' : 'días'}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">Duración por sesión *</label>
                <select value={goals.duracion_minutos} onChange={(e) => setGoals({ ...goals, duracion_minutos: e.target.value })} className={selectClass}>
                  <option value="">Seleccionar...</option>
                  {[30, 45, 60, 75, 90, 120].map((m) => <option key={m} value={m}>{m} minutos</option>)}
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-600 to-amber-600 text-white rounded-xl hover:from-brand-500 hover:to-amber-500 disabled:opacity-50 transition text-sm font-semibold shadow-lg shadow-brand-600/20">
                {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                {loading ? 'Guardando...' : 'Guardar objetivos'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MEMBER: MI MEMBRESÍA
// ============================================================

function MyMembershipPage({ onNavigate }) {
  const { profile, bcv: bcvData } = useApp();
  const [membership, setMembership] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase.from('membresias').select('*, planes(nombre, precio, duracion_dias)').eq('member_id', profile.id).order('created_at', { ascending: false });
      const all = data || [];
      const active = all.find((m) => m.estado === 'activo' || m.estado === 'por_vencer') || all[0] || null;
      setMembership(active); setHistory(all); setLoading(false);
    }
    load();
  }, [profile.id]);

  function getDaysRemaining(fechaFin) { const t = new Date(); t.setHours(0,0,0,0); const e = new Date(fechaFin); e.setHours(0,0,0,0); return Math.ceil((e - t) / 86400000); }

  if (loading) return <Spinner />;
  const daysLeft = membership ? getDaysRemaining(membership.fecha_fin) : 0;

  // Fitness calculations
  const age = calcAge(profile.fecha_nacimiento);
  const bmi = calcBMI(profile.peso_kg, profile.altura_cm);
  const bodyFat = calcBodyFat(bmi, age, profile.sexo);
  const plan = getTrainingPlan(profile);
  const hasProfile = profile.fecha_nacimiento && profile.sexo && profile.altura_cm && profile.peso_kg;
  const hasGoals = profile.nivel_entrenamiento && profile.objetivo_principal && profile.frecuencia_dias;

  return (
    <div className="animate-fadeIn">
      <h1 className="text-2xl font-bold text-white mb-6">Mi Membresía</h1>

      {/* Fitness Dashboard */}
      {hasProfile && hasGoals ? (
        <div className="mb-6 space-y-4">
          {/* Metrics cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass rounded-2xl p-4 card-hover">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Edad</p>
              <p className="text-xl font-bold text-white mt-1">{age} <span className="text-xs text-gray-500 font-normal">años</span></p>
            </div>
            <div className="glass rounded-2xl p-4 card-hover">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">IMC</p>
              <p className={`text-xl font-bold mt-1 ${bmi < 18.5 ? 'text-blue-400' : bmi < 25 ? 'text-emerald-400' : bmi < 30 ? 'text-amber-400' : 'text-red-400'}`}>{bmi?.toFixed(1)}</p>
              <p className="text-[10px] text-gray-600">{bmi < 18.5 ? 'Bajo peso' : bmi < 25 ? 'Normal' : bmi < 30 ? 'Sobrepeso' : 'Obesidad'}</p>
            </div>
            {bodyFat && bodyFat > 0 && (
              <div className="glass rounded-2xl p-4 card-hover">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">% Grasa</p>
                <p className="text-xl font-bold text-brand-400 mt-1">{bodyFat.toFixed(1)}%</p>
                <p className="text-[10px] text-gray-600">corporal</p>
              </div>
            )}
            {bodyFat && bodyFat > 0 && (
              <div className="glass rounded-2xl p-4 card-hover">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Masa magra</p>
                <p className="text-xl font-bold text-cyan-400 mt-1">{(Number(profile.peso_kg) * (1 - bodyFat / 100)).toFixed(1)} <span className="text-xs text-gray-500 font-normal">kg</span></p>
              </div>
            )}
          </div>

          {/* Training Plan */}
          {plan && (
            <div className="glass rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-white">Plan de Entrenamiento</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{plan.nivel} — {plan.objetivo} — {plan.frecuencia} días/sem — {plan.duracion} min</p>
                </div>
                <button onClick={() => onNavigate('my-profile')} className="text-xs text-brand-400 hover:text-brand-300 transition">Editar</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
                {plan.dias.map((day, i) => (
                  <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-500 uppercase font-semibold">Día {i + 1}</p>
                    <p className="text-xs text-white font-medium mt-1 leading-tight">{day}</p>
                  </div>
                ))}
              </div>
              {plan.tips.length > 0 && (
                <div className="bg-brand-600/10 border border-brand-500/15 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-brand-400 uppercase tracking-wider mb-2">Tips y Sugerencias</p>
                  <ul className="space-y-1.5">
                    {plan.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                        <svg className="w-3.5 h-3.5 text-brand-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" /></svg>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="glass rounded-2xl p-5 mb-6 border border-brand-500/15">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-11 h-11 bg-brand-600/15 border border-brand-500/20 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Completa tu perfil de entrenamiento</p>
              <p className="text-xs text-gray-500 mt-0.5">Configura tus datos corporales y objetivos para recibir tu plan de entrenamiento personalizado, métricas y sugerencias.</p>
            </div>
            <button onClick={() => onNavigate('my-profile')} className="px-4 py-2 bg-gradient-to-r from-brand-600 to-amber-600 text-white rounded-xl hover:from-brand-500 hover:to-amber-500 transition text-sm font-semibold shadow-lg shadow-brand-600/20 whitespace-nowrap">
              Configurar perfil
            </button>
          </div>
        </div>
      )}

      {membership ? (
        <div className="glass rounded-2xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-bold text-white">Plan {membership.planes?.nombre}</h2>
              <p className="text-gray-500 text-sm">{membership.planes?.duracion_dias} días de acceso</p>
            </div>
            <Badge estado={membership.estado} />
          </div>

          {(membership.estado === 'activo' || membership.estado === 'por_vencer') && (
            <div className="mb-5 bg-white/[0.03] rounded-xl p-4 border border-white/5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-500">Días restantes</span>
                <span className={`text-2xl font-bold ${daysLeft <= 5 ? 'text-amber-400' : 'text-emerald-400'}`}>{daysLeft}</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all ${daysLeft <= 5 ? 'bg-gradient-to-r from-amber-500 to-red-500' : 'bg-gradient-to-r from-brand-500 to-emerald-500'}`} style={{ width: `${Math.max(0, Math.min(100, (daysLeft / (membership.planes?.duracion_dias || 30)) * 100))}%` }}></div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5"><p className="text-xs text-gray-500 uppercase tracking-wider">Inicio</p><p className="font-semibold text-white mt-1">{formatDate(membership.fecha_inicio)}</p></div>
            <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5"><p className="text-xs text-gray-500 uppercase tracking-wider">Vencimiento</p><p className="font-semibold text-white mt-1">{formatDate(membership.fecha_fin)}</p></div>
            <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5"><p className="text-xs text-gray-500 uppercase tracking-wider">Precio</p><p className="font-semibold text-white mt-1">${Number(membership.planes?.precio || 0).toFixed(2)}</p>{bcvData?.rate && <p className="text-xs text-gray-500 mt-0.5">{formatBs(membership.planes?.precio, bcvData.rate)}</p>}</div>
          </div>

          {membership.estado === 'por_vencer' && <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-sm text-amber-300 flex items-center gap-2"><svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" /></svg>Vence en <strong>{daysLeft} días</strong>. Contacta al administrador.</div>}
          {membership.estado === 'vencido' && <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-300 flex items-center gap-2"><svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" /></svg>Tu membresía ha vencido. Contacta al administrador.</div>}
        </div>
      ) : (
        <div className="glass rounded-2xl p-8 text-center mb-6"><p className="text-gray-500">No tienes membresía activa. Contacta al administrador.</p></div>
      )}

      {history.length > 1 && (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5"><h2 className="font-semibold text-white text-sm">Historial</h2></div>
          <div className="divide-y divide-white/5">
            {history.filter((h) => h.id !== membership?.id).map((h) => (
              <div key={h.id} className="px-4 py-3 flex justify-between items-center">
                <div><span className="font-medium text-gray-300 text-sm">{h.planes?.nombre}</span><span className="text-xs text-gray-600 ml-2">{formatDate(h.fecha_inicio)} — {formatDate(h.fecha_fin)}</span></div>
                <Badge estado={h.estado} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MEMBER: MI ASISTENCIA
// ============================================================

function MyAttendancePage() {
  const { profile } = useApp();
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase.from('asistencias').select('*').eq('member_id', profile.id).order('fecha_entrada', { ascending: false }).limit(100);
      setAttendance(data || []); setLoading(false);
    }
    load();
  }, [profile.id]);

  if (loading) return <Spinner />;
  const thisMonth = attendance.filter((a) => { const d = new Date(a.fecha_entrada); const now = new Date(); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;

  return (
    <div className="animate-fadeIn">
      <h1 className="text-2xl font-bold text-white mb-6">Mi Asistencia</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard label="Este mes" value={thisMonth} color="bg-brand-600" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        <StatCard label="Total" value={attendance.length} color="bg-brand-600" icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </div>
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/5"><h2 className="font-semibold text-white text-sm">Historial</h2></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/5"><th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">#</th><th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Fecha</th><th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase">Hora</th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {attendance.length === 0 ? <tr><td colSpan="3" className="px-4 py-8 text-center text-gray-600">Sin asistencias</td></tr> : attendance.map((a, i) => (
                <tr key={a.id} className="hover:bg-white/[0.02] transition"><td className="px-4 py-3 text-gray-600">{i + 1}</td><td className="px-4 py-3 text-white">{formatDate(a.fecha_entrada)}</td><td className="px-4 py-3 text-gray-400">{new Date(a.fecha_entrada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MEMBER: PLANES DISPONIBLES
// ============================================================

function AvailablePlansPage() {
  const { profile, bcv: bcvData } = useApp();
  const [planes, setPlanes] = useState([]);
  const [loading, setLoading] = useState(true);

  const CATEGORIAS = [
    { id: 'inscripcion', label: 'Inscripción', color: 'emerald' },
    { id: 'sesion', label: 'Sesiones', color: 'blue' },
    { id: 'individual', label: 'Planes Individuales', color: 'brand' },
    { id: 'grupal', label: 'Planes Grupales', color: 'violet' },
    { id: 'asesoria', label: 'Asesorías Personalizadas', color: 'amber' },
  ];

  useEffect(() => {
    async function load() {
      if (!profile?.gym_id) return;
      setLoading(true);
      const { data } = await supabase.from('planes').select('*').eq('gym_id', profile.gym_id).eq('activo', true).order('precio');
      setPlanes(data || []); setLoading(false);
    }
    load();
  }, [profile?.gym_id]);

  if (loading) return <Spinner />;

  function getPrecioFinal(plan) {
    const p = Number(plan.precio);
    const d = Number(plan.descuento || 0);
    return d > 0 ? p * (1 - d / 100) : p;
  }

  return (
    <div className="animate-fadeIn">
      <h1 className="text-2xl font-bold text-white mb-6">Planes Disponibles</h1>

      {CATEGORIAS.map((cat) => {
        const catPlans = planes.filter((p) => (p.categoria || 'individual') === cat.id);
        if (catPlans.length === 0) return null;
        return (
          <div key={cat.id} className="mb-8">
            <h2 className={`text-sm font-bold uppercase tracking-wider mb-4 ${cat.color === 'brand' ? 'text-brand-400' : cat.color === 'emerald' ? 'text-emerald-400' : cat.color === 'blue' ? 'text-blue-400' : cat.color === 'violet' ? 'text-violet-400' : 'text-amber-400'}`}>{cat.label}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {catPlans.map((plan) => {
                const finalPrice = getPrecioFinal(plan);
                const hasDiscount = Number(plan.descuento) > 0;
                return (
                  <div key={plan.id} className="glass rounded-2xl p-6 card-hover relative overflow-hidden">
                    {hasDiscount && (
                      <div className="absolute top-3 right-3 px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold">-{Number(plan.descuento)}%</div>
                    )}
                    <h3 className="text-lg font-bold text-white">{plan.nombre}</h3>
                    {plan.descripcion && <p className="text-gray-500 text-sm mt-0.5">{plan.descripcion}</p>}
                    <p className="text-xs text-gray-600 mt-1">{plan.duracion_dias} {plan.duracion_dias === 1 ? 'día' : 'días'} de acceso</p>
                    <div className="mt-4 flex items-baseline gap-2">
                      <p className="text-3xl font-extrabold text-white">${finalPrice.toFixed(2)}</p>
                      {hasDiscount && <p className="text-sm text-gray-600 line-through">${Number(plan.precio).toFixed(2)}</p>}
                    </div>
                    {bcvData?.rate && <p className="text-sm text-gray-400 mt-0.5">{formatBs(finalPrice, bcvData.rate)}</p>}
                    <p className="text-xs text-gray-600 mt-3 pt-3 border-t border-white/5">Contacta al administrador para suscribirte</p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {planes.length === 0 && <p className="text-gray-600 text-center py-8">No hay planes disponibles</p>}
    </div>
  );
}

// ============================================================
// ADMIN: CONFIGURACIÓN DEL GYM
// ============================================================

function SettingsPage() {
  const { profile, gym, reloadGym, bcv: bcvData } = useApp();
  const [form, setForm] = useState({ nombre: '', direccion: '', telefono: '' });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [logoPreview, setLogoPreview] = useState(null);

  useEffect(() => {
    if (gym) {
      setForm({ nombre: gym.nombre || '', direccion: gym.direccion || '', telefono: gym.telefono || '' });
      setLogoPreview(gym.logo_url || null);
    }
  }, [gym]);

  async function handleSave(e) {
    e.preventDefault(); setError(''); setSuccess('');
    if (!form.nombre.trim()) { setError('El nombre del gimnasio es obligatorio.'); return; }
    setLoading(true);
    try {
      const { error, data } = await supabase.from('gyms').update({
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim() || null,
        telefono: form.telefono.trim() || null,
      }).eq('id', gym.id).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('No se pudo actualizar. Verifica los permisos.');
      await reloadGym();
      setSuccess('Configuración guardada');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('La imagen no debe superar 2MB.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) { setError('Formato no soportado. Usa JPG, PNG, WebP o SVG.'); return; }

    setUploading(true); setError('');
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${gym.id}/logo.${ext}`;

      // Remove old logo if exists
      await supabase.storage.from('gym-logos').remove([filePath]);

      const { error: uploadError } = await supabase.storage.from('gym-logos').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('gym-logos').getPublicUrl(filePath);
      const logoUrl = publicUrl + '?t=' + Date.now(); // cache bust

      const { error: updateError } = await supabase.from('gyms').update({ logo_url: logoUrl }).eq('id', gym.id);
      if (updateError) throw updateError;

      setLogoPreview(logoUrl);
      await reloadGym();
      setSuccess('Logo actualizado');
    } catch (err) { setError(err.message); } finally { setUploading(false); }
  }

  async function handleRemoveLogo() {
    setUploading(true); setError('');
    try {
      // List and remove all files in the gym's folder
      const { data: files } = await supabase.storage.from('gym-logos').list(gym.id);
      if (files?.length) {
        await supabase.storage.from('gym-logos').remove(files.map(f => `${gym.id}/${f.name}`));
      }
      const { error } = await supabase.from('gyms').update({ logo_url: null }).eq('id', gym.id);
      if (error) throw error;
      setLogoPreview(null);
      await reloadGym();
      setSuccess('Logo eliminado');
    } catch (err) { setError(err.message); } finally { setUploading(false); }
  }

  if (!gym) return <Spinner />;

  const inputClass = "w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-600 focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 outline-none transition text-sm";

  return (
    <div className="animate-fadeIn max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Configuración</h1>
        <p className="text-gray-500 text-sm mt-1">Personaliza tu gimnasio</p>
      </div>

      <ErrorMsg message={error} onClose={() => setError('')} />
      <SuccessMsg message={success} onClose={() => setSuccess('')} />

      {/* Logo Section */}
      <div className="glass rounded-2xl p-4 sm:p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Logotipo</h2>
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="relative group">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-white/10" />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-brand-500 to-amber-600 rounded-2xl flex items-center justify-center">
                <svg className="w-10 h-10 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/60 rounded-2xl flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-400 mb-3">JPG, PNG, WebP o SVG. Máximo 2MB.</p>
            <div className="flex gap-2">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600/15 text-brand-400 border border-brand-500/20 rounded-xl hover:bg-brand-600/25 transition text-sm font-medium cursor-pointer">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                {logoPreview ? 'Cambiar' : 'Subir logo'}
                <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" onChange={handleLogoUpload} className="hidden" disabled={uploading} />
              </label>
              {logoPreview && (
                <button onClick={handleRemoveLogo} disabled={uploading} className="px-4 py-2 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition text-sm font-medium">
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Gym Info Form */}
      <div className="glass rounded-2xl p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Información del Gimnasio</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Nombre del Gimnasio *</label>
            <input type="text" required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={inputClass} placeholder="Ej: Power Fitness" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Dirección</label>
            <input type="text" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} className={inputClass} placeholder="Ej: Av. Principal #123" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Teléfono</label>
            <input type="text" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className={inputClass} placeholder="Ej: +58 412-1234567" />
          </div>
          <div className="pt-2">
            <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-brand-600 to-amber-600 text-white rounded-xl hover:from-brand-500 hover:to-amber-500 disabled:opacity-50 transition text-sm font-semibold shadow-lg shadow-brand-600/20">
              {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
              {loading ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>

      {/* BCV Rate Info */}
      <div className="glass rounded-2xl p-4 sm:p-6 mt-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Tasa de Cambio BCV</h2>
        {bcvData?.rate ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-bold text-white">1 USD = Bs {bcvData.rate.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</p>
              <p className="text-xs text-gray-500 mt-1">Fuente: BCV Oficial — Actualizado: {new Date(bcvData.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
              <p className="text-xs text-gray-600 mt-0.5">Se actualiza automáticamente cada 8 horas</p>
            </div>
            <div className="w-11 h-11 bg-emerald-600/15 border border-emerald-500/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No se pudo obtener la tasa. Se reintentará automáticamente.</p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// APP PRINCIPAL
// ============================================================

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [gym, setGym] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const bcv = useBcvRate();

  const loadGym = useCallback(async (gymId) => {
    if (!gymId) return;
    const { data } = await supabase.from('gyms').select('*').eq('id', gymId).single();
    if (data) setGym(data);
  }, []);

  const reloadGym = useCallback(async () => {
    if (profile?.gym_id) await loadGym(profile.gym_id);
  }, [profile?.gym_id, loadGym]);

  const reloadProfile = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (data) setProfile(data);
  }, [session?.user?.id]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); if (!session) setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); if (!session) { setProfile(null); setGym(null); setLoading(false); } });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadProfile() {
      if (!session?.user) return;
      setLoading(true);
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (data) {
        setProfile(data);
        setView(data.role === 'admin' ? 'dashboard' : 'my-membership');
        if (data.gym_id) await loadGym(data.gym_id);
      }
      setLoading(false);
    }
    loadProfile();
  }, [session?.user?.id, loadGym]);

  async function handleLogout() { await supabase.auth.signOut(); setSession(null); setProfile(null); }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f13] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-3 border-white/10 border-t-brand-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">Cargando GymFlow...</p>
        </div>
      </div>
    );
  }

  if (!session) return <AuthPage />;
  if (!profile) return <Spinner />;

  function renderView() {
    switch (view) {
      case 'dashboard': return <AdminDashboard />;
      case 'members': return <MembersPage />;
      case 'plans': return <PlansPage />;
      case 'memberships': return <MembershipsPage />;
      case 'attendance': return <AttendancePage />;
      case 'my-membership': return <MyMembershipPage onNavigate={setView} />;
      case 'my-attendance': return <MyAttendancePage />;
      case 'available-plans': return <AvailablePlansPage />;
      case 'my-profile': return <MemberSettingsPage />;
      case 'settings': return <SettingsPage />;
      default: return <AdminDashboard />;
    }
  }

  return (
    <AppContext.Provider value={{ profile, session, gym, reloadGym, reloadProfile, bcv }}>
      <div className="flex min-h-screen bg-[#0f0f13]">
        <div className="hidden lg:block"><Sidebar currentView={view} setView={setView} profile={profile} onLogout={handleLogout} /></div>
        <MobileSidebar currentView={view} setView={setView} profile={profile} onLogout={handleLogout} open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
        <MobileMoreMenu open={moreMenuOpen} onClose={() => setMoreMenuOpen(false)} setView={setView} profile={profile} onLogout={handleLogout} />
        <div className="flex-1 min-w-0">
          <header className="lg:hidden bg-[#12121a]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-center sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <GymLogo gym={gym} size="sm" />
              <span className="font-bold text-white text-sm truncate max-w-[180px]">{gym?.nombre || 'GymFlow'}</span>
            </div>
          </header>
          <main className="p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8 max-w-7xl">{renderView()}</main>
        </div>
        <BottomNav currentView={view} setView={setView} profile={profile} onLogout={handleLogout} onMore={() => setMoreMenuOpen(true)} />
      </div>
    </AppContext.Provider>
  );
}
