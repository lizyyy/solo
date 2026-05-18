export class Summarizer {
  constructor(options = {}) {
    this.templates = new Map();
    this.chats = new Map();
    this.differences = [];
  }

  compare(oldData, newData) {
    const oldRecords = this.buildRecordMap(oldData.records || []);
    const newRecords = this.buildRecordMap(newData.records || []);

    const allKeys = new Set([...oldRecords.keys(), ...newRecords.keys()]);

    for (const key of allKeys) {
      const oldRecord = oldRecords.get(key);
      const newRecord = newRecords.get(key);
      this.compareRecord(key, oldRecord, newRecord);
    }

    return this.generateSummary(oldData, newData);
  }

  buildRecordMap(records) {
    const map = new Map();
    for (const record of records) {
      const key = `${record.templateId}_${record.chatId}`;
      map.set(key, record);
      this.templates.set(record.templateId, record.templateName);
      this.chats.set(record.chatId, record.chatName);
    }
    return map;
  }

  compareRecord(key, oldRecord, newRecord) {
    if (oldRecord && !newRecord) {
      this.differences.push({
        type: 'RECORD_MISSING_IN_NEW',
        key,
        templateId: oldRecord.templateId,
        templateName: oldRecord.templateName,
        chatId: oldRecord.chatId,
        chatName: oldRecord.chatName,
        oldStatus: oldRecord.touchStatus,
        message: `记录在新版本中缺失: ${oldRecord.templateName} -> ${oldRecord.chatName}`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (!oldRecord && newRecord) {
      this.differences.push({
        type: 'NEW_RECORD_ADDED',
        key,
        templateId: newRecord.templateId,
        templateName: newRecord.templateName,
        chatId: newRecord.chatId,
        chatName: newRecord.chatName,
        newStatus: newRecord.touchStatus,
        message: `新版本新增记录: ${newRecord.templateName} -> ${newRecord.chatName}`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (oldRecord && newRecord) {
      this.compareStatus(oldRecord, newRecord);
      this.compareVariables(oldRecord, newRecord);
    }
  }

  compareStatus(oldRecord, newRecord) {
    const key = `${oldRecord.templateId}_${oldRecord.chatId}`;

    if (oldRecord.touchStatus !== newRecord.touchStatus) {
      this.differences.push({
        type: 'TOUCH_STATUS_CHANGED',
        key,
        templateId: oldRecord.templateId,
        templateName: oldRecord.templateName,
        chatId: oldRecord.chatId,
        chatName: oldRecord.chatName,
        oldStatus: oldRecord.touchStatus,
        newStatus: newRecord.touchStatus,
        message: `触达状态变化: ${oldRecord.templateName} -> ${oldRecord.chatName}: ${oldRecord.touchStatus} → ${newRecord.touchStatus}`,
        timestamp: new Date().toISOString()
      });
    }
  }

  compareVariables(oldRecord, newRecord) {
    const key = `${oldRecord.templateId}_${oldRecord.chatId}`;
    const oldVars = oldRecord.variables || {};
    const newVars = newRecord.variables || {};

    const allVarKeys = new Set([...Object.keys(oldVars), ...Object.keys(newVars)]);

    for (const varKey of allVarKeys) {
      if (varKey === '_raw') continue;

      const oldValue = oldVars[varKey];
      const newValue = newVars[varKey];

      if (oldValue === undefined && newValue !== undefined) {
        this.differences.push({
          type: 'VARIABLE_ADDED',
          key,
          templateId: oldRecord.templateId,
          templateName: oldRecord.templateName,
          chatId: oldRecord.chatId,
          chatName: oldRecord.chatName,
          variableName: varKey,
          newValue,
          message: `新增模板变量: ${oldRecord.templateName} -> ${varKey} = ${newValue}`,
          timestamp: new Date().toISOString()
        });
      } else if (oldValue !== undefined && newValue === undefined) {
        this.differences.push({
          type: 'VARIABLE_REMOVED',
          key,
          templateId: oldRecord.templateId,
          templateName: oldRecord.templateName,
          chatId: oldRecord.chatId,
          chatName: oldRecord.chatName,
          variableName: varKey,
          oldValue,
          message: `模板变量缺失: ${oldRecord.templateName} -> ${varKey}`,
          timestamp: new Date().toISOString()
        });
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        this.differences.push({
          type: 'VARIABLE_VALUE_CHANGED',
          key,
          templateId: oldRecord.templateId,
          templateName: oldRecord.templateName,
          chatId: oldRecord.chatId,
          chatName: oldRecord.chatName,
          variableName: varKey,
          oldValue,
          newValue,
          message: `模板变量值变化: ${oldRecord.templateName} -> ${varKey}: ${oldValue} → ${newValue}`,
          timestamp: new Date().toISOString()
        });
      }
    }
  }

  generateSummary(oldData, newData) {
    const templateStats = this.calculateTemplateStats();
    const chatStats = this.calculateChatStats();
    const statusStats = this.calculateStatusStats(oldData.records, newData.records);

    const differenceByType = this.groupDifferencesByType();

    return {
      summary: {
        totalRecords: {
          old: oldData.records.length,
          new: newData.records.length,
          diff: newData.records.length - oldData.records.length
        },
        totalDifferences: this.differences.length,
        differenceBreakdown: differenceByType,
        templates: templateStats,
        chats: chatStats,
        statusStats
      },
      differences: this.differences,
      parseErrors: {
        old: oldData.errors || [],
        new: newData.errors || []
      },
      parseWarnings: {
        old: oldData.warnings || [],
        new: newData.warnings || []
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        toolName: '机器人消息样本模板灰度差异CLI',
        version: '1.0.0'
      }
    };
  }

  calculateTemplateStats() {
    const stats = {};
    for (const [templateId, templateName] of this.templates) {
      const templateDiffs = this.differences.filter(d => d.templateId === templateId);
      stats[templateId] = {
        templateId,
        templateName,
        totalDifferences: templateDiffs.length,
        byType: this.groupByType(templateDiffs)
      };
    }
    return stats;
  }

  calculateChatStats() {
    const stats = {};
    for (const [chatId, chatName] of this.chats) {
      const chatDiffs = this.differences.filter(d => d.chatId === chatId);
      stats[chatId] = {
        chatId,
        chatName,
        totalDifferences: chatDiffs.length,
        byType: this.groupByType(chatDiffs)
      };
    }
    return stats;
  }

  calculateStatusStats(oldRecords, newRecords) {
    const oldByStatus = this.countByStatus(oldRecords);
    const newByStatus = this.countByStatus(newRecords);

    const allStatuses = new Set([...Object.keys(oldByStatus), ...Object.keys(newByStatus)]);
    const stats = {};

    for (const status of allStatuses) {
      stats[status] = {
        old: oldByStatus[status] || 0,
        new: newByStatus[status] || 0,
        diff: (newByStatus[status] || 0) - (oldByStatus[status] || 0)
      };
    }

    return stats;
  }

  countByStatus(records) {
    const counts = {};
    for (const record of records) {
      const status = record.touchStatus || 'unknown';
      counts[status] = (counts[status] || 0) + 1;
    }
    return counts;
  }

  groupDifferencesByType() {
    return this.groupByType(this.differences);
  }

  groupByType(differences) {
    const groups = {};
    for (const diff of differences) {
      groups[diff.type] = (groups[diff.type] || 0) + 1;
    }
    return groups;
  }
}

export default Summarizer;
