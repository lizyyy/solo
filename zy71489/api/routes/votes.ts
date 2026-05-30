import { Router } from 'express';
import { getVotes, getVotesByTrack } from '../controllers/VoteController.js';

const router = Router();

router.get('/', getVotes);
router.get('/track/:trackId', getVotesByTrack);

export default router;
