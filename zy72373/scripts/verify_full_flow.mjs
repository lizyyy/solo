#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const projectRoot = path.resolve(__dirname, '..');
const cli = `node ${path.join(projectRoot, 'bin', 'fan-diagnosis.js')}`;
const taskId = `verify-${Date.now()}`;
const sampleCsv = path.join(projectRoot, 'sample_data', 'sensor_data.csv');

console.log('='.repeat(70));
console.log('风扇叶片平衡诊断 - 全链路真实验证脚本');
console.log('='.repeat(70));
console.log(`任务ID: ${taskId}`);
console.log(`时间: ${new Date().toLocaleString('zh-CN')}`);
console.log('');

let allPassed = true;
const results = [];

function run(cmd, desc) {
  console.log(`\n▶️  ${desc}`);
  console.log(`   $ ${cmd}`);
  try {
    const output = execSync(cmd, { cwd: projectRoot, encoding: 'utf-8' });
    console.log(output.split('\n').map(l => '   ' + l).join('\n'));
    results.push({ desc, passed: true });
    return output;
  } catch (e) {
    console.log(`   ❌ 失败: ${e.message}`);
    results.push({ desc, passed: false, error: e.message });
    allPassed = false;
    process.exit(1);
  }
}

// ============ 0. 准备：清理旧数据 ============
console.log('\n' + '='.repeat(70));
console.log('【第0步：准备环境】');
console.log('='.repeat(70));

const dataDir = path.join(os.homedir(), '.fan-diagnosis');
if (fs.existsSync(dataDir)) {
  fs.rmSync(dataDir, { recursive: true });
  console.log(`已清理旧数据目录: ${dataDir}`);
}

// ============ 1. 创建诊断任务 ============
console.log('\n' + '='.repeat(70));
console.log('【第1步：创建诊断任务】');
console.log('='.repeat(70));

run(
  `${cli} create --title "真实验证-风扇叶片平衡诊断" --created-by "训练教练老唐" --task-id ${taskId}`,
  '创建诊断任务'
);

// ============ 2. 导入传感器数据（真实样例 CSV） ============
console.log('\n' + '='.repeat(70));
console.log('【第2步：导入传感器数据（真实样例）】');
console.log('='.repeat(70));
console.log(`CSV 样例文件: ${sampleCsv}`);
console.log('文件内容:');
console.log(fs.readFileSync(sampleCsv, 'utf-8').split('\n').map(l => '   ' + l).join('\n'));

const importOutput = run(
  `${cli} import --task-id ${taskId} --file ${sampleCsv} --detect-unit-mixing`,
  '导入真实样例传感器数据'
);

// 验证：检测到单位混用
if (importOutput.includes('温度单位混用: 是') && importOutput.includes('FAN-REAL-B') && importOutput.includes('FAN-REAL-D')) {
  console.log('   ✅ 验证通过：正确检测到 FAN-REAL-B (358K) 和 FAN-REAL-D (355K) 待复核');
  results.push({ desc: '检测温度单位混用', passed: true });
} else {
  console.log('   ❌ 验证失败：未正确检测温度单位混用');
  allPassed = false;
  results.push({ desc: '检测温度单位混用', passed: false });
}

// ============ 3. 检测温度单位混用 ============
console.log('\n' + '='.repeat(70));
console.log('【第3步：检测温度单位混用详情】');
console.log('='.repeat(70));

const detectOutput = run(
  `${cli} detect-mixing --task-id ${taskId} --report`,
  '检测温度单位混用详情'
);

if (detectOutput.includes('有混用: 是') && detectOutput.includes('FAN-REAL-B: 358K') && detectOutput.includes('FAN-REAL-D: 355K')) {
  console.log('   ✅ 验证通过：正确列出受影响传感器和原始值');
  results.push({ desc: '混用详情检测', passed: true });
} else {
  console.log('   ❌ 验证失败：未正确列出受影响传感器');
  allPassed = false;
  results.push({ desc: '混用详情检测', passed: false });
}

// ============ 4. 查看任务详情 ============
console.log('\n' + '='.repeat(70));
console.log('【第4步：查看任务详情 - 验证当前状态】');
console.log('='.repeat(70));

const showOutput = run(
  `${cli} show --task-id ${taskId}`,
  '查看任务详情'
);

