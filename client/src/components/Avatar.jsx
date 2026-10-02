export default function Avatar({ user, size = 'md', className = '', showStatus = false }) {
  const initials = user?.username?.slice(0, 2).toUpperCase() || '??';
  const sizes = {
    sm: 'h-9 w-9 text-xs',
    md: 'h-11 w-11 text-sm',
    lg: 'h-14 w-14 text-base',
    xl: 'h-20 w-20 text-xl'
  };
  const src = user?.profilePicture
    ? `${(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000')}${user.profilePicture}`
    : null;

  return (
    <div className={`${sizes[size] || sizes.md} relative rounded-2xl overflow-visible shrink-0 bg-gradient-to-br from-emerald-300/30 to-white/10 ring-1 ring-white/15 flex items-center justify-center font-bold text-white ${className}`}>
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials}
      </div>
      {showStatus && (
        <span
          className={`absolute -right-0.5 -bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#091610] shadow-[0_0_0_3px_rgba(255,255,255,.06)] ${
            user?.online ? 'bg-emerald-400' : 'bg-white/25'
          }`}
          aria-label={user?.online ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}
