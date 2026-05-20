import { Router, Request, Response } from 'express';
import ApplicationService from '../services/ApplicationService';
import { ApplicationStatus } from '../models/Application';
import dayjs from 'dayjs';
import { getQueryNumber, getQueryString, getParamString } from '../utils/request';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const page = getQueryNumber(req.query.page) || 1;
    const pageSize = getQueryNumber(req.query.pageSize) || 20;
    const status = getQueryString(req.query.status) as ApplicationStatus | undefined;
    const merchantName = getQueryString(req.query.merchantName);
    const stallLocation = getQueryString(req.query.stallLocation);
    const certificateVersion = getQueryString(req.query.certificateVersion);
    const startDateStr = getQueryString(req.query.startDate);
    const endDateStr = getQueryString(req.query.endDate);
    const startDate = startDateStr ? dayjs(startDateStr).toDate() : undefined;
    const endDate = endDateStr ? dayjs(endDateStr).toDate() : undefined;

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
    const application = await ApplicationService.getApplicationById(parseInt(getParamString(req.params.id)));
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
      parseInt(getParamString(req.params.id)),
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
      parseInt(getParamString(req.params.id)),
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
      parseInt(getParamString(req.params.id)),
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
    const logs = await ApplicationService.getLogsByApplication(parseInt(getParamString(req.params.id)));
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
