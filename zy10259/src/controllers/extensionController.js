const ExtensionService = require('../services/extensionService');

class ExtensionController {
  static async create(req, res) {
    try {
      const extension = await ExtensionService.createExtension(req.body);
      res.sendIdempotentResponse(201, { success: true, data: extension });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async approve(req, res) {
    try {
      const result = await ExtensionService.approveExtension(req.params.id, req.body.approved_by || 'system');
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getByOrderId(req, res) {
    try {
      const extensions = await ExtensionService.getExtensionsByOrderId(req.params.orderId);
      res.json({ success: true, data: extensions });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = ExtensionController;
