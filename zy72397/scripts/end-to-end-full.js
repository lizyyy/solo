#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const runtimeFile = path.join(projectRoot, 'data/runtime.json');

function run(cmd, label) {
  console.log('\n' + '='.repeat(72));
  console.log(`🔹 ${label}`);
  console.log('='.repeat(72));
  console.log(`   $ ${cmd}`);
  console.log('-'.repeat(72));
  try {
    const output = execSync(cmd, { cwd: projectRoot, encoding: 'utf8', timeout: 15000 });
    console.log(output.split('\n').slice(0, 30).join('\n'));
    if (output.split('\n').length > 30) console.log('   ... (truncated) ...');
    return { ok: true, output };
  } catch (e) {
    console.log(e.stdout ? e.stdout.split('\n').slice(0, 20).join('\n') : e.message);
    return { ok: false, error: e.message };
  }
}

let passed = 0, failed = 0;
function check(label, condition, detail) {
  if (condition) {
    passed++;
    console.log(`   ✅ ${label}${detail ? ' — ' + detail : ''}`);
  } else {
    failed++;
    console.log(`   ❌ ${label}${detail ? ' — ' + detail : ''}`);
  }
}

console.log('');
console.log('🚀🚀🚀  端到端全链路验证  🚀🚀🚀');
console.log('');
console.log('目标: 证明离开演示进程后，何工仍能按回放结果把 REC-002 恢复并导出');
console.log('验证: prepare-demo → replay(独立) → rollback(独立) → export(独立) → 数据文件一致');
console.log('');

// 清理
console.log('🧹 清理旧数据...');
if (fs.existsSync(runtimeFile)) fs.unlinkSync(runtimeFile);
console.log('   runtime.json 已删除');
console.log('');

// Step 1: prepare-demo
const r1 = run('npm run prepare-demo 2>&1', 'Step 1: prepare-demo 构建完整场景（持久化到文件）');
const hasRuntimeAfterPrepare = fs.existsSync(runtimeFile);
const fileSizeAfterPrepare = hasRuntimeAfterPrepare ? fs.statSync(runtimeFile).size : 0;
check('runtime.json 文件存在', hasRuntimeAfterPrepare, `大小=${fileSizeAfterPrepare} 字节`);
check('prepare-demo 退出码 0', r1.ok);
check('输出包含 REC-002', r1.ok && r1.output.includes('REC-002'));
check('输出包含 SUPERSEDED', r1.ok && r1.output.includes('SUPERSEDED'));
check('输出包含 superseded_by', r1.ok && r1.output.includes('superseded_by'));

// Step 2: replay (独立进程)
const r2 = run('npm run replay -- --record-id=REC-002 2>&1', 'Step 2: 独立进程审计重放 REC-002');
check('replay 退出码 0', r2.ok);
check('replay 输出显示数据文件路径', r2.ok && r2.output.includes('runtime.json'));
check('replay 输出显示已加载记录数', r2.ok && r2.output.includes('已加载:'));
check('replay 输出含 IMPORTED → NEED_QC_REVIEW 状态流转', r2.ok && r2.output.includes('IMPORTED') && r2.output.includes('NEED_QC_REVIEW'));
check('replay 输出含边界问题明细（采样间隔 + 采样时长）', r2.ok && r2.output.includes('SAMPLING_GAP_EXCEEDED') && r2.output.includes('SAMPLING_DURATION_TOO_SHORT'));
check('replay 输出含 SUPERSEDED 状态', r2.ok && r2.output.includes('SUPERSEDED'));
check('replay 末尾给出实际可用的回滚命令（不是不存在的脚本）', r2.ok && r2.output.includes('npm run rollback'));

// Step 3: rollback (独立进程)
const r3 = run('npm run rollback -- --record-id=REC-002 --version=1 --operator=E2E-Test-User 2>&1', 'Step 3: 独立进程回滚 REC-002 到 NEED_QC_REVIEW（索引1）');
check('rollback 退出码 0', r3.ok);
check('rollback 后状态 = NEED_QC_REVIEW', r3.ok && r3.output.includes('NEED_QC_REVIEW'));
check('rollback 后 qc_review_required = true（派生同步）', r3.ok && r3.output.includes('qc_review_required:true'));
check('rollback 后 boundary_issues 保留（采样缺半小时证据）', r3.ok && r3.output.includes('SAMPLING_GAP_EXCEEDED') && r3.output.includes('SAMPLING_DURATION_TOO_SHORT'));
check('rollback 后三方一致性自检通过', r3.ok && r3.output.includes('verifyConsistency') && r3.output.includes('通过'));
check('rollback 后 API 与导出一致', r3.ok && r3.output.match(/API=.*EXPORT.*✅/g) ? true : false);
check('rollback 后数据已持久化', r3.ok && r3.output.includes('数据已持久化到'));

