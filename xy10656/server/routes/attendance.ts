import { Router, Request, Response } from 'express';
import * as attendanceService from '../services/attendanceService';
import { getChangeLogs } from '../services/changeLogService';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  try {
    const { studentId, routeId, attendanceDate, direction, status, startDate, endDate, parentConfirmed } = req.query;
    const records = attendanceService.getAttendanceRecords({
      studentId: studentId as string,
      routeId: routeId as string,
      attendanceDate: attendanceDate as string,
      direction: direction as string,
      status: status as string,
      startDate: startDate as string,
      endDate: endDate as string,
      parentConfirmed: parentConfirmed === 'true',
    });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/abnormal', (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    const records = attendanceService.getAbnormalRecords(date as string);
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/export', (req: Request, res: Response) => {
  try {
    const { startDate, endDate, changedBy, routeId } = req.query;
    const report = attendanceService.exportReport({
      startDate: startDate as string,
      endDate: endDate as string,
      changedBy: changedBy as string,
      routeId: routeId as string,
    });
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const record = attendanceService.getAttendanceById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    res.json(record);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id/logs', (req: Request, res: Response) => {
  try {
    const logs = getChangeLogs('attendance', req.params.id);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/', (req: Request, res: Response) => {
  try {
    const { operator, ...data } = req.body;
    const record = attendanceService.createAttendanceRecord(data, operator);
    res.status(201).json(record);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/:id/change-stop', (req: Request, res: Response) => {
  try {
    const { newStopId, changedBy, changeReason } = req.body;
    const record = attendanceService.changeStop(req.params.id, newStopId, changedBy, changeReason);
    res.json(record);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post('/:id/confirm', (req: Request, res: Response) => {
  try {
    const record = attendanceService.parentConfirm(req.params.id);
    res.json(record);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

export default router;
