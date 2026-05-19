const Complaint = require('../models/Complaint');
const OperationLog = require('../models/OperationLog');

class ComplaintController {
  static async create(req, res) {
    try {
      const data = req.body;
      const complaint = await Complaint.create(data);
      
      await OperationLog.log(
        'create',
        'complaints',
        complaint.id,
        req.body.operator_name || 'system',
        `创建客诉记录-${data.complaint_type}`
      );

      res.json({
        success: true,
        data: complaint
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
        handler_name: req.query.handler_name,
        room_number: req.query.room_number,
        status: req.query.status,
        complaint_type: req.query.complaint_type,
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };

      const records = await Complaint.findAll(filters);
      const stats = await Complaint.getStats(filters);

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
      const record = await Complaint.findById(req.params.id);
      
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
      const oldRecord = await Complaint.findById(id);
      
      if (!oldRecord) {
        return res.status(404).json({
          success: false,
          error: '记录不存在'
        });
      }

      await Complaint.update(id, req.body);
      const updatedRecord = await Complaint.findById(id);

      await OperationLog.log(
        'update',
        'complaints',
        id,
        req.body.operator_name || 'system',
        `更新客诉记录-${oldRecord.complaint_type}`,
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

  static async handle(req, res) {
    try {
      const { id } = req.params;
      const { handler_name, status, handling_result, deduction_amount } = req.body;

      if (!handler_name || !status) {
        return res.status(400).json({
          success: false,
          error: '处理人姓名和状态不能为空'
        });
      }

      if (!['pending', 'processing', 'resolved'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: '状态值不正确，应为pending、processing或resolved'
        });
      }

      const oldRecord = await Complaint.findById(id);
      if (!oldRecord) {
        return res.status(404).json({
          success: false,
          error: '记录不存在'
        });
      }

      await Complaint.handle(id, handler_name, status, handling_result, deduction_amount || 0);
      const updatedRecord = await Complaint.findById(id);

      await OperationLog.log(
        'handle',
        'complaints',
        id,
        handler_name,
        `处理客诉记录，状态：${status}，扣款：${deduction_amount || 0}元`,
        oldRecord,
        updatedRecord
      );

      res.json({
        success: true,
        data: updatedRecord,
        message: '处理完成'
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

      const stats = await Complaint.getStats(filters);

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

module.exports = ComplaintController;