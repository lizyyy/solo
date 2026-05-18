const http = require('http');
const { validateConfig, printStartupInfo } = require('./config');
const { handleRequest } = require('./routes');

const config = validateConfig();

const server = http.createServer(handleRequest);

server.listen(config.port, config.host, () => {
  printStartupInfo(config);
});

process.on('SIGINT', () => {
  console.log('\n🛑 收到停止信号，正在关闭服务...');
  server.close(() => {
    console.log('✅ 服务已关闭');
    process.exit(0);
  });
});
