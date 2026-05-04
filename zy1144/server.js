const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const gameService = require('./services/gameService');

const app = express();
const PORT = process.env.PORT || 3008;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

gameService.initializeSeedData();

app.get('/api/levels', (req, res) => {
  try {
    const levels = gameService.getAllLevels();
    res.json({ success: true, data: levels });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/levels/:levelId', (req, res) => {
  try {
    const level = gameService.getLevelById(req.params.levelId);
    if (!level) {
      return res.status(404).json({ success: false, error: '关卡不存在' });
    }
    res.json({ success: true, data: level });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/games', (req, res) => {
  try {
    const { levelId, playerName } = req.body;
    if (!levelId || !playerName) {
      return res.status(400).json({ success: false, error: '缺少必需参数' });
    }
    const game = gameService.createGame(levelId, playerName);
    res.json({ success: true, data: game });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/games/:gameId', (req, res) => {
  try {
    const game = gameService.getGameById(req.params.gameId);
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    res.json({ success: true, data: game });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/games/:gameId/start', (req, res) => {
  try {
    const game = gameService.startGame(req.params.gameId);
    res.json({ success: true, data: game });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/games/:gameId/sample', (req, res) => {
  try {
    const { lat, lng, accuracy, isSimulated } = req.body;
    if (lat == null || lng == null) {
      return res.status(400).json({ success: false, error: '缺少位置参数' });
    }
    const result = gameService.processLocationSample(
      req.params.gameId,
      lat,
      lng,
      accuracy || 10,
      isSimulated || false
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/games/:gameId/items', (req, res) => {
  try {
    const { itemType } = req.body;
    const result = gameService.useItem(req.params.gameId, itemType);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/games/:gameId/end', (req, res) => {
  try {
    const { status } = req.body;
    const game = gameService.endGame(req.params.gameId, status || 'lost');
    res.json({ success: true, data: game });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/games/:gameId/replay', (req, res) => {
  try {
    const replay = gameService.generateReplayData(req.params.gameId);
    if (!replay) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    res.json({ success: true, data: replay });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/games/:gameId/report', (req, res) => {
  try {
    const format = req.query.format || 'json';
    const report = gameService.exportReport(req.params.gameId, format);
    if (!report) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    
    if (format === 'markdown') {
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="report-${req.params.gameId}.md"`);
    }
    
    res.send(report);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`定位捉迷藏游戏服务器启动成功!`);
  console.log(`地址: http://localhost:${PORT}`);
  console.log(`按 Ctrl+C 停止服务器`);
});
