export default function Avatar({ user, size = 'md', className = '' }) {
  const initials = user?.username?.slice(0, 2).toUpperCase() || '??';
  const sizes = { sm: 'h-9 w-9 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-14 w-14 text-base', xl: 'h-20 w-20 text-xl' };
  const src = user?.profilePicture
    ? `${(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000')}${user.profilePicture}`
    : null;
  return (
    <div className={`${sizes[size] || sizes.md} rounded-2xl overflow-hidden shrink-0 bg-gradient-to-br from-aqua/35 to-indigo-500/30 ring-1 ring-white/10 flex items-center justify-center font-bold text-white ${className}`}>
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials}
    </div>
  );
}
