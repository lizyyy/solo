import { Router, Request, Response } from 'express';
import ApplicationService from '../services/ApplicationService';
import { ApplicationStatus } from '../models/Application';
import dayjs from 'dayjs';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const status = req.query.status as ApplicationStatus;
    const merchantName = req.query.merchantName as string;
    const stallLocation = req.query.stallLocation as string;
    const certificateVersion = req.query.certificateVersion as string;
    const startDate = req.query.startDate ? dayjs(req.query.startDate as string).toDate() : undefined;
    const endDate = req.query.endDate ? dayjs(req.query.endDate as string).toDate() : undefined;

    const result = await ApplicationService.listApplications(page, pageSize, {
      status,
      merchantName,
      stallLocation,
      startDate,
      endDate,
      certificateVersion,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const application = await ApplicationService.getApplicationById(parseInt(req.params.id));
    if (!application) {
      return res.status(404).json({ error: '申请记录不存在' });
    }
    res.json(application);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { operator, reason, venueName } = req.body;
    if (!operator) {
      return res.status(400).json({ error: '操作人不能为空' });
    }

    const result = await ApplicationService.approveApplication(
      parseInt(req.params.id),
      operator,
      reason,
      venueName
    );

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const { operator, reason } = req.body;
    if (!operator) {
      return res.status(400).json({ error: '操作人不能为空' });
    }

    const result = await ApplicationService.rejectApplication(
      parseInt(req.params.id),
      operator,
      reason
    );

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/return', async (req: Request, res: Response) => {
  try {
    const { operator, reason } = req.body;
    if (!operator) {
      return res.status(400).json({ error: '操作人不能为空' });
    }

    const result = await ApplicationService.returnForModify(
      parseInt(req.params.id),
      operator,
      reason
    );

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/logs', async (req: Request, res: Response) => {
  try {
    const logs = await ApplicationService.getLogsByApplication(parseInt(req.params.id));
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
