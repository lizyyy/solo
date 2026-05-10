const { v4: uuidv4 } = require('uuid');

class ExposureLog {
  constructor() {
    this.logs = [];
  }
  
  record(requestId, userId, selectedSources, degradationInfo, results, timestamp = Date.now()) {
    const logEntry = {
      id: uuidv4(),
      requestId,
      userId,
      timestamp,
      selectedSources: selectedSources.map(s => ({
        id: s.id,
        name: s.name,
        state: s.currentState,
        weight: s.getWeight()
      })),
      degradationInfo: {
        isDegraded: degradationInfo.isDegraded,
        reason: degradationInfo.reason,
        skippedSources: degradationInfo.skippedSources
      },
      results: results
    };
    
    this.logs.push(logEntry);
    return logEntry;
  }
  
  getLogs(filter = {}) {
    let result = [...this.logs];
    
    if (filter.startTime) {
      result = result.filter(l => l.timestamp >= filter.startTime);
    }
    
    if (filter.endTime) {
      result = result.filter(l => l.timestamp <= filter.endTime);
    }
    
    if (filter.userId) {
      result = result.filter(l => l.userId === filter.userId);
    }
    
    if (filter.sourceId) {
      result = result.filter(l => 
        l.selectedSources.some(s => s.id === filter.sourceId)
      );
    }
    
    return result;
  }
  
  generateReport(startTime, endTime) {
    const logs = this.getLogs({ startTime, endTime });
    
    const sourceStats = {};
    let totalRequests = logs.length;
    let degradedRequests = 0;
    
    logs.forEach(log => {
      if (log.degradationInfo.isDegraded) {
        degradedRequests++;
      }
      
      log.selectedSources.forEach(source => {
        if (!sourceStats[source.id]) {
          sourceStats[source.id] = {
            id: source.id,
            name: source.name,
            totalExposures: 0,
            healthyExposures: 0,
            degradedExposures: 0,
            circuitBreakerExposures: 0,
            probingExposures: 0
          };
        }
        
        sourceStats[source.id].totalExposures++;
        
        switch (source.state) {
          case 'HEALTHY':
            sourceStats[source.id].healthyExposures++;
            break;
          case 'DEGRADED':
            sourceStats[source.id].degradedExposures++;
            break;
          case 'CIRCUIT_BREAKER_OPEN':
            sourceStats[source.id].circuitBreakerExposures++;
            break;
          case 'PROBING':
            sourceStats[source.id].probingExposures++;
            break;
        }
      });
    });
    
    return {
      period: {
        startTime,
        endTime
      },
      summary: {
        totalRequests,
        degradedRequests,
        degradationRate: totalRequests > 0 ? (degradedRequests / totalRequests) : 0,
        sourceCount: Object.keys(sourceStats).length
      },
      sourceStats: Object.values(sourceStats)
    };
  }
  
  toJSON() {
    return {
      totalLogs: this.logs.length,
      logs: this.logs.slice(-100)
    };
  }
}

module.exports = {
  ExposureLog
};