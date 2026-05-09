const { initDb, getDb } = require('../src/database/init');
const ticketService = require('../src/services/ticketService');
const clusterService = require('../src/services/clusterService');
const assignService = require('../src/services/assignService');
const supervisionService = require('../src/services/supervisionService');
const historyService = require('../src/services/historyService');

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runTests() {
  console.log('');
  console.log('========================================');
  console.log('  政务热线工单合并服务 - 功能测试');
  console.log('========================================');
  console.log('');

  initDb();
  const db = getDb();

  console.log('>>> 环境准备: 清理数据库...');
  db.prepare('DELETE FROM replies').run();
  db.prepare('DELETE FROM supervision_records').run();
  db.prepare('DELETE FROM ticket_merges').run();
  db.prepare('DELETE FROM tickets').run();
  db.prepare('DELETE FROM cluster_members').run();
  db.prepare('DELETE FROM clusters').run();
  db.prepare('DELETE FROM complaints').run();
  db.prepare('DELETE FROM history_logs').run();
  console.log('✓ 数据库已清理');
  console.log('');

  const now = new Date();
  const baseTime = new Date(now);

  function getTime(offsetHours = 0) {
    const t = new Date(baseTime);
    t.setHours(t.getHours() + offsetHours);
    return t.toISOString();
  }

  const waterComplaints = [
    {
      citizen_name: '张小明',
      citizen_phone: '13800138001',
      content: '我们小区自来水停水已经3天了，请尽快解决！',
      area: '朝阳区',
      location: '阳光花园',
      category: '供水问题',
      created_at: getTime(-10)
    },
    {
      citizen_name: '李华',
      citizen_phone: '13800138002',
      content: '阳光花园这里停水好几天了，什么时候能恢复供水？',
      area: '朝阳区',
      location: '阳光花园',
      category: '供水问题',
      created_at: getTime(-9)
    },
    {
      citizen_name: '王芳',
      citizen_phone: '13800138003',
      content: '楼下水管爆裂漏水严重，请快派人来修！',
      area: '朝阳区',
      location: '阳光花园门口',
      category: '供水问题',
      created_at: getTime(-8)
    }
  ];

  const electricComplaints = [
    {
      citizen_name: '周伟',
      citizen_phone: '13800138004',
      content: '小区突然停电，已经十几个小时了。',
      area: '海淀区',
      location: '科技园',
      category: '供电问题',
      created_at: getTime(-12)
    },
    {
      citizen_name: '吴敏',
      citizen_phone: '13800138005',
      content: '科技园小区停电了，什么时候能修好？',
      area: '海淀区',
      location: '科技园B栋',
      category: '供电问题',
      created_at: getTime(-11)
    }
  ];

  test('1. 投诉录入功能', () => {
    console.log('  正在录入供水问题投诉...');
    for (const data of waterComplaints) {
      const result = ticketService.createComplaint(data);
      assert(result.id > 0, '投诉ID应该大于0');
      assert(result.complaint_no.startsWith('CP'), '投诉编号应该以CP开头');
    }

    console.log('  正在录入供电问题投诉...');
    for (const data of electricComplaints) {
      const result = ticketService.createComplaint(data);
      assert(result.id > 0, '投诉ID应该大于0');
    }

    const count = db.prepare('SELECT COUNT(*) as cnt FROM complaints').get().cnt;
    assert(count === 5, `应该有5条投诉，但实际有${count}条`);
    console.log('  ✓ 投诉录入成功，共5条');
  });

  test('2. 投诉聚类功能', () => {
    console.log('  正在执行聚类分析...');
    const result = clusterService.runClustering({
      timeWindowHours: 48,
      similarityThreshold: 0.25,
      forceRerun: true
    });

    assert(result.newClusters > 0, '应该创建至少1个聚类');
    console.log(`  聚类结果: 新建 ${result.newClusters} 个聚类`);

    const clusters = clusterService.getClustersWithDetails({ includeMembers: true });
    console.log('  聚类详情:');
    for (const cluster of clusters) {
      console.log(`    - 聚类#${cluster.id}: ${cluster.title} (${cluster.member_count}条投诉)`);
      for (const member of cluster.members) {
        console.log(`      * ${member.citizen_name}: ${member.content.substring(0, 30)}...`);
      }
    }

    const hasMultiMemberCluster = clusters.some(c => c.member_count > 1);
    assert(hasMultiMemberCluster, '应该有至少1个包含多条投诉的聚类');
    console.log('  ✓ 聚类成功，相似投诉已合并');
  });

  test('3. 工单创建功能', () => {
    console.log('  正在从聚类创建工单...');
    const result = ticketService.createTicketsFromAllClusters();
    
    console.log(`  创建了 ${result.createdCount} 个工单`);
    assert(result.createdCount > 0, '应该创建至少1个工单');

    const tickets = ticketService.getTickets({ pageSize: 100 });
    for (const ticket of tickets) {
      assert(ticket.ticket_no.startsWith('TK'), '工单编号应该以TK开头');
      console.log(`    - 工单 ${ticket.ticket_no}: ${ticket.cluster?.title || '未知'}`);
    }

    console.log('  ✓ 工单创建成功');
  });

  test('4. 部门自动分派功能', () => {
    console.log('  正在测试部门自动分派...');
    
    const result = assignService.autoAssignAllPendingTickets();
    console.log(`  分派结果: 处理 ${result.totalProcessed} 个，成功 ${result.successCount} 个`);

    const tickets = ticketService.getTickets({ pageSize: 100 });
    
    for (const ticket of tickets) {
      if (ticket.assigned_department_id) {
        console.log(`    - 工单 ${ticket.ticket_no} 分派到: ${ticket.department?.name || '未知部门'}`);
      } else {
        console.log(`    - 工单 ${ticket.ticket_no} 未能自动分派`);
      }
    }

    const hasAssigned = tickets.some(t => t.assigned_department_id);
    assert(hasAssigned, '应该有工单被自动分派到部门');
    console.log('  ✓ 部门分派成功');
  });

  test('5. 答复版本管理', () => {
    console.log('  正在测试答复功能...');
    
    const tickets = ticketService.getTickets({ pageSize: 100 });
    if (tickets.length === 0) {
      throw new Error('没有可用的工单');
    }

    const ticket = tickets[0];
    console.log(`  选择工单: ${ticket.ticket_no}`);

    console.log('  添加非正式答复...');
    const reply1 = assignService.addReply(
      ticket.id,
      '正在核实情况，请耐心等待。',
      '接线员小王',
      false
    );
    assert(reply1.version === 1, '第一个答复版本号应该是1');

    console.log('  添加官方答复...');
    const reply2 = assignService.addReply(
      ticket.id,
      '经核实，水管爆裂正在抢修中，预计今天下午恢复供水。给您带来不便敬请谅解。',
      '水务局官方',
      true
    );
    assert(reply2.version === 2, '第二个答复版本号应该是2');
    assert(reply2.isOfficial === true, '应该是官方答复');

    const latestOfficial = assignService.getLatestOfficialReply(ticket.id);
    assert(latestOfficial.version === 2, '最新官方答复版本号应该是2');

    console.log(`  答复记录: v1(非正式), v2(官方)`);
    console.log('  ✓ 答复版本管理功能正常');
  });

  test('6. 超时督办功能', () => {
    console.log('  正在测试督办功能...');
    
    const tickets = ticketService.getTickets({ pageSize: 100 });
    const ticket = tickets[0];

    const supervision = supervisionService.addSupervision(
      ticket.id,
      'warning',
      '工单已超时，请尽快处理',
      '督办员小李'
    );

    assert(supervision.id > 0, '督办记录ID应该大于0');
    assert(supervision.level === 'warning', '督办级别应该是warning');

    const list = supervisionService.getSupervisionList({ pageSize: 100 });
    console.log(`  督办记录数量: ${list.length}`);

    console.log('  ✓ 督办功能正常');
  });

  test('7. 工单合并功能', () => {
    console.log('  正在测试工单合并功能...');
    
    const tickets = ticketService.getTickets({ pageSize: 100 });
    if (tickets.length < 2) {
      console.log('  工单数量不足2个，跳过合并测试');
      return;
    }

    const targetTicket = tickets[0];
    const sourceTicket = tickets[1];

    console.log(`  合并工单: ${sourceTicket.ticket_no} -> ${targetTicket.ticket_no}`);
    
    const result = ticketService.mergeTickets(
      targetTicket.id,
      sourceTicket.id,
      '两个工单涉及同一供水问题',
      '操作员张三'
    );

    assert(result.targetTicketId === targetTicket.id, '目标工单ID不匹配');
    assert(result.sourceTicketId === sourceTicket.id, '源工单ID不匹配');

    const updatedSource = ticketService.getTicketById(sourceTicket.id);
    assert(updatedSource.status === 'merged', '源工单状态应该是merged');

    console.log('  ✓ 工单合并功能正常');
  });

  test('8. 工单办结和撤回功能', () => {
    console.log('  正在测试办结功能...');
    
    const tickets = ticketService.getTickets({ 
      status: 'pending', 
      pageSize: 100 
    });
    
    if (tickets.length === 0) {
      const allTickets = ticketService.getTickets({ pageSize: 100 });
      const toClose = allTickets.find(t => !['closed', 'withdrawn', 'merged'].includes(t.status));
      if (!toClose) {
        console.log('  没有可办结的工单，跳过测试');
        return;
      }

      const closeResult = ticketService.closeTicket(toClose.id, '操作员测试');
      assert(closeResult.ticketId === toClose.id, '办结ID不匹配');
      console.log(`  工单 ${toClose.ticket_no} 已办结`);
    } else {
      const toClose = tickets[0];
      const closeResult = ticketService.closeTicket(toClose.id, '操作员测试');
      assert(closeResult.ticketId === toClose.id, '办结ID不匹配');
      console.log(`  工单 ${toClose.ticket_no} 已办结`);
    }

    console.log('  ✓ 办结功能正常');
  });

  test('9. 历史记录功能', () => {
    console.log('  正在测试历史记录功能...');
    
    const tickets = ticketService.getTickets({ pageSize: 100 });
    if (tickets.length === 0) {
      throw new Error('没有可用的工单');
    }

    const ticket = tickets[0];
    const history = historyService.getHistory('ticket', ticket.id, { limit: 10 });

    console.log(`  工单 ${ticket.ticket_no} 的历史记录 (${history.length} 条):`);
    
    const formatted = historyService.formatHistoryForDisplay(history);
    for (const item of formatted) {
      console.log(`    - [${item.time}] ${item.operator}: ${item.action} - ${item.details || ''}`);
    }

    assert(history.length > 0, '应该至少有1条历史记录');
    console.log('  ✓ 历史记录功能正常');
  });

  test('10. 重复聚类稳定性测试', () => {
    console.log('  正在测试重复聚类稳定性...');
    
    const firstRun = clusterService.runClustering({
      forceRerun: true
    });
    
    const firstClusters = clusterService.getClustersWithDetails();
    const firstClusterKeys = firstClusters.map(c => c.cluster_key).sort();
    const firstMemberCounts = firstClusters.map(c => c.member_count).sort();

    const secondRun = clusterService.runClustering({
      forceRerun: true
    });
    
    const secondClusters = clusterService.getClustersWithDetails();
    const secondClusterKeys = secondClusters.map(c => c.cluster_key).sort();
    const secondMemberCounts = secondClusters.map(c => c.member_count).sort();

    assert(
      JSON.stringify(firstClusterKeys) === JSON.stringify(secondClusterKeys),
      '两次聚类的cluster_key应该相同'
    );

    assert(
      JSON.stringify(firstMemberCounts) === JSON.stringify(secondMemberCounts),
      '两次聚类的成员数量分布应该相同'
    );

    console.log('  ✓ 重复聚类结果稳定，符合预期');
  });

  test('11. 统计数据功能', () => {
    console.log('  正在测试统计功能...');
    
    ticketService.createTicketsFromAllClusters();
    assignService.autoAssignAllPendingTickets();
    
    const stats = supervisionService.getStatistics();
    
    console.log('  统计数据:');
    console.log(`    - 投诉总数: ${stats.complaints.total}`);
    console.log(`    - 聚类总数: ${stats.clusters.total}`);
    console.log(`    - 工单总数: ${stats.tickets.total}`);
    console.log(`    - 已办结: ${stats.tickets.closed}`);
    console.log(`    - 合并率: ${stats.clusters.mergeRate}%`);
    console.log(`    - 合并次数: ${stats.operations.merges}`);
    console.log(`    - 历史记录: ${stats.audit.historyLogs} 条`);

    assert(stats.complaints.total > 0, '投诉总数应该大于0');
    assert(stats.clusters.total > 0, '聚类总数应该大于0');
    assert(stats.tickets.total > 0, '工单总数应该大于0');

    console.log('  ✓ 统计功能正常');
  });

  console.log('');
  console.log('>>> 开始执行测试用例...');
  console.log('');

  for (const { name, fn } of tests) {
    console.log(`【测试用例】${name}`);
    try {
      fn();
      passed++;
      console.log(`✅ 通过: ${name}`);
    } catch (e) {
      failed++;
      console.log(`❌ 失败: ${name}`);
      console.log(`   错误信息: ${e.message}`);
      console.log(`   堆栈: ${e.stack}`);
    }
    console.log('');
  }

  console.log('========================================');
  console.log(`  测试结果: 通过 ${passed} / ${tests.length}`);
  if (failed > 0) {
    console.log(`  失败: ${failed}`);
  }
  console.log('========================================');
  console.log('');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error('测试执行失败:', e);
  process.exit(1);
});
