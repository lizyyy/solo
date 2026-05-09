const LogEntry = require('../models/LogEntry');
const TraceSession = require('../models/TraceSession');

class LogReplayService {
  static async getReplayTimeline(traceId) {
    const logs = await LogEntry.find({ traceId }).sort({ timestamp: 1 });
    const session = await TraceSession.findOne({ traceId });

    if (logs.length === 0) {
      throw new Error('Trace not found');
    }

    const timeline = this.buildTimeline(logs);
    const statistics = this.calculateStatistics(logs);

    return {
      traceId,
      session,
      timeline,
      statistics,
      anomalies: session?.anomalies || []
    };
  }

  static buildTimeline(logs) {
    const steps = logs.map((log, index) => ({
      step: index + 1,
      spanId: log.spanId,
      parentSpanId: log.parentSpanId,
      timestamp: log.timestamp,
      level: log.level,
      service: log.service,
      operation: log.operation,
      message: log.message,
      status: log.status,
      duration: log.duration,
      anomalies: log.anomalies || [],
      details: log.details,
      userId: log.userId
    }));

    const tree = this.buildTree(steps);
    
    return {
      flat: steps,
      tree: tree,
      duration: steps.length > 0 ? 
        steps[steps.length - 1].timestamp - steps[0].timestamp : 0
    };
  }

  static buildTree(steps) {
    const map = new Map();
    const roots = [];

    steps.forEach(step => {
      map.set(step.spanId, { ...step, children: [] });
    });

    steps.forEach(step => {
      const node = map.get(step.spanId);
      if (step.parentSpanId && map.has(step.parentSpanId)) {
        map.get(step.parentSpanId).children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  static calculateStatistics(logs) {
    const stats = {
      total: logs.length,
      byLevel: {
        DEBUG: 0,
        INFO: 0,
        WARN: 0,
        ERROR: 0,
        FATAL: 0
      },
      byStatus: {
        START: 0,
        PROCESSING: 0,
        SUCCESS: 0,
        FAILED: 0,
        ROLLBACK: 0,
        TIMEOUT: 0
      },
      byService: {},
      anomalies: {
        total: 0,
        byType: {}
      },
      avgDuration: 0
    };

    let totalDuration = 0;
    let durationCount = 0;

    logs.forEach(log => {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      stats.byStatus[log.status] = (stats.byStatus[log.status] || 0) + 1;
      stats.byService[log.service] = (stats.byService[log.service] || 0) + 1;

      if (log.duration > 0) {
        totalDuration += log.duration;
        durationCount++;
      }

      if (log.anomalies && log.anomalies.length > 0) {
        stats.anomalies.total += log.anomalies.length;
        log.anomalies.forEach(type => {
          stats.anomalies.byType[type] = (stats.anomalies.byType[type] || 0) + 1;
        });
      }
    });

    if (durationCount > 0) {
      stats.avgDuration = Math.round(totalDuration / durationCount);
    }

    return stats;
  }

  static async getReplayStep(traceId, stepIndex) {
    const timeline = await this.getReplayTimeline(traceId);
    
    if (stepIndex < 0 || stepIndex >= timeline.timeline.flat.length) {
      throw new Error('Step index out of range');
    }

    const step = timeline.timeline.flat[stepIndex];
    
    return {
      ...step,
      context: {
        previous: stepIndex > 0 ? timeline.timeline.flat[stepIndex - 1] : null,
        next: stepIndex < timeline.timeline.flat.length - 1 ? 
          timeline.timeline.flat[stepIndex + 1] : null,
        progress: {
          current: stepIndex + 1,
          total: timeline.timeline.flat.length,
          percentage: Math.round(((stepIndex + 1) / timeline.timeline.flat.length) * 100)
        }
      }
    };
  }

  static async searchInTrace(traceId, query) {
    const logs = await LogEntry.find({
      traceId,
      $or: [
        { message: { $regex: query, $options: 'i' } },
        { operation: { $regex: query, $options: 'i' } },
        { service: { $regex: query, $options: 'i' } }
      ]
    }).sort({ timestamp: 1 });

    return logs.map((log, index) => ({
      ...log.toObject(),
      matchIndex: index
    }));
  }

  static async getCriticalPath(traceId) {
    const timeline = await this.getReplayTimeline(traceId);
    const logs = timeline.timeline.flat;

    const criticalPath = logs.filter(log => 
      log.level === 'ERROR' || 
      log.level === 'FATAL' ||
      (log.anomalies && log.anomalies.length > 0) ||
      log.status === 'FAILED' ||
      log.status === 'ROLLBACK'
    );

    return {
      traceId,
      totalSteps: logs.length,
      criticalSteps: criticalPath.length,
      steps: criticalPath
    };
  }
}

module.exports = LogReplayService;
