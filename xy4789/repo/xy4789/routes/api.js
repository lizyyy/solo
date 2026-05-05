const express = require('express');
const router = express.Router();
const db = require('../database/db');
const path = require('path');
const fs = require('fs');

// 导入服务
const fileParser = require('../services/fileParser');
const validator = require('../services/validator');
const exporter = require('../services/exporter');

// 临时存储上传的文件数据（预览阶段使用）
let pendingBatches = {};

// 健康检查接口
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API服务正常运行' });
});

// 上传文件接口
router.post('/upload', fileParser.upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: '请选择要上传的文件' 
      });
    }

    // 解析文件
    const parsedData = fileParser.parseFile(req.file);
    
    // 生成临时批次ID
    const batchId = Date.now().toString();
    
    // 验证数据
    const validationResult = validator.validateArtifacts(parsedData);
    
    // 存储到临时批次
    pendingBatches[batchId] = {
      file: req.file,
      data: parsedData,
      validation: validationResult,
      createdAt: new Date().toISOString()
    };

    res.json({
      success: true,
      message: '文件上传成功',
      batchId: batchId,
      data: parsedData,
      validation: validationResult
    });
  } catch (error) {
    console.error('文件上传错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '文件上传失败', 
      error: error.message 
    });
  }
});

// 预览批次数据
router.get('/preview/:batchId', (req, res) => {
  const { batchId } = req.params;
  
  if (!pendingBatches[batchId]) {
    return res.status(404).json({ 
      success: false, 
      message: '批次不存在或已过期' 
    });
  }

  const batch = pendingBatches[batchId];
  
  res.json({
    success: true,
    batchId: batchId,
    data: batch.data,
    validation: batch.validation
  });
});

// 修正单个藏品数据
router.put('/preview/:batchId/artifact/:index', (req, res) => {
  try {
    const { batchId, index } = req.params;
    const updatedArtifact = req.body;
    
    if (!pendingBatches[batchId]) {
      return res.status(404).json({ 
        success: false, 
        message: '批次不存在或已过期' 
      });
    }
    
    const batch = pendingBatches[batchId];
    const artifactIndex = parseInt(index);
    
    if (artifactIndex < 0 || artifactIndex >= batch.data.length) {
      return res.status(404).json({ 
        success: false, 
        message: '藏品索引无效' 
      });
    }
    
    // 更新藏品数据
    batch.data[artifactIndex] = {
      ...batch.data[artifactIndex],
      ...updatedArtifact
    };
    
    // 重新验证整个批次
    batch.validation = validator.validateArtifacts(batch.data);
    
    res.json({
      success: true,
      message: '藏品数据更新成功',
      data: batch.data[artifactIndex],
      validation: batch.validation
    });
  } catch (error) {
    console.error('修正藏品数据错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '修正藏品数据失败', 
      error: error.message 
    });
  }
});

// 退回单个藏品
router.put('/preview/:batchId/artifact/:index/return', (req, res) => {
  try {
    const { batchId, index } = req.params;
    
    if (!pendingBatches[batchId]) {
      return res.status(404).json({ 
        success: false, 
        message: '批次不存在或已过期' 
      });
    }
    
    const batch = pendingBatches[batchId];
    const artifactIndex = parseInt(index);
    
    if (artifactIndex < 0 || artifactIndex >= batch.data.length) {
      return res.status(404).json({ 
        success: false, 
        message: '藏品索引无效' 
      });
    }
    
    // 标记为退回
    batch.data[artifactIndex].status = 'returned';
    batch.data[artifactIndex].notes = '库管退回';
    
    res.json({
      success: true,
      message: '藏品已标记为退回',
      data: batch.data[artifactIndex]
    });
  } catch (error) {
    console.error('退回藏品错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '退回藏品失败', 
      error: error.message 
    });
  }
});

