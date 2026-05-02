import {
  AppState,
  ExhibitionConfig,
  TimeSlot,
  SimulationResult,
  SavedPlan,
  HeatZone,
  RiskSummary,
} from '../types';

type StateChangeListener = (state: AppState) => void;

const INITIAL_STATE: AppState = {
  currentConfig: null,
  currentTimeSlots: [],
  selectedTimeSlot: null,
  simulationResult: null,
  sceneLoaded: false,
  isSimulating: false,
  selectedElement: null,
  simulationSpeed: 1,
  gridSize: 1,
};

export class AppStateManager {
  private state: AppState = { ...INITIAL_STATE };
  private listeners: Set<StateChangeListener> = new Set();
  private saveHistory: SavedPlan[] = [];

  constructor() {
    this.loadFromLocalStorage();
  }

  private loadFromLocalStorage(): void {
    try {
      const saved = localStorage.getItem('exhibition_plans');
      if (saved) {
        this.saveHistory = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load from localStorage:', e);
    }
  }

  private saveToLocalStorage(): void {
    try {
      localStorage.setItem('exhibition_plans', JSON.stringify(this.saveHistory));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }

  private notify(): void {
    this.listeners.forEach(listener => listener(this.state));
  }

  subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): AppState {
    return { ...this.state };
  }

  setConfig(config: ExhibitionConfig | null): void {
    this.state.currentConfig = config;
    this.state.sceneLoaded = config !== null;
    
    if (config === null) {
      this.state.simulationResult = null;
      this.state.isSimulating = false;
    }
    
    this.notify();
  }

  setTimeSlots(timeSlots: TimeSlot[]): void {
    this.state.currentTimeSlots = timeSlots;
    
    if (timeSlots.length > 0) {
      this.state.selectedTimeSlot = timeSlots[0];
    } else {
      this.state.selectedTimeSlot = null;
    }
    
    this.notify();
  }

  selectTimeSlot(timeSlotId: string): void {
    const timeSlot = this.state.currentTimeSlots.find(s => s.id === timeSlotId);
    
    if (timeSlot) {
      this.state.selectedTimeSlot = timeSlot;
      this.state.simulationResult = null;
      this.state.isSimulating = false;
    }
    
    this.notify();
  }

  setSimulationResult(result: SimulationResult | null): void {
    this.state.simulationResult = result;
    this.notify();
  }

  setSimulating(isSimulating: boolean): void {
    this.state.isSimulating = isSimulating;
    this.notify();
  }

  setSelectedElement(element: { id: string; name: string; type: string } | null): void {
    if (this.state.currentConfig && element) {
      this.state.selectedElement = this.state.currentConfig.elements.find(
        e => e.id === element.id
      ) || null;
    } else {
      this.state.selectedElement = null;
    }
    this.notify();
  }

  updateElementPosition(elementId: string, position: { x: number; z: number }): void {
    if (!this.state.currentConfig) return;

    const element = this.state.currentConfig.elements.find(e => e.id === elementId);
    if (element) {
      element.position.x = position.x;
      element.position.z = position.z;
    }

    this.state.simulationResult = null;
    this.notify();
  }

  setSimulationSpeed(speed: number): void {
    this.state.simulationSpeed = Math.max(0.1, Math.min(10, speed));
    this.notify();
  }

  saveCurrentPlan(planName?: string): SavedPlan {
    if (!this.state.currentConfig) {
      throw new Error('No configuration to save');
    }

    const plan: SavedPlan = {
      config: JSON.parse(JSON.stringify(this.state.currentConfig)),
      timeSlots: JSON.parse(JSON.stringify(this.state.currentTimeSlots)),
      savedAt: new Date().toISOString(),
      simulationResults: this.state.simulationResult
        ? [this.state.simulationResult]
        : [],
    };

    this.saveHistory = [plan, ...this.saveHistory].slice(0, 10);
    this.saveToLocalStorage();

    return plan;
  }

  loadPlan(index: number): boolean {
    if (index < 0 || index >= this.saveHistory.length) {
      return false;
    }

    const plan = this.saveHistory[index];
    this.state.currentConfig = plan.config;
    this.state.currentTimeSlots = plan.timeSlots;
    this.state.selectedTimeSlot = plan.timeSlots.length > 0 ? plan.timeSlots[0] : null;
    this.state.sceneLoaded = true;
    this.state.simulationResult = null;
    this.state.isSimulating = false;

    this.notify();
    return true;
  }

  getSaveHistory(): SavedPlan[] {
    return [...this.saveHistory];
  }

  clearHistory(): void {
    this.saveHistory = [];
    this.saveToLocalStorage();
  }

  reset(): void {
    this.state = { ...INITIAL_STATE };
    this.notify();
  }

  getHeatZones(): HeatZone[] {
    return this.state.simulationResult?.heatZones || [];
  }

  getRiskSummary(): RiskSummary | null {
    return this.state.simulationResult?.riskSummary || null;
  }

  canStartSimulation(): boolean {
    return (
      this.state.currentConfig !== null &&
      this.state.selectedTimeSlot !== null &&
      this.state.sceneLoaded
    );
  }

  canExport(): boolean {
    return this.state.simulationResult !== null;
  }

  canSave(): boolean {
    return this.state.currentConfig !== null;
  }
}
