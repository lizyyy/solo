const express = require('express');
const router = express.Router();
const db = require('../models/database');
const dayjs = require('dayjs');
const XLSX = require('xlsx');

router.get('/stats', (req, res) => {
  const totalBuildings = db.get('SELECT COUNT(*) as count FROM buildings');
  const totalProblems = db.get('SELECT COUNT(*) as count FROM inspection_problems');
  
  const statusStats = db.all(
    `SELECT status, COUNT(*) as count FROM inspection_problems GROUP BY status`
  );

  const ownerConfirmed = db.get(
    'SELECT COUNT(*) as count FROM inspection_problems WHERE owner_confirmed = 1'
  );

  const today = dayjs();
  const overdueOrdersRaw = db.all(`
    SELECT w.*, p.problem_type, p.description, p.location,
           b.building_no, b.unit_no, b.room_no, b.owner_name,
           c.name as contractor_name
    FROM work_orders w
    LEFT JOIN inspection_problems p ON w.problem_id = p.id
    LEFT JOIN buildings b ON p.building_id = b.id
    LEFT JOIN contractors c ON w.contractor_id = c.id
    WHERE w.status IN ('待整改', '待复验')
    ORDER BY w.deadline ASC
  `);

  const processedOverdue = overdueOrdersRaw.map(o => {
    const deadline = dayjs(o.deadline);
    const isOverdue = today.isAfter(deadline);
    return {
      ...o,
      is_overdue: isOverdue,
      overdue_days: isOverdue ? today.diff(deadline, 'day') : 0
    };
  }).filter(o => o.is_overdue);

  const typeStats = db.all(
    `SELECT problem_type, COUNT(*) as count FROM inspection_problems GROUP BY problem_type`
  );

  const buildingStatusStats = db.all(
    `SELECT status, COUNT(*) as count FROM buildings GROUP BY status`
  );

  res.json({ 
    code: 0, 
    data: {
      total_buildings: totalBuildings?.count || 0,
      total_problems: totalProblems?.count || 0,
      status_stats: statusStats,
      owner_confirmed: ownerConfirmed?.count || 0,
      overdue_count: processedOverdue.length,
      overdue_orders: processedOverdue,
      type_stats: typeStats,
      building_status_stats: buildingStatusStats
    } 
  });
});

const getProblemsByStatus = (status, params) => {
  let sql = `
    SELECT p.*, b.building_no, b.unit_no, b.room_no, b.owner_name
    FROM inspection_problems p
    LEFT JOIN buildings b ON p.building_id = b.id
    WHERE p.status = ?
  `;
  const sqlParams = [status];
  
  if (params.building_no) {
    sql += ' AND b.building_no = ?';
    sqlParams.push(params.building_no);
  }
  if (params.problem_type) {
    sql += ' AND p.problem_type = ?';
    sqlParams.push(params.problem_type);
  }
  sql += ' ORDER BY p.id DESC';
  
  return db.all(sql, sqlParams);
};

const enrichProblem = (p) => {
  const latestOrder = db.get(`
    SELECT w.*, c.name as contractor_name
    FROM work_orders w
    LEFT JOIN contractors c ON w.contractor_id = c.id
    WHERE w.problem_id = ?
    ORDER BY w.id DESC
    LIMIT 1
  `, [p.id]);
  
  if (latestOrder) {
    const deadline = dayjs(latestOrder.deadline);
    const today = dayjs();
    const isOverdue = p.status !== '已完成' && today.isAfter(deadline);
    p.latest_order = {
      ...latestOrder,
      is_overdue: isOverdue,
      overdue_days: isOverdue ? today.diff(deadline, 'day') : 0
    };
  }
  
  return p;
};

router.get('/kanban', (req, res) => {
  const { building_no, problem_type } = req.query;
  const filterParams = { building_no, problem_type };
  
  const pendingDispatch = getProblemsByStatus('待派单', filterParams).map(enrichProblem);
  const pendingFix = getProblemsByStatus('待整改', filterParams).map(enrichProblem);
  const pendingRecheck = getProblemsByStatus('待复验', filterParams).map(enrichProblem);
  const completed = getProblemsByStatus('已完成', filterParams).map(enrichProblem);

  res.json({ 
    code: 0, 
    data: {
      pending_dispatch: pendingDispatch,
      pending_fix: pendingFix,
      pending_recheck: pendingRecheck,
      completed
    } 
  });
});

