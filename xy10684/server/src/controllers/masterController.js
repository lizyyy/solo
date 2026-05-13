const { LowScoreReason, Department } = require('../models');
const LogService = require('../services/logService');

class MasterController {
  static async getReasons(req, res) {
    try {
      const list = await LowScoreReason.findAll({
        where: { enabled: true },
        order: [['sort', 'ASC']]
      });
      res.json({ success: true, data: list });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async createReason(req, res) {
    try {
      const operator = req.headers['x-operator'] || 'system';
      const reason = await LowScoreReason.create(req.body);
      await LogService.createLog('reason', reason.id, 'create', operator, null, reason.toJSON(), '创建低分原因');
      res.json({ success: true, data: reason });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getDepartments(req, res) {
    try {
      const list = await Department.findAll({
        where: { enabled: true },
        order: [['code', 'ASC']]
      });
      res.json({ success: true, data: list });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async createDepartment(req, res) {
    try {
      const operator = req.headers['x-operator'] || 'system';
      const dept = await Department.create(req.body);
      await LogService.createLog('department', dept.id, 'create', operator, null, dept.toJSON(), '创建部门');
      res.json({ success: true, data: dept });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = MasterController;
