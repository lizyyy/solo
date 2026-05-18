const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const cliPath = path.join(__dirname, '..', 'src', 'cli.js');

function runCommand(command, description) {
  console.log(`\n=== ${description} ===`);
  console.log(`执行: ${command}`);
  try {
    const output = execSync(command, { encoding: 'utf8' });
    console.log(output);
    return { success: true, output };
  } catch (error) {
    console.error('错误:', error.message);
    return { success: false, error: error.message };
  }
}

console.log('═══════════════════════════════════════════════════════════');
console.log('  户外研学机构研学保险名单 CLI - 功能测试');
console.log('═══════════════════════════════════════════════════════════');

runCommand(`node ${cliPath} --help`, '查看帮助信息');

runCommand(
  `node ${cliPath} --input ${dataDir}/sample-input.json --summary`,
  '测试1: 加载数据并显示汇总报告'
);

runCommand(
  `node ${cliPath} --input ${dataDir}/sample-input.json --validate-id`,
  '测试2: 验证身份证号'
);

runCommand(
  `node ${cliPath} --input ${dataDir}/sample-input.json --validate-id -v`,
  '测试3: 详细模式验证身份证号'
);

runCommand(
  `node ${cliPath} --input ${dataDir}/sample-input.json --change-team HWYX-20240501-001:TEAM-B:雪豹队 --output ${dataDir}/output-team-changed.json --summary`,
  '测试4: 改队操作'
);

runCommand(
  `node ${cliPath} --input ${dataDir}/sample-input.json --withdraw HWYX-20240501-005 --output ${dataDir}/output-withdrawn.json --summary`,
  '测试5: 退团操作'
);

runCommand(
  `node ${cliPath} --input ${dataDir}/sample-input.json --correct-idcard HWYX-20240501-002:610103199902022345 --output ${dataDir}/output-idcorrected.json --summary`,
  '测试6: 修正身份证号（15位升18位）'
);

runCommand(
  `node ${cliPath} --input ${dataDir}/sample-input.json --update-insurance HWYX-20240501-006:投保成功 --output ${dataDir}/output-insurance.json --summary`,
  '测试7: 更新保险状态'
);

console.log('\n=== 测试8: 复合操作 + 审计日志 ===');
const auditPath = `${dataDir}/audit-log.json`;
runCommand(
  `node ${cliPath} --input ${dataDir}/sample-input.json ` +
  `--change-team HWYX-20240501-002:TEAM-B:雪豹队 ` +
  `--withdraw HWYX-20240501-006 ` +
  `--correct-idcard HWYX-20240501-002:610103199902022345 ` +
  `--update-insurance HWYX-20240501-001:投保成功 ` +
  `--output ${dataDir}/output-combined.json ` +
  `--audit ${auditPath} ` +
  `--summary -v`,
  '复合操作（改队+退团+修正身份证+更新保险）+ 详细审计日志'
);

if (fs.existsSync(auditPath)) {
  console.log('\n=== 审计日志内容预览 ===');
  const auditLog = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  console.log(`共 ${auditLog.length} 条审计记录`);
}

console.log('\n=== 测试9: diff 友好输出测试 ===');
const output1 = `${dataDir}/output-v1.json`;
const output2 = `${dataDir}/output-v2.json`;

runCommand(
  `node ${cliPath} --input ${dataDir}/sample-input.json --output ${output1}`,
  '生成基准版本'
);

runCommand(
  `node ${cliPath} --input ${dataDir}/sample-input.json --change-team HWYX-20240501-003:TEAM-A:雄鹰队 --output ${output2}`,
  '生成变更版本'
);

console.log('\n文件均按稳定列顺序输出，可直接使用 diff 对比');

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  测试完成！请检查 data 目录下的输出文件');
console.log('═══════════════════════════════════════════════════════════');
