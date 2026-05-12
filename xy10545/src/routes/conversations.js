const express = require('express');
const router = express.Router();
const ConversationService = require('../services/ConversationService');
const { handleError, ApiError } = require('../utils/errorHandler');

router.post('/', async (req, res, next) => {
  try {
    const result = await ConversationService.createConversation(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const detail = ConversationService.getConversationDetail(req.params.id);
    if (!detail) {
      throw new ApiError('会话不存在', 'CONVERSATION_NOT_FOUND', 404);
    }
    res.json({ success: true, data: detail });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/messages', async (req, res, next) => {
  try {
    const result = await ConversationService.addMessage(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/intents', async (req, res, next) => {
  try {
    const result = await ConversationService.addIntent(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/emotions', async (req, res, next) => {
  try {
    const result = await ConversationService.addEmotion(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/close', async (req, res, next) => {
  try {
    const result = await ConversationService.closeConversation(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const Conversation = require('../models/Conversation');
    const { status, user_id } = req.query;
    const filters = {};
    if (status) filters.status = status;
    if (user_id) filters.user_id = user_id;
    
    const conversations = Conversation.findAll(filters);
    
    res.json({
      success: true,
      data: conversations
    });
  } catch (err) {
    next(err);
  }
});

router.use(handleError);

module.exports = router;
