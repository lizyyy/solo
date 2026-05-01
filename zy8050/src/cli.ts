#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { parseProductsCsv, parseLocalesJson, parseFontCoverageJson, parseDeviceProfilesYaml } from './parsers';
import { runAllValidations } from './validators';
import { checkPixelOverflow, generateSubsetManifest } from './layout';
import { exportAll } from './exporters';

interface Args {
  products: string;
  locales: string;
  'font-coverage': string;
  'device-profiles': string;
  output: string;
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('products', {
      alias: 'p',
      type: 'string',
      description: '产品 CSV 文件路径',
      demandOption: true
    })
    .option('locales', {
      alias: 'l',
      type: 'string',
      description: '多语言 JSON 文件路径',
      demandOption: true
    })
    .option('font-coverage', {
      alias: 'f',
      type: 'string',
      description: '字体覆盖 JSON 文件路径',
      demandOption: true
    })
    .option('device-profiles', {
      alias: 'd',
      type: 'string',
      description: '设备配置 YAML 文件路径',
      demandOption: true
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      description: '输出目录',
      default: 'output'
    })
    .help()
    .argv as Args;

  console.log('🚀 开始电子价签发布预检...\n');

  try {
    console.log('📖 解析输入文件...');
    const products = await parseProductsCsv(argv.products);
    const locales = parseLocalesJson(argv.locales);
    const fontCoverage = parseFontCoverageJson(argv['font-coverage']);
    const deviceProfiles = parseDeviceProfilesYaml(argv['device-profiles']);

    console.log(`✓ 解析完成: ${products.length} 个产品, ${Object.keys(locales).length} 种语言\n`);

    console.log('🔍 执行规则校验...');
    let issues = runAllValidations(products, locales, fontCoverage, deviceProfiles);
    
    console.log('📐 检查布局溢出...');
    const overflowIssues = checkPixelOverflow(products, locales, deviceProfiles);
    issues = [...issues, ...overflowIssues];

    console.log(`✓ 发现 ${issues.length} 个问题\n`);

    console.log('📦 生成字体子集清单...');
    const subsetManifest = generateSubsetManifest(products, locales, fontCoverage);

    console.log('💾 导出报告...');
    await exportAll(products, locales, deviceProfiles, issues, subsetManifest, argv.output);

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    console.log('\n✅ 预检完成!');
    console.log(`   错误: ${errorCount}, 警告: ${warningCount}`);

    if (errorCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ 预检失败:', error);
    process.exit(1);
  }
}

main();
