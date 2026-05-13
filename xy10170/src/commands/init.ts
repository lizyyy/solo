import * as fs from 'fs-extra';
import db from '../database/connection';
import config from '../config';
import { formatErrorForUser } from '../utils/errors';

export async function executeInit(options: { force?: boolean }): Promise<void> {
  console.log('\n📦 正在初始化证书盘点系统...\n');
  
  try {
    const dbExists = await fs.pathExists(config.dbPath);
    
    if (dbExists && !options.force) {
      console.log('⚠️  检测到现有数据，初始化会覆盖所有数据！\n');
      console.log('   如果确认要重新初始化，请使用 --force 参数：');
      console.log('   cert-audit init --force\n');
      console.log('   当前数据目录:', config.dataDir);
      process.exit(0);
    }
    
    if (dbExists && options.force) {
      console.log('🔄 强制重新初始化，删除现有数据...');
      await fs.remove(config.dbPath);
    }
    
    console.log('📂 创建数据目录...');
    await fs.ensureDir(config.dataDir);
    
    console.log('📁 创建报告目录...');
    await fs.ensureDir(config.reportDir);
    
    console.log('🗄️  初始化数据库...');
    await db.init();
    
    console.log('\n✅ 初始化完成！\n');
    console.log('📋 数据目录:', config.dataDir);
    console.log('🗄️  数据库:', config.dbPath);
    console.log('📊 报告目录:', config.reportDir);
    console.log('\n💡 下一步：');
    console.log('   1. 导入证书清单: cert-audit import <file>');
    console.log('   2. 检查证书状态: cert-audit check');
    console.log('   3. 生成到期报告: cert-audit report\n');
    
  } catch (error) {
    console.error(formatErrorForUser(error));
    process.exit(1);
  }
}
