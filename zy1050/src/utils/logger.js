import chalk from 'chalk';

export class Logger {
  constructor(verbose = false) {
    this.verbose = verbose;
  }

  info(message, ...args) {
    console.log(chalk.blue(`[INFO] ${message}`), ...args);
  }

  success(message, ...args) {
    console.log(chalk.green(`[SUCCESS] ${message}`), ...args);
  }

  warn(message, ...args) {
    console.warn(chalk.yellow(`[WARN] ${message}`), ...args);
  }

  error(message, ...args) {
    console.error(chalk.red(`[ERROR] ${message}`), ...args);
  }

  debug(message, ...args) {
    if (this.verbose) {
      console.log(chalk.gray(`[DEBUG] ${message}`), ...args);
    }
  }

  step(stepNum, total, message, ...args) {
    console.log(chalk.cyan(`[STEP ${stepNum}/${total}] ${message}`), ...args);
  }
}

export default new Logger();
