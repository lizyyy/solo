const { resourceLocks, bookings } = require('../models');
const { releaseResources } = require('./booking-service');

const JOB_INTERVAL = 60000; // 1分钟
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5秒

const jobStats = {
  totalRuns: 0,
  successfulRuns: 0,
  failedRuns: 0,
  lastRunTime: null,
  lastErrorMessage: null,
  releasedLocks: 0,
  currentRetryCount: 0
};

let jobInterval = null;
let isJobRunning = false;

const start = () => {
  console.log('后台任务已启动，将每分钟检查并释放过期资源');
  jobInterval = setInterval(runJob, JOB_INTERVAL);
};

const stop = () => {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    console.log('后台任务已停止');
  }
};

const runJob = async () => {
  if (isJobRunning) {
    console.log('后台任务正在执行中，跳过本次运行');
    return;
  }
  
  isJobRunning = true;
  jobStats.totalRuns++;
  jobStats.lastRunTime = new Date().toISOString();
  
  try {
    console.log(`\n[${new Date().toISOString()}] 开始执行资源过期检查任务`);
    
    const now = new Date().getTime();
    const expiredLocks = [];
    
    for (const [lockId, lock] of resourceLocks) {
      const lockEndTime = new Date(lock.endTime).getTime();
      if (lockEndTime < now) {
        expiredLocks.push(lock);
      }
    }
    
    if (expiredLocks.length === 0) {
      console.log('没有发现过期的资源锁');
    } else {
      console.log(`发现 ${expiredLocks.length} 个过期资源锁，准备释放`);
      
      const bookingIdsToRelease = new Set();
      for (const lock of expiredLocks) {
        bookingIdsToRelease.add(lock.bookingId);
      }
      
      console.log(`涉及 ${bookingIdsToRelease.size} 个订单需要释放资源`);
      
      for (const bookingId of bookingIdsToRelease) {
        try {
          releaseResources(bookingId);
          console.log(`已释放订单 ${bookingId} 的资源`);
          jobStats.releasedLocks += expiredLocks.filter(l => l.bookingId === bookingId).length;
        } catch (error) {
          console.error(`释放订单 ${bookingId} 资源失败: ${error.message}`);
          throw error;
        }
      }
    }
    
    jobStats.successfulRuns++;
    jobStats.currentRetryCount = 0;
    console.log('资源过期检查任务执行完成');
    
  } catch (error) {
    jobStats.failedRuns++;
    jobStats.lastErrorMessage = error.message;
    console.error(`资源过期检查任务执行失败: ${error.message}`);
    
    jobStats.currentRetryCount++;
    if (jobStats.currentRetryCount <= MAX_RETRIES) {
      console.log(`将在 ${RETRY_DELAY / 1000} 秒后重试（第 ${jobStats.currentRetryCount}/${MAX_RETRIES} 次）`);
      setTimeout(runJob, RETRY_DELAY);
    } else {
      console.error(`已达到最大重试次数 ${MAX_RETRIES}，任务将在下次定时执行时继续尝试`);
      jobStats.currentRetryCount = 0;
    }
    
  } finally {
    isJobRunning = false;
  }
};

const getJobStats = () => {
  return {
    ...jobStats,
    isRunning: isJobRunning,
    nextRunTime: new Date(Date.now() + JOB_INTERVAL).toISOString()
  };
};

const runManually = async () => {
  console.log('手动触发后台任务执行');
  return runJob();
};

module.exports = {
  start,
  stop,
  runJob,
  runManually,
  getJobStats,
  JOB_INTERVAL,
  MAX_RETRIES,
  RETRY_DELAY
};
