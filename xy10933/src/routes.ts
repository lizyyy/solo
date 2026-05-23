import { Router, Request, Response } from 'express';
import { createObjectCsvStringifier } from 'csv-writer';
import * as services from './services';
import { ApiResponse } from './types';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    message: '影棚器材借还 API 服务运行正常',
  };
  res.json(response);
});

router.get('/equipment', async (req: Request, res: Response) => {
  try {
    const equipment = await services.getAllEquipment();
    const response: ApiResponse = { success: true, data: equipment };
    res.json(response);
  } catch (error: any) {
    await logException('get_equipment', req.query, error.message);
    const response: ApiResponse = { success: false, error: error.message };
    res.status(500).json(response);
  }
});

router.get('/equipment/:id', async (req: Request, res: Response) => {
  try {
    const equipment = await services.getEquipment(req.params.id);
    if (!equipment) {
      const response: ApiResponse = { success: false, error: '器材不存在' };
      return res.status(404).json(response);
    }
    const response: ApiResponse = { success: true, data: equipment };
    res.json(response);
  } catch (error: any) {
    await logException('get_equipment_by_id', req.params, error.message);
    const response: ApiResponse = { success: false, error: error.message };
    res.status(500).json(response);
  }
});

router.post('/equipment', async (req: Request, res: Response) => {
  try {
    const equipment = await services.createEquipment(req.body);
    const response: ApiResponse = { success: true, data: equipment, message: '器材创建成功' };
    res.status(201).json(response);
  } catch (error: any) {
    await logException('create_equipment', req.body, error.message);
    const response: ApiResponse = { success: false, error: error.message };
    res.status(500).json(response);
  }
});

router.get('/accessories', async (req: Request, res: Response) => {
  try {
    const equipmentId = req.query.equipment_id as string | undefined;
    const accessories = await services.getAccessories(equipmentId);
    const response: ApiResponse = { success: true, data: accessories };
    res.json(response);
  } catch (error: any) {
    await logException('get_accessories', req.query, error.message);
    const response: ApiResponse = { success: false, error: error.message };
    res.status(500).json(response);
  }
});

router.get('/rental-orders', async (req: Request, res: Response) => {
  try {
    const orders = await services.getAllRentalOrders();
    const response: ApiResponse = { success: true, data: orders };
    res.json(response);
  } catch (error: any) {
    await logException('get_rental_orders', req.query, error.message);
    const response: ApiResponse = { success: false, error: error.message };
    res.status(500).json(response);
  }
});

router.get('/rental-orders/:id', async (req: Request, res: Response) => {
  try {
    const order = await services.getRentalOrder(req.params.id);
    if (!order) {
      const response: ApiResponse = { success: false, error: '借用单不存在' };
      return res.status(404).json(response);
    }
    const response: ApiResponse = { success: true, data: order };
    res.json(response);
  } catch (error: any) {
    await logException('get_rental_order_by_id', req.params, error.message);
    const response: ApiResponse = { success: false, error: error.message };
    res.status(500).json(response);
  }
});

router.get('/rental-orders/:id/accessories', async (req: Request, res: Response) => {
  try {
    const accessories = await services.getRentalAccessories(req.params.id);
    const response: ApiResponse = { success: true, data: accessories };
    res.json(response);
  } catch (error: any) {
    await logException('get_rental_accessories', req.params, error.message);
    const response: ApiResponse = { success: false, error: error.message };
    res.status(500).json(response);
  }
});

router.post('/rental-orders', async (req: Request, res: Response) => {
  try {
    const requiredFields = ['equipment_id', 'borrower_name', 'expected_start_date', 'expected_end_date', 'deposit_paid', 'accessory_ids'];
    const missingFields = requiredFields.filter(field => !(field in req.body));
    
    if (missingFields.length > 0) {
      await logException('create_rental_order_missing_fields', req.body, `缺少必填字段: ${missingFields.join(', ')}`);
      const response: ApiResponse = { success: false, error: `缺少必填字段: ${missingFields.join(', ')}` };
      return res.status(400).json(response);
    }

    const order = await services.createRentalOrder(req.body);
    const response: ApiResponse = { success: true, data: order, message: '借用单创建成功' };
    res.status(201).json(response);
  } catch (error: any) {
    await logException('create_rental_order', req.body, error.message);
    const response: ApiResponse = { success: false, error: error.message };
    res.status(500).json(response);
  }
});

router.patch('/rental-orders/:id/status', async (req: Request, res: Response) => {
  try {
    const { status, actual_date } = req.body;
    if (!status) {
      const response: ApiResponse = { success: false, error: '缺少状态参数' };
      return res.status(400).json(response);
    }

    const order = await services.updateRentalOrderStatus(req.params.id, status, actual_date);
    const response: ApiResponse = { success: true, data: order, message: '状态更新成功' };
    res.json(response);
  } catch (error: any) {
    await logException('update_rental_order_status', { ...req.params, ...req.body }, error.message);
    const response: ApiResponse = { success: false, error: error.message };
    res.status(500).json(response);
  }
});

router.post('/return-inspections', async (req: Request, res: Response) => {
  try {
    const requiredFields = ['rental_order_id', 'inspector_name', 'has_scratches', 'has_damage', 'accessories_complete', 'overall_condition', 'conclusion'];
    const missingFields = requiredFields.filter(field => !(field in req.body));
    
    if (missingFields.length > 0) {
      await logException('create_inspection_missing_fields', req.body, `缺少必填字段: ${missingFields.join(', ')}`);
      const response: ApiResponse = { success: false, error: `缺少必填字段: ${missingFields.join(', ')}` };
      return res.status(400).json(response);
    }

    const inspection = await services.createReturnInspection(req.body);
    const response: ApiResponse = { success: true, data: inspection, message: '归还检查创建成功' };
    res.status(201).json(response);
  } catch (error: any) {
    await logException('create_return_inspection', req.body, error.message);
    const response: ApiResponse = { success: false, error: error.message };
    res.status(500).json(response);
  }
});

