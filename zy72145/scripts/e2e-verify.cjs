const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '..', 'tmp-e2e');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const EXPORT_PATH = path.join(OUTPUT_DIR, 'e2e-export.xlsx');

const STATUS_LABELS = {
  all: '全部',
  normal: '正常',
  auth_expired: '授权过期',
  tc_mismatch: '时码错位',
  duplicate: '重复曲目',
  dirty_data: '脏数据',
};

const uuidv4 = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

function computeDiff(oldStr, newStr) {
  const oldText = oldStr || '';
  const newText = newStr || '';
  const changes = [];
  const addedChars = [];
  const removedChars = [];
  for (let i = 0; i < newText.length; i++) {
    if (!oldText.includes(newText[i])) addedChars.push(newText[i]);
  }
  for (let i = 0; i < oldText.length; i++) {
    if (!newText.includes(oldText[i])) removedChars.push(oldText[i]);
  }
  if (addedChars.length > 0) changes.push(`新增: "${addedChars.join('')}"`);
  if (removedChars.length > 0) changes.push(`删除: "${removedChars.join('')}"`);
  if (changes.length === 0) return '无实质变更';
  return changes.join('； ');
}

function formatTimestamp(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

function describeFilters(filters) {
  const parts = [];
  if (filters.status !== 'all') parts.push(`状态: ${STATUS_LABELS[filters.status]}`);
  if (filters.teacherName) parts.push(`教师包含: "${filters.teacherName}"`);
  if (filters.trackName) parts.push(`曲目包含: "${filters.trackName}"`);
  if (filters.dateFrom) parts.push(`授权开始≥: ${filters.dateFrom}`);
  if (filters.dateTo) parts.push(`授权结束≤: ${filters.dateTo}`);
  return parts.length > 0 ? parts.join('； ') : '未设置筛选条件（导出全部数据）';
}

const now = Date.now();
const oneDay = 24 * 60 * 60 * 1000;
const daysAgo = (d) => {
  const date = new Date(now - d * oneDay);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const daysLater = (d) => {
  const date = new Date(now + d * oneDay);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

console.log('🚀 音乐教师课时核销 — 离线端到端验证');
console.log('='.repeat(60));

let records = [
  {
    teacherName: '张明华', trackName: '夜曲', authStart: daysAgo(365), authEnd: daysLater(180),
    tcIn: '00:00:00', tcOut: '00:05:30', duration: 5, remark: '初级班必学曲目',
    sourceFile: '音乐教师课时核销_202606.xlsx',
  },
  {
    teacherName: 'Li Na', trackName: '致爱丽丝', authStart: daysAgo(200), authEnd: daysLater(100),
    tcIn: '00:00:00', tcOut: '00:04:20', duration: 4, remark: '贝多芬经典作品',
    sourceFile: '音乐教师课时核销_202606.xlsx',
  },
  {
    teacherName: '王老师', trackName: '二泉映月', authStart: daysAgo(400), authEnd: daysAgo(30),
    tcIn: '00:00:00', tcOut: '00:10:00', duration: 10, remark: '授权已过期，需重新申请',
    sourceFile: '音乐教师课时核销_202606.xlsx',
  },
  {
    teacherName: 'Chen Wei', trackName: 'River Flows in You', authStart: daysAgo(500), authEnd: daysAgo(100),
    tcIn: '00:00:00', tcOut: '00:06:30', duration: 6, remark: 'Yiruma作品，授权过期',
    sourceFile: '音乐教师课时核销_202606.xlsx',
  },
  {
    teacherName: '刘芳', trackName: '梁祝', authStart: daysAgo(600), authEnd: daysAgo(50),
    tcIn: '00:00:00', tcOut: '00:15:00', duration: 15, remark: '小提琴协奏曲，待续期',
    sourceFile: '音乐教师课时核销_202606.xlsx',
  },
  {
    teacherName: '赵强', trackName: '命运交响曲', authStart: daysAgo(100), authEnd: daysLater(265),
    tcIn: '00:10:00', tcOut: '00:05:00', duration: 0, remark: '时码错位，开始大于结束',
    sourceFile: '音乐教师课时核销_脏数据.xlsx',
  },
].map((r, i) => ({
  id: uuidv4(),
  ...r,
  importedAt: now - (6 - i) * 1000,
  lastModifiedAt: now - (6 - i) * 1000,
  validationStatus: 'normal',
  validationErrors: [],
  modifyHistory: [],
  rawData: { ...r },
}));

console.log(`✅ Step1：导入 ${records.length} 条记录`);

function validateRecord(rec) {
  const errors = [];
  if (!rec.teacherName || !rec.trackName) {
    errors.push({ type: 'dirty_data', message: '教师姓名或曲目名称为空', field: 'teacherName' });
    rec.validationStatus = 'dirty_data';
  }
  if (rec.authEnd && new Date(rec.authEnd) < new Date()) {
    errors.push({ type: 'auth_expired', message: '授权已过期', field: 'authEnd' });
  }
  const tcRegex = /^\d{2}:\d{2}:\d{2}$/;
  if (rec.tcIn && !tcRegex.test(rec.tcIn)) {
    errors.push({ type: 'tc_mismatch', message: `开始时码格式错误: ${rec.tcIn}`, field: 'tcIn' });
  }
  if (rec.tcOut && !tcRegex.test(rec.tcOut)) {
    errors.push({ type: 'tc_mismatch', message: `结束时码格式错误: ${rec.tcOut}`, field: 'tcOut' });
  }
  if (tcRegex.test(rec.tcIn) && tcRegex.test(rec.tcOut) && rec.tcIn >= rec.tcOut) {
    errors.push({ type: 'tc_mismatch', message: '开始时码≥结束时码', field: 'tcIn' });
  }
  const byPriority = ['dirty_data', 'tc_mismatch', 'duplicate', 'auth_expired', 'normal'];
  if (errors.length > 0) {
    rec.validationStatus = errors.map((e) => e.type).sort((a, b) => byPriority.indexOf(a) - byPriority.indexOf(b))[0];
  } else {
    rec.validationStatus = 'normal';
  }
  rec.validationErrors = errors;
  return rec;
}

records = records.map(validateRecord);
const counts = records.reduce((acc, r) => {
  acc[r.validationStatus] = (acc[r.validationStatus] || 0) + 1;
  return acc;
}, {});
console.log(
  `✅ Step2：校验完成。状态分布：${Object.entries(counts)
    .map(([k, v]) => `${STATUS_LABELS[k]}=${v}`)
    .join('，')}`
);

const filters = { status: 'auth_expired', teacherName: '', trackName: '', dateFrom: '', dateTo: '' };
const filteredRecords = records.filter((r) => r.validationStatus === filters.status);
console.log(`✅ Step3：筛选「${STATUS_LABELS[filters.status]}」→ 得到 ${filteredRecords.length} 条`);

const targetId = filteredRecords[0].id;
const oldRemark = filteredRecords[0].remark;
const newRemark = '续期申请已提交法务审批，预计本周完成，临时可使用至2026-06-30';
records = records.map((r) => {
  if (r.id !== targetId) return r;
  const diff = computeDiff(oldRemark, newRemark);
  return {
    ...r,
    remark: newRemark,
    lastModifiedAt: now,
    modifyHistory: [...r.modifyHistory, { timestamp: now, oldRemark, newRemark, diff }],
  };
});
const updated = records.find((r) => r.id === targetId);
console.log(
  `✅ Step4：修改备注成功。改前: "${oldRemark}"，改后: "${newRemark}"，差异: "${updated.modifyHistory[0].diff}"`
);

const afterFilter = records.filter((r) => r.validationStatus === filters.status);
console.log(`✅ Step5：修改后仍有 ${afterFilter.length} 条符合当前筛选`);

function buildMainSheetData(list) {
  return list.map((r, idx) => ({
    序号: idx + 1,
    教师姓名: r.teacherName,
    曲目名称: r.trackName,
    授权开始日期: r.authStart,
    授权结束日期: r.authEnd,
    开始时码: r.tcIn,
    结束时码: r.tcOut,
    '课时(分钟)': r.duration,
    当前备注: r.remark,
    备注修改次数: r.modifyHistory.length,
    最近一次备注修改: r.modifyHistory.length ? formatTimestamp(r.modifyHistory[r.modifyHistory.length - 1].timestamp) : '',
    校验状态: STATUS_LABELS[r.validationStatus],
    问题详情: r.validationErrors.map((e) => e.message).join('； '),
    原始来源文件: r.sourceFile,
    导入时间: formatTimestamp(r.importedAt),
    数据最后修改时间: formatTimestamp(r.lastModifiedAt),
    记录唯一ID: r.id,
  }));
}

function buildHistorySheetData(list) {
  const rows = [];
  list.forEach((r) => {
    if (r.modifyHistory.length === 0) {
      rows.push({
        记录ID: r.id,
        教师姓名: r.teacherName,
        曲目名称: r.trackName,
        修改序号: '-',
        修改时间: '-',
        修改前文本: '',
        修改后文本: r.remark,
        变更差异说明: '导入时已有备注' in r.rawData ? '导入时已有备注' : '无修改历史',
      });
    } else {
      r.modifyHistory.forEach((entry, idx) => {
        rows.push({
          记录ID: r.id,
          教师姓名: r.teacherName,
          曲目名称: r.trackName,
          修改序号: idx + 1,
          修改时间: formatTimestamp(entry.timestamp),
          修改前文本: entry.oldRemark || '(空)',
          修改后文本: entry.newRemark || '(空)',
          变更差异说明: entry.diff,
        });
      });
    }
  });
  return rows;
}

function buildReportSheetData(ctx) {
  return [
    ['音乐教师课时核销 — 导出报告'],
    ['项目', '值'],
    ['导出时间', formatTimestamp(ctx.exportedAt)],
    ['导出记录数', ctx.filteredRecordsCount],
    ['总记录数(含未筛选)', ctx.totalRecordsCount],
    ['筛选条件说明', describeFilters(ctx.filters)],
    ['状态筛选', STATUS_LABELS[ctx.filters.status]],
    ['教师姓名搜索', ctx.filters.teacherName || '(未设置)'],
    ['曲目名称搜索', ctx.filters.trackName || '(未设置)'],
    ['授权开始日期从', ctx.filters.dateFrom || '(未设置)'],
    ['授权结束日期至', ctx.filters.dateTo || '(未设置)'],
    ['涉及原始文件', ctx.sourceFiles.join('； ')],
    [
      '备注',
      '本Excel包含三个工作表：【核销结果】当前筛选清单、【备注修改历史】逐条改前改后差异、【导出报告】触发导出时的筛选条件与统计信息，便于后续复核与交接。',
    ],
  ];
}

const exportedAt = Date.now();
const context = {
  filters,
  exportedAt,
  totalRecordsCount: records.length,
  filteredRecordsCount: afterFilter.length,
  sourceFiles: Array.from(new Set(afterFilter.map((r) => r.sourceFile))),
};

const mainWs = XLSX.utils.json_to_sheet(buildMainSheetData(afterFilter));
const historyWs = XLSX.utils.json_to_sheet(buildHistorySheetData(afterFilter));
const reportWs = XLSX.utils.aoa_to_sheet(buildReportSheetData(context));
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, mainWs, '核销结果');
XLSX.utils.book_append_sheet(wb, historyWs, '备注修改历史');
XLSX.utils.book_append_sheet(wb, reportWs, '导出报告');
XLSX.writeFile(wb, EXPORT_PATH);
console.log(`✅ Step6：导出Excel → ${EXPORT_PATH}`);

console.log();
console.log('='.repeat(60));
console.log('📊 读取导回Excel进行断言验证');
console.log('='.repeat(60));

const readBack = XLSX.readFile(EXPORT_PATH);
const pass = [];
const fail = [];
const check = (name, cond, detail = '') => {
  if (cond) {
    pass.push(`✅ ${name}${detail ? ' — ' + detail : ''}`);
  } else {
    fail.push(`❌ ${name}${detail ? ' — ' + detail : ''}`);
  }
};

const expectedSheets = ['核销结果', '备注修改历史', '导出报告'];
check(
  '工作表名称数量与顺序正确',
  readBack.SheetNames.length === 3 && readBack.SheetNames.every((n, i) => n === expectedSheets[i]),
  `实际: [${readBack.SheetNames.join(' / ')}]`
);

const mainBack = XLSX.utils.sheet_to_json(readBack.Sheets['核销结果'], { header: 1 });
const mainHeaders = mainBack[0];
const mainRows = mainBack.slice(1);
const expectedMainHeaders = [
  '序号', '教师姓名', '曲目名称', '授权开始日期', '授权结束日期', '开始时码', '结束时码',
  '课时(分钟)', '当前备注', '备注修改次数', '最近一次备注修改', '校验状态', '问题详情',
  '原始来源文件', '导入时间', '数据最后修改时间', '记录唯一ID',
];
check('Sheet1【核销结果】列数=17', mainHeaders.length === 17, `实际: ${mainHeaders.length}`);
expectedMainHeaders.forEach((h, i) => {
  check(`Sheet1第${i + 1}列 "${h}"`, mainHeaders[i] === h, `实际: ${mainHeaders[i]}`);
});
check(
  'Sheet1数据行数=筛选数量(导出记录数)',
  mainRows.length === context.filteredRecordsCount,
  `实际: ${mainRows.length}，预期: ${context.filteredRecordsCount}`
);
mainRows.forEach((row, i) => {
  check(
    `Sheet1行${i + 1} 校验状态为「${STATUS_LABELS[filters.status]}」`,
    row[11] === STATUS_LABELS[filters.status],
    `实际: ${row[11]}`
  );
});

const historyBack = XLSX.utils.sheet_to_json(readBack.Sheets['备注修改历史'], { header: 1 });
const historyHeaders = historyBack[0];
const historyRows = historyBack.slice(1);
const expectedHistoryHeaders = [
  '记录ID', '教师姓名', '曲目名称', '修改序号', '修改时间', '修改前文本', '修改后文本', '变更差异说明',
];
check('Sheet2【备注修改历史】列数=8', historyHeaders.length === 8, `实际: ${historyHeaders.length}`);
expectedHistoryHeaders.forEach((h, i) => {
  check(`Sheet2第${i + 1}列 "${h}"`, historyHeaders[i] === h, `实际: ${historyHeaders[i]}`);
});
check(
  'Sheet2至少1条修改记录(非“-”序号)',
  historyRows.some((r) => r[3] !== '-'),
  `共${historyRows.length}行`
);
const modifiedRows = historyRows.filter((r) => r[3] !== '-');
modifiedRows.forEach((r, i) => {
  check(
    `Sheet2修改记录#${i + 1} 改前≠改后`,
    r[5] !== r[6],
    `改前="${r[5]}"，改后="${r[6]}"`
  );
  check(
    `Sheet2修改记录#${i + 1} 差异说明非空`,
    typeof r[7] === 'string' && r[7].length > 0,
    `差异: "${r[7]}"`
  );
});

const reportBack = XLSX.utils.sheet_to_json(readBack.Sheets['导出报告'], { header: 1 });
check('Sheet3【导出报告】行数=13', reportBack.length === 13, `实际: ${reportBack.length}`);
check('Sheet3 A1=标题', reportBack[0][0] === '音乐教师课时核销 — 导出报告', `实际: ${reportBack[0][0]}`);
check('Sheet3 A2=“项目” B2=“值”', reportBack[1][0] === '项目' && reportBack[1][1] === '值');
const reportMap = new Map(reportBack.slice(2).map((r) => [r[0], r[1]]));
check(
  `Sheet3「导出记录数」=${context.filteredRecordsCount}`,
  Number(reportMap.get('导出记录数')) === context.filteredRecordsCount,
  `实际: ${reportMap.get('导出记录数')}`
);
check(
  `Sheet3「总记录数(含未筛选)」=${records.length}`,
  Number(reportMap.get('总记录数(含未筛选)')) === records.length,
  `实际: ${reportMap.get('总记录数(含未筛选)')}`
);
check(
  `Sheet3「状态筛选」=${STATUS_LABELS[filters.status]}`,
  reportMap.get('状态筛选') === STATUS_LABELS[filters.status],
  `实际: ${reportMap.get('状态筛选')}`
);
check(
  'Sheet3「筛选条件说明」包含状态关键词',
  typeof reportMap.get('筛选条件说明') === 'string' &&
    reportMap.get('筛选条件说明').includes(STATUS_LABELS[filters.status]),
  `实际: "${reportMap.get('筛选条件说明')}"`
);
check(
  `Sheet3「涉及原始文件」包含 ${context.sourceFiles.length} 个来源文件`,
  typeof reportMap.get('涉及原始文件') === 'string' &&
    context.sourceFiles.every((f) => reportMap.get('涉及原始文件').includes(f)),
  `实际: "${reportMap.get('涉及原始文件')}"`
);
check(
  'Sheet3「备注」包含三个工作表说明',
  typeof reportMap.get('备注') === 'string' &&
    reportMap.get('备注').includes('核销结果') &&
    reportMap.get('备注').includes('备注修改历史') &&
    reportMap.get('备注').includes('导出报告'),
  `实际长度: ${reportMap.get('备注')?.length || 0}`
);

console.log();
pass.forEach((p) => console.log(p));
fail.forEach((f) => console.log(f));
console.log();
console.log(`总计：${pass.length}/${pass.length + fail.length} 项断言通过`);
if (fail.length > 0) {
  console.error(`\n❌ 有 ${fail.length} 项失败`);
  process.exit(1);
} else {
  console.log('\n🎉 音乐教师课时核销端到端验证全部通过！');
  console.log(`   导出文件: ${EXPORT_PATH}`);
}
