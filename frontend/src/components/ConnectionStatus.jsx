import React, { useEffect, useState } from 'react';

function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const markOnline = () => setIsOnline(true);
    const markOffline = () => setIsOnline(false);

    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);

    return () => {
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`rounded-full px-3 py-1.5 text-xs font-medium border backdrop-blur-sm transition-all ${
          isOnline
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
            : 'bg-rose-500/15 text-rose-300 border-rose-400/50'
        }`}
      >
        {isOnline ? 'Online' : 'Offline: changes may fail'}
      </div>
    </div>
  );
}

export default ConnectionStatus;
