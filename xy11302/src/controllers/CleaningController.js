const CleaningRecord = require('../models/CleaningRecord');
const OperationLog = require('../models/OperationLog');

class CleaningController {
  static async create(req, res) {
    try {
      const data = req.body;
      const record = await CleaningRecord.create(data);
      
      await OperationLog.log(
        'create',
        'cleaning_records',
        record.id,
        req.body.operator_name || 'system',
        `创建保洁记录-${data.room_number}`
      );

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

  static async getAll(req, res) {
    try {
      const filters = {
        cleaner_name: req.query.cleaner_name,
        room_number: req.query.room_number,
        status: req.query.status,
        has_issue: req.query.has_issue,
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };

      const records = await CleaningRecord.findAll(filters);
      const stats = await CleaningRecord.getStats(filters);

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
      const record = await CleaningRecord.findById(req.params.id);
      
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
      const oldRecord = await CleaningRecord.findById(id);
      
      if (!oldRecord) {
        return res.status(404).json({
          success: false,
          error: '记录不存在'
        });
      }

      await CleaningRecord.update(id, req.body);
      const updatedRecord = await CleaningRecord.findById(id);

      await OperationLog.log(
        'update',
        'cleaning_records',
        id,
        req.body.operator_name || 'system',
        `更新保洁记录-${oldRecord.room_number}`,
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
      const { reviewer_name, status, issue_description } = req.body;

      if (!reviewer_name || !status) {
        return res.status(400).json({
          success: false,
          error: '复核人姓名和状态不能为空'
        });
      }

      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: '状态值不正确，应为approved或rejected'
        });
      }

      const oldRecord = await CleaningRecord.findById(id);
      if (!oldRecord) {
        return res.status(404).json({
          success: false,
          error: '记录不存在'
        });
      }

      await CleaningRecord.review(id, reviewer_name, status, issue_description);
      const updatedRecord = await CleaningRecord.findById(id);

      await OperationLog.log(
        'review',
        'cleaning_records',
        id,
        reviewer_name,
        `复核保洁记录-${oldRecord.room_number}，状态：${status}`,
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

      const stats = await CleaningRecord.getStats(filters);

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

module.exports = CleaningController;