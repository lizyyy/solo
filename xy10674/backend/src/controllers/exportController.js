const exportService = require('../services/export');
const { OperationLog } = require('../models');

class ExportController {
  async exportDepositReport(req, res) {
    try {
      const userId = req.userId;
      const filters = req.body;

      const workbook = await exportService.exportDepositReport(filters);

      // 记录操作日志
      await OperationLog.create({
        user_id: userId,
        operation: 'export',
        module: 'deposit_report',
        detail: `导出押金赔付报告, 筛选条件: ${JSON.stringify(filters)}`,
        ip_address: req.ip
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=押金赔付报告_${new Date().toISOString().slice(0, 10)}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('导出押金赔付报告失败:', error);
      res.status(500).json({ message: '导出失败', error: error.message });
    }
  }

  async exportSupplierHandoverReport(req, res) {
    try {
      const userId = req.userId;
      const filters = req.body;

      const workbook = await exportService.exportSupplierHandoverReport(filters);

      // 记录操作日志
      await OperationLog.create({
        user_id: userId,
        operation: 'export',
        module: 'supplier_handover',
        detail: `导出供应商交接报告, 筛选条件: ${JSON.stringify(filters)}`,
        ip_address: req.ip
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=供应商交接报告_${new Date().toISOString().slice(0, 10)}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('导出供应商交接报告失败:', error);
      res.status(500).json({ message: '导出失败', error: error.message });
    }
  }

  async exportDepositFlowReport(req, res) {
    try {
      const userId = req.userId;
      const filters = req.body;

      const workbook = await exportService.exportDepositFlowReport(filters);

      // 记录操作日志
      await OperationLog.create({
        user_id: userId,
        operation: 'export',
        module: 'deposit_flow',
        detail: `导出押金流水报告, 筛选条件: ${JSON.stringify(filters)}`,
        ip_address: req.ip
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=押金流水报告_${new Date().toISOString().slice(0, 10)}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('导出押金流水报告失败:', error);
      res.status(500).json({ message: '导出失败', error: error.message });
    }
  }
}

module.exports = new ExportController();
