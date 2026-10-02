import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    connection: { type: mongoose.Schema.Types.ObjectId, ref: 'Connection', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 4000 },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    editedAt: { type: Date, default: null },
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    deletedForEveryone: { type: Boolean, default: false }
  },
  { timestamps: true }
);

messageSchema.index({ connection: 1, createdAt: 1 });
messageSchema.index({ receiver: 1, deliveredAt: 1 });
messageSchema.index({ receiver: 1, readAt: 1 });

export default mongoose.model('Message', messageSchema);
