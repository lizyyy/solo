const storage = require('../models/storage');
const eventBus = require('../utils/eventBus');

class ReportService {
  generateDailyReport(dateStr = null) {
    const targetDate = dateStr ? new Date(dateStr).toDateString() : new Date().toDateString();
    const history = storage.getHistory();
    const queue = storage.getQueue();

    const dayHistory = history.filter(h => 
      new Date(h.timestamp).toDateString() === targetDate
    );

    const dailyQueue = queue.filter(t => 
      new Date(t.createdAt).toDateString() === targetDate
    );

    const stats = {
      date: targetDate,
      totalQueue: dailyQueue.length,
      byTableType: this._groupByTableType(dailyQueue),
      byStatus: this._groupByStatus(dailyQueue),
      seatingRate: this._calculateSeatingRate(dailyQueue),
      averageWaitTime: this._calculateAverageWaitTime(dailyQueue),
      overtimeCount: dailyQueue.filter(t => t.skipCount > 0).length,
      memberStats: this._calculateMemberStats(dailyQueue),
      peakHours: this._findPeakHours(dayHistory),
      manualAdjustments: dayHistory.filter(h => h.eventType === 'QUEUE.MANUAL_ADJUST').length,
      notificationCount: dayHistory.filter(h => h.eventType === 'NOTIFICATION.SEND').length,
      combineOperations: dayHistory.filter(h => h.eventType === 'TABLE.COMBINE').length,
      splitOperations: dayHistory.filter(h => h.eventType === 'TABLE.SPLIT').length,
      eventFlow: this._getEventFlow(dayHistory)
    };

    eventBus.emitEvent('REPORT.GENERATE', {
      reportType: 'DAILY',
      timeRange: targetDate,
      summary: {
        total: stats.totalQueue,
        seatingRate: stats.seatingRate
      }
    });

    return stats;
  }

  _groupByTableType(queue) {
    const result = {};
    queue.forEach(t => {
      result[t.tableType] = result[t.tableType] || { total: 0, seated: 0, canceled: 0 };
      result[t.tableType].total++;
      if (t.status === 'SEATED') result[t.tableType].seated++;
      if (t.status === 'CANCELED') result[t.tableType].canceled++;
    });
    return result;
  }

  _groupByStatus(queue) {
    const result = {
      WAITING: 0,
      CALLED: 0,
      OVERTIME: 0,
      SEATED: 0,
      CANCELED: 0
    };
    queue.forEach(t => {
      result[t.status] = (result[t.status] || 0) + 1;
    });
    return result;
  }

  _calculateSeatingRate(queue) {
    const total = queue.length;
    const seated = queue.filter(t => t.status === 'SEATED').length;
    return total > 0 ? Math.round((seated / total) * 100) : 0;
  }

  _calculateAverageWaitTime(queue) {
    const seated = queue.filter(t => t.status === 'SEATED' && t.calledAt && t.createdAt);
    if (seated.length === 0) return 0;
    
    const totalMinutes = seated.reduce((sum, t) => {
      const wait = (new Date(t.calledAt) - new Date(t.createdAt)) / (1000 * 60);
      return sum + wait;
    }, 0);
    
    return Math.round(totalMinutes / seated.length);
  }

  _calculateMemberStats(queue) {
    const members = queue.filter(t => t.isMember);
    const nonMembers = queue.filter(t => !t.isMember);
    
    return {
      memberCount: members.length,
      memberSeatingRate: members.length > 0 
        ? Math.round((members.filter(t => t.status === 'SEATED').length / members.length) * 100)
        : 0,
      nonMemberCount: nonMembers.length,
      nonMemberSeatingRate: nonMembers.length > 0
        ? Math.round((nonMembers.filter(t => t.status === 'SEATED').length / nonMembers.length) * 100)
        : 0
    };
  }

  _findPeakHours(history) {
    const hours = {};
    history.forEach(h => {
      const hour = new Date(h.timestamp).getHours();
      hours[hour] = (hours[hour] || 0) + 1;
    });
    
    const sorted = Object.entries(hours).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, 3).map(([hour, count]) => ({
      hour: `${hour}:00-${hour + 1}:00`,
      eventCount: count
    }));
  }

  _getEventFlow(history) {
    return history
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map(h => ({
        time: new Date(h.timestamp).toLocaleTimeString(),
        type: h.eventType,
        details: h.details
      }))
      .slice(-50);
  }

  getHistory(filter = {}) {
    let history = storage.getHistory();
    
    if (filter.eventType) {
      history = history.filter(h => h.eventType === filter.eventType);
    }
    if (filter.startDate) {
      const start = new Date(filter.startDate).getTime();
      history = history.filter(h => new Date(h.timestamp).getTime() >= start);
    }
    if (filter.endDate) {
      const end = new Date(filter.endDate).getTime();
      history = history.filter(h => new Date(h.timestamp).getTime() <= end);
    }
    if (filter.ticketId) {
      history = history.filter(h => h.payload && h.payload.ticketId === filter.ticketId);
    }
    
    return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  getTicketHistory(ticketId) {
    const history = storage.getHistory();
    const events = history.filter(h => 
      h.payload && (h.payload.ticketId === ticketId || (h.payload.queueNumber && h.payload.queueNumber === this._getQueueNumber(ticketId)))
    );
    
    return {
      ticketId,
      events: events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    };
  }

  _getQueueNumber(ticketId) {
    const queue = storage.getQueue();
    const ticket = queue.find(t => t.id === ticketId);
    return ticket ? ticket.queueNumber : null;
  }

  getCurrentStatusSummary() {
    const queue = storage.getQueue();
    const tables = storage.getTables();
    
    return {
      queue: {
        total: queue.length,
        waiting: queue.filter(t => t.status === 'WAITING').length,
        called: queue.filter(t => t.status === 'CALLED').length,
        overtime: queue.filter(t => t.status === 'OVERTIME').length,
        byType: {
          SMALL: queue.filter(t => t.tableType === 'SMALL' && ['WAITING', 'CALLED'].includes(t.status)).length,
          MEDIUM: queue.filter(t => t.tableType === 'MEDIUM' && ['WAITING', 'CALLED'].includes(t.status)).length,
          LARGE: queue.filter(t => t.tableType === 'LARGE' && ['WAITING', 'CALLED'].includes(t.status)).length
        }
      },
      tables: {
        total: tables.length,
        available: tables.filter(t => t.status === 'AVAILABLE').length,
        occupied: tables.filter(t => t.status === 'OCCUPIED').length,
        combined: tables.filter(t => t.isCombined).length
      }
    };
  }
}

module.exports = new ReportService();
