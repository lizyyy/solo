import { SceneManager } from './renderer/SceneManager.js';
import { FloorRenderer } from './renderer/FloorRenderer.js';
import { PersonRenderer } from './renderer/PersonRenderer.js';
import { TimelineController } from './core/TimelineController.js';
import { DataLoader } from './parsers/DataLoader.js';
import { AnalysisEngine } from './analysis/AnalysisEngine.js';
import { ReportExporter } from './export/ReportExporter.js';
import { SampleDataGenerator } from './data/SampleDataGenerator.js';
import { UIManager } from './ui/UIManager.js';
import { AnomalyType } from './models/types.js';

class FireDrillVisualizer {
  constructor() {
    this.sceneManager = null;
    this.floorRenderer = null;
    this.personRenderer = null;
    this.timeline = null;
    this.dataLoader = null;
    this.analysisEngine = null;
    this.reportExporter = null;
    this.uiManager = null;
    
    this.simulationData = null;
    this.selectedPersonId = null;
    this.visibleFloors = new Set();
    this.activeFilters = {
      floor: 'all',
      group: 'all',
      anomalyType: 'all'
    };
    
    this.init();
  }

  init() {
    const container = document.getElementById('app');
    if (!container) {
      console.error('找不到 #app 容器');
      return;
    }
    
    this.uiManager = new UIManager(this);
    this.uiManager.init(container);
    
    this.dataLoader = new DataLoader();
    
    const canvasContainer = document.getElementById('canvas-container');
    if (canvasContainer) {
      this.sceneManager = new SceneManager(canvasContainer);
      this.floorRenderer = new FloorRenderer(this.sceneManager);
      this.personRenderer = new PersonRenderer(this.sceneManager);
      
      this.sceneManager.setClickCallback((type, data) => {
        if (type === 'person') {
          this.selectPerson(data.id);
        }
      });
      
      this.sceneManager.startAnimationLoop();
    }
    
    this.timeline = new TimelineController();
    this.setupTimelineEvents();
  }

  setupTimelineEvents() {
    this.timeline.on('onTimeChange', (time, progress) => {
      this.updatePersons(time);
      if (this.uiManager) {
        this.uiManager.updateTimeDisplay(time);
      }
    });
    
    this.timeline.on('onPlay', () => {
      if (this.uiManager) {
        this.uiManager.updatePlayButton(true);
      }
    });
    
    this.timeline.on('onPause', () => {
      if (this.uiManager) {
        this.uiManager.updatePlayButton(false);
      }
    });
  }

  async initializeScene() {
    if (!this.simulationData || !this.sceneManager) return;
    
    this.floorRenderer.clearFloors();
    this.personRenderer.clearPersons();
    
    const floors = Array.from(this.simulationData.floors.values());
    const minLevel = Math.min(...floors.map(f => f.level));
    const yOffset = -minLevel * 4;
    
    for (const floor of this.simulationData.floors.values()) {
      this.floorRenderer.renderFloor(floor, yOffset);
      this.visibleFloors.add(floor.level);
      
      for (const edge of floor.edges) {
        this.floorRenderer.renderEdge(edge, yOffset);
      }
      
      for (const exit of floor.exits) {
        this.floorRenderer.renderExit(exit, yOffset);
      }
    }
    
    for (const person of this.simulationData.persons.values()) {
      this.personRenderer.renderPerson(person, yOffset, false);
      this.personRenderer.renderTrajectory(person, yOffset, false);
    }
    
    this.sceneManager.addAnimationCallback(() => {
      this.animatePersons();
    });
  }

  runAnalysis() {
    if (!this.simulationData) return;
    
    this.analysisEngine = new AnalysisEngine(this.simulationData);
    this.analysisEngine.runFullAnalysis();
    
    const congestionEvents = this.analysisEngine.getCongestionEvents();
    const minLevel = Math.min(...Array.from(this.simulationData.floors.values()).map(f => f.level));
    const yOffset = -minLevel * 4;
    
    for (const event of congestionEvents) {
      this.personRenderer.renderCongestionEvent(event, yOffset);
    }
    
    this.reportExporter = new ReportExporter(this.analysisEngine);
  }

  updatePersons(time) {
    if (!this.personRenderer || !this.simulationData) return;
    
    const minLevel = Math.min(...Array.from(this.simulationData.floors.values()).map(f => f.level));
    const yOffset = -minLevel * 4;
    
    const personMeshes = this.sceneManager.getObjectsByCategory('persons');
    for (const mesh of personMeshes) {
      if (mesh.visible) {
        this.personRenderer.updatePersonPosition(mesh, time, yOffset);
      }
    }
  }

