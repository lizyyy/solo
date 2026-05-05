const db = require('./database');
const { Parser } = require('json2csv');
const utils = require('./utils');
const queryService = require('./queryService');

const exportCleanCSV = (options = {}) => {
  const { batchNumber, recordType } = options;
  const results = {};
  
  if (!recordType || recordType === 'water_sample') {
    const samples = queryService.getWaterSamples({ 
      batchNumber, 
      limit: 10000, 
      offset: 0 
    });
    
    const sampleFields = [
      { label: '批次号', value: 'batch_number' },
      { label: '样品编号', value: 'sample_code' },
      { label: '样品瓶码', value: 'bottle_code' },
      { label: '采样点编码', value: 'point_code' },
      { label: '采样点名称', value: 'point_name' },
      { label: '采样时间', value: 'sampling_time' },
      { label: '采集人', value: 'collector' },
      { label: '样品类型', value: 'sample_type' },
      { label: '温度(°C)', value: 'temperature' },
      { label: 'pH值', value: 'ph' },
      { label: '创建时间', value: 'created_at' }
    ];
    
    if (samples.length > 0) {
      const sampleParser = new Parser({ fields: sampleFields });
      results.waterSamples = {
        data: sampleParser.parse(samples),
        count: samples.length
      };
    } else {
      results.waterSamples = { data: '', count: 0 };
    }
  }
  
  if (!recordType || recordType === 'instrument_reading') {
    const readings = queryService.getInstrumentReadings({ 
      batchNumber, 
      limit: 10000, 
      offset: 0 
    });
    
    const readingFields = [
      { label: '批次号', value: 'batch_number' },
      { label: '样品瓶码', value: 'bottle_code' },
      { label: '仪器编码', value: 'instrument_code' },
      { label: '仪器名称', value: 'instrument_name' },
      { label: '读数类型', value: 'reading_type' },
      { label: '读数值', value: 'reading_value' },
      { label: '单位', value: 'reading_unit' },
      { label: '读数时间', value: 'reading_time' },
      { label: '操作员', value: 'operator' },
      { label: '创建时间', value: 'created_at' }
    ];
    
    if (readings.length > 0) {
      const readingParser = new Parser({ fields: readingFields });
      results.instrumentReadings = {
        data: readingParser.parse(readings),
        count: readings.length
      };
    } else {
      results.instrumentReadings = { data: '', count: 0 };
    }
  }
  
  if (!recordType || recordType === 'recheck_note') {
    const rechecks = queryService.getRecheckNotes({ 
      batchNumber, 
      limit: 10000, 
      offset: 0 
    });
    
    const recheckFields = [
      { label: '批次号', value: 'batch_number' },
      { label: '样品瓶码', value: 'bottle_code' },
      { label: '复检原因', value: 'recheck_reason' },
      { label: '复检操作员', value: 'recheck_operator' },
      { label: '复检时间', value: 'recheck_time' },
      { label: '原始值', value: 'original_value' },
      { label: '复检值', value: 'recheck_value' },
      { label: '结论', value: 'conclusion' },
      { label: '创建时间', value: 'created_at' }
    ];
    
    if (rechecks.length > 0) {
      const recheckParser = new Parser({ fields: recheckFields });
      results.recheckNotes = {
        data: recheckParser.parse(rechecks),
        count: rechecks.length
      };
    } else {
      results.recheckNotes = { data: '', count: 0 };
    }
  }
  
  if (!recordType || recordType === 'sampling_point') {
    const points = queryService.getSamplingPoints({ limit: 10000, offset: 0 });
    
    const pointFields = [
      { label: '采样点编码', value: 'point_code' },
      { label: '采样点名称', value: 'point_name' },
      { label: '位置', value: 'location' },
      { label: '描述', value: 'description' },
      { label: '创建时间', value: 'created_at' }
    ];
    
    if (points.length > 0) {
      const pointParser = new Parser({ fields: pointFields });
      results.samplingPoints = {
        data: pointParser.parse(points),
        count: points.length
      };
    } else {
      results.samplingPoints = { data: '', count: 0 };
    }
  }
  
  if (!recordType || recordType === 'instrument') {
    const instruments = queryService.getInstruments({ limit: 10000, offset: 0 });
    
    const instrumentFields = [
      { label: '仪器编码', value: 'instrument_code' },
      { label: '仪器名称', value: 'instrument_name' },
      { label: '型号', value: 'model' },
      { label: '上次校准日期', value: 'last_calibration' },
      { label: '状态', value: 'status' },
      { label: '创建时间', value: 'created_at' }
    ];
    
    if (instruments.length > 0) {
      const instrumentParser = new Parser({ fields: instrumentFields });
      results.instruments = {
        data: instrumentParser.parse(instruments),
        count: instruments.length
      };
    } else {
      results.instruments = { data: '', count: 0 };
    }
  }
  
  return results;
};

