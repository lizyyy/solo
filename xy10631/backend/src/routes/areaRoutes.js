const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const { logOperation } = require('../utils/logger');

router.get('/', (req, res) => {
  db.all('SELECT * FROM area ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  db.get('SELECT * FROM area WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const { area_code, name, building, floor, area_size, manager_id, manager_name } = req.body;
  const id = uuidv4();
  const now = new Date().toISOString();
  
  const sql = `
    INSERT INTO area (id, area_code, name, building, floor, area_size, manager_id, manager_name, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
  `;
  
  db.run(sql, [id, area_code, name, building, floor, area_size, manager_id, manager_name, now, now], async function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    await logOperation('area', id, 'create', null, null, null, manager_id, manager_name, '创建区域');
    res.json({ id, area_code, name });
  });
});

router.put('/:id', (req, res) => {
  const { name, building, floor, area_size, manager_id, manager_name, status, updated_by } = req.body;
  const areaId = req.params.id;
  const now = new Date().toISOString();
  
  db.get('SELECT * FROM area WHERE id = ?', [areaId], async (err, oldArea) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    const updates = [];
    const params = [];
    
    if (name !== undefined && name !== oldArea.name) {
      updates.push('name = ?');
      params.push(name);
      await logOperation('area', areaId, 'update', 'name', oldArea.name, name, updated_by, '系统', '修改区域名称');
    }
    if (building !== undefined && building !== oldArea.building) {
      updates.push('building = ?');
      params.push(building);
      await logOperation('area', areaId, 'update', 'building', oldArea.building, building, updated_by, '系统', '修改楼宇');
    }
    if (floor !== undefined && floor !== oldArea.floor) {
      updates.push('floor = ?');
      params.push(floor);
      await logOperation('area', areaId, 'update', 'floor', oldArea.floor, floor, updated_by, '系统', '修改楼层');
    }
    if (area_size !== undefined && area_size !== oldArea.area_size) {
      updates.push('area_size = ?');
      params.push(area_size);
      await logOperation('area', areaId, 'update', 'area_size', oldArea.area_size, area_size, updated_by, '系统', '修改区域面积');
    }
    if (manager_id !== undefined && manager_id !== oldArea.manager_id) {
      updates.push('manager_id = ?');
      params.push(manager_id);
      await logOperation('area', areaId, 'update', 'manager_id', oldArea.manager_id, manager_id, updated_by, '系统', '修改区域负责人');
    }
    if (status !== undefined && status !== oldArea.status) {
      updates.push('status = ?');
      params.push(status);
      await logOperation('area', areaId, 'update', 'status', oldArea.status, status, updated_by, '系统', '修改区域状态');
    }
    
    if (updates.length === 0) {
      res.json({ message: '没有需要更新的字段' });
      return;
    }
    
    updates.push('updated_at = ?');
    params.push(now);
    params.push(areaId);
    
    const sql = `UPDATE area SET ${updates.join(', ')} WHERE id = ?`;
    
    db.run(sql, params, function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: areaId, changes: this.changes });
    });
  });
});

module.exports = router;