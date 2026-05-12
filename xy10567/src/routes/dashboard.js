const express = require('express');
const router = express.Router();
const reportService = require('../services/reports');
const store = require('../models/store');

router.get('/summary', (req, res) => {
  try {
    const dashboard = reportService.generateDashboard();
    
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/export', (req, res) => {
  try {
    const { format } = req.query;
    const dashboard = reportService.generateDashboard();

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=dashboard.csv');
      res.send(reportService.exportToCSV(dashboard));
    } else {
      res.json({
        success: true,
        data: dashboard
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/customers', (req, res) => {
  try {
    const customers = store.getCustomers();
    const enriched = customers.map(c => {
      const workflows = store.getRenewalWorkflowsByCustomer(c.id);
      const latestWorkflow = workflows.sort((a, b) => 
        new Date(b.updatedAt) - new Date(a.updatedAt)
      )[0];
      const healthScore = store.getLatestHealthScore(c.id);
      const openTickets = store.getOpenTickets(c.id);
      const quotes = store.getQuotes(c.id);

      return {
        ...c,
        latestWorkflow: latestWorkflow ? {
          id: latestWorkflow.id,
          status: latestWorkflow.status,
          updatedAt: latestWorkflow.updatedAt,
          riskFlags: latestWorkflow.riskFlags
        } : null,
        healthScore: healthScore ? {
          score: healthScore.score,
          level: healthScore.level
        } : null,
        openTickets: {
          count: openTickets.length,
          criticalCount: openTickets.filter(t => 
            t.priority === 'critical' || t.severity === 'severe'
          ).length
        },
        latestQuote: quotes[0] ? {
          version: quotes[0].version,
          finalTotal: quotes[0].finalTotal,
          status: quotes[0].status
        } : null
      };
    });

    res.json({
      success: true,
      data: enriched,
      count: enriched.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/health', (req, res) => {
  try {
    const workflows = store.getRenewalWorkflows();
    const customers = store.getCustomers();
    const tickets = Array.from(store.tickets.values());
    const quotes = Array.from(store.quotes.values());

    res.json({
      success: true,
      data: {
        service: 'customer-success-renewal-api',
        status: 'running',
        timestamp: new Date().toISOString(),
        entities: {
          customers: customers.length,
          workflows: workflows.length,
          tickets: tickets.length,
          quotes: quotes.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
