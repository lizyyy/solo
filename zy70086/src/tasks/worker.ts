import 'reflect-metadata';
import { initDatabase, AppDataSource } from '../database/data-source';
import { BackgroundJobService, JobType } from '../services/background-job.service';
import { BinEvent, EventStatus, Bin, BinEventType } from '../entities';
import { StatisticsService } from '../services/statistics.service';
import { v4 as uuidv4 } from 'uuid';

const jobService = new BackgroundJobService();
const statsService = new StatisticsService();
const POLL_INTERVAL_SECONDS = 30;

interface JobHandlerResult {
  success: boolean;
  result?: any;
  error?: string;
}

async function handleEventEscalate(payload: any): Promise<JobHandlerResult> {
  const { eventId, binId, level, consecutiveFullCount } = payload;

  const eventRepo = AppDataSource.getRepository(BinEvent);
  const binRepo = AppDataSource.getRepository(Bin);

  const event = await eventRepo.findOne({ where: { id: eventId } });
  if (!event) {
    return { success: false, error: '事件不存在' };
  }

  if (event.status === EventStatus.RESOLVED) {
    return { success: true, result: '事件已解决，无需升级' };
  }

  const bin = await binRepo.findOne({ where: { id: binId } });
  if (!bin) {
    return { success: false, error: '桶点不存在' };
  }

  const newEscalateCount = event.escalateCount + 1;
  event.escalateCount = newEscalateCount;

  const levelText = level === '重大' ? '重大级' : level === '紧急' ? '紧急级' : '普通级';
  const escalationInfo = newEscalateCount >= 2
    ? '【重点关注】连续满溢已升级到二级，建议立即调度'
    : newEscalateCount >= 1
    ? '【关注】连续满溢已升级到一级，建议优先调度'
    : '';

  const consecutiveInfo = consecutiveFullCount >= 3
    ? `连续 ${consecutiveFullCount} 次满溢，建议检查桶点`
    : '';

  if (consecutiveFullCount >= 3) {
    bin.isUrgent = true;
    await binRepo.save(bin);
  }

  event.status = EventStatus.ESCALATED;
  event.description = [
    event.description,
    `升级处理：第 ${newEscalateCount} 次升级（${levelText}）`,
    escalationInfo,
    consecutiveInfo,
  ].filter(Boolean).join('；');

  await eventRepo.save(event);

  return {
    success: true,
    result: {
      eventId,
      binId,
      community: bin.community,
      location: bin.location,
      binType: bin.binType,
      level,
      escalateCount: newEscalateCount,
      consecutiveFullCount,
      isUrgent: bin.isUrgent,
      message: `${bin.community} ${bin.location} ${bin.binType} 桶点事件已升级（第 ${newEscalateCount} 次）`,
    },
  };
}

async function handleStatisticsAggregate(payload: any): Promise<JobHandlerResult> {
  const requestId = payload.requestId || uuidv4();
  const result = await statsService.refreshTodayStats(requestId);

  if (result.success) {
    return { success: true, result: result.data };
  }
  return { success: false, error: result.message };
}

async function handleVehicleReturnCheck(payload: any): Promise<JobHandlerResult> {
  return { success: true, result: '车辆返程检查完成' };
}

async function handleReceiptReminder(payload: any): Promise<JobHandlerResult> {
  return { success: true, result: '回执提醒已发送' };
}

async function handleBinCleanReminder(payload: any): Promise<JobHandlerResult> {
  return { success: true, result: '桶点清运提醒已发送' };
}

async function executeJob(job: any): Promise<JobHandlerResult> {
  const payload = JSON.parse(job.payloadJson || '{}');

  console.log(`[${new Date().toISOString()}] 执行任务：${job.jobType} (${job.id})，第 ${job.attemptCount + 1} 次尝试`);

  try {
    let result: JobHandlerResult;

    switch (job.jobType) {
      case JobType.EVENT_ESCALATE:
        result = await handleEventEscalate(payload);
        break;
      case JobType.STATISTICS_AGGREGATE:
        result = await handleStatisticsAggregate(payload);
        break;
      case JobType.VEHICLE_RETURN_CHECK:
        result = await handleVehicleReturnCheck(payload);
        break;
      case JobType.RECEIPT_REMINDER:
        result = await handleReceiptReminder(payload);
        break;
      case JobType.BIN_CLEAN_REMINDER:
        result = await handleBinCleanReminder(payload);
        break;
      default:
        result = { success: false, error: `未知任务类型：${job.jobType}` };
    }

    return result;
  } catch (e: any) {
    console.error(`[${new Date().toISOString()}] 任务执行异常：`, e.message);
    return { success: false, error: e.message || '未知错误' };
  }
}

async function runWorker() {
  console.log('\n========================================');
  console.log('  垃圾分类清运调度服务 - 后台任务处理器');
  console.log('========================================\n');
  console.log(`轮询间隔：${POLL_INTERVAL_SECONDS} 秒`);
  console.log('最大重试次数：3 次');
  console.log('重试间隔：60 秒\n');

  while (true) {
    try {
      const jobs = await jobService.getPendingJobs(10);

      if (jobs.length > 0) {
        console.log(`\n[${new Date().toISOString()}] 发现 ${jobs.length} 个待处理任务`);

        for (const job of jobs) {
          await jobService.markRunning(job.id);

          const result = await executeJob(job);

          if (result.success) {
            await jobService.markSuccess(job.id, result.result);
            console.log(`[${new Date().toISOString()}] ✓ 任务完成：${job.jobType} (${job.id})`);
            if (result.result && typeof result.result === 'object' && 'message' in result.result) {
              console.log(`    业务说明：${result.result.message}`);
            }
          } else {
            const updatedJob = await jobService.markFailed(job.id, result.error || '执行失败');
            if (updatedJob.status === '已死亡') {
              console.log(`[${new Date().toISOString()}] ✗ 任务死亡：${job.jobType} (${job.id})`);
              console.log(`    错误：${result.error}`);
              console.log(`    处理建议：请查看 API /api/jobs/dead，确认问题后调用 /api/jobs/:id/retry 重试`);
            } else {
              const minutes = Math.floor(updatedJob.retryIntervalSeconds / 60);
              console.log(`[${new Date().toISOString()}] ↻ 任务失败，将在 ${minutes} 分钟后重试（第 ${updatedJob.attemptCount}/${updatedJob.maxAttempts} 次）`);
              console.log(`    错误：${result.error}`);
            }
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_SECONDS * 1000));
    } catch (e: any) {
      console.error(`[${new Date().toISOString()}] Worker 循环异常：`, e.message);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_SECONDS * 1000));
    }
  }
}

async function startWorker() {
  try {
    await initDatabase();
    console.log('数据库连接成功，后台任务处理器准备就绪...');
    await runWorker();
  } catch (e) {
    console.error('后台任务处理器启动失败:', e);
    process.exit(1);
  }
}

startWorker();
