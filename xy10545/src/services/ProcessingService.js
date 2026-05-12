const { v4: uuidv4 } = require('uuid');
const Conversation = require('../models/Conversation');
const AgentHandler = require('../models/AgentHandler');
const ProcessingResult = require('../models/ProcessingResult');
const Correction = require('../models/Correction');
const TimelineEvent = require('../models/TimelineEvent');
const Agent = require('../models/Agent');
const { ApiError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

class ProcessingService {
  static async submitResult(conversationId, data) {
    const { 
      resolution, 
      category, 
      follow_up_needed = 0, 
      satisfaction_score,
      notes,
      idempotency_key,
      closed_by
    } = data;
    
    if (idempotency_key) {
      const existing = ProcessingResult.findByIdempotencyKey(idempotency_key);
      if (existing) {
        return {
          success: true,
          idempotent: true,
          data: existing
        };
      }
    }
    
    const conversation = Conversation.findById(conversationId);
    if (!conversation) {
      throw new ApiError('会话不存在', 'CONVERSATION_NOT_FOUND', 404);
    }
    
    if (Conversation.isClosed(conversationId)) {
      throw new ApiError('会话已结束，无法提交结果', 'CONVERSATION_CLOSED', 400);
    }
    
    const activeHandler = AgentHandler.findActiveByConversation(conversationId);
    if (!activeHandler) {
      throw new ApiError('没有活跃的人工处理记录', 'NO_ACTIVE_HANDLER', 400);
    }
    
    const result = ProcessingResult.create({
      id: uuidv4(),
      conversation_id: conversationId,
      agent_handler_id: activeHandler.id,
      resolution,
      category,
      follow_up_needed: follow_up_needed ? 1 : 0,
      satisfaction_score,
      idempotency_key
    });
    
    AgentHandler.complete(activeHandler.id, notes);
    Agent.updateStatus(activeHandler.agent_id, 'online', null);
    
    Conversation.updateStatus(conversationId, 'completed', `处理结果: ${resolution}`);
    
    TimelineEvent.create({
      id: uuidv4(),
      conversation_id: conversationId,
      event_type: 'result_submitted',
      event_data: {
        result_id: result.id,
        resolution,
        category,
        satisfaction_score,
        follow_up_needed: !!follow_up_needed
      },
      status: 'success'
    });
    
    logger.info('处理结果已提交', { conversation_id: conversationId, result_id: result.id });
    
    return {
      success: true,
      data: {
        result,
        conversation: {
          id: conversationId,
          status: 'completed',
          summary: `处理结果: ${resolution}`
        }
      }
    };
  }
  
  static async makeCorrection(conversationId, data) {
    const { field_type, old_value, new_value, corrected_by, reason, id } = data;
    
    const conversation = Conversation.findById(conversationId);
    if (!conversation) {
      throw new ApiError('会话不存在', 'CONVERSATION_NOT_FOUND', 404);
    }
    
    if (!field_type || old_value === undefined || new_value === undefined) {
      throw new ApiError('缺少必填字段: field_type, old_value, new_value', 'MISSING_FIELDS', 400);
    }
    
    if (!corrected_by) {
      throw new ApiError('必须指定修正者', 'MISSING_OPERATOR', 400);
    }
    
    const correction = Correction.create({
      id: id || uuidv4(),
      conversation_id: conversationId,
      field_type,
      old_value: JSON.stringify(old_value),
      new_value: JSON.stringify(new_value),
      corrected_by,
      reason
    });
    
    TimelineEvent.create({
      id: uuidv4(),
      conversation_id: conversationId,
      event_type: 'correction_made',
      event_data: {
        correction_id: correction.id,
        field_type,
        old_value,
        new_value,
        corrected_by,
        reason
      },
      status: 'warning'
    });
    
    logger.info('人工修正已记录', { 
      conversation_id: conversationId, 
      field_type, 
      corrected_by 
    });
    
    return {
      success: true,
      data: {
        ...correction,
        old_value,
        new_value
      }
    };
  }
  
  static getConversationResults(conversationId) {
    return ProcessingResult.findByConversation(conversationId);
  }
  
  static getCorrections(conversationId) {
    const corrections = Correction.findByConversation(conversationId);
    return corrections.map(c => ({
      ...c,
      old_value: JSON.parse(c.old_value),
      new_value: JSON.parse(c.new_value)
    }));
  }
}

module.exports = ProcessingService;
