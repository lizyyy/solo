const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const config = require('./config');
const { SessionManager } = require('./services/sessionManager');
const { StateMachine } = require('./services/stateMachine');
const { RulesEngine } = require('./services/rulesEngine');
const { StorageService } = require('./services/storage');
const { ImportExportService } = require('./services/importExport');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

const sessionManager = new SessionManager();
const storageService = new StorageService(config.STORAGE_PATH);
const rulesEngine = new RulesEngine();
const importExportService = new ImportExportService(storageService, rulesEngine);

app.use(express.static(path.join(__dirname, '../../client/public')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/sessions', (req, res) => {
  const sessions = sessionManager.listSessions();
  res.json({ sessions });
});

app.post('/api/sessions', (req, res) => {
  const { name, description } = req.body;
  const sessionId = uuidv4();
  const stateMachine = new StateMachine(sessionId, {
    name: name || `Session-${sessionId.slice(0, 8)}`,
    description: description || '',
  });
  
  sessionManager.addSession(sessionId, stateMachine);
  res.json({ sessionId, name: stateMachine.getSessionInfo().name });
});

app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const stateMachine = sessionManager.getSession(sessionId);
  
  if (!stateMachine) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    sessionInfo: stateMachine.getSessionInfo(),
    connectionState: stateMachine.getCurrentState(),
    events: stateMachine.getEvents(),
  });
});

app.delete('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  sessionManager.removeSession(sessionId);
  res.json({ success: true });
});

app.post('/api/sessions/:sessionId/import', (req, res) => {
  const { sessionId } = req.params;
  const { data, type } = req.body;
  
  const stateMachine = sessionManager.getSession(sessionId);
  if (!stateMachine) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  try {
    const result = importExportService.importData(stateMachine, data, type);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/sessions/:sessionId/export', (req, res) => {
  const { sessionId } = req.params;
  const { format } = req.query;
  
  const stateMachine = sessionManager.getSession(sessionId);
  if (!stateMachine) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  try {
    const result = importExportService.exportData(stateMachine, format || 'json');
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/sessions/:sessionId/validate', (req, res) => {
  const { sessionId } = req.params;
  
  const stateMachine = sessionManager.getSession(sessionId);
  if (!stateMachine) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const validationResults = rulesEngine.validateAll(stateMachine);
  res.json({ validation: validationResults });
});

app.post('/api/sessions/:sessionId/network-inject', (req, res) => {
  const { sessionId } = req.params;
  const { type, latency, packetLoss, duration } = req.body;
  
  const stateMachine = sessionManager.getSession(sessionId);
  if (!stateMachine) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  stateMachine.injectNetworkEvent({
    type,
    latency,
    packetLoss,
    duration,
    timestamp: Date.now(),
  });
  
  res.json({ success: true, message: `Network event injected: ${type}` });
});

app.post('/api/sessions/:sessionId/save', async (req, res) => {
  const { sessionId } = req.params;
  
  const stateMachine = sessionManager.getSession(sessionId);
  if (!stateMachine) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  try {
    const savedPath = await storageService.saveReplay(sessionId, stateMachine);
    res.json({ success: true, path: savedPath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/replays', async (req, res) => {
  try {
    const replays = await storageService.listReplays();
    res.json({ replays });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/replays/:replayId', async (req, res) => {
  const { replayId } = req.params;
  
  try {
    const replay = await storageService.loadReplay(replayId);
    
    const sessionId = uuidv4();
    const stateMachine = new StateMachine(sessionId, {
      name: replay.sessionInfo?.name || `Replay-${replayId.slice(0, 8)}`,
      description: replay.sessionInfo?.description || '',
    });
    
    if (replay.events) {
      for (const event of replay.events) {
        stateMachine.addEvent(event);
      }
    }
    
    sessionManager.addSession(sessionId, stateMachine);
    res.json({ sessionId, replayData: replay });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

wss.on('connection', (ws) => {
  console.log('WebSocket connection established');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('WebSocket message received:', data.type);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

const PORT = config.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  WebRTC Replay Station`);
  console.log(`========================================`);
  console.log(`  Server running on port ${PORT}`);
  console.log(`  Web UI: http://localhost:${PORT}`);
  console.log(`  API: http://localhost:${PORT}/api`);
  console.log(`========================================\n`);
});
