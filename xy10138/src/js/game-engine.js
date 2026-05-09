(function(root) {
  let constants;
  let Logger;

  if (typeof module !== 'undefined' && module.exports) {
    constants = require('./constants.js');
    Logger = require('./game-logger.js');
  } else {
    constants = GameConstants;
    Logger = GameLogger;
  }

  class GameEngine {
    constructor() {
      this.state = constants.GAME_STATE.IDLE;
      this.score = 0;
      this.timeRemaining = constants.GAME_TIME;
      this.robots = [];
      this.cargos = [];
      this.walls = [];
      this.selectedRobot = null;
      this.logger = new Logger();
      this.moveHistory = [];
      this.timerId = null;
      this.replayIndex = 0;
    }

    init() {
      this.reset();
    }

    reset() {
      this.stopTimer();
      this.state = constants.GAME_STATE.IDLE;
      this.score = 0;
      this.timeRemaining = constants.GAME_TIME;
      this.selectedRobot = null;
      this.logger.clear();
      this.moveHistory = [];
      this.replayIndex = 0;
      this._generateLevel();
    }

    _generateLevel() {
      this.robots = [
        { id: 1, x: 1, y: 1, carrying: false, color: constants.COLORS.ROBOT_1 },
        { id: 2, x: constants.GRID_WIDTH - 2, y: 1, carrying: false, color: constants.COLORS.ROBOT_2 },
        { id: 3, x: 6, y: constants.GRID_HEIGHT - 2, carrying: false, color: constants.COLORS.ROBOT_3 },
      ];

      this.cargos = [];
      const cargoPositions = [
        { x: 4, y: 2 }, { x: 7, y: 2 }, { x: 2, y: 5 },
        { x: 9, y: 5 }, { x: 5, y: 7 }, { x: 8, y: 7 },
        { x: 3, y: 4 }, { x: 6, y: 4 }, { x: 10, y: 3 },
        { x: 1, y: 7 }, { x: 10, y: 7 }, { x: 5, y: 2 },
      ];

      cargoPositions.forEach((pos, idx) => {
        this.cargos.push({
          id: idx + 1,
          x: pos.x,
          y: pos.y,
          picked: false,
          pickedBy: null,
        });
      });

      this.walls = this._generateWalls();
    }

    _generateWalls() {
      const walls = [];
      for (let x = 0; x < constants.GRID_WIDTH; x++) {
        walls.push({ x, y: 0 });
        walls.push({ x, y: constants.GRID_HEIGHT - 1 });
      }
      for (let y = 0; y < constants.GRID_HEIGHT; y++) {
        walls.push({ x: 0, y });
        walls.push({ x: constants.GRID_WIDTH - 1, y });
      }

      for (let y = 3; y < 6; y++) {
        walls.push({ x: 5, y });
      }
      for (let y = 5; y < 8; y++) {
        walls.push({ x: 9, y });
      }
      
      return walls;
    }

    start() {
      if (this.state === constants.GAME_STATE.PLAYING) return false;
      if (this.state === constants.GAME_STATE.ENDED || this.state === constants.GAME_STATE.REPLAYING) {
        this.reset();
      }
      this.state = constants.GAME_STATE.PLAYING;
      this.startTimer();
      return true;
    }

    pause() {
      if (this.state !== constants.GAME_STATE.PLAYING) return false;
      this.state = constants.GAME_STATE.PAUSED;
      this.stopTimer();
      return true;
    }

    resume() {
      if (this.state !== constants.GAME_STATE.PAUSED) return false;
      this.state = constants.GAME_STATE.PLAYING;
      this.startTimer();
      return true;
    }

    restart() {
      this.reset();
      this.start();
      return true;
    }

    endGame() {
      this.state = constants.GAME_STATE.ENDED;
      this.stopTimer();
    }

    startTimer() {
      this.stopTimer();
      this.timerId = setInterval(() => {
        if (this.state === constants.GAME_STATE.PLAYING) {
          this.timeRemaining--;
          if (this.timeRemaining <= 0) {
            this.endGame();
          }
        }
      }, 1000);
    }

    stopTimer() {
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
    }

    selectRobot(robotId) {
      if (this.state !== constants.GAME_STATE.PLAYING) return false;
      const robot = this.robots.find(r => r.id === robotId);
      if (robot) {
        this.selectedRobot = robot.id;
        return true;
      }
      return false;
    }

    moveRobot(direction) {
      if (this.state !== constants.GAME_STATE.PLAYING) return { success: false, reason: '游戏未运行' };
      if (!this.selectedRobot) return { success: false, reason: '请先选择机器人' };

      const robot = this.robots.find(r => r.id === this.selectedRobot);
      if (!robot) return { success: false, reason: '机器人不存在' };

      const dir = constants.DIRECTIONS[direction];
      if (!dir) return { success: false, reason: '无效方向' };

      const newX = robot.x + dir.dx;
      const newY = robot.y + dir.dy;

      if (this._isWall(newX, newY)) {
        return { success: false, reason: '无法移动到墙壁' };
      }

      if (this._isRobotAt(newX, newY)) {
        this._applyScore(constants.SCORE.COLLISION, `机器人${robot.id}碰撞`);
        return { success: false, reason: '发生碰撞!' };
      }

      const previousState = this._getSnapshot();
      robot.x = newX;
      robot.y = newY;

      this._applyScore(constants.SCORE.MOVE, `机器人${robot.id}移动`);
      this.moveHistory.push({
        type: 'move',
        robotId: robot.id,
        from: { x: previousState.robots.find(r => r.id === robot.id).x, y: previousState.robots.find(r => r.id === robot.id).y },
        to: { x: newX, y: newY },
        time: this.timeRemaining,
      });

      return { success: true, robot };
    }

    pickupCargo() {
      if (this.state !== constants.GAME_STATE.PLAYING) return { success: false, reason: '游戏未运行' };
      if (!this.selectedRobot) return { success: false, reason: '请先选择机器人' };

      const robot = this.robots.find(r => r.id === this.selectedRobot);
      if (!robot) return { success: false, reason: '机器人不存在' };

      if (robot.carrying) {
        return { success: false, reason: '机器人已携带货物' };
      }

      const cargo = this.cargos.find(c => c.x === robot.x && c.y === robot.y);
      
      if (!cargo) {
        this._applyScore(constants.SCORE.PICKUP_FAIL_EMPTY, `机器人${robot.id}取空位置`);
        return { success: false, reason: '此处无货物' };
      }

      if (cargo.picked) {
        this._applyScore(constants.SCORE.PICKUP_FAIL_DUPLICATE, `机器人${robot.id}重复取货`);
        return { success: false, reason: '货物已被取走' };
      }

      cargo.picked = true;
      cargo.pickedBy = robot.id;
      robot.carrying = true;

      this._applyScore(constants.SCORE.PICKUP_SUCCESS, `机器人${robot.id}成功取货`);
      this.moveHistory.push({
        type: 'pickup',
        robotId: robot.id,
        cargoId: cargo.id,
        position: { x: robot.x, y: robot.y },
        time: this.timeRemaining,
      });

      if (this.cargos.every(c => c.picked)) {
        this.endGame();
      }

      return { success: true, cargo, robot };
    }

    _isWall(x, y) {
      return this.walls.some(w => w.x === x && w.y === y);
    }

    _isRobotAt(x, y) {
      return this.robots.some(r => r.x === x && r.y === y);
    }

    _applyScore(amount, reason) {
      const oldScore = this.score;
      this.score = Math.max(0, this.score + amount);
      
      if (amount !== 0) {
        this.logger.log('score_change', {
          time: this.timeRemaining,
          score: this.score,
          reason,
          amount,
        });
      }
    }

    _getSnapshot() {
      return {
        score: this.score,
        timeRemaining: this.timeRemaining,
        robots: this.robots.map(r => ({ ...r })),
        cargos: this.cargos.map(c => ({ ...c })),
      };
    }

    getState() {
      return {
        gameState: this.state,
        score: this.score,
        timeRemaining: this.timeRemaining,
        robots: this.robots,
        cargos: this.cargos,
        walls: this.walls,
        selectedRobot: this.selectedRobot,
        scoreDetails: this.logger.getScoreDetails(),
        allCargosPicked: this.cargos.every(c => c.picked),
      };
    }

    getMoveHistory() {
      return [...this.moveHistory];
    }

    startReplay() {
      if (this.state !== constants.GAME_STATE.ENDED) return false;
      if (this.moveHistory.length === 0) return false;

      this.state = constants.GAME_STATE.REPLAYING;
      this.replayIndex = 0;
      this._restoreInitialSnapshot();
      return true;
    }

    _restoreInitialSnapshot() {
      this._generateLevel();
      this.timeRemaining = constants.GAME_TIME;
      this.score = 0;
      this.selectedRobot = null;
    }

    replayNextStep() {
      if (this.state !== constants.GAME_STATE.REPLAYING) return { done: true };
      if (this.replayIndex >= this.moveHistory.length) {
        this.state = constants.GAME_STATE.ENDED;
        return { done: true };
      }

      const step = this.moveHistory[this.replayIndex];
      this.replayIndex++;
      this.timeRemaining = step.time;

      if (step.type === 'move') {
        const robot = this.robots.find(r => r.id === step.robotId);
        if (robot) {
          robot.x = step.to.x;
          robot.y = step.to.y;
        }
      } else if (step.type === 'pickup') {
        const cargo = this.cargos.find(c => c.id === step.cargoId);
        const robot = this.robots.find(r => r.id === step.robotId);
        if (cargo) {
          cargo.picked = true;
          cargo.pickedBy = step.robotId;
        }
        if (robot) {
          robot.carrying = true;
        }
      }

      return { done: false, step };
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameEngine;
  } else {
    root.GameEngine = GameEngine;
  }
})(typeof window !== 'undefined' ? window : global);
