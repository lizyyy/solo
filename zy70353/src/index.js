#!/usr/bin/env node

const ConfigManager = require('./configManager');
const RequestSimulator = require('./requestSimulator');

const timeline = require('./commands/timeline');
const replay = require('./commands/replay');
const bisect = require('./commands/bisect');
const explain = require('./commands/explain');
const report = require('./commands/report');

function parseArgs(args) {
  const result = {
    command: null,
    options: {},
    args: []
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (value !== undefined) {
        result.options[key] = value;
      } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        result.options[key] = args[i + 1];
        i++;
      } else {
        result.options[key] = true;
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1);
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        result.options[key] = args[i + 1];
        i++;
      } else {
        result.options[key] = true;
      }
    } else if (!result.command) {
      result.command = arg;
    } else {
      result.args.push(arg);
    }
    
    i++;
  }

  return result;
}

function showHelp() {
  console.log(`
配置热更新回放 CLI

用法:
  config-replay <command> [options]

命令:
  timeline          显示配置变更时间线
  replay            重放所有配置版本，对比性能
  bisect            二分查找定位问题配置变更
  explain <version> 详细分析特定版本的变更影响
  report            生成完整的分析报告

选项:
  --snapshot <file>    配置快照文件路径 (默认: data/snapshot.json)
  --events <file>      配置变更事件文件路径 (默认: data/events.json)
  --requests <file>    请求样本文件路径 (默认: data/requests.json)
  --threshold <ms>     性能退化阈值 (默认: 20)
  --detail             显示详细信息
  --verbose            显示调试信息
  -h, --help           显示帮助信息

示例:
  config-replay timeline
  config-replay replay --detail
  config-replay bisect --threshold 30
  config-replay explain 3
  config-replay report

数据格式说明:

1. 配置快照 (snapshot.json):
{
  "timestamp": "2024-01-01T00:00:00Z",
  "config": {
    "rateLimit": { ... },
    "recommendation": { ... },
    "caching": { ... }
  },
  "frozen": {
    "security.enabled": true
  }
}

2. 变更事件 (events.json):
[
  {
    "timestamp": "2024-01-01T01:00:00Z",
    "type": "SET",
    "data": {
      "rateLimit.threshold": 500
    }
  }
]

3. 请求样本 (requests.json):
[
  {
    "id": "req-001",
    "path": "/api/recommend",
    "method": "GET",
    "metadata": {
      "requestCount": 150,
      "cacheState": "miss"
    }
  }
]
`);
}

function loadData(options) {
  const defaultDir = './data';
  
  const snapshotFile = options.snapshot || `${defaultDir}/snapshot.json`;
  const eventsFile = options.events || `${defaultDir}/events.json`;
  const requestsFile = options.requests || `${defaultDir}/requests.json`;

  const configManager = new ConfigManager();
  const requestSimulator = new RequestSimulator();

  try {
    configManager.loadSnapshot(snapshotFile);
  } catch (e) {
    console.error(`错误: 无法加载配置快照 ${snapshotFile}`);
    console.error(`  ${e.message}`);
    process.exit(1);
  }

  try {
    configManager.loadEvents(eventsFile);
  } catch (e) {
    console.error(`错误: 无法加载变更事件 ${eventsFile}`);
    console.error(`  ${e.message}`);
    process.exit(1);
  }

  try {
    requestSimulator.loadRequests(requestsFile);
  } catch (e) {
    console.error(`错误: 无法加载请求样本 ${requestsFile}`);
    console.error(`  ${e.message}`);
    process.exit(1);
  }

  configManager.buildVersions();

  return { configManager, requestSimulator };
}

function main() {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  if (parsed.options.h || parsed.options.help || !parsed.command) {
    showHelp();
    process.exit(0);
  }

  const { configManager, requestSimulator } = loadData(parsed.options);

  switch (parsed.command) {
    case 'timeline':
      timeline(configManager, parsed.options);
      break;

    case 'replay':
      replay(configManager, requestSimulator, parsed.options);
      break;

    case 'bisect':
      bisect(configManager, requestSimulator, {
        threshold: Number(parsed.options.threshold) || 20,
        verbose: parsed.options.verbose || false
      });
      break;

    case 'explain':
      if (parsed.args.length < 1) {
        console.error('错误: explain 命令需要指定版本号');
        console.error('用法: config-replay explain <version>');
        process.exit(1);
      }
      explain(configManager, requestSimulator, Number(parsed.args[0]), parsed.options);
      break;

    case 'report':
      report(configManager, requestSimulator, {
        threshold: Number(parsed.options.threshold) || 20
      });
      break;

    default:
      console.error(`错误: 未知命令 "${parsed.command}"`);
      showHelp();
      process.exit(1);
  }
}

main();
