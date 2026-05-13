const SurveyService = require('../services/surveyService');
const LogService = require('../services/logService');

class SurveyController {
  static async create(req, res) {
    try {
      const operator = req.headers['x-operator'] || 'system';
      const result = await SurveyService.createSurvey(req.body, operator);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async update(req, res) {
    try {
      const operator = req.headers['x-operator'] || 'system';
      const result = await SurveyService.updateSurvey(req.params.id, req.body, operator);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async detail(req, res) {
    try {
      const result = await SurveyService.getSurveyDetail(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async list(req, res) {
    try {
      const result = await SurveyService.getSurveyList(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async timeline(req, res) {
    try {
      const result = await LogService.getTimeline('survey', req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = SurveyController;
