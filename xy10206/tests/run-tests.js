const { spawn } = require('child_process');
const path = require('path');

let server = null;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const startServer = () => {
  return new Promise((resolve, reject) => {
    console.log('🚀 启动服务器...');
    
    server = spawn('node', ['server.js'], {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    server.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output);
      if (output.includes('舞台灯光预设回滚 API 已启动')) {
        resolve();
      }
    });

    server.stderr.on('data', (data) => {
      console.error('服务器错误:', data.toString());
    });

    server.on('error', (err) => {
      reject(err);
    });

    setTimeout(() => {
      resolve();
    }, 3000);
  });
};

const stopServer = () => {
  if (server) {
    console.log('\n🛑 停止服务器...');
    server.kill();
    server = null;
  }
};

const runTest = (testFile) => {
  return new Promise((resolve, reject) => {
    console.log(`\n🧪 运行测试: ${testFile}`);
    
    const test = spawn('node', [path.join(__dirname, testFile)], {
      stdio: ['inherit', 'inherit', 'inherit']
    });

    test.on('close', (code) => {
      resolve(code === 0);
    });

    test.on('error', (err) => {
      reject(err);
    });
  });
};

const runAllTests = async () => {
  try {
    await startServer();
    await sleep(1000);

    console.log('\n' + '='.repeat(70));
    console.log('  开始运行所有测试');
    console.log('='.repeat(70));

    const normalPassed = await runTest('normal-flow.js');
    await sleep(500);
    
    const abnormalPassed = await runTest('abnormal-cases.js');

    console.log('\n' + '='.repeat(70));
    console.log('  测试结果汇总');
    console.log('='.repeat(70));
    console.log(`  正常流程测试: ${normalPassed ? '✅ 通过' : '❌ 失败'}`);
    console.log(`  异常样例测试: ${abnormalPassed ? '✅ 通过' : '❌ 失败'}`);
    console.log('='.repeat(70));

    stopServer();

    if (normalPassed && abnormalPassed) {
      console.log('\n🎉 所有测试通过！');
      process.exit(0);
    } else {
      console.log('\n⚠️  部分测试失败');
      process.exit(1);
    }

  } catch (error) {
    console.error('测试运行失败:', error);
    stopServer();
    process.exit(1);
  }
};

process.on('SIGINT', () => {
  console.log('\n收到中断信号，清理中...');
  stopServer();
  process.exit(0);
});

runAllTests();
