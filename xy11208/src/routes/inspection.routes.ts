import { Router, Request, Response } from 'express';
import { InspectionModel } from '../models/inspection.model';
import { AuditModel } from '../models/audit.model';
import { QueryFilters } from '../types';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  try {
    const { pump_room_id, inspector_id, inspection_date, water_pressure, water_equipment_status, has_leakage, noise_level, remarks, exception_type, is_needs_repair } = req.body;

    if (!pump_room_id || !inspector_id || !inspection_date) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }

    const id = InspectionModel.create({
      pump_room_id,
      inspector_id,
      inspection_date,
      status: '待处理',
      water_pressure,
      water_equipment_status,
      has_leakage: has_leakage || false,
      noise_level,
      remarks,
      exception_type,
      is_needs_repair: is_needs_repair || false
    } as any);

    AuditModel.log({
      operation_type: '创建巡检',
      record_type: 'inspection',
      record_id: id,
      action: 'create',
      reason: '校验通过',
      passed: true,
      operator_id: inspector_id
    });

    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const filters: QueryFilters = {
      inspectorId: req.query.inspectorId ? parseInt(req.query.inspectorId as string) : undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      status: req.query.status as string | undefined,
      exceptionType: req.query.exceptionType as string | undefined,
      pumpRoomId: req.query.pumpRoomId ? parseInt(req.query.pumpRoomId as string) : undefined
    };

    const inspections = InspectionModel.getAll(filters);
    res.json({ success: true, data: inspections });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const inspection = InspectionModel.getById(parseInt(req.params.id));
    if (!inspection) {
      return res.status(404).json({ success: false, error: '巡检记录不存在' });
    }
    res.json({ success: true, data: inspection });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/audit', (req: Request, res: Response) => {
  try {
    const logs = AuditModel.getByRecord('inspection', parseInt(req.params.id));
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
