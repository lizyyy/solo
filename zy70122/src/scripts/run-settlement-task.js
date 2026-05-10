const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const { initDatabase } = require('../config/database');
const taskService = require('../services/taskService');

async function main() {
  await initDatabase();
  
  console.log('开始执行后台任务...\n');

  const results = taskService.executePendingTasks();

  if (results.length === 0) {
    console.log('没有待执行的任务');
    process.exit(0);
  }

  console.log(`执行了 ${results.length} 个任务:\n`);

  results.forEach((r, i) => {
    const status = r.success ? '成功' : '失败';
    console.log(`${i + 1}. 任务 ${r.taskId}`);
    console.log(`   状态: ${status}`);
    console.log(`   消息: ${r.message}`);
    if (r.error) {
      console.log(`   错误: ${r.error}`);
    }
    if (r.willRetry !== undefined) {
      console.log(`   自动重试: ${r.willRetry ? '是' : '否'}`);
    }
    console.log('');
  });

  const failedCount = results.filter(r => !r.success).length;
  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
