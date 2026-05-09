const GameState = require('./GameState');
const { GameStatus, ErrorType, PORTS, GAME_CONFIG } = require('./constants');

class GameEngine {
  constructor() {
    this.state = new GameState();
    this.selectedCrane = null;
    this.holdingContainer = null;
    this.timer = null;
    this.replayIndex = 0;
    this.onStateChange = null;
    this.onMessage = null;
  }

  setCallbacks(onStateChange, onMessage) {
    this.onStateChange = onStateChange;
    this.onMessage = onMessage;
  }

  notify() {
    if (this.onStateChange) {
      this.onStateChange(this.getGameSnapshot());
    }
  }

  sendMessage(msg, type = 'INFO') {
    if (this.onMessage) {
      this.onMessage({ text: msg, type });
    }
  }

  getGameSnapshot() {
    return {
      status: this.state.status,
      score: this.state.score,
      timeLeft: this.state.timeLeft,
      currentContainer: this.state.currentContainer,
      containers: [...this.state.containers],
      cranes: this.state.cranes.map(c => ({ ...c })),
      portContainers: { ...this.state.portContainers },
      portWeights: { ...this.state.portWeights },
      penalties: this.state.penalties,
      lastError: this.state.lastError,
      scoreDetails: [...this.state.scoreDetails],
      selectedCrane: this.selectedCrane,
      holdingContainer: this.holdingContainer
    };
  }

  start() {
    this.stopTimer();
    this.state.start();
    this.selectedCrane = null;
    this.holdingContainer = null;
    this.startTimer();
    this.sendMessage('游戏开始！将集装箱运送到对应的目的港！', 'SUCCESS');
    this.notify();
  }

