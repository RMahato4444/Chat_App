import User from '../models/User.js';
import Connection from '../models/Connection.js';
import { getLastSeen, isUserOnline } from '../presence.js';

function publicUser(user, presence = {}) {
  const id = user._id.toString();
  const online = presence.online ?? isUserOnline(id);
  return {
    id,
    username: user.username,
    profilePicture: user.profilePicture || null,
    online,
    lastSeen: online ? null : (presence.lastSeen || getLastSeen(id, user.lastSeen) || null)
  };
}

export async function searchUsers(req, res) {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ users: [] });
  const users = await User.find({ usernameLower: { $regex: q.toLowerCase(), $options: 'i' }, _id: { $ne: req.user._id } })
    .select('_id username profilePicture lastSeen')
    .limit(20);
  res.json({ users: users.map(user => publicUser(user)) });
}

export async function getProfile(req, res) {
  res.json({ user: publicUser(req.user) });
}

export async function uploadProfilePicture(req, res) {
  if (!req.file) return res.status(400).json({ message: 'Please choose an image.' });
  req.user.profilePicture = `/uploads/${req.file.filename}`;
  await req.user.save();
  res.json({ user: publicUser(req.user) });
}

export async function getConnections(req, res) {
  const userId = req.user._id;
  const connections = await Connection.find({ $or: [{ userA: userId }, { userB: userId }] })
    .populate('userA', '_id username profilePicture lastSeen')
    .populate('userB', '_id username profilePicture lastSeen')
    .sort({ updatedAt: -1 });

  const normalized = connections.map((c) => {
    const isA = c.userA._id.equals(userId);
    const other = isA ? c.userB : c.userA;
    const otherId = other._id.toString();
    const online = isUserOnline(otherId);
    return {
      id: c._id.toString(),
      status: c.status,
      requestedBy: c.requestedBy.toString(),
      user: publicUser(other, { online, lastSeen: online ? null : getLastSeen(otherId, other.lastSeen) }),
      updatedAt: c.updatedAt
    };
  });
  res.json({ connections: normalized });
}
