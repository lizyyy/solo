#!/usr/bin/env node
'use strict';

const { main } = require('../src/index.js');

main().catch((err) => {
  console.error('❌ 致命错误:', err.message);
  process.exit(1);
});
