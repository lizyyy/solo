const readline = require('readline');
const GameEngine = require('./game/GameEngine');
const ConsoleUI = require('./ui/ConsoleUI');
const { PORTS, GameStatus } = require('./game/constants');

class GameApp {
  constructor() {
    this.engine = new GameEngine();
    this.ui = new ConsoleUI();
    this.rl = null;
  }

  start() {
    this.ui.init(this.engine);
    this.setupInput();
    this.ui.renderWelcome();
  }

  setupInput() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (key) => {
      this.handleKey(key.toString());
    });
  }

  handleKey(key) {
    if (key === '\u0003') {
      this.shutdown();
      return;
    }

    const snapshot = this.engine.getGameSnapshot();
    
    switch (key.toLowerCase()) {
      case '1':
      case '2':
        this.engine.selectCrane(parseInt(key) - 1);
        break;
      case 'q':
        this.engine.pickContainer();
        break;
      case 'a':
        this.engine.placeContainer('SH');
        break;
      case 's':
        this.engine.placeContainer('SZ');
        break;
      case 'd':
        this.engine.placeContainer('GZ');
        break;
      case 'f':
        this.engine.placeContainer('TJ');
        break;
      case 'x':
        this.engine.cancelHold();
        break;
      case 'p':
        this.engine.togglePause();
        break;
      case 'r':
        this.engine.start();
        break;
      case 'v':
        const breakdown = this.engine.getScoreBreakdown();
        this.ui.renderScoreBreakdown(breakdown);
        break;
      case 'l':
        this.startReplay();
        return;
      case 'h':
        this.ui.renderHelp();
        return;
      case 'exit':
      case 'quit':
        this.shutdown();
        return;
      default:
        if (snapshot.status === GameStatus.IDLE) {
          this.engine.start();
        }
    }

    const currentSnapshot = this.engine.getGameSnapshot();
    this.ui.render(currentSnapshot);
  }

  async startReplay() {
    const actions = this.engine.startReplay();
    if (!actions) return;

    console.log('\n=== 回放开始 ===\n');
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      await new Promise(r => setTimeout(r, 800));
      
      if (action.type === 'PICK') {
        const port = PORTS.find(p => p.id === action.container.targetPort);
        console.log(
          `[${i + 1}/${actions.length}] 吊机${action.craneId + 1} 抓取 ` +
          `集装箱 #${action.container.id} (${action.container.weight}吨) → ${port.name}`
        );
      } else if (action.type === 'PLACE') {
        const port = PORTS.find(p => p.id === action.targetPort);
        const correctPort = PORTS.find(p => p.id === action.container.targetPort);
        const correct = action.targetPort === action.container.targetPort;
        const marker = correct ? '✓' : '✗';
        console.log(
          `[${i + 1}/${actions.length}] ${marker} 放置到 ${port.name} ` +
          `(正确: ${correctPort.name})`
        );
      }
    }
    console.log('\n=== 回放结束 ===\n');
    
    const snapshot = this.engine.getGameSnapshot();
    this.ui.render(snapshot);
  }

  shutdown() {
    console.log('\n再见！');
    this.engine.stopTimer?.();
    if (this.rl) this.rl.close();
    process.exit(0);
  }
}

const app = new GameApp();
app.start();
