const ticketService = require('../src/ticketService');
const { initDatabase } = require('../src/database');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'test-tickets.db');

let testResults = [];
let passed = 0;
let failed = 0;

function logTest(testName, success, message = '') {
  if (success) {
    passed++;
    console.log(`✅ PASS: ${testName}`);
  } else {
    failed++;
    console.log(`❌ FAIL: ${testName}`);
    console.log(`   ${message}`);
  }
  testResults.push({ testName, success, message });
}

async function testNormalFlow() {
  console.log('\n====================================');
  console.log('🧪 测试场景 1: 正常流程');
  console.log('====================================');

  try {
    const ticket1 = await ticketService.createTicket({
      ticketNumber: 'TICKET-001',
      priority: 'P1',
      assignee: 'zhang.san',
      rawInput: { source: 'phone', customer: 'ABC Corp' }
    });
    logTest('创建工单', !!ticket1 && ticket1.ticket_number === 'TICKET-001');

    const ticket2 = await ticketService.createTicket({
      ticketNumber: 'TICKET-002',
      priority: 'P2',
      assignee: 'li.si'
    });
    logTest('创建第二个工单', !!ticket2);

    const list = await ticketService.listTickets();
    logTest('查询工单列表', list.length >= 2);

    const fetched = await ticketService.getTicket('TICKET-001');
    logTest('查询单工单详情', !!fetched && fetched.nodes.length === 1);

    const advanced = await ticketService.advanceNode(
      'TICKET-001',
      'wang.wu',
      '已完成L1支持，移交L2'
    );
    logTest('推进节点到L2', advanced.current_node === 'L2_SUPPORT' && advanced.nodes.length === 2);

    const reminder = await ticketService.createReminder(
      'TICKET-001',
      'SLA_WARNING',
      'wang.wu'
    );
    logTest('创建催办提醒', !reminder.duplicated);

    const escalated = await ticketService.escalate(
      'TICKET-001',
      '客户催促',
      'manager.zhang'
    );
    logTest('升级工单', escalated.status === 'ESCALATED' && escalated.escalations.length === 1);

    const corrected = await ticketService.manualCorrection(
      'TICKET-001',
      'admin',
      'STATUS',
      'ESCALATED',
      'PROCESSING',
      '误升级，恢复处理状态'
    );
    logTest('人工修正状态', corrected.status === 'PROCESSING' && corrected.corrections.length === 1);

    const resolved = await ticketService.resolveTicket(
      'TICKET-001',
      '问题已解决，方案已交付客户'
    );
    logTest('结单', resolved.status === 'RESOLVED' && !!resolved.conclusion);

  } catch (error) {
    logTest('正常流程异常', false, error.message);
  }
}

async function testDirtyData() {
  console.log('\n====================================');
  console.log('🧪 测试场景 2: 脏数据处理');
  console.log('====================================');

  try {
    let errorThrown = false;
    try {
      await ticketService.createTicket({
        ticketNumber: 'DIRTY-001',
        priority: 'P99',
        assignee: 'test'
      });
    } catch (e) {
      errorThrown = true;
    }
    logTest('拒绝无效优先级(P99)', errorThrown);

    errorThrown = false;
    try {
      await ticketService.advanceNode('NOT-EXIST', 'test');
    } catch (e) {
      errorThrown = true;
    }
    logTest('拒绝推进不存在的工单', errorThrown);

    errorThrown = false;
    try {
      await ticketService.advanceNode('TICKET-001', 'test');
    } catch (e) {
      errorThrown = true;
    }
    logTest('拒绝推进已完结工单', errorThrown);

    errorThrown = false;
    try {
      await ticketService.manualCorrection('NOT-EXIST', 'admin', 'STATUS', '', '', '');
    } catch (e) {
      errorThrown = true;
    }
    logTest('拒绝修正不存在的工单', errorThrown);

    const notFound = await ticketService.getTicket('NOT-EXIST-123');
    logTest('查询不存在工单返回null', notFound === null);

    const ticket3 = await ticketService.createTicket({
      ticketNumber: 'DIRTY-003',
      priority: 'P3',
      assignee: 'test.user'
    });

    const exception = await ticketService.handleException(
      'DIRTY-003',
      { errorCode: 'E500', details: '系统异常，无法同步' }
    );
    logTest('异常处理记录原始输入', exception.status === 'EXCEPTION' && exception.processing_notes.includes('E500'));

  } catch (error) {
    logTest('脏数据测试异常', false, error.message);
  }
}

