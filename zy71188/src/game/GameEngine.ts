import type { GameState, Player, Hazard, MarkRecord, LevelConfig, InspectionReport, ScoreBreakdown } from './types';
import { LEVELS } from './data/levels';
import { MapSystem } from './systems/MapSystem';
import { HazardSystem } from './systems/HazardSystem';
import { ScoreSystem } from './systems/ScoreSystem';
import { ReplaySystem } from './systems/ReplaySystem';
import { ReportSystem } from './systems/ReportSystem';
import { CanvasRenderer } from './render/CanvasRenderer';

export class GameEngine {
  private state: GameState;
  private mapSystem: MapSystem;
  private hazardSystem: HazardSystem;
  private scoreSystem: ScoreSystem;
  private replaySystem: ReplaySystem;
  private reportSystem: ReportSystem;
  private renderer: CanvasRenderer;
  private keys: Set<string> = new Set();
  private animationFrameId: number | null = null;
  private lastTime: number = 0;
  private startTime: number = 0;
  private onStateChange: ((state: GameState) => void) | null = null;
  private onGameEnd: ((report: InspectionReport) => void) | null = null;

  constructor() {
    this.mapSystem = new MapSystem();
    this.hazardSystem = new HazardSystem();
    this.scoreSystem = new ScoreSystem();
    this.replaySystem = new ReplaySystem();
    this.reportSystem = new ReportSystem();
    this.renderer = new CanvasRenderer();

    this.state = this.createInitialState();
  }

  private createInitialState(): GameState {
    return {
      status: 'idle',
      currentLevel: 1,
      timeRemaining: 0,
      totalTime: 0,
      score: 0,
      scoreBreakdown: {
        baseScore: 1000,
        correctMarks: 0,
        wrongMarks: 0,
        duplicateMarks: 0,
        overtimePenalty: 0,
        timeBonus: 0,
        missedHazards: 0,
        resourceWaste: 0,
        totalScore: 1000
      },
      player: {
        x: 80,
        y: 80,
        direction: 'down',
        speed: 3
      },
      map: {
        width: 16,
        height: 12,
        tileSize: 40,
        tiles: [],
        shelves: []
      },
      hazards: [],
      markedRecords: [],
      replayData: [],
      nearHazard: null
    };
  }

  init(canvas: HTMLCanvasElement, width: number, height: number): void {
    this.renderer.init(canvas, width, height);
    this.setupKeyboardListeners();
    this.gameLoop();
  }

  setOnStateChange(callback: (state: GameState) => void): void {
    this.onStateChange = callback;
  }

  setOnGameEnd(callback: (report: InspectionReport) => void): void {
    this.onGameEnd = callback;
  }

