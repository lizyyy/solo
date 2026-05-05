#!/usr/bin/env node

import * as path from 'path';
import * as fs from 'fs';
import { Command } from 'commander';
import chalk from 'chalk';
import { table } from 'table';

import { FileParser } from './parsers';
import { Simulator } from './simulator';
import { SimulationResult, ConflictCase } from './types';

const program = new Command();

interface CliOptions {
  orders: string;
  skuTags: string;
  zoneCapacity: string;
  rules: string;
  samples: boolean;
  output: string;
  verbose: boolean;
}

function getSamplePath(): string {
  const possiblePaths = [
    path.join(__dirname, '..', 'samples'),
    path.join(__dirname, 'samples'),
    path.join(process.cwd(), 'samples')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return path.join(__dirname, '..', 'samples');
}

function resolvePaths(options: Partial<CliOptions>): {
  ordersPath: string;
  skuTagsPath: string;
  zoneCapacityPath: string;
  rulesPath: string;
} {
  if (options.samples) {
    const samplePath = getSamplePath();
    return {
      ordersPath: path.join(samplePath, 'orders.csv'),
      skuTagsPath: path.join(samplePath, 'sku_tags.csv'),
      zoneCapacityPath: path.join(samplePath, 'zone_capacity.yaml'),
      rulesPath: path.join(samplePath, 'rules.json')
    };
  }

  return {
    ordersPath: options.orders || 'orders.csv',
    skuTagsPath: options.skuTags || 'sku_tags.csv',
    zoneCapacityPath: options.zoneCapacity || 'zone_capacity.yaml',
    rulesPath: options.rules || 'rules.json'
  };
}

async function loadData(options: Partial<CliOptions>): Promise<{
  parser: FileParser;
  simulator: Simulator;
  simulationResult: SimulationResult | null;
  hasErrors: boolean;
}> {
  const paths = resolvePaths(options);
  const parser = new FileParser();
  const simulator = new Simulator();

  console.log(chalk.blue('📂 正在加载配置文件...'));
  console.log(`   - 订单文件: ${paths.ordersPath}`);
  console.log(`   - SKU标签: ${paths.skuTagsPath}`);
  console.log(`   - 区域容量: ${paths.zoneCapacityPath}`);
  console.log(`   - 规则配置: ${paths.rulesPath}`);
  console.log('');

  const [ordersResult, skuTagsResult] = await Promise.all([
    parser.parseOrders(paths.ordersPath),
    parser.parseSkuTags(paths.skuTagsPath)
  ]);
  const zoneResult = parser.parseZoneCapacity(paths.zoneCapacityPath);
  const rulesResult = parser.parseRules(paths.rulesPath);

  const allErrors = [
    ...ordersResult.errors,
    ...skuTagsResult.errors,
    ...zoneResult.errors,
    ...rulesResult.errors
  ];

  const hasErrors = allErrors.some(e => e.type === 'error');

  if (allErrors.length > 0) {
    console.log(chalk.yellow('⚠️  文件解析问题:'));
    for (const error of allErrors) {
      const icon = error.type === 'error' ? chalk.red('❌') : chalk.yellow('⚠️');
      console.log(`   ${icon} [${error.field}] ${error.message}`);
    }
    console.log('');
  }

  simulator.loadData(
    ordersResult.data,
    skuTagsResult.data,
    zoneResult.data,
    rulesResult.data
  );

  console.log(chalk.green('✅ 数据加载完成'));
  console.log(`   - 订单数: ${ordersResult.data.length}`);
  console.log(`   - SKU数: ${skuTagsResult.data.length}`);
  console.log(`   - 区域数: ${zoneResult.data.length}`);
  console.log(`   - 规则数: ${rulesResult.data.length}`);
  console.log('');

  return {
    parser,
    simulator,
    simulationResult: null,
    hasErrors
  };
}

program
  .name('wave-validator')
  .description('仓库订单分拣波次规则优先级冲突校验CLI')
  .version('1.0.0');

program
  .command('validate')
  .description('校验配置文件的语法和逻辑正确性')
  .option('--orders <path>', '订单CSV文件路径', 'orders.csv')
  .option('--sku-tags <path>', 'SKU标签CSV文件路径', 'sku_tags.csv')
  .option('--zone-capacity <path>', '区域容量YAML文件路径', 'zone_capacity.yaml')
  .option('--rules <path>', '规则JSON文件路径', 'rules.json')
  .option('--samples', '使用内置样本数据')
  .option('-v, --verbose', '显示详细信息')
  .action(async (options) => {
    console.log(chalk.bold.blue('🔍 波次规则配置校验\n'));

    const { simulator, hasErrors } = await loadData(options);

    if (hasErrors) {
      console.log(chalk.red('❌ 配置文件存在错误，无法继续校验'));
      process.exit(1);
    }

    console.log(chalk.blue('📋 正在执行配置校验...\n'));
    const result = simulator.validateConfiguration();

    console.log(chalk.bold('=== 校验结果 ===\n'));
    console.log(`状态: ${result.valid ? chalk.green('✅ 通过') : chalk.red('❌ 失败')}`);
    console.log(`错误数: ${result.errors.length}`);
    console.log(`警告数: ${result.warnings.length}`);
    console.log(`提示数: ${result.info.length}`);
    console.log('');

    if (result.errors.length > 0) {
      console.log(chalk.red.bold('❌ 错误:'));
      for (const e of result.errors) {
        const ruleInfo = e.ruleId ? ` (规则: ${e.ruleId})` : '';
        const zoneInfo = e.zoneId ? ` (区域: ${e.zoneId})` : '';
        console.log(`   ${chalk.red('•')} [${e.field}]${ruleInfo}${zoneInfo}: ${e.message}`);
      }
      console.log('');
    }

    if (result.warnings.length > 0) {
      console.log(chalk.yellow.bold('⚠️ 警告:'));
      for (const w of result.warnings) {
        const ruleInfo = w.ruleId ? ` (规则: ${w.ruleId})` : '';
        const zoneInfo = w.zoneId ? ` (区域: ${w.zoneId})` : '';
        console.log(`   ${chalk.yellow('•')} [${w.field}]${ruleInfo}${zoneInfo}: ${w.message}`);
      }
      console.log('');
    }

    if (result.info.length > 0 && options.verbose) {
      console.log(chalk.blue.bold('ℹ️ 提示:'));
      for (const i of result.info) {
        console.log(`   ${chalk.blue('•')} [${i.field}]: ${i.message}`);
      }
      console.log('');
    }

    if (result.valid) {
      console.log(chalk.green.bold('✅ 配置校验通过！'));
    } else {
      console.log(chalk.red.bold('❌ 配置校验失败，请修复上述错误后重试。'));
      process.exit(1);
    }
  });

program
  .command('simulate')
  .description('模拟一批订单的命中链路，分析冲突')
  .option('--orders <path>', '订单CSV文件路径', 'orders.csv')
  .option('--sku-tags <path>', 'SKU标签CSV文件路径', 'sku_tags.csv')
  .option('--zone-capacity <path>', '区域容量YAML文件路径', 'zone_capacity.yaml')
  .option('--rules <path>', '规则JSON文件路径', 'rules.json')
  .option('--samples', '使用内置样本数据')
  .option('-v, --verbose', '显示详细信息')
  .action(async (options) => {
    console.log(chalk.bold.blue('🚀 波次规则模拟运行\n'));

    const { simulator, hasErrors } = await loadData(options);

    if (hasErrors) {
      console.log(chalk.red('❌ 配置文件存在错误，无法继续模拟'));
      process.exit(1);
    }

    console.log(chalk.blue('⚙️ 正在执行规则模拟...\n'));
    const result = simulator.runSimulation();

    console.log(chalk.bold('=== 模拟结果 ===\n'));
    console.log(`总订单数: ${result.totalOrders}`);
    console.log(`存在冲突的订单数: ${result.ordersWithConflicts}`);
    console.log(`冲突率: ${result.totalOrders > 0 ? ((result.ordersWithConflicts / result.totalOrders) * 100).toFixed(1) : 0}%`);
    console.log('');

    const conflictCount = Object.entries(result.conflictCountByType).filter(([_, count]) => count > 0);
    if (conflictCount.length > 0) {
      console.log(chalk.bold('📊 冲突类型统计:\n'));
      const tableData = [
        ['冲突类型', '数量', '严重程度'],
        ...conflictCount.map(([type, count]) => {
          const typeNames: Record<string, string> = {
            'same_priority_multiple_rules': '同优先级多规则',
            'capacity_boundary': '容量边界',
            'mutually_exclusive_tags': '互斥标签',
            'cold_chain_conflict': '冷链标签',
            'large_item_conflict': '大件标签',
            'zone_exclusion': '区域排除',
            'default_fallback': '默认兜底'
          };
          return [typeNames[type] || type, String(count), count > 5 ? '🔴 高' : count > 2 ? '🟡 中' : '🟢 低'];
        })
      ];
      console.log(table(tableData));
    }

    console.log(chalk.bold('📦 区域容量使用情况:\n'));
    const zoneTableData = [
      ['区域ID', '已分配', '上限', '使用率', '状态'],
      ...result.zoneUsage.map(usage => {
        const percentage = usage.capacityPercentage;
        const status = percentage > 100 ? chalk.red('🔴 溢出') : percentage > 80 ? chalk.yellow('🟡 紧张') : chalk.green('🟢 正常');
        return [
          usage.zoneId,
          `${usage.ordersAssigned}`,
          simulator.getZoneTrackers().find(z => z.zoneId === usage.zoneId)?.maxOrders || '-',
          `${percentage}%`,
          status
        ];
      })
    ];
    console.log(table(zoneTableData));

    if (options.verbose && result.orderTraces.length > 0) {
      console.log(chalk.bold('📋 订单详情:\n'));
      for (const trace of result.orderTraces.slice(0, 10)) {
        console.log(`${chalk.bold(`订单 ${trace.orderId}`)}`);
        console.log(`   匹配规则: ${trace.matchedRules.length > 0 ? trace.matchedRules.map(r => r.ruleId).join(', ') : '无'}`);
        console.log(`   分配区域: ${trace.assignedZone || '未分配'}`);
        console.log(`   冲突数: ${trace.conflicts.length}`);
        if (trace.finalDecision) {
          console.log(`   最终裁决: ${trace.finalDecision.reason}`);
        }
        console.log('');
      }
      if (result.orderTraces.length > 10) {
        console.log(`... 还有 ${result.orderTraces.length - 10} 条订单，使用 export 命令导出完整报告`);
        console.log('');
      }
    }

    if (result.ordersWithConflicts > 0) {
      console.log(chalk.yellow.bold(`⚠️ 检测到 ${result.ordersWithConflicts} 个存在冲突的订单`));
      console.log(chalk.yellow('   建议运行 export 命令导出完整的冲突报告进行分析'));
    } else {
      console.log(chalk.green.bold('✅ 模拟运行完成，未检测到冲突！'));
    }
  });

program
  .command('export')
  .description('导出冲突报告和冲突案例CSV')
  .option('--orders <path>', '订单CSV文件路径', 'orders.csv')
  .option('--sku-tags <path>', 'SKU标签CSV文件路径', 'sku_tags.csv')
  .option('--zone-capacity <path>', '区域容量YAML文件路径', 'zone_capacity.yaml')
  .option('--rules <path>', '规则JSON文件路径', 'rules.json')
  .option('--samples', '使用内置样本数据')
  .option('-o, --output <path>', '输出目录路径', '.')
  .option('--md-name <name>', 'Markdown报告文件名', 'conflict_report.md')
  .option('--csv-name <name>', 'CSV案例文件名', 'conflict_cases.csv')
  .action(async (options) => {
    console.log(chalk.bold.blue('📤 导出冲突报告\n'));

    const { simulator, hasErrors } = await loadData(options);

    if (hasErrors) {
      console.log(chalk.red('❌ 配置文件存在错误，无法继续导出'));
      process.exit(1);
    }

    console.log(chalk.blue('⚙️ 正在执行规则模拟...\n'));
    const result = simulator.runSimulation();

    const outputDir = path.resolve(options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const mdPath = path.join(outputDir, options.mdName);
    const csvPath = path.join(outputDir, options.csvName);

    console.log(chalk.blue('📝 生成冲突报告...'));
    const reportContent = simulator.generateReport(result);
    fs.writeFileSync(mdPath, reportContent, 'utf-8');
    console.log(chalk.green(`   ✅ ${mdPath}`));

    console.log(chalk.blue('📊 生成冲突案例CSV...'));
    const conflictCases = simulator.getConflictCases(result);
    const csvContent = generateCsvContent(conflictCases);
    fs.writeFileSync(csvPath, csvContent, 'utf-8');
    console.log(chalk.green(`   ✅ ${csvPath}`));

    console.log('');
    console.log(chalk.bold.green('✅ 导出完成！'));
    console.log('');
    console.log(`报告文件: ${mdPath}`);
    console.log(`案例文件: ${csvPath}`);
    console.log('');
    console.log(chalk.bold('📈 导出统计:'));
    console.log(`   - 总订单数: ${result.totalOrders}`);
    console.log(`   - 冲突订单数: ${result.ordersWithConflicts}`);
    console.log(`   - 冲突案例数: ${conflictCases.length}`);
  });

function generateCsvContent(cases: ConflictCase[]): string {
  if (cases.length === 0) {
    return 'orderId,conflictType,rules,zones,description,severity,resolvedBy,resolutionReason,finalZone,finalRule\n';
  }

  const headers = Object.keys(cases[0]);
  const lines: string[] = [headers.join(',')];

  for (const c of cases) {
    const values = headers.map(h => {
      const value = (c as any)[h];
      const strValue = String(value).replace(/"/g, '""');
      if (strValue.includes(',') || strValue.includes('\n') || strValue.includes('"')) {
        return `"${strValue}"`;
      }
      return strValue;
    });
    lines.push(values.join(','));
  }

  return lines.join('\n') + '\n';
}

program.parse(process.argv);
