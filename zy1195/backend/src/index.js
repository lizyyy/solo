require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { initDatabase } = require('./config/database');
const experimentRoutes = require('./routes/experiments');
const WebSocketHandler = require('./websocket/handler');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

initDatabase()
  .then(() => console.log('数据库初始化完成'))
  .catch(err => console.error('数据库初始化失败:', err));

app.use('/api/experiments', experimentRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const wsHandler = new WebSocketHandler(wss);

server.listen(PORT, () => {
  console.log(`网络协议实验台后端服务已启动`);
  console.log(`HTTP 服务: http://localhost:${PORT}`);
  console.log(`WebSocket 服务: ws://localhost:${PORT}`);
});

module.exports = { app, server, wss, wsHandler };
