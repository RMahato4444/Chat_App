import { Server } from 'socket.io';
import mongoose from 'mongoose';
import { verifyToken } from '../utils/auth.js';
import Connection from '../models/Connection.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { getOnlineUserIds, markOffline, markOnline } from '../presence.js';

export function setupSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL, methods: ['GET', 'POST'] }
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

  io.on('connection', (socket) => {
    const userId = socket.user._id.toString();
    const becameOnline = markOnline(userId);
    socket.join(`user:${userId}`);

    socket.emit('presence:snapshot', { userIds: getOnlineUserIds() });

    if (becameOnline) {
      io.emit('presence:update', {
        userId,
        online: true,
        lastSeen: null
      });
    }

    socket.on('conversation:join', async ({ connectionId }) => {
      if (!mongoose.isValidObjectId(connectionId)) return;
      const connection = await Connection.findById(connectionId);
      if (connection?.status === 'accepted' && (connection.userA.equals(userId) || connection.userB.equals(userId))) {
        socket.join(`connection:${connectionId}`);
      }
    });

    socket.on('message:send', async ({ connectionId, text }) => {
      try {
        const cleanText = String(text || '').trim();
        if (!cleanText || cleanText.length > 4000 || !mongoose.isValidObjectId(connectionId)) return;
        const connection = await Connection.findById(connectionId);
        if (!connection || connection.status !== 'accepted') return socket.emit('message:error', { message: 'Chat is not active.' });
        if (!connection.userA.equals(userId) && !connection.userB.equals(userId)) return socket.emit('message:error', { message: 'Not allowed.' });
        const receiver = connection.userA.equals(userId) ? connection.userB : connection.userA;
        const message = await Message.create({ connection: connectionId, sender: userId, receiver, text: cleanText });
        const payload = {
          id: message._id.toString(),
          connection: connectionId,
          sender: userId,
          receiver: receiver.toString(),
          text: message.text,
          createdAt: message.createdAt,
          readAt: null
        };
        io.to(`connection:${connectionId}`).emit('message:new', payload);
        io.to(`user:${receiver}`).emit('message:new', payload);
      } catch {
        socket.emit('message:error', { message: 'Unable to send message.' });
      }
    });

    socket.on('messages:read', async ({ connectionId }) => {
      if (!mongoose.isValidObjectId(connectionId)) return;
      await Message.updateMany({ connection: connectionId, receiver: userId, readAt: null }, { $set: { readAt: new Date() } });
    });

    socket.on('disconnect', async () => {
      const lastSeen = markOffline(userId);
      if (!lastSeen) return;

      try {
        await User.findByIdAndUpdate(userId, { $set: { lastSeen } });
      } catch {
        // Presence updates should still be broadcast even if persisting lastSeen fails.
      }

      io.emit('presence:update', {
        userId,
        online: false,
        lastSeen: lastSeen.toISOString()
      });
    });
  });

  return io;
}
