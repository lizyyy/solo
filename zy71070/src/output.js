const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { OVERRIDE_TYPES, LAYERS } = require('./tracer');

function formatValue(value, maxLength = 80) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'object') {
    const str = JSON.stringify(value);
    if (str.length > maxLength) {
      return str.substring(0, maxLength - 3) + '...';
    }
    return str;
  }
  return String(value);
}

function createNoColorChalk() {
  const identity = (s) => s;
  const noColor = new Proxy(identity, {
    get: (target, prop) => {
      if (prop === 'level') return 0;
      return noColor;
    }
  });
  return noColor;
}

function printTerminalSummary(result, options) {
  const { mergedConfig, traceMap, conflicts, stats, keyPathChain } = result;
  const useColor = options.color !== false && !options.silent;

  const log = (msg = '') => !options.silent && console.log(msg);
  const c = useColor ? chalk : createNoColorChalk();

  log();
  log(c.bold.cyan('══════════════════════════════════════════════════════════════'));
  log(c.bold.cyan('                    JSON 配置合并轨迹报告'));
  log(c.bold.cyan('══════════════════════════════════════════════════════════════'));
  log();

  log(c.bold('📊 统计摘要'));
  log(c.gray('──────────────────────────────────────────────────────────────'));
  log(`  总配置项数: ${c.cyan(stats.totalKeys)}`);
  log(`  被覆盖项数: ${c.yellow(stats.overriddenKeys)}`);
  log(`  新增配置项: ${c.green(stats.newKeys)}`);
  log(`  NULL覆盖数: ${c.red(stats.nullOverrides)}`);
  log(`  冲突/告警数: ${c.red(stats.conflictCount + stats.caseInconsistencyCount)}`);
  log();

  log(c.bold('📁 各层级统计'));
  log(c.gray('──────────────────────────────────────────────────────────────'));
  for (const layer of LAYERS) {
    const ls = stats.layerStats[layer.name];
    if (ls) {
      log(`  ${layer.label}:`);
      log(`    定义键数: ${ls.totalKeys}`);
      log(`    最终生效: ${c.green(ls.finalKeys)}`);
      log(`    覆盖其他: ${c.yellow(ls.overriddenKeys)}`);
    }
  }
  log();

  if (keyPathChain) {
    log(c.bold('🔍 指定键路径追踪:'), c.cyan(keyPathChain.path));
    log(c.gray('──────────────────────────────────────────────────────────────'));
    log(`  最终值: ${c.green(formatValue(keyPathChain.finalValue))}`);
    log(`  最终来源: ${c.green(keyPathChain.finalLayerLabel)}`);
    log(`  覆盖类型: ${c.yellow(keyPathChain.overrideTypeLabel)}`);
    log(`  说明: ${c.gray(keyPathChain.overrideDescription)}`);
    log();
    log(c.bold('  覆盖链:'));
    for (const item of keyPathChain.chain) {
      const marker = item.isFinal ? c.green(' → ') : '   ';
      const finalMark = item.isFinal ? c.green(' [最终生效]') : '';
      log(`${marker}${item.layerLabel}: ${formatValue(item.value)}${finalMark}`);
    }
    log();
  }

  if (conflicts.conflicts.length > 0) {
    log(c.bold('⚠️  覆盖冲突详情'));
    log(c.gray('──────────────────────────────────────────────────────────────'));
    for (const conflict of conflicts.conflicts) {
      log();
      log(c.yellow(`  路径: ${conflict.path}`));
      log(`  类型: ${conflict.overrideTypeLabel}`);
      log(`  最终值: ${c.green(formatValue(conflict.finalValue))}`);
      log(`  来源: ${c.green(conflict.finalLayerLabel)}`);
      log(c.bold('  覆盖链:'));
      for (const item of conflict.chain) {
        const marker = item.isFinal ? c.green(' → ') : '   ';
        const finalMark = item.isFinal ? c.green(' [最终]') : '';
        log(`${marker}${item.layerLabel}: ${formatValue(item.value)}${finalMark}`);
      }
    }
    log();
  }

  if (conflicts.caseInconsistencies.length > 0) {
    log(c.bold('⚠️  键名大小写不一致警告'));
    log(c.gray('──────────────────────────────────────────────────────────────'));
    for (const ci of conflicts.caseInconsistencies) {
      log();
      log(c.yellow(`  路径: ${ci.path}`));
      log(`  统一小写: ${ci.lowerKey}`);
      log(c.bold('  使用情况:'));
      for (const usage of ci.usages) {
        log(`    ${usage.layerLabel}: "${usage.key}"`);
      }
    }
    log();
  }

  if (!options.silent) {
    log(c.bold.cyan('══════════════════════════════════════════════════════════════'));
  }

  return {
    stats,
    hasConflicts: conflicts.hasConflicts
  };
}

function generateJsonOutput(result, options) {
  const { mergedConfig, traceMap, conflicts, stats, keyPathChain } = result;

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      options: {
        arrayMerge: options.arrayMerge,
        caseSensitive: options.caseSensitive,
        keyPath: options.keyPath
      }
    },
    mergedConfig,
    traceMap,
    conflicts,
    statistics: stats,
    ...(keyPathChain && { keyPathChain })
  };
}

