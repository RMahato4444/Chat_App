import { Check, Clock3, MessageCircle } from 'lucide-react';
import Avatar from './Avatar';
import { presenceLabel } from '../lib/presence';

export default function ChatListItem({
  item,
  active,
  onClick,
  onAccept,
  onDecline,
}) {
  const pendingIncoming =
    item.status === 'pending' &&
    item.requestedBy !== item.currentUserId;

  const isOnline = item.user?.online;

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`w-full cursor-pointer rounded-2xl p-3 transition duration-200 outline-none focus-visible:ring-2 focus-visible:ring-sky-300/30 user-chat-card ${
        active ? 'user-chat-card-active' : ''
      }`}
      aria-label={`Open chat with ${item.user.username}`}
    >
      <div className="flex items-center gap-3">
        <Avatar user={item.user} showStatus />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold truncate text-white">{item.user.username}</p>
            {item.status === 'accepted' && (
              <MessageCircle size={15} className="text-blue-300 shrink-0" />
            )}
            {item.status === 'pending' && (
              <Clock3 size={15} className="text-blue-100/85 shrink-0" />
            )}
          </div>

          <div className="mt-1 flex items-center gap-1.5 min-w-0">
            {item.status === 'accepted' && (
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isOnline ? 'bg-emerald-400' : 'bg-white/25'}`} />
            )}
            <p className={`text-[11px] truncate ${isOnline ? 'text-emerald-200/85' : 'text-white/38'}`}>
              {item.status === 'accepted'
                ? presenceLabel(item.user)
                : item.status === 'pending'
                  ? pendingIncoming
                    ? 'Invite waiting for you'
                    : 'Invite sent · waiting for acceptance'
                  : 'Invite declined'}
            </p>
          </div>
        </div>
      </div>

      {pendingIncoming && (
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAccept();
            }}
            className="flex-1 rounded-xl bg-blue-400/15 border border-blue-300/15 text-blue-200 text-xs font-semibold px-3 py-2 flex items-center justify-center gap-1 backdrop-blur-md hover:bg-blue-400/20 transition"
          >
            <Check size={14} />
            Accept
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDecline();
            }}
            className="flex-1 rounded-xl bg-white/5 border border-white/8 text-white/55 text-xs font-semibold px-3 py-2 backdrop-blur-md hover:bg-white/8 transition"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}
