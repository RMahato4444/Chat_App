import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    connection: { type: mongoose.Schema.Types.ObjectId, ref: 'Connection', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 4000 },
    readAt: { type: Date, default: null }
  },
  { timestamps: true }
);

messageSchema.index({ connection: 1, createdAt: 1 });

export default mongoose.model('Message', messageSchema);
