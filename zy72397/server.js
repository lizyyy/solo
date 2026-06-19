const express = require('express');
const cors = require('cors');
const path = require('path');
const dataStore = require('./src/store/data-store');
const workflowEngine = require('./src/engine/workflow-engine');
const { STATUS, BOUNDARY_RULES } = require('./src/models/boundary-rules');
const { formatViewRecord, UNIFIED_FIELDS, REPLAY_PARAM_SPEC } = require('./src/models/unified-fields');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 启动时从持久化文件加载数据（所有命令/Web共用同一份证据链）
const runtimeLoadResult = dataStore.load();
if (runtimeLoadResult.loaded) {
  dataStore.enableAutoSave(true);
  console.log(`📂 已从持久化文件加载数据: ${runtimeLoadResult.path}`);
  console.log(`   记录: ${runtimeLoadResult.records} 条 | 审计日志: ${runtimeLoadResult.audit_logs} 条`);
} else {
  console.log(`ℹ️  持久化文件不存在或加载失败 (${runtimeLoadResult.reason})，从空开始`);
  console.log(`   运行 'npm run prepare-demo' 可构建完整演示场景`);
}
console.log('');

app.get('/api/records', (req, res) => {
  const { status, turbineId, needsQcReview, hasBoundaryIssues, recordId } = req.query;
  const filters = {};
  if (status) filters.status = status;
  if (turbineId) filters.turbineId = turbineId;
  if (needsQcReview === 'true') filters.needsQcReview = true;
  if (hasBoundaryIssues === 'true') filters.hasBoundaryIssues = true;
  if (recordId) filters.recordId = recordId;

  const data = dataStore.getUnifiedView(filters);
  res.json({
    success: true,
    data: data,
    source: 'dataStore.getUnifiedView()',
    _filters_applied: filters,
    _note: '页面、导出、API 共用此唯一数据源，禁止各自读取原始 records'
  });
});

app.get('/api/records/:id', (req, res) => {
  const record = dataStore.getRecordById(req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, error: '记录不存在' });
  }
  res.json({
    success: true,
    data: formatViewRecord(record),
    source: 'formatViewRecord(record)',
    _consistency_check: '与 /api/records 和 /api/export 同一转换函数'
  });
});

