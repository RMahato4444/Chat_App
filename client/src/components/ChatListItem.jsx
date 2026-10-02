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

  return (
    <div
      className={`w-full rounded-2xl p-3 transition duration-200 ${
        active
          ? 'bg-white/[.10] ring-1 ring-emerald-300/20 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]'
          : 'hover:bg-white/[.05]'
      }`}
    >
      <button type="button" onClick={onClick} className="w-full text-left">
        <div className="flex items-center gap-3">
          <Avatar user={item.user} showStatus />

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold truncate text-white">{item.user.username}</p>
              {item.status === 'accepted' && (
                <MessageCircle size={15} className="text-emerald-300 shrink-0" />
              )}
              {item.status === 'pending' && (
                <Clock3 size={15} className="text-emerald-200/80 shrink-0" />
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
      </button>

      {pendingIncoming && (
        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={onAccept}
            className="flex-1 rounded-xl bg-emerald-400/15 border border-emerald-300/15 text-emerald-200 text-xs font-semibold px-3 py-2 flex items-center justify-center gap-1 backdrop-blur-md hover:bg-emerald-400/20 transition"
          >
            <Check size={14} />
            Accept
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="flex-1 rounded-xl bg-white/5 border border-white/8 text-white/55 text-xs font-semibold px-3 py-2 backdrop-blur-md hover:bg-white/8 transition"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}