function writeJsonOutput(outputDir, data, timestamp) {
  const fileName = `config-trace-${timestamp}.json`;
  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  return filePath;
}

function generateMarkdownReport(result, options) {
  const { mergedConfig, traceMap, conflicts, stats, keyPathChain } = result;

  const lines = [];

  lines.push('# JSON 配置合并轨迹报告');
  lines.push('');
  lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push('');

  lines.push('## 统计摘要');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 总配置项数 | ${stats.totalKeys} |`);
  lines.push(`| 被覆盖项数 | ${stats.overriddenKeys} |`);
  lines.push(`| 新增配置项 | ${stats.newKeys} |`);
  lines.push(`| NULL覆盖数 | ${stats.nullOverrides} |`);
  lines.push(`| 冲突/告警数 | ${stats.conflictCount + stats.caseInconsistencyCount} |`);
  lines.push('');

  lines.push('## 各层级统计');
  lines.push('');
  lines.push('| 层级 | 定义键数 | 最终生效 | 覆盖其他 |');
  lines.push('|------|----------|----------|----------|');
  for (const layer of LAYERS) {
    const ls = stats.layerStats[layer.name];
    if (ls) {
      lines.push(`| ${layer.label} | ${ls.totalKeys} | ${ls.finalKeys} | ${ls.overriddenKeys} |`);
    }
  }
  lines.push('');

  if (keyPathChain) {
    lines.push('## 指定键路径追踪');
    lines.push('');
    lines.push(`**路径**: \`${keyPathChain.path}\``);
    lines.push('');
    lines.push(`- **最终值**: \`${formatValue(keyPathChain.finalValue)}\``);
    lines.push(`- **最终来源**: ${keyPathChain.finalLayerLabel}`);
    lines.push(`- **覆盖类型**: ${keyPathChain.overrideTypeLabel}`);
    lines.push(`- **说明**: ${keyPathChain.overrideDescription}`);
    lines.push('');
    lines.push('### 覆盖链');
    lines.push('');
    for (const item of keyPathChain.chain) {
      const finalMark = item.isFinal ? ' ✅ **[最终生效]**' : '';
      lines.push(`- **${item.layerLabel}**: \`${formatValue(item.value)}\`${finalMark}`);
    }
    lines.push('');
  }

  if (conflicts.conflicts.length > 0) {
    lines.push('## 覆盖冲突详情');
    lines.push('');

    for (let i = 0; i < conflicts.conflicts.length; i++) {
      const conflict = conflicts.conflicts[i];
      lines.push(`### ${i + 1}. ${conflict.path}`);
      lines.push('');
      lines.push(`- **类型**: ${conflict.overrideTypeLabel}`);
      lines.push(`- **最终值**: \`${formatValue(conflict.finalValue)}\``);
      lines.push(`- **来源**: ${conflict.finalLayerLabel}`);
      lines.push('');
      lines.push('#### 覆盖链');
      lines.push('');
      for (const item of conflict.chain) {
        const finalMark = item.isFinal ? ' ✅ **[最终]**' : '';
        lines.push(`- **${item.layerLabel}**: \`${formatValue(item.value)}\`${finalMark}`);
      }
      lines.push('');
    }
  }

  if (conflicts.caseInconsistencies.length > 0) {
    lines.push('## 键名大小写不一致警告');
    lines.push('');

    for (const ci of conflicts.caseInconsistencies) {
      lines.push(`### ${ci.path}`);
      lines.push('');
      lines.push(`统一小写: \`${ci.lowerKey}\``);
      lines.push('');
      lines.push('| 层级 | 使用的键名 |');
      lines.push('|------|------------|');
      for (const usage of ci.usages) {
        lines.push(`| ${usage.layerLabel} | \`${usage.key}\` |`);
      }
      lines.push('');
    }
  }

  lines.push('## 合并配置类型说明');
  lines.push('');
  lines.push('| 类型 | 说明 |');
  lines.push('|------|------|');
  for (const [key, value] of Object.entries(OVERRIDE_TYPES)) {
    lines.push(`| ${value.label} | ${value.description} |`);
  }
  lines.push('');

  lines.push('## 最终合并配置');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(mergedConfig, null, 2));
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

function writeMarkdownOutput(outputDir, content, timestamp) {
  const fileName = `config-trace-${timestamp}.md`;
  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

function writeOutputs(result, options) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPaths = {};

  if (options.format === 'all' || options.format === 'json') {
    const jsonData = generateJsonOutput(result, options);
    outputPaths.json = writeJsonOutput(options.output, jsonData, timestamp);
  }

  if (options.format === 'all' || options.format === 'markdown') {
    const mdContent = generateMarkdownReport(result, options);
    outputPaths.markdown = writeMarkdownOutput(options.output, mdContent, timestamp);
  }

  return outputPaths;
}

module.exports = {
  printTerminalSummary,
  generateJsonOutput,
  writeJsonOutput,
  generateMarkdownReport,
  writeMarkdownOutput,
  writeOutputs
};
