const express = require('express');
const path = require('path');
const apiRouter = require('./api');

let server = null;
const app = express();

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRouter);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function startServer(port = 3000) {
  return new Promise((resolve, reject) => {
    if (server) {
      resolve({ port, server });
      return;
    }
    
    server = app.listen(port, () => {
      console.log(`\n  🚀 手语课复盘工具已启动`);
      console.log(`  📡 本地服务地址: http://localhost:${port}`);
      console.log(`  🔧 API 地址: http://localhost:${port}/api`);
      console.log(`\n  按 Ctrl+C 停止服务\n`);
      resolve({ port, server });
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`端口 ${port} 已被占用，尝试端口 ${port + 1}...`);
        server = null;
        startServer(port + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

function stopServer() {
  return new Promise((resolve, reject) => {
    if (server) {
      server.close((err) => {
        if (err) {
          reject(err);
        } else {
          server = null;
          console.log('服务器已停止');
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

function getApp() {
  return app;
}

module.exports = {
  startServer,
  stopServer,
  getApp
};
