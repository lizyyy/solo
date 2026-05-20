const verificationService = require('../services/verificationService');
const batchService = require('../services/batchService');
const reportService = require('../services/reportService');

class VerificationController {
  async verifyVisitor(req, res) {
    try {
      const { phone, license_plate, name } = req.body;
      const operator = req.get('X-Operator') || 'system';
      const gate = req.get('X-Gate') || 'main';

      const result = await verificationService.verifyVisitor(
        { phone, license_plate, name },
        operator,
        gate
      );

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

  async verifyPlate(req, res) {
    try {
      const { plate_number } = req.body;
      const operator = req.get('X-Operator') || 'system';
      const gate = req.get('X-Gate') || 'main';

      const result = await verificationService.verifyPlate(
        { plate_number },
        operator,
        gate
      );

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

  async manualRelease(req, res) {
    try {
      const { identifier, reason, type } = req.body;
      const operator = req.get('X-Operator') || 'system';
      const gate = req.get('X-Gate') || 'main';

      const result = await verificationService.verifyUnauthorizedRelease(
        { identifier, reason, type },
        operator,
        gate
      );

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

  async getRecords(req, res) {
    try {
      const filters = {
        operator: req.query.operator,
        status: req.query.status,
        startTime: req.query.startTime,
        endTime: req.query.endTime,
        exceptionType: req.query.exceptionType,
        verificationType: req.query.verificationType,
        limit: req.query.limit ? parseInt(req.query.limit) : null
      };

      const records = await verificationService.getVerificationRecords(filters);

      res.json({
        success: true,
        data: records,
        total: records.length
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  async getStatistics(req, res) {
    try {
      const filters = {
        operator: req.query.operator,
        status: req.query.status,
        startTime: req.query.startTime,
        endTime: req.query.endTime
      };

      const stats = await verificationService.getStatistics(filters);

      res.json({
        success: true,
        data: stats
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  async batchVerifyVisitors(req, res) {
    try {
      const { items } = req.body;
      const operator = req.get('X-Operator') || 'system';
      const gate = req.get('X-Gate') || 'main';

      const { batchId, totalCount } = await batchService.createBatchOperation(
        'verify_visitors',
        items,
        operator
      );

      const processor = async (item) => {
        return await verificationService.verifyVisitor(item, operator, gate);
      };

      const result = await batchService.processBatch(batchId, processor, {
        concurrency: 5,
        retries: 1
      });

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

  async getBatchStatus(req, res) {
    try {
      const { batchId } = req.params;
      const status = await batchService.getBatchStatus(batchId);

      res.json({
        success: true,
        data: status
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  async retryBatch(req, res) {
    try {
      const { batchId } = req.params;
      const operator = req.get('X-Operator') || 'system';
      const gate = req.get('X-Gate') || 'main';

      const processor = async (item) => {
        return await verificationService.verifyVisitor(item, operator, gate);
      };

      const result = await batchService.retryFailedItems(batchId, processor, {
        retries: 1
      });

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

  async exportReport(req, res) {
    try {
      const filters = {
        operator: req.query.operator,
        status: req.query.status,
        startTime: req.query.startTime,
        endTime: req.query.endTime,
        exceptionType: req.query.exceptionType,
        verificationType: req.query.verificationType
      };

      const report = await reportService.generateDetailedReport(filters);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=verification-report.csv');
      res.send('\uFEFF' + report.csv);
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  async getReportSummary(req, res) {
    try {
      const filters = {
        operator: req.query.operator,
        status: req.query.status,
        startTime: req.query.startTime,
        endTime: req.query.endTime,
        exceptionType: req.query.exceptionType,
        verificationType: req.query.verificationType
      };

      const report = await reportService.generateDetailedReport(filters);

      res.json({
        success: true,
        data: {
          summary: report.summary,
          breakdowns: report.breakdowns,
          totalRecords: report.records.length
        }
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }
}

module.exports = new VerificationController();
