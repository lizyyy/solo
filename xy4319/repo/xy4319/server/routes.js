const express = require('express');
const router = express.Router();
const { getQuery, allQuery, runQuery, uuidv4 } = require('./database');
const { 
  TRIAGE_LEVELS, 
  checkDepartmentCapacity, 
  checkBedConflict,
  calculateTransferPriority,
  runAllRulesCheck,
  checkTriageErrors
} = require('./rulesEngine');
const { 
  logAction, 
  getLogs, 
  getLogStats,
  logPatientCreated,
  logPatientTriageChanged,
  logBedConflict
} = require('./logger');
const { 
  generateMarkdownReport, 
  generateCSVIncidents,
  generateCSVPatients
} = require('./exportService');
const { createAllSampleData, clearAllData } = require('./sampleData');
const { 
  broadcastPatientUpdate,
  broadcastDepartmentUpdate,
  broadcastBedUpdate,
  broadcastTransferUpdate,
  broadcastAmbulanceUpdate,
  runCheckAndBroadcast
} = require('./websocket');

// ===== 健康检查 =====
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: '分诊转运压测台 API 运行正常'
  });
});

// ===== 患者管理 =====

// 获取所有患者
router.get('/patients', async (req, res) => {
  try {
    const { status, triageLevel, limit, offset } = req.query;
    
    let sql = 'SELECT * FROM patients WHERE 1=1';
    const params = [];
    
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    
    if (triageLevel) {
      sql += ' AND triageLevel = ?';
      params.push(triageLevel);
    }
    
    sql += ' ORDER BY arrivalTime DESC';
    
    if (limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(limit));
      if (offset) {
        sql += ' OFFSET ?';
        params.push(parseInt(offset));
      }
    }
    
    const patients = await allQuery(sql, params);
    res.json(patients);
  } catch (error) {
    console.error('获取患者列表失败:', error);
    res.status(500).json({ error: '获取患者列表失败', message: error.message });
  }
});

// 获取单个患者
router.get('/patients/:id', async (req, res) => {
  try {
    const patient = await getQuery('SELECT * FROM patients WHERE id = ?', [req.params.id]);
    
    if (!patient) {
      return res.status(404).json({ error: '患者不存在' });
    }
    
    res.json(patient);
  } catch (error) {
    console.error('获取患者信息失败:', error);
    res.status(500).json({ error: '获取患者信息失败', message: error.message });
  }
});

// 创建患者
router.post('/patients', async (req, res) => {
  try {
    const { 
      name, age, gender, chiefComplaint, 
      triageLevel, targetDepartment, ambulanceId, notes 
    } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '患者姓名不能为空' });
    }
    
    const patientId = uuidv4();
    const now = new Date().toISOString();
    
    // 验证分诊级别
    if (triageLevel && !TRIAGE_LEVELS[triageLevel]) {
      return res.status(400).json({ error: '无效的分诊级别' });
    }
    
    const patient = {
      id: patientId,
      name,
      age: age || null,
      gender: gender || null,
      chiefComplaint: chiefComplaint || '',
      triageLevel: triageLevel || 'green',
      triageTime: now,
      arrivalTime: now,
      status: 'waiting',
      targetDepartment: targetDepartment || null,
      ambulanceId: ambulanceId || null,
      notes: notes || '',
      createdAt: now,
      updatedAt: now
    };
    
    await runQuery(`
      INSERT INTO patients (
        id, name, age, gender, chiefComplaint, triageLevel, triageTime,
        arrivalTime, status, targetDepartment, bedId, ambulanceId, notes,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
    `, [
      patientId, patient.name, patient.age, patient.gender,
      patient.chiefComplaint, patient.triageLevel, patient.triageTime,
      patient.arrivalTime, patient.status, patient.targetDepartment,
      patient.ambulanceId, patient.notes, patient.createdAt, patient.updatedAt
    ]);
    
    await logPatientCreated(patient, req.headers['x-operator'] || 'system');
    broadcastPatientUpdate(patient, 'created');
    
    res.status(201).json(patient);
  } catch (error) {
    console.error('创建患者失败:', error);
    res.status(500).json({ error: '创建患者失败', message: error.message });
  }
});

