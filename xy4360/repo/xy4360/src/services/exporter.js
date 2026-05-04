const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const FrequencyChecker = require('./frequencyChecker');

class Exporter {
  constructor() {
    this.freqChecker = new FrequencyChecker();
  }

  exportToMarkdown(session, frequencies, conflicts, forbiddenBands = []) {
    const deviceTypes = {
      'microphone': '麦克风',
      'iem': '监听耳返',
      'intercom': '对讲机',
      'backup': '备用频点'
    };

    const sortedFreqs = [...frequencies].sort((a, b) => a.frequency - b.frequency);
    
    const mainFreqs = sortedFreqs.filter(f => !f.is_backup);
    const backupFreqs = sortedFreqs.filter(f => f.is_backup);

    const conflictMap = new Map();
    conflicts.forEach(c => {
      if (c.frequency_1_id) {
        if (!conflictMap.has(c.frequency_1_id)) conflictMap.set(c.frequency_1_id, []);
        conflictMap.get(c.frequency_1_id).push(c);
      }
      if (c.frequency_2_id) {
        if (!conflictMap.has(c.frequency_2_id)) conflictMap.set(c.frequency_2_id, []);
        conflictMap.get(c.frequency_2_id).push(c);
      }
    });

    let md = `# ${session.name}\n\n`;
    md += `> 生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
    
    if (session.description) {
      md += `## 会话描述\n\n${session.description}\n\n`;
    }

    const criticalCount = conflicts.filter(c => c.severity === 'critical' && c.status === 'pending').length;
    const highCount = conflicts.filter(c => c.severity === 'high' && c.status === 'pending').length;
    const mediumCount = conflicts.filter(c => c.severity === 'medium' && c.status === 'pending').length;
    
    md += `## 检测状态\n\n`;
    md += `| 状态 | 数量 |\n|------|------|\n`;
    md += `| 主频点 | ${mainFreqs.length} |\n`;
    md += `| 备用频点 | ${backupFreqs.length} |\n`;
    md += `| 待处理严重问题 | ${criticalCount} |\n`;
    md += `| 待处理高危问题 | ${highCount} |\n`;
    md += `| 待处理中等问题 | ${mediumCount} |\n\n`;

    if (forbiddenBands.length > 0) {
      md += `## 禁用频段\n\n`;
      md += `| 名称 | 起始频率 | 结束频率 | 原因 | 优先级 |\n|------|----------|----------|------|--------|\n`;
      forbiddenBands.forEach(band => {
        md += `| ${band.name} | ${band.freq_start.toFixed(1)} MHz | ${band.freq_end.toFixed(1)} MHz | ${band.reason || '-'} | ${band.priority} |\n`;
      });
      md += `\n`;
    }

    md += `## 频点列表\n\n`;
    md += `| 设备名称 | 类型 | 频率(MHz) | 频段 | 通道 | 状态 | 冲突 |\n|----------|------|------------|------|------|------|------|\n`;
    
    sortedFreqs.forEach(freq => {
      const typeLabel = deviceTypes[freq.device_type] || freq.device_type;
      const freqConflicts = conflictMap.get(freq.id) || [];
      const pendingFreqConflicts = freqConflicts.filter(c => c.status === 'pending');
      
      let conflictStatus = '-';
      if (pendingFreqConflicts.length > 0) {
        const hasCritical = pendingFreqConflicts.some(c => c.severity === 'critical');
        const hasHigh = pendingFreqConflicts.some(c => c.severity === 'high');
        conflictStatus = hasCritical ? '⚠️ 严重' : hasHigh ? '⚠️ 高危' : '⚠️ 注意';
      }
      
      const isBackup = freq.is_backup ? '(备用)' : '';
      
      md += `| ${freq.device_name} ${isBackup} | ${typeLabel} | ${freq.frequency.toFixed(3)} | ${this._getBandName(freq.band)} | ${freq.channel || '-'} | ${freq.is_backup ? '备用' : '主用'} | ${conflictStatus} |\n`;
    });
    md += `\n`;

    const pendingConflicts = conflicts.filter(c => c.status === 'pending');
    if (pendingConflicts.length > 0) {
      md += `## 待处理冲突\n\n`;
      
      const grouped = {
        critical: pendingConflicts.filter(c => c.severity === 'critical'),
        high: pendingConflicts.filter(c => c.severity === 'high'),
        medium: pendingConflicts.filter(c => c.severity === 'medium'),
        low: pendingConflicts.filter(c => c.severity === 'low')
      };

      ['critical', 'high', 'medium', 'low'].forEach(severity => {
        if (grouped[severity].length > 0) {
          const severityLabel = this.freqChecker.getSeverityLabel(severity);
          md += `### ${severityLabel}问题 (${grouped[severity].length}个)\n\n`;
          
          grouped[severity].forEach((conflict, idx) => {
            const typeLabel = this.freqChecker.getConflictTypeLabel(conflict.type);
            const suggestion = this.freqChecker.getSuggestedAction(conflict.type);
            
            md += `#### ${idx + 1}. [${typeLabel}] ${conflict.details}\n\n`;
            md += `> 建议处理方式: ${suggestion}\n\n`;
          });
        }
      });
    }

