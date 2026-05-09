const http = require('http');

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('========================================');
  console.log('  骑手保证金扣罚 API 功能测试');
  console.log('========================================\n');
  
  const riderId = 'rider-001';
  
  try {
    console.log('[1] 创建违规单 - 超时配送，扣罚 100 元');
    const createRes = await request('POST', '/api/violations', {
      riderId,
      violationType: '超时配送',
      amount: 100,
      description: '订单超时 30 分钟',
    });
    console.log('状态:', createRes.status === 200 ? '✅ 通过' : '❌ 失败');
    if (!createRes.data.success) {
      console.log('错误:', createRes.data.message);
      return;
    }
    const violationId = createRes.data.data.id;
    console.log('违规单 ID:', violationId);
    console.log('当前状态:', createRes.data.data.status);
    console.log();
    
    console.log('[2] 查询初始余额（可用1000，冻结0）');
    const balanceRes = await request('GET', `/api/balances/${riderId}`);
    console.log('状态:', balanceRes.status === 200 ? '✅ 通过' : '❌ 失败');
    console.log('可用余额:', balanceRes.data.data.available);
    console.log('冻结余额:', balanceRes.data.data.frozen);
    console.log();
    
    console.log('[3] 执行冻结 - 应该从可用转到冻结');
    const freezeRes = await request('POST', `/api/violations/${violationId}/freeze`);
    console.log('状态:', freezeRes.status === 200 ? '✅ 通过' : '❌ 失败');
    if (freezeRes.status === 200) {
      console.log('可用余额:', freezeRes.data.data.balance.available);
      console.log('冻结余额:', freezeRes.data.data.balance.frozen);
      console.log('当前步骤:', freezeRes.data.data.violation.currentStep);
    } else {
      console.log('错误:', freezeRes.data.message);
    }
    console.log();
    
    console.log('[4] 重复冻结测试 - 应该被拦截');
    const freezeAgainRes = await request('POST', `/api/violations/${violationId}/freeze`);
    console.log('状态:', freezeAgainRes.status === 400 ? '✅ 成功拦截' : '❌ 拦截失败');
    if (freezeAgainRes.status === 400) {
      console.log('错误信息:', freezeAgainRes.data.message);
      console.log('当前卡点:', freezeAgainRes.data.currentStep);
    }
    console.log();
    
    console.log('[5] 执行扣罚 - 扣减冻结余额');
    const deductRes = await request('POST', `/api/violations/${violationId}/deduct`);
    console.log('状态:', deductRes.status === 200 ? '✅ 通过' : '❌ 失败');
    if (deductRes.status === 200) {
      console.log('冻结余额:', deductRes.data.data.balance.frozen);
      console.log('当前状态:', deductRes.data.data.violation.status);
    }
    console.log();
    
    console.log('[6] 查看保证金流水');
    const flowsRes = await request('GET', `/api/flows?riderId=${riderId}`);
    console.log('状态:', flowsRes.status === 200 ? '✅ 通过' : '❌ 失败');
    console.log('流水数量:', flowsRes.data.data.length);
    flowsRes.data.data.forEach((flow, i) => {
      console.log(`  [${i+1}] ${flow.type}: ${flow.amount}元 - ${flow.remark}`);
    });
    console.log();
    
    console.log('[7] 对账检查 - 内部一致性');
    const reconcileRes = await request('POST', '/api/reconcile', { riderId });
    console.log('状态:', reconcileRes.status === 200 ? '✅ 通过' : '❌ 失败');
    console.log('流水累计:', reconcileRes.data.data.flowSum);
    console.log('当前总额:', reconcileRes.data.data.currentBalance.total);
    console.log('内部一致:', reconcileRes.data.data.internalConsistent ? '是' : '否');
    console.log();
    
    console.log('[8] 处理记录追踪 - 查看完整流程');
    const traceRes = await request('GET', `/api/violations/${violationId}/trace`);
    console.log('状态:', traceRes.status === 200 ? '✅ 通过' : '❌ 失败');
    console.log('当前步骤:', traceRes.data.data.currentStep);
    console.log('处理步骤数:', traceRes.data.data.totalSteps);
    console.log('处理历史:');
    traceRes.data.data.history.forEach((r, i) => {
      console.log(`  [${i+1}] ${r.action} - ${r.status} (${r.operator})`);
      if (r.remark) console.log(`       ${r.remark}`);
    });
    console.log();
    
    console.log('[9] 提交申诉 - 进入申诉中状态');
    const appealRes = await request('POST', `/api/violations/${violationId}/appeal`, {
      appealReason: '当时系统派单距离显示有误，实际距离比显示远5公里',
    });
    console.log('状态:', appealRes.status === 200 ? '✅ 通过' : '❌ 失败');
    console.log('当前状态:', appealRes.data.data.status);
    console.log('当前步骤:', appealRes.data.data.currentStep);
    console.log();
    
    console.log('[10] 申诉审核通过 - 回滚保证金');
    const reviewRes = await request('POST', `/api/violations/${violationId}/review`, {
      approved: true,
    });
    console.log('状态:', reviewRes.status === 200 ? '✅ 通过' : '❌ 失败');
    if (reviewRes.status === 200) {
      console.log('申诉后余额:', reviewRes.data.data.balance.available);
      console.log('当前状态:', reviewRes.data.data.violation.status);
    }
    console.log();
    
    console.log('[11] 再次对账 - 验证回滚后余额一致');
    const reconcile2Res = await request('POST', '/api/reconcile', { riderId });
    console.log('状态:', reconcile2Res.status === 200 ? '✅ 通过' : '❌ 失败');
    console.log('流水累计:', reconcile2Res.data.data.flowSum);
    console.log('当前总额:', reconcile2Res.data.data.currentBalance.total);
    console.log('内部一致:', reconcile2Res.data.data.internalConsistent ? '是' : '否');
    console.log();
    
    console.log('[12] 验证回滚后无法再次冻结');
    const freezeAfterRollback = await request('POST', `/api/violations/${violationId}/freeze`);
    console.log('状态:', freezeAfterRollback.status === 400 ? '✅ 成功拦截' : '❌ 拦截失败');
    if (freezeAfterRollback.status === 400) {
      console.log('错误信息:', freezeAfterRollback.data.message);
    }
    console.log();
    
    console.log('========================================');
    console.log('  测试另一个场景：余额不足被拒绝');
    console.log('========================================\n');
    
    const rider2 = 'rider-002';
    
    console.log('[A] 创建大额违规单（2000元，超过初始1000元）');
    const create2Res = await request('POST', '/api/violations', {
      riderId: rider2,
      violationType: '严重违规',
      amount: 2000,
      description: '伪造签收',
    });
    const vid2 = create2Res.data.data.id;
    console.log('违规单 ID:', vid2);
    console.log();
    
    console.log('[B] 冻结 - 应该因余额不足被拒绝');
    const freeze2Res = await request('POST', `/api/violations/${vid2}/freeze`);
    console.log('状态:', freeze2Res.status === 400 ? '✅ 正确拒绝' : '❌ 错误');
    if (freeze2Res.status === 400) {
      console.log('错误信息:', freeze2Res.data.message);
      console.log('当前卡点:', freeze2Res.data.currentStep);
      console.log('上一步记录:', freeze2Res.data.previousRecord?.action || '无');
      console.log('本次拒绝记录:', freeze2Res.data.currentRecord?.remark || '无');
    }
    console.log();
    
    console.log('[C] 查看这个被拒绝的违规单的处理追踪');
    const trace2Res = await request('GET', `/api/violations/${vid2}/trace`);
    console.log('状态:', trace2Res.status === 200 ? '✅ 通过' : '❌ 失败');
    console.log('当前卡点:', trace2Res.data.data.currentStep);
    console.log('上一步:', trace2Res.data.data.previousRecord?.action || '无');
    console.log('最后一步:', trace2Res.data.data.lastRecord?.action || '无');
    console.log('全部历史:');
    trace2Res.data.data.history.forEach((r, i) => {
      console.log(`  [${i+1}] ${r.action} - ${r.status}`);
      if (r.remark) console.log(`       ${r.remark}`);
    });
    console.log();
    
    console.log('========================================');
    console.log('  所有测试用例执行完成！');
    console.log('========================================');
    console.log('\n验证说明：');
    console.log('1. 看控制台每个步骤前面的 ✅ 或 ❌ 就知道功能是否正常');
    console.log('2. 重复冻结时会返回 400，并告诉你当前卡在哪一步');
    console.log('3. 余额不足时，会同时返回上一次处理记录和本次拒绝原因');
    console.log('4. 对账接口会计算流水累计和当前余额是否匹配');
    console.log('5. 申诉回滚后，金额会原路返回，且不能再次冻结');
    
  } catch (e) {
    console.error('测试出错:', e.message);
    console.log('\n请先启动服务器：node server.js');
  }
}

runTests();
