const { param, query, validationResult } = require('express-validator');
const TaskService = require('../services/taskService');

class TaskController {
  static validationRules = {
    retry: [
      param('id').isUUID().withMessage('Invalid task ID')
    ],
    list: [
      query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
      query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be 0 or greater')
    ]
  };

  static async list(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { limit = 20, offset = 0, status, name } = req.query;

    const result = await TaskService.getTasks({
      limit: parseInt(limit),
      offset: parseInt(offset),
      status,
      name
    });

    return res.status(200).json({
      success: true,
      tasks: result.rows,
      count: result.count
    });
  }

  static async retry(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;

    const result = await TaskService.retryTaskById(id);

    if (result.success) {
      return res.status(200).json(result);
    }

    return res.status(400).json(result);
  }

  static async retryAllFailed(req, res) {
    try {
      const results = await TaskService.retryFailedTasks();
      
      return res.status(200).json({
        success: true,
        message: `Processed ${results.length} failed tasks`,
        results
      });
    } catch (error) {
      console.error('Retry all failed tasks error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retry tasks'
      });
    }
  }
}

module.exports = TaskController;