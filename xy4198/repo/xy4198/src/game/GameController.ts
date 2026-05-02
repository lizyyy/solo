import { Level, SimulationState, ScoreResult, ToolType, Direction, Position } from '../models/types';
import { createLevel, cloneLevel, resizeLevel, clearLevel, isValidPosition, isBlocked, createCustomer, createSign, positionsEqual, containsPosition, removePosition } from '../models/level';
import { createInitialSimulationState, stepSimulation } from '../engine/simulation';
import { calculateScore } from '../engine/scoring';
import { GameRenderer } from '../ui/renderer';
import { saveCurrentLevel, loadCurrentLevel, exportLevelToJSON, importLevelFromJSON, uploadFile, readFileContent } from '../utils/storage';
import { downloadMarkdownReport, downloadJSONReplay } from '../utils/export';
import { exampleLevels } from '../data/exampleLevels';

const SIMULATION_INTERVAL = 500;

export class GameController {
  private level: Level;
  private simulation: SimulationState | null = null;
  private simulationStates: SimulationState[] = [];
  private scoreResult: ScoreResult | null = null;
  private selectedTool: ToolType = 'select';
  private selectedSignDirection: Direction = Direction.RIGHT;
  private renderer: GameRenderer;
  private simulationInterval: number | null = null;
  private isMouseDown: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new GameRenderer(canvas);
    this.level = createLevel(10, 8, '新关卡');
    
    const savedLevel = loadCurrentLevel();
    if (savedLevel) {
      this.level = savedLevel;
    }
    
