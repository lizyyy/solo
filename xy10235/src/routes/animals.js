const express = require('express');
const { getDB } = require('../config/database');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { strain_id, gender, health_status } = req.query;
    const db = getDB();
    
    let query = `
      SELECT a.*, 
             s.code as strain_code, s.name as strain_name,
             ir.code as isolation_code, ir.name as isolation_name, ir.level as isolation_level
      FROM animals a
      LEFT JOIN strains s ON a.strain_id = s.id
      LEFT JOIN isolation_rules ir ON a.isolation_rule_id = ir.id
      WHERE 1=1
    `;
    const params = [];
    
    if (strain_id) {
      query += ' AND a.strain_id = ?';
      params.push(strain_id);
    }
    if (gender) {
      query += ' AND a.gender = ?';
      params.push(gender);
    }
    if (health_status) {
      query += ' AND a.health_status = ?';
      params.push(health_status);
    }
    
    query += ' ORDER BY a.created_at DESC';
    
    const animals = db.prepare(query).all(...params);
    
    res.json({
      success: true,
      data: animals
    });
  } catch (error) {
    console.error('获取动物列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取动物列表失败',
      error: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const animal = db.prepare(`
      SELECT a.*, 
             s.code as strain_code, s.name as strain_name,
             ir.code as isolation_code, ir.name as isolation_name, ir.level as isolation_level
      FROM animals a
      LEFT JOIN strains s ON a.strain_id = s.id
      LEFT JOIN isolation_rules ir ON a.isolation_rule_id = ir.id
      WHERE a.id = ?
    `).get(req.params.id);
    
    if (!animal) {
      return res.status(404).json({
        success: false,
        message: '动物不存在'
      });
    }
    
    const allocations = db.prepare(`
      SELECT al.*, c.code as cage_code, c.room as cage_room
      FROM allocations al
      LEFT JOIN cages c ON al.cage_id = c.id
      WHERE al.animal_id = ?
      ORDER BY al.created_at DESC
    `).all(req.params.id);
    
    animal.allocations = allocations;
    
    res.json({
      success: true,
      data: animal
    });
  } catch (error) {
    console.error('获取动物详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取动物详情失败',
      error: error.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const { animal_id, strain_id, gender, birth_date, weight, isolation_rule_id, health_status, notes } = req.body;
    
    if (!animal_id || !strain_id || !gender) {
      return res.status(400).json({
        success: false,
        message: '动物编号、品系ID和性别为必填项'
      });
    }
    
    if (!['male', 'female'].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: '性别必须是: male 或 female'
      });
    }
    
    const db = getDB();
    
    const strain = db.prepare('SELECT * FROM strains WHERE id = ?').get(strain_id);
    if (!strain) {
      return res.status(400).json({
        success: false,
        message: '品系不存在'
      });
    }
    
    if (isolation_rule_id) {
      const isolation = db.prepare('SELECT * FROM isolation_rules WHERE id = ?').get(isolation_rule_id);
      if (!isolation) {
        return res.status(400).json({
          success: false,
          message: '隔离规则不存在'
        });
      }
    }
    
    const existing = db.prepare('SELECT * FROM animals WHERE animal_id = ?').get(animal_id);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: '动物编号已存在',
        data: existing
      });
    }
    
    const result = db.prepare(`
      INSERT INTO animals (animal_id, strain_id, gender, birth_date, weight, isolation_rule_id, health_status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      animal_id, strain_id, gender,
      birth_date || null,
      weight || null,
      isolation_rule_id || null,
      health_status || 'normal',
      notes || null
    );
    
    const animal = db.prepare(`
      SELECT a.*, 
             s.code as strain_code, s.name as strain_name,
             ir.code as isolation_code, ir.name as isolation_name, ir.level as isolation_level
      FROM animals a
      LEFT JOIN strains s ON a.strain_id = s.id
      LEFT JOIN isolation_rules ir ON a.isolation_rule_id = ir.id
      WHERE a.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json({
      success: true,
      message: '动物档案创建成功',
      data: animal
    });
  } catch (error) {
    console.error('创建动物档案失败:', error);
    res.status(500).json({
      success: false,
      message: '创建动物档案失败',
      error: error.message
    });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { birth_date, weight, isolation_rule_id, health_status, notes } = req.body;
    const db = getDB();
    
    const animal = db.prepare('SELECT * FROM animals WHERE id = ?').get(req.params.id);
    if (!animal) {
      return res.status(404).json({
        success: false,
        message: '动物不存在'
      });
    }
    
    if (isolation_rule_id) {
      const isolation = db.prepare('SELECT * FROM isolation_rules WHERE id = ?').get(isolation_rule_id);
      if (!isolation) {
        return res.status(400).json({
          success: false,
          message: '隔离规则不存在'
        });
      }
    }
    
    db.prepare(`
      UPDATE animals 
      SET birth_date = ?, weight = ?, isolation_rule_id = ?, health_status = ?, notes = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      birth_date !== undefined ? birth_date : animal.birth_date,
      weight !== undefined ? weight : animal.weight,
      isolation_rule_id !== undefined ? isolation_rule_id : animal.isolation_rule_id,
      health_status || animal.health_status,
      notes !== undefined ? notes : animal.notes,
      req.params.id
    );
    
    const updated = db.prepare(`
      SELECT a.*, 
             s.code as strain_code, s.name as strain_name,
             ir.code as isolation_code, ir.name as isolation_name, ir.level as isolation_level
      FROM animals a
      LEFT JOIN strains s ON a.strain_id = s.id
      LEFT JOIN isolation_rules ir ON a.isolation_rule_id = ir.id
      WHERE a.id = ?
    `).get(req.params.id);
    
    res.json({
      success: true,
      message: '动物档案更新成功',
      data: updated
    });
  } catch (error) {
    console.error('更新动物档案失败:', error);
    res.status(500).json({
      success: false,
      message: '更新动物档案失败',
      error: error.message
    });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDB();
    
    const animal = db.prepare('SELECT * FROM animals WHERE id = ?').get(req.params.id);
    if (!animal) {
      return res.status(404).json({
        success: false,
        message: '动物不存在'
      });
    }
    
    const allocationsCount = db.prepare('SELECT COUNT(*) as count FROM allocations WHERE animal_id = ?').get(req.params.id).count;
    if (allocationsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `该动物有 ${allocationsCount} 条分配记录，无法删除`
      });
    }
    
    db.prepare('DELETE FROM animals WHERE id = ?').run(req.params.id);
    
    res.json({
      success: true,
      message: '动物档案删除成功'
    });
  } catch (error) {
    console.error('删除动物档案失败:', error);
    res.status(500).json({
      success: false,
      message: '删除动物档案失败',
      error: error.message
    });
  }
});

module.exports = router;
