import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import {
  getConnections,
  getProfile,
  removeProfilePicture,
  searchUsers,
  uploadProfilePicture
} from '../controllers/userController.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, and WEBP images are allowed.'));
    }
    cb(null, true);
  }
});

const router = Router();
router.use(requireAuth);
router.get('/search', searchUsers);
router.get('/connections', getConnections);
router.get('/profile', getProfile);
router.post('/profile/picture', upload.single('profilePicture'), uploadProfilePicture);
router.delete('/profile/picture', removeProfilePicture);

export default router;
