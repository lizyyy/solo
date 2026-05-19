const ExportService = require('../services/ExportService');
const OperationLog = require('../models/OperationLog');
const fs = require('fs');
const path = require('path');

class ExportController {
  static async exportCleaning(req, res) {
    try {
      const filters = {
        cleaner_name: req.query.cleaner_name,
        room_number: req.query.room_number,
        status: req.query.status,
        has_issue: req.query.has_issue,
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };

      const filePath = await ExportService.exportCleaningRecords(filters);
      const fileName = path.basename(filePath);

      await OperationLog.log(
        'export',
        'cleaning_records',
        null,
        req.query.operator_name || 'system',
        `导出保洁记录CSV文件`,
        null,
        { fileName }
      );

      res.download(filePath, fileName, (err) => {
        if (err) {
          res.status(500).json({
            success: false,
            error: '文件下载失败'
          });
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async exportComplaints(req, res) {
    try {
      const filters = {
        handler_name: req.query.handler_name,
        room_number: req.query.room_number,
        status: req.query.status,
        complaint_type: req.query.complaint_type,
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };

      const filePath = await ExportService.exportComplaints(filters);
      const fileName = path.basename(filePath);

      await OperationLog.log(
        'export',
        'complaints',
        null,
        req.query.operator_name || 'system',
        `导出客诉记录CSV文件`,
        null,
        { fileName }
      );

      res.download(filePath, fileName, (err) => {
        if (err) {
          res.status(500).json({
            success: false,
            error: '文件下载失败'
          });
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async exportReworks(req, res) {
    try {
      const filters = {
        original_cleaner: req.query.original_cleaner,
        reworker_name: req.query.reworker_name,
        room_number: req.query.room_number,
        status: req.query.status,
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };

      const filePath = await ExportService.exportReworks(filters);
      const fileName = path.basename(filePath);

      await OperationLog.log(
        'export',
        'reworks',
        null,
        req.query.operator_name || 'system',
        `导出返工记录CSV文件`,
        null,
        { fileName }
      );

      res.download(filePath, fileName, (err) => {
        if (err) {
          res.status(500).json({
            success: false,
            error: '文件下载失败'
          });
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async exportSettlements(req, res) {
    try {
      const filters = {
        cleaner_name: req.query.cleaner_name,
        settlement_month: req.query.settlement_month,
        status: req.query.status
      };

      const filePath = await ExportService.exportSettlements(filters);
      const fileName = path.basename(filePath);

      await OperationLog.log(
        'export',
        'settlements',
        null,
        req.query.operator_name || 'system',
        `导出结算记录CSV文件`,
        null,
        { fileName }
      );

      res.download(filePath, fileName, (err) => {
        if (err) {
          res.status(500).json({
            success: false,
            error: '文件下载失败'
          });
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async exportMonthlyReport(req, res) {
    try {
      const { month, cleaner_name } = req.query;

      if (!month) {
        return res.status(400).json({
          success: false,
          error: '结算月份不能为空'
        });
      }

      const result = await ExportService.exportAllByMonth(month, cleaner_name);

      await OperationLog.log(
        'export',
        'reports',
        null,
        req.query.operator_name || 'system',
        `导出月度报告-${month}`,
        null,
        result
      );

      res.json({
        success: true,
        message: '月度报告生成成功',
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async downloadFile(req, res) {
    try {
      const { filename } = req.params;
      const filePath = ExportService.getExportFilePath(filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          error: '文件不存在'
        });
      }

      res.download(filePath, filename, (err) => {
        if (err) {
          res.status(500).json({
            success: false,
            error: '文件下载失败'
          });
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = ExportController;