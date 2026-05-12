const { v4: uuidv4 } = require('uuid');
const { initSchema } = require('./database/schema');
const Agent = require('./models/Agent');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');
const Intent = require('./models/Intent');
const Emotion = require('./models/Emotion');

const seedAgents = () => {
  const agents = [
    { id: 'agent_001', name: '张三', skills: ['refund', 'complaint'] },
    { id: 'agent_002', name: '李四', skills: ['order', 'logistics'] },
    { id: 'agent_003', name: '王五', skills: ['technical', 'refund'] }
  ];
  
  for (const agent of agents) {
    if (!Agent.findById(agent.id)) {
      Agent.create(agent);
      console.log(`✅ 创建客服: ${agent.name}`);
    }
  }
};

const seedBotOnlyConversation = () => {
  const convId = 'conv_bot_only';
  if (Conversation.findById(convId)) {
    console.log('⏭️  跳过: 机器人闭环会话已存在');
    return;
  }
  
  Conversation.create({ id: convId, user_id: 'user_001', channel: 'web' });
  
  Message.create({
    id: uuidv4(),
    conversation_id: convId,
    role: 'user',
    content: '请问如何查询我的订单？'
  });
  
  Intent.create({
    id: uuidv4(),
    conversation_id: convId,
    intent_name: 'order_query',
    confidence: 0.95,
    slot_values: null,
    source: 'bot'
  });
  
  Emotion.create({
    id: uuidv4(),
    conversation_id: convId,
    emotion_type: 'neutral',
    confidence: 0.85,
    triggered_by: '用户消息'
  });
  
  Message.create({
    id: uuidv4(),
    conversation_id: convId,
    role: 'bot',
    content: '您可以在"我的订单"页面查看所有订单信息。请问还有其他问题吗？'
  });
  
  Conversation.updateStatus(convId, 'closed', '机器人成功解决订单查询问题');
  
  console.log('✅ 造数: 机器人闭环会话');
};

const seedEscalatedConversation = () => {
  const convId = 'conv_escalated';
  if (Conversation.findById(convId)) {
    console.log('⏭️  跳过: 情绪升级转人工会话已存在');
    return;
  }
  
  Conversation.create({ id: convId, user_id: 'user_002', channel: 'app' });
  
  Message.create({
    id: uuidv4(),
    conversation_id: convId,
    role: 'user',
    content: '我的退款怎么还没到账？已经等了7天了！'
  });
  
  Intent.create({
    id: uuidv4(),
    conversation_id: convId,
    intent_name: 'refund_status',
    confidence: 0.92,
    slot_values: { wait_days: 7 },
    source: 'bot'
  });
  
  Emotion.create({
    id: uuidv4(),
    conversation_id: convId,
    emotion_type: 'frustrated',
    confidence: 0.88,
    triggered_by: '用户表达不满'
  });
  
  Message.create({
    id: uuidv4(),
    conversation_id: convId,
    role: 'bot',
    content: '抱歉让您久等了，我帮您查询一下退款进度...'
  });
  
  Message.create({
    id: uuidv4(),
    conversation_id: convId,
    role: 'user',
    content: '这已经是我第三次问了！你们到底管不管？太垃圾了！'
  });
  
  Intent.create({
    id: uuidv4(),
    conversation_id: convId,
    intent_name: 'escalation_request',
    confidence: 0.98,
    slot_values: { urgency: 'high' },
    source: 'bot'
  });
  
  Emotion.create({
    id: uuidv4(),
    conversation_id: convId,
    emotion_type: 'angry',
    confidence: 0.95,
    triggered_by: '用户强烈不满，使用负面词汇'
  });
  
  Conversation.updateStatus(convId, 'queued', '用户情绪升级，需要转人工处理退款问题');
  
  console.log('✅ 造数: 情绪升级转人工会话');
};

const seedDuplicateEscalation = () => {
  const convId = 'conv_duplicate';
  if (Conversation.findById(convId)) {
    console.log('⏭️  跳过: 重复转人工会话已存在');
    return;
  }
  
  Conversation.create({ id: convId, user_id: 'user_003', channel: 'phone' });
  
  Message.create({
    id: uuidv4(),
    conversation_id: convId,
    role: 'user',
    content: '我要投诉你们的配送服务'
  });
  
  Intent.create({
    id: uuidv4(),
    conversation_id: convId,
    intent_name: 'complaint',
    confidence: 0.90,
    slot_values: { complaint_type: 'delivery' },
    source: 'bot'
  });
  
  Emotion.create({
    id: uuidv4(),
    conversation_id: convId,
    emotion_type: 'frustrated',
    confidence: 0.82,
    triggered_by: '投诉意图'
  });
  
  console.log('✅ 造数: 重复转人工会话（待转人工）');
};

const seedCompletedConversation = () => {
  const convId = 'conv_completed';
  if (Conversation.findById(convId)) {
    console.log('⏭️  跳过: 已完成会话已存在');
    return;
  }
  
  Conversation.create({ id: convId, user_id: 'user_004', channel: 'web' });
  
  Message.create({
    id: uuidv4(),
    conversation_id: convId,
    role: 'user',
    content: '我的账号登不上去了'
  });
  
  Intent.create({
    id: uuidv4(),
    conversation_id: convId,
    intent_name: 'login_issue',
    confidence: 0.94,
    slot_values: null,
    source: 'bot'
  });
  
  Emotion.create({
    id: uuidv4(),
    conversation_id: convId,
    emotion_type: 'anxious',
    confidence: 0.78,
    triggered_by: '无法登录'
  });
  
  Conversation.updateStatus(convId, 'completed', '人工客服帮助用户重置密码，问题已解决');
  
  console.log('✅ 造数: 已完成会话');
};

const run = () => {
  console.log('\n========================================');
  console.log('   客服机器人转人工 API - 造数脚本');
  console.log('========================================\n');
  
  initSchema();
  
  console.log('--- 创建客服账号 ---');
  seedAgents();
  
  console.log('\n--- 创建示例会话 ---');
  seedBotOnlyConversation();
  seedEscalatedConversation();
  seedDuplicateEscalation();
  seedCompletedConversation();
  
  console.log('\n========================================');
  console.log('✅ 造数完成！');
  console.log('========================================\n');
  console.log('📊 数据概览:');
  console.log('   - 3个客服账号');
  console.log('   - 4个示例会话');
  console.log('   - 包含: 机器人闭环、情绪升级、重复转人工、已完成');
  console.log('\n🚀 启动服务: npm start');
  console.log('🎬 运行演示: npm run demo\n');
};

if (require.main === module) {
  run();
}

module.exports = { run };
