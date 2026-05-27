const { v4: uuidv4 } = require('uuid');
const { RepairRequest, Rating, ProcessLog, Batch } = require('../models');
const config = require('../config');

async function runScheduledScans() {
  console.log('[Scheduler] 开始执行定时扫描任务...');

  await scanOvertimeRepairs();
  await scanMaliciousRatings();

  console.log('[Scheduler] 定时扫描任务完成');
}

async function scanOvertimeRepairs() {
  const now = new Date();
  const thresholdMs = config.OVERTIME_THRESHOLD_HOURS * 3600000;

  const processingRecords = await RepairRequest.find({
    status: { $in: ['已派单', '处理中'] },
    assignedAt: { $exists: true, $lte: new Date(now - thresholdMs) }
  }).lean();

  for (const record of processingRecords) {
    const overtimeHours = ((now - record.assignedAt) / 3600000).toFixed(1);
    const log = new ProcessLog({
      logId: uuidv4(),
      targetType: 'RepairRequest',
      targetId: record.requestId,
      action: '超时罚分',
      reason: `系统检测：处理超时 ${overtimeHours} 小时（阈值 ${config.OVERTIME_THRESHOLD_HOURS}h）`,
      operator: 'system_scheduler',
      operatedAt: now,
      metadata: {
        overtimeHours: parseFloat(overtimeHours),
        thresholdHours: config.OVERTIME_THRESHOLD_HOURS,
        assignedAt: record.assignedAt
      }
    });
    await log.save();
  }

  console.log(`[Scheduler] 超时扫描: 发现 ${processingRecords.length} 条超时记录`);
}

async function scanMaliciousRatings() {
  const oneHourAgo = new Date(Date.now() - 3600000);
  const recentRatings = await Rating.find({
    ratedAt: { $gte: oneHourAgo },
    isMalicious: { $ne: true }
  }).sort({ ratedBy: 1, ratedAt: 1 }).lean();

  const userRatings = {};
  for (const r of recentRatings) {
    if (!userRatings[r.ratedBy]) userRatings[r.ratedBy] = [];
    userRatings[r.ratedBy].push(r);
  }

  for (const [user, ratings] of Object.entries(userRatings)) {
    if (ratings.length > config.MALICIOUS_RATING.MAX_RATINGS_PER_HOUR) {
      for (const r of ratings) {
        const log = new ProcessLog({
          logId: uuidv4(),
          targetType: 'Rating',
          targetId: r.ratingId,
          action: '标记恶意评分',
          reason: `系统检测：用户 ${user} 在 1 小时内评分 ${ratings.length} 次，超过阈值`,
          operator: 'system_scheduler',
          operatedAt: new Date(),
          metadata: {
            user,
            ratingCount: ratings.length,
            threshold: config.MALICIOUS_RATING.MAX_RATINGS_PER_HOUR
          }
        });
        await log.save();
      }
    }
  }

  console.log('[Scheduler] 恶意评分扫描完成');
}

async function recoverOnStartup() {
  console.log('[Recovery] 检查未完成的批次和处理中记录...');

  const pendingBatches = await Batch.find({
    importStatus: '待确认'
  }).lean();

  if (pendingBatches.length > 0) {
    console.log(`[Recovery] 发现 ${pendingBatches.length} 个待确认批次，需要手动处理`);
  }

  const stuckProcessing = await RepairRequest.find({
    status: { $in: ['已派单', '处理中'] },
    assignedAt: { $exists: true }
  }).lean();

  if (stuckProcessing.length > 0) {
    console.log(`[Recovery] 发现 ${stuckProcessing.length} 条处理中记录，系统状态已恢复`);
  }

  console.log('[Recovery] 服务状态恢复检查完成');
}

module.exports = { runScheduledScans, recoverOnStartup };
