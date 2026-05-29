#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { ContractSentinel } from './index';

const program = new Command();

program
  .name('sentinel')
  .description('接口契约差异哨兵 - 检测OpenAPI文档、Mock和真实接口之间的不一致')
  .version('1.0.0');

program
  .command('compare')
  .description('比对两个契约')
  .requiredOption('-a, --contract-a <path>', '契约A文件路径 (OpenAPI JSON/YAML)')
  .requiredOption('-b, --contract-b <path>', '契约B文件路径 (OpenAPI JSON/YAML)')
  .option('-f, --format <format>', '输出格式: json|html|markdown', 'json')
  .option('-o, --output <path>', '输出文件路径')
  .option('--name-a <name>', '契约A名称', 'contractA')
  .option('--name-b <name>', '契约B名称', 'contractB')
  .action(async (options) => {
    try {
      const sentinelA = new ContractSentinel(options.nameA);
      const sentinelB = new ContractSentinel(options.nameB);

      const contractA = sentinelA.parseOpenAPI(options.contractA);
      const contractB = sentinelB.parseOpenAPI(options.contractB);

      const diff = sentinelA.compare(contractA, contractB);

      const content = sentinelA.exportReport(diff, {
        format: options.format as any,
        outputPath: options.output,
        includeExamples: true
      });

      if (!options.output) {
        console.log(content);
      } else {
        console.log(`报告已导出到: ${options.output}`);
      }

      if (diff.summary.isCompatible) {
        console.log('\n✅ 契约兼容');
      } else {
        console.log(`\n❌ 发现 ${diff.summary.breakingChanges} 个破坏性变更`);
        process.exit(1);
      }
    } catch (error: any) {
      console.error('比对失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('验证输入完整性')
  .requiredOption('--openapi <path>', 'OpenAPI文档路径')
  .option('--mock <path>', 'Mock响应JSON文件路径')
  .option('--real <path>', '真实响应JSON文件路径')
  .action((options) => {
    const missing: string[] = [];

    if (!fs.existsSync(options.openapi)) {
      console.log('✅ OpenAPI文档存在');
    } else {
      missing.push('OpenAPI文档');
    }

    if (options.mock && fs.existsSync(options.mock)) {
      console.log('✅ Mock响应文件存在');
    } else if (options.mock) {
      missing.push('Mock响应文件');
    }

    if (options.real && fs.existsSync(options.real)) {
      console.log('✅ 真实响应文件存在');
    } else if (options.real) {
      missing.push('真实响应文件');
    }

    if (missing.length > 0) {
      console.log('\n❌ 缺少以下输入:', missing.join(', '));
      process.exit(1);
    } else {
      console.log('\n✅ 所有输入验证通过');
    }
  });

program
  .command('examples')
  .description('从OpenAPI生成样例数据')
  .requiredOption('-i, --input <path>', 'OpenAPI文档路径')
  .option('-o, --output <path>', '输出文件路径')
  .action((options) => {
    const sentinel = new ContractSentinel();
    const contract = sentinel.parseOpenAPI(options.input);
    const examples = sentinel.generateExamples(contract);
    
    const content = JSON.stringify(examples, null, 2);
    
    if (options.output) {
      fs.writeFileSync(options.output, content);
      console.log(`样例已导出到: ${options.output}`);
    } else {
      console.log(content);
    }
  });

program
  .command('track')
  .description('追踪契约版本')
  .requiredOption('-i, --input <path>', 'OpenAPI文档路径')
  .option('-v, --version <version>', '版本号')
  .action((options) => {
    const sentinel = new ContractSentinel();
    const contract = sentinel.parseOpenAPI(options.input);
    contract.version = options.version || contract.version;
    
    const record = sentinel.trackVersion(contract);
    
    console.log(`已追踪版本: ${record.version}`);
    console.log(`变更记录:`, record.changes);
  });

program
  .command('versions')
  .description('列出所有追踪的版本')
  .action(() => {
    const { VersionTracker } = require('./version-tracker');
    const tracker = new VersionTracker();
    const versions = tracker.getAllVersions();
    
    if (versions.length === 0) {
      console.log('没有追踪的版本');
      return;
    }
    
    console.log('追踪的版本:');
    for (const v of versions) {
      console.log(`- ${v.version} (${new Date(v.timestamp).toLocaleString()})`);
      if (v.changes.length > 0) {
        console.log(`  变更: ${v.changes.length} 项`);
      }
    }
  });

program.parse();
