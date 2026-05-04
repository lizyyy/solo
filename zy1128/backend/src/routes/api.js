import express from 'express';
import multer from 'multer';
import productModel from '../models/productModel.js';
import accountModel from '../models/accountModel.js';
import holderModel from '../models/holderModel.js';
import subscriptionModel from '../models/subscriptionModel.js';
import expectedPayoutModel from '../models/expectedPayoutModel.js';
import transactionModel from '../models/transactionModel.js';
import reconciliationModel from '../models/reconciliationModel.js';
import allocationModel from '../models/allocationModel.js';

import {
  importProducts,
  importTransactions,
  importSubscriptions,
  importPayoutRules
} from '../services/importService.js';

import {
  generateExpectedPayouts,
  calculatePayoutDetails
} from '../services/calculationService.js';

import {
  runAutoMatching,
  manualMatch,
  unmatch,
  addManualAdjustment,
  getMatchingStats
} from '../services/matchingService.js';

import {
  generateAllocations,
  getHolderAllocations,
  getReconciliationAllocations,
  validateShareRatiosForProduct
} from '../services/allocationService.js';

import {
  exportToCSV,
  exportToHTML,
  exportToMarkdown,
  generateReconciliationReport,
  generateHolderAllocationReport
} from '../services/exportService.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/products', (req, res) => {
  const products = productModel.findAll();
  res.json({ success: true, data: products });
});

router.get('/products/:id', (req, res) => {
  const product = productModel.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: '产品不存在' });
  }
  res.json({ success: true, data: product });
});

