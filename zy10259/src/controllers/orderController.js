const OrderService = require('../services/orderService');

class OrderController {
  static async create(req, res) {
    try {
      const order = await OrderService.createOrder(req.body);
      res.sendIdempotentResponse(201, { success: true, data: order });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getById(req, res) {
    try {
      const order = await OrderService.getOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ success: false, error: '订单不存在' });
      }
      res.json({ success: true, data: order });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async list(req, res) {
    try {
      const orders = await OrderService.listOrders(req.query);
      res.json({ success: true, data: orders });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = OrderController;
