const chalk = require('chalk');

class Logger {
  constructor() {
    this.isVerbose = false;
    this.colorEnabled = true;
  }

  configure(options) {
    this.isVerbose = options.verbose || false;
    this.colorEnabled = options.color !== false;
  }

  log(message) {
    console.log(message);
  }

  info(message) {
    const prefix = this.colorEnabled ? chalk.blue('ℹ') : 'ℹ';
    console.log(`${prefix}  ${message}`);
  }

  success(message) {
    const prefix = this.colorEnabled ? chalk.green('✓') : '✓';
    console.log(`${prefix}  ${message}`);
  }

  warning(message) {
    const prefix = this.colorEnabled ? chalk.yellow('⚠') : '⚠';
    console.log(`${prefix}  ${message}`);
  }

  error(message) {
    const prefix = this.colorEnabled ? chalk.red('✗') : '✗';
    console.log(`${prefix}  ${message}`);
  }

  verbose(message) {
    if (this.isVerbose) {
      const prefix = this.colorEnabled ? chalk.gray('│') : '│';
      console.log(`${prefix}  ${message}`);
    }
  }

  header(title) {
    console.log('\n' + (this.colorEnabled ? chalk.bold.white(title) : title));
    console.log(this.colorEnabled ? chalk.gray('═'.repeat(50)) : '═'.repeat(50));
  }

  section(title) {
    if (this.isVerbose) {
      console.log('\n' + (this.colorEnabled ? chalk.cyan.underline(title) : title));
    }
  }
}

module.exports = new Logger();
