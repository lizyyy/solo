import { DataParser } from './dataParser.js';
import { Scene3D } from './scene.js';
import { RiskCalculator } from './riskCalculator.js';
import { InteractionState } from './interactionState.js';
import { StorageExporter } from './storageExporter.js';

class SnowInspectionApp {
  constructor() {
    this.dataParser = new DataParser();
    this.riskCalculator = new RiskCalculator();
    this.interactionState = new InteractionState();
    this.storageExporter = new StorageExporter();
    this.scene3D = null;
    
    this.currentViewMode = 'slope';
    this.pendingHazardLocation = null;
    this.crowdData = {
      baseDensity: 0.03,
      attractions: [
        { x: 10, y: 10, radius: 30 },
        { x: 45, y: 45, radius: 25 }
      ]
    };

    this.init();
  }

  async init() {
    try {
      this.scene3D = new Scene3D('scene3d').init();
      this._setupEventListeners();
      this._updateLegend();
      this._hideLoading();
    } catch (error) {
      console.error('初始化失败:', error);
      this._showToast('初始化失败: ' + error.message, 'error');
    }
  }

  _setupEventListeners() {
    this._setupModeButtons();
    this._setupViewModeButtons();
    this._setupToolbarButtons();
    this._setupModalButtons();
    this._setupFileInputs();
    this._setupCollapsibleSections();
    this._setupSceneCallbacks();
    this._setupInteractionCallbacks();
  }

