const { initDatabase } = require('./models/init');

async function main() {
  console.log('隐患闭环管理系统启动中...');
  await initDatabase();
  console.log('数据库初始化完成!');
  console.log('\n使用以下命令进行操作:');
  console.log('  node src/cli.js --help');
  console.log('  node src/cli.js import-hazards --file data/samples/hazards.csv');
  console.log('  node src/cli.js test-sample');
}

main().catch(console.error);
