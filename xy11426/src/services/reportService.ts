import { getDatabase } from '../db/database';
import { getBatchCheckResults } from './checkService';
import { getFixedRecords } from './fixService';
import { ReportData, DataSourceType } from '../types';

export function generateReport(batchId: string): ReportData {
  const db = getDatabase();
  
  const batch = db.prepare(`
    SELECT * FROM import_batches WHERE id = ?
  `).get(batchId) as any;

  if (!batch) {
    throw new Error(`批次不存在: ${batchId}`);
  }

  const records = db.prepare(`
    SELECT * FROM visitor_records WHERE batch_id = ?
  `).all(batchId) as any[];

  const checkResults = getBatchCheckResults(batchId, false);
  const fixedRecords = getFixedRecords(batchId);

  const failures: ReportData['failures'] = [];
  const processedRecordIds = new Set<string>();

  for (const check of checkResults) {
    if (check.passed === 0 && !processedRecordIds.has(check.record_id)) {
      const record = records.find(r => r.id === check.record_id);
      if (record) {
        failures.push({
          originalLineNo: record.original_line_no,
          visitorName: record.visitor_name,
          reason: check.message,
          suggestion: getSuggestion(check.message)
        });
        processedRecordIds.add(check.record_id);
      }
    }
  }

  const fixedList: ReportData['fixedList'] = [];
  for (const fixed of fixedRecords) {
    try {
      const oldVal = JSON.parse(fixed.old_value || '{}');
      const newVal = JSON.parse(fixed.new_value || '{}');
      
      const field = Object.keys(oldVal)[0] || Object.keys(newVal)[0] || 'unknown';
      fixedList.push({
        originalLineNo: fixed.original_line_no,
        visitorName: fixed.visitor_name,
        oldValue: oldVal[field] || '',
        newValue: newVal[field] || '',
        fixReason: newVal.reason || '手动修复'
      });
    } catch {
      fixedList.push({
        originalLineNo: fixed.original_line_no,
        visitorName: fixed.visitor_name,
        oldValue: fixed.old_value || '',
        newValue: fixed.new_value || '',
        fixReason: '手动修复'
      });
    }
  }

  return {
    batchId: batch.id,
    fileName: batch.file_name,
    sourceType: batch.source_type as DataSourceType,
    importTime: batch.created_at,
    operator: batch.operator,
    totalRecords: records.length,
    validRecords: batch.valid_records || 0,
    invalidRecords: batch.invalid_records || 0,
    fixedRecords: fixedList.length,
    failures,
    fixedList
  };
}

function getSuggestion(message: string): string {
  const suggestions: Record<string, string> = {
    '手机号为空': '请补充访客手机号',
    '手机号格式不正确': '请检查手机号格式，应为11位数字',
    '身份证号格式不正确': '请检查身份证号格式',
    '车牌号格式不正确': '请检查车牌号格式',
    '访问日期为空': '请补充访问日期',
    '开始时间晚于结束时间': '请调整访问时间范围，或将结束时间设为23:59:59',
    '疑似跨天权限未收回': '请核实该访客权限是否已收回，或确认是否为临时放行跨天',
    '闸机记录超过权限结束时间24小时以上': '请核实该访客权限是否已按时收回',
    '访客姓名为空或未知': '请补充访客姓名'
  };

  for (const [key, value] of Object.entries(suggestions)) {
    if (message.includes(key)) {
      return value;
    }
  }

  return '请检查数据后手动修正';
}

export function formatReportText(report: ReportData): string {
  const sourceTypeNames: Record<string, string> = {
    'visitor_appointment': '访客预约表',
    'gate_record': '闸机记录',
    'temp_plate': '临时车牌',
    'refund_flow': '退款流水'
  };

  let text = `
═══════════════════════════════════════════════════════════════
                    园区访客通行巡检报表
═══════════════════════════════════════════════════════════════

【基本信息】
  批次ID: ${report.batchId}
  文件名: ${report.fileName}
  数据类型: ${sourceTypeNames[report.sourceType] || report.sourceType}
  导入时间: ${report.importTime}
  操作员: ${report.operator}

【数据统计】
  总记录数: ${report.totalRecords}
  有效记录: ${report.validRecords}
  问题记录: ${report.invalidRecords}
  已修复: ${report.fixedRecords}

═══════════════════════════════════════════════════════════════
                        失败清单
═══════════════════════════════════════════════════════════════

`;

  if (report.failures.length === 0) {
    text += '  无失败记录\n';
  } else {
    text += `  行号  | 访客姓名 | 问题原因\n`;
    text += `  ${'─'.repeat(60)}\n`;
    
    for (const failure of report.failures) {
      text += `  ${String(failure.originalLineNo).padEnd(4)} | ${failure.visitorName.padEnd(8)} | ${failure.reason}\n`;
      text += `         |          | 建议: ${failure.suggestion}\n`;
    }
  }

  text += `
═══════════════════════════════════════════════════════════════
                        修复清单
═══════════════════════════════════════════════════════════════

`;

  if (report.fixedList.length === 0) {
    text += '  无修复记录\n';
  } else {
    text += `  行号  | 访客姓名 | 修复内容\n`;
    text += `  ${'─'.repeat(60)}\n`;
    
    for (const fixed of report.fixedList) {
      text += `  ${String(fixed.originalLineNo).padEnd(4)} | ${fixed.visitorName.padEnd(8)} | ${fixed.fixReason}\n`;
      text += `         |          | ${fixed.oldValue} → ${fixed.newValue}\n`;
    }
  }

  text += `
═══════════════════════════════════════════════════════════════
                          报表结束
═══════════════════════════════════════════════════════════════
`;

  return text;
}

export function getSummary(): any {
  const db = getDatabase();
  
  const batches = db.prepare(`
    SELECT 
      source_type,
      COUNT(*) as batch_count,
      SUM(total_records) as total_records,
      SUM(valid_records) as valid_records,
      SUM(invalid_records) as invalid_records
    FROM import_batches
    GROUP BY source_type
  `).all();

  const tasks = db.prepare(`
    SELECT 
      status,
      COUNT(*) as count
    FROM async_tasks
    GROUP BY status
  `).all();

  return {
    batches,
    tasks
  };
}
