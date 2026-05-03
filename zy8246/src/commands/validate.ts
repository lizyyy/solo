import * as path from 'path';
import { loadDataContext } from '../readers';
import { validateData, analyzeData } from '../analyzer';
import { Issue, IssueSeverity, DataContext } from '../types';

export function formatIssue(issue: Issue, index: number): string {
  const severityIcon = {
    [IssueSeverity.ERROR]: '❌',
    [IssueSeverity.WARNING]: '⚠️',
    [IssueSeverity.INFO]: 'ℹ️'
  };

  const lines: string[] = [];
  lines.push(`${severityIcon[issue.severity]} [${index + 1}] ${issue.title}`);
  lines.push(`   门店: ${issue.storeId}`);
  lines.push(`   描述: ${issue.description}`);
  lines.push(`   涉及实体: ${issue.affectedEntities.join(', ')}`);
  lines.push('');

  return lines.join('\n');
}

export function printSummary(errors: Issue[], warnings: Issue[], infos: Issue[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('验证结果摘要');
  console.log('='.repeat(60));
  console.log(`\n  ❌ 错误: ${errors.length} 个`);
  console.log(`  ⚠️  警告: ${warnings.length} 个`);
  console.log(`  ℹ️  信息: ${infos.length} 个`);

  if (errors.length > 0) {
    console.log(`\n  状态: ❌ 验证失败，存在 ${errors.length} 个严重问题需要处理`);
  } else if (warnings.length > 0) {
    console.log(`\n  状态: ⚠️  验证通过，但存在 ${warnings.length} 个警告需要关注`);
  } else {
    console.log(`\n  状态: ✅ 验证通过，所有检查项正常`);
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

export async function runValidate(dataDir: string, options: { verbose?: boolean }): Promise<number> {
  try {
    const resolvedDataDir = path.resolve(dataDir);
    console.log(`📂 正在从目录读取数据: ${resolvedDataDir}`);

    const context = loadDataContext(resolvedDataDir);

    console.log(`   ✅ 读取到 ${context.rooms.length} 条客房退房记录`);
    console.log(`   ✅ 读取到 ${context.linenTags.length} 条 RFID 标签记录`);
    console.log(`   ✅ 读取到 ${context.laundryBatches.length} 条送洗批次记录`);
    console.log(`   ✅ 读取到 ${context.vendorRules.length} 条供应商洗涤规则`);

    console.log('\n🔍 正在执行夜审复核检查...\n');

    const { issues, warnings, infos } = analyzeData(context);
    const result = validateData(context);

    const allIssues = [...issues, ...warnings, ...infos];

    if (allIssues.length > 0) {
      console.log('发现的问题详情:\n');

      if (issues.length > 0) {
        console.log('❌ 严重问题:');
        console.log('-'.repeat(60));
        issues.forEach((issue, index) => {
          console.log(formatIssue(issue, index));
        });
      }

      if (warnings.length > 0) {
        console.log('⚠️  警告:');
        console.log('-'.repeat(60));
        warnings.forEach((issue, index) => {
          console.log(formatIssue(issue, index));
        });
      }

      if (options.verbose && infos.length > 0) {
        console.log('ℹ️  信息提示:');
        console.log('-'.repeat(60));
        infos.forEach((issue, index) => {
          console.log(formatIssue(issue, index));
        });
      }
    }

    printSummary(issues, warnings, infos);

    return result.isValid ? 0 : 1;

  } catch (error) {
    console.error('\n❌ 验证过程中发生错误:');
    console.error(`   ${(error as Error).message}`);
    console.error('');

    if (options.verbose) {
      console.error((error as Error).stack);
    }

    return 1;
  }
}