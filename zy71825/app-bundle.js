const STORAGE_KEYS = {
  LEVELS: 'gh_guardian_levels',
  RECORDS: 'gh_guardian_records',
  HISTORY: 'gh_guardian_history',
  LAST_SYNC: 'gh_guardian_last_sync',
  SESSION_ID: 'gh_guardian_session'
};

class StorageService {
  static generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  static saveLevels(levels) {
    try {
      localStorage.setItem(STORAGE_KEYS.LEVELS, JSON.stringify(levels));
    } catch (error) {
      throw new Error('保存关卡数据失败，请检查浏览器存储空间是否充足');
    }
  }

  static getLevels() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LEVELS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.warn('读取关卡数据失败，返回空数据');
      return [];
    }
  }

  static saveRecords(records) {
    try {
      localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(records));
    } catch (error) {
      throw new Error('保存玩家记录失败，请检查浏览器存储空间是否充足');
    }
  }

  static getRecords() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RECORDS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.warn('读取玩家记录失败，返回空数据');
      return [];
    }
  }

  static addRecord(record) {
    const records = this.getRecords();
    const newRecord = {
      ...record,
      id: this.generateId()
    };
    records.push(newRecord);
    this.saveRecords(records);
    this.addHistory({
      recordId: newRecord.id,
      action: 'created',
      oldValue: {},
      newValue: newRecord,
      operator: 'system',
      timestamp: Date.now()
    });
    return newRecord;
  }

  static updateRecord(id, updates, operator) {
    const records = this.getRecords();
    const index = records.findIndex(r => r.id === id);
    if (index === -1) {
      throw new Error('找不到该记录，可能已被删除');
    }
    const oldValue = { ...records[index] };
    records[index] = { ...records[index], ...updates };
    this.saveRecords(records);

    const action = updates.rewardStatus === 'confirmed' ? 'confirmed' :
                   updates.rewardStatus === 'corrected' ? 'corrected' :
                   updates.rewardStatus === 'topped_up' ? 'topped_up' : 'updated';
    
    this.addHistory({
      recordId: id,
      action,
      oldValue,
      newValue: updates,
      operator,
      timestamp: Date.now()
    });
  }

  static saveHistory(history) {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch (error) {
      throw new Error('保存历史记录失败');
    }
  }

  static getHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.warn('读取历史记录失败，返回空数据');
      return [];
    }
  }

  static addHistory(history) {
    const histories = this.getHistory();
    const newHistory = {
      ...history,
      id: this.generateId()
    };
    histories.push(newHistory);
    this.saveHistory(histories);
    return newHistory;
  }

  static getHistoryByRecordId(recordId) {
    return this.getHistory().filter(h => h.recordId === recordId);
  }

  static clearAll() {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  }

  static exportAllData() {
    return JSON.stringify({
      levels: this.getLevels(),
      records: this.getRecords(),
      history: this.getHistory(),
      exportedAt: Date.now()
    }, null, 2);
  }

  static importAllData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (data.levels) this.saveLevels(data.levels);
      if (data.records) this.saveRecords(data.records);
      if (data.history) this.saveHistory(data.history);
      return { success: true, message: '数据导入成功' };
    } catch (error) {
      return { success: false, message: '数据格式不正确，请检查导入文件' };
    }
  }
}

class ImportService {
  static parseCSV(csvContent) {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
    return lines.map(line => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  }

  static importLevelsFromCSV(csvContent) {
    const errors = [];
    const levels = [];
    
    try {
      const rows = this.parseCSV(csvContent);
      if (rows.length < 2) {
        return {
          success: false,
          message: 'CSV文件内容太少，至少需要表头和一行数据',
          importedCount: 0,
          errors: [{ row: 1, field: 'all', value: '', message: '数据行数不足' }]
        };
      }

      const headers = rows[0].map(h => h.toLowerCase());
      const requiredFields = ['关卡名称', '章节', '关卡', '奖励名称', '奖励数量'];
      const fieldMap = {};

      requiredFields.forEach(field => {
        const index = headers.findIndex(h => 
          h === field.toLowerCase() || 
          h.includes(field.slice(0, 2))
        );
        if (index === -1) {
          errors.push({ row: 1, field, value: '', message: `缺少必填列"${field}"` });
        } else {
          fieldMap[field] = index;
        }
      });

      if (errors.length > 0) {
        return {
          success: false,
          message: '表头格式不正确，请检查必填列',
          importedCount: 0,
          errors
        };
      }

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;
        
        try {
          const chapter = parseInt(row[fieldMap['章节']] || '0', 10);
          const stage = parseInt(row[fieldMap['关卡']] || '0', 10);
          const rewardAmount = parseInt(row[fieldMap['奖励数量']] || '0', 10);

          if (isNaN(chapter) || chapter <= 0) {
            errors.push({ row: rowNum, field: '章节', value: row[fieldMap['章节']], message: '章节必须是正整数' });
            continue;
          }
          if (isNaN(stage) || stage <= 0) {
            errors.push({ row: rowNum, field: '关卡', value: row[fieldMap['关卡']], message: '关卡必须是正整数' });
            continue;
          }
          if (isNaN(rewardAmount) || rewardAmount < 0) {
            errors.push({ row: rowNum, field: '奖励数量', value: row[fieldMap['奖励数量']], message: '奖励数量不能是负数' });
            continue;
          }

          const levelName = row[fieldMap['关卡名称']] || `第${chapter}章第${stage}关`;
          
          levels.push({
            id: `level_${chapter}_${stage}_${Date.now()}_${i}`,
            name: levelName,
            chapter,
            stage,
            expectedReward: row[fieldMap['奖励名称']] || '未知奖励',
            rewardAmount,
            source: 'imported',
            importedAt: Date.now()
          });
        } catch (e) {
          errors.push({ row: rowNum, field: 'unknown', value: '', message: '该行数据解析失败' });
        }
      }

      if (levels.length > 0) {
        const existingLevels = StorageService.getLevels();
        const newLevels = [...existingLevels];
        
        levels.forEach(newLevel => {
          const exists = newLevels.findIndex(l => 
            l.chapter === newLevel.chapter && l.stage === newLevel.stage
          );
          if (exists === -1) {
            newLevels.push(newLevel);
          }
        });
        
        StorageService.saveLevels(newLevels);
      }

      return {
        success: errors.length === 0,
        message: errors.length === 0 
          ? `成功导入 ${levels.length} 个关卡` 
          : `导入完成，成功 ${levels.length} 个，失败 ${errors.length} 个`,
        importedCount: levels.length,
        errors
      };
    } catch (error) {
      return {
        success: false,
        message: 'CSV文件解析失败，请检查文件格式',
        importedCount: 0,
        errors: [{ row: 0, field: 'file', value: '', message: '文件格式错误' }]
      };
    }
  }

