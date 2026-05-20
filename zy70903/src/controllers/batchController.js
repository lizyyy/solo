const BatchService = require('../services/batchService');
const ProcessService = require('../services/processService');
const ExportService = require('../services/exportService');

class BatchController {
  static async submitBatch(req, res) {
    try {
      const result = await BatchService.submitBatch(req.body);
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getBatchDetail(req, res) {
    try {
      const { id } = req.params;
      const result = await BatchService.getBatchDetail(id);
      if (!result) {
        return res.status(404).json({
          success: false,
          message: '批次不存在'
        });
      }
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getBatchList(req, res) {
    try {
      const result = await BatchService.getBatchList(req.query);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getStatistics(req, res) {
    try {
      const result = await BatchService.getStatistics();
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async submitTrialRun(req, res) {
    try {
      const { id } = req.params;
      const result = await ProcessService.submitTrialRun(id, req.body);
      res.json({
        success: true,
        data: result,
        message: '试运行记录提交成功'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async submitApproval(req, res) {
    try {
      const { id } = req.params;
      const result = await ProcessService.submitApproval(id, req.body);
      res.json({
        success: true,
        data: result,
        message: '审批记录提交成功'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async exportCSV(req, res) {
    try {
      const { id } = req.params;
      const csv = await ExportService.generateCSV(id);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="inspection_report_${id}.csv"`);
      res.send('\uFEFF' + csv);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = BatchController;
