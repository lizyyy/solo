const express = require('express');
const router = express.Router();
const services = require('./services');
const { Parser } = require('json2csv');
const { v4: uuidv4 } = require('uuid');

const statusMap = {
  pending_sign: '待签署',
  resigning: '重签中',
  effective: '已生效',
  cancelled: '作废',
  rejected: '驳回',
  pending_manual: '待人工处理'
};

router.post('/contracts', async (req, res) => {
  try {
    const { contract_no, contract_name, created_by } = req.body;
    const result = await services.createContract(contract_no, contract_name, created_by);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/signatories', async (req, res) => {
  try {
    const { contract_id, signatory_name, signatory_type } = req.body;
    const result = await services.createSignatory(contract_id, signatory_name, signatory_type);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/records', async (req, res) => {
  try {
    const { contract_id, signatory_id, signature_no, resign_reason, created_by } = req.body;
    const result = await services.createSignatureRecord(contract_id, signatory_id, signature_no, resign_reason, created_by);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/records/:id/modify', async (req, res) => {
  try {
    const { id } = req.params;
    const { signature_no, resign_reason, operator } = req.body;
    const result = await services.modifySignatureRecord(id, signature_no, resign_reason, operator);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/records/:id/audit', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, operator, remarks } = req.body;
    const result = await services.auditSignatureRecord(id, approved, operator, remarks);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.put('/records/:id/withdraw', async (req, res) => {
  try {
    const { id } = req.params;
    const { operator, remarks } = req.body;
    const result = await services.withdrawSignatureRecord(id, operator, remarks);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/records', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      contract_no: req.query.contract_no,
      signatory_name: req.query.signatory_name
    };
    const result = await services.listSignatureRecords(filters);
    const formattedResult = result.map(item => ({
      ...item,
      status_name: statusMap[item.status] || item.status
    }));
    res.json({ success: true, data: formattedResult });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await services.getSignatureRecord(id);
    if (result) {
      result.status_name = statusMap[result.status] || result.status;
      res.json({ success: true, data: result });
    } else {
      res.status(404).json({ success: false, error: '记录不存在' });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/records/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await services.getSignatureHistory(id);
    const formattedResult = result.map(item => ({
      ...item,
      status_name: statusMap[item.status] || item.status
    }));
    res.json({ success: true, data: formattedResult });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/records/:id/check-version', async (req, res) => {
  try {
    const { id } = req.params;
    const { download_version } = req.body;
    const result = await services.checkVersionConflict(id, download_version);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/pending-manual', async (req, res) => {
  try {
    const result = await services.getPendingManualProcess();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/import', async (req, res) => {
  try {
    const { records } = req.body;
    const batchNo = `BATCH-${Date.now()}`;
    const result = await services.importRecords(records, batchNo);
    res.json({ success: true, batch_no: batchNo, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const data = await services.getAllDataForExport();
    const formattedData = data.map(item => ({
      合同编号: item.contract_no,
      合同名称: item.contract_name,
      签署方: item.signatory_name,
      签署方类型: item.signatory_type,
      签章编号: item.signature_no || '',
      重签原因: item.resign_reason || '',
      状态: statusMap[item.status] || item.status,
      版本: item.version,
      创建时间: item.created_at,
      更新时间: item.updated_at
    }));

    if (req.query.format === 'json') {
      res.json({ success: true, data: formattedData });
    } else {
      const parser = new Parser();
      const csv = parser.parse(formattedData);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="contract-signature-export.csv"');
      res.send('\uFEFF' + csv);
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/export/history/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await services.getSignatureHistory(id);
    const formattedData = data.map(item => ({
      合同编号: item.contract_no,
      签署方: item.signatory_name,
      签章编号: item.signature_no || '',
      重签原因: item.resign_reason || '',
      状态: statusMap[item.status] || item.status,
      版本: item.version,
      操作: item.operation,
      操作人: item.operator || '',
      操作时间: item.operation_time,
      备注: item.remarks || ''
    }));

    const parser = new Parser();
    const csv = parser.parse(formattedData);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="history-${id}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
