import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { clearMessages, getMessages, markRead } from '../controllers/messageController.js';

const router = Router();
router.use(requireAuth);
router.get('/:connectionId', getMessages);
router.post('/:connectionId/read', markRead);
router.delete('/:connectionId', clearMessages);
export default router;
