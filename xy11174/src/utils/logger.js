const chalk = require('chalk');

class Logger {
  constructor(verbose = false) {
    this.verbose = verbose;
  }

  info(message) {
    console.log(chalk.blue(`[INFO] ${message}`));
  }

  success(message) {
    console.log(chalk.green(`[SUCCESS] ${message}`));
  }

  warn(message) {
    console.log(chalk.yellow(`[WARN] ${message}`));
  }

  error(message) {
    console.log(chalk.red(`[ERROR] ${message}`));
  }

  debug(message) {
    if (this.verbose) {
      console.log(chalk.gray(`[DEBUG] ${message}`));
    }
  }

  section(title) {
    console.log('\n' + chalk.cyan.bold(`>>> ${title}`));
  }
}

module.exports = Logger;
