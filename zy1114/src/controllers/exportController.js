const exportService = require('../services/exportService');

function exportShiftHandover(req, res, next) {
  try {
    const { date, format } = req.query;
    const data = exportService.getShiftHandoverData(date);
    
    const exportFormat = format || 'json';
    
    if (exportFormat === 'markdown' || exportFormat === 'md') {
      const markdown = exportService.toMarkdownShiftHandover(data);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="shift-handover-${data.date}.md"`);
      res.send(markdown);
    } else if (exportFormat === 'csv') {
      const csv = exportService.toCSVShiftHandover(data);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="shift-handover-${data.date}.csv"`);
      res.send(csv);
    } else {
      res.json({
        success: true,
        data: data
      });
    }
  } catch (err) {
    next(err);
  }
}

function exportDailyReconciliation(req, res, next) {
  try {
    const { date, format } = req.query;
    const data = exportService.getDailyReconciliationData(date);
    
    const exportFormat = format || 'json';
    
    if (exportFormat === 'markdown' || exportFormat === 'md') {
      const markdown = exportService.toMarkdownDailyReconciliation(data);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="daily-reconciliation-${data.date}.md"`);
      res.send(markdown);
    } else if (exportFormat === 'csv') {
      const csv = exportService.toCSVDailyReconciliation(data);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="daily-reconciliation-${data.date}.csv"`);
      res.send(csv);
    } else {
      res.json({
        success: true,
        data: data
      });
    }
  } catch (err) {
    next(err);
  }
}

function exportRepairTodo(req, res, next) {
  try {
    const { date, format } = req.query;
    const data = exportService.getRepairTodoData(date);
    
    const exportFormat = format || 'json';
    
    if (exportFormat === 'markdown' || exportFormat === 'md') {
      const markdown = exportService.toMarkdownRepairTodo(data);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="repair-todo-${data.date}.md"`);
      res.send(markdown);
    } else if (exportFormat === 'csv') {
      const csv = exportService.toCSVRepairTodo(data);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="repair-todo-${data.date}.csv"`);
      res.send(csv);
    } else {
      res.json({
        success: true,
        data: data
      });
    }
  } catch (err) {
    next(err);
  }
}

module.exports = {
  exportShiftHandover,
  exportDailyReconciliation,
  exportRepairTodo
};
