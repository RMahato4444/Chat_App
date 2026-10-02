import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getConversation, respondToInvite, sendInvite } from '../controllers/connectionController.js';

const router = Router();
router.use(requireAuth);
router.post('/invite', sendInvite);
router.post('/respond', respondToInvite);
router.get('/:connectionId', getConversation);
export default router;
