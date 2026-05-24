import chalk from 'chalk';
export const logger = {
    info: (message) => console.log(chalk.blue(`ℹ  ${message}`)),
    success: (message) => console.log(chalk.green(`✓  ${message}`)),
    warn: (message) => console.log(chalk.yellow(`⚠  ${message}`)),
    error: (message) => console.log(chalk.red(`✗  ${message}`)),
    debug: (message, verbose = false) => {
        if (verbose) {
            console.log(chalk.gray(`🔍  ${message}`));
        }
    },
    section: (title) => {
        console.log('\n' + chalk.bold.cyan(`═══ ${title} ═══`));
    },
    empty: () => console.log(''),
};
export const riskColor = (level) => {
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
//# sourceMappingURL=logger.js.map