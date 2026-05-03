const Request = require('../models/Request');
const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS } = require('../utils/constants');

class RequestController {
  static async createRequest(req, res) {
    try {
      const {
        requester_id,
        pickup_location,
        dropoff_location,
        item_type,
        weight = 0,
        volume = 0,
        latest_delivery_time,
        tip_amount = 0,
        notes
      } = req.body;

      if (!requester_id || !pickup_location || !dropoff_location || !item_type || !latest_delivery_time) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_REQUIRED_FIELDS',
          message: '缺少必填字段'
        });
      }

      const request = await Request.create({
        requester_id,
        pickup_location,
        dropoff_location,
        item_type,
        weight: parseFloat(weight) || 0,
        volume: parseFloat(volume) || 0,
        latest_delivery_time,
        tip_amount: parseFloat(tip_amount) || 0,
        notes
      });

      await AuditLog.create({
        request_id: request.id,
        order_id: null,
        actor_id: requester_id,
        actor_type: 'requester',
        action: AUDIT_ACTIONS.REQUEST_CREATED,
        details: {
          pickup_location,
          dropoff_location,
          item_type,
          tip_amount
        }
      });

      res.status(201).json({
        success: true,
        data: request
      });
    } catch (error) {
      console.error('创建请求单错误:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  static async getRequest(req, res) {
    try {
      const { id } = req.params;
      const request = await Request.findById(id);

      if (!request) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: '请求单不存在'
        });
      }

      res.json({
        success: true,
        data: request
      });
    } catch (error) {
      console.error('获取请求单错误:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  static async listRequests(req, res) {
    try {
      const { status, requester_id } = req.query;
      let requests;

      if (status === 'pending') {
        requests = await Request.findAllPending();
      } else if (requester_id) {
        requests = await Request.findByRequesterId(requester_id);
      } else {
        requests = await Request.findAll();
      }

      res.json({
        success: true,
        data: requests
      });
    } catch (error) {
      console.error('列出请求单错误:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
}

module.exports = RequestController;
