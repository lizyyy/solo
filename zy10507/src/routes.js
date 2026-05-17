const express = require('express');
const router = express.Router();
const ticketService = require('./ticketService');
const exportService = require('./exportService');

router.post('/tickets', async (req, res) => {
  try {
    const ticket = await ticketService.createTicket(req.body);
    res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/tickets', async (req, res) => {
  try {
    const tickets = await ticketService.listTickets(req.query);
    res.json({ success: true, data: tickets });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/tickets/:ticketNumber', async (req, res) => {
  try {
    const ticket = await ticketService.getTicket(req.params.ticketNumber);
    if (!ticket) {
      return res.status(404).json({ success: false, error: '工单不存在' });
    }
    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/tickets/:ticketNumber/advance', async (req, res) => {
  try {
    const ticket = await ticketService.advanceNode(
      req.params.ticketNumber,
      req.body.nextAssignee,
      req.body.processingNotes
    );
    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/tickets/:ticketNumber/escalate', async (req, res) => {
  try {
    const ticket = await ticketService.escalate(
      req.params.ticketNumber,
      req.body.reason,
      req.body.escalatedTo
    );
    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/tickets/:ticketNumber/remind', async (req, res) => {
  try {
    const result = await ticketService.createReminder(
      req.params.ticketNumber,
      req.body.reminderType || 'MANUAL',
      req.body.sentTo
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/tickets/:ticketNumber/exception', async (req, res) => {
  try {
    const ticket = await ticketService.handleException(
      req.params.ticketNumber,
      req.body
    );
    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/tickets/:ticketNumber/correct', async (req, res) => {
  try {
    const ticket = await ticketService.manualCorrection(
      req.params.ticketNumber,
      req.body.correctedBy,
      req.body.correctionType,
      req.body.oldValue,
      req.body.newValue,
      req.body.reason
    );
    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/tickets/:ticketNumber/resolve', async (req, res) => {
  try {
    const ticket = await ticketService.resolveTicket(
      req.params.ticketNumber,
      req.body.conclusion
    );
    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/sla/check', async (req, res) => {
  try {
    const results = await ticketService.checkSLAAndRemind();
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/export/tickets', async (req, res) => {
  try {
    const filePath = await exportService.exportTicketsToCSV(req.query);
    res.download(filePath, `tickets-export-${Date.now()}.csv`);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/export/escalations', async (req, res) => {
  try {
    const filePath = await exportService.exportEscalationsToCSV(req.query);
    res.download(filePath, `escalations-export-${Date.now()}.csv`);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/export/tickets/:ticketNumber', async (req, res) => {
  try {
    const filePath = await exportService.exportSingleTicketToCSV(req.params.ticketNumber);
    res.download(filePath, `ticket-${req.params.ticketNumber}-${Date.now()}.csv`);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/config', (req, res) => {
  res.json({
    success: true,
    data: {
      nodeFlow: ticketService.NODE_FLOW,
      slaConfig: ticketService.SLA_CONFIG
    }
  });
});

module.exports = router;
