const express = require('express');
const router = express.Router();
const reportService = require('../services/reportService');
const batchService = require('../services/batchService');

router.get('/batches/:batchId', async (req, res) => {
  try {
    const report = await reportService.generateBatchReport(req.params.batchId);
    if (!report.batchInfo) {
      return res.status(404).json({ error: '批次不存在' });
    }
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/batches/:batchId/download', async (req, res) => {
  try {
    const csv = await reportService.generateCSVReport(req.params.batchId);
    const batchId = req.params.batchId;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="maintenance_report_${batchId}.csv"`);
    res.send('\uFEFF' + csv);
    
    await batchService.updateBatchStatus(batchId, 'exported');
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/batches/:batchId/audit', async (req, res) => {
  try {
    const auditLogs = await reportService.generateAuditReport(req.params.batchId);
    res.json(auditLogs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/batches/:batchId/audit/download', async (req, res) => {
  try {
    const { Parser } = require('json2csv');
    const auditLogs = await reportService.generateAuditReport(req.params.batchId);
    
    const fields = [
      { label: '日志ID', value: 'id' },
      { label: '记录ID', value: 'record_id' },
      { label: '宿舍楼', value: 'dormitory' },
      { label: '房间号', value: 'room_number' },
      { label: '学生姓名', value: 'student_name' },
      { label: '修改人', value: 'modified_by' },
      { label: '修改时间', value: 'modified_at' },
      { label: '修改字段', value: 'field_name' },
      { label: '原值', value: 'old_value' },
      { label: '新值', value: 'new_value' },
      { label: '修改原因', value: 'change_reason' }
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(auditLogs);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit_report_${req.params.batchId}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
