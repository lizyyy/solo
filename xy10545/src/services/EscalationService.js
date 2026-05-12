const { v4: uuidv4 } = require('uuid');
const Conversation = require('../models/Conversation');
const Escalation = require('../models/Escalation');
const Queue = require('../models/Queue');
const Agent = require('../models/Agent');
const AgentHandler = require('../models/AgentHandler');
const Intent = require('../models/Intent');
const Emotion = require('../models/Emotion');
const TimelineEvent = require('../models/TimelineEvent');
const { ApiError } = require('../utils/errorHandler');
const config = require('../config');
const logger = require('../utils/logger');

class EscalationService {
  static async requestEscalation(conversationId, data) {
    const { reason, requester = 'bot', idempotency_key, priority_override } = data;
    
    if (idempotency_key) {
      const existing = Escalation.findByIdempotencyKey(idempotency_key);
      if (existing) {
        logger.info('Idempotent request detected, returning existing escalation', { 
          idempotency_key, 
          escalation_id: existing.id 
        });
        return {
          success: true,
          idempotent: true,
          data: this.getEscalationDetail(existing.id)
        };
      }
    }
    
    const conversation = Conversation.findById(conversationId);
    if (!conversation) {
      throw new ApiError('会话不存在', 'CONVERSATION_NOT_FOUND', 404);
    }
    
    if (Conversation.isClosed(conversationId)) {
      throw new ApiError('会话已结束，无法转人工', 'CONVERSATION_CLOSED', 400);
    }
    
    const activeEscalation = Escalation.getActiveEscalation(conversationId);
    if (activeEscalation) {
      logger.warn('会话已有活跃的转人工请求', { 
        conversation_id: conversationId, 
        existing_escalation: activeEscalation.id 
      });
      return {
        success: false,
        duplicate: true,
        error: '会话已有活跃的转人工请求',
        existing_escalation: this.getEscalationDetail(activeEscalation.id)
      };
    }
    
    const hasRecent = Escalation.hasRecentEscalation(conversationId, 2);
    if (hasRecent && !data.force_escalation) {
      logger.info('检测到重复转人工请求（2小时内）', { conversation_id: conversationId });
      return {
        success: false,
        repeat_detected: true,
        message: '2小时内已有转人工记录，如需再次转人工请设置force_escalation=true'
      };
    }
    
    const primaryIntent = Intent.getPrimaryIntent(conversationId);
    const highestEmotion = Emotion.getHighestPriorityEmotion(conversationId);
    
    let priority = priority_override || 5;
    let emotionType = null;
    
    if (highestEmotion && !priority_override) {
      priority = config.EMOTION_PRIORITY[highestEmotion.emotion_type] || 5;
      emotionType = highestEmotion.emotion_type;
    }
    
    const queueSize = Queue.getSize();
    if (queueSize >= config.MAX_QUEUE_SIZE) {
      throw new ApiError('排队人数过多，请稍后再试', 'QUEUE_FULL', 503);
    }
    
    const escalationId = uuidv4();
    const metadata = {
      primary_intent: primaryIntent ? primaryIntent.intent_name : null,
      primary_intent_confidence: primaryIntent ? primaryIntent.confidence : null,
      emotion_detected: highestEmotion ? highestEmotion.emotion_type : null,
      total_intents: Intent.findByConversation(conversationId).length,
      total_emotions: Emotion.findByConversation(conversationId).length
    };
    
    const escalation = Escalation.create({
      id: escalationId,
      conversation_id: conversationId,
      reason,
      priority,
      requester,
      idempotency_key,
      metadata
    });
    
    Conversation.updateStatus(conversationId, 'escalating');
    
    TimelineEvent.create({
      id: uuidv4(),
      conversation_id: conversationId,
      event_type: 'escalation_requested',
      event_data: {
        escalation_id: escalationId,
        reason,
        priority,
        emotion_type: emotionType,
        requester
      },
      status: 'success'
    });
    
    const queueEntry = this.addToQueue(escalation, emotionType);
    
    const availableAgents = Agent.findAvailable();
    let assigned = null;
    
    if (availableAgents.length > 0) {
      assigned = this.assignToAgent(escalation, availableAgents[0]);
    } else {
      TimelineEvent.create({
        id: uuidv4(),
        conversation_id: conversationId,
        event_type: 'waiting_for_agent',
        event_data: {
          queue_position: Queue.getPosition(conversationId),
          queue_size: queueSize + 1,
          reason: 'no_available_agents'
        },
        status: 'info'
      });
    }
    
    logger.info('转人工请求已创建', { 
      conversation_id: conversationId, 
      escalation_id: escalationId,
      assigned: !!assigned
    });
    
    return {
      success: true,
      data: {
        escalation: this.getEscalationDetail(escalationId),
        queue: queueEntry ? this.getQueueInfo(conversationId) : null,
        assigned_agent: assigned ? this.getAgentHandlerDetail(assigned.id) : null,
        context: {
          primary_intent: primaryIntent,
          highest_emotion: highestEmotion,
          priority_score: priority
        }
      }
    };
  }
  
  static addToQueue(escalation, emotionType) {
    const queueEntry = Queue.create({
      id: uuidv4(),
      conversation_id: escalation.conversation_id,
      escalation_id: escalation.id,
      priority_score: escalation.priority,
      emotion_type: emotionType
    });
    
    Escalation.updateStatus(escalation.id, 'queued');
    Conversation.updateStatus(escalation.conversation_id, 'queued');
    
    return queueEntry;
  }
  
