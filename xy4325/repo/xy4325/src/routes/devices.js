const express = require('express');
const router = express.Router();
const db = require('../database');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');

const upload = multer({ dest: 'uploads/' });

router.get('/', (req, res, next) => {
  try {
    const { status, type, project_group_id } = req.query;
    
    let sql = `
      SELECT d.*, 
             pg.name as project_group_name,
             (SELECT COUNT(*) FROM borrow_records br WHERE br.device_id = d.id AND br.status = 'active') as is_borrowed
      FROM devices d
      LEFT JOIN project_groups pg ON d.project_group_id = pg.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      sql += ' AND d.status = ?';
      params.push(status);
    }
    
    if (type) {
      sql += ' AND d.type = ?';
      params.push(type);
    }
    
    if (project_group_id) {
      sql += ' AND d.project_group_id = ?';
      params.push(parseInt(project_group_id));
    }
    
    sql += ' ORDER BY d.created_at DESC';
    
    const devices = db.prepare(sql).all(...params);
    
    res.json({
      success: true,
      data: devices,
      count: devices.length
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    
    const device = db.prepare(`
      SELECT d.*, 
             pg.name as project_group_name
      FROM devices d
      LEFT JOIN project_groups pg ON d.project_group_id = pg.id
      WHERE d.id = ?
    `).get(parseInt(id));
    
    if (!device) {
      const err = new Error('设备不存在');
      err.name = 'NotFoundError';
      return next(err);
    }
    
    const borrowRecords = db.prepare(`
      SELECT br.*,
             s.name as student_name,
             s.student_id as student_number,
             pg.name as project_group_name
      FROM borrow_records br
      LEFT JOIN students s ON br.student_id = s.id
      LEFT JOIN project_groups pg ON br.project_group_id = pg.id
      WHERE br.device_id = ?
      ORDER BY br.borrow_date DESC
    `).all(parseInt(id));
    
    res.json({
      success: true,
      data: {
        ...device,
        borrowHistory: borrowRecords
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', (req, res, next) => {
  try {
    const { device_id, name, type, model, serial_number, project_group_id } = req.body;
    
    if (!device_id || !name || !type) {
      const err = new Error('设备编号、名称和类型为必填项');
      err.name = 'ValidationError';
      return next(err);
    }
    
    const result = db.prepare(`
      INSERT INTO devices (device_id, name, type, model, serial_number, status, project_group_id)
      VALUES (?, ?, ?, ?, ?, 'available', ?)
    `).run(device_id, name, type, model || null, serial_number || null, project_group_id || null);
    
    const newDevice = db.prepare('SELECT * FROM devices WHERE id = ?').get(result.lastInsertRowid);
    
    res.status(201).json({
      success: true,
      message: '设备登记成功',
      data: newDevice
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, type, model, serial_number, project_group_id, status } = req.body;
    
    const existing = db.prepare('SELECT * FROM devices WHERE id = ?').get(parseInt(id));
    if (!existing) {
      const err = new Error('设备不存在');
      err.name = 'NotFoundError';
      return next(err);
    }
    
    const updateFields = [];
    const updateValues = [];
    
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (type !== undefined) {
      updateFields.push('type = ?');
      updateValues.push(type);
    }
    if (model !== undefined) {
      updateFields.push('model = ?');
      updateValues.push(model);
    }
    if (serial_number !== undefined) {
      updateFields.push('serial_number = ?');
      updateValues.push(serial_number);
    }
    if (project_group_id !== undefined) {
      updateFields.push('project_group_id = ?');
      updateValues.push(project_group_id);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    
    if (updateFields.length === 0) {
      return res.json({
        success: true,
        message: '没有需要更新的字段',
        data: existing
      });
    }
    
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(parseInt(id));
    
    const sql = `UPDATE devices SET ${updateFields.join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...updateValues);
    
    const updatedDevice = db.prepare('SELECT * FROM devices WHERE id = ?').get(parseInt(id));
    
    res.json({
      success: true,
      message: '设备信息更新成功',
      data: updatedDevice
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    
    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(parseInt(id));
    if (!device) {
      const err = new Error('设备不存在');
      err.name = 'NotFoundError';
      return next(err);
    }
    
    const activeBorrow = db.prepare(`
      SELECT * FROM borrow_records WHERE device_id = ? AND status = 'active'
    `).get(parseInt(id));
    
    if (activeBorrow) {
      const err = new Error('设备当前已被借用，无法删除');
      err.name = 'ValidationError';
      return next(err);
    }
    
    db.prepare('DELETE FROM devices WHERE id = ?').run(parseInt(id));
    
    res.json({
      success: true,
      message: '设备删除成功'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/import/csv', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) {
      const err = new Error('请选择要上传的 CSV 文件');
      err.name = 'ValidationError';
      return next(err);
    }
    
    const results = [];
    const errors = [];
    let successCount = 0;
    let failCount = 0;
    
    const filePath = path.join(__dirname, '../../', req.file.path);
    
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (row) => {
        results.push(row);
      })
      .on('end', () => {
        const insertStmt = db.prepare(`
          INSERT INTO devices (device_id, name, type, model, serial_number, status, project_group_id)
          VALUES (?, ?, ?, ?, ?, 'available', ?)
        `);
        
        const transaction = db.transaction((devices) => {
          for (const device of devices) {
            try {
              const device_id = device['设备编号'] || device['device_id'] || device['id'];
              const name = device['名称'] || device['name'];
              const type = device['类型'] || device['type'];
              const model = device['型号'] || device['model'] || null;
              const serial_number = device['序列号'] || device['serial_number'] || null;
              const project_group_name = device['项目组'] || device['project_group'] || null;
              
              if (!device_id || !name || !type) {
                failCount++;
                errors.push({
                  row: device,
                  reason: '缺少必填字段（设备编号、名称、类型）'
                });
                continue;
              }
              
              let project_group_id = null;
              if (project_group_name) {
                const group = db.prepare('SELECT id FROM project_groups WHERE name = ?').get(project_group_name);
                if (group) {
                  project_group_id = group.id;
                }
              }
              
              insertStmt.run(device_id, name, type, model, serial_number, project_group_id);
              successCount++;
            } catch (err) {
              failCount++;
              errors.push({
                row: device,
                reason: err.message
              });
            }
          }
        });
        
        transaction(results);
        
        fs.unlinkSync(filePath);
        
        res.json({
          success: true,
          message: `CSV 导入完成：成功 ${successCount} 条，失败 ${failCount} 条`,
          data: {
            successCount,
            failCount,
            errors: errors.slice(0, 20)
          }
        });
      })
      .on('error', (err) => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        next(err);
      });
  } catch (err) {
    next(err);
  }
});

router.get('/stats/summary', (req, res, next) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM devices').get().count;
    const available = db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'available'").get().count;
    const borrowed = db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'borrowed'").get().count;
    const maintenance = db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'maintenance'").get().count;
    
    const types = db.prepare(`
      SELECT type, COUNT(*) as count
      FROM devices
      GROUP BY type
      ORDER BY count DESC
    `).all();
    
    res.json({
      success: true,
      data: {
        total,
        available,
        borrowed,
        maintenance,
        byType: types
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
