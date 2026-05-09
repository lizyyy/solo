const express = require('express');
const router = express.Router();

const clusterService = require('../services/clusterService');
const ticketService = require('../services/ticketService');
const assignService = require('../services/assignService');
const supervisionService = require('../services/supervisionService');
const historyService = require('../services/historyService');

router.post('/complaints', (req, res) => {
  try {
    const { citizen_name, citizen_phone, content, area, location, category, urgency_level } = req.body;
    
    if (!citizen_name || !content) {
      return res.status(400).json({ error: '缺少必填字段: citizen_name, content' });
    }
    
    const complaint = ticketService.createComplaint({
      citizen_name,
      citizen_phone,
      content,
      area,
      location,
      category,
      urgency_level
    });
    
    res.json({
      success: true,
      data: complaint
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/complaints/batch', (req, res) => {
  try {
    const { complaints } = req.body;
    
    if (!Array.isArray(complaints) || complaints.length === 0) {
      return res.status(400).json({ error: '请提供有效的投诉数据数组' });
    }
    
    const created = ticketService.batchCreateComplaints(complaints);
    
    res.json({
      success: true,
      data: {
        count: created.length,
        complaints: created
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/cluster', (req, res) => {
  try {
    const { timeWindowHours, similarityThreshold, forceRerun } = req.body;
    
    const result = clusterService.runClustering({
      timeWindowHours,
      similarityThreshold,
      forceRerun: forceRerun === true
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/clusters', (req, res) => {
  try {
    const { minComplaints, includeMembers = 'true' } = req.query;
    
    const clusters = clusterService.getClustersWithDetails({
      minComplaints: minComplaints ? parseInt(minComplaints) : 1,
      includeMembers: includeMembers !== 'false'
    });
    
    res.json({
      success: true,
      data: clusters
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/clusters/:id', (req, res) => {
  try {
    const cluster = clusterService.getClusterById(parseInt(req.params.id));
    
    if (!cluster) {
      return res.status(404).json({ error: '聚类不存在' });
    }
    
    res.json({
      success: true,
      data: cluster
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/merge', (req, res) => {
  try {
    const { target_ticket_id, source_ticket_id, reason, operator } = req.body;
    
    if (!target_ticket_id || !source_ticket_id) {
      return res.status(400).json({ error: '缺少必填字段: target_ticket_id, source_ticket_id' });
    }
    
    const result = ticketService.mergeTickets(
      parseInt(target_ticket_id),
      parseInt(source_ticket_id),
      reason,
      operator || 'operator'
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/tickets/from-clusters', (req, res) => {
  try {
    const result = ticketService.createTicketsFromAllClusters();
    
    res.json({
      success: true,
      data: result
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/tickets', (req, res) => {
  try {
    const { status, department_id, page, page_size } = req.query;
    
    const tickets = ticketService.getTickets({
      status,
      departmentId: department_id ? parseInt(department_id) : null,
      page: page ? parseInt(page) : 1,
      pageSize: page_size ? parseInt(page_size) : 20
    });
    
    res.json({
      success: true,
      data: tickets
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/tickets/:id', (req, res) => {
  try {
    const ticket = ticketService.getTicketById(parseInt(req.params.id));
    
    if (!ticket) {
      return res.status(404).json({ error: '工单不存在' });
    }
    
    res.json({
      success: true,
      data: ticket
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/tickets/:id/assign', (req, res) => {
  try {
    const { department_id, operator, reason } = req.body;
    
    if (!department_id) {
      return res.status(400).json({ error: '缺少必填字段: department_id' });
    }
    
    const result = assignService.assignTicketToDepartment(
      parseInt(req.params.id),
      parseInt(department_id),
      operator || 'operator',
      reason
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/tickets/:id/auto-assign', (req, res) => {
  try {
    const { operator } = req.body;
    
    const result = assignService.autoAssignTicket(
      parseInt(req.params.id),
      operator || 'system'
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/tickets/auto-assign-all', (req, res) => {
  try {
    const result = assignService.autoAssignAllPendingTickets();
    
    res.json({
      success: true,
      data: result
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/tickets/:id/reply', (req, res) => {
  try {
    const { content, author, is_official } = req.body;
    
    if (!content || !author) {
      return res.status(400).json({ error: '缺少必填字段: content, author' });
    }
    
    const result = assignService.addReply(
      parseInt(req.params.id),
      content,
      author,
      is_official === true
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/tickets/:id/supervise', (req, res) => {
  try {
    const { level, reason, supervisor } = req.body;
    
    if (!level) {
      return res.status(400).json({ error: '缺少必填字段: level (remind|warning|urgent)' });
    }
    
    const result = supervisionService.addSupervision(
      parseInt(req.params.id),
      level,
      reason,
      supervisor || 'operator'
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/tickets/:id/close', (req, res) => {
  try {
    const { closed_by } = req.body;
    
    const result = ticketService.closeTicket(
      parseInt(req.params.id),
      closed_by || 'operator'
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/tickets/:id/withdraw', (req, res) => {
  try {
    const { operator } = req.body;
    
    const result = ticketService.withdrawTicket(
      parseInt(req.params.id),
      operator || 'operator'
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.get('/departments', (req, res) => {
  try {
    const departments = assignService.getDepartments();
    
    res.json({
      success: true,
      data: departments
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/departments/match', (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: '缺少必填字段: content' });
    }
    
    const result = assignService.matchDepartmentByContent(content);
    
    res.json({
      success: true,
      data: result
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/supervision', (req, res) => {
  try {
    const { level, page, page_size } = req.query;
    
    const list = supervisionService.getSupervisionList({
      level,
      page: page ? parseInt(page) : 1,
      pageSize: page_size ? parseInt(page_size) : 20
    });
    
    res.json({
      success: true,
      data: list
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/supervision/overdue', (req, res) => {
  try {
    const overdue = supervisionService.checkOverdueTickets();
    
    res.json({
      success: true,
      data: {
        count: overdue.length,
        tickets: overdue
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/statistics', (req, res) => {
  try {
    const stats = supervisionService.getStatistics();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/statistics/department-performance', (req, res) => {
  try {
    const performance = supervisionService.getDepartmentPerformance();
    
    res.json({
      success: true,
      data: performance
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/history/:entityType/:entityId', (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const { limit, action } = req.query;
    
    const logs = historyService.getHistory(entityType, parseInt(entityId), {
      limit: limit ? parseInt(limit) : 100,
      action
    });
    
    const formatted = historyService.formatHistoryForDisplay(logs);
    
    res.json({
      success: true,
      data: {
        raw: logs,
        formatted: formatted
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
