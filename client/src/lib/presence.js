export function presenceLabel(user) {
  if (user?.online) return 'Online';
  if (!user?.lastSeen) return 'Last seen unavailable';

  const date = new Date(user.lastSeen);
  if (Number.isNaN(date.getTime())) return 'Last seen recently';

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const now = new Date();
  const today = now.toDateString() === date.toDateString();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toDateString() === date.toDateString();

  if (today) return `Last seen today at ${time}`;
  if (yesterday) return `Last seen yesterday at ${time}`;

  return `Last seen ${date.toLocaleDateString([], { day: 'numeric', month: 'short', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' })} at ${time}`;
}
