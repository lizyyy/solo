const BatchService = require('../services/batchService');

class BatchController {
  static async create(req, res) {
    try {
      const { check_date, created_by } = req.body;
      
      if (!check_date || !created_by) {
        return res.status(400).json({
          success: false,
          message: '缺少必要参数: check_date, created_by'
        });
      }

      const batch = await BatchService.createBatch({ check_date, created_by });
      
      res.json({
        success: true,
        data: batch,
        message: '批次创建成功'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const batch = await BatchService.getBatchById(id);
      
      if (!batch) {
        return res.status(404).json({
          success: false,
          message: '批次不存在'
        });
      }

      res.json({
        success: true,
        data: batch
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getByNo(req, res) {
    try {
      const { batch_no } = req.params;
      const batch = await BatchService.getBatchByNo(batch_no);
      
      if (!batch) {
        return res.status(404).json({
          success: false,
          message: '批次不存在'
        });
      }

      res.json({
        success: true,
        data: batch
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async list(req, res) {
    try {
      const { page = 1, pageSize = 20 } = req.query;
      const batches = await BatchService.listBatches(parseInt(page), parseInt(pageSize));
      
      res.json({
        success: true,
        data: batches
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = BatchController;