#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');

const distPath = path.join(__dirname, '..', 'dist', 'index.js');

if (!fs.existsSync(distPath)) {
  console.error('错误：未找到编译后的文件，请先运行 npm run build');
  process.exit(1);
}

require(distPath);