  _setupModeButtons() {
    const modeButtons = document.querySelectorAll('.mode-btn');
    
    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const mode = btn.dataset.mode;
        this.interactionState.setMode(mode);
        this._updateModeIndicator(mode);
      });
    });
  }

  _setupViewModeButtons() {
    const viewButtons = document.querySelectorAll('.color-mode-btn');
    
    viewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        viewButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const viewMode = btn.dataset.view;
        this.currentViewMode = viewMode;
        this._updateLegend();
        
        if (this.dataParser.elevationData) {
          this.scene3D.setViewMode(viewMode, this.riskCalculator, this.dataParser.elevationData);
        }
      });
    });
  }

  _setupToolbarButtons() {
    document.getElementById('btn-load-sample').addEventListener('click', () => {
      this._loadSampleData();
    });

    document.getElementById('btn-save-project').addEventListener('click', () => {
      this._saveCurrentProject();
    });

    document.getElementById('btn-load-project').addEventListener('click', () => {
      this._showProjectList();
    });

    document.getElementById('btn-export-report').addEventListener('click', () => {
      this._exportReport();
    });

    document.getElementById('btn-export-json').addEventListener('click', () => {
      this._exportJSON();
    });
  }

  _setupModalButtons() {
    const hazardModal = document.getElementById('hazard-modal');
    const projectModal = document.getElementById('project-modal');

    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        hazardModal.classList.add('hidden');
        projectModal.classList.add('hidden');
      });
    });

    document.getElementById('btn-cancel-hazard').addEventListener('click', () => {
      hazardModal.classList.add('hidden');
      this.pendingHazardLocation = null;
    });

    document.getElementById('btn-save-hazard').addEventListener('click', () => {
      this._saveHazardFromForm();
    });

    document.getElementById('btn-clear-hazards').addEventListener('click', () => {
      if (confirm('确定要清除所有隐患标注吗？')) {
        const hazards = this.interactionState.getHazards();
        hazards.forEach(h => {
          try {
            this.interactionState.deleteHazard(h.id);
          } catch (e) {}
        });
        this.scene3D.clearAllMarkers();
        this._updateHazardsList();
        this._updateStats();
        this._showToast('已清除所有隐患');
      }
    });

    document.getElementById('btn-clear-route').addEventListener('click', () => {
      if (confirm('确定要清除当前路线吗？')) {
        this.interactionState.clearRoute();
        if (this.dataParser.elevationData) {
          this.scene3D.renderRoute([], this.dataParser.elevationData);
        }
        this._updateRouteList();
        this._updateStats();
        this._showToast('已清除路线');
      }
    });

    document.getElementById('btn-optimize-route').addEventListener('click', () => {
      this._optimizeRoute();
    });
  }

  _setupFileInputs() {
    document.getElementById('import-elevation').addEventListener('change', (e) => {
      this._handleFileUpload(e, 'elevation');
    });

    document.getElementById('import-facilities').addEventListener('change', (e) => {
      this._handleFileUpload(e, 'facilities');
    });

    document.getElementById('import-hazards').addEventListener('change', (e) => {
      this._handleFileUpload(e, 'hazards');
    });
  }

  _setupCollapsibleSections() {
    document.querySelectorAll('.section-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.closest('.sidebar-section');
        section.classList.toggle('collapsed');
      });
    });
  }

  _setupSceneCallbacks() {
    this.scene3D.onTerrainClick = (point) => {
      const mode = this.interactionState.getMode();
      
      if (mode === 'mark_hazard') {
        this._showHazardModal(point);
      } else if (mode === 'plan_route') {
        this._addRouteWaypoint(point);
      }
    };

    this.scene3D.onMarkerClick = (hazard) => {
      this._selectHazard(hazard);
    };
  }

  _setupInteractionCallbacks() {
    this.interactionState.onHazardAdded = (hazard) => {
      if (this.dataParser.elevationData) {
        this.scene3D.addHazardMarker(hazard, this.dataParser.elevationData);
      }
      this._updateHazardsList();
      this._updateStats();
    };

    this.interactionState.onHazardUpdated = (hazard) => {
      this._updateHazardsList();
      this._updateStats();
    };

    this.interactionState.onHazardDeleted = (hazard) => {
      this._updateHazardsList();
      this._updateStats();
    };

    this.interactionState.onRouteUpdated = (waypoints) => {
      if (this.dataParser.elevationData) {
        this.scene3D.renderRoute(waypoints.map(w => w.location), this.dataParser.elevationData);
      }
      this._updateRouteList();
      this._updateStats();
    };
  }

  async _loadSampleData() {
    this._showLoading('正在加载示例数据...');
    
    try {
      const [elevationCSV, facilitiesGeoJSON, hazardsJSON] = await Promise.all([
        this._fetchText('/data/elevation_sample.csv'),
        this._fetchText('/data/facilities_sample.geojson'),
        this._fetchText('/data/hazards_sample.json')
      ]);

      await this.dataParser.parseElevationCSV(elevationCSV);
      this.dataParser.parseFacilitiesGeoJSON(facilitiesGeoJSON);
      
      const hazards = this.dataParser.parseHazardsRecord(hazardsJSON);
      hazards.forEach(h => this.interactionState.addHazard(h));

      this._renderScene();
      this._hideLoading();
      this._showToast('示例数据加载成功！');
      
    } catch (error) {
      console.error('加载示例数据失败:', error);
      this._hideLoading();
      this._showToast('加载示例数据失败: ' + error.message, 'error');
    }
  }

  async _fetchText(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`无法获取 ${url}`);
    }
    return response.text();
  }

  _renderScene() {
    const allData = this.dataParser.getAllData();
    
    if (allData.elevation) {
      this.scene3D.renderTerrain(allData.elevation, this.riskCalculator);
      this.scene3D.setViewMode(this.currentViewMode, this.riskCalculator, allData.elevation);
    }

    if (allData.facilities && allData.elevation) {
      this.scene3D.renderFacilities(allData.facilities, allData.elevation);
    }

    const hazards = this.interactionState.getHazards();
    hazards.forEach(hazard => {
      this.scene3D.addHazardMarker(hazard, allData.elevation);
    });

    const waypoints = this.interactionState.getRouteWaypoints();
    if (waypoints.length > 1) {
      this.scene3D.renderRoute(waypoints.map(w => w.location), allData.elevation);
    }

    this._updateStats();
    this._updateHazardsList();
    this._updateRouteList();
  }

  async _handleFileUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const content = e.target.result;
        
        if (type === 'elevation') {
          await this.dataParser.parseElevationCSV(content);
          document.getElementById('elevation-filename').textContent = file.name;
          this._showToast('高程数据已导入');
        } else if (type === 'facilities') {
          this.dataParser.parseFacilitiesGeoJSON(content);
          document.getElementById('facilities-filename').textContent = file.name;
          this._showToast('设施数据已导入');
        } else if (type === 'hazards') {
          const imported = this.storageExporter.importJSON(content);
          imported.hazards.forEach(h => this.interactionState.addHazard(h));
          document.getElementById('hazards-filename').textContent = file.name;
          this._showToast(`已导入 ${imported.hazards.length} 条隐患记录`);
        }

        this._renderScene();
        
      } catch (error) {
        console.error('文件导入失败:', error);
        this._showToast('导入失败: ' + error.message, 'error');
      }
    };

    reader.readAsText(file);
  }

  _showHazardModal(location) {
    this.pendingHazardLocation = {
      x: location.x,
      y: location.y,
      z: location.z
    };

    document.getElementById('coord-x').textContent = location.x.toFixed(2);
    document.getElementById('coord-y').textContent = location.y.toFixed(2);
    document.getElementById('coord-z').textContent = location.z.toFixed(2);

    document.getElementById('hazard-form').reset();
    document.getElementById('hazard-severity').value = 'medium';
    document.getElementById('hazard-radius').value = 5;
    document.getElementById('hazard-status').value = 'pending';

    document.getElementById('hazard-modal').classList.remove('hidden');
  }

  _saveHazardFromForm() {
    const type = document.getElementById('hazard-type').value;
    if (!type) {
      this._showToast('请选择隐患类型', 'error');
      return;
    }

    const hazard = {
      type: type,
      location: this.pendingHazardLocation,
      severity: document.getElementById('hazard-severity').value,
      description: document.getElementById('hazard-description').value,
      radius: parseInt(document.getElementById('hazard-radius').value) || 5,
      notes: document.getElementById('hazard-notes').value,
      status: document.getElementById('hazard-status').value
    };

    this.interactionState.addHazard(hazard);
    document.getElementById('hazard-modal').classList.add('hidden');
    this.pendingHazardLocation = null;
    this._showToast('隐患已标注');
  }

  _addRouteWaypoint(location) {
    this.interactionState.addRouteWaypoint({
      x: location.x,
      y: location.y,
      z: location.z
    });
    this._showToast('已添加路线点');
  }

  _optimizeRoute() {
    const waypoints = this.interactionState.getRouteWaypoints();
    if (waypoints.length < 3) {
      this._showToast('至少需要3个点才能优化路线', 'error');
      return;
    }

    if (waypoints.length > 1) {
      const start = waypoints[0];
      const end = waypoints[waypoints.length - 1];
      const middle = waypoints.slice(1, -1);
      
      middle.sort((a, b) => {
        const distA = Math.sqrt(
          Math.pow(a.location.x - start.location.x, 2) + 
          Math.pow(a.location.y - start.location.y, 2)
        );
        const distB = Math.sqrt(
          Math.pow(b.location.x - start.location.x, 2) + 
          Math.pow(b.location.y - start.location.y, 2)
        );
        return distA - distB;
      });

      const optimized = [start, ...middle, end];
      this.interactionState.clearRoute();
      optimized.forEach(wp => {
        this.interactionState.addRouteWaypoint(wp.location);
      });

      this._showToast('路线已优化');
    }
  }

  _selectHazard(hazard) {
    this.interactionState.selectHazard(hazard.id);
    this._updateHazardsList();
  }

  _updateHazardsList() {
    const container = document.getElementById('hazards-list');
    const hazards = this.interactionState.getHazards();
    
    if (hazards.length === 0) {
      container.innerHTML = '<p class="empty-message">暂无隐患数据</p>';
      return;
    }

    const typeNames = {
      ice: '结冰',
      pit: '坑洼',
      rock: '岩石',
      debris: '杂物',
      other: '其他'
    };

    container.innerHTML = hazards.map(h => `
      <div class="hazard-item ${this.interactionState.selectedHazard?.id === h.id ? 'selected' : ''}" data-id="${h.id}">
        <div class="hazard-header">
          <span class="hazard-type">${typeNames[h.type] || h.type}</span>
          <span class="hazard-severity ${h.severity}">${this._getSeverityLabel(h.severity)}</span>
        </div>
        <div class="hazard-location">
          位置: (${h.location.x.toFixed(1)}, ${h.location.y.toFixed(1)})
        </div>
        <div class="hazard-desc">${h.description || '无描述'}</div>
      </div>
    `).join('');

    container.querySelectorAll('.hazard-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const hazard = hazards.find(h => h.id === id);
        if (hazard) {
          this._selectHazard(hazard);
        }
      });
    });
  }

  _updateRouteList() {
    const container = document.getElementById('route-list');
    const waypoints = this.interactionState.getRouteWaypoints();
    
    if (waypoints.length === 0) {
      container.innerHTML = '<p class="empty-message">暂无路线点，请在"规划路线"模式下点击雪道添加</p>';
      return;
    }

    container.innerHTML = waypoints.map((wp, index) => {
      let indexClass = '';
      if (index === 0) indexClass = 'first';
      else if (index === waypoints.length - 1) indexClass = 'last';

      return `
        <div class="route-item" data-id="${wp.id}">
          <div class="route-index ${indexClass}">${index + 1}</div>
          <div class="route-info">
            <div class="route-name">${wp.name}</div>
            <div class="route-coords">
              (${wp.location.x.toFixed(1)}, ${wp.location.y.toFixed(1)}, ${wp.location.z.toFixed(1)})
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  _updateStats() {
    const stats = this.interactionState.getStatistics();
    
    document.getElementById('stat-hazards').textContent = stats.hazards.total;
    document.getElementById('stat-critical').textContent = stats.hazards.bySeverity.critical;
    document.getElementById('stat-waypoints').textContent = stats.route.waypointCount;
    
    const distanceKm = (stats.route.distance / 1000).toFixed(2);
    document.getElementById('stat-distance').textContent = `${distanceKm} km`;
  }

  _updateLegend() {
    const container = document.getElementById('legend-container');
    const legend = this.riskCalculator.getRiskLegend(this.currentViewMode);
    
    container.innerHTML = legend.map(item => `
      <div class="legend-item">
        <div class="legend-color" style="background-color: ${item.color}"></div>
        <span>${item.label}</span>
      </div>
    `).join('');
  }

  _updateModeIndicator(mode) {
    const indicator = document.getElementById('mode-indicator');
    const text = document.getElementById('mode-indicator-text');
    
    const modeTexts = {
      view: '👁️ 浏览模式 - 可旋转缩放查看地形',
      mark_hazard: '🎯 标注隐患模式 - 点击雪道添加隐患',
      plan_route: '🛤️ 路线规划模式 - 点击雪道添加巡检点'
    };

    text.textContent = modeTexts[mode] || '';
    indicator.classList.remove('hidden');
    
    setTimeout(() => {
      indicator.classList.add('hidden');
    }, 3000);
  }

  _getSeverityLabel(severity) {
    const labels = {
      low: '低风险',
      medium: '中风险',
      high: '高风险',
      critical: '严重'
    };
    return labels[severity] || severity;
  }

  _saveCurrentProject() {
    const allData = this.dataParser.getAllData();
    const projectName = prompt('请输入项目名称:', `巡检项目 ${new Date().toLocaleDateString()}`);
    
    if (!projectName) return;

    const project = {
      name: projectName,
      description: `创建于 ${new Date().toLocaleString()}`,
      elevation: allData.elevation,
      facilities: allData.facilities,
      photos: allData.photos,
      hazards: this.interactionState.getHazards(),
      routeWaypoints: this.interactionState.getRouteWaypoints()
    };

    const saved = this.storageExporter.saveProject(project);
    this._showToast(`项目 "${saved.name}" 已保存`);
  }

  _showProjectList() {
    const projects = this.storageExporter.listProjects();
    const container = document.getElementById('project-list');
    
    if (projects.length === 0) {
      container.innerHTML = '<p class="empty-message">暂无保存的项目</p>';
    } else {
      container.innerHTML = projects.map(p => `
        <div class="project-item" data-id="${p.id}">
          <div class="hazard-header">
            <span class="hazard-type">${p.name}</span>
            <span class="hazard-severity low">${p.hazardCount} 隐患</span>
          </div>
          <div class="hazard-location">
            更新于: ${new Date(p.updatedAt).toLocaleString()}
          </div>
          <div class="hazard-desc">${p.description || '无描述'}</div>
        </div>
      `).join('');

      container.querySelectorAll('.project-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.id;
          this._loadProject(id);
        });
      });
    }

    document.getElementById('project-modal').classList.remove('hidden');
  }

  _loadProject(projectId) {
    try {
      const project = this.storageExporter.loadProject(projectId);
      
      if (project.data.elevation) {
        this.dataParser.elevationData = project.data.elevation;
      }
      if (project.data.facilities) {
        this.dataParser.facilities = project.data.facilities;
      }
      
      this.interactionState.reset();
      if (project.data.hazards) {
        project.data.hazards.forEach(h => this.interactionState.addHazard(h));
      }
      if (project.data.routeWaypoints) {
        project.data.routeWaypoints.forEach(wp => this.interactionState.addRouteWaypoint(wp.location));
      }

      this._renderScene();
      document.getElementById('project-modal').classList.add('hidden');
      this._showToast(`已加载项目: ${project.name}`);
      
    } catch (error) {
      this._showToast('加载项目失败: ' + error.message, 'error');
    }
  }

  _exportReport() {
    const hazards = this.interactionState.getHazards();
    const route = this.interactionState.getRouteWaypoints();
    const stats = this.interactionState.getStatistics();
    const allData = this.dataParser.getAllData();
    
    let riskAreas = [];
    if (allData.elevation) {
      riskAreas = this.riskCalculator.analyzeHighRiskAreas(allData.elevation, this.crowdData);
    }

    const exportData = {
      project: {
        name: this.storageExporter.currentProjectId ? '已保存项目' : '临时巡检项目',
        id: this.storageExporter.currentProjectId
      },
      hazards: hazards,
      route: route,
      statistics: stats,
      riskAreas: riskAreas
    };

    try {
      this.storageExporter.exportAndDownloadReport(exportData);
      this._showToast('巡检报告已导出');
    } catch (error) {
      this._showToast('导出失败: ' + error.message, 'error');
    }
  }

  _exportJSON() {
    const hazards = this.interactionState.getHazards();
    const routeWaypoints = this.interactionState.getRouteWaypoints();

    try {
      this.storageExporter.exportAndDownloadJSON(hazards, {
        includeRoute: true,
        routeWaypoints: routeWaypoints
      });
      this._showToast('JSON标注包已导出');
    } catch (error) {
      this._showToast('导出失败: ' + error.message, 'error');
    }
  }

  _showLoading(message = '加载中...') {
    const overlay = document.getElementById('loading-overlay');
    const text = overlay.querySelector('p');
    if (text) text.textContent = message;
    overlay.classList.remove('hidden');
  }

  _hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
  }

  _showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const messageEl = document.getElementById('toast-message');
    
    messageEl.textContent = message;
    toast.style.background = type === 'error' ? 'rgba(220, 38, 38, 0.9)' : 'rgba(16, 185, 129, 0.9)';
    toast.classList.remove('hidden');
    
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new SnowInspectionApp();
});
