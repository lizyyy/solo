const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const store = require('../src/store');
const slaService = require('../src/service');
const { TICKET_STATUS, PAUSE_REASON, ERROR_CODES } = require('../src/constants');

describe('工单SLA服务暂停计时证明 - 完整流转', () => {
  let ticketId;

  beforeEach(() => {
    store.clear();
  });

  it('1. 创建工单 - 状态为计时中', () => {
    const result = slaService.createTicket({
      title: '用户无法登录系统',
      customerId: 'CUST001',
      customerName: '张三'
    });

    assert.ok(result.success);
    assert.equal(result.data.status, TICKET_STATUS.TIMING);
    assert.equal(result.data.title, '用户无法登录系统');
    ticketId = result.data.id;
    console.log('   ✅ 创建工单成功:', ticketId);
  });

  it('2. 暂停计时 - 状态变为暂停中', () => {
    const ticket = slaService.createTicket({
      title: '用户无法登录系统',
      customerId: 'CUST001',
      customerName: '张三'
    });
    ticketId = ticket.data.id;

    const result = slaService.pauseTicket({
      ticketId: ticketId,
      reason: PAUSE_REASON.CUSTOMER_INFO,
      reasonDetail: '需要用户提供更多日志信息',
      proofMaterials: ['screenshot_2024_01_15.png', 'chat_log.pdf'],
      pausedBy: 'agent_001',
      customerWaiting: true
    });

    assert.ok(result.success);
    assert.equal(result.data.ticket.status, TICKET_STATUS.PAUSED);
    assert.equal(result.data.pauseRecord.reason, PAUSE_REASON.CUSTOMER_INFO);
    assert.equal(result.data.pauseRecord.customerWaiting, true);
    assert.equal(result.data.pauseRecord.proofMaterials.length, 2);
    console.log('   ✅ 暂停计时成功，暂停记录ID:', result.data.pauseRecord.id);
  });

  it('3. 查询工单详情 - 包含暂停记录', () => {
    const ticket = slaService.createTicket({
      title: '用户无法登录系统',
      customerId: 'CUST001',
      customerName: '张三'
    });
    ticketId = ticket.data.id;

    slaService.pauseTicket({
      ticketId: ticketId,
      reason: PAUSE_REASON.CUSTOMER_INFO,
      pausedBy: 'agent_001'
    });

    const result = slaService.getTicketDetail(ticketId);

    assert.ok(result.success);
    assert.equal(result.data.ticket.id, ticketId);
    assert.equal(result.data.pauseRecords.length, 1);
    console.log('   ✅ 工单详情查询成功，暂停记录数:', result.data.pauseRecords.length);
  });

  it('4. 恢复计时 - 状态变为已恢复', async () => {
    const ticket = slaService.createTicket({
      title: '用户无法登录系统',
      customerId: 'CUST001',
      customerName: '张三'
    });
    ticketId = ticket.data.id;

    slaService.pauseTicket({
      ticketId: ticketId,
      reason: PAUSE_REASON.CUSTOMER_INFO,
      pausedBy: 'agent_001'
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const result = slaService.resumeTicket({
      ticketId: ticketId,
      resumedBy: 'agent_001',
      notes: '用户已提供日志'
    });

    assert.ok(result.success);
    assert.equal(result.data.ticket.status, TICKET_STATUS.RESUMED);
    assert.ok(result.data.pausedDuration >= 0);
    console.log('   ✅ 恢复计时成功，暂停时长:', result.data.pausedDuration, '秒');
  });

  it('5. 查询工单历史 - 时间线完整', () => {
    const ticket = slaService.createTicket({
      title: '用户无法登录系统',
      customerId: 'CUST001',
      customerName: '张三'
    });
    ticketId = ticket.data.id;

    slaService.pauseTicket({
      ticketId: ticketId,
      reason: PAUSE_REASON.CUSTOMER_INFO,
      pausedBy: 'agent_001'
    });

    slaService.resumeTicket({
      ticketId: ticketId,
      resumedBy: 'agent_001'
    });

    const result = slaService.getTicketHistory(ticketId);

    assert.ok(result.success);
    assert.ok(result.data.history.length >= 3);
    assert.equal(result.data.history[0].type, 'created');
    assert.equal(result.data.history[1].type, 'paused');
    assert.equal(result.data.history[2].type, 'resumed');
    console.log('   ✅ 工单历史查询成功，历史记录数:', result.data.history.length);
  });

  it('6. 工单列表 - 能查询到已恢复工单', () => {
    const ticket = slaService.createTicket({
      title: '用户无法登录系统',
      customerId: 'CUST001',
      customerName: '张三'
    });
    ticketId = ticket.data.id;

    slaService.pauseTicket({
      ticketId: ticketId,
      reason: PAUSE_REASON.CUSTOMER_INFO,
      pausedBy: 'agent_001'
    });

    slaService.resumeTicket({
      ticketId: ticketId,
      resumedBy: 'agent_001'
    });

    const allResult = slaService.listTickets();
    const resumedResult = slaService.listTickets({ status: TICKET_STATUS.RESUMED });

    assert.ok(allResult.success);
    assert.ok(allResult.data.total >= 1);
    assert.equal(resumedResult.data.tickets[0].id, ticketId);
    console.log('   ✅ 工单列表查询成功，总工单数:', allResult.data.total);
  });

  it('7. 导出数据 - 数据完整可导出', () => {
    const ticket = slaService.createTicket({
      title: '用户无法登录系统',
      customerId: 'CUST001',
      customerName: '张三'
    });
    ticketId = ticket.data.id;

    slaService.pauseTicket({
      ticketId: ticketId,
      reason: PAUSE_REASON.CUSTOMER_INFO,
      pausedBy: 'agent_001'
    });

    const result = slaService.exportData();

    assert.ok(result.success);
    assert.ok(result.data.tickets.length >= 1);
    assert.ok(result.data.pauseRecords.length >= 1);
    assert.ok(result.data.exportedAt);
    console.log('   ✅ 数据导出成功，工单:', result.data.tickets.length, '暂停记录:', result.data.pauseRecords.length);
  });
});

describe('工单SLA服务暂停计时证明 - 冲突记录', () => {
  beforeEach(() => {
    store.clear();
  });

  it('1. 重复暂停 - 返回409冲突，不静默覆盖', () => {
    const ticket = slaService.createTicket({
      title: '订单支付异常',
      customerId: 'CUST002',
      customerName: '李四'
    });
    const ticketId = ticket.data.id;

    const firstResult = slaService.pauseTicket({
      ticketId: ticketId,
      reason: PAUSE_REASON.THIRD_PARTY,
      pausedBy: 'agent_002'
    });
    assert.ok(firstResult.success);

    const secondResult = slaService.pauseTicket({
      ticketId: ticketId,
      reason: PAUSE_REASON.INTERNAL_APPROVAL,
      pausedBy: 'agent_003'
    });

    assert.ok(!secondResult.success);
    assert.equal(secondResult.error, ERROR_CODES.DUPLICATE_PAUSE);
    assert.ok(secondResult.conflictRecord);
    assert.equal(secondResult.conflictRecord.status, 'active');
    console.log('   ✅ 重复暂停正确返回冲突，冲突记录ID:', secondResult.conflictRecord?.id);
  });

  it('2. 状态流转校验 - 已暂停工单不能再次暂停', () => {
    const ticket = slaService.createTicket({
      title: '发票申请问题',
      customerId: 'CUST003',
      customerName: '王五'
    });
    const ticketId = ticket.data.id;

    slaService.pauseTicket({
      ticketId: ticketId,
      reason: PAUSE_REASON.OTHER,
      pausedBy: 'agent_001'
    });

    const result = slaService.pauseTicket({
      ticketId: ticketId,
      reason: PAUSE_REASON.CUSTOMER_INFO,
      pausedBy: 'agent_001'
    });

    assert.ok(!result.success);
    assert.ok(
      result.error === ERROR_CODES.INVALID_STATUS_TRANSITION ||
      result.error === ERROR_CODES.DUPLICATE_PAUSE
    );
    console.log('   ✅ 状态流转校验正确:', result.message);
  });

  it('3. 未暂停工单不能恢复', () => {
    const ticket = slaService.createTicket({
      title: '物流查询问题',
      customerId: 'CUST004',
      customerName: '赵六'
    });
    const ticketId = ticket.data.id;

    const result = slaService.resumeTicket({
      ticketId: ticketId,
      resumedBy: 'agent_001'
    });

    assert.ok(!result.success);
    assert.equal(result.error, ERROR_CODES.INVALID_STATUS_TRANSITION);
    console.log('   ✅ 未暂停工单恢复校验正确:', result.message);
  });

  it('4. 不存在工单操作返回404', () => {
    const pauseResult = slaService.pauseTicket({
      ticketId: 'NOT_EXIST',
      reason: PAUSE_REASON.CUSTOMER_INFO,
      pausedBy: 'agent_001'
    });

    assert.ok(!pauseResult.success);
    assert.equal(pauseResult.error, ERROR_CODES.TICKET_NOT_FOUND);

    const resumeResult = slaService.resumeTicket({
      ticketId: 'NOT_EXIST',
      resumedBy: 'agent_001'
    });

    assert.ok(!resumeResult.success);
    assert.equal(resumeResult.error, ERROR_CODES.TICKET_NOT_FOUND);
    console.log('   ✅ 不存在工单操作正确返回404');
  });

  it('5. 客服暂停但客户仍在等待 - 标记正确', () => {
    const ticket = slaService.createTicket({
      title: '退款进度查询',
      customerId: 'CUST005',
      customerName: '钱七'
    });
    const ticketId = ticket.data.id;

    const result = slaService.pauseTicket({
      ticketId: ticketId,
      reason: PAUSE_REASON.INTERNAL_APPROVAL,
      reasonDetail: '需要主管审批退款金额',
      pausedBy: 'agent_005',
      customerWaiting: true
    });

    assert.ok(result.success);
    assert.equal(result.data.pauseRecord.customerWaiting, true);
    console.log('   ✅ 客户等待状态标记正确');
  });
});

describe('工单SLA服务暂停计时证明 - 导入坏行', () => {
  beforeEach(() => {
    store.clear();
  });

  it('1. 导入数据 - 成功记录和失败记录分别统计', () => {
    const importData = {
      tickets: [
        { id: 'TKT001', title: '正常工单1', customerId: 'C001', customerName: '用户1' },
        { id: 'TKT002', title: '正常工单2', customerId: 'C002', customerName: '用户2' },
        { title: '缺少ID的工单' },
        { id: 'TKT004' },
        { id: 'TKT005', title: '完整工单3', customerId: 'C003', customerName: '用户3' }
      ]
    };

    const result = slaService.importData(importData);

    assert.equal(result.data.success, 3);
    assert.equal(result.data.failed, 2);
    assert.equal(result.data.errors.length, 2);
    console.log('   ✅ 导入结果正确 - 成功:', result.data.success, '失败:', result.data.failed);
  });

  it('2. 导入重复ID - 默认不覆盖，返回错误', () => {
    slaService.createTicket({ id: 'TKT001', title: '已存在工单' });

    const importData = {
      tickets: [
        { id: 'TKT001', title: '尝试覆盖的工单' },
        { id: 'TKT002', title: '新工单' }
      ]
    };

    const result = slaService.importData(importData);

    assert.equal(result.data.success, 1);
    assert.equal(result.data.failed, 1);
    assert.match(result.data.errors[0].error, /已存在/);
    console.log('   ✅ 重复导入正确拒绝 - 成功:', result.data.success, '失败:', result.data.failed);
  });

  it('3. 导入重复ID - 允许覆盖时成功覆盖', () => {
    slaService.createTicket({ id: 'TKT001', title: '已存在工单', customerName: '原用户' });

    const importData = {
      tickets: [
        { id: 'TKT001', title: '已覆盖的工单', customerName: '新用户' }
      ]
    };

    const result = slaService.importData(importData, true);

    assert.equal(result.data.success, 1);
    assert.equal(result.data.failed, 0);

    const ticket = slaService.getTicketDetail('TKT001');
    assert.equal(ticket.data.ticket.title, '已覆盖的工单');
    assert.equal(ticket.data.ticket.customerName, '新用户');
    console.log('   ✅ 覆盖模式导入成功');
  });

  it('4. 空数据导入 - 不报错，返回0成功', () => {
    const result = slaService.importData({ tickets: [] });

    assert.equal(result.data.success, 0);
    assert.equal(result.data.failed, 0);
    console.log('   ✅ 空数据导入处理正确');
  });

  it('5. 完全坏数据导入 - 全部失败但不崩溃', () => {
    const importData = {
      tickets: [
        { wrongField: '完全错误' },
        {},
        { id: '' },
        null
      ]
    };

    const result = slaService.importData(importData);

    assert.equal(result.data.success, 0);
    assert.equal(result.data.failed, 4);
    console.log('   ✅ 完全坏数据导入处理正确');
  });
});

describe('工单SLA服务暂停计时证明 - 超时检查', () => {
  beforeEach(() => {
    store.clear();
  });

  it('1. 超期工单自动标记为超时状态', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString();

    slaService.createTicket({
      id: 'TKT_TIMEOUT',
      title: '已超时工单',
      slaDeadline: pastDate
    });

    slaService.createTicket({
      id: 'TKT_NORMAL',
      title: '正常工单'
    });

    const result = slaService.checkTimeout();

    assert.ok(result.success);
    assert.ok(result.data.timeoutTickets.includes('TKT_TIMEOUT'));
    assert.ok(!result.data.timeoutTickets.includes('TKT_NORMAL'));

    const ticket = slaService.getTicketDetail('TKT_TIMEOUT');
    assert.equal(ticket.data.ticket.status, TICKET_STATUS.TIMEOUT);
    console.log('   ✅ 超时检查正确，超时工单数:', result.data.timeoutTickets.length);
  });
});
