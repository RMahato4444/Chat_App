import mongoose from 'mongoose';
import Connection from '../models/Connection.js';
import Message from '../models/Message.js';

function serializeMessage(message, viewerId) {
  const raw = message.toObject ? message.toObject() : message;
  const id = raw._id?.toString?.() || raw.id?.toString?.();
  const sender = raw.sender?.toString?.() || raw.sender;
  const receiver = raw.receiver?.toString?.() || raw.receiver;
  const deletedForMe = (raw.deletedFor || []).some((idValue) => idValue.toString() === viewerId.toString());

  return {
    ...raw,
    id,
    sender,
    receiver,
    deletedForMe,
    text: raw.deletedForEveryone || deletedForMe ? 'This message was deleted' : raw.text
  };
}

async function getAuthorizedConnection(connectionId, userId) {
  if (!mongoose.isValidObjectId(connectionId)) return null;
  const connection = await Connection.findById(connectionId);
  if (!connection || connection.status !== 'accepted') return null;
  if (!connection.userA.equals(userId) && !connection.userB.equals(userId)) return null;
  return connection;
}

export async function getMessages(req, res) {
  const { connectionId } = req.params;
  const connection = await getAuthorizedConnection(connectionId, req.user._id);
  if (!connection) return res.status(403).json({ message: 'Chat is not active or you are not allowed.' });

  const messages = await Message.find({ connection: connectionId }).sort({ createdAt: 1 }).limit(100);
  const visibleMessages = messages
    .filter((message) => !message.deletedForEveryone && !(message.deletedFor || []).some((id) => id.toString() === req.user._id.toString()))
    .map((message) => serializeMessage(message, req.user._id));

  res.json({ messages: visibleMessages });
}

export async function markRead(req, res) {
  const { connectionId } = req.params;
  const connection = await getAuthorizedConnection(connectionId, req.user._id);
  if (!connection) return res.status(403).json({ message: 'Chat is not active or you are not allowed.' });

  const readAt = new Date();
  const unread = await Message.find({ connection: connectionId, receiver: req.user._id, readAt: null }).select('_id sender');

  if (unread.length) {
    await Message.updateMany(
      { _id: { $in: unread.map((message) => message._id) } },
      { $set: { readAt } }
    );

    const io = req.app.get('io');
    if (io) {
      const messageIds = unread.map((message) => message._id.toString());
      const senderIds = [...new Set(unread.map((message) => message.sender.toString()))];
      const statusPayload = { connection: connectionId, messageIds, readAt: readAt.toISOString() };
      senderIds.forEach((senderId) => io.to(`user:${senderId}`).emit('message:status', statusPayload));
      io.to(`user:${req.user._id.toString()}`).emit('message:status', statusPayload);
    }
  }

  res.json({ ok: true, readAt });
}

export async function clearMessages(req, res) {
  const { connectionId } = req.params;
  const connection = await getAuthorizedConnection(connectionId, req.user._id);
  if (!connection) return res.status(403).json({ message: 'Chat is not active or you are not allowed.' });

  await Message.deleteMany({ connection: connectionId });

  const otherUserId = connection.userA.equals(req.user._id)
    ? connection.userB.toString()
    : connection.userA.toString();

  const io = req.app.get('io');
  if (io) {
    const payload = { connection: connectionId };
    io.to(`user:${req.user._id.toString()}`).emit('chat:cleared', payload);
    io.to(`user:${otherUserId}`).emit('chat:cleared', payload);
  }

  res.json({ ok: true });
}
