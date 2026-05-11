#!/usr/bin/env node

const commands = require('./commands');

function parseArgs(argv) {
  const args = { _: [] };
  
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    
    if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      if (eqIndex > 0) {
        const key = arg.substring(2, eqIndex);
        const value = arg.substring(eqIndex + 1);
        args[key] = value;
        args[`--${key}`] = value;
      } else {
        const key = arg.substring(2);
        const nextArg = argv[i + 1];
        if (nextArg && !nextArg.startsWith('-')) {
          args[key] = nextArg;
          args[`--${key}`] = nextArg;
          i++;
        } else {
          args[key] = true;
          args[`--${key}`] = true;
        }
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.substring(1);
      const nextArg = argv[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        args[key] = nextArg;
        i++;
      } else {
        args[key] = true;
      }
    } else {
      args._.push(arg);
    }
  }
  
  return args;
}

function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const command = args._[0];
  
  switch (command) {
    case 'import':
      commands.cmdImport(args);
      break;
    case 'check':
      commands.cmdCheck(args);
      break;
    case 'confirm':
      commands.cmdConfirm(args);
      break;
    case 'list':
      commands.cmdList(args);
      break;
    case 'history':
      commands.cmdHistory(args);
      break;
    case 'export':
      commands.cmdExport(args);
      break;
    case 'clear':
      commands.cmdClear(args);
      break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      commands.cmdHelp();
      break;
    default:
      console.log(`未知命令: ${command}`);
      console.log('使用 badge help 查看帮助');
      process.exit(1);
  }
}

main();
