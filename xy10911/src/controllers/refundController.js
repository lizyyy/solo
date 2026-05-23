const { Refund } = require('../models/Refund');
const RefundService = require('../services/refundService');
const { Parser } = require('json2csv');

class RefundController {
  static async createRefund(req, res) {
    try {
      const result = await RefundService.createRefundApplication(req.body);
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.status(201).json(result);
    } catch (error) {
      console.error('创建退款申请失败:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      });
    }
  }

  static async getRefund(req, res) {
    try {
      const { refundId } = req.params;
      const refund = await Refund.findById(refundId);
      
      if (!refund) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: '退款申请不存在'
        });
      }
      
      res.json({
        success: true,
        data: refund
      });
    } catch (error) {
      console.error('查询退款申请失败:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      });
    }
  }

  static async listRefunds(req, res) {
    try {
      const filters = {
        status: req.query.status,
        machine_id: req.query.machine_id
      };
      
      const refunds = await Refund.findAll(filters);
      
      res.json({
        success: true,
        data: refunds,
        total: refunds.length
      });
    } catch (error) {
      console.error('查询退款列表失败:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      });
    }
  }

  static async updateRefundStatus(req, res) {
    try {
      const { refundId } = req.params;
      const { status, operator, remarks } = req.validatedData;
      
      const result = await RefundService.advanceRefundStatus(refundId, status, operator, remarks);
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json(result);
    } catch (error) {
      console.error('更新退款状态失败:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      });
    }
  }

  static async manualCorrect(req, res) {
    try {
      const { refundId } = req.params;
      const { operator, ...updateData } = req.validatedData;
      
      const result = await RefundService.manualCorrect(refundId, updateData, operator);
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json(result);
    } catch (error) {
      console.error('人工修正失败:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      });
    }
  }

  static async getRefundLogs(req, res) {
    try {
      const { refundId } = req.params;
      const logs = await Refund.getLogs(refundId);
      
      res.json({
        success: true,
        data: logs
      });
    } catch (error) {
      console.error('查询处理日志失败:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      });
    }
  }

  static async exportRefunds(req, res) {
    try {
      const filters = {
        status: req.query.status,
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };
      
      const data = await Refund.exportAll(filters);
      
      if (req.query.format === 'csv') {
        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(data);
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=refunds_${new Date().toISOString().split('T')[0]}.csv`);
        res.send('\uFEFF' + csv);
      } else {
        res.json({
          success: true,
          data,
          total: data.length
        });
      }
    } catch (error) {
      console.error('导出数据失败:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      });
    }
  }

  static async recordException(req, res) {
    try {
      const { refundId } = req.params;
      const { error_details, operator } = req.body;
      
      const result = await RefundService.handleException(refundId, error_details, operator || 'system');
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json(result);
    } catch (error) {
      console.error('记录异常失败:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: '服务器内部错误'
      });
    }
  }
}

module.exports = RefundController;
