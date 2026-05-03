import * as path from 'path';
import * as fs from 'fs-extra';
import { stringify } from 'csv-stringify/sync';
import { DateTime } from 'luxon';
import { loadDataContext } from '../readers';
import { analyzeData, generateReviewSummary } from '../analyzer';
import { Issue, IssueSeverity, IssueType, DataContext } from '../types';

function escapeForCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function issuesToCsv(issues: Issue[]): string {
  const headers = [
    'ID',
    '类型',
    '严重程度',
    '标题',
    '描述',
    '涉及实体',
    '门店ID',
    '时间戳',
    '详情'
  ];

  const rows = issues.map(issue => [
    issue.id,
    issue.type,
    issue.severity,
    escapeForCsv(issue.title),
    escapeForCsv(issue.description),
    escapeForCsv(issue.affectedEntities.join('; ')),
    issue.storeId,
    issue.timestamp,
    escapeForCsv(JSON.stringify(issue.details, null, 2))
  ]);

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
}

function generateMarkdownReport(
  context: DataContext,
  issues: Issue[],
  warnings: Issue[],
  infos: Issue[]
): string {
  const summary = generateReviewSummary(context, issues, warnings, infos);
  const now = DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss');

  const lines: string[] = [];

  lines.push('# 布草洗涤流转夜审复核报告');
  lines.push('');
  lines.push(`**生成时间**: ${now}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('## 1. 总体概况');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 今日退房客房数 | ${summary.totalRooms} |`);
  lines.push(`| 涉及布草标签数 | ${summary.totalTags} |`);
  lines.push(`| 送洗批次数量 | ${summary.totalBatches} |`);
  lines.push(`| 跨午夜退房数量 | ${summary.crossMidnightCheckouts} |`);
  lines.push('');

  lines.push('## 2. 问题汇总');
  lines.push('');
  lines.push('| 严重程度 | 数量 |');
  lines.push('|----------|------|');
  lines.push(`| ❌ 严重问题 | ${issues.length} |`);
  lines.push(`| ⚠️ 警告 | ${warnings.length} |`);
  lines.push(`| ℹ️ 信息提示 | ${infos.length} |`);
  lines.push('');

  if (issues.length > 0 || warnings.length > 0) {
    lines.push('## 3. 问题类型分布');
    lines.push('');

    const typeCounts: Record<string, { count: number; severity: IssueSeverity }> = {};

    [...issues, ...warnings, ...infos].forEach(issue => {
      if (!typeCounts[issue.type]) {
        typeCounts[issue.type] = { count: 0, severity: issue.severity };
      }
      typeCounts[issue.type].count++;
    });

    lines.push('| 问题类型 | 数量 | 严重程度 |');
    lines.push('|----------|------|----------|');

    Object.entries(typeCounts).forEach(([type, data]) => {
      const severityText = {
        [IssueSeverity.ERROR]: '严重',
        [IssueSeverity.WARNING]: '警告',
        [IssueSeverity.INFO]: '信息'
      }[data.severity];
      lines.push(`| ${type} | ${data.count} | ${severityText} |`);
    });

    lines.push('');
  }

  if (issues.length > 0) {
    lines.push('## 4. 严重问题详情');
    lines.push('');
    issues.forEach((issue, index) => {
      lines.push(`### 4.${index + 1} ${issue.title}`);
      lines.push('');
      lines.push(`- **门店**: ${issue.storeId}`);
      lines.push(`- **涉及实体**: ${issue.affectedEntities.join(', ')}`);
      lines.push(`- **时间**: ${issue.timestamp}`);
      lines.push('');
      lines.push('**描述**:');
      lines.push('');
      lines.push(`> ${issue.description}`);
      lines.push('');

      if (Object.keys(issue.details).length > 0) {
        lines.push('**详情**:');
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(issue.details, null, 2));
        lines.push('```');
        lines.push('');
      }
    });
  }

  if (warnings.length > 0) {
    lines.push('## 5. 警告详情');
    lines.push('');
    warnings.forEach((issue, index) => {
      lines.push(`### 5.${index + 1} ${issue.title}`);
      lines.push('');
      lines.push(`- **门店**: ${issue.storeId}`);
      lines.push(`- **涉及实体**: ${issue.affectedEntities.join(', ')}`);
      lines.push(`- **时间**: ${issue.timestamp}`);
      lines.push('');
      lines.push('**描述**:');
      lines.push('');
      lines.push(`> ${issue.description}`);
      lines.push('');

      if (Object.keys(issue.details).length > 0) {
        lines.push('**详情**:');
        lines.push('');
        lines.push('```json');
        lines.push(JSON.stringify(issue.details, null, 2));
        lines.push('```');
        lines.push('');
      }
    });
  }

  if (infos.length > 0) {
    lines.push('## 6. 信息提示');
    lines.push('');
    lines.push('以下为信息类提示，不影响复核通过，但需要关注:');
    lines.push('');
    infos.forEach((issue, index) => {
      lines.push(`### 6.${index + 1} ${issue.title}`);
      lines.push('');
      lines.push(`- **门店**: ${issue.storeId}`);
      lines.push(`- **涉及实体**: ${issue.affectedEntities.join(', ')}`);
      lines.push('');
      lines.push('**描述**:');
      lines.push('');
      lines.push(`> ${issue.description}`);
      lines.push('');
    });
  }

  lines.push('## 7. 送洗批次清单');
  lines.push('');
  lines.push('| 批次ID | 门店 | 状态 | 标签数 | 送洗时间 | 预计返回 |');
  lines.push('|--------|------|------|--------|----------|----------|');

  context.laundryBatches.forEach(batch => {
    lines.push(
      `| ${batch.batchId} | ${batch.storeId} | ${batch.status} | ${batch.tags.length} | ${batch.sentAt || '-'} | ${batch.expectedReturn || '-'} |`
    );
  });

  lines.push('');

  lines.push('## 8. 复核结论');
  lines.push('');

  if (issues.length > 0) {
    lines.push(`❌ **复核状态: 未通过**`);
    lines.push('');
    lines.push(`存在 ${issues.length} 个严重问题，需要立即处理后才能通过复核。`);
  } else if (warnings.length > 0) {
    lines.push(`⚠️ **复核状态: 有条件通过**`);
    lines.push('');
    lines.push(`存在 ${warnings.length} 个警告，建议关注并跟进处理，但不影响本次复核通过。`);
  } else {
    lines.push(`✅ **复核状态: 全部通过**`);
    lines.push('');
    lines.push('所有检查项均通过，布草洗涤流转正常。');
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*此报告由 linen-audit-cli 自动生成*');

  return lines.join('\n');
}

