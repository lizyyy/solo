const RentalService = require('../services/RentalService');
const RentalModel = require('../models/RentalModel');
const BatchModel = require('../models/BatchModel');
const OperationLogModel = require('../models/OperationLogModel');
const ExceptionModel = require('../models/ExceptionModel');
const DepositRuleModel = require('../models/DepositRuleModel');
const RepairModel = require('../models/RepairModel');

class RentalController {
  static async createBatch(req, res) {
    try {
      const { batch_name, total_count, operator } = req.body;
      const result = await RentalService.createBatch(batch_name, total_count, operator);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async importRentalCSV(req, res) {
    try {
      const { batch_id, operator } = req.body;
      if (!req.file) {
        return res.status(400).json({ success: false, error: '请上传CSV文件' });
      }
      const result = await RentalService.importRentalCSV(req.file.path, batch_id, operator);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async importRepairJSON(req, res) {
    try {
      const result = await RentalService.importRepairJSON(req.body);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async importDepositRules(req, res) {
    try {
      const result = await RentalService.importDepositRules(req.body.rules);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async processRental(req, res) {
    try {
      const { id } = req.params;
      const { operator, reason, status } = req.body;
      const result = await RentalService.processRental(parseInt(id), operator, reason, status);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async returnForModification(req, res) {
    try {
      const { id } = req.params;
      const { operator, reason } = req.body;
      const result = await RentalService.returnForModification(parseInt(id), operator, reason);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getRentalDetails(req, res) {
    try {
      const { id } = req.params;
      const result = await RentalService.getRentalDetails(parseInt(id));
      if (!result) {
        return res.status(404).json({ success: false, error: '记录不存在' });
      }
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async searchRentals(req, res) {
    try {
      const filters = req.query;
      const result = await RentalModel.findAll(filters);
      res.json({ success: true, data: result, count: result.length });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async exportRentals(req, res) {
    try {
      const filters = req.query;
      const { csv, count } = await RentalService.exportRentals(filters);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="rental_records_${Date.now()}.csv"`);
      res.send('\uFEFF' + csv);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getBatches(req, res) {
    try {
      const result = await BatchModel.findAll();
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getBatchDetails(req, res) {
    try {
      const { batch_id } = req.params;
      const batch = await BatchModel.findById(batch_id);
      const rentals = await RentalModel.findByBatch(batch_id);
      const logs = await OperationLogModel.findByBatch(batch_id);
      res.json({ success: true, data: { batch, rentals, logs } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getUnresolvedExceptions(req, res) {
    try {
      const result = await ExceptionModel.findUnresolved();
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async resolveException(req, res) {
    try {
      const { id } = req.params;
      const { operator, resolution_note } = req.body;
      const result = await RentalService.resolveException(parseInt(id), operator, resolution_note);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getDepositRules(req, res) {
    try {
      const result = await DepositRuleModel.findAll();
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getRepairRecords(req, res) {
    try {
      const { device_serial } = req.query;
      let result;
      if (device_serial) {
        result = await RepairModel.findByDeviceSerial(device_serial);
      } else {
        result = await RepairModel.findAll();
      }
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async getOperationLogs(req, res) {
    try {
      const { rental_id } = req.query;
      let result;
      if (rental_id) {
        result = await OperationLogModel.findByRentalId(parseInt(rental_id));
      } else {
        result = await OperationLogModel.findAll();
      }
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async searchByDeviceSerial(req, res) {
    try {
      const { serial } = req.params;
      const rentals = await RentalModel.findByDeviceSerial(serial);
      const repairs = await RepairModel.findByDeviceSerial(serial);
      res.json({ success: true, data: { rentals, repairs } });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  static async searchByDepositFlow(req, res) {
    try {
      const { flow_id } = req.params;
      const result = await RentalModel.findByDepositFlow(flow_id);
      res.json({ success: true, data: result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = RentalController;
