const { v4: uuidv4 } = require('uuid');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Intent = require('../models/Intent');
const Emotion = require('../models/Emotion');
const TimelineEvent = require('../models/TimelineEvent');
const { ApiError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

class ConversationService {
  static async createConversation(data) {
    const { id, user_id, channel = 'web' } = data;
    
    if (id && Conversation.findById(id)) {
      logger.warn('会话ID已存在', { id });
      return {
        success: true,
        idempotent: true,
        data: this.getConversationDetail(id)
      };
    }
    
    const conversationId = id || uuidv4();
    
    const conversation = Conversation.create({
      id: conversationId,
      user_id,
      channel
    });
    
    TimelineEvent.create({
      id: uuidv4(),
      conversation_id: conversationId,
      event_type: 'conversation_created',
      event_data: { user_id, channel },
      status: 'success'
    });
    
    logger.info('会话已创建', { conversation_id: conversationId, user_id });
    
    return {
      success: true,
      data: this.getConversationDetail(conversationId)
    };
  }
  
  static async addMessage(conversationId, data) {
    const { role, content, id } = data;
    
    if (!['user', 'bot', 'agent'].includes(role)) {
      throw new ApiError('无效的消息角色', 'INVALID_ROLE', 400);
    }
    
    const conversation = Conversation.findById(conversationId);
    if (!conversation) {
      throw new ApiError('会话不存在', 'CONVERSATION_NOT_FOUND', 404);
    }
    
    if (Conversation.isClosed(conversationId)) {
      throw new ApiError('会话已结束，无法添加消息', 'CONVERSATION_CLOSED', 400);
    }
    
    if (id && Message.findById(id)) {
      return {
        success: true,
        idempotent: true,
        data: Message.findById(id)
      };
    }
    
    const message = Message.create({
      id: id || uuidv4(),
      conversation_id: conversationId,
      role,
      content
    });
    
    Conversation.updateStatus(conversationId, conversation.status);
    
    TimelineEvent.create({
      id: uuidv4(),
      conversation_id: conversationId,
      event_type: 'message_sent',
      event_data: { message_id: message.id, role },
      status: 'success'
    });
    
    logger.info('消息已添加', { conversation_id: conversationId, message_id: message.id, role });
    
    return {
      success: true,
      data: message
    };
  }
  
  static async addIntent(conversationId, data) {
    const { intent_name, confidence, slot_values, source = 'bot', id } = data;
    
    const conversation = Conversation.findById(conversationId);
    if (!conversation) {
      throw new ApiError('会话不存在', 'CONVERSATION_NOT_FOUND', 404);
    }
    
    if (id && Intent.findById(id)) {
      return {
        success: true,
        idempotent: true,
        data: Intent.findById(id)
      };
    }
    
    const intent = Intent.create({
      id: id || uuidv4(),
      conversation_id: conversationId,
      intent_name,
      confidence,
      slot_values,
      source
    });
    
    TimelineEvent.create({
      id: uuidv4(),
      conversation_id: conversationId,
      event_type: 'intent_detected',
      event_data: { 
        intent_id: intent.id, 
        intent_name, 
        confidence,
        source
      },
      status: 'success'
    });
    
    logger.info('意图已记录', { conversation_id: conversationId, intent_name });
    
    return {
      success: true,
      data: intent
    };
  }
  
  static async addEmotion(conversationId, data) {
    const { emotion_type, confidence, triggered_by, id } = data;
    
    const validEmotions = ['angry', 'frustrated', 'anxious', 'confused', 'neutral', 'happy'];
    if (!validEmotions.includes(emotion_type)) {
      throw new ApiError('无效的情绪类型', 'INVALID_EMOTION', 400);
    }
    
    const conversation = Conversation.findById(conversationId);
    if (!conversation) {
      throw new ApiError('会话不存在', 'CONVERSATION_NOT_FOUND', 404);
    }
    
    if (id && Emotion.findById(id)) {
      return {
        success: true,
        idempotent: true,
        data: Emotion.findById(id)
      };
    }
    
    const emotion = Emotion.create({
      id: id || uuidv4(),
      conversation_id: conversationId,
      emotion_type,
      confidence,
      triggered_by
    });
    
    TimelineEvent.create({
      id: uuidv4(),
      conversation_id: conversationId,
      event_type: 'emotion_detected',
      event_data: { 
        emotion_id: emotion.id, 
        emotion_type, 
        confidence,
        triggered_by
      },
      status: 'success'
    });
    
    logger.info('情绪已记录', { conversation_id: conversationId, emotion_type });
    
    return {
      success: true,
      data: emotion
    };
  }
  
  static async closeConversation(conversationId, data = {}) {
    const { summary, closed_by } = data;
    
    const conversation = Conversation.findById(conversationId);
    if (!conversation) {
      throw new ApiError('会话不存在', 'CONVERSATION_NOT_FOUND', 404);
    }
    
    if (Conversation.isClosed(conversationId)) {
      return {
        success: true,
        idempotent: true,
        message: '会话已结束',
        data: this.getConversationDetail(conversationId)
      };
    }
    
    const updated = Conversation.updateStatus(conversationId, 'closed', summary);
    
    TimelineEvent.create({
      id: uuidv4(),
      conversation_id: conversationId,
      event_type: 'conversation_closed',
      event_data: { summary, closed_by },
      status: 'success'
    });
    
    logger.info('会话已关闭', { conversation_id: conversationId });
    
    return {
      success: true,
      data: this.getConversationDetail(conversationId)
    };
  }
  
  static getConversationDetail(conversationId) {
    const conversation = Conversation.findById(conversationId);
    if (!conversation) return null;
    
    return {
      ...conversation,
      messages: Message.findByConversation(conversationId),
      intents: Intent.findByConversation(conversationId),
      emotions: Emotion.findByConversation(conversationId),
      primary_intent: Intent.getPrimaryIntent(conversationId),
      highest_emotion: Emotion.getHighestPriorityEmotion(conversationId)
    };
  }
}

module.exports = ConversationService;
