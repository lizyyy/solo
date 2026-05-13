import { Router } from 'express';
import * as voteController from '../controllers/voteController';

const router = Router();

router.get('/:projectId', voteController.getVotes);
router.get('/:projectId/statistics', voteController.getVoteStatistics);
router.post('/:projectId', voteController.createVote);
router.put('/:id', voteController.updateVote);

export default router;
