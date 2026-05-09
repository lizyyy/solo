const BackgroundJobService = require('./services/backgroundJobService');
const logger = require('./utils/logger');

const POLL_INTERVAL = 5000;
const CONCURRENT_JOBS = 3;
let isRunning = false;
let activeJobs = 0;

async function processJobs() {
  if (isRunning) return;
  
  try {
    isRunning = true;
    
    const pendingJobs = await BackgroundJobService.getPendingJobs();
    
    for (const job of pendingJobs) {
      if (activeJobs >= CONCURRENT_JOBS) break;
      
      processJob(job);
    }
  } catch (error) {
    logger.error('获取待处理任务失败:', error);
  } finally {
    isRunning = false;
  }
}

async function processJob(job) {
  activeJobs++;
  
  try {
    await BackgroundJobService.markJobRunning(job.id);
    
    logger.info(`开始处理任务: ${job.job_name} (ID: ${job.id})`);
    
    await BackgroundJobService.executeJob(job);
    
    logger.info(`任务完成: ${job.job_name} (ID: ${job.id})`);
  } catch (error) {
    logger.error(`任务失败: ${job.job_name} (ID: ${job.id}):`, error.message);
  } finally {
    activeJobs--;
  }
}

function startWorker() {
  logger.info('后台任务工作器已启动');
  
  setInterval(() => {
    processJobs();
  }, POLL_INTERVAL);
  
  processJobs();
}

process.on('SIGTERM', () => {
  logger.info('收到停止信号，等待正在执行的任务完成...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('收到中断信号，等待正在执行的任务完成...');
  process.exit(0);
});

if (require.main === module) {
  startWorker();
}

module.exports = { startWorker, processJobs };
