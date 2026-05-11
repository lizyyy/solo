const http = require('http');
const { spawn } = require('child_process');

let serverProcess = null;

async function checkServerReady(url, timeout = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`Status code: ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.setTimeout(2000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });
      return true;
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error('Server failed to start within timeout');
}

async function startServer() {
  console.log('启动服务器...');
  
  serverProcess = spawn('node', ['src/server.js'], {
    cwd: process.cwd(),
    stdio: 'inherit'
  });

  serverProcess.on('error', (err) => {
    console.error('服务器启动失败:', err);
  });

  serverProcess.on('exit', (code, signal) => {
    console.log(`服务器已退出，代码: ${code}，信号: ${signal}`);
  });

  await checkServerReady('http://localhost:3000/health');
  console.log('服务器已就绪！\n');
  
  return serverProcess;
}

async function runTests() {
  console.log('\n' + '='.repeat(70));
  console.log('开始执行测试套件');
  console.log('='.repeat(70) + '\n');

  let results = {
    successful: null,
    review: null
  };

  try {
    console.log('\n' + '-'.repeat(70));
    console.log('测试 1: 顺利样例');
    console.log('-'.repeat(70) + '\n');
    
    const runSuccessfulScenario = require('./successfulScenario');
    results.successful = await runSuccessfulScenario();
    console.log('✓ 顺利样例测试通过\n');
  } catch (error) {
    console.error('✗ 顺利样例测试失败:', error.message || error);
    results.successful = { error: error.message || error };
  }

  try {
    console.log('\n' + '-'.repeat(70));
    console.log('测试 2: 复核样例');
    console.log('-'.repeat(70) + '\n');
    
    const runReviewScenario = require('./reviewScenario');
    results.review = await runReviewScenario();
    console.log('✓ 复核样例测试通过\n');
  } catch (error) {
    console.error('✗ 复核样例测试失败:', error.message || error);
    results.review = { error: error.message || error };
  }

  return results;
}

function stopServer() {
  if (serverProcess) {
    console.log('\n停止服务器...');
    serverProcess.kill();
    serverProcess = null;
    console.log('服务器已停止');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const shouldStartServer = args.includes('--start-server') || args.includes('-s');

  try {
    if (shouldStartServer) {
      await startServer();
      try {
        const results = await runTests();
        
        console.log('\n' + '='.repeat(70));
        console.log('测试执行摘要');
        console.log('='.repeat(70));
        
        const successfulTest = results.successful && !results.successful.error;
        const reviewTest = results.review && !results.review.error;
        
        console.log(`\n顺利样例: ${successfulTest ? '✓ 通过' : '✗ 失败'}`);
        console.log(`复核样例: ${reviewTest ? '✓ 通过' : '✗ 失败'}`);
        
        console.log(`\n总体: ${successfulTest && reviewTest ? '✓ 全部通过' : '✗ 部分失败'}`);
        console.log('='.repeat(70) + '\n');
        
        process.exit(successfulTest && reviewTest ? 0 : 1);
      } finally {
        stopServer();
      }
    } else {
      console.log('等待服务器连接 (默认 http://localhost:3000)...');
      await checkServerReady('http://localhost:3000/health');
      console.log('已连接到服务器！\n');
      
      const results = await runTests();
      
      console.log('\n' + '='.repeat(70));
      console.log('测试执行摘要');
      console.log('='.repeat(70));
      
      const successfulTest = results.successful && !results.successful.error;
      const reviewTest = results.review && !results.review.error;
      
      console.log(`\n顺利样例: ${successfulTest ? '✓ 通过' : '✗ 失败'}`);
      console.log(`复核样例: ${reviewTest ? '✓ 通过' : '✗ 失败'}`);
      
      console.log(`\n总体: ${successfulTest && reviewTest ? '✓ 全部通过' : '✗ 部分失败'}`);
      console.log('='.repeat(70) + '\n');
      
      process.exit(successfulTest && reviewTest ? 0 : 1);
    }
  } catch (error) {
    console.error('\n测试执行出错:', error.message);
    console.error(error.stack);
    stopServer();
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\n接收到中断信号，正在清理...');
  stopServer();
  process.exit(0);
});

main();
