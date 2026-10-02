import crypto from 'crypto';
import path from 'path';
import User from '../models/User.js';
import Connection from '../models/Connection.js';
import { getLastSeen, isUserOnline } from '../presence.js';
import { requireSupabase, SUPABASE_BUCKET } from '../utils/supabase.js';

function publicUser(user, presence = {}) {
  const id = user._id.toString();
  const online = presence.online ?? isUserOnline(id);
  return {
    id,
    username: user.username,
    profilePicture: user.profilePicture || null,
    online,
    lastSeen: online ? null : (presence.lastSeen || getLastSeen(id, user.lastSeen) || null)
  };
}

export async function searchUsers(req, res) {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ users: [] });
  const users = await User.find({
    usernameLower: { $regex: q.toLowerCase(), $options: 'i' },
    _id: { $ne: req.user._id }
  })
    .select('_id username profilePicture lastSeen')
    .limit(20);
  res.json({ users: users.map(user => publicUser(user)) });
}

export async function getProfile(req, res) {
  res.json({ user: publicUser(req.user) });
}

function getExtension(mimetype, originalname) {
  const extensionByMime = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
  };
  return extensionByMime[mimetype] || path.extname(originalname || '').toLowerCase() || '.jpg';
}

function getStoragePath(profilePicture) {
  if (!profilePicture || !profilePicture.includes('/storage/v1/object/public/')) return null;

  const marker = '/storage/v1/object/public/';
  const afterMarker = profilePicture.split(marker)[1];
  if (!afterMarker) return null;

  const slashIndex = afterMarker.indexOf('/');
  if (slashIndex === -1) return null;

  const bucket = afterMarker.slice(0, slashIndex);
  const filePath = afterMarker.slice(slashIndex + 1);
  return bucket === SUPABASE_BUCKET ? filePath : null;
}

async function removeStoredProfilePicture(profilePicture) {
  const oldPath = getStoragePath(profilePicture);
  if (!oldPath) return;

  try {
    const supabase = requireSupabase();
    const { error } = await supabase.storage.from(SUPABASE_BUCKET).remove([oldPath]);
    if (error) console.warn('Could not remove old profile picture:', error.message);
  } catch (error) {
    console.warn('Could not remove old profile picture:', error.message);
  }
}

export async function uploadProfilePicture(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: 'Please choose a JPG, PNG, or WEBP image up to 3 MB.' });
  }

  try {
    const supabase = requireSupabase();
    const extension = getExtension(req.file.mimetype, req.file.originalname);
    const storagePath = `${req.user._id.toString()}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        cacheControl: '31536000',
        upsert: false
      });

    if (uploadError) {
      console.error('Supabase upload failed:', uploadError);
      return res.status(502).json({ message: `Could not upload profile picture: ${uploadError.message}` });
    }

    const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(storagePath);
    const publicUrl = data?.publicUrl;

    if (!publicUrl) {
      await supabase.storage.from(SUPABASE_BUCKET).remove([storagePath]);
      return res.status(502).json({ message: 'Could not create profile picture URL.' });
    }

    const previousPicture = req.user.profilePicture;
    req.user.profilePicture = publicUrl;
    await req.user.save();

    await removeStoredProfilePicture(previousPicture);

    return res.json({ user: publicUser(req.user) });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    return res.status(error?.statusCode || 500).json({
      message: error?.message || 'Could not upload profile picture.'
    });
  }
}

export async function removeProfilePicture(req, res) {
  try {
    const previousPicture = req.user.profilePicture;

    if (!previousPicture) {
      return res.json({ user: publicUser(req.user), message: 'No profile picture to remove.' });
    }

    req.user.profilePicture = null;
    await req.user.save();

    await removeStoredProfilePicture(previousPicture);

    return res.json({ user: publicUser(req.user) });
  } catch (error) {
    console.error('Profile picture removal error:', error);
    return res.status(error?.statusCode || 500).json({
      message: error?.message || 'Could not remove profile picture.'
    });
  }
}

export async function getConnections(req, res) {
  const userId = req.user._id;
  const connections = await Connection.find({ $or: [{ userA: userId }, { userB: userId }] })
    .populate('userA', '_id username profilePicture lastSeen')
    .populate('userB', '_id username profilePicture lastSeen')
    .sort({ updatedAt: -1 });

  const normalized = connections.map((c) => {
    const isA = c.userA._id.equals(userId);
    const other = isA ? c.userB : c.userA;
    const otherId = other._id.toString();
    const online = isUserOnline(otherId);
    return {
      id: c._id.toString(),
      status: c.status,
      requestedBy: c.requestedBy.toString(),
      user: publicUser(other, {
        online,
        lastSeen: online ? null : getLastSeen(otherId, other.lastSeen)
      }),
      updatedAt: c.updatedAt
    };
  });
  res.json({ connections: normalized });
}
