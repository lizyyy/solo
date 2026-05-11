const { v4: uuidv4 } = require('uuid');
const { 
  isInFallbackMode, 
  getInMemoryLogs, 
  getInMemorySessions, 
  getInMemoryReports,
  addInMemoryLog,
  addInMemorySession,
  addInMemoryReport
} = require('../config/database');

const LogEntry = require('../models/LogEntry');
const TraceSession = require('../models/TraceSession');
const AnalysisReport = require('../models/AnalysisReport');

class DataAccess {
  static async saveLog(logData) {
    if (isInFallbackMode()) {
      const log = {
        ...logData,
        _id: `log-${uuidv4()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: function() { return this; }
      };
      addInMemoryLog(log);
      return log;
    }
    
    const log = new LogEntry(logData);
    return await log.save();
  }

  static async findLogs(query = {}, options = {}) {
    if (isInFallbackMode()) {
      let logs = [...getInMemoryLogs()];
      
      if (query.traceId) {
        logs = logs.filter(l => l.traceId === query.traceId);
      }
      if (query.spanId) {
        logs = logs.filter(l => l.spanId === query.spanId);
      }
      if (query.level) {
        logs = logs.filter(l => l.level === query.level);
      }
      if (query.service) {
        logs = logs.filter(l => l.service === query.service);
      }
      if (query.operation) {
        logs = logs.filter(l => l.operation === query.operation);
      }
      if (query.userId) {
        logs = logs.filter(l => l.userId === query.userId);
      }
      if (query.timestamp) {
        if (query.timestamp.$gte) {
          logs = logs.filter(l => new Date(l.timestamp) >= query.timestamp.$gte);
        }
        if (query.timestamp.$lte) {
          logs = logs.filter(l => new Date(l.timestamp) <= query.timestamp.$lte);
        }
      }
      if (query.$or) {
        const regexKeys = query.$or.map(item => Object.keys(item)[0]);
        const searchTerm = query.$or[0][regexKeys[0]].$regex;
        const regex = new RegExp(searchTerm, 'i');
        logs = logs.filter(l => 
          regexKeys.some(key => regex.test(l[key] || ''))
        );
      }
      if (query.anomalies && query.anomalies.$in) {
        logs = logs.filter(l => 
          l.anomalies && l.anomalies.some(a => query.anomalies.$in.includes(a))
        );
      }
      
      if (options.sort) {
        const sortKeys = Object.keys(options.sort);
        logs.sort((a, b) => {
          for (const key of sortKeys) {
            const order = options.sort[key];
            const valA = a[key] instanceof Date ? a[key].getTime() : 
                          typeof a[key] === 'string' && !isNaN(Date.parse(a[key])) ? new Date(a[key]).getTime() : a[key];
            const valB = b[key] instanceof Date ? b[key].getTime() : 
                          typeof b[key] === 'string' && !isNaN(Date.parse(b[key])) ? new Date(b[key]).getTime() : b[key];
            
            if (valA < valB) return -1 * order;
            if (valA > valB) return 1 * order;
          }
          return 0;
        });
      }
      
      if (options.skip) {
        logs = logs.slice(options.skip);
      }
      if (options.limit) {
        logs = logs.slice(0, options.limit);
      }
      
      return logs;
    }
    
    let cursor = LogEntry.find(query);
    
    if (options.sort) {
      cursor = cursor.sort(options.sort);
    }
    if (options.skip) {
      cursor = cursor.skip(options.skip);
    }
    if (options.limit) {
      cursor = cursor.limit(options.limit);
    }
    
    return await cursor;
  }

  static async countLogs(query = {}) {
    if (isInFallbackMode()) {
      const logs = await this.findLogs(query);
      return logs.length;
    }
    return await LogEntry.countDocuments(query);
  }

  static async findLogById(id) {
    if (isInFallbackMode()) {
      const logs = getInMemoryLogs();
      return logs.find(l => l._id === id);
    }
    return await LogEntry.findById(id);
  }

  static async updateLog(query, update) {
    if (isInFallbackMode()) {
      const logs = getInMemoryLogs();
      const log = logs.find(l => l.spanId === query.spanId);
      if (log && update.$addToSet && update.$addToSet.anomalies) {
        const anomaliesToAdd = update.$addToSet.anomalies.$each || [update.$addToSet.anomalies];
        log.anomalies = [...new Set([...(log.anomalies || []), ...anomaliesToAdd])];
      }
      return log;
    }
    return await LogEntry.findOneAndUpdate(query, update);
  }

  static async getLogStatistics(query = {}) {
    if (isInFallbackMode()) {
      const logs = await this.findLogs(query);
      
      const byLevel = {};
      const byService = {};
      const byStatus = {};
      
      logs.forEach(log => {
        byLevel[log.level] = (byLevel[log.level] || 0) + 1;
        byService[log.service] = (byService[log.service] || 0) + 1;
        byStatus[log.status] = (byStatus[log.status] || 0) + 1;
      });
      
      const byLevelArr = Object.entries(byLevel).map(([k, v]) => ({ _id: k, count: v }));
      const byServiceArr = Object.entries(byService)
        .map(([k, v]) => ({ _id: k, count: v }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      const byStatusArr = Object.entries(byStatus).map(([k, v]) => ({ _id: k, count: v }));
      
      return { byLevel: byLevelArr, byService: byServiceArr, byStatus: byStatusArr, total: logs.length };
    }
    
    const [byLevel, byService, byStatus, total] = await Promise.all([
      LogEntry.aggregate([
        { $match: query },
        { $group: { _id: '$level', count: { $sum: 1 } } }
      ]),
      LogEntry.aggregate([
        { $match: query },
        { $group: { _id: '$service', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      LogEntry.aggregate([
        { $match: query },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      LogEntry.countDocuments(query)
    ]);
    
    return { byLevel, byService, byStatus, total };
  }

  static async getDistinctServices() {
    if (isInFallbackMode()) {
      const logs = getInMemoryLogs();
      const services = new Set(logs.map(l => l.service));
      return Array.from(services);
    }
    return await LogEntry.distinct('service');
  }

  static async getRecentErrors(query = {}, limit = 10) {
    if (isInFallbackMode()) {
      const logs = getInMemoryLogs().filter(
        l => (l.level === 'ERROR' || l.level === 'FATAL')
      );
      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return logs.slice(0, limit);
    }
    
    return await LogEntry.find({
      ...query,
      level: { $in: ['ERROR', 'FATAL'] }
    })
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  static async deleteOldLogs(cutoffDate) {
    if (isInFallbackMode()) {
      const logs = getInMemoryLogs();
      const initialCount = logs.length;
      const filtered = logs.filter(l => new Date(l.timestamp) >= cutoffDate);
      const deletedCount = initialCount - filtered.length;
      while (logs.length > 0) logs.pop();
      filtered.forEach(l => logs.push(l));
      return { deletedCount };
    }
    return await LogEntry.deleteMany({ timestamp: { $lt: cutoffDate } });
  }

  static async findSession(query = {}) {
    if (isInFallbackMode()) {
      const sessions = getInMemorySessions();
      return sessions.find(s => s.traceId === query.traceId);
    }
    return await TraceSession.findOne(query);
  }

  static async saveSession(sessionData) {
    if (isInFallbackMode()) {
      const sessions = getInMemorySessions();
      let session = sessions.find(s => s.traceId === sessionData.traceId);
      
      if (!session) {
        session = {
          ...sessionData,
          _id: `session-${uuidv4()}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          toObject: function() { return this; }
        };
        sessions.push(session);
      } else {
        Object.assign(session, sessionData, { updatedAt: new Date() });
      }
      
      return session;
    }
    
