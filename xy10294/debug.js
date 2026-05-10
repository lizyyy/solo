const BASE_URL = 'http://localhost:3002';

async function debug() {
  console.log('=== 第一次创建请求（有 idempotency_key TEST-REQ-001）===');
  const r1 = await fetch(BASE_URL + '/api/shift-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotency_key: 'TEST-REQ-001',
      requester_id: 'EMP002',
      original_position_id: 'POS002',
      target_position_id: 'POS001',
      original_employee_id: 'EMP001',
      replacement_employee_id: 'EMP002',
      shift_date: '2026-05-15',
      shift_type: 'DAY',
      reason: '张三家中有事',
    }),
  });
  const j1 = await r1.json();
  console.log('HTTP Status:', r1.status);
  console.log('Response:', JSON.stringify(j1, null, 2));

  console.log('\n=== 再次请求同一个 idempotency_key ===');
  const r2 = await fetch(BASE_URL + '/api/shift-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotency_key: 'TEST-REQ-001',
      requester_id: 'EMP002',
      target_position_id: 'POS001',
      replacement_employee_id: 'EMP002',
      shift_date: '2026-05-15',
      shift_type: 'DAY',
      reason: '第二次',
    }),
  });
  const j2 = await r2.json();
  console.log('HTTP Status:', r2.status);
  console.log('Response:', JSON.stringify(j2, null, 2));
}

debug().catch(console.error);
