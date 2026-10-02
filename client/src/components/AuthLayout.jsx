import { MessageCircleMore } from 'lucide-react';

export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="app-bg min-h-screen grid place-items-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-aqua/15 border border-aqua/30 grid place-items-center text-aqua"><MessageCircleMore size={26} /></div>
          <div><p className="font-black text-xl tracking-tight">GlassChat</p><p className="text-xs text-white/45">private, real-time conversations</p></div>
        </div>
        <div className="glass rounded-[28px] p-6 sm:p-8">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-white/50">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
