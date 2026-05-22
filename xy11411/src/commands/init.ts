import chalk from 'chalk';
import { dbService } from '../services/database';
import { createStateManager } from '../services/stateManager';
import { AutoCheckService } from '../services/autoCheck';

export async function initCommand(options: {
  force?: boolean;
}): Promise<void> {
  console.log(chalk.blue('\n=== 初始化连锁茶饮原料巡检系统 ===\n'));

  if (dbService.isInitialized() && !options.force) {
    console.log(chalk.yellow('⚠️  系统已初始化'));
    console.log(chalk.gray('如需重新初始化，请使用 --force 参数\n'));
    return;
  }

  try {
    console.log(chalk.gray('正在创建工作目录和数据库...'));
    await dbService.initialize();
    console.log(chalk.green('✓ 数据库初始化完成'));

    const config = dbService.getConfig();
    console.log(chalk.gray(`工作目录: ${config.workDir}`));
    console.log(chalk.gray(`数据库: ${config.path}`));

    const stateManager = await createStateManager();
    await stateManager.logAction('system_init', 'system', undefined, {
      force: options.force || false
    });
    console.log(chalk.green('✓ 审计日志已记录'));

    const autoCheck = new AutoCheckService(stateManager);
    const { consistent, issues } = await autoCheck.verifyRestartConsistency();
    if (consistent) {
      console.log(chalk.green('✓ 系统一致性检查通过'));
    } else {
      console.log(chalk.yellow(`⚠️  发现 ${issues.length} 个问题:`));
      issues.forEach(issue => console.log(chalk.yellow(`  - ${issue}`)));
    }

    console.log(chalk.green('\n✓ 系统初始化成功!'));
    console.log(chalk.gray('\n可使用以下命令开始:'));
    console.log(chalk.gray('  tea-inspect import <file>   - 导入数据文件'));
    console.log(chalk.gray('  tea-inspect check           - 数据校验'));
    console.log(chalk.gray('  tea-inspect report          - 生成报表\n'));

  } catch (error) {
    console.error(chalk.red('\n✗ 初始化失败:'), (error as Error).message);
    process.exit(1);
  }
}
