import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Lock, User } from 'lucide-react';
import Monitor from './Monitor';

type SessionUser = {
  uid: number;
  account: string;
  roleid: number;
};

type AuthResponse = {
  code: number;
  result?: boolean;
  token?: string;
  user?: SessionUser;
  error?: string;
};

function AnimatedBrand() {
  return (
    <div className="brand-wrap" aria-label="CustomServiciosRS">
      <svg className="brand-logo" viewBox="0 0 1024 1024" role="img">
        <defs>
          <linearGradient id="fleet-cyan" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#00e5ff" />
            <stop offset="100%" stopColor="#007bff" />
          </linearGradient>
          <linearGradient id="fleet-gold" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#ff9100" />
            <stop offset="100%" stopColor="#ffcc00" />
          </linearGradient>
          <filter id="fleet-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur result="blur" stdDeviation="15" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <path d="M720,512c0,114.9-93.1,208-208,208S304,626.9,304,512s93.1-208,208-208c45.4,0,87.4,14.6,121.7,39.3"
          fill="none" filter="url(#fleet-glow)" stroke="url(#fleet-cyan)" strokeLinecap="round" strokeWidth="80">
          <animate attributeName="stroke-dasharray" dur="3s" fill="freeze" from="0, 2000" to="2000, 0" />
          <animate attributeName="opacity" dur="4s" repeatCount="indefinite" values="0.8;1;0.8" />
        </path>
        <circle cx="650" cy="350" fill="url(#fleet-gold)" filter="url(#fleet-glow)" r="100">
          <animateTransform attributeName="transform" dur="3s" repeatCount="indefinite"
            type="translate" values="0,0; 0,-20; 0,0" />
        </circle>
        <path d="M550,350 Q600,350 650,350" stroke="url(#fleet-gold)" strokeLinecap="round" strokeWidth="60">
          <animateTransform attributeName="transform" dur="3s" repeatCount="indefinite"
            type="translate" values="0,0; 0,-10; 0,0" />
        </path>
        <circle cx="512" cy="512" fill="white" r="10">
          <animate attributeName="r" dur="5s" repeatCount="indefinite" values="0;150;0" />
          <animate attributeName="opacity" dur="5s" repeatCount="indefinite" values="0;0.3;0" />
        </circle>
      </svg>
      <div className="brand-name">
        <span className="brand-custom">Custom</span>
        <span className="brand-services">Servicios<span className="brand-r">R</span><span className="brand-s">S</span></span>
      </div>
      <div className="brand-tagline">
        <span>Tecnologia</span><i /><span>Seguridad</span><i /><span>Confianza</span>
      </div>
    </div>
  );
}

export default function App() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<{ token: string; user: SessionUser } | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('ceiba_fleet_session');
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (parsed?.token && parsed?.user) setSession(parsed);
    } catch {
      sessionStorage.removeItem('ceiba_fleet_session');
    }
  }, []);

  const roleLabel = useMemo(() => {
    if (!session) return '';
    return session.user.roleid === 1 ? 'Administrador Ceiba II' : `Rol Ceiba II #${session.user.roleid}`;
  }, [session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const data = new FormData(event.currentTarget);
    const username = String(data.get('username') || '').trim();
    const password = String(data.get('password') || '');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const result = await response.json() as AuthResponse;
      if (!response.ok || result.code !== 200 || !result.token || !result.user) {
        throw new Error(result.error || 'Credenciales invalidas');
      }
      const nextSession = { token: result.token, user: result.user };
      sessionStorage.setItem('ceiba_fleet_session', JSON.stringify(nextSession));
      setSession(nextSession);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo conectar con Ceiba II');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    sessionStorage.removeItem('ceiba_fleet_session');
    setSession(null);
  }

  if (session) {
    return (
      <Monitor
        token={session.token}
        username={session.user.account}
        onLogout={logout}
      />
    );
  }

  return (
    <main className="shell">
      <div className="grid-bg" />
      <section className="login-layout">
        <AnimatedBrand />
        <p className="intro">Control inteligente de flotas, GPS, rutas, geocercas y alarmas.</p>
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="accent-line" />
          <label htmlFor="username">Usuario</label>
          <div className="input-wrap">
            <User size={20} />
            <input id="username" name="username" autoComplete="username" placeholder="Usuario Ceiba II" required />
          </div>
          <label htmlFor="password">Contrasena</label>
          <div className="input-wrap">
            <Lock size={20} />
            <input id="password" name="password" type={showPassword ? 'text' : 'password'}
              autoComplete="current-password" placeholder="Contrasena Ceiba II" required />
            <button type="button" className="eye-button" onClick={() => setShowPassword(v => !v)}
              aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}>
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {error && <div className="error-box">{error}</div>}
          <button className="primary-button" type="submit" disabled={loading}>
            <span>{loading ? 'Validando...' : 'Ingresar'}</span>
            <ArrowRight size={20} />
          </button>
          <p className="login-note">Acceso con las mismas credenciales y vigencia de cuenta del servidor Ceiba II.</p>
        </form>
        <footer>CustomServiciosRS · Ceiba Fleet</footer>
      </section>
    </main>
  );
}
