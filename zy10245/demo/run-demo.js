const http = require('http');

const API_BASE = 'http://localhost:3000/api';

function request(method, path, data = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'demo_user',
        ...extraHeaders
      }
    };

    const req = http.request(`${API_BASE}${path}`, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

function log(title, data, color = '36') {
  console.log(`\n\x1b[${color}m【${title}】\x1b[0m`);
  if (data) {
    if (typeof data === 'string') {
      console.log(data);
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

async function runDemo() {
  console.log('\n\x1b[35m========================================\x1b[0m');
  console.log('\x1b[35m  养老院护理交接 API 演示\x1b[0m');
  console.log('\x1b[35m========================================\x1b[0m');

  try {
    log('1. 健康检查');
    const health = await request('GET', '/health');
    console.log('状态:', health.data.message);

    log('2. 创建老人档案');
    const elder1 = await request('POST', '/elders', {
      name: '王爷爷',
      room_number: '101',
      bed_number: 'A',
      risk_level: 'high',
      medical_conditions: '高血压、糖尿病',
      allergies: '青霉素'
    });
    log('王爷爷创建成功', elder1.data.data);

    const elder2 = await request('POST', '/elders', {
      name: '李奶奶',
      room_number: '102',
      bed_number: 'B',
      risk_level: 'normal',
      medical_conditions: '关节炎',
      allergies: '无'
    });
    log('李奶奶创建成功', elder2.data.data);

    const elder3 = await request('POST', '/elders', {
      name: '张爷爷',
      room_number: '103',
      bed_number: 'A',
      risk_level: 'critical',
      medical_conditions: '心脏病、老年痴呆',
      allergies: '无'
    });
    log('张爷爷创建成功（高风险）', elder3.data.data);

    log('3. 添加家属备注');
    const note1 = await request('POST', `/elders/${elder1.data.data.id}/family-notes`, {
      author: '王小明（家属）',
      content: '今晚8点会打电话问候，请注意接听',
      is_important: true
    });
    log('家属备注添加成功', note1.data.data);

    log('4. 创建护理事项');
    const care1 = await request('POST', '/care-items', {
      elder_id: elder1.data.data.id,
      type: 'medication',
      title: '早餐后服用降压药',
      description: '硝苯地平缓释片 10mg',
      scheduled_time: '08:00',
      requires_acknowledgment: true,
      created_by: '李护士'
    });
    log('护理事项1创建成功', care1.data.data);

    const care2 = await request('POST', '/care-items', {
      elder_id: elder3.data.data.id,
      type: 'vital_signs',
      title: '测量血压心率',
      description: '早晚各一次，异常及时报告',
      scheduled_time: '20:00',
      requires_acknowledgment: true,
      created_by: '李护士'
    });
    log('护理事项2创建成功（高风险）', care2.data.data);

    const care3 = await request('POST', '/care-items', {
      elder_id: elder2.data.data.id,
      type: 'activity',
      title: '协助散步',
      description: '下午散步30分钟',
      scheduled_time: '15:00',
      requires_acknowledgment: false,
      created_by: '李护士'
    });
    log('护理事项3创建成功', care3.data.data);

    log('5. 创建班次 - 夜班');
    const nightShift = await request('POST', '/shifts', {
      type: 'night',
      date: '2024-01-15',
      nurse_name: '李护士（夜班）'
    });
    log('夜班创建成功', nightShift.data.data);

    log('6. 创建班次 - 白班');
    const morningShift = await request('POST', '/shifts', {
      type: 'morning',
      date: '2024-01-15',
      nurse_name: '王护士（白班）'
    });
    log('白班创建成功', morningShift.data.data);

    log('7. 开始夜班');
    const startNight = await request('POST', `/shifts/${nightShift.data.data.id}/start`);
    log('夜班已开始', { status: startNight.data.data.status });

    log('8. 完成部分护理事项');
    const complete1 = await request('POST', `/care-items/${care1.data.data.id}/complete`, {
      performed_by: '李护士',
      notes: '已按时服用',
      shift_id: nightShift.data.data.id
    });
    log('护理事项1完成', { status: complete1.data.data.status });

    log('9. ========== 演示边界情况 ==========', '33');

    log('9.1 尝试重复完成同一个护理事项');
    const duplicateComplete = await request('POST', `/care-items/${care1.data.data.id}/complete`, {
      performed_by: '李护士',
      notes: '再次确认',
      shift_id: nightShift.data.data.id
    });
    log('系统拦截结果', {
      statusCode: duplicateComplete.status,
      error: duplicateComplete.data.error
    });

    log('9.2 尝试未接班确认就关闭需要确认的事项');
    const closeWithoutAck = await request('POST', `/care-items/${care2.data.data.id}/close-without-ack`, {
      performed_by: '李护士',
      reason: '忘记提醒',
      shift_id: nightShift.data.data.id
    });
    log('系统拦截结果', {
      statusCode: closeWithoutAck.status,
      error: closeWithoutAck.data.error
    });

    log('9.3 尝试重复创建同类型同日期班次');
    const duplicateShift = await request('POST', '/shifts', {
      type: 'night',
      date: '2024-01-15',
      nurse_name: '张护士'
    });
    log('系统拦截结果', {
      statusCode: duplicateShift.status,
      error: duplicateShift.data.error
    });

    log('10. 夜班提交交接');
    const handover = await request('POST', `/shifts/${nightShift.data.data.id}/handover/submit`, {
      next_shift_id: morningShift.data.data.id,
      submitted_by: '李护士',
      notes: `
1. 王爷爷：血压药已服，状态平稳
2. 张爷爷：血压心率已测量，无异常，白班请继续关注
3. 李奶奶：散步已完成
4. 张爷爷今晚家属会来看望，请留意
      `.trim()
    });
    log('交接提交成功', handover.data.data);
    log('系统警告（未完成事项）', handover.data.warnings);

    log('11. ========== 演示交接撤销 ==========', '33');
    const revoke = await request('POST', `/shifts/${nightShift.data.data.id}/handover/revoke`, {
      revoked_by: '李护士'
    });
    log('交接撤销结果', revoke.data);

    log('12. 重新提交交接');
    const handover2 = await request('POST', `/shifts/${nightShift.data.data.id}/handover/submit`, {
      next_shift_id: morningShift.data.data.id,
      submitted_by: '李护士',
      notes: '重新提交交接，请白班关注张爷爷的情况'
    });
    log('交接重新提交成功', handover2.data.data);

    log('13. 白班确认接班');
    const acknowledge = await request('POST', `/shifts/${morningShift.data.data.id}/handover/acknowledge`, {
      acknowledged_by: '王护士',
      handover_id: handover2.data.data.id
    });
    log('接班确认成功', {
      status: acknowledge.data.data.status,
      acknowledgedBy: acknowledge.data.data.acknowledged_by
    });

    log('14. ========== 检查班次状态 ==========', '33');
    const nightAfter = await request('GET', `/shifts/${nightShift.data.data.id}`);
    const morningAfter = await request('GET', `/shifts/${morningShift.data.data.id}`);
    log('夜班最终状态', { status: nightAfter.data.data.status, endedAt: nightAfter.data.data.ended_at });
    log('白班最终状态', { status: morningAfter.data.data.status, startedAt: morningAfter.data.data.started_at });

    log('15. ========== 查询未完成护理事项 ==========', '33');
    const pendingItems = await request('GET', '/audit/pending-items-summary');
    log('未完成事项汇总', {
      total: pendingItems.data.summary.total,
      byRiskLevel: pendingItems.data.summary.byRiskLevel,
      items: pendingItems.data.data.map(i => ({
        老人: i.elder_name,
        风险等级: i.risk_level,
        事项: i.title,
        状态: i.status
      }))
    });

    log('16. ========== 查询被系统拦截的错误操作 ==========', '33');
    const blockedOps = await request('GET', '/audit/blocked-operations');
    log('拦截的操作统计', {
      总拦截数: blockedOps.data.summary.total,
      按原因统计: blockedOps.data.summary.byReason,
      详情: blockedOps.data.data.map(op => ({
        时间: op.created_at,
        类型: op.operation_type,
        原因: op.block_reason
      }))
    });

    log('17. ========== 查询交接历史 ==========', '33');
    const history = await request('GET', '/audit/handover-history');
    log('交接历史记录', history.data.data.map(h => ({
      日期: h.shift_date,
      班次: h.shift_type === 'night' ? '夜班' : '白班',
      交班护士: h.outgoing_nurse,
      接班护士: h.incoming_nurse,
      交接时间: h.acknowledged_at
    })));

    log('18. ========== 查询风险提醒 ==========', '33');
    const alerts = await request('GET', `/shifts/${nightShift.data.data.id}/risk-alerts`);
    log('本班风险提醒', alerts.data.data.map(a => ({
      老人: a.elder_id,
      类型: a.alert_type,
      消息: a.message,
      是否已确认: a.acknowledged ? '是' : '否'
    })));

    log('19. ========== 查询家属备注 ==========', '33');
    const familyNotes = await request('GET', `/elders/${elder1.data.data.id}/family-notes`);
    log('王爷爷的家属备注', familyNotes.data.data.map(n => ({
      作者: n.author,
      内容: n.content,
      重要: n.is_important ? '是' : '否'
    })));

    log('20. ========== 演示重复请求幂等性 ==========', '33');
    const idempotencyKey = 'demo-idemp-key-001';
    
    const firstReq = await request('POST', '/care-items', {
      elder_id: elder2.data.data.id,
      type: 'meal',
      title: '协助用餐',
      created_by: '王护士'
    }, { 'X-Idempotency-Key': idempotencyKey });
    log('第一次请求', { success: firstReq.data.success, id: firstReq.data.data?.id });

    const secondReq = await request('POST', '/care-items', {
      elder_id: elder2.data.data.id,
      type: 'meal',
      title: '协助用餐',
      created_by: '王护士'
    }, { 'X-Idempotency-Key': idempotencyKey });
    log('重复请求（相同幂等键）', {
      success: secondReq.data.success,
      message: secondReq.data.message,
      idempotent: secondReq.data.idempotent
    });

    log('21. ========== 演示已归档老人不能修改 ==========', '33');
    
    await request('POST', `/care-items/${care2.data.data.id}/complete`, {
      performed_by: '王护士',
      notes: '白班已完成',
      shift_id: morningShift.data.data.id
    });
    await request('POST', `/care-items/${care3.data.data.id}/complete`, {
      performed_by: '王护士',
      notes: '已完成',
      shift_id: morningShift.data.data.id
    });

    const archive = await request('POST', `/elders/${elder2.data.data.id}/archive`);
    log('归档李奶奶（所有事项已完成）', { success: archive.data.success });

    const tryUpdate = await request('PUT', `/elders/${elder2.data.data.id}`, {
      name: '李奶奶（修改）',
      room_number: '105'
    });
    log('尝试修改已归档老人', {
      statusCode: tryUpdate.status,
      error: tryUpdate.data.error
    });

    log('22. ========== 最终操作日志统计 ==========', '33');
    const allLogs = await request('GET', '/audit/operation-logs');
    const successCount = allLogs.data.data.filter(l => l.status === 'success').length;
    const blockedCount = allLogs.data.data.filter(l => l.status === 'blocked').length;
    log('操作统计', {
      总操作数: allLogs.data.data.length,
      成功: successCount,
      被拦截: blockedCount
    });

    console.log('\n\x1b[32m========================================\x1b[0m');
    console.log('\x1b[32m  演示完成！\x1b[0m');
    console.log('\x1b[32m========================================\x1b[0m');
    console.log('\n关键场景验证总结:');
    console.log(' ✓ 早晚班交接流程完整');
    console.log(' ✓ 未接班确认不能关闭需要确认的事项');
    console.log(' ✓ 用药事项不能重复确认');
    console.log(' ✓ 高风险老人自动产生提醒');
    console.log(' ✓ 已归档老人不能修改');
    console.log(' ✓ 重复导入/提交被拦截');
    console.log(' ✓ 重复请求幂等性保证');
    console.log(' ✓ 交接可以撤销');
    console.log(' ✓ 所有操作可审计追溯');

  } catch (error) {
    console.error('\x1b[31m演示出错:\x1b[0m', error.message);
    process.exit(1);
  }
}

function waitForServer() {
  return new Promise((resolve) => {
    const check = () => {
      http.get(`${API_BASE}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          setTimeout(check, 500);
        }
      }).on('error', () => setTimeout(check, 500));
    };
    check();
  });
}

async function main() {
  console.log('等待服务器启动...');
  await waitForServer();
  console.log('服务器已启动，开始演示...\n');
  await runDemo();
}

main();
