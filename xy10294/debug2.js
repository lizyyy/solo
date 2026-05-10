const BASE_URL = 'http://localhost:3002';

async function debug() {
  const timestamp = Date.now();
  console.log('timestamp:', timestamp);
  
  const r1 = await fetch(BASE_URL + '/api/shift-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotency_key: `DBG-${timestamp}-001`,
      requester_id: 'EMP002',
      target_position_id: 'POS001',
      replacement_employee_id: 'EMP002',
      shift_date: '2026-05-18',
      shift_type: 'DAY',
      reason: 'debug',
    }),
  });
  console.log('HTTP Status:', r1.status);
  const text = await r1.text();
  console.log('Response:', text);
  
  try {
    const json = JSON.parse(text);
    console.log('Parsed JSON:', JSON.stringify(json, null, 2));
  } catch(e) {
    console.log('Not JSON:', e.message);
  }
}

debug().catch(console.error);