const exportRejectsJSON = (options = {}) => {
  const { batchNumber, isFixed, riskLevel, recordType } = options;
  
  const rejectedRecords = queryService.getRejectedRecords({
    batchNumber,
    isFixed,
    riskLevel,
    recordType,
    limit: 10000,
    offset: 0
  });
  
  const formattedRecords = rejectedRecords.map(record => ({
    id: record.id,
    batchNumber: record.batch_number,
    batchImportTime: record.batch_import_time,
    originalFilename: record.original_filename,
    lineNumber: record.line_number,
    recordType: record.record_type,
    originalContent: JSON.parse(record.original_content),
    errorReason: record.error_reason,
    errorDetails: record.error_details ? JSON.parse(record.error_details) : null,
    bottleCode: record.bottle_code,
    isFixed: record.is_fixed === 1,
    fixedBy: record.fixed_by,
    fixedAt: record.fixed_at,
    fixedContent: record.fixed_content ? JSON.parse(record.fixed_content) : null,
    riskLevel: record.risk_level,
    riskScore: record.risk_score,
    createdAt: record.created_at
  }));
  
  const summary = {
    exportTime: new Date().toISOString(),
    total: formattedRecords.length,
    byRiskLevel: {},
    byRecordType: {},
    fixedCount: formattedRecords.filter(r => r.isFixed).length,
    pendingCount: formattedRecords.filter(r => !r.isFixed).length
  };
  
  formattedRecords.forEach(record => {
    summary.byRiskLevel[record.riskLevel] = (summary.byRiskLevel[record.riskLevel] || 0) + 1;
    summary.byRecordType[record.recordType] = (summary.byRecordType[record.recordType] || 0) + 1;
  });
  
  return {
    summary,
    records: formattedRecords
  };
};

