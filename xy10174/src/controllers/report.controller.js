const { success, error, errorCodes } = require('../utils/response');
const ReportService = require('../services/report.service');

class ReportController {
  constructor() {
    this.service = new ReportService();
  }

  async getDepartmentReport(req, res) {
    try {
      const { departmentId } = req.params;
      const { fiscalYear } = req.query;

      if (!departmentId) {
        return res.status(400).json(error(errorCodes.VALIDATION_ERROR, {
          missingFields: ['departmentId']
        }));
      }

      const report = await this.service.getDepartmentBudgetReport(departmentId, fiscalYear);
      res.json(success(report));
    } catch (err) {
      console.error('Get department report error:', err);
      if (err.code) {
        return res.status(404).json({
          success: false,
          code: err.code,
          message: err.message,
          details: err.details,
          timestamp: Date.now()
        });
      }
      res.status(500).json(error(errorCodes.INTERNAL_ERROR, err.message));
    }
  }

  async getBudgetTrend(req, res) {
    try {
      const { departmentId } = req.params;
      const { budgetType, fiscalYear } = req.query;

      if (!departmentId || !budgetType || !fiscalYear) {
        return res.status(400).json(error(errorCodes.VALIDATION_ERROR, {
          missingFields: ['departmentId', 'budgetType', 'fiscalYear'].filter(f => 
            (f === 'departmentId' && !departmentId) ||
            (f === 'budgetType' && !budgetType) ||
            (f === 'fiscalYear' && !fiscalYear)
          )
        }));
      }

      const trend = await this.service.getBudgetUsageTrend(departmentId, budgetType, fiscalYear);
      res.json(success(trend));
    } catch (err) {
      console.error('Get budget trend error:', err);
      if (err.code) {
        return res.status(404).json({
          success: false,
          code: err.code,
          message: err.message,
          details: err.details,
          timestamp: Date.now()
        });
      }
      res.status(500).json(error(errorCodes.INTERNAL_ERROR, err.message));
    }
  }

  async getAllDepartmentsReport(req, res) {
    try {
      const { fiscalYear } = req.query;
      const report = await this.service.getAllDepartmentsReport(fiscalYear);
      res.json(success(report));
    } catch (err) {
      console.error('Get all departments report error:', err);
      res.status(500).json(error(errorCodes.INTERNAL_ERROR, err.message));
    }
  }
}

module.exports = ReportController;