  animatePersons() {
    if (!this.timeline?.isPlaying) return;
  }

  selectPerson(personId) {
    if (this.selectedPersonId === personId) {
      this.deselectPerson();
      return;
    }
    
    this.selectedPersonId = personId;
    
    this.personRenderer.highlightPerson(personId, true);
    
    const person = this.simulationData.getPerson(personId);
    if (person) {
      const minLevel = Math.min(...Array.from(this.simulationData.floors.values()).map(f => f.level));
      const yOffset = -minLevel * 4;
      
      this.personRenderer.renderTrajectory(person, yOffset, true);
      
      if (this.uiManager) {
        this.uiManager.updatePersonDetails(person);
      }
      
      if (person.trajectory.length > 0) {
        const pos = person.trajectory[0].position;
        const floorY = yOffset + pos.floor * 4;
        this.sceneManager.lookAt(pos.x, floorY + 2, pos.y);
      }
    }
  }

  deselectPerson() {
    if (this.selectedPersonId) {
      this.personRenderer.highlightPerson(this.selectedPersonId, false);
      
      const trajectories = this.sceneManager.getObjectsByCategory('trajectories');
      for (const traj of trajectories) {
        if (traj.userData.personId === this.selectedPersonId) {
          this.sceneManager.removeObject(traj);
        }
      }
      
      this.selectedPersonId = null;
      
      if (this.uiManager) {
        this.uiManager.updatePersonDetails(null);
      }
    }
  }

  applyFilters(filters) {
    this.activeFilters = { ...this.activeFilters, ...filters };
    
    if (!this.personRenderer || !this.analysisEngine) return;
    
    let filteredPersons = Array.from(this.simulationData.persons.values());
    
    if (this.activeFilters.floor !== 'all') {
      const floorLevel = parseInt(this.activeFilters.floor);
      filteredPersons = filteredPersons.filter(p => {
        if (p.trajectory.length > 0) {
          return p.trajectory[0].position.floor === floorLevel;
        }
        return false;
      });
    }
    
    if (this.activeFilters.group !== 'all') {
      filteredPersons = filteredPersons.filter(p => p.group === this.activeFilters.group);
    }
    
    if (this.activeFilters.anomalyType !== 'all') {
      const anomalyType = this.activeFilters.anomalyType;
      
      if (anomalyType === 'has_anomaly') {
        filteredPersons = filteredPersons.filter(p => 
          p.analysis && p.analysis.anomalies.length > 0
        );
      } else {
        const typeMap = {
          'wrong_exit': AnomalyType.WRONG_EXIT,
          'blocked_path': AnomalyType.BLOCKED_PATH,
          'stay_too_long': AnomalyType.STAY_TOO_LONG,
          'wrong_direction': AnomalyType.WRONG_DIRECTION
        };
        
        const targetType = typeMap[anomalyType];
        if (targetType) {
          filteredPersons = filteredPersons.filter(p => 
            p.analysis && p.analysis.anomalies.some(a => a.type === targetType)
          );
        }
      }
    }
    
    const visibleIds = new Set(filteredPersons.map(p => p.id));
    
    this.personRenderer.filterPersons(person => visibleIds.has(person.id));
  }

  resetFilters() {
    this.activeFilters = {
      floor: 'all',
      group: 'all',
      anomalyType: 'all'
    };
    
    if (this.personRenderer) {
      this.personRenderer.filterPersons(null);
    }
  }

  exportMarkdownReport() {
    if (this.reportExporter) {
      this.reportExporter.downloadMarkdownReport();
      if (this.uiManager) {
        this.uiManager.showNotification('Markdown 报告已导出！');
      }
    }
  }

  exportJSONReport() {
    if (this.reportExporter) {
      this.reportExporter.downloadJSONReport();
      if (this.uiManager) {
        this.uiManager.showNotification('JSON 分析结果已导出！');
      }
    }
  }

  setFloorVisibility(floorLevel, visible) {
    if (visible) {
      this.visibleFloors.add(floorLevel);
    } else {
      this.visibleFloors.delete(floorLevel);
    }
    
    if (this.floorRenderer) {
      this.floorRenderer.setFloorVisibility(floorLevel, visible);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new FireDrillVisualizer();
});

export default FireDrillVisualizer;
