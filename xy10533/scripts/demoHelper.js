const http = require('http');

const makeRequest = (options, data = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve(responseData);
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

const PORT = process.env.PORT || 3002;

const api = {
  post: (path, data, operator = 'admin') => {
    return makeRequest({
      method: 'POST',
      hostname: 'localhost',
      port: PORT,
      path: `/api${path}`,
      headers: {
        'Content-Type': 'application/json',
        'x-operator': operator
      }
    }, data);
  },
  
  get: (path, operator = 'admin') => {
    return makeRequest({
      method: 'GET',
      hostname: 'localhost',
      port: PORT,
      path: `/api${path}`,
      headers: {
        'x-operator': operator
      }
    });
  }
};

const log = {
  title: (msg) => {
    console.log('\n' + '='.repeat(60));
    console.log(msg);
    console.log('='.repeat(60));
  },
  
  step: (num, msg) => {
    console.log(`\n【步骤 ${num}】${msg}`);
    console.log('-'.repeat(60));
  },
  
  success: (msg, data = null) => {
    console.log(`✓ ${msg}`);
    if (data) {
      console.log('  返回数据:', JSON.stringify(data, null, 2).substring(0, 500));
    }
  },
  
  error: (msg) => {
    console.log(`✗ 错误: ${msg}`);
  },
  
  info: (msg) => {
    console.log(`ℹ ${msg}`);
  },
  
  result: (msg) => {
    console.log('\n' + '-'.repeat(60));
    console.log(`  结果: ${msg}`);
    console.log('-'.repeat(60));
  },
  
  section: (msg) => {
    console.log('\n  [' + msg + ']');
  }
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  api,
  log,
  delay
};
