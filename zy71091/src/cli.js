const { Command } = require('commander');

function parseArgs(argv) {
  const program = new Command();

  program
    .name('redis-key-audit')
    .description('Redis Key 空间审计 CLI 工具 - 分析内存、前缀、TTL 和增长趋势')
    .version('1.0.0');

  program
    .option('-i, --input <file>', '输入样本文件 (JSON 格式)')
    .option('-p, --previous <file>', '历史快照文件，用于趋势对比')
    .option('-o, --output-dir <dir>', '输出目录', './audit-output')
    .option('--prefix-depth <n>', '前缀聚合深度', '3')
    .option('--prefix-separator <char>', '前缀分隔符', ':')
    .option('--ttl-buckets <buckets>', 'TTL 分级桶 (逗号分隔)', '0,60,3600,86400,604800,2592000')
    .option('--top-n <n>', 'Top N 前缀/Key 数量', '20')
    .option('--sample-rate <rate>', '抽样率 (0.01-1.0)', '1.0')
    .option('--format <format>', '输出格式: all, terminal, json, markdown', 'all')
    .option('--quiet', '静默模式，仅输出错误')
    .option('--strict', '严格模式，输入验证失败直接退出');

  program.parse(argv);
  return program.opts();
}

module.exports = { parseArgs };