export async function runExport(dataDir: string, options: { output?: string }): Promise<number> {
  try {
    const resolvedDataDir = path.resolve(dataDir);
    const outputDir = options.output ? path.resolve(options.output) : resolvedDataDir;

    console.log(`📂 正在从目录读取数据: ${resolvedDataDir}`);

    const context = loadDataContext(resolvedDataDir);
    const { issues, warnings, infos } = analyzeData(context);

    console.log(`   ✅ 读取到 ${context.rooms.length} 条客房退房记录`);
    console.log(`   ✅ 读取到 ${context.linenTags.length} 条 RFID 标签记录`);
    console.log(`   ✅ 读取到 ${context.laundryBatches.length} 条送洗批次记录`);
    console.log(`   ✅ 读取到 ${context.vendorRules.length} 条供应商洗涤规则`);

    await fs.ensureDir(outputDir);

    const allIssues = [...issues, ...warnings, ...infos];

    console.log('\n📝 正在生成 issues.csv...');
    const csvContent = issuesToCsv(allIssues);
    const csvPath = path.join(outputDir, 'issues.csv');
    await fs.writeFile(csvPath, csvContent, 'utf-8');
    console.log(`   ✅ 已保存到: ${csvPath}`);
    console.log(`      共 ${allIssues.length} 条记录`);

    console.log('\n📄 正在生成 linen_review.md...');
    const markdownContent = generateMarkdownReport(context, issues, warnings, infos);
    const mdPath = path.join(outputDir, 'linen_review.md');
    await fs.writeFile(mdPath, markdownContent, 'utf-8');
    console.log(`   ✅ 已保存到: ${mdPath}`);

    console.log('\n' + '='.repeat(60));
    console.log('导出完成!');
    console.log('='.repeat(60));
    console.log(`\n  📋 issues.csv: ${csvPath}`);
    console.log(`  📄 linen_review.md: ${mdPath}`);

    if (issues.length > 0) {
      console.log(`\n  ⚠️  注意: 存在 ${issues.length} 个严重问题需要处理`);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    return 0;

  } catch (error) {
    console.error('\n❌ 导出过程中发生错误:');
    console.error(`   ${(error as Error).message}`);
    console.error('');
    console.error((error as Error).stack);

    return 1;
  }
}