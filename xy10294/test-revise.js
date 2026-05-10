const BASE_URL = 'http://localhost:3002';

async function test() {
  const ts = Date.now();
  
  console.log('【修正测试】');
  
  console.log('\n1. 创建申请：误选吴八(EMP006)为主焊接岗替班人');
  const r1 = await fetch(BASE_URL + '/api/shift-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotency_key: `REVISE-TEST-${ts}`,
      requester_id: 'EMP002',
      target_position_id: 'POS001',
      replacement_employee_id: 'EMP006',
      shift_date: '2026-05-25',
      shift_type: 'DAY',
      reason: '误选吴八',
    }),
  });
  const j1 = await r1.json();
  const reqId = j1.data?.request_id;
  console.log('   request_id:', reqId);
  console.log('   当前替班人:', j1.data?.replacement_employee_id);
  console.log('   校验结果:', j1.validation_summary?.passed, '(应为 false，因为吴八焊接L1 < 要求L3)');
  
  console.log('\n2. 修正申请：改为李四(EMP002)');
  const r2 = await fetch(BASE_URL + `/api/shift-requests/${reqId}/revise`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      actor_id: 'EMP002',
      replacement_employee_id: 'EMP002',
      reason: '应该是李四',
      comment: '修正错误的替班人'
    }),
  });
  const j2 = await r2.json();
  console.log('   HTTP status:', r2.status);
  console.log('   success:', j2.success);
  console.log('   消息:', j2.message || '(无错误)');
  console.log('   新替班人:', j2.data?.replacement_employee_id, '(应为 EMP002)');
  console.log('   状态:', j2.data?.status, '(应为 DRAFT，回到草稿)');
  console.log('   新校验结果:', j2.validation_summary?.passed, '(应为 true，李四焊接L3 >= 要求L3)');
  
  console.log('\n3. 查询申请详情确认修正结果');
  const r3 = await fetch(BASE_URL + `/api/shift-requests/${reqId}`);
  const j3 = await r3.json();
  console.log('   流转日志:');
  j3.data?.transitions?.forEach(t => {
    console.log('     -', t.transition_type, ':', t.from_status, '->', t.to_status, t.comment ? `(${t.comment})` : '');
  });
}

test().catch(console.error);