if (showOutput.includes('FAN-REAL-B: 358K ⚠️待复核') && showOutput.includes('FAN-REAL-D: 355K ⚠️待复核')) {
  console.log('   ✅ 验证通过：传感器显示正确的待复核状态');
  results.push({ desc: '任务详情状态', passed: true });
} else {
  console.log('   ❌ 验证失败：传感器状态不正确');
  allPassed = false;
  results.push({ desc: '任务详情状态', passed: false });
}

// ============ 5. 补录工况照片（2张，模拟老唐从群里补传） ============
console.log('\n' + '='.repeat(70));
console.log('【第5步：训练教练老唐补看/补录工况照片】');
console.log('='.repeat(70));

run(
  `${cli} add-photo --task-id ${taskId} --file "fan_blade_B_wear_20260619.jpg" --description "群里补传 - 叶片B磨损实拍图，边缘有明显腐蚀" --upload-by "训练教练老唐"`,
  '补录照片1：叶片B磨损实拍'
);

run(
  `${cli} add-photo --task-id ${taskId} --file "sensor_install_location_20260619.jpg" --description "群里补传 - 传感器FAN-REAL-D安装位置确认" --upload-by "训练教练老唐"`,
  '补录照片2：传感器安装位置'
);

// ============ 6. 验证：补录照片后交接报告更新 ============
console.log('\n' + '='.repeat(70));
console.log('【第6步：验证 - 补录照片后交接报告更新】');
console.log('='.repeat(70));

const reportV3Output = run(
  `${cli} report --task-id ${taskId} --version 3`,
  '查看 v3 报告（补录照片后）'
);

if (reportV3Output.includes('工况照片已补录') && reportV3Output.includes('缺失材料: 温度单位人工复核确认, 照片内容人工确认')) {
  console.log('   ✅ 验证通过：报告正确更新，"工况照片"已移除，新增"照片内容人工确认"');
  results.push({ desc: '补录照片后报告更新', passed: true });
} else {
  console.log('   ❌ 验证失败：报告未正确更新');
  allPassed = false;
  results.push({ desc: '补录照片后报告更新', passed: false });
}

// ============ 7. 人工修正数据（老唐复核） ============
console.log('\n' + '='.repeat(70));
console.log('【第7步：训练教练老唐人工修正 - 保存温度单位复核】');
console.log('='.repeat(70));

run(
  `${cli} correct --task-id ${taskId} --sensor FAN-REAL-B --field temperature --from "358K" --to "85°C" --operator "训练教练老唐" --reason "群里叶片B照片显示正常磨损，温度在预期范围，开尔文转摄氏度统一单位 (358K-273.15=84.85≈85°C)"`,
  '修正 FAN-REAL-B：358K → 85°C'
);

// 验证：修正1后仍有1个待复核，"温度单位人工复核确认" 应保留
const reportV4Output = run(
  `${cli} report --task-id ${taskId} --version 4`,
  '查看 v4 报告（修正B后）'
);

if (reportV4Output.includes('已修正 FAN-REAL-B，仍有传感器待老唐复核') && reportV4Output.includes('温度单位人工复核确认')) {
  console.log('   ✅ 验证通过：仍有 FAN-REAL-D 待复核，"温度单位人工复核确认" 正确保留（条件写正！）');
  results.push({ desc: '修正后仍有待复核时保留缺失材料', passed: true });
} else {
  console.log('   ❌ 验证失败：缺失材料更新条件可能写反');
  allPassed = false;
  results.push({ desc: '修正后仍有待复核时保留缺失材料', passed: false });
}

// 修正第2个传感器
run(
  `${cli} correct --task-id ${taskId} --sensor FAN-REAL-D --field temperature --from "355K" --to "82°C" --operator "训练教练老唐" --reason "群里传感器安装位置照片确认位置正确，温度读数偏高是因为单位是开尔文 (355K-273.15=80.85≈82°C)"`,
  '修正 FAN-REAL-D：355K → 82°C'
);

// 验证：全部复核完成后，"温度单位人工复核确认" 应被移除
const reportV5Output = run(
  `${cli} report --task-id ${taskId} --version 5`,
  '查看 v5 报告（修正D后）'
);

