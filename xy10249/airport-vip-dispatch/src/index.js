#!/usr/bin/env node

const { dispatchCommands } = require('./commands');
const { showHelp } = require('./utils/help');

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const subArgs = args.slice(1);

  if (!command || command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
  }

  if (command === '--version' || command === '-v') {
    const pkg = require('../package.json');
    console.log(`Airport VIP Dispatch CLI v${pkg.version}`);
    process.exit(0);
  }

  const handler = dispatchCommands[command];
  if (!handler) {
    console.error(`错误: 未知命令 '${command}'`);
    showHelp();
    process.exit(1);
  }

  handler(subArgs).catch((err) => {
    console.error('\n执行失败:', err.message);
    process.exit(1);
  });
}

main();
