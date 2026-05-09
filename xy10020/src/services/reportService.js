const OperationLog = require('../models/OperationLog');
const PushTask = require('../models/PushTask');
const Message = require('../models/Message');
const LiveRoom = require('../models/LiveRoom');
const UserConnection = require('../models/UserConnection');

class ReportService {
  async generateReport(startTime, endTime, options = {}) {
    const [
      operationStats,
      taskStats,
      messageStats,
      roomStats,
      operationLogs
    ] = await Promise.all([
      this.getOperationStats(startTime, endTime),
      this.getTaskStats(startTime, endTime),
      this.getMessageStats(startTime, endTime),
      this.getRoomStats(startTime, endTime),
      this.getOperationLogs(startTime, endTime, options)
    ]);

    return {
      reportTime: Date.now(),
      timeRange: {
        start: startTime,
        end: endTime
      },
      summary: {
        totalOperations: operationStats.total,
        operationsByType: operationStats.byType,
        totalTasks: taskStats.total,
        completedTasks: taskStats.completed,
        failedTasks: taskStats.failed,
        totalMessages: messageStats.total,
        activeRooms: roomStats.activeCount,
        peakViewers: roomStats.peakViewers
      },
      details: {
        operations: operationLogs
      }
    };
  }

  async getOperationStats(startTime, endTime) {
    const db = require('../database/client').getDb();

    const totalResult = db.prepare(`
      SELECT COUNT(*) as count FROM operation_logs
      WHERE created_at >= ? AND created_at <= ?
    `).get(startTime, endTime);

    const byTypeResult = db.prepare(`
      SELECT operation_type, COUNT(*) as count
      FROM operation_logs
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY operation_type
    `).all(startTime, endTime);

    const byType = {};
    for (const row of byTypeResult) {
      byType[row.operation_type] = row.count;
    }

    return {
      total: totalResult.count,
      byType
    };
  }

  async getTaskStats(startTime, endTime) {
    const db = require('../database/client').getDb();

    const totalResult = db.prepare(`
      SELECT COUNT(*) as count FROM push_tasks
      WHERE created_at >= ? AND created_at <= ?
    `).get(startTime, endTime);

    const completedResult = db.prepare(`
      SELECT COUNT(*) as count FROM push_tasks
      WHERE created_at >= ? AND created_at <= ? AND status = 'completed'
    `).get(startTime, endTime);

    const failedResult = db.prepare(`
      SELECT COUNT(*) as count FROM push_tasks
      WHERE created_at >= ? AND created_at <= ? AND status = 'failed'
    `).get(startTime, endTime);

    const byTypeResult = db.prepare(`
      SELECT task_type,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM push_tasks
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY task_type
    `).all(startTime, endTime);

    return {
      total: totalResult.count,
      completed: completedResult.count,
      failed: failedResult.count,
      successRate: totalResult.count > 0
        ? Math.round((completedResult.count / totalResult.count) * 100)
        : 0,
      byType: byTypeResult
    };
  }

  async getMessageStats(startTime, endTime) {
    const db = require('../database/client').getDb();

    const totalResult = db.prepare(`
      SELECT COUNT(*) as count FROM messages
      WHERE created_at >= ? AND created_at <= ?
    `).get(startTime, endTime);

    const byTypeResult = db.prepare(`
      SELECT message_type, COUNT(*) as count
      FROM messages
      WHERE created_at >= ? AND created_at <= ?
      GROUP BY message_type
    `).all(startTime, endTime);

    const byType = {};
    for (const row of byTypeResult) {
      byType[row.message_type] = row.count;
    }

    return {
      total: totalResult.count,
      byType
    };
  }

  async getRoomStats(startTime, endTime) {
    const db = require('../database/client').getDb();

    const activeRooms = LiveRoom.findActive();

    const maxViewersResult = db.prepare(`
      SELECT MAX(max_viewers) as peak FROM live_rooms
    `).get();

    const liveEventsResult = db.prepare(`
      SELECT COUNT(*) as count FROM operation_logs
      WHERE operation_type IN ('START_LIVE', 'END_LIVE')
        AND created_at >= ? AND created_at <= ?
    `).get(startTime, endTime);

    return {
      activeCount: activeRooms.length,
      peakViewers: maxViewersResult.peak || 0,
      totalLiveEvents: liveEventsResult.count
    };
  }

  async getOperationLogs(startTime, endTime, options = {}) {
    const limit = Math.min(options.limit || 1000, 10000);
    const offset = options.offset || 0;

    return OperationLog.findByTimeRange(startTime, endTime, { limit, offset });
  }

  exportToJSON(report) {
    return JSON.stringify(report, null, 2);
  }

  exportToCSV(report) {
    const csvLines = [];

    csvLines.push('报表生成时间,' + new Date(report.reportTime).toISOString());
    csvLines.push('时间范围,' + new Date(report.timeRange.start).toISOString() + ' 到 ' + new Date(report.timeRange.end).toISOString());
    csvLines.push('');

    csvLines.push('统计摘要');
    csvLines.push('指标,数值');
    csvLines.push('总操作数,' + report.summary.totalOperations);
    csvLines.push('总任务数,' + report.summary.totalTasks);
    csvLines.push('已完成任务,' + report.summary.completedTasks);
    csvLines.push('失败任务,' + report.summary.failedTasks);
    csvLines.push('总消息数,' + report.summary.totalMessages);
    csvLines.push('活跃直播间,' + report.summary.activeRooms);
    csvLines.push('峰值观众数,' + report.summary.peakViewers);
    csvLines.push('');

    csvLines.push('操作类型分布');
    csvLines.push('操作类型,数量');
    for (const [type, count] of Object.entries(report.summary.operationsByType)) {
      csvLines.push(`${type},${count}`);
    }
    csvLines.push('');

    csvLines.push('操作日志明细');
    csvLines.push('时间,操作类型,实体类型,实体ID,用户ID,IP地址');
    for (const log of report.details.operations) {
      const time = new Date(log.createdAt).toISOString();
      csvLines.push([
        time,
        log.operationType,
        log.entityType || '',
        log.entityId || '',
        log.userId || '',
        log.ipAddress || ''
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    }

    return csvLines.join('\n');
  }
}

module.exports = ReportService;
