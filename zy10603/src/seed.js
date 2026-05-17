const ticketService = require('./services/ticketService');

const seedData = [
  {
    session_id: 'SESS_001',
    bot_tag: 'customer_service_v2',
    human_queue: 'general',
    customer_emotion: 'neutral',
    status: 'AUTO_PROCESS'
  },
  {
    session_id: 'SESS_002',
    bot_tag: 'billing_bot',
    human_queue: 'billing',
    customer_emotion: 'negative',
    status: 'PENDING_REVIEW'
  },
  {
    session_id: 'SESS_003',
    bot_tag: 'technical_support',
    human_queue: 'technical',
    customer_emotion: 'angry',
    status: 'TRANSFERRED_TO_HUMAN'
  },
  {
    session_id: 'SESS_004',
    bot_tag: 'complaint_handler',
    human_queue: 'complaint',
    customer_emotion: 'negative',
    status: 'CLOSED'
  }
];

async function seed() {
  console.log('开始导入种子数据...');
  
  for (const data of seedData) {
    try {
      await ticketService.createTicket(data);
      console.log(`✓ 已创建: ${data.session_id}`);
    } catch (e) {
      if (e.message.includes('会话编号已存在')) {
        console.log(`- 已跳过: ${data.session_id} (已存在)`);
      } else {
        console.error(`✗ 失败: ${data.session_id} - ${e.message}`);
      }
    }
  }

  console.log('种子数据导入完成!');
  
  const ticket2 = await ticketService.getTicketBySessionId('SESS_002');
  if (ticket2) {
    await ticketService.updateStatus(ticket2.id, {
      status: 'TRANSFERRED_TO_HUMAN',
      operator: 'admin',
      remark: '复核通过，转人工处理'
    });
    console.log('✓ 已为 SESS_002 添加状态流转历史');
  }
}

if (require.main === module) {
  seed().then(() => process.exit(0));
}

module.exports = seed;
