import { Request, Response } from 'express';
import { ProcessingService } from '../services/processing.service';
import { BatchService } from '../services/batch.service';

const processingService = new ProcessingService();
const batchService = new BatchService();

export const requestMaterials = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, operator } = req.body;

    if (!reason || !operator) {
      return res.status(400).json({ error: '请提供原因和操作人' });
    }

    const result = await processingService.requestMaterials(id, reason, operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const approveRegistration = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, operator } = req.body;

    if (!operator) {
      return res.status(400).json({ error: '请提供操作人' });
    }

    const result = await processingService.approveRegistration(
      id,
      reason || '审核通过',
      operator
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const rejectRegistration = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, operator } = req.body;

    if (!reason || !operator) {
      return res.status(400).json({ error: '请提供原因和操作人' });
    }

    const result = await processingService.rejectRegistration(id, reason, operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const cancelRegistration = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, operator } = req.body;

    if (!reason || !operator) {
      return res.status(400).json({ error: '请提供原因和操作人' });
    }

    const result = await processingService.cancelRegistration(id, reason, operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const reviewRegistration = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, operator } = req.body;

    if (!reason || !operator) {
      return res.status(400).json({ error: '请提供原因和操作人' });
    }

    const result = await processingService.reviewRegistration(id, reason, operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const promoteWaitlist = async (req: Request, res: Response) => {
  try {
    const { activityId } = req.body;
    const { operator } = req.body;

    if (!activityId || !operator) {
      return res.status(400).json({ error: '请提供活动ID和操作人' });
    }

    const result = await batchService.promoteWaitlist(activityId, operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getProcessingHistory = async (req: Request, res: Response) => {
  try {
    const { registrationId, waitlistEntryId } = req.query;

    if (!registrationId && !waitlistEntryId) {
      return res.status(400).json({ error: '请提供报名记录ID或候补记录ID' });
    }

    const history = await processingService.getProcessingRecords(
      registrationId as string | undefined,
      waitlistEntryId as string | undefined
    );

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};
