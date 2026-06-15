const dbModule = require('./db');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const db = dbModule;

const BUCKET_THRESHOLDS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
const dbPath = path.join(__dirname, '..', 'data', 'db.json');

function loadJSON() {
  if (!fs.existsSync(dbPath)) return {};
  try { return JSON.parse(fs.readFileSync(dbPath, 'utf-8')); } catch(e) { return {}; }
}

function scoreToBucket(score) {
  if (score == null) return null;
  for (let i = 0; i < BUCKET_THRESHOLDS.length; i++) {
    if (score < BUCKET_THRESHOLDS[i]) return i + 1;
  }
  return BUCKET_THRESHOLDS.length + 1;
}

function checkDuplicateImport(reportId) {
  const data = loadJSON();
  const samples = (data.negative_samples || []).filter(s => s.report_id == reportId);
  const itemIds = new Map();
  const duplicates = [];

  samples.forEach(s => {
    if (itemIds.has(s.item_id)) {
      duplicates.push({
        item_id: s.item_id,
        lines: [itemIds.get(s.item_id), s.original_line_no]
      });
    } else {
      itemIds.set(s.item_id, s.original_line_no);
    }
  });

  return {
    passed: duplicates.length === 0,
    details: duplicates.length > 0 
      ? `发现 ${duplicates.length} 个重复导入的 item_id` 
      : '无重复导入',
    duplicates
  };
}

function checkBucketDifference(reportId) {
  const data = loadJSON();
  const samples = (data.negative_samples || []).filter(s => s.report_id == reportId);
  const anomalies = [];

  samples.forEach(s => {
    if (s.offline_bucket != null && s.online_bucket != null) {
      const diff = Math.abs(s.offline_bucket - s.online_bucket);
      if (diff === 1) {
        anomalies.push({
          sample_id: s.id,
          item_id: s.item_id,
          item_title: s.item_title,
          offline_bucket: s.offline_bucket,
          online_bucket: s.online_bucket,
          offline_score: s.offline_score,
          online_score: s.online_score
        });
      }
    }
  });

  return {
    passed: true,
    details: `检测到 ${anomalies.length} 条离线线上分差一个桶的记录（需评测运营复核）`,
    anomalies
  };
}

function checkExportConsistency(reportId) {
  const data = loadJSON();
  const exports = (data.export_records || []).filter(e => e.report_id == reportId);
  const latestExport = exports.sort((a, b) => new Date(b.exported_at) - new Date(a.exported_at))[0];

  if (!latestExport) {
    return {
      passed: false,
      details: '尚未导出过，无法校验一致性',
      currentHash: null,
      lastExportHash: null
    };
  }

  const samples = (data.negative_samples || [])
    .filter(s => s.report_id == reportId)
    .sort((a, b) => a.original_line_no - b.original_line_no);

  const currentHash = crypto
    .createHash('md5')
    .update(JSON.stringify(samples))
    .digest('hex');

  const consistent = currentHash === latestExport.content_hash;

  return {
    passed: consistent,
    details: consistent ? '当前数据与上次导出一致' : '数据已变更，与上次导出不一致',
    currentHash,
    lastExportHash: latestExport.content_hash
  };
}

function checkRecalcAfterSupplement(reportId) {
  const data = loadJSON();
  const recallCount = (data.recall_candidates || []).filter(r => r.report_id == reportId).length;
  const samplesWithRecall = (data.negative_samples || []).filter(s => 
    s.report_id == reportId && s.recall_candidate_added == 1
  ).length;

  const passed = recallCount === 0 || samplesWithRecall > 0;

  return {
    passed,
    details: passed 
      ? '补录召回候选后已关联重算' 
      : '存在召回候选补录但未关联到负样本，需要重算',
    recallCount,
    samplesWithRecall
  };
}

function runAllChecks(reportId) {
  const results = {
    duplicate_import: checkDuplicateImport(reportId),
    bucket_diff: checkBucketDifference(reportId),
    export_consistency: checkExportConsistency(reportId),
    recalc_after_supplement: checkRecalcAfterSupplement(reportId)
  };

  const stmt = db.prepare(`
    INSERT INTO self_check_results (report_id, check_type, check_passed, details)
    VALUES (?, ?, ?, ?)
  `);

  Object.entries(results).forEach(([type, r]) => {
    stmt.run(reportId, type, r.passed ? 1 : 0, r.details);
  });

  return results;
}

function calculateBucketForSample(sample) {
  const offline_bucket = scoreToBucket(sample.offline_score);
  const online_bucket = scoreToBucket(sample.online_score);
  const bucket_diff = (offline_bucket != null && online_bucket != null)
    ? Math.abs(offline_bucket - online_bucket)
    : null;
  const is_bucket_diff_anomaly = bucket_diff === 1 ? 1 : 0;

  return { offline_bucket, online_bucket, bucket_diff, is_bucket_diff_anomaly };
}

module.exports = {
  checkDuplicateImport,
  checkBucketDifference,
  checkExportConsistency,
  checkRecalcAfterSupplement,
  runAllChecks,
  calculateBucketForSample,
  scoreToBucket
};
