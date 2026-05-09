import { Router } from 'express';
import { requireAgent, AuthenticatedRequest } from '../middlewares/auth.middleware';
import followUpService from '../services/followUp.service';
import logger from '../utils/logger';

const router = Router();

router.get('/pending', requireAgent, async (req: AuthenticatedRequest, res) => {
  try {
    const { assigneeId } = req.query;
    const followUps = await followUpService.getPendingFollowUps(
      assigneeId as string || req.user!.id
    );
    res.json({ followUps });
  } catch (error) {
    logger.error('Get pending follow-ups failed:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get pending follow-ups',
    });
  }
});

router.get('/overdue', requireAgent, async (req, res) => {
  try {
    const followUps = await followUpService.getOverdueFollowUps();
    res.json({ followUps });
  } catch (error) {
    logger.error('Get overdue follow-ups failed:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get overdue follow-ups',
    });
  }
});

router.get('/stats', requireAgent, async (req, res) => {
  try {
    const stats = await followUpService.getFollowUpStats();
    res.json(stats);
  } catch (error) {
    logger.error('Get follow-up stats failed:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get follow-up stats',
    });
  }
});

router.get('/:id', requireAgent, async (req, res) => {
  try {
    const followUp = await followUpService.getFollowUpById(req.params.id);
    
    if (!followUp) {
      res.status(404).json({
        error: 'FOLLOWUP_NOT_FOUND',
        message: 'Follow-up not found',
      });
      return;
    }

    res.json(followUp);
  } catch (error) {
    logger.error('Get follow-up failed:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get follow-up',
    });
  }
});

router.post('/', requireAgent, async (req: AuthenticatedRequest, res) => {
  try {
    const followUp = await followUpService.createFollowUp(
      req.body,
      req.user!.id,
      req.requestId
    );

    res.status(201).json(followUp);
  } catch (error) {
    logger.error('Create follow-up failed:', error);
    res.status(400).json({
      error: 'CREATE_FAILED',
      message: (error as Error).message,
    });
  }
});

router.put('/:id', requireAgent, async (req: AuthenticatedRequest, res) => {
  try {
    const followUp = await followUpService.updateFollowUp(
      req.params.id,
      req.body,
      req.user!.id,
      req.requestId
    );

    res.json(followUp);
  } catch (error) {
    logger.error('Update follow-up failed:', error);
    res.status(400).json({
      error: 'UPDATE_FAILED',
      message: (error as Error).message,
    });
  }
});

router.post('/:id/complete', requireAgent, async (req: AuthenticatedRequest, res) => {
  try {
    const { completionNote } = req.body;
    
    if (!completionNote) {
      res.status(400).json({
        error: 'MISSING_NOTE',
        message: 'Completion note is required',
      });
      return;
    }

    const followUp = await followUpService.completeFollowUp(
      req.params.id,
      { completionNote },
      req.user!.id,
      req.requestId
    );

    res.json(followUp);
  } catch (error) {
    logger.error('Complete follow-up failed:', error);
    res.status(400).json({
      error: 'COMPLETE_FAILED',
      message: (error as Error).message,
    });
  }
});

router.post('/:id/compensate', requireAgent, async (req: AuthenticatedRequest, res) => {
  try {
    const followUp = await followUpService.compensateFollowUp(
      req.params.id,
      req.body,
      req.user!.id,
      req.requestId
    );

    res.status(201).json(followUp);
  } catch (error) {
    logger.error('Compensate follow-up failed:', error);
    res.status(400).json({
      error: 'COMPENSATE_FAILED',
      message: (error as Error).message,
    });
  }
});

export default router;