// 确认入库批次
router.post('/confirm/:batchId', (req, res) => {
  try {
    const { batchId } = req.params;
    
    if (!pendingBatches[batchId]) {
      return res.status(404).json({ 
        success: false, 
        message: '批次不存在或已过期' 
      });
    }
    
    const batch = pendingBatches[batchId];
    
    // 开始数据库事务
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      try {
        // 1. 创建入库批次记录
        const batchName = req.body.batchName || `批次_${new Date().toISOString().slice(0, 10)}`;
        const totalItems = batch.data.length;
        const confirmedItems = batch.data.filter(item => item.status !== 'returned').length;
        const cancelledItems = batch.data.filter(item => item.status === 'returned').length;
        
        const stmt = db.prepare(`
          INSERT INTO batches (batch_name, upload_date, status, total_items, confirmed_items, cancelled_items, notes)
          VALUES (?, datetime('now'), 'confirmed', ?, ?, ?, ?)
        `);
        
        stmt.run(batchName, totalItems, confirmedItems, cancelledItems, req.body.notes || '');
        stmt.finalize();
        
        // 获取新创建的批次ID
        db.get('SELECT last_insert_rowid() as id', (err, row) => {
          if (err) {
            throw err;
          }
          
          const newBatchId = row.id;
          
          // 2. 插入藏品记录
          const artifactStmt = db.prepare(`
            INSERT INTO artifacts (batch_id, box_number, artifact_number, insurance_value, location, status, has_certificate, original_row, notes, validation_errors)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          
          const auditStmt = db.prepare(`
            INSERT INTO audit_logs (batch_id, artifact_id, action, details, created_at)
            VALUES (?, ?, 'confirm', ?, datetime('now'))
          `);
          
          batch.data.forEach((artifact, index) => {
            const status = artifact.status === 'returned' ? 'returned' : 'confirmed';
            const validationErrors = JSON.stringify(artifact.validationErrors || []);
            
            artifactStmt.run(
              newBatchId,
              artifact.boxNumber,
              artifact.artifactNumber,
              artifact.insuranceValue,
              artifact.location,
              status,
              artifact.hasCertificate ? 1 : 0,
              artifact.originalRow || index + 1,
              artifact.notes || '',
              validationErrors
            );
            
            // 获取刚插入的藏品ID
            db.get('SELECT last_insert_rowid() as id', (err, artifactRow) => {
              if (err) {
                throw err;
              }
              
              const artifactId = artifactRow.id;
              
              // 记录审计日志
              const details = JSON.stringify({
                artifactNumber: artifact.artifactNumber,
                status: status,
                boxNumber: artifact.boxNumber,
                insuranceValue: artifact.insuranceValue,
                location: artifact.location
              });
              
              auditStmt.run(newBatchId, artifactId, details);
            });
          });
          
          artifactStmt.finalize();
          
          // 记录批次级别的审计日志
          const batchAuditDetails = JSON.stringify({
            batchName: batchName,
            totalItems: totalItems,
            confirmedItems: confirmedItems,
            cancelledItems: cancelledItems,
            notes: req.body.notes || ''
          });
          
          db.run(`
            INSERT INTO audit_logs (batch_id, action, details, created_at)
            VALUES (?, 'batch_confirm', ?, datetime('now'))
          `, [newBatchId, batchAuditDetails]);
          
          // 提交事务
          db.run('COMMIT', (err) => {
            if (err) {
              throw err;
            }
            
            // 清除临时批次
            delete pendingBatches[batchId];
            
            res.json({
              success: true,
              message: '批次确认入库成功',
              batchId: newBatchId,
              totalItems: totalItems,
              confirmedItems: confirmedItems,
              cancelledItems: cancelledItems
            });
          });
        });
      } catch (error) {
        // 回滚事务
        db.run('ROLLBACK');
        throw error;
      }
    });
  } catch (error) {
    console.error('确认入库错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '确认入库失败', 
      error: error.message 
    });
  }
});

// 获取所有入库批次列表
router.get('/batches', (req, res) => {
  try {
    db.all(`
      SELECT id, batch_name, upload_date, status, total_items, confirmed_items, cancelled_items, notes, created_at, updated_at
      FROM batches
      ORDER BY created_at DESC
    `, (err, rows) => {
      if (err) {
        throw err;
      }
      
      res.json({
        success: true,
        batches: rows
      });
    });
  } catch (error) {
    console.error('获取批次列表错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取批次列表失败', 
      error: error.message 
    });
  }
});

// 获取单个批次详情
router.get('/batches/:batchId', (req, res) => {
  try {
    const { batchId } = req.params;
    
    // 获取批次基本信息
    db.get(`
      SELECT id, batch_name, upload_date, status, total_items, confirmed_items, cancelled_items, notes, created_at, updated_at
      FROM batches
      WHERE id = ?
    `, [batchId], (err, batch) => {
      if (err) {
        throw err;
      }
      
      if (!batch) {
        return res.status(404).json({ 
          success: false, 
          message: '批次不存在' 
        });
      }
      
      // 获取批次下的所有藏品
      db.all(`
        SELECT id, box_number, artifact_number, insurance_value, location, status, has_certificate, original_row, notes, validation_errors, created_at, updated_at
        FROM artifacts
        WHERE batch_id = ?
        ORDER BY original_row
      `, [batchId], (err, artifacts) => {
        if (err) {
          throw err;
        }
        
        // 解析验证错误JSON
        const parsedArtifacts = artifacts.map(artifact => ({
          ...artifact,
          validationErrors: artifact.validation_errors ? JSON.parse(artifact.validation_errors) : []
        }));
        
        res.json({
          success: true,
          batch: batch,
          artifacts: parsedArtifacts
        });
      });
    });
  } catch (error) {
    console.error('获取批次详情错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取批次详情失败', 
      error: error.message 
    });
  }
});

// 导出Markdown交接单
router.get('/batches/:batchId/export/markdown', (req, res) => {
  try {
    const { batchId } = req.params;
    
    // 获取批次基本信息
    db.get(`
      SELECT id, batch_name, upload_date, status, total_items, confirmed_items, cancelled_items, notes, created_at, updated_at
      FROM batches
      WHERE id = ?
    `, [batchId], (err, batch) => {
      if (err) {
        throw err;
      }
      
      if (!batch) {
        return res.status(404).json({ 
          success: false, 
          message: '批次不存在' 
        });
      }
      
      // 获取批次下的所有藏品
      db.all(`
        SELECT id, box_number, artifact_number, insurance_value, location, status, has_certificate, original_row, notes, validation_errors, created_at, updated_at
        FROM artifacts
        WHERE batch_id = ?
        ORDER BY original_row
      `, [batchId], (err, artifacts) => {
        if (err) {
          throw err;
        }
        
        // 生成Markdown
        const markdown = exporter.generateMarkdown(batch, artifacts);
        
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename=交接单_${batch.batch_name}.md`);
        res.send(markdown);
      });
    });
  } catch (error) {
    console.error('导出Markdown错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '导出Markdown失败', 
      error: error.message 
    });
  }
});

