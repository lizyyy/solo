const express = require('express');
const router = express.Router();
const invoiceService = require('../services/invoiceService');
const { Parser } = require('json2csv');

router.post('/', (req, res, next) => {
  try {
    const invoice = invoiceService.createInvoice(req.body);
    res.json({
      success: true,
      data: invoice.toJSON()
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const invoice = invoiceService.getInvoice(req.params.id);
    if (!invoice) {
      return res.status(404).json({ success: false, error: '发票记录不存在' });
    }
    res.json({
      success: true,
      data: invoice.toJSON()
    });
  } catch (error) {
    next(error);
  }
});

router.get('/request/:requestId', (req, res, next) => {
  try {
    const invoice = invoiceService.getInvoiceByRequestId(req.params.requestId);
    if (!invoice) {
      return res.status(404).json({ success: false, error: '开票请求不存在' });
    }
    res.json({
      success: true,
      data: invoice.toJSON()
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', (req, res, next) => {
  try {
    const invoices = invoiceService.queryInvoices(req.query);
    res.json({
      success: true,
      data: invoices.map(inv => inv.toJSON()),
      total: invoices.length
    });
  } catch (error) {
    next(error);
  }
});

router.post('/callback/:requestId', (req, res, next) => {
  try {
    const invoice = invoiceService.processCallback(req.params.requestId, req.body);
    res.json({
      success: true,
      data: invoice.toJSON()
    });
  } catch (error) {
    next(error);
  }
});

router.post('/check-timeout', (req, res, next) => {
  try {
    const timeoutInvoices = invoiceService.checkTimeoutInvoices();
    res.json({
      success: true,
      data: timeoutInvoices.map(inv => inv.toJSON()),
      count: timeoutInvoices.length
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/compensate', (req, res, next) => {
  try {
    const invoice = invoiceService.compensateStatus(req.params.id, req.body);
    res.json({
      success: true,
      data: invoice.toJSON()
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/review', (req, res, next) => {
  try {
    const invoice = invoiceService.reviewInvoice(req.params.id, req.body);
    res.json({
      success: true,
      data: invoice.toJSON()
    });
  } catch (error) {
    next(error);
  }
});

router.post('/red-flush', (req, res, next) => {
  try {
    const record = invoiceService.createRedFlush(req.body);
    res.json({
      success: true,
      data: record.toJSON()
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/download', (req, res, next) => {
  try {
    const downloadInfo = invoiceService.getInvoiceDownloadUrl(req.params.id);
    res.json({
      success: true,
      data: downloadInfo
    });
  } catch (error) {
    next(error);
  }
});

router.get('/export/csv', (req, res, next) => {
  try {
    const data = invoiceService.exportInvoices(req.query);
    const fields = [
      'requestId', 'platform', 'businessNo', 'buyerName',
      'amount', 'callbackStatus', 'reviewReason',
      'invoiceCode', 'invoiceNo', 'createdAt', 'reviewTime'
    ];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(data);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=invoices_${Date.now()}.csv`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    next(error);
  }
});

router.post('/batch/import', (req, res, next) => {
  try {
    const results = invoiceService.batchImport(req.body.invoices || []);
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
