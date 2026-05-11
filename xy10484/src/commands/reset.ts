import { Command } from 'commander';
import { resetStore } from '../utils/store';

export function registerResetCommand(program: Command): void {
  program
    .command('reset')
    .description('重置所有数据')
    .option('-y, --yes', '确认重置')
    .action((options) => {
      if (!options.yes) {
        console.log('警告：此操作将清除所有导入的数据和异常记录。');
        console.log('请使用 --yes 选项确认执行重置。');
        return;
      }
      
      resetStore();
      console.log('所有数据已重置！');
    });
}