  static importLevelsFromJSON(jsonContent) {
    try {
      const data = JSON.parse(jsonContent);
      const levels = Array.isArray(data) ? data : data.levels || [];
      const errors = [];

      const validLevels = levels.filter((level, index) => {
        if (!level.name) {
          errors.push({ row: index + 1, field: 'name', value: level.name, message: '缺少关卡名称' });
          return false;
        }
        if (!level.chapter || typeof level.chapter !== 'number') {
          errors.push({ row: index + 1, field: 'chapter', value: level.chapter, message: '章节格式不正确' });
          return false;
        }
        if (!level.stage || typeof level.stage !== 'number') {
          errors.push({ row: index + 1, field: 'stage', value: level.stage, message: '关卡格式不正确' });
          return false;
        }
        return true;
      }).map(level => ({
        ...level,
        id: level.id || `level_${level.chapter}_${level.stage}_${Date.now()}`,
        source: 'imported',
        importedAt: Date.now()
      }));

      if (validLevels.length > 0) {
        const existingLevels = StorageService.getLevels();
        StorageService.saveLevels([...existingLevels, ...validLevels]);
      }

      return {
        success: errors.length === 0,
        message: errors.length === 0 
          ? `成功导入 ${validLevels.length} 个关卡` 
          : `导入完成，成功 ${validLevels.length} 个，失败 ${errors.length} 个`,
        importedCount: validLevels.length,
        errors
      };
    } catch (error) {
      return {
        success: false,
        message: 'JSON格式不正确，请检查文件内容',
        importedCount: 0,
        errors: [{ row: 0, field: 'json', value: '', message: 'JSON解析失败' }]
      };
    }
  }

