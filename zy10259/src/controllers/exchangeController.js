const ExchangeService = require('../services/exchangeService');

class ExchangeController {
  static async create(req, res) {
    try {
      const exchange = await ExchangeService.createExchange(req.body);
      res.sendIdempotentResponse(201, { success: true, data: exchange });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async confirm(req, res) {
    try {
      const exchange = await ExchangeService.confirmExchange(req.params.id);
      res.json({ success: true, data: exchange });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getByOrderId(req, res) {
    try {
      const exchanges = await ExchangeService.getExchangesByOrderId(req.params.orderId);
      res.json({ success: true, data: exchanges });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = ExchangeController;
