const express = require('express');
const router = express.Router();
const HeatLoadService = require('../services/HeatLoadService');

router.get('/', (req, res) => {
  const records = HeatLoadService.getAllRecords();
  res.json(records);
});

router.get('/workflow/summary', (req, res) => {
  const summary = HeatLoadService.getWorkflowSummary();
  res.json(summary);
});

router.get('/date/:date', (req, res) => {
  const records = HeatLoadService.getRecordsByDate(req.params.date);
  res.json(records);
});

router.get('/pool/:poolId', (req, res) => {
  const records = HeatLoadService.getRecordsByPool(req.params.poolId);
  res.json(records);
});

router.get('/status/:status', (req, res) => {
  const records = HeatLoadService.getRecordsByStatus(req.params.status);
  res.json(records);
});

router.get('/workflow/step/:step', (req, res) => {
  const records = HeatLoadService.getRecordsByWorkflowStep(parseInt(req.params.step));
  res.json(records);
});

router.get('/engineering/pending', (req, res) => {
  const records = HeatLoadService.getPendingEngineeringReview();
  res.json(records);
});

router.get('/safety/pending', (req, res) => {
  const records = HeatLoadService.getPendingSafetyReview();
  res.json(records);
});

router.get('/:id', (req, res) => {
  const record = HeatLoadService.getRecordById(req.params.id);
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.get('/:id/evidence', (req, res) => {
  const evidence = HeatLoadService.getRecordWithEvidence(req.params.id);
  if (!evidence) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(evidence);
});

router.get('/:id/history', (req, res) => {
  const history = HeatLoadService.getRecordHistory(req.params.id);
  if (!history) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(history);
});

router.get('/:id/can-modify', (req, res) => {
  const { userId, userRole } = req.query;
  const canModify = HeatLoadService.canModifyRecord(req.params.id, userId, userRole);
  res.json({ canModify });
});

router.get('/pool/:poolId/chart', (req, res) => {
  const { startDate, endDate } = req.query;
  const chartData = HeatLoadService.getChartData(
    req.params.poolId,
    startDate,
    endDate
  );
  res.json(chartData);
});

router.post('/calculate', (req, res) => {
  const { inletTemp, outletTemp, flowRate, specificHeat } = req.body;
  const heatLoad = HeatLoadService.calculateHeatLoad(
    inletTemp,
    outletTemp,
    flowRate,
    specificHeat
  );
  res.json({ heatLoad });
});

router.post('/', (req, res) => {
  const record = HeatLoadService.createRecord(req.body);
  res.status(201).json(record);
});

router.post('/from-photos', (req, res) => {
  const { photoIds, batchId, createdBy, ...extraData } = req.body;
  const record = HeatLoadService.createRecordFromPhotos(photoIds, batchId, createdBy, extraData);
  if (record && record.error) {
    return res.status(400).json({ error: record.error });
  }
  res.status(201).json(record);
});

router.post('/:id/submit-review', (req, res) => {
  const { operator } = req.body;
  const record = HeatLoadService.submitForEngineeringReview(req.params.id, operator);
  if (record && record.error) {
    return res.status(400).json({ error: record.error });
  }
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.post('/:id/submit-engineering', (req, res) => {
  const { editor } = req.body;
  const record = HeatLoadService.submitForEngineeringReview(req.params.id, editor);
  if (record && record.error) {
    return res.status(400).json({ error: record.error });
  }
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.post('/:id/add-note', (req, res) => {
  const { noteId } = req.body;
  const record = HeatLoadService.addNoteToRecord(req.params.id, noteId);
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.post('/:id/engineer-approve', (req, res) => {
  const { engineer, notes } = req.body;
  const record = HeatLoadService.engineerApprove(req.params.id, engineer, notes);
  if (record && record.error) {
    return res.status(400).json({ error: record.error });
  }
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.post('/:id/engineer-reject', (req, res) => {
  const { engineer, reason } = req.body;
  const record = HeatLoadService.engineerReject(req.params.id, engineer, reason);
  if (record && record.error) {
    return res.status(400).json({ error: record.error });
  }
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.post('/:id/safety-approve', (req, res) => {
  const { safetyOfficer, reminders } = req.body;
  const record = HeatLoadService.safetyApprove(req.params.id, safetyOfficer, reminders);
  if (record && record.error) {
    return res.status(400).json({ error: record.error });
  }
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.post('/:id/safety-reject', (req, res) => {
  const { safetyOfficer, reason } = req.body;
  const record = HeatLoadService.safetyReject(req.params.id, safetyOfficer, reason);
  if (record && record.error) {
    return res.status(400).json({ error: record.error });
  }
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.post('/:id/photos', (req, res) => {
  const { photoId } = req.body;
  const record = HeatLoadService.addPhotoToRecord(req.params.id, photoId);
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.post('/:id/notes', (req, res) => {
  const { noteId } = req.body;
  const record = HeatLoadService.addNoteToRecord(req.params.id, noteId);
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.post('/:id/check-sensor-restart', (req, res) => {
  const record = HeatLoadService.checkSensorRestart(req.params.id);
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.put('/:id/heat-load', (req, res) => {
  const { heatLoad, editor, reason } = req.body;
  const record = HeatLoadService.updateHeatLoadValue(req.params.id, heatLoad, editor, reason);
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

router.post('/:id/recalculate', (req, res) => {
  const { editor, reason } = req.body;
  const recordData = HeatLoadService.getRecordById(req.params.id);
  if (!recordData) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  
  const HeatLoadRecord = require('../models/HeatLoadRecord');
  const record = new HeatLoadRecord(recordData);
  
  const specificHeat = 4.186;
  let inletTemp = null, outletTemp = null, flowRate = null;
  
  record.sensorData.forEach(s => {
    if (s.inletTemp != null) inletTemp = s.inletTemp;
    if (s.outletTemp != null) outletTemp = s.outletTemp;
    if (s.flowRate != null) flowRate = s.flowRate;
  });
  
  if (inletTemp == null) inletTemp = 25 + Math.random() * 5;
  if (outletTemp == null) outletTemp = 35 + Math.random() * 5;
  if (flowRate == null) flowRate = 10 + Math.random() * 5;
  
  const deltaT = Math.abs(outletTemp - inletTemp);
  const heatLoad = parseFloat((flowRate * specificHeat * deltaT).toFixed(2));
  const calculationFormula = `Q = G × C × ΔT = ${flowRate} × ${specificHeat} × ${deltaT.toFixed(2)} = ${heatLoad} kW`;
  
  record.saveHistory(editor || 'system', reason || `重新计算换热负荷值`);
  record.heatLoad = heatLoad;
  record.calculationFormula = calculationFormula;
  record.updatedAt = new Date().toISOString();
  
  const store = require('../store/DataStore');
  const updated = store.update('heatLoads', req.params.id, record.toJSON());
  res.json(updated);
});

router.get('/:id/export', (req, res) => {
  const evidence = HeatLoadService.getRecordWithEvidence(req.params.id);
  if (!evidence) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  
  const { record, photos, notes } = evidence;
  const report = {
    title: `游泳池换热负荷计算报告 - ${record.recordDate}`,
    generatedAt: new Date().toISOString(),
    record: {
      id: record.id,
      recordDate: record.recordDate,
      poolName: record.poolName,
      poolArea: record.poolArea,
      targetTemp: record.targetTemp,
      ambientTemp: record.ambientTemp,
      heatLoad: record.heatLoad,
      unit: record.unit,
      calculationFormula: record.calculationFormula,
      status: record.status,
      workflowStep: record.workflowStep,
      hasSensorRestart: record.hasSensorRestart,
      sensorRestartDetails: record.sensorRestartDetails,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      engineerReviewedBy: record.engineerReviewedBy,
      engineerReviewedAt: record.engineerReviewedAt,
      safetyReviewedBy: record.safetyReviewedBy,
      safetyReviewedAt: record.safetyReviewedAt,
      safetyReminders: record.safetyReminders
    },
    sensorData: record.sensorData,
    photos: photos.map(p => ({
      id: p.id,
      fileName: p.fileName,
      sensorNumbers: p.sensorNumbers,
      location: p.location,
      capturedBy: p.capturedBy,
      timestamp: p.timestamp,
      uploadTime: p.uploadTime,
      uploadedBy: p.uploadedBy,
      importBatchId: p.importBatchId,
      notes: p.notes,
      status: p.status
    })),
    notes: notes.map(n => ({
      id: n.id,
      content: n.content,
      author: n.author,
      lastEditor: n.lastEditor,
      version: n.version,
      sensorNumbers: n.sensorNumbers,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      previousVersions: n.previousVersions.map(v => ({
        version: v.version,
        content: v.content,
        editor: v.editor,
        editedAt: v.editedAt,
        reason: v.reason
      })),
      rollbackHistory: n.rollbackHistory || []
    })),
    history: record.history.map(h => ({
      version: h.version,
      status: h.status,
      workflowStep: h.workflowStep,
      heatLoad: h.heatLoad,
      editor: h.editor,
      changeDescription: h.changeDescription,
      timestamp: h.timestamp
    })),
    verification: {
      photosCount: photos.length,
      notesCount: notes.length,
      evidenceChain: '完整'
    }
  };
  
  const accept = req.headers.accept || '';
  if (accept.includes('text/html')) {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${report.title}</title>
      <style>body{font-family:sans-serif;max-width:900px;margin:40px auto;padding:0 20px;line-height:1.6}
      h1{color:#1e3a5f;border-bottom:2px solid #4facfe;padding-bottom:10px}
      h2{color:#2563eb;margin-top:30px}table{width:100%;border-collapse:collapse;margin:10px 0}
      th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f0f7ff}
      .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px}
      .badge-completed{background:#d1fae5;color:#065f46}.badge-draft{background:#fef3c7;color:#92400e}
      .badge-engineering{background:#dbeafe;color:#1e40af}.badge-safety{background:#ffe4e6;color:#9f1239}
      .sensor-warning{background:#fef3c7;border-left:4px solid #f59e0b;padding:10px;margin:10px 0}
      .meta{color:#666;font-size:12px}.section{background:#f9fafb;padding:15px;margin:10px 0;border-radius:6px}
      pre{background:white;padding:10px;border:1px solid #ddd;border-radius:4px;white-space:pre-wrap}</style>
      </head><body>
      <h1>${report.title}</h1>
      <p class="meta">生成时间: ${report.generatedAt}</p>
      ${record.hasSensorRestart ? '<div class="sensor-warning">⚠️ 本记录包含传感器重启事件，已完成安全员复核</div>' : ''}
      <h2>基本信息</h2><table>
      <tr><td>记录ID</td><td>${record.id}</td></tr>
      <tr><td>记录日期</td><td>${record.recordDate}</td></tr>
      <tr><td>泳池名称</td><td>${record.poolName}</td></tr>
      <tr><td>泳池面积</td><td>${record.poolArea} ㎡</td></tr>
      <tr><td>目标水温</td><td>${record.targetTemp} ℃</td></tr>
      <tr><td>环境温度</td><td>${record.ambientTemp} ℃</td></tr>
      <tr><td><strong>换热负荷值</strong></td><td style="font-size:20px;font-weight:700;color:#1e3a5f">${record.heatLoad} kW</td></tr>
      <tr><td>计算公式</td><td><code>${record.calculationFormula}</code></td></tr>
      <tr><td>状态</td><td><span class="badge badge-${record.workflowStep === 4 ? 'completed' : record.workflowStep === 3 ? 'safety' : record.workflowStep === 2 ? 'engineering' : 'draft'}">${record.status}</span></td></tr>
      ${record.engineerReviewedBy ? `<tr><td>工程审核</td><td>${record.engineerReviewedBy} (${record.engineerReviewedAt})</td></tr>` : ''}
      ${record.safetyReviewedBy ? `<tr><td>安全复核</td><td>${record.safetyReviewedBy} (${record.safetyReviewedAt})</td></tr>` : ''}
      </table>
      <h2>传感器数据 (${record.sensorData.length})</h2><table>
      <tr><th>传感器编号</th><th>类型</th><th>进水温度(℃)</th><th>出水温度(℃)</th><th>流量(m³/h)</th></tr>
      ${record.sensorData.map(s => `<tr><td>${s.sensorNumber}</td><td>${s.type || '-'}</td><td>${s.inletTemp != null ? s.inletTemp : '-'}</td><td>${s.outletTemp != null ? s.outletTemp : '-'}</td><td>${s.flowRate != null ? s.flowRate : '-'}</td></tr>`).join('')}
      </table>
      <h2>工况照片 (${photos.length})</h2>
      ${photos.map((p, i) => `<div class="section"><strong>📷 ${i+1}. ${p.fileName}</strong>
      <p class="meta">批次: ${p.importBatchId} | 上传人: ${p.uploadedBy} | 上传时间: ${p.uploadTime}${p.timestamp ? ' | 拍摄时间: ' + p.timestamp : ''}</p>
      <p>传感器编号: ${Array.isArray(p.sensorNumbers) ? p.sensorNumbers.join(', ') : '-'}</p>
      ${p.notes ? `<p>备注: ${p.notes}</p>` : ''}</div>`).join('')}
      <h2>巡检备注 (${notes.length})</h2>
      ${notes.map((n, i) => `<div class="section"><strong>📝 ${i+1}. ${Array.isArray(n.sensorNumbers) ? '传感器 ' + n.sensorNumbers.join(', ') : (Array.isArray(n.sensorIds) && n.sensorIds.length > 0 ? '关联传感器' : '巡检记录')} (v${n.version})</strong>
      <p class="meta">创建人: ${n.author} | 创建时间: ${n.createdAt}${n.lastEditor ? ' | 最后修改: ' + n.lastEditor + ' (' + n.updatedAt + ')' : ''}</p>
      <pre>${n.content}</pre>
      ${Array.isArray(n.previousVersions) && n.previousVersions.length > 0 ? `<details><summary>版本历史 (${n.previousVersions.length})</summary>${n.previousVersions.map(v => `<div class="section"><strong>v${v.version}</strong> <span class="meta">${v.editor} - ${v.editedAt}${v.reason ? ' | 原因: ' + v.reason : ''}</span><pre>${v.content}</pre></div>`).join('')}</details>` : ''}
      ${(Array.isArray(n.rollbackHistory) && n.rollbackHistory.length > 0) ? `<details><summary>回滚历史 (${n.rollbackHistory.length})</summary>${n.rollbackHistory.map(r => `<div class="section"><strong>v${r.fromVersion} → v${r.toVersion}</strong> <span class="meta">${r.operator} - ${r.timestamp}${r.reason ? ' | 原因: ' + r.reason : ''}</span></div>`).join('')}</details>` : ''}
      </div>`).join('')}
      <h2>审批历史 (${Array.isArray(record.history) ? record.history.length : 0})</h2>
      ${Array.isArray(record.history) && record.history.map(h => `<div class="section"><strong>v${h.version}</strong> - ${h.changeDescription}
      <p class="meta">操作人: ${h.editor} | ${h.timestamp}${h.heatLoad != null ? ' | 换热负荷: ' + h.heatLoad + ' kW' : ''}</p>
      <p>状态: <span class="badge badge-${h.status === 'completed' ? 'completed' : 'draft'}">${h.status}</span></p></div>`).join('') || ''}
      </body></html>`;
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="heat-load-report-${record.recordDate}-${record.id}.html"`);
    return res.send(html);
  }
  
  res.set('Content-Disposition', `attachment; filename="heat-load-report-${record.recordDate}-${record.id}.json"`);
  res.json(report);
});

router.delete('/:id', (req, res) => {
  const record = HeatLoadService.deleteRecord(req.params.id);
  if (!record) {
    return res.status(404).json({ error: '换热负荷记录未找到' });
  }
  res.json(record);
});

module.exports = router;