  static assignToAgent(escalation, agent) {
    const conversationId = escalation.conversation_id;
    
    const handler = AgentHandler.create({
      id: uuidv4(),
      conversation_id: conversationId,
      agent_id: agent.id,
      escalation_id: escalation.id
    });
    
    Queue.updateStatus(
      Queue.getByConversation(conversationId)?.id,
      'assigned',
      agent.id
    );
    
    Escalation.updateStatus(escalation.id, 'assigned');
    Conversation.updateStatus(conversationId, 'assigned');
    Agent.updateStatus(agent.id, agent.status, conversationId);
    
    TimelineEvent.create({
      id: uuidv4(),
      conversation_id: conversationId,
      event_type: 'agent_assigned',
      event_data: {
        agent_id: agent.id,
        agent_name: agent.name,
        handler_id: handler.id
      },
      status: 'success'
    });
    
    return handler;
  }
  
  static async agentAccept(handlerId, agentId) {
    const handler = AgentHandler.findById(handlerId);
    if (!handler) {
      throw new ApiError('处理记录不存在', 'HANDLER_NOT_FOUND', 404);
    }
    
    if (handler.agent_id !== agentId) {
      throw new ApiError('无权接受此会话', 'UNAUTHORIZED', 403);
    }
    
    if (handler.status === 'accepted') {
      return {
        success: true,
        idempotent: true,
        message: '已接受',
        data: this.getAgentHandlerDetail(handlerId)
      };
    }
    
    if (['completed', 'rejected'].includes(handler.status)) {
      throw new ApiError('会话已结束，无法接受', 'HANDLER_FINALIZED', 400);
    }
    
    AgentHandler.accept(handlerId);
    Escalation.updateStatus(handler.escalation_id, 'in_progress');
    Conversation.updateStatus(handler.conversation_id, 'in_progress');
    
    const queueEntry = Queue.getByConversation(handler.conversation_id);
    if (queueEntry) {
      Queue.updateStatus(queueEntry.id, 'processing');
    }
    
    TimelineEvent.create({
      id: uuidv4(),
      conversation_id: handler.conversation_id,
      event_type: 'agent_accepted',
      event_data: { handler_id: handlerId, agent_id: agentId },
      status: 'success'
    });
    
    return {
      success: true,
      data: this.getAgentHandlerDetail(handlerId)
    };
  }
  
  static async agentReject(handlerId, agentId, reason) {
    const handler = AgentHandler.findById(handlerId);
    if (!handler) {
      throw new ApiError('处理记录不存在', 'HANDLER_NOT_FOUND', 404);
    }
    
    if (handler.agent_id !== agentId) {
      throw new ApiError('无权拒绝此会话', 'UNAUTHORIZED', 403);
    }
    
    if (handler.status === 'rejected') {
      return {
        success: true,
        idempotent: true,
        message: '已拒绝',
        data: this.getAgentHandlerDetail(handlerId)
      };
    }
    
    if (['completed', 'accepted'].includes(handler.status)) {
      throw new ApiError('无法拒绝此会话', 'INVALID_STATUS', 400);
    }
    
    AgentHandler.reject(handlerId);
    Agent.updateStatus(agentId, 'online', null);
    
    TimelineEvent.create({
      id: uuidv4(),
      conversation_id: handler.conversation_id,
      event_type: 'agent_rejected',
      event_data: { handler_id: handlerId, agent_id: agentId, reason },
      status: 'warning'
    });
    
    const escalation = Escalation.findById(handler.escalation_id);
    const queueEntry = Queue.getByConversation(handler.conversation_id);
    
    if (queueEntry) {
      Queue.updateStatus(queueEntry.id, 'queued', null);
    }
    Escalation.updateStatus(handler.escalation_id, 'queued');
    Conversation.updateStatus(handler.conversation_id, 'queued');
    
    const availableAgents = Agent.findAvailable().filter(a => a.id !== agentId);
    let reassigned = null;
    
    if (availableAgents.length > 0) {
      reassigned = this.assignToAgent(escalation, availableAgents[0]);
    }
    
    return {
      success: true,
      reassigned: !!reassigned,
      data: {
        original_handler: this.getAgentHandlerDetail(handlerId),
        new_assignment: reassigned ? this.getAgentHandlerDetail(reassigned.id) : null,
        current_queue_position: Queue.getPosition(handler.conversation_id)
      }
    };
  }
  
  static getEscalationDetail(escalationId) {
    const escalation = Escalation.findById(escalationId);
    if (!escalation) return null;
    
    const queue = Queue.getByConversation(escalation.conversation_id);
    const position = queue ? Queue.getPosition(escalation.conversation_id) : null;
    
    return {
      ...escalation,
      queue_position: position,
      queue_entry: queue
    };
  }
  
  static getQueueInfo(conversationId) {
    const queue = Queue.getByConversation(conversationId);
    if (!queue) return null;
    
    return {
      ...queue,
      current_position: Queue.getPosition(conversationId),
      total_queue_size: Queue.getSize()
    };
  }
  
  static getAgentHandlerDetail(handlerId) {
    const handler = AgentHandler.findById(handlerId);
    if (!handler) return null;
    
    const agent = Agent.findById(handler.agent_id);
    return {
      ...handler,
      agent: agent ? { id: agent.id, name: agent.name } : null
    };
  }
  
  static getFullContext(conversationId) {
    const conversation = Conversation.findById(conversationId);
    if (!conversation) return null;
    
    return {
      conversation,
      intents: Intent.findByConversation(conversationId),
      emotions: Emotion.findByConversation(conversationId),
      escalations: Escalation.findByConversation(conversationId),
      current_queue: Queue.getByConversation(conversationId) ? 
        this.getQueueInfo(conversationId) : null,
      current_handler: AgentHandler.findActiveByConversation(conversationId) ?
        this.getAgentHandlerDetail(AgentHandler.findActiveByConversation(conversationId).id) : null
    };
  }
}

module.exports = EscalationService;
