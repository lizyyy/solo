const FinancialExportService = require('../services/FinancialExportService');
const ContractVersionService = require('../services/ContractVersionService');
const store = require('../stores/MemoryStore');
const ResponseHandler = require('../utils/responseHandler');

class ExportController {
  static async exportContractForFinance(req, res) {
    try {
      const exportData = FinancialExportService.exportContractForFinance(
        req.params.contractId,
        req.query.versionId
      );
      
      const format = req.query.format || 'json';
      
      if (format === 'text') {
        const textReport = FinancialExportService.formatAsTextReport(exportData);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.send(textReport);
      }
      
      return ResponseHandler.success(
        res,
        exportData,
        `财务导出完成：${exportData.businessContext.contractNo}`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async exportVersionHistory(req, res) {
    try {
      const exportData = FinancialExportService.exportVersionHistory(req.params.contractId);
      
      const format = req.query.format || 'json';
      
      if (format === 'text') {
        const textReport = FinancialExportService.formatAsTextReport(exportData);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.send(textReport);
      }
      
      return ResponseHandler.success(
        res,
        exportData,
        `版本历史导出完成：共 ${exportData.totalVersions} 个版本`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }

  static async exportTaxSummary(req, res) {
    try {
      const { startDate, endDate, format } = req.query;
      
      const allContracts = store.getAllContracts();
      const activeContracts = allContracts.filter(c => {
        if (!startDate && !endDate) return true;
        const signDate = new Date(c.signDate);
        if (startDate && signDate < new Date(startDate)) return false;
        if (endDate && signDate > new Date(endDate)) return false;
        return true;
      });

      const exportData = FinancialExportService.exportTaxSummaryForPeriod(
        activeContracts,
        startDate || '2000-01-01',
        endDate || new Date().toISOString().split('T')[0]
      );
      
      if (format === 'text') {
        const textReport = FinancialExportService.formatAsTextReport(exportData);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.send(textReport);
      }
      
      return ResponseHandler.success(
        res,
        exportData,
        `税务汇总导出完成：共 ${exportData.contracts.length} 份合同`
      );
    } catch (error) {
      return ResponseHandler.error(res, error);
    }
  }
}

module.exports = ExportController;