router.post('/deposit-deductions', async (req: Request, res: Response) => {
  try {
    const requiredFields = ['rental_order_id', 'amount', 'reason', 'requested_by'];
    const missingFields = requiredFields.filter(field => !(field in req.body));
    
    if (missingFields.length > 0) {
      await logException('create_deduction_missing_fields', req.body, `缺少必填字段: ${missingFields.join(', ')}`);
      const response: ApiResponse = { success: false, error: `缺少必填字段: ${missingFields.join(', ')}` };
      return res.status(400).json(response);
    }

    const deduction = await services.createDepositDeduction(req.body);
    const response: ApiResponse = { success: true, data: deduction, message: '扣款申请创建成功' };
    res.status(201).json(response);
  } catch (error: any) {
    await logException('create_deposit_deduction', req.body, error.message);
    const response: ApiResponse = { success: false, error: error.message };
    res.status(500).json(response);
  }
});

router.patch('/deposit-deductions/:id/approve', async (req: Request, res: Response) => {
  try {
    const { approved_by, approve } = req.body;
    if (!approved_by) {
      const response: ApiResponse = { success: false, error: '缺少审批人信息' };
      return res.status(400).json(response);
    }

    const deduction = await services.approveDepositDeduction(req.params.id, approved_by, approve !== false);
    const response: ApiResponse = { 
      success: true, 
      data: deduction, 
      message: approve !== false ? '扣款已批准' : '扣款已驳回' 
    };
    res.json(response);
  } catch (error: any) {
    await logException('approve_deposit_deduction', { ...req.params, ...req.body }, error.message);
    const response: ApiResponse = { success: false, error: error.message };
    res.status(500).json(response);
  }
});

router.post('/manual-corrections', async (req: Request, res: Response) => {
  try {
    const requiredFields = ['correction_type', 'reason', 'corrected_by'];
    const missingFields = requiredFields.filter(field => !(field in req.body));
    
    if (missingFields.length > 0) {
      const response: ApiResponse = { success: false, error: `缺少必填字段: ${missingFields.join(', ')}` };
      return res.status(400).json(response);
    }

    await services.createManualCorrection(req.body);
    const response: ApiResponse = { success: true, message: '人工修正记录已创建' };
    res.status(201).json(response);
  } catch (error: any) {
    await logException('create_manual_correction', req.body, error.message);
    const response: ApiResponse = { success: false, error: error.message };
    res.status(500).json(response);
  }
});

router.get('/rental-orders/:id/report', async (req: Request, res: Response) => {
  try {
    const report = await services.generateRentalReport(req.params.id);
    const response: ApiResponse = { success: true, data: report };
    res.json(response);
  } catch (error: any) {
    await logException('generate_rental_report', req.params, error.message);
    const response: ApiResponse = { success: false, error: error.message };
    res.status(500).json(response);
  }
});

router.get('/rental-orders/:id/export/csv', async (req: Request, res: Response) => {
  try {
    const report = await services.generateRentalReport(req.params.id);
    
    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'order_no', title: '借用单号' },
        { id: 'equipment_name', title: '器材名称' },
        { id: 'borrower_name', title: '借用人' },
        { id: 'rental_period', title: '借用周期' },
        { id: 'actual_days', title: '实际天数' },
        { id: 'rental_fee', title: '租金' },
        { id: 'overdue_days', title: '逾期天数' },
        { id: 'overdue_fee', title: '逾期费用' },
        { id: 'deposit_paid', title: '已付押金' },
        { id: 'deductions', title: '扣款总额' },
        { id: 'deposit_refund', title: '应退押金' },
        { id: 'inspection_result', title: '检查结果' },
        { id: 'status', title: '状态' },
      ],
    });

    const csv = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords([report]);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rental-report-${report.order_no}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error: any) {
    await logException('export_rental_report_csv', req.params, error.message);
    const response: ApiResponse = { success: false, error: error.message };
    res.status(500).json(response);
  }
});

router.get('/exception-logs', async (req: Request, res: Response) => {
  try {
    const logs = await services.getExceptionLogs();
    const response: ApiResponse = { success: true, data: logs };
    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, error: error.message };
    res.status(500).json(response);
  }
});

router.get('/exception-logs/:id', async (req: Request, res: Response) => {
  try {
    const log = await services.getExceptionLog(req.params.id);
    if (!log) {
      const response: ApiResponse = { success: false, error: '异常日志不存在' };
      return res.status(404).json(response);
    }
    const response: ApiResponse = { success: true, data: log };
    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, error: error.message };
    res.status(500).json(response);
  }
});

router.patch('/exception-logs/:id', async (req: Request, res: Response) => {
  try {
    const { processing_conclusion, handled_by } = req.body;
    if (!processing_conclusion || !handled_by) {
      const response: ApiResponse = { success: false, error: '缺少处理结论或处理人' };
      return res.status(400).json(response);
    }

    await services.updateExceptionLog(req.params.id, processing_conclusion, handled_by);
    const updatedLog = await services.getExceptionLog(req.params.id);
    const response: ApiResponse = { success: true, data: updatedLog, message: '异常日志处理完成' };
    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = { success: false, error: error.message };
    res.status(500).json(response);
  }
});

export default router;
