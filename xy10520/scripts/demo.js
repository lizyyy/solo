const { execSync } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const INSPECT_CMD = `node ${path.join(PROJECT_ROOT, 'src', 'index.js')}`;

function run(cmd) {
  console.log(`\n> ${cmd}`);
  console.log('='.repeat(70));
  try {
    const output = execSync(cmd, { 
      cwd: PROJECT_ROOT, 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    console.log(output);
    return output;
  } catch (e) {
    console.log(e.stdout || e.message);
    console.log('');
  }
}

console.log('\n' + '#'.repeat(70));
console.log('# 巡店问题整改 CLI - 完整演示');
console.log('#'.repeat(70));

console.log('\n' + '='.repeat(70));
console.log('【步骤 1】初始化系统');
console.log('='.repeat(70));
run(`${INSPECT_CMD} init --force`);

console.log('\n' + '='.repeat(70));
console.log('【步骤 2】导入门店信息');
console.log('='.repeat(70));
run(`${INSPECT_CMD} import stores data/stores.json --operator 系统管理员`);

console.log('\n' + '='.repeat(70));
console.log('【步骤 3】导入巡店记录');
console.log('='.repeat(70));
run(`${INSPECT_CMD} import inspections data/inspections.json --operator 系统管理员`);

console.log('\n' + '='.repeat(70));
console.log('【步骤 4】导入巡店问题（陈列、卫生、价格牌、安全隐患）');
console.log('='.repeat(70));
run(`${INSPECT_CMD} import issues data/issues.json --operator 系统管理员`);

console.log('\n' + '='.repeat(70));
console.log('【步骤 5】检查问题状态');
console.log('='.repeat(70));
run(`${INSPECT_CMD} check --verbose`);

console.log('\n' + '='.repeat(70));
console.log('【步骤 6】上海店提交整改（成功路径）');
console.log('='.repeat(70));
run(`${INSPECT_CMD} import corrections data/corrections-success.json --operator 李明`);

console.log('\n' + '='.repeat(70));
console.log('【步骤 7】检查状态变化');
console.log('='.repeat(70));
run(`${INSPECT_CMD} check`);

console.log('\n' + '='.repeat(70));
console.log('【步骤 8】北京店尝试提交整改 - 失败路径：整改照片缺失');
console.log('='.repeat(70));
run(`${INSPECT_CMD} import corrections data/corrections-fail-no-photo.json --operator 王芳`);

console.log('\n' + '='.repeat(70));
console.log('【步骤 9】北京店重新提交整改（补充照片）');
console.log('='.repeat(70));
run(`${INSPECT_CMD} import corrections data/corrections-issue-003.json --operator 王芳`);

console.log('\n' + '='.repeat(70));
console.log('【步骤 10】督导提交复查结果（2个通过，1个不通过）');
console.log('='.repeat(70));
run(`${INSPECT_CMD} import reinspections data/reinspections.json --operator 督导组`);

console.log('\n' + '='.repeat(70));
console.log('【步骤 11】检查最终状态');
console.log('='.repeat(70));
run(`${INSPECT_CMD} check`);

console.log('\n' + '='.repeat(70));
console.log('【步骤 12】查看问题详情（已闭环的陈列问题）');
console.log('='.repeat(70));
run(`${INSPECT_CMD} detail issue_001 --history`);

console.log('\n' + '='.repeat(70));
console.log('【步骤 13】查看问题详情（复查不通过的价格牌问题）');
console.log('='.repeat(70));
run(`${INSPECT_CMD} detail issue_003 --history`);

console.log('\n' + '='.repeat(70));
console.log('【步骤 14】查看问题详情（未整改的安全隐患问题）');
console.log('='.repeat(70));
run(`${INSPECT_CMD} detail issue_004`);

console.log('\n' + '='.repeat(70));
console.log('【步骤 15】生成月度报告 - 展示闭环、扣分、评分影响');
console.log('='.repeat(70));
run(`${INSPECT_CMD} report --month 2026-05`);

console.log('\n' + '='.repeat(70));
console.log('【步骤 16】演示幂等性 - 重复导入相同问题');
console.log('='.repeat(70));
run(`${INSPECT_CMD} import issues data/duplicate-issues.json --operator 系统管理员`);

console.log('\n' + '#'.repeat(70));
console.log('# 演示完成！');
console.log('#'.repeat(70));
console.log('\n业务结论：');
console.log('  - 已闭环：问题001（陈列）、问题002（卫生）');
console.log('  - 未闭环：问题003（价格牌 - 复查不通过）、问题004（安全隐患 - 未整改）');
console.log('  - 扣分原因：问题003 复查不通过，扣 1 分');
console.log('  - 门店评分：上海店 100 分（全部闭环），北京店 99 分（复查不通过扣 1 分）');
console.log('');
