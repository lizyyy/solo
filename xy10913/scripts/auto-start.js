const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.join(__dirname, '..');
const nodeModulesPath = path.join(projectRoot, 'node_modules');

function checkDependencies() {
  try {
    require.resolve(path.join(nodeModulesPath, 'express'));
    require.resolve(path.join(nodeModulesPath, 'sqlite3'));
    require.resolve(path.join(nodeModulesPath, 'uuid'));
    require.resolve(path.join(nodeModulesPath, 'body-parser'));
    require.resolve(path.join(nodeModulesPath, 'moment'));
    return true;
  } catch (e) {
    return false;
  }
}

function installDependencies() {
  console.log('📦 正在安装依赖...');
  const result = spawnSync('npm', ['install', '--no-audit', '--no-fund'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: true
  });
  
  if (result.status !== 0) {
    console.error('❌ 依赖安装失败');
    process.exit(1);
  }
  console.log('✅ 依赖安装完成\n');
}

function startServer() {
  console.log('🚀 启动租赁设备押金API服务...\n');
  const serverProcess = spawn('node', [path.join(projectRoot, 'src/app.js')], {
    cwd: projectRoot,
    stdio: 'inherit'
  });

  process.on('SIGINT', () => {
    console.log('\n收到中断信号，正在停止服务...');
    serverProcess.kill('SIGTERM');
    process.exit(0);
  });

  serverProcess.on('exit', (code) => {
    process.exit(code || 0);
  });
}

function main() {
  console.log('═'.repeat(50));
  console.log('  租赁设备押金 API - 自动启动');
  console.log('═'.repeat(50) + '\n');

  if (!checkDependencies()) {
    console.log('⚠️  检测到依赖未安装，将自动执行 npm install');
    installDependencies();
  } else {
    console.log('✅ 依赖已就绪\n');
  }

  startServer();
}

main();
