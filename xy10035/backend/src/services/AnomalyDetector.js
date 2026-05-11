const DataAccess = require('../data/DataAccess');

const ANOMALY_TYPES = {
  DUPLICATE: 'DUPLICATE',
  CONCURRENCY: 'CONCURRENCY',
  TIMING_ISSUE: 'TIMING_ISSUE',
  CACHE_STALE: 'CACHE_STALE',
  ROLLBACK_FAILED: 'ROLLBACK_FAILED',
  ASYNC_OUT_OF_ORDER: 'ASYNC_OUT_OF_ORDER'
};

class AnomalyDetector {
  static async detectAnomalies(traceId) {
    const logs = await DataAccess.findLogs({ traceId }, { sort: { timestamp: 1 } });
    const anomalies = [];

    if (logs.length === 0) return anomalies;

    anomalies.push(...this.detectDuplicateOperations(logs));
    anomalies.push(...this.detectConcurrencyIssues(logs));
    anomalies.push(...this.detectAsyncOutOfOrder(logs));
    anomalies.push(...this.detectCacheStaleIssues(logs));
    anomalies.push(...this.detectRollbackFailures(logs));

    return anomalies;
  }

  static detectDuplicateOperations(logs) {
    const anomalies = [];
    const operationMap = new Map();

    logs.forEach(log => {
      const hasRequestBody = log.details?.requestBody && 
                           Object.keys(log.details.requestBody).length > 0;
      
      let key;
      if (hasRequestBody) {
        key = `${log.service}-${log.operation}-${JSON.stringify(log.details.requestBody)}`;
      } else {
        key = `${log.service}-${log.operation}-${log.message}-${log.userId || ''}`;
      }
      
      if (operationMap.has(key)) {
        const previous = operationMap.get(key);
        const timeDiff = new Date(log.timestamp) - new Date(previous.timestamp);
        
        if (timeDiff < 5000) {
          anomalies.push({
            type: ANOMALY_TYPES.DUPLICATE,
            description: `重复操作检测: ${log.operation} 在 ${timeDiff}ms 内重复执行`,
            timestamp: log.timestamp,
            affectedSteps: [previous.spanId, log.spanId]
          });
        }
      }
      
      if (log.status === 'SUCCESS') {
        operationMap.set(key, log);
      }
    });

    return anomalies;
  }

  static detectConcurrencyIssues(logs) {
    const anomalies = [];
    const resourceMap = new Map();

    logs.forEach(log => {
      if (log.details?.resourceId) {
        const resourceId = log.details.resourceId;
        
        if (!resourceMap.has(resourceId)) {
          resourceMap.set(resourceId, []);
        }
        resourceMap.get(resourceId).push(log);
      }
    });

    resourceMap.forEach((resourceLogs, resourceId) => {
      const writeOperations = resourceLogs.filter(
        log => ['UPDATE', 'DELETE', 'CREATE'].includes(log.operation)
      );
      
      for (let i = 0; i < writeOperations.length - 1; i++) {
        const current = writeOperations[i];
        const next = writeOperations[i + 1];
        
        const timeDiff = new Date(next.timestamp) - new Date(current.timestamp);
        
        if (current.userId !== next.userId && timeDiff < 1000) {
          anomalies.push({
            type: ANOMALY_TYPES.CONCURRENCY,
            description: `并发冲突: 用户 ${current.userId} 和 ${next.userId} 在 ${timeDiff}ms 内同时修改资源 ${resourceId}`,
            timestamp: next.timestamp,
            affectedSteps: [current.spanId, next.spanId]
          });
        }
      }
    });

    return anomalies;
  }

  static detectAsyncOutOfOrder(logs) {
    const anomalies = [];
    const asyncOperations = logs.filter(log => log.tags?.includes('async'));

    for (let i = 0; i < asyncOperations.length - 1; i++) {
      const current = asyncOperations[i];
      const next = asyncOperations[i + 1];

      if (current.details?.expectedOrder && 
          next.details?.expectedOrder &&
          current.details.expectedOrder > next.details.expectedOrder) {
        anomalies.push({
          type: ANOMALY_TYPES.ASYNC_OUT_OF_ORDER,
          description: `异步任务顺序错乱: 预期顺序 ${current.details.expectedOrder} -> ${next.details.expectedOrder}，但实际执行顺序相反`,
          timestamp: next.timestamp,
          affectedSteps: [current.spanId, next.spanId]
        });
      }
    }

    return anomalies;
  }

  static detectCacheStaleIssues(logs) {
    const anomalies = [];
    const cacheLogs = logs.filter(log => log.tags?.includes('cache'));

    for (let i = 0; i < cacheLogs.length; i++) {
      const log = cacheLogs[i];
      
      if (log.operation === 'CACHE_HIT' && log.details?.staleTime) {
        const staleTime = parseInt(log.details.staleTime);
        
        if (staleTime > 300000) {
          anomalies.push({
            type: ANOMALY_TYPES.CACHE_STALE,
            description: `缓存过期: ${log.details.cacheKey} 已过期 ${staleTime}ms 未更新`,
            timestamp: log.timestamp,
            affectedSteps: [log.spanId]
          });
        }
      }

      if (log.operation === 'DB_UPDATE' && log.details?.shouldInvalidateCache) {
        const nextCacheHit = cacheLogs.find(c => 
          c.operation === 'CACHE_HIT' && 
          new Date(c.timestamp) > new Date(log.timestamp) &&
          new Date(c.timestamp) - new Date(log.timestamp) < 60000
        );
        
        if (nextCacheHit && nextCacheHit.details?.cacheVersion !== log.details?.newVersion) {
          anomalies.push({
            type: ANOMALY_TYPES.CACHE_STALE,
            description: `缓存未更新: 数据库版本 ${log.details.newVersion} 但缓存仍为 ${nextCacheHit.details?.cacheVersion}`,
            timestamp: nextCacheHit.timestamp,
            affectedSteps: [log.spanId, nextCacheHit.spanId]
          });
        }
      }
    }

    return anomalies;
  }

  static detectRollbackFailures(logs) {
    const anomalies = [];
    const rollbackLogs = logs.filter(log => log.operation === 'ROLLBACK');

    rollbackLogs.forEach(rollbackLog => {
      if (rollbackLog.status === 'FAILED') {
        anomalies.push({
          type: ANOMALY_TYPES.ROLLBACK_FAILED,
          description: `数据回滚失败: ${rollbackLog.message}`,
          timestamp: rollbackLog.timestamp,
          affectedSteps: [rollbackLog.spanId]
        });
      }
    });

    return anomalies;
  }

  static async markAnomaliesInLogs(traceId, anomalies) {
    const affectedSpanIds = new Set();
    anomalies.forEach(a => a.affectedSteps.forEach(id => affectedSpanIds.add(id)));

    for (const spanId of affectedSpanIds) {
      const logAnomalies = anomalies
        .filter(a => a.affectedSteps.includes(spanId))
        .map(a => a.type);

      await DataAccess.updateLog(
        { spanId },
        { $addToSet: { anomalies: { $each: logAnomalies } } }
      );
    }
  }
}

module.exports = AnomalyDetector;
