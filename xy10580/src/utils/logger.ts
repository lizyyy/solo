import chalk from 'chalk';

export const logger = {
  info: (message: string) => {
    console.log(chalk.blue('[INFO]'), message);
  },
  
  success: (message: string) => {
    console.log(chalk.green('[SUCCESS]'), message);
  },
  
  warn: (message: string) => {
    console.log(chalk.yellow('[WARN]'), message);
  },
  
  error: (message: string) => {
    console.error(chalk.red('[ERROR]'), message);
  },
  
  debug: (message: string) => {
    if (process.env.DEBUG) {
      console.log(chalk.gray('[DEBUG]'), message);
    }
  },
  
  step: (num: number, message: string) => {
    console.log(chalk.cyan(`[${num}]`), message);
  },
  
  status: (label: string, value: string) => {
    console.log(chalk.white(`${label}:`), chalk.italic(value));
  },
  
  divider: () => {
    console.log(chalk.gray('─'.repeat(60)));
  },
  
  header: (title: string) => {
    console.log('');
    console.log(chalk.bold.bgBlue.white(` ${title} `));
    logger.divider();
  },
};
