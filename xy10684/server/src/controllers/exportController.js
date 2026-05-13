const ExportService = require('../services/exportService');
const dayjs = require('dayjs');

class ExportController {
  static async exportRevisitResults(req, res) {
    try {
      const workbook = await ExportService.exportRevisitResults(req.query);
      
      const filename = `复访结果_${dayjs().format('YYYYMMDDHHmmss')}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  static async getFilters(req, res) {
    try {
      const result = await ExportService.getExportFilters();
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}

module.exports = ExportController;