app.get('/api/records/:id/audit', (req, res) => {
  try {
    const audit = workflowEngine.replayAuditLog(req.params.id);
    res.json({
      success: true,
      data: audit,
      _note: '审计日志包含完整的 status_history / manual_changes / full_audit_log'
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.get('/api/export', (req, res) => {
  const format = (req.query.format || 'json').toLowerCase();
  const { needsQcReview, hasBoundaryIssues, recordId, status, turbineId } = req.query;
  const filters = {};
  if (needsQcReview === 'true') filters.needsQcReview = true;
  if (hasBoundaryIssues === 'true') filters.hasBoundaryIssues = true;
  if (recordId) filters.recordId = recordId;
  if (status) filters.status = status;
  if (turbineId) filters.turbineId = turbineId;

  const data = dataStore.getExportData(format, filters);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('X-Unified-View-Filters', JSON.stringify(filters));
    res.setHeader('X-Data-Source', 'dataStore.getExportData() 内部调用 getUnifiedView()');
    const filename = needsQcReview === 'true' ? 'turbine-efficiency-qc-review.csv' : 'turbine-efficiency.csv';
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + data);
  } else {
    res.json({
      success: true,
      data: JSON.parse(data),
      source: 'dataStore.getExportData() → getUnifiedView() → formatViewRecord()',
      _filters_applied: filters,
      _consistency: '字段定义完全与 /api/records /api/records/:id 同一份 UNIFIED_FIELDS'
    });
  }
});

app.get('/api/statistics', (req, res) => {
  res.json({
    success: true,
    data: dataStore.getStatistics(),
    _consistency_note: '统计基于同一份 records，与导出/页面使用同一数据'
  });
});

app.get('/api/consistency', (req, res) => {
  res.json({
    success: true,
    data: dataStore.verifyConsistency()
  });
});

app.post('/api/import', (req, res) => {
  try {
    let data, operator;
    if (Array.isArray(req.body)) {
      data = req.body;
      operator = 'system';
    } else {
      data = req.body.data;
      operator = req.body.operator;
    }
    if (!Array.isArray(data)) {
      return res.status(400).json({ success: false, error: '导入数据必须是数组' });
    }
    const result = workflowEngine.importSensorData(data, operator || 'system');
    const consistency = dataStore.verifyConsistency();
    res.json({
      success: true,
      data: result,
      _post_import_consistency: consistency,
      _auto_boundary: '导入时自动按相邻记录执行边界规则，采样时间缺半小时自动 NEED_QC_REVIEW'
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message, stack: e.stack });
  }
});

app.post('/api/records/:id/engineer-review', (req, res) => {
  try {
    const { operator, notes, photoUrls } = req.body;
    const record = workflowEngine.engineerReview(
      req.params.id,
      operator || '何工',
      notes,
      photoUrls || []
    );
    const consistency = dataStore.verifyConsistency();
    res.json({
      success: true,
      data: formatViewRecord(record),
      _post_action_consistency: consistency
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/api/records/:id/submit-qc', (req, res) => {
  try {
    const { operator, remark } = req.body;
    const record = workflowEngine.submitForQcReview(req.params.id, operator || '何工', remark);
    res.json({ success: true, data: formatViewRecord(record) });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/api/records/:id/qc-approve', (req, res) => {
  try {
    const { operator, remark } = req.body;
    const record = workflowEngine.qcApprove(req.params.id, operator || '质检员', remark);
    const consistency = dataStore.verifyConsistency();
    res.json({
      success: true,
      data: formatViewRecord(record),
      _fields_updated: { qc_review_required: record.qc_review_required, current_status: record.current_status },
      _post_action_consistency: consistency
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/api/records/:id/qc-reject', (req, res) => {
  try {
    const { operator, reason } = req.body;
    const record = workflowEngine.qcReject(req.params.id, operator || '质检员', reason);
    res.json({ success: true, data: formatViewRecord(record) });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/api/records/:id/finalize', (req, res) => {
  try {
    const { operator, conclusion } = req.body;
    if (!conclusion) {
      return res.status(400).json({ success: false, error: 'finalize 必须提供 conclusion' });
    }
    const record = workflowEngine.finalizeConclusion(req.params.id, operator || '何工', conclusion);
    const consistency = dataStore.verifyConsistency();
    res.json({
      success: true,
      data: formatViewRecord(record),
      _conclusion_snapshot: {
        conclusion: record.conclusion,
        version: record.conclusion_version,
        previous_count: record.previous_versions.length
      },
      _post_action_consistency: consistency
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.post('/api/records/:id/rework', (req, res) => {
  try {
    const { operator, reason, photoUrls } = req.body;
    if (!reason) {
      return res.status(400).json({ success: false, error: 'rework 必须提供 reason' });
    }
    const oldBefore = dataStore.getRecordById(req.params.id);
    const oldConclusionBefore = oldBefore ? oldBefore.conclusion : null;

    const result = workflowEngine.createRework(
      req.params.id,
      operator || '何工',
      reason,
      photoUrls || []
    );

    const oldAfter = dataStore.getRecordById(result.old_record_id);
    const newRecord = dataStore.getRecordById(result.new_record_id);
    const consistency = dataStore.verifyConsistency();

    res.json({
      success: true,
      data: result,
      _rework_evidence_chain: {
        old_record_id: result.old_record_id,
        old_status_before: oldBefore ? oldBefore.current_status : null,
        old_status_after: oldAfter ? oldAfter.current_status : 'MISSING',
        old_superseded_by: oldAfter ? oldAfter.superseded_by : null,
        old_conclusion_preserved: oldAfter ? oldAfter.conclusion : null,
        old_conclusion_was: oldConclusionBefore,
        old_previous_versions_count: oldAfter ? oldAfter.previous_versions.length : 0,
        new_record_id: result.new_record_id,
        new_status: newRecord ? newRecord.current_status : null,
        new_previous_versions_snapshot: newRecord ? newRecord.previous_versions : [],
        new_rework_from_field: newRecord ? newRecord.manual_changes.filter(c => c.field === 'rework_from') : []
      },
      _post_action_consistency: consistency
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message, stack: e.stack });
  }
});

app.post('/api/records/:id/rollback', (req, res) => {
  try {
    const { operator, versionIndex, version } = req.body;
    const vIdx = typeof versionIndex === 'number' ? versionIndex : (parseInt(String(version || '0'), 10));
    if (Number.isNaN(vIdx)) {
      return res.status(400).json({ success: false, error: 'rollback 必须提供 versionIndex 或 version 参数（数字）' });
    }
    const beforeSnapshot = (() => {
      const r = dataStore.getRecordById(req.params.id);
      return r ? {
        status: r.current_status,
        qc: r.qc_review_required,
        boundaryCount: r.boundary_issues.length
      } : null;
    })();

    const record = workflowEngine.rollbackToVersion(req.params.id, vIdx, operator || 'system');
    const consistency = dataStore.verifyConsistency();

    res.json({
      success: true,
      data: formatViewRecord(record),
      _rollback_report: {
        before: beforeSnapshot,
        after: {
          status: record.current_status,
          qc: record.qc_review_required,
          boundaryCount: record.boundary_issues.length,
          boundaryMessages: record.boundary_issues.map(i => i.message)
        },
        version_index: vIdx,
        target_status_history_entry: record.status_history.length > 0 ? record.status_history[Math.min(vIdx, record.status_history.length - 1)] : null,
        derived_fields_restored_note: 'qc_review_required / boundary_issues 已按目标状态派生规则同步恢复，避免页面/接口/导出三者不一致'
      },
      _post_action_consistency: consistency
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.get('/api/boundary-rules', (req, res) => {
  res.json({
    success: true,
    data: {
      ...BOUNDARY_RULES,
      status_list: STATUS,
      _enforcement: '代码与 README.md 同步修改，禁止只改一处',
      _auto_trigger: '导入时自动检测，命中后强制 NEED_QC_REVIEW，跳过工程师也不能直接终态'
    }
  });
});

app.get('/api/unified-fields', (req, res) => {
  res.json({
    success: true,
    data: UNIFIED_FIELDS,
    _note: '页面表格、API返回、CSV导出 完全使用这里定义的字段顺序、转换逻辑和列名'
  });
});

app.get('/api/command-help', (req, res) => {
  res.json({
    success: true,
    data: REPLAY_PARAM_SPEC,
    _note: '所有命令参数规范与 scripts/ 目录下脚本 --help 内容同步'
  });
});

app.listen(PORT, '127.0.0.1', () => {
  const sep = '='.repeat(60);
  console.log(sep);
  console.log(`水轮机效率回放系统已启动: http://localhost:${PORT}`);
  console.log(sep);
  console.log(`核心接口（均走统一数据源 dataStore.getUnifiedView）:`);
  console.log(`  GET  /api/records?needsQcReview=true  - 采样时间缺半小时等需复核记录`);
  console.log(`  GET  /api/records/:id                  - 单条详情`);
  console.log(`  GET  /api/records/:id/audit            - 审计日志重放`);
  console.log(`  GET  /api/export?format=csv&needsQcReview=true - 导出（字段与页面完全同一份）`);
  console.log(`  GET  /api/statistics                   - 统计（含返工SUPERSEDED计数）`);
  console.log(`  GET  /api/consistency                  - 三方一致性自检`);
  console.log(`  POST /api/records/:id/rework           - 返工（自动标旧记录SUPERSEDED+证据链）`);
  console.log(`  POST /api/records/:id/rollback         - 回滚（同步派生字段）`);
  console.log(`  GET  /api/unified-fields               - 统一定义的字段映射`);
  console.log(sep);
  console.log(`验证提示:`);
  console.log(`  curl http://localhost:${PORT}/api/consistency`);
  console.log(`  curl "http://localhost:${PORT}/api/records?needsQcReview=true" | head -200`);
  console.log(sep);
});

module.exports = app;
