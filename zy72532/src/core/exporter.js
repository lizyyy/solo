const fs = require('fs');
const path = require('path');
const { stringify } = require('csv-stringify/sync');

function generateSanitizedExport(records, outputDir, runId) {
  const exportRecords = records.map(record => {
    const exportRow = {
      id: record.id,
      question: record.question,
      model_answer: record.model_answer,
      hit_original: record.hit,
      hit_final: record.hit_final,
      hit_source: record.hit_source,
      phone: record.phone,
      user_name: record.user_name,
      create_time: record.create_time,
      has_manual_review: record.manual_review ? '是' : '否',
      review_note: record.manual_review ? record.manual_review.review_note : '',
      old_caliber_info: record.manual_review ? record.manual_review.old_caliber_info : '',
      change_count: record.change_history.length,
      change_details: record.change_history.length > 0 
        ? record.change_history.map(c => `${c.field}: ${c.old_value} → ${c.new_value} (${c.reason})`).join(' | ')
        : '',
      privacy_warning: record.warnings && record.warnings.length > 0 ? '是' : '否',
      privacy_warning_details: record.warnings && record.warnings.length > 0
        ? record.warnings.map(w => `${w.message} [${w.action}]`).join('; ')
        : ''
    };
    return exportRow;
  });
  
  const csvContent = stringify(exportRecords, { header: true });
  const outputPath = path.join(outputDir, `sanitized_export_${runId}.csv`);
  fs.writeFileSync(outputPath, csvContent, 'utf-8');
  
  return {
    path: outputPath,
    recordCount: exportRecords.length,
    hasPrivacyIssues: records.some(r => r.warnings && r.warnings.length > 0)
  };
}

function generateWeeklyReport(records, stats, runId, metadata) {
  const lines = [];
  
  lines.push('========================================');
  lines.push('       问答命中率周报');
  lines.push('========================================');
  lines.push(`运行ID: ${runId}`);
  lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`数据周期: ${metadata.weekRange || '2026-06-01 至 2026-06-07'}`);
  lines.push('');
  
  lines.push('【一、整体统计】');
  lines.push('----------------------------------------');
  lines.push(`总问答数: ${stats.total}`);
  lines.push(`命中数: ${stats.hitCount}`);
  lines.push(`命中率: ${stats.hitRate}`);
  lines.push(`人工改判数: ${stats.manualReviewed}`);
  lines.push(`结果变更数: ${stats.changedCount}`);
  lines.push(`隐私问题数: ${stats.privacyIssues}`);
  lines.push('');
  
  lines.push('【二、逐条明细】');
  lines.push('----------------------------------------');
  lines.push('');
  
  records.forEach((record, index) => {
    lines.push(`--- 记录 ${index + 1}: ${record.id} ---`);
    lines.push(`问题: ${record.question}`);
    lines.push(`模型回答: ${record.model_answer}`);
    lines.push(`原始命中: ${record.hit} → 最终命中: ${record.hit_final}`);
    lines.push(`数据来源: ${record.hit_source}`);
    
    if (record.manual_review) {
      lines.push(`人工改判人: ${record.manual_review.reviewer}`);
      lines.push(`改判时间: ${record.manual_review.review_time}`);
      lines.push(`改判备注: ${record.manual_review.review_note}`);
      if (record.manual_review.old_caliber_info) {
        lines.push(`旧口径说明: ${record.manual_review.old_caliber_info}`);
      }
    }
    
    if (record.change_history.length > 0) {
      lines.push('变更历史:');
      record.change_history.forEach((change, i) => {
        lines.push(`  ${i + 1}. ${change.field}: ${change.old_value} → ${change.new_value}`);
        lines.push(`     原因: ${change.reason} [来源: ${change.source}]`);
      });
    }
    
    if (record.warnings && record.warnings.length > 0) {
      lines.push('⚠️  隐私警告:');
      record.warnings.forEach(w => {
        lines.push(`  - ${w.message}（${w.action}）`);
      });
    }
    
    lines.push('');
  });
  
  lines.push('【三、复盘说明】');
  lines.push('----------------------------------------');
  lines.push('1. 顺利记录（如Q001）：模型输出正常，脱敏正常，无需人工干预');
  lines.push('2. 手机号漏遮（如Q002）：已标记，留给算法同事复核，暂不归入正常');
  lines.push('3. 人工改判补录（如Q003）：从人工改判表补入旧口径结果，保留完整备注');
  lines.push('');
  lines.push('【四、重跑命令】');
  lines.push('----------------------------------------');
  lines.push(`npm run demo`);
  lines.push(`# 或: node src/cli.js run --demo`);
  lines.push('');
  lines.push('========================================');
  
  const reportPath = path.join(metadata.outputDir, `weekly_report_${runId}.md`);
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');
  
  return {
    path: reportPath,
    content: lines.join('\n')
  };
}

function saveRunRecord(runData, outputDir) {
  const recordPath = path.join(outputDir, `run_record_${runData.runId}.json`);
  fs.writeFileSync(recordPath, JSON.stringify(runData, null, 2), 'utf-8');
  return recordPath;
}

module.exports = {
  generateSanitizedExport,
  generateWeeklyReport,
  saveRunRecord
};
