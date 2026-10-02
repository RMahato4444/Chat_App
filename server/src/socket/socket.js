import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { verifyToken } from '../utils/auth.js';
import Connection from '../models/Connection.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { getOnlineUserIds, markOffline, markOnline } from '../presence.js';

const EDIT_WINDOW_MS = 30 * 60 * 1000;

async function authorizedConnection(connectionId, userId) {
  if (!mongoose.isValidObjectId(connectionId)) return null;
  const connection = await Connection.findById(connectionId);
  if (!connection || connection.status !== 'accepted') return null;
  if (!connection.userA.equals(userId) && !connection.userB.equals(userId)) return null;
  return connection;
}

function messagePayload(message, viewerId) {
  const deletedForMe = (message.deletedFor || []).some((id) => id.toString() === viewerId.toString());
  const text = message.deletedForEveryone || deletedForMe ? 'This message was deleted' : message.text;
  return {
    id: message._id.toString(),
    connection: message.connection.toString(),
    sender: message.sender.toString(),
    receiver: message.receiver.toString(),
    text,
    createdAt: message.createdAt,
    deliveredAt: message.deliveredAt,
    readAt: message.readAt,
    editedAt: message.editedAt,
    deletedForMe,
    deletedForEveryone: message.deletedForEveryone
  };
}

async function markDeliveredForUser(io, userId, connectionId = null, messageIds = []) {
  const query = { receiver: userId, deliveredAt: null };
  if (connectionId) query.connection = connectionId;
  if (messageIds.length) query._id = { $in: messageIds };

  const pending = await Message.find(query).select('_id sender connection');
  if (!pending.length) return;

  const deliveredAt = new Date();
  await Message.updateMany({ _id: { $in: pending.map((message) => message._id) } }, { $set: { deliveredAt } });

  const grouped = new Map();
  pending.forEach((message) => {
    const senderId = message.sender.toString();
    if (!grouped.has(senderId)) grouped.set(senderId, { messageIds: [], connection: message.connection.toString() });
    grouped.get(senderId).messageIds.push(message._id.toString());
  });

  grouped.forEach((payload, senderId) => {
    const statusPayload = { ...payload, deliveredAt: deliveredAt.toISOString() };
    io.to(`user:${senderId}`).emit('message:status', statusPayload);
    io.to(`user:${userId}`).emit('message:status', statusPayload);
  });
}

async function markReadForUser(io, userId, connectionId) {
  const pending = await Message.find({ connection: connectionId, receiver: userId, readAt: null }).select('_id sender');
  if (!pending.length) return;

  const readAt = new Date();
  await Message.updateMany({ _id: { $in: pending.map((message) => message._id) } }, { $set: { readAt } });

  const senderIds = [...new Set(pending.map((message) => message.sender.toString()))];
  const statusPayload = {
    connection: connectionId,
    messageIds: pending.map((message) => message._id.toString()),
    readAt: readAt.toISOString()
  };
  senderIds.forEach((senderId) => io.to(`user:${senderId}`).emit('message:status', statusPayload));
  io.to(`user:${userId}`).emit('message:status', statusPayload);
}