// 更新患者
router.put('/patients/:id', async (req, res) => {
  try {
    const patientId = req.params.id;
    const existingPatient = await getQuery('SELECT * FROM patients WHERE id = ?', [patientId]);
    
    if (!existingPatient) {
      return res.status(404).json({ error: '患者不存在' });
    }
    
    const { 
      name, age, gender, chiefComplaint, 
      triageLevel, status, targetDepartment, bedId, ambulanceId, notes 
    } = req.body;
    
    const now = new Date().toISOString();
    const updates = [];
    const values = [];
    
    // 检查分诊级别变更
    if (triageLevel && triageLevel !== existingPatient.triageLevel) {
      if (!TRIAGE_LEVELS[triageLevel]) {
        return res.status(400).json({ error: '无效的分诊级别' });
      }
      await logPatientTriageChanged(
        { ...existingPatient, ...req.body },
        existingPatient.triageLevel,
        triageLevel,
        req.headers['x-operator'] || 'system'
      );
    }
    
    // 检查床位占用/释放
    if (bedId !== undefined) {
      if (bedId && bedId !== existingPatient.bedId) {
        // 分配新床位
        const conflict = await checkBedConflict(bedId, patientId);
        if (conflict.conflict) {
          await logBedConflict(conflict.bed || { id: bedId }, patientId, conflict.reason);
          return res.status(400).json({ error: conflict.reason });
        }
        
        // 更新床位状态
        await runQuery(
          'UPDATE beds SET status = "occupied", patientId = ?, occupiedAt = ? WHERE id = ?',
          [patientId, now, bedId]
        );
        
        // 释放旧床位
        if (existingPatient.bedId) {
          await runQuery(
            'UPDATE beds SET status = "available", patientId = NULL, releasedAt = ? WHERE id = ?',
            [now, existingPatient.bedId]
          );
        }
      } else if (!bedId && existingPatient.bedId) {
        // 释放床位
        await runQuery(
          'UPDATE beds SET status = "available", patientId = NULL, releasedAt = ? WHERE id = ?',
          [now, existingPatient.bedId]
        );
      }
    }
    
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (age !== undefined) { updates.push('age = ?'); values.push(age); }
    if (gender !== undefined) { updates.push('gender = ?'); values.push(gender); }
    if (chiefComplaint !== undefined) { updates.push('chiefComplaint = ?'); values.push(chiefComplaint); }
    if (triageLevel !== undefined) { updates.push('triageLevel = ?'); values.push(triageLevel); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (targetDepartment !== undefined) { updates.push('targetDepartment = ?'); values.push(targetDepartment); }
    if (bedId !== undefined) { updates.push('bedId = ?'); values.push(bedId || null); }
    if (ambulanceId !== undefined) { updates.push('ambulanceId = ?'); values.push(ambulanceId || null); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
    
    if (updates.length > 0) {
      updates.push('updatedAt = ?');
      values.push(now);
      values.push(patientId);
      
      await runQuery(`UPDATE patients SET ${updates.join(', ')} WHERE id = ?`, values);
      
      await logAction(
        'patient_updated',
        'patient',
        patientId,
        { name: name || existingPatient.name },
        req.headers['x-operator'] || 'system'
      );
      
      const updatedPatient = await getQuery('SELECT * FROM patients WHERE id = ?', [patientId]);
      broadcastPatientUpdate(updatedPatient, 'updated');
      
      res.json(updatedPatient);
    } else {
      res.json(existingPatient);
    }
  } catch (error) {
    console.error('更新患者失败:', error);
    res.status(500).json({ error: '更新患者失败', message: error.message });
  }
});

// 删除患者
router.delete('/patients/:id', async (req, res) => {
  try {
    const patientId = req.params.id;
    const patient = await getQuery('SELECT * FROM patients WHERE id = ?', [patientId]);
    
    if (!patient) {
      return res.status(404).json({ error: '患者不存在' });
    }
    
    // 释放关联床位
    if (patient.bedId) {
      await runQuery(
        'UPDATE beds SET status = "available", patientId = NULL, releasedAt = ? WHERE id = ?',
        [new Date().toISOString(), patient.bedId]
      );
    }
    
    // 删除关联转运记录
    await runQuery('DELETE FROM transfer_queue WHERE patientId = ?', [patientId]);
    
    // 删除患者
    await runQuery('DELETE FROM patients WHERE id = ?', [patientId]);
    
    await logAction(
      'patient_deleted',
      'patient',
      patientId,
      { name: patient.name },
      req.headers['x-operator'] || 'system'
    );
    
    broadcastPatientUpdate({ id: patientId, name: patient.name }, 'deleted');
    
    res.json({ message: '患者已删除', patientId });
  } catch (error) {
    console.error('删除患者失败:', error);
    res.status(500).json({ error: '删除患者失败', message: error.message });
  }
});

// 批量导入患者
router.post('/patients/batch', async (req, res) => {
  try {
    const { patients } = req.body;
    
    if (!patients || !Array.isArray(patients)) {
      return res.status(400).json({ error: '患者数据格式错误' });
    }
    
    const results = [];
    const operator = req.headers['x-operator'] || 'system';
    
    for (const patientData of patients) {
      try {
        const patientId = uuidv4();
        const now = new Date().toISOString();
        
        const patient = {
          id: patientId,
          name: patientData.name || '未命名患者',
          age: patientData.age || null,
          gender: patientData.gender || null,
          chiefComplaint: patientData.chiefComplaint || '',
          triageLevel: patientData.triageLevel || 'green',
          triageTime: now,
          arrivalTime: patientData.arrivalTime || now,
          status: patientData.status || 'waiting',
          targetDepartment: patientData.targetDepartment || null,
          notes: patientData.notes || '',
          createdAt: now,
          updatedAt: now
        };
        
        await runQuery(`
          INSERT INTO patients (
            id, name, age, gender, chiefComplaint, triageLevel, triageTime,
            arrivalTime, status, targetDepartment, bedId, ambulanceId, notes,
            createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
        `, [
          patientId, patient.name, patient.age, patient.gender,
          patient.chiefComplaint, patient.triageLevel, patient.triageTime,
          patient.arrivalTime, patient.status, patient.targetDepartment,
          patient.notes, patient.createdAt, patient.updatedAt
        ]);
        
        await logPatientCreated(patient, operator);
        broadcastPatientUpdate(patient, 'created');
        
        results.push({ success: true, patientId, name: patient.name });
      } catch (err) {
        results.push({ 
          success: false, 
          name: patientData.name || '未知',
          error: err.message 
        });
      }
    }
    
    await logAction(
      'data_imported',
      'patient',
      null,
      { imported: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length },
      operator
    );
    
    res.json({
      total: patients.length,
      imported: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      details: results
    });
  } catch (error) {
    console.error('批量导入患者失败:', error);
    res.status(500).json({ error: '批量导入患者失败', message: error.message });
  }
});

// ===== 科室管理 =====

router.get('/departments', async (req, res) => {
  try {
    const departments = await allQuery('SELECT * FROM departments ORDER BY name');
    res.json(departments);
  } catch (error) {
    res.status(500).json({ error: '获取科室列表失败', message: error.message });
  }
});

router.get('/departments/:id/capacity', async (req, res) => {
  try {
    const capacity = await checkDepartmentCapacity(req.params.id);
    res.json(capacity);
  } catch (error) {
    res.status(500).json({ error: '获取科室容量失败', message: error.message });
  }
});

// ===== 床位管理 =====

router.get('/beds', async (req, res) => {
  try {
    const { departmentId, status } = req.query;
    
    let sql = `
      SELECT b.*, d.name as departmentName 
      FROM beds b 
      LEFT JOIN departments d ON b.departmentId = d.id 
      WHERE 1=1
    `;
    const params = [];
    
    if (departmentId) {
      sql += ' AND b.departmentId = ?';
      params.push(departmentId);
    }
    
    if (status) {
      sql += ' AND b.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY d.name, b.bedNumber';
    
    const beds = await allQuery(sql, params);
    res.json(beds);
  } catch (error) {
    res.status(500).json({ error: '获取床位列表失败', message: error.message });
  }
});

// ===== 救护车管理 =====

router.get('/ambulances', async (req, res) => {
  try {
    const ambulances = await allQuery('SELECT * FROM ambulances ORDER BY plateNumber');
    res.json(ambulances);
  } catch (error) {
    res.status(500).json({ error: '获取救护车列表失败', message: error.message });
  }
});

// ===== 转运队列 =====

router.get('/transfers', async (req, res) => {
  try {
    const { status } = req.query;
    
    let sql = `
      SELECT tq.*, p.name as patientName, p.triageLevel, p.chiefComplaint
      FROM transfer_queue tq
      LEFT JOIN patients p ON tq.patientId = p.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      sql += ' AND tq.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY tq.queuePosition ASC, tq.priority DESC';
    
    const transfers = await allQuery(sql, params);
    res.json(transfers);
  } catch (error) {
    res.status(500).json({ error: '获取转运队列失败', message: error.message });
  }
});

// 创建转运请求
router.post('/transfers', async (req, res) => {
  try {
    const { patientId, fromDepartment, toDepartment, reason } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: '患者ID不能为空' });
    }
    
    const patient = await getQuery('SELECT * FROM patients WHERE id = ?', [patientId]);
    if (!patient) {
      return res.status(404).json({ error: '患者不存在' });
    }
    
    // 检查是否已有未完成的转运请求
    const existingTransfer = await getQuery(
      "SELECT * FROM transfer_queue WHERE patientId = ? AND status IN ('pending', 'in_progress')",
      [patientId]
    );
    
    if (existingTransfer) {
      return res.status(400).json({ error: '该患者已有未完成的转运请求' });
    }
    
    const transferId = uuidv4();
    const now = new Date().toISOString();
    
    // 计算优先级
    const priority = calculateTransferPriority(patient);
    
    // 获取当前队列最大位置
    const maxPosition = await getQuery(
      "SELECT MAX(queuePosition) as maxPos FROM transfer_queue WHERE status = 'pending'"
    );
    const queuePosition = (maxPosition?.maxPos || 0) + 1;
    
    await runQuery(`
      INSERT INTO transfer_queue (
        id, patientId, priority, queuePosition, status,
        assignedAt, fromDepartment, toDepartment, reason
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `, [transferId, patientId, priority, queuePosition, now, fromDepartment || '急诊科', toDepartment, reason || '']);
    
    const transfer = await getQuery(`
      SELECT tq.*, p.name as patientName, p.triageLevel
      FROM transfer_queue tq
      LEFT JOIN patients p ON tq.patientId = p.id
      WHERE tq.id = ?
    `, [transferId]);
    
    await logAction(
      'transfer_requested',
      'transfer',
      transferId,
      { patientName: patient.name, toDepartment, priority },
      req.headers['x-operator'] || 'system'
    );
    
    broadcastTransferUpdate(transfer, 'created');
    
    res.status(201).json(transfer);
  } catch (error) {
    console.error('创建转运请求失败:', error);
    res.status(500).json({ error: '创建转运请求失败', message: error.message });
  }
});

// 更新转运状态
router.put('/transfers/:id', async (req, res) => {
  try {
    const transferId = req.params.id;
    const { status, priority, queuePosition } = req.body;
    
    const transfer = await getQuery('SELECT * FROM transfer_queue WHERE id = ?', [transferId]);
    
    if (!transfer) {
      return res.status(404).json({ error: '转运请求不存在' });
    }
    
    const now = new Date().toISOString();
    const updates = [];
    const values = [];
    
    if (status) {
      updates.push('status = ?');
      values.push(status);
      
      if (status === 'completed') {
        updates.push('transferredAt = ?');
        values.push(now);
      }
    }
    
    if (priority !== undefined) {
      updates.push('priority = ?');
      values.push(priority);
    }
    
    if (queuePosition !== undefined) {
      updates.push('queuePosition = ?');
      values.push(queuePosition);
    }
    
    if (updates.length > 0) {
      updates.push('assignedAt = COALESCE(assignedAt, ?)');
      values.push(now);
      values.push(transferId);
      
      await runQuery(`UPDATE transfer_queue SET ${updates.join(', ')} WHERE id = ?`, values);
      
      if (status === 'completed') {
        await logAction(
          'transfer_completed',
          'transfer',
          transferId,
          { patientId: transfer.patientId },
          req.headers['x-operator'] || 'system'
        );
      }
    }
    
    const updatedTransfer = await getQuery(`
      SELECT tq.*, p.name as patientName, p.triageLevel
      FROM transfer_queue tq
      LEFT JOIN patients p ON tq.patientId = p.id
      WHERE tq.id = ?
    `, [transferId]);
    
    broadcastTransferUpdate(updatedTransfer, 'updated');
    
    res.json(updatedTransfer);
  } catch (error) {
    console.error('更新转运请求失败:', error);
    res.status(500).json({ error: '更新转运请求失败', message: error.message });
  }
});

// 重新排序转运队列
router.post('/transfers/reorder', async (req, res) => {
  try {
    const { transfers } = req.body;
    
    if (!transfers || !Array.isArray(transfers)) {
      return res.status(400).json({ error: '转运数据格式错误' });
    }
    
    for (let i = 0; i < transfers.length; i++) {
      const transfer = transfers[i];
      await runQuery(
        'UPDATE transfer_queue SET queuePosition = ? WHERE id = ?',
        [i + 1, transfer.id]
      );
    }
    
    broadcastTransferUpdate({ reordered: true }, 'reordered');
    
    res.json({ message: '转运队列已重新排序', count: transfers.length });
  } catch (error) {
    console.error('重新排序转运队列失败:', error);
    res.status(500).json({ error: '重新排序转运队列失败', message: error.message });
  }
});

// ===== 规则检查 =====

router.post('/rules/check', async (req, res) => {
  try {
    const results = await runCheckAndBroadcast();
    res.json(results);
  } catch (error) {
    console.error('规则检查失败:', error);
    res.status(500).json({ error: '规则检查失败', message: error.message });
  }
});

// 检查分诊建议
router.post('/rules/triage-suggestion', async (req, res) => {
  try {
    const { patient } = req.body;
    
    if (!patient) {
      return res.status(400).json({ error: '患者数据不能为空' });
    }
    
    // 临时创建一个患者对象用于检查
    const checkPatient = {
      id: 'temp',
      name: patient.name || '临时患者',
      chiefComplaint: patient.chiefComplaint || '',
      triageLevel: patient.triageLevel || 'green'
    };
    
    const errors = await checkTriageErrors(checkPatient, patient.suggestedLevel);
    
    res.json({
      suggestions: errors,
      currentLevel: patient.triageLevel,
      chiefComplaint: patient.chiefComplaint
    });
  } catch (error) {
    console.error('分诊建议检查失败:', error);
    res.status(500).json({ error: '分诊建议检查失败', message: error.message });
  }
});

// ===== 操作日志 =====

router.get('/logs', async (req, res) => {
  try {
    const { limit, offset, severity, action, startTime, endTime } = req.query;
    
    const options = {
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
      severity,
      action,
      startTime,
      endTime
    };
    
    const logs = await getLogs(options);
    res.json(logs);
  } catch (error) {
    console.error('获取日志失败:', error);
    res.status(500).json({ error: '获取日志失败', message: error.message });
  }
});

router.get('/logs/stats', async (req, res) => {
  try {
    const { startTime, endTime } = req.query;
    const stats = await getLogStats({ startTime, endTime });
    res.json(stats);
  } catch (error) {
    console.error('获取日志统计失败:', error);
    res.status(500).json({ error: '获取日志统计失败', message: error.message });
  }
});

// ===== 导出功能 =====

// 导出 Markdown 复盘报告
router.get('/export/report', async (req, res) => {
  try {
    const report = await generateMarkdownReport();
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="drill-report-${new Date().toISOString().slice(0, 10)}.md"`);
    
    res.send(report.markdown);
  } catch (error) {
    console.error('生成报告失败:', error);
    res.status(500).json({ error: '生成报告失败', message: error.message });
  }
});

// 导出异常事件 CSV
router.get('/export/incidents', async (req, res) => {
  try {
    const csv = await generateCSVIncidents();
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="incidents-${new Date().toISOString().slice(0, 10)}.csv"`);
    
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('导出异常事件失败:', error);
    res.status(500).json({ error: '导出异常事件失败', message: error.message });
  }
});

// 导出患者数据 CSV
router.get('/export/patients', async (req, res) => {
  try {
    const csv = await generateCSVPatients();
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="patients-${new Date().toISOString().slice(0, 10)}.csv"`);
    
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('导出患者数据失败:', error);
    res.status(500).json({ error: '导出患者数据失败', message: error.message });
  }
});

// ===== 示例数据 =====

router.post('/sample-data', async (req, res) => {
  try {
    const result = await createAllSampleData();
    res.json(result);
  } catch (error) {
    console.error('创建示例数据失败:', error);
    res.status(500).json({ error: '创建示例数据失败', message: error.message });
  }
});

router.delete('/sample-data', async (req, res) => {
  try {
    await clearAllData();
    res.json({ message: '所有数据已清除' });
  } catch (error) {
    console.error('清除数据失败:', error);
    res.status(500).json({ error: '清除数据失败', message: error.message });
  }
});

// ===== 系统信息 =====

router.get('/system/info', async (req, res) => {
  try {
    // 获取统计数据
    const patientStats = await getQuery('SELECT COUNT(*) as count FROM patients');
    const waitingPatients = await getQuery("SELECT COUNT(*) as count FROM patients WHERE status = 'waiting'");
    const triagePatients = await getQuery("SELECT COUNT(*) as count FROM patients WHERE status = 'triage'");
    
    const bedStats = await getQuery(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied
      FROM beds
    `);
    
    const transferStats = await getQuery(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress
      FROM transfer_queue
    `);
    
    const logStats = await getLogStats();
    
    res.json({
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      stats: {
        patients: {
          total: patientStats?.count || 0,
          waiting: waitingPatients?.count || 0,
          triage: triagePatients?.count || 0
        },
        beds: {
          total: bedStats?.total || 0,
          available: bedStats?.available || 0,
          occupied: bedStats?.occupied || 0
        },
        transfers: {
          total: transferStats?.total || 0,
          pending: transferStats?.pending || 0,
          in_progress: transferStats?.in_progress || 0
        },
        logs: logStats
      },
      triageLevels: TRIAGE_LEVELS
    });
  } catch (error) {
    console.error('获取系统信息失败:', error);
    res.status(500).json({ error: '获取系统信息失败', message: error.message });
  }
});

module.exports = router;
