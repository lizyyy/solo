const BASE_URL = 'http://localhost:3002';

const post = async (url, body) => {
  const res = await fetch(BASE_URL + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
};

const get = async (url) => {
  const res = await fetch(BASE_URL + url);
  return res.json();
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runTests() {
  console.log('\n========== 产线班组技能矩阵 API 验收测试 ==========\n');
  
  console.log('【测试1】健康检查');
  const health = await get('/api/health');
  console.log('  success:', health.success, '-', health.status === 'ok' ? '通过 ✓' : '失败 ✗');
  
  console.log('\n【测试2】员工列表（员工技能入口）');
  const emps = await get('/api/employees');
  console.log('  员工数量:', emps.data?.length || 0, '-', emps.data?.length === 6 ? '通过 ✓' : '失败 ✗');
  
  console.log('\n【测试3】岗位要求（关键校验）- 主焊接岗');
  const posReq = await get('/api/position-requirements?position_id=POS001');
  const hasWeldL3 = posReq.data?.some(r => r.skill_id === 'SK001' && r.required_level === 3);
  console.log('  要求数量:', posReq.data?.length, '- 焊接L3要求存在:', hasWeldL3 ? '通过 ✓' : '失败 ✗');
  
  console.log('\n【测试4】正常场景：李四(EMP002)申请主焊接岗（技能匹配）');
  const req1 = await post('/api/shift-requests', {
    idempotency_key: 'TEST-REQ-001',
    requester_id: 'EMP002',
    original_position_id: 'POS002',
    target_position_id: 'POS001',
    original_employee_id: 'EMP001',
    replacement_employee_id: 'EMP002',
    shift_date: '2026-05-15',
    shift_type: 'DAY',
    reason: '张三家中有事',
  });
  const reqId1 = req1.data?.request_id;
  const passed1 = req1.validation_summary?.passed;
  console.log('  request_id:', reqId1);
  console.log('  校验通过:', passed1, '-', passed1 === true ? '通过 ✓' : '失败 ✗');
  
  if (reqId1) {
    console.log('\n【测试5】推进流程：提交申请 -> 审批通过');
    const submit = await post(`/api/shift-requests/${reqId1}/submit`, { actor_id: 'EMP002' });
    console.log('  提交后状态:', submit.data?.status, '-', submit.data?.status === 'PENDING_APPROVAL' ? '通过 ✓' : '失败 ✗');
    
    const approve = await post(`/api/shift-requests/${reqId1}/approve`, { actor_id: 'MGR001', comment: '同意' });
    console.log('  审批后状态:', approve.data?.status, '-', approve.data?.status === 'APPROVED' ? '通过 ✓' : '失败 ✗');
  }
  
  console.log('\n【测试6】异常场景：技能等级不足（吴八 EMP006 只有焊接L1）');
  const req2 = await post('/api/shift-requests', {
    idempotency_key: 'TEST-REQ-002',
    requester_id: 'EMP006',
    target_position_id: 'POS001',
    replacement_employee_id: 'EMP006',
    shift_date: '2026-05-15',
    shift_type: 'DAY',
    reason: '试试主焊接岗',
  });
  const passed2 = req2.validation_summary?.passed;
  const skillMatch = req2.validation_summary?.validations?.find(v => v.type === 'SKILL_MATCH');
  console.log('  校验通过:', passed2, '- 应为 false:', passed2 === false ? '通过 ✓' : '失败 ✗');
  console.log('  技能匹配失败:', skillMatch?.passed === false ? '通过 ✓' : '失败 ✗');
  
  console.log('\n【测试7】异常场景：缺勤检查（吴八 EMP006 今日已请假）');
  const req3 = await post('/api/shift-requests', {
    idempotency_key: 'TEST-REQ-003',
    requester_id: 'EMP006',
    target_position_id: 'POS003',
    replacement_employee_id: 'EMP006',
    shift_date: new Date().toISOString().split('T')[0],
    shift_type: 'DAY',
    reason: '今天上班',
  });
  const absenceCheck = req3.validation_summary?.validations?.find(v => v.type === 'ABSENCE_CHECK');
  console.log('  缺勤检查失败:', absenceCheck?.passed === false ? '通过 ✓' : '失败 ✗');
  
  console.log('\n【测试8】异常场景：缺字段报错');
  const req4 = await post('/api/shift-requests', { requester_id: 'EMP001' });
  console.log('  error:', req4.error, '-', req4.success === false && req4.message?.includes('缺少必填字段') ? '通过 ✓' : '失败 ✗');
  
  console.log('\n【测试9】幂等性：重复请求不写乱状态');
  const r1 = await post('/api/shift-requests', {
    idempotency_key: 'IDEMP-TEST-001',
    requester_id: 'EMP002',
    target_position_id: 'POS003',
    replacement_employee_id: 'EMP002',
    shift_date: '2026-05-16',
    shift_type: 'DAY',
    reason: '第一次请求',
  });
  const id1 = r1.data?.request_id;
  
  const r2 = await post('/api/shift-requests', {
    idempotency_key: 'IDEMP-TEST-001',
    requester_id: 'EMP002',
    target_position_id: 'POS003',
    replacement_employee_id: 'EMP002',
    shift_date: '2026-05-16',
    shift_type: 'DAY',
    reason: '第二次请求（应该被忽略）',
  });
  const id2 = r2.data?.request_id;
  
  console.log('  第一次 request_id:', id1);
  console.log('  第二次 request_id:', id2);
  console.log('  from_cache:', r2.from_cache);
  console.log('  request_id 相同:', id1 === id2 ? '通过 ✓' : '失败 ✗');
  console.log('  reason 未被覆盖（仍然是第一次请求的值）:', r2.data?.reason === '第一次请求' ? '通过 ✓' : '失败 ✗');
  
  console.log('\n【测试10】撤回和修正');
  const req5 = await post('/api/shift-requests', {
    idempotency_key: 'TEST-WITHDRAW-001',
    requester_id: 'EMP002',
    target_position_id: 'POS002',
    replacement_employee_id: 'EMP002',
    shift_date: '2026-05-20',
    shift_type: 'DAY',
    reason: '测试撤回',
  });
  const reqId5 = req5.data?.request_id;
  
  const submitted = await post(`/api/shift-requests/${reqId5}/submit`, { actor_id: 'EMP002' });
  console.log('  提交后状态:', submitted.data?.status);
  
  const withdrawn = await post(`/api/shift-requests/${reqId5}/withdraw`, { actor_id: 'EMP002', comment: '临时有事' });
  console.log('  撤回后状态:', withdrawn.data?.status, '-', withdrawn.data?.status === 'WITHDRAWN' ? '通过 ✓' : '失败 ✗');
  
  console.log('\n【测试11】技能矩阵总览查询');
  const matrix = await get('/api/summary/matrix');
  console.log('  员工数:', matrix.data?.total_employees);
  console.log('  技能数:', matrix.data?.total_skills);
  console.log('  岗位数:', matrix.data?.total_positions);
  console.log('  员工技能矩阵存在:', !!matrix.data?.employees ? '通过 ✓' : '失败 ✗');
  console.log('  岗位要求矩阵存在:', !!matrix.data?.positions ? '通过 ✓' : '失败 ✗');
  
  console.log('\n========== 验收测试完成 ==========\n');
}

runTests().catch(console.error);
