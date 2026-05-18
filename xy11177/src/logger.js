import chalk from 'chalk';

export class Logger {
  constructor(verbose = false) {
    this.isVerbose = verbose;
  }

  log(message) {
    console.log(chalk.blue('[INFO]'), message);
  }

  success(message) {
    console.log(chalk.green('[SUCCESS]'), message);
  }

  warn(message) {
    console.log(chalk.yellow('[WARN]'), message);
  }

  error(message) {
    console.error(chalk.red('[ERROR]'), message);
  }

  verbose(message) {
    if (this.isVerbose) {
      console.log(chalk.gray('[DEBUG]'), message);
    }
  }
}
