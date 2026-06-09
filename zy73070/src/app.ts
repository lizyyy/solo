import express, { Request, Response } from 'express';
import { workOrderService } from './services';
import {
  CreateWorkOrderRequest,
  ChangeVerdictRequest,
  SupplementMaterialRequest,
  ResolveDuplicateRequest,
  RescindWorkOrderRequest,
} from './types';

const app = express();
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Service', 'switchgear-temp-replay-backend');
  next();
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: '配电柜温升工单回放后端',
    timestamp: new Date().toISOString(),
    features: [
      '改判追踪（来源+当前状态）',
      '原始传感器日志保留（不清洗）',
      '设备编号重复自动挂起',
      '补录变更历史（旧材料+新备注+改判原因）',
      '撤回记录',
      '审计日志',
    ],
  });
});

app.post('/api/v1/work-orders', (req: Request, res: Response) => {
  try {
    const body = req.body as CreateWorkOrderRequest;
    if (!body.work_order_no || !body.device_code || !body.initial_conclusion || !body.created_by || !body.created_by_name) {
      return res.status(400).json({
        error: '参数缺失',
        required_fields: ['work_order_no', 'device_code', 'initial_conclusion', 'created_by', 'created_by_name'],
      });
    }
    const result = workOrderService.createWorkOrder(body);
    return res.status(201).json({
      success: true,
      message: result.duplicate_alert
        ? '工单创建成功，但因设备编号重复已被挂起，请现场老师确认。'
        : '工单创建成功。',
      data: result,
    });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message });
  }
});

app.get('/api/v1/work-orders', (req: Request, res: Response) => {
  try {
    const options: any = {};
    if (req.query.status) options.status = String(req.query.status);
    if (req.query.suspended) options.suspended = String(req.query.suspended) === 'true';
    if (req.query.rescinded) options.rescinded = String(req.query.rescinded) === 'true';
    if (req.query.device_code) options.device_code = String(req.query.device_code);
    if (req.query.limit) options.limit = parseInt(String(req.query.limit), 10);
    if (req.query.offset) options.offset = parseInt(String(req.query.offset), 10);

    const list = workOrderService.listWorkOrders(options);
    return res.json({
      success: true,
      data: list,
      count: list.length,
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/v1/work-orders/:id', (req: Request, res: Response) => {
  try {
    const detail = workOrderService.getWorkOrderDetail(req.params.id);
    return res.json({
      success: true,
      data: detail,
    });
  } catch (e: any) {
    return res.status(404).json({ success: false, error: e.message });
  }
});

app.post('/api/v1/work-orders/change-verdict', (req: Request, res: Response) => {
  try {
    const body = req.body as ChangeVerdictRequest;
    if (!body.work_order_id || !body.new_conclusion || !body.change_reason || !body.operator_id || !body.operator_name) {
      return res.status(400).json({
        error: '参数缺失',
        required_fields: ['work_order_id', 'new_conclusion', 'change_reason', 'operator_id', 'operator_name'],
      });
    }
    const result = workOrderService.changeVerdict(body);
    return res.json({
      success: true,
      message: '改判成功。历史记录已保留，可通过工单详情查询来源链。',
      data: result,
    });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/api/v1/work-orders/supplement-material', (req: Request, res: Response) => {
  try {
    const body = req.body as SupplementMaterialRequest;
    if (!body.work_order_id || !body.supplementary_material || !body.operator_id || !body.operator_name) {
      return res.status(400).json({
        error: '参数缺失',
        required_fields: ['work_order_id', 'supplementary_material', 'operator_id', 'operator_name'],
      });
    }
    const result = workOrderService.supplementMaterial(body);
    const hasVerdictChange = !!result.verdict_history;
    return res.json({
      success: true,
      message: hasVerdictChange
        ? '补录成功且结论已变更，旧材料快照与改判原因已写入历史。'
        : '补录成功，原始材料已原样保留。',
      data: result,
    });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/api/v1/work-orders/rescind', (req: Request, res: Response) => {
  try {
    const body = req.body as RescindWorkOrderRequest;
    if (!body.work_order_id || !body.rescind_reason || !body.rescinded_by || !body.rescinded_by_name) {
      return res.status(400).json({
        error: '参数缺失',
        required_fields: ['work_order_id', 'rescind_reason', 'rescinded_by', 'rescinded_by_name'],
      });
    }
    const order = workOrderService.rescindWorkOrder(body);
    return res.json({
      success: true,
      message: '工单已撤回，撤回原因与操作人已记入审计日志。',
      data: { work_order: order },
    });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message });
  }
});

app.get('/api/v1/duplicate-alerts', (_req: Request, res: Response) => {
  try {
    const list = workOrderService.listUnresolvedDuplicates();
    return res.json({
      success: true,
      message: list.length > 0 ? `存在 ${list.length} 条未解决的设备重复告警，需现场老师确认。` : '当前无未解决的设备重复告警。',
      data: list,
      count: list.length,
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/v1/duplicate-alerts/:id/resolve', (req: Request, res: Response) => {
  try {
    const body = req.body as ResolveDuplicateRequest;
    if (!body.resolution_type || !body.resolution_note || !body.resolved_by || !body.resolved_by_name) {
      return res.status(400).json({
        error: '参数缺失',
        required_fields: ['resolution_type', 'resolution_note', 'resolved_by', 'resolved_by_name'],
      });
    }
    const result = workOrderService.resolveDuplicate({
      alert_id: req.params.id,
      resolution_type: body.resolution_type,
      resolution_note: body.resolution_note,
      resolved_by: body.resolved_by,
      resolved_by_name: body.resolved_by_name,
    });
    return res.json({
      success: true,
      message: '设备重复告警已处理，处理方式与备注已归档。',
      data: result,
    });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message });
  }
});

app.get('/api/v1/audit-logs', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
    const list = workOrderService.listAuditLogs(limit);
    return res.json({
      success: true,
      data: list,
      count: list.length,
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: '接口不存在，请查阅 API 文档。',
    available_endpoints: [
      'GET /health',
      'POST /api/v1/work-orders',
      'GET /api/v1/work-orders',
      'GET /api/v1/work-orders/:id',
      'POST /api/v1/work-orders/change-verdict',
      'POST /api/v1/work-orders/supplement-material',
      'POST /api/v1/work-orders/rescind',
      'GET /api/v1/duplicate-alerts',
      'POST /api/v1/duplicate-alerts/:id/resolve',
      'GET /api/v1/audit-logs',
    ],
  });
});

export default app;
