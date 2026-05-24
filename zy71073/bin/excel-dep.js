#!/usr/bin/env node

const { CLI } = require('../src/cli/index');
const exitCodes = require('../src/core/exit-codes');

async function main() {
  const cli = new CLI();
  try {
    await cli.run(process.argv);
  } catch (error) {
    console.error('\n错误:', error.message);
    process.exit(exitCodes.RUNTIME_ERROR);
  }
}

main();
