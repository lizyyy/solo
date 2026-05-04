const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:8080';

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', reject);
    
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function httpGet(path) {
  return makeRequest({
    hostname: 'localhost',
    port: 8080,
    path: path,
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
}

function httpPost(path, body = null, headers = {}) {
  const defaultHeaders = { 'Content-Type': 'application/json' };
  const allHeaders = { ...defaultHeaders, ...headers };
  
  if (body && allHeaders['Content-Type'] === 'application/json') {
    body = JSON.stringify(body);
    allHeaders['Content-Length'] = Buffer.byteLength(body);
  }
  
  return makeRequest({
    hostname: 'localhost',
    port: 8080,
    path: path,
    method: 'POST',
    headers: allHeaders
  }, body);
}

async function uploadFile(endpoint, filePath) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substr(2);
    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    
    const preamble = `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
      'Content-Type: application/octet-stream\r\n' +
      '\r\n';
    
    const epilogue = `\r\n--${boundary}--\r\n`;
    
    const totalLength = Buffer.byteLength(preamble) + fileContent.length + Buffer.byteLength(epilogue);
    
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': totalLength
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: data
          });
        }
      });
    });
    
    req.on('error', reject);
    
    req.write(preamble);
    req.write(fileContent);
    req.write(epilogue);
    req.end();
  });
}

async function runTests() {
  console.log('========================================');
  console.log('疫苗接种点冷链设备核对系统 API 测试');
  console.log('========================================\n');

  try {
    console.log('1. 检查服务健康状态...');
    const healthRes = await httpGet('/health');
    console.log('   状态:', healthRes.statusCode);
    console.log('   响应:', healthRes.data, '\n');

    const examplesDir = path.join(__dirname, 'examples');

    console.log('2. 导入箱体数据...');
    const containersRes = await uploadFile('/api/import/containers', path.join(examplesDir, 'containers.csv'));
    console.log('   状态:', containersRes.statusCode);
    console.log('   响应:', JSON.stringify(containersRes.data, null, 2), '\n');

    console.log('3. 导入冰排数据...');
    const icePacksRes = await uploadFile('/api/import/ice-packs', path.join(examplesDir, 'ice-packs.csv'));
    console.log('   状态:', icePacksRes.statusCode);
    console.log('   响应:', JSON.stringify(icePacksRes.data, null, 2), '\n');

    console.log('4. 导入温度记录仪数据...');
    const loggersRes = await uploadFile('/api/import/loggers', path.join(examplesDir, 'loggers.csv'));
    console.log('   状态:', loggersRes.statusCode);
    console.log('   响应:', JSON.stringify(loggersRes.data, null, 2), '\n');

    console.log('5. 导入预约批次数据...');
    const batchesRes = await uploadFile('/api/import/batches', path.join(examplesDir, 'batches.csv'));
    console.log('   状态:', batchesRes.statusCode);
    console.log('   响应:', JSON.stringify(batchesRes.data, null, 2), '\n');

    console.log('6. 导入温度记录数据...');
    const tempRes = await uploadFile('/api/import/temperature', path.join(examplesDir, 'temperature.csv'));
    console.log('   状态:', tempRes.statusCode);
    console.log('   响应:', JSON.stringify(tempRes.data, null, 2), '\n');

    console.log('7. 导入设备校准数据...');
    const calibrationData = JSON.parse(fs.readFileSync(path.join(examplesDir, 'calibration.json'), 'utf8'));
    const calibrationRes = await httpPost('/api/import/calibration', calibrationData);
    console.log('   状态:', calibrationRes.statusCode);
    console.log('   响应:', calibrationRes.data, '\n');

    console.log('8. 计算风险评估...');
    const riskCalcRes = await httpPost('/api/risks/calculate');
    console.log('   状态:', riskCalcRes.statusCode);
    console.log('   响应:', riskCalcRes.data, '\n');

    console.log('9. 查询风险清单...');
    const risksRes = await httpGet('/api/risks');
    console.log('   状态:', risksRes.statusCode);
    console.log('   响应:', risksRes.data, '\n');

    const risksData = JSON.parse(risksRes.data);
    if (risksData.data && risksData.data.length > 0) {
      const firstRiskId = risksData.data[0].id;
      
      console.log('10. 护士长改判复核意见 (风险ID:', firstRiskId, ')...');
      const reviewRes = await httpPost(`/api/risks/${firstRiskId}/review`, {
        review_status: 'cleared',
        review_comment: '经核实，该风险已解决，温度已恢复正常范围',
        reviewer_name: '李护士长'
      });
      console.log('   状态:', reviewRes.statusCode);
      console.log('   响应:', reviewRes.data, '\n');
    }

    console.log('11. 查询系统状态...');
    const statusRes = await httpGet('/api/status');
    console.log('   状态:', statusRes.statusCode);
    console.log('   响应:', statusRes.data, '\n');

    console.log('12. 重新查询风险清单...');
    const risksRes2 = await httpGet('/api/risks');
    console.log('   状态:', risksRes2.statusCode);
    console.log('   响应:', risksRes2.data, '\n');

    console.log('========================================');
    console.log('API 测试完成！');
    console.log('========================================');
    console.log('\n下一步操作:');
    console.log('- 访问 GET /api/export/markdown 下载放行单');
    console.log('- 访问 GET /api/export/json 下载审计包');

  } catch (error) {
    console.error('测试失败:', error.message);
    console.error('请确保服务器已启动: npm start');
    process.exit(1);
  }
}

runTests();
