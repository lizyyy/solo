const ReceivableService = require('../services/receivableService');
const HistoryService = require('../services/historyService');
const ExportService = require('../services/exportService');
const ImportService = require('../services/importService');

class ReceivableController {
  static async create(req, res) {
    try {
      const result = await ReceivableService.createReceivable(req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async applyUnlock(req, res) {
    try {
      const { id } = req.params;
      const result = await ReceivableService.applyUnlock(id, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async approveUnlock(req, res) {
    try {
      const { id } = req.params;
      const result = await ReceivableService.approveUnlock(id, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async rejectUnlock(req, res) {
    try {
      const { id } = req.params;
      const result = await ReceivableService.rejectUnlock(id, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getDetail(req, res) {
    try {
      const { id } = req.params;
      const result = await ReceivableService.getReceivableDetailWithHistory(id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getList(req, res) {
    try {
      const result = await ReceivableService.getReceivableList(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getHistories(req, res) {
    try {
      const { receivableId } = req.params;
      const result = await HistoryService.getHistoriesByReceivableId(receivableId);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async export(req, res) {
    try {
      const csv = await ExportService.exportToCSV(req.query);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=receivables_${Date.now()}.csv`);
      res.send('\uFEFF' + csv);
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async import(req, res) {
    try {
      const { rows, operator } = req.body;
      const result = await ImportService.importReceivables(rows, operator);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getImportLogs(req, res) {
    try {
      const result = await ImportService.getImportLogs(req.query);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getBadRows(req, res) {
    try {
      const { batchNo } = req.params;
      const result = await ImportService.getBadRows(batchNo);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = ReceivableController;