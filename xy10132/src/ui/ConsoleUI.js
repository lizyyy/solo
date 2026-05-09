const readline = require('readline');
const { PORTS, GAME_CONFIG, GameStatus } = require('../game/constants');

class ConsoleUI {
  constructor() {
    this.rl = null;
    this.engine = null;
    this.lastSnapshot = null;
  }

  init(engine) {
    this.engine = engine;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
    
    engine.setCallbacks(
      (snapshot) => this.handleStateChange(snapshot),
      (msg) => this.handleMessage(msg)
    );
  }

  handleStateChange(snapshot) {
    this.lastSnapshot = snapshot;
  }

  handleMessage(msg) {
    const colors = {
      SUCCESS: '\x1b[32m',
      ERROR: '\x1b[31m',
      WARN: '\x1b[33m',
      INFO: '\x1b[36m',
    };
    const reset = '\x1b[0m';
    const color = colors[msg.type] || colors.INFO;
    console.log(`${color}[${msg.type}]${reset} ${msg.text}`);
  }

  clearScreen() {
    process.stdout.write('\x1Bc');
  }

  drawBorder(text, width = 60) {
    const padding = Math.max(0, width - text.length - 4);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return '═'.repeat(leftPad) + ` ${text} ` + '═'.repeat(rightPad);
  }

  renderStatusBar(snapshot) {
    const mins = Math.floor(snapshot.timeLeft / 60);
    const secs = snapshot.timeLeft % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    const timeColor = snapshot.timeLeft <= 30 ? '\x1b[31m' : '\x1b[36m';
    
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log(
      `║  ${'\x1b[33m'}分数: ${snapshot.score.toString().padStart(5, ' ')}${'\x1b[0m'}  ` +
      `${timeColor}时间: ${timeStr}${'\x1b[0m'}  ` +
      `${'\x1b[31m'}处罚: ${snapshot.penalties}/${GAME_CONFIG.maxPenalties}${'\x1b[0m'}  ` +
      `状态: ${this.getStatusText(snapshot.status)}` +
      ' '.repeat(12) + '║'
    );
    console.log('╚' + '═'.repeat(58) + '╝');
  }

  getStatusText(status) {
    const texts = {
      [GameStatus.IDLE]: '准备中',
      [GameStatus.PLAYING]: '\x1b[32m游戏中\x1b[0m',
      [GameStatus.PAUSED]: '\x1b[33m已暂停\x1b[0m',
      [GameStatus.ENDED]: '\x1b[31m已结束\x1b[0m',
      [GameStatus.REPLAY]: '\x1b[35m回放中\x1b[0m'
    };
    return texts[status] || status;
  }

  renderCranes(snapshot) {
    console.log('\n' + this.drawBorder('吊 机'));
    snapshot.cranes.forEach((crane, i) => {
      const selected = snapshot.selectedCrane === i;
      const holding = snapshot.holdingContainer && snapshot.selectedCrane === i;
      const available = !crane.busy && crane.cooldown <= 0;
      
      const status = holding 
        ? `抓取中 → 集装箱 #${crane.carryingContainer?.id}`
        : crane.cooldown > 0 
          ? `冷却中 (${crane.cooldown}s)` 
          : crane.busy 
            ? '忙碌' 
            : '可用';
      
      const marker = selected ? '▶' : ' ';
      const bg = selected ? '\x1b[44m' : '';
      const reset = '\x1b[0m';
      
      console.log(`${bg}${marker} [${i + 1}] 吊机 ${i + 1} - ${status}${reset}`);
    });
    console.log('═'.repeat(60));
  }

  renderContainer(snapshot) {
    console.log('\n' + this.drawBorder('当前集装箱'));
    const container = snapshot.currentContainer;
    if (container) {
      const targetPort = PORTS.find(p => p.id === container.targetPort);
      console.log(`\x1b[36m#${container.id}\x1b[0m  重量: \x1b[33m${container.weight}吨\x1b[0m  目的港: \x1b[35m${targetPort.name}\x1b[0m`);
      console.log(`颜色标识: ${targetPort.color}`);
    } else {
      console.log('等待下一个集装箱...');
    }
    console.log('═'.repeat(60));
  }

  renderPorts(snapshot) {
    console.log('\n' + this.drawBorder('港 口'));
    PORTS.forEach(port => {
      const containers = snapshot.portContainers[port.id];
      const weight = snapshot.portWeights[port.id];
      const capacity = GAME_CONFIG.portFullThreshold;
      const weightLimit = port.weightLimit * 3;
      const full = containers.length >= capacity;
      const overWeight = weight > weightLimit;
      
      const status = full 
        ? `${'\x1b[31m'}已满${'\x1b[0m'}` 
        : overWeight 
          ? `${'\x1b[31m'}超重${'\x1b[0m'}` 
          : `${'\x1b[32m'}可用${'\x1b[0m'}`;
      
      console.log(
        `${port.color}■${'\x1b[0m'} [${PORTS.indexOf(port) + 1}] ${port.name.padEnd(8, ' ')} ` +
        `${status} ` +
        `箱: ${containers.length}/${capacity}  ` +
        `重: ${weight}/${weightLimit}吨`
      );
    });
    console.log('═'.repeat(60));
  }

