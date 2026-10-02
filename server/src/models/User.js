import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 24,
      match: /^[A-Za-z0-9_@]+$/
    },
    usernameLower: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    profilePicture: { type: String, default: null },
    lastSeen: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
