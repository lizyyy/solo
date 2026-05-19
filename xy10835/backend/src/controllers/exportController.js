const ExportService = require('../services/exportService');
const { OperationEventDAO, UserDAO } = require('../database/dao');
const fs = require('fs');
const path = require('path');
const { parse } = require('json2csv');

async function getCurrentOperator(req) {
  const userId = req.currentUserId;
  if (userId) {
    const user = await UserDAO.getById(userId);
    if (user) {
      return user;
    }
  }
  const users = await UserDAO.getAll();
  if (users.length > 0) {
    return users[0];
  }
  return {
    id: 'default-admin',
    name: '系统管理员',
    username: 'admin',
    role: 'admin'
  };
}

const ImportHistory = [];

const ExportController = {
  async createExport(req, res) {
    try {
      const operator = await getCurrentOperator(req);
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
      }, operator);

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
      const tasks = await ExportService.getTaskList();

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
      const operator = await getCurrentOperator(req);
      const { id } = req.params;
      const task = await ExportService.retryTask(id, operator);

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
      const operator = await getCurrentOperator(req);
      const { id } = req.params;
      const { filter_snapshot } = req.body;

      const task = await ExportService.correctAndRetry(id, filter_snapshot, operator);

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
      const operator = await getCurrentOperator(req);
      const { id } = req.params;
      const filePath = await ExportService.downloadTask(id, operator);

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
      const operator = await getCurrentOperator(req);
      const { id } = req.params;
      const { target_user_id } = req.body;

      const permission = await ExportService.grantDownloadPermission(
        id, target_user_id, operator
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
  },

  async importEvents(req, res) {
    try {
      const operator = await getCurrentOperator(req);
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '请上传 CSV 文件'
        });
      }

      const filePath = req.file.path;
      const fileContent = fs.readFileSync(filePath, 'utf8');
      
      const lines = fileContent.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      const eventTypeIdx = headers.findIndex(h => 
        h.includes('事件类型') || h.includes('event_type') || h.includes('type')
      );
      const moduleIdx = headers.findIndex(h => 
        h.includes('模块') || h.includes('module')
      );
      const operatorNameIdx = headers.findIndex(h => 
        h.includes('操作人') || h.includes('操作员') || h.includes('operator')
      );
      const ipIdx = headers.findIndex(h => 
        h.includes('IP') || h.includes('ip')
      );
      const detailsIdx = headers.findIndex(h => 
        h.includes('详情') || h.includes('details')
      );
      const statusIdx = headers.findIndex(h => 
        h.includes('状态') || h.includes('status')
      );
      const timeIdx = headers.findIndex(h => 
        h.includes('时间') || h.includes('time')
      );

      let successCount = 0;
      let failCount = 0;
      const errors = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',').map(v => v.trim());
        
        try {
          const eventType = eventTypeIdx >= 0 ? values[eventTypeIdx] : 'view';
          const module = moduleIdx >= 0 ? values[moduleIdx] : '批量导入';
          const operatorName = operatorNameIdx >= 0 ? values[operatorNameIdx] : '系统导入';
          const ip = ipIdx >= 0 ? values[ipIdx] : '127.0.0.1';
          const details = detailsIdx >= 0 ? values[detailsIdx] : '批量导入操作日志';
          const status = statusIdx >= 0 ? values[statusIdx] || 'success' : 'success';
          const createdAt = timeIdx >= 0 && values[timeIdx] ? new Date(values[timeIdx]).toISOString() : new Date().toISOString();

          await OperationEventDAO.create({
            event_type: eventType,
            module: module,
            operator_id: operator.id,
            operator_name: operatorName,
            ip_address: ip,
            details: details,
            status: status,
            created_at: createdAt
          });
          
          successCount++;
        } catch (e) {
          failCount++;
          errors.push(`行 ${i + 1}: ${e.message}`);
        }
      }

      const importRecord = {
        id: Date.now().toString(),
        file_name: req.file.originalname,
        operator_id: operator.id,
        operator_name: operator.name,
        success_count: successCount,
        fail_count: failCount,
        created_at: new Date().toISOString(),
        errors: errors.slice(0, 10)
      };
      ImportHistory.unshift(importRecord);

      res.json({
        success: true,
        data: {
          success_count: successCount,
          fail_count: failCount,
          errors: errors.slice(0, 10)
        },
        message: `导入完成：成功 ${successCount} 条，失败 ${failCount} 条`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '导入失败: ' + error.message
      });
    }
  },

  async getImportHistory(req, res) {
    try {
      res.json({
        success: true,
        data: ImportHistory
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
