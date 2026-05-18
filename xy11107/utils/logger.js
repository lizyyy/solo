const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');

class Logger {
  constructor(options = {}) {
    this.isVerbose = options.verbose || false;
    this.logFile = options.logFile || path.join(process.cwd(), 'logs', `inspection-${Date.now()}.log`);
    fs.ensureDirSync(path.dirname(this.logFile));
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (this.isVerbose || level === 'error' || level === 'warn') {
      this.printToConsole(message, level);
    }
    
    fs.appendFileSync(this.logFile, logEntry + '\n');
  }

  printToConsole(message, level) {
    switch (level) {
      case 'info':
        console.log(chalk.blue('ℹ ') + message);
        break;
      case 'success':
        console.log(chalk.green('✓ ') + message);
        break;
      case 'warn':
        console.log(chalk.yellow('⚠ ') + message);
        break;
      case 'error':
        console.log(chalk.red('✗ ') + message);
        break;
      case 'verbose':
        if (this.isVerbose) {
          console.log(chalk.gray('  ') + message);
        }
        break;
      default:
        console.log(message);
    }
  }

  info(message) {
    this.log(message, 'info');
  }

  success(message) {
    this.log(message, 'success');
  }

  warn(message) {
    this.log(message, 'warn');
  }

  error(message) {
    this.log(message, 'error');
  }

  verbose(message) {
    this.log(message, 'verbose');
  }
}

module.exports = Logger;
