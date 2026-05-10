const express = require('express');

function createReportsRouter(service) {
  const router = express.Router();

  router.get('/summary', (req, res) => {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    const { startTime, endTime } = req.query;
    const actualStart = startTime ? parseInt(startTime) : oneHourAgo;
    const actualEnd = endTime ? parseInt(endTime) : now;

    const report = service.getReport(actualStart, actualEnd);

    res.json({
      success: true,
      data: report
    });
  });

  router.get('/exposures', (req, res) => {
    const filter = {};

    if (req.query.startTime) {
      filter.startTime = parseInt(req.query.startTime);
    }
    if (req.query.endTime) {
      filter.endTime = parseInt(req.query.endTime);
    }
    if (req.query.userId) {
      filter.userId = req.query.userId;
    }
    if (req.query.sourceId) {
      filter.sourceId = req.query.sourceId;
    }

    const logs = service.getExposureLogs(filter);

    res.json({
      success: true,
      data: {
        count: logs.length,
        logs: logs.slice(-100)
      }
    });
  });

  router.get('/health', (req, res) => {
    const sources = service.getAllSources();
    const now = Date.now();

    const healthSummary = {
      totalSources: sources.length,
      healthyCount: 0,
      degradedCount: 0,
      circuitBreakerCount: 0,
      probingCount: 0,
      sourceDetails: []
    };

    sources.forEach(source => {
      const json = source.toJSON();
      healthSummary.sourceDetails.push({
        id: source.id,
        name: source.name,
        state: source.currentState,
        consecutiveFailures: source.consecutiveFailures,
        metrics: json.metrics,
        isAvailable: source.isAvailableForRequest(),
        weight: source.getWeight()
      });

      switch (source.currentState) {
        case 'HEALTHY':
          healthSummary.healthyCount++;
          break;
        case 'DEGRADED':
          healthSummary.degradedCount++;
          break;
        case 'CIRCUIT_BREAKER_OPEN':
          healthSummary.circuitBreakerCount++;
          break;
        case 'PROBING':
          healthSummary.probingCount++;
          break;
      }
    });

    const isDegraded = healthSummary.degradedCount > 0 || healthSummary.circuitBreakerCount > 0;

    res.json({
      success: true,
      data: {
        service: 'recall-degradation-service',
        status: isDegraded ? 'DEGRADED' : 'HEALTHY',
        timestamp: now,
        ...healthSummary
      }
    });
  });

  return router;
}

module.exports = {
  createReportsRouter
};