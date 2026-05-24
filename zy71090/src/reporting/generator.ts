import { writeFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { table } from 'table';
import { AnalysisResult, CLIOptions } from '../types';
import { formatTTL } from '../parsers/zoneParser';
import { formatChainAsTree } from '../analyzers/cnameAnalyzer';

export async function generateReports(
  result: AnalysisResult,
  options: CLIOptions,
  outputDir: string
): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const baseName = `${result.zone.name}-${timestamp}`;
  
  for (const format of options.format) {
    switch (format.toLowerCase()) {
      case 'json':
        generateJSONReport(result, outputDir, baseName);
        break;
      case 'markdown':
      case 'md':
        generateMarkdownReport(result, outputDir, baseName);
        break;
      case 'terminal':
      case 'console':
        generateTerminalReport(result, options.verbose);
        break;
    }
  }
}

function generateJSONReport(result: AnalysisResult, outputDir: string, baseName: string): void {
  const filePath = join(outputDir, `${baseName}.json`);
  writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(chalk.green(`✓ JSON 报告已生成: ${filePath}`));
}

function generateMarkdownReport(result: AnalysisResult, outputDir: string, baseName: string): void {
  const filePath = join(outputDir, `${baseName}.md`);
  const content = buildMarkdownContent(result);
  writeFileSync(filePath, content, 'utf-8');
  console.log(chalk.green(`✓ Markdown 报告已生成: ${filePath}`));
}

