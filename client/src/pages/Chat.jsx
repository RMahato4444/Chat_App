import { ImagePlus, LogOut, Plus, Search, Settings2, Trash2, UserRound, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Avatar from '../components/Avatar';
import ChatListItem from '../components/ChatListItem';
import ChatWindow from '../components/ChatWindow';
import { api, SOCKET_URL } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function Chat() {
  const { user, updateUser, logout } = useAuth();
  const [connections, setConnections] = useState([]);
  const [presence, setPresence] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState({});
  const [chatMeta, setChatMeta] = useState({});
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileChat, setMobileChat] = useState(false);
  const [busyUser, setBusyUser] = useState('');
  const [notice, setNotice] = useState('');
  const [profileAction, setProfileAction] = useState('');
  const socketRef = useRef(null);
  const searchTimer = useRef(null);
  const selectedIdRef = useRef(null);

  const currentUserId = String(user?.id || user?._id || '');

  const messageSenderId = (message) => {
    const sender = message?.sender;

    if (typeof sender === 'string' || typeof sender === 'number') {
      return String(sender);
    }

    return String(
      sender?.id ||
      sender?._id ||
      message?.senderId ||
      message?.userId ||
      message?.user?.id ||
      message?.user?._id ||
      message?.from?.id ||
      message?.from?._id ||
      message?.senderUser?.id ||
      message?.senderUser?._id ||
      ''
    );
  };

  const isOwnMessage = (message) => {
    const senderId = messageSenderId(message);
    return Boolean(senderId) && senderId === currentUserId;
  };

  const messageText = (message) => {
    if (!message) return '';
    if (message.deletedForMe || message.deletedForEveryone) {
      return 'This message was deleted';
    }
    return String(message.text || message.content || '').trim();
  };

  const buildChatMeta = (messageList = []) => {
    const lastMessage = messageList.length
      ? messageList[messageList.length - 1]
      : null;

    const unreadCount = messageList.reduce((count, message) => {
      const senderId = messageSenderId(message);
      const isIncoming = Boolean(senderId) && senderId !== currentUserId;
      const isUnread = isIncoming && !message.readAt && !message.deletedForMe;
      return count + (isUnread ? 1 : 0);
    }, 0);

    return {
      lastMessage,
      unreadCount,
    };
  };

  const setChatMetaFromMessages = (connectionId, messageList, unreadOverride) => {
    const meta = buildChatMeta(messageList);
    setChatMeta((prev) => ({
      ...prev,
      [String(connectionId)]: {
        ...meta,
        ...(typeof unreadOverride === 'number'
          ? { unreadCount: unreadOverride }
          : {}),
      },
    }));
  };

  const enrichedConnections = useMemo(
    () => connections.map((connection) => {
      const state = presence[connection.user.id];
      return {
        ...connection,
        user: {
          ...connection.user,
          online: state?.online ?? connection.user.online ?? false,
          lastSeen: state?.online ? null : (state?.lastSeen ?? connection.user.lastSeen ?? null)
        }
      };
    }),
    [connections, presence]
  );

  const selected = enrichedConnections.find(c => c.id === selectedId) || null;

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const refreshConnections = async () => {
    const { data } = await api.get('/users/connections');
    const list = (data.connections || []).map((item) => ({
      ...item,
      currentUserId: user.id,
    }));

    setConnections(list);

    setPresence((prev) => {
      const next = { ...prev };

      for (const item of list) {
        const userId = String(item.user?.id || item.user?._id);
        if (!userId) continue;

        next[userId] = {
          online: item.user?.online ?? false,
          lastSeen: item.user?.lastSeen ?? null,
        };
      }

      return next;
    });

    setSelectedId((prev) =>
      prev && list.some((item) => item.id === prev) ? prev : null
    );

    const accepted = list.filter((item) => item.status === 'accepted');

    const results = await Promise.all(
      accepted.map(async (connection) => {
        try {
          const { data: messageData } = await api.get(
            `/messages/${connection.id}`
          );
          return [String(connection.id), buildChatMeta(messageData.messages || [])];
        } catch {
          return [String(connection.id), { lastMessage: null, unreadCount: 0 }];
        }
      })
    );

    setChatMeta((prev) => {
      const next = { ...prev };

      results.forEach(([connectionId, meta]) => {
        const existing = prev[connectionId];
        next[connectionId] = {
          ...meta,
          // Preserve a locally newer unread count if refresh happens while
          // a live message is arriving.
          unreadCount:
            typeof existing?.unreadCount === 'number'
              ? Math.max(existing.unreadCount, meta.unreadCount)
              : meta.unreadCount,
        };
      });

      return next;
    });
  };


  useEffect(() => {
    refreshConnections().catch(() => setNotice('Could not load your chats.'));
    const socket = io(SOCKET_URL, { auth: { token: localStorage.getItem('glasschat_token') } });
    socketRef.current = socket;

    socket.on('connect', () => refreshConnections().catch(() => {}));
    socket.on('presence:snapshot', ({ userIds = [] }) => {
      setPresence(prev => {
        const next = { ...prev };
        userIds.forEach(id => { next[id] = { online: true, lastSeen: null }; });
        return next;
      });
    });
    socket.on('presence:update', ({ userId, online, lastSeen }) => {
      setPresence(prev => ({
        ...prev,
        [userId]: { online, lastSeen: online ? null : lastSeen }
      }));
    });
    socket.on('message:new', (message) => {
      const connectionId = String(message.connection);
      const senderId = messageSenderId(message);
      const incoming = Boolean(senderId) && senderId !== currentUserId;
      const isCurrentConversation = selectedIdRef.current === connectionId;

      setMessages((prev) => {
        const current = prev[connectionId] || [];

        if (
          current.some(
            (m) => String(m.id || m._id) === String(message.id || message._id)
          )
        ) {
          return prev;
        }

        return {
          ...prev,
          [connectionId]: [...current, message],
        };
      });

      setChatMeta((prev) => {
        const current = prev[connectionId] || {
          lastMessage: null,
          unreadCount: 0,
        };

        return {
          ...prev,
          [connectionId]: {
            ...current,
            lastMessage: message,
            unreadCount:
              incoming && !isCurrentConversation
                ? current.unreadCount + 1
                : current.unreadCount,
          },
        };
      });

      // Move this connection to the top immediately whenever a new
      // message arrives, whether it was sent or received.
      setConnections((prev) =>
        prev.map((connection) =>
          String(connection.id) === connectionId
            ? {
                ...connection,
                updatedAt:
                  message.createdAt ||
                  message.sentAt ||
                  message.timestamp ||
                  new Date().toISOString(),
              }
            : connection
        )
      );

      if (incoming && isCurrentConversation) {
        api.post(`/messages/${connectionId}/read`).catch(() => {});
        socketRef.current?.emit('messages:read', {
          connectionId,
        });
      }
    });

    socket.on('message:status', ({ connection, messageIds = [], deliveredAt, readAt }) => {
      setMessages((prev) => {
        const current = prev[connection] || [];
        const ids = new Set(messageIds.map(String));

        if (!ids.size) return prev;

        const next = current.map((message) => {
          const id = String(message.id || message._id);
          if (!ids.has(id)) return message;

          return {
            ...message,
            ...(deliveredAt ? { deliveredAt } : {}),
            ...(readAt ? { readAt } : {}),
          };
        });

        setChatMeta((metaPrev) => ({
          ...metaPrev,
          [String(connection)]: {
            ...buildChatMeta(next),
            unreadCount:
              readAt && String(selectedId) === String(connection)
                ? 0
                : metaPrev[String(connection)]?.unreadCount ?? 0,
          },
        }));

        return {
          ...prev,
          [connection]: next,
        };
      });
    });

    socket.on('connection:new', () => {
      refreshConnections();
      setNotice('New chat invite received.');
    });
    socket.on('connection:update', () => {
      refreshConnections();
    });
    socket.on('message:error', ({ message }) => setNotice(message));

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (!selectedId || selected?.status !== 'accepted') return;
    socketRef.current?.emit('conversation:join', { connectionId: selectedId });
    api.get(`/messages/${selectedId}`)
      .then(({ data }) => {
        const nextMessages = data.messages || [];

        setMessages((prev) => ({
          ...prev,
          [selectedId]: nextMessages,
        }));

        setChatMeta((prev) => ({
          ...prev,
          [String(selectedId)]: {
            ...buildChatMeta(nextMessages),
            unreadCount: 0,
          },
        }));
      })
      .catch(() => {});
    api.post(`/messages/${selectedId}/read`).catch(() => {});
    socketRef.current?.emit('messages:read', { connectionId: selectedId });

    setChatMeta((prev) => ({
      ...prev,
      [String(selectedId)]: {
        ...(prev[String(selectedId)] || {}),
        unreadCount: 0,
      },
    }));
  }, [selectedId, selected?.status]);

  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(() => {
      api.get('/users/search', { params: { q: search.trim() } })
        .then(({ data }) => setSearchResults(data.users))
        .catch(() => setSearchResults([]));
    }, 250);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  const invite = async (username) => {
    setBusyUser(username);
    setNotice('');
    try {
      await api.post('/connections/invite', { username });
      setNotice(`Invite sent to ${username}.`);
      setSearch('');
      setSearchResults([]);
      await refreshConnections();
    } catch (err) {
      setNotice(err?.response?.data?.message || 'Could not send invite.');
    } finally {
      setBusyUser('');
    }
  };

  const respond = async (connectionId, action) => {
    try {
      await api.post('/connections/respond', { connectionId, action });
      await refreshConnections();
      setSelectedId(connectionId);
      setMobileChat(true);
      setNotice(action === 'accept' ? 'Chat unlocked.' : 'Invite declined.');
    } catch (err) {
      setNotice(err?.response?.data?.message || 'Unable to respond.');
    }
  };

  const uploadPhoto = async (file) => {
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setNotice('Profile picture must be 3 MB or smaller.');
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setNotice('Only JPG, PNG, and WEBP images are supported.');
      return;
    }

    const body = new FormData();
    body.append('profilePicture', file);

    setProfileAction('upload');
    try {
      const { data } = await api.post('/users/profile/picture', body);
      updateUser(data.user);
      setNotice('Profile picture updated.');
    } catch (err) {
      setNotice(err?.response?.data?.message || 'Could not upload profile picture.');
    } finally {
      setProfileAction('');
    }
  };

  const removePhoto = async () => {
    if (!user?.profilePicture || profileAction) return;

    setProfileAction('remove');
    try {
      const { data } = await api.delete('/users/profile/picture');
      updateUser(data.user);
      setNotice('Profile picture removed.');
    } catch (err) {
      setNotice(err?.response?.data?.message || 'Could not remove profile picture.');
    } finally {
      setProfileAction('');
    }
  };

  const getLatestActivityTime = (connection) => {
    const connectionId = String(connection.id);

    const lastMessage =
      chatMeta[connectionId]?.lastMessage ||
      (messages[connectionId]?.length
        ? messages[connectionId][messages[connectionId].length - 1]
        : null);

    const messageTime =
      lastMessage?.createdAt ||
      lastMessage?.sentAt ||
      lastMessage?.timestamp ||
      lastMessage?.updatedAt;

    const messageTimestamp = messageTime
      ? new Date(messageTime).getTime()
      : 0;

    const connectionTimestamp = connection.updatedAt
      ? new Date(connection.updatedAt).getTime()
      : 0;

    return Math.max(
      Number.isFinite(messageTimestamp) ? messageTimestamp : 0,
      Number.isFinite(connectionTimestamp) ? connectionTimestamp : 0
    );
  };

  const sortedConnections = useMemo(
    () =>
      [...enrichedConnections].sort(
        (a, b) => getLatestActivityTime(b) - getLatestActivityTime(a)
      ),
    [enrichedConnections, chatMeta, messages]
  );

  return (
    <div className="app-bg min-h-full h-screen overflow-hidden p-3 sm:p-5">
      <div className="relative z-10 max-w-[1500px] mx-auto h-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-3 sm:gap-5">
        <div className={`${mobileChat ? 'block' : 'hidden'} lg:block h-full min-h-0`}>
          <ChatWindow
            currentUser={user}
            selected={selected}
            messages={messages[selectedId] || []}
            socket={socketRef.current}
            onBack={() => setMobileChat(false)}
          />
        </div>

        <aside className={`${mobileChat ? 'hidden' : 'flex'} lg:flex glass rounded-[28px] min-h-0 flex-col overflow-hidden`}>
          <header className="px-4 sm:px-5 pt-4 pb-3 border-b border-white/10 bg-black/10">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar user={{ ...user, online: true }} showStatus />
                <div className="min-w-0">
                  <p className="font-bold truncate">{user.username}</p>
                  <p className="text-[11px] text-blue-100/85 mt-0.5">Online</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setProfileOpen(true)} className="h-10 w-10 rounded-xl hover:bg-white/7 grid place-items-center text-white/65" type="button"><Settings2 size={18} /></button>
                <button onClick={logout} className="h-10 w-10 rounded-xl hover:bg-rose-500/10 text-white/55 grid place-items-center" type="button"><LogOut size={18} /></button>
              </div>
            </div>

            <div className="relative mt-4">
              <Search size={17} className="absolute left-3.5 top-3.5 text-white/30" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search username to invite…" className="w-full rounded-2xl glass-soft pl-10 pr-10 py-3 text-sm outline-none placeholder:text-white/25 focus:border-blue-300/30" />
              {search && <button onClick={() => { setSearch(''); setSearchResults([]); }} className="absolute right-2 top-2 h-8 w-8 rounded-xl grid place-items-center hover:bg-white/8 text-white/35" type="button"><X size={15} /></button>}
              {search && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-[52px] z-20 glass rounded-2xl p-2 shadow-glass animate-pop">
                  {searchResults.map(result => (
                    <div key={result.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5">
                      <Avatar user={result} showStatus size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{result.username}</p>
                        <p className="text-[10px] text-white/35">{result.online ? 'Online now' : 'Username match'}</p>
                      </div>
                      <button disabled={busyUser === result.username} onClick={() => invite(result.username)} className="rounded-xl bg-blue-400/15 border border-blue-300/15 px-3 py-2 text-xs font-bold text-blue-200 disabled:opacity-40" type="button"><UserRound size={13} className="inline mr-1" />{busyUser === result.username ? 'Sending…' : 'Invite'}</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {notice && <button onClick={() => setNotice('')} className="mt-3 w-full text-left rounded-xl bg-blue-500/10 border border-blue-300/10 px-3 py-2 text-xs text-white/60 truncate" type="button">{notice}</button>}
          </header>

          <div className="flex-1 overflow-y-auto chat-scroll p-2.5 sm:p-3 space-y-1.5">
            <div className="px-2 pt-2 pb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[.12em] text-white/30">People & chats</p>
              <span className="text-[10px] text-white/20">{connections.length}</span>
            </div>

            {sortedConnections.length === 0 && (
              <div className="m-2 rounded-2xl glass-soft p-5 text-center">
                <Plus className="mx-auto text-blue-200/80" size={24} />
                <p className="mt-3 text-sm font-semibold">No chats yet</p>
                <p className="mt-1 text-xs text-white/35">Use the username search above to send your first chat invite.</p>
              </div>
            )}

            {sortedConnections.map(item => (
              <ChatListItem
                key={item.id}
                item={item}
                active={selectedId === item.id}
                lastMessage={chatMeta[String(item.id)]?.lastMessage}
                unreadCount={chatMeta[String(item.id)]?.unreadCount || 0}
                onClick={() => {
                  setSelectedId(item.id);
                  setMobileChat(true);

                  setChatMeta((prev) => ({
                    ...prev,
                    [String(item.id)]: {
                      ...(prev[String(item.id)] || {}),
                      unreadCount: 0,
                    },
                  }));
                }}
                onAccept={() => respond(item.id, 'accept')}
                onDecline={() => respond(item.id, 'decline')}
              />
            ))}
          </div>
        </aside>
      </div>

      {profileOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm p-4 grid place-items-center" onMouseDown={() => setProfileOpen(false)}>
          <div onMouseDown={e => e.stopPropagation()} className="glass w-full max-w-md rounded-[28px] p-6">
            <div className="flex items-center justify-between"><h2 className="font-bold text-lg">Your profile</h2><button onClick={() => setProfileOpen(false)} className="h-9 w-9 rounded-xl hover:bg-white/8 grid place-items-center" type="button"><X size={17} /></button></div>
            <div className="mt-6 flex flex-col items-center"><Avatar user={{ ...user, online: true }} showStatus size="xl" /><p className="mt-4 text-xl font-bold">{user.username}</p><p className="text-xs text-blue-100/70 mt-1">Online now</p></div>
            <div className="mt-6 space-y-3">
              <label className={`block rounded-2xl glass-soft p-4 text-center transition ${profileAction ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-white/7'}`}>
                <ImagePlus size={18} className="mx-auto text-blue-200" />
                <p className="mt-2 text-sm font-semibold">Change profile picture</p>
                <p className="text-xs text-white/35 mt-1">PNG, JPG or WEBP · max 3 MB</p>
                <input type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(profileAction)} onChange={e => { uploadPhoto(e.target.files?.[0]); e.target.value = ''; }} className="hidden" />
              </label>

              <button
                onClick={removePhoto}
                disabled={!user?.profilePicture || Boolean(profileAction)}
                className={`w-full rounded-2xl border py-3 text-sm font-semibold transition ${
                  user?.profilePicture && !profileAction
                    ? 'border-rose-400/15 bg-rose-400/5 text-rose-200 hover:bg-rose-400/10'
                    : 'border-white/8 bg-white/[.03] text-white/25 cursor-not-allowed'
                }`}
                type="button"
                title={user?.profilePicture ? 'Remove your profile picture' : 'No profile picture to remove'}
              >
                <Trash2 size={15} className="inline mr-2" />
                {profileAction === 'remove' ? 'Removing…' : user?.profilePicture ? 'Remove profile picture' : 'No profile picture to remove'}
              </button>

              <button onClick={() => { setProfileOpen(false); logout(); }} className="w-full rounded-2xl border border-white/10 bg-white/5 text-white/75 py-3 text-sm font-semibold hover:bg-white/10 transition" type="button"><LogOut size={15} className="inline mr-2" />Sign out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
