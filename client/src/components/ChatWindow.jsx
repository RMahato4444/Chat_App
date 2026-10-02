import { ArrowLeft, CheckCheck, LockKeyhole, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Avatar from './Avatar';

function timeLabel(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatWindow({ currentUser, selected, messages, socket, onBack }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    const node = endRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = (e) => {
    e?.preventDefault();
    const clean = text.trim();
    if (!clean || !socket || selected?.status !== 'accepted') return;
    socket.emit('message:send', { connectionId: selected.id, text: clean });
    setText('');
  };

  if (!selected) return (
    <section className="glass rounded-[28px] h-full hidden md:grid place-items-center text-center p-8">
      <div className="max-w-sm"><LockKeyhole className="mx-auto text-aqua/70" size={44}/><h2 className="mt-4 text-xl font-bold">Choose a chat</h2><p className="text-sm text-white/45 mt-2">Search a username and send an invite. Messaging unlocks only after the other person accepts.</p></div>
    </section>
  );

  const pendingIncoming = selected.status === 'pending' && selected.requestedBy !== currentUser.id;
  return (
    <section className="glass rounded-[28px] h-full min-h-0 flex flex-col overflow-hidden border-white/10">
      <header className="h-[76px] shrink-0 border-b border-white/10 bg-white/[.025] px-4 sm:px-5 flex items-center gap-3 backdrop-blur-xl">
        <button className="md:hidden h-10 w-10 rounded-xl hover:bg-white/10 grid place-items-center" onClick={onBack}><ArrowLeft size={19}/></button>
        <Avatar user={selected.user} />
        <div className="min-w-0"><p className="font-semibold truncate">{selected.user.username}</p><p className="text-xs text-white/40 mt-1">{selected.status === 'accepted' ? 'Connected · real-time chat' : pendingIncoming ? 'Invite awaiting your response' : 'Waiting for acceptance'}</p></div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto chat-scroll px-4 sm:px-6 py-5 space-y-3">
        {selected.status !== 'accepted' ? (
          <div className="h-full grid place-items-center text-center"><div className="max-w-sm"><div className="mx-auto h-14 w-14 rounded-2xl bg-white/5 grid place-items-center"><LockKeyhole size={24} className="text-amber-300"/></div><h3 className="mt-4 font-bold">Chat is locked</h3><p className="mt-2 text-sm text-white/45">{pendingIncoming ? 'Accept the invite from the chat list to open this conversation.' : 'This conversation will open once the other user accepts your invite.'}</p></div></div>
        ) : messages.length === 0 ? (
          <div className="h-full grid place-items-center text-center text-sm text-white/40"><div><p className="font-semibold text-white/60">You are connected.</p><p className="mt-1">Send the first message.</p></div></div>
        ) : messages.map((message) => {
          const mine = message.sender === currentUser.id;
          return <div key={message.id || message._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[78%] sm:max-w-[65%] rounded-2xl px-3.5 py-2.5 ${mine ? 'bg-blue-400/18 border border-blue-300/20 text-blue-50 backdrop-blur-md shadow-lg shadow-blue-950/10 rounded-br-md' : 'bg-white/[.07] border border-white/10 text-white backdrop-blur-md shadow-lg shadow-black/10 rounded-bl-md'}`}><p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{message.text}</p><div className={`mt-1.5 flex items-center justify-end gap-1 text-[10px] ${mine ? 'text-ink/60' : 'text-white/35'}`}><span>{timeLabel(message.createdAt)}</span>{mine && <CheckCheck size={13}/>}</div></div></div>;
        })}
        <div ref={endRef}/>
      </div>

      <form onSubmit={send} className="p-3 sm:p-4 border-t border-white/10 bg-black/[.06] backdrop-blur-xl">
        <div className="glass-soft rounded-2xl p-1.5 flex items-end gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} disabled={selected.status !== 'accepted'} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }} rows={1} placeholder={selected.status === 'accepted' ? 'Write a message…' : 'Chat unavailable until both users agree'} className="flex-1 resize-none bg-transparent outline-none px-3 py-2.5 text-sm text-white placeholder:text-white/25 max-h-32 disabled:cursor-not-allowed" />
          <button disabled={!text.trim() || selected.status !== 'accepted'} className="h-11 w-11 rounded-xl bg-aqua text-ink grid place-items-center disabled:opacity-30 disabled:cursor-not-allowed"><Send size={18}/></button>
        </div>
        <p className="text-[10px] text-white/25 mt-2 px-2"><LockKeyhole size={11} className="inline mr-1"/>Only approved connections can exchange messages.</p>
      </form>
    </section>
  );
}
