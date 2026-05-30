import { Maze } from '../models/Maze.js';
import { GameState } from '../models/GameState.js';
import { SoundWave } from '../physics/SoundWave.js';
import { CollisionDetector } from '../physics/CollisionDetector.js';
import { ResourceManager } from './ResourceManager.js';

export class GameEngine {
    constructor(options = {}) {
        this.maze = options.maze || new Maze();
        this.gameState = options.gameState || new GameState();
        this.resourceManager = new ResourceManager(this.gameState);
        this.history = [];
        this.failedAttempts = [];
        this.currentWave = null;
        this.waveAnimation = null;
        this.listeners = {};
        this.moveStep = options.moveStep || 30;
        this.playerRadius = options.playerRadius || 10;
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    initDefaultMaze() {
        this.maze = new Maze({
            width: 600,
            height: 600,
            gridSize: 30
        });

        this.maze.addCharacter({
            type: 'player',
            x: 50,
            y: 550,
            status: 'active'
        });

        this.maze.addCharacter({
            type: 'teammate',
            x: 550,
            y: 50,
            status: 'trapped',
            health: 80
        });

        this.maze.addWall({
            x1: 150, y1: 0, x2: 150, y2: 400,
            material: 'hard',
            addedInBatch: 'initial'
        });

        this.maze.addWall({
            x1: 300, y1: 200, x2: 300, y2: 600,
            material: 'hard',
            addedInBatch: 'initial'
        });

        this.maze.addWall({
            x1: 450, y1: 0, x2: 450, y2: 450,
            material: 'soft',
            addedInBatch: 'initial'
        });

        this.maze.addWall({
            x1: 150, y1: 200, x2: 300, y2: 200,
            material: 'absorbent',
            addedInBatch: 'initial'
        });

        this.gameState = new GameState();
        this.resourceManager = new ResourceManager(this.gameState);
        this.history = [];
        this.failedAttempts = [];

        this.emit('mazeUpdated', this.maze);
        this.emit('stateUpdated', this.gameState);
    }

    movePlayer(direction) {
        if (this.gameState.isGameOver()) {
            return { success: false, reason: '游戏已结束' };
        }

        const player = this.maze.getPlayer();
        if (!player) {
            return { success: false, reason: '未找到玩家' };
        }

        if (!this.resourceManager.canAfford('move')) {
            return { success: false, reason: '资源不足，无法移动' };
        }

        const oldX = player.x;
        const oldY = player.y;
        let dx = 0, dy = 0;

        switch (direction) {
            case 'up': dy = -this.moveStep; break;
            case 'down': dy = this.moveStep; break;
            case 'left': dx = -this.moveStep; break;
            case 'right': dx = this.moveStep; break;
            default:
                return { success: false, reason: '无效方向' };
        }

        const newX = oldX + dx;
        const newY = oldY + dy;

        if (!this.maze.isPointInBounds(newX, newY, this.playerRadius)) {
            return { success: false, reason: '无法移出边界' };
        }

        const collision = CollisionDetector.checkCircleWallCollision(
            newX, newY, this.playerRadius,
            this.maze.walls.filter(w => !w.id.startsWith('boundary_'))
        );

        if (collision.collision) {
            return { success: false, reason: '前方有障碍物' };
        }

        this.resourceManager.consume('move');

        player.setPosition(newX, newY);

        const trapped = this.maze.getTrappedTeammates();
        let efficiencyGain = 0;
        if (trapped.length > 0) {
            const target = trapped[0];
            efficiencyGain = this.resourceManager.calculateMoveEfficiency(
                oldX, oldY, newX, newY, target.x, target.y
            );
            if (efficiencyGain > 0) {
                this.resourceManager.gain('efficientMove', Math.floor(efficiencyGain / 10));
            }
        }

        let rescued = false;
        for (const teammate of trapped) {
            const dist = player.distanceTo(teammate);
            if (dist < this.playerRadius * 2) {
                if (this.resourceManager.canAfford('rescue')) {
                    this.resourceManager.consume('rescue');
                    teammate.rescue();
                    rescued = true;
                    
                    const bonus = this.resourceManager.calculateRescueBonus(
                        this.gameState.resources.timeUnits,
                        teammate.health
                    );
                    this.resourceManager.gain('rescue');
                    this.gameState.addScore('rescue', bonus);
                }
            }
        }

        this.gameState.nextTurn();

        const action = {
            type: 'move',
            turn: this.gameState.turn,
            timestamp: Date.now(),
            parameters: { direction, fromX: oldX, fromY: oldY, toX: newX, toY: newY },
            result: { success: true, efficiencyGain, rescued },
            stateSnapshot: this.gameState.clone()
        };
        this.history.push(action);

        this.checkGameOver();

        this.emit('playerMoved', { player, direction });
        this.emit('stateUpdated', this.gameState);
        this.emit('historyUpdated', this.history);

        return {
            success: true,
            player,
            efficiencyGain,
            rescued,
            action
        };
    }

    fireSoundPulse(direction, intensity = 1.0) {
        if (this.gameState.isGameOver()) {
            return { success: false, reason: '游戏已结束' };
        }

        const player = this.maze.getPlayer();
        if (!player) {
            return { success: false, reason: '未找到玩家' };
        }

        if (!this.resourceManager.canAfford('soundPulse')) {
            return { success: false, reason: '资源不足，无法发射声波' };
        }

        this.resourceManager.consume('soundPulse');

        const wave = new SoundWave({
            startX: player.x,
            startY: player.y,
            direction: direction,
            intensity: intensity,
            maxReflections: 5,
            maxDistance: 2000
        });

        const result = wave.propagate(this.maze.walls);
        this.currentWave = wave;

        const accuracy = this.resourceManager.calculateEchoAccuracy(result.echoes, 3);
        this.resourceManager.gain('echoQuality', Math.floor(accuracy / 10));

        this.gameState.nextTurn();

        const action = {
            type: 'sound_pulse',
            turn: this.gameState.turn,
            timestamp: Date.now(),
            parameters: { direction, intensity },
            result: {
                success: true,
                echoCount: result.echoes.length,
                reflectionCount: result.reflections.length,
                totalDistance: wave.getTotalDistance(),
                totalTime: wave.getTotalTime()
            },
            waveData: wave.toJSON(),
            echoes: result.echoes,
            stateSnapshot: this.gameState.clone()
        };
        this.history.push(action);

        this.checkGameOver();

        this.emit('soundPulseFired', { wave, echoes: result.echoes });
        this.emit('stateUpdated', this.gameState);
        this.emit('historyUpdated', this.history);

        return {
            success: true,
            wave,
            echoes: result.echoes,
            reflections: result.reflections,
            path: result.path,
            action
        };
    }

    checkGameOver() {
        if (this.gameState.isGameOver()) return;

        const trapped = this.maze.getTrappedTeammates();
        const rescued = this.maze.getRescuedTeammates();
        
        if (trapped.length === 0 && rescued.length > 0) {
            this.gameState.setGameOver('所有队友已成功救援！', true);
            this.emit('victory', this.gameState);
            return;
        }

        if (this.gameState.resources.soundPulses <= 0 && trapped.length > 0) {
            this.recordFailure('声波脉冲耗尽，无法继续探测');
            this.gameState.setGameOver('声波脉冲耗尽，救援失败', false);
            this.emit('gameOver', this.gameState);
            return;
        }

        if (this.gameState.resources.energy <= 0) {
            this.recordFailure('能量耗尽，无法继续行动');
            this.gameState.setGameOver('能量耗尽，救援失败', false);
            this.emit('gameOver', this.gameState);
            return;
        }

        if (this.gameState.resources.timeUnits <= 0) {
            this.recordFailure('时间耗尽，队友未能及时获救');
            this.gameState.setGameOver('时间耗尽，救援失败', false);
            this.emit('gameOver', this.gameState);
            return;
        }

        const player = this.maze.getPlayer();
        if (player && player.health <= 0) {
            this.recordFailure('玩家生命值耗尽');
            this.gameState.setGameOver('玩家昏迷，救援失败', false);
            this.emit('gameOver', this.gameState);
            return;
        }
    }

    recordFailure(reason) {
        const failure = {
            id: `fail_${Date.now()}`,
            timestamp: Date.now(),
            reason,
            turn: this.gameState.turn,
            finalState: this.gameState.clone(),
            mazeSnapshot: this.maze.clone(),
            history: [...this.history]
        };
        this.failedAttempts.push(failure);
        this.emit('failureRecorded', failure);
        return failure;
    }

    getLatestFailure() {
        if (this.failedAttempts.length === 0) return null;
        return this.failedAttempts[this.failedAttempts.length - 1];
    }

    getAllFailures() {
        return [...this.failedAttempts];
    }

    getHistory() {
        return [...this.history];
    }

    getTurnSummary(turnNumber) {
        const action = this.history.find(h => h.turn === turnNumber);
        if (!action) return null;
        
        return {
            turn: turnNumber,
            action: action.type,
            parameters: action.parameters,
            result: action.result,
            state: action.stateSnapshot
        };
    }

    getFullState() {
        return {
            maze: this.maze.toJSON(),
            gameState: this.gameState.toJSON(),
            history: [...this.history],
            failedAttempts: [...this.failedAttempts],
            currentWave: this.currentWave ? this.currentWave.toJSON() : null
        };
    }

    resetGame() {
        this.initDefaultMaze();
        this.emit('gameReset');
    }

    loadState(state) {
        if (state.maze) {
            this.maze = new Maze(state.maze);
        }
        if (state.gameState) {
            this.gameState = new GameState(state.gameState);
            this.resourceManager = new ResourceManager(this.gameState);
        }
        if (state.history) {
            this.history = state.history;
        }
        if (state.failedAttempts) {
            this.failedAttempts = state.failedAttempts;
        }
        
        this.emit('mazeUpdated', this.maze);
        this.emit('stateUpdated', this.gameState);
        this.emit('historyUpdated', this.history);
    }
}
