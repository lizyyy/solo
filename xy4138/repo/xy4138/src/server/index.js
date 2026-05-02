#!/usr/bin/env node

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');

const JSONLParser = require('./parsers/jsonl-parser');
const CSVParser = require('./parsers/csv-parser');
const YAMLParser = require('./parsers/yaml-parser');
const DataParser = require('./parsers');
const ReplayScheduler = require('./scheduler/replay-scheduler');
const RealtimeReceiver = require('./scheduler/realtime-receiver');
const SessionStore = require('./storage/session-store');
const ReportExporter = require('./exporters/report-exporter');
const { MessageType, ControlAction, createControlMessage } = require('./protocols/messages');

const DEFAULT_PORT = 8080;
const DEFAULT_HOST = 'localhost';

class TelemetryServer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      port: options.port || DEFAULT_PORT,
      host: options.host || DEFAULT_HOST,
      dataDir: options.dataDir || path.join(__dirname, '..', '..', 'data'),
      sessionDir: options.sessionDir || path.join(__dirname, '..', '..', 'sessions'),
      publicDir: options.publicDir || path.join(__dirname, '..', 'public'),
      ...options
    };

    this.app = null;
    this.httpServer = null;
    this.replayWsServer = null;
    this.realtimeReceiver = null;
    
    this.replayScheduler = new ReplayScheduler();
    this.sessionStore = new SessionStore(this.options.sessionDir);
    this.reportExporter = new ReportExporter();
    
    this.jsonlParser = new JSONLParser();
    this.csvParser = new CSVParser();
    this.yamlParser = new YAMLParser();
    this.dataParser = new DataParser();
    
    this.connectedClients = new Set();
    this.currentMode = 'idle';
    this.loadedData = null;
    this.analysisResults = null;
  }

  async initialize() {
    this._ensureDirectories();
    this._setupExpress();
    this._setupWebSockets();
    this._setupEventHandlers();
    
    console.log('赛道遥测黑匣子服务器初始化完成');
    console.log(`  数据目录: ${this.options.dataDir}`);
    console.log(`  会话目录: ${this.options.sessionDir}`);
    console.log(`  静态目录: ${this.options.publicDir}`);
  }

  _ensureDirectories() {
    const dirs = [
      this.options.dataDir,
      this.options.sessionDir,
      this.options.publicDir
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`创建目录: ${dir}`);
      }
    });
  }

  _setupExpress() {
    this.app = express();
    
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    
    this.app.use(express.static(this.options.publicDir));
    
    this._setupAPIRoutes();
    
    this.app.use((err, req, res, next) => {
      console.error(`API 错误: ${err.message}`);
      res.status(500).json({ error: err.message, success: false });
    });
  }

  _setupAPIRoutes() {
    const router = express.Router();

    router.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        mode: this.currentMode,
        clients: this.connectedClients.size,
        timestamp: Date.now()
      });
    });

    router.post('/data/upload', async (req, res) => {
      try {
        const { type, content, filename } = req.body;
        
        if (!type || !content) {
          return res.status(400).json({ error: '缺少 type 或 content', success: false });
        }

        let result;
        
        switch (type) {
          case 'jsonl':
            result = this.jsonlParser.parseString(content);
            break;
          case 'csv':
            result = await this.csvParser.parseString(content);
            break;
          case 'yaml':
            result = this.yamlParser.parseString(content);
            break;
          default:
            return res.status(400).json({ error: `不支持的类型: ${type}`, success: false });
        }

        res.json({
          success: true,
          type,
          count: Array.isArray(result) ? result.length : 1,
          data: result
        });
      } catch (error) {
        res.status(500).json({ error: error.message, success: false });
      }
    });

    router.post('/data/load', async (req, res) => {
      try {
        const { telemetry, commands, track } = req.body;
        
        const data = {
          telemetry: null,
          telemetryRaw: null,
          commands: null,
          commandsRaw: null,
          track: null,
          trackRaw: null,
          mergedFrames: null
        };

        let telemetryRecords = null;
        let commandRecords = null;

        if (telemetry) {
          const telemetryPath = path.isAbsolute(telemetry) 
            ? telemetry 
            : path.join(this.options.dataDir, telemetry);
          
          if (fs.existsSync(telemetryPath)) {
            const result = await this.jsonlParser.parseFile(telemetryPath);
            data.telemetryRaw = result;
            telemetryRecords = result.records;
            data.telemetry = telemetryRecords;
            console.log(`加载遥测数据: ${telemetryRecords.length} 条`);
            if (result.errors.length > 0) {
              console.log(`  ⚠️  解析错误: ${result.errors.length} 个`);
            }
          }
        }

        if (commands) {
          const commandsPath = path.isAbsolute(commands)
            ? commands
            : path.join(this.options.dataDir, commands);
          
          if (fs.existsSync(commandsPath)) {
            const result = await this.csvParser.parseFile(commandsPath);
            data.commandsRaw = result;
            commandRecords = result.records;
            data.commands = commandRecords;
            console.log(`加载控制指令: ${commandRecords.length} 条`);
            if (result.errors.length > 0) {
              console.log(`  ⚠️  解析错误: ${result.errors.length} 个`);
            }
          }
        }

        if (track) {
          const trackPath = path.isAbsolute(track)
            ? track
            : path.join(this.options.dataDir, track);
          
          if (fs.existsSync(trackPath)) {
            const result = await this.yamlParser.parseFile(trackPath);
            data.trackRaw = result;
            data.track = result.data;
            console.log(`加载赛道标注: ${data.track?.name || data.track?.track_name || 'unnamed'}`);
            if (result.errors.length > 0) {
              console.log(`  ⚠️  解析错误: ${result.errors.length} 个`);
            }
          }
        }

        if (telemetryRecords) {
          const mergedResult = this.dataParser.mergeTelemetryAndCommands(
            telemetryRecords,
            commandRecords || []
          );
          data.mergedFrames = mergedResult;
          
          this.analysisResults = {
            stateChanges: this.dataParser.detectStateChanges(telemetryRecords),
            emergencyStops: this.dataParser.detectEmergencyStops(telemetryRecords),
            latency: commandRecords ? this.dataParser.calculateLatency(commandRecords, telemetryRecords) : null
          };

          const framesForScheduler = data.mergedFrames
            .filter(f => f.telemetry)
            .map(f => ({
              ...f.telemetry,
              _commands: f.commands
            }))
            .filter(f => f.sequence !== undefined);

          this.replayScheduler.loadFrames(framesForScheduler);
          this.loadedData = data;
          this.currentMode = 'replay';

          console.log(`数据加载完成: ${framesForScheduler.length} 帧`);
        }

        res.json({
          success: true,
          mode: this.currentMode,
          frameCount: data.mergedFrames ? data.mergedFrames.length : 0,
          duration: this.replayScheduler.getDuration(),
          analysis: this.analysisResults,
          track: data.track,
          parseInfo: {
            telemetry: data.telemetryRaw?.stats,
            commands: data.commandsRaw?.stats
          }
        });
      } catch (error) {
        console.error(`加载数据失败: ${error.message}`);
        console.error(error.stack);
        res.status(500).json({ error: error.message, success: false });
      }
    });

    router.get('/data/list', (req, res) => {
      try {
        const files = fs.readdirSync(this.options.dataDir);
        const dataFiles = files
          .filter(f => ['.jsonl', '.csv', '.yaml', '.yml'].includes(path.extname(f)))
          .map(f => {
            const stat = fs.statSync(path.join(this.options.dataDir, f));
            return {
              name: f,
              size: stat.size,
              modified: stat.mtime.toISOString(),
              type: this._getFileType(f)
            };
          });
        
        res.json({ success: true, files: dataFiles });
      } catch (error) {
        res.status(500).json({ error: error.message, success: false });
      }
    });

    router.post('/control', (req, res) => {
      try {
        const { action, params } = req.body;
        
        if (!action) {
          return res.status(400).json({ error: '缺少 action', success: false });
        }

        const result = this.replayScheduler.handleControlAction(action, params);
        
        if (this.connectedClients.size > 0) {
          const msg = createControlMessage(action, params);
          this._broadcastToClients(msg);
        }

        res.json({
          success: true,
          action,
          result,
          status: this.replayScheduler.getStatus()
        });
      } catch (error) {
        res.status(500).json({ error: error.message, success: false });
      }
    });

    router.get('/status', (req, res) => {
      res.json({
        success: true,
        mode: this.currentMode,
        replayStatus: this.replayScheduler.getStatus(),
        analysis: this.analysisResults,
        loaded: this.loadedData !== null,
        frameCount: this.replayScheduler.getFrameCount()
      });
    });

    router.post('/sessions', (req, res) => {
      try {
        const sessionData = {
          ...req.body,
          createdAt: new Date().toISOString()
        };
        
        const id = this.sessionStore.save(sessionData);
        res.json({ success: true, id });
      } catch (error) {
        res.status(500).json({ error: error.message, success: false });
      }
    });

    router.get('/sessions', (req, res) => {
      try {
        const sessions = this.sessionStore.list();
        res.json({ success: true, sessions });
      } catch (error) {
        res.status(500).json({ error: error.message, success: false });
      }
    });

    router.get('/sessions/:id', (req, res) => {
      try {
        const session = this.sessionStore.load(req.params.id);
        if (session === null) {
          return res.status(404).json({ error: '会话不存在', success: false });
        }
        res.json({ success: true, session });
      } catch (error) {
        res.status(500).json({ error: error.message, success: false });
      }
    });

    router.delete('/sessions/:id', (req, res) => {
      try {
        this.sessionStore.delete(req.params.id);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message, success: false });
      }
    });

    router.post('/export/:format', async (req, res) => {
      try {
        const format = req.params.format.toLowerCase();
        const exportData = req.body;
        
        let content, contentType, extension;
        
        switch (format) {
          case 'markdown':
          case 'md':
            content = this.reportExporter.exportMarkdown(exportData);
            contentType = 'text/markdown';
            extension = 'md';
            break;
          
          case 'csv':
            content = this.reportExporter.exportCSV(exportData);
            contentType = 'text/csv';
            extension = 'csv';
            break;
          
          case 'json':
            content = this.reportExporter.exportJSON(exportData);
            contentType = 'application/json';
            extension = 'json';
            break;
          
          default:
            return res.status(400).json({ 
              error: `不支持的导出格式: ${format}`, 
              success: false 
            });
        }

        const filename = `report_${Date.now()}.${extension}`;
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(content);
      } catch (error) {
        res.status(500).json({ error: error.message, success: false });
      }
    });

    router.get('/samples', (req, res) => {
      const samples = [
        {
          name: '示例遥测数据',
          file: 'sample-telemetry.jsonl',
          description: '包含 50 帧完整遥测数据，含急停事件'
        },
        {
          name: '示例控制指令',
          file: 'sample-commands.csv',
          description: '包含 50 条控制指令，含急停命令'
        },
        {
          name: '示例赛道标注',
          file: 'sample-track.yaml',
          description: '标准 L 型赛道，含 7 个检查点和 3 个障碍物'
        }
      ];
      
      res.json({ success: true, samples });
    });

    this.app.use('/api', router);
  }

  _getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
      case '.jsonl': return 'telemetry';
      case '.csv': return 'commands';
      case '.yaml':
      case '.yml': return 'track';
      default: return 'unknown';
    }
  }

  _setupWebSockets() {
    this.httpServer = http.createServer(this.app);
    this.replayWsServer = new WebSocket.Server({ noServer: true });
    this.realtimeReceiver = new RealtimeReceiver();

    this.replayWsServer.on('connection', (ws, req) => {
      this._handleReplayClient(ws, req);
    });

    this.httpServer.on('upgrade', (request, socket, head) => {
      const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

      if (pathname === '/ws/replay') {
        this.replayWsServer.handleUpgrade(request, socket, head, (ws) => {
          this.replayWsServer.emit('connection', ws, request);
        });
      } else if (pathname === '/ws/realtime') {
        this.realtimeReceiver.handleUpgrade(request, socket, head);
      } else {
        socket.destroy();
      }
    });

    this.realtimeReceiver.on('telemetry', (data) => {
      this._broadcastToClients({
        type: 'telemetry',
        ...data
      });
    });

    this.realtimeReceiver.on('event', (data) => {
      this._broadcastToClients({
        type: 'event',
        ...data
      });
    });
  }

  _handleReplayClient(ws, req) {
    console.log('新的回放客户端连接');
    this.connectedClients.add(ws);

    const initialStatus = {
      type: 'info',
      message: 'Connected to telemetry server',
      status: this.replayScheduler.getStatus(),
      mode: this.currentMode,
      timestamp: Date.now()
    };
    
    if (this.loadedData && this.loadedData.mergedFrames) {
      initialStatus.frameCount = this.loadedData.mergedFrames.length;
      initialStatus.duration = this.replayScheduler.getDuration();
    }

    ws.send(JSON.stringify(initialStatus));

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this._handleClientMessage(ws, msg);
      } catch (e) {
        console.error(`客户端消息解析错误: ${e.message}`);
      }
    });

    ws.on('close', () => {
      console.log('回放客户端断开');
      this.connectedClients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket 错误: ${error.message}`);
      this.connectedClients.delete(ws);
    });
  }

  _handleClientMessage(ws, msg) {
    switch (msg.type) {
      case 'control':
        this.replayScheduler.handleControlAction(msg.action, msg.params);
        break;
      
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
      
      case 'get_status':
        ws.send(JSON.stringify({
          type: 'status',
          status: this.replayScheduler.getStatus(),
          mode: this.currentMode,
          analysis: this.analysisResults
        }));
        break;
    }
  }

  _broadcastToClients(message) {
    const data = JSON.stringify(message);
    
    for (const client of this.connectedClients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(data);
        } catch (e) {
          console.error(`广播消息失败: ${e.message}`);
        }
      }
    }
  }

  _setupEventHandlers() {
    this.replayScheduler.on('frame', (frame) => {
      this._broadcastToClients({
        type: 'telemetry',
        ...frame
      });
    });

    this.replayScheduler.on('status', (status) => {
      this._broadcastToClients({
        type: 'status',
        status
      });
    });

    this.replayScheduler.on('event', (event) => {
      this._broadcastToClients({
        type: 'event',
        ...event
      });
    });

    this.replayScheduler.on('seek', (info) => {
      this._broadcastToClients({
        type: 'seek',
        ...info
      });
    });
  }

  async start() {
    await this.initialize();

    return new Promise((resolve, reject) => {
      this.httpServer.listen(this.options.port, this.options.host, () => {
        console.log('\n' + '='.repeat(60));
        console.log('赛道遥测黑匣子 - 服务器已启动');
        console.log('='.repeat(60));
        console.log(`\n  Web 界面:   http://${this.options.host}:${this.options.port}`);
        console.log(`  API 接口:   http://${this.options.host}:${this.options.port}/api`);
        console.log(`  回放 WS:    ws://${this.options.host}:${this.options.port}/ws/replay`);
        console.log(`  实时 WS:    ws://${this.options.host}:${this.options.port}/ws/realtime`);
        console.log('\n' + '='.repeat(60));
        console.log('可用命令:');
        console.log('  加载示例数据: POST /api/data/load');
        console.log('  控制回放:     POST /api/control');
        console.log('  导出报告:     POST /api/export/:format');
        console.log('='.repeat(60) + '\n');
        
        resolve();
      });

      this.httpServer.on('error', (error) => {
        console.error(`服务器启动失败: ${error.message}`);
        reject(error);
      });
    });
  }

  async stop() {
    console.log('正在关闭服务器...');
    
    this.replayScheduler.pause();
    
    for (const client of this.connectedClients) {
      client.close();
    }
    this.connectedClients.clear();
    
    if (this.realtimeReceiver) {
      this.realtimeReceiver.stop();
    }
    
    if (this.replayWsServer) {
      this.replayWsServer.close();
    }
    
    if (this.httpServer) {
      return new Promise((resolve) => {
        this.httpServer.close(() => {
          console.log('服务器已关闭');
          resolve();
        });
      });
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    port: DEFAULT_PORT,
    host: DEFAULT_HOST
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--port':
      case '-p':
        config.port = parseInt(args[++i]) || DEFAULT_PORT;
        break;
      case '--host':
      case '-h':
        config.host = args[++i] || DEFAULT_HOST;
        break;
      case '--help':
        console.log(`
赛道遥测黑匣子 - 遥测回放与实时监控服务器

用法:
  node src/server/index.js [选项]

选项:
  --port, -p <port>    服务器端口 (默认: ${DEFAULT_PORT})
  --host, -h <host>    服务器主机 (默认: ${DEFAULT_HOST})
  --help               显示帮助信息

示例:
  # 使用默认设置启动
  node src/server/index.js

  # 在指定端口启动
  node src/server/index.js --port 9000

  # 绑定到所有接口
  node src/server/index.js --host 0.0.0.0
`);
        process.exit(0);
    }
  }

  return config;
}

async function main() {
  const config = parseArgs();
  const server = new TelemetryServer(config);

  process.on('SIGINT', async () => {
    console.log('\n收到 SIGINT，正在优雅关闭...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n收到 SIGTERM，正在优雅关闭...');
    await server.stop();
    process.exit(0);
  });

  try {
    await server.start();
  } catch (error) {
    console.error(`启动失败: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = TelemetryServer;