    let session = await TraceSession.findOne({ traceId: sessionData.traceId });
    
    if (!session) {
      session = new TraceSession(sessionData);
    } else {
      Object.assign(session, sessionData);
    }
    
    return await session.save();
  }

  static async findSessions(query = {}, options = {}) {
    if (isInFallbackMode()) {
      let sessions = [...getInMemorySessions()];
      
      if (query.userId) {
        sessions = sessions.filter(s => s.userId === query.userId);
      }
      if (query.status) {
        sessions = sessions.filter(s => s.status === query.status);
      }
      if (query['anomalies.0']) {
        sessions = sessions.filter(s => s.anomalies && s.anomalies.length > 0);
      }
      if (query.startTime) {
        if (query.startTime.$gte) {
          sessions = sessions.filter(s => new Date(s.startTime) >= query.startTime.$gte);
        }
        if (query.startTime.$lte) {
          sessions = sessions.filter(s => new Date(s.startTime) <= query.startTime.$lte);
        }
      }
      
      sessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
      
      if (options.skip) {
        sessions = sessions.slice(options.skip);
      }
      if (options.limit) {
        sessions = sessions.slice(0, options.limit);
      }
      
      return sessions;
    }
    
    let cursor = TraceSession.find(query);
    
    if (options.sort) {
      cursor = cursor.sort(options.sort);
    }
    if (options.skip) {
      cursor = cursor.skip(options.skip);
    }
    if (options.limit) {
      cursor = cursor.limit(options.limit);
    }
    
    return await cursor;
  }

  static async countSessions(query = {}) {
    if (isInFallbackMode()) {
      const sessions = await this.findSessions(query);
      return sessions.length;
    }
    return await TraceSession.countDocuments(query);
  }

  static async saveReport(reportData) {
    if (isInFallbackMode()) {
      const report = {
        ...reportData,
        _id: `report-${uuidv4()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        toObject: function() { return this; }
      };
      addInMemoryReport(report);
      return report;
    }
    
    const report = new AnalysisReport(reportData);
    return await report.save();
  }

  static async findReports(query = {}, options = {}) {
    if (isInFallbackMode()) {
      let reports = [...getInMemoryReports()];
      
      if (query.createdBy) {
        reports = reports.filter(r => r.createdBy === query.createdBy);
      }
      
      reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      if (options.limit) {
        reports = reports.slice(0, options.limit);
      }
      
      return reports;
    }
    
    let cursor = AnalysisReport.find(query);
    
    if (options.sort) {
      cursor = cursor.sort(options.sort);
    }
    if (options.limit) {
      cursor = cursor.limit(options.limit);
    }
    
    return await cursor;
  }

  static async findReportById(reportId) {
    if (isInFallbackMode()) {
      const reports = getInMemoryReports();
      return reports.find(r => r.reportId === reportId);
    }
    return await AnalysisReport.findOne({ reportId });
  }
}

module.exports = DataAccess;
