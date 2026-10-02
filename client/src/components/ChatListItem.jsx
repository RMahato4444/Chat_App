import { Check, Clock3, MessageCircle, UserPlus } from 'lucide-react';
import Avatar from './Avatar';

export default function ChatListItem({ item, active, onClick, onAccept, onDecline }) {
  const pendingIncoming = item.status === 'pending' && item.requestedBy !== item.currentUserId;
  return (
    <button onClick={onClick} className={`w-full text-left rounded-2xl p-3 transition ${active ? 'bg-white/10 ring-1 ring-white/10' : 'hover:bg-white/[.045]'}`}>
      <div className="flex items-center gap-3">
        <Avatar user={item.user} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold truncate">{item.user.username}</p>
            {item.status === 'accepted' ? <MessageCircle size={15} className="text-aqua" /> : item.status === 'pending' ? <Clock3 size={15} className="text-amber-300" /> : null}
          </div>
          <p className="text-xs text-white/40 truncate mt-1">
            {item.status === 'accepted' ? 'Chat available' : item.status === 'pending' ? (pendingIncoming ? 'Invite waiting for you' : 'Invite sent') : 'Declined'}
          </p>
        </div>
      </div>
      {pendingIncoming && (
        <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
          <span onClick={onAccept} className="flex-1 rounded-xl bg-aqua/15 text-aqua text-xs font-semibold px-3 py-2 flex items-center justify-center gap-1 cursor-pointer"><Check size={14}/> Accept</span>
          <span onClick={onDecline} className="flex-1 rounded-xl bg-white/5 text-white/60 text-xs font-semibold px-3 py-2 text-center cursor-pointer">Decline</span>
        </div>
      )}
    </button>
  );
}
