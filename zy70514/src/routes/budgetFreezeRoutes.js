const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { Parser } = require('json2csv');
const budgetFreezeService = require('../services/BudgetFreezeService');
const { FREEZE_CATEGORIES, CORRECTION_TYPES } = require('../services/FreezeStatusMachine');

const createFreezeSchema = Joi.object({
  accountId: Joi.string().required(),
  groupId: Joi.string().optional(),
  freezeAmount: Joi.number().positive().required(),
  freezeReason: Joi.string().min(10).required(),
  freezeCategory: Joi.string().valid(...Object.values(FREEZE_CATEGORIES)).required(),
  complaintId: Joi.string().optional(),
  operatorId: Joi.string().required(),
  operatorName: Joi.string().required(),
  originalRequest: Joi.object().optional(),
  processingBasis: Joi.object().optional()
});

const transitionSchema = Joi.object({
  toStatus: Joi.string().required(),
  operatorId: Joi.string().required(),
  operatorName: Joi.string().required(),
  remarks: Joi.string().optional()
});

const thawApprovalSchema = Joi.object({
  applicantId: Joi.string().required(),
  applicantName: Joi.string().required(),
  thawReason: Joi.string().min(10).required(),
  proposedAmount: Joi.number().positive().required()
});

const approveThawSchema = Joi.object({
  approverId: Joi.string().required(),
  approverName: Joi.string().required(),
  approvalRemarks: Joi.string().optional(),
  isPartial: Joi.boolean().default(false)
});

const manualCorrectionSchema = Joi.object({
  freezeId: Joi.string().optional(),
  accountId: Joi.string().required(),
  groupId: Joi.string().optional(),
  correctionType: Joi.string().valid(...Object.values(CORRECTION_TYPES)).required(),
  originalValue: Joi.number().optional(),
  correctedValue: Joi.number().required(),
  reason: Joi.string().min(10).required(),
  operatorId: Joi.string().required(),
  operatorName: Joi.string().required()
});

const exceptionSchema = Joi.object({
  exceptionData: Joi.object().required(),
  operatorId: Joi.string().required(),
  operatorName: Joi.string().required()
});

router.post('/', async (req, res) => {
  try {
    const { error, value } = createFreezeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await budgetFreezeService.createFreezeRecord(value);
    res.status(201).json({
      message: '预算冻结记录创建成功',
      data: result
    });
  } catch (error) {
    console.error('创建冻结记录失败:', error);
    res.status(500).json({ error: '创建冻结记录失败' });
  }
});

router.get('/', async (req, res) => {
  try {
    const filters = {
      accountId: req.query.accountId,
      status: req.query.status,
      complaintId: req.query.complaintId,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset) : undefined
    };

    const records = await budgetFreezeService.listFreezeRecords(filters);
    res.json({
      data: records,
      total: records.length
    });
  } catch (error) {
    console.error('查询冻结记录失败:', error);
    res.status(500).json({ error: '查询冻结记录失败' });
  }
});

router.get('/:freezeId', async (req, res) => {
  try {
    const record = await budgetFreezeService.getFreezeRecord(req.params.freezeId);
    if (!record) {
      return res.status(404).json({ error: '冻结记录不存在' });
    }
    res.json({ data: record });
  } catch (error) {
    console.error('查询冻结记录详情失败:', error);
    res.status(500).json({ error: '查询冻结记录详情失败' });
  }
});

router.post('/:freezeId/transition', async (req, res) => {
  try {
    const { error, value } = transitionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await budgetFreezeService.transitionStatus(
      req.params.freezeId,
      value.toStatus,
      value.operatorId,
      value.operatorName,
      value.remarks
    );

    res.json({
      message: '状态转换成功',
      data: result
    });
  } catch (error) {
    console.error('状态转换失败:', error);
    res.status(400).json({ error: error.message });
  }
});

router.post('/:freezeId/confirm', async (req, res) => {
  try {
    const { operatorId, operatorName, processingBasis } = req.body;

    if (!operatorId || !operatorName) {
      return res.status(400).json({ error: '操作员信息不能为空' });
    }

    const result = await budgetFreezeService.confirmFreeze(
      req.params.freezeId,
      operatorId,
      operatorName,
      processingBasis
    );

    res.json({
      message: '冻结已确认，进入正式排查流程',
      data: result
    });
  } catch (error) {
    console.error('确认冻结失败:', error);
    res.status(400).json({ error: error.message });
  }
});

router.post('/:freezeId/start-investigation', async (req, res) => {
  try {
    const { operatorId, operatorName } = req.body;

    if (!operatorId || !operatorName) {
      return res.status(400).json({ error: '操作员信息不能为空' });
    }

    const result = await budgetFreezeService.startInvestigation(
      req.params.freezeId,
      operatorId,
      operatorName
    );

    res.json({
      message: '已启动用量异常排查',
      data: result
    });
  } catch (error) {
    console.error('启动排查失败:', error);
    res.status(400).json({ error: error.message });
  }
});

