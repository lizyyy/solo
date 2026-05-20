import { Router, Request, Response } from 'express';
import ScheduleService from '../services/ScheduleService';
import dayjs from 'dayjs';

const router = Router();

router.get('/check', async (req: Request, res: Response) => {
  try {
    const { venueName, location, startDate, endDate } = req.query;

    if (!venueName || !location || !startDate || !endDate) {
      return res.status(400).json({ error: '必填字段不能为空' });
    }

    const result = await ScheduleService.checkConflict(
      venueName as string,
      location as string,
      dayjs(startDate as string).toDate(),
      dayjs(endDate as string).toDate()
    );

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/venue', async (req: Request, res: Response) => {
  try {
    const { venueName, location, startDate, endDate } = req.query;

    if (!venueName || !location || !startDate || !endDate) {
      return res.status(400).json({ error: '必填字段不能为空' });
    }

    const schedules = await ScheduleService.getSchedulesByVenueAndDate(
      venueName as string,
      location as string,
      dayjs(startDate as string).toDate(),
      dayjs(endDate as string).toDate()
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
    await ScheduleService.releaseSchedule(parseInt(req.params.applicationId));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
