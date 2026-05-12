const { storage } = require('../src/utils/storage');
const { initializeData } = require('../src/utils/initializer');

async function seedSampleData() {
  console.log('开始初始化示例数据...');
  await initializeData();
  
  console.log();
  console.log('已创建设备:');
  Object.values(storage.equipment).forEach(eq => {
    console.log(`  - ${eq.name} (${eq.model}): 押金 ${eq.depositAmount}元, 日租金 ${eq.dailyRentalFee}元`);
  });
  
  console.log();
  console.log('示例数据初始化完成!');
  console.log();
  console.log('可以运行以下命令查看演示:');
  console.log('  node scripts/demo-scenarios.js   - 运行所有演示场景');
  console.log('  npm start                        - 启动 API 服务');
}

seedSampleData().catch(console.error);