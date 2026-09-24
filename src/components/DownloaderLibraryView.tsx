import React, { useEffect, useState } from 'react';

export const DownloaderLibraryView: React.FC<{ token: string | null }> = ({ token }) => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
    setReady(true);
  }, [token]);

  if (!ready) return null;
  return (
    <section className="w-full h-full min-h-0 overflow-hidden bg-[#000f20] pb-16">
      <iframe
        key={token || 'authenticated-session'}
        title="Ceiba Video Downloader"
        src="/ceiba-downloader/index.html"
        className="block w-full h-full min-h-[calc(100vh-4rem)] border-0"
        loading="eager"
      />
    </section>
  );
};
