#!/usr/bin/env node

import { program } from 'commander';
import path from 'path';
import { IspAuditor } from '../core/auditor.js';

program
  .name('isp-audit')
  .description('ISP 标定参数包预检 CLI 工具')
  .version('1.0.0');

program
  .command('check')
  .description('检查 ISP 标定参数包')
  .argument('<release-policy>', 'release_policy.yaml 文件路径')
  .option('-o, --output <dir>', '输出目录', './audit_output')
  .option('-v, --verbose', '显示详细输出')
  .action(async (releasePolicyPath, options) => {
    try {
      const absolutePolicyPath = path.resolve(releasePolicyPath);
      const baseDir = path.dirname(absolutePolicyPath);
      const outputDir = path.isAbsolute(options.output) 
        ? options.output 
        : path.resolve(process.cwd(), options.output);

      const auditor = new IspAuditor({
        baseDir,
        outputDir,
        verbose: options.verbose
      });

      await auditor.audit(path.basename(releasePolicyPath));
    } catch (error) {
      console.error('\n❌ 执行失败:');
      console.error(error.message);
      
      if (options.verbose) {
        console.error('\n详细错误信息:');
        console.error(error.stack);
      }
      
      process.exit(1);
    }
  });

program
  .command('list')
  .description('列出所有可用的校验规则')
  .action(() => {
    console.log('📋 ISP Audit CLI - 校验规则列表\n');
    
    const rules = [
      {
        name: '曝光/增益曲线校验',
        description: '检查曝光时间和模拟增益曲线的单调性',
        level: 'error'
      },
      {
        name: '白平衡矩阵校验',
        description: '验证白平衡矩阵维度为 3x4，数值有效',
        level: 'error'
      },
      {
        name: '颜色校正矩阵校验',
        description: '验证 CCM 矩阵维度为 3x4',
        level: 'error'
      },
      {
        name: '镜头阴影表校验',
        description: '检查 LSC 表覆盖所有传感器模式',
        level: 'error'
      },
      {
        name: '机型适配校验',
        description: '确保标定文件与相机配置机型一致',
        level: 'error'
      },
      {
        name: '分辨率档位校验',
        description: '检查所有传感器模式有对应的标定',
        level: 'error'
      },
      {
        name: '数值有效性校验',
        description: '检查 NaN、Infinity 等无效数值',
        level: 'error'
      },
      {
        name: '重复标定检测',
        description: '检测同一机型是否存在多份标定',
        level: 'warning'
      },
      {
        name: '参数范围校验',
        description: '检查参数是否在合理范围内',
        level: 'warning'
      }
    ];

    console.log('┌────────────────────────┬─────────────────────────────────┬─────────┐');
    console.log('│ 校验规则               │ 说明                            │ 级别    │');
    console.log('├────────────────────────┼─────────────────────────────────┼─────────┤');
    
    for (const rule of rules) {
      const namePad = rule.name.padEnd(22);
      const descPad = rule.description.padEnd(31);
      const levelPad = rule.level === 'error' ? 'ERROR  ' : 'WARNING';
      console.log(`│ ${namePad} │ ${descPad} │ ${levelPad} │`);
    }
    
    console.log('└────────────────────────┴─────────────────────────────────┴─────────┘');
    
    console.log('\n📖 使用示例:');
    console.log('  isp-audit check samples/release_policy.yaml');
    console.log('  npm run dev -- check samples/release_policy.yaml');
  });

program.parse(process.argv);
