const express = require('express');
const router = express.Router();
const ShortageService = require('../services/ShortageService');
const ResultService = require('../services/ResultService');
const HistoryService = require('../services/HistoryService');
const JobService = require('../services/JobService');

router.post('/', async (req, res) => {
  try {
    const data = req.body;
    const operator = req.headers['x-operator'] || 'system';

    if (!data.materialCode || !data.materialName || !data.supplierCode || 
        !data.supplierName || !data.requiredDate || !data.requiredQuantity) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段：物料编码、物料名称、供应商编码、供应商名称、需求日期、需求数量'
      });
    }

    const shortage = await ShortageService.createShortage(data, operator);

    res.status(201).json({
      success: true,
      message: '缺料单创建成功',
      data: {
        id: shortage.id,
        shortageNo: shortage.shortageNo,
        material: `${shortage.materialName} (${shortage.materialCode})`,
        supplier: `${shortage.supplierName} (${shortage.supplierCode})`,
        requiredDate: shortage.requiredDate,
        requiredQuantity: parseFloat(shortage.requiredQuantity),
        status: shortage.status
      }
    });
  } catch (error) {
    console.error('创建缺料单失败:', error);
    res.status(500).json({
      success: false,
      message: '创建缺料单失败',
      error: error.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, supplierCode, materialCode } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (supplierCode) filter.supplierCode = supplierCode;
    if (materialCode) filter.materialCode = materialCode;

    const shortages = await ShortageService.listShortages(filter);

    res.json({
      success: true,
      message: '查询成功',
      data: shortages.map(s => ({
        id: s.id,
        shortageNo: s.shortageNo,
        material: `${s.materialName} (${s.materialCode})`,
        supplier: `${s.supplierName} (${s.supplierCode})`,
        requiredDate: s.requiredDate,
        requiredQuantity: parseFloat(s.requiredQuantity),
        status: _translateStatus(s.status),
        latestPromiseDate: s.latestPromiseDate,
        deliveryQuantity: s.deliveryQuantity ? parseFloat(s.deliveryQuantity) : 0
      }))
    });
  } catch (error) {
    console.error('查询缺料单列表失败:', error);
    res.status(500).json({
      success: false,
      message: '查询缺料单列表失败',
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let shortage;

    if (id.startsWith('SH-')) {
      shortage = await ShortageService.getShortageByNo(id);
    } else {
      shortage = await ShortageService.getShortage(id);
    }

    if (!shortage) {
      return res.status(404).json({
        success: false,
        message: '缺料单不存在'
      });
    }

    res.json({
      success: true,
      message: '查询成功',
      data: {
        id: shortage.id,
        shortageNo: shortage.shortageNo,
        material: `${shortage.materialName} (${shortage.materialCode})`,
        supplier: `${shortage.supplierName} (${shortage.supplierCode})`,
        requiredDate: shortage.requiredDate,
        requiredQuantity: parseFloat(shortage.requiredQuantity),
        status: _translateStatus(shortage.status),
        latestPromiseDate: shortage.latestPromiseDate,
        deliveryQuantity: shortage.deliveryQuantity ? parseFloat(shortage.deliveryQuantity) : 0,
        commitments: shortage.commitments,
        affectedOrders: shortage.affectedOrders,
        urgeTasks: shortage.urgeTasks,
        deliveryReceipts: shortage.deliveryReceipts,
        riskReports: shortage.riskReports
      }
    });
  } catch (error) {
    console.error('查询缺料单详情失败:', error);
    res.status(500).json({
      success: false,
      message: '查询缺料单详情失败',
      error: error.message
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const operator = req.headers['x-operator'] || 'system';

    const shortage = await ShortageService.updateShortage(id, data, operator);

    res.json({
      success: true,
      message: '缺料单更新成功',
      data: {
        id: shortage.id,
        shortageNo: shortage.shortageNo,
        status: _translateStatus(shortage.status)
      }
    });
  } catch (error) {
    console.error('更新缺料单失败:', error);
    res.status(500).json({
      success: false,
      message: '更新缺料单失败',
      error: error.message
    });
  }
});

router.post('/:id/withdraw', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const operator = req.headers['x-operator'] || 'system';

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: '请提供撤回原因'
      });
    }

    const shortage = await ShortageService.withdrawShortage(id, reason, operator);

    res.json({
      success: true,
      message: `缺料单已撤回，原因：${reason}`,
      data: {
        id: shortage.id,
        shortageNo: shortage.shortageNo,
        status: '已撤回'
      }
    });
  } catch (error) {
    console.error('撤回缺料单失败:', error);
    res.status(500).json({
      success: false,
      message: '撤回缺料单失败',
      error: error.message
    });
  }
});

router.post('/:id/supplement', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const operator = req.headers['x-operator'] || 'system';

    const shortage = await ShortageService.supplementShortage(id, data, operator);

    res.json({
      success: true,
      message: '缺料单补录成功',
      data: {
        id: shortage.id,
        shortageNo: shortage.shortageNo
      }
    });
  } catch (error) {
    console.error('补录缺料单失败:', error);
    res.status(500).json({
      success: false,
      message: '补录缺料单失败',
      error: error.message
    });
  }
});

