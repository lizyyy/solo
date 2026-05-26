/**
 * API 路由控制器
 */

const approvalService = require('../services/approvalService');
const rulesEngine = require('../services/rulesEngine');
const fileReader = require('../services/fileReader');
const store = require('../models/store');
const path = require('path');
const fs = require('fs');

// ========== 装修申请相关 ==========

/**
 * POST /api/decoration/upload
 * 上传装修申请 CSV 文件
 */
async function uploadDecorationFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传文件'
      });
    }

    const filePath = req.file.path;
    const result = await approvalService.processDecorationFile(filePath, 'csv');

    // 清理临时文件
    fs.unlink(filePath, () => {});

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * POST /api/decoration/process
 * 直接提交 JSON 格式的装修申请数据
 */
function processRawDecoration(req, res) {
  try {
    const { data } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        error: '数据格式错误，需要 data 数组'
      });
    }

    const result = approvalService.processRawData(data, 'decoration');
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/decoration/:id
 * 获取单个装修申请详情
 */
function getDecorationDetail(req, res) {
  try {
    const { id } = req.params;
    const application = store.getDecorationApplication(id);

    if (!application) {
      return res.status(404).json({
        success: false,
        error: '装修申请不存在'
      });
    }

    const inspections = store.getInspectionsByApplication(id);
    const violations = store.getViolationsByApplication(id);
    const approvals = store.getApprovalRecordsByApplication(id);
    const freezeRecords = store.getDepositFreezeByApplication(id);
    const refundHistory = store.getRefundByApplication(id);

    res.json({
      success: true,
      application,
      inspections,
      violations,
      approvals,
      freezeRecords,
      refundHistory
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/decoration
 * 获取所有装修申请列表
 */
function listApplications(req, res) {
  try {
    const { status, ownerId } = req.query;
    let applications = Array.from(store.decorationApplications.values());

    if (status) {
      applications = applications.filter(a => a.acceptanceStatus === status);
    }
    if (ownerId) {
      applications = applications.filter(a => a.ownerId === ownerId);
    }

    res.json({
      success: true,
      count: applications.length,
      applications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ========== 巡检相关 ==========

/**
 * POST /api/inspection/upload
 * 上传巡检 JSON 文件
 */
async function uploadInspectionFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传文件'
      });
    }

    const filePath = req.file.path;
    const result = await approvalService.processInspectionFile(filePath);

    fs.unlink(filePath, () => {});

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * POST /api/inspection
 * 直接提交巡检数据
 */
function addInspection(req, res) {
  try {
    const inspection = store.addInspectionRecord(req.body);
    res.json({
      success: true,
      inspection
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ========== 扣款规则相关 ==========

/**
 * POST /api/rules/upload
 * 上传扣款规则 JSON 文件
 */
async function uploadDeductionRules(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传文件'
      });
    }

    const filePath = req.file.path;
    const result = await approvalService.processDeductionRulesFile(filePath);

    fs.unlink(filePath, () => {});

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/rules
 * 获取所有扣款规则
 */
function listRules(req, res) {
  try {
    const rules = store.getActiveRules();
    res.json({
      success: true,
      count: rules.length,
      rules
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * POST /api/rules
 * 添加扣款规则
 */
function addRule(req, res) {
  try {
    const rule = store.addDeductionRule(req.body);
    res.json({
      success: true,
      rule
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ========== 审批相关 ==========

/**
 * POST /api/approval/process
 * 处理审批（批量分类）
 */
function processApproval(req, res) {
  try {
    const { applicationIds } = req.body;
    const results = [];

    applicationIds.forEach(id => {
      const app = store.getDecorationApplication(id);
      if (app) {
        results.push(rulesEngine.processApplication(app));
      }
    });

    const normal = results.filter(r => r.category === 'normal');
    const pending = results.filter(r => r.category === 'pending_confirmation');
    const failed = results.filter(r => r.category === 'failed');

    res.json({
      success: true,
      summary: {
        total: results.length,
        normal: normal.length,
        pending_confirmation: pending.length,
        failed: failed.length
      },
      normal,
      pending_confirmation: pending,
      failed
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * POST /api/approval/deduction
 * 执行扣款审批
 */
function executeDeduction(req, res) {
  try {
    const { applicationId, ruleId, operator } = req.body;
    const result = approvalService.executeDeductionProcess(applicationId, ruleId, operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ========== 退款相关 ==========

/**
 * POST /api/refund/create
 * 创建退款审批
 */
function createRefund(req, res) {
  try {
    const { applicationId, amount, approver, reason } = req.body;
    const result = rulesEngine.createRefundApproval(applicationId, amount, approver, reason);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * POST /api/refund/confirm/:id
 * 确认退款执行
 */
function confirmRefund(req, res) {
  try {
    const { id } = req.params;
    const { operator } = req.body;
    const result = rulesEngine.confirmRefund(id, operator);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/refund/:id/trace
 * 获取退款追踪信息（从历史追溯来源）
 */
function getRefundTrace(req, res) {
  try {
    const { id } = req.params;
    const result = approvalService.getRefundTrace(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * GET /api/refund
 * 获取所有退款历史
 */
function listRefunds(req, res) {
  try {
    const result = approvalService.getAllRefundHistory();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ========== 统计相关 ==========

/**
 * GET /api/stats
 * 获取分类统计
 */
function getStats(req, res) {
  try {
    const stats = approvalService.getCategoryStats();
    const refundCount = store.getRefundHistory().length;
    const violationCount = Array.from(store.violationRecords.values()).length;
    const freezeCount = Array.from(store.depositFreezeRecords.values()).filter(f => !f.released).length;

    res.json({
      success: true,
      ...stats,
      refundCount,
      violationCount,
      activeFreezeCount: freezeCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ========== 批次去重相关 ==========

/**
 * GET /api/batch/:fingerprint
 * 检查批次处理状态
 */
function checkBatch(req, res) {
  try {
    const { fingerprint } = req.params;
    const result = approvalService.checkBatchStatus(fingerprint);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// ========== 健康检查 ==========

/**
 * GET /api/health
 */
function healthCheck(req, res) {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'property-decoration-approval',
    version: '1.0.0'
  });
}

module.exports = {
  uploadDecorationFile,
  processRawDecoration,
  getDecorationDetail,
  listApplications,
  uploadInspectionFile,
  addInspection,
  uploadDeductionRules,
  listRules,
  addRule,
  processApproval,
  executeDeduction,
  createRefund,
  confirmRefund,
  getRefundTrace,
  listRefunds,
  getStats,
  checkBatch,
  healthCheck
};
