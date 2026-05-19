const Rework = require('../models/Rework');
const OperationLog = require('../models/OperationLog');

class ReworkController {
  static async create(req, res) {
    try {
      const data = req.body;
      const rework = await Rework.create(data);
      
      await OperationLog.log(
        'create',
        'reworks',
        rework.id,
        req.body.operator_name || 'system',
        `创建返工记录-${data.room_number}`
      );

      res.json({
        success: true,
        data: rework
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async getAll(req, res) {
    try {
      const filters = {
        original_cleaner: req.query.original_cleaner,
        reworker_name: req.query.reworker_name,
        room_number: req.query.room_number,
        status: req.query.status,
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };

      const records = await Rework.findAll(filters);
      const stats = await Rework.getStats(filters);

      res.json({
        success: true,
        data: records,
        summary: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async getById(req, res) {
    try {
      const record = await Rework.findById(req.params.id);
      
      if (!record) {
        return res.status(404).json({
          success: false,
          error: '记录不存在'
        });
      }

      res.json({
        success: true,
        data: record
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const oldRecord = await Rework.findById(id);
      
      if (!oldRecord) {
        return res.status(404).json({
          success: false,
          error: '记录不存在'
        });
      }

      await Rework.update(id, req.body);
      const updatedRecord = await Rework.findById(id);

      await OperationLog.log(
        'update',
        'reworks',
        id,
        req.body.operator_name || 'system',
        `更新返工记录-${oldRecord.room_number}`,
        oldRecord,
        updatedRecord
      );

      res.json({
        success: true,
        data: updatedRecord
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async review(req, res) {
    try {
      const { id } = req.params;
      const { reviewer_name, status, deduction_amount } = req.body;

      if (!reviewer_name || !status) {
        return res.status(400).json({
          success: false,
          error: '复核人姓名和状态不能为空'
        });
      }

      if (!['pending', 'completed'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: '状态值不正确，应为pending或completed'
        });
      }

      const oldRecord = await Rework.findById(id);
      if (!oldRecord) {
        return res.status(404).json({
          success: false,
          error: '记录不存在'
        });
      }

      await Rework.review(id, reviewer_name, status, deduction_amount || 0);
      const updatedRecord = await Rework.findById(id);

      await OperationLog.log(
        'review',
        'reworks',
        id,
        reviewer_name,
        `复核返工记录-${oldRecord.room_number}，状态：${status}，扣款：${deduction_amount || 0}元`,
        oldRecord,
        updatedRecord
      );

      res.json({
        success: true,
        data: updatedRecord,
        message: '复核完成'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async getStats(req, res) {
    try {
      const filters = {
        start: req.query.start_date,
        end: req.query.end_date
      };

      const stats = await Rework.getStats(filters);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = ReworkController;