const generateMarkdownReport = (options = {}) => {
  const { batchNumber, includeDuplicates = true } = options;
  
  const stats = queryService.getStatistics();
  const batches = batchNumber 
    ? [queryService.getBatchByNumber(batchNumber)].filter(Boolean)
    : queryService.getBatches({ limit: 100, offset: 0 });
  
  let report = `# 水质检测数据交接报告\n\n`;
  report += `**生成时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;
  report += `---\n\n`;
  
  report += `## 一、数据统计概览\n\n`;
  report += `| 指标 | 数量 |\n`;
  report += `|------|------|\n`;
  report += `| 总批次 | ${stats.totalBatches} |\n`;
  report += `| 水样记录 | ${stats.totalSamples} |\n`;
  report += `| 仪器读数 | ${stats.totalReadings} |\n`;
  report += `| 复检记录 | ${stats.totalRechecks} |\n\n`;
  
  report += `### 隔离记录风险分布\n\n`;
  if (stats.rejectedByRisk && stats.rejectedByRisk.length > 0) {
    report += `| 风险等级 | 数量 |\n`;
    report += `|----------|------|\n`;
    stats.rejectedByRisk.forEach(item => {
      const levelName = {
        'low': '低风险',
        'medium': '中风险',
        'high': '高风险',
        'unknown': '未知'
      }[item.risk_level] || item.risk_level;
      report += `| ${levelName} | ${item.count} |\n`;
    });
  } else {
    report += `暂无隔离记录\n\n`;
  }
  
  report += `\n### 隔离记录处理状态\n\n`;
  if (stats.fixedStats) {
    report += `| 状态 | 数量 |\n`;
    report += `|------|------|\n`;
    report += `| 总隔离记录 | ${stats.fixedStats.total_rejected || 0} |\n`;
    report += `| 已修复 | ${stats.fixedStats.fixed_count || 0} |\n`;
    report += `| 待处理 | ${stats.fixedStats.pending_count || 0} |\n\n`;
  }
  
  report += `---\n\n`;
  
  report += `## 二、批次详情\n\n`;
  batches.forEach((batch, index) => {
    report += `### 批次 ${batch.batch_number}\n\n`;
    report += `- **导入时间**: ${batch.import_time}\n`;
    report += `- **原始文件名**: ${batch.original_filename || '未知'}\n`;
    report += `- **状态**: ${batch.status === 'active' ? '正常' : batch.status}\n\n`;
    
    const batchSamples = queryService.getWaterSamples({ 
      batchNumber: batch.batch_number, 
      limit: 100, 
      offset: 0 
    });
    
    const batchRejected = queryService.getRejectedRecords({ 
      batchNumber: batch.batch_number, 
      limit: 10000, 
      offset: 0 
    });
    
    const batchDuplicates = includeDuplicates ? queryService.getDuplicateRecords({ 
      batchNumber: batch.batch_number, 
      limit: 10000, 
      offset: 0 
    }) : [];
    
    report += `#### 本批次数据统计\n\n`;
    report += `- 有效水样记录: ${batchSamples.length}\n`;
    report += `- 隔离记录: ${batchRejected.length}\n`;
    if (includeDuplicates) {
      report += `- 检测到的重复记录: ${batchDuplicates.length}\n`;
    }
    report += `\n`;
    
    if (batchSamples.length > 0) {
      report += `#### 有效水样记录（前10条）\n\n`;
      report += `| 样品瓶码 | 采样点 | 采样时间 | 温度 | pH |\n`;
      report += `|----------|--------|----------|------|----|\n`;
      batchSamples.slice(0, 10).forEach(sample => {
        report += `| ${sample.bottle_code || '-'} | ${sample.point_name || sample.point_code || '-'} | ${sample.sampling_time || '-'} | ${sample.temperature !== null ? sample.temperature : '-'} | ${sample.ph !== null ? sample.ph : '-'} |\n`;
      });
      if (batchSamples.length > 10) {
        report += `\n... 还有 ${batchSamples.length - 10} 条记录\n`;
      }
      report += `\n`;
    }
    
    if (batchRejected.length > 0) {
      report += `#### 隔离记录详情\n\n`;
      const pendingRecords = batchRejected.filter(r => r.is_fixed === 0);
      const fixedRecords = batchRejected.filter(r => r.is_fixed === 1);
      
      if (pendingRecords.length > 0) {
        report += `##### 待处理记录 (${pendingRecords.length}条)\n\n`;
        report += `| 行号 | 记录类型 | 错误原因 | 风险等级 | 瓶码 |\n`;
        report += `|------|----------|----------|----------|------|\n`;
        pendingRecords.forEach(record => {
          const typeName = {
            'water_sample': '水样',
            'instrument_reading': '仪器读数',
            'recheck_note': '复检记录',
            'sampling_point': '采样点',
            'instrument': '仪器'
          }[record.record_type] || record.record_type;
          
          const riskName = {
            'low': '低',
            'medium': '中',
            'high': '高',
            'unknown': '未知'
          }[record.risk_level] || record.risk_level;
          
          report += `| ${record.line_number} | ${typeName} | ${record.error_reason.substring(0, 30)}${record.error_reason.length > 30 ? '...' : ''} | ${riskName} | ${record.bottle_code || '-'} |\n`;
        });
        report += `\n`;
      }
      
      if (fixedRecords.length > 0) {
        report += `##### 已修复记录 (${fixedRecords.length}条)\n\n`;
        report += `| 行号 | 记录类型 | 修复人 | 修复时间 | 风险等级 |\n`;
        report += `|------|----------|--------|----------|----------|\n`;
        fixedRecords.forEach(record => {
          const typeName = {
            'water_sample': '水样',
            'instrument_reading': '仪器读数',
            'recheck_note': '复检记录',
            'sampling_point': '采样点',
            'instrument': '仪器'
          }[record.record_type] || record.record_type;
          
          const riskName = {
            'low': '低',
            'medium': '中',
            'high': '高',
            'unknown': '未知'
          }[record.risk_level] || record.risk_level;
          
          report += `| ${record.line_number} | ${typeName} | ${record.fixed_by || '-'} | ${record.fixed_at || '-'} | ${riskName} |\n`;
        });
        report += `\n`;
      }
    }
    
    if (index < batches.length - 1) {
      report += `---\n\n`;
    }
  });
  
  report += `---\n\n`;
  
  report += `## 三、注意事项\n\n`;
  report += `1. **隔离记录**: 请优先处理高风险和中风险的隔离记录\n`;
  report += `2. **重复记录**: 系统已自动跳过重复导入的记录，详情可查询重复记录接口\n`;
  report += `3. **数据导出**: 可通过导出接口获取完整的 clean.csv 和 rejects.json 文件\n`;
  report += `4. **风险评估**: 风险等级由系统自动评估，人工标记修复后可重新评估\n\n`;
  
  report += `---\n\n`;
  
  report += `*报告生成完毕 - ${new Date().toLocaleString('zh-CN')}*\n`;
  
  return report;
};

module.exports = {
  exportCleanCSV,
  exportRejectsJSON,
  generateMarkdownReport
};
