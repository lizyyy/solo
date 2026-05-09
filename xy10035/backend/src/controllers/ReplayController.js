const asyncHandler = require('express-async-handler');
const LogReplayService = require('../services/LogReplayService');
const TraceSession = require('../models/TraceSession');

class ReplayController {
  static getTimeline = asyncHandler(async (req, res) => {
    const { traceId } = req.params;
    
    const timeline = await LogReplayService.getReplayTimeline(traceId);
    
    res.json({
      success: true,
      data: timeline
    });
  });

  static getStep = asyncHandler(async (req, res) => {
    const { traceId, stepIndex } = req.params;
    
    const step = await LogReplayService.getReplayStep(traceId, parseInt(stepIndex) - 1);
    
    res.json({
      success: true,
      data: step
    });
  });

  static searchInTrace = asyncHandler(async (req, res) => {
    const { traceId } = req.params;
    const { q } = req.query;
    
    if (!q) {
      res.status(400);
      throw new Error('Search query is required');
    }
    
    const results = await LogReplayService.searchInTrace(traceId, q);
    
    res.json({
      success: true,
      data: results
    });
  });

  static getCriticalPath = asyncHandler(async (req, res) => {
    const { traceId } = req.params;
    
    const criticalPath = await LogReplayService.getCriticalPath(traceId);
    
    res.json({
      success: true,
      data: criticalPath
    });
  });

  static listTraces = asyncHandler(async (req, res) => {
    const {
      userId,
      status,
      hasAnomalies,
      startTime,
      endTime,
      page = 1,
      limit = 50
    } = req.query;

    const query = {};
    
    if (userId) query.userId = userId;
    if (status) query.status = status;
    if (hasAnomalies === 'true') {
      query['anomalies.0'] = { $exists: true };
    }
    
    if (startTime || endTime) {
      query.startTime = {};
      if (startTime) query.startTime.$gte = new Date(startTime);
      if (endTime) query.startTime.$lte = new Date(endTime);
    }

    const skip = (page - 1) * limit;
    
    const [traces, total] = await Promise.all([
      TraceSession.find(query)
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      TraceSession.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: traces,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  });

  static getTraceSummary = asyncHandler(async (req, res) => {
    const { traceId } = req.params;
    
    const timeline = await LogReplayService.getReplayTimeline(traceId);
    
    const summary = {
      traceId,
      startTime: timeline.session?.startTime,
      endTime: timeline.session?.endTime,
      status: timeline.session?.status,
      duration: timeline.timeline.duration,
      totalSteps: timeline.statistics.total,
      errors: timeline.statistics.byLevel.ERROR + timeline.statistics.byLevel.FATAL,
      warnings: timeline.statistics.byLevel.WARN,
      anomalies: timeline.statistics.anomalies.total,
      services: timeline.session?.services || [],
      anomalyTypes: Object.keys(timeline.statistics.anomalies.byType),
      successRate: timeline.statistics.total > 0 ? 
        Math.round((timeline.statistics.byStatus.SUCCESS / timeline.statistics.total) * 100) : 0
    };
    
    res.json({
      success: true,
      data: summary
    });
  });

  static exportTraceForReplay = asyncHandler(async (req, res) => {
    const { traceId } = req.params;
    
    const timeline = await LogReplayService.getReplayTimeline(traceId);
    
    const exportData = {
      traceId,
      exportTime: new Date().toISOString(),
      session: timeline.session,
      steps: timeline.timeline.flat.map(step => ({
        step: step.step,
        timestamp: step.timestamp,
        service: step.service,
        operation: step.operation,
        message: step.message,
        status: step.status,
        level: step.level,
        anomalies: step.anomalies,
        details: step.details
      })),
      statistics: timeline.statistics
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=trace-${traceId}.json`);
    
    res.json(exportData);
  });
}

module.exports = ReplayController;
