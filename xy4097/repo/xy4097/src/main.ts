import { SceneRenderer, ElementDragEvent } from './renderers/SceneRenderer';
import { SimulationEngine } from './engine/SimulationEngine';
import { AppStateManager } from './stores/AppState';
import { ReportExporter } from './exporters/ReportExporter';
import { parseExhibitionJson, exportToJson } from './parsers/jsonParser';
import { parseTimeSlotCsv } from './parsers/csvParser';
import { ExhibitionConfig, TimeSlot, RiskSummary } from './types';

const DEMO_EXHIBITION_JSON: ExhibitionConfig = {
  version: '1.0.0',
  exhibitionName: '古代文明特展',
  exhibitionDate: '2026-06-01',
  venue: '城市博物馆一层展厅',
  floor: {
    width: 20,
    depth: 15,
    height: 0.1,
  },
  elements: [
    {
      id: 'entrance_1',
      type: 'entrance',
      name: '主入口',
      position: { x: -9, z: 0 },
      dimensions: { width: 2, depth: 2, height: 0.1 },
    },
    {
      id: 'exit_1',
      type: 'exit',
      name: '主出口',
      position: { x: 9, z: 0 },
      dimensions: { width: 2, depth: 2, height: 0.1 },
    },
    {
      id: 'exhibit_1',
      type: 'exhibit',
      name: '青铜器展区',
      position: { x: -5, z: -3 },
      dimensions: { width: 3, depth: 2, height: 2 },
    },
    {
      id: 'exhibit_2',
      type: 'exhibit',
      name: '陶瓷展区',
      position: { x: -5, z: 3 },
      dimensions: { width: 3, depth: 2, height: 2 },
    },
    {
      id: 'exhibit_3',
      type: 'exhibit',
      name: '书画展区',
      position: { x: 0, z: -5 },
      dimensions: { width: 4, depth: 1.5, height: 2.5 },
    },
    {
      id: 'exhibit_4',
      type: 'exhibit',
      name: '玉器展区',
      position: { x: 0, z: 5 },
      dimensions: { width: 4, depth: 1.5, height: 2 },
    },
    {
      id: 'exhibit_5',
      type: 'exhibit',
      name: '镇馆之宝',
      position: { x: 5, z: 0 },
      dimensions: { width: 2.5, depth: 2.5, height: 3 },
    },
    {
      id: 'restricted_1',
      type: 'restricted',
      name: '工作区',
      position: { x: -9, z: 5 },
      dimensions: { width: 2, depth: 3, height: 0.1 },
    },
  ],
};

const DEMO_TIMESLOTS_CSV = `id,startTime,endTime,visitorCount,description
TS001,09:00,10:00,80,开馆第一时段
TS002,10:00,11:00,120,高峰时段
TS003,11:00,12:00,100,午间时段
TS004,13:00,14:00,90,下午时段
TS005,14:00,15:00,150,高峰时段
TS006,15:00,16:00,110,闭馆前时段`;

class Application {
  private sceneRenderer: SceneRenderer | null = null;
  private simulationEngine: SimulationEngine | null = null;
  private stateManager: AppStateManager;
  private reportExporter: ReportExporter;
  
  private animationFrameId: number | null = null;
  private gridSize = 1;

  constructor() {
    this.stateManager = new AppStateManager();
    this.reportExporter = new ReportExporter();
    
    this.initializeScene();
    this.setupEventListeners();
  }

  private initializeScene(): void {
    try {
      this.sceneRenderer = new SceneRenderer({
        containerId: 'canvas-container',
        gridSize: this.gridSize,
      });

      this.sceneRenderer.setOnElementDrag(this.handleElementDrag.bind(this));
      this.sceneRenderer.setOnElementSelect((event) => {
        if (event.element) {
          this.stateManager.setSelectedElement({
            id: event.element.id,
            name: event.element.name,
            type: event.element.type,
          });
        } else {
          this.stateManager.setSelectedElement(null);
        }
      });
    } catch (error) {
      console.error('Failed to initialize scene:', error);
      alert('3D场景初始化失败，请确保浏览器支持WebGL');
    }
  }

  private handleElementDrag(event: ElementDragEvent): void {
    this.stateManager.updateElementPosition(event.element.id, event.newPosition);
    
    if (this.simulationEngine && this.stateManager.getState().currentConfig) {
      this.simulationEngine.updateConfig(this.stateManager.getState().currentConfig!);
    }
    
    this.updateUI();
  }