// Step 4: export (独立进程, 验证回滚结果)
const r4 = run('npm run export -- --record-id=REC-002 --format=json 2>&1', 'Step 4: 独立进程导出 REC-002（验证回滚后状态）');
check('export 退出码 0', r4.ok);
check('export 输出含 REC-002 状态=NEED_QC_REVIEW', r4.ok && r4.output.includes('status=NEED_QC_REVIEW'));
check('export 输出含 qc=true', r4.ok && r4.output.includes('qc=true'));
check('export 输出含 2 个边界问题', r4.ok && r4.output.match(/boundary_issues=\[.*,.*\]/) ? true : false);
check('export 输出未过滤视图核对通过', r4.ok && r4.output.includes('未过滤导出核对') && r4.output.includes('status✅'));

// Step 5: 验证 runtime.json 文件内容包含回滚后的状态
console.log('\n' + '='.repeat(72));
console.log('🔹 Step 5: 直接检查 runtime.json 文件内容');
console.log('='.repeat(72));
try {
  const raw = fs.readFileSync(runtimeFile, 'utf8');
  const data = JSON.parse(raw);
  const rec002 = (data.records || []).find(r => r.id === 'REC-002');
  check('runtime.json 含 records 数组', Array.isArray(data.records), `共 ${data.records ? data.records.length : 0} 条`);
  check('runtime.json 中 REC-002 存在', !!rec002);
  if (rec002) {
    check('runtime.json 中 REC-002.current_status = NEED_QC_REVIEW',
      rec002.current_status === 'NEED_QC_REVIEW', `值=${rec002.current_status}`);
    check('runtime.json 中 REC-002.qc_review_required = true',
      rec002.qc_review_required === true, `值=${rec002.qc_review_required}`);
    check('runtime.json 中 REC-002.boundary_issues 有 2 个',
      Array.isArray(rec002.boundary_issues) && rec002.boundary_issues.length === 2,
      `数=${rec002.boundary_issues ? rec002.boundary_issues.length : 0}`);
    check('runtime.json 中 REC-002.original_line_no = 2',
      rec002.original_line_no === 2, `值=${rec002.original_line_no}`);
    check('runtime.json 中 REC-002.status_history 至少 6 条（导入→边界→QC→终态→返工→回滚）',
      Array.isArray(rec002.status_history) && rec002.status_history.length >= 6,
      `数=${rec002.status_history ? rec002.status_history.length : 0}`);
  }
  check('runtime.json 含 schema_version', !!data.schema_version, data.schema_version);
  check('runtime.json 含 audit_log', Array.isArray(data.audit_log), `${data.audit_log ? data.audit_log.length : 0} 条`);
} catch (e) {
  check('runtime.json 可解析', false, e.message);
}

// Step 6: 备用样例重建（删了 runtime.json 再 import 也能跑）
console.log('\n' + '='.repeat(72));
console.log('🔹 Step 6: 备用样例入口验证 —— 删了 runtime.json 用 sample-sensors.json 重建');
console.log('='.repeat(72));
if (fs.existsSync(runtimeFile)) fs.unlinkSync(runtimeFile);
const r6 = run('npm run import 2>&1', 'Step 6a: npm run import 从 sample-sensors.json 导入');
check('import 退出码 0', r6.ok);
check('import 输出含 BATCH-001', r6.ok && r6.output.includes('BATCH-001'));
check('import 输出检测到边界问题', r6.ok && r6.output.includes('边界问题'));
check('import 数据已持久化', r6.ok && r6.output.includes('数据已持久化到'));
const hasAfterImport = fs.existsSync(runtimeFile);
check('runtime.json 重建成功', hasAfterImport);

const r7 = run('npm run replay -- --record-id=REC-002 2>&1', 'Step 6b: 独立 replay 验证重建后的数据');
check('重建后 replay 能读到 REC-002', r7.ok && r7.output.includes('REC-002'));
check('重建后 replay 显示 IMPORTED', r7.ok && r7.output.includes('IMPORTED'));
check('重建后 replay 显示 NEED_QC_REVIEW', r7.ok && r7.output.includes('NEED_QC_REVIEW'));

// Summary
console.log('\n' + '='.repeat(72));
console.log(`🏁 端到端验证汇总: ${passed} 通过 / ${failed} 失败 / ${passed + failed} 总计`);
console.log('='.repeat(72));
console.log('');
console.log('✅ 验证了以下核心能力:');
console.log('   1. prepare-demo 能把完整返工场景持久化到 runtime.json');
console.log('   2. 独立进程 replay 能读到同一份数据（离开演示进程也能追溯）');
console.log('   3. 独立进程 rollback 能回滚并同步所有派生字段');
console.log('   4. 独立进程 export 能读到回滚后的结果（三方一致）');
console.log('   5. runtime.json 文件本身包含所有证据链（可直接查看/备份）');
console.log('   6. 备用样例入口 sample-sensors.json 可随时重建，不依赖已删除材料');
console.log('   7. 审计重放里给出的回滚入口是实际可用的 npm run rollback 命令');
console.log('');
console.log('📂 持久化文件位置: data/runtime.json');
console.log('🔧 所有命令都基于此文件共享同一份证据链');
console.log('');

process.exit(failed > 0 ? 1 : 0);