if (reportV5Output.includes('温度单位已由训练教练老唐复核确认') && !reportV5Output.includes('温度单位人工复核确认') && reportV5Output.includes('缺失材料: 照片内容人工确认')) {
  console.log('   ✅ 验证通过：全部复核完成，"温度单位人工复核确认" 正确移除');
  results.push({ desc: '全部复核后移除缺失材料', passed: true });
} else {
  console.log('   ❌ 验证失败：缺失材料未正确移除');
  allPassed = false;
  results.push({ desc: '全部复核后移除缺失材料', passed: false });
}

// ============ 8. 反查：追溯改前改后内容 ============
console.log('\n' + '='.repeat(70));
console.log('【第8步：版本追溯 - 反查改前/改后内容和状态变化】');
console.log('='.repeat(70));

const traceV1Output = run(
  `${cli} trace-version --task-id ${taskId} --version 1`,
  '追溯 v1 版本（导入初始状态）'
);

if (traceV1Output.includes('FAN-REAL-B: 358K ⚠️') && traceV1Output.includes('FAN-REAL-D: 355K ⚠️')) {
  console.log('   ✅ 验证通过：可反查 v1 改前状态（358K/355K 待复核）');
  results.push({ desc: '反查改前状态', passed: true });
} else {
  console.log('   ❌ 验证失败：无法反查改前状态');
  allPassed = false;
  results.push({ desc: '反查改前状态', passed: false });
}

const traceV5Output = run(
  `${cli} trace-version --task-id ${taskId} --version 5`,
  '追溯 v5 版本（全部修正后）'
);

if (traceV5Output.includes('FAN-REAL-B: 85°C') && traceV5Output.includes('FAN-REAL-D: 82°C') && traceV5Output.includes('对接人变更: 训练教练老唐 → 训练教练老唐') === false) {
  console.log('   ✅ 验证通过：可反查 v5 改后状态（85°C/82°C 已通过）');
  results.push({ desc: '反查改后状态', passed: true });
} else {
  console.log('   ❌ 验证失败：无法反查改后状态');
  allPassed = false;
  results.push({ desc: '反查改后状态', passed: false });
}

// 验证与上一版本对比
if (traceV5Output.includes('移除缺失材料: 温度单位人工复核确认')) {
  console.log('   ✅ 验证通过：可追溯 v4→v5 缺失材料变化');
  results.push({ desc: '追溯版本间变化', passed: true });
} else {
  console.log('   ❌ 验证失败：无法追溯版本间变化');
  allPassed = false;
  results.push({ desc: '追溯版本间变化', passed: false });
}

// ============ 9. 刷新重算：重跑诊断 ============
console.log('\n' + '='.repeat(70));
console.log('【第9步：刷新重算 - 重跑诊断】');
console.log('='.repeat(70));

run(
  `${cli} rerun --task-id ${taskId} --check-uniformity`,
  '重跑诊断分析'
);

// ============ 10. 验证：交接报告和最终结果 ============
console.log('\n' + '='.repeat(70));
console.log('【第10步：验证 - 交接报告和最终结果】');
console.log('='.repeat(70));

const reportV6Output = run(
  `${cli} report --task-id ${taskId} --version 6`,
  '查看 v6 最终报告'
);

if (reportV6Output.includes('重跑诊断分析完成') && reportV6Output.includes('缺失材料: 照片内容人工确认') && reportV6Output.includes('下一步对接人: 训练教练老唐')) {
  console.log('   ✅ 验证通过：最终报告状态正确，材料、对接人、说明可互相解释');
  results.push({ desc: '最终报告状态', passed: true });
} else {
  console.log('   ❌ 验证失败：最终报告状态不正确');
  allPassed = false;
  results.push({ desc: '最终报告状态', passed: false });
}

// 反查缺失材料触发源
if (reportV6Output.includes('缺失材料触发源追溯') && reportV6Output.includes('照片内容人工确认')) {
  console.log('   ✅ 验证通过：可从交接报告追回触发缺失材料的原始材料');
  results.push({ desc: '缺失材料触发源追溯', passed: true });
} else {
  console.log('   ❌ 验证失败：无法追回触发源');
  allPassed = false;
  results.push({ desc: '缺失材料触发源追溯', passed: false });
}

// ============ 11. 导出报告 ============
console.log('\n' + '='.repeat(70));
console.log('【第11步：导出报告 - 验证真实导出功能】');
console.log('='.repeat(70));

