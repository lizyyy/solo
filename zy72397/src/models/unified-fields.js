const UNIFIED_FIELDS = [
  { key: 'id',                          label: '记录ID',            csvHeader: '记录ID',              visibleInList: true  },
  { key: 'original_line_no',            label: '原始行号',          csvHeader: '原始导入行号',        visibleInList: true  },
  { key: 'import_batch_id',             label: '导入批次',          csvHeader: '导入批次',            visibleInList: true  },
  { key: 'sensor_id',                   label: '传感器编号',        csvHeader: '传感器编号',          visibleInList: true  },
  { key: 'sensor_name',                 label: '传感器名称',        csvHeader: '传感器名称',          visibleInList: false },
  { key: 'turbine_id',                  label: '水轮机编号',        csvHeader: '水轮机编号',          visibleInList: true  },
  { key: 'sampling_time',               label: '采样时间',          csvHeader: '采样时间',            visibleInList: true  },
  { key: 'sampling_start_time',         label: '采样开始',          csvHeader: '采样开始时间',        visibleInList: false },
  { key: 'sampling_end_time',           label: '采样结束',          csvHeader: '采样结束时间',        visibleInList: false },
  { key: 'efficiency',                  label: '效率(%)',           csvHeader: '效率(%)',             visibleInList: true  },
  { key: 'flow_rate',                   label: '流量(m³/s)',        csvHeader: '流量(m3/s)',          visibleInList: false },
  { key: 'head',                        label: '水头(m)',           csvHeader: '水头(m)',             visibleInList: false },
  { key: 'power',                       label: '功率(kW)',          csvHeader: '功率(kW)',            visibleInList: false },
  { key: 'current_status',              label: '处理状态',          csvHeader: '处理状态',            visibleInList: true  },
  { key: 'qc_review_required',          label: '需QC复核',          csvHeader: '需质检员复核',        visibleInList: true,
    transform: (v) => typeof v === 'boolean' ? v : !!v,
    csvTransform: (v) => v ? '是' : '否' },
  { key: 'boundary_issues',             label: '边界问题',          csvHeader: '边界规则问题明细',    visibleInList: true,
    transform: (arr) => Array.isArray(arr) ? arr.map(i => i.message).join('; ') : '',
    csvTransform: (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) return '';
      return arr.map(i => `[${i.issueType}]${i.message}(阈值:${i.threshold || i.minRequired})`).join(' || ');
    }
  },
  { key: 'conclusion',                  label: '当前结论',          csvHeader: '当前结论',            visibleInList: true  },
  { key: 'conclusion_version',          label: '结论版本',          csvHeader: '结论版本号',          visibleInList: false },
  { key: 'superseded_by',               label: '被哪条记录替代',    csvHeader: '返工后被哪条新记录替代', visibleInList: true },
  { key: 'previous_versions',           label: '历史结论版本数',    csvHeader: '历史结论版本数',       visibleInList: false,
    transform: (arr) => Array.isArray(arr) ? arr.length : 0,
    csvTransform: (arr) => Array.isArray(arr) ? arr.length : 0
  },
  { key: 'work_condition_photos_count', label: '工况照片数',        csvHeader: '工况照片数量',        visibleInList: false,
    transform: (arr, rec) => Array.isArray(rec.work_condition_photos) ? rec.work_condition_photos.length : 0,
    csvTransform: (arr, rec) => Array.isArray(rec.work_condition_photos) ? rec.work_condition_photos.length : 0
  },
  { key: 'manual_changes_count',        label: '人工改动次数',      csvHeader: '人工改动次数',        visibleInList: false,
    transform: (arr, rec) => Array.isArray(rec.manual_changes) ? rec.manual_changes.length : 0,
    csvTransform: (arr, rec) => Array.isArray(rec.manual_changes) ? rec.manual_changes.length : 0
  },
  { key: 'status_history_count',        label: '状态流转步数',      csvHeader: '状态流转步数',        visibleInList: false,
    transform: (arr, rec) => Array.isArray(rec.status_history) ? rec.status_history.length : 0,
    csvTransform: (arr, rec) => Array.isArray(rec.status_history) ? rec.status_history.length : 0
  },
  { key: 'status_history',              label: '状态流转明细',      csvHeader: '状态流转明细(审计)',  visibleInList: false,
    transform: (arr) => Array.isArray(arr) ? arr.map(s => `${s.timestamp.slice(5,16)}|${s.status}|${s.operator}|${s.remark||''}`).join(' \\ ') : '',
    csvTransform: (arr) => {
      if (!Array.isArray(arr)) return '';
      return arr.map(s => `${s.timestamp.slice(0,19)}[${s.status}]${s.operator}:"${s.remark||''}"`).join(' || ');
    }
  },
  { key: 'manual_changes',              label: '人工改动明细',      csvHeader: '人工改动明细(审计)',  visibleInList: false,
    transform: (arr) => Array.isArray(arr) ? arr.map(c => `${c.field}:${c.old_value}→${c.new_value}`).join('; ') : '',
    csvTransform: (arr) => {
      if (!Array.isArray(arr)) return '';
      return arr.map(c => `${c.timestamp.slice(0,19)} ${c.field}: (${c.old_value||'空'}) → (${c.new_value}) [${c.operator}]因:${c.reason||''}`).join(' || ');
    }
  },
  { key: 'previous_versions_detail',    label: '历史结论',          csvHeader: '历史结论明细(返工证据)', visibleInList: false,
    transform: () => '',
    csvTransform: (_, rec) => {
      if (!Array.isArray(rec.previous_versions) || rec.previous_versions.length === 0) return '';
      return rec.previous_versions.map((v, i) => `V${v.conclusion_version}:${v.conclusion||''}@${(v.timestamp||'').slice(0,16)}`).join(' || ');
    }
  },
  { key: 'created_at',                  label: '创建时间',          csvHeader: '创建时间',            visibleInList: false },
  { key: 'updated_at',                  label: '更新时间',          csvHeader: '最后更新时间',        visibleInList: false }
];

