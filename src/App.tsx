import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BUILD_VERSION } from './build-version';
import { Vehicle, Geofence, AlertItem, LibraryRecord, DownloadJob, TabType } from './types';
import { Header } from './components/Header';
import { NavigationDrawer } from './components/NavigationDrawer';
import { MapView } from './components/MapView';
import { UnitInfoSheet } from './components/UnitInfoSheet';
import { CameraStreamOverlay } from './components2/CameraStreamOverlay';
import { BottomNavBar } from './components/BottomNavBar';
import { DetailModal } from './components/DetailModal';
import { AlertasView } from './components/AlertasView';
import { GeocercasView } from './components/GeocercasView';
import { DownloaderLibraryView } from './components/DownloaderLibraryView';
import { RastreoView } from './components/RastreoView';
import { DespachoView } from './components/DespachoView';
import { RecorridoView, RecorridoSelection } from './components/RecorridoView';
import { DescargasView } from './components/DescargasView';
import { EvidenceTrackerView } from './components/EvidenceTrackerView';
import { SettingsModal } from './components/SettingsModal';
import { VideoPreviewModal } from './components/VideoPreviewModal';
import { VueltasView } from './components/VueltasView';
import { User, Lock, ArrowRight, Monitor, Download, ChevronUp, ChevronDown } from 'lucide-react';

interface AuthState {
  user: any;
  token: string | null;
}