    this.initCanvas();
    this.bindEvents(canvas);
    this.render();
  }

  private initCanvas(): void {
    this.renderer.resize(this.level.width, this.level.height);
  }

  private bindEvents(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    canvas.addEventListener('mouseup', () => this.handleMouseUp());
    canvas.addEventListener('mouseleave', () => this.handleMouseUp());
    
    canvas.addEventListener('click', (e) => this.handleClick(e));
  }

  private handleMouseDown(e: MouseEvent): void {
    if (this.simulation && this.simulation.isRunning) return;
    
    this.isMouseDown = true;
    this.handleCanvasInteraction(e);
  }

  private handleMouseMove(e: MouseEvent): void {
    if (this.isMouseDown && !this.simulation?.isRunning) {
      this.handleCanvasInteraction(e);
    }
  }

  private handleMouseUp(): void {
    this.isMouseDown = false;
  }

  private handleClick(_e: MouseEvent): void {
    if (this.simulation && this.simulation.isRunning) return;
  }

  private handleCanvasInteraction(e: MouseEvent): void {
    const pos = this.renderer.getGridPosition(e.clientX, e.clientY);
    if (!pos || !isValidPosition(this.level, pos)) return;
    
    this.applyTool(pos);
    this.render();
    saveCurrentLevel(this.level);
  }

  private applyTool(pos: Position): void {
    switch (this.selectedTool) {
      case 'wall':
        this.toggleWall(pos);
        break;
      case 'exit':
        this.toggleExit(pos);
        break;
      case 'smoke':
        this.toggleSmokeSource(pos);
        break;
      case 'customer':
        this.toggleCustomer(pos);
        break;
      case 'sign':
        this.toggleSign(pos);
        break;
      case 'eraser':
        this.eraseAt(pos);
        break;
      case 'select':
        break;
    }
  }

  private toggleWall(pos: Position): void {
    if (isBlocked(this.level, pos)) {
      this.level.walls = removePosition(this.level.walls, pos);
    } else {
      this.eraseAt(pos);
      this.level.walls.push({ ...pos });
    }
  }

  private toggleExit(pos: Position): void {
    if (containsPosition(this.level.exits, pos)) {
      this.level.exits = removePosition(this.level.exits, pos);
    } else {
      this.eraseAt(pos);
      this.level.exits.push({ ...pos });
    }
  }

  private toggleSmokeSource(pos: Position): void {
    if (containsPosition(this.level.smokeSources, pos)) {
      this.level.smokeSources = removePosition(this.level.smokeSources, pos);
    } else {
      this.eraseAt(pos);
      this.level.smokeSources.push({ ...pos });
    }
  }

  private toggleCustomer(pos: Position): void {
    const existingIndex = this.level.customers.findIndex(c =>
      positionsEqual(c.position, pos)
    );
    
    if (existingIndex >= 0) {
      this.level.customers.splice(existingIndex, 1);
    } else {
      this.eraseAt(pos);
      this.level.customers.push(createCustomer(pos));
    }
  }

  private toggleSign(pos: Position): void {
    const existingIndex = this.level.signs.findIndex(s =>
      positionsEqual(s.position, pos)
    );
    
    if (existingIndex >= 0) {
      const existingSign = this.level.signs[existingIndex]!;
      existingSign.direction = this.getNextDirection(existingSign.direction);
    } else {
      this.eraseAt(pos);
      this.level.signs.push(createSign(pos, this.selectedSignDirection));
    }
  }

  private getNextDirection(dir: Direction): Direction {
    const directions = [Direction.UP, Direction.RIGHT, Direction.DOWN, Direction.LEFT];
    const currentIndex = directions.indexOf(dir);
    return directions[(currentIndex + 1) % 4]!;
  }

  private eraseAt(pos: Position): void {
    this.level.walls = removePosition(this.level.walls, pos);
    this.level.exits = removePosition(this.level.exits, pos);
    this.level.smokeSources = removePosition(this.level.smokeSources, pos);
    this.level.customers = this.level.customers.filter(
      c => !positionsEqual(c.position, pos)
    );
    this.level.signs = this.level.signs.filter(
      s => !positionsEqual(s.position, pos)
    );
  }

  private render(): void {
    if (this.simulation) {
      this.renderer.renderSimulation(this.level, this.simulation);
    } else {
      this.renderer.renderLevel(this.level);
    }
  }

  startSimulation(): void {
    if (this.level.customers.length === 0) {
      this.updateStatus('请先放置顾客！');
      return;
    }
    
    if (this.level.exits.length === 0) {
      this.updateStatus('请先放置出口！');
      return;
    }
    
    this.simulation = createInitialSimulationState(this.level);
    this.simulationStates = [cloneSimulationState(this.simulation)];
    this.scoreResult = null;
    this.simulation.isRunning = true;
    
    this.simulationInterval = window.setInterval(() => {
      if (this.simulation && !this.simulation.isPaused && this.simulation.isRunning) {
        this.simulation = stepSimulation(this.level, this.simulation);
        this.simulationStates.push(cloneSimulationState(this.simulation));
        this.updateSimulationUI();
        this.render();
        
        if (this.simulation.isComplete) {
          this.stopSimulation();
          this.onSimulationComplete();
        }
      }
    }, SIMULATION_INTERVAL);
    
    this.updateStatus('模拟开始...');
    this.updateToolbarState(true);
  }

  pauseSimulation(): void {
    if (!this.simulation) return;
    
    this.simulation.isPaused = !this.simulation.isPaused;
    this.updateStatus(this.simulation.isPaused ? '模拟已暂停' : '模拟继续中...');
    this.updatePauseButton();
  }

  stopSimulation(): void {
    if (this.simulationInterval !== null) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    
    if (this.simulation) {
      this.simulation.isRunning = false;
    }
    
    this.updateToolbarState(false);
  }

  resetSimulation(): void {
    this.stopSimulation();
    this.simulation = null;
    this.simulationStates = [];
    this.scoreResult = null;
    this.resetSimulationUI();
    this.render();
    this.updateStatus('准备就绪');
  }

  private onSimulationComplete(): void {
    if (!this.simulation) return;
    
    this.scoreResult = calculateScore(this.level, this.simulation);
    this.updateScoreUI();
    this.enableExportButtons();
    this.updateStatus('模拟完成！查看评分结果。');
  }

  setTool(tool: ToolType): void {
    this.selectedTool = tool;
    this.updateToolUI();
  }

  setSignDirection(direction: Direction): void {
    this.selectedSignDirection = direction;
  }

  resizeGrid(width: number, height: number): void {
    if (width < 5 || width > 20 || height < 5 || height > 20) {
      this.updateStatus('网格大小必须在 5-20 之间！');
      return;
    }
    
    this.level = resizeLevel(this.level, width, height);
    this.initCanvas();
    this.render();
    saveCurrentLevel(this.level);
    this.updateStatus('网格大小已调整');
  }

  clearAll(): void {
    this.level = clearLevel(this.level);
    this.resetSimulation();
    this.render();
    saveCurrentLevel(this.level);
    this.updateStatus('已清空所有内容');
  }

  loadExampleLevel(levelKey: 'simple' | 'medium' | 'hard'): void {
    const creator = exampleLevels[levelKey];
    if (creator) {
      this.level = creator();
      this.resetSimulation();
      this.initCanvas();
      this.render();
      saveCurrentLevel(this.level);
      this.updateStatus(`已加载 ${this.level.name}`);
    }
  }

  async saveLevelToFile(): Promise<void> {
    try {
      const content = exportLevelToJSON(this.level);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${this.level.name.replace(/\s+/g, '_')}_level.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      this.updateStatus('关卡已保存');
    } catch (error) {
      this.updateStatus('保存关卡失败');
    }
  }

  async loadLevelFromFile(): Promise<void> {
    try {
      const file = await uploadFile();
      const content = await readFileContent(file);
      const loadedLevel = importLevelFromJSON(content);
      
      if (loadedLevel) {
        this.level = loadedLevel;
        this.resetSimulation();
        this.initCanvas();
        this.render();
        saveCurrentLevel(this.level);
        this.updateStatus(`已加载关卡: ${loadedLevel.name}`);
      } else {
        this.updateStatus('无效的关卡文件');
      }
    } catch (error) {
      this.updateStatus('加载关卡失败');
    }
  }

  exportMarkdown(): void {
    if (!this.simulation || !this.scoreResult) {
      this.updateStatus('请先完成模拟！');
      return;
    }
    
    downloadMarkdownReport(this.level, this.simulation, this.scoreResult);
    this.updateStatus('Markdown 复盘报告已导出');
  }

  exportJSON(): void {
    if (!this.scoreResult) {
      this.updateStatus('请先完成模拟！');
      return;
    }
    
    downloadJSONReplay(this.level, this.simulationStates, this.scoreResult);
    this.updateStatus('JSON 回放文件已导出');
  }

  private updateStatus(message: string): void {
    const statusEl = document.getElementById('statusMessage');
    if (statusEl) {
      statusEl.textContent = message;
    }
  }

  private updateSimulationUI(): void {
    if (!this.simulation) return;
    
    const timeStepEl = document.getElementById('timeStep');
    const evacuatedEl = document.getElementById('evacuated');
    const remainingEl = document.getElementById('remaining');
    
    if (timeStepEl) timeStepEl.textContent = this.simulation.timeStep.toString();
    if (evacuatedEl) evacuatedEl.textContent = this.simulation.evacuatedCount.toString();
    if (remainingEl) {
      const remaining = this.level.customers.length - this.simulation.evacuatedCount - this.simulation.trappedCount;
      remainingEl.textContent = remaining.toString();
    }
  }

  private updateScoreUI(): void {
    if (!this.scoreResult) return;
    
    const totalScoreEl = document.getElementById('totalScore');
    const baseScoreEl = document.getElementById('baseScore');
    const congestionEl = document.getElementById('congestionPenalty');
    const reverseEl = document.getElementById('reversePenalty');
    const deadEndEl = document.getElementById('deadEndPenalty');
    const timeoutEl = document.getElementById('timeoutPenalty');
    const reasonsListEl = document.getElementById('reasonsList');
    
    if (totalScoreEl) totalScoreEl.textContent = this.scoreResult.totalScore.toString();
    if (baseScoreEl) baseScoreEl.textContent = this.scoreResult.baseScore.toString();
    if (congestionEl) congestionEl.textContent = this.scoreResult.congestionPenalty.toString();
    if (reverseEl) reverseEl.textContent = this.scoreResult.reversePenalty.toString();
    if (deadEndEl) deadEndEl.textContent = this.scoreResult.deadEndPenalty.toString();
    if (timeoutEl) timeoutEl.textContent = this.scoreResult.timeoutPenalty.toString();
    
    if (reasonsListEl) {
      reasonsListEl.innerHTML = '';
      for (const reason of this.scoreResult.reasons) {
        const li = document.createElement('li');
        li.textContent = reason;
        reasonsListEl.appendChild(li);
      }
    }
  }

  private resetSimulationUI(): void {
    const timeStepEl = document.getElementById('timeStep');
    const evacuatedEl = document.getElementById('evacuated');
    const remainingEl = document.getElementById('remaining');
    
    if (timeStepEl) timeStepEl.textContent = '0';
    if (evacuatedEl) evacuatedEl.textContent = '0';
    if (remainingEl) remainingEl.textContent = this.level.customers.length.toString();
    
    const totalScoreEl = document.getElementById('totalScore');
    const baseScoreEl = document.getElementById('baseScore');
    const congestionEl = document.getElementById('congestionPenalty');
    const reverseEl = document.getElementById('reversePenalty');
    const deadEndEl = document.getElementById('deadEndPenalty');
    const timeoutEl = document.getElementById('timeoutPenalty');
    const reasonsListEl = document.getElementById('reasonsList');
    
    if (totalScoreEl) totalScoreEl.textContent = '0';
    if (baseScoreEl) baseScoreEl.textContent = '0';
    if (congestionEl) congestionEl.textContent = '0';
    if (reverseEl) reverseEl.textContent = '0';
    if (deadEndEl) deadEndEl.textContent = '0';
    if (timeoutEl) timeoutEl.textContent = '0';
    if (reasonsListEl) reasonsListEl.innerHTML = '';
    
    this.disableExportButtons();
  }

  private updateToolbarState(isRunning: boolean): void {
    const startBtn = document.getElementById('startSimulation') as HTMLButtonElement;
    const pauseBtn = document.getElementById('pauseSimulation') as HTMLButtonElement;
    
    if (startBtn) startBtn.disabled = isRunning;
    if (pauseBtn) pauseBtn.disabled = !isRunning;
    if (pauseBtn) pauseBtn.textContent = isRunning ? '暂停' : '暂停';
  }

  private updatePauseButton(): void {
    const pauseBtn = document.getElementById('pauseSimulation') as HTMLButtonElement;
    if (pauseBtn && this.simulation) {
      pauseBtn.textContent = this.simulation.isPaused ? '继续' : '暂停';
    }
  }

  private updateToolUI(): void {
    const toolButtons = document.querySelectorAll('.tool-btn');
    const currentToolEl = document.getElementById('currentTool');
    
    toolButtons.forEach(btn => {
      const tool = btn.getAttribute('data-tool');
      if (tool === this.selectedTool) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    if (currentToolEl) {
      const toolNames: Record<ToolType, string> = {
        select: '选择',
        wall: '墙体',
        exit: '出口',
        smoke: '烟源',
        customer: '顾客',
        sign: '指示牌',
        eraser: '橡皮擦',
      };
      currentToolEl.textContent = toolNames[this.selectedTool] || '选择';
    }
  }

  private enableExportButtons(): void {
    const markdownBtn = document.getElementById('exportMarkdown') as HTMLButtonElement;
    const jsonBtn = document.getElementById('exportJSON') as HTMLButtonElement;
    
    if (markdownBtn) markdownBtn.disabled = false;
    if (jsonBtn) jsonBtn.disabled = false;
  }

  private disableExportButtons(): void {
    const markdownBtn = document.getElementById('exportMarkdown') as HTMLButtonElement;
    const jsonBtn = document.getElementById('exportJSON') as HTMLButtonElement;
    
    if (markdownBtn) markdownBtn.disabled = true;
    if (jsonBtn) jsonBtn.disabled = true;
  }

  getLevel(): Level {
    return cloneLevel(this.level);
  }

  getSimulation(): SimulationState | null {
    return this.simulation ? cloneSimulationState(this.simulation) : null;
  }
}

function cloneSimulationState(state: SimulationState): SimulationState {
  return {
    ...state,
    customers: state.customers.map(c => ({
      ...c,
      position: { ...c.position },
      targetExit: c.targetExit ? { ...c.targetExit } : null,
      path: c.path.map(p => ({ ...p })),
    })),
    smokeCells: state.smokeCells.map(s => ({
      ...s,
      position: { ...s.position },
    })),
    congestionEvents: state.congestionEvents.map(e => ({
      ...e,
      position: { ...e.position },
      customerIds: [...e.customerIds],
    })),
    reverseEvents: state.reverseEvents.map(e => ({
      ...e,
      position: { ...e.position },
    })),
    deadEndEvents: state.deadEndEvents.map(e => ({
      ...e,
      position: { ...e.position },
    })),
  };
}
