const { EVENT_TYPES } = require('./constants');

class Statistics {
  constructor() {
    this.stats = {
      totalRecords: 0,
      overflow: {
        total: 0,
        bySkillGroup: {},
        byTime: {}
      },
      abandon: {
        total: 0,
        bySkillGroup: {},
        byTime: {}
      },
      queueHold: {
        total: 0,
        details: []
      },
      visitorRefresh: {
        total: 0,
        details: []
      },
      skillGroupRename: {
        total: 0,
        details: []
      },
      files: new Set(),
      timeRange: {
        start: null,
        end: null
      }
    };
  }

  addRecord(record) {
    this.stats.totalRecords++;
    this.stats.files.add(record.fileName);

    if (record.timestamp) {
      this.updateTimeRange(record.timestamp);
    }

    const skillGroup = record.skillGroup || '未知技能组';
    const timeBucket = this.getTimeBucket(record.timestamp);

    record.events.forEach(event => {
      switch (event) {
        case EVENT_TYPES.OVERFLOW:
          this.addOverflow(record, skillGroup, timeBucket);
          break;
        case EVENT_TYPES.ABANDON:
          this.addAbandon(record, skillGroup, timeBucket);
          break;
        case EVENT_TYPES.QUEUE_HOLD:
          this.addQueueHold(record);
          break;
        case EVENT_TYPES.VISITOR_REFRESH:
          this.addVisitorRefresh(record);
          break;
        case EVENT_TYPES.SKILL_GROUP_RENAME:
          this.addSkillGroupRename(record);
          break;
      }
    });
  }

  addOverflow(record, skillGroup, timeBucket) {
    this.stats.overflow.total++;
    this.stats.overflow.bySkillGroup[skillGroup] = 
      (this.stats.overflow.bySkillGroup[skillGroup] || 0) + 1;
    if (timeBucket) {
      this.stats.overflow.byTime[timeBucket] = 
        (this.stats.overflow.byTime[timeBucket] || 0) + 1;
    }
  }

  addAbandon(record, skillGroup, timeBucket) {
    this.stats.abandon.total++;
    this.stats.abandon.bySkillGroup[skillGroup] = 
      (this.stats.abandon.bySkillGroup[skillGroup] || 0) + 1;
    if (timeBucket) {
      this.stats.abandon.byTime[timeBucket] = 
        (this.stats.abandon.byTime[timeBucket] || 0) + 1;
    }
  }

  addQueueHold(record) {
    this.stats.queueHold.total++;
    this.stats.queueHold.details.push({
      fileName: record.fileName,
      lineNumber: record.lineNumber,
      timestamp: record.timestamp,
      visitorId: record.visitorId,
      skillGroup: record.skillGroup
    });
  }

  addVisitorRefresh(record) {
    this.stats.visitorRefresh.total++;
    this.stats.visitorRefresh.details.push({
      fileName: record.fileName,
      lineNumber: record.lineNumber,
      timestamp: record.timestamp,
      visitorId: record.visitorId
    });
  }

  addSkillGroupRename(record) {
    this.stats.skillGroupRename.total++;
    this.stats.skillGroupRename.details.push({
      fileName: record.fileName,
      lineNumber: record.lineNumber,
      timestamp: record.timestamp,
      lineContent: record.lineContent
    });
  }

  updateTimeRange(timestamp) {
    const time = new Date(timestamp).getTime();
    if (!this.stats.timeRange.start || time < new Date(this.stats.timeRange.start).getTime()) {
      this.stats.timeRange.start = timestamp;
    }
    if (!this.stats.timeRange.end || time > new Date(this.stats.timeRange.end).getTime()) {
      this.stats.timeRange.end = timestamp;
    }
  }

  getTimeBucket(timestamp) {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
  }

  getSummary() {
    return {
      reportTitle: '在线客服排队日志技能组溢出统计报告',
      generatedAt: new Date().toISOString(),
      timeRange: this.stats.timeRange,
      filesProcessed: Array.from(this.stats.files),
      totalRecords: this.stats.totalRecords,
      overflowSummary: {
        total: this.stats.overflow.total,
        bySkillGroup: this.sortByCount(this.stats.overflow.bySkillGroup)
      },
      abandonSummary: {
        total: this.stats.abandon.total,
        bySkillGroup: this.sortByCount(this.stats.abandon.bySkillGroup)
      },
      otherEvents: {
        queueHold: this.stats.queueHold.total,
        visitorRefresh: this.stats.visitorRefresh.total,
        skillGroupRename: this.stats.skillGroupRename.total
      },
      specialEventReferences: {
        queueHold: this.stats.queueHold.details.map(d => `${d.fileName}:${d.lineNumber}`),
        visitorRefresh: this.stats.visitorRefresh.details.map(d => `${d.fileName}:${d.lineNumber}`),
        skillGroupRename: this.stats.skillGroupRename.details.map(d => `${d.fileName}:${d.lineNumber}`)
      }
    };
  }

  getDetailedReport() {
    return {
      ...this.getSummary(),
      detailedRecords: {
        queueHold: this.stats.queueHold.details,
        visitorRefresh: this.stats.visitorRefresh.details,
        skillGroupRename: this.stats.skillGroupRename.details
      }
    };
  }

  sortByCount(obj) {
    return Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});
  }

  reset() {
    this.stats = {
      totalRecords: 0,
      overflow: {
        total: 0,
        bySkillGroup: {},
        byTime: {}
      },
      abandon: {
        total: 0,
        bySkillGroup: {},
        byTime: {}
      },
      queueHold: {
        total: 0,
        details: []
      },
      visitorRefresh: {
        total: 0,
        details: []
      },
      skillGroupRename: {
        total: 0,
        details: []
      },
      files: new Set(),
      timeRange: {
        start: null,
        end: null
      }
    };
  }
}

module.exports = Statistics;
