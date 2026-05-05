const store = require('../store');
const analysisService = require('../services/analysisService');
const reportService = require('../services/reportService');

class TaskController {
  createTask(req, res) {
    try {
      const { name, description, messageIds, consumerGroup, speed } = req.body;

      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'name is required'
        });
      }

      if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'messageIds must be a non-empty array'
        });
      }

      const task = store.addReplayTask({
        name,
        description,
        messageIds,
        consumerGroup,
        speed: speed || 1
      });

      res.json({
        success: true,
        message: 'Task created successfully',
        data: task.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getTask(req, res) {
    try {
      const { id } = req.params;
      const task = store.getReplayTask(id);

      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found'
        });
      }

      res.json({
        success: true,
        data: task.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getAllTasks(req, res) {
    try {
      const tasks = store.getAllReplayTasks();
      res.json({
        success: true,
        count: tasks.length,
        data: tasks.map(t => t.toJSON())
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  updateTask(req, res) {
    try {
      const { id } = req.params;
      const { name, description, messageIds, consumerGroup, speed, status } = req.body;

      const task = store.getReplayTask(id);
      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found'
        });
      }

      const updates = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (messageIds !== undefined) updates.messageIds = messageIds;
      if (consumerGroup !== undefined) updates.consumerGroup = consumerGroup;
      if (speed !== undefined) updates.speed = speed;
      if (status !== undefined) updates.status = status;

      const updatedTask = store.updateReplayTask(id, updates);
      res.json({
        success: true,
        message: 'Task updated successfully',
        data: updatedTask.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  executeTask(req, res) {
    try {
      const { id } = req.params;
      const task = store.getReplayTask(id);

      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found'
        });
      }

      store.updateReplayTask(id, {
        status: 'running',
        startTime: new Date()
      });

      const result = analysisService.batchAnalyze(task.messageIds, id);

      store.updateReplayTask(id, {
        status: result.failed > 0 ? 'completed_with_errors' : 'completed',
        endTime: new Date(),
        results: result
      });

      const updatedTask = store.getReplayTask(id);

      res.json({
        success: true,
        message: 'Task executed successfully',
        data: {
          task: updatedTask.toJSON(),
          analysisResults: result
        }
      });
    } catch (error) {
      store.updateReplayTask(req.params.id, {
        status: 'failed',
        endTime: new Date()
      });

      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  generateTaskReport(req, res) {
    try {
      const { id } = req.params;
      const { format } = req.query;

      const task = store.getReplayTask(id);
      if (!task) {
        return res.status(404).json({
          success: false,
          error: 'Task not found'
        });
      }

      let report;
      if (format === 'json') {
        report = reportService.generateJSONReport(id);
      } else {
        report = reportService.generateMarkdownReport(id);
      }

      res.json({
        success: true,
        message: 'Report generated successfully',
        data: report.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new TaskController();
