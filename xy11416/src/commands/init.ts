import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { getDatabase } from '../database';

export async function initCommand(workDir: string, options: { force?: boolean }): Promise<void> {
  const absoluteDir = path.resolve(workDir);

  if (!fs.existsSync(absoluteDir)) {
    fs.mkdirSync(absoluteDir, { recursive: true });
  }

  const dbPath = path.join(absoluteDir, 'pmi.db');
  if (fs.existsSync(dbPath) && !options.force) {
    console.log(chalk.yellow(`工作目录已存在: ${absoluteDir}`));
    console.log(chalk.yellow('使用 --force 选项重新初始化'));
    return;
  }

  const db = getDatabase(absoluteDir);
  await db.initSchema();

  const dataDir = path.join(absoluteDir, 'data');
  const exportDir = path.join(absoluteDir, 'exports');
  const importDir = path.join(absoluteDir, 'imports');

  [dataDir, exportDir, importDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  const configPath = path.join(absoluteDir, 'pmi.json');
  const config = {
    version: '1.0.0',
    initializedAt: new Date().toISOString(),
    workDir: absoluteDir,
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log(chalk.green('✓ 初始化成功!'));
  console.log(chalk.gray(`  工作目录: ${absoluteDir}`));
  console.log(chalk.gray(`  数据库: ${dbPath}`));
  console.log('');
  console.log(chalk.blue('下一步:'));
  console.log(chalk.gray('  1. 放入待导入文件到 imports/ 目录'));
  console.log(chalk.gray('  2. 运行 pmi import <文件路径> 导入数据'));
  console.log(chalk.gray('  3. 运行 pmi check 检查数据质量'));
}
