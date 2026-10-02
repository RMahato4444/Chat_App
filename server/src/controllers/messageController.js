import mongoose from 'mongoose';
import Connection from '../models/Connection.js';
import Message from '../models/Message.js';

export async function getMessages(req, res) {
  const { connectionId } = req.params;
  if (!mongoose.isValidObjectId(connectionId)) return res.status(400).json({ message: 'Invalid connection.' });
  const connection = await Connection.findById(connectionId);
  if (!connection || connection.status !== 'accepted') return res.status(403).json({ message: 'Chat is not active.' });
  if (!connection.userA.equals(req.user._id) && !connection.userB.equals(req.user._id)) return res.status(403).json({ message: 'Not allowed.' });

  const messages = await Message.find({ connection: connectionId }).sort({ createdAt: 1 }).limit(100);
  res.json({ messages });
}

export async function markRead(req, res) {
  const { connectionId } = req.params;
  await Message.updateMany({ connection: connectionId, receiver: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ ok: true });
}
