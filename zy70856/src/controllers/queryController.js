const BorrowRecord = require('../models/BorrowRecord');
const Batch = require('../models/Batch');
const Case = require('../models/Case');
const UserPermission = require('../models/UserPermission');

const queryHistory = async (req, res) => {
  try {
    const {
      securityLevel,
      borrowerName,
      borrowerId,
      approvalComment,
      approverName,
      status,
      startDate,
      endDate,
      caseId,
      caseTitle,
      isOverdue,
      isSecretCase,
      batchId,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.body;
    
    const query = {};
    
    if (securityLevel) {
      if (Array.isArray(securityLevel)) {
        query.securityLevel = { $in: securityLevel };
      } else {
        query.securityLevel = securityLevel;
      }
    }
    
    if (borrowerName) query.borrowerName = { $regex: borrowerName, $options: 'i' };
    if (borrowerId) query.borrowerId = borrowerId;
    if (approvalComment) query.approvalComment = { $regex: approvalComment, $options: 'i' };
    if (approverName) query.approverName = { $regex: approverName, $options: 'i' };
    if (status) query.status = status;
    if (caseId) query.caseId = caseId;
    if (caseTitle) query.caseTitle = { $regex: caseTitle, $options: 'i' };
    if (isOverdue !== undefined) query.isOverdue = isOverdue;
    if (isSecretCase !== undefined) query.isSecretCase = isSecretCase;
    if (batchId) query.batchId = batchId;
    
    if (startDate || endDate) {
      query.borrowDate = {};
      if (startDate) query.borrowDate.$gte = new Date(startDate);
      if (endDate) query.borrowDate.$lte = new Date(endDate);
    }
    
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [records, total] = await Promise.all([
      BorrowRecord.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      BorrowRecord.countDocuments(query)
    ]);
    
    const recordsWithExplanation = records.map(record => ({
      ...record.toObject(),
      currentStatusExplanation: record.getCurrentStatusExplanation()
    }));
    
    res.json({
      success: true,
      data: {
        records: recordsWithExplanation,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        },
        query: query
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

const getBatchList = async (req, res) => {
  try {
    const { status, batchType, createdBy, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (batchType) query.batchType = batchType;
    if (createdBy) query.createdBy = { $regex: createdBy, $options: 'i' };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [batches, total] = await Promise.all([
      Batch.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Batch.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: {
        batches,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询批次列表失败',
      error: error.message
    });
  }
};

const getStatistics = async (req, res) => {
  try {
    const [
      totalRecords,
      borrowedCount,
      overdueCount,
      secretCaseCount,
      pendingCount,
      returnedCount,
      batchCount,
      userCount
    ] = await Promise.all([
      BorrowRecord.countDocuments({}),
      BorrowRecord.countDocuments({ status: '已借出' }),
      BorrowRecord.countDocuments({ isOverdue: true }),
      BorrowRecord.countDocuments({ isSecretCase: true }),
      BorrowRecord.countDocuments({ status: { $in: ['待处理', '审批中', '涉密待审'] } }),
      BorrowRecord.countDocuments({ status: '已归还' }),
      Batch.countDocuments({}),
      UserPermission.countDocuments({})
    ]);
    
    const securityLevelStats = await BorrowRecord.aggregate([
      { $group: { _id: '$securityLevel', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const statusStats = await BorrowRecord.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const departmentStats = await BorrowRecord.aggregate([
      { $match: { borrowerDepartment: { $exists: true, $ne: '' } } },
      { $group: { _id: '$borrowerDepartment', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    res.json({
      success: true,
      data: {
        overview: {
          totalRecords,
          borrowedCount,
          overdueCount,
          secretCaseCount,
          pendingCount,
          returnedCount,
          batchCount,
          userCount
        },
        bySecurityLevel: securityLevelStats,
        byStatus: statusStats,
        byDepartment: departmentStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取统计数据失败',
      error: error.message
    });
  }
};

const getOperationLogs = async (req, res) => {
  try {
    const { recordId, action, operator, startDate, endDate, page = 1, limit = 50 } = req.body;
    
    const match = {};
    
    if (recordId) {
      const record = await BorrowRecord.findOne({ recordId });
      if (!record) {
        return res.status(404).json({
          success: false,
          message: '记录不存在'
        });
      }
      match._id = record._id;
    }
    
    const pipeline = [
      { $match: match },
      { $unwind: '$operationHistory' },
      { $sort: { 'operationHistory.timestamp': -1 } }
    ];
    
    if (action) {
      pipeline.splice(2, 0, { $match: { 'operationHistory.action': action } });
    }
    if (operator) {
      pipeline.splice(2, 0, { $match: { 'operationHistory.operator': { $regex: operator, $options: 'i' } } });
    }
    if (startDate || endDate) {
      const dateMatch = {};
      if (startDate) dateMatch.$gte = new Date(startDate);
      if (endDate) dateMatch.$lte = new Date(endDate);
      pipeline.splice(2, 0, { $match: { 'operationHistory.timestamp': dateMatch } });
    }
    
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await BorrowRecord.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push({ $skip: skip }, { $limit: parseInt(limit) });
    
    const logs = await BorrowRecord.aggregate(pipeline);
    
    const formattedLogs = logs.map(log => ({
      recordId: log.recordId,
      caseId: log.caseId,
      caseTitle: log.caseTitle,
      borrowerName: log.borrowerName,
      action: log.operationHistory.action,
      operator: log.operationHistory.operator,
      reason: log.operationHistory.reason,
      readableReason: log.operationHistory.readableReason,
      comment: log.operationHistory.comment,
      timestamp: log.operationHistory.timestamp,
      timestampFormatted: log.operationHistory.timestamp.toLocaleString('zh-CN')
    }));
    
    res.json({
      success: true,
      data: {
        logs: formattedLogs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取操作日志失败',
      error: error.message
    });
  }
};

module.exports = {
  queryHistory,
  getBatchList,
  getStatistics,
  getOperationLogs
};
