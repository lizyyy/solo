const Bull = require('bull');
const config = require('./index');
const logger = require('./logger');

const queues = {};

function createQueue(name) {
  if (queues[name]) {
    return queues[name];
  }

  const queue = new Bull(name, config.redis.url, {
    defaultJobOptions: {
      attempts: config.queue.maxRetryTimes,
      backoff: {
        type: 'exponential',
        delay: config.queue.retryDelayMs,
      },
      removeOnComplete: false,
      removeOnFail: false,
    },
  });

  queue.on('error', (error) => {
    logger.error(`队列 ${name} 错误:`, error);
  });

  queue.on('failed', (job, error) => {
    logger.error(`队列 ${name} 任务 ${job.id} 失败:`, error.message);
  });

  queue.on('completed', (job) => {
    logger.info(`队列 ${name} 任务 ${job.id} 完成`);
  });

  queues[name] = queue;
  return queue;
}

const compensationQueue = createQueue('compensation');

async function closeAllQueues() {
  for (const name in queues) {
    await queues[name].close();
  }
}

module.exports = {
  compensationQueue,
  createQueue,
  closeAllQueues,
};
