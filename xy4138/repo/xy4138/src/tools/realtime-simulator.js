#!/usr/bin/env node

const WebSocket = require('ws');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function usage() {
  console.log(`
赛道遥测黑匣子 - 实时数据模拟器

用法:
  node src/tools/realtime-simulator.js [选项]

选项:
  --host <host>      WebSocket 服务器主机 (默认: localhost)
  --port <port>      WebSocket 服务器端口 (默认: 8080)
  --path <path>      WebSocket 路径 (默认: /ws/realtime)
  --interval <ms>    发送间隔 (默认: 100ms)
  --count <n>        发送帧数 (默认: 无限)
  --help             显示帮助信息

示例:
  # 使用默认设置连接
  node src/tools/realtime-simulator.js

  # 每 50ms 发送一帧，共 100 帧
  node src/tools/realtime-simulator.js --interval 50 --count 100

  # 连接到指定服务器
  node src/tools/realtime-simulator.js --host 192.168.1.100 --port 9000
`);
  process.exit(0);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    host: 'localhost',
    port: 8080,
    path: '/ws/realtime',
    interval: 100,
    count: Infinity
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--host':
        config.host = args[++i] || config.host;
        break;
      case '--port':
        config.port = parseInt(args[++i]) || config.port;
        break;
      case '--path':
        config.path = args[++i] || config.path;
        break;
      case '--interval':
        config.interval = parseInt(args[++i]) || config.interval;
        break;
      case '--count':
        config.count = parseInt(args[++i]) || config.count;
        break;
      case '--help':
        usage();
        break;
    }
  }

  return config;
}

const RobotState = {
  IDLE: 'IDLE',
  INITIALIZING: 'INITIALIZING',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  EMERGENCY_STOP: 'EMERGENCY_STOP',
  ERROR: 'ERROR',
  COMPLETED: 'COMPLETED'
};

class RealtimeSimulator {
  constructor(config) {
    this.config = config;
    this.ws = null;
    this.startTime = null;
    this.sequence = 0;
    this.frameCount = 0;
    this.intervalId = null;
    this.state = RobotState.IDLE;
    this.position = { x: 0, y: 0, theta: 0 };
    this.velocity = { linear: 0, angular: 0 };
    this.battery = 12.56;
    this.emergencyStop = false;
    this.connected = false;
    this.stopped = false;
  }

