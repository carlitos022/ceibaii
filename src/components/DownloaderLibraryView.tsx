import React, { useEffect, useState } from 'react';

export const DownloaderLibraryView: React.FC<{ token: string | null; isAdmin: boolean }> = ({ token, isAdmin }) => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setReady(false);
    if (!token || !isAdmin) return;
    let active = true;
    const openSession = async () => {
      try {
        const response = await fetch('/api/admin-downloader/session', {
          method: 'POST', headers: { Authorization: 'Bearer ' + token },
          credentials: 'same-origin', cache: 'no-store'
        });
        if (!response.ok) throw new Error('No se pudo abrir la sesión del administrador');
        if (active) { setError(''); setReady(true); }
      } catch (e) {
        if (active) { setReady(false); setError('No se pudo abrir Biblioteca. Vuelve a iniciar sesión.'); }
      }
    };
    void openSession();
    const timer = window.setInterval(openSession, 10 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token, isAdmin]);

  if (!isAdmin) return <section className="flex h-full items-center justify-center bg-[#000f20] px-6 text-center text-slate-300">
    Solo el administrador puede hacer uso de esta pestaña
  </section>;
  if (error) return <section className="flex h-full items-center justify-center bg-[#000f20] px-6 text-center text-rose-300">{error}</section>;
  if (!ready) return <section className="flex h-full items-center justify-center bg-[#000f20] text-cyan-300">Abriendo Biblioteca...</section>;
  return <section className="w-full h-full min-h-0 overflow-hidden bg-[#000f20] pb-16">
    <iframe title="Centro de descargas CEIBA SD" src="/admin-downloader/"
      className="block w-full h-full min-h-[calc(100vh-4rem)] border-0" loading="eager" />
  </section>;
};
