import {
  Project,
  Equipment,
  ValidationResult,
  createProject,
  createEquipment,
  createVector3,
  cloneProject,
} from './models';
import { validateProject, getValidationSummary } from './validation';
import { SceneManager } from './scene/SceneManager';
import { InteractiveControls, DragStartEvent, DragMoveEvent, DragEndEvent } from './scene/InteractiveControls';
import { HistoryManager } from './state/history';
import {
  loadFileFromDisk,
  downloadProjectJSON,
  downloadSafetyReport,
  downloadLoadTableCSV,
  importProjectFromJSON,
  validateProjectJSON,
} from './io';
import {
  exampleProjects,
  createBasicExample,
} from './examples';

class Application {
  private sceneManager: SceneManager;
  private interactiveControls: InteractiveControls;
  private historyManager: HistoryManager<Project>;
  
  private currentProject: Project;
  private currentValidation: ValidationResult | null = null;
  private selectedObjectId: string | null = null;
  private selectedObjectType: string | null = null;
  
  private container: HTMLElement;
  private sidebar: HTMLElement;
  private toolbar: HTMLElement;

  constructor() {
    const canvasContainer = document.getElementById('canvas-container');
    if (!canvasContainer) {
      throw new Error('Canvas container not found');
    }

    this.container = canvasContainer;
    this.sidebar = document.getElementById('sidebar')!;
    this.toolbar = document.getElementById('toolbar')!;

    this.currentProject = createBasicExample();
    this.historyManager = new HistoryManager<Project>(50);

    this.sceneManager = new SceneManager(canvasContainer);
    this.interactiveControls = new InteractiveControls(this.sceneManager);

    this.setupEventListeners();
    this.loadProject(this.currentProject);
    this.renderUI();
  }

