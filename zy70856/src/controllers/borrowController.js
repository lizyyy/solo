const BorrowRecord = require('../models/BorrowRecord');
const Batch = require('../models/Batch');
const Case = require('../models/Case');
const UserPermission = require('../models/UserPermission');
const { Parser } = require('json2csv');
const { generateId, calculateOverdueDays, canAccessSecretLevel, getReadableOverdueMessage, getReadableSecretMessage, getReadableRenewMessage } = require('../utils/helpers');

const createBatch = async (req, res) => {
  try {
    const { batchName, batchType, description, recordIds, operator } = req.body;
    
    const batchId = generateId('BATCH');
    const batch = new Batch({
      batchId,
      batchName: batchName || `批次_${new Date().toLocaleDateString('zh-CN')}`,
      batchType: batchType || '借阅申请',
      description,
      totalRecords: recordIds?.length || 0,
      createdBy: operator || '系统管理员',
      recordIds: recordIds || [],
      status: recordIds?.length > 0 ? '处理中' : '新建'
    });
    
    await batch.save();
    
    res.status(201).json({
      success: true,
      message: '批次创建成功',
      batch
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '批次创建失败',
      error: error.message
    });
  }
};

const markProcessed = async (req, res) => {
  try {
    const { recordId, operator, operatorId, comment } = req.body;
    
    const record = await BorrowRecord.findOne({ recordId });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }
    
    const previousStatus = record.status;
    record.status = '已借出';
    record.approvalStatus = '通过';
    record.approverName = operator;
    record.approverId = operatorId;
    record.approvalComment = comment;
    record.approvalDate = new Date();
    
    record.addAction(
      '借出',
      operator,
      '管理员标记已处理',
      `从「${previousStatus}」状态标记为已借出`,
      comment
    );
    
    await record.save();
    
    if (record.batchId) {
      const batch = await Batch.findOne({ batchId: record.batchId });
      if (batch) {
        const unprocessedRecords = await BorrowRecord.countDocuments({
          batchId: record.batchId,
          status: { $nin: ['已借出', '已归还', '已退回', '已取消'] }
        });
        if (unprocessedRecords === 0) {
          batch.status = '已完成';
          batch.completedAt = new Date();
          batch.processedBy = operator;
          batch.processedById = operatorId;
          await batch.save();
        }
      }
    }
    
    res.json({
      success: true,
      message: '处理成功',
      record: {
        recordId: record.recordId,
        status: record.status,
        statusExplanation: record.getCurrentStatusExplanation()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '处理失败',
      error: error.message
    });
  }
};

const returnModify = async (req, res) => {
  try {
    const { recordId, operator, operatorId, reason, readableReason, requireMaterials } = req.body;
    
    const record = await BorrowRecord.findOne({ recordId });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }
    
    const previousStatus = record.status;
    record.status = '已退回';
    record.approvalStatus = '驳回';
    record.approverName = operator;
    record.approverId = operatorId;
    record.approvalComment = reason;
    record.approvalDate = new Date();
    
    if (requireMaterials) {
      record.flags.materialsSupplemented = false;
      record.addAction(
        '要求补材料',
        operator,
        reason || '材料不齐全',
        readableReason || '申请材料不完整，需要补充后重新提交',
        ''
      );
    } else {
      record.addAction(
        '退回修改',
        operator,
        reason || '审核不通过',
        readableReason || `从「${previousStatus}」状态退回，需修改后重新提交`,
        ''
      );
    }
    
    await record.save();
    
    res.json({
      success: true,
      message: requireMaterials ? '已要求补充材料' : '已退回修改',
      record: {
        recordId: record.recordId,
        status: record.status,
        statusExplanation: record.getCurrentStatusExplanation()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '操作失败',
      error: error.message
    });
  }
};

const approveAndRelease = async (req, res) => {
  try {
    const { recordId, operator, operatorId, comment } = req.body;
    
    const record = await BorrowRecord.findOne({ recordId });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }
    
    const previousStatus = record.status;
    
    const userInfo = await UserPermission.findOne({ userId: record.borrowerId });
    const caseInfo = await Case.findOne({ caseId: record.caseId });
    
    if (caseInfo && userInfo && !canAccessSecretLevel(userInfo.maxSecurityLevel, caseInfo.securityLevel)) {
      return res.status(403).json({
        success: false,
        message: '涉密案件需要更高权限审批',
        readableMessage: getReadableSecretMessage(caseInfo.securityLevel, userInfo.maxSecurityLevel, caseInfo.title)
      });
    }
    
    record.status = '已批准';
    record.approvalStatus = '通过';
    record.approverName = operator;
    record.approverId = operatorId;
    record.approvalComment = comment;
    record.approvalDate = new Date();
    record.flags.specialApprovalRequired = false;
    
    record.addAction(
      '审批通过',
      operator,
      '审批通过予以放行',
      `从「${previousStatus}」状态审批通过，可办理借出`,
      comment
    );
    
    record.addAction(
      '放行',
      operator,
      '涉密审查通过',
      `经审批确认借阅人具备相应权限，予以放行`,
      ''
    );
    
    await record.save();
    
    res.json({
      success: true,
      message: '审批通过，已放行',
      record: {
        recordId: record.recordId,
        status: record.status,
        statusExplanation: record.getCurrentStatusExplanation()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '审批失败',
      error: error.message
    });
  }
};

