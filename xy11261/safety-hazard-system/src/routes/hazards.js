const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { db } = require('../models/database');
const { 
  checkPhotoRequired, 
  checkOverdueEscalation, 
  checkDuplicateLocation, 
  checkRectificationDeadline,
  getHazardRuleLogs 
} = require('../utils/ruleEngine');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

router.get('/', (req, res) => {
  try {
    const { 
      rectifier, 
      status, 
      hazard_level, 
      start_time, 
      end_time, 
      location,
      page = 1,
      page_size = 20
    } = req.query;

    let sql = 'SELECT * FROM hazards WHERE 1=1';
    const countSql = 'SELECT COUNT(*) as total FROM hazards WHERE 1=1';
    const params = [];
    const countParams = [];

    if (rectifier) {
      sql += ' AND rectifier = ?';
      params.push(rectifier);
      countParams.push(rectifier);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
      countParams.push(status);
    }
    if (hazard_level) {
      sql += ' AND hazard_level = ?';
      params.push(hazard_level);
      countParams.push(hazard_level);
    }
    if (start_time) {
      sql += ' AND inspector_time >= ?';
      params.push(start_time);
      countParams.push(start_time);
    }
    if (end_time) {
      sql += ' AND inspector_time <= ?';
      params.push(end_time);
      countParams.push(end_time);
    }
    if (location) {
      sql += ' AND location LIKE ?';
      params.push(`%${location}%`);
      countParams.push(`%${location}%`);
    }

    sql += ' ORDER BY inspector_time DESC LIMIT ? OFFSET ?';
    const limit = parseInt(page_size);
    const offset = (parseInt(page) - 1) * limit;
    params.push(limit, offset);

    const stmt = db.prepare(sql);
    const hazards = stmt.all(...params);

    const countStmt = db.prepare(countSql);
    const { total } = countStmt.get(...countParams);

    checkOverdueEscalation();

    res.json({
      success: true,
      data: {
        list: hazards,
        pagination: {
          page: parseInt(page),
          page_size: limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/stats', (req, res) => {
  try {
    const totalStmt = db.prepare('SELECT COUNT(*) as total FROM hazards');
    const { total } = totalStmt.get();

    const statusStmt = db.prepare('SELECT status, COUNT(*) as count FROM hazards GROUP BY status');
    const byStatus = statusStmt.all();

    const levelStmt = db.prepare('SELECT hazard_level, COUNT(*) as count FROM hazards GROUP BY hazard_level');
    const byLevel = levelStmt.all();

    const rectifierStmt = db.prepare('SELECT rectifier, COUNT(*) as count FROM hazards WHERE rectifier IS NOT NULL GROUP BY rectifier ORDER BY count DESC LIMIT 10');
    const byRectifier = rectifierStmt.all();

    const closed = byStatus.find(s => s.status === 'closed')?.count || 0;
    const closureRate = total > 0 ? ((closed / total) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        total,
        closed,
        closure_rate: `${closureRate}%`,
        by_status: byStatus,
        by_level: byLevel,
        by_rectifier: byRectifier
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM hazards WHERE id = ?');
    const hazard = stmt.get(req.params.id);

    if (!hazard) {
      return res.status(404).json({ success: false, message: '隐患记录不存在' });
    }

    const ruleLogs = getHazardRuleLogs(hazard.id);

    const historyStmt = db.prepare('SELECT * FROM status_history WHERE hazard_id = ? ORDER BY created_at DESC');
    const statusHistory = historyStmt.all(hazard.id);

    res.json({
      success: true,
      data: {
        hazard,
        rule_logs: ruleLogs,
        status_history: statusHistory
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', upload.single('inspector_photo'), (req, res) => {
  try {
    const { location, description, hazard_level = 'medium', inspector, inspector_time } = req.body;

    if (!location || !description || !inspector || !inspector_time) {
      return res.status(400).json({ 
        success: false, 
        message: '位置、描述、巡检人、巡检时间为必填项' 
      });
    }

    const inspector_photo = req.file ? `uploads/${req.file.filename}` : null;

    const stmt = db.prepare(`
      INSERT INTO hazards (location, description, hazard_level, inspector, inspector_photo, inspector_time)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(location, description, hazard_level, inspector, inspector_photo, inspector_time);
    const hazardId = result.lastInsertRowid;

    const newHazard = { id: hazardId, location, inspector_photo };

    const duplicateCheck = checkDuplicateLocation(newHazard);
    const photoCheck = checkPhotoRequired({ ...newHazard, inspector_photo }, 'inspect');

    res.json({
      success: true,
      message: '隐患创建成功',
      data: {
        id: hazardId,
        warnings: {
          duplicate: duplicateCheck.hasDuplicate ? duplicateCheck.reason : null,
          photo: photoCheck.passed ? null : photoCheck.reason
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/assign', (req, res) => {
  try {
    const { rectifier, rectify_deadline, operator } = req.body;
    const hazardId = req.params.id;

    if (!rectifier || !rectify_deadline || !operator) {
      return res.status(400).json({ 
        success: false, 
        message: '整改责任人、整改截止时间、操作人为必填项' 
      });
    }

    const getStmt = db.prepare('SELECT * FROM hazards WHERE id = ?');
    const hazard = getStmt.get(hazardId);

    if (!hazard) {
      return res.status(404).json({ success: false, message: '隐患记录不存在' });
    }

    const deadlineCheck = checkRectificationDeadline({ ...hazard, rectify_deadline });
    if (!deadlineCheck.passed) {
      return res.status(400).json({ 
        success: false, 
        message: deadlineCheck.reason,
        rule_logs: getHazardRuleLogs(hazardId)
      });
    }

    const updateStmt = db.prepare(`
      UPDATE hazards 
      SET rectifier = ?, rectify_deadline = ?, status = 'rectifying', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    updateStmt.run(rectifier, rectify_deadline, hazardId);

    const historyStmt = db.prepare(`
      INSERT INTO status_history (hazard_id, from_status, to_status, operator, remark)
      VALUES (?, ?, ?, ?, ?)
    `);
    historyStmt.run(hazardId, hazard.status, 'rectifying', operator, `分配给${rectifier}负责整改`);

    res.json({
      success: true,
      message: '整改任务分配成功',
      rule_logs: getHazardRuleLogs(hazardId)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/rectify', upload.single('rectify_photo'), (req, res) => {
  try {
    const { rectify_description, operator } = req.body;
    const hazardId = req.params.id;

    if (!rectify_description || !operator) {
      return res.status(400).json({ 
        success: false, 
        message: '整改说明、操作人为必填项' 
      });
    }

    const getStmt = db.prepare('SELECT * FROM hazards WHERE id = ?');
    const hazard = getStmt.get(hazardId);

    if (!hazard) {
      return res.status(404).json({ success: false, message: '隐患记录不存在' });
    }

    const rectify_photo = req.file ? `uploads/${req.file.filename}` : hazard.rectify_photo;

    const photoCheck = checkPhotoRequired({ ...hazard, rectify_photo }, 'rectify');
    if (!photoCheck.passed) {
      return res.status(400).json({ 
        success: false, 
        message: photoCheck.reason,
        rule_logs: getHazardRuleLogs(hazardId)
      });
    }

    const updateStmt = db.prepare(`
      UPDATE hazards 
      SET rectify_photo = ?, rectify_description = ?, rectify_time = CURRENT_TIMESTAMP, 
          status = 'rechecking', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    updateStmt.run(rectify_photo, rectify_description, hazardId);

    const historyStmt = db.prepare(`
      INSERT INTO status_history (hazard_id, from_status, to_status, operator, remark)
      VALUES (?, ?, ?, ?, ?)
    `);
    historyStmt.run(hazardId, hazard.status, 'rechecking', operator, '整改完成，申请复查');

    res.json({
      success: true,
      message: '整改提交成功，进入待复查状态',
      rule_logs: getHazardRuleLogs(hazardId)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/recheck', upload.single('recheck_photo'), (req, res) => {
  try {
    const { recheck_result, recheck_description, rechecker } = req.body;
    const hazardId = req.params.id;

    if (!recheck_result || !recheck_description || !rechecker) {
      return res.status(400).json({ 
        success: false, 
        message: '复查结果、复查说明、复查人为必填项' 
      });
    }

    const getStmt = db.prepare('SELECT * FROM hazards WHERE id = ?');
    const hazard = getStmt.get(hazardId);

    if (!hazard) {
      return res.status(404).json({ success: false, message: '隐患记录不存在' });
    }

    const recheck_photo = req.file ? `uploads/${req.file.filename}` : hazard.recheck_photo;

    const photoCheck = checkPhotoRequired({ ...hazard, recheck_photo }, 'recheck');
    if (!photoCheck.passed) {
      return res.status(400).json({ 
        success: false, 
        message: photoCheck.reason,
        rule_logs: getHazardRuleLogs(hazardId)
      });
    }

    const newStatus = recheck_result === 'pass' ? 'closed' : 'rectifying';

    const updateStmt = db.prepare(`
      UPDATE hazards 
      SET recheck_photo = ?, recheck_description = ?, recheck_result = ?, 
          rechecker = ?, recheck_time = CURRENT_TIMESTAMP, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    updateStmt.run(recheck_photo, recheck_description, recheck_result, rechecker, newStatus, hazardId);

    const historyStmt = db.prepare(`
      INSERT INTO status_history (hazard_id, from_status, to_status, operator, remark)
      VALUES (?, ?, ?, ?, ?)
    `);
    historyStmt.run(hazardId, hazard.status, newStatus, rechecker, 
      recheck_result === 'pass' ? '复查通过，隐患闭环' : '复查不通过，重新整改');

    res.json({
      success: true,
      message: recheck_result === 'pass' ? '复查通过，隐患已闭环' : '复查不通过，重新进入整改',
      rule_logs: getHazardRuleLogs(hazardId)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/merge', (req, res) => {
  try {
    const { merge_ids, operator } = req.body;
    const hazardId = parseInt(req.params.id);

    if (!merge_ids || !Array.isArray(merge_ids) || !operator) {
      return res.status(400).json({ 
        success: false, 
        message: '合并ID列表和操作人为必填项' 
      });
    }

    const getStmt = db.prepare('SELECT * FROM hazards WHERE id = ?');
    const mainHazard = getStmt.get(hazardId);

    if (!mainHazard) {
      return res.status(404).json({ success: false, message: '主隐患记录不存在' });
    }

    const mergedFrom = [hazardId, ...merge_ids].join(',');

    const updateStmt = db.prepare(`
      UPDATE hazards 
      SET merged_from = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    updateStmt.run(mergedFrom, hazardId);

    res.json({
      success: true,
      message: `成功合并 ${merge_ids.length} 条重复隐患记录`,
      merged_ids: merge_ids
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM hazards WHERE id = ?');
    const result = stmt.run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: '隐患记录不存在' });
    }

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
