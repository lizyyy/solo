const express = require('express');
const { getDB } = require('../config/database');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { status, room, strain_id } = req.query;
    const db = getDB();
    
    let query = `
      SELECT c.*, 
             s.code as strain_code, s.name as strain_name,
             ir.code as isolation_code, ir.name as isolation_name, ir.level as isolation_level
      FROM cages c
      LEFT JOIN strains s ON c.strain_id = s.id
      LEFT JOIN isolation_rules ir ON c.isolation_rule_id = ir.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }
    if (room) {
      query += ' AND c.room = ?';
      params.push(room);
    }
    if (strain_id) {
      query += ' AND c.strain_id = ?';
      params.push(strain_id);
    }
    
    query += ' ORDER BY c.room, c.rack, c.position';
    
    const cages = db.prepare(query).all(...params);
    
    res.json({
      success: true,
      data: cages
    });
  } catch (error) {
    console.error('获取笼位列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取笼位列表失败',
      error: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const cage = db.prepare(`
      SELECT c.*, 
             s.code as strain_code, s.name as strain_name,
             ir.code as isolation_code, ir.name as isolation_name, ir.level as isolation_level
      FROM cages c
      LEFT JOIN strains s ON c.strain_id = s.id
      LEFT JOIN isolation_rules ir ON c.isolation_rule_id = ir.id
      WHERE c.id = ?
    `).get(req.params.id);
    
    if (!cage) {
      return res.status(404).json({
        success: false,
        message: '笼位不存在'
      });
    }
    
    res.json({
      success: true,
      data: cage
    });
  } catch (error) {
    console.error('获取笼位详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取笼位详情失败',
      error: error.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const { code, room, rack, position, max_capacity, strain_id, gender, isolation_rule_id, notes } = req.body;
    
    if (!code || !room || !rack || !position) {
      return res.status(400).json({
        success: false,
        message: '笼位编码、房间、架位和位置为必填项'
      });
    }
    
    if (gender && !['male', 'female', 'mixed'].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: '性别必须是: male, female, mixed'
      });
    }
    
    const db = getDB();
    
    const existing = db.prepare('SELECT * FROM cages WHERE code = ?').get(code);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: '笼位编码已存在',
        data: existing
      });
    }
    
    const result = db.prepare(`
      INSERT INTO cages (code, room, rack, position, max_capacity, strain_id, gender, isolation_rule_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      code, room, rack, position,
      max_capacity || 5,
      strain_id || null,
      gender || null,
      isolation_rule_id || null,
      notes || null
    );
    
    const cage = db.prepare(`
      SELECT c.*, 
             s.code as strain_code, s.name as strain_name,
             ir.code as isolation_code, ir.name as isolation_name, ir.level as isolation_level
      FROM cages c
      LEFT JOIN strains s ON c.strain_id = s.id
      LEFT JOIN isolation_rules ir ON c.isolation_rule_id = ir.id
      WHERE c.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json({
      success: true,
      message: '笼位创建成功',
      data: cage
    });
  } catch (error) {
    console.error('创建笼位失败:', error);
    res.status(500).json({
      success: false,
      message: '创建笼位失败',
      error: error.message
    });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { max_capacity, strain_id, gender, isolation_rule_id, status, notes } = req.body;
    const db = getDB();
    
    const cage = db.prepare('SELECT * FROM cages WHERE id = ?').get(req.params.id);
    if (!cage) {
      return res.status(404).json({
        success: false,
        message: '笼位不存在'
      });
    }
    
    if (gender && !['male', 'female', 'mixed'].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: '性别必须是: male, female, mixed'
      });
    }
    
    if (status && !['available', 'occupied', 'maintenance', 'reserved'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '状态必须是: available, occupied, maintenance, reserved'
      });
    }
    
    db.prepare(`
      UPDATE cages 
      SET max_capacity = ?, strain_id = ?, gender = ?, isolation_rule_id = ?, 
          status = ?, notes = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      max_capacity !== undefined ? max_capacity : cage.max_capacity,
      strain_id !== undefined ? strain_id : cage.strain_id,
      gender !== undefined ? gender : cage.gender,
      isolation_rule_id !== undefined ? isolation_rule_id : cage.isolation_rule_id,
      status || cage.status,
      notes !== undefined ? notes : cage.notes,
      req.params.id
    );
    
    const updated = db.prepare(`
      SELECT c.*, 
             s.code as strain_code, s.name as strain_name,
             ir.code as isolation_code, ir.name as isolation_name, ir.level as isolation_level
      FROM cages c
      LEFT JOIN strains s ON c.strain_id = s.id
      LEFT JOIN isolation_rules ir ON c.isolation_rule_id = ir.id
      WHERE c.id = ?
    `).get(req.params.id);
    
    res.json({
      success: true,
      message: '笼位更新成功',
      data: updated
    });
  } catch (error) {
    console.error('更新笼位失败:', error);
    res.status(500).json({
      success: false,
      message: '更新笼位失败',
      error: error.message
    });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDB();
    
    const cage = db.prepare('SELECT * FROM cages WHERE id = ?').get(req.params.id);
    if (!cage) {
      return res.status(404).json({
        success: false,
        message: '笼位不存在'
      });
    }
    
    if (cage.current_occupancy > 0) {
      return res.status(400).json({
        success: false,
        message: `该笼位当前有 ${cage.current_occupancy} 只动物，无法删除`
      });
    }
    
    const allocationsCount = db.prepare('SELECT COUNT(*) as count FROM allocations WHERE cage_id = ?').get(req.params.id).count;
    if (allocationsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `该笼位有 ${allocationsCount} 条分配记录，无法删除`
      });
    }
    
    db.prepare('DELETE FROM cages WHERE id = ?').run(req.params.id);
    
    res.json({
      success: true,
      message: '笼位删除成功'
    });
  } catch (error) {
    console.error('删除笼位失败:', error);
    res.status(500).json({
      success: false,
      message: '删除笼位失败',
      error: error.message
    });
  }
});

module.exports = router;
