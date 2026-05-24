import { SceneManager } from './scene/SceneManager.js';
import { MallBuilder } from './scene/MallBuilder.js';
import { DragController } from './interaction/DragController.js';
import { Validator } from './validation/Validator.js';
import { ReportExporter } from './report/ReportExporter.js';
import { TimelineController } from './interaction/TimelineController.js';
import { sampleMallData } from './data/sampleData.js';

class App {
  constructor() {
    this.canvas = document.getElementById('scene-canvas');
    this.sceneManager = null;
    this.mallBuilder = null;
    this.dragController = null;
    this.validator = null;
    this.reportExporter = null;
    this.timelineController = null;
    this.currentFloor = 'all';
    this.filters = {
      escalator: true,
      fireDoor: true,
      heatmap: true,
      direction: true
    };

    this.init();
  }

  init() {
    this.sceneManager = new SceneManager(this.canvas);
    this.mallBuilder = new MallBuilder(this.sceneManager);
    this.dragController = new DragController(this.sceneManager, this.mallBuilder);
    this.validator = new Validator(this.sceneManager);
    this.reportExporter = new ReportExporter(this.sceneManager, this.validator);
    this.timelineController = new TimelineController(this.sceneManager);

    window.flowPaths = sampleMallData.flowPaths;

    this.buildScene();
    this.setupEventListeners();
    this.validator.validate();
    this.dragController.updateBarrierListUI();
  }

  buildScene() {
    sampleMallData.floors.forEach(floor => {
      this.mallBuilder.buildFloor(floor);
    });

    sampleMallData.escalators.forEach(escalator => {
      const floor = sampleMallData.floors.find(f => f.id === escalator.floor);
      if (floor) {
        this.mallBuilder.buildEscalator(escalator, floor.y);
      }
    });

    sampleMallData.fireDoors.forEach(fireDoor => {
      const floor = sampleMallData.floors.find(f => f.id === fireDoor.floor);
      if (floor) {
        this.mallBuilder.buildFireDoor(fireDoor, floor.y);
      }
    });

    sampleMallData.barriers.forEach(barrier => {
      const floor = sampleMallData.floors.find(f => f.id === barrier.floor);
      if (floor) {
        this.mallBuilder.buildBarrier(barrier, floor.y);
      }
    });

    sampleMallData.flowPaths.forEach(path => {
      const floor = sampleMallData.floors.find(f => f.id === path.floor);
      if (floor) {
        this.mallBuilder.buildHeatmap(path, floor.y);
        
        for (let i = 0; i < path.points.length - 1; i++) {
          this.mallBuilder.buildDirectionArrow(path.points[i], path.points[i + 1], floor.y, i);
        }
      }
    });

    sampleMallData.stores.forEach(store => {
      const floor = sampleMallData.floors.find(f => f.id === store.floor);
      if (floor) {
        this.mallBuilder.buildStore(store, floor.y);
      }
    });

    this.timelineController.recordInitialState();
  }

