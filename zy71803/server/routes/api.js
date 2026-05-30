const express = require('express');
const router = express.Router();
const FundLevelService = require('../services/FundLevelService');
const Account = require('../models/Account');
const { BusinessError } = require('../utils/BusinessError');

const service = new FundLevelService();

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '多账户资金水位系统运行正常' });
});

router.get('/accounts', asyncHandler(async (req, res) => {
  const accounts = service.getAccounts();
  res.json({ success: true, data: accounts });
}));

router.post('/accounts', asyncHandler(async (req, res) => {
  const account = new Account(req.body);
  const result = service.addAccount(account);
  res.json({ success: true, data: result.toJSON() });
}));

router.get('/credit-records', asyncHandler(async (req, res) => {
  const filters = req.query;
  const records = service.getCreditRecords(filters);
  res.json({ success: true, data: records });
}));

router.get('/credit-records/:id', asyncHandler(async (req, res) => {
  const record = service.getCreditRecordById(req.params.id);
  if (!record) {
    return res.status(404).json({
      success: false,
      error: 'RECORD_NOT_FOUND',
      message: '找不到该记录'
    });
  }
  res.json({ success: true, data: record });
}));

router.post('/credit-records', asyncHandler(async (req, res) => {
  try {
    const result = service.addCreditRecord(req.body, req.body.operator);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof BusinessError) {
      return res.status(400).json({
        success: false,
        error: error.code,
        message: error.userMessage,
        details: error.details
      });
    }
    throw error;
  }
}));

router.put('/credit-records/:id', asyncHandler(async (req, res) => {
  try {
    const result = service.updateCreditRecord(req.params.id, req.body, req.body.operator);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof BusinessError) {
      return res.status(400).json({
        success: false,
        error: error.code,
        message: error.userMessage,
        details: error.details
      });
    }
    throw error;
  }
}));

router.delete('/credit-records/:id', asyncHandler(async (req, res) => {
  try {
    service.deleteCreditRecord(req.params.id);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    if (error instanceof BusinessError) {
      return res.status(404).json({
        success: false,
        error: error.code,
        message: error.userMessage,
        details: error.details
      });
    }
    throw error;
  }
}));

router.get('/fund-level-summary', asyncHandler(async (req, res) => {
  const summary = service.getFundLevelSummary();
  res.json({ success: true, data: summary });
}));

router.get('/review-list', asyncHandler(async (req, res) => {
  const reviewList = service.getReviewList();
  res.json({ success: true, data: reviewList });
}));

router.post('/init-sample-data', asyncHandler(async (req, res) => {
  const sampleAccounts = [
    { id: 'ACC001', name: '活期结算户-001', customerId: 'CUST001', customerName: '张三科技有限公司', branch: '北京中关村支行' },
    { id: 'ACC002', name: '定期存款户-002', customerId: 'CUST001', customerName: '张三科技有限公司', branch: '北京中关村支行' },
    { id: 'ACC003', name: '贷款账户-003', customerId: 'CUST002', customerName: '李四贸易有限公司', branch: '上海浦东支行' },
    { id: 'ACC004', name: '保证金账户-004', customerId: 'CUST002', customerName: '李四贸易有限公司', branch: '上海浦东支行' },
    { id: 'ACC005', name: '专用账户-005', customerId: 'CUST003', customerName: '王五制造股份公司', branch: '广州天河支行' }
  ];

  sampleAccounts.forEach(acc => service.addAccount(new Account(acc)));

  const sampleRecords = [
    { accountId: 'ACC001', accountName: '活期结算户-001', creditAmount: 500, usedAmount: 200, sourceType: 'credit_ledger', sourceId: 'LEDG001', sourceDate: '2026-05-01', status: 'confirmed', operationType: 'conclusion_change', remark: '初始授信额度', handler: '王经理' },
    { accountId: 'ACC001', accountName: '活期结算户-001', creditAmount: 500, usedAmount: 250, sourceType: 'supplement_email', sourceId: 'EMAIL001', sourceDate: '2026-05-15', status: 'pending_supplement', operationType: 'material_supplement', remark: '客户邮件补充说明', handler: '李助理' },
    { accountId: 'ACC002', accountName: '定期存款户-002', creditAmount: 1000, usedAmount: 0, sourceType: 'credit_ledger', sourceId: 'LEDG002', sourceDate: '2026-05-02', status: 'confirmed', operationType: 'conclusion_change', remark: '定期存单质押', handler: '王经理' },
    { accountId: 'ACC003', accountName: '贷款账户-003', creditAmount: 800, usedAmount: 600, sourceType: 'review_daily', sourceId: 'DAILY001', sourceDate: '2026-05-10', status: 'manually_modified', operationType: 'conclusion_change', remark: '经复核调整已用额度', handler: '张主管' },
    { accountId: 'ACC004', accountName: '保证金账户-004', creditAmount: 300, usedAmount: 150, sourceType: 'credit_ledger', sourceId: 'LEDG003', sourceDate: '2026-05-05', status: 'confirmed', operationType: 'conclusion_change', remark: '承兑汇票保证金', handler: '刘经理' },
    { accountId: 'ACC005', accountName: '专用账户-005', creditAmount: 2000, usedAmount: 1200, sourceType: 'supplement_email', sourceId: 'EMAIL002', sourceDate: '2026-05-20', status: 'pending_supplement', operationType: 'material_supplement', remark: '待确认最新授信', handler: '陈助理' },
    { accountId: 'ACC005', accountName: '专用账户-005', creditAmount: 1500, usedAmount: 1000, sourceType: 'review_daily', sourceId: 'DAILY002', sourceDate: '2026-05-18', status: 'manually_modified', operationType: 'conclusion_change', remark: '日报修正授信金额', handler: '赵主管' }
  ];

  sampleRecords.forEach(rec => {
    try {
      service.addCreditRecord(rec, 'system');
    } catch (e) {
      console.log('跳过重复记录:', rec.accountId, rec.sourceDate);
    }
  });

  res.json({ 
    success: true, 
    message: '示例数据初始化完成',
    stats: {
      accounts: service.getAccounts().length,
      records: service.getCreditRecords().length
    }
  });
}));

router.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: '系统处理出错，请稍后重试或联系技术支持',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = router;