  startTimer() {
    this.timer = setInterval(() => {
      if (this.state.isPlaying()) {
        this.state.tickTime();
        if (this.state.isEnded()) {
          this.stopTimer();
          this.sendMessage('时间耗尽！游戏结束。', 'ERROR');
        }
        this.notify();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  pause() {
    if (this.state.isPlaying()) {
      this.state.pause();
      this.sendMessage('游戏已暂停', 'INFO');
      this.notify();
    }
  }

  resume() {
    if (this.state.isPaused()) {
      this.state.resume();
      this.sendMessage('游戏继续', 'SUCCESS');
      this.notify();
    }
  }

  restart() {
    this.start();
  }

  togglePause() {
    if (this.state.isPlaying()) {
      this.pause();
    } else if (this.state.isPaused()) {
      this.resume();
    }
  }

  selectCrane(craneId) {
    if (!this.state.isPlaying()) {
      this.sendMessage('游戏未进行中', 'WARN');
      return;
    }

    if (!this.state.canUseCrane(craneId)) {
      const crane = this.state.cranes[craneId];
      if (crane && crane.cooldown > 0) {
        this.sendMessage(`吊机${craneId + 1}冷却中，剩余${crane.cooldown}秒`, 'WARN');
      } else {
        this.sendMessage(`吊机${craneId + 1}忙`, 'WARN');
      }
      return;
    }

    if (this.holdingContainer) {
      this.sendMessage('请先放下当前集装箱', 'WARN');
      return;
    }

    if (this.selectedCrane === craneId) {
      this.selectedCrane = null;
      this.notify();
      return;
    }

    this.selectedCrane = craneId;
    this.notify();
  }

  pickContainer() {
    if (!this.state.isPlaying()) {
      this.sendMessage('游戏未进行中', 'WARN');
      return;
    }

    if (this.holdingContainer) {
      this.sendMessage('请先放下当前集装箱', 'WARN');
      return;
    }

    if (this.selectedCrane === null) {
      this.sendMessage('请先选择一台可用的吊机', 'WARN');
      return;
    }

    if (!this.state.currentContainer) {
      this.sendMessage('没有可用的集装箱', 'WARN');
      return;
    }

    const container = this.state.currentContainer;
    if (this.state.assignContainerToCrane(this.selectedCrane, container)) {
      this.holdingContainer = container;
      this.state.nextContainer();
      
      const targetPort = PORTS.find(p => p.id === container.targetPort);
      this.sendMessage(`已抓取集装箱 #${container.id} (${container.weight}吨) → 目的港: ${targetPort.name}`, 'INFO');
      this.state.recordAction({
        type: 'PICK',
        craneId: this.selectedCrane,
        container: { ...container }
      });
      this.notify();
    }
  }

  placeContainer(targetPortId) {
    if (!this.state.isPlaying()) {
      this.sendMessage('游戏未进行中', 'WARN');
      return;
    }

    if (!this.holdingContainer) {
      this.sendMessage('没有抓取集装箱', 'WARN');
      return;
    }

    if (this.selectedCrane === null) {
      this.sendMessage('请先选择吊机', 'WARN');
      return;
    }

    const container = this.holdingContainer;
    const targetPort = PORTS.find(p => p.id === targetPortId);

    this.state.recordAction({
      type: 'PLACE',
      craneId: this.selectedCrane,
      container: { ...container },
      targetPort: targetPortId
    });

    const result = this.state.placeContainer(container, targetPortId);

    if (result.valid) {
      this.sendMessage(`成功运送至${targetPort.name}！+${result.points}分`, 'SUCCESS');
    } else {
      const errorMsgs = {
        [ErrorType.WRONG_PORT]: '错误的目的港！',
        [ErrorType.OVERWEIGHT]: `${targetPort.name}超重！`,
        [ErrorType.PORT_FULL]: `${targetPort.name}已满！`,
      };
      this.sendMessage(
        `${errorMsgs[result.error] || '放置失败'} -${GAME_CONFIG.penalty}分 ` +
        `(已处罚${this.state.penalties}/${GAME_CONFIG.maxPenalties}次)`,
        'ERROR'
      );
    }

    this.state.releaseCrane(this.selectedCrane);
    this.holdingContainer = null;
    this.selectedCrane = null;
    this.notify();
  }

  cancelHold() {
    if (this.holdingContainer && this.selectedCrane !== null) {
      this.state.releaseCrane(this.selectedCrane);
      this.sendMessage('已取消抓取', 'INFO');
    }
    this.holdingContainer = null;
    this.selectedCrane = null;
    this.notify();
  }

  startReplay() {
    if (this.state.actionHistory.length === 0) {
      this.sendMessage('没有回放记录', 'WARN');
      return null;
    }
    
    this.replayIndex = 0;
    this.state.status = GameStatus.REPLAY;
    this.sendMessage('开始回放...', 'INFO');
    this.notify();
    return this.state.actionHistory;
  }

  getNextReplayAction() {
    if (this.state.actionHistory.length === 0 || this.replayIndex >= this.state.actionHistory.length) {
      return null;
    }
    return this.state.actionHistory[this.replayIndex++];
  }

  isReplayComplete() {
    return this.replayIndex >= this.state.actionHistory.length;
  }

  getScoreBreakdown() {
    const deliveries = this.state.scoreDetails.filter(d => d.type === 'DELIVER');
    const penalties = this.state.scoreDetails.filter(d => d.type === 'PENALTY');

    const errorCount = {};
    penalties.forEach(p => {
      errorCount[p.error] = (errorCount[p.error] || 0) + 1;
    });

    const portStats = {};
    PORTS.forEach(port => {
      portStats[port.id] = {
        name: port.name,
        count: this.state.portContainers[port.id].length,
        totalWeight: this.state.portWeights[port.id]
      };
    });

    return {
      totalScore: this.state.score,
      deliveries: {
        count: deliveries.length,
        totalPoints: deliveries.reduce((sum, d) => sum + d.points, 0)
      },
      penalties: {
        count: penalties.length,
        totalDeduction: Math.abs(penalties.reduce((sum, d) => sum + d.points, 0)),
        errorCount
      },
      portStats,
      timeUsed: GAME_CONFIG.initialTime - this.state.timeLeft,
      containersProcessed: this.state.containerIdCounter - this.state.containers.length
    };
  }
}

module.exports = GameEngine;