async function testDuplicateRequests() {
  console.log('\n====================================');
  console.log('🧪 测试场景 3: 重复请求去重');
  console.log('====================================');

  try {
    await ticketService.createTicket({
      ticketNumber: 'DUP-001',
      priority: 'P1',
      assignee: 'duplicate.tester'
    });

    const r1 = await ticketService.createReminder('DUP-001', 'SLA_WARNING', 'duplicate.tester');
    logTest('首次催办成功', !r1.duplicated);

    const r2 = await ticketService.createReminder('DUP-001', 'SLA_WARNING', 'duplicate.tester');
    logTest('重复催办去重', r2.duplicated);

    const r3 = await ticketService.createReminder('DUP-001', 'SLA_WARNING', 'another.person');
    logTest('同类型重复催办仍然去重', r3.duplicated);

    const r4 = await ticketService.createReminder('DUP-001', 'MANUAL', 'manager');
    logTest('不同类型催办正常创建', !r4.duplicated);

    const ticket = await ticketService.getTicket('DUP-001');
    logTest('催办记录数量正确', ticket.reminders.length === 2);

  } catch (error) {
    logTest('重复请求测试异常', false, error.message);
  }
}

async function testManualCorrections() {
  console.log('\n====================================');
  console.log('🧪 测试场景 4: 人工修正');
  console.log('====================================');

  try {
    const ticket = await ticketService.createTicket({
      ticketNumber: 'CORR-001',
      priority: 'P2',
      assignee: 'original.assignee'
    });

    const originalDeadline = ticket.deadline;
    const newDeadline = new Date(Date.now() + 86400000).toISOString();

    const c1 = await ticketService.manualCorrection(
      'CORR-001',
      'admin.li',
      'DEADLINE',
      originalDeadline,
      newDeadline,
      '客户要求延期一天'
    );
    logTest('人工修正截止时间', c1.deadline === newDeadline);

    const c2 = await ticketService.manualCorrection(
      'CORR-001',
      'team.lead',
      'ASSIGNEE',
      'original.assignee',
      'new.assignee',
      '原处理人休假，转单'
    );
    const activeNode = c2.nodes.find(n => n.status === 'ACTIVE');
    logTest('人工修正处理人', activeNode.assignee === 'new.assignee');

    const c3 = await ticketService.manualCorrection(
      'CORR-001',
      'director.wang',
      'NODE',
      'L1_SUPPORT',
      'L3_ENGINEERING',
      '紧急问题，直接跳级处理'
    );
    logTest('人工修正节点跳级', c3.current_node === 'L3_ENGINEERING');

    const final = await ticketService.getTicket('CORR-001');
    logTest('修正记录完整留存', final.corrections.length === 3);

    const hasAllTypes = final.corrections
      .map(c => c.correction_type)
      .sort()
      .join(',') === 'ASSIGNEE,DEADLINE,NODE';
    logTest('修正类型记录完整', hasAllTypes);

  } catch (error) {
    logTest('人工修正测试异常', false, error.message);
  }
}

async function testSLAFunctionality() {
  console.log('\n====================================');
  console.log('🧪 测试场景 5: SLA 功能验证');
  console.log('====================================');

  try {
    const p1Deadline = ticketService.calculateDeadline('P1');
    const p2Deadline = ticketService.calculateDeadline('P2');

    const p1Time = new Date(p1Deadline).getTime();
    const p2Time = new Date(p2Deadline).getTime();
    logTest('P1 SLA时限短于P2', p1Time < p2Time);

    const nodeFlow = ticketService.NODE_FLOW;
    logTest('节点流程定义完整', nodeFlow.includes('L1_SUPPORT') && nodeFlow.includes('L2_SUPPORT'));

    const slaConfig = ticketService.SLA_CONFIG;
    logTest('SLA配置完整', slaConfig.P1 && slaConfig.P2 && slaConfig.P3 && slaConfig.P4);

  } catch (error) {
    logTest('SLA功能测试异常', false, error.message);
  }
}

async function runAllTests() {
  console.log('🚀 开始工单升级时限 API 自检程序');
  console.log('数据库路径:', dbPath);

  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('已清理旧测试数据库');
  }

  process.env.TEST_DB = dbPath;

  await initDatabase();

  await testNormalFlow();
  await testDirtyData();
  await testDuplicateRequests();
  await testManualCorrections();
  await testSLAFunctionality();

  console.log('\n====================================');
  console.log('📊 测试结果汇总');
  console.log('====================================');
  console.log(`✅ 通过: ${passed}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`📈 总数: ${passed + failed}`);
  console.log(`📊 通过率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n⚠️  部分测试失败，请检查上述错误信息');
    process.exit(1);
  } else {
    console.log('\n🎉 所有测试通过！');
    process.exit(0);
  }
}

runAllTests().catch(console.error);