router.post('/:id/commitments', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const operator = req.headers['x-operator'] || 'system';

    if (!data.promiseDate || !data.promiseQuantity) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段：承诺日期、承诺数量'
      });
    }

    const commitment = await ShortageService.addCommitment(id, data, operator);

    res.status(201).json({
      success: true,
      message: `第${commitment.versionNo}版承诺添加成功`,
      data: {
        versionNo: commitment.versionNo,
        promiseDate: commitment.promiseDate,
        promiseQuantity: parseFloat(commitment.promiseQuantity),
        reason: commitment.reason,
        source: commitment.source
      }
    });
  } catch (error) {
    console.error('添加承诺失败:', error);
    res.status(500).json({
      success: false,
      message: '添加承诺失败',
      error: error.message
    });
  }
});

router.post('/:id/orders', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    if (!data.orderNo) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段：订单号'
      });
    }

    const order = await ShortageService.addAffectedOrder(id, data);

    res.status(201).json({
      success: true,
      message: '影响订单添加成功',
      data: {
        id: order.id,
        orderNo: order.orderNo,
        orderType: order.orderType,
        impactLevel: _translateImpactLevel(order.impactLevel)
      }
    });
  } catch (error) {
    console.error('添加影响订单失败:', error);
    res.status(500).json({
      success: false,
      message: '添加影响订单失败',
      error: error.message
    });
  }
});

router.post('/:id/urges', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const operator = req.headers['x-operator'] || 'system';

    if (!data.content) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段：催办内容'
      });
    }

    const urge = await ShortageService.addUrgeTask(id, data, operator);

    res.status(201).json({
      success: true,
      message: '催办任务创建成功',
      data: {
        id: urge.id,
        taskNo: urge.taskNo,
        priority: _translatePriority(urge.priority),
        assignee: urge.assignee,
        status: '待处理'
      }
    });
  } catch (error) {
    console.error('创建催办任务失败:', error);
    res.status(500).json({
      success: false,
      message: '创建催办任务失败',
      error: error.message
    });
  }
});

router.post('/urges/:taskId/complete', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { response } = req.body;
    const operator = req.headers['x-operator'] || 'system';

    if (!response) {
      return res.status(400).json({
        success: false,
        message: '请提供处理结果'
      });
    }

    const task = await ShortageService.completeUrgeTask(taskId, response, operator);

    res.json({
      success: true,
      message: '催办任务已完成',
      data: {
        taskNo: task.taskNo,
        status: '已完成',
        response: task.response
      }
    });
  } catch (error) {
    console.error('完成催办任务失败:', error);
    res.status(500).json({
      success: false,
      message: '完成催办任务失败',
      error: error.message
    });
  }
});

router.post('/:id/receipts', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const operator = req.headers['x-operator'] || 'system';

    if (!data.deliveryDate || !data.deliveryQuantity) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段：到料日期、到料数量'
      });
    }

    const receipt = await ShortageService.addDeliveryReceipt(id, data, operator);

    res.status(201).json({
      success: true,
      message: '到料回执添加成功',
      data: {
        id: receipt.id,
        receiptNo: receipt.receiptNo,
        deliveryDate: receipt.deliveryDate,
        deliveryQuantity: parseFloat(receipt.deliveryQuantity),
        qualityStatus: _translateQualityStatus(receipt.qualityStatus)
      }
    });
  } catch (error) {
    console.error('添加到料回执失败:', error);
    res.status(500).json({
      success: false,
      message: '添加到料回执失败',
      error: error.message
    });
  }
});

router.post('/:id/risks', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const operator = req.headers['x-operator'] || 'system';

    if (!data.riskLevel || !data.description) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段：风险等级、风险描述'
      });
    }

    const report = await ShortageService.addRiskReport(id, data, operator);

    res.status(201).json({
      success: true,
      message: `风险报告创建成功，等级：${_translateRiskLevel(data.riskLevel)}`,
      data: {
        id: report.id,
        reportNo: report.reportNo,
        riskLevel: _translateRiskLevel(report.riskLevel),
        status: '活跃'
      }
    });
  } catch (error) {
    console.error('创建风险报告失败:', error);
    res.status(500).json({
      success: false,
      message: '创建风险报告失败',
      error: error.message
    });
  }
});

router.put('/risks/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const data = req.body;
    const operator = req.headers['x-operator'] || 'system';

    const report = await ShortageService.updateRiskReport(reportId, data, operator);

    res.json({
      success: true,
      message: '风险报告更新成功',
      data: {
        reportNo: report.reportNo,
        status: _translateRiskStatus(report.status)
      }
    });
  } catch (error) {
    console.error('更新风险报告失败:', error);
    res.status(500).json({
      success: false,
      message: '更新风险报告失败',
      error: error.message
    });
  }
});

