const ReturnService = require('../services/returnService');

class ReturnController {
  static async create(req, res) {
    try {
      const returnRecord = await ReturnService.createReturn(req.body);
      res.sendIdempotentResponse(201, { success: true, data: returnRecord });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async confirm(req, res) {
    try {
      const { damage_fee } = req.body;
      const returnRecord = await ReturnService.confirmReturn(req.params.id, damage_fee || 0);
      res.json({ success: true, data: returnRecord });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getById(req, res) {
    try {
      const returnRecord = await ReturnService.getReturnById(req.params.id);
      if (!returnRecord) {
        return res.status(404).json({ success: false, error: '归还记录不存在' });
      }
      res.json({ success: true, data: returnRecord });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = ReturnController;
