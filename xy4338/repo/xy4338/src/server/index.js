#!/usr/bin/env node

const InspectorServer = require('./app');
const config = require('../config');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    port: config.server.port,
    host: config.server.host
  };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' || args[i] === '-p') {
      if (i + 1 < args.length) {
        options.port = parseInt(args[i + 1]);
        i++;
      }
    } else if (args[i] === '--host' || args[i] === '-h') {
      if (i + 1 < args.length) {
        options.host = args[i + 1];
        i++;
      }
    } else if (args[i] === '--help') {
      printHelp();
      process.exit(0);
    }
  }
  
  return options;
}

function printHelp() {
  console.log(`
🎵 ${config.app.name} - 本地HTTP接口服务

用法: inspect-server [选项]

选项:
  --port, -p <端口>    指定服务端口 (默认: ${config.server.port})
  --host, -h <地址>    指定服务地址 (默认: ${config.server.host})
  --help                显示此帮助信息

示例:
  inspect-server
  inspect-server --port 8080
  inspect-server -p 3001 -h 0.0.0.0

API 接口:
  GET    /api/health                    健康检查
  GET    /api/dashboard                 仪表盘统计
  GET    /api/inspections               获取巡检记录列表
  POST   /api/inspections               创建新的巡检
  GET    /api/inspections/:id           获取巡检详情
  GET    /api/inspections/:id/risks     获取巡检风险
  PUT    /api/risks/:id/resolve         标记风险已解决
  POST   /api/inspections/:id/notes     添加备注
  GET    /api/inspections/:id/notes     获取备注列表
  GET    /api/inspections/:id/export/markdown  导出Markdown
  GET    /api/inspections/:id/export/json      导出JSON

`);
}

function main() {
  const options = parseArgs();
  
  config.server.port = options.port;
  config.server.host = options.host;
  
  const server = new InspectorServer();
  server.start();
  
  process.on('SIGINT', () => {
    console.log('\n正在停止服务...');
    server.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n正在停止服务...');
    server.stop();
    process.exit(0);
  });
}

main();
