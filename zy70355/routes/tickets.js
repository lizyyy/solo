const express = require('express');
const router = express.Router();
const {
  createTicket,
  assignPriority,
  startProcessing,
  pauseSLA,
  resumeSLA,
  closeTicket,
  appealTicket,
  approveAppeal,
  getTicket,
  getAllTickets,
  getStatistics,
  getTicketTimeline,
  PRIORITY_SLA,
  PAUSE_TYPES
} = require('../models/ticket');

router.get('/priorities', (req, res) => {
  res.json({
    priorities: Object.keys(PRIORITY_SLA).map(key => ({
      key,
      sla: PRIORITY_SLA[key]
    }))
  });
});

router.get('/pause-types', (req, res) => {
  res.json({
    pauseTypes: Object.keys(PAUSE_TYPES).map(key => ({
      key,
      ...PAUSE_TYPES[key]
    }))
  });
});

router.post('/', (req, res) => {
  try {
    const { title, type, priority, customerId, description } = req.body;
    
    if (!title || !type || !priority || !customerId) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['title', 'type', 'priority', 'customerId']
      });
    }
    
    if (!PRIORITY_SLA[priority]) {
      return res.status(400).json({
        error: `Invalid priority: ${priority}`,
        validPriorities: Object.keys(PRIORITY_SLA)
      });
    }
    
    const ticket = createTicket({
      title,
      type,
      priority,
      customerId,
      description: description || ''
    });
    
    res.status(201).json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', (req, res) => {
  try {
    const tickets = getAllTickets();
    res.json({ count: tickets.length, tickets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const stats = getStatistics(startDate, endDate);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:ticketId', (req, res) => {
  try {
    const ticket = getTicket(req.params.ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:ticketId/timeline', (req, res) => {
  try {
    const timeline = getTicketTimeline(req.params.ticketId);
    if (!timeline) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(timeline);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:ticketId/assign-priority', (req, res) => {
  try {
    const { priority } = req.body;
    if (!priority) {
      return res.status(400).json({ error: 'Priority is required' });
    }
    
    const ticket = assignPriority(req.params.ticketId, priority);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    res.json(ticket);
  } catch (error) {
    if (error.message.includes('closed')) {
      return res.status(409).json({ error: error.message });
    }
    if (error.message.includes('Invalid priority')) {
      return res.status(400).json({ 
        error: error.message,
        validPriorities: Object.keys(PRIORITY_SLA)
      });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/:ticketId/start', (req, res) => {
  try {
    const { assignee } = req.body;
    if (!assignee) {
      return res.status(400).json({ error: 'Assignee is required' });
    }
    
    const ticket = startProcessing(req.params.ticketId, assignee);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    res.json(ticket);
  } catch (error) {
    if (error.message.includes('closed')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/:ticketId/pause', (req, res) => {
  try {
    const { pauseType, reason } = req.body;
    
    if (!pauseType) {
      return res.status(400).json({ 
        error: 'Pause type is required',
        validPauseTypes: Object.keys(PAUSE_TYPES)
      });
    }
    
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ error: 'Pause reason is required' });
    }
    
    if (!PAUSE_TYPES[pauseType]) {
      return res.status(400).json({ 
        error: `Invalid pause type: ${pauseType}`,
        validPauseTypes: Object.keys(PAUSE_TYPES)
      });
    }
    
    const ticket = pauseSLA(req.params.ticketId, pauseType, reason);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    res.json(ticket);
  } catch (error) {
    if (error.message.includes('closed')) {
      return res.status(409).json({ error: error.message });
    }
    if (error.message.includes('Pause reason')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes('Invalid pause type')) {
      return res.status(400).json({ 
        error: error.message,
        validPauseTypes: Object.keys(PAUSE_TYPES)
      });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/:ticketId/resume', (req, res) => {
  try {
    const ticket = resumeSLA(req.params.ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    res.json(ticket);
  } catch (error) {
    if (error.message.includes('closed')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/:ticketId/close', (req, res) => {
  try {
    const ticket = closeTicket(req.params.ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:ticketId/appeal', (req, res) => {
  try {
    const { appealReason, adjustPauseReason } = req.body;
    
    if (!appealReason) {
      return res.status(400).json({ error: 'Appeal reason is required' });
    }
    
    const ticket = appealTicket(req.params.ticketId, appealReason, adjustPauseReason);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    res.json(ticket);
  } catch (error) {
    if (error.message.includes('Only closed')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/:ticketId/approve-appeal', (req, res) => {
  try {
    const { approvedPauseType, approvedReason } = req.body;
    
    if (!approvedPauseType || !approvedReason) {
      return res.status(400).json({ error: 'Approved pause type and reason are required' });
    }
    
    if (!PAUSE_TYPES[approvedPauseType]) {
      return res.status(400).json({ 
        error: `Invalid pause type: ${approvedPauseType}`,
        validPauseTypes: Object.keys(PAUSE_TYPES)
      });
    }
    
    const ticket = approveAppeal(req.params.ticketId, approvedPauseType, approvedReason);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    
    res.json(ticket);
  } catch (error) {
    if (error.message.includes('No pending appeal')) {
      return res.status(409).json({ error: error.message });
    }
    if (error.message.includes('Invalid pause type')) {
      return res.status(400).json({ 
        error: error.message,
        validPauseTypes: Object.keys(PAUSE_TYPES)
      });
    }
    if (error.message.includes('Approve reason')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
