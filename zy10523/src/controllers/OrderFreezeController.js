const OrderFreezeService = require('../services/OrderFreezeService');
const ExportService = require('../services/ExportService');

const getOperatorInfo = (req) => {
  return {
    operator: req.headers['x-operator'] || 'system',
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent']
  };
};

class OrderFreezeController {
  static async createFreeze(req, res) {
    try {
      const operatorInfo = getOperatorInfo(req);
      const result = await OrderFreezeService.createFreeze(req.validatedData, operatorInfo);
      res.status(201).json({
        success: true,
        data: result,
        message: '订单冻结创建成功'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const result = await OrderFreezeService.getById(id);
      
      if (!result) {
        return res.status(404).json({
          success: false,
          error: '冻结记录不存在'
        });
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  static async query(req, res) {
    try {
      const { status, orderNo, reviewer, startTime, endTime, page, pageSize } = req.validatedQuery;
      
      const filters = { status, orderNo, reviewer, startTime, endTime };
      const pagination = {
        offset: (page - 1) * pageSize,
        limit: pageSize
      };

      const result = await OrderFreezeService.query(filters, pagination);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  static async submitForReview(req, res) {
    try {
      const { id } = req.params;
      const { reviewer } = req.validatedData;
      const operatorInfo = getOperatorInfo(req);
      
      const result = await OrderFreezeService.submitForReview(id, reviewer, operatorInfo);
      
      res.json({
        success: true,
        data: result,
        message: '已提交复核'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  static async release(req, res) {
    try {
      const { id } = req.params;
      const { finalConclusion } = req.validatedData;
      const operatorInfo = getOperatorInfo(req);
      
      const result = await OrderFreezeService.release(id, finalConclusion, operatorInfo);
      
      res.json({
        success: true,
        data: result,
        message: '订单冻结已释放'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  static async cancel(req, res) {
    try {
      const { id } = req.params;
      const { finalConclusion } = req.validatedData;
      const operatorInfo = getOperatorInfo(req);
      
      const result = await OrderFreezeService.cancel(id, finalConclusion, operatorInfo);
      
      res.json({
        success: true,
        data: result,
        message: '订单冻结已取消'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  static async manualCorrect(req, res) {
    try {
      const { id } = req.params;
      const operatorInfo = getOperatorInfo(req);
      
      const result = await OrderFreezeService.manualCorrect(id, req.validatedData, operatorInfo);
      
      res.json({
        success: true,
        data: result,
        message: '人工修正成功'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  static async checkAndIntercept(req, res) {
    try {
      const { orderNo, interceptType, requestData } = req.validatedData;
      
      const result = await OrderFreezeService.checkAndIntercept(orderNo, interceptType, requestData);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  static async getOperationLogs(req, res) {
    try {
      const { id } = req.params;
      const logs = await OrderFreezeService.getOperationLogs(id);
      
      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  static async addProcessingSummary(req, res) {
    try {
      const { id } = req.params;
      const { summary } = req.validatedData;
      const operatorInfo = getOperatorInfo(req);
      
      const result = await OrderFreezeService.addProcessingSummary(id, summary, operatorInfo);
      
      res.json({
        success: true,
        data: result,
        message: '处理摘要已添加'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  static async recordException(req, res) {
    try {
      const { id } = req.params;
      const { errorInfo, originalInput } = req.validatedData;
      const operatorInfo = getOperatorInfo(req);
      
      const result = await OrderFreezeService.recordException(id, errorInfo, originalInput, operatorInfo);
      
      res.json({
        success: true,
        data: result,
        message: '异常已记录'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  static async exportFreezeRecords(req, res) {
    try {
      const { status, orderNo, reviewer, startTime, endTime } = req.query;
      const filters = { status, orderNo, reviewer, startTime, endTime };
      
      const result = await ExportService.exportFreezeRecords(filters);
      
      res.json({
        success: true,
        data: result,
        message: '导出成功'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  static async exportOperationLogs(req, res) {
    try {
      const { freezeId } = req.query;
      const result = await ExportService.exportOperationLogs(freezeId);
      
      res.json({
        success: true,
        data: result,
        message: '导出成功'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  static async exportFullTrace(req, res) {
    try {
      const { id } = req.params;
      const result = await ExportService.exportFullTrace(id);
      
      res.json({
        success: true,
        data: result,
        message: '导出成功'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  static async listExportFiles(req, res) {
    try {
      const files = await ExportService.listExportFiles();
      
      res.json({
        success: true,
        data: files
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  static async downloadExport(req, res) {
    try {
      const { filename } = req.params;
      const file = await ExportService.getExportFile(filename);
      
      if (!file) {
        return res.status(404).json({
          success: false,
          error: '文件不存在'
        });
      }

      res.download(file.filepath, filename);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = OrderFreezeController;
