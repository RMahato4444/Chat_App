import { Check, Clock3 } from 'lucide-react';
import Avatar from './Avatar';
import { presenceLabel } from '../lib/presence';

export default function ChatListItem({
  item,
  active,
  lastMessage,
  unreadCount = 0,
  onClick,
  onAccept,
  onDecline,
}) {
  const pendingIncoming =
    item.status === 'pending' &&
    item.requestedBy !== item.currentUserId;

  const isOnline = item.user?.online;
  const hasUnread = item.status === 'accepted' && unreadCount > 0;

  const previewText = (() => {
    if (!lastMessage) {
      if (item.status === 'accepted') {
        return presenceLabel(item.user);
      }

      if (item.status === 'pending') {
        return pendingIncoming
          ? 'Invite waiting for you'
          : 'Invite sent · waiting for acceptance';
      }

      return 'Invite declined';
    }

    const deleted =
      lastMessage.deletedForMe || lastMessage.deletedForEveryone;

    const text = deleted
      ? 'This message was deleted'
      : String(
          lastMessage.text || lastMessage.content || ''
        ).trim();

    if (!text) return 'Message';

    const senderId = String(
      lastMessage.sender?.id ||
        lastMessage.sender?._id ||
        lastMessage.senderId ||
        lastMessage.user?.id ||
        lastMessage.user?._id ||
        lastMessage.from?.id ||
        lastMessage.from?._id ||
        ''
    );

    return senderId === String(item.currentUserId)
      ? `You: ${text}`
      : text;
  })();

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
      className={`relative w-full cursor-pointer rounded-xl p-2.5 transition duration-200 outline-none focus-visible:ring-2 focus-visible:ring-sky-300/30 user-chat-card ${
        active ? 'user-chat-card-active' : ''
      }`}
      aria-label={`Open chat with ${item.user.username}`}
    >
      <div className="flex items-start gap-2.5">
        <Avatar user={item.user} showStatus size="sm" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold truncate text-white text-sm min-w-0">
              {item.user.username}
            </p>

            {item.status === 'pending' && (
              <Clock3
                size={13}
                className="text-blue-100/75 shrink-0"
              />
            )}
          </div>

          <div
            className="mt-1 text-[11px] leading-[1.25] text-white/65 min-h-0"
            title={previewText}
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {previewText}
          </div>

          <div className="mt-1 flex items-center gap-1.5 min-w-0">
            {item.status === 'accepted' && (
              <span
                className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                  isOnline ? 'bg-emerald-400' : 'bg-white/25'
                }`}
              />
            )}

            <p
              className={`text-[10px] leading-none truncate ${
                isOnline
                  ? 'text-emerald-200/70'
                  : 'text-white/30'
              }`}
            >
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

        {hasUnread && (
          <span
            className="mt-0.5 shrink-0 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center shadow-[0_0_12px_rgba(239,68,68,.4)] ring-1 ring-red-300/20"
            aria-label={`${unreadCount} unread message${
              unreadCount === 1 ? '' : 's'
            }`}
            title={`${unreadCount} unread message${
              unreadCount === 1 ? '' : 's'
            }`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </div>

      {pendingIncoming && (
        <div className="flex gap-2 mt-2.5">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAccept();
            }}
            className="flex-1 rounded-lg bg-blue-400/15 border border-blue-300/15 text-blue-200 text-xs font-semibold px-2.5 py-1.5 flex items-center justify-center gap-1 backdrop-blur-md hover:bg-blue-400/20 transition"
          >
            <Check size={13} />
            Accept
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDecline();
            }}
            className="flex-1 rounded-lg bg-white/5 border border-white/8 text-white/55 text-xs font-semibold px-2.5 py-1.5 backdrop-blur-md hover:bg-white/8 transition"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  );
}