  setupEventListeners() {
    document.getElementById('floor-select').addEventListener('change', (e) => {
      this.currentFloor = e.target.value;
      this.filterByFloor(this.currentFloor);
    });

    document.getElementById('filter-escalator').addEventListener('change', (e) => {
      this.filters.escalator = e.target.checked;
      this.toggleVisibility('escalators', this.filters.escalator);
    });

    document.getElementById('filter-fire-door').addEventListener('change', (e) => {
      this.filters.fireDoor = e.target.checked;
      this.toggleVisibility('fireDoors', this.filters.fireDoor);
    });

    document.getElementById('filter-heatmap').addEventListener('change', (e) => {
      this.filters.heatmap = e.target.checked;
      this.toggleHeatmapVisibility(this.filters.heatmap);
    });

    document.getElementById('filter-direction').addEventListener('change', (e) => {
      this.filters.direction = e.target.checked;
      this.toggleDirectionVisibility(this.filters.direction);
    });

    document.getElementById('btn-add-barrier').addEventListener('click', () => {
      this.dragController.addBarrier('1F');
    });

    document.getElementById('btn-import').addEventListener('click', () => {
      this.importSample();
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
      this.resetState();
    });

    document.getElementById('btn-export').addEventListener('click', () => {
      this.exportReport();
    });

    document.getElementById('btn-play').addEventListener('click', () => {
      this.timelineController.play();
    });

    document.getElementById('btn-pause').addEventListener('click', () => {
      this.timelineController.pause();
    });

    document.getElementById('btn-speed').addEventListener('click', (e) => {
      const speeds = [1, 2, 4];
      const currentIndex = speeds.indexOf(this.timelineController.speed);
      const nextIndex = (currentIndex + 1) % speeds.length;
      this.timelineController.setSpeed(speeds[nextIndex]);
      e.target.textContent = `${speeds[nextIndex]}x`;
    });

    document.getElementById('timeline-slider').addEventListener('input', (e) => {
      this.timelineController.setProgress(parseFloat(e.target.value));
    });

    this.timelineController.onProgressChange = (progress) => {
      document.getElementById('timeline-slider').value = progress;
    };

    document.querySelectorAll('.view-presets button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const viewType = e.target.dataset.view;
        this.sceneManager.setView(viewType);
      });
    });

    document.addEventListener('barrierChanged', () => {
      this.validator.validate();
    });

    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
  }

  filterByFloor(floorId) {
    const floorMap = { '1F': 0, '2F': 8, '3F': 16 };
    
    if (floorId === 'all') {
      this.sceneManager.scene.traverse((obj) => {
        obj.visible = true;
      });
    } else {
      const targetY = floorMap[floorId];
      this.sceneManager.scene.traverse((obj) => {
        if (obj.userData && obj.userData.floor) {
          const objFloorY = floorMap[obj.userData.floor];
          obj.visible = objFloorY === targetY;
        }
      });
    }
  }

  toggleVisibility(type, visible) {
    const items = this.sceneManager[type];
    items.forEach(item => {
      item.mesh.visible = visible;
    });
  }

  toggleHeatmapVisibility(visible) {
    this.sceneManager.heatmapObjects.forEach(obj => {
      obj.visible = visible;
    });
  }

  toggleDirectionVisibility(visible) {
    this.sceneManager.directionArrows.forEach(obj => {
      obj.visible = visible;
    });
  }

  onMouseMove(event) {
    const intersects = this.sceneManager.getIntersects(event);
    
    const infoCard = document.getElementById('info-card');
    
    if (intersects.length > 0) {
      const obj = intersects[0].object;
      let data = null;
      
      let parent = obj;
      while (parent && !parent.userData.type) {
        parent = parent.parent;
      }
      
      if (parent && parent.userData) {
        data = parent.userData;
      }

      if (data && data.type) {
        this.showInfoCard(data);
        return;
      }
    }
    
    infoCard.classList.remove('visible');
  }

  showInfoCard(data) {
    const infoCard = document.getElementById('info-card');
    const typeNames = {
      'floor': '楼层',
      'escalator': '扶梯',
      'fireDoor': '消防门',
      'barrier': '围挡'
    };

    let content = `<div class="info-title">${typeNames[data.type] || data.type}</div>`;
    
    if (data.type === 'escalator') {
      content += `
        <div class="info-row"><span>名称</span><span>${data.name}</span></div>
        <div class="info-row"><span>楼层</span><span>${data.floor} → ${data.targetFloor}</span></div>
        <div class="info-row"><span>方向</span><span>${data.direction === 'up' ? '上行' : '下行'}</span></div>
        <div class="info-row"><span>状态</span><span>${data.status === 'maintenance' ? '检修中' : '正常'}</span></div>
      `;
    } else if (data.type === 'fireDoor') {
      content += `
        <div class="info-row"><span>名称</span><span>${data.name}</span></div>
        <div class="info-row"><span>楼层</span><span>${data.floor}</span></div>
        <div class="info-row"><span>位置</span><span>(${data.x}, ${data.z})</span></div>
      `;
    } else if (data.type === 'barrier') {
      content += `
        <div class="info-row"><span>名称</span><span>${data.name}</span></div>
        <div class="info-row"><span>楼层</span><span>${data.floor}</span></div>
        <div class="info-row"><span>位置</span><span>(${data.x}, ${data.z})</span></div>
        <div class="info-row"><span>尺寸</span><span>${data.width}×${data.depth}</span></div>
      `;
    } else if (data.type === 'floor') {
      content += `
        <div class="info-row"><span>名称</span><span>${data.name}</span></div>
        <div class="info-row"><span>高度</span><span>${data.y}m</span></div>
      `;
    }

    infoCard.innerHTML = content;
    infoCard.classList.add('visible');
  }

  importSample() {
    this.sceneManager.clearAll();
    this.buildScene();
    this.dragController.updateBarrierListUI();
    this.validator.validate();
    this.timelineController.recordInitialState();
    
    alert('样例数据已导入！');
  }

  resetState() {
    this.timelineController.reset();
    this.dragController.clearSelection();
    
    document.getElementById('floor-select').value = 'all';
    document.getElementById('filter-escalator').checked = true;
    document.getElementById('filter-fire-door').checked = true;
    document.getElementById('filter-heatmap').checked = true;
    document.getElementById('filter-direction').checked = true;
    
    this.filters = {
      escalator: true,
      fireDoor: true,
      heatmap: true,
      direction: true
    };
    
    this.filterByFloor('all');
    this.toggleVisibility('escalators', true);
    this.toggleVisibility('fireDoors', true);
    this.toggleHeatmapVisibility(true);
    this.toggleDirectionVisibility(true);
    
    this.validator.validate();
  }

  exportReport() {
    this.reportExporter.downloadHTML();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
});
