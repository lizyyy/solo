const http = require('http');

const BASE_URL = 'http://localhost:3000';

const makeRequest = (method, path, data = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Body:', body);
        try {
          const parsed = body ? JSON.parse(body) : {};
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, data: parsed });
          } else {
            reject({ status: res.statusCode, error: parsed });
          }
        } catch (e) {
          reject({ status: res.statusCode, error: { message: body } });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
};

const runTest = async () => {
  const contractData = {
    contract_no: 'TEST-001',
    parties: {
      transferor: '张三',
      transferee: '李四'
    },
    start_date: '2024-01-01',
    end_date: '2026-01-01',
    land_plots: [
      { plot_no: 'P1', area: 50.5, location: '东村一组' },
      { plot_no: 'P2', area: 30.0, location: '东村二组' }
    ],
    rent_plans: [
      { period_start: '2024-01-01', period_end: '2025-01-01', amount: 10100 },
      { period_start: '2025-01-01', period_end: '2026-01-01', amount: 10100 }
    ]
  };

  try {
    console.log('Creating contract...');
    const result = await makeRequest('POST', '/contracts', contractData);
    console.log('\nSuccess!');
    console.log('Contract ID:', result.data.id);
  } catch (e) {
    console.log('\nError:', e);
  }
};

runTest().catch(console.error);
