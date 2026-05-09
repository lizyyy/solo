import { Router, Request, Response } from 'express';
import Joi from 'joi';
import replayService from '../services/ReplayService';
import logger from '../utils/logger';

const router = Router();

const replaySchema = Joi.object({
  speed: Joi.number().min(0.1).max(10).optional(),
  startVersion: Joi.number().integer().min(1).optional(),
  endVersion: Joi.number().integer().min(1).optional(),
  dryRun: Joi.boolean().optional(),
});

const compareStatesSchema = Joi.object({
  version1: Joi.number().integer().min(1).required(),
  version2: Joi.number().integer().min(1).required(),
});

router.get('/message/:messageId', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const { error, value } = replaySchema.validate(req.query);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await replayService.replayMessageById(messageId, {
      speed: value.speed,
      startVersion: value.startVersion,
      endVersion: value.endVersion,
      dryRun: value.dryRun,
    });

    return res.json(result);
  } catch (error) {
    logger.error('Replay message failed', error as Error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/trace/:traceId', async (req: Request, res: Response) => {
  try {
    const { traceId } = req.params;
    const timeline = await replayService.replayByTraceId(traceId);

    return res.json(timeline);
  } catch (error) {
    logger.error('Replay by trace failed', error as Error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/message/:messageId/compare', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const { error, value } = compareStatesSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await replayService.compareStates(
      messageId,
      value.version1,
      value.version2
    );

    return res.json(result);
  } catch (error) {
    logger.error('Compare states failed', error as Error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/message/:messageId/path', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const path = await replayService.getExecutionPath(messageId);

    return res.json(path);
  } catch (error) {
    logger.error('Get execution path failed', error as Error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/message/:messageId/diagnose', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const diagnosis = await replayService.diagnoseIssue(messageId);

    return res.json(diagnosis);
  } catch (error) {
    logger.error('Diagnose issue failed', error as Error);
    return res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
