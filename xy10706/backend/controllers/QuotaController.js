const QuotaService = require('../services/QuotaService');
const { Parser } = require('json2csv');
const { Customer, Package, ApiEndpoint, CallRecord, CustomerPackage, ReviewRecord } = require('../models');
const { Op } = require('sequelize');

class QuotaController {
  static async processCall(req, res) {
    try {
      const { apiKey, path, method, idempotencyKey } = req.body;
      const result = await QuotaService.processCall(apiKey, path, method, idempotencyKey);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async retryCall(req, res) {
    try {
      const { requestId } = req.body;
      const result = await QuotaService.processRetry(requestId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async reviewCall(req, res) {
    try {
      const { callRecordId, action, reason, reviewer } = req.body;
      const result = await QuotaService.reviewCall(callRecordId, action, reason, reviewer);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async recalculateRecords(req, res) {
    try {
      const { oldPath, newPath, method } = req.body;
      const result = await QuotaService.recalculateRecords(oldPath, newPath, method);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getStatistics(req, res) {
    try {
      const { customerId, startDate, endDate } = req.query;
      const result = await QuotaService.getStatistics(
        customerId ? parseInt(customerId) : null,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async exportBilling(req, res) {
    try {
      const { customerId, startDate, endDate, format = 'json' } = req.query;
      const records = await QuotaService.exportBillingDetails(
        parseInt(customerId),
        new Date(startDate),
        new Date(endDate)
      );

      if (format === 'csv') {
        const parser = new Parser();
        const csv = parser.parse(records);
        res.header('Content-Type', 'text/csv');
        res.attachment(`billing-${customerId}-${Date.now()}.csv`);
        res.send(csv);
      } else {
        res.json({ success: true, records });
      }
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getCustomers(req, res) {
    try {
      const customers = await Customer.findAll({ order: [['createdAt', 'DESC']] });
      res.json(customers);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async createCustomer(req, res) {
    try {
      const customer = await Customer.create(req.body);
      res.json(customer);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getPackages(req, res) {
    try {
      const packages = await Package.findAll({ order: [['createdAt', 'DESC']] });
      res.json(packages);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async createPackage(req, res) {
    try {
      const pkg = await Package.create(req.body);
      res.json(pkg);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getEndpoints(req, res) {
    try {
      const endpoints = await ApiEndpoint.findAll({ order: [['createdAt', 'DESC']] });
      res.json(endpoints);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async createEndpoint(req, res) {
    try {
      const endpoint = await ApiEndpoint.create(req.body);
      res.json(endpoint);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getCallRecords(req, res) {
    try {
      const { customerId, status, page = 1, limit = 20 } = req.query;
      const where = {};
      if (customerId) where.CustomerId = parseInt(customerId);
      if (status) where.status = status;

      const { count, rows } = await CallRecord.findAndCountAll({
        where,
        include: [
          { model: Customer, attributes: ['name', 'email'] },
          { model: ApiEndpoint, attributes: ['path', 'method'] }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      });

      res.json({
        success: true,
        records: rows,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit))
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getCallRecord(req, res) {
    try {
      const record = await CallRecord.findByPk(req.params.id, {
        include: [
          { model: Customer, attributes: ['name', 'email'] },
          { model: ApiEndpoint, attributes: ['path', 'method'] },
          { model: ReviewRecord }
        ]
      });
      res.json(record);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getCustomerPackages(req, res) {
    try {
      const packages = await CustomerPackage.findAll({
        where: { CustomerId: req.params.customerId },
        include: [{ model: Package }],
        order: [['createdAt', 'DESC']]
      });
      res.json(packages);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async assignPackage(req, res) {
    try {
      const { CustomerId, PackageId, startDate, endDate } = req.body;
      const customerPackage = await CustomerPackage.create({
        CustomerId,
        PackageId,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null
      });
      res.json(customerPackage);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getReviewRecords(req, res) {
    try {
      const { customerId, page = 1, limit = 20 } = req.query;
      const where = {};
      if (customerId) where.CustomerId = parseInt(customerId);

      const { count, rows } = await ReviewRecord.findAndCountAll({
        where,
        include: [
          { model: CallRecord }
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit)
      });

      res.json({
        success: true,
        records: rows,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit))
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getDailyTrend(req, res) {
    try {
      const { customerId, days = 30 } = req.query;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));

      const where = {
        createdAt: { [Op.gte]: startDate }
      };
      if (customerId) where.CustomerId = parseInt(customerId);

      const records = await CallRecord.findAll({
        where,
        attributes: [
          [require('sequelize').fn('DATE', require('sequelize').col('createdAt')), 'date'],
          'status',
          [require('sequelize').fn('COUNT', '*'), 'count']
        ],
        group: ['date', 'status'],
        order: [['date', 'ASC']]
      });

      res.json({ success: true, trend: records });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = QuotaController;
