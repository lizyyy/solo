import express from 'express';
import ExcelJS from 'exceljs';
import { db } from '../db';

const router = express.Router();

const STATUS_MAP: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  duplicate: '重复小票',
  settled: '已结算',
  appealed: '申诉中'
};

const APPEAL_STATUS_MAP: Record<string, string> = {
  pending: '待处理',
  resolved: '已解决',
  rejected: '已驳回'
};

const SETTLEMENT_STATUS_MAP: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已完成',
  cancelled: '已取消'
};

router.get('/receipts', async (req, res) => {
  const { employee_id, merchant_id, status, receipt_no, start_date, end_date, is_duplicate } = req.query;

  let sql = `
    SELECT r.*, 
           e.name as employee_name, e.department as employee_department,
           m.name as merchant_name
    FROM receipts r
    LEFT JOIN employees e ON r.employee_id = e.id
    LEFT JOIN merchants m ON r.merchant_id = m.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (employee_id) {
    sql += ' AND r.employee_id = ?';
    params.push(employee_id);
  }
  if (merchant_id) {
    sql += ' AND r.merchant_id = ?';
    params.push(merchant_id);
  }
  if (status) {
    sql += ' AND r.status = ?';
    params.push(status);
  }
  if (receipt_no) {
    sql += ' AND r.receipt_no LIKE ?';
    params.push(`%${receipt_no}%`);
  }
  if (start_date) {
    sql += ' AND r.consumption_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    sql += ' AND r.consumption_date <= ?';
    params.push(end_date);
  }
  if (is_duplicate !== undefined) {
    sql += ' AND r.is_duplicate = ?';
    params.push(is_duplicate === 'true' ? 1 : 0);
  }

  sql += ' ORDER BY r.created_at DESC';

  const receipts = db.prepare(sql).all(...params) as any[];

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('小票记录');

  worksheet.columns = [
    { header: '小票编号', key: 'receipt_no', width: 20 },
    { header: '员工姓名', key: 'employee_name', width: 12 },
    { header: '所属部门', key: 'employee_department', width: 12 },
    { header: '商户名称', key: 'merchant_name', width: 20 },
    { header: '消费金额(元)', key: 'amount', width: 14 },
    { header: '消费日期', key: 'consumption_date', width: 14 },
    { header: '上传日期', key: 'upload_date', width: 14 },
    { header: '状态', key: 'status', width: 12 },
    { header: '是否重复', key: 'is_duplicate', width: 12 },
    { header: '备注', key: 'notes', width: 30 }
  ];

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8E8E8' }
  };

  receipts.forEach(r => {
    worksheet.addRow({
      receipt_no: r.receipt_no,
      employee_name: r.employee_name,
      employee_department: r.employee_department,
      merchant_name: r.merchant_name,
      amount: r.amount,
      consumption_date: r.consumption_date,
      upload_date: r.upload_date,
      status: STATUS_MAP[r.status] || r.status,
      is_duplicate: r.is_duplicate ? '是' : '否',
      notes: r.notes || ''
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=receipts_${Date.now()}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
});

router.get('/settlements/:id', async (req, res) => {
  const { id } = req.params;

  const settlement = db.prepare(`
    SELECT s.*, m.name as merchant_name, m.contact_person, m.phone, m.address
    FROM settlements s
    LEFT JOIN merchants m ON s.merchant_id = m.id
    WHERE s.id = ?
  `).get(id) as any;

  if (!settlement) {
    return res.status(404).json({ success: false, message: '结算单不存在' });
  }

  const items = db.prepare(`
    SELECT si.*, r.receipt_no, r.consumption_date, r.amount as receipt_amount,
           e.name as employee_name, e.department
    FROM settlement_items si
    LEFT JOIN receipts r ON si.receipt_id = r.id
    LEFT JOIN employees e ON r.employee_id = e.id
    WHERE si.settlement_id = ?
    ORDER BY r.consumption_date DESC
  `).all(id) as any[];

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('结算明细');

  worksheet.columns = [
    { header: '小票编号', key: 'receipt_no', width: 20 },
    { header: '员工姓名', key: 'employee_name', width: 12 },
    { header: '所属部门', key: 'department', width: 12 },
    { header: '消费日期', key: 'consumption_date', width: 14 },
    { header: '金额(元)', key: 'amount', width: 14 }
  ];

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8E8E8' }
  };

  items.forEach(item => {
    worksheet.addRow({
      receipt_no: item.receipt_no,
      employee_name: item.employee_name,
      department: item.department,
      consumption_date: item.consumption_date,
      amount: item.amount
    });
  });

  const summaryRow = worksheet.addRow({
    receipt_no: '',
    employee_name: '',
    department: '合计',
    consumption_date: '',
    amount: settlement.total_amount
  });
  summaryRow.font = { bold: true };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=settlement_${settlement.settlement_month}_${Date.now()}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
});

router.get('/appeals', async (req, res) => {
  const { status } = req.query;

  let sql = `
    SELECT a.*, 
           r.receipt_no, r.amount, r.status as receipt_status,
           e.name as employee_name, e.department,
           m.name as merchant_name
    FROM appeals a
    LEFT JOIN receipts r ON a.receipt_id = r.id
    LEFT JOIN employees e ON r.employee_id = e.id
    LEFT JOIN merchants m ON r.merchant_id = m.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status) {
    sql += ' AND a.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY a.created_at DESC';

  const appeals = db.prepare(sql).all(...params) as any[];

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('申诉记录');

  worksheet.columns = [
    { header: '申诉人', key: 'appellant', width: 12 },
    { header: '员工姓名', key: 'employee_name', width: 12 },
    { header: '所属部门', key: 'department', width: 12 },
    { header: '商户名称', key: 'merchant_name', width: 20 },
    { header: '小票编号', key: 'receipt_no', width: 20 },
    { header: '金额(元)', key: 'amount', width: 12 },
    { header: '申诉类型', key: 'appeal_type', width: 14 },
    { header: '申诉原因', key: 'reason', width: 40 },
    { header: '申诉状态', key: 'status', width: 12 },
    { header: '处理结果', key: 'handle_result', width: 40 },
    { header: '申诉时间', key: 'created_at', width: 20 }
  ];

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8E8E8' }
  };

  appeals.forEach(a => {
    worksheet.addRow({
      appellant: a.appellant,
      employee_name: a.employee_name,
      department: a.department,
      merchant_name: a.merchant_name,
      receipt_no: a.receipt_no,
      amount: a.amount,
      appeal_type: a.appeal_type === 'reject' ? '拒绝申诉' : '重复申诉',
      reason: a.reason,
      status: APPEAL_STATUS_MAP[a.status] || a.status,
      handle_result: a.handle_result || '',
      created_at: new Date(a.created_at).toLocaleString('zh-CN')
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=appeals_${Date.now()}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
});

export default router;
