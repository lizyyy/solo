const path = require('path');
const fs = require('fs');
const { importModelOutput, importManualReview, importCorrectionLog } = require('./dataImporter');
const { checkRecordPrivacy } = require('./privacyChecker');
const { mergeManualReview, calculateStats } = require('./dataMerger');
const { generateSanitizedExport, generateWeeklyReport, saveRunRecord } = require('./exporter');

function generateRunId() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 6);
  return `${dateStr}_${random}`;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function runPipeline(options = {}) {
  const runId = generateRunId();
  const baseDir = options.baseDir || process.cwd();
  const dataDir = path.join(baseDir, 'data');
  const outputDir = path.join(baseDir, 'output');
  ensureDir(outputDir);
  
  const modelOutputPath = options.modelOutput || path.join(dataDir, 'model_output_raw.csv');
  const manualReviewPath = options.manualReview || path.join(dataDir, 'manual_review_sheet.csv');
  const correctionLogPath = options.correctionLog || path.join(dataDir, 'manual_correction_log.json');
  
  console.log(`\n🚀 开始运行问答命中率周报流程`);
  console.log(`运行ID: ${runId}`);
  console.log(`数据目录: ${dataDir}`);
  console.log(`输出目录: ${outputDir}`);
  console.log('');
  
  console.log('📥 步骤1: 导入模型输出片段');
  const modelRecords = importModelOutput(modelOutputPath);
  console.log(`   导入 ${modelRecords.length} 条模型输出记录`);
  
  console.log('🔍 步骤2: 隐私检测（手机号脱敏检查）');
  let totalPrivacyIssues = 0;
  modelRecords.forEach(record => {
    const issues = checkRecordPrivacy(record);
    record.warnings = issues;
    if (issues.length > 0) {
      totalPrivacyIssues += issues.length;
      console.log(`   ⚠️  ${record.id}: 发现 ${issues.length} 个隐私问题，留待算法复核`);
    }
  });
  console.log(`   共发现 ${totalPrivacyIssues} 个隐私问题`);
  
  console.log('📝 步骤3: 导入人工改判表');
  const reviewRecords = importManualReview(manualReviewPath);
  console.log(`   导入 ${reviewRecords.length} 条人工改判记录`);
  
  console.log('📋 步骤4: 导入人工修正日志');
  let correctionLog = null;
  if (fs.existsSync(correctionLogPath)) {
    correctionLog = importCorrectionLog(correctionLogPath);
    console.log(`   导入 1 份人工修正日志: ${correctionLog.correction_id}`);
    console.log(`   操作人: ${correctionLog.operator}, 说明: ${correctionLog.description}`);
  }
  
  console.log('🔄 步骤5: 合并数据，保留完整变更痕迹');
  const mergedRecords = mergeManualReview(modelRecords, reviewRecords, correctionLog);
  const stats = calculateStats(mergedRecords);
  console.log(`   合并完成，共 ${mergedRecords.length} 条记录`);
  console.log(`   命中率: ${stats.hitRate} (${stats.hitCount}/${stats.total})`);
  
  console.log('📤 步骤6: 生成脱敏导出CSV');
  const exportResult = generateSanitizedExport(mergedRecords, outputDir, runId);
  console.log(`   导出文件: ${exportResult.path}`);
  
  console.log('📊 步骤7: 生成周报文档');
  const reportResult = generateWeeklyReport(mergedRecords, stats, runId, {
    outputDir,
    weekRange: options.weekRange
  });
  console.log(`   周报文件: ${reportResult.path}`);
  
  console.log('💾 步骤8: 保存运行记录（用于复盘和重跑）');
  const runRecord = {
    runId,
    runTime: new Date().toISOString(),
    inputs: {
      modelOutput: modelOutputPath,
      manualReview: manualReviewPath,
      correctionLog: correctionLogPath
    },
    stats,
    recordCount: mergedRecords.length,
    outputs: {
      sanitizedExport: exportResult.path,
      weeklyReport: reportResult.path
    },
    notes: [
      '手机号漏遮问题已标记，未自动修复，留给算法同事复核',
      '人工改判表备注完整保留在导出和周报中',
      '所有变更历史可追溯'
    ]
  };
  const recordPath = saveRunRecord(runRecord, outputDir);
  console.log(`   运行记录: ${recordPath}`);
  
  console.log('');
  console.log('✅ 流程完成！');
  console.log('');
  console.log('📌 三种场景处理结果:');
  mergedRecords.forEach(r => {
    const scenario = r.warnings.length > 0 ? '手机号漏遮' : 
                      (r.manual_review ? '人工改判补录' : '顺利记录');
    console.log(`   ${r.id}: ${scenario} → 最终命中: ${r.hit_final}`);
  });
  
  return {
    runId,
    records: mergedRecords,
    stats,
    outputs: {
      sanitizedExport: exportResult.path,
      weeklyReport: reportResult.path,
      runRecord: recordPath
    }
  };
}

function listRuns(outputDir) {
  const dir = outputDir || path.join(process.cwd(), 'output');
  if (!fs.existsSync(dir)) return [];
  
  const files = fs.readdirSync(dir);
  const runRecords = files
    .filter(f => f.startsWith('run_record_') && f.endsWith('.json'))
    .map(f => {
      const content = fs.readFileSync(path.join(dir, f), 'utf-8');
      return JSON.parse(content);
    })
    .sort((a, b) => new Date(b.runTime) - new Date(a.runTime));
  
  return runRecords;
}

module.exports = {
  runPipeline,
  listRuns,
  generateRunId
};