  renderHolding(snapshot) {
    if (snapshot.holdingContainer) {
      const c = snapshot.holdingContainer;
      const port = PORTS.find(p => p.id === c.targetPort);
      console.log(`\n${'\x1b[43m'}${'\x1b[30m'}[正在运送] 集装箱 #${c.id} (${c.weight}吨) → ${port.name}${'\x1b[0m'}`);
    }
  }

  renderHelp() {
    console.log('\n' + this.drawBorder('操作说明'));
    console.log('  1,2     → 选择吊机');
    console.log('  q       → 抓取当前集装箱');
    console.log('  a,s,d,f → 放置到对应港口 (a=上海, s=深圳, d=广州, f=天津)');
    console.log('  x       → 取消抓取');
    console.log('  p       → 暂停/继续');
    console.log('  r       → 重新开始');
    console.log('  v       → 查看计分明细');
    console.log('  l       → 回放本局');
    console.log('  h       → 显示帮助');
    console.log('  exit    → 退出游戏');
    console.log('═'.repeat(60));
  }

  renderScoreBreakdown(breakdown) {
    console.log('\n' + this.drawBorder('计分明细'));
    console.log(`\n${'\x1b[33m'}总分数: ${breakdown.totalScore}${'\x1b[0m'}`);
    console.log('─'.repeat(60));
    console.log(`\x1b[32m成功运送: ${breakdown.deliveries.count} 个集装箱，获得 ${breakdown.deliveries.totalPoints} 分${'\x1b[0m'}`);
    console.log(`\x1b[31m处罚次数: ${breakdown.penalties.count} 次，扣减 ${breakdown.penalties.totalDeduction} 分${'\x1b[0m'}`);
    
    if (Object.keys(breakdown.penalties.errorCount).length > 0) {
      console.log('  错误类型统计:');
      for (const [error, count] of Object.entries(breakdown.penalties.errorCount)) {
        console.log(`    - ${this.getErrorText(error)}: ${count}次`);
      }
    }
    
    console.log('\n各港口统计:');
    for (const [portId, stats] of Object.entries(breakdown.portStats)) {
      console.log(`  ${stats.name}: ${stats.count}箱 / ${stats.totalWeight}吨`);
    }
    
    console.log(`\n用时: ${breakdown.timeUsed}秒`);
    console.log(`处理集装箱: ${breakdown.containersProcessed}个`);
    console.log('═'.repeat(60));
  }

  getErrorText(error) {
    const texts = {
      WRONG_PORT: '错误港口',
      OVERWEIGHT: '超重',
      PORT_FULL: '港口已满',
      CRANE_BUSY: '吊机忙碌',
      TIME_OUT: '时间耗尽'
    };
    return texts[error] || error;
  }

  renderGameOver(breakdown) {
    console.log('\n');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║' + this.drawBorder('游 戏 结 束', 58) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
    this.renderScoreBreakdown(breakdown);
    console.log('\n按 r 重新开始，按 l 回放，按 exit 退出');
  }

  renderWelcome() {
    this.clearScreen();
    console.log('\n');
    console.log('╔' + '═'.repeat(58) + '╗');
    console.log('║' + this.drawBorder('港口吊机装箱节奏游戏', 58) + '║');
    console.log('╚' + '═'.repeat(58) + '╝');
    console.log('\n游戏规则:');
    console.log('  • 每个集装箱有重量和目的港');
    console.log('  • 选择吊机 → 抓取集装箱 → 运到对应目的港');
    console.log('  • 吊机使用后有冷却时间（重量越大冷却越久）');
    console.log('  • 每排错一次扣50分，累计5次错误游戏结束');
    console.log('  • 港口有容量限制和重量限制');
    console.log('  • 时间耗尽或错误过多导致压港则游戏失败');
    console.log('\n按任意键开始，或输入 h 查看帮助...');
  }

  render(snapshot) {
    this.clearScreen();
    this.renderStatusBar(snapshot);
    this.renderCranes(snapshot);
    this.renderContainer(snapshot);
    this.renderPorts(snapshot);
    this.renderHolding(snapshot);
    
    if (snapshot.status === GameStatus.IDLE) {
      this.renderHelp();
      console.log('\n按任意键开始游戏...');
    } else if (snapshot.status === GameStatus.ENDED) {
      this.renderGameOver(this.engine.getScoreBreakdown());
    } else {
      this.renderHelp();
    }
  }

  close() {
    if (this.rl) {
      this.rl.close();
    }
  }
}

module.exports = ConsoleUI;