// 导出JSON明细
router.get('/batches/:batchId/export/json', (req, res) => {
  try {
    const { batchId } = req.params;
    
    // 获取批次基本信息
    db.get(`
      SELECT id, batch_name, upload_date, status, total_items, confirmed_items, cancelled_items, notes, created_at, updated_at
      FROM batches
      WHERE id = ?
    `, [batchId], (err, batch) => {
      if (err) {
        throw err;
      }
      
      if (!batch) {
        return res.status(404).json({ 
          success: false, 
          message: '批次不存在' 
        });
      }
      
      // 获取批次下的所有藏品
      db.all(`
        SELECT id, box_number, artifact_number, insurance_value, location, status, has_certificate, original_row, notes, validation_errors, created_at, updated_at
        FROM artifacts
        WHERE batch_id = ?
        ORDER BY original_row
      `, [batchId], (err, artifacts) => {
        if (err) {
          throw err;
        }
        
        // 生成JSON
        const jsonData = exporter.generateJSON(batch, artifacts);
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=明细_${batch.batch_name}.json`);
        res.json(jsonData);
      });
    });
  } catch (error) {
    console.error('导出JSON错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '导出JSON失败', 
      error: error.message 
    });
  }
});

// 获取审计日志
router.get('/audit-logs', (req, res) => {
  try {
    const { batchId, artifactId, action } = req.query;
    
    let query = `
      SELECT al.id, al.batch_id, al.artifact_id, al.action, al.user_name, al.details, al.created_at,
             b.batch_name, a.artifact_number
      FROM audit_logs al
      LEFT JOIN batches b ON al.batch_id = b.id
      LEFT JOIN artifacts a ON al.artifact_id = a.id
      WHERE 1=1
    `;
    const params = [];
    
    if (batchId) {
      query += ' AND al.batch_id = ?';
      params.push(batchId);
    }
    
    if (artifactId) {
      query += ' AND al.artifact_id = ?';
      params.push(artifactId);
    }
    
    if (action) {
      query += ' AND al.action = ?';
      params.push(action);
    }
    
    query += ' ORDER BY al.created_at DESC';
    
    db.all(query, params, (err, rows) => {
      if (err) {
        throw err;
      }
      
      // 解析details JSON
      const parsedLogs = rows.map(log => ({
        ...log,
        details: log.details ? JSON.parse(log.details) : null
      }));
      
      res.json({
        success: true,
        logs: parsedLogs
      });
    });
  } catch (error) {
    console.error('获取审计日志错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取审计日志失败', 
      error: error.message 
    });
  }
});

module.exports = router;
