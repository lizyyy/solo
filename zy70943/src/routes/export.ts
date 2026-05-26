import { Router, Request, Response } from 'express';
import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';
import fs from 'fs';
import db from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { formatTimestamp, nowTimestamp } from '../utils/helpers';

const router = Router();

const EXCEPTION_TYPE_MAP: Record<string, string> = {
  delay: '干线晚点',
  damage: '破损',
  transit_responsibility: '中转责任',
};

const STATUS_MAP: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  confirmed: '已确认',
  rejected: '已驳回',
  appealed: '已申诉',
  archived: '已归档',
};

const ACTION_MAP: Record<string, string> = {
  create: '创建',
  update: '更新',
  reconcile: '核对',
  archive: '归档',
};

router.get('/csv', authMiddleware, async (req: Request, res: Response) => {
  const batchId = req.query.batch_id as string;
  const status = req.query.status as string;
  const exceptionType = req.query.exception_type as string;
  const start_time = req.query.start_time as string;
  const end_time = req.query.end_time as string;

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (batchId) {
    whereClause += ' AND d.batch_id = ?';
    params.push(parseInt(batchId));
  }

  if (status) {
    whereClause += ' AND d.status = ?';
    params.push(status);
  }

  if (exceptionType) {
    whereClause += ' AND d.exception_type = ?';
    params.push(exceptionType);
  }

  if (start_time) {
    whereClause += ' AND d.exception_time >= ?';
    params.push(parseInt(start_time));
  }

  if (end_time) {
    whereClause += ' AND d.exception_time <= ?';
    params.push(parseInt(end_time));
  }

  const details = db.prepare(`
    SELECT 
      d.*,
      b.batch_no,
      b.name as batch_name,
      u.real_name as created_by_name
    FROM deduction_details d
    LEFT JOIN batches b ON d.batch_id = b.id
    LEFT JOIN users u ON d.created_by = u.id
    ${whereClause}
    ORDER BY d.created_at DESC
  `).all(...params) as any[];

  const detailIds = details.map(d => d.id);

  let reconciliationsMap: Record<number, any[]> = {};
  if (detailIds.length > 0) {
    const placeholders = detailIds.map(() => '?').join(',');
    const reconciliations = db.prepare(`
      SELECT * FROM reconciliation_items
      WHERE deduction_detail_id IN (${placeholders})
      ORDER BY deduction_detail_id, created_at
    `).all(...detailIds) as any[];

    reconciliationsMap = reconciliations.reduce((acc, item) => {
      if (!acc[item.deduction_detail_id]) {
        acc[item.deduction_detail_id] = [];
      }
      acc[item.deduction_detail_id].push(item);
      return acc;
    }, {} as Record<number, any[]>);
  }

  const exportDir = path.resolve('./exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const fileName = `deduction_export_${nowTimestamp()}.csv`;
  const filePath = path.join(exportDir, fileName);

  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: [
      { id: 'batch_no', title: '批次号' },
      { id: 'batch_name', title: '批次名称' },
      { id: 'detail_no', title: '明细编号' },
      { id: 'waybill_no', title: '运单号' },
      { id: 'exception_type', title: '异常类型' },
      { id: 'exception_time', title: '异常时间' },
      { id: 'from_city', title: '出发城市' },
      { id: 'to_city', title: '到达城市' },
      { id: 'carrier', title: '承运商' },
      { id: 'vehicle_no', title: '车牌号' },
      { id: 'driver', title: '司机' },
      { id: 'original_amount', title: '原始金额' },
      { id: 'deduction_amount', title: '扣罚金额' },
      { id: 'responsible_party', title: '责任方' },
      { id: 'status', title: '状态' },
      { id: 'conclusion', title: '处理结论' },
      { id: 'matched_waybills', title: '核对运单' },
      { id: 'created_by_name', title: '创建人' },
      { id: 'final_handler_name', title: '最后处理人' },
      { id: 'created_at', title: '创建时间' },
      { id: 'handled_at', title: '处理时间' },
    ],
  });

  const records = details.map(detail => {
    const reconciliations = reconciliationsMap[detail.id] || [];
    const matchedWaybills = reconciliations
      .map(r => `${r.source_type}:${r.source_waybill_no}(${r.matched_amount})`)
      .join('; ');

    return {
      batch_no: detail.batch_no,
      batch_name: detail.batch_name,
      detail_no: detail.detail_no,
      waybill_no: detail.waybill_no,
      exception_type: EXCEPTION_TYPE_MAP[detail.exception_type] || detail.exception_type,
      exception_time: detail.exception_time ? formatTimestamp(detail.exception_time) : '',
      from_city: detail.from_city || '',
      to_city: detail.to_city || '',
      carrier: detail.carrier || '',
      vehicle_no: detail.vehicle_no || '',
      driver: detail.driver || '',
      original_amount: detail.original_amount,
      deduction_amount: detail.deduction_amount,
      responsible_party: detail.responsible_party || '',
      status: STATUS_MAP[detail.status] || detail.status,
      conclusion: detail.conclusion || '',
      matched_waybills: matchedWaybills,
      created_by_name: detail.created_by_name || '',
      final_handler_name: detail.final_handler_name || '',
      created_at: formatTimestamp(detail.created_at),
      handled_at: detail.handled_at ? formatTimestamp(detail.handled_at) : '',
    };
  });

  await csvWriter.writeRecords(records);

  res.download(filePath, fileName, (err) => {
    if (err) {
      res.status(500).json({ error: '导出失败' });
    }
  });
});

router.get('/statistics', authMiddleware, (req: Request, res: Response) => {
  const batchId = req.query.batch_id as string;
  const start_time = req.query.start_time as string;
  const end_time = req.query.end_time as string;

  let whereClause = 'WHERE 1=1';
  const params: any[] = [];

  if (batchId) {
    whereClause += ' AND batch_id = ?';
    params.push(parseInt(batchId));
  }

  if (start_time) {
    whereClause += ' AND created_at >= ?';
    params.push(parseInt(start_time));
  }

  if (end_time) {
    whereClause += ' AND created_at <= ?';
    params.push(parseInt(end_time));
  }

  const byStatus = db.prepare(`
    SELECT 
      status,
      COUNT(*) as count,
      SUM(deduction_amount) as total_amount
    FROM deduction_details
    ${whereClause}
    GROUP BY status
  `).all(...params);

  const byExceptionType = db.prepare(`
    SELECT 
      exception_type,
      COUNT(*) as count,
      SUM(deduction_amount) as total_amount
    FROM deduction_details
    ${whereClause}
    GROUP BY exception_type
  `).all(...params);

  const summary = db.prepare(`
    SELECT 
      COUNT(*) as total_count,
      SUM(original_amount) as total_original_amount,
      SUM(deduction_amount) as total_deduction_amount
    FROM deduction_details
    ${whereClause}
  `).get(...params);

  res.json({
    summary,
    by_status: byStatus.map((item: any) => ({
      ...item,
      status_name: STATUS_MAP[item.status] || item.status,
    })),
    by_exception_type: byExceptionType.map((item: any) => ({
      ...item,
      exception_type_name: EXCEPTION_TYPE_MAP[item.exception_type] || item.exception_type,
    })),
  });
});

export default router;