router.post('/products', (req, res) => {
  try {
    const product = productModel.create(req.body);
    res.json({ success: true, data: product });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get('/accounts', (req, res) => {
  const accounts = accountModel.findAll();
  res.json({ success: true, data: accounts });
});

router.get('/accounts/:id', (req, res) => {
  const account = accountModel.findById(req.params.id);
  if (!account) {
    return res.status(404).json({ success: false, error: '账户不存在' });
  }
  res.json({ success: true, data: account });
});

router.get('/holders', (req, res) => {
  const holders = holderModel.findAll();
  res.json({ success: true, data: holders });
});

router.get('/holders/:id', (req, res) => {
  const holder = holderModel.findById(req.params.id);
  if (!holder) {
    return res.status(404).json({ success: false, error: '持有人不存在' });
  }
  res.json({ success: true, data: holder });
});

router.get('/subscriptions', (req, res) => {
  const subscriptions = subscriptionModel.findAll();
  res.json({ success: true, data: subscriptions });
});

router.get('/subscriptions/:id', (req, res) => {
  const subscription = subscriptionModel.findById(req.params.id);
  if (!subscription) {
    return res.status(404).json({ success: false, error: '认购记录不存在' });
  }
  res.json({ success: true, data: subscription });
});

router.get('/expected-payouts', (req, res) => {
  const filters = {};
  if (req.query.account_id) filters.account_id = req.query.account_id;
  if (req.query.product_id) filters.product_id = req.query.product_id;
  if (req.query.holder_id) filters.holder_id = req.query.holder_id;
  if (req.query.status) filters.status = req.query.status;
  if (req.query.start_date) filters.start_date = req.query.start_date;
  if (req.query.end_date) filters.end_date = req.query.end_date;

  const payouts = expectedPayoutModel.findAll(filters);
  res.json({ success: true, data: payouts });
});

router.get('/expected-payouts/:id', (req, res) => {
  const payout = expectedPayoutModel.findById(req.params.id);
  if (!payout) {
    return res.status(404).json({ success: false, error: '应到账记录不存在' });
  }
  res.json({ success: true, data: payout });
});

router.get('/transactions', (req, res) => {
  const filters = {};
  if (req.query.account_id) filters.account_id = req.query.account_id;
  if (req.query.matched !== undefined) filters.matched = req.query.matched === 'true';
  if (req.query.start_date) filters.start_date = req.query.start_date;
  if (req.query.end_date) filters.end_date = req.query.end_date;

  const transactions = transactionModel.findAll(filters);
  res.json({ success: true, data: transactions });
});

router.get('/transactions/unmatched', (req, res) => {
  const accountId = req.query.account_id || null;
  const transactions = transactionModel.findUnmatched(accountId);
  res.json({ success: true, data: transactions });
});

router.get('/reconciliations', (req, res) => {
  const filters = {};
  if (req.query.account_id) filters.account_id = req.query.account_id;
  if (req.query.product_id) filters.product_id = req.query.product_id;
  if (req.query.holder_id) filters.holder_id = req.query.holder_id;
  if (req.query.difference_type) filters.difference_type = req.query.difference_type;
  if (req.query.start_date) filters.start_date = req.query.start_date;
  if (req.query.end_date) filters.end_date = req.query.end_date;

  const reconciliations = reconciliationModel.findAll(filters);
  res.json({ success: true, data: reconciliations });
});

router.get('/reconciliations/:id', (req, res) => {
  const reconciliation = reconciliationModel.findById(req.params.id);
  if (!reconciliation) {
    return res.status(404).json({ success: false, error: '核对记录不存在' });
  }
  res.json({ success: true, data: reconciliation });
});

router.get('/allocations', (req, res) => {
  const filters = {};
  if (req.query.holder_id) filters.holder_id = req.query.holder_id;
  if (req.query.start_date) filters.start_date = req.query.start_date;
  if (req.query.end_date) filters.end_date = req.query.end_date;

  const allocations = allocationModel.findAll(filters);
  res.json({ success: true, data: allocations });
});

router.post('/import/products', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: '请上传文件' });
  }

  try {
    const csvContent = req.file.buffer.toString('utf-8');
    const result = importProducts(csvContent);
    res.json(result);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/import/transactions', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: '请上传文件' });
  }

  try {
    const csvContent = req.file.buffer.toString('utf-8');
    const result = importTransactions(csvContent);
    res.json(result);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/import/subscriptions', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: '请上传文件' });
  }

  try {
    const csvContent = req.file.buffer.toString('utf-8');
    const result = importSubscriptions(csvContent);
    res.json(result);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/import/payout-rules', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: '请上传文件' });
  }

  try {
    const jsonContent = req.file.buffer.toString('utf-8');
    const result = importPayoutRules(jsonContent);
    res.json(result);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.post('/calculate/expected-payouts', (req, res) => {
  const subscriptionId = req.body.subscription_id || null;
  const result = generateExpectedPayouts(subscriptionId);
  res.json(result);
});

router.get('/calculate/payout-details/:id', (req, res) => {
  const result = calculatePayoutDetails(req.params.id);
  if (!result.success) {
    return res.status(404).json(result);
  }
  res.json(result);
});

router.post('/matching/auto', (req, res) => {
  const filters = {};
  if (req.body.account_id) filters.account_id = req.body.account_id;
  
  const result = runAutoMatching(filters);
  res.json(result);
});

router.post('/matching/manual', (req, res) => {
  const { expected_payout_id, transaction_id } = req.body;
  
  if (!expected_payout_id || !transaction_id) {
    return res.status(400).json({ 
      success: false, 
      error: '请提供 expected_payout_id 和 transaction_id' 
    });
  }

  const result = manualMatch(expected_payout_id, transaction_id);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/matching/unmatch/:id', (req, res) => {
  const result = unmatch(req.params.id);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.post('/matching/adjustment/:id', (req, res) => {
  const { adjustment_note } = req.body;
  const result = addManualAdjustment(req.params.id, adjustment_note);
  if (!result.success) {
    return res.status(400).json(result);
  }
  res.json(result);
});

router.get('/matching/stats', (req, res) => {
  const stats = getMatchingStats();
  res.json({ success: true, data: stats });
});

router.post('/allocations/generate', (req, res) => {
  const reconciliationId = req.body.reconciliation_id || null;
  const result = generateAllocations(reconciliationId);
  res.json(result);
});

router.get('/allocations/holder/:id', (req, res) => {
  const filters = {};
  if (req.query.start_date) filters.start_date = req.query.start_date;
  if (req.query.end_date) filters.end_date = req.query.end_date;

  const result = getHolderAllocations(req.params.id, filters);
  res.json({ success: true, data: result });
});

router.get('/allocations/reconciliation/:id', (req, res) => {
  const result = getReconciliationAllocations(req.params.id);
  res.json({ success: true, data: result });
});

router.get('/allocations/validate/:product_id', (req, res) => {
  const result = validateShareRatiosForProduct(req.params.product_id);
  res.json({ success: true, data: result });
});

router.get('/export/reconciliations', (req, res) => {
  const filters = {};
  if (req.query.account_id) filters.account_id = req.query.account_id;
  if (req.query.holder_id) filters.holder_id = req.query.holder_id;
  if (req.query.start_date) filters.start_date = req.query.start_date;
  if (req.query.end_date) filters.end_date = req.query.end_date;

  const format = req.query.format || 'json';
  const report = generateReconciliationReport(filters);

  if (format === 'csv') {
    const csv = exportToCSV(report.data, report.columns);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reconciliation-report.csv"`);
    res.send('\uFEFF' + csv);
  } else if (format === 'html') {
    const html = exportToHTML(report.data, report.columns, report.title);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } else if (format === 'markdown') {
    const md = exportToMarkdown(report.data, report.columns, report.title);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reconciliation-report.md"`);
    res.send(md);
  } else {
    res.json({ success: true, data: report });
  }
});

router.get('/export/holder/:id', (req, res) => {
  const filters = {};
  if (req.query.start_date) filters.start_date = req.query.start_date;
  if (req.query.end_date) filters.end_date = req.query.end_date;

  const format = req.query.format || 'json';
  const report = generateHolderAllocationReport(req.params.id, filters);

  if (report.error) {
    return res.status(404).json({ success: false, error: report.error });
  }

  if (format === 'csv') {
    const csv = exportToCSV(report.data, report.columns);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="holder-${req.params.id}-allocations.csv"`);
    res.send('\uFEFF' + csv);
  } else if (format === 'html') {
    const html = exportToHTML(report.data, report.columns, report.title);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } else if (format === 'markdown') {
    const md = exportToMarkdown(report.data, report.columns, report.title);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="holder-${req.params.id}-allocations.md"`);
    res.send(md);
  } else {
    res.json({ success: true, data: report });
  }
});

router.get('/stats', (req, res) => {
  const stats = {
    products: productModel.count(),
    accounts: accountModel.count(),
    holders: holderModel.count(),
    subscriptions: subscriptionModel.count(),
    expectedPayouts: expectedPayoutModel.count(),
    transactions: transactionModel.count(),
    unmatchedTransactions: transactionModel.count({ matched: false }),
    reconciliations: reconciliationModel.count()
  };

  res.json({ success: true, data: stats });
});

export default router;
