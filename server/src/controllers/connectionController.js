import mongoose from 'mongoose';
import User from '../models/User.js';
import Connection from '../models/Connection.js';

function pairIds(a, b) {
  const aStr = a.toString();
  const bStr = b.toString();
  return aStr < bStr ? { userA: a, userB: b } : { userA: b, userB: a };
}

async function connectionFor(userId, otherId) {
  return Connection.findOne(pairIds(userId, otherId));
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    profilePicture: user.profilePicture || null,
    online: user.online ?? false,
    lastSeen: user.lastSeen ?? null,
  };
}

export async function sendInvite(req, res) {
  const username = String(req.body.username || '').trim();
  const target = await User.findOne({ usernameLower: username.toLowerCase() });

  if (!target) {
    return res.status(404).json({ message: 'User not found.' });
  }

  if (target._id.equals(req.user._id)) {
    return res.status(400).json({ message: 'You cannot invite yourself.' });
  }

  const pair = pairIds(req.user._id, target._id);
  const existing = await Connection.findOne(pair);

  const io = req.app.get('io');

  if (existing) {
    if (existing.status === 'accepted') {
      return res.status(409).json({ message: 'You are already connected.' });
    }

    if (existing.status === 'pending') {
      return res.status(409).json({
        message: existing.requestedBy.equals(req.user._id)
          ? 'Invite already sent.'
          : 'This user has already invited you.',
      });
    }

    existing.requestedBy = req.user._id;
    existing.status = 'pending';
    await existing.save();

    io.to(`user:${target._id}`).emit('connection:new', {
      id: existing._id.toString(),
      status: 'pending',
      requestedBy: req.user._id.toString(),
      from: publicUser(req.user),
      user: publicUser(req.user),
    });

    io.to(`user:${req.user._id}`).emit('connection:update', {
      connectionId: existing._id.toString(),
      status: 'pending',
      requestedBy: req.user._id.toString(),
      user: publicUser(target),
    });

    return res.status(201).json({
      message: 'Invite sent again.',
      connection: existing,
    });
  }

  const connection = await Connection.create({
    ...pair,
    requestedBy: req.user._id,
    status: 'pending',
  });

  io.to(`user:${target._id}`).emit('connection:new', {
    id: connection._id.toString(),
    status: 'pending',
    requestedBy: req.user._id.toString(),
    from: publicUser(req.user),
    user: publicUser(req.user),
  });

  io.to(`user:${req.user._id}`).emit('connection:update', {
    connectionId: connection._id.toString(),
    status: 'pending',
    requestedBy: req.user._id.toString(),
    user: publicUser(target),
  });

  return res.status(201).json({
    message: 'Chat invite sent.',
    connection,
  });
}

export async function respondToInvite(req, res) {
  const { connectionId, action } = req.body;

  if (!mongoose.isValidObjectId(connectionId)) {
    return res.status(400).json({ message: 'Invalid connection.' });
  }

  if (!['accept', 'decline'].includes(action)) {
    return res.status(400).json({ message: 'Invalid action.' });
  }

  const connection = await Connection.findById(connectionId);

  if (!connection) {
    return res.status(404).json({ message: 'Invite not found.' });
  }

  const isParticipant =
    connection.userA.equals(req.user._id) ||
    connection.userB.equals(req.user._id);

  if (!isParticipant) {
    return res.status(403).json({ message: 'Not allowed.' });
  }

  if (connection.status !== 'pending') {
    return res.status(400).json({ message: 'Invite is no longer pending.' });
  }

  if (connection.requestedBy.equals(req.user._id)) {
    return res.status(400).json({
      message: 'The recipient must respond to this invite.',
    });
  }

  connection.status = action === 'accept' ? 'accepted' : 'declined';
  await connection.save();

  const otherId = connection.userA.equals(req.user._id)
    ? connection.userB
    : connection.userA;

  const io = req.app.get('io');

  const updatePayload = {
    connectionId: connection._id.toString(),
    status: connection.status,
    requestedBy: connection.requestedBy.toString(),
    user: publicUser(req.user),
  };

  // Notify the person who accepted/declined.
  io.to(`user:${req.user._id}`).emit('connection:update', {
    ...updatePayload,
    user: publicUser(
      await User.findById(otherId).select('username profilePicture online lastSeen')
    ),
  });

  // Notify the original sender immediately.
  io.to(`user:${otherId}`).emit('connection:update', updatePayload);

  return res.json({
    message:
      action === 'accept'
        ? 'Chat invite accepted.'
        : 'Chat invite declined.',
    status: connection.status,
  });
}

export async function getConversation(req, res) {
  const { connectionId } = req.params;

  if (!mongoose.isValidObjectId(connectionId)) {
    return res.status(400).json({ message: 'Invalid connection.' });
  }

  const connection = await Connection.findById(connectionId);

  if (!connection) {
    return res.status(404).json({ message: 'Conversation not found.' });
  }

  if (
    !connection.userA.equals(req.user._id) &&
    !connection.userB.equals(req.user._id)
  ) {
    return res.status(403).json({ message: 'Not allowed.' });
  }

  return res.json({ connection });
}
