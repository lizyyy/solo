import { Router, Request, Response } from 'express';
import { RepairModel } from '../models/repair.model';
import { AuditModel } from '../models/audit.model';
import { RepairService } from '../services/repair.service';
import { ReportService } from '../services/report.service';
import { QueryFilters } from '../types';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  try {
    const { inspection_id, pump_room_id, reporter_id, problem_description, priority, due_date } = req.body;

    if (!inspection_id || !pump_room_id || !reporter_id || !problem_description) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    const result = RepairService.createRepair({
      inspection_id,
      pump_room_id,
      reporter_id,
      problem_description,
      status: '待派单',
      priority: priority || '普通',
      due_date
    } as any, reporter_id);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.reason });
    }

    res.json({ success: true, id: result.id });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/batch', (req: Request, res: Response) => {
  try {
    const { repairs, operator_id } = req.body;

    if (!repairs || !Array.isArray(repairs)) {
      return res.status(400).json({ success: false, error: '报修数据格式错误' });
    }

    const result = RepairService.batchCreateRepairs(repairs, operator_id);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const filters: QueryFilters = {
      handlerId: req.query.handlerId ? parseInt(req.query.handlerId as string) : undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      status: req.query.status as string | undefined,
      pumpRoomId: req.query.pumpRoomId ? parseInt(req.query.pumpRoomId as string) : undefined
    };

    const repairs = RepairModel.getAll(filters);
    res.json({ success: true, data: repairs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/report', (req: Request, res: Response) => {
  try {
    const filters: QueryFilters = {
      handlerId: req.query.handlerId ? parseInt(req.query.handlerId as string) : undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      status: req.query.status as string | undefined,
      pumpRoomId: req.query.pumpRoomId ? parseInt(req.query.pumpRoomId as string) : undefined
    };

    const report = ReportService.generateRepairReport(filters);
    res.json({ success: true, ...report });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export', (req: Request, res: Response) => {
  try {
    const filters: QueryFilters = {
      handlerId: req.query.handlerId ? parseInt(req.query.handlerId as string) : undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      status: req.query.status as string | undefined,
      pumpRoomId: req.query.pumpRoomId ? parseInt(req.query.pumpRoomId as string) : undefined
    };

    const { buffer, summary } = ReportService.exportRepairReportExcel(filters);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=repair-report-${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const repair = RepairModel.getById(parseInt(req.params.id));
    if (!repair) {
      return res.status(404).json({ success: false, error: '报修记录不存在' });
    }
    res.json({ success: true, data: repair });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/:id/status', (req: Request, res: Response) => {
  try {
    const { status, operator_id, remark } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: '缺少目标状态' });
    }

    const result = RepairService.updateStatus(
      parseInt(req.params.id),
      status,
      operator_id,
      remark
    );

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.reason });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/assign', (req: Request, res: Response) => {
  try {
    const { handler_id, operator_id } = req.body;

    if (!handler_id) {
      return res.status(400).json({ success: false, error: '缺少处理人ID' });
    }

    const result = RepairService.assignHandler(
      parseInt(req.params.id),
      handler_id,
      operator_id
    );

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.reason });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/retest', (req: Request, res: Response) => {
  try {
    const { passed, remark, operator_id } = req.body;

    if (typeof passed !== 'boolean') {
      return res.status(400).json({ success: false, error: '缺少复测结果' });
    }

    const result = RepairService.handleRetest(
      parseInt(req.params.id),
      passed,
      remark || '',
      operator_id
    );

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.reason });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/audit', (req: Request, res: Response) => {
  try {
    const logs = AuditModel.getByRecord('repair', parseInt(req.params.id));
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