router.get('/export/rooms', (req, res) => {
  const buildingsRaw = db.all(`
    SELECT * FROM buildings b ORDER BY building_no, unit_no, room_no
  `);
  
  const buildings = buildingsRaw.map(b => {
    const total = db.get('SELECT COUNT(*) as count FROM inspection_problems WHERE building_id = ?', [b.id]);
    const pendingDispatch = db.get('SELECT COUNT(*) as count FROM inspection_problems WHERE building_id = ? AND status = ?', [b.id, '待派单']);
    const pendingFix = db.get('SELECT COUNT(*) as count FROM inspection_problems WHERE building_id = ? AND status = ?', [b.id, '待整改']);
    const pendingRecheck = db.get('SELECT COUNT(*) as count FROM inspection_problems WHERE building_id = ? AND status = ?', [b.id, '待复验']);
    const ownerConfirmed = db.get('SELECT COUNT(*) as count FROM inspection_problems WHERE building_id = ? AND owner_confirmed = 1', [b.id]);
    
    return {
      '楼栋': b.building_no,
      '单元': b.unit_no,
      '房号': b.room_no,
      '业主姓名': b.owner_name,
      '业主电话': b.owner_phone,
      '交付日期': b.delivery_date,
      '交付状态': b.status,
      '问题总数': total?.count || 0,
      '待派单': pendingDispatch?.count || 0,
      '待整改': pendingFix?.count || 0,
      '待复验': pendingRecheck?.count || 0,
      '业主已确认': ownerConfirmed?.count || 0
    };
  });

  const ws = XLSX.utils.json_to_sheet(buildings);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '每户交付状态');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const filename1 = encodeURIComponent(`每户交付状态_${dayjs().format('YYYYMMDD')}.xlsx`);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename1}`);
  res.send(buffer);
});

router.get('/export/problems', (req, res) => {
  const { status } = req.query;
  
  let sql = `
    SELECT p.*, b.building_no, b.unit_no, b.room_no, b.owner_name
    FROM inspection_problems p
    LEFT JOIN buildings b ON p.building_id = b.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    sql += ' AND p.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY b.building_no, b.unit_no, b.room_no, p.id';

  const problemsRaw = db.all(sql, params);
  
  const problems = problemsRaw.map(p => {
    const latestOrder = db.get(`
      SELECT w.*, c.name as contractor_name
      FROM work_orders w
      LEFT JOIN contractors c ON w.contractor_id = c.id
      WHERE w.problem_id = ?
      ORDER BY w.id DESC
      LIMIT 1
    `, [p.id]);
    
    const latestRecheck = db.get(`
      SELECT * FROM rechecks WHERE problem_id = ? ORDER BY id DESC LIMIT 1
    `, [p.id]);
    
    return {
      '楼栋': p.building_no,
      '单元': p.unit_no,
      '房号': p.room_no,
      '业主姓名': p.owner_name,
      '问题类型': p.problem_type,
      '问题分类': p.problem_category,
      '问题描述': p.description,
      '位置': p.location,
      '验房日期': p.inspection_date,
      '问题状态': p.status,
      '业主是否确认': p.owner_confirmed === 1 ? '是' : '否',
      '业主确认时间': p.owner_confirm_time,
      '责任施工方': latestOrder?.contractor_name,
      '派单日期': latestOrder?.assigned_date,
      '整改截止日期': latestOrder?.deadline,
      '复验日期': latestRecheck?.recheck_date,
      '复验结果': latestRecheck?.result,
      '复验备注': latestRecheck?.remarks
    };
  });

  const ws = XLSX.utils.json_to_sheet(problems);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '验房问题清单');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const filename2 = encodeURIComponent(`验房问题清单_${dayjs().format('YYYYMMDD')}.xlsx`);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename2}`);
  res.send(buffer);
});

router.get('/export/compensations', (req, res) => {
  const compsRaw = db.all(`
    SELECT co.*, p.problem_type, p.description, p.building_id, w.contractor_id, w.assigned_date, w.deadline
    FROM compensations co
    LEFT JOIN inspection_problems p ON co.problem_id = p.id
    LEFT JOIN work_orders w ON co.work_order_id = w.id
    ORDER BY co.id DESC
  `);
  
  const compensations = compsRaw.map(c => {
    const building = db.get('SELECT * FROM buildings WHERE id = ?', [c.building_id]);
    const contractor = db.get('SELECT * FROM contractors WHERE id = ?', [c.contractor_id]);
    
    return {
      '赔付记录ID': c.id,
      '楼栋': building?.building_no,
      '单元': building?.unit_no,
      '房号': building?.room_no,
      '业主姓名': building?.owner_name,
      '问题类型': c.problem_type,
      '问题描述': c.description,
      '责任施工方': contractor?.name,
      '派单日期': c.assigned_date,
      '整改截止日期': c.deadline,
      '逾期天数': c.delay_days,
      '赔付金额': c.amount,
      '计算依据': c.calculation_basis,
      '赔付状态': c.status,
      '创建时间': c.created_at
    };
  });

  const ws = XLSX.utils.json_to_sheet(compensations);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '逾期赔付记录');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const filename3 = encodeURIComponent(`逾期赔付记录_${dayjs().format('YYYYMMDD')}.xlsx`);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename3}`);
  res.send(buffer);
});

module.exports = router;
