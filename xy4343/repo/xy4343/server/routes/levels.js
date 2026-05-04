const express = require('express');
const router = express.Router();
const db = require('../database');
const fs = require('fs-extra');
const path = require('path');
const uuid = require('uuid');

const levelsDir = path.join(__dirname, '../../data/levels');

// 获取所有关卡
router.get('/', (req, res) => {
  db.all('SELECT id, name, description, time_limit, created_at FROM levels ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 获取单个关卡详情
router.get('/:id', (req, res) => {
  const levelId = req.params.id;
  db.get('SELECT * FROM levels WHERE id = ?', [levelId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: '关卡不存在' });
    }
    
    // 解析JSON数据
    const level = {
      ...row,
      floor_plan: JSON.parse(row.floor_plan),
      checkpoints: JSON.parse(row.checkpoints)
    };
    res.json(level);
  });
});

// 创建新关卡（从JSON导入）
router.post('/', (req, res) => {
  const { name, description, floor_plan, checkpoints, time_limit } = req.body;
  
  // 验证必要字段
  if (!name || !floor_plan || !checkpoints) {
    return res.status(400).json({ error: '缺少必要字段：name, floor_plan, checkpoints' });
  }
  
  // 保存JSON到文件系统
  const levelFile = path.join(levelsDir, `${uuid.v4()}.json`);
  const levelData = {
    name,
    description: description || '',
    floor_plan,
    checkpoints,
    time_limit: time_limit || 120,
    created_at: new Date().toISOString()
  };
  
  fs.writeJson(levelFile, levelData, { spaces: 2 })
    .then(() => {
      // 保存到数据库
      const stmt = db.prepare(`
        INSERT INTO levels (name, description, floor_plan, checkpoints, time_limit)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        name,
        description || '',
        JSON.stringify(floor_plan),
        JSON.stringify(checkpoints),
        time_limit || 120,
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json({
            success: true,
            id: this.lastID,
            message: '关卡创建成功'
          });
        }
      );
      stmt.finalize();
    })
    .catch(err => {
      res.status(500).json({ error: '保存关卡文件失败: ' + err.message });
    });
});

// 删除关卡
router.delete('/:id', (req, res) => {
  const levelId = req.params.id;
  db.run('DELETE FROM levels WHERE id = ?', [levelId], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: '关卡不存在' });
    }
    res.json({ success: true, message: '关卡删除成功' });
  });
});

module.exports = router;
