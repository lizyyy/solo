const ResultService = require('../services/resultService');
const LogService = require('../services/logService');

class ResultController {
  static async create(req, res) {
    try {
      const operator = req.headers['x-operator'] || 'system';
      const result = await ResultService.createResult(req.body, operator);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async list(req, res) {
    try {
      const result = await ResultService.getResultList(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async detail(req, res) {
    try {
      const result = await ResultService.getResultDetail(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async timeline(req, res) {
    try {
      const result = await LogService.getTimeline('result', req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = ResultController;
