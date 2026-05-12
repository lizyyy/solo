const OutboundService = require('../services/outboundService');

class OutboundController {
  static async create(req, res) {
    try {
      const outbound = await OutboundService.createOutbound(req.body);
      res.sendIdempotentResponse(201, { success: true, data: outbound });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async confirm(req, res) {
    try {
      const outbound = await OutboundService.confirmOutbound(req.params.id);
      res.json({ success: true, data: outbound });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getById(req, res) {
    try {
      const outbound = await OutboundService.getOutboundById(req.params.id);
      if (!outbound) {
        return res.status(404).json({ success: false, error: '出库记录不存在' });
      }
      res.json({ success: true, data: outbound });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = OutboundController;
