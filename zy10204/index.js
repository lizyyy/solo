#!/usr/bin/env node

const { createCli } = require('./src/cli/cli');

async function main() {
  const program = createCli();
  await program.parseAsync(process.argv);
}

main().catch(err => {
  console.error('错误:', err.message);
  process.exit(1);
});
