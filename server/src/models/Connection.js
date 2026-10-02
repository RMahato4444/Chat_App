import mongoose from 'mongoose';

const connectionSchema = new mongoose.Schema(
  {
    userA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' }
  },
  { timestamps: true }
);

connectionSchema.index({ userA: 1, userB: 1 }, { unique: true });
connectionSchema.index({ userB: 1, status: 1 });
connectionSchema.index({ userA: 1, status: 1 });

export default mongoose.model('Connection', connectionSchema);
