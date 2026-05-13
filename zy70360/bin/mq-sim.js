#!/usr/bin/env node

const { main } = require('../src/index');

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
