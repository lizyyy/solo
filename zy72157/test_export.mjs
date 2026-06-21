import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// === 1. 真实样例数据（与浏览器evaluate返回的一致 + 补充9条普通点位）===
const TEST_POINT_HANDLED = {
  id: 'street-001',
  name: '阳光社区助餐点（正式备案版）',
  address: '阳光花园内23栋1单元102室',
  lat: 31.2351,
  lng: 121.4801,
  type: 'smooth',
  status: 'confirmed',
  source: '街道备注',
  sourceFile: '样例数据',
  sourceRowNumber: 5,
  note: '街道手改：本点位为新增，服务时间为周一至周五11:00-13:00。周姐备注：此点位已列入整改计划，预计下月完成 - 周姐复核。居民反馈：居民王阿姨反馈：用餐座位不够，建议增加4-6个位置。照片说明：门头照已拍1张，室内3张，照片显示招牌清晰',
  createdAt: new Date('2026-06-22T02:21:40.000Z'),
  updatedAt: new Date('2026-06-22T02:27:30.000Z'),
  zhoujieNote: '此点位已列入整改计划，预计下月完成 - 周姐复核',
  feedback: '居民王阿姨反馈：用餐座位不够，建议增加4-6个位置',
  photoNotes: '门头照已拍1张，室内3张，照片显示招牌清晰',
  originalValues: {
    name: '阳光社区助餐点',
    address: '阳光花园内23栋1单元',
    type: 'review',
  },
  manualResolveHistory: [
    { field: '点位名称', originalValue: '阳光社区助餐点', resolvedValue: '阳光社区助餐点（正式备案版）' },
    { field: '详细地址', originalValue: '阳光花园内23栋1单元', resolvedValue: '阳光花园内23栋1单元102室' },
    { field: '点位类型', originalValue: 'review', resolvedValue: 'smooth' },
  ],
  auditTrail: [
    {
      id: 'audit-1',
      pointId: 'street-001',
      action: 'import',
      operator: '系统',
      timestamp: new Date('2026-06-22T02:21:40.000Z'),
      remark: '从街道手改备注导入',
    },
    {
      id: 'audit-2',
      pointId: 'street-001',
      action: 'manualResolve',
      operator: '老曹',
      timestamp: new Date('2026-06-22T02:27:30.000Z'),
      remark: '手动处理3个字段：点位名称[阳光社区助餐点→阳光社区助餐点（正式备案版）]，详细地址[阳光花园内23栋1单元→阳光花园内23栋1单元102室]，点位类型[review→smooth]；现场核实与街道周姐反馈一致，按最新备案名称更新',
    },
  ],
  sourceRow: {
    序号: 4,
    点位名称: '阳光社区助餐点',
    详细地址: '阳光花园内23栋1单元',
    纬度: 31.2351,
    经度: 121.4801,
    数据来源: '街道备注',
    备注: '街道手改：本点位为新增，服务时间为周一至周五11:00-13:00',
    服务时间: '周一至周五',
    所属街道: '阳光街道',
  },
  diffs: [],
};