  connect() {
    const url = `ws://${this.config.host}:${this.config.port}${this.config.path}`;
    console.log(`连接到 ${url}...`);

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.connected = true;
      this.startTime = Date.now();
      console.log('✅ 已连接到服务器');
      console.log(`发送间隔: ${this.config.interval}ms`);
      if (this.config.count !== Infinity) {
        console.log(`发送帧数: ${this.config.count}`);
      } else {
        console.log(`发送帧数: 无限 (按 Ctrl+C 停止)`);
      }
      console.log('');
      this.startSending();
      this.showPrompt();
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleServerMessage(msg);
      } catch (e) {
        console.log(`收到消息: ${data.toString()}`);
      }
    });

    this.ws.on('close', (code, reason) => {
      this.connected = false;
      console.log(`\n❌ 连接已关闭 (code: ${code})`);
      this.stopSending();
      rl.close();
    });

    this.ws.on('error', (error) => {
      console.error(`连接错误: ${error.message}`);
      process.exit(1);
    });
  }

  handleServerMessage(msg) {
    switch (msg.type) {
      case 'control':
        console.log(`\n📥 收到控制指令: ${msg.action}`);
        if (msg.action === 'emergency_stop') {
          this.emergencyStop = true;
          this.state = RobotState.EMERGENCY_STOP;
          console.log('⚠️  触发急停!');
        } else if (msg.action === 'pause') {
          this.state = RobotState.PAUSED;
          this.velocity = { linear: 0, angular: 0 };
        } else if (msg.action === 'resume') {
          this.state = RobotState.RUNNING;
        }
        break;

      case 'info':
        console.log(`\n📥 服务器信息: ${msg.message}`);
        break;

      default:
        console.log(`\n📥 收到消息: ${JSON.stringify(msg)}`);
    }
  }

  generateFrame() {
    this.sequence++;
    this.frameCount++;

    const elapsed = Date.now() - this.startTime;
    const phase = this.sequence % 200;

    if (phase === 0 && this.state === RobotState.IDLE) {
      this.state = RobotState.INITIALIZING;
    } else if (phase === 10 && this.state === RobotState.INITIALIZING) {
      this.state = RobotState.RUNNING;
      this.velocity = { linear: 1.0, angular: 0.1 };
    } else if (phase === 100 && this.state === RobotState.RUNNING) {
      this.velocity = { linear: 1.5, angular: 0.05 };
    } else if (phase === 150 && this.state === RobotState.RUNNING) {
      this.velocity = { linear: 1.0, angular: 0.2 };
    }

    this.position.x += this.velocity.linear * Math.cos(this.position.theta) * (this.config.interval / 1000);
    this.position.y += this.velocity.linear * Math.sin(this.position.theta) * (this.config.interval / 1000);
    this.position.theta += this.velocity.angular * (this.config.interval / 1000);

    this.battery -= 0.001 + Math.random() * 0.002;

    const lidarData = Array(8).fill(0).map(() => 4.0 + Math.random() * 2.0);

    if (this.frameCount % 50 === 0 && Math.random() > 0.7) {
      lidarData[0] = 0.5 + Math.random() * 0.5;
      lidarData[1] = 0.6 + Math.random() * 0.4;
    }

    const commandAckLatency = 8 + Math.floor(Math.random() * 10);
    const sensorUpdateLatency = 4 + Math.floor(Math.random() * 5);

    return {
      type: 'telemetry',
      timestamp: this.startTime + elapsed,
      sequence: this.sequence,
      state: this.state,
      position: { ...this.position },
      velocity: { ...this.velocity },
      battery: Math.max(11.0, this.battery),
      emergency_stop: this.emergencyStop,
      sensors: {
        lidar: lidarData
      },
      latency: {
        command_ack: commandAckLatency,
        sensor_update: sensorUpdateLatency
      }
    };
  }

  startSending() {
    this.intervalId = setInterval(() => {
      if (this.stopped) return;
      
      if (this.frameCount >= this.config.count) {
        console.log(`\n✅ 已发送 ${this.frameCount} 帧，停止发送`);
        this.stopSending();
        this.ws.close();
        return;
      }

      const frame = this.generateFrame();
      
      try {
        this.ws.send(JSON.stringify(frame));
        
        if (this.frameCount % 10 === 0) {
          process.stdout.write(`\r📤 已发送 ${this.frameCount} 帧 (seq: ${frame.sequence}, state: ${frame.state})`);
        }

        if (this.frameCount % 30 === 0 && Math.random() > 0.8) {
          const event = {
            type: 'event',
            event_type: 'info',
            timestamp: Date.now(),
            message: `Simulated event at frame ${this.frameCount}`,
            data: { source: 'simulator' }
          };
          this.ws.send(JSON.stringify(event));
        }
      } catch (e) {
        console.error(`发送失败: ${e.message}`);
      }
    }, this.config.interval);
  }

  stopSending() {
    this.stopped = true;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  showPrompt() {
    rl.question('\n输入命令 (h=帮助, e=急停, r=恢复, p=暂停, t=状态, q=退出): ', (input) => {
      const cmd = input.trim().toLowerCase();
      
      switch (cmd) {
        case 'h':
        case 'help':
          console.log(`
可用命令:
  h, help      显示此帮助
  e, estop     发送急停
  r, resume    恢复运行
  p, pause     暂停
  t, status    显示当前状态
  q, quit      退出
`);
          break;

        case 'e':
        case 'estop':
          this.emergencyStop = true;
          this.state = RobotState.EMERGENCY_STOP;
          this.velocity = { linear: 0, angular: 0 };
          console.log('⚠️  触发急停!');
          
          const estopMsg = {
            type: 'telemetry',
            timestamp: Date.now(),
            sequence: ++this.sequence,
            state: RobotState.EMERGENCY_STOP,
            position: { ...this.position },
            velocity: { ...this.velocity },
            battery: this.battery,
            emergency_stop: true,
            sensors: { lidar: Array(8).fill(0).map(() => 0.5 + Math.random()) },
            latency: { command_ack: 5, sensor_update: 3 }
          };
          if (this.connected) {
            this.ws.send(JSON.stringify(estopMsg));
          }
          break;

        case 'r':
        case 'resume':
          this.emergencyStop = false;
          this.state = RobotState.RUNNING;
          this.velocity = { linear: 1.0, angular: 0.1 };
          console.log('✅ 恢复运行');
          break;

        case 'p':
        case 'pause':
          this.state = RobotState.PAUSED;
          this.velocity = { linear: 0, angular: 0 };
          console.log('⏸️  已暂停');
          break;

        case 't':
        case 'status':
          console.log(`
当前状态:
  已发送帧数: ${this.frameCount}
  序列: ${this.sequence}
  状态: ${this.state}
  位置: (${this.position.x.toFixed(2)}, ${this.position.y.toFixed(2)}, θ=${this.position.theta.toFixed(2)})
  速度: (线性=${this.velocity.linear.toFixed(2)}, 角=${this.velocity.angular.toFixed(2)})
  电池: ${this.battery.toFixed(2)}V
  急停: ${this.emergencyStop ? '是' : '否'}
`);
          break;

        case 'q':
        case 'quit':
          console.log('👋 退出...');
          this.stopSending();
          if (this.connected) {
            this.ws.close();
          }
          rl.close();
          return;

        default:
          console.log(`未知命令: ${cmd}，输入 h 查看帮助`);
      }

      this.showPrompt();
    });
  }

  start() {
    process.on('SIGINT', () => {
      console.log('\n\n收到 SIGINT，正在关闭...');
      this.stopSending();
      if (this.connected) {
        this.ws.close();
      }
      rl.close();
      process.exit(0);
    });

    this.connect();
  }
}

const config = parseArgs();
const simulator = new RealtimeSimulator(config);
simulator.start();
