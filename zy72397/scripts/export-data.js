const fs = require('fs');
const path = require('path');
const { cliBootstrap } = require('../src/cli-bootstrap');
const dataStore = require('../src/store/data-store');

const { dataFile, loadResult, getArg } = cliBootstrap();

let format = (getArg('format') || 'json').toLowerCase();
let outputPath = getArg('output');
let needsQcReview = getArg('needs-qc-review');
let hasBoundaryIssues = getArg('has-boundary-issues');
let recordId = getArg('record-id');
let status = getArg('status');

const filters = {};
if (needsQcReview === 'true' || needsQcReview === '1' || needsQcReview === 'yes') filters.needsQcReview = true;
if (needsQcReview === 'false' || needsQcReview === '0' || needsQcReview === 'no') filters.needsQcReview = false;
if (hasBoundaryIssues === 'true' || hasBoundaryIssues === '1') filters.hasBoundaryIssues = true;
if (hasBoundaryIssues === 'false' || hasBoundaryIssues === '0') filters.hasBoundaryIssues = false;
if (recordId) filters.recordId = recordId;
if (status) filters.status = status;

const S = '='.repeat(72);
const D = '-'.repeat(72);

console.log(S);
console.log(`📤 导出明细 (格式: ${format.toUpperCase()})`);
console.log(S);
console.log(`数据文件: ${dataFile}`);
if (loadResult && loadResult.loaded) {
  console.log(`已加载: ${loadResult.records} 条记录，${loadResult.audit_logs} 条审计日志`);
} else {
  console.log(`加载状态: ${loadResult ? loadResult.reason : '未知'}（从空开始）`);
}
console.log('');
console.log('💡 核心保证: 导出与页面展示/API返回走同一份数据源 getUnifiedView()');
console.log('   尤其是采样缺半小时等边界问题记录，在三方都可追溯');
console.log('');
if (Object.keys(filters).length > 0) {
  console.log('🔍 应用过滤器:');
  Object.keys(filters).forEach(k => console.log(`   --${k} = ${filters[k]}`));
  console.log('');
}

try {
  const data = dataStore.getExportData(format, filters);
  const stats = dataStore.getStatistics();

  console.log('📊 总体统计:');
  [
    ['总记录数', 'total_records'],
    ['需QC复核 (采样缺半小时等)', 'needs_qc_review'],
    ['含边界问题', 'has_boundary_issues'],
    ['已返工被替代(SUPERSEDED)', 'superseded_records'],
    ['返工链中记录数', 'records_in_rework_chain'],
  ].forEach(([label, key]) => {
    console.log(`   ${label.padEnd(30)}: ${stats[key] || 0}`);
  });

  const fullView = dataStore.getUnifiedView(filters);
  console.log(`\n📦 本次筛选结果: ${fullView.length} 条记录`);
  if (Object.keys(filters).length > 0) {
    console.log('   应用过滤器后只导出匹配记录');
  }
  console.log('');

  // 一致性自检
  console.log('🔗 三方一致性自检 (防止页面OK/接口读不到/导出不一致):');
  const vc = dataStore.verifyConsistency();
  console.log(`   结果: ${vc.passed ? '✅ 通过' : '❌ 失败: ' + vc.issues.join('; ')}`);
  console.log(`   ${vc.summary}`);
  console.log('');

  // 如果存在采样缺半小时的记录，专门追一下这条
  const boundaryRecsAll = dataStore.getUnifiedView({ hasBoundaryIssues: true });
  if (boundaryRecsAll.length > 0) {
    console.log('🔍 边界问题记录核对（采样缺半小时等，绝不允许从导出里消失）:');
    boundaryRecsAll.forEach(r => {
      const issues = (r.boundary_issues || []).map(i => `${i.issueType}`).join('+') || '(无)';
      const sup = r.superseded_by ? ` → 被 ${r.superseded_by} 替代` : '';
      console.log(`   ${r.id.padEnd(14)} status=${r.current_status.padEnd(18)} qc_req=${String(r.qc_review_required).padEnd(5)} issues=${issues.padEnd(44)}${sup}`);
    });
    console.log('   注: 如使用了过滤器（如 needs-qc-review=true），不匹配的记录会被导出跳过，属正常');
    console.log('');
    // 每条去未过滤的完整视图里核对是否一致（因为过滤只是导出筛选，不代表数据丢失）
    if (format === 'json') {
      const fullExpNoFilter = JSON.parse(dataStore.getExportData('json'));
      boundaryRecsAll.forEach(r => {
        const inExp = fullExpNoFilter.find(x => x.id === r.id);
        const statusOk = inExp && inExp.current_status === r.current_status;
        const qcOk = inExp && JSON.stringify(inExp.qc_review_required) === JSON.stringify(r.qc_review_required);
        const issuesOk = inExp && (inExp.boundary_issues ? inExp.boundary_issues.length : 0)
          === (r.boundary_issues ? r.boundary_issues.length : 0);
        console.log(`   未过滤导出核对 ${r.id}: status${statusOk?'✅':'❌'}  qc_review${qcOk?'✅':'❌'}  boundary${issuesOk?'✅':'❌'}`);
      });
      console.log('');
    } else {
      const fullCsvNoFilter = dataStore.getExportData('csv');
      boundaryRecsAll.forEach(r => {
        const foundInCsv = fullCsvNoFilter.includes(r.id);
        console.log(`   未过滤CSV中存在 ${r.id}: ${foundInCsv ? '✅' : '❌ 丢失！'}`);
      });
      console.log('');
    }
  }

  if (outputPath) {
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const writeData = format === 'csv' ? '\uFEFF' + data : data;
    fs.writeFileSync(outputPath, writeData);
    console.log(`✅ 已导出到文件: ${outputPath}`);
    const size = fs.statSync(outputPath).size;
    console.log(`   文件大小: ${size} 字节`);
  } else {
    if (format === 'json') {
      console.log('📋 数据预览 (前 3 条):');
      const jsonData = JSON.parse(data);
      jsonData.slice(0, 3).forEach((r, i) => {
        console.log(`  [${i}] ${r.id} | ${r.sensor_id} | status=${r.current_status} | qc=${r.qc_review_required} | superseded_by=${r.superseded_by || '—'} | boundary_issues=[${(r.boundary_issues||[]).map(x=>x.issueType).join(',')}]`);
      });
    } else {
      const lines = data.split('\n');
      console.log('📋 数据预览 (表头 + 前 2 条):');
      lines.slice(0, 3).forEach(line => console.log('   ' + line));
    }
    console.log('');
    console.log('使用 --output=<路径> 保存到文件');
  }
  console.log('');

  console.log('💡 常用命令:');
  console.log('   npm run export -- --format=csv --output=out/all.csv                ← 全部');
  console.log('   npm run export -- --format=csv --needs-qc-review=true --output=out/needs-qc.csv   ← 只导需要QC复核的（采样缺半小时等）');
  console.log('   npm run export -- --format=json --has-boundary-issues=true         ← 只导含边界问题的');
  console.log('   npm run export -- --format=csv --record-id=REC-002 --output=out/REC-002.csv  ← 追一条记录');
  console.log('   npm run export -- --format=csv --status=SUPERSEDED                 ← 查被返工替代的旧结论');
  console.log('');

} catch (e) {
  console.log(`❌ 导出失败: ${e.message}`);
  console.log(e.stack);
  process.exit(1);
}
