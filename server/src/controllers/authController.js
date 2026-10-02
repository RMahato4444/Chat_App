import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { signToken } from '../utils/auth.js';

const USERNAME_RE = /^[A-Za-z0-9_@]+$/;

function publicUser(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    profilePicture: user.profilePicture || null
  };
}

export async function signup(req, res) {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    if (!USERNAME_RE.test(username) || username.length < 3 || username.length > 24) {
      return res.status(400).json({ message: 'Username must be 3-24 characters and contain only letters, numbers, _ and @.' });
    }
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });

    const usernameLower = username.toLowerCase();
    const exists = await User.findOne({ usernameLower });
    if (exists) return res.status(409).json({ message: 'That username is already taken.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, usernameLower, passwordHash });
    const token = signToken(user._id.toString());
    res.status(201).json({ token, user: publicUser(user) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: 'That username is already taken.' });
    res.status(500).json({ message: 'Unable to create account.' });
  }
}

export async function login(req, res) {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const user = await User.findOne({ usernameLower: username.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
    res.json({ token: signToken(user._id.toString()), user: publicUser(user) });
  } catch {
    res.status(500).json({ message: 'Unable to log in.' });
  }
}

export function me(req, res) {
  res.json({ user: publicUser(req.user) });
}
