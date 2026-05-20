const visitorService = require('../services/visitorService');

class VisitorController {
  async createVisitor(req, res) {
    try {
      const data = req.body;
      const createdBy = req.get('X-Operator') || 'system';
      const result = await visitorService.createVisitor(data, createdBy);

      res.json({
        success: true,
        data: result
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  async getVisitor(req, res) {
    try {
      const { id } = req.params;
      const visitor = await visitorService.getVisitor(id);

      if (!visitor) {
        return res.status(404).json({
          success: false,
          error: '访客不存在'
        });
      }

      res.json({
        success: true,
        data: visitor
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  async approveVisitor(req, res) {
    try {
      const { id } = req.params;
      const approver = req.get('X-Operator') || 'system';
      const result = await visitorService.approveVisitor(id, approver);

      res.json({
        success: true,
        data: result
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  async rejectVisitor(req, res) {
    try {
      const { id } = req.params;
      const rejector = req.get('X-Operator') || 'system';
      const result = await visitorService.rejectVisitor(id, rejector);

      res.json({
        success: true,
        data: result
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  async getVisitors(req, res) {
    try {
      const filters = {
        status: req.query.status,
        visitDate: req.query.visitDate,
        hostName: req.query.hostName,
        limit: req.query.limit ? parseInt(req.query.limit) : null
      };

      const visitors = await visitorService.getVisitors(filters);

      res.json({
        success: true,
        data: visitors,
        total: visitors.length
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  async createTemporaryPlate(req, res) {
    try {
      const data = req.body;
      const createdBy = req.get('X-Operator') || 'system';
      const result = await visitorService.createTemporaryPlate(data, createdBy);

      res.json({
        success: true,
        data: result
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  async getTemporaryPlates(req, res) {
    try {
      const filters = {
        status: req.query.status,
        plateNumber: req.query.plateNumber
      };

      const plates = await visitorService.getTemporaryPlates(filters);

      res.json({
        success: true,
        data: plates,
        total: plates.length
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  async addToBlacklist(req, res) {
    try {
      const data = req.body;
      const addedBy = req.get('X-Operator') || 'system';
      const result = await visitorService.addToBlacklist(data, addedBy);

      res.json({
        success: true,
        data: result
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  async removeFromBlacklist(req, res) {
    try {
      const { id } = req.params;
      const result = await visitorService.removeFromBlacklist(id);

      res.json({
        success: true,
        data: result
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  async getBlacklist(req, res) {
    try {
      const filters = {
        status: req.query.status,
        type: req.query.type
      };

      const blacklist = await visitorService.getBlacklist(filters);

      res.json({
        success: true,
        data: blacklist,
        total: blacklist.length
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }
}

module.exports = new VisitorController();
