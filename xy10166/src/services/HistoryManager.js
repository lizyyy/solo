const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

class HistoryManager {
  constructor() {
    this.historyDir = path.join(process.cwd(), 'data', 'history');
    this._ensureDirectory();
  }

  _ensureDirectory() {
    if (!fs.existsSync(this.historyDir)) {
      fs.mkdirSync(this.historyDir, { recursive: true });
    }
  }

  _getHistoryFile() {
    return path.join(this.historyDir, 'check_history.json');
  }

  async saveCheckResult(result) {
    const historyFile = this._getHistoryFile();
    let history = [];

    if (fs.existsSync(historyFile)) {
      try {
        history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
      } catch (e) {
        history = [];
      }
    }

    const historyEntry = {
      id: 'check_' + Date.now(),
      timestamp: new Date().toISOString(),
      type: result.type || 'conflict_check',
      summary: {
        totalAppointments: result.totalAppointments,
        checkedAppointments: result.checkedAppointments,
        midnightAppointments: result.midnightAppointments || 0,
        conflictCount: result.conflicts ? result.conflicts.length : 0,
        statistics: result.statistics || {}
      },
      message: result.message,
      conflictIds: result.conflicts ? result.conflicts.map(c => c.id) : []
    };

    history.unshift(historyEntry);
    
    if (history.length > 100) {
      history = history.slice(0, 100);
    }

    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), 'utf-8');
    return historyEntry;
  }

  async getHistory(options = {}) {
    const { limit = 10, offset = 0, type = null } = options;
    const historyFile = this._getHistoryFile();

    if (!fs.existsSync(historyFile)) {
      return { entries: [], total: 0 };
    }

    let history = [];
    try {
      history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
    } catch (e) {
      return { entries: [], total: 0 };
    }

    let filtered = history;
    if (type) {
      filtered = history.filter(h => h.type === type);
    }

    const paged = filtered.slice(offset, offset + limit);

    return {
      entries: paged,
      total: filtered.length,
      hasMore: offset + limit < filtered.length
    };
  }

  async getHistoryEntry(id) {
    const historyFile = this._getHistoryFile();
    if (!fs.existsSync(historyFile)) {
      return null;
    }

    let history = [];
    try {
      history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
    } catch (e) {
      return null;
    }

    return history.find(h => h.id === id) || null;
  }

  async clearHistory() {
    const historyFile = this._getHistoryFile();
    if (fs.existsSync(historyFile)) {
      fs.unlinkSync(historyFile);
    }
    return { cleared: true };
  }

  async compareWithPrevious(currentResult) {
    const { entries } = await this.getHistory({ limit: 2 });
    
    if (entries.length < 2) {
      return {
        hasPrevious: false,
        message: '没有足够的历史记录进行对比'
      };
    }

    const previous = entries[1];
    const current = {
      totalAppointments: currentResult.totalAppointments,
      conflictCount: currentResult.conflicts ? currentResult.conflicts.length : 0,
      statistics: currentResult.statistics || {}
    };

    const diff = {
      appointmentChange: current.totalAppointments - previous.summary.totalAppointments,
      conflictChange: current.conflictCount - previous.summary.conflictCount,
      severityChanges: {}
    };

    const types = ['high', 'medium', 'low'];
    for (const type of types) {
      diff.severityChanges[type] = 
        (current.statistics.bySeverity?.[type] || 0) - 
        (previous.summary.statistics.bySeverity?.[type] || 0);
    }

    return {
      hasPrevious: true,
      previousCheckTime: previous.timestamp,
      currentCheckTime: currentResult.timestamp,
      diff,
      message: this._generateDiffMessage(diff)
    };
  }

  _generateDiffMessage(diff) {
    const parts = [];
    
    if (diff.appointmentChange !== 0) {
      parts.push(`预约数量${diff.appointmentChange > 0 ? '增加' : '减少'}了 ${Math.abs(diff.appointmentChange)} 个`);
    }
    
    if (diff.conflictChange !== 0) {
      parts.push(`冲突数量${diff.conflictChange > 0 ? '增加' : '减少'}了 ${Math.abs(diff.conflictChange)} 个`);
    }

    const severityChanges = [];
    if (diff.severityChanges.high !== 0) {
      severityChanges.push(`严重${diff.severityChanges.high > 0 ? '+': ''}${diff.severityChanges.high}`);
    }
    if (diff.severityChanges.medium !== 0) {
      severityChanges.push(`中等${diff.severityChanges.medium > 0 ? '+': ''}${diff.severityChanges.medium}`);
    }
    if (diff.severityChanges.low !== 0) {
      severityChanges.push(`轻微${diff.severityChanges.low > 0 ? '+': ''}${diff.severityChanges.low}`);
    }
    
    if (severityChanges.length > 0) {
      parts.push(`（${severityChanges.join('，')}）`);
    }

    return parts.length > 0 ? parts.join('') : '与上次检查无显著变化';
  }
}

module.exports = HistoryManager;
