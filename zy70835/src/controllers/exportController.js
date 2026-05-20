const ExportService = require('../services/exportService');
const path = require('path');

class ExportController {
  static async exportCSV(req, res) {
    try {
      const { check_date } = req.params;
      
      if (!check_date) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数: check_date'
        });
      }

      const result = await ExportService.exportToCSV(check_date);
      
      res.json({
        success: true,
        data: result,
        message: '导出成功'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async downloadCSV(req, res) {
    try {
      const { check_date } = req.params;
      
      if (!check_date) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数: check_date'
        });
      }

      const result = await ExportService.exportToCSV(check_date);
      
      res.download(result.filePath, result.fileName, (err) => {
        if (err) {
          res.status(500).json({
            success: false,
            message: '文件下载失败'
          });
        }
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
      const { check_date } = req.params;
      
      if (!check_date) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数: check_date'
        });
      }

      const statistics = await ExportService.getStatistics(check_date);
      
      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = ExportController;