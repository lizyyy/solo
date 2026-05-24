#!/usr/bin/env node

const { CLI } = require('../src/cli');
const { exitCodes } = require('../src/constants/exit-codes');

async function main() {
  try {
    const cli = new CLI();
    const result = await cli.run(process.argv);
    process.exit(result.exitCode);
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(exitCodes.FATAL_ERROR);
  }
}

main();
