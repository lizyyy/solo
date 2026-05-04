const API_BASE = '/api';

class ClimbingApp {
  constructor() {
    this.state = {
      walls: [],
      holds: [],
      routes: [],
      risks: [],
      selectedWall: null,
      selectedRoute: null,
      selectedHold: null,
      currentTool: 'select',
      routeCreationHolds: [],
      reviewNotes: ''
    };

    this.init();
  }

  async init() {
    this.setupEventListeners();
    this.setupModals();
    this.setupToolBar();
    
    await this.loadAllData();
    
    if (this.visualizer) {
      this.visualizer.init();
    }
  }

  setupEventListeners() {
    document.getElementById('btnAnalyze').addEventListener('click', () => this.analyzeRisks());
    document.getElementById('btnExportMarkdown').addEventListener('click', () => this.exportMarkdown());
    document.getElementById('btnExportJson').addEventListener('click', () => this.exportJson());
    
    document.getElementById('btnAddWall').addEventListener('click', () => this.openModal('addWallModal'));
    document.getElementById('btnAddRoute').addEventListener('click', () => this.openModal('addRouteModal'));
    
    document.getElementById('btnImportHolds').addEventListener('click', () => this.importData('holds'));
    document.getElementById('btnImportHeatmap').addEventListener('click', () => this.importData('heatmap'));
    document.getElementById('btnImportFeedback').addEventListener('click', () => this.importData('feedback'));
    
    document.getElementById('btnSaveNotes').addEventListener('click', () => this.saveNotes());
    document.getElementById('reviewNotes').addEventListener('input', (e) => {
      this.state.reviewNotes = e.target.value;
    });
    
    document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileImport(e));
  }

  setupModals() {
    const overlay = document.getElementById('modalOverlay');
    
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => this.closeAllModals());
    });
    
    overlay.addEventListener('click', () => this.closeAllModals());
    
    document.querySelectorAll('.modal-footer .btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        this.handleModalAction(action);
      });
    });
  }

  setupToolBar() {
    const toolButtons = document.querySelectorAll('.tool-btn');
    toolButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tool = e.currentTarget.dataset.tool;
        this.setCurrentTool(tool);
      });
    });
  }

  setCurrentTool(tool) {
    this.state.currentTool = tool;
    
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === tool);
    });

    if (tool === 'createRoute') {
      this.state.routeCreationHolds = [];
      this.updateSelectedHoldsList();
    }
  }

  openModal(modalId) {
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById(modalId).classList.add('active');
  }

  closeAllModals() {
    document.getElementById('modalOverlay').classList.remove('active');
    document.querySelectorAll('.modal').forEach(modal => {
      modal.classList.remove('active');
    });
  }

  handleModalAction(action) {
    switch (action) {
      case 'cancel':
        this.closeAllModals();
        break;
      case 'saveWall':
        this.saveWall();
        break;
      case 'saveRoute':
        this.saveRoute();
        break;
    }
  }

  async saveWall() {
    const name = document.getElementById('wallName').value.trim();
    const width = parseFloat(document.getElementById('wallWidth').value) || 8;
    const height = parseFloat(document.getElementById('wallHeight').value) || 4;
    const isKidsArea = document.getElementById('isKidsArea').checked;

    if (!name) {
      alert('请输入墙面名称');
      return;
    }

    try {
      const response = await this.apiPost('/walls', {
        name,
        width,
        height,
        isKidsArea
      });

      if (response.success) {
        this.state.walls.push(response.data);
        this.renderWallList();
        this.refreshVisualizer();
        this.closeAllModals();
        
        document.getElementById('wallName').value = '';
        document.getElementById('wallWidth').value = '8';
        document.getElementById('wallHeight').value = '4';
        document.getElementById('isKidsArea').checked = false;
      }
    } catch (error) {
      console.error('保存墙面失败:', error);
      alert('保存失败: ' + error.message);
    }
  }

  async saveRoute() {
    const name = document.getElementById('routeName').value.trim();
    const difficulty = document.getElementById('routeDifficulty').value;
    const color = document.getElementById('routeColor').value;
    const notes = document.getElementById('routeNotes').value.trim();
    const holdIds = this.state.routeCreationHolds.map(h => h.id);

    if (!name) {
      alert('请输入路线名称');
      return;
    }

    if (holdIds.length < 2) {
      alert('请至少选择2个岩点');
      return;
    }

    try {
      const response = await this.apiPost('/routes', {
        name,
        holdIds,
        difficulty,
        color,
        wallId: this.state.selectedWall?.id,
        notes
      });

      if (response.success) {
        this.state.routes.push(response.data);
        this.renderRouteList();
        this.refreshVisualizer();
        this.closeAllModals();
        
        document.getElementById('routeName').value = '';
        document.getElementById('routeDifficulty').value = 'V0';
        document.getElementById('routeColor').value = '#ff4444';
        document.getElementById('routeNotes').value = '';
        this.state.routeCreationHolds = [];
        this.updateSelectedHoldsList();
      }
    } catch (error) {
      console.error('保存路线失败:', error);
      alert('保存失败: ' + error.message);
    }
  }

  updateSelectedHoldsList() {
    const container = document.getElementById('selectedHoldsList');
    
    if (this.state.routeCreationHolds.length === 0) {
      container.innerHTML = '<span class="empty-tag">尚未选择岩点</span>';
      return;
    }

    container.innerHTML = this.state.routeCreationHolds.map((hold, index) => `
      <span class="hold-tag">
        <span>${index + 1}. (${hold.position.x.toFixed(1)}, ${hold.position.y.toFixed(1)})</span>
        <button class="remove-btn" onclick="app.removeRouteHold('${hold.id}')">&times;</button>
      </span>
    `).join('');
  }

  removeRouteHold(holdId) {
    this.state.routeCreationHolds = this.state.routeCreationHolds.filter(h => h.id !== holdId);
    this.updateSelectedHoldsList();
  }

  async loadAllData() {
    try {
      const [wallsResponse, routesResponse] = await Promise.all([
        this.apiGet('/walls'),
        this.apiGet('/routes')
      ]);

      if (wallsResponse.success) {
        this.state.walls = wallsResponse.data;
        this.renderWallList();
      }

      if (routesResponse.success) {
        this.state.routes = routesResponse.data;
        this.renderRouteList();
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  }

  renderWallList() {
    const container = document.getElementById('wallList');
    
    if (this.state.walls.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无墙面</div>';
      return;
    }

    container.innerHTML = this.state.walls.map(wall => `
      <div class="wall-item ${this.state.selectedWall?.id === wall.id ? 'selected' : ''}" 
           data-wall-id="${wall.id}"
           onclick="app.selectWall('${wall.id}')">
        <div class="wall-item-header">
          <span class="wall-item-name">${wall.name}</span>
          ${wall.isKidsArea ? '<span class="kids-area-badge">儿童区</span>' : ''}
        </div>
        <div class="wall-item-info">
          ${wall.width}m × ${wall.height}m
        </div>
      </div>
    `).join('');
  }

  renderRouteList() {
    const container = document.getElementById('routeList');
    
    let filteredRoutes = this.state.routes;
    if (this.state.selectedWall) {
      filteredRoutes = this.state.routes.filter(r => r.wallId === this.state.selectedWall.id);
    }

    if (filteredRoutes.length === 0) {
      container.innerHTML = '<div class="empty-state">暂无路线</div>';
      return;
    }

    container.innerHTML = filteredRoutes.map(route => `
      <div class="route-item ${this.state.selectedRoute?.id === route.id ? 'selected' : ''}" 
           data-route-id="${route.id}"
           onclick="app.selectRoute('${route.id}')">
        <div class="route-item-header">
          <span class="route-item-name">${route.name}</span>
          <span class="route-item-color" style="background-color: ${route.color}"></span>
        </div>
        <div class="route-item-info">
          难度: ${route.difficulty} | 岩点: ${route.holdIds.length}
        </div>
      </div>
    `).join('');
  }

  renderRiskList() {
    const container = document.getElementById('riskList');
    const { highRiskCount, mediumRiskCount, lowRiskCount } = document.getElementById('riskSummary').dataset;
    
    document.getElementById('highRiskCount').textContent = highRiskCount || '0';
    document.getElementById('mediumRiskCount').textContent = mediumRiskCount || '0';
    document.getElementById('lowRiskCount').textContent = lowRiskCount || '0';

    if (this.state.risks.length === 0) {
      container.innerHTML = '<div class="empty-state">请先执行风险分析</div>';
      return;
    }

    container.innerHTML = this.state.risks.map(risk => `
      <div class="risk-item ${risk.severity}" 
           data-risk-id="${risk.id}"
           onclick="app.selectRisk('${risk.id}')">
        <div class="risk-item-title">${risk.riskName}</div>
        <div class="risk-item-desc">${risk.description}</div>
      </div>
    `).join('');
  }

  selectWall(wallId) {
    this.state.selectedWall = this.state.walls.find(w => w.id === wallId);
    this.state.selectedRoute = null;
    this.state.selectedHold = null;
    
    this.renderWallList();
    this.renderRouteList();
    this.updateEditPanel();
    this.refreshVisualizer();
  }

  selectRoute(routeId) {
    this.state.selectedRoute = this.state.routes.find(r => r.id === routeId);
    this.state.selectedHold = null;
    
    this.renderRouteList();
    this.updateEditPanel();
    this.updateInfoPanel();
    this.refreshVisualizer();
  }

  selectHold(hold) {
    if (this.state.currentTool === 'createRoute') {
      const existingIndex = this.state.routeCreationHolds.findIndex(h => h.id === hold.id);
      if (existingIndex === -1) {
        this.state.routeCreationHolds.push(hold);
      } else {
        this.state.routeCreationHolds.splice(existingIndex, 1);
      }
      this.updateSelectedHoldsList();
      this.refreshVisualizer();
      return;
    }

    if (this.state.currentTool === 'addHold') {
      return;
    }

    this.state.selectedHold = hold;
    this.state.selectedRoute = null;
    
    this.updateEditPanel();
    this.updateInfoPanel();
    this.refreshVisualizer();
  }

  selectRisk(riskId) {
    const risk = this.state.risks.find(r => r.id === riskId);
    if (risk) {
      this.updateInfoPanel(risk);
      
      if (risk.affectedRoutes && risk.affectedRoutes.length > 0) {
        this.state.selectedRoute = this.state.routes.find(r => r.id === risk.affectedRoutes[0]);
        this.renderRouteList();
        this.refreshVisualizer();
      }
    }
  }

  updateEditPanel() {
    const container = document.getElementById('editPanel');
    
    if (this.state.selectedHold) {
      const hold = this.state.selectedHold;
      container.innerHTML = `
        <div class="edit-panel-content">
          <div class="form-group">
            <label>位置</label>
            <div>X: ${hold.position.x.toFixed(2)} | Y: ${hold.position.y.toFixed(2)} | Z: ${hold.position.z.toFixed(2)}</div>
          </div>
          <div class="form-group">
            <label>颜色</label>
            <input type="color" id="editHoldColor" value="${hold.color}" onchange="app.updateHoldColor(this.value)">
          </div>
          <div class="form-group">
            <label>难度</label>
            <select id="editHoldDifficulty" onchange="app.updateHoldDifficulty(this.value)">
              ${['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10+']
                .map(d => `<option value="${d}" ${hold.difficulty === d ? 'selected' : ''}>${d}</option>`)
                .join('')}
            </select>
          </div>
          <div class="edit-actions">
            <button class="btn btn-danger btn-small" onclick="app.deleteHold()">删除岩点</button>
          </div>
        </div>
      `;
      return;
    }

    if (this.state.selectedRoute) {
      const route = this.state.selectedRoute;
      container.innerHTML = `
        <div class="edit-panel-content">
          <div class="form-group">
            <label>路线名称</label>
            <input type="text" id="editRouteName" value="${route.name}" onchange="app.updateRouteName(this.value)">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>难度</label>
              <select id="editRouteDifficulty" onchange="app.updateRouteDifficulty(this.value)">
                ${['V0', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10+']
                  .map(d => `<option value="${d}" ${route.difficulty === d ? 'selected' : ''}>${d}</option>`)
                  .join('')}
              </select>
            </div>
            <div class="form-group">
              <label>颜色</label>
              <input type="color" id="editRouteColor" value="${route.color}" onchange="app.updateRouteColor(this.value)">
            </div>
          </div>
          <div class="edit-actions">
            <button class="btn btn-danger btn-small" onclick="app.deleteRoute()">删除路线</button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = '<div class="empty-state">选择岩点或路线进行编辑</div>';
  }

  updateInfoPanel(risk = null) {
    const container = document.getElementById('selectedInfo');
    
    if (risk) {
      container.innerHTML = `
        <div style="margin-bottom: 8px;"><strong>${risk.riskName}</strong></div>
        <div style="color: var(--text-secondary); margin-bottom: 8px;">${risk.description}</div>
        <div style="font-size: 0.8rem; color: var(--success-color);">
          💡 ${risk.suggestion}
        </div>
      `;
      return;
    }

    if (this.state.selectedHold) {
      const hold = this.state.selectedHold;
      container.innerHTML = `
        <div style="margin-bottom: 4px;"><strong>岩点</strong></div>
        <div style="color: var(--text-secondary);">
          难度: ${hold.difficulty}<br>
          类型: ${hold.type || '未知'}<br>
          大小: ${hold.size || '未知'}
        </div>
      `;
      return;
    }

    if (this.state.selectedRoute) {
      const route = this.state.selectedRoute;
      container.innerHTML = `
        <div style="margin-bottom: 4px;"><strong>${route.name}</strong></div>
        <div style="color: var(--text-secondary);">
          难度: ${route.difficulty}<br>
          岩点数量: ${route.holdIds.length}<br>
          ${route.notes ? `备注: ${route.notes}` : ''}
        </div>
      `;
      return;
    }

    container.innerHTML = '点击岩点或路线查看详情';
  }

  async updateHoldColor(color) {
    if (!this.state.selectedHold) return;
    
    this.state.selectedHold.color = color;
    this.refreshVisualizer();
  }

  async updateHoldDifficulty(difficulty) {
    if (!this.state.selectedHold) return;
    
    this.state.selectedHold.difficulty = difficulty;
  }

  async updateRouteName(name) {
    if (!this.state.selectedRoute) return;
    
    this.state.selectedRoute.name = name;
    this.renderRouteList();
  }

  async updateRouteDifficulty(difficulty) {
    if (!this.state.selectedRoute) return;
    
    this.state.selectedRoute.difficulty = difficulty;
    this.renderRouteList();
  }

  async updateRouteColor(color) {
    if (!this.state.selectedRoute) return;
    
    this.state.selectedRoute.color = color;
    this.renderRouteList();
    this.refreshVisualizer();
  }

  async deleteHold() {
    if (!this.state.selectedHold) return;
    
    if (confirm('确定要删除这个岩点吗？')) {
      this.state.holds = this.state.holds.filter(h => h.id !== this.state.selectedHold.id);
      this.state.selectedHold = null;
      this.updateEditPanel();
      this.updateInfoPanel();
      this.refreshVisualizer();
    }
  }

  async deleteRoute() {
    if (!this.state.selectedRoute) return;
    
    if (confirm('确定要删除这条路线吗？')) {
      try {
        const response = await this.apiDelete(`/routes/${this.state.selectedRoute.id}`);
        if (response.success) {
          this.state.routes = this.state.routes.filter(r => r.id !== this.state.selectedRoute.id);
          this.state.selectedRoute = null;
          this.renderRouteList();
          this.updateEditPanel();
          this.updateInfoPanel();
          this.refreshVisualizer();
        }
      } catch (error) {
        console.error('删除路线失败:', error);
        alert('删除失败: ' + error.message);
      }
    }
  }

  saveNotes() {
    const notes = document.getElementById('reviewNotes').value;
    localStorage.setItem('climbingReviewNotes', notes);
    alert('备注已保存');
  }

  async analyzeRisks() {
    try {
      const response = await this.apiPost('/risk/analyze', {});
      
      if (response.success) {
        this.state.risks = response.data.risks;
        
        const summary = response.data.summary;
        const riskSummary = document.getElementById('riskSummary');
        riskSummary.dataset.highRiskCount = summary.bySeverity.high;
        riskSummary.dataset.mediumRiskCount = summary.bySeverity.medium;
        riskSummary.dataset.lowRiskCount = summary.bySeverity.low;
        
        document.getElementById('highRiskCount').textContent = summary.bySeverity.high;
        document.getElementById('mediumRiskCount').textContent = summary.bySeverity.medium;
        document.getElementById('lowRiskCount').textContent = summary.bySeverity.low;
        
        this.renderRiskList();
        
        alert(`风险分析完成: 发现 ${summary.totalRisks} 个风险点`);
      }
    } catch (error) {
      console.error('风险分析失败:', error);
      alert('分析失败: ' + error.message);
    }
  }

  async exportMarkdown() {
    try {
      const response = await this.apiPost('/export/markdown', {
        wallId: this.state.selectedWall?.id
      });
      
      if (response.success) {
        this.downloadFile(response.data.content, response.data.filename, 'text/markdown');
      }
    } catch (error) {
      console.error('导出Markdown失败:', error);
      alert('导出失败: ' + error.message);
    }
  }

  async exportJson() {
    try {
      const response = await this.apiPost('/export/json', {
        wallId: this.state.selectedWall?.id
      });
      
      if (response.success) {
        this.downloadFile(response.data.content, response.data.filename, 'application/json');
      }
    } catch (error) {
      console.error('导出JSON失败:', error);
      alert('导出失败: ' + error.message);
    }
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  importData(type) {
    this._currentImportType = type;
    document.getElementById('fileInput').click();
  }

  async handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        let endpoint = '';
        let payload = {};

        switch (this._currentImportType) {
          case 'holds':
            endpoint = '/import/holds';
            payload = { holds: data.holds || data };
            break;
          case 'heatmap':
            endpoint = '/import/heatmap';
            payload = { heatmapData: data.heatmapData || data };
            break;
          case 'feedback':
            endpoint = '/import/feedback';
            payload = { feedbackList: data.feedbackList || data };
            break;
        }

        const response = await this.apiPost(endpoint, payload);
        
        if (response.success) {
          alert(response.message);
          
          if (this._currentImportType === 'holds' && response.data) {
            this.state.holds.push(...response.data);
            this.refreshVisualizer();
          }
        }
      } catch (error) {
        console.error('导入失败:', error);
        alert('导入失败: ' + error.message);
      }
    };
    reader.readAsText(file);
    
    event.target.value = '';
  }

  refreshVisualizer() {
    if (this.visualizer) {
      this.visualizer.render();
    }
  }

  async apiGet(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`);
    return response.json();
  }

  async apiPost(endpoint, data) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    return response.json();
  }

  async apiDelete(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE'
    });
    return response.json();
  }
}

const app = new ClimbingApp();
