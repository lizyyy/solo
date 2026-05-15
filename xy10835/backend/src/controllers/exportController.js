const ExportService = require('../services/exportService');
const { OperationEventDAO, UserDAO } = require('../database/dao');

const mockOperator = {
  id: 'mock-user-001',
  name: '合规管理员',
  username: 'compliance_admin',
  role: 'admin'
};

const ExportController = {
  async createExport(req, res) {
    try {
      const { task_name, filter_snapshot } = req.body;
      
      if (!filter_snapshot) {
        return res.status(400).json({
          success: false,
          message: '缺少筛选条件'
        });
      }

      const task = await ExportService.createTask({
        task_name,
        filter_snapshot
      }, mockOperator);

      res.json({
        success: true,
        data: task,
        message: '导出任务创建成功'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  async getTaskList(req, res) {
    try {
      const { limit, offset } = req.query;
      const tasks = await ExportService.getTaskList(
        null,
        parseInt(limit) || 50,
        parseInt(offset) || 0
      );

      res.json({
        success: true,
        data: tasks
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  async getTaskDetail(req, res) {
    try {
      const { id } = req.params;
      const detail = await ExportService.getTaskDetail(id);

      res.json({
        success: true,
        data: detail
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  },

  async retryTask(req, res) {
    try {
      const { id } = req.params;
      const task = await ExportService.retryTask(id, mockOperator);

      res.json({
        success: true,
        data: task,
        message: '任务重试成功'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  async correctAndRetry(req, res) {
    try {
      const { id } = req.params;
      const { filter_snapshot } = req.body;

      const task = await ExportService.correctAndRetry(id, filter_snapshot, mockOperator);

      res.json({
        success: true,
        data: task,
        message: '修正成功，任务已重新处理'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  async downloadExport(req, res) {
    try {
      const { id } = req.params;
      const filePath = await ExportService.downloadTask(id, mockOperator);

      res.download(filePath, (err) => {
        if (err) {
          res.status(500).json({
            success: false,
            message: '下载失败'
          });
        }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  async grantPermission(req, res) {
    try {
      const { id } = req.params;
      const { target_user_id } = req.body;

      const permission = await ExportService.grantDownloadPermission(
        id, target_user_id, mockOperator
      );

      res.json({
        success: true,
        data: permission,
        message: '授权成功'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  },

  async getOperationEvents(req, res) {
    try {
      const filters = req.query;
      const parsedFilters = {
        operator_ids: filters.operator_ids ? filters.operator_ids.split(',') : undefined,
        start_time: filters.start_time,
        end_time: filters.end_time,
        event_types: filters.event_types ? filters.event_types.split(',') : undefined,
        modules: filters.modules ? filters.modules.split(',') : undefined,
        statuses: filters.statuses ? filters.statuses.split(',') : undefined
      };

      const events = await OperationEventDAO.query(
        parsedFilters,
        parseInt(filters.limit) || 100,
        parseInt(filters.offset) || 0
      );

      const total = await OperationEventDAO.count(parsedFilters);

      res.json({
        success: true,
        data: {
          list: events,
          total: total
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  async getUsers(req, res) {
    try {
      const users = await UserDAO.getAll();
      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
};

module.exports = ExportController;
