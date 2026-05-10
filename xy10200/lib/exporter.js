const fs = require('fs');
const path = require('path');
const { CONFLICT_TYPES } = require('./models');

const TYPE_NAMES = {
  [CONFLICT_TYPES.YARD_COORDINATE]: '堆场坐标异常',
  [CONFLICT_TYPES.POSITION_OCCUPANCY]: '箱位占用冲突',
  [CONFLICT_TYPES.MULTI_SOURCE]: '多源数据不一致',
  [CONFLICT_TYPES.SHIFT_CHAIN_BROKEN]: '移位链断裂',
};

const SEVERITY_EMOJI = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
};

const STATUS_EMOJI = {
  pending: '⏳',
  resolved: '✅',
  blocked: '🚫',
};

class Exporter {
  constructor(storage) {
    this.storage = storage;
  }

  exportJSON(outputPath, data) {
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    return outputPath;
  }

  exportMarkdown(outputPath, checkRecord, conflicts) {
    const lines = [];
    
    lines.push('# 码头堆场箱位纠错报告');
    lines.push('');
    lines.push(`## 检查概览`);
    lines.push('');
    lines.push(`- **检查ID**: ${checkRecord.id}`);
    lines.push(`- **检查时间**: ${checkRecord.timestamp}`);
    lines.push(`- **检查集装箱总数**: ${checkRecord.totalContainers}`);
    lines.push(`- **发现冲突数**: ${conflicts.length}`);
    lines.push(`- **输入文件**: ${checkRecord.inputFiles.join(', ')}`);
    if (checkRecord.isDuplicate) {
      lines.push(`- **重复扫描**: 是（幂等性校验通过）`);
    }
    lines.push('');

    if (conflicts.length > 0) {
      const grouped = {};
      for (const c of conflicts) {
        if (!grouped[c.type]) grouped[c.type] = [];
        grouped[c.type].push(c);
      }

      lines.push('## 冲突详情');
      lines.push('');
      
      for (const [type, items] of Object.entries(grouped)) {
        const typeName = TYPE_NAMES[type] || type;
        lines.push(`### ${typeName} (${items.length}项)`);
        lines.push('');
        
        for (const conflict of items) {
          lines.push(`#### ${SEVERITY_EMOJI[conflict.severity]} ${conflict.containerNo}`);
          lines.push('');
          lines.push(`- **状态**: ${STATUS_EMOJI[conflict.status]} ${conflict.status}`);
          lines.push(`- **严重程度**: ${conflict.severity}`);
          lines.push(`- **描述**: ${conflict.description}`);
          lines.push(`- **影响箱位**: ${conflict.affectedPositions.join(', ')}`);
          lines.push(`- **创建时间**: ${conflict.createdAt}`);
          
          if (conflict.sourceRecords && conflict.sourceRecords.length > 0) {
            lines.push('');
            lines.push('**来源记录**:');
            lines.push('');
            lines.push('| 来源 | 位置 | 时间 |');
            lines.push('|------|------|------|');
            for (const rec of conflict.sourceRecords) {
              const pos = rec.position || `${rec.from || '?'} → ${rec.to || '?'}`;
              const ts = rec.timestamp ? new Date(rec.timestamp).toLocaleString() : '-';
              lines.push(`| ${rec.source} | ${pos} | ${ts} |`);
            }
          }
          
          if (conflict.resolution) {
            lines.push('');
            lines.push(`**处理方案**: ${conflict.resolution}`);
          }
          
          lines.push('');
        }
      }

      lines.push('## 待复核清单');
      lines.push('');
      const pending = conflicts.filter(c => c.status === 'pending');
      if (pending.length > 0) {
        lines.push('| 序号 | 箱号 | 冲突类型 | 严重程度 | 状态 |');
        lines.push('|------|------|----------|----------|------|');
        for (let i = 0; i < pending.length; i++) {
          const c = pending[i];
          lines.push(`| ${i + 1} | ${c.containerNo} | ${TYPE_NAMES[c.type] || c.type} | ${c.severity} | ${STATUS_EMOJI[c.status]} pending |`);
        }
      } else {
        lines.push('暂无待复核项。');
      }
    } else {
      lines.push('## 检查结果');
      lines.push('');
      lines.push('✅ **所有数据一致，未发现冲突**');
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('*本报告由 yard-position-corrector 工具生成*');

    fs.writeFileSync(outputPath, lines.join('\n'));
    return outputPath;
  }

  exportAnomalyList(outputPath) {
    const conflicts = this.storage.loadConflicts();
    const pending = conflicts.filter(c => c.status === 'pending');
    
    const data = {
      timestamp: new Date().toISOString(),
      total: pending.length,
      anomalies: pending.map(c => ({
        id: c.id,
        containerNo: c.containerNo,
        type: c.type,
        typeName: TYPE_NAMES[c.type] || c.type,
        severity: c.severity,
        description: c.description,
        affectedPositions: c.affectedPositions,
        createdAt: c.createdAt,
      })),
    };
    
    this.exportJSON(outputPath, data);
    return outputPath;
  }

  exportExceptionReport(checkRecord, outputDir) {
    const conflicts = this.storage.loadConflicts();
    const checkConflicts = checkRecord.conflicts
      .map(id => conflicts.find(c => c.id === id))
      .filter(Boolean);

    const baseName = `report-${Date.now()}`;
    
    const jsonPath = path.join(outputDir, `${baseName}.json`);
    this.exportJSON(jsonPath, {
      check: checkRecord,
      conflicts: checkConflicts,
    });

    const mdPath = path.join(outputDir, `${baseName}.md`);
    this.exportMarkdown(mdPath, checkRecord, checkConflicts);

    const anomalyPath = path.join(outputDir, `anomalies-${Date.now()}.json`);
    this.exportAnomalyList(anomalyPath);

    return { jsonPath, mdPath, anomalyPath };
  }
}

module.exports = { Exporter };
