const HistoryService = require('../services/historyService');

class HistoryController {
  static async getHistories(req, res) {
    try {
      const { page = 1, pageSize = 20, operator, action, recordId } = req.query;

      if (recordId) {
        const histories = await HistoryService.getHistoriesByRecordId(recordId);
        return res.json({ success: true, data: histories });
      }

      const result = await HistoryService.getAllHistories({
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        operator,
        action
      });

      res.json({
        success: true,
        data: result.rows,
        total: result.count,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async addHistory(req, res) {
    try {
      const { recordId, action, operator, previousStatus, newStatus, reason, remark } = req.body;

      const history = await HistoryService.addHistory(
        recordId,
        action,
        operator,
        { previousStatus, newStatus, reason, remark }
      );

      res.status(201).json({ success: true, data: history });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = HistoryController;
