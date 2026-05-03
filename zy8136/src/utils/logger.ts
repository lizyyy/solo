import chalk from 'chalk';

class Logger {
  private verbose: boolean = false;

  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  info(message: string, data?: unknown): void {
    console.log(chalk.blue(`[INFO] ${message}`));
    if (this.verbose && data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  success(message: string): void {
    console.log(chalk.green(`[SUCCESS] ${message}`));
  }

  warn(message: string): void {
    console.log(chalk.yellow(`[WARN] ${message}`));
  }

  error(message: string, error?: unknown): void {
    console.error(chalk.red(`[ERROR] ${message}`));
    if (error) {
      console.error(error);
    }
  }

  debug(message: string, data?: unknown): void {
    if (this.verbose) {
      console.log(chalk.gray(`[DEBUG] ${message}`));
      if (data) {
        console.log(JSON.stringify(data, null, 2));
      }
    }
  }
}

export const logger = new Logger();
