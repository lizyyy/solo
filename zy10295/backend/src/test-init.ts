import { initDatabaseConnection, initDatabaseTables, ensureDataDir } from './database';
import { createDemoData } from './services/demoData';

console.log('开始测试数据库初始化...');

try {
  // 测试确保数据目录
  ensureDataDir();
  console.log('✓ 数据目录已确保存在');

  // 测试数据库连接初始化
  initDatabaseConnection();
  console.log('✓ 数据库连接已初始化');

  // 测试创建表
  initDatabaseTables();
  console.log('✓ 数据库表已创建');

  // 测试创建演示数据
  createDemoData();
  console.log('✓ 演示数据已创建');

  console.log('\n✅ 所有测试通过！数据库初始化顺序正确。');
} catch (error) {
  console.error('❌ 测试失败:', error);
  process.exit(1);
}
