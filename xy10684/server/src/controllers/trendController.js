const TrendService = require('../services/trendService');

class TrendController {
  static async calculate(req, res) {
    try {
      const { periodType, startDate, endDate } = req.body;
      const result = await TrendService.calculateTrend(periodType, startDate, endDate);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async list(req, res) {
    try {
      const result = await TrendService.getTrends(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async statistics(req, res) {
    try {
      const result = await TrendService.getStatistics();
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = TrendController;
