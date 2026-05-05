const db = require('./database');

function initSampleData() {
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM tickets');
  const result = countStmt.get();
  
  if (result.count > 0) {
    console.log('数据库已有数据，跳过样例数据初始化');
    return;
  }

  console.log('正在初始化样例数据...');

  const insertStmt = db.prepare(`
    INSERT INTO tickets (id, store_id, store_name, store_timezone, title, description, created_utc, status)
    VALUES (@id, @store_id, @store_name, @store_timezone, @title, @description, @created_utc, @status)
  `);

  const sampleTickets = generateSampleTickets();

  const transaction = db.transaction((tickets) => {
    for (const ticket of tickets) {
      insertStmt.run(ticket);
    }
  });

  transaction(sampleTickets);
  console.log(`已插入 ${sampleTickets.length} 条样例工单数据`);
}

function generateSampleTickets() {
  const tickets = [];
  
  const beijingStore = {
    id: 'store-bj',
    name: '北京门店',
    timezone: 'Asia/Shanghai'
  };
  
  const laStore = {
    id: 'store-la',
    name: '洛杉矶门店',
    timezone: 'America/Los_Angeles'
  };

  const datePoints = [
    { utc: 1709222400, desc: '2024-03-01 00:00 UTC = 2024-03-01 08:00 Beijing = 2024-02-29 16:00 LA' },
    { utc: 1709218800, desc: '2024-02-29 23:00 UTC = 2024-03-01 07:00 Beijing = 2024-02-29 15:00 LA' },
    { utc: 1709215200, desc: '2024-02-29 22:00 UTC = 2024-03-01 06:00 Beijing = 2024-02-29 14:00 LA' },
    { utc: 1709208000, desc: '2024-02-29 20:00 UTC = 2024-03-01 04:00 Beijing = 2024-02-29 12:00 LA' },
    { utc: 1709136000, desc: '2024-02-29 00:00 UTC = 2024-02-29 08:00 Beijing = 2024-02-28 16:00 LA' },
    { utc: 1709132400, desc: '2024-02-28 23:00 UTC = 2024-02-29 07:00 Beijing = 2024-02-28 15:00 LA' },
    { utc: 1709049600, desc: '2024-02-28 00:00 UTC = 2024-02-28 08:00 Beijing = 2024-02-27 16:00 LA' },
    { utc: 1706745600, desc: '2024-02-01 00:00 UTC = 2024-02-01 08:00 Beijing = 2024-01-31 16:00 LA' },
    { utc: 1706659200, desc: '2024-01-31 00:00 UTC = 2024-01-31 08:00 Beijing = 2024-01-30 16:00 LA' },
    { utc: 1711929600, desc: '2024-04-01 00:00 UTC = 2024-04-01 08:00 Beijing = 2024-03-31 17:00 LA' },
  ];

  const ticketTemplates = [
    { title: '用户无法登录系统', description: '用户报告登录页面显示错误', status: 'open' },
    { title: '订单支付失败', description: '用户尝试支付时系统报错', status: 'resolved' },
    { title: '商品库存查询问题', description: '库存显示与实际不符', status: 'in_progress' },
    { title: '会员积分异常', description: '积分累计计算错误', status: 'open' },
    { title: '系统响应缓慢', description: '高峰期系统卡顿严重', status: 'resolved' },
  ];

  let ticketIndex = 0;

  datePoints.forEach((point, idx) => {
    ticketTemplates.forEach((template, tIdx) => {
      const store = Math.random() > 0.5 ? beijingStore : laStore;
      const ticketId = `TK-${String(ticketIndex + 1).padStart(4, '0')}`;
      
      tickets.push({
        id: ticketId,
        store_id: store.id,
        store_name: store.name,
        store_timezone: store.timezone,
        title: template.title,
        description: `${template.description} (参考: ${point.desc})`,
        created_utc: point.utc + (tIdx * 60),
        status: template.status
      });
      
      ticketIndex++;
    });
  });

  tickets.push(
    {
      id: 'TK-DEMO-001',
      store_id: 'store-bj',
      store_name: '北京门店',
      store_timezone: 'Asia/Shanghai',
      title: '【关键演示】2月29日23:00 UTC (北京时间3月1日07:00)',
      description: '此工单在UTC时间2月29日，但北京时间已是3月1日。用于验证跨月边界处理。',
      created_utc: 1709247600,
      status: 'open'
    },
    {
      id: 'TK-DEMO-002',
      store_id: 'store-la',
      store_name: '洛杉矶门店',
      store_timezone: 'America/Los_Angeles',
      title: '【关键演示】2月29日08:00 UTC (洛杉矶时间2月28日16:00)',
      description: '此工单在UTC时间2月29日，但洛杉矶时间还是2月28日。用于验证跨月边界处理。',
      created_utc: 1709193600,
      status: 'resolved'
    },
    {
      id: 'TK-DEMO-003',
      store_id: 'store-bj',
      store_name: '北京门店',
      store_timezone: 'Asia/Shanghai',
      title: '【关键演示】3月1日00:00 UTC (北京时间3月1日08:00)',
      description: 'UTC时间3月1日开始，北京时间也是3月1日。',
      created_utc: 1709251200,
      status: 'in_progress'
    },
    {
      id: 'TK-DEMO-004',
      store_id: 'store-la',
      store_name: '洛杉矶门店',
      store_timezone: 'America/Los_Angeles',
      title: '【关键演示】3月1日07:00 UTC (洛杉矶时间2月29日23:00)',
      description: 'UTC时间已是3月1日，但洛杉矶时间还是2月29日。',
      created_utc: 1709276400,
      status: 'open'
    }
  );

  return tickets;
}

module.exports = {
  initSampleData
};
