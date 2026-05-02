#!/usr/bin/env node

import('../src/cli.js').catch(err => {
  console.error('启动失败:', err.message);
  process.exit(1);
});
