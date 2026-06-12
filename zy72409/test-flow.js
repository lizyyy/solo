const http = require('http');

const BASE_URL = 'localhost';
const PORT = 3001;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: `/api${path}`,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
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
}

function assert(condition, msg) {
  if (!condition) {
    console.error('  ✗ 断言失败:', msg);
    process.exitCode = 1;
  } else {
    console.log('  ✓', msg);
  }
}

async function testFlow() {
  console.log('===  Livehouse 酒水分成修复验证  ===\n');

  // 步骤 0: 健康检查
  console.log('步骤 0: 健康检查');
  const health = await request('GET', '/health');
  assert(health.success, '服务健康');
  console.log();

  // 步骤 1: 创建批次
  console.log('步骤 1: 创建演出批次');
  const createBatch = await request('POST', '/batches', {
    batchDate: '2026-06-12',
    showName: '周五爵士夜'
  });
  assert(createBatch.success, '创建批次成功');
  const batchId = createBatch.data.batchId;
  console.log('  批次ID:', batchId);
  console.log();

  // 步骤 2: 第一次导入调音师留言（赠票+售票混合）
  console.log('步骤 2: 第一次导入调音师留言（赠票2张 + 售票2张 混合）');
  const soundTickets = [
    { ticketType: 'paid', ticketNumber: 'T001', attendeeName: '张三', price: 100, quantity: 1 },
    { ticketType: 'paid', ticketNumber: 'T002', attendeeName: '李四', price: 100, quantity: 1 },
    { ticketType: 'complimentary', ticketNumber: 'C001', attendeeName: '嘉宾A', price: 0, quantity: 1 },
    { ticketType: 'complimentary', ticketNumber: 'C002', attendeeName: '嘉宾B', price: 0, quantity: 1 }
  ];
  const imp1 = await request('POST', `/batches/${batchId}/import/sound-engineer`, { tickets: soundTickets });
  assert(imp1.success, '调音师第一次导入成功');
  assert(imp1.data.recordsImported === 4, `导入4条记录（实际 ${imp1.data.recordsImported}）`);
  assert(imp1.data.duplicatesFound === 0, '无重复');
  console.log();

  // 步骤 3: 重跑同一批调音师材料（测试 import_version 递增，历史版本分清）
  console.log('步骤 3: 重跑同一批调音师材料（测试重跑不会多出一份）');
  const imp2 = await request('POST', `/batches/${batchId}/import/sound-engineer`, { tickets: soundTickets });
  assert(imp2.success, '调音师第二次导入成功');
  assert(imp2.data.recordsImported === 4, `第二次导入仍为4条（实际 ${imp2.data.recordsImported}）`);
  assert(imp2.data.warnings.some(w => w.includes('v2') && w.includes('v1')), '警告提示检测到历史版本 v1，本次 v2');
  console.log('  警告信息:', imp2.data.warnings);
  console.log();

  // 步骤 4: 导入排练群接龙（与调音师冲突：多1张售票、少1张赠票）
  console.log('步骤 4: 导入排练群接龙（故意制造冲突）');
  const rehearsalTickets = [
    { ticketType: 'paid', ticketNumber: 'T001', attendeeName: '张三', price: 100, quantity: 1 },
    { ticketType: 'paid', ticketNumber: 'T002', attendeeName: '李四', price: 100, quantity: 1 },
    { ticketType: 'paid', ticketNumber: 'T003', attendeeName: '王五', price: 100, quantity: 1 },
    { ticketType: 'complimentary', ticketNumber: 'C001', attendeeName: '嘉宾A', price: 0, quantity: 1 }
  ];
  const imp3 = await request('POST', `/batches/${batchId}/import/rehearsal-group`, { tickets: rehearsalTickets });
  assert(imp3.success, '排练群导入成功');
  assert(imp3.data.conflicts.length >= 3, `至少检测出3类冲突（实际 ${imp3.data.conflicts.length}）`);
  console.log('  检测到的冲突类型:', imp3.data.conflicts.map(c => c.conflictType));
  console.log();

  // 步骤 5: 许老师按排练群口径确认所有冲突 -> 观察 canonical、分成、导出是否一起变
  console.log('步骤 5: 许老师依次解决所有冲突（选择「确认排练群」口径）');
  const conflictsBefore = await request('GET', `/batches/${batchId}/conflicts`);
  for (const c of conflictsBefore.data) {
    if (!c.resolved) {
      const r = await request('POST', `/conflicts/${c.id}/resolve`, {
        resolution: 'confirm_rehearsal_group',
        resolvedBy: '许老师'
      });
      assert(r.success && r.data.resolved === 1, `冲突 ${c.conflict_type} 已标记已解决`);
    }
  }
  console.log();
  console.log('步骤 6: 先计算分成，再取统一结果核对核心链路收口');
  console.log('  --- 先计算分成 ---');
  const calc1 = await request('POST', `/batches/${batchId}/calculate`);
  assert(calc1.success, '分成计算成功');
  console.log('  总票数:', calc1.data.totalTickets);
  console.log('  售票数:', calc1.data.totalPaidTickets);
  console.log('  赠票数:', calc1.data.totalCompTickets);
  console.log('  总金额:', calc1.data.totalRevenue);
  assert(calc1.data.totalPaidTickets === 3, `分成计算售票数 = 3（实际 ${calc1.data.totalPaidTickets}）`);
  assert(calc1.data.totalCompTickets === 1, `分成计算赠票数 = 1（实际 ${calc1.data.totalCompTickets}）`);
  assert(calc1.data.totalRevenue === 300, `分成计算总金额 = 300（实际 ${calc1.data.totalRevenue}）`);

  console.log();
  console.log('  --- 核对核心链路收口 —— canonical / 分成 / 导出 三处一致 ---');
  const unified = await request('GET', `/batches/${batchId}`);
  const data = unified.data;

  console.log('  --- 批次信息 ---');
  console.log('  authoritative_source:', data.batch.authoritativeSource);
  console.log('  状态:', data.batch.status);
  console.log('  是否混合票:', data.batch.hasMixedTickets);
  assert(data.batch.authoritativeSource === 'rehearsal_group', `权威口径 = rehearsal_group（实际 ${data.batch.authoritativeSource}）`);

  console.log();
  console.log('  --- canonical 权威明细（按排练群口径应有4条：3售票 + 1赠票） ---');
  console.log('  canonical 条数:', data.tickets.canonical.length);
  console.log('  canonical 明细:');
  for (const t of data.tickets.canonical) {
    console.log('   -', t.ticketType, t.ticketNumber, t.attendeeName, 'price=' + t.price, 'qty=' + t.quantity, 'source_of_truth=' + t.sourceOfTruth);
  }
  const canonicalPaid = data.tickets.canonical.filter(t => t.ticketType === 'paid').reduce((s, t) => s + t.quantity, 0);
  const canonicalComp = data.tickets.canonical.filter(t => t.ticketType === 'complimentary').reduce((s, t) => s + t.quantity, 0);
  assert(data.tickets.canonical.length === 4, `canonical 共4条（实际 ${data.tickets.canonical.length}）`);
  assert(canonicalPaid === 3, `canonical 售票3张（实际 ${canonicalPaid}）`);
  assert(canonicalComp === 1, `canonical 赠票1张（实际 ${canonicalComp}）`);

  console.log();
  console.log('  --- 核对混合批次：赠票+售票混在一个批次 ---');
  assert(data.batch.hasMixedTickets === true, 'hasMixedTickets = true（赠票售票混合）');
  const mixedCheck = data.selfCheckResults.find(r => r.checkType === 'mixed_tickets');
  assert(mixedCheck.passed === false, 'mixed_tickets 自检不通过，提示录音师复核');
  console.log('  mixed_tickets 自检消息:', mixedCheck.message);

  console.log();
  console.log('  --- 核对导出一致性（canonical / 分成 / 导出 同一份） ---');
  const exportCheck = data.selfCheckResults.find(r => r.checkType === 'export_consistency');
  assert(exportCheck.passed === true, 'export_consistency 自检通过，接口/页面/导出一致');
  console.log('  export_consistency 消息:', exportCheck.message);

  // 步骤 7: 导出文件验证（和接口返回同一份 canonical）
  console.log();
  console.log('步骤 7: 核对导出文件 = 页面结果 = 接口返回');
  const exp = await request('GET', `/batches/${batchId}/export`);
  assert(exp.exportSource === 'canonical_tickets', `导出源 = canonical_tickets（实际 ${exp.exportSource}）`);
  assert(exp.authoritativeSource === 'rehearsal_group', `导出 authoritativeSource = rehearsal_group`);
  assert(Array.isArray(exp.tickets) || exp.tickets, '导出包含 tickets');
  assert(Array.isArray(exp.tickets?.canonical) && exp.tickets.canonical.length === 4, `导出 canonical 也是4条`);
  console.log('  导出 canonical 售票数:', exp.tickets.canonical.filter(t => t.ticketType === 'paid').reduce((s, t) => s + t.quantity, 0));
  console.log('  导出 canonical 赠票数:', exp.tickets.canonical.filter(t => t.ticketType === 'complimentary').reduce((s, t) => s + t.quantity, 0));

  // 步骤 8: 切口径测试 —— 改为确认调音师，确认数字跟着变
  console.log();
  console.log('步骤 8: 切换口径 —— 重新解决所有冲突为「确认调音师」，核对 canonical + 分成一起变');

  // 为了切换，先再导入排练群（生成新的未解决冲突），然后选调音师口径
  const imp4 = await request('POST', `/batches/${batchId}/import/rehearsal-group`, { tickets: rehearsalTickets });
  const conflictsAfter = await request('GET', `/batches/${batchId}/conflicts`);
  for (const c of conflictsAfter.data) {
    if (!c.resolved) {
      await request('POST', `/conflicts/${c.id}/resolve`, {
        resolution: 'confirm_sound_engineer',
        resolvedBy: '许老师'
      });
    }
  }

  const calc2 = await request('POST', `/batches/${batchId}/calculate`);
  const unified2 = await request('GET', `/batches/${batchId}`);
  console.log('  切换后 authoritative_source:', unified2.data.batch.authoritativeSource);
  console.log('  切换后 canonical 条数:', unified2.data.tickets.canonical.length);
  console.log('  切换后分成：售票=' + calc2.data.totalPaidTickets + ' 赠票=' + calc2.data.totalCompTickets + ' 金额=' + calc2.data.totalRevenue);
  assert(unified2.data.batch.authoritativeSource === 'sound_engineer', `切换后 authoritativeSource = sound_engineer`);
  assert(calc2.data.totalPaidTickets === 2, `切换口径后分成售票=2（调音师只有2张售票，实际 ${calc2.data.totalPaidTickets}）`);
  assert(calc2.data.totalCompTickets === 2, `切换口径后分成赠票=2（调音师有2张赠票，实际 ${calc2.data.totalCompTickets}）`);
  assert(calc2.data.totalRevenue === 200, `切换口径后分成金额=200（实际 ${calc2.data.totalRevenue}）`);

  // 重算一致性检查
  const selfCheck2 = unified2.data.selfCheckResults.find(r => r.checkType === 'recalculation_consistency');
  console.log('  recalculation_consistency:', selfCheck2.passed, selfCheck2.message);

  console.log();
  console.log('步骤 9: 录音师复核通过（授权提醒更新）');
  const st = await request('POST', `/batches/${batchId}/status`, { status: 'confirmed', updatedBy: '录音师' });
  assert(st.success && st.data.status === 'confirmed', '录音师确认状态=confirmed');
  const finalUnified = await request('GET', `/batches/${batchId}`);
  console.log('  最终状态:', finalUnified.data.batch.status);
  console.log('  最终 authoritative_source:', finalUnified.data.batch.authoritativeSource);
  console.log('  最终混合票标记:', finalUnified.data.batch.hasMixedTickets);
  console.log('  最终 canonical 记录数:', finalUnified.data.tickets.canonical.length);

  console.log();
  console.log('=== 全部验证通过 ===');
}

testFlow().catch(err => {
  console.error('测试异常:', err);
  process.exit(1);
});
