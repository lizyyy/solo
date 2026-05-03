import {
  GameConfig,
  GameState,
  Position,
  ReplayAction
} from '../types';
import {
  GameStateMachine,
  ExportSystem,
  MapSystem
} from '../core';
import { UIRenderer } from '../ui/UIRenderer';

export class GameController {
  private stateMachine: GameStateMachine;
  private exportSystem: ExportSystem;
  private renderer: UIRenderer;
  private mapSystem: MapSystem;
  private gameConfig: GameConfig;
  private isGameOver: boolean;

  private custodianStats: Map<string, {
    movesMade: number;
    artifactsCollected: number;
    artifactsDeposited: number;
  }>;

  private eventsEncountered: Array<{
    turn: number;
    eventName: string;
    eventType: string;
  }>;

  private risksDetected: Array<{
    turn: number;
    riskType: string;
    severity: string;
    description: string;
  }>;

  constructor(config: GameConfig) {
    this.gameConfig = config;
    this.stateMachine = new GameStateMachine(config);
    this.exportSystem = new ExportSystem(config);
    this.renderer = new UIRenderer();
    this.mapSystem = this.stateMachine.getMapSystem();
    this.isGameOver = false;

    this.custodianStats = new Map();
    for (const custodian of config.custodians) {
      this.custodianStats.set(custodian.id, {
        movesMade: 0,
        artifactsCollected: 0,
        artifactsDeposited: 0
      });
    }

    this.eventsEncountered = [];
    this.risksDetected = [];
  }

  initialize(): void {
    this.stateMachine.startGame();
    this.setupEventListeners();
    this.render();
  }