  private setupKeyboardListeners(): void {
    document.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
      
      if (e.key === ' ' && this.state.status === 'playing') {
        e.preventDefault();
        this.markHazard();
      }
    });

    document.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
  }

  startLevel(levelId: number): void {
    const config = LEVELS.find(l => l.id === levelId) || LEVELS[0];
    
    this.state.currentLevel = levelId;
    this.state.totalTime = config.timeLimit;
    this.state.timeRemaining = config.timeLimit;
    
    const map = this.mapSystem.generateMap(config);
    this.state.map = map;
    
    const hazards = this.hazardSystem.generateHazards(
      config,
      map.shelves,
      config.mapSize.width,
      config.mapSize.height
    );
    this.state.hazards = hazards;
    
    const startPos = this.mapSystem.findValidPosition(
      map.shelves,
      config.mapSize.width,
      config.mapSize.height
    );
    this.state.player = {
      x: startPos.x,
      y: startPos.y,
      direction: 'down',
      speed: 3
    };
    
    this.state.markedRecords = [];
    this.state.score = 0;
    this.state.scoreBreakdown = {
      baseScore: 1000,
      correctMarks: 0,
      wrongMarks: 0,
      duplicateMarks: 0,
      overtimePenalty: 0,
      timeBonus: 0,
      missedHazards: 0,
      resourceWaste: 0,
      totalScore: 1000
    };
    this.state.nearHazard = null;
    this.state.status = 'playing';
    
    this.replaySystem.clear();
    this.startTime = Date.now();
    this.lastTime = this.startTime;
    
    this.notifyStateChange();
  }

  pause(): void {
    if (this.state.status === 'playing') {
      this.state.status = 'paused';
      this.notifyStateChange();
    }
  }

  resume(): void {
    if (this.state.status === 'paused') {
      this.state.status = 'playing';
      this.lastTime = Date.now();
      this.notifyStateChange();
    }
  }

  restart(): void {
    this.startLevel(this.state.currentLevel);
  }

  markHazard(): void {
    if (this.state.status !== 'playing' || !this.state.nearHazard) return;

    const hazard = this.state.nearHazard;
    
    if (hazard.marked) {
      const record: MarkRecord = {
        hazardId: hazard.id,
        timestamp: Date.now() - this.startTime,
        isCorrect: false,
        isDuplicate: true,
        position: { x: this.state.player.x, y: this.state.player.y }
      };
      this.state.markedRecords.push(record);
      this.updateScore();
      this.notifyStateChange();
      return;
    }

    const result = this.hazardSystem.markHazard(hazard);

    hazard.marked = true;
    hazard.markCorrect = result.isCorrect;

    const record: MarkRecord = {
      hazardId: hazard.id,
      timestamp: Date.now() - this.startTime,
      isCorrect: result.isCorrect,
      isDuplicate: false,
      position: { x: this.state.player.x, y: this.state.player.y }
    };

    this.state.markedRecords.push(record);
    this.updateScore();
    this.notifyStateChange();
  }

  private updateScore(): void {
    const config = LEVELS.find(l => l.id === this.state.currentLevel) || LEVELS[0];
    const breakdown = this.scoreSystem.calculateFinalScore(
      this.state.hazards,
      this.state.markedRecords,
      this.state.timeRemaining,
      this.state.totalTime
    );
    this.state.scoreBreakdown = breakdown;
    this.state.score = breakdown.totalScore;
  }

  private gameLoop = (): void => {
    const currentTime = Date.now();

    if (this.state.status === 'playing') {
      const deltaTime = (currentTime - this.lastTime) / 1000;
      this.lastTime = currentTime;

      this.updatePlayer();
      this.updateTime(deltaTime);
      this.checkNearbyHazard();
      this.recordReplayFrame(currentTime);
    }

    this.renderer.render(this.state);
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };

  private updatePlayer(): void {
    const { player, map } = this.state;
    let dx = 0;
    let dy = 0;

    if (this.keys.has('w') || this.keys.has('arrowup')) {
      dy = -player.speed;
      player.direction = 'up';
    }
    if (this.keys.has('s') || this.keys.has('arrowdown')) {
      dy = player.speed;
      player.direction = 'down';
    }
    if (this.keys.has('a') || this.keys.has('arrowleft')) {
      dx = -player.speed;
      player.direction = 'left';
    }
    if (this.keys.has('d') || this.keys.has('arrowright')) {
      dx = player.speed;
      player.direction = 'right';
    }

    const newX = player.x + dx;
    const newY = player.y + dy;
    const playerSize = 24;

    if (this.mapSystem.isWalkable(
      newX - playerSize / 2,
      player.y - playerSize / 2,
      playerSize,
      playerSize,
      map.shelves,
      map.width,
      map.height
    )) {
      player.x = newX;
    }

    if (this.mapSystem.isWalkable(
      player.x - playerSize / 2,
      newY - playerSize / 2,
      playerSize,
      playerSize,
      map.shelves,
      map.width,
      map.height
    )) {
      player.y = newY;
    }
  }

  private updateTime(deltaTime: number): void {
    this.state.timeRemaining = Math.max(0, this.state.timeRemaining - deltaTime);

    if (this.state.timeRemaining <= 0) {
      this.endGame();
    }
  }

  private checkNearbyHazard(): void {
    this.state.nearHazard = this.hazardSystem.checkNearbyHazard(
      this.state.player.x,
      this.state.player.y,
      this.state.hazards
    );
  }

  private recordReplayFrame(currentTime: number): void {
    this.replaySystem.recordFrame(
      this.state.player,
      this.state.markedRecords,
      currentTime - this.startTime
    );
  }

  private endGame(): void {
    this.state.status = 'finished';
    this.updateScore();

    const config = LEVELS.find(l => l.id === this.state.currentLevel) || LEVELS[0];
    const failReasons = this.scoreSystem.getFailReasons(
      this.state.scoreBreakdown,
      this.state.hazards,
      this.state.timeRemaining
    );
    
    const report = this.reportSystem.generateReport(
      config,
      this.state.hazards,
      this.state.markedRecords,
      this.state.timeRemaining,
      this.state.totalTime,
      this.state.scoreBreakdown,
      failReasons
    );

    this.reportSystem.saveReport(report);
    this.replaySystem.saveToStorage(this.state.currentLevel);

    if (this.onGameEnd) {
      this.onGameEnd(report);
    }

    this.notifyStateChange();
  }

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange({ ...this.state });
    }
  }

  getState(): GameState {
    return { ...this.state };
  }

  getLevels(): LevelConfig[] {
    return LEVELS;
  }

  getScoreSystem(): ScoreSystem {
    return this.scoreSystem;
  }

  getReportSystem(): ReportSystem {
    return this.reportSystem;
  }

  getReplaySystem(): ReplaySystem {
    return this.replaySystem;
  }

  destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    document.removeEventListener('keydown', () => {});
    document.removeEventListener('keyup', () => {});
  }
}
