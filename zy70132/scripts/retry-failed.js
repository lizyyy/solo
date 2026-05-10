const { initDatabase, getDb } = require('../src/database');
const models = require('../src/models');
const services = require('../src/services');

initDatabase();

console.log('开始重试失败任务...\n');

const tasks = models.getRetryableFailedTasks();

if (tasks.length === 0) {
  console.log('没有可重试的失败任务');
  process.exit(0);
}

console.log(`找到 ${tasks.length} 个待重试任务\n`);

let successCount = 0;
let failCount = 0;

for (const task of tasks) {
  console.log(`\n处理任务: ${task.id}`);
  console.log(`  类型: ${task.task_type}`);
  console.log(`  尝试次数: ${task.attempts}`);
  
  const payload = JSON.parse(task.payload);
  
  try {
    let result;
    switch (task.task_type) {
      case 'ESCALATION':
        const ticket = models.getTicketById(payload.ticketId);
        if (!ticket) throw new Error('票据不存在');
        const nextUser = models.getNextWaitlistUser(payload.eventId);
        if (nextUser) {
          result = services.escalateToNextUser(payload.eventId, ticket, nextUser, payload.fromUserId);
        }
        break;
      case 'TIMEOUT_PROCESS':
        result = services.processPaymentTimeouts();
        break;
      case 'QUEUE_TIMEOUT':
        result = services.processQueueTimeouts();
        break;
      default:
        throw new Error(`未知任务类型: ${task.task_type}`);
    }
    
    models.deleteFailedTask(task.id);
    console.log(`  ✓ 重试成功`);
    successCount++;
  } catch (err) {
    console.log(`  ✗ 重试失败: ${err.message}`);
    
    if (task.attempts + 1 >= 5) {
      models.deleteFailedTask(task.id);
      console.log(`    已达最大重试次数，任务已移除`);
    } else {
      models.updateFailedTask(task.id, err.message);
      console.log(`    已记录，将在下次重试`);
    }
    failCount++;
  }
}

console.log(`\n\n=== 重试结果 ===`);
console.log(`成功: ${successCount}`);
console.log(`失败: ${failCount}`);
