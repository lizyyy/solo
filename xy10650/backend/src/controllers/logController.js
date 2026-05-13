const OperationLogService = require('../services/operationLog');

class LogController {
  static async list(req, res) {
    const { hazard_id, limit = 100 } = req.query;
    
    try {
      const logs = await OperationLogService.getLogs(hazard_id, parseInt(limit));
      res.json({ success: true, data: logs });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async timeline(req, res) {
    const { hazard_id } = req.params;
    
    try {
      const timeline = await OperationLogService.getTimeline(hazard_id);
      res.json({ success: true, data: timeline });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = LogController;