const MaterialService = require('../services/materialService');
const ImportService = require('../services/importService');
const QueryService = require('../services/queryService');
const ExportService = require('../services/exportService');

class MaterialController {
  static async createRecord(req, res) {
    try {
      const result = await MaterialService.createRecord(req.body);
      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async createBatch(req, res) {
    try {
      const records = req.body.records;
      if (!Array.isArray(records)) {
        return res.status(400).json({ success: false, error: 'records must be an array' });
      }
      
      const result = await MaterialService.createBatch(records);
      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async markProcessing(req, res) {
    try {
      const { recordId } = req.params;
      const { handler, reason } = req.body;
      
      const result = await MaterialService.markProcessing(recordId, handler, reason);
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async approveRecord(req, res) {
    try {
      const { recordId } = req.params;
      const { handler, reason, actualQuantity } = req.body;
      
      const result = await MaterialService.approveRecord(recordId, handler, reason, actualQuantity);
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async rejectRecord(req, res) {
    try {
      const { recordId } = req.params;
      const { handler, rejectionReason } = req.body;
      
      const result = await MaterialService.rejectRecord(recordId, handler, rejectionReason);
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async returnForRevision(req, res) {
    try {
      const { recordId } = req.params;
      const { handler, returnReason } = req.body;
      
      const result = await MaterialService.returnForRevision(recordId, handler, returnReason);
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async completeRecord(req, res) {
    try {
      const { recordId } = req.params;
      const { handler, reason } = req.body;
      
      const result = await MaterialService.completeRecord(recordId, handler, reason);
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async processReturn(req, res) {
    try {
      const { recordId } = req.params;
      const { returnedQuantity, handler, reason } = req.body;
      
      const result = await MaterialService.processReturn(recordId, returnedQuantity, handler, reason);
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getRecord(req, res) {
    try {
      const { recordId } = req.params;
      const result = await MaterialService.getRecordById(recordId);
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(404).json(result);
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getRecordWithAuditTrail(req, res) {
    try {
      const { recordId } = req.params;
      const result = await MaterialService.getRecordWithAuditTrail(recordId);
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(404).json(result);
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async queryRecords(req, res) {
    try {
      const filters = {
        orderNumber: req.query.orderNumber,
        teamName: req.query.teamName,
        batchNumber: req.query.batchNumber,
        materialCode: req.query.materialCode,
        status: req.query.status,
        recordType: req.query.recordType,
        hasException: req.query.hasException ? req.query.hasException === 'true' : undefined,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      const options = {
        page: req.query.page,
        pageSize: req.query.pageSize,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder
      };

      const result = await QueryService.queryRecords(filters, options);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getByOrderNumber(req, res) {
    try {
      const { orderNumber } = req.params;
      const result = await QueryService.queryByOrderNumber(orderNumber);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getByTeamName(req, res) {
    try {
      const { teamName } = req.params;
      const dateRange = {
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };
      const result = await QueryService.queryByTeamName(teamName, dateRange);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getByBatchNumber(req, res) {
    try {
      const { batchNumber } = req.params;
      const result = await QueryService.queryByBatchNumber(batchNumber);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getExceptionLogs(req, res) {
    try {
      const filters = {
        exceptionType: req.query.exceptionType,
        orderNumber: req.query.orderNumber,
        status: req.query.status
      };
      const result = await QueryService.getExceptionLogs(filters);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getCompleteReport(req, res) {
    try {
      const { recordId } = req.params;
      const result = await QueryService.getCompleteReport(recordId);
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(404).json(result);
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getStatistics(req, res) {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };
      const result = await QueryService.getStatistics(filters);
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async exportToCSV(req, res) {
    try {
      const filters = {
        orderNumber: req.query.orderNumber,
        teamName: req.query.teamName,
        batchNumber: req.query.batchNumber,
        materialCode: req.query.materialCode,
        status: req.query.status,
        recordType: req.query.recordType,
        hasException: req.query.hasException ? req.query.hasException === 'true' : undefined,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      const result = await ExportService.exportToCSV(filters);
      if (result.success) {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.status(200).send('\uFEFF' + result.data);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async exportReport(req, res) {
    try {
      const { recordId } = req.params;
      const result = await ExportService.exportReport(recordId);
      if (result.success) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.status(200).send(result.data);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async importVehicles(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      const result = await ImportService.importVehiclesFromFile(req.file.path);
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async importInventory(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      const result = await ImportService.importInventoryFromCSV(req.file.path);
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async importMaterialRecords(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }

      const result = await ImportService.importMaterialRecordsFromCSV(req.file.path);
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = MaterialController;