router.get('/:id/result', async (req, res) => {
  try {
    const { id } = req.params;
    let shortageId = id;

    if (id.startsWith('SH-')) {
      const shortage = await ShortageService.getShortageByNo(id);
      shortageId = shortage.id;
    }

    const result = await ResultService.calculateShortageResult(shortageId);

    res.json({
      success: true,
      message: '结果计算完成',
      data: result
    });
  } catch (error) {
    console.error('计算结果失败:', error);
    res.status(500).json({
      success: false,
      message: '计算结果失败',
      error: error.message
    });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    let shortageId = id;

    if (id.startsWith('SH-')) {
      const shortage = await ShortageService.getShortageByNo(id);
      shortageId = shortage.id;
    }

    const history = await HistoryService.getHistory(shortageId);

    res.json({
      success: true,
      message: '查询历史记录成功',
      data: history.map(h => ({
        id: h.id,
        operationType: _translateOperationType(h.operationType),
        operator: h.operator || '系统',
        content: h.content,
        createdAt: h.createdAt
      }))
    });
  } catch (error) {
    console.error('查询历史记录失败:', error);
    res.status(500).json({
      success: false,
      message: '查询历史记录失败',
      error: error.message
    });
  }
});

router.post('/jobs', async (req, res) => {
  try {
    const { jobType, shortageId, maxRetries } = req.body;

    if (!jobType) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段：任务类型'
      });
    }

    const job = await JobService.createJob(jobType, shortageId, null, maxRetries);

    res.status(201).json({
      success: true,
      message: '后台任务创建成功',
      data: {
        jobId: job.id,
        jobType: _translateJobType(job.jobType),
        status: '待执行',
        maxRetries: job.maxRetries
      }
    });
  } catch (error) {
    console.error('创建后台任务失败:', error);
    res.status(500).json({
      success: false,
      message: '创建后台任务失败',
      error: error.message
    });
  }
});

router.post('/jobs/:jobId/execute', async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await JobService.executeJob(jobId);

    res.json({
      success: result.success,
      message: result.success ? '任务执行成功' : result.error,
      data: result
    });
  } catch (error) {
    console.error('执行后台任务失败:', error);
    res.status(500).json({
      success: false,
      message: '执行后台任务失败',
      error: error.message
    });
  }
});

router.get('/jobs/:jobId/status', async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await JobService.getJobStatus(jobId);

    res.json({
      success: true,
      message: '查询任务状态成功',
      data: {
        ...status,
        jobType: _translateJobType(status.jobType),
        status: _translateJobStatus(status.status)
      }
    });
  } catch (error) {
    console.error('查询任务状态失败:', error);
    res.status(500).json({
      success: false,
      message: '查询任务状态失败',
      error: error.message
    });
  }
});

router.get('/jobs', async (req, res) => {
  try {
    const { status, jobType } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (jobType) filter.jobType = jobType;

    const jobs = await JobService.listJobs(filter);

    res.json({
      success: true,
      message: '查询任务列表成功',
      data: jobs.map(j => ({
        ...j,
        jobType: _translateJobType(j.jobType),
        status: _translateJobStatus(j.status)
      }))
    });
  } catch (error) {
    console.error('查询任务列表失败:', error);
    res.status(500).json({
      success: false,
      message: '查询任务列表失败',
      error: error.message
    });
  }
});

module.exports = router;

function _translateStatus(status) {
  const map = {
    'pending': '待处理',
    'processing': '处理中',
    'resolved': '已解决',
    'withdrawn': '已撤回'
  };
  return map[status] || status;
}

function _translateImpactLevel(level) {
  const map = {
    'low': '低',
    'medium': '中',
    'high': '高',
    'critical': '严重'
  };
  return map[level] || level;
}

function _translatePriority(priority) {
  const map = {
    'normal': '普通',
    'high': '高',
    'urgent': '紧急'
  };
  return map[priority] || priority;
}

function _translateQualityStatus(status) {
  const map = {
    'qualified': '合格',
    'unqualified': '不合格',
    'inspecting': '检验中'
  };
  return map[status] || status;
}

function _translateRiskLevel(level) {
  const map = {
    'low': '低',
    'medium': '中',
    'high': '高',
    'critical': '严重'
  };
  return map[level] || level;
}

function _translateRiskStatus(status) {
  const map = {
    'active': '活跃',
    'mitigated': '已缓解',
    'resolved': '已解决',
    'closed': '已关闭'
  };
  return map[status] || status;
}

function _translateOperationType(type) {
  const map = {
    'create': '创建',
    'update': '更新',
    'supplement': '补录',
    'withdraw': '撤回',
    'commitment': '添加承诺',
    'urge': '催办',
    'delivery': '到料',
    'risk': '风险报告'
  };
  return map[type] || type;
}

function _translateJobType(type) {
  const map = {
    'calculate_result': '计算结果',
    'recalculate_shortage': '批量重算',
    'generate_report': '生成报告'
  };
  return map[type] || type;
}

function _translateJobStatus(status) {
  const map = {
    'pending': '待执行',
    'running': '执行中',
    'completed': '已完成',
    'failed': '执行失败',
    'cancelled': '已取消'
  };
  return map[status] || status;
}
