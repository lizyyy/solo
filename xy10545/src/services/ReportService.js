const Conversation = require('../models/Conversation');
const Agent = require('../models/Agent');
const AgentHandler = require('../models/AgentHandler');
const ProcessingResult = require('../models/ProcessingResult');
const Queue = require('../models/Queue');
const Intent = require('../models/Intent');
const Emotion = require('../models/Emotion');
const TimelineEvent = require('../models/TimelineEvent');

class ReportService {
  static getConversationTimeline(conversationId) {
    const conversation = Conversation.findById(conversationId);
    if (!conversation) return null;
    
    const events = TimelineEvent.findByConversation(conversationId);
    const messages = require('../models/Message').findByConversation(conversationId);
    const intents = Intent.findByConversation(conversationId);
    const emotions = Emotion.findByConversation(conversationId);
    
    const allEvents = [
      ...events.map(e => ({
        ...e,
        source: 'timeline'
      })),
      ...messages.map(m => ({
        id: m.id,
        event_type: 'message',
        event_data: { role: m.role, content: m.content },
        created_at: m.created_at,
        source: 'message'
      }))
    ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    return {
      conversation_id: conversationId,
      conversation_status: conversation.status,
      user_id: conversation.user_id,
      created_at: conversation.created_at,
      closed_at: conversation.closed_at,
      summary: conversation.summary,
      timeline: allEvents,
      intents,
      emotions,
      processing_results: ProcessingResult.findByConversation(conversationId),
      corrections: require('../models/Correction').findByConversation(conversationId)
    };
  }
  
  static getQueueReport() {
    const queue = Queue.getQueue();
    const agentStats = Agent.getStats();
    
    const queueWithDetails = queue.map(q => {
      const conv = Conversation.findById(q.conversation_id);
      const primaryIntent = Intent.getPrimaryIntent(q.conversation_id);
      const highestEmotion = Emotion.getHighestPriorityEmotion(q.conversation_id);
      
      return {
        ...q,
        user_id: conv?.user_id,
        primary_intent: primaryIntent?.intent_name,
        highest_emotion: highestEmotion?.emotion_type,
        waiting_time: this.calculateWaitingTime(q.waiting_since)
      };
    });
    
    return {
      generated_at: new Date().toISOString(),
      queue_size: queue.length,
      max_priority: queue.length > 0 ? Math.max(...queue.map(q => q.priority_score)) : 0,
      agent_stats: agentStats,
      queue_entries: queueWithDetails
    };
  }
  
  static getAgentPerformanceReport() {
    const agents = Agent.findAll();
    
    return {
      generated_at: new Date().toISOString(),
      agents: agents.map(agent => {
        const stats = AgentHandler.getAgentStats(agent.id);
        return {
          agent_id: agent.id,
          agent_name: agent.name,
          status: agent.status,
          current_conversation: agent.current_conversation_id,
          total_handled: stats.total_handled,
          completed: stats.completed,
          rejected: stats.rejected,
          skills: agent.skills
        };
      }),
      summary: {
        total_agents: agents.length,
        online_agents: agents.filter(a => a.status === 'online').length,
        busy_agents: agents.filter(a => a.current_conversation_id).length
      }
    };
  }
  
  static getOverallStats() {
    const resultStats = ProcessingResult.getStats();
    const agentStats = Agent.getStats();
    
    const allConversations = Conversation.findAll();
    const closedConversations = Conversation.findAll({ status: 'closed' });
    const completedConversations = Conversation.findAll({ status: 'completed' });
    
    const emotionCounts = {};
    const intentCounts = {};
    
    for (const conv of allConversations) {
      const emotion = Emotion.getHighestPriorityEmotion(conv.id);
      if (emotion) {
        emotionCounts[emotion.emotion_type] = (emotionCounts[emotion.emotion_type] || 0) + 1;
      }
      
      const intent = Intent.getPrimaryIntent(conv.id);
      if (intent) {
        intentCounts[intent.intent_name] = (intentCounts[intent.intent_name] || 0) + 1;
      }
    }
    
    return {
      generated_at: new Date().toISOString(),
      conversations: {
        total: allConversations.length,
        closed: closedConversations.length + completedConversations.length,
        in_progress: allConversations.length - closedConversations.length - completedConversations.length,
        bot_only: allConversations.filter(c => c.status === 'bot').length
      },
      processing: {
        total_results: resultStats.total_results || 0,
        follow_up_count: resultStats.follow_up_count || 0,
        avg_satisfaction: resultStats.avg_satisfaction || 0
      },
      agents: agentStats,
      emotions: emotionCounts,
      intents: intentCounts,
      queue: {
        current_size: Queue.getSize()
      }
    };
  }
  
  static exportReport(format = 'json') {
    const data = {
      timeline_sample: null,
      queue_report: this.getQueueReport(),
      agent_report: this.getAgentPerformanceReport(),
      overall_stats: this.getOverallStats()
    };
    
    if (format === 'csv') {
      return this.convertToCSV(data);
    }
    
    return data;
  }
  
  static calculateWaitingTime(since) {
    const start = new Date(since);
    const now = new Date();
    const diffMs = now - start;
    
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟`;
    }
    return `${minutes}分钟`;
  }
  
  static convertToCSV(data) {
    let csv = 'Report Type,Metric,Value\n';
    
    if (data.overall_stats) {
      const s = data.overall_stats;
      csv += `Conversations,Total,${s.conversations.total}\n`;
      csv += `Conversations,Closed,${s.conversations.closed}\n`;
      csv += `Conversations,In Progress,${s.conversations.in_progress}\n`;
      csv += `Agents,Total,${s.agents.total_agents}\n`;
      csv += `Agents,Online,${s.agents.online_agents}\n`;
      csv += `Agents,Busy,${s.agents.busy_agents}\n`;
      csv += `Queue,Current Size,${s.queue.current_size}\n`;
      csv += `Processing,Avg Satisfaction,${s.processing.avg_satisfaction}\n`;
    }
    
    return csv;
  }
}

module.exports = ReportService;
