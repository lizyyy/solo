const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function generateTerminalReport(analysisResult, options) {
  const { basicStats, prefixAnalysis, ttlAnalysis, trendAnalysis, validation } = analysisResult;

  console.log('\n');
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════════'));
  console.log(chalk.cyan.bold('              Redis Key 空间审计报告'));
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════════'));
  console.log(`生成时间: ${new Date().toLocaleString()}`);
  console.log(`输入文件: ${options.input}`);
  if (options.previous) {
    console.log(`历史快照: ${options.previous}`);
  }
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════════\n'));

  if (validation.warnings.length > 0) {
    console.log(chalk.yellow.bold('⚠️  警告信息:'));
    validation.warnings.forEach(w => console.log(chalk.yellow(`   - ${w}`)));
    console.log('');
  }

  const summaryTable = new Table({
    head: [chalk.white.bold('指标'), chalk.white.bold('数值')],
    colWidths: [30, 30]
  });

  summaryTable.push(
    ['Key 总数', basicStats.totalKeys.toLocaleString()],
    ['总内存', formatBytes(basicStats.totalMemory)],
    ['平均内存', formatBytes(basicStats.avgMemory)],
    ['中位数内存', formatBytes(basicStats.medianMemory)],
    ['P95 内存', formatBytes(basicStats.p95Memory)],
    ['最大单个 Key', formatBytes(basicStats.maxMemory)],
    ['最小单个 Key', formatBytes(basicStats.minMemory)],
    ['无 TTL Key 数量', `${basicStats.noTTLCount} (${basicStats.noTTLPercentage}%)`]
  );

  console.log(chalk.blue.bold('📊 基本统计'));
  console.log(summaryTable.toString());
  console.log('');

  const bigKeysTable = new Table({
    head: [chalk.white.bold('#'), chalk.white.bold('Key'), chalk.white.bold('内存'), chalk.white.bold('TTL'), chalk.white.bold('类型')],
    colWidths: [5, 40, 15, 15, 10]
  });

  basicStats.topBigKeys.forEach((key, idx) => {
    bigKeysTable.push([
      idx + 1,
      key.key.length > 35 ? key.key.slice(0, 35) + '...' : key.key,
      formatBytes(key.memory),
      key.ttl === -1 ? '永久' : `${key.ttl}s`,
      key.type
    ]);
  });

  console.log(chalk.blue.bold('🔥 Top Big Keys'));
  console.log(bigKeysTable.toString());
  console.log('');

  const depth = parseInt(options.prefixDepth, 10);
  const levelData = prefixAnalysis.byDepth[depth];
  
  if (levelData) {
    const prefixTable = new Table({
      head: [chalk.white.bold('#'), chalk.white.bold('前缀'), chalk.white.bold('Key数'), chalk.white.bold('总内存'), chalk.white.bold('无TTL%')],
      colWidths: [5, 35, 12, 15, 10]
    });

    levelData.topPrefixes.slice(0, 10).forEach((p, idx) => {
      prefixTable.push([
        idx + 1,
        p.prefix.length > 30 ? p.prefix.slice(0, 30) + '...' : p.prefix,
        p.keyCount.toLocaleString(),
        formatBytes(p.totalMemory),
        `${p.noTTLPercentage}%`
      ]);
    });

    console.log(chalk.blue.bold(`📁 业务前缀 Top 10 (深度: ${depth})`));
    console.log(prefixTable.toString());
    console.log('');
  }

  const ttlTable = new Table({
    head: [chalk.white.bold('TTL 区间'), chalk.white.bold('Key数'), chalk.white.bold('占比'), chalk.white.bold('总内存')],
    colWidths: [25, 12, 10, 15]
  });

  ttlAnalysis.sortedBuckets.forEach(bucket => {
    const percentageColor = parseFloat(bucket.percentage) > 20 ? chalk.red : chalk.white;
    ttlTable.push([
      bucket.label,
      bucket.count.toLocaleString(),
      percentageColor(`${bucket.percentage}%`),
      formatBytes(bucket.totalMemory)
    ]);
  });

  console.log(chalk.blue.bold('⏰ TTL 分布统计'));
  console.log(ttlTable.toString());
  console.log('');

  if (trendAnalysis) {
    const trendTable = new Table({
      head: [chalk.white.bold('指标'), chalk.white.bold('当前'), chalk.white.bold('变化'), chalk.white.bold('变化率')],
      colWidths: [20, 15, 15, 15]
    });

    const memChangeColor = trendAnalysis.summary.memoryChange > 0 ? chalk.red : chalk.green;
    const keyChangeColor = trendAnalysis.summary.keyCountChange > 0 ? chalk.red : chalk.green;

    trendTable.push(
      ['总 Key 数', 
       basicStats.totalKeys.toLocaleString(), 
       keyChangeColor((trendAnalysis.summary.keyCountChange > 0 ? '+' : '') + trendAnalysis.summary.keyCountChange),
       keyChangeColor(`${trendAnalysis.summary.keyCountChangePercent}%`)
      ],
      ['总内存', 
       formatBytes(basicStats.totalMemory), 
       memChangeColor((trendAnalysis.summary.memoryChange > 0 ? '+' : '') + formatBytes(trendAnalysis.summary.memoryChange)),
       memChangeColor(`${trendAnalysis.summary.memoryChangePercent}%`)
      ],
      ['新增 Key', trendAnalysis.summary.addedCount, '-', '-'],
      ['删除 Key', trendAnalysis.summary.removedCount, '-', '-'],
      ['无 TTL 变化', trendAnalysis.summary.noTTLChange, '-', '-']
    );

    console.log(chalk.blue.bold('📈 趋势对比 (vs 历史快照)'));
    console.log(trendTable.toString());
    console.log('');
  }

  const risks = [];
  if (parseFloat(basicStats.noTTLPercentage) > 30) {
    risks.push(chalk.red(`高风险: ${basicStats.noTTLPercentage}% 的 Key 没有设置 TTL`));
  }
  if (basicStats.maxMemory > 1024 * 1024 * 100) {
    risks.push(chalk.yellow(`注意: 存在超过 100MB 的大 Key`));
  }
  if (prefixAnalysis.highRiskPrefixes && prefixAnalysis.highRiskPrefixes.length > 0) {
    risks.push(chalk.red(`发现 ${prefixAnalysis.highRiskPrefixes.length} 个高风险前缀 (无TTL > 50%)`));
  }

  if (risks.length > 0) {
    console.log(chalk.bgRed.white.bold('🚨 风险提示'));
    risks.forEach(r => console.log(`   ${r}`));
    console.log('');
  }

  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════════'));
  console.log(chalk.green('✅ 分析完成! 详细报告已输出到: ') + options.outputDir);
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════════\n'));
}

