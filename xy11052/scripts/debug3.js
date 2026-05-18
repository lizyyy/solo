const http = require('http');

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } 
        catch (e) { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  };
}

async function test() {
  const API_BASE = 'http://localhost:3000/api/rectification';
  
  console.log('1. 导入数据...');
  const importRes = await request(`${API_BASE}/import`, {
    method: 'POST',
    body: { items: [{
      inspection_id: 'INSPECT20240115001',
      store_id: 'STORE001',
      store_name: '全家便利店(中关村店)',
      problem_category: '环境卫生',
      problem_type: '地面清洁',
      problem_description: '测试问题',
      requirement: '测试整改要求',
      deadline: '2024-01-20',
      responsible_person: '店长张三',
      inspector_id: 'INS001',
      inspector_name: '王督导',
      inspection_date: '2024-01-15'
    }] }
  });
  const itemId = importRes.data.data.success[0].itemId;
  console.log('itemId:', itemId);

  console.log('\n2. 当前状态是pending，尝试直接到approved...');
  const skipRes = await request(`${API_BASE}/update-status`, {
    method: 'POST',
    body: { itemId, newStatus: 'approved', operatorId: 'SUP001', operatorName: '李主管', remark: '越级测试' }
  });
  console.log('statusCode:', skipRes.status);
  console.log('success:', skipRes.data.success);
  console.log('error:', skipRes.data.error);

  console.log('\n3. 再试 pending -> rectifying (应该成功)...');
  const res1 = await request(`${API_BASE}/update-status`, {
    method: 'POST',
    body: { itemId, newStatus: 'rectifying', operatorId: 'SUP001', operatorName: '李主管', remark: '测试' }
  });
  console.log('结果:', res1.data.success, res1.data.message || res1.data.error);
}

test().catch(console.error);