  private setupEventListeners(): void {
    const jsonInput = document.getElementById('json-input') as HTMLInputElement;
    const csvInput = document.getElementById('csv-input') as HTMLInputElement;
    const loadDemoBtn = document.getElementById('load-demo') as HTMLButtonElement;
    const startSimulationBtn = document.getElementById('start-simulation') as HTMLButtonElement;
    const pauseSimulationBtn = document.getElementById('pause-simulation') as HTMLButtonElement;
    const resetSimulationBtn = document.getElementById('reset-simulation') as HTMLButtonElement;
    const recalculateBtn = document.getElementById('recalculate') as HTMLButtonElement;
    const savePlanBtn = document.getElementById('save-plan') as HTMLButtonElement;
    const screenshotBtn = document.getElementById('screenshot') as HTMLButtonElement;
    const exportReportBtn = document.getElementById('export-report') as HTMLButtonElement;

    if (jsonInput) {
      jsonInput.addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          await this.loadJsonFile(file);
        }
      });
    }

    if (csvInput) {
      csvInput.addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          await this.loadCsvFile(file);
        }
      });
    }

    if (loadDemoBtn) {
      loadDemoBtn.addEventListener('click', () => this.loadDemoData());
    }

    if (startSimulationBtn) {
      startSimulationBtn.addEventListener('click', () => this.startSimulation());
    }

    if (pauseSimulationBtn) {
      pauseSimulationBtn.addEventListener('click', () => this.pauseSimulation());
    }

    if (resetSimulationBtn) {
      resetSimulationBtn.addEventListener('click', () => this.resetSimulation());
    }

    if (recalculateBtn) {
      recalculateBtn.addEventListener('click', () => this.recalculate());
    }

    if (savePlanBtn) {
      savePlanBtn.addEventListener('click', () => this.savePlan());
    }

    if (screenshotBtn) {
      screenshotBtn.addEventListener('click', () => this.exportScreenshot());
    }

    if (exportReportBtn) {
      exportReportBtn.addEventListener('click', () => this.exportReport());
    }

    this.stateManager.subscribe(() => this.updateUI());
  }

  private async loadJsonFile(file: File): Promise<void> {
    try {
      const text = await file.text();
      const config = parseExhibitionJson(text);
      
      this.stateManager.setConfig(config);
      
      if (this.sceneRenderer) {
        this.sceneRenderer.loadConfig(config);
      }

      const statusEl = document.getElementById('json-status');
      if (statusEl) {
        statusEl.textContent = `已加载: ${config.exhibitionName}`;
        statusEl.style.color = '#4CAF50';
      }
    } catch (error) {
      const statusEl = document.getElementById('json-status');
      if (statusEl) {
        statusEl.textContent = `错误: ${(error as Error).message}`;
        statusEl.style.color = '#ff4444';
      }
    }
  }

  private async loadCsvFile(file: File): Promise<void> {
    try {
      const text = await file.text();
      const timeSlots = parseTimeSlotCsv(text);
      
      this.stateManager.setTimeSlots(timeSlots);

      const statusEl = document.getElementById('csv-status');
      if (statusEl) {
        statusEl.textContent = `已加载: ${timeSlots.length} 个时段`;
        statusEl.style.color = '#4CAF50';
      }
    } catch (error) {
      const statusEl = document.getElementById('csv-status');
      if (statusEl) {
        statusEl.textContent = `错误: ${(error as Error).message}`;
        statusEl.style.color = '#ff4444';
      }
    }
  }

  private loadDemoData(): void {
    try {
      const config = JSON.parse(JSON.stringify(DEMO_EXHIBITION_JSON));
      const timeSlots = parseTimeSlotCsv(DEMO_TIMESLOTS_CSV);

      this.stateManager.setConfig(config);
      this.stateManager.setTimeSlots(timeSlots);

      if (this.sceneRenderer) {
        this.sceneRenderer.loadConfig(config);
      }

      const jsonStatusEl = document.getElementById('json-status');
      const csvStatusEl = document.getElementById('csv-status');

      if (jsonStatusEl) {
        jsonStatusEl.textContent = `已加载: ${config.exhibitionName} (示例)`;
        jsonStatusEl.style.color = '#4CAF50';
      }
      if (csvStatusEl) {
        csvStatusEl.textContent = `已加载: ${timeSlots.length} 个时段 (示例)`;
        csvStatusEl.style.color = '#4CAF50';
      }
    } catch (error) {
      console.error('Failed to load demo data:', error);
    }
  }

  private startSimulation(): void {
    const state = this.stateManager.getState();
    
    if (!state.currentConfig || !state.selectedTimeSlot) {
      alert('请先加载展厅配置并选择时段');
      return;
    }

    if (!this.simulationEngine) {
      this.simulationEngine = new SimulationEngine(
        state.currentConfig,
        state.selectedTimeSlot,
        this.gridSize
      );
    }

    this.simulationEngine.start();
    this.stateManager.setSimulating(true);

    this.reportExporter.setConfig(state.currentConfig);
    this.reportExporter.setTimeSlot(state.selectedTimeSlot);

    this.runSimulationLoop();
  }

  private runSimulationLoop(): void {
    const state = this.stateManager.getState();
    
    if (!state.isSimulating || !this.simulationEngine) {
      return;
    }

    for (let i = 0; i < state.simulationSpeed * 5; i++) {
      this.simulationEngine.step();
    }

    const result = this.simulationEngine.getResult();
    this.stateManager.setSimulationResult(result);

    if (this.sceneRenderer) {
      const visitors = this.simulationEngine.getVisitors();
      this.sceneRenderer.updateVisitorPositions(
        visitors.map(v => ({
          id: v.id,
          x: v.position.x,
          z: v.position.z,
        }))
      );

      this.sceneRenderer.updateHeatmap(result.heatZones, result.riskSummary.maxDensity);
    }

    this.reportExporter.setSimulationResult(result);

    this.animationFrameId = requestAnimationFrame(() => this.runSimulationLoop());
  }

  private pauseSimulation(): void {
    this.stateManager.setSimulating(false);
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private resetSimulation(): void {
    this.pauseSimulation();
    
    if (this.simulationEngine) {
      this.simulationEngine.reset();
    }
    
    this.stateManager.setSimulationResult(null);
    
    if (this.sceneRenderer) {
      this.sceneRenderer.clearHeatmap();
      this.sceneRenderer.clearVisitorMarkers();
    }
  }

  private recalculate(): void {
    const state = this.stateManager.getState();
    
    if (!state.currentConfig || !state.selectedTimeSlot) {
      return;
    }

    this.resetSimulation();

    this.simulationEngine = new SimulationEngine(
      state.currentConfig,
      state.selectedTimeSlot,
      this.gridSize
    );

    this.startSimulation();
  }

  private savePlan(): void {
    try {
      const plan = this.stateManager.saveCurrentPlan();
      
      const json = exportToJson(plan.config);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.download = `plan_${new Date().toISOString().split('T')[0]}.json`;
      link.href = url;
      link.click();
      
      URL.revokeObjectURL(url);
      
      alert('方案已保存并下载');
    } catch (error) {
      alert(`保存失败: ${(error as Error).message}`);
    }
  }

  private exportScreenshot(): void {
    if (!this.sceneRenderer) return;
    
    try {
      const dataUrl = this.sceneRenderer.takeScreenshot();
      this.reportExporter.exportPng(
        dataUrl,
        `heatmap_${Date.now()}.png`
      );
    } catch (error) {
      alert(`截图失败: ${(error as Error).message}`);
    }
  }

  private exportReport(): void {
    const state = this.stateManager.getState();
    
    if (!state.simulationResult) {
      alert('请先运行模拟');
      return;
    }

    try {
      let screenshotDataUrl: string | undefined;
      if (this.sceneRenderer) {
        screenshotDataUrl = this.sceneRenderer.takeScreenshot();
      }

      this.reportExporter.exportMarkdownFile(
        {
          includeScreenshot: false,
          includeRiskAnalysis: true,
          includeRecommendations: true,
        },
        undefined,
        `risk_report_${Date.now()}.md`
      );

      alert('报告已导出');
    } catch (error) {
      alert(`导出报告失败: ${(error as Error).message}`);
    }
  }

  private updateUI(): void {
    const state = this.stateManager.getState();

    this.updateTimeSlotList();
    this.updateButtons(state);
    this.updateRiskDisplay(state.simulationResult?.riskSummary);
    this.updateStats(state.simulationResult?.riskSummary);
  }

  private updateTimeSlotList(): void {
    const state = this.stateManager.getState();
    const listEl = document.getElementById('timeslot-list');
    
    if (!listEl) return;

    if (state.currentTimeSlots.length === 0) {
      listEl.innerHTML = '<p class="info-text">请先导入数据</p>';
      return;
    }

    listEl.innerHTML = state.currentTimeSlots
      .map((slot) => {
        const isSelected = state.selectedTimeSlot?.id === slot.id;
        return `
          <div class="timeslot-item ${isSelected ? 'selected' : ''}" data-id="${slot.id}">
            <div class="time">${slot.startTime} - ${slot.endTime}</div>
            <div class="visitors">👥 ${slot.visitorCount} 人</div>
          </div>
        `;
      })
      .join('');

    listEl.querySelectorAll('.timeslot-item').forEach((item) => {
      item.addEventListener('click', () => {
        const id = (item as HTMLElement).dataset.id;
        if (id) {
          this.stateManager.selectTimeSlot(id);
          
          if (this.stateManager.getState().isSimulating) {
            this.resetSimulation();
          }
          
          this.simulationEngine = null;
        }
      });
    });
  }

  private updateButtons(state: ReturnType<AppStateManager['getState']>): void {
    const startBtn = document.getElementById('start-simulation') as HTMLButtonElement;
    const pauseBtn = document.getElementById('pause-simulation') as HTMLButtonElement;
    const resetBtn = document.getElementById('reset-simulation') as HTMLButtonElement;
    const recalculateBtn = document.getElementById('recalculate') as HTMLButtonElement;
    const savePlanBtn = document.getElementById('save-plan') as HTMLButtonElement;
    const screenshotBtn = document.getElementById('screenshot') as HTMLButtonElement;
    const exportReportBtn = document.getElementById('export-report') as HTMLButtonElement;

    const canStart = this.stateManager.canStartSimulation();
    const isSimulating = state.isSimulating;
    const hasResult = state.simulationResult !== null;
    const canSave = this.stateManager.canSave();
    const canExport = this.stateManager.canExport();

    if (startBtn) {
      startBtn.disabled = !canStart || isSimulating;
    }
    if (pauseBtn) {
      pauseBtn.disabled = !isSimulating;
    }
    if (resetBtn) {
      resetBtn.disabled = !canStart;
    }
    if (recalculateBtn) {
      recalculateBtn.disabled = !canStart;
    }
    if (savePlanBtn) {
      savePlanBtn.disabled = !canSave;
    }
    if (screenshotBtn) {
      screenshotBtn.disabled = !hasResult;
    }
    if (exportReportBtn) {
      exportReportBtn.disabled = !canExport;
    }
  }

  private updateRiskDisplay(summary?: RiskSummary | null): void {
    if (!summary) {
      ['critical', 'high', 'medium', 'low'].forEach((level) => {
        const el = document.getElementById(`risk-${level}`);
        if (el) el.textContent = '0';
      });
      return;
    }

    const criticalEl = document.getElementById('risk-critical');
    const highEl = document.getElementById('risk-high');
    const mediumEl = document.getElementById('risk-medium');
    const lowEl = document.getElementById('risk-low');

    if (criticalEl) criticalEl.textContent = summary.criticalZones.toString();
    if (highEl) highEl.textContent = summary.highZones.toString();
    if (mediumEl) mediumEl.textContent = summary.mediumZones.toString();
    if (lowEl) lowEl.textContent = summary.lowZones.toString();
  }

  private updateStats(summary?: RiskSummary | null): void {
    const visitorsEl = document.getElementById('stat-visitors');
    const maxDensityEl = document.getElementById('stat-max-density');
    const criticalEl = document.getElementById('stat-critical');
    const bottlenecksEl = document.getElementById('stat-bottlenecks');

    if (!summary) {
      if (visitorsEl) visitorsEl.textContent = '0';
      if (maxDensityEl) maxDensityEl.textContent = '0';
      if (criticalEl) criticalEl.textContent = '0';
      if (bottlenecksEl) bottlenecksEl.textContent = '0';
      return;
    }

    if (visitorsEl) visitorsEl.textContent = summary.totalVisitors.toString();
    if (maxDensityEl) maxDensityEl.textContent = summary.maxDensity.toFixed(1);
    if (criticalEl) criticalEl.textContent = summary.criticalZones.toString();
    if (bottlenecksEl) bottlenecksEl.textContent = summary.bottleneckCount.toString();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new Application();
});
