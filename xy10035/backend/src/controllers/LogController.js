const { v4: uuidv4 } = require('uuid');
const asyncHandler = require('express-async-handler');
const DataAccess = require('../data/DataAccess');
const AnomalyDetector = require('../services/AnomalyDetector');

class LogController {
  static ingest = asyncHandler(async (req, res) => {
    const logs = Array.isArray(req.body) ? req.body : [req.body];
    
    const createdLogs = [];
    
    for (const log of logs) {
      const logData = {
        traceId: log.traceId || uuidv4(),
        spanId: log.spanId || uuidv4(),
        parentSpanId: log.parentSpanId || null,
        timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
        level: log.level || 'INFO',
        source: log.source,
        service: log.service,
        operation: log.operation,
        message: log.message,
        userId: log.userId,
        requestId: log.requestId,
        details: log.details || {},
        status: log.status || 'PROCESSING',
        duration: log.duration || 0,
        tags: log.tags || [],
        anomalies: log.anomalies || []
      };
      
      const savedLog = await DataAccess.saveLog(logData);
      createdLogs.push(savedLog);
      
      await this.updateOrCreateTraceSession(savedLog);
    }
    
    res.status(201).json({
      success: true,
      count: createdLogs.length,
      logs: createdLogs
    });
  });

  static async updateOrCreateTraceSession(logEntry) {
    const { traceId } = logEntry;
    
    let session = await DataAccess.findSession({ traceId });
    
    if (!session) {
      session = await DataAccess.saveSession({
        traceId,
        startTime: logEntry.timestamp,
        userId: logEntry.userId,
        services: [logEntry.service],
        status: 'RUNNING',
        totalSteps: 1,
        successSteps: logEntry.status === 'SUCCESS' ? 1 : 0,
        failedSteps: logEntry.status === 'FAILED' ? 1 : 0,
        anomalies: []
      });
    } else {
      const updatedSession = {
        traceId,
        totalSteps: session.totalSteps + 1,
        successSteps: session.successSteps + (logEntry.status === 'SUCCESS' ? 1 : 0),
        failedSteps: session.failedSteps + (logEntry.status === 'FAILED' ? 1 : 0),
        services: session.services.includes(logEntry.service) 
          ? session.services 
          : [...session.services, logEntry.service]
      };
      
      if (logEntry.status === 'END' || logEntry.operation === 'SESSION_END') {
        updatedSession.endTime = logEntry.timestamp;
        
        if (updatedSession.failedSteps > 0) {
          updatedSession.status = 'FAILED';
        } else if (updatedSession.successSteps > 0) {
          updatedSession.status = 'COMPLETED';
        } else {
          updatedSession.status = session.status;
        }
      } else {
        updatedSession.status = session.status;
      }
      
      session = await DataAccess.saveSession(updatedSession);
    }
    
    const anomalies = await AnomalyDetector.detectAnomalies(traceId);
    if (anomalies.length > 0) {
      const status = session.failedSteps > 0 ? 'FAILED' : 'PARTIAL';
      session = await DataAccess.saveSession({
        traceId,
        anomalies,
        status
      });
      await AnomalyDetector.markAnomaliesInLogs(traceId, anomalies);
    }
    
    return session;
  }

  static search = asyncHandler(async (req, res) => {
    const {
      traceId,
      spanId,
      level,
      service,
      operation,
      userId,
      startTime,
      endTime,
      keywords,
      anomalies,
      page = 1,
      limit = 50
    } = req.query;

    const query = {};

    if (traceId) query.traceId = traceId;
    if (spanId) query.spanId = spanId;
    if (level) query.level = level;
    if (service) query.service = service;
    if (operation) query.operation = operation;
    if (userId) query.userId = userId;
    
    if (startTime || endTime) {
      query.timestamp = {};
      if (startTime) query.timestamp.$gte = new Date(startTime);
      if (endTime) query.timestamp.$lte = new Date(endTime);
    }

    if (keywords) {
      query.$or = [
        { message: { $regex: keywords, $options: 'i' } },
        { operation: { $regex: keywords, $options: 'i' } },
        { service: { $regex: keywords, $options: 'i' } }
      ];
    }

    if (anomalies) {
      const anomalyList = anomalies.split(',').map(a => a.trim());
      query.anomalies = { $in: anomalyList };
    }

    const skip = (page - 1) * limit;
    
    const [logs, total] = await Promise.all([
      DataAccess.findLogs(query, {
        sort: { timestamp: -1 },
        skip,
        limit: parseInt(limit)
      }),
      DataAccess.countLogs(query)
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  });

  static getById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    const log = await DataAccess.findLogById(id);
    
    if (!log) {
      res.status(404);
      throw new Error('Log not found');
    }
    
    res.json({
      success: true,
      data: log
    });
  });

  static getStatistics = asyncHandler(async (req, res) => {
    const { startTime, endTime, service } = req.query;
    
    const query = {};
    
    if (startTime || endTime) {
      query.timestamp = {};
      if (startTime) query.timestamp.$gte = new Date(startTime);
      if (endTime) query.timestamp.$lte = new Date(endTime);
    }
    
    if (service) {
      query.service = service;
    }

    const stats = await DataAccess.getLogStatistics(query);
    const recentErrors = await DataAccess.getRecentErrors(query, 10);

    res.json({
      success: true,
      data: {
        total: stats.total,
        byLevel: stats.byLevel.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
        byService: stats.byService,
        byStatus: stats.byStatus.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
        recentErrors
      }
    });
  });

  static getServices = asyncHandler(async (req, res) => {
    const services = await DataAccess.getDistinctServices();
    
    res.json({
      success: true,
      data: services
    });
  });

  static deleteOldLogs = asyncHandler(async (req, res) => {
    const { days = 90 } = req.query;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const result = await DataAccess.deleteOldLogs(cutoffDate);
    
    res.json({
      success: true,
      deletedCount: result.deletedCount,
      cutoffDate
    });
  });
}

module.exports = LogController;
