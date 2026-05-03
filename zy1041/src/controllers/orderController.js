const Order = require('../models/Order');
const OrderService = require('../services/OrderService');

class OrderController {
  static async lockOrder(req, res) {
    try {
      const { request_id, traveler_id } = req.body;

      if (!request_id || !traveler_id) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_REQUIRED_FIELDS',
          message: '缺少必填字段: request_id 和 traveler_id'
        });
      }

      const result = await OrderService.lockOrder(request_id, traveler_id);

      if (!result.success) {
        return res.status(409).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('锁定订单错误:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  static async confirmOrder(req, res) {
    try {
      const { order_id, actor_id, actor_type } = req.body;

      if (!order_id || !actor_id || !actor_type) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_REQUIRED_FIELDS',
          message: '缺少必填字段: order_id, actor_id, actor_type'
        });
      }

      const result = await OrderService.confirmOrder(order_id, actor_id, actor_type);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('确认订单错误:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  static async pickupItem(req, res) {
    try {
      const { order_id, traveler_id } = req.body;

      if (!order_id || !traveler_id) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_REQUIRED_FIELDS',
          message: '缺少必填字段: order_id 和 traveler_id'
        });
      }

      const result = await OrderService.pickupItem(order_id, traveler_id);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('标记取货错误:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  static async deliverItem(req, res) {
    try {
      const { order_id, traveler_id } = req.body;

      if (!order_id || !traveler_id) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_REQUIRED_FIELDS',
          message: '缺少必填字段: order_id 和 traveler_id'
        });
      }

      const result = await OrderService.deliverItem(order_id, traveler_id);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('标记送达错误:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  static async cancelOrder(req, res) {
    try {
      const { order_id, actor_id, actor_type, reason } = req.body;

      if (!order_id || !actor_id || !actor_type) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_REQUIRED_FIELDS',
          message: '缺少必填字段: order_id, actor_id, actor_type'
        });
      }

      const result = await OrderService.cancelOrder(order_id, actor_id, actor_type, reason);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('取消订单错误:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  static async raiseDispute(req, res) {
    try {
      const { order_id, actor_id, actor_type, dispute_reason } = req.body;

      if (!order_id || !actor_id || !actor_type) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_REQUIRED_FIELDS',
          message: '缺少必填字段: order_id, actor_id, actor_type'
        });
      }

      const result = await OrderService.raiseDispute(order_id, actor_id, actor_type, dispute_reason);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      console.error('发起争议错误:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  static async getOrderStatus(req, res) {
    try {
      const { order_id } = req.params;

      const result = await OrderService.getOrderStatus(order_id);

      if (!result) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: '订单不存在'
        });
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('获取订单状态错误:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  static async listOrders(req, res) {
    try {
      const { request_id, trip_id } = req.query;
      let orders;

      if (request_id) {
        orders = await Order.findByRequestId(request_id);
      } else if (trip_id) {
        orders = await Order.findByTripId(trip_id);
      } else {
        orders = await Order.findAll();
      }

      res.json({
        success: true,
        data: orders
      });
    } catch (error) {
      console.error('列出订单错误:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
}

module.exports = OrderController;
