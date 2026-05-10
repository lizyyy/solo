const { HistoryRecord } = require('../models');

class HistoryService {
  static async record(shortageId, operationType, content, operator = null, beforeSnapshot = null, afterSnapshot = null) {
    try {
      const record = await HistoryRecord.create({
        shortageId,
        operationType,
        operator,
        content,
        beforeSnapshot: beforeSnapshot ? JSON.stringify(beforeSnapshot) : null,
        afterSnapshot: afterSnapshot ? JSON.stringify(afterSnapshot) : null
      });
      return record;
    } catch (error) {
      console.error('记录历史失败:', error);
      throw error;
    }
  }

  static async getHistory(shortageId) {
    try {
      const records = await HistoryRecord.findAll({
        where: { shortageId },
        order: [['createdAt', 'DESC']]
      });
      return records.map(record => ({
        id: record.id,
        operationType: record.operationType,
        operator: record.operator,
        content: record.content,
        beforeSnapshot: record.beforeSnapshot ? JSON.parse(record.beforeSnapshot) : null,
        afterSnapshot: record.afterSnapshot ? JSON.parse(record.afterSnapshot) : null,
        createdAt: record.createdAt
      }));
    } catch (error) {
      console.error('获取历史记录失败:', error);
      throw error;
    }
  }
}

module.exports = HistoryService;
