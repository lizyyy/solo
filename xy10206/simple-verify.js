const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

let server = null;
let actualPort = null;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const extractPort = (output) => {
  const match = output.match(/监听地址:\s*127\.0\.0\.1:(\d+)/);
  if (match) return parseInt(match[1]);
  const match2 = output.match(/服务地址:\s*http:\/\/127\.0\.0\.1:(\d+)/);
  if (match2) return parseInt(match2[1]);
  return null;
};

const request = (method, path, body = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: actualPort,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const body = data ? JSON.parse(data) : {};
          resolve({ statusCode: res.statusCode, body });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const startServer = () => {
  return new Promise((resolve, reject) => {
    console.log('🚀 启动舞台灯光预设回滚 API 服务...');
    
    server = spawn('node', ['server.js'], {
      cwd: path.join(__dirname),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let outputBuffer = '';
    
    server.stdout.on('data', (data) => {
      const output = data.toString();
      outputBuffer += output;
      process.stdout.write(output);
      
      const port = extractPort(output);
      if (port) {
        actualPort = port;
      }
      
      if (output.includes('舞台灯光预设回滚 API 已启动') && actualPort) {
        resolve();
      }
    });

    server.stderr.on('data', (data) => {
      const output = data.toString();
      outputBuffer += output;
      process.stderr.write(output);
    });

    server.on('error', (err) => {
      reject(err);
    });

    setTimeout(() => {
      if (actualPort) {
        resolve();
      } else {
        reject(new Error('服务器启动超时，输出:\n' + outputBuffer));
      }
    }, 15000);
  });
};

const stopServer = () => {
  if (server) {
    console.log('\n🛑 停止服务器...');
    server.kill();
    server = null;
  }
};

const verify = async () => {
  try {
    await startServer();
    await sleep(1000);
    
    console.log('\n' + '='.repeat(70));
    console.log('  开始验证 API 功能');
    console.log('='.repeat(70));
    
    console.log('\n[1/5] 验证健康检查接口...');
    const healthRes = await request('GET', '/health');
    console.log('    状态码:', healthRes.statusCode);
    console.log('    响应:', JSON.stringify(healthRes.body));
    if (healthRes.statusCode !== 200 || !healthRes.body.success) {
      throw new Error('健康检查失败');
    }
    console.log('    ✓ 通过');
    
    console.log('\n[2/5] 验证场景查询接口...');
    const sceneRes = await request('GET', '/api/scenes/scene-001');
    console.log('    状态码:', sceneRes.statusCode);
    console.log('    场景名:', sceneRes.body.data?.name);
    console.log('    激活版本:', sceneRes.body.data?.activePreset?.version);
    if (sceneRes.statusCode !== 200 || !sceneRes.body.success) {
      throw new Error('场景查询失败');
    }
    console.log('    ✓ 通过');
    
    console.log('\n[3/5] 验证预设列表接口...');
    const presetsRes = await request('GET', '/api/presets?sceneId=scene-001');
    console.log('    状态码:', presetsRes.statusCode);
    console.log('    预设数量:', presetsRes.body.data?.length);
    if (presetsRes.statusCode !== 200 || !presetsRes.body.success) {
      throw new Error('预设列表查询失败');
    }
    console.log('    ✓ 通过');
    
    console.log('\n[4/5] 验证创建新版本预设...');
    const newPresetRes = await request('POST', '/api/presets', {
      sceneId: 'scene-001',
      version: 'v9.9.9-verify',
      name: '验证测试版本',
      description: '自动化验证创建',
      lightPositions: {
        '主光-左': { intensity: 75, color: '#7C3AED', pan: 0, tilt: -15 }
      },
      createdBy: '自动化测试'
    });
    console.log('    状态码:', newPresetRes.statusCode);
    console.log('    版本:', newPresetRes.body.data?.version);
    console.log('    状态:', newPresetRes.body.data?.status);
    if (newPresetRes.statusCode !== 201 || !newPresetRes.body.success) {
      throw new Error('创建预设失败: ' + JSON.stringify(newPresetRes.body));
    }
    console.log('    ✓ 通过');
    
    console.log('\n[5/5] 验证场景锁定功能...');
    const lockRes = await request('POST', '/api/scenes/lock', {
      sceneId: 'scene-001',
      lockedBy: '自动化测试',
      reason: '验证锁定功能'
    });
    console.log('    状态码:', lockRes.statusCode);
    console.log('    锁定状态:', lockRes.body.data?.status);
    if (lockRes.statusCode !== 200 || !lockRes.body.success) {
      throw new Error('场景锁定失败');
    }
    console.log('    ✓ 通过');
    
    console.log('\n' + '='.repeat(70));
    console.log('  ✅ 所有验证通过！');
    console.log('='.repeat(70));
    console.log('\n  服务端口:', actualPort);
    console.log('  健康检查:', `http://127.0.0.1:${actualPort}/health`);
    console.log('  业务场景: 已完整验证创建、查询、锁定等核心功能');
    console.log('');
    
    stopServer();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ 验证失败:', error.message);
    console.error(error.stack);
    stopServer();
    process.exit(1);
  }
};

process.on('SIGINT', () => {
  console.log('\n收到中断信号，清理中...');
  stopServer();
  process.exit(0);
});

verify();
