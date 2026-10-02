import { useEffect, useMemo, useState } from 'react';
import { assetUrl } from '../lib/api';

export default function Avatar({ user, size = 'md', className = '', showStatus = false }) {
  const initials = useMemo(() => {
    const value = user?.username || '??';
    const parts = value.split(/[@_]/).filter(Boolean);
    return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : value.slice(0, 2)).toUpperCase();
  }, [user?.username]);

  const sizes = {
    sm: 'h-9 w-9 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-14 w-14 text-base',
    xl: 'h-20 w-20 text-xl'
  };

  const src = assetUrl(user?.profilePicture);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  const showImage = Boolean(src) && !imageFailed;

  return (
    <div className={`${sizes[size] || sizes.md} relative rounded-2xl overflow-visible shrink-0 bg-gradient-to-br from-blue-400/30 via-blue-500/15 to-white/10 ring-1 ring-white/15 flex items-center justify-center font-bold text-white ${className}`}>
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        {showImage ? (
          <img
            src={src}
            alt=""
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="h-full w-full grid place-items-center bg-gradient-to-br from-blue-400/30 to-slate-950/20">
            {initials}
          </div>
        )}
      </div>

      {showStatus && (
        <span
          className={`absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#07111f] shadow-[0_0_0_3px_rgba(255,255,255,.06)] ${
            user?.online ? 'bg-emerald-400' : 'bg-white/25'
          }`}
          aria-label={user?.online ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}
