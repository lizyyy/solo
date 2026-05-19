const Settlement = require('../models/Settlement');
const OperationLog = require('../models/OperationLog');

class SettlementController {
  static async create(req, res) {
    try {
      const data = req.body;
      const settlement = await Settlement.create(data);
      
      await OperationLog.log(
        'create',
        'settlements',
        settlement.id,
        req.body.operator_name || 'system',
        `创建结算单-${data.settlement_month}-${data.cleaner_name}`
      );

      res.json({
        success: true,
        data: settlement
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
        settlement_month: req.query.settlement_month,
        status: req.query.status
      };

      const records = await Settlement.findAll(filters);

      res.json({
        success: true,
        data: records
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
      const record = await Settlement.findById(req.params.id);
      
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
      const oldRecord = await Settlement.findById(id);
      
      if (!oldRecord) {
        return res.status(404).json({
          success: false,
          error: '记录不存在'
        });
      }

      await Settlement.update(id, req.body);
      const updatedRecord = await Settlement.findById(id);

      await OperationLog.log(
        'update',
        'settlements',
        id,
        req.body.operator_name || 'system',
        `更新结算单-${oldRecord.settlement_month}-${oldRecord.cleaner_name}`,
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

  static async approve(req, res) {
    try {
      const { id } = req.params;
      const { reviewed_by } = req.body;

      if (!reviewed_by) {
        return res.status(400).json({
          success: false,
          error: '复核人姓名不能为空'
        });
      }

      const oldRecord = await Settlement.findById(id);
      if (!oldRecord) {
        return res.status(404).json({
          success: false,
          error: '记录不存在'
        });
      }

      await Settlement.approve(id, reviewed_by);
      const updatedRecord = await Settlement.findById(id);

      await OperationLog.log(
        'approve',
        'settlements',
        id,
        reviewed_by,
        `批准结算单-${oldRecord.settlement_month}-${oldRecord.cleaner_name}`,
        oldRecord,
        updatedRecord
      );

      res.json({
        success: true,
        data: updatedRecord,
        message: '结算单已批准'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async generate(req, res) {
    try {
      const { settlement_month, cleaner_name } = req.body;

      if (!settlement_month || !cleaner_name) {
        return res.status(400).json({
          success: false,
          error: '结算月份和保洁员姓名不能为空'
        });
      }

      const result = await Settlement.generateByMonth(settlement_month, cleaner_name);

      res.json({
        success: true,
        data: result,
        message: '结算数据生成成功，请确认后保存'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = SettlementController;