  private setupEventListeners(): void {
    this.renderer.addMapClickListener((x, y) => {
      this.handleMapClick(x, y);
    });

    const endTurnBtn = document.getElementById('end-turn-btn');
    if (endTurnBtn) {
      endTurnBtn.addEventListener('click', () => {
        this.handleEndTurn();
      });
    }

    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        this.handleRestart();
      });
    }
  }

  private handleMapClick(x: number, y: number): void {
    if (this.isGameOver) return;

    const state = this.stateMachine.getState();
    const clickPosition = { x, y };

    const clickedCustodian = state.custodians.find(
      c => c.position.x === x && c.position.y === y
    );

    if (clickedCustodian) {
      this.stateMachine.selectCustodian(clickedCustodian.id);
      this.render();
      return;
    }

    const selectedCustodian = this.stateMachine.getSelectedCustodian();
    if (selectedCustodian) {
      const displayCase = state.displayCases.find(
        dc => dc.position.x === x && dc.position.y === y
      );

      if (displayCase && 
          selectedCustodian.position.x === x && 
          selectedCustodian.position.y === y) {
        if (displayCase.isLocked) {
          const result = this.stateMachine.unlockCase(
            selectedCustodian.id,
            displayCase.id
          );
          if (result.success) {
            this.recordAction('unlock', {
              custodianId: selectedCustodian.id,
              caseId: displayCase.id
            });
          }
          this.render();
          return;
        } else if (displayCase.artifactId) {
          const result = this.stateMachine.collectArtifact(
            selectedCustodian.id,
            displayCase.artifactId
          );
          if (result.success) {
            this.recordAction('collect', {
              custodianId: selectedCustodian.id,
              artifactId: displayCase.artifactId,
              caseId: displayCase.id
            });
            
            const stats = this.custodianStats.get(selectedCustodian.id);
            if (stats) stats.artifactsCollected++;
          }
          this.render();
          return;
        }
      }

      if (this.mapSystem.isExit(clickPosition) &&
          selectedCustodian.position.x === x && 
          selectedCustodian.position.y === y &&
          selectedCustodian.carriedArtifacts.length > 0) {
        for (const artifactId of selectedCustodian.carriedArtifacts) {
          const result = this.stateMachine.depositArtifact(
            selectedCustodian.id,
            artifactId
          );
          if (result.success) {
            this.recordAction('deposit', {
              custodianId: selectedCustodian.id,
              artifactId: artifactId,
              exitPosition: clickPosition
            });
            
            const stats = this.custodianStats.get(selectedCustodian.id);
            if (stats) stats.artifactsDeposited++;
          }
        }
        this.render();
        return;
      }

      const moveResult = this.stateMachine.moveCustodian(
        selectedCustodian.id,
        clickPosition
      );

      if (moveResult.success) {
        this.recordAction('move', {
          custodianId: selectedCustodian.id,
          from: selectedCustodian.position,
          to: clickPosition
        });
        
        const stats = this.custodianStats.get(selectedCustodian.id);
        if (stats) stats.movesMade++;
      }

      this.render();
    }
  }

  private handleEndTurn(): void {
    if (this.isGameOver) return;

    const state = this.stateMachine.getState();
    
    this.recordAction('endTurn', null);

    const previousEvents = [...state.activeEvents];

    const newState = this.stateMachine.endTurn();

    for (const event of newState.activeEvents) {
      const wasActive = previousEvents.some(e => e.id === event.id);
      if (!wasActive) {
        this.eventsEncountered.push({
          turn: newState.turn,
          eventName: event.name,
          eventType: event.type
        });
      }
    }

    for (const risk of newState.risks) {
      this.risksDetected.push({
        turn: newState.turn,
        riskType: risk.type,
        severity: risk.severity,
        description: risk.description
      });
    }

    if (newState.result !== 'inProgress') {
      this.isGameOver = true;
      this.handleGameEnd(newState);
    }

    this.render();
  }

  private handleRestart(): void {
    if (confirm('确定要重新开始游戏吗？当前进度将丢失。')) {
      this.stateMachine.reset();
      this.exportSystem.reset();
      this.isGameOver = false;
      this.mapSystem = this.stateMachine.getMapSystem();

      for (const custodian of this.gameConfig.custodians) {
        this.custodianStats.set(custodian.id, {
          movesMade: 0,
          artifactsCollected: 0,
          artifactsDeposited: 0
        });
      }
      this.eventsEncountered = [];
      this.risksDetected = [];

      this.stateMachine.startGame();
      this.render();
    }
  }

  private handleGameEnd(finalState: GameState): void {
    this.renderer.showGameEnd(
      finalState.result,
      finalState.securedArtifactsCount,
      finalState.totalArtifactsToSecure
    );

    setTimeout(() => {
      if (confirm('游戏结束！是否导出游戏数据？\n\n点击确定将导出 replay.json 和 review_report.md')) {
        this.exportGameData(finalState);
      }
    }, 100);
  }

  private exportGameData(finalState: GameState): void {
    const replayData = this.exportSystem.generateReplayData(finalState);
    this.exportSystem.downloadReplayJson(replayData);

    setTimeout(() => {
      const custodianStatsArray = Array.from(this.custodianStats.entries()).map(
        ([custodianId, stats]) => {
          const custodian = this.gameConfig.custodians.find(c => c.id === custodianId);
          return {
            custodianId,
            name: custodian?.name || '未知',
            ...stats
          };
        }
      );

      const reviewReport = this.exportSystem.generateReviewReport(
        finalState,
        custodianStatsArray,
        this.eventsEncountered,
        this.risksDetected
      );
      this.exportSystem.downloadReviewReport(reviewReport);
    }, 500);
  }

  private recordAction(
    actionType: ReplayAction['actionType'],
    action: ReplayAction['action']
  ): void {
    const state = this.stateMachine.getState();
    const selectedCustodian = this.stateMachine.getSelectedCustodian();

    const replayAction: ReplayAction = {
      turn: state.turn,
      actionType,
      action,
      custodianId: selectedCustodian?.id,
      timestamp: Date.now()
    };

    this.exportSystem.addAction(replayAction);
  }

  private render(): void {
    const state = this.stateMachine.getState();
    const selectedCustodian = this.stateMachine.getSelectedCustodian();

    let reachablePositions: Position[] = [];
    if (selectedCustodian && selectedCustodian.canMove) {
      reachablePositions = this.mapSystem.getReachableAdjacentPositions(
        selectedCustodian.position,
        state.isPowerOutage
      );
    }

    this.renderer.renderGameState(state, this.mapSystem, reachablePositions);
  }

  getState(): GameState {
    return this.stateMachine.getState();
  }

  getGameId(): string {
    return this.exportSystem.getGameId();
  }

  getReplayActions(): ReplayAction[] {
    return this.exportSystem.getActions();
  }
}
