import * as XLSX from 'xlsx';
import { buildReportWorkbook, triggerDownload } from './src/utils/excelExport.js';
import {
  mockMaterials, mockFilterCriterias, mockTimeline, mockExports, mockHandoverNote,
} from './src/mockData.js';
import { fitMaterial, analyzeJumpCauses } from './src/utils/fitting.js';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const activeFilter = mockFilterCriterias[0];
const filteredMaterials = mockMaterials.filter(m => activeFilter.materialIds.includes(m.id));
const fittingResults = {};
for (const m of filteredMaterials) {
  fittingResults[m.id] = fitMaterial(m, activeFilter);
}
const jumpCauses = analyzeJumpCauses(fittingResults, undefined, filteredMaterials, activeFilter, undefined);

const bundle = {
  materials: mockMaterials,
  filteredMaterials,
  filter: activeFilter,
  filterHistory: mockFilterCriterias,
  fittingResults,
  jumpCauses,
  timeline: mockTimeline,
  previousExports: mockExports,
  handoverNote: mockHandoverNote,
  operator: '验收脚本',
  generatedAt: Date.now(),
};

console.log('\n=== Step 1: 构建 7-Sheet 工作簿 ===');
const { wb, snapshot, hash, fileName } = buildReportWorkbook(bundle);
console.log('文件名:', fileName);
console.log('校验哈希:', hash);
console.log('材料数:', snapshot.materialCount, ' 数据点:', snapshot.totalPoints);
console.log('边界警告:', snapshot.boundaryWarnings.length, snapshot.boundaryWarnings);
console.log('各材料 R²:', JSON.stringify(snapshot.rSquaredValues, null, 2));

// 保存到磁盘
const outDir = join(__dirname, 'tmp-verify');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, fileName);
const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
writeFileSync(outPath, Buffer.from(buf));
console.log('\n✅ 文件已保存到:', outPath, '大小:', (buf.length / 1024).toFixed(1), 'KB');

// 重新读入验证
console.log('\n=== Step 2: 重新解析文件，逐 Sheet 核对 ===');
const wb2 = XLSX.readFile(outPath);
const sheetNames = wb2.SheetNames;
console.log('Sheet 列表:', sheetNames);
const expected = ['1.数据校验', '2.报告摘要', '3.拟合结果明细', '4.异常跳变分析', '5.学生草稿溯源', '6.历史时间线', '7.交接指引'];
for (const s of expected) {
  const hit = sheetNames.includes(s);
  console.log('  -', s, hit ? '✅ 存在' : '❌ 缺失');
}

// 校验 Sheet1 数据校验页的关键数据
console.log('\n=== Step 3: Sheet1 数据校验页核对 ===');
const s1 = XLSX.utils.sheet_to_json(wb2.Sheets['1.数据校验'], { header: 1 });
const map = {};
for (const row of s1) {
  if (row && row[0]) map[String(row[0])] = row[1];
}
console.log('  文件名匹配:', map['文件名'] === fileName ? '✅' : '❌', map['文件名']);
console.log('  哈希匹配:', map['校验哈希 (SHA-like)'] === hash ? '✅' : '❌', map['校验哈希 (SHA-like)']);
console.log('  操作人:', map['操作人']);
console.log('  生成时间:', map['生成时间']);
console.log('  材料数量:', map['材料数量'], '==', snapshot.materialCount, map['材料数量'] == snapshot.materialCount ? '✅' : '❌');
console.log('  数据点总数:', map['数据点总数'], '==', snapshot.totalPoints, map['数据点总数'] == snapshot.totalPoints ? '✅' : '❌');
console.log('  筛选口径名称:', map['筛选口径名称'], '==', activeFilter.name, map['筛选口径名称'] === activeFilter.name ? '✅' : '❌');
console.log('  边界警告数量:', map['边界警告数量'], '==', snapshot.boundaryWarnings.length, map['边界警告数量'] == snapshot.boundaryWarnings.length ? '✅' : '❌');

