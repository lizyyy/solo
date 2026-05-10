const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../config/database');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const db = getDB();
    const strains = db.prepare(`
      SELECT * FROM strains ORDER BY created_at DESC
    `).all();
    
    res.json({
      success: true,
      data: strains
    });
  } catch (error) {
    console.error('获取品系列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取品系列表失败',
      error: error.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const strain = db.prepare('SELECT * FROM strains WHERE id = ?').get(req.params.id);
    
    if (!strain) {
      return res.status(404).json({
        success: false,
        message: '品系不存在'
      });
    }
    
    res.json({
      success: true,
      data: strain
    });
  } catch (error) {
    console.error('获取品系详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取品系详情失败',
      error: error.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const { code, name, description } = req.body;
    
    if (!code || !name) {
      return res.status(400).json({
        success: false,
        message: '品系编码和名称为必填项'
      });
    }
    
    const db = getDB();
    
    const existing = db.prepare('SELECT * FROM strains WHERE code = ?').get(code);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: '品系编码已存在',
        data: existing
      });
    }
    
    const result = db.prepare(`
      INSERT INTO strains (code, name, description)
      VALUES (?, ?, ?)
    `).run(code, name, description || null);
    
    const strain = db.prepare('SELECT * FROM strains WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({
      success: true,
      message: '品系创建成功',
      data: strain
    });
  } catch (error) {
    console.error('创建品系失败:', error);
    res.status(500).json({
      success: false,
      message: '创建品系失败',
      error: error.message
    });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { name, description, is_active } = req.body;
    const db = getDB();
    
    const strain = db.prepare('SELECT * FROM strains WHERE id = ?').get(req.params.id);
    if (!strain) {
      return res.status(404).json({
        success: false,
        message: '品系不存在'
      });
    }
    
    db.prepare(`
      UPDATE strains 
      SET name = ?, description = ?, is_active = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      name || strain.name,
      description !== undefined ? description : strain.description,
      is_active !== undefined ? (is_active ? 1 : 0) : strain.is_active,
      req.params.id
    );
    
    const updated = db.prepare('SELECT * FROM strains WHERE id = ?').get(req.params.id);
    
    res.json({
      success: true,
      message: '品系更新成功',
      data: updated
    });
  } catch (error) {
    console.error('更新品系失败:', error);
    res.status(500).json({
      success: false,
      message: '更新品系失败',
      error: error.message
    });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const db = getDB();
    
    const strain = db.prepare('SELECT * FROM strains WHERE id = ?').get(req.params.id);
    if (!strain) {
      return res.status(404).json({
        success: false,
        message: '品系不存在'
      });
    }
    
    const animalsCount = db.prepare('SELECT COUNT(*) as count FROM animals WHERE strain_id = ?').get(req.params.id).count;
    if (animalsCount > 0) {
      return res.status(400).json({
        success: false,
        message: `该品系下有 ${animalsCount} 只动物，无法删除`
      });
    }
    
    const cagesCount = db.prepare('SELECT COUNT(*) as count FROM cages WHERE strain_id = ?').get(req.params.id).count;
    if (cagesCount > 0) {
      return res.status(400).json({
        success: false,
        message: `该品系关联 ${cagesCount} 个笼位，无法删除`
      });
    }
    
    db.prepare('DELETE FROM strains WHERE id = ?').run(req.params.id);
    
    res.json({
      success: true,
      message: '品系删除成功'
    });
  } catch (error) {
    console.error('删除品系失败:', error);
    res.status(500).json({
      success: false,
      message: '删除品系失败',
      error: error.message
    });
  }
});

module.exports = router;
