import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { getConnections, getProfile, searchUsers, uploadProfilePicture } from '../controllers/userController.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(
    null,
    ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
  )
});

const router = Router();
router.use(requireAuth);
router.get('/search', searchUsers);
router.get('/connections', getConnections);
router.get('/profile', getProfile);
router.post('/profile/picture', upload.single('profilePicture'), uploadProfilePicture);

export default router;
