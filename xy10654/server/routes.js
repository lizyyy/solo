const express = require('express');
const router = express.Router();
const RecallService = require('./services/recallService');
const ExcelJS = require('exceljs');

router.post('/batches', async (req, res) => {
  try {
    const result = await RecallService.createBatch({ ...req.body, operator: req.body.operator || 'system' });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/batches', async (req, res) => {
  try {
    const result = await RecallService.getBatches();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/department-usages', async (req, res) => {
  try {
    const result = await RecallService.createDepartmentUsage({ ...req.body, operator: req.body.operator || 'system' });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/recalls', async (req, res) => {
  try {
    const result = await RecallService.createRecallNotice({ ...req.body, initiator: req.body.initiator || 'system' });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/recalls', async (req, res) => {
  try {
    const result = await RecallService.getRecalls();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/recalls/:id/review', async (req, res) => {
  try {
    const result = await RecallService.reviewRecall(req.params.id, { ...req.body, reviewed_by: req.body.reviewed_by || 'system' });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/recalls/:id/timeline', async (req, res) => {
  try {
    const result = await RecallService.getRecallTimeline(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/recalls/:id/risks', async (req, res) => {
  try {
    const result = await RecallService.getRiskDepartments(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/recalls/:id/acceptances', async (req, res) => {
  try {
    const result = await RecallService.getReturnAcceptances(req.params.id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/return-acceptances/:id', async (req, res) => {
  try {
    const result = await RecallService.updateReturnAcceptance(req.params.id, { ...req.body, operator: req.body.operator || 'system' });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/operation-logs', async (req, res) => {
  try {
    const result = await RecallService.getOperationLogs(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const report = await RecallService.exportReport(req.query);
    
    const workbook = new ExcelJS.Workbook();
    const summarySheet = workbook.addWorksheet('汇总');
    const returnsSheet = workbook.addWorksheet('退回验收');
    const modificationsSheet = workbook.addWorksheet('修改记录');
    const logsSheet = workbook.addWorksheet('操作日志');
    const risksSheet = workbook.addWorksheet('风险科室');
    
    summarySheet.columns = [
      { header: '统计项', key: 'item', width: 30 },
      { header: '数值', key: 'value', width: 20 }
    ];
    summarySheet.addRow({ item: '召回总数', value: report.summary.totalRecalls });
    summarySheet.addRow({ item: '退回记录总数', value: report.summary.totalReturns });
    summarySheet.addRow({ item: '修改记录总数', value: report.summary.totalModifications });
    summarySheet.addRow({ item: '高风险科室数', value: report.summary.highRiskDepartments });
    
    returnsSheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: '召回ID', key: 'recall_id', width: 10 },
      { header: '科室', key: 'department_name', width: 15 },
      { header: '应退回', key: 'expected_quantity', width: 10 },
      { header: '已退回', key: 'returned_quantity', width: 10 },
      { header: '状态', key: 'status', width: 10 },
      { header: '验收人', key: 'accepted_by', width: 12 },
      { header: '修改人', key: 'modifier', width: 12 },
      { header: '修改原因', key: 'modifyReason', width: 30 },
      { header: '影响记录数', key: 'affectedRecords', width: 12 }
    ];
    report.returnAcceptances.forEach(row => returnsSheet.addRow(row));
    
    modificationsSheet.columns = [
      { header: '表名', key: 'table_name', width: 20 },
      { header: '记录ID', key: 'record_id', width: 10 },
      { header: '字段名', key: 'field_name', width: 20 },
      { header: '旧值', key: 'old_value', width: 20 },
      { header: '新值', key: 'new_value', width: 20 },
      { header: '修改人', key: 'modified_by', width: 12 },
      { header: '修改原因', key: 'modified_reason', width: 30 },
      { header: '修改时间', key: 'created_at', width: 20 }
    ];
    report.modificationHistory.forEach(row => modificationsSheet.addRow(row));
    
    logsSheet.columns = [
      { header: '模块', key: 'module', width: 20 },
      { header: '操作', key: 'operation', width: 15 },
      { header: '操作人', key: 'operator', width: 12 },
      { header: '记录ID', key: 'record_id', width: 10 },
      { header: '变更原因', key: 'change_reason', width: 30 },
      { header: '时间', key: 'created_at', width: 20 }
    ];
    report.operationLogs.forEach(row => logsSheet.addRow(row));
    
    risksSheet.columns = [
      { header: '召回ID', key: 'recall_id', width: 10 },
      { header: '科室', key: 'department_name', width: 15 },
      { header: '风险等级', key: 'risk_level', width: 12 },
      { header: '影响患者数', key: 'affected_patients', width: 15 },
      { header: '使用数量', key: 'usage_quantity', width: 12 }
    ];
    report.riskDepartments.forEach(row => risksSheet.addRow(row));
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=recall-report.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/export/json', async (req, res) => {
  try {
    const report = await RecallService.exportReport(req.query);
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
