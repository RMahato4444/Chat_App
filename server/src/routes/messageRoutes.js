import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getMessages, markRead } from '../controllers/messageController.js';

const router = Router();
router.use(requireAuth);
router.get('/:connectionId', getMessages);
router.post('/:connectionId/read', markRead);
export default router;
