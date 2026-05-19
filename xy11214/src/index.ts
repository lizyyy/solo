import { initDatabase } from './database';

async function main() {
  await initDatabase();

  console.log('地下泵房巡检管理系统已启动');
  console.log('使用 npm run --help 查看可用命令');
  console.log('');
  console.log('快速开始:');
  console.log('  npm run import:csv data/sample_inspections_normal.csv   # 导入巡检记录');
  console.log('  npm run import:json data/sample_alerts_normal.json        # 导入告警数据');
  console.log('  npm run status summary                                     # 查看系统概要');
  console.log('  npm run report                                             # 生成统计报告');
}

main().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
