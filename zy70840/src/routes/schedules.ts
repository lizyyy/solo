import { Router, Request, Response } from 'express';
import ScheduleService from '../services/ScheduleService';
import dayjs from 'dayjs';
import { getQueryString } from '../utils/request';

const router = Router();

router.get('/check', async (req: Request, res: Response) => {
  try {
    const venueName = getQueryString(req.query.venueName);
    const location = getQueryString(req.query.location);
    const startDateStr = getQueryString(req.query.startDate);
    const endDateStr = getQueryString(req.query.endDate);

    if (!venueName || !location || !startDateStr || !endDateStr) {
      return res.status(400).json({ error: '必填字段不能为空' });
    }

    const result = await ScheduleService.checkConflict(
      venueName,
      location,
      dayjs(startDateStr).toDate(),
      dayjs(endDateStr).toDate()
    );

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/venue', async (req: Request, res: Response) => {
  try {
    const venueName = getQueryString(req.query.venueName);
    const location = getQueryString(req.query.location);
    const startDateStr = getQueryString(req.query.startDate);
    const endDateStr = getQueryString(req.query.endDate);

    if (!venueName || !location || !startDateStr || !endDateStr) {
      return res.status(400).json({ error: '必填字段不能为空' });
    }

    const schedules = await ScheduleService.getSchedulesByVenueAndDate(
      venueName,
      location,
      dayjs(startDateStr).toDate(),
      dayjs(endDateStr).toDate()
    );

    res.json(schedules);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/occupy', async (req: Request, res: Response) => {
  try {
    const { applicationId, venueName, location, startDate, endDate } = req.body;

    if (!applicationId || !venueName || !location || !startDate || !endDate) {
      return res.status(400).json({ error: '必填字段不能为空' });
    }

    const schedule = await ScheduleService.occupySchedule(
      applicationId,
      venueName,
      location,
      dayjs(startDate).toDate(),
      dayjs(endDate).toDate()
    );

    res.json(schedule);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/block', async (req: Request, res: Response) => {
  try {
    const { venueName, location, startDate, endDate, blockedBy, blockedReason } = req.body;

    if (!venueName || !location || !startDate || !endDate || !blockedBy) {
      return res.status(400).json({ error: '必填字段不能为空' });
    }

    const schedule = await ScheduleService.blockSchedule(
      venueName,
      location,
      dayjs(startDate).toDate(),
      dayjs(endDate).toDate(),
      blockedBy,
      blockedReason
    );

    res.json(schedule);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/release/:applicationId', async (req: Request, res: Response) => {
  try {
    const applicationIdParam = Array.isArray(req.params.applicationId) ? req.params.applicationId[0] : req.params.applicationId;
    await ScheduleService.releaseSchedule(parseInt(applicationIdParam));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
