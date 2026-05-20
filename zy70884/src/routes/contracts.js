const express = require('express');
const router = express.Router();

const contractService = require('../services/contractService');
const exportService = require('../services/exportService');
const { getLogsByContractId } = require('../services/auditService');

router.get('/', async (req, res) => {
  try {
    const { seal_type, authorizer, express_no } = req.query;
    const contracts = await contractService.searchContracts({
      seal_type,
      authorizer,
      express_no
    });
    res.json({ success: true, data: contracts, count: contracts.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/trace', async (req, res) => {
  try {
    const { express_no } = req.query;
    if (!express_no) {
      return res.status(400).json({ success: false, error: '请提供快递单号' });
    }
    const trace = await contractService.getContractTraceByExpressNo(express_no);
    if (!trace) {
      return res.status(404).json({ success: false, error: '未找到该快递单号对应的合同' });
    }
    res.json({ success: true, data: trace });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const contract = await contractService.getContractById(req.params.id);
    if (!contract) {
      return res.status(404).json({ success: false, error: '合同不存在' });
    }
    const logs = await getLogsByContractId(req.params.id);
    res.json({ success: true, data: { contract, auditLogs: logs } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id/process', async (req, res) => {
  try {
    const handler = req.headers['x-handler'] || 'system';
    const { remark } = req.body;
    const result = await contractService.markAsProcessed(req.params.id, handler, remark);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/return', async (req, res) => {
  try {
    const handler = req.headers['x-handler'] || 'system';
    const { reason } = req.body;
    const result = await contractService.returnForModification(req.params.id, handler, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/unauthorized-seal', async (req, res) => {
  try {
    const handler = req.headers['x-handler'] || 'system';
    const { reason } = req.body;
    const result = await contractService.recordUnauthorizedSeal(req.params.id, handler, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/attachment-supplement', async (req, res) => {
  try {
    const handler = req.headers['x-handler'] || 'system';
    const { reason } = req.body;
    const result = await contractService.recordAttachmentSupplement(req.params.id, handler, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:id/withdraw-resubmit', async (req, res) => {
  try {
    const handler = req.headers['x-handler'] || 'system';
    const { reason } = req.body;
    const result = await contractService.recordWithdrawResubmit(req.params.id, handler, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export/detail', async (req, res) => {
  try {
    const handler = req.headers['x-handler'] || 'system';
    const { seal_type, authorizer, express_no } = req.query;
    const result = await exportService.exportDetailWithTrace({
      seal_type,
      authorizer,
      express_no
    }, handler);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.csv);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