export default function App() {
  const query = new URLSearchParams(window.location.search);
  const embeddedVivo = query.get('embed') === 'vivo';
  const androidApp = query.get('app') === 'android';
  const embeddedShell = embeddedVivo || androidApp;
  useEffect(() => {
    let navigating = false;
    const checkVersion = async () => {
      if (navigating) return;
      try {
        const response = await fetch('/build-version.json?t=' + Date.now(), {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (!response.ok) return;
        const { version } = await response.json();
        if (version && version !== BUILD_VERSION) {
          navigating = true;
          const next = new URL(window.location.href);
          next.searchParams.set('v', version);
          window.location.replace(next.toString());
        }
      } catch { /* Keep the current session if offline. */ }
    };
    void checkVersion();
    const onVisible = () => { if (document.visibilityState === 'visible') void checkVersion(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', checkVersion);
    const timer = window.setInterval(checkVersion, 60_000);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', checkVersion);
    };
  }, []);
  // Primary States
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [library, setLibrary] = useState<LibraryRecord[]>([]);
  const [downloads, setDownloads] = useState<DownloadJob[]>([]);

  // Navigation & Modals
  const [activeTab, setActiveTab] = useState<TabType>('vivo');
  const [vivoChromeHidden, setVivoChromeHidden] = useState(false);
  const [recorridoChromeHidden, setRecorridoChromeHidden] = useState(false);
  const headerTouchY = useRef<number | null>(null);
  const [recorridoSelection, setRecorridoSelection] = useState<RecorridoSelection | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isVideoOverlayOpen, setIsVideoOverlayOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<any | null>(null);

  // Auth States
  const [auth, setAuth] = useState<AuthState>({ user: null, token: null });
  const [showSplash, setShowSplash] = useState(!embeddedShell);
  const [showLogin, setShowLogin] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const loginEpoch = useRef(0);

  const handleLogout = () => {
    loginEpoch.current += 1;
    localStorage.removeItem('csrs_auth');
    setAuth({ user: null, token: null });
    setIsSettingsModalOpen(false);
    setIsDrawerOpen(false);
    setIsVideoOverlayOpen(false);
    setIsDetailModalOpen(false);
    setPreviewTarget(null);
    setSelectedVehicle(null);
    setVehicles([]);
    setShowLogin(true);
    setLoginError('');
  };

  // Load auth from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('csrs_auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.token && parsed.user) {
          const claim = JSON.parse(atob(parsed.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
          if (Number(claim.exp) * 1000 > Date.now()) setAuth(parsed);
          else { localStorage.removeItem('csrs_auth'); setLoginError('Su sesion vencio. Inicie sesion nuevamente.'); }
        }
      } catch (e) { localStorage.removeItem('csrs_auth'); }
    }
  }, []);

  // Splash screen
  useEffect(() => {
    if (embeddedShell) {
      setShowSplash(false);
      setShowLogin(!auth.token);
      return;
    }
    const timer = setTimeout(() => {
      setShowSplash(false);
      setShowLogin(!auth.token);
    }, 2000);
    return () => clearTimeout(timer);
  }, [auth.token, embeddedShell]);

  // Helpers to normalize API responses (handles both new mock API and old Ceiba 12058 API wrapped in {code,result})
  const normalizeArray = <T,>(data: any, fallback: T[]): T[] => {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.result)) return data.result;
    if (data && data.code === 200 && Array.isArray(data.result)) return data.result;
    return fallback;
  };
  const normalizeVehicles = (data: any): Vehicle[] => {
    const rows = Array.isArray(data) ? data : data && Array.isArray(data.result) ? data.result : [];
    return rows.filter((item: any): item is Vehicle => Boolean(item?.id && item?.unitNumber && item?.status));
  };

  // Fetch initial data with fallbacks
  const fetchData = useCallback(async () => {
    const token = (() => { try { const s = localStorage.getItem('csrs_auth'); if (s) return JSON.parse(s).token; } catch {} return null; })();
    const headers: Record<string,string> = token ? { 'Authorization': 'Bearer ' + token } : {};
    const safeFetch = async (url: string, fallback: any) => {
      try {
        const r = await fetch(url, { headers, cache: 'no-store' });
        if (r.status === 401 && token) {
          // A saved but expired Ceiba II login otherwise leaves every counter at zero.
          const current = localStorage.getItem('csrs_auth');
          if (current && JSON.parse(current).token === token) {
            localStorage.removeItem('csrs_auth');
            setAuth({ user: null, token: null });
            setShowLogin(true);
            setLoginError('La sesión venció. Inicia sesión nuevamente.');
          }
          return null;
        }
        if (!r.ok) throw new Error('http ' + r.status);
        const j = await r.json();
        return j;
      } catch (e) {
        return null;
      }
    };
    try {
      const [vehRaw, geoRaw, altRaw, libRaw, dlRaw] = await Promise.all([
        safeFetch('/api/vehicles', null),
        embeddedShell ? Promise.resolve(null) : safeFetch('/api/geofences', null),
        embeddedShell ? Promise.resolve(null) : safeFetch('/api/alerts', null),
        embeddedShell ? Promise.resolve(null) : safeFetch('/api/library', null),
        embeddedShell ? Promise.resolve(null) : safeFetch('/api/downloads', null)
      ]);

      const vehData = vehRaw ? normalizeVehicles(vehRaw) : [];
      const geoData = normalizeArray<Geofence>(geoRaw, []);
      const altData = normalizeArray<AlertItem>(altRaw, []);
      const libData = normalizeArray<LibraryRecord>(libRaw, []);
      const dlData = normalizeArray<DownloadJob>(dlRaw, []);

      if (JSON.parse(localStorage.getItem('csrs_auth') || '{}').token !== token) return;
      setVehicles(vehData);
      setGeofences(geoData);
      setAlerts(altData);
      setLibrary(libData);
      setDownloads(dlData);

      // Never replace a selection made while the initial request was in flight.
      setSelectedVehicle(previous => previous
         ? vehData.find((v: Vehicle) => v.id === previous.id) || null
        : null);
    } catch (err) {
      console.error('Error fetching fleet data:', err);
      setVehicles([]);
      setGeofences([]);
      setAlerts([]);
      setLibrary([]);
      setDownloads([]);
    }
  }, [embeddedShell]);

  useEffect(() => {
    if (!auth.token || showSplash) return;
    void fetchData();

    // Setup Server-Sent Events (SSE) for continuous live telemetry updates
    const streamToken = encodeURIComponent(auth.token);
    const eventSource = new EventSource(`/api/stream/telemetry?access_token=${streamToken}`);
    let lastTelemetryAt = Date.now();

    eventSource.onmessage = (event) => {
      try {
        if (JSON.parse(localStorage.getItem('csrs_auth') || '{}').token !== auth.token) return;
        const data = JSON.parse(event.data);
        if (data.type === 'telemetry_update' && Array.isArray(data.vehicles)) {
          lastTelemetryAt = Date.now();
          setVehicles(data.vehicles);
          // Keep selected vehicle data updated with live coords
          setSelectedVehicle((prev) => {
            if (!prev) return null;
            const updated = data.vehicles.find((v: Vehicle) => v.id === prev.id);
             return updated || null;
          });
        }
      } catch (e) {
        // ignore parse error
      }
    };

    // SSE is the primary 2.5 s channel. This poll prevents stale online/offline
    // state when a mobile proxy silently drops the EventSource connection.
    const fallbackPoll = window.setInterval(() => {
      if (eventSource.readyState !== EventSource.OPEN || Date.now() - lastTelemetryAt > 10000) void fetchData();
    }, 10000);

    return () => {
      eventSource.close();
      window.clearInterval(fallbackPoll);
    };
  }, [auth.token, showSplash, fetchData]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoggingIn) return;
    const attempt = ++loginEpoch.current;
    const formData = new FormData(e.currentTarget);
    const username = (formData.get('username') as string || '').trim();
    const password = (formData.get('password') as string || '');

    if (!username || !password) return;
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: AbortSignal.timeout(20000)
      });
      const data = await res.json().catch(() => null);
      if (attempt !== loginEpoch.current) return;
      // Old backend: {code:200, result:true, token, user:{uid,account}}  New backend: {code:200, token, user, result}
      const isSuccess = data && data.code === 200 && data.token && (data.result || data.user);
      if (isSuccess) {
        const user = data.user || { account: username, uid: username };
        const newAuth = { user, token: data.token };
        setAuth(newAuth);
        localStorage.setItem('csrs_auth', JSON.stringify(newAuth));
        setShowLogin(false);
        return;
      }
      setLoginError((data && (data.error || data.errorcase)) || 'Credenciales inválidas');
    } catch (e) {
      if (attempt === loginEpoch.current) setLoginError('No se pudo conectar con Ceiba II. Intente nuevamente.');
    } finally {
      if (attempt === loginEpoch.current) setIsLoggingIn(false);
    }
  };

  // Vehicle select handler
  const handleSelectVehicle = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setActiveTab('vivo');
  };

  // Close info sheet
  const handleCloseInfoSheet = () => {
    setSelectedVehicle(null);
  };

  // Open live video stream
  const handleOpenVideo = (vehicle?: Vehicle) => {
    if (vehicle) {
      setSelectedVehicle(vehicle);
    }
    setIsVideoOverlayOpen(true);
  };

  // Resolve alert
  const handleResolveAlert = async (alertId: string) => {
    try {
      await fetch(`/api/alerts/${alertId}/resolve`, { method: 'POST' });
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, resolved: true } : a))
      );
    } catch (e) {
      console.error(e);
    }
  };

  // Focus geofence
  const handleFocusGeofence = (geo: Geofence) => {
    setActiveTab('vivo');
  };

  // Play recording from library
  const handlePlayRecording = (record: LibraryRecord) => {
    const targetVeh = vehicles.find((v) => v.unitNumber === record.unitNumber) || selectedVehicle;
    if (targetVeh) {
      setSelectedVehicle(targetVeh);
      setIsVideoOverlayOpen(true);
    }
  };

  // Download recording
  const handleDownloadRecording = async (record: LibraryRecord) => {
    try {
      const res = await fetch('/api/downloads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitNumber: record.unitNumber,
          title: `Video ${record.channelName} (${record.durationFormatted})`,
          type: 'video_mp4'
        })
      });
      const newJob = await res.json();
      setDownloads((prev) => [newJob, ...prev]);
    } catch (e) {
      console.error(e);
    }
  };

  // Bulk download multiple selected channels & time range
  const handleBulkDownload = async (
    unitNumber: string,
    channels: number[],
    date: string,
    startTime: string,
    endTime: string
  ) => {
    try {
      const channelNames: Record<number, string> = {
        1: 'CH1 Frontal',
        2: 'CH2 Cabina',
        3: 'CH3 Pasaje',
        4: 'CH4 Retro'
      };

      const jobs = await Promise.all(
        channels.map((ch) =>
          fetch('/api/downloads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              unitNumber,
              title: `Clip ${channelNames[ch] || 'CH' + ch} (${date} ${startTime}-${endTime})`,
              type: 'video_mp4'
            })
          }).then((r) => r.json())
        )
      );

      setDownloads((prev) => [...jobs, ...prev]);
    } catch (e) {
      console.error('Error in bulk download:', e);
    }
  };

   const unreadAlertsCount = alerts.filter((a) => !a.resolved).length;
  const liveStats = React.useMemo(() => {
    const total = vehicles.length;
    const online = vehicles.filter(v => v.status !== 'offline').length;
    const offline = vehicles.filter(v => v.status === 'offline').length;
    const moving = vehicles.filter(v => v.status === 'moving').length;
    const stopped = vehicles.filter(v => v.status === 'stopped').length;
    return { total, online, offline, moving, stopped };
  }, [vehicles]);
  const chromeTab = activeTab === 'vivo' || activeTab === 'recorrido';
  const chromeHidden = activeTab === 'vivo' ? vivoChromeHidden : recorridoChromeHidden;
  const setCurrentChromeHidden = (hidden: boolean) => {
    if (activeTab === 'vivo') setVivoChromeHidden(hidden);
    if (activeTab === 'recorrido') setRecorridoChromeHidden(hidden);
  };
  // Show Splash Screen
  if (showSplash) {
    return (
      <div id="splash" className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: '#020c17' }}>
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="h-full w-full" style={{ backgroundImage: 'linear-gradient(to right, #3c494e 1px, transparent 1px), linear-gradient(to bottom, #3c494e 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>
        <div className="text-center relative z-10">
          <div className="mb-6">
            <svg className="w-24 h-24 mx-auto" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="gm" x1="0%" x2="100%" y1="0%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#00e5ff' }} />
                  <stop offset="100%" style={{ stopColor: '#007bff' }} />
                </linearGradient>
                <linearGradient id="ga" x1="0%" x2="100%" y1="0%" y2="100%">
                  <stop offset="0%" style={{ stopColor: '#ff9100' }} />
                  <stop offset="100%" style={{ stopColor: '#ffcc00' }} />
                </linearGradient>
                <filter height="140%" id="gl" width="140%" x="-20%" y="-20%">
                  <feGaussianBlur result="blur" stdDeviation="15" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <path d="M720,512c0,114.9-93.1,208-208,208S304,626.9,304,512s93.1-208,208-208c45.4,0,87.4,14.6,121.7,39.3" fill="none" filter="url(#gl)" stroke="url(#gm)" strokeLinecap="round" strokeWidth="80">
                <animate attributeName="stroke-dasharray" dur="3s" fill="freeze" from="0, 2000" to="2000, 0" />
                <animate attributeName="opacity" dur="4s" repeatCount="indefinite" values="0.8;1;0.8" />
              </path>
              <g>
                <circle cx="650" cy="350" fill="url(#ga)" filter="url(#gl)" r="100">
                  <animateTransform attributeName="transform" dur="3s" repeatCount="indefinite" type="translate" values="0,0; 0,-20; 0,0" />
                </circle>
                <path d="M550,350 Q600,350 650,350" stroke="url(#ga)" strokeLinecap="round" strokeWidth="60">
                  <animateTransform attributeName="transform" dur="3s" repeatCount="indefinite" type="translate" values="0,0; 0,-10; 0,0" />
                </path>
              </g>
              <circle cx="512" cy="512" fill="white" r="10">
                <animate attributeName="r" dur="5s" repeatCount="indefinite" values="0;150;0" />
                <animate attributeName="opacity" dur="5s" repeatCount="indefinite" values="0;0.3;0" />
              </circle>
            </svg>
          </div>
          <div className="font-bold text-3xl leading-none tracking-tight flex flex-col items-center">
            <span className="text-white uppercase">Custom</span>
            <div className="flex items-center gap-1">
              <span className="text-[#00d1ff] uppercase">Servicios</span>
              <div className="flex font-bold">
                <span className="text-[#00d1ff]">R</span>
                <span className="text-[#ffb300]">S</span>
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs text-[#7b96b3] tracking-wider uppercase">
            <span>Tecnologia</span>
            <span className="w-1 h-1 rounded-full bg-[#00d1ff]" />
            <span>Seguridad</span>
            <span className="w-1 h-1 rounded-full bg-[#00d1ff]" />
            <span>Confianza</span>
          </div>
        </div>
      </div>
    );
  }

  // Show Login Screen
  if (showLogin) {
    if (embeddedVivo) return (
      <div className="h-screen flex items-center justify-center bg-[#011420] text-cyan-100 px-6 text-center">
        Sesion de Vivo no disponible. Inicia sesion nuevamente en CSRS X.
      </div>
    );
    return (
      <div id="view-login" className="fixed inset-0 z-50 items-center justify-center p-4" style={{ display: 'flex', background: '#020c17' }}>
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="h-full w-full" style={{ backgroundImage: 'linear-gradient(to right, #3c494e 1px, transparent 1px), linear-gradient(to bottom, #3c494e 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>
        <main className="flex-1 flex flex-col items-center justify-center p-4 relative z-10 w-full max-w-md mx-auto">
          <header className="text-center w-full flex flex-col items-center mb-1">
            <div className="flex flex-col items-center mb-1">
              <div className="h-20 w-20 mb-2">
                <svg className="w-full h-full" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="gm2" x1="0%" x2="100%" y1="0%" y2="100%">
                      <stop offset="0%" style={{ stopColor: '#00e5ff' }} />
                      <stop offset="100%" style={{ stopColor: '#007bff' }} />
                    </linearGradient>
                    <linearGradient id="ga2" x1="0%" x2="100%" y1="0%" y2="100%">
                      <stop offset="0%" style={{ stopColor: '#ff9100' }} />
                      <stop offset="100%" style={{ stopColor: '#ffcc00' }} />
                    </linearGradient>
                    <filter height="140%" id="gl2" width="140%" x="-20%" y="-20%">
                      <feGaussianBlur result="blur" stdDeviation="15" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>
                  <path d="M720,512c0,114.9-93.1,208-208,208S304,626.9,304,512s93.1-208,208-208c45.4,0,87.4,14.6,121.7,39.3" fill="none" filter="url(#gl2)" stroke="url(#gm2)" strokeLinecap="round" strokeWidth="80">
                    <animate attributeName="stroke-dasharray" dur="3s" fill="freeze" from="0, 2000" to="2000, 0" />
                    <animate attributeName="opacity" dur="4s" repeatCount="indefinite" values="0.8;1;0.8" />
                  </path>
                  <g>
                    <circle cx="650" cy="350" fill="url(#ga2)" filter="url(#gl2)" r="100">
                      <animateTransform attributeName="transform" dur="3s" repeatCount="indefinite" type="translate" values="0,0; 0,-20; 0,0" />
                    </circle>
                    <path d="M550,350 Q600,350 650,350" stroke="url(#ga2)" strokeLinecap="round" strokeWidth="60">
                      <animateTransform attributeName="transform" dur="3s" repeatCount="indefinite" type="translate" values="0,0; 0,-10; 0,0" />
                    </path>
                  </g>
                  <circle cx="512" cy="512" fill="white" r="10">
                    <animate attributeName="r" dur="5s" repeatCount="indefinite" values="0;150;0" />
                    <animate attributeName="opacity" dur="5s" repeatCount="indefinite" values="0;0.3;0" />
                  </circle>
                </svg>
              </div>
            </div>
            <div className="font-bold text-3xl leading-none tracking-tight flex flex-col items-center">
              <span className="text-white uppercase">Custom</span>
              <div className="flex items-center gap-1">
                <span className="text-[#00d1ff] uppercase">Servicios</span>
                <div className="flex font-bold">
                  <span className="text-[#00d1ff]">R</span>
                  <span className="text-[#ffb300]">S</span>
                </div>
              </div>
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-[#7b96b3] tracking-wider uppercase">
              <span>Tecnologia</span>
              <span className="w-1 h-1 rounded-full bg-[#00d1ff]" />
              <span>Seguridad</span>
              <span className="w-1 h-1 rounded-full bg-[#00d1ff]" />
              <span>Confianza</span>
            </div>
          </header>
          <p className="text-sm text-[#7b96b3] max-w-xs mx-auto mt-1">Sistema de monitorizacion de flota y logistica industrial.</p>
          <form onSubmit={handleLogin} className="w-full bg-[#0a2540]/80 backdrop-blur-md rounded-xl border border-[#293a50]/20 p-6 shadow-lg relative overflow-hidden mt-4">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#00d1ff]/20 via-[#00d1ff] to-[#00d1ff]/20" />
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <label className="text-xs text-[#7b96b3] block uppercase tracking-wider font-medium">User</label>
                <div className="relative rounded-lg transition-all duration-200 bg-[#011428] border border-[#293a50]/50 flex items-center focus-within:border-[#00d1ff]/50">
                  <div className="pl-3 text-[#7b96b3]">
                    <User className="w-5 h-5" />
                  </div>
                  <input className="w-full bg-transparent border-none text-white font-mono text-sm focus:ring-0 placeholder:text-[#293a50]/50 py-3 px-3" id="username" name="username" placeholder="User" type="text" required />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-[#7b96b3] block uppercase tracking-wider font-medium">Pass</label>
                <div className="relative rounded-lg transition-all duration-200 bg-[#011428] border border-[#293a50]/50 flex items-center focus-within:border-[#00d1ff]/50">
                  <div className="pl-3 text-[#7b96b3]">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input className="w-full bg-transparent border-none text-white font-mono text-sm focus:ring-0 placeholder:text-[#293a50]/50 py-3 px-3" id="password" name="password" placeholder="Pass" type="password" required />
                </div>
              </div>
              {loginError && (
                <div className="text-[#ff3b3b] text-sm text-center bg-[#ff3b3b]/10 rounded-lg p-3 border border-[#ff3b3b]/30">
                  {loginError}
                </div>
              )}
              <div className="pt-2">
                <button className="w-full bg-[#00d1ff] text-[#011428] font-bold text-lg py-3 rounded-lg hover:bg-[#00b8e6] transition-all duration-200 active:scale-95 flex justify-center items-center gap-2" type="submit" disabled={isLoggingIn}>
                  <span id="login-text">{isLoggingIn ? 'Iniciando...' : 'Iniciar Sesion'}</span>
                  {isLoggingIn ? <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : <ArrowRight className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </form>
        </main>
      </div>
    );
  }

  // Main App
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#011420] text-slate-300 flex flex-col font-sans select-none">
      {/* Top Header App Bar */}
      <div className={chromeTab && chromeHidden ? 'hidden sm:block' : 'block'}
        onTouchStart={event => { headerTouchY.current = event.touches[0]?.clientY ?? null; }}
        onTouchEnd={event => { if (chromeTab && headerTouchY.current != null && headerTouchY.current - event.changedTouches[0].clientY > 35) setCurrentChromeHidden(true); headerTouchY.current = null; }}>
        <Header onOpenDrawer={() => setIsDrawerOpen(true)} onOpenSettings={() => setIsSettingsModalOpen(true)} />
      </div>
      {chromeTab && (chromeHidden
        ? <button type="button" onClick={() => setCurrentChromeHidden(false)} onTouchStart={event => { headerTouchY.current = event.touches[0]?.clientY ?? null; }} onTouchEnd={event => { if (headerTouchY.current != null && event.changedTouches[0].clientY - headerTouchY.current > 25) setCurrentChromeHidden(false); headerTouchY.current = null; }} aria-label="Mostrar barra superior" className="fixed top-0 left-1/2 -translate-x-1/2 z-[1100] h-6 w-14 rounded-b-xl border border-t-0 border-cyan-500/50 bg-[#061d2b]/90 text-cyan-200 grid place-items-center sm:hidden"><ChevronDown className="h-4 w-4" /></button>
        : <button type="button" onClick={() => setCurrentChromeHidden(true)} aria-label="Ocultar barra superior" className="fixed top-14 left-1/2 -translate-x-1/2 z-[1100] h-5 w-12 rounded-b-xl border border-t-0 border-cyan-500/40 bg-[#061d2b]/85 text-cyan-200 grid place-items-center sm:hidden"><ChevronUp className="h-3.5 w-3.5" /></button>)}

      {/* Navigation Slide-out Drawer */}
      <NavigationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        vehicles={vehicles}
        selectedVehicleId={selectedVehicle?.id || null}
        onSelectVehicle={handleSelectVehicle}
        onOpenVideo={handleOpenVideo}
      />

      {embeddedShell && activeTab !== 'vivo' && activeTab !== 'biblioteca' && activeTab !== 'rastreo' && activeTab !== 'despacho' && activeTab !== 'recorrido' && (
        <button type="button" onClick={() => setActiveTab('vivo')}
          className="px-4 py-2 text-sm font-semibold text-cyan-200 bg-[#08283d] border-b border-cyan-800">
          Volver a Vivo
        </button>
      )}

      {/* Main View Area */}
      <main className={`relative isolate flex-1 w-full h-full overflow-hidden bg-[radial-gradient(circle_at_top,rgba(0,209,255,0.06),transparent_32%)] ${androidApp ? 'pb-16' : ''}`}>
        {/* Tab 1: Live Interactive Map (Vivo) - En Vivo MDVR con contadores reales + barra lateral unidades */}
        <div className={`w-full h-full ${activeTab === 'vivo' ? 'flex flex-col' : 'hidden'}`}>
          {/* Live stats bar tiempo real */}
          <div className={`bg-[#000f20]/90 backdrop-blur-md border-b border-[#293a50] px-2 sm:px-4 py-2 flex-wrap items-center gap-2 text-[11px] font-mono flex-shrink-0 ${vivoChromeHidden ? 'hidden sm:flex' : 'flex'}`}>
            <span className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700 text-slate-300">Total: <b className="text-white">{liveStats.total}</b></span>
            <span className="px-2 py-1 rounded bg-emerald-950/50 border border-emerald-700 text-emerald-300">En Línea: <b>{liveStats.online}</b></span>
            <span className="px-2 py-1 rounded bg-slate-800 border border-slate-600 text-slate-400">Sin conexión: <b>{liveStats.offline}</b></span>
            <span className="px-2 py-1 rounded bg-orange-950/40 border border-orange-700 text-orange-300">En Movimiento: <b>{liveStats.moving}</b></span>
            <span className="px-2 py-1 rounded bg-red-950/40 border border-red-700 text-red-300">Detenidas: <b>{liveStats.stopped}</b></span>
            <span className="ml-auto text-[10px] text-slate-500 hidden sm:inline">GPS cada 2.5s • Video en vivo y audio AAC mediante CMS / WCMS5</span>
          </div>
          <div className="flex-1 relative overflow-hidden">
            <MapView
                vehicles={vehicles}
                geofences={geofences}
                selectedVehicle={selectedVehicle}
                onSelectVehicle={handleSelectVehicle}
                onMapClick={handleCloseInfoSheet}
              />
              {/* Bottom Floating Info Sheet for Selected Vehicle */}
              <UnitInfoSheet
                vehicle={selectedVehicle}
                onClose={handleCloseInfoSheet}
                onOpenVideo={() => handleOpenVideo()}
                onOpenDetail={() => setIsDetailModalOpen(true)}
                onOpenGeocercas={() => setActiveTab('vivo')}
                onOpenTracker={() => setActiveTab('vivo')}
                onOpenDescargar={() => setActiveTab('biblioteca')}
                onOpenAlertas={() => setActiveTab('vivo')}
              />
            </div>
        </div>

        {/* Tab 2: Biblioteca de Grabaciones */}
        {activeTab === 'biblioteca' && <DownloaderLibraryView token={auth.token} isAdmin={Number(auth.user?.roleid) === 1} />}
        {activeTab === 'rastreo' && <RastreoView vehicles={vehicles} token={auth.token} onOpenVehicle={(vehicle) => { setSelectedVehicle(vehicle); setIsDetailModalOpen(true); }} />}
        {activeTab === 'despacho' && <DespachoView vehicles={vehicles} token={auth.token} onOpenRecorrido={(selection) => { setRecorridoSelection(selection); setActiveTab('recorrido'); }} />}
        {activeTab === 'recorrido' && <RecorridoView vehicles={vehicles} token={auth.token} initialSelection={recorridoSelection} chromeHidden={recorridoChromeHidden} onChromeHiddenChange={setRecorridoChromeHidden} />}

      </main>

      {/* 4-Channel Live MDVR Video Overlay */}
      {isVideoOverlayOpen && (
        <CameraStreamOverlay
          vehicle={selectedVehicle}
          onClose={() => setIsVideoOverlayOpen(false)}
        />
      )}

      {/* Detailed Telemetry Modal */}
      {isDetailModalOpen && (
        <DetailModal
          vehicle={selectedVehicle}
          onClose={() => setIsDetailModalOpen(false)}
          onOpenVideo={() => {
            setIsDetailModalOpen(false);
            setIsVideoOverlayOpen(true);
          }}
        />
      )}

      {/* Ceiba II / MySQL Diagnostics & Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onLogout={handleLogout}
        token={auth.token}
        account={auth.user?.account || auth.user?.un}
        unitsCount={vehicles.length}
        isAdministrator={Number(auth.user?.roleid ?? auth.user?.rid) === 1}
      />

      {!embeddedVivo && <BottomNavBar activeTab={activeTab} onTabChange={setActiveTab} />}
    </div>
  );
}