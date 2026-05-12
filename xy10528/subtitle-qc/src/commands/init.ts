import chalk from 'chalk';
import ora from 'ora';
import { isInitialized, initState, loadState, getDataDir } from '../store';
import { formatDate } from '../utils';

export interface InitOptions {
  force?: boolean;
}

export async function handleInit(options: InitOptions = {}): Promise<void> {
  const spinner = ora('正在初始化字幕质检项目...').start();
  
  try {
    if (isInitialized() && !options.force) {
      spinner.fail(chalk.red('项目已初始化，使用 --force 覆盖'));
      const state = loadState();
      console.log(chalk.gray(`  数据目录: ${getDataDir()}`));
      console.log(chalk.gray(`  初始化时间: ${formatDate(state.initializedAt)}`));
      return;
    }
    
    const state = initState();
    spinner.succeed(chalk.green('字幕质检项目初始化成功'));
    
    console.log('');
    console.log(chalk.bold('  项目信息:'));
    console.log(chalk.gray(`  - 数据目录: ${getDataDir()}`));
    console.log(chalk.gray(`  - 状态文件: ${getDataDir()}/state.json`));
    console.log(chalk.gray(`  - 初始化时间: ${formatDate(state.initializedAt)}`));
    
    console.log('');
    console.log(chalk.bold('  下一步:'));
    console.log(chalk.cyan('  1. subtitle-qc import --subtitle examples/zh.srt --language zh'));
    console.log(chalk.cyan('  2. subtitle-qc import --sensitive examples/sensitive-words.json'));
    console.log(chalk.cyan('  3. subtitle-qc check'));
    
    console.log('');
  } catch (error) {
    spinner.fail(chalk.red(`初始化失败: ${error}`));
    process.exit(1);
  }
}