// 校验 Sheet2 报告摘要
console.log('\n=== Step 4: Sheet2 报告摘要核对 ===');
const s2 = XLSX.utils.sheet_to_json(wb2.Sheets['2.报告摘要'], { header: 1 });
const s2Map = {};
for (const row of s2) {
  if (row && row[0]) s2Map[String(row[0])] = { c1: row[1], c3: row[3], c4: row[4] };
}
console.log('  平均 R²:', s2Map['平均拟合优度 R²']?.c1);
console.log('  跳变风险数:', s2Map['跳变风险数']?.c1, '==', jumpCauses.length, s2Map['跳变风险数']?.c1 == jumpCauses.length ? '✅' : '❌');
console.log('  已复核:', s2Map['已复核']?.c1);
console.log('  待处理:', s2Map['待处理']?.c1);
console.log('  缺材料:', s2Map['缺材料']?.c1);

// 找材料处理清单表头，数一下行数
const headerIdx = s2.findIndex(r => r && r[0] === '材料ID' && r[2] === '处理状态');
let matRows = 0;
for (let i = headerIdx + 1; i < s2.length; i++) {
  if (s2[i] && s2[i].filter(x => x !== undefined && x !== '').length > 0) matRows++;
  else break;
}
console.log('  材料处理清单行数:', matRows, '==', filteredMaterials.length, matRows === filteredMaterials.length ? '✅' : '❌');

// 校验 Sheet3 拟合结果明细 + 残差
console.log('\n=== Step 5: Sheet3 拟合结果明细核对 ===');
const s3 = XLSX.utils.sheet_to_json(wb2.Sheets['3.拟合结果明细'], { header: 1 });
// 第一个表头
const mainHeader = s3.findIndex(r => r && r[0] === '材料ID' && r[4] === 'R²');
console.log('  主表头位于行:', mainHeader);
let mainCount = 0;
for (let i = mainHeader + 1; i < s3.length; i++) {
  if (s3[i] && s3[i][0] && /^mat-/.test(String(s3[i][0]))) mainCount++;
  else if (mainCount > 0) break;
}
console.log('  拟合结果主表行数:', mainCount, '==', filteredMaterials.length, mainCount === filteredMaterials.length ? '✅' : '❌');
// 残差表
const residualHeader = s3.findIndex(r => r && r[0] === '材料ID' && r[3] === 'Y实测');
let residualCount = 0;
for (let i = residualHeader + 1; i < s3.length; i++) {
  if (s3[i] && s3[i][0] && /^mat-/.test(String(s3[i][0]))) residualCount++;
}
const expectedResidual = filteredMaterials.reduce((a, m) => a + m.dataPoints.length, 0);
console.log('  残差表行数:', residualCount, '==', expectedResidual, residualCount === expectedResidual ? '✅' : '❌');

// 校验 Sheet4 异常跳变分析
console.log('\n=== Step 6: Sheet4 异常跳变分析核对 ===');
const s4 = XLSX.utils.sheet_to_json(wb2.Sheets['4.异常跳变分析'], { header: 1 });
const anomalyIdx = s4.findIndex(r => r && r[0] === '跳变风险总数');
console.log('  跳变风险总数行位置:', anomalyIdx, '值:', s4[anomalyIdx]?.[1], '==', jumpCauses.length, s4[anomalyIdx]?.[1] == jumpCauses.length ? '✅' : '❌');

// 异常矩阵
const matrixIdx = s4.findIndex(r => r && r[0] === '材料ID' && r[2] === '边界样本不足');
let matAnom = 0;
for (let i = matrixIdx + 1; i < s4.length; i++) {
  if (s4[i] && s4[i][0] && /^mat-/.test(String(s4[i][0]))) matAnom++;
  else if (matAnom > 0) break;
}
console.log('  异常矩阵材料数:', matAnom, '==', filteredMaterials.length, matAnom === filteredMaterials.length ? '✅' : '❌');

