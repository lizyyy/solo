const express = require('express');
const traceabilityService = require('./services/traceabilityService');
const reportService = require('./services/reportService');

const router = express.Router();

// 中间件：获取操作者信息
const getOperator = (req) => {
  return req.headers['x-operator'] || 'system';
};

// 错误处理中间件
const handleError = (res, error) => {
  console.error('API Error:', error);
  res.status(400).json({
    success: false,
    error: error.message,
    timestamp: new Date().toISOString()
  });
};

// 成功响应
const handleSuccess = (res, data, message = '操作成功') => {
  res.json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

// ========== 门店管理 ==========

// 创建门店
router.post('/stores', async (req, res) => {
  try {
    const operator = getOperator(req);
    const result = await traceabilityService.createStore(req.body, operator);
    handleSuccess(res, result, '门店创建成功');
  } catch (error) {
    handleError(res, error);
  }
});

// 获取所有门店
router.get('/stores', async (req, res) => {
  try {
    const result = await traceabilityService.getStores();
    handleSuccess(res, result);
  } catch (error) {
    handleError(res, error);
  }
});

// ========== 批次管理 ==========

// 创建批次
router.post('/batches', async (req, res) => {
  try {
    const operator = getOperator(req);
    const result = await traceabilityService.createBatch(req.body, operator);
    handleSuccess(res, result, '批次创建成功');
  } catch (error) {
    handleError(res, error);
  }
});

// 获取批次列表
router.get('/batches', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.product_code) filter.product_code = req.query.product_code;
    
    const result = await traceabilityService.getBatches(filter);
    handleSuccess(res, result);
  } catch (error) {
    handleError(res, error);
  }
});

// 获取批次详情
router.get('/batches/:id', async (req, res) => {
  try {
    const result = await traceabilityService.getBatchDetail(req.params.id);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: '批次不存在',
        timestamp: new Date().toISOString()
      });
    }
    handleSuccess(res, result);
  } catch (error) {
    handleError(res, error);
  }
});

// ========== 业务流程 ==========

// 出库
router.post('/outbound', async (req, res) => {
  try {
    const operator = getOperator(req);
    const result = await traceabilityService.createOutbound(req.body, operator);
    handleSuccess(res, result, '出库成功');
  } catch (error) {
    handleError(res, error);
  }
});

// 开始冷链运输
router.post('/cold-chain/start', async (req, res) => {
  try {
    const operator = getOperator(req);
    const result = await traceabilityService.startColdChain(req.body, operator);
    handleSuccess(res, result, '冷链运输开始');
  } catch (error) {
    handleError(res, error);
  }
});

// 完成冷链运输
router.post('/cold-chain/:id/complete', async (req, res) => {
  try {
    const operator = getOperator(req);
    const result = await traceabilityService.completeColdChain(req.params.id, req.body, operator);
    handleSuccess(res, result, '冷链运输完成');
  } catch (error) {
    handleError(res, error);
  }
});

// 门店接收
router.post('/receive', async (req, res) => {
  try {
    const operator = getOperator(req);
    const result = await traceabilityService.receiveBatch(req.body, operator);
    handleSuccess(res, result, '接收成功');
  } catch (error) {
    handleError(res, error);
  }
});

// 开始解冻
router.post('/thaw/start', async (req, res) => {
  try {
    const operator = getOperator(req);
    const result = await traceabilityService.startThaw(req.body, operator);
    handleSuccess(res, result, '解冻开始');
  } catch (error) {
    handleError(res, error);
  }
});

// 完成解冻
router.post('/thaw/:id/complete', async (req, res) => {
  try {
    const operator = getOperator(req);
    const result = await traceabilityService.completeThaw(req.params.id, req.body, operator);
    handleSuccess(res, result, '解冻完成');
  } catch (error) {
    handleError(res, error);
  }
});

// 销售
router.post('/sales', async (req, res) => {
  try {
    const operator = getOperator(req);
    const result = await traceabilityService.createSale(req.body, operator);
    handleSuccess(res, result, '销售成功');
  } catch (error) {
    handleError(res, error);
  }
});

// 召回
router.post('/recalls', async (req, res) => {
  try {
    const operator = getOperator(req);
    const result = await traceabilityService.createRecall(req.body, operator);
    handleSuccess(res, result, '召回成功');
  } catch (error) {
    handleError(res, error);
  }
});

// 报损
router.post('/damages', async (req, res) => {
  try {
    const operator = getOperator(req);
    const result = await traceabilityService.createDamage(req.body, operator);
    handleSuccess(res, result, '报损成功');
  } catch (error) {
    handleError(res, error);
  }
});

// ========== 查询 ==========

// 获取门店库存
router.get('/inventory', async (req, res) => {
  try {
    const storeId = req.query.store_id || null;
    const result = await traceabilityService.getStoreInventory(storeId);
    handleSuccess(res, result);
  } catch (error) {
    handleError(res, error);
  }
});

// ========== 人工修正 ==========

router.post('/manual-correction', async (req, res) => {
  try {
    const operator = getOperator(req);
    const result = await traceabilityService.manualCorrection(req.body, operator);
    handleSuccess(res, result, '人工修正成功');
  } catch (error) {
    handleError(res, error);
  }
});

// ========== 报告导出 ==========

// 批次流向报告
router.get('/reports/batch-flow/:batchId', async (req, res) => {
  try {
    const result = await reportService.generateBatchFlowReport(req.params.batchId);
    handleSuccess(res, result, '批次流向报告生成成功');
  } catch (error) {
    handleError(res, error);
  }
});

// 门店库存报告
router.get('/reports/inventory', async (req, res) => {
  try {
    const storeId = req.query.store_id || null;
    const result = await reportService.generateStoreInventoryReport(storeId);
    handleSuccess(res, result, '门店库存报告生成成功');
  } catch (error) {
    handleError(res, error);
  }
});

// 召回报告
router.get('/reports/recall/:batchId', async (req, res) => {
  try {
    const result = await reportService.generateRecallReport(req.params.batchId);
    handleSuccess(res, result, '召回报告生成成功');
  } catch (error) {
    handleError(res, error);
  }
});

module.exports = router;