export function setupSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL, methods: ['GET', 'POST', 'DELETE'] }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = verifyToken(token || '');
      const user = await User.findById(payload.userId).select('_id username profilePicture lastSeen');
      if (!user) return next(new Error('Unauthorized'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    const becameOnline = markOnline(userId);
    socket.join(`user:${userId}`);

    socket.emit('presence:snapshot', { userIds: getOnlineUserIds() });
    if (becameOnline) io.emit('presence:update', { userId, online: true, lastSeen: null });

    await markDeliveredForUser(io, userId);

    socket.on('conversation:join', async ({ connectionId }) => {
      const connection = await authorizedConnection(connectionId, userId);
      if (!connection) return;
      socket.join(`connection:${connectionId}`);
      await markDeliveredForUser(io, userId, connectionId);
    });

    socket.on('message:send', async ({ connectionId, text }) => {
      try {
        const cleanText = String(text || '').trim();
        if (!cleanText || cleanText.length > 4000) return;
        const connection = await authorizedConnection(connectionId, userId);
        if (!connection) return socket.emit('message:error', { message: 'Chat is not active.' });

        const receiver = connection.userA.equals(userId) ? connection.userB : connection.userA;
        const receiverId = receiver.toString();
        const deliveredAt = getOnlineUserIds().includes(receiverId) ? new Date() : null;

        const message = await Message.create({ connection: connectionId, sender: userId, receiver, text: cleanText, deliveredAt });
        io.to(`user:${userId}`).emit('message:new', messagePayload(message, userId));
        io.to(`user:${receiverId}`).emit('message:new', messagePayload(message, receiverId));
      } catch (error) {
        console.error('message:send failed:', error);
        socket.emit('message:error', { message: 'Unable to send message.' });
      }
    });

    socket.on('messages:delivered', async ({ connectionId, messageIds = [] }) => {
      try {
        const connection = await authorizedConnection(connectionId, userId);
        if (!connection) return;
        const normalizedIds = Array.isArray(messageIds)
          ? messageIds.filter((id) => mongoose.isValidObjectId(id)).map((id) => new mongoose.Types.ObjectId(id))
          : [];
        await markDeliveredForUser(io, userId, connectionId, normalizedIds);
      } catch {
        // Ignore acknowledgement errors.
      }
    });

    socket.on('messages:read', async ({ connectionId }) => {
      try {
        const connection = await authorizedConnection(connectionId, userId);
        if (!connection) return;
        await markDeliveredForUser(io, userId, connectionId);
        await markReadForUser(io, userId, connectionId);
      } catch {
        // Ignore acknowledgement errors.
      }
    });

    socket.on('message:edit', async ({ connectionId, messageId, text }) => {
      try {
        const connection = await authorizedConnection(connectionId, userId);
        if (!connection || !mongoose.isValidObjectId(messageId)) return;
        const cleanText = String(text || '').trim();
        if (!cleanText || cleanText.length > 4000) return;

        const message = await Message.findOne({ _id: messageId, connection: connectionId, sender: userId, deletedForEveryone: false });
        if (!message) return socket.emit('message:error', { message: 'You can only edit your own active messages.' });

        const ageMs = Date.now() - new Date(message.createdAt).getTime();
        if (ageMs < 0 || ageMs > EDIT_WINDOW_MS) {
          return socket.emit('message:error', { message: 'Messages can only be edited within 30 minutes of being sent.' });
        }

        message.text = cleanText;
        message.editedAt = new Date();
        await message.save();

        const receiverId = message.receiver.toString();
        io.to(`user:${userId}`).emit('message:update', messagePayload(message, userId));
        io.to(`user:${receiverId}`).emit('message:update', messagePayload(message, receiverId));
      } catch {
        socket.emit('message:error', { message: 'Unable to edit message.' });
      }
    });

    socket.on('message:delete', async ({ connectionId, messageId, mode = 'me' }) => {
      try {
        const connection = await authorizedConnection(connectionId, userId);
        if (!connection || !mongoose.isValidObjectId(messageId)) return;

        const message = await Message.findOne({ _id: messageId, connection: connectionId });
        if (!message) return;

        if (mode === 'everyone') {
          if (!message.sender.equals(userId)) {
            return socket.emit('message:error', { message: 'Only the sender can delete this message for everyone.' });
          }
          message.deletedForEveryone = true;
          message.text = 'This message was deleted';
          message.editedAt = null;
          await message.save();

          const senderId = message.sender.toString();
          const receiverId = message.receiver.toString();
          io.to(`user:${senderId}`).emit('message:deleted', { connection: connectionId, messageId, mode: 'everyone' });
          io.to(`user:${receiverId}`).emit('message:deleted', { connection: connectionId, messageId, mode: 'everyone' });
          return;
        }

        if (mode !== 'me') return;
        await Message.updateOne({ _id: messageId }, { $addToSet: { deletedFor: userId } });
        io.to(`user:${userId}`).emit('message:deleted', { connection: connectionId, messageId, mode: 'me' });
      } catch {
        socket.emit('message:error', { message: 'Unable to delete message.' });
      }
    });

    socket.on('disconnect', async () => {
      const lastSeen = markOffline(userId);
      if (!lastSeen) return;
      try {
        await User.findByIdAndUpdate(userId, { $set: { lastSeen } });
      } catch {
        // Ignore persistence errors.
      }
      io.emit('presence:update', { userId, online: false, lastSeen: lastSeen.toISOString() });
    });
  });

  return io;
}
