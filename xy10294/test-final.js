const BASE_URL = 'http://localhost:3002';

async function run() {
  const ts = Date.now();
  let passed = 0, failed = 0;
  
  const check = (name, cond) => {
    if (cond) { console.log(`  ✓ ${name}`); passed++; }
    else { console.log(`  ✗ ${name}`); failed++; }
  };

  console.log('\n========== 产线班组技能矩阵 API - 最终验收测试 ==========\n');
  
  console.log('【1. 基础数据查询（员工技能作为入口）】');
  const health = await fetch(BASE_URL + '/api/health').then(r => r.json());
  check('健康检查', health.success);
  
  const emps = await fetch(BASE_URL + '/api/employees').then(r => r.json());
  check('员工数量 = 6', emps.data?.length === 6);
  
  const skills = await fetch(BASE_URL + '/api/skills').then(r => r.json());
  check('技能数量 = 6', skills.data?.length === 6);
  
  console.log('\n【2. 岗位要求查询（关键校验）】');
  const posReq = await fetch(BASE_URL + '/api/position-requirements?position_id=POS001').then(r => r.json());
  const weldL3 = posReq.data?.some(r => r.skill_id === 'SK001' && r.required_level === 3 && r.is_mandatory === 1);
  check('主焊接岗要求焊接L3（必须）', weldL3);
  
  console.log('\n【3. 正常换班流程】');
  const create1 = await fetch(BASE_URL + '/api/shift-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotency_key: `FINAL-${ts}-001`,
      requester_id: 'EMP002',
      target_position_id: 'POS001',
      replacement_employee_id: 'EMP002',
      shift_date: '2026-05-18',
      shift_type: 'DAY',
      reason: '正常申请',
    }),
  }).then(r => r.json());
  check('创建成功 HTTP 201/200', create1.success);
  check('技能匹配通过', create1.validation_summary?.passed);
  
  const reqId = create1.data?.request_id;
  
  const submit = await fetch(BASE_URL + `/api/shift-requests/${reqId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor_id: 'EMP002' }),
  }).then(r => r.json());
  check('提交 -> PENDING_APPROVAL', submit.data?.status === 'PENDING_APPROVAL');
  
  const approve = await fetch(BASE_URL + `/api/shift-requests/${reqId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor_id: 'MGR001' }),
  }).then(r => r.json());
  check('审批 -> APPROVED', approve.data?.status === 'APPROVED');
  
  console.log('\n【4. 异常1：技能等级不足】');
  const badSkill = await fetch(BASE_URL + '/api/shift-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotency_key: `FINAL-${ts}-002`,
      requester_id: 'EMP006',
      target_position_id: 'POS001',
      replacement_employee_id: 'EMP006',
      shift_date: '2026-05-18',
      shift_type: 'DAY',
      reason: '技能不足',
    }),
  }).then(r => r.json());
  const sm = badSkill.validation_summary?.validations?.find(v => v.type === 'SKILL_MATCH');
  check('校验应失败', badSkill.validation_summary?.passed === false);
  check('SKILL_MATCH 失败', sm?.passed === false);
  
  console.log('\n【5. 异常2：缺勤检查】');
  const today = new Date().toISOString().split('T')[0];
  const absent = await fetch(BASE_URL + '/api/shift-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotency_key: `FINAL-${ts}-003`,
      requester_id: 'EMP006',
      target_position_id: 'POS003',
      replacement_employee_id: 'EMP006',
      shift_date: today,
      shift_type: 'DAY',
      reason: '今天请假了还来上班',
    }),
  }).then(r => r.json());
  const ab = absent.validation_summary?.validations?.find(v => v.type === 'ABSENCE_CHECK');
  check('缺勤检查失败', ab?.passed === false);
  
  console.log('\n【6. 异常3：缺字段】');
  const missing = await fetch(BASE_URL + '/api/shift-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requester_id: 'EMP001' }),
  }).then(r => r.json());
  check('success=false', missing.success === false);
  check('消息含"缺少必填字段"', missing.message?.includes('缺少必填字段'));
  
  console.log('\n【7. 幂等性（重复请求不写乱状态）】');
  const first = await fetch(BASE_URL + '/api/shift-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotency_key: `FINAL-IDEMP-${ts}`,
      requester_id: 'EMP002',
      target_position_id: 'POS003',
      replacement_employee_id: 'EMP002',
      shift_date: '2026-05-19',
      shift_type: 'DAY',
      reason: '第一次',
    }),
  }).then(r => r.json());
  const id1 = first.data?.request_id;
  
  const second = await fetch(BASE_URL + '/api/shift-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotency_key: `FINAL-IDEMP-${ts}`,
      requester_id: 'EMP002',
      target_position_id: 'POS003',
      replacement_employee_id: 'EMP002',
      shift_date: '2026-05-19',
      shift_type: 'DAY',
      reason: '第二次覆盖',
    }),
  }).then(r => r.json());
  check('from_cache=true', second.from_cache === true);
  check('request_id 相同', id1 === second.data?.request_id);
  check('reason 未被覆盖', second.data?.reason === '第一次');
  
  console.log('\n【8. 撤回】');
  const wr = await fetch(BASE_URL + '/api/shift-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotency_key: `FINAL-WD-${ts}`,
      requester_id: 'EMP002',
      target_position_id: 'POS002',
      replacement_employee_id: 'EMP002',
      shift_date: '2026-05-20',
      shift_type: 'DAY',
      reason: '撤回测试',
    }),
  }).then(r => r.json());
  const wReqId = wr.data?.request_id;
  
  await fetch(BASE_URL + `/api/shift-requests/${wReqId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor_id: 'EMP002' }),
  });
  
  const withdraw = await fetch(BASE_URL + `/api/shift-requests/${wReqId}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor_id: 'EMP002' }),
  }).then(r => r.json());
  check('撤回 -> WITHDRAWN', withdraw.data?.status === 'WITHDRAWN');
  
  console.log('\n【9. 修正（人工改错后修正）】');
  const rev1 = await fetch(BASE_URL + '/api/shift-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotency_key: `FINAL-REV-${ts}`,
      requester_id: 'EMP002',
      target_position_id: 'POS001',
      replacement_employee_id: 'EMP006',
      shift_date: '2026-05-21',
      shift_type: 'DAY',
      reason: '误选吴八',
    }),
  }).then(r => r.json());
  const revReqId = rev1.data?.request_id;
  check('修正前校验失败', rev1.validation_summary?.passed === false);
  
  const rev2 = await fetch(BASE_URL + `/api/shift-requests/${revReqId}/revise`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actor_id: 'EMP002', replacement_employee_id: 'EMP002' }),
  }).then(r => r.json());
  check('修正后替班人=EMP002', rev2.data?.replacement_employee_id === 'EMP002');
  check('修正后校验通过', rev2.validation_summary?.passed === true);
  check('回到 DRAFT 状态', rev2.data?.status === 'DRAFT');
  
  console.log('\n【10. 技能矩阵总览】');
  const matrix = await fetch(BASE_URL + '/api/summary/matrix').then(r => r.json());
  check('员工矩阵存在', Array.isArray(matrix.data?.employees));
  check('岗位矩阵存在', Array.isArray(matrix.data?.positions));
  check('员工数=6', matrix.data?.total_employees === 6);
  
  console.log('\n========== 测试结果 ==========');
  console.log(`通过: ${passed}, 失败: ${failed}`);
  console.log(failed === 0 ? '\n🎉 所有测试通过！' : '\n⚠️ 有测试失败');
}

run().catch(console.error);
