#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import { calculatePermissionDiff } from './calculator';
import { generateOutput } from './output';
import { validateInput } from './validator';
import { CLIOptions, RuleConfig, EmployeePermission } from './types';

const program = new Command();

program
  .name('组织变更文件权限重算差异 CLI')
  .description('计算组织变更（调岗）后的文件权限差异，支持兼职部门、临时授权、继承规则的特殊处理')
  .version('1.0.0', '-v, --version', '输出版本号')
  .requiredOption('-i, --input <path>', '输入文件路径（包含员工权限数据的JSON文件）')
  .requiredOption('-r, --rules <path>', '规则配置文件路径（JSON格式的规则定义）')
  .requiredOption('-o, --output <dir>', '输出目录路径')
  .option('-d, --dry-run', '试运行模式，不生成实际文件，仅输出计算结果到控制台', false)
  .option('--overwrite', '覆盖已存在的输出文件', false)
  .helpOption('-h, --help', '显示帮助信息')
  .addHelpText('after', `

示例:
  $ org-permission-diff --input ./data/employees.json --rules ./config/rules.json --output ./results
  $ org-permission-diff -i input.json -r rules.json -o out --dry-run
  $ org-permission-diff -i data.json -r rules.json -o results --overwrite

业务规则说明:
  1. 标准权限差异：调岗导致的常规权限增减
  2. 兼职部门权限：员工在兼职部门拥有的权限，需单独列出
  3. 临时授权：有过期时间的临时权限，需判断是否需要重新审批
  4. 继承规则：从角色/组/部门继承的权限，调岗后需重新计算
`);

program.parse();

async function main() {
  const options = program.opts<CLIOptions>();

  console.log('='.repeat(60));
  console.log('  组织变更文件权限重算差异 CLI');
  console.log('='.repeat(60));
  console.log(`  输入文件: ${options.input}`);
  console.log(`  规则文件: ${options.rules}`);
  console.log(`  输出目录: ${options.output}`);
  console.log(`  试运行模式: ${options.dryRun ? '是' : '否'}`);
  console.log(`  覆盖模式: ${options.overwrite ? '是' : '否'}`);
  console.log('='.repeat(60));
  console.log();

  try {
    if (!await fs.pathExists(options.input)) {
      console.error('❌ 错误: 输入文件不存在');
      console.error(`   文件路径: ${options.input}`);
      process.exit(1);
    }

    if (!await fs.pathExists(options.rules)) {
      console.error('❌ 错误: 规则配置文件不存在');
      console.error(`   文件路径: ${options.rules}`);
      process.exit(1);
    }

    if (!options.dryRun) {
      const outputExists = await fs.pathExists(options.output);
      if (outputExists && !options.overwrite) {
        console.error('❌ 错误: 输出目录已存在且未使用 --overwrite 参数');
        console.error(`   目录路径: ${options.output}`);
        process.exit(1);
      }
    }

    console.log('📋 正在读取输入数据...');
    const inputData: EmployeePermission[] = await fs.readJson(options.input);

    console.log('📋 正在读取规则配置...');
    const rules: RuleConfig = await fs.readJson(options.rules);
    console.log(`   规则版本: ${rules.version}`);
    console.log(`   生效日期: ${rules.effectiveDate}`);
    console.log();

    console.log('🔍 正在验证输入数据...');
    const validationErrors = validateInput(inputData, rules);
    if (validationErrors.length > 0) {
      console.log(`⚠️  发现 ${validationErrors.length} 个验证问题:`);
      validationErrors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. [${err.severity.toUpperCase()}] ${err.message}`);
      });
      console.log();
    }

    console.log('🧮 正在计算权限差异...');
    console.log('   处理重点: 兼职部门 | 临时授权 | 继承规则');
    console.log();
    const result = calculatePermissionDiff(inputData, rules);

    console.log('📊 计算完成! 结果摘要:');
    console.log(`   员工总数: ${result.summary.totalEmployees}`);
    console.log(`   权限变更总数: ${result.summary.totalPermissionsChanged}`);
    console.log(`   - 新增权限: ${result.summary.addedPermissions}`);
    console.log(`   - 移除权限: ${result.summary.removedPermissions}`);
    console.log(`   - 兼职部门差异: ${result.summary.partTimeDiffs}`);
    console.log(`   - 临时授权差异: ${result.summary.temporaryDiffs}`);
    console.log(`   - 继承规则差异: ${result.summary.inheritedDiffs}`);
    console.log();

    if (result.errors.length > 0) {
      console.log('⚠️  处理过程中发现的问题:');
      result.errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. [${err.severity.toUpperCase()}] ${err.message}`);
      });
      console.log();
    }

    if (!options.dryRun) {
      console.log('📝 正在生成输出文件...');
      await generateOutput(result, options.output, rules);
      console.log('✅ 输出文件生成完成!');
    } else {
      console.log('🔍 试运行模式: 不生成输出文件');
      console.log();
      console.log('详细差异预览:');
      console.log('─'.repeat(60));
      
      if (result.standardDiffs.length > 0) {
        console.log('\n【标准权限差异】');
        result.standardDiffs.slice(0, 5).forEach(diff => {
          console.log(`  ${diff.diffType === 'added' ? '+' : diff.diffType === 'removed' ? '-' : '~'} ${diff.permissionName} (${diff.employeeName})`);
        });
        if (result.standardDiffs.length > 5) {
          console.log(`  ... 还有 ${result.standardDiffs.length - 5} 条`);
        }
      }

      if (result.partTimeDiffs.length > 0) {
        console.log('\n【兼职部门权限差异】');
        result.partTimeDiffs.slice(0, 5).forEach(diff => {
          console.log(`  ${diff.diffType === 'added' ? '+' : diff.diffType === 'removed' ? '-' : '~'} ${diff.permissionName} - ${diff.changeReason} (${diff.employeeName})`);
        });
        if (result.partTimeDiffs.length > 5) {
          console.log(`  ... 还有 ${result.partTimeDiffs.length - 5} 条`);
        }
      }

      if (result.temporaryDiffs.length > 0) {
        console.log('\n【临时授权差异】');
        result.temporaryDiffs.slice(0, 5).forEach(diff => {
          console.log(`  ${diff.diffType === 'added' ? '+' : diff.diffType === 'removed' ? '-' : '~'} ${diff.permissionName} - ${diff.changeReason} (${diff.employeeName})`);
        });
        if (result.temporaryDiffs.length > 5) {
          console.log(`  ... 还有 ${result.temporaryDiffs.length - 5} 条`);
        }
      }

      if (result.inheritedDiffs.length > 0) {
        console.log('\n【继承规则差异】');
        result.inheritedDiffs.slice(0, 5).forEach(diff => {
          console.log(`  ${diff.diffType === 'added' ? '+' : diff.diffType === 'removed' ? '-' : '~'} ${diff.permissionName} - ${diff.changeReason} (${diff.employeeName})`);
        });
        if (result.inheritedDiffs.length > 5) {
          console.log(`  ... 还有 ${result.inheritedDiffs.length - 5} 条`);
        }
      }
    }

    console.log();
    console.log('='.repeat(60));
    console.log('✅ 处理完成!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 处理失败!');
    console.error(`   错误信息: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error('   堆栈信息:', error.stack);
    }
    process.exit(1);
  }
}

main();
