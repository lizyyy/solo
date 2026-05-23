import { initDatabase, isDatabaseInitialized } from '../db/database';
import chalk from 'chalk';

export async function initCommand(): Promise<number> {
  console.log(chalk.blue('正在初始化园区访客通行巡检工具...'));

  if (isDatabaseInitialized()) {
    console.log(chalk.yellow('数据库已初始化，跳过创建。'));
    return 0;
  }

  try {
    initDatabase();
    console.log(chalk.green('✓ 数据库初始化成功！'));
    console.log(chalk.gray('  数据文件位置: .park-inspect/data.db'));
    console.log('');
    console.log(chalk.cyan('下一步操作:'));
    console.log('  1. 导入数据: park-inspect import <文件路径>');
    console.log('  2. 校验数据: park-inspect check <批次ID>');
    console.log('  3. 生成报表: park-inspect report <批次ID>');
    
    return 0;
  } catch (error) {
    console.error(chalk.red('初始化失败:'), (error as Error).message);
    return 1;
  }
}