const OTHER_9_POINTS = [
  {
    id: 'gis-001', name: '幸福街道社区助餐点', address: '幸福路123号幸福社区服务中心1楼',
    lat: 31.2304, lng: 121.4737, type: 'smooth', status: 'pending', source: 'GIS点位',
    sourceFile: '样例数据', sourceRowNumber: 1, note: '标准GIS点位，数据完整',
    createdAt: new Date(), updatedAt: new Date(), auditTrail: [{ id:'a', pointId:'gis-001', action:'import', operator:'系统', timestamp: new Date(), remark:'从GIS系统导入' }],
    sourceRow: { '点位名称': '幸福街道社区助餐点', '详细地址': '幸福路123号幸福社区服务中心1楼' }, diffs: [],
  },
  {
    id: 'gis-002', name: '幸福街道社区食堂', address: '幸福路123号',
    lat: 31.2305, lng: 121.4738, type: 'duplicate', status: 'pending', source: 'GIS点位',
    sourceFile: '样例数据', sourceRowNumber: 2, note: '与幸福街道社区助餐点重复，待确认合并',
    createdAt: new Date(), updatedAt: new Date(), auditTrail: [{ id:'b', pointId:'gis-002', action:'import', operator:'系统', timestamp: new Date(), remark:'从GIS系统导入' }],
    sourceRow: {}, diffs: [],
  },
  {
    id: 'feedback-001', name: '阳光社区老年助餐服务点', address: '阳光花园23栋',
    lat: 31.2350, lng: 121.4800, type: 'review', status: 'pending', source: '居民反馈',
    sourceFile: '样例数据', sourceRowNumber: 3, note: '居民反馈：点位名称待确认',
    createdAt: new Date(), updatedAt: new Date(), auditTrail: [{ id:'c', pointId:'feedback-001', action:'import', operator:'系统', timestamp: new Date(), remark:'从居民反馈台账导入' }],
    sourceRow: {}, diffs: [],
  },
  {
    id: 'gis-003', name: '和平街道老年人助餐中心（旧）', address: '和平路456号（2023年前使用）',
    lat: 31.2400, lng: 121.4680, type: 'legacy', status: 'pending', source: 'GIS点位',
    sourceFile: '样例数据', sourceRowNumber: 6, note: '旧口径数据，已停用',
    createdAt: new Date(), updatedAt: new Date(), auditTrail: [{ id:'d', pointId:'gis-003', action:'import', operator:'系统', timestamp: new Date(), remark:'从历史GIS数据导入' }],
    sourceRow: {}, diffs: [],
  },
  {
    id: 'gis-004', name: '(未命名)', address: '南京路789号',
    lat: 31.2380, lng: 121.4750, type: 'empty', status: 'pending', source: 'GIS点位',
    sourceFile: '样例数据', sourceRowNumber: 7, note: '空值记录，点位名称缺失',
    createdAt: new Date(), updatedAt: new Date(), auditTrail: [{ id:'e', pointId:'gis-004', action:'import', operator:'系统', timestamp: new Date(), remark:'从GIS系统导入' }],
    sourceRow: {}, diffs: [],
  },
  {
    id: 'inspect-001', name: '河滨社区助餐点A', address: '河滨路1号（与江湾街道交界处）',
    lat: 31.2485, lng: 121.4850, type: 'boundary', status: 'pending', source: '巡检记录',
    sourceFile: '样例数据', sourceRowNumber: 8, note: '边界点位，待确认归属街道',
    createdAt: new Date(), updatedAt: new Date(), auditTrail: [{ id:'f', pointId:'inspect-001', action:'import', operator:'系统', timestamp: new Date(), remark:'从巡检记录导入' }],
    sourceRow: {}, diffs: [],
  },
  {
    id: 'inspect-002', name: '河滨社区助餐点B', address: '河滨路3号（与江湾街道交界处）',
    lat: 31.2487, lng: 121.4852, type: 'boundary', status: 'pending', source: '巡检记录',
    sourceFile: '样例数据', sourceRowNumber: 9, note: '边界点位，待确认归属街道',
    createdAt: new Date(), updatedAt: new Date(), auditTrail: [{ id:'g', pointId:'inspect-002', action:'import', operator:'系统', timestamp: new Date(), remark:'从巡检记录导入' }],
    sourceRow: {}, diffs: [],
  },
  {
    id: 'gis-005', name: '康乐街道助餐服务中心', address: '康乐路88号',
    lat: 31.2420, lng: 121.4780, type: 'smooth', status: 'pending', source: 'GIS点位',
    sourceFile: '样例数据', sourceRowNumber: 10, note: '标准GIS点位',
    createdAt: new Date(), updatedAt: new Date(), auditTrail: [{ id:'h', pointId:'gis-005', action:'import', operator:'系统', timestamp: new Date(), remark:'从GIS系统导入' }],
    sourceRow: {}, diffs: [],
  },
  {
    id: 'feedback-002', name: '康乐社区食堂', address: '康乐路88号康乐街道办事处旁',
    lat: 31.2421, lng: 121.4781, type: 'smooth', status: 'pending', source: '居民反馈',
    sourceFile: '样例数据', sourceRowNumber: 11, note: '居民反馈记录',
    createdAt: new Date(), updatedAt: new Date(), auditTrail: [{ id:'i', pointId:'feedback-002', action:'import', operator:'系统', timestamp: new Date(), remark:'从居民反馈台账导入' }],
    sourceRow: {}, diffs: [],
  },
];

const points = [TEST_POINT_HANDLED, ...OTHER_9_POINTS];

// === 2. 完全复制AppContext.tsx中的exportToCSV逻辑 ===
const TYPE_LABELS = {
  smooth: '顺利记录',
  review: '需人工确认',
  duplicate: '重复项',
  boundary: '边界点位',
  empty: '空值记录',
  legacy: '旧口径数据',
};

const STATUS_LABELS = {
  pending: '待处理',
  confirmed: '已确认',
  rejected: '已作废',
};

