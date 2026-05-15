const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

async function seedDemoData() {
  console.log('Seeding demo data...');

  const envId = uuidv4();
  await db.run(
    'INSERT INTO environments (id, name, variables) VALUES (?, ?, ?)',
    [envId, '生产环境', JSON.stringify([
      { key: 'baseUrl', value: 'https://httpbin.org' },
      { key: 'apiKey', value: 'demo-key-12345' }
    ])]
  );

  const collectionId = uuidv4();
  await db.run(
    'INSERT INTO collections (id, name, description, environment_id, status) VALUES (?, ?, ?, ?, ?)',
    [collectionId, '核心接口冒烟测试', '每日上线后需要执行的核心接口验证', envId, 'active']
  );

  const steps = [
    {
      name: 'GET - 健康检查',
      method: 'GET',
      url: 'https://httpbin.org/status/200',
      assertions: JSON.stringify([
        { type: 'status_code', expected: 200 }
      ])
    },
    {
      name: 'GET - 获取用户信息',
      method: 'GET',
      url: 'https://httpbin.org/get?user=demo',
      assertions: JSON.stringify([
        { type: 'status_code', expected: 200 },
        { type: 'response_time', expected: 3000 }
      ])
    },
    {
      name: 'POST - 创建订单',
      method: 'POST',
      url: 'https://httpbin.org/post',
      body: JSON.stringify({ product: 'test', quantity: 1 }),
      assertions: JSON.stringify([
        { type: 'status_code', expected: 200 }
      ])
    },
    {
      name: 'GET - 延迟响应测试',
      method: 'GET',
      url: 'https://httpbin.org/delay/1',
      assertions: JSON.stringify([
        { type: 'status_code', expected: 200 },
        { type: 'response_time', expected: 5000 }
      ])
    },
    {
      name: 'GET - 404错误测试',
      method: 'GET',
      url: 'https://httpbin.org/status/404',
      assertions: JSON.stringify([
        { type: 'status_code', expected: 404 }
      ])
    }
  ];

  for (let i = 0; i < steps.length; i++) {
    const stepId = uuidv4();
    const step = steps[i];
    await db.run(
      `INSERT INTO steps (id, collection_id, name, method, url, headers, body, assertions, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [stepId, collectionId, step.name, step.method, step.url, '[]', step.body || '{}', step.assertions, i]
    );
  }

  const statuses = ['completed', 'completed', 'failed', 'completed', 'failed'];
  for (let i = 0; i < 5; i++) {
    const batchId = uuidv4();
    const status = statuses[i];
    const passedSteps = status === 'completed' ? 5 : Math.floor(Math.random() * 3) + 2;
    const failedSteps = 5 - passedSteps;

    const pastTime = new Date(Date.now() - (5 - i) * 3600000).toISOString();

    await db.run(
      `INSERT INTO batches (id, collection_id, status, total_steps, passed_steps, failed_steps, started_at, completed_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [batchId, collectionId, status, 5, passedSteps, failedSteps, pastTime, pastTime, pastTime]
    );

    const stepRecords = await db.all('SELECT id FROM steps WHERE collection_id = ? ORDER BY order_index ASC', [collectionId]);

    for (let j = 0; j < stepRecords.length; j++) {
      const resultId = uuidv4();
      const stepStatus = j < passedSteps ? 'passed' : 'failed';
      const responseTime = Math.floor(Math.random() * 1000) + 200;

      await db.run(
        `INSERT INTO execution_results (id, batch_id, step_id, status, request_data, response_data, response_status, response_time, assertions_result, error_message, executed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          resultId,
          batchId,
          stepRecords[j].id,
          stepStatus,
          JSON.stringify({ method: 'GET', url: steps[j].url }),
          JSON.stringify({ success: true }),
          200,
          responseTime,
          JSON.stringify([{ passed: stepStatus === 'passed', message: 'OK' }]),
          stepStatus === 'failed' ? 'Assertion failed' : null,
          pastTime
        ]
      );
    }
  }

  console.log('Demo data seeded successfully!');
}

db.init().then(() => {
  seedDemoData().then(() => {
    console.log('Done!');
    process.exit(0);
  }).catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
});
