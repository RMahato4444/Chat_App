import {
  ArrowLeft,
  Check,
  CheckCheck,
  Edit3,
  Info,
  LockKeyhole,
  MoreHorizontal,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import Avatar from './Avatar';
import { api } from '../lib/api';

const EDIT_WINDOW_MS = 30 * 60 * 1000;
const MENU_WIDTH = 230;
const MENU_HEIGHT = 240;

function timeLabel(date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dateTimeLabel(date) {
  if (!date) return 'Not yet';
  return new Date(date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' });
}

function messageStatus(message) {
  if (message.readAt) return 'read';
  if (message.deliveredAt) return 'delivered';
  return 'sent';
}

function isWithinEditWindow(message) {
  if (!message?.createdAt) return false;
  const created = new Date(message.createdAt).getTime();
  const elapsed = Date.now() - created;
  return elapsed >= 0 && elapsed <= EDIT_WINDOW_MS;
}

function StatusTicks({ message }) {
  const status = messageStatus(message);
  if (status === 'sent') {
    return <Check size={14} strokeWidth={2.4} className="text-white/80 shrink-0" aria-label="Sent" />;
  }
  return (
    <CheckCheck
      size={15}
      strokeWidth={2.4}
      className={status === 'read' ? 'text-cyan-200' : 'text-sky-100/95'}
      aria-label={status === 'read' ? 'Read' : 'Delivered'}
    />
  );
}

function MenuItem({ icon: Icon, children, onClick, tone = 'default' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
        tone === 'danger'
          ? 'text-rose-100 hover:bg-rose-400/10'
          : 'text-white/85 hover:bg-white/10'
      }`}
    >
      <Icon size={16} className="shrink-0" />
      <span>{children}</span>
    </button>
  );
}

export default function ChatWindow({ currentUser, selected, messages, socket, onBack, onLocalRemoveMessage, onLocalClearChat }) {
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [actionNotice, setActionNotice] = useState('');
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const menuRef = useRef(null);
  const chatRef = useRef(null);

  useEffect(() => {
    const node = endRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const closeMenu = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      setContextMenu(null);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setContextMenu(null);
        setInfoMessage(null);
        setConfirmation(null);
        setEditingId(null);
        setText('');
      }
    };
    window.addEventListener('mousedown', closeMenu);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', closeMenu);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (editingId) requestAnimationFrame(() => textareaRef.current?.focus());
  }, [editingId]);

  const editingMessage = useMemo(
    () => messages.find((message) => (message.id || message._id) === editingId),
    [messages, editingId]
  );

  const cancelEdit = () => {
    setEditingId(null);
    setText('');
  };

  const send = (event) => {
    event?.preventDefault();
    const clean = text.trim();
    if (!clean || !socket || selected?.status !== 'accepted') return;

    if (editingId) {
      if (!editingMessage || !isWithinEditWindow(editingMessage)) {
        setActionNotice('This message can no longer be edited. The 30-minute limit has expired.');
        cancelEdit();
        return;
      }
      socket.emit('message:edit', {
        connectionId: selected.id,
        messageId: editingId,
        text: clean,
      });
      cancelEdit();
      return;
    }

    socket.emit('message:send', { connectionId: selected.id, text: clean });
    setText('');
  };

  const positionMenu = (x, y) => {
    const rect = chatRef.current?.getBoundingClientRect();
    const padding = 12;
    if (!rect) {
      return {
        x: Math.max(12, Math.min(x, window.innerWidth - MENU_WIDTH - 12)),
        y: Math.max(12, Math.min(y, window.innerHeight - MENU_HEIGHT - 12)),
      };
    }
    return {
      x: Math.round(Math.max(rect.left + padding, Math.min(x, rect.right - MENU_WIDTH - padding))),
      y: Math.round(Math.max(rect.top + padding, Math.min(y, rect.bottom - MENU_HEIGHT - padding))),
    };
  };

  const openMessageMenu = (message, x, y) => {
    const pos = positionMenu(x, y);
    setContextMenu({ message, x: pos.x, y: pos.y });
  };

  const handleMessageContext = (event, message) => {
    event.preventDefault();
    openMessageMenu(message, event.clientX, event.clientY);
  };

  const handleMoreClick = (event, message) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    openMessageMenu(message, rect.left - MENU_WIDTH + rect.width, rect.bottom + 8);
  };

  const startEdit = (message) => {
    if (!message || message.sender !== currentUser.id || message.deletedForMe || message.deletedForEveryone) return;
    if (!isWithinEditWindow(message)) {
      setActionNotice('This message is older than 30 minutes and can no longer be edited.');
      setContextMenu(null);
      return;
    }
    setEditingId(message.id || message._id);
    setText(message.text);
    setContextMenu(null);
    setActionNotice('');
  };

  const requestDelete = (message, mode) => {
    if (!message || !socket) return;
    if (mode === 'everyone' && message.sender !== currentUser.id) return;
    setConfirmation({ type: 'delete', message, mode });
    setContextMenu(null);
  };

  const confirmDelete = () => {
    if (!confirmation?.message || !selected?.id || !socket) return;
    const { message, mode } = confirmation;
    const messageId = message.id || message._id;

    if (mode === 'remove-local') {
      onLocalRemoveMessage?.(selected.id, messageId);
      setConfirmation(null);
      return;
    }

    socket.emit('message:delete', {
      connectionId: selected.id,
      messageId,
      mode,
    });

    if (editingId === messageId) cancelEdit();
    setConfirmation(null);
  };

  const showInfo = (message) => {
    setInfoMessage(message);
    setContextMenu(null);
  };

  const requestClearChat = () => {
    if (!selected?.id || selected.status !== 'accepted' || clearing) return;
    setConfirmation({ type: 'clear' });
  };

  const confirmClearChat = async () => {
    if (!selected?.id || clearing) return;
    setClearing(true);
    try {
      await api.delete(`/messages/${selected.id}`);
      onLocalClearChat?.(selected.id);
      cancelEdit();
      setActionNotice('Chat cleared.');
    } catch (error) {
      setActionNotice(error?.response?.data?.message || 'Could not clear this chat.');
    } finally {
      setClearing(false);
      setConfirmation(null);
    }
  };

  const renderContextMenu = () => {
    if (!contextMenu) return null;
    const { message, x, y } = contextMenu;
    const mine = message.sender === currentUser.id;
    const deletedForMe = Boolean(message.deletedForMe);
    const deletedForEveryone = Boolean(message.deletedForEveryone);
    const editable = mine && !deletedForMe && !deletedForEveryone && isWithinEditWindow(message);

    return createPortal(
      <div
        ref={menuRef}
        className="fixed z-[10000] w-[230px] rounded-2xl p-1.5 context-menu-glass shadow-2xl animate-pop"
        style={{ left: `${x}px`, top: `${y}px` }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <MenuItem icon={Info} onClick={() => showInfo(message)}>Message info</MenuItem>

        {editable && <MenuItem icon={Edit3} onClick={() => startEdit(message)}>Edit message</MenuItem>}

        {deletedForMe && !deletedForEveryone ? (
          <MenuItem icon={Trash2} tone="danger" onClick={() => requestDelete(message, 'remove-local')}>
            Remove from my chat
          </MenuItem>
        ) : (
          !deletedForEveryone && (
            <MenuItem icon={Trash2} tone="danger" onClick={() => requestDelete(message, 'me')}>
              Delete for me
            </MenuItem>
          )
        )}

        {mine && !deletedForEveryone && (
          <MenuItem icon={Trash2} tone="danger" onClick={() => requestDelete(message, 'everyone')}>
            Delete for everyone
          </MenuItem>
        )}
      </div>,
      document.body
    );
  };

  const renderInfoModal = () => {
    if (!infoMessage) return null;
    return createPortal(
      <div className="fixed inset-0 z-[10001] grid place-items-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-3xl info-modal-glass p-5 shadow-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-base font-semibold">Message info</p>
              <p className="text-xs text-white/40 mt-1">Delivery status for this message</p>
            </div>
            <button type="button" className="h-9 w-9 rounded-xl bg-white/5 hover:bg-white/10 grid place-items-center" onClick={() => setInfoMessage(null)} aria-label="Close message info">
              <X size={16} />
            </button>
          </div>
          <div className="mt-5 space-y-2">
            <div className="info-row"><span>Sent</span><strong>{dateTimeLabel(infoMessage.createdAt)}</strong></div>
            <div className="info-row"><span>Delivered</span><strong>{dateTimeLabel(infoMessage.deliveredAt)}</strong></div>
            <div className="info-row"><span>Read</span><strong>{dateTimeLabel(infoMessage.readAt)}</strong></div>
            {infoMessage.editedAt && !infoMessage.deletedForEveryone && <div className="info-row"><span>Edited</span><strong>{dateTimeLabel(infoMessage.editedAt)}</strong></div>}
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const renderConfirmation = () => {
    if (!confirmation) return null;
    const isClear = confirmation.type === 'clear';
    const removeLocal = confirmation.mode === 'remove-local';
    const title = isClear
      ? 'Clear entire chat?'
      : removeLocal
        ? 'Remove this message from your chat?'
        : confirmation.mode === 'everyone'
          ? 'Delete this message for everyone?'
          : 'Delete this message for you?';
    const description = isClear
      ? 'This permanently removes every message in this conversation for both users.'
      : removeLocal
        ? 'It will disappear from your current chat view. The other person will not be affected.'
        : confirmation.mode === 'everyone'
          ? 'This removes the message from both users’ chat history.'
          : 'The message will be hidden from your chat view, but the other person will keep it.';

    return createPortal(
      <div className="fixed inset-0 z-[10002] grid place-items-center p-4 bg-black/45 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-3xl confirm-modal-glass p-5 shadow-2xl">
          <div className="h-11 w-11 rounded-2xl bg-sky-400/10 border border-sky-300/10 text-sky-200 grid place-items-center mb-4">
            <Trash2 size={18} />
          </div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-white/50">{description}</p>
          {actionNotice && <p className="mt-3 text-xs text-rose-200/80">{actionNotice}</p>}
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => setConfirmation(null)} className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-semibold text-white/65 hover:bg-white/10 transition">Cancel</button>
            <button
              type="button"
              onClick={isClear ? confirmClearChat : confirmDelete}
              disabled={clearing}
              className="flex-1 rounded-xl border border-rose-300/15 bg-rose-400/10 px-3 py-2.5 text-sm font-semibold text-rose-100 hover:bg-rose-400/15 transition disabled:opacity-40"
            >
              {clearing ? 'Clearing…' : isClear ? 'Clear chat' : removeLocal ? 'Remove' : 'Delete'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  if (!selected) {
    return (
      <section className="glass rounded-[28px] h-full hidden md:grid place-items-center text-center p-8">
        <div className="max-w-sm">
          <LockKeyhole className="mx-auto text-sky-300/80" size={44} />
          <h2 className="mt-4 text-xl font-bold">Choose a chat</h2>
          <p className="text-sm text-white/45 mt-2">Search a username and send an invite. Messaging unlocks only after the other person accepts.</p>
        </div>
      </section>
    );
  }

  const pendingIncoming = selected.status === 'pending' && selected.requestedBy !== currentUser.id;

  return (
    <section ref={chatRef} className="glass rounded-[28px] h-full min-h-0 flex flex-col overflow-hidden border-white/10">
      <header className="chat-header-glass h-[76px] shrink-0 border-b border-sky-200/10 px-4 sm:px-5 flex items-center gap-3">
        <button className="md:hidden h-10 w-10 rounded-xl hover:bg-white/10 grid place-items-center" onClick={onBack} type="button" aria-label="Back"><ArrowLeft size={19} /></button>
        <Avatar user={selected.user} showStatus />
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{selected.user.username}</p>
          <p className={`text-xs mt-1 ${selected.user.online ? 'text-emerald-200/80' : 'text-white/40'}`}>
            {selected.status === 'accepted'
              ? selected.user.online
                ? 'Online · real-time chat'
                : `Last seen ${selected.user.lastSeen ? new Date(selected.user.lastSeen).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'recently'}`
              : pendingIncoming ? 'Invite awaiting your response' : 'Waiting for acceptance'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onBack}
            title="Exit chat"
            aria-label="Exit chat"
            className="h-10 px-3 sm:px-4 rounded-xl border border-sky-200/20 bg-sky-500/20 text-sky-50 hover:bg-sky-500/35 hover:border-sky-200/35 transition flex items-center gap-2 font-medium text-sm shadow-[0_8px_24px_rgba(14,165,233,0.12)]"
          >
            <ArrowLeft size={16} />
            <span>Exit chat</span>
          </button>
          {selected.status === 'accepted' && (
            <button type="button" onClick={requestClearChat} disabled={clearing} title="Clear entire chat" aria-label="Clear entire chat" className="clear-chat-btn h-10 w-10 rounded-xl grid place-items-center disabled:opacity-40">
              <Trash2 size={17} />
            </button>
          )}
        </div>
      </header>

      <div className="chat-body-glass flex-1 min-h-0 overflow-y-auto chat-scroll px-4 sm:px-6 py-5 space-y-3">
        {selected.status !== 'accepted' ? (
          <div className="h-full grid place-items-center text-center">
            <div className="max-w-sm"><div className="mx-auto h-14 w-14 rounded-2xl bg-white/5 grid place-items-center"><LockKeyhole size={24} className="text-amber-300" /></div><h3 className="mt-4 font-bold">Chat is locked</h3><p className="mt-2 text-sm text-white/45">{pendingIncoming ? 'Accept the invite from the chat list to open this conversation.' : 'This conversation will open once the other user accepts your invite.'}</p></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full grid place-items-center text-center text-sm text-white/40"><div><p className="font-semibold text-white/60">You are connected.</p><p className="mt-1">Send the first message.</p></div></div>
        ) : (
          messages.map((message) => {
            const mine = message.sender === currentUser.id;
            const deleted = message.deletedForMe || message.deletedForEveryone;
            return (
              <div key={message.id || message._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className="group max-w-[78%] sm:max-w-[65%]">
                  <div
                    onContextMenu={(event) => handleMessageContext(event, message)}
                    className={`message-bubble relative rounded-2xl px-3.5 py-2.5 ${mine ? 'message-own rounded-br-md' : 'message-other rounded-bl-md'} ${deleted ? 'opacity-70' : ''}`}
                  >
                    <p className={`pr-8 text-[15px] leading-relaxed whitespace-pre-wrap break-words ${deleted ? 'italic text-white/55' : ''}`}>
                      {message.text}
                    </p>
                    <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[10px] pr-7">
                      {message.editedAt && !deleted && <span className="text-white/40">edited</span>}
                      <span className={mine ? 'text-emerald-100/70' : 'text-blue-100/65'}>{timeLabel(message.createdAt)}</span>
                      {mine && <StatusTicks message={message} />}
                    </div>
                    <button
                      type="button"
                      className="message-more-btn absolute top-1.5 right-1.5 h-7 w-7 rounded-lg grid place-items-center"
                      onClick={(event) => handleMoreClick(event, message)}
                      aria-label="Message actions"
                    >
                      <MoreHorizontal size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {actionNotice && (
        <div className="px-3 sm:px-4 pt-2">
          <button type="button" onClick={() => setActionNotice('')} className="w-full rounded-xl bg-sky-400/8 border border-sky-200/10 px-3 py-2 text-left text-xs text-white/55 truncate">{actionNotice}</button>
        </div>
      )}

      <form onSubmit={send} className="composer-panel p-3 sm:p-4 border-t border-white/10">
        {editingMessage && (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-xl px-3 py-2 editing-bar">
            <div className="min-w-0"><p className="text-xs font-semibold text-emerald-100">Editing message</p><p className="text-[11px] text-white/40 truncate">You can edit this message for up to 30 minutes.</p></div>
            <button type="button" onClick={cancelEdit} className="h-8 w-8 rounded-lg grid place-items-center hover:bg-white/10 text-white/60" aria-label="Cancel edit"><X size={15} /></button>
          </div>
        )}
        <div className="composer-input-glass rounded-2xl p-1.5 flex items-end gap-2">
          <textarea ref={textareaRef} value={text} onChange={(e) => setText(e.target.value)} disabled={selected.status !== 'accepted'} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }} rows={1} placeholder={selected.status === 'accepted' ? 'Write a message…' : 'Chat unavailable until both users agree'} className="flex-1 resize-none bg-transparent outline-none px-3 py-2.5 text-sm text-white placeholder:text-white/25 max-h-32 disabled:cursor-not-allowed" />
          <button type="submit" disabled={!text.trim() || selected.status !== 'accepted'} className="h-11 w-11 rounded-xl bg-sky-400/75 text-slate-950 grid place-items-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-sky-300/80 transition">{editingId ? <Edit3 size={17} /> : <Send size={18} />}</button>
        </div>
        <p className="text-[10px] text-white/25 mt-2 px-2"><LockKeyhole size={11} className="inline mr-1" />Only approved connections can exchange messages.</p>
      </form>

      {renderContextMenu()}
      {renderInfoModal()}
      {renderConfirmation()}
    </section>
  );
}
