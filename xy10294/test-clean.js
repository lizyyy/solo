const BASE_URL = 'http://localhost:3002';

async function test() {
  const timestamp = Date.now();
  
  console.log('\n===== 干净测试 - 使用新的 idempotency_key =====\n');
  
  console.log('【测试A】创建正常换班申请（李四 -> 主焊接岗）');
  const r1 = await fetch(BASE_URL + '/api/shift-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotency_key: `CLEAN-TEST-${timestamp}-001`,
      requester_id: 'EMP002',
      target_position_id: 'POS001',
      replacement_employee_id: 'EMP002',
      shift_date: '2026-05-18',
      shift_type: 'DAY',
      reason: '干净测试-正常申请',
    }),
  });
  const j1 = await r1.json();
  console.log('  HTTP:', r1.status, '-', r1.status === 201 ? '201 创建成功 ✓' : '');
  console.log('  状态:', j1.data?.status);
  console.log('  validation_summary.passed:', j1.validation_summary?.passed);
  console.log('  校验项:');
  j1.validation_summary?.validations?.forEach(v => {
    console.log('    -', v.type, ':', v.passed ? '通过' : '失败', '-', v.message);
  });
  
  const reqId = j1.data?.request_id;
  
  if (reqId) {
    console.log('\n【测试B】提交申请');
    const r2 = await fetch(BASE_URL + `/api/shift-requests/${reqId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor_id: 'EMP002' }),
    });
    const j2 = await r2.json();
    console.log('  提交后状态:', j2.data?.status, '-', j2.data?.status === 'PENDING_APPROVAL' ? '✓' : '');
    
    console.log('\n【测试C】审批通过');
    const r3 = await fetch(BASE_URL + `/api/shift-requests/${reqId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor_id: 'MGR001' }),
    });
    const j3 = await r3.json();
    console.log('  审批后状态:', j3.data?.status, '-', j3.data?.status === 'APPROVED' ? '✓' : '');
    
    console.log('\n【测试D】查询申请详情（含校验记录和流转日志）');
    const r4 = await fetch(BASE_URL + `/api/shift-requests/${reqId}`);
    const j4 = await r4.json();
    console.log('  校验记录数:', j4.data?.validations?.length);
    console.log('  流转日志数:', j4.data?.transitions?.length);
    j4.data?.transitions?.forEach(t => {
      console.log('    -', t.transition_type, ':', t.from_status, '->', t.to_status);
    });
  }
  
  console.log('\n【测试E】技能等级不足（吴八申请主焊接岗）');
  const r5 = await fetch(BASE_URL + '/api/shift-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotency_key: `CLEAN-TEST-${timestamp}-002`,
      requester_id: 'EMP006',
      target_position_id: 'POS001',
      replacement_employee_id: 'EMP006',
      shift_date: '2026-05-18',
      shift_type: 'DAY',
      reason: '干净测试-技能不足',
    }),
  });
  const j5 = await r5.json();
  console.log('  HTTP:', r5.status);
  console.log('  状态:', j5.data?.status);
  console.log('  validation_summary.passed:', j5.validation_summary?.passed, '-', j5.validation_summary?.passed === false ? '应为 false ✓' : '');
  const sm = j5.validation_summary?.validations?.find(v => v.type === 'SKILL_MATCH');
  console.log('  SKILL_MATCH:', sm?.passed === false ? '失败 ✓' : '', sm?.message);
  
  console.log('\n【测试F】撤回测试');
  const r6 = await fetch(BASE_URL + '/api/shift-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotency_key: `CLEAN-TEST-${timestamp}-003`,
      requester_id: 'EMP002',
      target_position_id: 'POS002',
      replacement_employee_id: 'EMP002',
      shift_date: '2026-05-19',
      shift_type: 'DAY',
      reason: '干净测试-撤回',
    }),
  });
  const j6 = await r6.json();
  const reqId2 = j6.data?.request_id;
  console.log('  创建成功, request_id:', reqId2);
  
  await fetch(BASE_URL + `/api/shift-requests/${reqId2}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor_id: 'EMP002' }),
  });
  
  const r7 = await fetch(BASE_URL + `/api/shift-requests/${reqId2}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor_id: 'EMP002', comment: '不换了' }),
  });
  const j7 = await r7.json();
  console.log('  撤回后状态:', j7.data?.status, '-', j7.data?.status === 'WITHDRAWN' ? '✓' : '');
  
  console.log('\n【测试G】修正测试');
  const r8 = await fetch(BASE_URL + '/api/shift-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotency_key: `CLEAN-TEST-${timestamp}-004`,
      requester_id: 'EMP002',
      target_position_id: 'POS001',
      replacement_employee_id: 'EMP006',
      shift_date: '2026-05-20',
      shift_type: 'DAY',
      reason: '误选吴八',
    }),
  });
  const j8 = await r8.json();
  const reqId3 = j8.data?.request_id;
  console.log('  创建时选中吴八（技能不足）');
  console.log('  校验结果:', j8.validation_summary?.passed === false ? '失败 ✓' : '');
  
  const r9 = await fetch(BASE_URL + `/api/shift-requests/${reqId3}/revise`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      actor_id: 'EMP002',
      replacement_employee_id: 'EMP002',
      reason: '修正为李四'
    }),
  });
  const j9 = await r9.json();
  console.log('  修正替班人为李四后:');
  console.log('  新替班人:', j9.data?.replacement_employee_id);
  console.log('  状态:', j9.data?.status, '-', j9.data?.status === 'DRAFT' ? '回到草稿 ✓' : '');
  console.log('  校验结果:', j9.validation_summary?.passed === true ? '通过 ✓' : '');
  
  console.log('\n===== 测试完成 =====\n');
}

test().catch(console.error);