  static importPlayerRecordsFromCSV(csvContent) {
    const errors = [];
    const records = [];
    
    try {
      const rows = this.parseCSV(csvContent);
      if (rows.length < 2) {
        return {
          success: false,
          message: 'CSV文件内容太少',
          importedCount: 0,
          errors: [{ row: 1, field: 'all', value: '', message: '数据行数不足' }]
        };
      }

      const headers = rows[0].map(h => h.toLowerCase());
      const fieldMap = {
        '玩家ID': headers.findIndex(h => h.includes('玩家') && h.includes('id')) || 0,
        '玩家名称': headers.findIndex(h => h.includes('玩家') && (h.includes('名') || h.includes('昵称'))) || 1,
        '关卡名称': headers.findIndex(h => h.includes('关卡')) || 2,
        '完成时间': headers.findIndex(h => h.includes('时间') || h.includes('日期')) || 3,
        '数据来源': headers.findIndex(h => h.includes('来源') || h.includes('source')) || 4
      };

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 1;

        try {
          const playerId = row[fieldMap['玩家ID']];
          const playerName = row[fieldMap['玩家名称']];
          const levelName = row[fieldMap['关卡名称']];
          const sourceText = (row[fieldMap['数据来源']] || '').toLowerCase();

          if (!playerId || !playerName) {
            errors.push({ row: rowNum, field: '玩家信息', value: '', message: '缺少玩家ID或名称' });
            continue;
          }

          const source = sourceText.includes('反馈') ? 'player_feedback' :
            sourceText.includes('手动') ? 'manual' : 'game_data';

          records.push({
            playerId,
            playerName,
            levelId: '',
            levelName,
            completedAt: Date.now(),
            rewardStatus: 'pending',
            source,
            feedbackNote: source === 'player_feedback' ? '玩家反馈记录' : undefined
          });
        } catch (e) {
          errors.push({ row: rowNum, field: 'unknown', value: '', message: '该行数据解析失败' });
        }
      }

      records.forEach(record => {
        StorageService.addRecord(record);
      });

      return {
        success: errors.length === 0,
        message: `成功导入 ${records.length} 条玩家记录`,
        importedCount: records.length,
        errors
      };
    } catch (error) {
      return {
        success: false,
        message: 'CSV文件解析失败',
        importedCount: 0,
        errors: [{ row: 0, field: 'file', value: '', message: '文件格式错误' }]
      };
    }
  }

  static downloadTemplate(type) {
    let csvContent = '';
    if (type === 'levels') {
      csvContent = '关卡名称,章节,关卡,奖励名称,奖励数量\n示例关卡,1,1,钻石,100';
    } else {
      csvContent = '玩家ID,玩家名称,关卡名称,完成时间,数据来源\nP001,小明,第1章第1关,2024-01-01,游戏数据';
    }
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = type === 'levels' ? '关卡导入模板.csv' : '玩家记录导入模板.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}

class ExportService {
  static exportRecordsToCSV(records) {
    const headers = [
      '记录ID', '玩家ID', '玩家名称', '关卡名称', '完成时间',
      '奖励状态', '实际奖励', '奖励数量', '数据来源', '处理人', '处理时间', '备注'
    ];
    
    const statusMap = {
      'pending': '待处理',
      'confirmed': '已确认',
      'corrected': '已修正',
      'topped_up': '已补发'
    };

    const sourceMap = {
      'game_data': '游戏数据',
      'player_feedback': '玩家反馈',
      'manual': '人工录入'
    };

    const rows = records.map(record => [
      record.id,
      record.playerId,
      record.playerName,
      record.levelName,
      new Date(record.completedAt).toLocaleString('zh-CN'),
      statusMap[record.rewardStatus] || record.rewardStatus,
      record.actualReward || '',
      record.actualAmount?.toString() || '',
      sourceMap[record.source] || record.source,
      record.handler || '',
      record.handledAt ? new Date(record.handledAt).toLocaleString('zh-CN') : '',
      record.correctionNote || record.feedbackNote || ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');

    this.downloadFile(csvContent, `玩家记录_${new Date().toLocaleDateString('zh-CN')}.csv`, 'text/csv');
  }

  static exportLevelsToCSV(levels) {
    const headers = ['关卡ID', '关卡名称', '章节', '关卡', '预期奖励', '奖励数量', '数据来源', '导入时间'];
    
    const sourceMap = {
      'imported': '导入',
      'manual': '手动添加'
    };

    const rows = levels.map(level => [
      level.id,
      level.name,
      level.chapter.toString(),
      level.stage.toString(),
      level.expectedReward,
      level.rewardAmount.toString(),
      sourceMap[level.source] || level.source,
      level.importedAt ? new Date(level.importedAt).toLocaleString('zh-CN') : ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');

    this.downloadFile(csvContent, `关卡配置_${new Date().toLocaleDateString('zh-CN')}.csv`, 'text/csv');
  }

  static exportHistoryToCSV(history) {
    const headers = ['操作ID', '记录ID', '操作类型', '操作人', '操作时间', '备注'];
    
    const actionMap = {
      'created': '创建',
      'updated': '更新',
      'confirmed': '确认',
      'corrected': '修正',
      'topped_up': '补发'
    };

    const rows = history.map(h => [
      h.id,
      h.recordId,
      actionMap[h.action] || h.action,
      h.operator,
      new Date(h.timestamp).toLocaleString('zh-CN'),
      h.note || ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');

    this.downloadFile(csvContent, `操作历史_${new Date().toLocaleDateString('zh-CN')}.csv`, 'text/csv');
  }

  static exportActivitySummary(summary) {
    let content = `========================================\n`;
    content += `        植物温室守护 - 活动复盘报告\n`;
    content += `========================================\n\n`;
    content += `活动名称：${summary.activityName}\n`;
    content += `活动时间：${new Date(summary.startDate).toLocaleDateString('zh-CN')} 至 ${new Date(summary.endDate).toLocaleDateString('zh-CN')}\n`;
    content += `生成时间：${new Date().toLocaleString('zh-CN')}\n\n`;
    
    content += `【处理口径说明】\n`;
    content += `${summary.handlingPolicy}\n\n`;
    
    content += `【统计概览】\n`;
    content += `  总记录数：${summary.stats.total}\n`;
    content += `  已确认：${summary.stats.confirmed}\n`;
    content += `  待处理：${summary.stats.pending}\n`;
    content += `  已修正：${summary.stats.corrected}\n`;
    content += `  待补发：${summary.stats.toBeSupplemented}\n\n`;

    content += `【详细记录分类】\n\n`;
    
    if (summary.breakdown.confirmedRecords.length > 0) {
      content += `1. 已确认记录 (${summary.breakdown.confirmedRecords.length}条)\n`;
      content += `----------------------------------------\n`;
      summary.breakdown.confirmedRecords.forEach(r => {
        content += `  ${r.playerName}(${r.playerId}) - ${r.levelName} - ${r.actualReward || '已发'}\n`;
      });
      content += '\n';
    }

    if (summary.breakdown.pendingRecords.length > 0) {
      content += `2. 待处理记录 (${summary.breakdown.pendingRecords.length}条) - 请优先处理\n`;
      content += `----------------------------------------\n`;
      summary.breakdown.pendingRecords.forEach(r => {
        const source = r.source === 'player_feedback' ? '玩家反馈' : '游戏数据';
        content += `  ${r.playerName}(${r.playerId}) - ${r.levelName} - 来源:${source}${r.feedbackNote ? ' - ' + r.feedbackNote : ''}\n`;
      });
      content += '\n';
    }

    if (summary.breakdown.correctedRecords.length > 0) {
      content += `3. 人工修正记录 (${summary.breakdown.correctedRecords.length}条) - 已人工介入\n`;
      content += `----------------------------------------\n`;
      summary.breakdown.correctedRecords.forEach(r => {
        content += `  ${r.playerName}(${r.playerId}) - ${r.levelName} - 处理人:${r.handler || '未知'}${r.correctionNote ? ' - ' + r.correctionNote : ''}\n`;
      });
      content += '\n';
    }

    if (summary.breakdown.toBeSupplementedRecords.length > 0) {
      content += `4. 待补发记录 (${summary.breakdown.toBeSupplementedRecords.length}条) - 需执行补发\n`;
      content += `----------------------------------------\n`;
      summary.breakdown.toBeSupplementedRecords.forEach(r => {
        content += `  ${r.playerName}(${r.playerId}) - ${r.levelName} - 应发:${r.actualReward} x${r.actualAmount}\n`;
      });
      content += '\n';
    }

    content += `========================================\n`;
    content += `        报告结束 - 请按处理口径执行\n`;
    content += `========================================\n`;

    this.downloadFile(content, `活动复盘_${summary.activityName}_${new Date().toLocaleDateString('zh-CN')}.txt`, 'text/plain');
  }

  static exportAllData() {
    const data = {
      levels: StorageService.getLevels(),
      records: StorageService.getRecords(),
      history: StorageService.getHistory(),
      exportedAt: Date.now(),
      exportedBy: '植物温室守护系统'
    };
    
    this.downloadFile(
      JSON.stringify(data, null, 2),
      `完整数据备份_${new Date().toLocaleDateString('zh-CN')}.json`,
      'application/json'
    );
  }

  static downloadFile(content, filename, mimeType) {
    const blob = new Blob(['\ufeff' + content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

class ErrorService {
  static errorMessages = {
    'STORAGE_FULL': '哎呀，存储空间满了！请导出一些旧数据后清理一下空间吧',
    'NETWORK_ERROR': '网络连接好像断了，别急，你的操作已经存在本地了',
    'INVALID_DATA': '这个数据格式不对哦，请检查一下格式是否正确',
    'RECORD_NOT_FOUND': '找不到这条记录了，可能被别人删掉了',
    'PERMISSION_DENIED': '你没有权限做这个操作，请找管理员开通',
    'DUPLICATE_RECORD': '这条记录已经存在啦，不用重复添加',
    'IMPORT_FAILED': '导入失败了，请看看是不是文件有问题',
    'EXPORT_FAILED': '导出失败了，请重试一下',
    'UNKNOWN_ERROR': '出了点小问题，别慌，先记下来找技术同学看看'
  };

  static getFriendlyMessage(errorCode, details) {
    const baseMessage = this.errorMessages[errorCode] || this.errorMessages['UNKNOWN_ERROR'];
    return details ? `${baseMessage}（${details}）` : baseMessage;
  }

  static analyzeRecoveryInfo(
    recordSource,
    hasLevelData,
    hasPlayerFeedback,
    timestamp
  ) {
    const isFromLevelTable = recordSource === 'game_data' || hasLevelData;
    const isFromFeedback = recordSource === 'player_feedback' || hasPlayerFeedback;
    
    let source = 'unknown';
    let message = '';
    let nextStep = '';
    let contactPerson = '';

    if (isFromLevelTable && isFromFeedback) {
      source = 'level_table';
      message = '这条记录来自关卡草表，同时收到了玩家反馈';
      nextStep = '请先核对关卡草表中的通关记录，确认后补发';
      contactPerson = '活动运营组';
    } else if (isFromLevelTable) {
      source = 'level_table';
      message = '这条记录来自关卡草表，没有玩家反馈';
      nextStep = '请检查关卡数据是否正确，确认后正常发放';
      contactPerson = '数据组';
    } else if (isFromFeedback) {
      source = 'player_feedback';
      message = '这条记录来自玩家反馈，在关卡草表中找不到';
      nextStep = '请联系玩家核实通关情况，必要时走补发流程';
      contactPerson = '客服组';
    } else {
      source = 'unknown';
      message = '这条记录来源不明确，两边都找不到';
      nextStep = '请人工核查，联系数据组和客服组两边确认';
      contactPerson = '活动负责人';
    }

    const timeGap = timestamp ? Date.now() - timestamp : 0;
    if (timeGap > 7 * 24 * 60 * 60 * 1000) {
      message += '，这条记录已经超过7天了，处理时请注意时效性';
    }

    return {
      recoverable: source !== 'unknown',
      source,
      message,
      nextStep,
      contactPerson
    };
  }

  static getSourceText(source) {
    const sourceMap = {
      'level_table': '关卡草表',
      'player_feedback': '玩家反馈',
      'unknown': '来源不明'
    };
    return sourceMap[source];
  }

  static getStatusText(status) {
    const statusMap = {
      'pending': '⏳ 待处理',
      'confirmed': '✅ 已确认',
      'corrected': '🔧 已修正',
      'topped_up': '💎 已补发'
    };
    return statusMap[status] || status;
  }

  static showToast(message, type = 'info') {
    const existing = document.querySelector('.gh-toast');
    if (existing) existing.remove();

    const colors = {
      info: '#3b82f6',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444'
    };

    const toast = document.createElement('div');
    toast.className = 'gh-toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 24px;
      background: ${colors[type]};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-size: 14px;
      animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  static showRecoveryDialog(info, onClose) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;

    const sourceColor = info.source === 'level_table' ? '#3b82f6' :
                       info.source === 'player_feedback' ? '#f59e0b' : '#ef4444';

    overlay.innerHTML = `
      <div style="
        background: white;
        border-radius: 16px;
        padding: 24px;
        max-width: 400px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      ">
        <h3 style="margin:0 0 16px 0; font-size:18px;">📋 记录来源分析</h3>
        <div style="margin-bottom:16px;">
          <div style="display:inline-block;padding:4px 12px;border-radius:20px;background:${sourceColor};color:white;font-size:12px;">
            ${this.getSourceText(info.source)}
          </div>
        </div>
        <p style="color:#374151;line-height:1.6;">${info.message}</p>
        <div style="margin-top:16px;padding:12px;background:#fef3c7;border-radius:8px;">
          <div style="font-weight: bold; color: #92400e;">下一步</div>
          <div style="color: #b45309; font-size: 14px;">${info.nextStep}</div>
        </div>
        <div style="margin-top:8px;color:#6b7280;font-size:13px;">
          👤 联系人：<strong>${info.contactPerson}</strong>
        </div>
        <button style="
          margin-top:20px;
          width:100%;
          padding:10px;
          background:#3b82f6;
          color:white;
          border:none;
          border-radius:8px;
          cursor:pointer;
          font-size:14px;
        ">我知道了</button>
      </div>
    `;

    const button = overlay.querySelector('button');
    button?.addEventListener('click', () => {
      overlay.remove();
      onClose?.();
    });

    document.body.appendChild(overlay);
  }

  static injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

class ActivityService {
  static getReviewStats() {
    const records = StorageService.getRecords();
    return {
      total: records.length,
      confirmed: records.filter(r => r.rewardStatus === 'confirmed').length,
      pending: records.filter(r => r.rewardStatus === 'pending').length,
      corrected: records.filter(r => r.rewardStatus === 'corrected').length,
      toBeSupplemented: records.filter(r => r.rewardStatus === 'topped_up').length
    };
  }

  static generateActivitySummary(
    activityName,
    startDate,
    endDate,
    handlingPolicy
  ) {
    const records = StorageService.getRecords();
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    const filteredRecords = records.filter(r => 
      r.completedAt >= startTime && r.completedAt <= endTime
    );

    const confirmedRecords = filteredRecords.filter(r => r.rewardStatus === 'confirmed');
    const pendingRecords = filteredRecords.filter(r => r.rewardStatus === 'pending');
    const correctedRecords = filteredRecords.filter(r => r.rewardStatus === 'corrected');
    const toBeSupplementedRecords = filteredRecords.filter(r => r.rewardStatus === 'topped_up');

    return {
      activityName,
      startDate: startTime,
      endDate: endTime,
      handlingPolicy,
      stats: {
        total: filteredRecords.length,
        confirmed: confirmedRecords.length,
        pending: pendingRecords.length,
        corrected: correctedRecords.length,
        toBeSupplemented: toBeSupplementedRecords.length
      },
      breakdown: {
        confirmedRecords,
        pendingRecords,
        correctedRecords,
        toBeSupplementedRecords
      }
    };
  }

  static getRecordsByStatus(status) {
    return StorageService.getRecords().filter(r => r.rewardStatus === status);
  }

  static getRecordsBySource(source) {
    return StorageService.getRecords().filter(r => r.source === source);
  }

  static searchRecords(keyword) {
    const lowerKeyword = keyword.toLowerCase();
    return StorageService.getRecords().filter(r => 
      r.playerName.toLowerCase().includes(lowerKeyword) ||
      r.playerId.toLowerCase().includes(lowerKeyword) ||
      r.levelName.toLowerCase().includes(lowerKeyword)
    );
  }

  static getDefaultHandlingPolicy() {
    return `
1. 已确认记录：奖励已正常发放，无需额外操作
2. 待处理记录：请在24小时内完成复核，优先处理玩家反馈记录
3. 已修正记录：已人工介入，需跟踪玩家是否收到
4. 待补发记录：请走补发流程，补发后标记为"已补发"
5. 所有处理需在活动结束后7天内完成
    `.trim();
  }

  static addSampleData() {
    const sampleLevels = [
      { id: 'level_1_1', name: '阳光花房', chapter: 1, stage: 1, expectedReward: '钻石', rewardAmount: 100, source: 'imported', importedAt: Date.now() },
      { id: 'level_1_2', name: '温室培育', chapter: 1, stage: 2, expectedReward: '金币', rewardAmount: 500, source: 'imported', importedAt: Date.now() },
      { id: 'level_2_1', name: '雨林探险', chapter: 2, stage: 1, expectedReward: '钻石', rewardAmount: 150, source: 'imported', importedAt: Date.now() },
      { id: 'level_2_2', name: '沙漠绿洲', chapter: 2, stage: 2, expectedReward: '能量', rewardAmount: 50, source: 'imported', importedAt: Date.now() }
    ];
    StorageService.saveLevels(sampleLevels);

    const sampleRecords = [
      { playerId: 'P001', playerName: '小明', levelId: 'level_1_1', levelName: '阳光花房', completedAt: Date.now() - 86400000, rewardStatus: 'confirmed', actualReward: '钻石', actualAmount: 100, source: 'game_data', handler: '张三', handledAt: Date.now() - 80000000 },
      { playerId: 'P002', playerName: '小红', levelId: 'level_1_1', levelName: '阳光花房', completedAt: Date.now() - 72000000, rewardStatus: 'pending', source: 'game_data' },
      { playerId: 'P003', playerName: '小刚', levelId: 'level_1_2', levelName: '温室培育', completedAt: Date.now() - 60000000, rewardStatus: 'pending', source: 'player_feedback', feedbackNote: '通关后没收到奖励' },
      { playerId: 'P004', playerName: '小美', levelId: 'level_2_1', levelName: '雨林探险', completedAt: Date.now() - 50000000, rewardStatus: 'corrected', actualReward: '钻石', actualAmount: 150, source: 'manual', handler: '李四', handledAt: Date.now() - 40000000, correctionNote: '数据异常，手动补发' },
      { playerId: 'P005', playerName: '小华', levelId: 'level_2_2', levelName: '沙漠绿洲', completedAt: Date.now() - 36000000, rewardStatus: 'topped_up', actualReward: '能量', actualAmount: 50, source: 'player_feedback', handler: '王五', handledAt: Date.now() - 20000000 }
    ];

    sampleRecords.forEach(r => StorageService.addRecord(r));
  }
}

class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
  }

  create() {
    ErrorService.injectStyles();
    ActivityService.addSampleData();

    this.add.rectangle(400, 300, 800, 600, 0x2d5a27);
    
    this.add.text(400, 80, '🌿 植物温室守护 🌿', {
      fontSize: '36px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(400, 130, '活动奖励管理系统', {
      fontSize: '18px',
      color: '#a7d129'
    }).setOrigin(0.5);

    const menuOptions = [
      { icon: '📥', text: '导入关卡草表', scene: 'ImportScene' },
      { icon: '🔍', text: '记录复核', scene: 'ReviewScene' },
      { icon: '✏️', text: '修正记录', scene: 'CorrectScene' },
      { icon: '📜', text: '操作历史', scene: 'HistoryScene' },
      { icon: '📊', text: '活动复盘', scene: 'SummaryScene' },
      { icon: '📤', text: '导出数据', scene: null }
    ];

    menuOptions.forEach((option, index) => {
      const item = this.add.text(400, 200 + index * 55, `${option.icon} ${option.text}`, {
        fontSize: '20px',
        color: '#ffffff',
        backgroundColor: '#4a7c59',
        padding: { x: 20, y: 10 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      item.on('pointerover', () => {
        item.setStyle({ backgroundColor: '#6b9b7a' });
      });

      item.on('pointerout', () => {
        item.setStyle({ backgroundColor: '#4a7c59' });
      });

      item.on('pointerdown', () => {
        if (option.scene) {
          this.scene.start(option.scene);
        } else {
          ExportService.exportAllData();
          ErrorService.showToast('完整数据备份已导出！', 'success');
        }
      });
    });

    const stats = ActivityService.getReviewStats();
    this.add.text(400, 540, 
      `📊 概览 | 总数:${stats.total} | 待处理:${stats.pending} | 已确认:${stats.confirmed} | 已修正:${stats.corrected}`,
      { fontSize: '14px', color: '#c8e6c9' }
    ).setOrigin(0.5);
  }
}

class ImportScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ImportScene' });
  }

  create() {
    this.add.rectangle(400, 300, 800, 600, 0x2d5a27);
    
    this.add.text(400, 50, '📥 导入关卡草表', {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(400, 90, '支持 CSV / JSON 格式导入', {
      fontSize: '14px',
      color: '#a7d129'
    }).setOrigin(0.5);

    this.add.text(200, 140, '下载导入模板：', {
      fontSize: '16px',
      color: '#ffffff'
    });

    const templateBtn = this.add.text(350, 140, '📄 关卡模板.csv', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#3b82f6',
      padding: { x: 12, y: 6 }
    }).setInteractive({ useHandCursor: true });

    templateBtn.on('pointerdown', () => {
      ImportService.downloadTemplate('levels');
      ErrorService.showToast('模板已下载！', 'success');
    });

    this.add.text(200, 190, '选择要导入的文件：', {
      fontSize: '16px',
      color: '#ffffff'
    });

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv,.json';
    fileInput.style.cssText = 'position:absolute;top:210px;left:200px;opacity:0;z-index:100;cursor:pointer;';
    fileInput.multiple = false;
    document.body.appendChild(fileInput);

    const fileBtn = this.add.text(400, 220, '📂 点击选择文件', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#4a7c59',
      padding: { x: 30, y: 15 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    fileBtn.on('pointerdown', () => fileInput.click());

    const resultText = this.add.text(400, 320, '', {
      fontSize: '14px',
      color: '#fbbf24'
    }).setOrigin(0.5);

    const errorList = this.add.text(200, 360, '', {
      fontSize: '12px',
      color: '#f87171',
      align: 'left',
      wordWrap: { width: 400 }
    });

    fileInput.addEventListener('change', (e) => {
      const target = e.target;
      const file = target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result;
        
        fileBtn.setText(`✅ 已选: ${file.name}`);
        
        let result;
        if (file.name.endsWith('.csv')) {
          result = ImportService.importLevelsFromCSV(content);
        } else if (file.name.endsWith('.json')) {
          result = ImportService.importLevelsFromJSON(content);
        } else {
          ErrorService.showToast('不支持的文件格式', 'error');
          return;
        }

        resultText.setText(result.message);
        
        if (result.errors.length > 0) {
          const errorMsg = result.errors.slice(0, 5).map(e => 
            `第${e.row}行 - ${e.field}: ${e.message}`
          ).join('\n');
          errorList.setText('❌ 错误详情:\n' + errorMsg);
          ErrorService.showToast(result.success ? '部分导入成功' : '导入失败', result.success ? 'warning' : 'error');
        } else {
          errorList.setText('');
          ErrorService.showToast('导入成功！', 'success');
        }

        this.updateLevelList();
      };
      reader.readAsText(file);
    });

    this.add.text(200, 450, '📋 已导入的关卡:', {
      fontSize: '16px',
      color: '#ffffff'
    });

    this.updateLevelList();

    const backBtn = this.add.text(100, 550, '← 返回主菜单', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#6b7280',
      padding: { x: 15, y: 8 }
    }).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      fileInput.remove();
      this.scene.start('MainScene');
    });

    this.events.on('shutdown', () => {
      fileInput.remove();
    });
  }

  updateLevelList() {
    const levels = StorageService.getLevels();
    const levelList = this.add.text(200, 480, '', {
      fontSize: '12px',
      color: '#d1d5db',
      align: 'left',
      wordWrap: { width: 500 }
    });

    if (levels.length === 0) {
      levelList.setText('（暂无关卡数据，请先导入）');
    } else {
      const listText = levels.slice(0, 5).map(l => 
        `  • ${l.name} - ${l.expectedReward} x${l.rewardAmount}`
      ).join('\n') + (levels.length > 5 ? `\n  ...还有 ${levels.length - 5} 个关卡` : '');
      levelList.setText(listText);
    }
  }
}

class ReviewScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ReviewScene' });
  }

  create() {
    this.add.rectangle(400, 300, 800, 600, 0x2d5a27);
    
    this.add.text(400, 40, '🔍 记录复核', {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const stats = ActivityService.getReviewStats();
    this.add.text(400, 75, 
      `待处理:${stats.pending} | 已确认:${stats.confirmed} | 已修正:${stats.corrected} | 待补发:${stats.toBeSupplemented}`,
      { fontSize: '12px', color: '#a7d129' }
    ).setOrigin(0.5);

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = '搜索玩家名称/ID/关卡...';
    searchInput.style.cssText = 'position:absolute;top:100px;left:200px;width:300px;padding:8px;border-radius:8px;border:none;font-size:14px;';
    document.body.appendChild(searchInput);

    const searchBtn = this.add.text(520, 108, '🔍 搜索', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#3b82f6',
      padding: { x: 15, y: 6 }
    }).setInteractive({ useHandCursor: true });

    searchBtn.on('pointerdown', () => {
      const keyword = searchInput.value.trim();
      this.currentRecords = keyword ? ActivityService.searchRecords(keyword) : StorageService.getRecords();
      this.updateRecordList();
    });

    const filters = [
      { label: '全部', status: null },
      { label: '⏳ 待处理', status: 'pending' },
      { label: '✅ 已确认', status: 'confirmed' },
      { label: '🔧 已修正', status: 'corrected' },
      { label: '💎 待补发', status: 'topped_up' }
    ];

    filters.forEach((filter, index) => {
      const btn = this.add.text(100 + index * 130, 155, filter.label, {
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: filter.status === null ? '#3b82f6' : '#4a7c59',
        padding: { x: 10, y: 5 }
      }).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        this.currentRecords = filter.status 
          ? ActivityService.getRecordsByStatus(filter.status)
          : StorageService.getRecords();
        this.updateRecordList();
        
        filters.forEach((_, i) => {
          const b = this.children.getAt(4 + i);
          b.setStyle({ backgroundColor: i === index ? '#3b82f6' : '#4a7c59' });
        });
      });
    });

    this.currentRecords = StorageService.getRecords();
    this.updateRecordList();

    const backBtn = this.add.text(100, 560, '← 返回主菜单', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#6b7280',
      padding: { x: 15, y: 8 }
    }).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      searchInput.remove();
      this.scene.start('MainScene');
    });

    this.events.on('shutdown', () => {
      searchInput.remove();
    });
  }

  updateRecordList() {
    if (this.recordTexts) this.recordTexts.forEach(t => t.destroy());
    this.recordTexts = [];

    if (this.currentRecords.length === 0) {
      const empty = this.add.text(400, 350, '暂无记录', {
        fontSize: '18px',
        color: '#9ca3af'
      }).setOrigin(0.5);
      this.recordTexts.push(empty);
      return;
    }

    const displayRecords = this.currentRecords.slice(0, 8);
    
    displayRecords.forEach((record, index) => {
      const y = 200 + index * 42;
      
      const statusColor = record.rewardStatus === 'pending' ? '#fbbf24' :
                         record.rewardStatus === 'confirmed' ? '#22c55e' :
                         record.rewardStatus === 'corrected' ? '#3b82f6' : '#a855f7';

      const sourceIcon = record.source === 'player_feedback' ? '💬' :
                        record.source === 'manual' ? '✋' : '🎮';

      const bg = this.add.rectangle(400, y, 600, 35, 0x1e3a1e, 0.8)
        .setInteractive({ useHandCursor: true });

      const text = this.add.text(120, y, 
        `${sourceIcon} ${record.playerName}(${record.playerId}) - ${record.levelName}`,
        { fontSize: '14px', color: '#ffffff' }
      ).setOrigin(0, 0.5);

      const status = this.add.text(620, y, ErrorService.getStatusText(record.rewardStatus), {
        fontSize: '12px',
        color: statusColor
      }).setOrigin(1, 0.5);

      bg.on('pointerover', () => bg.setFillStyle(0x2d5a27, 1));
      bg.on('pointerout', () => bg.setFillStyle(0x1e3a1e, 0.8));
      
      bg.on('pointerdown', () => {
        const recoveryInfo = ErrorService.analyzeRecoveryInfo(
          record.source,
          record.source === 'game_data',
          record.source === 'player_feedback',
          record.completedAt
        );
        ErrorService.showRecoveryDialog(recoveryInfo);
      });

      this.recordTexts.push(bg, text, status);
    });

    if (this.currentRecords.length > 8) {
      const more = this.add.text(400, 530, 
        `...还有 ${this.currentRecords.length - 8} 条记录`,
        { fontSize: '12px', color: '#9ca3af' }
      ).setOrigin(0.5);
      this.recordTexts.push(more);
    }
  }
}

class CorrectScene extends Phaser.Scene {
  constructor() {
    super({ key: 'CorrectScene' });
    this.recordElements = [];
  }

  create() {
    this.add.rectangle(400, 300, 800, 600, 0x2d5a27);
    
    this.add.text(400, 40, '✏️ 修正记录', {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(400, 75, '点击记录进行修正', {
      fontSize: '14px',
      color: '#a7d129'
    }).setOrigin(0.5);

    this.refreshRecordList();

    const backBtn = this.add.text(100, 560, '← 返回主菜单', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#6b7280',
      padding: { x: 15, y: 8 }
    }).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      this.closeEditOverlay();
      this.scene.start('MainScene');
    });
  }

  refreshRecordList() {
    this.recordElements.forEach(e => e.destroy());
    this.recordElements = [];

    const records = StorageService.getRecords();
    const pendingRecords = records.filter(r => 
      r.rewardStatus === 'pending' || r.rewardStatus === 'topped_up'
    );

    if (pendingRecords.length === 0) {
      const empty = this.add.text(400, 300, '🎉 太棒了！没有待处理的记录', {
        fontSize: '18px',
        color: '#22c55e'
      }).setOrigin(0.5);
      this.recordElements.push(empty);
      return;
    }

    pendingRecords.slice(0, 8).forEach((record, index) => {
      const y = 120 + index * 52;
      
      const bg = this.add.rectangle(400, y, 600, 45, 0x1e3a1e, 0.8)
        .setInteractive({ useHandCursor: true });

      const sourceColor = record.source === 'player_feedback' ? '#f59e0b' : '#3b82f6';
      const sourceLabel = record.source === 'player_feedback' ? '玩家反馈' :
                         record.source === 'manual' ? '人工录入' : '游戏数据';

      const text = this.add.text(120, y - 10, 
        `${record.playerName} - ${record.levelName}`,
        { fontSize: '14px', color: '#ffffff' }
      ).setOrigin(0, 0.5);

      const badge = this.add.text(120, y + 12, sourceLabel, {
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: sourceColor,
        padding: { x: 8, y: 3 }
      }).setOrigin(0, 0.5);

      const status = this.add.text(620, y, ErrorService.getStatusText(record.rewardStatus), {
        fontSize: '12px',
        color: '#fbbf24'
      }).setOrigin(1, 0.5);

      bg.on('pointerover', () => bg.setFillStyle(0x2d5a27, 1));
      bg.on('pointerout', () => bg.setFillStyle(0x1e3a1e, 0.8));
      bg.on('pointerdown', () => this.showEditDialog(record));

      this.recordElements.push(bg, text, badge, status);
    });
  }

  showEditDialog(record) {
    this.closeEditOverlay();

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;

    const sourceText = record.source === 'player_feedback' ? '玩家反馈' :
                      record.source === 'manual' ? '人工录入' : '游戏数据';

    overlay.innerHTML = `
      <div style="
        background: white;
        border-radius: 16px;
        padding: 24px;
        width: 450px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      ">
        <h3 style="margin:0 0 16px 0; font-size:20px; color:#1f2937;">📝 修正记录</h3>
        
        <div style="background:#f3f4f6; padding:12px; border-radius:8px; margin-bottom:16px;">
          <div style="font-weight:bold; color:#374151;">${record.playerName} (${record.playerId})</div>
          <div style="color:#6b7280; font-size:14px;">关卡：${record.levelName}</div>
          <div style="color:#6b7280; font-size:14px;">来源：${sourceText}</div>
          ${record.feedbackNote ? `<div style="color:#dc2626; font-size:13px; margin-top:4px;">💬 ${record.feedbackNote}</div>` : ''}
        </div>

        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:14px; color:#374151; margin-bottom:6px;">奖励名称</label>
          <input type="text" id="rewardName" value="${record.actualReward || ''}" 
            style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; box-sizing:border-box;"
            placeholder="如：钻石、金币">
        </div>

        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:14px; color:#374151; margin-bottom:6px;">奖励数量</label>
          <input type="number" id="rewardAmount" value="${record.actualAmount || ''}" 
            style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; box-sizing:border-box;"
            placeholder="如：100">
        </div>

        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:14px; color:#374151; margin-bottom:6px;">处理状态</label>
          <select id="statusSelect" style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px;">
            <option value="pending" ${record.rewardStatus === 'pending' ? 'selected' : ''}>⏳ 待处理</option>
            <option value="confirmed" ${record.rewardStatus === 'confirmed' ? 'selected' : ''}>✅ 已确认（奖励已发）</option>
            <option value="corrected" ${record.rewardStatus === 'corrected' ? 'selected' : ''}>🔧 已修正（人工处理）</option>
            <option value="topped_up" ${record.rewardStatus === 'topped_up' ? 'selected' : ''}>💎 已补发</option>
          </select>
        </div>

        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:14px; color:#374151; margin-bottom:6px;">处理人</label>
          <input type="text" id="handlerName" value="${record.handler || ''}" 
            style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; box-sizing:border-box;"
            placeholder="请输入你的姓名">
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block; font-size:14px; color:#374151; margin-bottom:6px;">处理备注</label>
          <textarea id="correctionNote" rows="3"
            style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; box-sizing:border-box; resize:vertical;"
            placeholder="说明处理情况...">${record.correctionNote || ''}</textarea>
        </div>

        <div style="display:flex; gap:12px;">
          <button id="cancelBtn" style="
            flex:1; padding:10px; background:#6b7280; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;
          ">取消</button>
          <button id="saveBtn" style="
            flex:1; padding:10px; background:#22c55e; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;
          ">保存修改</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.editOverlay = overlay;

    overlay.querySelector('#cancelBtn')?.addEventListener('click', () => {
      this.closeEditOverlay();
    });

    overlay.querySelector('#saveBtn')?.addEventListener('click', () => {
      const rewardName = overlay.querySelector('#rewardName').value;
      const rewardAmount = parseInt(overlay.querySelector('#rewardAmount').value, 10);
      const status = overlay.querySelector('#statusSelect').value;
      const handler = overlay.querySelector('#handlerName').value;
      const note = overlay.querySelector('#correctionNote').value;

      if (!handler.trim()) {
        ErrorService.showToast('请填写处理人姓名', 'warning');
        return;
      }

      try {
        StorageService.updateRecord(record.id, {
          actualReward: rewardName || undefined,
          actualAmount: isNaN(rewardAmount) ? undefined : rewardAmount,
          rewardStatus: status,
          handler: handler.trim(),
          handledAt: Date.now(),
          correctionNote: note || undefined
        }, handler.trim());

        ErrorService.showToast('修改已保存！', 'success');
        this.closeEditOverlay();
        this.refreshRecordList();
      } catch (e) {
        ErrorService.showToast(e.message || '保存失败', 'error');
      }
    });
  }

  closeEditOverlay() {
    if (this.editOverlay) {
      this.editOverlay.remove();
      this.editOverlay = null;
    }
  }
}

class HistoryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HistoryScene' });
    this.historyElements = [];
  }

  create() {
    this.add.rectangle(400, 300, 800, 600, 0x2d5a27);
    
    this.add.text(400, 40, '📜 操作历史', {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const exportBtn = this.add.text(680, 40, '📤 导出', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#3b82f6',
      padding: { x: 12, y: 6 }
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

    exportBtn.on('pointerdown', () => {
      ExportService.exportHistoryToCSV(StorageService.getHistory());
      ErrorService.showToast('历史记录已导出！', 'success');
    });

    this.refreshHistoryList();

    const backBtn = this.add.text(100, 560, '← 返回主菜单', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#6b7280',
      padding: { x: 15, y: 8 }
    }).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      this.scene.start('MainScene');
    });
  }

  refreshHistoryList() {
    this.historyElements.forEach(e => e.destroy());
    this.historyElements = [];

    const history = StorageService.getHistory().reverse().slice(0, 12);

    if (history.length === 0) {
      const empty = this.add.text(400, 300, '暂无操作记录', {
        fontSize: '18px',
        color: '#9ca3af'
      }).setOrigin(0.5);
      this.historyElements.push(empty);
      return;
    }

    const actionColors = {
      'created': '#3b82f6',
      'updated': '#6b7280',
      'confirmed': '#22c55e',
      'corrected': '#f59e0b',
      'topped_up': '#a855f7'
    };

    const actionLabels = {
      'created': '创建',
      'updated': '更新',
      'confirmed': '确认',
      'corrected': '修正',
      'topped_up': '补发'
    };

    history.forEach((h, index) => {
      const y = 100 + index * 38;
      
      const bg = this.add.rectangle(400, y, 650, 32, 0x1e3a1e, 0.6);

      const time = new Date(h.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      
      const timeText = this.add.text(100, y, time, {
        fontSize: '12px',
        color: '#9ca3af'
      }).setOrigin(0, 0.5);

      const actionText = this.add.text(170, y, actionLabels[h.action] || h.action, {
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: actionColors[h.action] || '#6b7280',
        padding: { x: 8, y: 3 }
      }).setOrigin(0, 0.5);

      const recordText = this.add.text(250, y, `记录: ${h.recordId.slice(0, 8)}...`, {
        fontSize: '12px',
        color: '#d1d5db'
      }).setOrigin(0, 0.5);

      const opText = this.add.text(500, y, h.operator, {
        fontSize: '12px',
        color: '#a7d129'
      }).setOrigin(0, 0.5);

      if (h.note) {
        const noteText = this.add.text(580, y, '💬', {
          fontSize: '14px'
        }).setOrigin(0, 0.5);
        this.historyElements.push(noteText);
      }

      this.historyElements.push(bg, timeText, actionText, recordText, opText);
    });
  }
}

class SummaryScene extends Phaser.Scene {
  constructor() {
    super({ key: 'SummaryScene' });
    this.summaryOverlay = null;
  }

  create() {
    this.add.rectangle(400, 300, 800, 600, 0x2d5a27);
    
    this.add.text(400, 40, '📊 活动复盘', {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const stats = ActivityService.getReviewStats();
    this.drawStatsChart(stats);

    this.add.text(100, 280, '📋 处理口径说明', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    const policy = ActivityService.getDefaultHandlingPolicy();
    this.add.text(100, 310, policy, {
      fontSize: '13px',
      color: '#d1d5db',
      align: 'left',
      wordWrap: { width: 600 },
      lineSpacing: 6
    });

    this.add.text(100, 420, '📁 分类导出', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    });

    const exportOptions = [
      { label: '📄 已确认记录', status: 'confirmed', color: '#22c55e' },
      { label: '⏳ 待处理记录', status: 'pending', color: '#fbbf24' },
      { label: '🔧 人工修正记录', status: 'corrected', color: '#3b82f6' },
      { label: '💎 待补发记录', status: 'topped_up', color: '#a855f7' }
    ];

    exportOptions.forEach((option, index) => {
      const btn = this.add.text(100 + index * 160, 460, option.label, {
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: option.color,
        padding: { x: 12, y: 8 }
      }).setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => {
        const records = ActivityService.getRecordsByStatus(option.status);
        if (records.length === 0) {
          ErrorService.showToast('该分类暂无记录', 'info');
          return;
        }
        ExportService.exportRecordsToCSV(records);
        ErrorService.showToast(`已导出 ${records.length} 条记录`, 'success');
      });
    });

    const generateBtn = this.add.text(400, 520, '📋 生成完整复盘报告', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#059669',
      padding: { x: 25, y: 12 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    generateBtn.on('pointerdown', () => {
      this.showSummaryDialog();
    });

    const backBtn = this.add.text(100, 560, '← 返回主菜单', {
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#6b7280',
      padding: { x: 15, y: 8 }
    }).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      this.closeSummaryOverlay();
      this.scene.start('MainScene');
    });
  }

  drawStatsChart(stats) {
    const centerX = 400;
    const centerY = 180;
    const radius = 70;

    const segments = [
      { value: stats.confirmed, color: 0x22c55e, label: '已确认' },
      { value: stats.pending, color: 0xfbbf24, label: '待处理' },
      { value: stats.corrected, color: 0x3b82f6, label: '已修正' },
      { value: stats.toBeSupplemented, color: 0xa855f7, label: '待补发' }
    ];

    const total = stats.total || 1;
    let startAngle = -Math.PI / 2;

    segments.forEach((seg) => {
      const angle = (seg.value / total) * Math.PI * 2;
      
      if (seg.value > 0) {
        const graphics = this.add.graphics();
        graphics.fillStyle(seg.color, 1);
        graphics.slice(centerX, centerY, radius, startAngle, startAngle + angle, false);
        graphics.fillPath();
      }

      const midAngle = startAngle + angle / 2;
      const labelX = centerX + Math.cos(midAngle) * (radius + 30);
      const labelY = centerY + Math.sin(midAngle) * (radius + 30);

      this.add.text(labelX, labelY, `${seg.label}\n${seg.value}`, {
        fontSize: '12px',
        color: '#ffffff',
        align: 'center'
      }).setOrigin(0.5);

      startAngle += angle;
    });

    this.add.circle(centerX, centerY, 35, 0x2d5a27);
    this.add.text(centerX, centerY, `总计\n${stats.total}`, {
      fontSize: '14px',
      color: '#ffffff',
      align: 'center'
    }).setOrigin(0.5);
  }

  showSummaryDialog() {
    this.closeSummaryOverlay();

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;

    overlay.innerHTML = `
      <div style="
        background: white;
        border-radius: 16px;
        padding: 24px;
        width: 480px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      ">
        <h3 style="margin:0 0 20px 0; font-size:20px; color:#1f2937;">📋 生成活动复盘报告</h3>
        
        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:14px; color:#374151; margin-bottom:6px;">活动名称</label>
          <input type="text" id="activityName" value="植物温室守护活动" 
            style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; box-sizing:border-box;">
        </div>

        <div style="display:flex; gap:12px; margin-bottom:16px;">
          <div style="flex:1;">
            <label style="display:block; font-size:14px; color:#374151; margin-bottom:6px;">开始日期</label>
            <input type="date" id="startDate" 
              style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; box-sizing:border-box;">
          </div>
          <div style="flex:1;">
            <label style="display:block; font-size:14px; color:#374151; margin-bottom:6px;">结束日期</label>
            <input type="date" id="endDate" 
              style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; box-sizing:border-box;">
          </div>
        </div>

        <div style="margin-bottom:20px;">
          <label style="display:block; font-size:14px; color:#374151; margin-bottom:6px;">处理口径</label>
          <textarea id="handlingPolicy" rows="5"
            style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; box-sizing:border-box; resize:vertical; font-size:13px;">${ActivityService.getDefaultHandlingPolicy()}</textarea>
        </div>

        <div style="display:flex; gap:12px;">
          <button id="cancelBtn" style="
            flex:1; padding:10px; background:#6b7280; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;
          ">取消</button>
          <button id="generateBtn" style="
            flex:1; padding:10px; background:#059669; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px;
          ">生成并导出</button>
        </div>
      </div>
    `;

    const today = new Date();
    const startDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    setTimeout(() => {
      overlay.querySelector('#startDate').value = startDate.toISOString().split('T')[0];
      overlay.querySelector('#endDate').value = today.toISOString().split('T')[0];
    }, 0);

    document.body.appendChild(overlay);
    this.summaryOverlay = overlay;

    overlay.querySelector('#cancelBtn').addEventListener('click', () => {
      this.closeSummaryOverlay();
    });

    overlay.querySelector('#generateBtn').addEventListener('click', () => {
      const activityName = overlay.querySelector('#activityName').value;
      const startDateVal = overlay.querySelector('#startDate').value;
      const endDateVal = overlay.querySelector('#endDate').value;
      const handlingPolicy = overlay.querySelector('#handlingPolicy').value;

      if (!activityName.trim()) {
        ErrorService.showToast('请填写活动名称', 'warning');
        return;
      }
      if (!startDateVal || !endDateVal) {
        ErrorService.showToast('请选择日期范围', 'warning');
        return;
      }

      const summary = ActivityService.generateActivitySummary(
        activityName.trim(),
        new Date(startDateVal),
        new Date(endDateVal + 'T23:59:59'),
        handlingPolicy
      );

      ExportService.exportActivitySummary(summary);
      ErrorService.showToast('复盘报告已生成！', 'success');
      this.closeSummaryOverlay();
    });
  }

  closeSummaryOverlay() {
    if (this.summaryOverlay) {
      this.summaryOverlay.remove();
      this.summaryOverlay = null;
    }
  }
}

window.addEventListener('load', () => {
  const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#2d5a27',
    scene: [
      MainScene,
      ImportScene,
      ReviewScene,
      CorrectScene,
      HistoryScene,
      SummaryScene
    ],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    }
  };

  new Phaser.Game(config);
});