function exportToCSV(pointsArr) {
  const headers = [
    '序号', '点位ID', '点位名称', '详细地址', '纬度', '经度', '点位类型',
    '来源', '来源文件', '原始行号', '状态', '合并备注',
    '周姐备注', '居民反馈', '巡检照片说明',
    '原始名称(冲突前)', '原始地址(冲突前)', '原始类型(冲突前)',
    '人工处理痕迹', '审核意见历史', '补录差异明细',
  ];

  const rows = pointsArr.map((p, idx) => {
    const typeLabel = TYPE_LABELS[p.type] || p.type || '';
    const statusLabel = STATUS_LABELS[p.status] || p.status || '';

    // 人工处理痕迹序列化
    const manualTraces = (p.manualResolveHistory || []).map(
      (h) => `${h.field}:${h.originalValue || '(空)'}→${h.resolvedValue || '(空)'}`
    ).join(' | ');

    // 审核历史序列化（按时间倒序，带编号）
    const auditHistory = [...(p.auditTrail || [])]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map((a, i) => {
        const time = new Date(a.timestamp).toLocaleString('zh-CN', { hour12: false });
        return `[${time}]#${i + 1} ${a.operator}-${a.action}:${a.remark || ''}`;
      })
      .join(' || ');

    // 补录差异明细序列化
    const diffsDetail = (p.diffs || []).map((d) => {
      const choice = d.resolution === 'A' ? d.valueA : d.resolution === 'B' ? d.valueB : d.customValue || '';
      const choiceLabel = d.resolution === 'A' ? '[取A]' : d.resolution === 'B' ? '[取B]' : d.resolution === 'custom' ? '[自定义]' : '';
      return `${d.fieldName} ${choiceLabel} A=${d.valueA || '(空)'} vs B=${d.valueB || '(空)'} → 最终=${choice || '(未决)'}`;
    }).join(' || ');

    return [
      idx + 1,
      p.id,
      p.name,
      p.address,
      p.lat,
      p.lng,
      typeLabel,
      p.source || '',
      p.sourceFile || '',
      p.sourceRowNumber || '',
      statusLabel,
      p.note || '',
      p.zhoujieNote || '',
      p.feedback || '',
      p.photoNotes || '',
      p.originalValues?.name || '',
      p.originalValues?.address || '',
      p.originalValues?.type ? TYPE_LABELS[p.originalValues.type] || p.originalValues.type : '',
      manualTraces,
      auditHistory,
      diffsDetail,
    ];
  });

  return Papa.unparse({ fields: headers, data: rows });
}

// === 3. 执行导出并保存CSV文件 ===
const csvContent = exportToCSV(points);
const outPath = path.join(__dirname, 'TEST_EXPORT_RESULT.csv');
fs.writeFileSync(outPath, '\ufeff' + csvContent, 'utf8');
console.log(`\n✅ CSV已导出到: ${outPath}`);
console.log(`✅ 文件大小: ${(fs.statSync(outPath).size / 1024).toFixed(2)} KB`);

// === 4. 解析CSV并逐列验证目标点位（第1条） ===
console.log('\n' + '='.repeat(80));
console.log('📋 开始逐列核对「阳光社区助餐点（正式备案版）」的21列导出内容');
console.log('='.repeat(80));

const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
const handledRow = parsed.data.find((r) => r['点位名称'] && r['点位名称'].includes('正式备案'));

if (!handledRow) {
  console.error('❌ 未找到手动处理的点位行！');
  process.exit(1);
}

