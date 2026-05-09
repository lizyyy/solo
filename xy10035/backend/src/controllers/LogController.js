const { v4: uuidv4 } = require('uuid');
const asyncHandler = require('express-async-handler');
const LogEntry = require('../models/LogEntry');
const TraceSession = require('../models/TraceSession');
const AnomalyDetector = require('../services/AnomalyDetector');

class LogController {
  static ingest = asyncHandler(async (req, res) => {
    const logs = Array.isArray(req.body) ? req.body : [req.body];
    
    const createdLogs = [];
    
    for (const log of logs) {
      const logEntry = new LogEntry({
        traceId: log.traceId || uuidv4(),
        spanId: log.spanId || uuidv4(),
        parentSpanId: log.parentSpanId || null,
        timestamp: log.timestamp || new Date(),
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
      });
      
      createdLogs.push(await logEntry.save());
      
      await this.updateOrCreateTraceSession(logEntry);
    }
    
    res.status(201).json({
      success: true,
      count: createdLogs.length,
      logs: createdLogs
    });
  });

  static async updateOrCreateTraceSession(logEntry) {
    const { traceId } = logEntry;
    
    let session = await TraceSession.findOne({ traceId });
    
    if (!session) {
      session = new TraceSession({
        traceId,
        startTime: logEntry.timestamp,
        userId: logEntry.userId,
        services: [logEntry.service],
        status: 'RUNNING',
        totalSteps: 1,
        successSteps: logEntry.status === 'SUCCESS' ? 1 : 0,
        failedSteps: logEntry.status === 'FAILED' ? 1 : 0
      });
    } else {
      session.totalSteps++;
      
      if (logEntry.status === 'SUCCESS') {
        session.successSteps++;
      } else if (logEntry.status === 'FAILED') {
        session.failedSteps++;
      }
      
      if (!session.services.includes(logEntry.service)) {
        session.services.push(logEntry.service);
      }
      
      if (logEntry.status === 'END' || logEntry.operation === 'SESSION_END') {
        session.endTime = logEntry.timestamp;
        
        if (session.failedSteps > 0) {
          session.status = 'FAILED';
        } else if (session.successSteps > 0) {
          session.status = 'COMPLETED';
        }
      }
    }
    
    await session.save();
    
    const anomalies = await AnomalyDetector.detectAnomalies(traceId);
    if (anomalies.length > 0) {
      session.anomalies = anomalies;
      session.status = session.failedSteps > 0 ? 'FAILED' : 'PARTIAL';
      await session.save();
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
      LogEntry.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      LogEntry.countDocuments(query)
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
    
    const log = await LogEntry.findById(id);
    
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
    
    const match = {};
    
    if (startTime || endTime) {
      match.timestamp = {};
      if (startTime) match.timestamp.$gte = new Date(startTime);
      if (endTime) match.timestamp.$lte = new Date(endTime);
    }
    
    if (service) {
      match.service = service;
    }

    const [byLevel, byService, byStatus, total] = await Promise.all([
      LogEntry.aggregate([
        { $match: match },
        { $group: { _id: '$level', count: { $sum: 1 } } }
      ]),
      LogEntry.aggregate([
        { $match: match },
        { $group: { _id: '$service', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      LogEntry.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      LogEntry.countDocuments(match)
    ]);

    const recentErrors = await LogEntry.find({
      ...match,
      level: { $in: ['ERROR', 'FATAL'] }
    })
      .sort({ timestamp: -1 })
      .limit(10);

    res.json({
      success: true,
      data: {
        total,
        byLevel: byLevel.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
        byService,
        byStatus: byStatus.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
        recentErrors
      }
    });
  });

  static getServices = asyncHandler(async (req, res) => {
    const services = await LogEntry.distinct('service');
    
    res.json({
      success: true,
      data: services
    });
  });

  static deleteOldLogs = asyncHandler(async (req, res) => {
    const { days = 90 } = req.query;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const result = await LogEntry.deleteMany({ timestamp: { $lt: cutoffDate } });
    
    res.json({
      success: true,
      deletedCount: result.deletedCount,
      cutoffDate
    });
  });
}

module.exports = LogController;
