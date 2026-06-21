/**
 * 生成导出报告文件用于验证
 * 运行方式：npx tsx scripts/generate-export-files.ts
 */

import { levels } from '../src/data/levels';
import { conflictingImportData } from '../src/data/importData';
import { GameEngine } from '../src/utils/gameEngine';
import { DataValidator } from '../src/utils/dataValidator';
import { ReportExporter } from '../src/utils/reportExporter';
import * as fs from 'fs';
import * as path from 'path';

const level = levels[0];
const playerName = '质检阿蓝';

console.log('生成导出报告文件...\n');

// 检测冲突
const detectedConflicts = DataValidator.detectConflicts(level, conflictingImportData);
console.log(`检测到 ${detectedConflicts.length} 个冲突`);

// 模拟用户解决冲突
const resolutions: Array<'use_imported' | 'use_preset'> = ['use_imported', 'use_preset', 'use_imported'];
const resolvedConflicts = detectedConflicts.map((c, i) => ({
  ...c,
  resolved: true as const,
  resolution: resolutions[i],
}));
console.log('用户已解决所有冲突\n');

// 计算补录差异报告
const emptyValueReports = DataValidator.checkEmptyValues(conflictingImportData.data);
const dataValues = Object.values(conflictingImportData.data);
const duplicateReports = DataValidator.checkDuplicates(dataValues);
const boundaryReports = DataValidator.checkBoundaryCases(level);

// 创建游戏状态
let gameState = GameEngine.startGame(level.id, conflictingImportData);
gameState = {
  ...gameState,
  conflicts: resolvedConflicts,
  emptyValueReports,
  duplicateReports,
  boundaryReports,
};

// 模拟完成游戏（全部正确）
const correctChoices = ['ch-1-a', 'ch-2-b', 'ch-3-a'];
correctChoices.forEach(choiceId => {
  gameState = GameEngine.makeChoice(gameState, choiceId, level);
});
console.log(`游戏完成，得分: ${gameState.score}/${gameState.maxScore}\n`);

// 生成报告
const report = ReportExporter.generateReport(gameState, level, playerName);

// 确保输出目录存在
const outputDir = path.join(process.cwd(), 'exported-reports');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 导出 TXT
const txtContent = ReportExporter.exportAsText(report);
const txtPath = path.join(outputDir, `地铁客流解谜局报告-${playerName}-${Date.now()}.txt`);
fs.writeFileSync(txtPath, txtContent, 'utf-8');
console.log(`✅ TXT 报告已生成: ${txtPath}`);

// 导出 JSON
const jsonContent = ReportExporter.exportAsJSON(report);
const jsonPath = path.join(outputDir, `地铁客流解谜局报告-${playerName}-${Date.now()}.json`);
fs.writeFileSync(jsonPath, jsonContent, 'utf-8');
console.log(`✅ JSON 报告已生成: ${jsonPath}\n`);

// 验证报告内容
console.log('='.repeat(60));
console.log('📊 报告内容核对');
console.log('='.repeat(60));

console.log(`\n✅ 冲突解决记录: ${report.conflictResolutions.length} 条`);
report.conflictResolutions.forEach((cr, i) => {
  console.log(`\n   ${i + 1}. ${cr.field}`);
  console.log(`      预设值: ${cr.presetValue}`);
  console.log(`      导入值: ${cr.importedValue}`);
  console.log(`      最终选择: ${cr.resolution === 'use_imported' ? '导入值' : '预设值'}`);
  console.log(`      生效值: ${cr.effectiveValue}`);
  console.log(`      差异原因: ${cr.reason}`);
});

console.log(`\n✅ 边界情况报告: ${report.boundaryReports.length} 条`);
console.log(`✅ 空值补录报告: ${report.emptyValueReports.length} 条`);
console.log(`✅ 重复项检测报告: ${report.duplicateReports.length} 条`);

console.log(`\n✅ 结算统计:`);
console.log(`   玩家: ${report.playerName}`);
console.log(`   得分: ${report.finalScore}/${report.maxScore}`);
console.log(`   正确率: ${((report.correctCount / report.totalRounds) * 100).toFixed(1)}%`);

// 关键数据一致性检查
console.log(`\n` + '='.repeat(60));
console.log('🔍 关键一致性检查');
console.log('='.repeat(60));

const checks = [
  {
    name: '冲突数量一致',
    check: report.conflictResolutions.length === 3,
    expected: 3,
    actual: report.conflictResolutions.length,
  },
  {
    name: '冲突1选择正确（导入值）',
    check: report.conflictResolutions[0]?.resolution === 'use_imported',
    expected: 'use_imported',
    actual: report.conflictResolutions[0]?.resolution,
  },
  {
    name: '冲突1生效值正确（2900）',
    check: report.conflictResolutions[0]?.effectiveValue === 2900,
    expected: 2900,
    actual: report.conflictResolutions[0]?.effectiveValue,
  },
  {
    name: '冲突2选择正确（预设值）',
    check: report.conflictResolutions[1]?.resolution === 'use_preset',
    expected: 'use_preset',
    actual: report.conflictResolutions[1]?.resolution,
  },
  {
    name: '冲突2生效值正确（2100）',
    check: report.conflictResolutions[1]?.effectiveValue === 2100,
    expected: 2100,
    actual: report.conflictResolutions[1]?.effectiveValue,
  },
  {
    name: '冲突3选择正确（导入值）',
    check: report.conflictResolutions[2]?.resolution === 'use_imported',
    expected: 'use_imported',
    actual: report.conflictResolutions[2]?.resolution,
  },
  {
    name: '冲突3生效值正确（2950）',
    check: report.conflictResolutions[2]?.effectiveValue === 2950,
    expected: 2950,
    actual: report.conflictResolutions[2]?.effectiveValue,
  },
  {
    name: '边界情况数量正确',
    check: report.boundaryReports.length === 5,
    expected: 5,
    actual: report.boundaryReports.length,
  },
  {
    name: '得分正确（100分）',
    check: report.finalScore === 100,
    expected: 100,
    actual: report.finalScore,
  },
  {
    name: 'TXT包含冲突解决记录',
    check: txtContent.includes('数据冲突解决记录'),
    expected: true,
    actual: txtContent.includes('数据冲突解决记录'),
  },
  {
    name: 'TXT包含差异原因',
    check: txtContent.includes('差异原因：'),
    expected: true,
    actual: txtContent.includes('差异原因：'),
  },
  {
    name: 'JSON包含完整冲突数据',
    check: JSON.parse(jsonContent).conflictResolutions.length === 3,
    expected: 3,
    actual: JSON.parse(jsonContent).conflictResolutions.length,
  },
];

let allPassed = true;
checks.forEach(item => {
  const status = item.check ? '✅' : '❌';
  console.log(`   ${status} ${item.name}`);
  if (!item.check) {
    console.log(`      期望: ${item.expected}, 实际: ${item.actual}`);
    allPassed = false;
  }
});

console.log(`\n` + '='.repeat(60));
if (allPassed) {
  console.log('🎉 所有检查通过！报告内容与页面完全一致');
} else {
  console.log('⚠️  部分检查未通过，请查看详细信息');
}
console.log('='.repeat(60));

console.log(`\n📁 导出文件位置:`);
console.log(`   TXT: ${txtPath}`);
console.log(`   JSON: ${jsonPath}`);
console.log(`\n📝 请打开上述文件，人工核对以下内容：`);
console.log(`   1. 3条冲突记录的数量、选择、值是否与页面一致`);
console.log(`   2. 差异原因说明是否完整`);
console.log(`   3. 结算统计（得分、正确率）是否与页面一致`);
