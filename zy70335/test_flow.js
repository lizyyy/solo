const http = require('http');

const BASE_URL = 'http://localhost:3001';

const request = (method, path, body) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : {}
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if (res.statusCode >= 400) {
            reject({ status: res.statusCode, data: parsed });
          } else {
            resolve(parsed);
          }
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

async function runTests() {
  console.log('============================================');
  console.log('  数据修复工单 API - 流程测试');
  console.log('============================================\n');

  try {
    console.log('【测试1】健康检查');
    await request('GET', '/health');
    console.log('  ✓ 服务正常\n');

    console.log('【测试2】查看初始订单数据');
    const orderBefore = await request('GET', '/api/v1/data/orders/ORD001');
    console.log(`  订单 ORD001 当前状态: ${orderBefore.status}`);
    console.log('  ✓ 数据查询正常\n');

    console.log('【测试3】创建订单状态修复工单');
    const ticket = await request('POST', '/api/v1/tickets', {
      title: '订单 ORD001 状态异常修复',
      description: '用户投诉订单状态异常',
      creator: 'zhangsan',
      department: '订单中心',
      reason: '用户申请退款',
      repair_actions: [
        {
          table: 'orders',
          record_id: 'ORD001',
          updates: { status: 'REFUNDING' }
        }
      ]
    });
    const ticketId = ticket.id;
    console.log(`  工单创建成功，ID: ${ticketId}`);
    console.log(`  状态: ${ticket.status}`);
    console.log(`  需要审批级别: ${ticket.required_approval_level}`);
    console.log('  ✓ 工单创建正常\n');

    console.log('【测试4】执行预检');
    const precheck = await request('POST', `/api/v1/tickets/${ticketId}/precheck`);
    console.log(`  预检状态: ${precheck.status}`);
    console.log(`  预估影响记录数: ${precheck.estimated_impact_count}`);
    console.log(`  高风险字段数: ${precheck.high_risk_fields.length}`);
    if (!precheck.passed) {
      throw new Error('预检应该通过: ' + JSON.stringify(precheck.errors));
    }
    console.log('  ✓ 预检通过\n');

    console.log('【测试5】审批（订单状态是高风险字段，需要二级审批）');
    await request('POST', `/api/v1/tickets/${ticketId}/approve`, {
      approver: 'manager01',
      level: 1,
      comment: '一级审批通过'
    });
    await request('POST', `/api/v1/tickets/${ticketId}/approve`, {
      approver: 'director01',
      level: 2,
      comment: '二级审批通过'
    });
    console.log('  ✓ 二级审批完成\n');

    console.log('【测试6】执行修复');
    const execution = await request('POST', `/api/v1/tickets/${ticketId}/execute`, {
      executor: 'operator01'
    });
    console.log(`  执行状态: ${execution.status}`);
    console.log(`  实际影响记录数: ${execution.actual_impact_count}`);
    console.log('  ✓ 执行成功\n');

    console.log('【测试7】验证订单状态已修改');
    const orderAfter = await request('GET', '/api/v1/data/orders/ORD001');
    console.log(`  订单 ORD001 当前状态: ${orderAfter.status}`);
    if (orderAfter.status !== 'REFUNDING') {
      throw new Error('订单状态未被修改');
    }
    console.log('  ✓ 数据修改验证通过\n');

    console.log('【测试8】尝试重复执行（应该失败）');
    try {
      await request('POST', `/api/v1/tickets/${ticketId}/execute`, {
        executor: 'operator01'
      });
      throw new Error('重复执行应该失败');
    } catch (e) {
      console.log(`  预期错误: ${e.data.error}`);
      if (!e.data.error.includes('执行') && !e.data.error.includes('重复')) {
        throw new Error('错误信息不正确: ' + e.data.error);
      }
      console.log('  ✓ 重复执行被阻止\n');
    }

    console.log('【测试9】创建高风险字段工单（会员积分）');
    const highRiskTicket = await request('POST', '/api/v1/tickets', {
      title: '会员 USER002 积分补发',
      creator: 'lisi',
      department: '会员中心',
      reason: '营销活动奖励',
      repair_actions: [
        {
          table: 'members',
          record_id: 'USER002',
          updates: { points: 5000, level: 'GOLD' }
        }
      ]
    });
    const highRiskId = highRiskTicket.id;
    console.log(`  工单创建成功，ID: ${highRiskId}`);
    console.log(`  需要审批级别: ${highRiskTicket.required_approval_level}`);
    if (highRiskTicket.required_approval_level !== 2) {
      throw new Error('高风险字段应该需要二级审批');
    }
    console.log('  ✓ 高风险字段识别正确\n');

    console.log('【测试10】预检高风险工单');
    const highRiskPrecheck = await request('POST', `/api/v1/tickets/${highRiskId}/precheck`);
    console.log(`  高风险字段: ${highRiskPrecheck.high_risk_fields.map(f => f.field).join(', ')}`);
    console.log('  ✓ 高风险字段预检正常\n');

    console.log('【测试11】一级审批后尝试执行（应该失败）');
    await request('POST', `/api/v1/tickets/${highRiskId}/approve`, {
      approver: 'manager01',
      level: 1,
      comment: '一级审批通过'
    });
    try {
      await request('POST', `/api/v1/tickets/${highRiskId}/execute`, {
        executor: 'operator01'
      });
      throw new Error('只有一级审批时执行应该失败');
    } catch (e) {
      console.log(`  预期错误: ${e.data.error}`);
      console.log('  ✓ 二级审批前执行被阻止\n');
    }

    console.log('【测试12】二级审批后执行');
    await request('POST', `/api/v1/tickets/${highRiskId}/approve`, {
      approver: 'director01',
      level: 2,
      comment: '二级审批通过'
    });
    const highRiskExecution = await request('POST', `/api/v1/tickets/${highRiskId}/execute`, {
      executor: 'operator01'
    });
    console.log(`  执行状态: ${highRiskExecution.status}`);
    console.log('  ✓ 二级审批后执行成功\n');

    console.log('【测试13】验证会员数据修改');
    const memberAfter = await request('GET', '/api/v1/data/members/USER002');
    console.log(`  会员积分: ${memberAfter.points} (预期 5000)`);
    console.log(`  会员等级: ${memberAfter.level} (预期 GOLD)`);
    if (memberAfter.points !== 5000 || memberAfter.level !== 'GOLD') {
      throw new Error('会员数据修改失败');
    }
    console.log('  ✓ 会员数据修改验证通过\n');

    console.log('【测试14】预检阻断测试 - 不存在的记录');
    const badTicket = await request('POST', '/api/v1/tickets', {
      title: '测试预检阻断',
      creator: 'zhangsan',
      department: '测试',
      reason: '测试预检功能',
      repair_actions: [
        {
          table: 'orders',
          record_id: 'NOT_EXIST_999',
          updates: { status: 'CANCELLED' }
        }
      ]
    });
    const badTicketId = badTicket.id;
    const badPrecheck = await request('POST', `/api/v1/tickets/${badTicketId}/precheck`);
    console.log(`  预检状态: ${badPrecheck.status}`);
    console.log(`  错误信息: ${badPrecheck.errors[0]}`);
    if (badPrecheck.passed) {
      throw new Error('预检应该失败');
    }
    console.log('  ✓ 预检阻断正常\n');

    console.log('【测试15】预检失败后尝试审批（应该失败）');
    try {
      await request('POST', `/api/v1/tickets/${badTicketId}/approve`, {
        approver: 'manager01',
        level: 1,
        comment: '测试'
      });
      throw new Error('预检失败后审批应该失败');
    } catch (e) {
      console.log(`  预期错误: ${e.data.error}`);
      if (e.data.error !== '预检未通过，不能审批') {
        throw new Error('错误信息不正确');
      }
      console.log('  ✓ 预检失败时审批被阻止\n');
    }

    console.log('【测试16】审计报告查询');
    const ticketDetails = await request('GET', `/api/v1/tickets/${ticketId}`);
    console.log(`  审计ID: ${ticketDetails.audit_id}`);
    if (ticketDetails.audit) {
      console.log(`  影响记录数: ${ticketDetails.audit.affected_count}`);
      console.log(`  差异字段数: ${ticketDetails.audit.differences.length}`);
      console.log(`  操作者: ${ticketDetails.audit.executor}`);
    }
    console.log('  ✓ 审计报告查询正常\n');

    console.log('【测试17】工单列表查询');
    const ticketList = await request('GET', '/api/v1/tickets');
    console.log(`  工单总数: ${ticketList.length}`);
    console.log('  ✓ 工单列表查询正常\n');

    console.log('============================================');
    console.log('  所有测试通过 ✓');
    console.log('============================================\n');

  } catch (e) {
    console.error('\n❌ 测试失败:', e.message || e);
    if (e.data) console.error('错误详情:', JSON.stringify(e.data, null, 2));
    process.exit(1);
  }
}

runTests();
