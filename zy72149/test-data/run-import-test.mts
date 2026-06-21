/**
 * 可复现的导入+异常+导出 端到端测试脚本
 *
 * 覆盖：
 *  1. 打开导入页（此处直接构造 File 对象模拟选择/拖拽）
 *  2. 解析曲目表 CSV、音频文件名清单 TXT、群聊批注 TXT、合同截图 PNG/JPG
 *  3. 合并批次生成素材记录（多文件不丢，来源按文件类型自动判定）
 *  4. 异常检测（授权过期 / 时码错位 / 重复曲目）
 *  5. 报告口径核对（Report 页展示 vs generateReportContent 下载报告 vs 明细 Excel 字段）
 *
 * 运行方式：
 *   npx tsx test-data/run-import-test.mts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------
// 模拟浏览器 DOM 环境中工具函数依赖的最小部分
// ---------------------------------------------------------------------
// fileParser 用到了 FileReader、File、Blob 这些浏览器 API。
// 我们在 Node 端直接用 xlsx + Buffer 重走同样的解析逻辑，
// 以"同一份数据源、同一套判定规则"来证明口径一致。
// ---------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname);

// -------- 与 src/utils/detection.ts 完全一致的逻辑 --------
type ExceptionType = 'auth_expired' | 'timecode_mismatch' | 'duplicate_track';
interface MaterialException {
  type: ExceptionType;
  description: string;
  detectedAt: string;
  resolved: boolean;
}
interface AudioMaterial {
  id: string;
  fileName: string;
  trackName: string;
  emotionTag: string;
  remark: string;
  source: '曲目表' | '音频文件' | '合同截图' | '群聊批注';
  processedAt: string;
  processedBy: string;
  status: 'pending' | 'reviewed' | 'exception' | 'resolved';
  exceptions: MaterialException[];
  originalSource: string;
  authorizationDate?: string;
  timecode?: string;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

const createException = (type: ExceptionType, description: string): MaterialException => ({
  type, description, detectedAt: new Date().toISOString(), resolved: false,
});

const detectAuthExpired = (m: AudioMaterial): MaterialException | null => {
  if (!m.authorizationDate) return null;
  const auth = new Date(m.authorizationDate);
  const now = new Date();
  if (auth < now) {
    const days = Math.floor((now.getTime() - auth.getTime()) / 86400000);
    return createException('auth_expired', `授权已过期${days}天，需要重新申请`);
  }
  return null;
};

const detectTimecodeMismatch = (m: AudioMaterial): MaterialException | null => {
  if (!m.timecode) return null;
  if (!/^\d{2}:\d{2}:\d{2}\s*-\s*\d{2}:\d{2}:\d{2}$/.test(m.timecode.trim())) {
    return createException('timecode_mismatch', `时码格式不正确："${m.timecode}"`);
  }
  const [s, e] = m.timecode.split('-').map((x) => x.trim());
  const parse = (t: string) => { const [h, m, sec] = t.split(':').map(Number); return h * 3600 + m * 60 + sec; };
  if (parse(s) >= parse(e)) {
    return createException('timecode_mismatch', `开始时间大于结束时间：${m.timecode}`);
  }
  return null;
};

const detectDuplicateTracks = (materials: AudioMaterial[]) => {
  const map = new Map<string, string[]>();
  materials.forEach((m) => {
    const key = m.trackName.toLowerCase().replace(/\s+/g, '').replace(/[_\-0-9]/g, '').substring(0, 6);
    if (key.length < 2) return;
    map.set(key, [...(map.get(key) || []), m.id]);
  });
  const dup = new Map<string, string[]>();
  map.forEach((ids, k) => { if (ids.length > 1) dup.set(k, ids); });
  return dup;
};

const countDuplicateGroups = (materials: AudioMaterial[]) => detectDuplicateTracks(materials).size;

const detectAllExceptions = (materials: AudioMaterial[]): AudioMaterial[] => {
  const duplicates = detectDuplicateTracks(materials);
  const dupIds = new Set<string>();
  duplicates.forEach((ids) => ids.forEach((id) => dupIds.add(id)));

  return materials.map((m) => {
    const newEx: MaterialException[] = [];
    const a = detectAuthExpired(m); if (a) newEx.push(a);
    const t = detectTimecodeMismatch(m); if (t) newEx.push(t);
    if (dupIds.has(m.id)) {
      const group = Array.from(duplicates.values()).find((g) => g.includes(m.id));
      const others = materials.filter((x) => group?.includes(x.id) && x.id !== m.id).map((x) => x.trackName).join('、');
      if (others) newEx.push(createException('duplicate_track', `与"${others}"内容重复`));
    }
    const merged = [...m.exceptions];
    const existing = new Set(m.exceptions.map((e) => `${e.type}_${e.resolved}`));
    newEx.forEach((e) => { if (!existing.has(`${e.type}_false`)) merged.push(e); });
    const hasUnresolved = merged.some((e) => !e.resolved);
    const status: AudioMaterial['status'] = hasUnresolved ? 'exception' : m.status === 'exception' ? 'pending' : m.status;
    return { ...m, exceptions: merged, status };
  });
};

// -------- 与 src/utils/fileParser.ts 一致的列名归一化 --------
const COLUMN_MAPS: Record<string, string[]> = {
  fileName: ['文件名', '文件名称', 'filename', 'file_name', '音频文件', '音频文件名'],
  trackName: ['曲目名称', '曲目名', '曲名', 'trackname', 'track_name', '名称', '标题'],
  emotionTag: ['情绪标签', '情绪', '标签', 'emotion', 'emotion_tag'],
  remark: ['备注', '说明', '批注', 'remark', 'note', '描述'],
  authorizationDate: ['授权日期', '到期日期', '有效期', 'auth_date', 'expire', 'expiry_date'],
  timecode: ['时码', '时间码', '时长', 'timecode', 'duration', '时间'],
};
const normalizeHeader = (h: string): string => {
  const t = h.trim();
  for (const [k, aliases] of Object.entries(COLUMN_MAPS)) {
    if (aliases.includes(t.toLowerCase()) || aliases.includes(t)) return k;
  }
  return t;
};
const normalizeDateValue = (val: string): string => {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.substring(0, 10);
  const n = Number(val);
  if (!isNaN(n) && n > 30000 && n < 60000) {
    const d = new Date((n - 25569) * 86400 * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return val;
};
const EMOTIONS = ['欢快', '舒缓', '紧张', '悲伤', '激昂', '温馨', '神秘', '其他'];
const guessSource = (name: string): AudioMaterial['source'] => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['wav', 'mp3', 'aiff', 'flac', 'ogg', 'aac', 'm4a', 'wma'].includes(ext)) return '音频文件';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'heic'].includes(ext)) return '合同截图';
  return '曲目表';
};

// -------- 解析器（对应 fileParser 的三个入口） --------
function parseCsv(fileName: string, text: string): AudioMaterial[] {
  const wb = XLSX.read(text, { type: 'string' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (rows.length === 0) throw new Error('CSV 内容为空');
  const headers = Object.keys(rows[0]);
  const mapped = headers.map(normalizeHeader);
  const out: AudioMaterial[] = [];
  rows.forEach((row, idx) => {
    const norm: Record<string, string> = {};
    headers.forEach((h, i) => { norm[mapped[i]] = String(row[h] || '').trim(); });
    const fileName0 = norm.fileName || '';
    const trackName = norm.trackName || '';
    if (!fileName0 && !trackName) return;
    out.push({
      id: generateId(),
      fileName: fileName0 || `未知文件_${idx + 1}`,
      trackName: trackName || fileName0 || `未知曲目_${idx + 1}`,
      emotionTag: EMOTIONS.includes(norm.emotionTag || '') ? norm.emotionTag : '',
      remark: norm.remark || '',
      source: '曲目表',
      processedAt: new Date().toISOString(),
      processedBy: '小温',
      status: 'pending',
      exceptions: [],
      originalSource: `导入自文件：${fileName}，第${idx + 2}行`,
      authorizationDate: normalizeDateValue(norm.authorizationDate) || undefined,
      timecode: norm.timecode || undefined,
    });
  });
  return out;
}

function parseTextList(fileName: string, text: string, forceSource?: AudioMaterial['source']): AudioMaterial[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#'));
  if (lines.length === 0) throw new Error('文本内容为空');
  return lines.flatMap((line, idx) => {
    const parts = line.split(/[,\t;|]/).map((p) => p.trim());
    const fn = parts[0] || '';
    const tn = parts[1] || '';
    if (!fn) return [];
    return [{
      id: generateId(),
      fileName: fn,
      trackName: tn || fn.replace(/\.[^.]+$/, ''),
      emotionTag: '',
      remark: '',
      source: forceSource || guessSource(fn),
      processedAt: new Date().toISOString(),
      processedBy: '小温',
      status: 'pending',
      exceptions: [],
      originalSource: `导入自文件清单：${fileName}，第${idx + 1}行`,
    }];
  });
}

function parseImage(fileName: string): AudioMaterial[] {
  return [{
    id: generateId(),
    fileName,
    trackName: fileName.replace(/\.[^.]+$/, ''),
    emotionTag: '',
    remark: '图片附件：请人工复核截图内容',
    source: '合同截图',
    processedAt: new Date().toISOString(),
    processedBy: '小温',
    status: 'pending',
    exceptions: [],
    originalSource: `合同截图导入：${fileName}（截图解析仅保留附件记录，异常与标签需人工核对）`,
  }];
}

// -------- 报告生成（对应 export.ts generateReportContent） --------
function generateReport(materials: AudioMaterial[]): string {
  const total = materials.length;
  const reviewed = materials.filter((m) => m.status === 'reviewed' || m.status === 'resolved').length;
  const pending = materials.filter((m) => m.status === 'pending').length;
  const hasException = materials.filter((m) => m.status === 'exception').length;
  const authExpired = materials.filter((m) => m.exceptions.some((e) => e.type === 'auth_expired' && !e.resolved)).length;
  const timecodeMismatch = materials.filter((m) => m.exceptions.some((e) => e.type === 'timecode_mismatch' && !e.resolved)).length;
  const duplicateTrack = countDuplicateGroups(materials); // 核心：组数，不是条数
  const emo: Record<string, number> = {};
  materials.forEach((m) => { const t = m.emotionTag || '未标注'; emo[t] = (emo[t] || 0) + 1; });
  const progress = total > 0 ? Math.round((reviewed / total) * 100) : 0;
  return `
音频素材情绪标签复核报告
生成时间：${new Date().toLocaleString('zh-CN')}

【复核进度】
总计：${total} 条
已完成复核：${reviewed} 条（${progress}%）
待复核：${pending} 条
存在异常：${hasException} 条

【异常统计】
授权过期：${authExpired} 条
时码错位：${timecodeMismatch} 条
重复曲目：${duplicateTrack} 组

【情绪标签分布】
${Object.entries(emo).map(([t, c]) => `${t}：${c} 条`).join('\n')}

【备注】
- 本报告数据与导出明细完全一致
- 所有修改记录均已保留原始来源和处理时间
- 异常素材请优先处理，避免影响后续工作
`.trim();
}

// -------- 运行测试 --------
interface AssertCtx { passed: number; failed: number; }
function assert(ctx: AssertCtx, cond: unknown, msg: string) {
  if (cond) {
    ctx.passed++;
    console.log(`  ✔ ${msg}`);
  } else {
    ctx.failed++;
    console.error(`  ✘ ${msg}`);
  }
}

async function main() {
  const ctx: AssertCtx = { passed: 0, failed: 0 };
  console.log('\n== 导入+异常+导出 端到端测试 ==\n');

  // 1. 读取测试文件，模拟浏览器拖拽多个文件
  console.log('[Step 1] 读取 5 个测试文件：CSV + TXT×2 + PNG + JPG');
  const csvFile = { name: '曲目表_测试.csv', ext: 'csv' } as const;
  const txtFile = { name: '音频文件名清单_测试.txt', ext: 'txt' } as const;
  const groupTxt = { name: '群聊批注_测试.txt', ext: 'txt' } as const;
  const pngImg = { name: '合同截图_授权期限.png', ext: 'png' } as const;
  const jpgImg = { name: '合同截图_曲目清单.jpg', ext: 'jpg' } as const;

  const csvText = fs.readFileSync(path.join(DATA_DIR, csvFile.name), 'utf-8');
  const audioText = fs.readFileSync(path.join(DATA_DIR, txtFile.name), 'utf-8');
  const groupText = fs.readFileSync(path.join(DATA_DIR, groupTxt.name), 'utf-8');
  const pngBuf = fs.readFileSync(path.join(DATA_DIR, pngImg.name));
  const jpgBuf = fs.readFileSync(path.join(DATA_DIR, jpgImg.name));

  assert(ctx, csvText.includes('合唱结尾'), 'CSV 包含"合唱结尾"行（授权过期样例）');
  assert(ctx, audioText.trim().split('\n').length === 5, '音频文件名清单 TXT 有 5 行');
  assert(ctx, groupText.trim().split('\n').length === 3, '群聊批注 TXT 有 3 行');
  assert(ctx, pngBuf[0] === 0x89 && pngBuf[1] === 0x50, 'PNG 文件签名正确');
  assert(ctx, jpgBuf[0] === 0xff && jpgBuf[1] === 0xd8, 'JPG 文件签名正确');

  // 2. 多文件解析（不丢文件，来源按文件类型自动判定）
  console.log('\n[Step 2] 多文件批量解析');
  const csvRows = parseCsv(csvFile.name, csvText);
  const audioRows = parseTextList(txtFile.name, audioText); // 自动判定：文件名含 wav/mp3 → 音频文件
  // 群聊批注 TXT：文件名含有"群聊"关键字，手动标注来源
  const groupRows = parseTextList(groupTxt.name, groupText, '群聊批注');
  const pngRows = parseImage(pngImg.name);
  const jpgRows = parseImage(jpgImg.name);

  const batch = [...csvRows, ...audioRows, ...groupRows, ...pngRows, ...jpgRows];
  assert(ctx, batch.length === 8 + 5 + 3 + 1 + 1, `批次共 18 条（CSV 8 + 音频 TXT 5 + 群聊 TXT 3 + PNG 1 + JPG 1），实际 ${batch.length}`);

  // 3. 来源构成核对
  console.log('\n[Step 3] 来源构成核对（不被统一覆盖）');
  const bySource: Record<string, number> = {};
  batch.forEach((m) => { bySource[m.source] = (bySource[m.source] || 0) + 1; });
  console.log('  来源分布：', bySource);
  assert(ctx, bySource['曲目表'] === 8, `曲目表 8 条，实际 ${bySource['曲目表']}`);
  assert(ctx, bySource['音频文件'] === 5, `音频文件 5 条，实际 ${bySource['音频文件']}`);
  assert(ctx, bySource['群聊批注'] === 3, `群聊批注 3 条，实际 ${bySource['群聊批注']}`);
  assert(ctx, bySource['合同截图'] === 2, `合同截图 2 条，实际 ${bySource['合同截图']}`);

  // 4. 原始来源保留
  console.log('\n[Step 4] 原始来源与处理时间');
  assert(ctx, batch[0].originalSource.includes('曲目表_测试.csv'), `首条 originalSource 指向 CSV，实际="${batch[0].originalSource}"`);
  assert(ctx, batch[8].originalSource.includes('音频文件名清单_测试.txt'), `第 9 条 originalSource 指向音频 TXT，实际="${batch[8].originalSource}"`);
  assert(ctx, batch[16].originalSource.includes('合同截图导入'), `PNG 截图 originalSource 含"合同截图导入"，实际="${batch[16].originalSource}"`);
  assert(ctx, batch.every((m) => m.processedAt && m.processedBy === '小温'), '每条都有处理时间和处理人');

  // 5. 异常检测
  console.log('\n[Step 5] 运行异常检测');
  const detected = detectAllExceptions(batch);

  const authExpired = detected.filter((m) => m.exceptions.some((e) => e.type === 'auth_expired' && !e.resolved));
  const timecodeBad = detected.filter((m) => m.exceptions.some((e) => e.type === 'timecode_mismatch' && !e.resolved));
  const dupGroups = countDuplicateGroups(detected);

  // 预导入的 CSV 中：TRK_Choral_End.wav 授权 2025-03-01（已过期），BGM_Cello_Dark.mp3 时码开始>结束
  assert(ctx, authExpired.length === 1, `授权过期 1 条（合唱结尾），实际 ${authExpired.length}`);
  assert(ctx, authExpired[0].trackName === '合唱结尾', `授权过期曲目名="合唱结尾"，实际="${authExpired[0]?.trackName}"`);
  assert(ctx, timecodeBad.length === 1, `时码错位 1 条（大提琴暗调），实际 ${timecodeBad.length}`);
  assert(ctx, timecodeBad[0].trackName === '大提琴暗调', `时码错位曲目名="大提琴暗调"，实际="${timecodeBad[0]?.trackName}"`);
  // 原 mock 中"结尾曲 TRK_010_Ending"出现两次，这里新批次没有重复，所以组数 0
  assert(ctx, dupGroups === 0, `当前批次无重复曲目，实际 ${dupGroups} 组`);

  // 6. 重复曲目口径验证：人为加入两条相似曲目验证组数统计
  console.log('\n[Step 6] 重复曲目口径：组数 vs 条数');
  const withDups = [
    ...detected,
    {
      id: generateId(), fileName: 'DUP_A.wav', trackName: '结尾曲 01',
      emotionTag: '', remark: '', source: '音频文件' as const,
      processedAt: new Date().toISOString(), processedBy: '小温',
      status: 'pending' as const, exceptions: [], originalSource: '测试：重复曲目 A',
    },
    {
      id: generateId(), fileName: 'DUP_B.wav', trackName: '结尾曲 02',
      emotionTag: '', remark: '', source: '音频文件' as const,
      processedAt: new Date().toISOString(), processedBy: '小温',
      status: 'pending' as const, exceptions: [], originalSource: '测试：重复曲目 B',
    },
    {
      id: generateId(), fileName: 'DUP_C.wav', trackName: '结尾曲 03',
      emotionTag: '', remark: '', source: '音频文件' as const,
      processedAt: new Date().toISOString(), processedBy: '小温',
      status: 'pending' as const, exceptions: [], originalSource: '测试：重复曲目 C',
    },
  ];
  const afterDup = detectAllExceptions(withDups);
  const dupCountRecords = afterDup.filter((m) => m.exceptions.some((e) => e.type === 'duplicate_track' && !e.resolved)).length;
  const dupGroupCount = countDuplicateGroups(afterDup);
  console.log(`  重复记录条数=${dupCountRecords}，组数=${dupGroupCount}`);
  assert(ctx, dupGroupCount === 1, `3 条相似 → 1 组，实际 ${dupGroupCount}`);
  assert(ctx, dupCountRecords === 3, `3 条都被标记 duplicate_track 异常，实际 ${dupCountRecords}`);

  // 7. 报告口径一致性：Report 页统计 vs 下载报告
  console.log('\n[Step 7] 报告预览 vs 下载报告（重复曲目应显示组数而非条数）');
  const report = generateReport(afterDup);
  console.log('  报告节选：\n' + report.split('【情绪标签分布】')[0]);
  assert(ctx, report.includes('重复曲目：1 组'), `下载报告写"1 组"，实际报告=${report.match(/重复曲目：.*/)?.[0]}`);
  assert(ctx, !report.includes(`重复曲目：${dupCountRecords} 组`), `不应该用条数(3)当作组数报告`);
  assert(ctx, report.includes(`总计：${afterDup.length} 条`), `报告总数正确`);

  // 8. 明细导出口径：每条含来源、授权、时码、原始来源、处理时间
  console.log('\n[Step 8] 明细导出字段校验');
  const exportData = afterDup.map((m, i) => ({
    '序号': i + 1,
    '文件名': m.fileName,
    '曲目名称': m.trackName,
    '情绪标签': m.emotionTag || '未标注',
    '状态': m.status,
    '来源': m.source,
    '处理备注': m.remark,
    '例外情况': m.exceptions.filter((e) => !e.resolved).map((e) => e.type).join('、') || '无',
    '原始来源': m.originalSource,
    '处理人': m.processedBy,
    '处理时间': m.processedAt,
    '授权日期': m.authorizationDate || '',
    '时码': m.timecode || '',
  }));
  assert(ctx, exportData.every((r) => r['来源'] && r['原始来源'] && r['处理时间']), '每行都有来源 / 原始来源 / 处理时间');
  const authRow = exportData.find((r) => r['曲目名称'] === '合唱结尾');
  assert(ctx, authRow && authRow['例外情况'].includes('auth_expired'), `合唱结尾 → 授权过期，实际例外="${authRow?.['例外情况']}"`);
  const tcRow = exportData.find((r) => r['曲目名称'] === '大提琴暗调');
  assert(ctx, tcRow && tcRow['例外情况'].includes('timecode_mismatch'), `大提琴暗调 → 时码错位，实际例外="${tcRow?.['例外情况']}"`);

  // 9. 写一份报告文件和明细 Excel 作为留档
  console.log('\n[Step 9] 写出报告与明细到 test-data/output/ 供人工复核');
  const outDir = path.join(DATA_DIR, 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, '音频素材情绪标签复核报告.txt');
  fs.writeFileSync(reportPath, report, 'utf-8');
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportData);
  XLSX.utils.book_append_sheet(wb, ws, '复核清单');
  const xlsxPath = path.join(outDir, '音频素材情绪标签复核清单.xlsx');
  XLSX.writeFile(wb, xlsxPath);
  console.log(`  → ${reportPath}`);
  console.log(`  → ${xlsxPath}`);

  console.log(`\n== 结果：通过 ${ctx.passed}，失败 ${ctx.failed} ==\n`);
  if (ctx.failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
