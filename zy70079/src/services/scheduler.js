const cron = require('node-cron');
const BackgroundCheckService = require('./background-check.service');
const AuditLogger = require('../utils/audit-logger');

class Scheduler {
  static init() {
    cron.schedule('*/5 * * * *', async () => {
      console.log('Running timeout check...');
      await this.checkTimeouts();
    });

    console.log('Scheduler initialized - timeout check runs every 5 minutes');
  }

  static async checkTimeouts() {
    try {
      const timeoutTasks = await BackgroundCheckService.getTimeoutTasks();
      
      for (const task of timeoutTasks) {
        console.log(`Handling timeout for task: ${task.id}`);
        try {
          await BackgroundCheckService.handleTimeout(task.id);
          console.log(`Task ${task.id} marked as timeout`);
        } catch (error) {
          console.error(`Failed to handle timeout for task ${task.id}:`, error);
          await AuditLogger.log({
            taskId: task.id,
            action: 'TIMEOUT_HANDLING_FAILED',
            actorType: 'system',
            details: { error: error.message },
          });
        }
      }
    } catch (error) {
      console.error('Timeout check failed:', error);
    }
  }
}

module.exports = Scheduler;
