const lossReportService = require('../services/lossReportService');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

class LossReportController {
  async createReport(req, res) {
    try {
      const result = await lossReportService.createReport(req.body);
      res.status(201).json({
        success: true,
        message: '报损记录创建成功',
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: '创建报损记录失败',
        error: error.message
      });
    }
  }

  async batchImport(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '请上传CSV文件'
        });
      }

      const reports = [];
      const filePath = req.file.path;

      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (row) => {
            reports.push(row);
          })
          .on('end', resolve)
          .on('error', reject);
      });

      fs.unlinkSync(filePath);

      const result = await lossReportService.batchCreateReports(reports);
      
      res.status(200).json({
        success: true,
        message: `批量导入完成：成功 ${result.success} 条，失败 ${result.failed} 条`,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: '批量导入失败',
        error: error.message
      });
    }
  }

  async getReport(req, res) {
    try {
      const { id } = req.params;
      const report = await lossReportService.getReportById(id);
      
      if (!report) {
        return res.status(404).json({
          success: false,
          message: '报损记录不存在'
        });
      }

      res.status(200).json({
        success: true,
        data: report
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: '获取报损记录失败',
        error: error.message
      });
    }
  }

  async getReports(req, res) {
    try {
      const reports = await lossReportService.getReports(req.query);
      res.status(200).json({
        success: true,
        total: reports.length,
        data: reports
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: '获取报损记录列表失败',
        error: error.message
      });
    }
  }

  async updateReport(req, res) {
    try {
      const { id } = req.params;
      const result = await lossReportService.updateReport(id, req.body);
      
      res.status(200).json({
        success: true,
        message: '报损记录更新成功',
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: '更新报损记录失败',
        error: error.message
      });
    }
  }

  async auditReport(req, res) {
    try {
      const { id } = req.params;
      const result = await lossReportService.auditReport(id, req.body);
      
      res.status(200).json({
        success: true,
        message: '审核完成',
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: '审核失败',
        error: error.message
      });
    }
  }

  async exportReports(req, res) {
    try {
      const data = await lossReportService.exportReports(req.query);
      
      const fields = Object.keys(data[0] || {});
      const json2csvParser = new Parser({ fields });
      const csvData = json2csvParser.parse(data);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=vegetable_loss_report_${Date.now()}.csv`);
      
      res.status(200).send('\uFEFF' + csvData);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: '导出失败',
        error: error.message
      });
    }
  }
}

module.exports = new LossReportController();
