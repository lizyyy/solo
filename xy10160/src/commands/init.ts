import chalk from 'chalk';
import { initializeStore, isInitialized, addHistoryEntry } from '../storage/store';
import { getDataDir } from '../storage/store';

export const initCommand = (options: { force?: boolean }): void => {
  if (isInitialized()) {
    if (!options.force) {
      console.log(chalk.yellow('⚠️  项目已初始化'));
      console.log(chalk.gray(`   数据目录: ${getDataDir()}`));
      console.log(chalk.gray('   使用 --force 强制重新初始化（会清除已有数据）'));
      addHistoryEntry('init', '检测到已初始化，跳过', 'success', '项目已存在，使用 --force 可覆盖');
      return;
    }
    console.log(chalk.yellow('⚠️  强制重新初始化，将清除所有数据...'));
  }

  const initialized = initializeStore();
  if (initialized) {
    console.log(chalk.green('✓ 初始化成功'));
    console.log(chalk.gray(`   数据目录: ${getDataDir()}`));
    addHistoryEntry('init', '初始化完成', 'success', `数据目录: ${getDataDir()}`);
  } else {
    console.log(chalk.red('✗ 初始化失败'));
    addHistoryEntry('init', '初始化失败', 'failed', '无法创建数据目录');
  }
};