const exportDetails = async (req, res) => {
  try {
    const { 
      batchId, 
      status, 
      securityLevel, 
      borrowerId, 
      borrowerName,
      startDate, 
      endDate,
      isOverdue,
      isSecretCase 
    } = req.body;
    
    const query = {};
    if (batchId) query.batchId = batchId;
    if (status) query.status = status;
    if (securityLevel) query.securityLevel = securityLevel;
    if (borrowerId) query.borrowerId = borrowerId;
    if (borrowerName) query.borrowerName = { $regex: borrowerName, $options: 'i' };
    if (startDate) query.borrowDate = { $gte: new Date(startDate) };
    if (endDate) query.borrowDate = { ...query.borrowDate, $lte: new Date(endDate) };
    if (isOverdue !== undefined) query.isOverdue = isOverdue;
    if (isSecretCase !== undefined) query.isSecretCase = isSecretCase;
    
    const records = await BorrowRecord.find(query).sort({ createdAt: -1 });
    
    const exportData = records.map(record => ({
      记录ID: record.recordId,
      批次ID: record.batchId || '',
      案件编号: record.caseId,
      案件标题: record.caseTitle,
      密级: record.securityLevel,
      借阅人ID: record.borrowerId,
      借阅人姓名: record.borrowerName,
      借阅人部门: record.borrowerDepartment || '',
      借阅日期: record.borrowDate.toLocaleDateString('zh-CN'),
      应还日期: record.dueDate.toLocaleDateString('zh-CN'),
      实际归还日期: record.returnDate ? record.returnDate.toLocaleDateString('zh-CN') : '',
      续借次数: record.renewCount,
      用途: record.purpose || '',
      当前状态: record.status,
      是否超期: record.isOverdue ? '是' : '否',
      超期天数: record.overdueDays || 0,
      是否涉密案件: record.isSecretCase ? '是' : '否',
      审批人: record.approverName || '',
      审批意见: record.approvalComment || '',
      审批日期: record.approvalDate ? record.approvalDate.toLocaleDateString('zh-CN') : '',
      状态说明: record.getCurrentStatusExplanation(),
      操作记录数: record.operationHistory.length
    }));
    
    if (req.query.format === 'json') {
      res.json({
        success: true,
        total: exportData.length,
        query: query,
        data: exportData
      });
    } else {
      const json2csvParser = new Parser({ withBOM: true });
      const csv = json2csvParser.parse(exportData);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="借阅明细_${new Date().toLocaleDateString('zh-CN')}.csv"`);
      res.send(csv);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导出失败',
      error: error.message
    });
  }
};

const sendOverdueReminder = async (req, res) => {
  try {
    const { recordId, operator } = req.body;
    
    const record = await BorrowRecord.findOne({ recordId });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }
    
    const overdueDays = calculateOverdueDays(record.dueDate);
    if (overdueDays <= 0) {
      return res.status(400).json({
        success: false,
        message: '该记录未超期',
        overdueDays
      });
    }
    
    record.overdueDays = overdueDays;
    record.isOverdue = true;
    record.flags.overdueReminderSent = true;
    
    record.addAction(
      '超期催还',
      operator || '系统',
      `超期${overdueDays}天`,
      getReadableOverdueMessage(overdueDays, record.borrowerName),
      ''
    );
    
    await record.save();
    
    res.json({
      success: true,
      message: '催还通知已记录',
      record: {
        recordId: record.recordId,
        overdueDays,
        readableMessage: getReadableOverdueMessage(overdueDays, record.borrowerName),
        statusExplanation: record.getCurrentStatusExplanation()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '催还操作失败',
      error: error.message
    });
  }
};

const renewRecord = async (req, res) => {
  try {
    const { recordId, operator, renewDays = 30 } = req.body;
    
    const record = await BorrowRecord.findOne({ recordId });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }
    
    const maxRenewCount = parseInt(process.env.MAX_RENEW_TIMES) || 2;
    
    if (record.renewCount >= maxRenewCount) {
      return res.status(400).json({
        success: false,
        message: '已达到续借上限',
        readableMessage: getReadableRenewMessage(record.renewCount, maxRenewCount, record.borrowerName)
      });
    }
    
    record.renewCount += 1;
    const oldDueDate = new Date(record.dueDate);
    record.dueDate = new Date(oldDueDate.getTime() + renewDays * 24 * 60 * 60 * 1000);
    
    const newOverdueDays = calculateOverdueDays(record.dueDate);
    record.overdueDays = newOverdueDays;
    record.isOverdue = newOverdueDays > 0;
    
    record.addAction(
      '续借',
      operator || '系统',
      `第${record.renewCount}次续借`,
      `到期日从${oldDueDate.toLocaleDateString('zh-CN')}延长至${record.dueDate.toLocaleDateString('zh-CN')}`,
      getReadableRenewMessage(record.renewCount, maxRenewCount, record.borrowerName)
    );
    
    await record.save();
    
    res.json({
      success: true,
      message: '续借成功',
      record: {
        recordId: record.recordId,
        renewCount: record.renewCount,
        maxRenewCount,
        newDueDate: record.dueDate.toLocaleDateString('zh-CN'),
        readableMessage: getReadableRenewMessage(record.renewCount, maxRenewCount, record.borrowerName),
        statusExplanation: record.getCurrentStatusExplanation()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '续借失败',
      error: error.message
    });
  }
};

const getRecordDetail = async (req, res) => {
  try {
    const { recordId } = req.params;
    
    const record = await BorrowRecord.findOne({ recordId });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }
    
    const operationHistoryWithExplanation = record.operationHistory.map(action => ({
      ...action.toObject(),
      timestampFormatted: action.timestamp.toLocaleString('zh-CN')
    }));
    
    res.json({
      success: true,
      record: {
        ...record.toObject(),
        currentStatusExplanation: record.getCurrentStatusExplanation(),
        operationHistory: operationHistoryWithExplanation
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询失败',
      error: error.message
    });
  }
};

module.exports = {
  createBatch,
  markProcessed,
  returnModify,
  approveAndRelease,
  exportDetails,
  sendOverdueReminder,
  renewRecord,
  getRecordDetail
};
