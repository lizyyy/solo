const http = require('http');

const BASE_URL = 'http://localhost:3000/api';

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      method,
      path,
      hostname: 'localhost',
      port: 3000,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };

    const req = http.request(options, (res) => {
      let rawData = '';
      res.on('data', (chunk) => { rawData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
          }
        } catch (e) {
          resolve(rawData);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function seed() {
  console.log('开始初始化样例数据...\n');

  const employees = [
    { name: '张三', department: '安全部' },
    { name: '李四', department: '安全部' },
    { name: '王五', department: '销售部' },
    { name: '赵六', department: '销售部' },
    { name: '钱七', department: '人力资源部' }
  ];

  console.log('创建员工...');
  const createdEmployees = [];
  for (const emp of employees) {
    const result = await makeRequest('POST', '/api/employees', emp);
    createdEmployees.push(result);
    console.log(`  - ${result.name} (${result.department}): ${result.id}`);
  }

  console.log('\n创建培训场次...');
  
  const safetySession = await makeRequest('POST', '/api/sessions', {
    name: '2026年度安全生产合规培训',
    type: 'safety',
    start_time: '2026-05-15T09:00:00',
    end_time: '2026-05-15T17:00:00',
    grace_minutes: 15,
    pass_score: 70,
    location: '总部1号会议室'
  });
  console.log(`  - 安全培训: ${safetySession.id}`);

  const salesSession = await makeRequest('POST', '/api/sessions', {
    name: '2026年Q2销售合规培训',
    type: 'sales',
    start_time: '2026-05-20T10:00:00',
    end_time: '2026-05-20T16:00:00',
    grace_minutes: 10,
    pass_score: 60,
    location: '销售中心培训室'
  });
  console.log(`  - 销售培训: ${salesSession.id}`);

  console.log('\n安全培训 - 报名员工...');
  await makeRequest('POST', '/api/registrations', {
    session_id: safetySession.id,
    employee_id: createdEmployees[0].id
  });
  console.log(`  - 张三已报名`);
  
  await makeRequest('POST', '/api/registrations', {
    session_id: safetySession.id,
    employee_id: createdEmployees[1].id
  });
  console.log(`  - 李四已报名`);

  console.log('\n销售培训 - 报名员工...');
  await makeRequest('POST', '/api/registrations', {
    session_id: salesSession.id,
    employee_id: createdEmployees[2].id
  });
  console.log(`  - 王五已报名`);
  
  await makeRequest('POST', '/api/registrations', {
    session_id: salesSession.id,
    employee_id: createdEmployees[3].id
  });
  console.log(`  - 赵六已报名`);
  
  await makeRequest('POST', '/api/registrations', {
    session_id: salesSession.id,
    employee_id: createdEmployees[4].id
  });
  console.log(`  - 钱七已报名`);

  console.log('\n样例数据初始化完成！');
  console.log('\n员工列表:');
  createdEmployees.forEach(e => {
    console.log(`  ${e.name}: ${e.id}`);
  });
  console.log('\n培训场次:');
  console.log(`  安全培训: ${safetySession.id}`);
  console.log(`  销售培训: ${salesSession.id}`);

  return {
    employees: createdEmployees,
    safetySession,
    salesSession
  };
}

seed().catch(console.error);