    return md;
  }

  exportToCsv(session, frequencies, conflicts, outputPath) {
    const deviceTypes = {
      'microphone': '麦克风',
      'iem': '监听耳返',
      'intercom': '对讲机',
      'backup': '备用频点'
    };

    const conflictMap = new Map();
    conflicts.forEach(c => {
      if (c.frequency_1_id) {
        if (!conflictMap.has(c.frequency_1_id)) conflictMap.set(c.frequency_1_id, []);
        conflictMap.get(c.frequency_1_id).push(c);
      }
      if (c.frequency_2_id) {
        if (!conflictMap.has(c.frequency_2_id)) conflictMap.set(c.frequency_2_id, []);
        conflictMap.get(c.frequency_2_id).push(c);
      }
    });

    const records = frequencies.map(freq => {
      const typeLabel = deviceTypes[freq.device_type] || freq.device_type;
      const freqConflicts = conflictMap.get(freq.id) || [];
      const pendingConflicts = freqConflicts.filter(c => c.status === 'pending');
      
      let conflictLevel = '无';
      let conflictTypes = [];
      let suggestions = [];

      if (pendingConflicts.length > 0) {
        const hasCritical = pendingConflicts.some(c => c.severity === 'critical');
        const hasHigh = pendingConflicts.some(c => c.severity === 'high');
        const hasMedium = pendingConflicts.some(c => c.severity === 'medium');
        
        conflictLevel = hasCritical ? '严重' : hasHigh ? '高危' : hasMedium ? '中等' : '轻微';
        
        pendingConflicts.forEach(c => {
          conflictTypes.push(this.freqChecker.getConflictTypeLabel(c.type));
          suggestions.push(this.freqChecker.getSuggestedAction(c.type));
        });
      }

      return {
        session_name: session.name,
        device_name: freq.device_name,
        device_type: typeLabel,
        frequency: freq.frequency.toFixed(3),
        band: this._getBandName(freq.band),
        channel: freq.channel || '',
        is_backup: freq.is_backup ? '是' : '否',
        conflict_level: conflictLevel,
        conflict_types: conflictTypes.join('; '),
        suggestions: [...new Set(suggestions)].join('; '),
        notes: freq.notes || ''
      };
    });

    const csvWriter = createCsvWriter({
      path: outputPath,
      header: [
        { id: 'session_name', title: '会话名称' },
        { id: 'device_name', title: '设备名称' },
        { id: 'device_type', title: '设备类型' },
        { id: 'frequency', title: '频率(MHz)' },
        { id: 'band', title: '频段' },
        { id: 'channel', title: '通道' },
        { id: 'is_backup', title: '是否备用' },
        { id: 'conflict_level', title: '冲突等级' },
        { id: 'conflict_types', title: '冲突类型' },
        { id: 'suggestions', title: '处理建议' },
        { id: 'notes', title: '备注' }
      ]
    });

    return csvWriter.writeRecords(records);
  }

  exportConflictsToCsv(session, conflicts, outputPath) {
    const pendingConflicts = conflicts.filter(c => c.status === 'pending');
    
    const records = pendingConflicts.map((conflict, idx) => {
      return {
        no: idx + 1,
        session_name: session.name,
        type: this.freqChecker.getConflictTypeLabel(conflict.type),
        severity: this.freqChecker.getSeverityLabel(conflict.severity),
        device_1: conflict.device1_name || '-',
        freq_1: conflict.freq1 ? conflict.freq1.toFixed(3) : '-',
        device_2: conflict.device2_name || '-',
        freq_2: conflict.freq2 ? conflict.freq2.toFixed(3) : '-',
        details: conflict.details,
        suggestion: this.freqChecker.getSuggestedAction(conflict.type),
        status: '待处理'
      };
    });

    const csvWriter = createCsvWriter({
      path: outputPath,
      header: [
        { id: 'no', title: '序号' },
        { id: 'session_name', title: '会话名称' },
        { id: 'type', title: '冲突类型' },
        { id: 'severity', title: '严重程度' },
        { id: 'device_1', title: '设备1' },
        { id: 'freq_1', title: '频率1(MHz)' },
        { id: 'device_2', title: '设备2' },
        { id: 'freq_2', title: '频率2(MHz)' },
        { id: 'details', title: '详情' },
        { id: 'suggestion', title: '处理建议' },
        { id: 'status', title: '状态' }
      ]
    });

    return csvWriter.writeRecords(records);
  }

  _getBandName(bandCode) {
    const bandNames = {
      'uhfLow': 'UHF低频段 (470-614MHz)',
      'uhfMid': 'UHF中频段 (614-698MHz)',
      'uhfHigh': 'UHF高频段 (698-960MHz)',
      'unknown': '未知频段'
    };
    return bandNames[bandCode] || bandCode || '-';
  }
}

module.exports = Exporter;
