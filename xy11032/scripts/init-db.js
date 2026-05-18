async function main() {
  console.log('正在初始化数据库...');
  const init = require('../src/database/init');
  await init();

  console.log('\n正在导入样例数据...');
  const insertSampleData = require('../src/database/sample-data');
  await insertSampleData();
  
  console.log('\n初始化完成！');
  process.exit(0);
}

main().catch(err => {
  console.error('初始化失败:', err);
  process.exit(1);
});
