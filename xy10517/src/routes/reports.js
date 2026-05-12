const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const reportService = require('../services/reportService');

router.get('/statistics', (req, res) => {
  try {
    const stats = reportService.getStatistics();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/unreturned', (req, res) => {
  try {
    const summary = reportService.getUnreturnedSummary();
    
    if (req.query.format === 'csv') {
      const parser = new Parser({
        fields: [
          'loan_code', 'part_code', 'part_name', 'engineer_name', 'engineer_code',
          'quantity', 'totalReturned', 'totalConsumed', 'totalDamaged', 'remaining',
          'status', 'is_overdue', 'overdue_days',
          'order_code', 'customer_name', 'work_order_status',
          'borrowed_at', 'expected_return_at', 'actual_return_at'
        ]
      });
      const csv = parser.parse(summary.details);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=unreturned-loans.csv');
      return res.send(csv);
    }
    
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stock', (req, res) => {
  try {
    const report = reportService.getStockStatusReport();
    
    if (req.query.format === 'csv') {
      const parser = new Parser({
        fields: ['part_code', 'part_name', 'category', 'stock_quantity', 'unit', 'price', 'location', 'min_stock']
      });
      const csv = parser.parse(report.details);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=stock-status.csv');
      return res.send(csv);
    }
    
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/inventory-changes', (req, res) => {
  try {
    const changes = reportService.getInventoryChangeReport();
    
    if (req.query.format === 'csv') {
      const parser = new Parser({
        fields: ['created_at', 'action', 'operator', 'reason', 'part_code', 'part_name']
      });
      const csv = parser.parse(changes);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=inventory-changes.csv');
      return res.send(csv);
    }
    
    res.json({ success: true, data: changes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/part-flow/:partId', (req, res) => {
  try {
    const report = reportService.getPartFlowReport(req.params.partId);
    
    if (req.query.format === 'csv') {
      const parser = new Parser({
        fields: ['time', 'type', 'action', 'loan_code', 'engineer', 'work_order', 'quantity', 'remark']
      });
      const csv = parser.parse(report.events);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=part-flow.csv');
      return res.send(csv);
    }
    
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/loan-audit/:loanId', (req, res) => {
  try {
    const report = reportService.getLoanAuditReport(req.params.loanId);
    
    if (!report) {
      return res.status(404).json({ success: false, error: '借用记录不存在' });
    }
    
    if (req.query.format === 'csv') {
      const parser = new Parser({
        fields: ['time', 'action', 'operator', 'before', 'after', 'reason']
      });
      const csv = parser.parse(report.timeline);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=loan-audit.csv');
      return res.send(csv);
    }
    
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/full-audit', (req, res) => {
  try {
    const report = reportService.getFullAuditReport();
    
    if (req.query.format === 'csv') {
      const parser = new Parser({
        fields: ['created_at', 'entity_type', 'entity_id', 'action', 'operator', 'reason']
      });
      const csv = parser.parse(report.details);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=full-audit.csv');
      return res.send(csv);
    }
    
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/dashboard', (req, res) => {
  try {
    const stats = reportService.getStatistics();
    const unreturned = reportService.getUnreturnedSummary();
    const stock = reportService.getStockStatusReport();
    
    res.json({
      success: true,
      data: {
        statistics: stats,
        unreturned: {
          total: unreturned.total_count,
          by_status: unreturned.by_status,
          unbound_workorder: unreturned.unbound_workorder,
          closed_workorder_pending: unreturned.closed_workorder_pending,
          overdue_7days_plus: unreturned.overdue_7days_plus,
          overdue_30days_plus: unreturned.overdue_30days_plus
        },
        stock: {
          total_value: stock.total_value,
          total_count: stock.total_count,
          low_stock_count: stock.low_stock.length,
          zero_stock_count: stock.zero_stock.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
