const TaskService = require('../services/taskService');
const LogService = require('../services/logService');

class TaskController {
  static async create(req, res) {
    try {
      const operator = req.headers['x-operator'] || 'system';
      const result = await TaskService.createTask(req.body.surveyId, operator);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async complete(req, res) {
    try {
      const operator = req.headers['x-operator'] || 'system';
      const result = await TaskService.completeTask(req.params.id, req.body.remedyResult, operator);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async review(req, res) {
    try {
      const operator = req.headers['x-operator'] || 'system';
      const { reviewResult, reviewRemark } = req.body;
      const result = await TaskService.reviewTask(req.params.id, reviewResult, reviewRemark, operator);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async list(req, res) {
    try {
      const result = await TaskService.getTaskList(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async timeline(req, res) {
    try {
      const result = await LogService.getTimeline('task', req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = TaskController;