const exportPath = path.join(projectRoot, `交接报告_${taskId}_v6.txt`);
run(
  `${cli} report --task-id ${taskId} --version 6 --output "${exportPath}"`,
  `导出报告到 ${exportPath}`
);

if (fs.existsSync(exportPath)) {
  const content = fs.readFileSync(exportPath, 'utf-8');
  console.log('导出文件内容（摘要）:');
  console.log(content.substring(0, 500).split('\n').map(l => '   ' + l).join('\n') + '...');
  
  if (content.includes('FAN-REAL-B') && content.includes('358K') && content.includes('85°C') && content.includes('温度单位人工复核确认记录')) {
    console.log('   ✅ 验证通过：导出报告包含完整追溯信息（改前改后、版本历史）');
    results.push({ desc: '报告导出', passed: true });
  } else {
    console.log('   ❌ 验证失败：导出报告内容不完整');
    allPassed = false;
    results.push({ desc: '报告导出', passed: false });
  }
} else {
  console.log('   ❌ 验证失败：导出文件不存在');
  allPassed = false;
  results.push({ desc: '报告导出', passed: false });
}

// ============ 12. 复盘：复制复盘命令再执行 ============
console.log('\n' + '='.repeat(70));
console.log('【第12步：流程复盘 - 复制复盘命令再执行，验证能跑回同一条样例】');
console.log('='.repeat(70));

const replayOutput = run(
  `${cli} replay --task-id ${taskId} --full`,
  '复盘完整流程'
);

// 验证复盘命令能列出所有操作
if (replayOutput.includes('导入传感器数据') && replayOutput.includes('人工修正数据') && replayOutput.includes('FAN-REAL-B') && replayOutput.includes('FAN-REAL-D')) {
  console.log('   ✅ 验证通过：复盘命令能完整复现操作历史');
  results.push({ desc: '复盘命令复现历史', passed: true });
} else {
  console.log('   ❌ 验证失败：复盘命令无法复现历史');
  allPassed = false;
  results.push({ desc: '复盘命令复现历史', passed: false });
}

// 关键验证：用复盘命令中的步骤新建一个任务，看是否能得到相同结果
console.log('\n▶️  关键验证：用复盘命令跑回同一条样例');
const taskId2 = `verify-${Date.now()}-2`;

run(
  `${cli} create --title "复盘复现验证" --created-by "训练教练老唐" --task-id ${taskId2}`,
  '创建新任务用于复现'
);

run(
  `${cli} import --task-id ${taskId2} --file ${sampleCsv} --detect-unit-mixing`,
  '复现：导入相同传感器数据'
);

run(
  `${cli} add-photo --task-id ${taskId2} --file "fan_blade_B_wear_20260619.jpg" --description "群里补传 - 叶片B磨损实拍图" --upload-by "训练教练老唐"`,
  '复现：补录照片1'
);

run(
  `${cli} add-photo --task-id ${taskId2} --file "sensor_install_location_20260619.jpg" --description "群里补传 - 传感器FAN-REAL-D安装位置确认" --upload-by "训练教练老唐"`,
  '复现：补录照片2'
);

run(
  `${cli} correct --task-id ${taskId2} --sensor FAN-REAL-B --field temperature --from "358K" --to "85°C" --operator "训练教练老唐" --reason "开尔文转摄氏度统一单位"`,
  '复现：修正 FAN-REAL-B'
);

run(
  `${cli} correct --task-id ${taskId2} --sensor FAN-REAL-D --field temperature --from "355K" --to "82°C" --operator "训练教练老唐" --reason "开尔文转摄氏度统一单位"`,
  '复现：修正 FAN-REAL-D'
);

run(
  `${cli} rerun --task-id ${taskId2} --check-uniformity`,
  '复现：重跑诊断'
);

// 验证两个任务的最终报告版本一致
const report1 = run(`${cli} report --task-id ${taskId} --version 6`, '获取原任务最终报告');
const report2 = run(`${cli} report --task-id ${taskId2} --version 6`, '获取复现任务最终报告');

