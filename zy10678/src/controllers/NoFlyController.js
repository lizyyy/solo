const noFlyService = require('../services/NoFlyService');
const referenceRepository = require('../repositories/ReferenceRepository');
const { Parser } = require('json2csv');
const { STATUS_PENDING, STATUS_APPROVED, STATUS_RESTORED } = require('../models/NoFlyRecord');

class NoFlyController {
  async createRecord(req, res) {
    try {
      const result = await noFlyService.createRecord(req.body);
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getRecords(req, res) {
    try {
      const filters = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.route_id) filters.route_id = req.query.route_id;
      if (req.query.start_date) filters.start_date = req.query.start_date;
      if (req.query.end_date) filters.end_date = req.query.end_date;

      const result = await noFlyService.getRecords(filters);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getRecordById(req, res) {
    try {
      const result = await noFlyService.getRecordById(req.params.id);
      if (!result.success) {
        return res.status(404).json(result);
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async changeStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, operator, remark } = req.body;
      
      const result = await noFlyService.changeStatus(id, status, operator, remark);
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getHistory(req, res) {
    try {
      const result = await noFlyService.getHistory(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async importRecords(req, res) {
    try {
      const { rows, batchId } = req.body;
      if (!rows || !Array.isArray(rows)) {
        return res.status(400).json({ success: false, errors: ['rows必须是数组'] });
      }

      const result = await noFlyService.validateAndImport(rows, batchId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getImportValidation(req, res) {
    try {
      const result = await noFlyService.getImportValidation(req.params.batchId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async exportRecords(req, res) {
    try {
      const filters = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.route_id) filters.route_id = req.query.route_id;

      const data = await noFlyService.exportRecords(filters);
      const parser = new Parser();
      const csv = parser.parse(data);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=no_fly_records_${Date.now()}.csv`);
      res.send('\uFEFF' + csv);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getReferenceData(req, res) {
    try {
      const [routes, drones, applicants] = await Promise.all([
        referenceRepository.getAllRoutes(),
        referenceRepository.getAllDrones(),
        referenceRepository.getAllApplicants()
      ]);

      res.json({
        success: true,
        data: { routes, drones, applicants }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getStatusInfo(req, res) {
    res.json({
      success: true,
      data: {
        statuses: [
          { value: STATUS_PENDING, label: '禁飞申请', description: '已提交申请，待审批' },
          { value: STATUS_APPROVED, label: '已禁飞', description: '审批通过，禁飞生效中' },
          { value: STATUS_RESTORED, label: '已恢复', description: '禁飞已解除，航线恢复可飞' }
        ]
      }
    });
  }
}

module.exports = new NoFlyController();