function buildMarkdownContent(result: AnalysisResult): string {
  const lines: string[] = [];
  const { summary, zone, ttlAnalysis, environmentAnalysis, cnameChains, missingRecords } = result;
  
  lines.push(`# Route53 TTL 分析报告 - ${zone.name}`);
  lines.push('');
  lines.push(`**生成时间**: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`**总记录数**: ${summary.totalRecords}`);
  lines.push(`**平均 TTL**: ${formatTTL(summary.averageTTL)}`);
  lines.push(`**最大 TTL**: ${formatTTL(summary.maxTTL)}`);
  lines.push(`**最小 TTL**: ${formatTTL(summary.minTTL)}`);
  lines.push('');
  
  lines.push('## 摘要');
  lines.push('');
  lines.push(`- ⚠️ **需调整记录**: ${summary.needsAdjustment} 条`);
  lines.push(`- 🔗 **CNAME 链路**: ${summary.cnameChainsCount} 条`);
  lines.push(`- ❓ **缺失记录**: ${summary.missingRecordsCount} 条`);
  lines.push('');
  
  lines.push('## TTL 分级统计');
  lines.push('');
  lines.push('| 级别 | 记录数 | 描述 |');
  lines.push('|------|--------|------|');
  for (const [tier, count] of Object.entries(summary.byTier)) {
    const tierInfo = ttlAnalysis.find(a => a.tier === tier)?.tierInfo;
    lines.push(`| **${tier}** | ${count} | ${tierInfo?.description || ''} |`);
  }
  lines.push('');
  
  lines.push('## 需调整记录详情');
  lines.push('');
  const needsAdjustment = ttlAnalysis.filter(a => a.needsAdjustment);
  if (needsAdjustment.length > 0) {
    lines.push('| 域名 | 类型 | 当前 TTL | 推荐 TTL | 原因 |');
    lines.push('|------|------|----------|----------|------|');
    for (const item of needsAdjustment.slice(0, 50)) {
      lines.push(`| ${item.record.name} | ${item.record.type} | ${formatTTL(item.record.ttl)} | ${formatTTL(item.recommendedTTL)} | ${item.reason} |`);
    }
    if (needsAdjustment.length > 50) {
      lines.push(`| ... | ... | ... | ... | 还有 ${needsAdjustment.length - 50} 条记录 |`);
    }
  } else {
    lines.push('✅ 所有记录 TTL 配置合理');
  }
  lines.push('');
  
  lines.push('## 环境分布');
  lines.push('');
  lines.push('| 环境 | 记录数 |');
  lines.push('|------|--------|');
  for (const [env, count] of Object.entries(summary.byEnvironment)) {
    lines.push(`| ${env} | ${count} |`);
  }
  lines.push('');
  
  lines.push('## CNAME 链路分析');
  lines.push('');
  if (cnameChains.length > 0) {
    lines.push('### 链路统计');
    lines.push('');
    lines.push(`- 总链路数: ${cnameChains.length}`);
    lines.push(`- 平均深度: ${(cnameChains.reduce((a, b) => a + b.depth, 0) / cnameChains.length).toFixed(1)}`);
    lines.push(`- 最大深度: ${Math.max(...cnameChains.map(c => c.depth))}`);
    lines.push(`- 循环引用: ${cnameChains.filter(c => c.isCircular).length} 条`);
    lines.push(`- 未解析: ${cnameChains.filter(c => c.unresolved.length > 0).length} 条`);
    lines.push('');
    
    lines.push('### 链路详情');
    lines.push('');
    for (const chain of cnameChains.slice(0, 20)) {
      lines.push(`#### ${chain.domain}`);
      lines.push('');
      lines.push('```');
      lines.push(formatChainAsTree(chain));
      lines.push('```');
      lines.push('');
      lines.push(`- 深度: ${chain.depth}`);
      lines.push(`- 最大 TTL: ${formatTTL(chain.maxTTL)}`);
      lines.push(`- 平均 TTL: ${formatTTL(chain.averageTTL)}`);
      if (chain.isCircular) lines.push('- ⚠️ 循环引用');
      if (chain.unresolved.length > 0) lines.push(`- ⚠️ 未解析: ${chain.unresolved.join(', ')}`);
      lines.push('');
    }
    if (cnameChains.length > 20) {
      lines.push(`> 还有 ${cnameChains.length - 20} 条链路未显示`);
      lines.push('');
    }
  } else {
    lines.push('无 CNAME 记录');
    lines.push('');
  }
  
  lines.push('## 缺失记录');
  lines.push('');
  if (missingRecords.length > 0) {
    lines.push('| 环境 | 记录名 | 类型 | 存在于 |');
    lines.push('|------|--------|------|--------|');
    for (const missing of missingRecords) {
      lines.push(`| ${missing.environment} | ${missing.recordName} | ${missing.type} | ${missing.foundInEnvironments.join(', ')} |`);
    }
  } else {
    lines.push('✅ 各环境记录完整');
  }
  lines.push('');
  
  lines.push('## 记录类型分布');
  lines.push('');
  lines.push('| 类型 | 数量 |');
  lines.push('|------|------|');
  for (const [type, count] of Object.entries(summary.byType)) {
    lines.push(`| ${type} | ${count} |`);
  }
  lines.push('');
  
  lines.push('## 附录');
  lines.push('');
  lines.push('### TTL 分级规则');
  lines.push('');
  const uniqueTiers = [...new Set(ttlAnalysis.map(a => a.tier))];
  for (const tier of uniqueTiers) {
    const tierInfo = ttlAnalysis.find(a => a.tier === tier)?.tierInfo;
    if (tierInfo) {
      lines.push(`- **${tier}**: ${tierInfo.min}s - ${tierInfo.max === Infinity ? '∞' : tierInfo.max + 's'} (${tierInfo.description})`);
    }
  }
  
  return lines.join('\n');
}

