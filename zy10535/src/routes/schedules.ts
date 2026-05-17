import { Router, Request, Response } from 'express';
import { VisitScheduleService } from '../services/VisitScheduleService';
import { ExportService, ExportFormat } from '../services/ExportService';
import { VisitStatus } from '../entities/VisitSchedule';
import { DelayReason } from '../entities/DelayRecord';

const router = Router();
const scheduleService = new VisitScheduleService();
const exportService = new ExportService();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { scheduledStartTime, scheduledEndTime, ...rest } = req.body;
    const schedule = await scheduleService.createSchedule({
      ...rest,
      scheduledStartTime: new Date(scheduledStartTime),
      scheduledEndTime: new Date(scheduledEndTime)
    });
    res.status(201).json(schedule);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const filters: any = {};
    if (req.query.customerId) filters.customerId = req.query.customerId as string;
    if (req.query.personInChargeId) filters.personInChargeId = req.query.personInChargeId as string;
    if (req.query.status) filters.status = req.query.status as VisitStatus;
    if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
    if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

    const schedules = await scheduleService.getSchedules(filters);
    res.json(schedules);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/missed', async (req: Request, res: Response) => {
  try {
    const missed = await scheduleService.getMissedVisits();
    res.json(missed);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const schedule = await scheduleService.getScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: '排期不存在' });
    }
    res.json(schedule);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/confirm', async (req: Request, res: Response) => {
  try {
    const { confirmedBy } = req.body;
    const schedule = await scheduleService.confirmByPerson(req.params.id, confirmedBy);
    res.json(schedule);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/status', async (req: Request, res: Response) => {
  try {
    const { newStatus, operator, basis } = req.body;
    const schedule = await scheduleService.advanceStatus(req.params.id, newStatus, operator, basis);
    res.json(schedule);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/delay', async (req: Request, res: Response) => {
  try {
    const { newScheduledTime, ...rest } = req.body;
    const delayRecord = await scheduleService.createDelayRecord(req.params.id, {
      ...rest,
      newScheduledTime: newScheduledTime ? new Date(newScheduledTime) : undefined
    });
    res.status(201).json(delayRecord);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/missed', async (req: Request, res: Response) => {
  try {
    const { operator } = req.body;
    const schedule = await scheduleService.markAsMissed(req.params.id, operator);
    res.json(schedule);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { scheduledStartTime, scheduledEndTime, operator, ...rest } = req.body;
    const updateData: any = { ...rest };
    if (scheduledStartTime && scheduledEndTime) {
      updateData.scheduledStartTime = new Date(scheduledStartTime);
      updateData.scheduledEndTime = new Date(scheduledEndTime);
    }
    const schedule = await scheduleService.manualUpdate(req.params.id, updateData, operator);
    res.json(schedule);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { reason, operator } = req.body;
    const schedule = await scheduleService.cancelSchedule(req.params.id, reason, operator);
    res.json(schedule);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/report', async (req: Request, res: Response) => {
  try {
    const { createdBy, ...reportData } = req.body;
    const report = await scheduleService.createReport(req.params.id, reportData, createdBy);
    res.status(201).json(report);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/report', async (req: Request, res: Response) => {
  try {
    const report = await scheduleService.getReportByScheduleId(req.params.id);
    if (!report) {
      return res.status(404).json({ error: '报告不存在' });
    }
    res.json(report);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/export', async (req: Request, res: Response) => {
  try {
    const { format = 'xlsx', filters } = req.body;

    const scheduleFilters: any = {};
    if (filters) {
      if (filters.customerId) scheduleFilters.customerId = filters.customerId;
      if (filters.personInChargeId) scheduleFilters.personInChargeId = filters.personInChargeId;
      if (filters.status) scheduleFilters.status = filters.status;
      if (filters.startDate) scheduleFilters.startDate = new Date(filters.startDate);
      if (filters.endDate) scheduleFilters.endDate = new Date(filters.endDate);
    }

    const schedules = await scheduleService.getSchedules(scheduleFilters);

    if (format === 'xlsx') {
      const buffer = exportService.exportToExcel(schedules);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="visit_schedules_${Date.now()}.xlsx"`);
      return res.send(buffer);
    } else {
      const csv = exportService.exportToCSV(schedules);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="visit_schedules_${Date.now()}.csv"`);
      return res.send(csv);
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
