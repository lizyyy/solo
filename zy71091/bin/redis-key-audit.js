#!/usr/bin/env node

const { main } = require('../src/index.js');

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
