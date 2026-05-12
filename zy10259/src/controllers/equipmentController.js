const EquipmentService = require('../services/equipmentService');

class EquipmentController {
  static async create(req, res) {
    try {
      const equipment = await EquipmentService.createEquipment(req.body);
      res.sendIdempotentResponse(201, { success: true, data: equipment });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async getById(req, res) {
    try {
      const equipment = await EquipmentService.getEquipmentById(req.params.id);
      if (!equipment) {
        return res.status(404).json({ success: false, error: '设备不存在' });
      }
      res.json({ success: true, data: equipment });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async list(req, res) {
    try {
      const equipmentList = await EquipmentService.listEquipment(req.query);
      res.json({ success: true, data: equipmentList });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}

module.exports = EquipmentController;
