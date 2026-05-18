#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { checkPermissionDowngrade, formatResult } = require('./checker');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    base: null,
    target: null,
    output: null,
    format: 'json',
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--base':
      case '-b':
        options.base = args[++i];
        break;
      case '--target':
      case '-t':
        options.target = args[++i];
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--format':
      case '-f':
        options.format = args[++i];
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
应用权限清单权限降级核验 CLI v1.0.0

用法:
  perm-check [选项]

选项:
  -b, --base <文件>    基准权限清单文件（降级前）
  -t, --target <文件>  目标权限清单文件（降级后）
  -o, --output <文件>  输出结果文件路径
  -f, --format <格式>  输出格式: json (默认) 或 text
  -h, --help           显示此帮助信息

示例:
  perm-check --base examples/base-permissions.json \\
             --target examples/target-permissions.json \\
             --output examples/result.json \\
             --format text

业务规则:
  - 检查旧token权限是否残留
  - 检查子应用继承权限是否残留
  - 检查缓存权限是否未过期

输出说明:
  - 结果包含明确的"应用权限清单权限降级核验"标识
  - 按类别统计残留权限数量
  - 提供详细差异对比，便于diff观察规则变更后的变化
`);
}

function loadJsonFile(filepath) {
  try {
    const content = fs.readFileSync(path.resolve(filepath), 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`读取文件失败: ${filepath}`);
    console.error(error.message);
    process.exit(1);
  }
}

function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  if (!options.base || !options.target) {
    console.error('错误: 必须指定 --base 和 --target 参数');
    console.error('使用 --help 查看帮助信息');
    process.exit(1);
  }

  const basePermissions = loadJsonFile(options.base);
  const targetPermissions = loadJsonFile(options.target);

  const result = checkPermissionDowngrade(basePermissions, targetPermissions);
  const formatted = formatResult(result, options.format);

  if (options.output) {
    fs.writeFileSync(path.resolve(options.output), formatted, 'utf-8');
    console.log(`结果已写入: ${options.output}`);
  } else {
    console.log(formatted);
  }

  process.exit(result.summary.totalResidue > 0 ? 1 : 0);
}

main();