router.post('/:freezeId/thaw-approvals', async (req, res) => {
  try {
    const { error, value } = thawApprovalSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await budgetFreezeService.createThawApproval(
      req.params.freezeId,
      value.applicantId,
      value.applicantName,
      value.thawReason,
      value.proposedAmount
    );

    res.status(201).json({
      message: '解冻审批申请已创建',
      data: result
    });
  } catch (error) {
    console.error('创建解冻审批失败:', error);
    res.status(500).json({ error: '创建解冻审批失败' });
  }
});

router.post('/thaw-approvals/:approvalId/approve', async (req, res) => {
  try {
    const { error, value } = approveThawSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await budgetFreezeService.approveThaw(
      req.params.approvalId,
      value.approverId,
      value.approverName,
      value.approvalRemarks,
      value.isPartial
    );

    res.json({
      message: value.isPartial ? '部分解冻审批通过' : '全额解冻审批通过',
      data: result
    });
  } catch (error) {
    console.error('审批解冻失败:', error);
    res.status(400).json({ error: error.message });
  }
});

router.post('/thaw-approvals/:approvalId/reject', async (req, res) => {
  try {
    const { approverId, approverName, rejectionReason } = req.body;

    if (!approverId || !approverName || !rejectionReason) {
      return res.status(400).json({ error: '审批信息和驳回理由不能为空' });
    }

    const result = await budgetFreezeService.rejectThaw(
      req.params.approvalId,
      approverId,
      approverName,
      rejectionReason
    );

    res.json({
      message: '解冻申请已驳回',
      data: result
    });
  } catch (error) {
    console.error('驳回解冻申请失败:', error);
    res.status(400).json({ error: error.message });
  }
});

router.post('/manual-corrections', async (req, res) => {
  try {
    const { error, value } = manualCorrectionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await budgetFreezeService.createManualCorrection(value);

    res.status(201).json({
      message: '人工修正申请已创建',
      data: result
    });
  } catch (error) {
    console.error('创建人工修正失败:', error);
    res.status(500).json({ error: '创建人工修正失败' });
  }
});

router.post('/manual-corrections/:correctionId/approve', async (req, res) => {
  try {
    const { approverId, approverName, remarks } = req.body;

    if (!approverId || !approverName) {
      return res.status(400).json({ error: '审批人信息不能为空' });
    }

    const result = await budgetFreezeService.approveCorrection(
      req.params.correctionId,
      approverId,
      approverName,
      remarks
    );

    res.json({
      message: '人工修正已批准并应用',
      data: result
    });
  } catch (error) {
    console.error('批准人工修正失败:', error);
    res.status(400).json({ error: error.message });
  }
});

router.post('/:freezeId/exception', async (req, res) => {
  try {
    const { error, value } = exceptionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await budgetFreezeService.handleException(
      req.params.freezeId,
      value.exceptionData,
      value.operatorId,
      value.operatorName
    );

    res.json({
      message: '异常处理记录已保存',
      data: result
    });
  } catch (error) {
    console.error('异常处理失败:', error);
    res.status(400).json({ error: error.message });
  }
});

router.get('/export/data', async (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status,
      accountId: req.query.accountId
    };

    const data = await budgetFreezeService.getExportData(filters);
    res.json({
      message: '导出数据获取成功',
      total: data.length,
      data
    });
  } catch (error) {
    console.error('导出数据失败:', error);
    res.status(500).json({ error: '导出数据失败' });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status,
      accountId: req.query.accountId
    };

    const data = await budgetFreezeService.getExportData(filters);

    const flatData = data.map(record => ({
      freezeId: record.freeze_id,
      accountId: record.account_id,
      customerName: record.customer_name,
      customerEmail: record.customer_email,
      groupId: record.group_id,
      groupName: record.group_name,
      freezeAmount: record.freeze_amount,
      freezeReason: record.freeze_reason,
      freezeCategory: record.freeze_category,
      complaintId: record.complaint_id,
      status: record.status,
      createOperator: record.create_operator,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      operationCount: record.operations?.length || 0,
      approvalCount: record.approvals?.length || 0
    }));

    const fields = [
      'freezeId', 'accountId', 'customerName', 'customerEmail',
      'groupId', 'groupName', 'freezeAmount', 'freezeReason',
      'freezeCategory', 'complaintId', 'status', 'createOperator',
      'createdAt', 'updatedAt', 'operationCount', 'approvalCount'
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(flatData);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="budget_freezes_${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('导出CSV失败:', error);
    res.status(500).json({ error: '导出CSV失败' });
  }
});

router.get('/usage/:accountId/summary', async (req, res) => {
  try {
    const { startDate, endDate, groupId } = req.query;

    const data = await budgetFreezeService.getUsageSummary(
      req.params.accountId,
      groupId,
      startDate,
      endDate
    );

    res.json({
      message: '用量汇总查询成功',
      data
    });
  } catch (error) {
    console.error('查询用量汇总失败:', error);
    res.status(500).json({ error: '查询用量汇总失败' });
  }
});

module.exports = router;
