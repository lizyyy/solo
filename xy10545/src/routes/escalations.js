const express = require('express');
const router = express.Router();
const EscalationService = require('../services/EscalationService');
const Queue = require('../models/Queue');
const Agent = require('../models/Agent');
const { handleError, ApiError } = require('../utils/errorHandler');

router.post('/', async (req, res, next) => {
  try {
    const { conversation_id, ...data } = req.body;
    if (!conversation_id) {
      throw new ApiError('缺少conversation_id', 'MISSING_CONVERSATION_ID', 400);
    }
    const result = await EscalationService.requestEscalation(conversation_id, data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/queue', async (req, res, next) => {
  try {
    const queue = Queue.getQueue();
    const queueWithDetails = queue.map(q => ({
      ...q,
      position: Queue.getPosition(q.conversation_id)
    }));
    
    res.json({
      success: true,
      data: {
        queue_size: queue.length,
        max_priority: queue.length > 0 ? Math.max(...queue.map(q => q.priority_score)) : 0,
        entries: queueWithDetails
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/agents', async (req, res, next) => {
  try {
    const agents = Agent.findAll();
    res.json({
      success: true,
      data: agents
    });
  } catch (err) {
    next(err);
  }
});

router.post('/agents/online', async (req, res, next) => {
  try {
    const { agent_id } = req.body;
    if (!agent_id) {
      throw new ApiError('缺少agent_id', 'MISSING_AGENT_ID', 400);
    }
    const agent = Agent.updateStatus(agent_id, 'online');
    res.json({ success: true, data: agent });
  } catch (err) {
    next(err);
  }
});

router.post('/handlers/:handlerId/accept', async (req, res, next) => {
  try {
    const { agent_id } = req.body;
    if (!agent_id) {
      throw new ApiError('缺少agent_id', 'MISSING_AGENT_ID', 400);
    }
    const result = await EscalationService.agentAccept(req.params.handlerId, agent_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/handlers/:handlerId/reject', async (req, res, next) => {
  try {
    const { agent_id, reason } = req.body;
    if (!agent_id) {
      throw new ApiError('缺少agent_id', 'MISSING_AGENT_ID', 400);
    }
    const result = await EscalationService.agentReject(req.params.handlerId, agent_id, reason);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/context/:conversationId', async (req, res, next) => {
  try {
    const context = EscalationService.getFullContext(req.params.conversationId);
    if (!context) {
      throw new ApiError('会话不存在', 'CONVERSATION_NOT_FOUND', 404);
    }
    res.json({ success: true, data: context });
  } catch (err) {
    next(err);
  }
});

router.use(handleError);

module.exports = router;
