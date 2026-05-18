const CompensationService = require('../services/CompensationService');
const fs = require('fs');
const csv = require('csv-parser');
const multer = require('multer');

const upload = multer({ dest: 'uploads/' });

class CompensationController {
  static async create(req, res) {
    try {
      const { compensationData, items } = req.body;
      const result = await CompensationService.createCompensation(compensationData, items || []);
      const response = {
        success: true,
        message: '赔付记录创建成功',
        data: { compensation_no: result.compensation_no }
      };
      if (result.warnings && result.warnings.length > 0) {
        response.warnings = result.warnings;
      }
      res.status(201).json(response);
    } catch (error) {
      if (error.type === 'VALIDATION_ERROR') {
        const response = {
          success: false,
          error: '数据验证失败',
          errors: error.errors
        };
        if (error.warnings && error.warnings.length > 0) {
          response.warnings = error.warnings;
        }
        res.status(400).json(response);
      } else if (error.type === 'DUPLICATE_RECORD') {
        res.status(409).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: '服务器内部错误',
          message: error.message
        });
      }
    }
  }

  static async get(req, res) {
    try {
      const { compensation_no } = req.params;
      const record = await CompensationService.getCompensation(compensation_no);
      res.json({
        success: true,
        data: record
      });
    } catch (error) {
      if (error.type === 'NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: '服务器内部错误',
          message: error.message
        });
      }
    }
  }

  static async list(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const result = await CompensationService.listCompensations(page, limit);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: '服务器内部错误',
        message: error.message
      });
    }
  }

  static async update(req, res) {
    try {
      const { compensation_no } = req.params;
      const { updateData, items } = req.body;
      const result = await CompensationService.updateCompensation(compensation_no, updateData, items);
      const response = {
        success: true,
        message: '赔付记录更新成功',
        data: { compensation_no, version: result.version }
      };
      if (result.warnings && result.warnings.length > 0) {
        response.warnings = result.warnings;
      }
      res.json(response);
    } catch (error) {
      if (error.type === 'NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: error.message
        });
      } else if (error.type === 'VALIDATION_ERROR') {
        const response = {
          success: false,
          error: '数据验证失败',
          errors: error.errors
        };
        if (error.warnings && error.warnings.length > 0) {
          response.warnings = error.warnings;
        }
        res.status(400).json(response);
      } else {
        res.status(500).json({
          success: false,
          error: '服务器内部错误',
          message: error.message
        });
      }
    }
  }

  static async exportCSV(req, res) {
    try {
      const csvData = await CompensationService.exportToCSV();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="compensation_records_${Date.now()}.csv"`);
      res.send('\ufeff' + csvData);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: '导出失败',
        message: error.message
      });
    }
  }

  static async importCSV(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: '请上传CSV文件'
        });
      }

      const records = [];
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => records.push(data))
        .on('end', async () => {
          try {
            fs.unlinkSync(req.file.path);
            const result = await CompensationService.importFromCSV(records);
            res.json({
              success: true,
              message: `导入完成：成功 ${result.success.length} 条，失败 ${result.failed.length} 条`,
              data: result
            });
          } catch (error) {
            res.status(500).json({
              success: false,
              error: '导入处理失败',
              message: error.message
            });
          }
        });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: '导入失败',
        message: error.message
      });
    }
  }
}

module.exports = { CompensationController, upload };