function generateTerminalReport(result: AnalysisResult, verbose: boolean): void {
  const { summary, zone, ttlAnalysis, cnameChains, missingRecords } = result;
  
  console.log('');
  console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════'));
  console.log(chalk.cyan.bold(`           Route53 TTL 分析报告 - ${zone.name}`));
  console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════'));
  console.log('');
  
  console.log(chalk.white.bold('📊 基本统计'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  const statsData = [
    ['总记录数', summary.totalRecords],
    ['平均 TTL', formatTTL(summary.averageTTL)],
    ['最大 TTL', formatTTL(summary.maxTTL)],
    ['最小 TTL', formatTTL(summary.minTTL)]
  ];
  console.log(table(statsData, {
    header: undefined,
    columns: [{ width: 20 }, { width: 30 }]
  }));
  
  console.log(chalk.white.bold('🎯 TTL 分级分布'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  const tierData = [['级别', '数量', '占比']];
  const colorMap: Record<string, (text: string) => string> = {
    red: chalk.red,
    orange: chalk.yellow,
    yellow: chalk.yellowBright,
    green: chalk.green,
    blue: chalk.blue,
    cyan: chalk.cyan,
    magenta: chalk.magenta,
    white: chalk.white
  };
  for (const [tier, count] of Object.entries(summary.byTier)) {
    const percentage = ((count / summary.totalRecords) * 100).toFixed(1) + '%';
    const tierInfo = ttlAnalysis.find(a => a.tier === tier)?.tierInfo;
    const colorFn = colorMap[tierInfo?.color || 'white'] || chalk.white;
    tierData.push([colorFn(tier), count.toString(), percentage]);
  }
  console.log(table(tierData));
  
  console.log(chalk.white.bold('⚠️ 需调整记录'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  const needsAdjustment = ttlAnalysis.filter(a => a.needsAdjustment);
  if (needsAdjustment.length > 0) {
    console.log(chalk.yellow(`发现 ${needsAdjustment.length} 条记录需要调整 TTL`));
    console.log('');
    
    const adjData = [['域名', '类型', '当前 TTL', '推荐 TTL']];
    for (const item of needsAdjustment.slice(0, 10)) {
      adjData.push([
        item.record.name,
        item.record.type,
        formatTTL(item.record.ttl),
        formatTTL(item.recommendedTTL)
      ]);
    }
    console.log(table(adjData));
    
    if (needsAdjustment.length > 10) {
      console.log(chalk.gray(`  ... 还有 ${needsAdjustment.length - 10} 条记录需调整`));
    }
    console.log('');
  } else {
    console.log(chalk.green('✅ 所有记录 TTL 配置合理'));
    console.log('');
  }
  
  if (missingRecords.length > 0) {
    console.log(chalk.white.bold('❓ 缺失记录'));
    console.log(chalk.gray('────────────────────────────────────────────────────────────'));
    console.log(chalk.red(`发现 ${missingRecords.length} 条环境缺失记录`));
    console.log('');
    
    const missData = [['环境', '记录名', '类型']];
    for (const item of missingRecords.slice(0, 10)) {
      missData.push([item.environment, item.recordName, item.type]);
    }
    console.log(table(missData));
    
    if (missingRecords.length > 10) {
      console.log(chalk.gray(`  ... 还有 ${missingRecords.length - 10} 条缺失记录`));
    }
    console.log('');
  }
  
  if (cnameChains.length > 0) {
    console.log(chalk.white.bold('🔗 CNAME 链路'));
    console.log(chalk.gray('────────────────────────────────────────────────────────────'));
    console.log(`共 ${cnameChains.length} 条 CNAME 链路`);
    console.log('');
    
    const circularChains = cnameChains.filter(c => c.isCircular);
    const unresolvedChains = cnameChains.filter(c => c.unresolved.length > 0);
    const longChains = cnameChains.filter(c => c.depth >= 3);
    
    if (circularChains.length > 0) {
      console.log(chalk.red(`⚠️  ${circularChains.length} 条循环引用链路`));
    }
    if (unresolvedChains.length > 0) {
      console.log(chalk.yellow(`⚠️  ${unresolvedChains.length} 条未完全解析链路`));
    }
    if (longChains.length > 0) {
      console.log(chalk.blue(`ℹ️  ${longChains.length} 条深度 >= 3 的链路`));
    }
    
    if (verbose) {
      console.log('');
      for (const chain of cnameChains.slice(0, 5)) {
        console.log(chalk.cyan(chain.domain));
        console.log(chalk.gray(formatChainAsTree(chain).split('\n').slice(1).join('\n')));
        console.log('');
      }
    }
  }
  
  console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════'));
}

export function generateBriefSummary(result: AnalysisResult): string {
  const { summary } = result;
  return [
    `总记录: ${summary.totalRecords}`,
    `需调整: ${summary.needsAdjustment}`,
    `CNAME链路: ${summary.cnameChainsCount}`,
    `缺失记录: ${summary.missingRecordsCount}`
  ].join(' | ');
}
