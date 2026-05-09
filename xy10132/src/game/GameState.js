const { GameStatus, ErrorType, PORTS, GAME_CONFIG } = require('./constants');

class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.status = GameStatus.IDLE;
    this.score = 0;
    this.timeLeft = GAME_CONFIG.initialTime;
    this.containers = [];
    this.currentContainer = null;
    this.cranes = [
      { id: 0, cooldown: 0, busy: false, carryingContainer: null },
      { id: 1, cooldown: 0, busy: false, carryingContainer: null }
    ];
    this.portContainers = {};
    this.portWeights = {};
    PORTS.forEach(port => {
      this.portContainers[port.id] = [];
      this.portWeights[port.id] = 0;
    });
    this.penalties = 0;
    this.lastError = ErrorType.NONE;
    this.scoreDetails = [];
    this.actionHistory = [];
    this.containerIdCounter = 0;
  }

  start() {
    this.reset();
    this.status = GameStatus.PLAYING;
    this.generateContainers();
    this.nextContainer();
  }

  pause() {
    if (this.status === GameStatus.PLAYING) {
      this.status = GameStatus.PAUSED;
    }
  }

  resume() {
    if (this.status === GameStatus.PAUSED) {
      this.status = GameStatus.PLAYING;
    }
  }

  end(reason = ErrorType.NONE) {
    this.status = GameStatus.ENDED;
    this.lastError = reason;
  }

  isPlaying() {
    return this.status === GameStatus.PLAYING;
  }

  isPaused() {
    return this.status === GameStatus.PAUSED;
  }

  isEnded() {
    return this.status === GameStatus.ENDED;
  }

  generateContainers() {
    for (let i = 0; i < GAME_CONFIG.containersPerRound; i++) {
      const container = this.createContainer();
      this.containers.push(container);
    }
  }

  createContainer() {
    const targetPort = PORTS[Math.floor(Math.random() * PORTS.length)];
    const weight = GAME_CONFIG.minWeight + 
      Math.floor(Math.random() * (targetPort.weightLimit - GAME_CONFIG.minWeight + 1));
    
    return {
      id: ++this.containerIdCounter,
      weight,
      targetPort: targetPort.id,
      color: targetPort.color
    };
  }

  nextContainer() {
    if (this.containers.length === 0) {
      this.generateContainers();
    }
    this.currentContainer = this.containers.shift();
    return this.currentContainer;
  }

  canUseCrane(craneId) {
    const crane = this.cranes[craneId];
    if (!crane) return false;
    return !crane.busy && crane.cooldown <= 0;
  }

  getAvailableCrane() {
    return this.cranes.find(c => !c.busy && c.cooldown <= 0) || null;
  }

  assignContainerToCrane(craneId, container) {
    const crane = this.cranes[craneId];
    if (!crane || !this.canUseCrane(craneId)) {
      return false;
    }
    crane.busy = true;
    crane.carryingContainer = container;
    crane.cooldown = Math.ceil(container.weight / 10);
    return true;
  }

  releaseCrane(craneId) {
    const crane = this.cranes[craneId];
    if (crane) {
      crane.busy = false;
      crane.carryingContainer = null;
    }
  }

  updateCraneCooldowns() {
    this.cranes.forEach(crane => {
      if (crane.cooldown > 0) {
        crane.cooldown--;
      }
    });
  }

  tickTime() {
    if (this.timeLeft > 0) {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.end(ErrorType.TIME_OUT);
        return false;
      }
    }
    this.updateCraneCooldowns();
    return true;
  }

  addScoreDetail(detail) {
    this.scoreDetails.push({
      ...detail,
      timestamp: Date.now()
    });
  }

  recordAction(action) {
    this.actionHistory.push({
      ...action,
      timestamp: Date.now()
    });
  }

  validatePlacement(container, targetPortId) {
    const targetPort = PORTS.find(p => p.id === targetPortId);
    
    if (!targetPort) {
      return { valid: false, error: ErrorType.WRONG_PORT };
    }

    if (container.targetPort !== targetPortId) {
      return { valid: false, error: ErrorType.WRONG_PORT };
    }

    if (this.portContainers[targetPortId].length >= GAME_CONFIG.portFullThreshold) {
      return { valid: false, error: ErrorType.PORT_FULL };
    }

    if (this.portWeights[targetPortId] + container.weight > targetPort.weightLimit * 3) {
      return { valid: false, error: ErrorType.OVERWEIGHT };
    }

    return { valid: true, error: ErrorType.NONE };
  }

  placeContainer(container, targetPortId) {
    const validation = this.validatePlacement(container, targetPortId);
    
    if (!validation.valid) {
      this.penalties++;
      this.score = Math.max(0, this.score - GAME_CONFIG.penalty);
      this.lastError = validation.error;
      
      this.addScoreDetail({
        type: 'PENALTY',
        error: validation.error,
        points: -GAME_CONFIG.penalty
      });

      if (this.penalties >= GAME_CONFIG.maxPenalties) {
        this.end(validation.error);
      }
      
      return validation;
    }

    const points = GAME_CONFIG.baseScore + container.weight * GAME_CONFIG.weightBonusMultiplier;
    this.score += points;
    this.portContainers[targetPortId].push(container);
    this.portWeights[targetPortId] += container.weight;
    this.lastError = ErrorType.NONE;

    this.addScoreDetail({
      type: 'DELIVER',
      containerId: container.id,
      targetPort: targetPortId,
      weight: container.weight,
      points
    });

    return { valid: true, points, error: ErrorType.NONE };
  }
}

module.exports = GameState;
