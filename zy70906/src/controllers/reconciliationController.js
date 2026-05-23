const store = require('../store');
const importService = require('../services/importService');
const pointsCalculator = require('../services/pointsCalculator');
const discrepancyDetector = require('../services/discrepancyDetector');
const reportService = require('../services/reportService');

class ReconciliationController {
  async importReceipts(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }
      const result = await importService.importReceiptsCSV(req.file.path);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async importMembers(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }
      const result = await importService.importMembersJSON(req.file.path);
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async runReconciliation(req, res) {
    try {
      const calculated = pointsCalculator.calculateAllReconciliations();
      const checked = discrepancyDetector.checkAllReconciliations();
      res.status(200).json({ success: true, message: `Reconciliation completed. Checked ${checked.length} records.` });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  getReconciliations(req, res) {
    try {
      const { status, memberNo } = req.query;
      let recons = store.getAllReconciliations();
      if (status) {
        recons = recons.filter(r => r.status === status);
      }
      if (memberNo) {
        recons = recons.filter(r => r.memberNo === memberNo);
      }
      res.status(200).json({ success: true, data: recons.map(r => r.toJSON()) });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  getReconciliation(req, res) {
    try {
      const { id } = req.params;
      const recon = store.getReconciliation(id);
      if (!recon) {
        return res.status(404).json({ success: false, message: 'Reconciliation not found' });
      }
      res.status(200).json({ success: true, data: recon.toJSON() });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  approveReconciliation(req, res) {
    try {
      const { id } = req.params;
      const { reviewer, remark } = req.body;
      const recon = store.getReconciliation(id);
      if (!recon) {
        return res.status(404).json({ success: false, message: 'Reconciliation not found' });
      }
      recon.approve(reviewer, remark);
      res.status(200).json({ success: true, data: recon.toJSON() });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  rejectReconciliation(req, res) {
    try {
      const { id } = req.params;
      const { reviewer, remark } = req.body;
      const recon = store.getReconciliation(id);
      if (!recon) {
        return res.status(404).json({ success: false, message: 'Reconciliation not found' });
      }
      recon.reject(reviewer, remark);
      res.status(200).json({ success: true, data: recon.toJSON() });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  async getReport(req, res) {
    try {
      const report = await reportService.generateReconciliationReport();
      res.status(200).json({ success: true, ...report });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }

  getSummary(req, res) {
    try {
      const recons = store.getAllReconciliations();
      const summary = reportService.calculateSummary(recons);
      res.status(200).json({ success: true, summary });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
}

module.exports = new ReconciliationController();