const UNIFIED_FIELD_KEY_MAP = UNIFIED_FIELDS.reduce((acc, f) => {
  acc[f.key] = f;
  return acc;
}, {});

function getCsvHeaders() {
  return UNIFIED_FIELDS.map(f => f.csvHeader);
}

function getCsvRow(recordView) {
  return UNIFIED_FIELDS.map(f => {
    const rawVal = recordView[f.key];
    if (typeof f.csvTransform === 'function') {
      let v = f.csvTransform(rawVal, recordView);
      if (typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))) {
        v = '"' + v.replace(/"/g, '""') + '"';
      }
      return v;
    }
    let v = rawVal === undefined || rawVal === null ? '' : String(rawVal);
    if (typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))) {
      v = '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  });
}

function formatViewRecord(record) {
  const view = {};
  UNIFIED_FIELDS.forEach(f => {
    if (typeof f.transform === 'function') {
      view[f.key] = f.transform(record[f.key], record);
    } else {
      view[f.key] = record[f.key];
    }
  });
  view.status_history = record.status_history;
  view.manual_changes = record.manual_changes;
  view.previous_versions = record.previous_versions;
  view.work_condition_photos = record.work_condition_photos;
  view.boundary_issues = record.boundary_issues;
  view._source_record_id = record.id;
  view._unified_fields_version = 'v1.0';
  return view;
}

const REPLAY_PARAM_SPEC = {
  'demo': {
    desc: '运行完整演示场景（导入→三步流程→返工→导出核对）',
    args: [],
    example: 'npm run demo'
  },
  'replay': {
    desc: '重放某条记录的审计日志（含返工证据链和回滚点）',
    args: [{ name: '--record-id', required: true, example: 'REC-002' }],
    example: 'npm run replay -- --record-id=REC-002'
  },
  'import': {
    desc: '导入传感器JSON数据，自动跑边界规则',
    args: [{ name: '--file', required: false, example: 'data/sample-sensors.json' }],
    example: 'npm run import -- --file=data/sample-sensors.json'
  },
  'export': {
    desc: '导出统一视图数据（与页面、接口完全同一份）',
    args: [
      { name: '--format', required: false, example: 'json|csv' },
      { name: '--output', required: false, example: 'output/result.csv' },
      { name: '--needs-qc-review', required: false, example: 'true 只导出待质检员复核的（重点：采样时间缺半小时等）' }
    ],
    example: 'npm run export -- --format=csv --output=report.csv'
  },
  'rollback': {
    desc: '把某条记录回滚到指定状态索引（同步恢复qc_review_required等派生字段）',
    args: [
      { name: '--record-id', required: true, example: 'REC-002' },
      { name: '--version', required: true, example: '1 (对应status_history的索引，回看NEED_QC_REVIEW那一刻)' }
    ],
    example: 'npm run rollback -- --record-id=REC-002 --version=1'
  },
  'verify-end-to-end': {
    desc: '端到端核对：返工SUPERSEDED标记、回滚派生字段、三方一致性',
    args: [],
    example: 'npm run verify'
  }
};

module.exports = {
  UNIFIED_FIELDS,
  UNIFIED_FIELD_KEY_MAP,
  getCsvHeaders,
  getCsvRow,
  formatViewRecord,
  REPLAY_PARAM_SPEC
};
