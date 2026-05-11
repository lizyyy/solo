const express = require('express');
const router = express.Router();
const db = require('../models/database');
const dayjs = require('dayjs');

router.get('/', (req, res) => {
  const { building_no, status } = req.query;
  let sql = `
    SELECT b.*, 
      (SELECT COUNT(*) FROM inspection_problems WHERE building_id = b.id) as total_problems,
      (SELECT COUNT(*) FROM inspection_problems WHERE building_id = b.id AND status = '待派单') as pending_dispatch,
      (SELECT COUNT(*) FROM inspection_problems WHERE building_id = b.id AND status = '待整改') as pending_fix,
      (SELECT COUNT(*) FROM inspection_problems WHERE building_id = b.id AND status = '待复验') as pending_recheck,
      (SELECT COUNT(*) FROM inspection_problems WHERE building_id = b.id AND status = '已完成') as completed
    FROM buildings b
    WHERE 1=1
  `;
  const params = [];

  if (building_no) {
    sql += ' AND building_no = ?';
    params.push(building_no);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY building_no, unit_no, room_no';

  const buildings = db.all(sql, params);
  res.json({ code: 0, data: buildings });
});

router.get('/:id', (req, res) => {
  const building = db.get('SELECT * FROM buildings WHERE id = ?', [req.params.id]);
  
  if (!building) {
    return res.status(404).json({ code: 1, message: '楼栋房号不存在' });
  }
  res.json({ code: 0, data: building });
});

router.post('/', (req, res) => {
  const { building_no, unit_no, room_no, owner_name, owner_phone, delivery_date, status } = req.body;
  
  if (!building_no || !unit_no || !room_no) {
    return res.status(400).json({ code: 1, message: '楼栋、单元、房号不能为空' });
  }

  const exists = db.get(
    'SELECT id FROM buildings WHERE building_no = ? AND unit_no = ? AND room_no = ?',
    [building_no, unit_no, room_no]
  );

  if (exists) {
    return res.status(400).json({ code: 1, message: '该房号已存在' });
  }

  const result = db.prepare(
    `INSERT INTO buildings (building_no, unit_no, room_no, owner_name, owner_phone, delivery_date, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(building_no, unit_no, room_no, owner_name, owner_phone, delivery_date, status || '未交付', dayjs().format('YYYY-MM-DD HH:mm:ss'));

  res.json({ code: 0, data: { id: result.lastInsertRowid } });
});

router.put('/:id', (req, res) => {
  const { building_no, unit_no, room_no, owner_name, owner_phone, delivery_date, status } = req.body;

  const building = db.get('SELECT * FROM buildings WHERE id = ?', [req.params.id]);
  if (!building) {
    return res.status(404).json({ code: 1, message: '楼栋房号不存在' });
  }

  db.prepare(
    `UPDATE buildings SET 
      building_no = ?, unit_no = ?, room_no = ?, owner_name = ?, 
      owner_phone = ?, delivery_date = ?, status = ?, updated_at = ?
    WHERE id = ?`
  ).run(building_no, unit_no, room_no, owner_name, owner_phone, delivery_date, status, dayjs().format('YYYY-MM-DD HH:mm:ss'), req.params.id);

  res.json({ code: 0, message: '更新成功' });
});

router.delete('/:id', (req, res) => {
  const problems = db.all('SELECT id FROM inspection_problems WHERE building_id = ?', [req.params.id]);
  
  if (problems.length > 0) {
    return res.status(400).json({ code: 1, message: '该房号下存在验房问题，无法删除' });
  }

  db.run('DELETE FROM buildings WHERE id = ?', [req.params.id]);
  res.json({ code: 0, message: '删除成功' });
});

module.exports = router;
