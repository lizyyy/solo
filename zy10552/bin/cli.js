#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const { PermissionMatrixGenerator } = require('../src/index');

const program = new Command();

program
  .name('openapi-permission-matrix')
  .description('OpenAPI权限矩阵CLI工具 - 生成角色到接口的权限矩阵')
  .version('1.0.0');

program
  .command('generate')
  .description('生成权限矩阵')
  .option('-i, --input <dir>', 'OpenAPI文件输入目录', './openapi')
  .option('-o, --output <dir>', '输出目录', './output')
  .option('-r, --roles <roles>', '角色列表(逗号分隔)', '')
  .option('--strict', '严格模式，发现缺失权限时退出码为1')
  .option('--no-clean', '不清空输出目录，保留旧结果')
  .action(async (options) => {
    try {
      const inputDir = path.resolve(options.input);
      const outputDir = path.resolve(options.output);
      
      if (!fs.existsSync(inputDir)) {
        console.error(`错误: 输入目录不存在: ${inputDir}`);
        process.exit(1);
      }
      
      const generator = new PermissionMatrixGenerator({
        inputDir,
        outputDir,
        roles: options.roles ? options.roles.split(',').map(r => r.trim()) : [],
        strict: options.strict,
        clean: options.clean
      });
      
      const result = await generator.generate();
      
      console.log('\n✅ 权限矩阵生成完成!');
      console.log(`📁 输出目录: ${outputDir}`);
      
      process.exit(result.exitCode);
    } catch (error) {
      console.error('❌ 生成失败:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
