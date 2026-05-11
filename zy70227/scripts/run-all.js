const { spawn } = require('child_process');
const path = require('path');

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      ...options,
      stdio: 'inherit'
    });
    
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}

async function waitForServer(timeout = 30000) {
  const http = require('http');
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.request(
          { hostname: 'localhost', port: 3000, path: '/api/health', method: 'GET' },
          (res) => {
            if (res.statusCode === 200) {
              resolve();
            } else {
              reject(new Error(`Status ${res.statusCode}`));
            }
          }
        );
        req.on('error', reject);
        req.setTimeout(1000, () => reject(new Error('Timeout')));
        req.end();
      });
      return true;
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  return false;
}

async function main() {
  console.log('='.repeat(60));
  console.log('会议同传频道冲突 API - 完整测试套件');
  console.log('='.repeat(60));
  console.log('');

  console.log('步骤 1: 检查依赖...');
  try {
    require('express');
    console.log('✅ 依赖已安装');
  } catch (e) {
    console.log('📦 正在安装依赖...');
    await runCommand('npm', ['install']);
    console.log('✅ 依赖安装完成');
  }

  console.log('');
  console.log('步骤 2: 启动服务器...');
  const serverProc = spawn('node', ['src/index.js'], {
    cwd: __dirname + '/..',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let serverOutput = '';
  serverProc.stdout.on('data', (data) => { serverOutput += data.toString(); });
  serverProc.stderr.on('data', (data) => { serverOutput += data.toString(); });

  console.log('⌛ 等待服务器启动...');
  const serverReady = await waitForServer(30000);
  
  if (!serverReady) {
    console.log('❌ 服务器启动失败');
    console.log('服务器输出:', serverOutput);
    serverProc.kill();
    process.exit(1);
  }
  console.log('✅ 服务器已启动');

  console.log('');
  console.log('步骤 3: 运行完整演示...');
  console.log('-'.repeat(40));
  
  try {
    await runCommand('node', [path.join(__dirname, 'demo.js')]);
    console.log('');
    console.log('✅ 演示完成');
  } catch (e) {
    console.log('❌ 演示失败:', e.message);
    serverProc.kill();
    process.exit(1);
  }

  console.log('');
  console.log('步骤 4: 运行边界情况测试...');
  console.log('-'.repeat(40));

  try {
    await runCommand('node', [path.join(__dirname, 'edge-cases.js')]);
    console.log('');
    console.log('✅ 边界情况测试完成');
  } catch (e) {
    console.log('❌ 边界情况测试失败:', e.message);
    serverProc.kill();
    process.exit(1);
  }

  console.log('');
  console.log('步骤 5: 停止服务器...');
  serverProc.kill();
  console.log('✅ 服务器已停止');

  console.log('');
  console.log('='.repeat(60));
  console.log('🎉 所有测试通过！');
  console.log('='.repeat(60));
}

main().catch(console.error);