function generateJSONReport(analysisResult, options) {
  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      inputFile: options.input,
      previousFile: options.previous || null,
      options: {
        prefixDepth: parseInt(options.prefixDepth, 10),
        prefixSeparator: options.prefixSeparator,
        topN: parseInt(options.topN, 10),
        sampleRate: parseFloat(options.sampleRate)
      }
    },
    summary: {
      totalKeys: analysisResult.basicStats.totalKeys,
      totalMemory: analysisResult.basicStats.totalMemory,
      totalMemoryFormatted: formatBytes(analysisResult.basicStats.totalMemory),
      avgMemory: analysisResult.basicStats.avgMemory,
      noTTLCount: analysisResult.basicStats.noTTLCount,
      noTTLPercentage: analysisResult.basicStats.noTTLPercentage,
      hasTrendAnalysis: !!analysisResult.trendAnalysis
    },
    basicStats: analysisResult.basicStats,
    prefixAnalysis: {
      businessPrefixes: analysisResult.prefixAnalysis.patterns.businessPrefixes,
      mixedPrefixes: analysisResult.prefixAnalysis.patterns.mixedPrefixes,
      highRiskPrefixes: analysisResult.prefixAnalysis.highRiskPrefixes,
      memoryDistribution: analysisResult.prefixAnalysis.memoryDistribution,
      topPrefixes: analysisResult.prefixAnalysis.byDepth[parseInt(options.prefixDepth, 10)]?.topPrefixes || []
    },
    ttlAnalysis: {
      stats: analysisResult.ttlAnalysis.stats,
      buckets: Object.values(analysisResult.ttlAnalysis.buckets)
    },
    validation: {
      errors: analysisResult.validation.errors,
      warnings: analysisResult.validation.warnings
    }
  };

  if (analysisResult.trendAnalysis) {
    report.trendAnalysis = {
      summary: analysisResult.trendAnalysis.summary,
      topGainers: analysisResult.trendAnalysis.topGainers,
      topLosers: analysisResult.trendAnalysis.topLosers,
      prefixTrends: analysisResult.trendAnalysis.prefixTrends
    };
  }

  return report;
}

