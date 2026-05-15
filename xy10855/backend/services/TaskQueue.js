const TaskService = require('./TaskService');

class TaskQueue {
  constructor() {
    this.queue = [];
    this.processing = new Set();
    this.maxConcurrent = 2;
    this.isRunning = false;
  }

  addTask(taskId) {
    if (!this.queue.includes(taskId) && !this.processing.has(taskId)) {
      this.queue.push(taskId);
      console.log(`任务 ${taskId} 已加入队列，当前队列长度: ${this.queue.length}`);
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.isRunning) return;
    this.isRunning = true;

    while (this.queue.length > 0 && this.processing.size < this.maxConcurrent) {
      const taskId = this.queue.shift();
      
      if (this.processing.has(taskId)) continue;
      
      this.processing.add(taskId);
      this.processTask(taskId);
    }

    this.isRunning = false;
  }

  async processTask(taskId) {
    console.log(`开始处理任务: ${taskId}`);
    
    try {
      await TaskService.startTask(taskId);
      await TaskService.simulateTaskProgress(taskId);
      await TaskService.completeTask(taskId);
      console.log(`任务 ${taskId} 完成`);
    } catch (error) {
      console.error(`任务 ${taskId} 失败:`, error.message);
      await TaskService.failTask(taskId, error);
    } finally {
      this.processing.delete(taskId);
      this.processQueue();
    }
  }

  getQueueStatus() {
    return {
      waiting: this.queue.length,
      processing: this.processing.size,
      queue: [...this.queue],
      processingTasks: Array.from(this.processing)
    };
  }

  clearQueue() {
    const cleared = this.queue.length;
    this.queue = [];
    return { cleared };
  }
}

module.exports = new TaskQueue();
