#!/usr/bin/env node

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';

import { 
  parseOrderCsv, 
  parseSvgFile, 
  parseRulesYaml, 
  parseBarcodesJson,
  getDefaultRules
} from '../parsers';

import { validate, ValidationInput, RuleCategory } from '../rules';

import { exportReports, ExportOptions } from '../report';

const packageJsonPath = path.join(__dirname, '../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

const program = new Command();

program
  .name('prepress-checker')
  .description('包装印刷厂制版预检 CLI 工具')
  .version(packageJson.version);

program
  .command('check')
  .description('执行制版预检检查')
  .requiredOption('-s, --svg <path>', '刀模 SVG 文件路径')
  .option('-o, --order <path>', '订单 CSV 文件路径')
  .option('-r, --rules <path>', '工艺规则 YAML 文件路径')
  .option('-b, --barcodes <path>', '条码清单 JSON 文件路径')
  .option('-d, --output-dir <path>', '报告输出目录', './output')
  .option('-n, --base-name <name>', '报告文件名前缀', 'prepress-report')
  .option('-f, --formats <formats...>', '输出格式: json, csv, md', ['json', 'csv', 'md'])
  .option('--enable <rules...>', '启用指定规则分类')
  .option('--disable <rules...>', '禁用指定规则分类')
  .option('-v, --verbose', '显示详细输出')
  .action(async (options) => {
    try {
      await runCheck(options);
    } catch (error) {
      console.error('\n❌ 执行出错:');
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('list-rules')
  .description('列出所有可用的检查规则')
  .action(() => {
    listRules();
  });

program
  .command('init-rules')
  .description('创建默认的工艺规则 YAML 配置文件')
  .option('-o, --output <path>', '输出文件路径', './rules.yaml')
  .action((options) => {
    initRules(options.output);
  });

interface CheckOptions {
  svg: string;
  order?: string;
  rules?: string;
  barcodes?: string;
  outputDir: string;
  baseName: string;
  formats: string[];
  enable?: string[];
  disable?: string[];
  verbose?: boolean;
}

async function runCheck(options: CheckOptions): Promise<void> {
  console.log('\n📦 制版预检工具启动...\n');

  const svgPath = path.resolve(options.svg);
  if (!fs.existsSync(svgPath)) {
    throw new Error(`SVG 文件不存在: ${svgPath}`);
  }

  if (options.verbose) {
    console.log('📄 解析输入文件...');
  }

  const svg = parseSvgFile(svgPath);
  
  const order = options.order ? parseOrderCsv(path.resolve(options.order))[0] : undefined;
  const rules = options.rules 
    ? parseRulesYaml(path.resolve(options.rules)) 
    : getDefaultRules();
  const barcodes = options.barcodes 
    ? parseBarcodesJson(path.resolve(options.barcodes)) 
    : undefined;

  if (options.verbose) {
    console.log(`  ✓ SVG: ${path.basename(svgPath)}`);
    if (options.order) console.log(`  ✓ 订单: ${path.basename(options.order)}`);
    if (options.rules) console.log(`  ✓ 规则: ${path.basename(options.rules)}`);
    if (options.barcodes) console.log(`  ✓ 条码: ${path.basename(options.barcodes)}`);
    console.log('');
  }

  const validationInput: ValidationInput = {
    svg,
    rules,
    barcodes,
    order,
    svgFileName: path.basename(svgPath),
    orderFileName: options.order ? path.basename(options.order) : undefined,
    rulesFileName: options.rules ? path.basename(options.rules) : undefined,
    barcodesFileName: options.barcodes ? path.basename(options.barcodes) : undefined,
  };

  const validationOptions = {
    enabledRules: options.enable as RuleCategory[],
    disabledRules: options.disable as RuleCategory[],
  };

  if (options.verbose) {
    console.log('🔍 执行检查规则...');
  }

  const result = validate(validationInput, validationOptions);

  const { summary } = result;
  
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('              检查结果摘要');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  
  if (summary.critical > 0) {
    console.log('🔴 状态: 不通过 (存在严重错误)');
  } else if (summary.warning > 0) {
    console.log('🟡 状态: 有警告');
  } else {
    console.log('🟢 状态: 通过');
  }
  
  console.log('');
  console.log(`   🔴 严重错误: ${summary.critical}`);
  console.log(`   🟡 警告:     ${summary.warning}`);
  console.log(`   ℹ️  信息:     ${summary.info}`);
  console.log(`   ─────────────────`);
  console.log(`   📊 总计:     ${summary.total}`);
  console.log('');

  if (result.issues.length > 0 && options.verbose) {
    console.log('📋 问题详情:');
    console.log('');
    
    for (const issue of result.issues) {
      const emoji = issue.severity === 'critical' ? '🔴' : 
                    issue.severity === 'warning' ? '🟡' : 'ℹ️';
      console.log(`  ${emoji} [${issue.category}] ${issue.message}`);
      if (issue.suggestion) {
        console.log(`     💡 建议: ${issue.suggestion}`);
      }
      console.log('');
    }
  }

  const exportOptions: ExportOptions = {
    outputDir: path.resolve(options.outputDir),
    baseName: options.baseName,
    formats: options.formats as ('json' | 'csv' | 'md')[],
  };

  if (options.verbose) {
    console.log('📄 导出报告...');
  }

  const exportResult = exportReports(result, exportOptions);

  console.log('');
  console.log('📁 报告已导出:');
  for (const file of exportResult.files) {
    console.log(`   - ${file.path} (${formatFileSize(file.size)})`);
  }
  console.log('');

  if (summary.critical > 0) {
    process.exit(1);
  }
}

function listRules(): void {
  const rules = [
    {
      id: 'viewbox',
      name: 'ViewBox 检查',
      description: '检查 SVG 是否包含有效的 viewBox 属性',
      severity: 'warning',
    },
    {
      id: 'dimension',
      name: '尺寸单位检查',
      description: '检查 SVG 尺寸和单位是否符合印刷要求',
      severity: 'warning',
    },
    {
      id: 'dieline',
      name: '刀线检查',
      description: '检查刀线路径是否闭合、颜色和线宽是否正确',
      severity: 'critical',
    },
    {
      id: 'bleed',
      name: '出血边距检查',
      description: '检查元素是否在安全区内，是否超出出血范围',
      severity: 'warning',
    },
    {
      id: 'spot_color',
      name: '专色命名检查',
      description: '检查专色命名是否符合规范',
      severity: 'warning',
    },
    {
      id: 'registration',
      name: '套准孔检查',
      description: '检查套准孔是否存在、位置和尺寸是否正确',
      severity: 'warning',
    },
    {
      id: 'barcode',
      name: '条码检查',
      description: '检查条码尺寸、位置和安静区是否符合要求',
      severity: 'warning',
    },
  ];

  console.log('\n📋 可用的检查规则:\n');
  
  for (const rule of rules) {
    const emoji = rule.severity === 'critical' ? '🔴' : 
                  rule.severity === 'warning' ? '🟡' : 'ℹ️';
    console.log(`  ${emoji} --${rule.id}`);
    console.log(`     名称: ${rule.name}`);
    console.log(`     描述: ${rule.description}`);
    console.log('');
  }

  console.log('💡 使用示例:');
  console.log('');
  console.log('  # 只启用刀线和条码检查');
  console.log('  prepress-checker check --enable dieline barcode -s dieline.svg');
  console.log('');
  console.log('  # 禁用套准孔检查');
  console.log('  prepress-checker check --disable registration -s dieline.svg');
  console.log('');
}

function initRules(outputPath: string): void {
  const defaultRules = {
    bleed: {
      margin: 3,
      unit: 'mm',
    },
    spotColors: {
      allowedPrefixes: ['PANTONE', 'Spot', '专色'],
      caseSensitive: false,
    },
    registrationMarks: {
      required: true,
      size: {
        min: 5,
        max: 15,
      },
      positionTolerance: 2,
    },
    barcode: {
      minWidth: 20,
      maxWidth: 100,
      minHeight: 10,
      maxHeight: 50,
      quietZone: 5,
    },
    dieline: {
      strokeColor: '#FF0000',
      strokeWidth: 0.5,
      mustBeClosed: true,
    },
  };

  const yaml = require('js-yaml');
  const content = `# 包装印刷工艺规则配置
# 此文件定义了制版预检工具的检查规则

# 出血边距设置
bleed:
  # 出血边距值
  margin: ${defaultRules.bleed.margin}
  # 单位: mm, cm, pt, in
  unit: "${defaultRules.bleed.unit}"

# 专色命名规则
spotColors:
  # 允许的专色前缀列表
  allowedPrefixes:
${defaultRules.spotColors.allowedPrefixes.map(p => `    - "${p}"`).join('\n')}
  # 是否区分大小写
  caseSensitive: ${defaultRules.spotColors.caseSensitive}

# 套准孔规则
registrationMarks:
  # 是否必须包含套准孔
  required: ${defaultRules.registrationMarks.required}
  # 套准孔尺寸范围
  size:
    min: ${defaultRules.registrationMarks.size.min}
    max: ${defaultRules.registrationMarks.size.max}
  # 位置容差
  positionTolerance: ${defaultRules.registrationMarks.positionTolerance}

# 条码规则
barcode:
  # 最小宽度
  minWidth: ${defaultRules.barcode.minWidth}
  # 最大宽度
  maxWidth: ${defaultRules.barcode.maxWidth}
  # 最小高度
  minHeight: ${defaultRules.barcode.minHeight}
  # 最大高度
  maxHeight: ${defaultRules.barcode.maxHeight}
  # 安静区大小
  quietZone: ${defaultRules.barcode.quietZone}

# 刀线规则
dieline:
  # 刀线描边颜色
  strokeColor: "${defaultRules.dieline.strokeColor}"
  # 刀线线宽
  strokeWidth: ${defaultRules.dieline.strokeWidth}
  # 刀线必须闭合
  mustBeClosed: ${defaultRules.dieline.mustBeClosed}
`;

  const resolvedPath = path.resolve(outputPath);
  const dir = path.dirname(resolvedPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(resolvedPath, content, 'utf-8');
  
  console.log(`\n✅ 默认工艺规则配置已创建: ${resolvedPath}`);
  console.log('');
  console.log('💡 使用方式:');
  console.log(`  prepress-checker check -s dieline.svg -r ${resolvedPath}`);
  console.log('');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

program.parse(process.argv);
