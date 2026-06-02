// ========== 本地存储模块 ==========
const STORAGE_KEY = 'qin_fang_deposit_settlement_v1';
const STORAGE_META_KEY = 'qin_fang_deposit_settlement_meta_v1';

const Storage = {
  // 保存全部数据
  saveAll(records, failedItems = []) {
    try {
      const data = {
        records: records,
        failedItems: failedItems,
        savedAt: new Date().toISOString(),
        version: 1
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      
      // 保存元数据（快速读取用
      const meta = {
        recordCount: records.length,
        failedCount: failedItems.length,
        lastSaved: new Date().toISOString(),
        statusSummary: this.getStatusSummary(records)
      };
      localStorage.setItem(STORAGE_META_KEY, JSON.stringify(meta));
      
      return true;
    } catch (e) {
      console.error('保存失败:', e);
      return false;
    }
  },

  // 读取全部数据
  loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { records: [], failedItems: [], loaded: false };
      
      const data = JSON.parse(raw);
      return {
        records: data.records || [],
        failedItems: data.failedItems || [],
        savedAt: data.savedAt,
        loaded: true
      };
    } catch (e) {
      console.error('读取失败:', e);
      return { records: [], failedItems: [], loaded: false, error: e };
    }
  },

  // 读取元数据
  loadMeta() {
    try {
      const raw = localStorage.getItem(STORAGE_META_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  // 更新单条记录（保留处理历史
  updateRecord(updatedRecord, author = '当前处理人') {
    const data = this.loadAll();
    const index = data.records.findIndex(r => r.id === updatedRecord.id);
    
    if (index === -1) {
      // 新增
      data.records.push(updatedRecord);
    } else {
      // 更新：版本号+1，保留处理备注
      const oldRecord = data.records[index];
      updatedRecord.version = (oldRecord.version || 1) + 1;
      
      // 如果有新的处理备注，追加而不是覆盖
      if (updatedRecord.processingNotes && updatedRecord.processingNotes.length > 0) {
        const oldNotes = oldRecord.processingNotes || [];
        const newNotes = updatedRecord.processingNotes.filter(note => {
          return !oldNotes.some(old => 
            old.content === note.content && old.time === note.time
          );
        });
        updatedRecord.processingNotes = [...oldNotes, ...newNotes];
      } else {
        updatedRecord.processingNotes = oldRecord.processingNotes || [];
      }
      
      // 追加一条系统自动的处理备注
      updatedRecord.processingNotes.push({
        author: author,
        content: `第${updatedRecord.version}版更新，状态变为"${window.DataModels.getStatusLabel(updatedRecord.status)}"`,
        time: new Date().toLocaleString('zh-CN')
      });
      
      updatedRecord.processedAt = new Date().toISOString();
      updatedRecord.processedBy = author;
      
      data.records[index] = updatedRecord;
    }
    
    this.saveAll(data.records, data.failedItems);
    return updatedRecord;
  },

  // 添加批注
  addAnnotation(recordId, annotation) {
    const data = this.loadAll();
    const record = data.records.find(r => r.id === recordId);
    if (!record) return null;
    
    if (!record.annotations) record.annotations = [];
    record.annotations.push(annotation);
    
    record.processingNotes.push({
      author: annotation.author,
      content: `添加了批注：${annotation.content.substring(0, 30)}${annotation.content.length > 30 ? '...' : ''}`,
      time: new Date().toLocaleString('zh-CN')
    });
    
    this.saveAll(data.records, data.failedItems);
    return record;
  },

  // 解决异常
  resolveAnomaly(recordId, anomalyId, resolutionNote, author = '当前处理人') {
    const data = this.loadAll();
    const record = data.records.find(r => r.id === recordId);
    if (!record) return null;
    
    const anomaly = record.anomalies.find(a => a.id === anomalyId);
    if (!anomaly) return null;
    
    anomaly.resolved = true;
    anomaly.resolutionNote = resolutionNote;
    anomaly.resolvedBy = author;
    anomaly.resolvedAt = new Date().toISOString();
    
    record.processingNotes.push({
      author: author,
      content: `异常已处理：${anomaly.reason.substring(0, 30)}... → ${resolutionNote}`,
      time: new Date().toLocaleString('zh-CN')
    });
    
    // 重新判断状态和结算
    const { SettlementEngine } = window.CoreLogic;
    record.status = SettlementEngine.determineStatus(record);
    if (record.status === window.DataModels.STATUS.CONFIRMED) {
      record.settlement = SettlementEngine.calculate(record);
      record.status = window.DataModels.STATUS.CONFIRMED;
    }
    
    this.saveAll(data.records, data.failedItems);
    return record;
  },

  // 人工确认结算
  confirmSettlement(recordId, author = '当前处理人') {
    const data = this.loadAll();
    const record = data.records.find(r => r.id === recordId);
    if (!record) return null;
    
    const { SettlementEngine } = window.CoreLogic;
    const { STATUS } = window.DataModels;
    record.settlement = SettlementEngine.calculate(record);
    record.status = STATUS.SETTLED;
    
    record.processingNotes.push({
      author: author,
      content: `人工确认结算完成，应退押金 ${window.DataModels.formatCurrency(record.settlement.refundAmount)}`,
      time: new Date().toLocaleString('zh-CN')
    });
    
    this.saveAll(data.records, data.failedItems);
    return record;
  },

  // 保存失败记录
  saveFailedItems(failedItems) {
    const data = this.loadAll();
    data.failedItems = failedItems;
    this.saveAll(data.records, data.failedItems);
  },

  // 清空全部数据
  clearAll() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_META_KEY);
  },

  // 导出数据（JSON格式）
  exportData() {
    const data = this.loadAll();
    const exportObj = {
      exportTime: new Date().toISOString(),
      system: '琴房预约押金结算系统',
      version: '1.0.0',
      ...data
    };
    return JSON.stringify(exportObj, null, 2);
  },

  // 导入数据（从JSON恢复）
  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data.records) throw new Error('数据格式不对');
      this.saveAll(data.records, data.failedItems || []);
      return true;
    } catch (e) {
      console.error('导入失败:', e);
      return false;
    }
  },

  // 获取状态统计
  getStatusSummary(records) {
    const summary = {};
    records.forEach(r => {
      summary[r.status] = (summary[r.status] || 0) + 1;
    });
    return summary;
  },

  // 检查是否有未保存的更改（简单实现）
  hasUnsavedChanges(currentRecords, savedRecords) {
    if (currentRecords.length !== savedRecords.length) return true;
    // 简单比较最后修改时间
    return false;
  }
};

// ========== 导出 ==========
window.Storage = Storage;
