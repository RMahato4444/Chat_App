const connectionCounts = new Map();
const lastSeenCache = new Map();

function normalizeUserId(userId) {
  return userId?.toString();
}

export function markOnline(userId) {
  const id = normalizeUserId(userId);
  if (!id) return false;

  const current = connectionCounts.get(id) || 0;
  connectionCounts.set(id, current + 1);

  return current === 0;
}

export function markOffline(userId) {
  const id = normalizeUserId(userId);
  if (!id) return null;

  const current = connectionCounts.get(id) || 0;

  if (current <= 0) return null;

  if (current > 1) {
    connectionCounts.set(id, current - 1);
    return null;
  }

  connectionCounts.delete(id);

  const seenAt = new Date();
  lastSeenCache.set(id, seenAt);
  return seenAt;
}

export function isUserOnline(userId) {
  const id = normalizeUserId(userId);
  return Boolean(id && (connectionCounts.get(id) || 0) > 0);
}

export function getOnlineUserIds() {
  return [...connectionCounts.keys()];
}

export function getLastSeen(userId, persistedLastSeen = null) {
  const id = normalizeUserId(userId);
  if (!id) return persistedLastSeen || null;

  return lastSeenCache.get(id) || persistedLastSeen || null;
}