// 校验 Sheet5 草稿溯源 + 命名链路
console.log('\n=== Step 7: Sheet5 学生草稿溯源核对 ===');
const s5 = XLSX.utils.sheet_to_json(wb2.Sheets['5.学生草稿溯源'], { header: 1 });
const draftHeader = s5.findIndex(r => r && r[0] === '材料ID' && r[2] === '学生草稿原文（完整）');
let draftCount = 0;
for (let i = draftHeader + 1; i < s5.length; i++) {
  if (s5[i] && s5[i][0] && /^mat-/.test(String(s5[i][0]))) draftCount++;
  else if (draftCount > 0) break;
}
console.log('  草稿溯源行数:', draftCount, '==', filteredMaterials.length, draftCount === filteredMaterials.length ? '✅' : '❌');

const nameHistHeader = s5.findIndex(r => r && r[0] === '材料ID' && r[2] === '名称');
let histCount = 0;
for (let i = nameHistHeader + 1; i < s5.length; i++) {
  if (s5[i] && s5[i][0] && /^mat-/.test(String(s5[i][0]))) histCount++;
  else if (histCount > 0 && !s5[i]?.[0]) break;
}
const expectedHist = filteredMaterials.reduce((a, m) => a + m.nameHistory.length, 0);
console.log('  命名链路行数:', histCount, '==', expectedHist, histCount === expectedHist ? '✅' : '❌');

// 校验 Sheet6 历史时间线
console.log('\n=== Step 8: Sheet6 历史时间线核对 ===');
const s6 = XLSX.utils.sheet_to_json(wb2.Sheets['6.历史时间线'], { header: 1 });
const tlHeader = s6.findIndex(r => r && r[0] === '时间' && r[3] === '描述');
let tlCount = 0;
for (let i = tlHeader + 1; i < s6.length; i++) {
  if (s6[i] && s6[i][0] && s6[i][0].includes('2026')) tlCount++;
  else if (tlCount > 0) break;
}
console.log('  时间线事件行数:', tlCount, '≈', mockTimeline.length, tlCount === mockTimeline.length ? '✅' : `⚠️ (实际${tlCount})`);

const criteriaHeader = s6.findIndex(r => r && r[0] === '口径ID' && r[2] === '创建人');
let critCount = 0;
for (let i = criteriaHeader + 1; i < s6.length; i++) {
  if (s6[i] && s6[i][0] && /^f-/.test(String(s6[i][0]))) critCount++;
  else if (critCount > 0) break;
}
console.log('  筛选口径列表行数:', critCount, '==', mockFilterCriterias.length, critCount === mockFilterCriterias.length ? '✅' : '❌');

// 校验 Sheet7 交接指引
console.log('\n=== Step 9: Sheet7 交接指引核对 ===');
const s7 = XLSX.utils.sheet_to_json(wb2.Sheets['7.交接指引'], { header: 1 });
const hasLocation = s7.some(r => r && String(r[0] || '').includes('材料放在哪里'));
const hasAnomaly = s7.some(r => r && String(r[0] || '').includes('异常在哪里看'));
const hasReexport = s7.some(r => r && String(r[0] || '').includes('如何重新导出'));
const hasReviewed = s7.some(r => r && String(r[0] || '').includes('已复核'));
const hasMissing = s7.some(r => r && String(r[0] || '').includes('缺材料'));
const hasContact = s7.some(r => r && String(r[0] || '').includes('紧急联系'));
console.log('  含材料位置章节:', hasLocation ? '✅' : '❌');
console.log('  含异常位置章节:', hasAnomaly ? '✅' : '❌');
console.log('  含重新导出章节:', hasReexport ? '✅' : '❌');
console.log('  含已复核/缺材料分类:', hasReviewed && hasMissing ? '✅' : '❌');
console.log('  含紧急联系:', hasContact ? '✅' : '❌');

// 关键跳变原因是否在 Sheet4 中出现
console.log('\n=== Step 10: 跳变原因清单覆盖检查 ===');
const nameMismatch = s4.some(r => r && String(r[0] || '').includes('名称前后不一致'));
const unitIssue = s4.some(r => r && String(r[0] || '').includes('单位不一致'));
console.log('  Sheet4 中出现"单位不一致/存疑":', unitIssue ? '✅' : '❌');
console.log('  Sheet4 中出现"材料名称前后不一致":', nameMismatch ? '✅' : '❌');

console.log('\n========== 🎉 全部验收完成 ==========\n');
console.log('输出文件位置:', outPath);