function generateMarkdownReport(analysisResult, options) {
  const { basicStats, prefixAnalysis, ttlAnalysis, trendAnalysis, validation } = analysisResult;
  const depth = parseInt(options.prefixDepth, 10);

  let md = `# Redis Key 空间审计报告\n\n`;
  md += `> 生成时间: ${new Date().toLocaleString()}\n`;
  md += `> 输入文件: \`${options.input}\`\n`;
  if (options.previous) {
    md += `> 历史快照: \`${options.previous}\`\n`;
  }
  md += `\n---\n\n`;

  if (validation.warnings.length > 0) {
    md += `## ⚠️ 警告信息\n\n`;
    validation.warnings.forEach(w => {
      md += `- ${w}\n`;
    });
    md += `\n`;
  }

  md += `## 📊 基本统计\n\n`;
  md += `| 指标 | 数值 |\n`;
  md += `|------|------|\n`;
  md += `| Key 总数 | ${basicStats.totalKeys.toLocaleString()} |\n`;
  md += `| 总内存 | ${formatBytes(basicStats.totalMemory)} |\n`;
  md += `| 平均内存 | ${formatBytes(basicStats.avgMemory)} |\n`;
  md += `| 中位数内存 | ${formatBytes(basicStats.medianMemory)} |\n`;
  md += `| P95 内存 | ${formatBytes(basicStats.p95Memory)} |\n`;
  md += `| 最大 Key | ${formatBytes(basicStats.maxMemory)} |\n`;
  md += `| 最小 Key | ${formatBytes(basicStats.minMemory)} |\n`;
  md += `| 无 TTL Key | ${basicStats.noTTLCount} (${basicStats.noTTLPercentage}%) |\n`;
  md += `\n`;

  md += `## 🔥 Top Big Keys\n\n`;
  md += `| # | Key | 内存 | TTL | 类型 |\n`;
  md += `|---|-----|------|-----|------|\n`;
  basicStats.topBigKeys.forEach((key, idx) => {
    md += `| ${idx + 1} | \`${key.key}\` | ${formatBytes(key.memory)} | ${key.ttl === -1 ? '永久' : `${key.ttl}s`} | ${key.type} |\n`;
  });
  md += `\n`;

  const levelData = prefixAnalysis.byDepth[depth];
  if (levelData) {
    md += `## 📁 业务前缀分析 (深度: ${depth})\n\n`;
    md += `### Top 前缀 (按内存)\n\n`;
    md += `| # | 前缀 | Key 数量 | 总内存 | 无 TTL 占比 |\n`;
    md += `|---|------|----------|--------|-------------|\n`;
    levelData.topPrefixes.slice(0, 15).forEach((p, idx) => {
      md += `| ${idx + 1} | \`${p.prefix}\` | ${p.keyCount.toLocaleString()} | ${formatBytes(p.totalMemory)} | ${p.noTTLPercentage}% |\n`;
    });
    md += `\n`;
  }

  if (prefixAnalysis.highRiskPrefixes.length > 0) {
    md += `### ⚠️ 高风险前缀 (无 TTL > 50%)\n\n`;
    md += `| 前缀 | Key 数量 | 总内存 | 无 TTL 数量 | 占比 |\n`;
    md += `|------|----------|--------|-------------|------|\n`;
    prefixAnalysis.highRiskPrefixes.forEach(p => {
      md += `| \`${p.prefix}\` | ${p.keyCount.toLocaleString()} | ${formatBytes(p.totalMemory)} | ${p.noTTLCount} | ${p.noTTLPercentage}% |\n`;
    });
    md += `\n`;
  }

  md += `## ⏰ TTL 分布分析\n\n`;
  md += `| TTL 区间 | Key 数量 | 占比 | 总内存 | 平均内存 |\n`;
  md += `|----------|----------|------|--------|----------|\n`;
  ttlAnalysis.sortedBuckets.forEach(bucket => {
    md += `| ${bucket.label} | ${bucket.count.toLocaleString()} | ${bucket.percentage}% | ${formatBytes(bucket.totalMemory)} | ${formatBytes(bucket.avgMemory)} |\n`;
  });
  md += `\n`;

  if (trendAnalysis) {
    md += `## 📈 趋势对比 (vs 历史快照)\n\n`;
    md += `### 总体变化\n\n`;
    md += `| 指标 | 当前值 | 变化量 | 变化率 |\n`;
    md += `|------|--------|--------|--------|\n`;
    md += `| Key 总数 | ${basicStats.totalKeys.toLocaleString()} | ${trendAnalysis.summary.keyCountChange > 0 ? '+' : ''}${trendAnalysis.summary.keyCountChange} | ${trendAnalysis.summary.keyCountChangePercent}% |\n`;
    md += `| 总内存 | ${formatBytes(basicStats.totalMemory)} | ${trendAnalysis.summary.memoryChange > 0 ? '+' : ''}${formatBytes(trendAnalysis.summary.memoryChange)} | ${trendAnalysis.summary.memoryChangePercent}% |\n`;
    md += `| 新增 Key | ${trendAnalysis.summary.addedCount} | - | - |\n`;
    md += `| 删除 Key | ${trendAnalysis.summary.removedCount} | - | - |\n`;
    md += `\n`;

    md += `### 内存增长 Top 前缀\n\n`;
    md += `| 前缀 | 当前内存 | 历史内存 | 内存变化 | 变化率 |\n`;
    md += `|------|----------|----------|----------|--------|\n`;
    trendAnalysis.prefixTrends.topByMemoryGrowth.slice(0, 10).forEach(t => {
      md += `| \`${t.prefix}\` | ${formatBytes(t.currentMemory)} | ${formatBytes(t.previousMemory)} | ${t.memoryChange > 0 ? '+' : ''}${formatBytes(t.memoryChange)} | ${t.memoryChangePercent}% |\n`;
    });
    md += `\n`;
  }

  md += `## 🎯 审计结论与建议\n\n`;
  const conclusions = [];
  
  if (parseFloat(basicStats.noTTLPercentage) > 30) {
    conclusions.push(`**高优先级**: ${basicStats.noTTLPercentage}% 的 Key 没有设置 TTL，建议检查是否存在内存泄漏风险`);
  }
  
  if (basicStats.maxMemory > 1024 * 1024 * 50) {
    conclusions.push(`**中优先级**: 存在大于 50MB 的大 Key，建议考虑拆分或优化存储结构`);
  }
  
  if (prefixAnalysis.patterns.mixedPrefixes.length > 5) {
    conclusions.push(`**建议**: 检测到 ${prefixAnalysis.patterns.mixedPrefixes.length} 个使用频率较低的前缀，建议规范 Key 命名`);
  }
  
  if (conclusions.length === 0) {
    conclusions.push(`Redis Key 空间状态良好，继续保持`);
  }

  conclusions.forEach((c, i) => {
    md += `${i + 1}. ${c}\n`;
  });

  md += `\n---\n`;
  md += `*本报告由 redis-key-audit CLI 工具自动生成*\n`;

  return md;
}

function writeReports(analysisResult, options) {
  const outputDir = options.outputDir;
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const baseName = `redis-audit-${timestamp}`;

  if (options.format === 'all' || options.format === 'json') {
    const jsonReport = generateJSONReport(analysisResult, options);
    const jsonPath = path.join(outputDir, `${baseName}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2), 'utf-8');
  }

  if (options.format === 'all' || options.format === 'markdown') {
    const mdReport = generateMarkdownReport(analysisResult, options);
    const mdPath = path.join(outputDir, `${baseName}.md`);
    fs.writeFileSync(mdPath, mdReport, 'utf-8');
  }

  if (options.format === 'all' || options.format === 'terminal') {
    if (!options.quiet) {
      generateTerminalReport(analysisResult, options);
    }
  }

  return {
    outputDir,
    files: fs.readdirSync(outputDir).filter(f => f.includes(baseName))
  };
}

module.exports = {
  generateTerminalReport,
  generateJSONReport,
  generateMarkdownReport,
  writeReports,
  formatBytes
};
