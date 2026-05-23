#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const distPath = path.join(__dirname, '..', 'dist', 'index.js');
const srcPath = path.join(__dirname, '..', 'src', 'index.ts');

if (fs.existsSync(distPath)) {
  require(distPath);
} else {
  console.log('⚠️  未找到构建产物，正在自动构建...');
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit'
  });
  
  if (result.status === 0 && fs.existsSync(distPath)) {
    console.log('✅ 构建完成，开始执行...\n');
    require(distPath);
  } else {
    console.error('❌ 构建失败，请手动运行: npm run build');
    process.exit(1);
  }
}
