const TaskService = require('../services/taskService');
const ExportService = require('../services/exportService');

class TaskController {
  static async submitMaterials(req, res) {
    try {
      const { submitter, materials } = req.body;
      
      if (!submitter || !materials || !Array.isArray(materials) || materials.length === 0) {
        return res.status(400).json({
          success: false,
          message: '提交人不能为空，且材料必须是非空数组'
        });
      }

      const result = await TaskService.submitMaterials(submitter, materials);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('提交材料失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async updateTaskStatus(req, res) {
    try {
      const { taskId } = req.params;
      const { newStatus, operator, changeReason } = req.body;

      if (!newStatus || !operator || !changeReason) {
        return res.status(400).json({
          success: false,
          message: '新状态、操作人和修改原因不能为空'
        });
      }

      const result = await TaskService.updateTaskStatus(taskId, newStatus, operator, changeReason);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('更新任务状态失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getTaskDetail(req, res) {
    try {
      const { taskId } = req.params;
      const result = await TaskService.getTaskDetail(taskId);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('获取任务详情失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getTaskList(req, res) {
    try {
      const { status } = req.query;
      const filters = {};
      if (status) filters.status = status;
      
      const tasks = await TaskService.getTaskList(filters);
      
      res.json({
        success: true,
        data: tasks
      });
    } catch (error) {
      console.error('获取任务列表失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getStatistics(req, res) {
    try {
      const stats = await TaskService.getStatistics();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('获取统计信息失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getAuditLogs(req, res) {
    try {
      const { taskId } = req.params;
      const logs = await TaskService.getAuditLogs(taskId);
      
      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      console.error('获取审计日志失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async exportTask(req, res) {
    try {
      const { taskId } = req.params;
      const { exportedBy, format } = req.body;

      if (!exportedBy) {
        return res.status(400).json({
          success: false,
          message: '导出人不能为空'
        });
      }

      if (format === 'csv') {
        const result = await ExportService.exportToCSV(taskId, exportedBy);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="task-${taskId}.csv"`);
        res.send(result.csv);
      } else {
        const result = await ExportService.exportTask(taskId, exportedBy);
        res.json({
          success: true,
          data: result
        });
      }
    } catch (error) {
      console.error('导出任务失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getExportHistory(req, res) {
    try {
      const { taskId } = req.params;
      const history = await ExportService.getExportHistory(taskId);
      
      res.json({
        success: true,
        data: history
      });
    } catch (error) {
      console.error('获取导出历史失败:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = TaskController;