const assertions = [
  ['序号', handledRow['序号'], '1', (a, b) => a === b],
  ['点位ID', handledRow['点位ID'], 'street-001', (a, b) => a === b],
  ['点位名称（人工值）', handledRow['点位名称'], '阳光社区助餐点（正式备案版）', (a, b) => a === b],
  ['详细地址（人工值）', handledRow['详细地址'], '阳光花园内23栋1单元102室', (a, b) => a === b],
  ['纬度', handledRow['纬度'], '31.2351', (a, b) => Math.abs(parseFloat(a) - parseFloat(b)) < 0.0001],
  ['经度', handledRow['经度'], '121.4801', (a, b) => Math.abs(parseFloat(a) - parseFloat(b)) < 0.0001],
  ['点位类型（人工值）', handledRow['点位类型'], '顺利记录', (a, b) => a === b],
  ['来源', handledRow['来源'], '街道备注', (a, b) => a === b],
  ['来源文件', handledRow['来源文件'], '样例数据', (a, b) => a === b],
  ['原始行号', handledRow['原始行号'], '5', (a, b) => a === b],
  ['状态（已确认）', handledRow['状态'], '已确认', (a, b) => a === b],
  ['合并备注包含周姐', handledRow['合并备注'], '此点位已列入整改计划', (a, b) => a.includes(b)],
  ['周姐备注完整', handledRow['周姐备注'], '此点位已列入整改计划，预计下月完成 - 周姐复核', (a, b) => a === b],
  ['居民反馈完整', handledRow['居民反馈'], '居民王阿姨反馈：用餐座位不够，建议增加4-6个位置', (a, b) => a === b],
  ['巡检照片说明完整', handledRow['巡检照片说明'], '门头照已拍1张，室内3张，照片显示招牌清晰', (a, b) => a === b],
  ['原始名称（冲突前）', handledRow['原始名称(冲突前)'], '阳光社区助餐点', (a, b) => a === b],
  ['原始地址（冲突前）', handledRow['原始地址(冲突前)'], '阳光花园内23栋1单元', (a, b) => a === b],
  ['原始类型（冲突前）', handledRow['原始类型(冲突前)'], '需人工确认', (a, b) => a === b],
  ['人工处理痕迹-名称', handledRow['人工处理痕迹'], '点位名称:阳光社区助餐点→阳光社区助餐点（正式备案版）', (a, b) => a.includes(b)],
  ['人工处理痕迹-地址', handledRow['人工处理痕迹'], '详细地址:阳光花园内23栋1单元→阳光花园内23栋1单元102室', (a, b) => a.includes(b)],
  ['人工处理痕迹-类型', handledRow['人工处理痕迹'], '点位类型:review→smooth', (a, b) => a.includes(b)],
  ['审核历史-含manualResolve动作', handledRow['审核意见历史'], '-manualResolve:', (a, b) => a.includes(b)],
  ['审核历史-含字段变更明细', handledRow['审核意见历史'], '手动处理3个字段', (a, b) => a.includes(b)],
  ['审核历史-含操作说明', handledRow['审核意见历史'], '现场核实与街道周姐反馈一致', (a, b) => a.includes(b)],
  ['审核历史-共2条', handledRow['审核意见历史'].split('||').length, 2, (a, b) => a === b],
  ['补录差异明细为空', handledRow['补录差异明细'], '', (a, b) => a === b],
];

let passCount = 0;
let failCount = 0;
const fails = [];

assertions.forEach(([name, actual, expected, checker], i) => {
  const result = checker(actual, expected);
  const displayActual = typeof actual === 'string' && actual.length > 45 ? actual.substring(0, 45) + '...' : String(actual);
  const displayExpected = typeof expected === 'string' && expected.length > 35 ? expected.substring(0, 35) + '...' : String(expected);
  if (result) {
    passCount++;
    console.log(`  ✅ 断言${String(i + 1).padStart(2, '0')} | ${name.padEnd(26)} | 实际=${displayActual.padEnd(50)} ✓`);
  } else {
    failCount++;
    fails.push({ name, actual, expected });
    console.log(`  ❌ 断言${String(i + 1).padStart(2, '0')} | ${name.padEnd(26)} | 实际=${displayActual.padEnd(50)} | 期望=${displayExpected}`);
  }
});

// === 5. 附加统计验证 ===
console.log('\n' + '='.repeat(80));
console.log('📊 导出文件整体统计');
console.log('='.repeat(80));
console.log(`  - 总行数（含表头）: ${parsed.data.length + 1}`);
console.log(`  - 数据行数: ${parsed.data.length}`);
console.log(`  - 列数: ${parsed.meta.fields ? parsed.meta.fields.length : 'N/A'}`);
console.log(`  - 列名: ${parsed.meta.fields ? parsed.meta.fields.join(' | ') : 'N/A'}`);
console.log(`  - 已确认状态点数: ${parsed.data.filter(r => r['状态'] === '已确认').length}`);
console.log(`  - 带周姐备注点数: ${parsed.data.filter(r => r['周姐备注'] && r['周姐备注'].length > 0).length}`);
console.log(`  - 带人工处理痕迹点数: ${parsed.data.filter(r => r['人工处理痕迹'] && r['人工处理痕迹'].length > 0).length}`);
console.log(`  - 带审核意见历史点数: ${parsed.data.filter(r => r['审核意见历史'] && r['审核意见历史'].length > 0).length}`);

// === 6. 结果总结 ===
console.log('\n' + '='.repeat(80));
console.log('🎯 最终验证结果');
console.log('='.repeat(80));
console.log(`  通过断言: ${passCount} / ${assertions.length}`);
console.log(`  失败断言: ${failCount}`);

if (failCount > 0) {
  console.log('\n  ❌ 失败详情:');
  fails.forEach(f => console.log(`    - ${f.name}: 实际="${f.actual}", 期望="${f.expected}"`));
  process.exit(1);
} else {
  console.log('\n  🎉🎉🎉 所有26项断言全部通过！CSV导出内容与手动处理结果100%一致！🎉🎉🎉');
  console.log(`  📄 导出文件路径: ${outPath}`);
  process.exit(0);
}
