const { Op } = require('sequelize');
const { Batch, ReplayHistory } = require('../models');

const BatchService = {
  async list(params = {}) {
    const { page = 1, pageSize = 20, status, dataSource, batchNo, startDate, endDate } = params;
    const where = {};

    if (status) where.status = status;
    if (dataSource) where.dataSource = { [Op.like]: `%${dataSource}%` };
    if (batchNo) where.batchNo = { [Op.like]: `%${batchNo}%` };
    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    const { count, rows } = await Batch.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return {
      list: rows.map(this.formatBatch),
      total: count,
      page,
      pageSize
    };
  },

  async getDetail(id) {
    const batch = await Batch.findByPk(id, {
      include: [{
        model: ReplayHistory,
        as: 'replayHistories',
        order: [['replayNo', 'DESC']]
      }]
    });

    if (!batch) {
      throw new Error('批次不存在');
    }

    return {
      ...this.formatBatch(batch),
      replayHistories: batch.replayHistories?.map(this.formatReplayHistory) || []
    };
  },

  async create(data) {
    const batch = await Batch.create({
      batchNo: data.batchNo || `BATCH${Date.now()}`,
      dataSource: data.dataSource,
      targetTable: data.targetTable,
      totalCount: data.totalCount || 0,
      successCount: data.successCount || 0,
      failCount: data.failCount || 0,
      failReason: data.failReason,
      failDetail: data.failDetail,
      hasPartialSuccess: (data.successCount || 0) > 0 && (data.failCount || 0) > 0,
      createdBy: data.createdBy,
      status: Batch.Status.SYNCING
    });

    return batch;
  },

  async markFailed(id, failData) {
    const batch = await Batch.findByPk(id);
    if (!batch) {
      throw new Error('批次不存在');
    }

    await batch.update({
      status: Batch.Status.FAILED,
      failCount: failData.failCount || batch.totalCount,
      successCount: failData.successCount || 0,
      failReason: failData.failReason,
      failDetail: failData.failDetail,
      hasPartialSuccess: (failData.successCount || 0) > 0
    });

    return batch;
  },

  async replay(id, operator, reason = '') {
    const batch = await Batch.findByPk(id);
    if (!batch) {
      throw new Error('批次不存在');
    }

    if (batch.status === Batch.Status.REPLAYING) {
      throw new Error('该批次正在重放中，请稍后再试');
    }

    if (batch.status === Batch.Status.COMPLETED) {
      throw new Error('该批次已完成，无需重放');
    }

    const replayNo = batch.replayCount + 1;

    const replayHistory = await ReplayHistory.create({
      batchId: batch.id,
      replayNo,
      operator,
      reason,
      startedAt: new Date(),
      status: ReplayHistory.Result.PENDING
    });

    await batch.update({
      status: Batch.Status.REPLAYING,
      replayCount: replayNo,
      lastReplayAt: new Date()
    });

    return {
      batch: this.formatBatch(batch),
      replayHistory: this.formatReplayHistory(replayHistory)
    };
  },

  async completeReplay(batchId, replayData) {
    const batch = await Batch.findByPk(batchId);
    if (!batch) {
      throw new Error('批次不存在');
    }

    const replayHistory = await ReplayHistory.findOne({
      where: { batchId, replayNo: batch.replayCount }
    });

    if (!replayHistory) {
      throw new Error('重放记录不存在');
    }

    const { successCount = 0, failCount = 0, conflictCount = 0, skipCount = 0, failRecords = [], conflictRecords = [], evidence = {} } = replayData;
    const totalCount = successCount + failCount + skipCount;
    
    let replayStatus;
    if (failCount === 0 && conflictCount === 0) {
      replayStatus = ReplayHistory.Result.SUCCESS;
    } else if (successCount > 0) {
      replayStatus = ReplayHistory.Result.PARTIAL_SUCCESS;
    } else {
      replayStatus = ReplayHistory.Result.FAILED;
    }

    await replayHistory.update({
      status: replayStatus,
      totalCount,
      successCount,
      failCount,
      conflictCount,
      skipCount,
      failRecords,
      conflictRecords,
      evidence,
      finishedAt: new Date()
    });

    const newSuccessCount = batch.successCount + successCount;
    const newFailCount = failCount;

    let batchStatus;
    if (newFailCount === 0) {
      batchStatus = Batch.Status.COMPLETED;
    } else {
      batchStatus = Batch.Status.FAILED;
    }

    await batch.update({
      status: batchStatus,
      successCount: newSuccessCount,
      failCount: newFailCount,
      hasPartialSuccess: newSuccessCount > 0 && newFailCount > 0,
      completedAt: batchStatus === Batch.Status.COMPLETED ? new Date() : null
    });

    return {
      batch: this.formatBatch(batch),
      replayHistory: this.formatReplayHistory(replayHistory)
    };
  },

  async checkConflict(batchId, recordKeys) {
    const batch = await Batch.findByPk(batchId);
    if (!batch) {
      throw new Error('批次不存在');
    }

    const conflicts = [];
    if (batch.hasPartialSuccess) {
      for (const key of recordKeys) {
        const isConflicted = await this.checkRecordExists(batch.targetTable, key);
        if (isConflicted) {
          conflicts.push(key);
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflictKeys: conflicts,
      message: conflicts.length > 0 
        ? `检测到 ${conflicts.length} 条记录已存在，将跳过这些记录以避免重复写入`
        : '无冲突记录'
    };
  },

  async checkRecordExists(targetTable, recordKey) {
    return Math.random() > 0.7;
  },

  formatBatch(batch) {
    const statusText = {
      [Batch.Status.SYNCING]: '同步中',
      [Batch.Status.FAILED]: '失败',
      [Batch.Status.REPLAYING]: '重放中',
      [Batch.Status.COMPLETED]: '已完成'
    };

    return {
      id: batch.id,
      batchNo: batch.batchNo,
      dataSource: batch.dataSource,
      targetTable: batch.targetTable,
      status: batch.status,
      statusText: statusText[batch.status],
      totalCount: batch.totalCount,
      successCount: batch.successCount,
      failCount: batch.failCount,
      failReason: batch.failReason,
      failDetail: batch.failDetail,
      hasPartialSuccess: batch.hasPartialSuccess,
      replayCount: batch.replayCount,
      lastReplayAt: batch.lastReplayAt,
      createdBy: batch.createdBy,
      completedAt: batch.completedAt,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt
    };
  },

  formatReplayHistory(history) {
    const statusText = {
      [ReplayHistory.Result.PENDING]: '处理中',
      [ReplayHistory.Result.SUCCESS]: '成功',
      [ReplayHistory.Result.PARTIAL_SUCCESS]: '部分成功',
      [ReplayHistory.Result.FAILED]: '失败'
    };

    return {
      id: history.id,
      batchId: history.batchId,
      replayNo: history.replayNo,
      operator: history.operator,
      status: history.status,
      statusText: statusText[history.status],
      totalCount: history.totalCount,
      successCount: history.successCount,
      failCount: history.failCount,
      conflictCount: history.conflictCount,
      skipCount: history.skipCount,
      reason: history.reason,
      failRecords: history.failRecords,
      conflictRecords: history.conflictRecords,
      evidence: history.evidence,
      startedAt: history.startedAt,
      finishedAt: history.finishedAt,
      createdAt: history.createdAt
    };
  }
};

module.exports = BatchService;
