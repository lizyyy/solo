import chalk from 'chalk';

export const logger = {
  info: (message: string) => console.log(chalk.blue(`ℹ  ${message}`)),
  success: (message: string) => console.log(chalk.green(`✓  ${message}`)),
  warn: (message: string) => console.log(chalk.yellow(`⚠  ${message}`)),
  error: (message: string) => console.log(chalk.red(`✗  ${message}`)),
  debug: (message: string, verbose = false) => {
    if (verbose) {
      console.log(chalk.gray(`🔍  ${message}`));
    }
  },
  section: (title: string) => {
    console.log('\n' + chalk.bold.cyan(`═══ ${title} ═══`));
  },
  empty: () => console.log(''),
};

export const riskColor = (level: string) => {
  switch (level) {
    case 'critical':
      return chalk.bgRed.white.bold;
    case 'high':
      return chalk.red.bold;
    case 'medium':
      return chalk.yellow.bold;
    case 'low':
      return chalk.blue.bold;
    case 'info':
      return chalk.gray;
    default:
      return chalk.white;
  }
};