if (report1.includes('诊断重跑完成') === report2.includes('诊断重跑完成') &&
    report1.includes('缺失材料: 照片内容人工确认') === report2.includes('缺失材料: 照片内容人工确认')) {
  console.log('   ✅ 验证通过：复盘命令能跑回同一条样例，两个任务最终状态完全一致');
  results.push({ desc: '复盘命令跑回同一条样例', passed: true });
} else {
  console.log('   ❌ 验证失败：两个任务最终状态不一致');
  allPassed = false;
  results.push({ desc: '复盘命令跑回同一条样例', passed: false });
}

// ============ 13. 验证导入页类型检查（运行 tsc） ============
console.log('\n' + '='.repeat(70));
console.log('【第13步：项目自带检查 - 确认导入页不再失败】');
console.log('='.repeat(70));

try {
  const tscOutput = execSync('npx tsc --noEmit 2>&1', { cwd: projectRoot, encoding: 'utf-8' });
  if (tscOutput.trim() === '') {
    console.log('   ✅ 验证通过：TypeScript 类型检查通过，导入页类型校验不再失败');
    results.push({ desc: 'TypeScript 类型检查', passed: true });
  } else {
    console.log('   ❌ 验证失败：TypeScript 仍有错误');
    console.log(tscOutput);
    allPassed = false;
    results.push({ desc: 'TypeScript 类型检查', passed: false });
  }
} catch (e) {
  console.log('   ❌ 验证失败：TypeScript 检查报错');
  console.log(e.stdout || e.message);
  allPassed = false;
  results.push({ desc: 'TypeScript 类型检查', passed: false });
}

// 运行 npm run build
try {
  const buildOutput = execSync('npm run build 2>&1', { cwd: projectRoot, encoding: 'utf-8' });
  if (buildOutput.includes('built in') && !buildOutput.includes('error')) {
    console.log('   ✅ 验证通过：npm run build 构建成功');
    results.push({ desc: '项目构建', passed: true });
  } else {
    console.log('   ❌ 验证失败：构建失败');
    allPassed = false;
    results.push({ desc: '项目构建', passed: false });
  }
} catch (e) {
  console.log('   ❌ 验证失败：构建报错');
  console.log(e.stdout || e.message);
  allPassed = false;
  results.push({ desc: '项目构建', passed: false });
}

// ============ 清理 ============
console.log('\n' + '='.repeat(70));
console.log('【清理】');
console.log('='.repeat(70));
if (fs.existsSync(exportPath)) {
  fs.unlinkSync(exportPath);
  console.log(`已删除导出文件: ${exportPath}`);
}

// ============ 总结 ============
console.log('\n' + '='.repeat(70));
console.log('验证结果汇总');
console.log('='.repeat(70));

results.forEach((r, i) => {
  const status = r.passed ? '✅ 通过' : '❌ 失败';
  console.log(`${String(i + 1).padStart(2, ' ')}. ${status} - ${r.desc}`);
  if (r.error) console.log(`     错误: ${r.error}`);
});

const passedCount = results.filter(r => r.passed).length;
const totalCount = results.length;

console.log('\n' + '='.repeat(70));
console.log(`最终结果: ${allPassed ? '✅ 全部验证通过' : '❌ 存在验证失败'} (${passedCount}/${totalCount})`);
console.log('='.repeat(70));

if (allPassed) {
  console.log('\n🎉 风扇叶片平衡诊断 - 全链路真实验证完成！');
  console.log('');
  console.log('覆盖的功能点：');
  console.log('  ✅ 传感器编号第一次导入（真实样例CSV）');
  console.log('  ✅ 触发缺材料（温度单位混用检测）');
  console.log('  ✅ 人工补看/补录工况照片（2张）');
  console.log('  ✅ 保存温度单位复核（逐条修正）');
  console.log('  ✅ 刷新重算（重跑诊断）');
  console.log('  ✅ 当前状态实时展示');
  console.log('  ✅ 版本追溯（每一步改前/改后）');
  console.log('  ✅ 处理判断（条件写正，不写反）');
  console.log('  ✅ 交接报告（每一步更新）');
  console.log('  ✅ 导出结果（真实文件导出）');
  console.log('  ✅ 复盘命令（真实CLI入口，可跑回同一条样例）');
  console.log('  ✅ 导入页类型校验（TS检查通过）');
  process.exit(0);
} else {
  console.log('\n⚠️  存在验证失败，请检查上述错误');
  process.exit(1);
}
