const { ProcessHistory } = require('../models');

class HistoryService {
  static async addHistory(recordId, action, operator, options = {}) {
    const { previousStatus, newStatus, reason, remark } = options;
    return await ProcessHistory.create({
      recordId,
      action,
      previousStatus,
      newStatus,
      reason,
      operator,
      operatedAt: new Date(),
      remark
    });
  }

  static async getHistoriesByRecordId(recordId) {
    return await ProcessHistory.findAll({
      where: { recordId },
      order: [['operatedAt', 'DESC']]
    });
  }

  static async getAllHistories(options = {}) {
    const { page = 1, pageSize = 20, operator, action } = options;
    const where = {};
    if (operator) where.operator = operator;
    if (action) where.action = action;

    return await ProcessHistory.findAndCountAll({
      where,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [['operatedAt', 'DESC']]
    });
  }
}

module.exports = HistoryService;