  private setupEventListeners(): void {
    this.sceneManager.setOnObjectClick((objectId, type) => {
      this.selectObject(objectId, type);
    });

    this.interactiveControls.setOnDragStart(this.onDragStart.bind(this));
    this.interactiveControls.setOnDragMove(this.onDragMove.bind(this));
    this.interactiveControls.setOnDragEnd(this.onDragEnd.bind(this));

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedObjectId) {
          this.deleteSelectedObject();
        }
      }
    });
  }

  private onDragStart(event: DragStartEvent): void {
    this.selectObject(event.objectId, event.objectType);
  }

  private onDragMove(event: DragMoveEvent): void {
    this.updateProjectObjectPosition(event.objectId, event.currentPosition);
    this.validateAndUpdate();
  }

  private onDragEnd(event: DragEndEvent): void {
    if (event.hasMoved) {
      this.updateProjectObjectPosition(event.objectId, event.endPosition);
      this.recordHistory('移动对象');
    }
  }

  private updateProjectObjectPosition(objectId: string, position: { x: number; y: number; z: number }): void {
    const eqIndex = this.currentProject.equipment.findIndex(eq => eq.id === objectId);
    if (eqIndex !== -1) {
      this.currentProject.equipment[eqIndex] = {
        ...this.currentProject.equipment[eqIndex],
        position: createVector3(position.x, position.y, position.z),
      };
    }

    const trussIndex = this.currentProject.trusses.findIndex(t => t.id === objectId);
    if (trussIndex !== -1) {
      this.currentProject.trusses[trussIndex] = {
        ...this.currentProject.trusses[trussIndex],
        position: createVector3(position.x, position.y, position.z),
      };
    }
  }

  private validateAndUpdate(): void {
    this.currentValidation = validateProject(this.currentProject);
    this.updateValidationUI();
  }

  private recordHistory(description: string): void {
    this.historyManager.push(cloneProject(this.currentProject), description);
    this.updateUndoRedoButtons();
  }

  private loadProject(project: Project): void {
    this.currentProject = project;
    this.sceneManager.loadProject(project);
    this.currentValidation = validateProject(project);
    this.selectedObjectId = null;
    this.selectedObjectType = null;
    this.sceneManager.selectObject(null);
    this.renderUI();
    this.updateUndoRedoButtons();
  }

  private selectObject(objectId: string, type: string): void {
    this.selectedObjectId = objectId;
    this.selectedObjectType = type;
    this.sceneManager.selectObject(objectId);
    this.updateSelectedObjectUI();
  }

  private deleteSelectedObject(): void {
    if (!this.selectedObjectId) return;

    const eqIndex = this.currentProject.equipment.findIndex(eq => eq.id === this.selectedObjectId);
    if (eqIndex !== -1) {
      this.currentProject.equipment.splice(eqIndex, 1);
    }

    const hpIndex = this.currentProject.hoistPoints.findIndex(hp => hp.id === this.selectedObjectId);
    if (hpIndex !== -1) {
      this.currentProject.hoistPoints.splice(hpIndex, 1);
    }

    const trussIndex = this.currentProject.trusses.findIndex(t => t.id === this.selectedObjectId);
    if (trussIndex !== -1) {
      const truss = this.currentProject.trusses[trussIndex];
      this.currentProject.hoistPoints = this.currentProject.hoistPoints.filter(hp => hp.trussId !== truss.id);
      this.currentProject.equipment = this.currentProject.equipment.filter(eq => eq.trussId !== truss.id);
      this.currentProject.trusses.splice(trussIndex, 1);
    }

    this.recordHistory('删除对象');
    this.selectedObjectId = null;
    this.selectedObjectType = null;
    this.sceneManager.loadProject(this.currentProject);
    this.sceneManager.selectObject(null);
    this.validateAndUpdate();
    this.renderUI();
  }

  private undo(): void {
    if (!this.historyManager.canUndo()) return;
    const previousState = this.historyManager.undo();
    if (previousState) {
      this.loadProject(previousState);
    }
  }

  private redo(): void {
    if (!this.historyManager.canRedo()) return;
    const nextState = this.historyManager.redo();
    if (nextState) {
      this.loadProject(nextState);
    }
  }

  private renderUI(): void {
    this.renderToolbar();
    this.renderSidebar();
    this.updateUndoRedoButtons();
  }

  private renderToolbar(): void {
    this.toolbar.innerHTML = `
      <button class="btn btn-secondary" id="btn-undo" disabled title="撤销 (Ctrl+Z)">↶ 撤销</button>
      <button class="btn btn-secondary" id="btn-redo" disabled title="重做 (Ctrl+Shift+Z)">↷ 重做</button>
      <button class="btn btn-primary" id="btn-new">新建</button>
      <button class="btn btn-primary" id="btn-import">导入</button>
      <button class="btn btn-primary" id="btn-export">导出</button>
      <button class="btn btn-primary" id="btn-report">报告</button>
      <button class="btn btn-primary" id="btn-csv">CSV</button>
    `;

    document.getElementById('btn-undo')?.addEventListener('click', () => this.undo());
    document.getElementById('btn-redo')?.addEventListener('click', () => this.redo());
    document.getElementById('btn-new')?.addEventListener('click', () => this.showNewProjectDialog());
    document.getElementById('btn-import')?.addEventListener('click', () => this.importProject());
    document.getElementById('btn-export')?.addEventListener('click', () => downloadProjectJSON(this.currentProject));
    document.getElementById('btn-report')?.addEventListener('click', () => {
      if (this.currentValidation) {
        downloadSafetyReport(this.currentProject, this.currentValidation);
      }
    });
    document.getElementById('btn-csv')?.addEventListener('click', () => {
      if (this.currentValidation) {
        downloadLoadTableCSV(this.currentProject, this.currentValidation);
      }
    });
  }

  private updateUndoRedoButtons(): void {
    const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement;
    const redoBtn = document.getElementById('btn-redo') as HTMLButtonElement;
    if (undoBtn) undoBtn.disabled = !this.historyManager.canUndo();
    if (redoBtn) redoBtn.disabled = !this.historyManager.canRedo();
  }

  private renderSidebar(): void {
    this.sidebar.innerHTML = '';

    this.renderProjectInfoPanel();
    this.renderExamplesPanel();
    this.renderValidationPanel();
    this.renderLoadPanel();
    this.renderEquipmentPanel();
    this.renderSelectedObjectPanel();
  }

  private renderProjectInfoPanel(): void {
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="panel-title">项目信息</div>
      <div class="input-group">
        <label>项目名称</label>
        <input type="text" id="project-name" value="${this.currentProject.name}">
      </div>
      <div class="input-group">
        <label>描述</label>
        <input type="text" id="project-description" value="${this.currentProject.description}">
      </div>
      <div class="row">
        <button class="btn btn-secondary btn-small" id="btn-add-truss">+ 桁架</button>
        <button class="btn btn-secondary btn-small" id="btn-add-hoist">+ 吊点</button>
        <button class="btn btn-secondary btn-small" id="btn-add-equipment">+ 设备</button>
      </div>
    `;
    this.sidebar.appendChild(panel);

    document.getElementById('project-name')?.addEventListener('change', (e) => {
      this.currentProject.name = (e.target as HTMLInputElement).value;
    });
    document.getElementById('project-description')?.addEventListener('change', (e) => {
      this.currentProject.description = (e.target as HTMLInputElement).value;
    });

    document.getElementById('btn-add-truss')?.addEventListener('click', () => this.addTruss());
    document.getElementById('btn-add-hoist')?.addEventListener('click', () => this.addHoistPoint());
    document.getElementById('btn-add-equipment')?.addEventListener('click', () => this.addEquipment());
  }

  private renderExamplesPanel(): void {
    const panel = document.createElement('div');
    panel.className = 'panel';
    let examplesHtml = '<div class="panel-title">示例场景</div>';
    
    exampleProjects.forEach((example, index) => {
      examplesHtml += `
        <div class="list-item" data-example="${example.id}">
          <div>
            <div style="font-weight: 500;">${example.name}</div>
            <div style="font-size: 11px; color: #888;">${example.description}</div>
          </div>
          <button class="btn btn-primary btn-small" data-load-example="${example.id}">加载</button>
        </div>
      `;
    });
    
    panel.innerHTML = examplesHtml;
    this.sidebar.appendChild(panel);

    exampleProjects.forEach(example => {
      const btn = panel.querySelector(`[data-load-example="${example.id}"]`);
      btn?.addEventListener('click', () => {
        this.loadProject(example.create());
        this.recordHistory('加载示例');
      });
    });
  }

  private renderValidationPanel(): void {
    if (!this.currentValidation) return;

    const summary = getValidationSummary(this.currentValidation);
    const panel = document.createElement('div');
    panel.className = 'panel';
    
    let statusClass = 'success';
    let statusText = '安全';
    
    if (summary.errors.length > 0) {
      statusClass = 'error';
      statusText = '存在安全隐患';
    } else if (summary.warnings.length > 0) {
      statusClass = 'warning';
      statusText = '存在警告';
    }

    panel.innerHTML = `
      <div class="panel-title">安全状态</div>
      <div class="stat">
        <span class="stat-label">总体状态: </span>
        <span class="stat-value ${statusClass}">${statusText}</span>
      </div>
    `;

    summary.errors.forEach(error => {
      panel.innerHTML += `<div class="alert alert-error">⚠️ ${error}</div>`;
    });

    summary.warnings.forEach(warning => {
      panel.innerHTML += `<div class="alert alert-warning">⚠ ${warning}</div>`;
    });

    if (summary.errors.length === 0 && summary.warnings.length === 0) {
      panel.innerHTML += `<div class="alert alert-success">✅ 所有检查通过</div>`;
    }

    this.sidebar.appendChild(panel);
  }

  private renderLoadPanel(): void {
    if (!this.currentValidation) return;

    const panel = document.createElement('div');
    panel.className = 'panel';
    
    let loadsHtml = '<div class="panel-title">吊点载荷</div>';
    
    if (this.currentValidation.hoistLoads.length === 0) {
      loadsHtml += '<div style="color: #888; font-size: 13px;">暂无吊点数据</div>';
    } else {
      this.currentValidation.hoistLoads.forEach(load => {
        const hp = this.currentProject.hoistPoints.find(p => p.id === load.hoistPointId);
        const name = hp?.name || load.hoistPointId;
        const percentage = (load.loadRatio * 100).toFixed(0);
        const progressPercent = Math.min(load.loadRatio * 100, 100);
        
        let fillClass = '';
        if (load.isOverloaded) fillClass = 'error';
        else if (load.isWarning) fillClass = 'warning';

        loadsHtml += `
          <div class="stat" style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span class="stat-label">${name}</span>
              <span class="stat-value ${fillClass}">${load.staticLoad.toFixed(1)}kg / ${load.maxRatedLoad}kg (${percentage}%)</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill ${fillClass}" style="width: ${progressPercent}%;"></div>
            </div>
          </div>
        `;
      });
    }

    const cog = this.currentValidation.centerOfGravity;
    const unbalance = this.currentValidation.unbalance;
    
    loadsHtml += `
      <div class="panel-title" style="margin-top: 16px;">重心分析</div>
      <div class="stat">
        <span class="stat-label">总质量: </span>
        <span class="stat-value">${cog.totalMass.toFixed(1)} kg</span>
      </div>
      <div class="stat">
        <span class="stat-label">重心位置: </span>
        <span class="stat-value">(${cog.position.x.toFixed(2)}, ${cog.position.y.toFixed(2)}, ${cog.position.z.toFixed(2)})</span>
      </div>
      <div class="stat">
        <span class="stat-label">最大偏载比: </span>
        <span class="stat-value ${unbalance.isUnbalanced ? 'error' : ''}">${(unbalance.maxRatio * 100).toFixed(1)}%</span>
      </div>
    `;

    panel.innerHTML = loadsHtml;
    this.sidebar.appendChild(panel);
  }

  private renderEquipmentPanel(): void {
    const panel = document.createElement('div');
    panel.className = 'panel';
    
    let html = '<div class="panel-title">设备列表</div>';
    
    if (this.currentProject.equipment.length === 0) {
      html += '<div style="color: #888; font-size: 13px;">暂无设备</div>';
    } else {
      this.currentProject.equipment.forEach(eq => {
        const isSelected = this.selectedObjectId === eq.id;
        html += `
          <div class="list-item ${isSelected ? 'selected' : ''}" data-object-id="${eq.id}" data-object-type="equipment">
            <div>
              <div style="font-weight: 500;">${eq.name}</div>
              <div style="font-size: 11px; color: #888;">${eq.weight}kg @ (${eq.position.x.toFixed(1)}, ${eq.position.y.toFixed(1)}, ${eq.position.z.toFixed(1)})</div>
            </div>
          </div>
        `;
      });
    }

    panel.innerHTML = html;
    this.sidebar.appendChild(panel);

    panel.querySelectorAll('[data-object-id]').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-object-id');
        const type = item.getAttribute('data-object-type');
        if (id && type) {
          this.selectObject(id, type);
        }
      });
    });
  }

  private renderSelectedObjectPanel(): void {
    if (!this.selectedObjectId) return;

    const panel = document.createElement('div');
    panel.className = 'panel';
    
    let html = '<div class="panel-title">选中对象</div>';

    const eq = this.currentProject.equipment.find(e => e.id === this.selectedObjectId);
    if (eq) {
      html += `
        <div class="input-group">
          <label>名称</label>
          <input type="text" id="selected-name" value="${eq.name}">
        </div>
        <div class="input-group">
          <label>类型</label>
          <select id="selected-type">
            <option value="light" ${eq.type === 'light' ? 'selected' : ''}>灯具</option>
            <option value="speaker" ${eq.type === 'speaker' ? 'selected' : ''}>音箱</option>
            <option value="led" ${eq.type === 'led' ? 'selected' : ''}>LED屏</option>
            <option value="generic" ${eq.type === 'generic' ? 'selected' : ''}>通用设备</option>
          </select>
        </div>
        <div class="input-group">
          <label>重量 (kg)</label>
          <input type="number" id="selected-weight" value="${eq.weight}" step="0.1">
        </div>
        <div class="coords">
          <div class="input-group">
            <label>X</label>
            <input type="number" id="selected-x" value="${eq.position.x.toFixed(3)}" step="0.1">
          </div>
          <div class="input-group">
            <label>Y</label>
            <input type="number" id="selected-y" value="${eq.position.y.toFixed(3)}" step="0.1">
          </div>
          <div class="input-group">
            <label>Z</label>
            <input type="number" id="selected-z" value="${eq.position.z.toFixed(3)}" step="0.1">
          </div>
        </div>
        <div class="row">
          <button class="btn btn-danger btn-small" id="btn-delete-selected">删除</button>
        </div>
      `;
    }

    const hp = this.currentProject.hoistPoints.find(h => h.id === this.selectedObjectId);
    if (hp) {
      html += `
        <div class="input-group">
          <label>名称</label>
          <input type="text" id="selected-name" value="${hp.name}">
        </div>
        <div class="input-group">
          <label>额定载荷 (kg)</label>
          <input type="number" id="selected-maxload" value="${hp.maxLoad}" step="1">
        </div>
        <div class="coords">
          <div class="input-group">
            <label>X</label>
            <input type="number" id="selected-x" value="${hp.position.x.toFixed(3)}" step="0.1">
          </div>
          <div class="input-group">
            <label>Y</label>
            <input type="number" id="selected-y" value="${hp.position.y.toFixed(3)}" step="0.1">
          </div>
          <div class="input-group">
            <label>Z</label>
            <input type="number" id="selected-z" value="${hp.position.z.toFixed(3)}" step="0.1">
          </div>
        </div>
        <div class="row">
          <button class="btn btn-danger btn-small" id="btn-delete-selected">删除</button>
        </div>
      `;
    }

    const truss = this.currentProject.trusses.find(t => t.id === this.selectedObjectId);
    if (truss) {
      html += `
        <div class="input-group">
          <label>名称</label>
          <input type="text" id="selected-name" value="${truss.name}">
        </div>
        <div class="input-group">
          <label>类型</label>
          <select id="selected-type">
            <option value="box" ${truss.type === 'box' ? 'selected' : ''}>箱式桁架</option>
            <option value="triangular" ${truss.type === 'triangular' ? 'selected' : ''}>三角桁架</option>
            <option value="ladder" ${truss.type === 'ladder' ? 'selected' : ''}>梯式桁架</option>
          </select>
        </div>
        <div class="input-group">
          <label>长度 (m)</label>
          <input type="number" id="selected-length" value="${truss.length}" step="0.1">
        </div>
        <div class="input-group">
          <label>每米重量 (kg/m)</label>
          <input type="number" id="selected-weight-per-m" value="${truss.weightPerMeter}" step="0.1">
        </div>
        <div class="coords">
          <div class="input-group">
            <label>X</label>
            <input type="number" id="selected-x" value="${truss.position.x.toFixed(3)}" step="0.1">
          </div>
          <div class="input-group">
            <label>Y</label>
            <input type="number" id="selected-y" value="${truss.position.y.toFixed(3)}" step="0.1">
          </div>
          <div class="input-group">
            <label>Z</label>
            <input type="number" id="selected-z" value="${truss.position.z.toFixed(3)}" step="0.1">
          </div>
        </div>
        <div class="row">
          <button class="btn btn-danger btn-small" id="btn-delete-selected">删除</button>
        </div>
      `;
    }

    panel.innerHTML = html;
    this.sidebar.appendChild(panel);

    document.getElementById('btn-delete-selected')?.addEventListener('click', () => {
      this.deleteSelectedObject();
    });

    this.setupSelectedObjectListeners();
  }

  private setupSelectedObjectListeners(): void {
    const updateField = (field: string, value: string | number) => {
      if (!this.selectedObjectId) return;

      const eqIndex = this.currentProject.equipment.findIndex(e => e.id === this.selectedObjectId);
      if (eqIndex !== -1) {
        const eq = this.currentProject.equipment[eqIndex];
        switch (field) {
          case 'name': eq.name = value as string; break;
          case 'type': eq.type = value as any; break;
          case 'weight': eq.weight = value as number; break;
          case 'x': eq.position.x = value as number; break;
          case 'y': eq.position.y = value as number; break;
          case 'z': eq.position.z = value as number; break;
        }
        this.currentProject.equipment[eqIndex] = { ...eq };
      }

      const hpIndex = this.currentProject.hoistPoints.findIndex(h => h.id === this.selectedObjectId);
      if (hpIndex !== -1) {
        const hp = this.currentProject.hoistPoints[hpIndex];
        switch (field) {
          case 'name': hp.name = value as string; break;
          case 'maxLoad': hp.maxLoad = value as number; break;
          case 'x': hp.position.x = value as number; break;
          case 'y': hp.position.y = value as number; break;
          case 'z': hp.position.z = value as number; break;
        }
        this.currentProject.hoistPoints[hpIndex] = { ...hp };
      }

      const trussIndex = this.currentProject.trusses.findIndex(t => t.id === this.selectedObjectId);
      if (trussIndex !== -1) {
        const truss = this.currentProject.trusses[trussIndex];
        switch (field) {
          case 'name': truss.name = value as string; break;
          case 'type': truss.type = value as any; break;
          case 'length': truss.length = value as number; break;
          case 'weightPerMeter': truss.weightPerMeter = value as number; break;
          case 'x': truss.position.x = value as number; break;
          case 'y': truss.position.y = value as number; break;
          case 'z': truss.position.z = value as number; break;
        }
        this.currentProject.trusses[trussIndex] = { ...truss };
      }

      this.recordHistory(`修改对象属性`);
      this.sceneManager.loadProject(this.currentProject);
      this.sceneManager.selectObject(this.selectedObjectId);
      this.validateAndUpdate();
      this.renderUI();
    };

    const nameInput = document.getElementById('selected-name') as HTMLInputElement;
    if (nameInput) {
      nameInput.addEventListener('change', (e) => updateField('name', (e.target as HTMLInputElement).value));
    }

    const typeSelect = document.getElementById('selected-type') as HTMLSelectElement;
    if (typeSelect) {
      typeSelect.addEventListener('change', (e) => updateField('type', (e.target as HTMLSelectElement).value));
    }

    const weightInput = document.getElementById('selected-weight') as HTMLInputElement;
    if (weightInput) {
      weightInput.addEventListener('change', (e) => updateField('weight', parseFloat((e.target as HTMLInputElement).value)));
    }

    const maxLoadInput = document.getElementById('selected-maxload') as HTMLInputElement;
    if (maxLoadInput) {
      maxLoadInput.addEventListener('change', (e) => updateField('maxLoad', parseFloat((e.target as HTMLInputElement).value)));
    }

    const lengthInput = document.getElementById('selected-length') as HTMLInputElement;
    if (lengthInput) {
      lengthInput.addEventListener('change', (e) => updateField('length', parseFloat((e.target as HTMLInputElement).value)));
    }

    const weightPerMInput = document.getElementById('selected-weight-per-m') as HTMLInputElement;
    if (weightPerMInput) {
      weightPerMInput.addEventListener('change', (e) => updateField('weightPerMeter', parseFloat((e.target as HTMLInputElement).value)));
    }

    const xInput = document.getElementById('selected-x') as HTMLInputElement;
    const yInput = document.getElementById('selected-y') as HTMLInputElement;
    const zInput = document.getElementById('selected-z') as HTMLInputElement;

    if (xInput) {
      xInput.addEventListener('change', (e) => updateField('x', parseFloat((e.target as HTMLInputElement).value)));
    }
    if (yInput) {
      yInput.addEventListener('change', (e) => updateField('y', parseFloat((e.target as HTMLInputElement).value)));
    }
    if (zInput) {
      zInput.addEventListener('change', (e) => updateField('z', parseFloat((e.target as HTMLInputElement).value)));
    }
  }

  private updateValidationUI(): void {
    const panels = this.sidebar.querySelectorAll('.panel');
    panels.forEach((panel, index) => {
      if (index === 1 || index === 2 || index === 3) {
        panel.remove();
      }
    });
    this.renderValidationPanel();
    this.renderLoadPanel();
    this.renderEquipmentPanel();
    this.renderSelectedObjectPanel();
  }

  private updateSelectedObjectUI(): void {
    const panels = this.sidebar.querySelectorAll('.panel');
    panels.forEach((panel, index) => {
      if (index === 4) {
        panel.remove();
      }
    });
    this.renderSelectedObjectPanel();
  }

  private showNewProjectDialog(): void {
    const newProject = createProject({ name: '新项目' });
    this.loadProject(newProject);
    this.recordHistory('新建项目');
  }

  private async importProject(): Promise<void> {
    const fileData = await loadFileFromDisk();
    if (!fileData) return;

    const validation = validateProjectJSON(fileData.content);
    if (!validation.valid || !validation.project) {
      alert(`导入失败:\n${validation.errors.join('\n')}`);
      return;
    }

    this.loadProject(validation.project);
    this.recordHistory('导入项目');
  }

  private addTruss(): void {
    const newTruss = createEquipment({
      name: `桁架 ${this.currentProject.trusses.length + 1}`,
      type: 'light' as any,
      weight: 0,
      dimensions: createVector3(6, 0.5, 0.5),
      position: createVector3(0, 5, 0),
      color: '#4a90d9',
    });
    this.currentProject.equipment.push(newTruss);
    this.recordHistory('添加桁架');
    this.sceneManager.addEquipment(newTruss);
    this.validateAndUpdate();
    this.renderUI();
  }

  private addHoistPoint(): void {
    const newEquipment = createEquipment({
      name: `吊点 ${this.currentProject.hoistPoints.length + 1}`,
      type: 'generic',
      weight: 0,
      dimensions: createVector3(0.3, 0.3, 0.3),
      position: createVector3(0, 7, 0),
      color: '#ff9800',
    });
    this.currentProject.equipment.push(newEquipment);
    this.recordHistory('添加吊点');
    this.sceneManager.addEquipment(newEquipment);
    this.validateAndUpdate();
    this.renderUI();
  }

  private addEquipment(): void {
    const newEquipment = createEquipment({
      name: `设备 ${this.currentProject.equipment.length + 1}`,
      type: 'light',
      weight: 15,
      dimensions: createVector3(0.4, 0.5, 0.3),
      position: createVector3(0, 5.5, 0),
      color: '#ffeb3b',
    });
    this.currentProject.equipment.push(newEquipment);
    this.recordHistory('添加设备');
    this.sceneManager.addEquipment(newEquipment);
    this.validateAndUpdate();
    this.renderUI();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    new Application();
  } catch (error) {
    console.error('Failed to initialize application:', error);
  }
});
