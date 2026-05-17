#!/usr/bin/env node

const { Command } = require('commander');
const { run } = require('../src/index');
const path = require('path');

const program = new Command();

program
  .name('cdn-sampler')
  .description('CDN 访问日志样本抽样工具')
  .version('1.0.0');

program
  .argument('<input-file>', '输入的日志文件路径')
  .option('-f, --format <format>', '日志格式: nginx, aliyun, cloudfront, json', 'nginx')
  .option('-s, --sample-size <number>', '目标样本数量', '1000')
  .option('-o, --output-dir <dir>', '输出目录', process.cwd())
  .option('-n, --output-name <name>', '输出文件名前缀', 'cdn-sample-report')
  .option('-c, --status-codes <codes>', '过滤状态码，逗号分隔', '')
  .option('-r, --regions <regions>', '过滤地区，逗号分隔', '')
  .option('-t, --resource-types <types>', '过滤资源类型，逗号分隔', '')
  .option('--min-per-stratum <number>', '每层最小样本数', '5')
  .option('--max-per-stratum <number>', '每层最大样本数', '100')
  .option('--strata-fields <fields>', '分层字段，逗号分隔', 'status,region,resourceType')
  .option('--dedupe-fields <fields>', '去重字段，逗号分隔', 'url,status,ip')
  .option('--seed <string>', '随机种子')
  .option('--fields <fields>', '自定义字段列表（自定义格式用）', '')
  .option('--pattern <regex>', '自定义日志匹配正则表达式')
  .option('--no-progress', '不显示进度条')
  .option('--no-terminal', '不输出终端摘要')
  .option('--no-raw', '不包含原始日志行')
  .action(async (inputFile, options) => {
    try {
      const parsedOptions = {
        input: path.resolve(inputFile),
        format: options.format,
        sampleSize: parseInt(options.sampleSize, 10),
        outputDir: path.resolve(options.outputDir),
        outputName: options.outputName,
        statusCodes: options.statusCodes ? options.statusCodes.split(',').map(c => c.trim()).filter(Boolean) : null,
        regions: options.regions ? options.regions.split(',').map(r => r.trim()).filter(Boolean) : null,
        resourceTypes: options.resourceTypes ? options.resourceTypes.split(',').map(t => t.trim()).filter(Boolean) : null,
        minPerStratum: parseInt(options.minPerStratum, 10),
        maxPerStratum: parseInt(options.maxPerStratum, 10),
        strataFields: options.strataFields.split(',').map(f => f.trim()).filter(Boolean),
        dedupeFields: options.dedupeFields.split(',').map(f => f.trim()).filter(Boolean),
        seed: options.seed,
        fields: options.fields ? options.fields.split(',').map(f => f.trim()).filter(Boolean) : null,
        pattern: options.pattern,
        progress: options.progress,
        terminal: options.terminal,
        includeRaw: options.raw
      };

      await run(parsedOptions);
    } catch (error) {
      console.error('❌ 执行出错:', error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program
  .command('formats')
  .description('显示支持的日志格式说明')
  .action(() => {
    console.log(`
支持的日志格式:

1. nginx (默认)
   格式: $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent" "$http_x_forwarded_for"

2. aliyun (阿里云 CDN)
   包含字段: ip, time, region, isp, host, status, size, method, url, referer, userAgent, schema, cacheStatus

3. cloudfront (AWS CloudFront)
   制表符分隔的标准 CloudFront 日志格式

4. json
   每行一个 JSON 对象，需要包含基本字段: ip, status, url, time

自定义格式:
   使用 --pattern 指定正则表达式，--fields 指定字段名列表
`);
  });

program.parse();
