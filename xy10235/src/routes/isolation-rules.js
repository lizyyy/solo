const express = require('express');
const { getDB } = require('../config/database');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const db = getDB();
    const rules = db.prepare(`
      SELECT * FROM isolation_rules ORDER BY created_at DESC
    `).all();
    
    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    console.error('获取隔离规则列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取隔离规则列表失败',
      error: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const rule = db.prepare('SELECT * FROM isolation_rules WHERE id = ?').get(req.params.id);
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: '隔离规则不存在'
      });
    }
    
    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    console.error('获取隔离规则详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取隔离规则详情失败',
      error: error.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const { code, name, level, description, can_coexist_with } = req.body;
    
    if (!code || !name || !level) {
      return res.status(400).json({
        success: false,
        message: '规则编码、名称和级别为必填项'
      });
    }
    
    const validLevels = ['SPF', 'conventional', 'quarantine', 'germ-free', 'immunodeficient'];
    if (!validLevels.includes(level)) {
      return res.status(400).json({
        success: false,
        message: `隔离级别无效，有效值为: ${validLevels.join(', ')}`
      });
    }
    
    const db = getDB();
    
    const existing = db.prepare('SELECT * FROM isolation_rules WHERE code = ?').get(code);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: '隔离规则编码已存在',
        data: existing
      });
    }
    
    const result = db.prepare(`
      INSERT INTO isolation_rules (code, name, level, description, can_coexist_with)
      VALUES (?, ?, ?, ?, ?)
    `).run(code, name, level, description || null, can_coexist_with || null);
    
    const rule = db.prepare('SELECT * FROM isolation_rules WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({
      success: true,
      message: '隔离规则创建成功',
      data: rule
    });
  } catch (error) {
    console.error('创建隔离规则失败:', error);
    res.status(500).json({
      success: false,
      message: '创建隔离规则失败',
      error: error.message
    });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { name, level, description, can_coexist_with, is_active } = req.body;
    const db = getDB();
    
    const rule = db.prepare('SELECT * FROM isolation_rules WHERE id = ?').get(req.params.id);
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: '隔离规则不存在'
      });
    }
    
    if (level) {
      const validLevels = ['SPF', 'conventional', 'quarantine', 'germ-free', 'immunodeficient'];
      if (!validLevels.includes(level)) {
        return res.status(400).json({
          success: false,
          message: `隔离级别无效，有效值为: ${validLevels.join(', ')}`
        });
      }
    }
    
    db.prepare(`
      UPDATE isolation_rules 
      SET name = ?, level = ?, description = ?, can_coexist_with = ?, is_active = ?, 
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      name || rule.name,
      level || rule.level,
      description !== undefined ? description : rule.description,
      can_coexist_with !== undefined ? can_coexist_with : rule.can_coexist_with,
      is_active !== undefined ? (is_active ? 1 : 0) : rule.is_active,
      req.params.id
    );
    
    const updated = db.prepare('SELECT * FROM isolation_rules WHERE id = ?').get(req.params.id);
    
    res.json({
      success: true,
      message: '隔离规则更新成功',
      data: updated
    });
  } catch (error) {
    console.error('更新隔离规则失败:', error);
    res.status(500).json({
      success: false,
      message: '更新隔离规则失败',
      error: error.message
    });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDB();
    
    const rule = db.prepare('SELECT * FROM isolation_rules WHERE id = ?').get(req.params.id);
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: '隔离规则不存在'
      });
    }
    
    const animalsCount = db.prepare('SELECT COUNT(*) as count FROM animals WHERE isolation_rule_id = ?').get(req.params.id).count;
    if (animalsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `该隔离规则关联 ${animalsCount} 只动物，无法删除`
      });
    }
    
    const cagesCount = db.prepare('SELECT COUNT(*) as count FROM cages WHERE isolation_rule_id = ?').get(req.params.id).count;
    if (cagesCount > 0) {
      return res.status(400).json({
        success: false,
        message: `该隔离规则关联 ${cagesCount} 个笼位，无法删除`
      });
    }
    
    db.prepare('DELETE FROM isolation_rules WHERE id = ?').run(req.params.id);
    
    res.json({
      success: true,
      message: '隔离规则删除成功'
    });
  } catch (error) {
    console.error('删除隔离规则失败:', error);
    res.status(500).json({
      success: false,
      message: '删除隔离规则失败',
      error: error.message
    });
  }
});

module.exports = router;
