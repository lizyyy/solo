import type { Plan, BoothObject, CheckResult, ObjectType } from './models/types';
import { SceneManager } from './renderer/SceneManager';
import { InteractionManager } from './editor/InteractionManager';
import { runAllChecks } from './checker/rules';
import { planStorage, exportPlanToJson, importPlanFromJson, downloadJson, downloadHtml, loadFileFromInput, readFileAsText } from './storage/localStorage';
import { generateMarkdownReport, generateHtmlReport } from './report/generator';
import { OBJECT_TEMPLATES, OBJECT_CATEGORIES, generateId, getTemplateByType, getTemplatesByCategory } from './models/objectLibrary';
import { createDefaultPlan, EXAMPLE_PLANS } from './models/examples';
import './styles/main.css';

const OBJECT_TYPE_LABELS: Record<string, string> = {
  table: '桌子',
  display_rack: '展架',
  cashier_desk: '收银台',
  power_outlet: '电源插座',
  power_cable: '电源线',
  entrance: '入口',
  exit: '出口',
  safety_aisle: '安全通道',
  feature_wall: '主视觉墙',
};

export class App {
  private currentPlan: Plan;
  private sceneManager: SceneManager | null = null;
  private interactionManager: InteractionManager | null = null;
  private selectedCategory: string = 'all';
  private autoSaveTimer: number | null = null;
  private checkResults: CheckResult[] = [];
  
  constructor() {
    this.currentPlan = this.loadSavedPlan() || createDefaultPlan();
  }
  
  private loadSavedPlan(): Plan | null {
    return planStorage.loadCurrentPlan();
  }
  
  public async init(): Promise<void> {
    this.renderUI();
    this.initScene();
    this.loadPlan(this.currentPlan);
    this.startAutoSave();
  }
  
  private initScene(): void {
    const viewportContainer = document.getElementById('viewport-container');
    if (!viewportContainer) {
      console.error('Viewport container not found');
      return;
    }
    
    this.sceneManager = new SceneManager(viewportContainer);
    this.interactionManager = new InteractionManager(this.sceneManager);
    this.interactionManager.setPlan(this.currentPlan);
    
    this.interactionManager.addEventListener((event) => {
      switch (event.type) {
        case 'select':
          this.onObjectSelect(event.objectId!, event.object);
          break;
        case 'deselect':
          this.onObjectDeselect();
          break;
        case 'move':
        case 'rotate':
        case 'scale':
        case 'delete':
          this.scheduleAutoSave();
          this.runChecks();
          break;
      }
    });
  }
  
  private renderUI(): void {
    const app = document.getElementById('app');
    if (!app) return;
    
    app.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-title">
          <span class="toolbar-title-icon">🏪</span>
          <span class="toolbar-title-text">摊位布置预演工具</span>
        </div>
        
        <div class="toolbar-divider"></div>
        
        <input 
          type="text" 
          class="plan-name-input" 
          id="plan-name-input"
          value="${this.currentPlan.name}"
          placeholder="方案名称..."
        />
        
        <div class="toolbar-divider"></div>
        
        <div class="toolbar-group">
          <button class="toolbar-btn" id="btn-file">
            <span class="toolbar-btn-icon">📁</span>
            <span>文件</span>
          </button>
          <button class="toolbar-btn" id="btn-examples">
            <span class="toolbar-btn-icon">📋</span>
            <span>示例</span>
          </button>
          <button class="toolbar-btn" id="btn-export-json">
            <span class="toolbar-btn-icon">📤</span>
            <span>导出</span>
          </button>
          <button class="toolbar-btn" id="btn-import-json">
            <span class="toolbar-btn-icon">📥</span>
            <span>导入</span>
          </button>
          <button class="toolbar-btn" id="btn-report">
            <span class="toolbar-btn-icon">📄</span>
            <span>检查报告</span>
          </button>
        </div>
        
        <div class="toolbar-divider"></div>
        
        <div class="toolbar-group">
          <button class="toolbar-btn" id="btn-undo" title="撤销">
            <span class="toolbar-btn-icon">↶</span>
          </button>
          <button class="toolbar-btn" id="btn-redo" title="重做">
            <span class="toolbar-btn-icon">↷</span>
          </button>
          <button class="toolbar-btn active" id="btn-snap" title="网格吸附">
            <span class="toolbar-btn-icon">⊞</span>
            <span>吸附</span>
          </button>
        </div>
        
        <div style="flex: 1;"></div>
        
        <div class="toolbar-group">
          <button class="toolbar-btn" id="btn-new">
            <span class="toolbar-btn-icon">+</span>
            <span>新方案</span>
          </button>
          <button class="toolbar-btn" id="btn-settings">
            <span class="toolbar-btn-icon">⚙</span>
            <span>设置</span>
          </button>
        </div>
      </div>
      
      <div class="main-content">
        <div class="left-panel">
          <div class="panel-header">
            <span class="panel-header-icon">📦</span>
            <span>物件库</span>
          </div>
          
          <div class="category-tabs" id="category-tabs">
            <button class="category-tab active" data-category="all">全部</button>
            ${OBJECT_CATEGORIES.map(cat => 
              `<button class="category-tab" data-category="${cat.id}">${cat.icon} ${cat.name}</button>`
            ).join('')}
          </div>
          
          <div class="object-list" id="object-list">
            ${this.renderObjectList()}
          </div>
        </div>
        
        <div class="viewport-container" id="viewport-container">
          <div class="viewport-controls">
            <button class="viewport-btn" id="view-top" title="顶视图">
              <span>⬆</span>
            </button>
            <button class="viewport-btn" id="view-front" title="前视图">
              <span>⬇</span>
            </button>
            <button class="viewport-btn" id="view-side" title="侧视图">
              <span>➡</span>
            </button>
            <button class="viewport-btn active" id="view-perspective" title="透视图">
              <span>🔲</span>
            </button>
          </div>
          
          <div class="keyboard-hint">
            快捷键: <kbd>Q</kbd><kbd>E</kbd> 旋转 | <kbd>Del</kbd> 删除 | <kbd>Esc</kbd> 取消选择 | <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> 切换视角
          </div>
        </div>
        
        <div class="right-panel">
          <div class="check-header">
            <div class="check-title">
              <span class="panel-header-icon">✅</span>
              <span>检查结果</span>
            </div>
            <button class="toolbar-btn" id="btn-run-checks" style="padding: 4px 10px; font-size: 12px;">
              <span>刷新</span>
            </button>
          </div>
          
          <div class="check-summary" id="check-summary">
            <span class="summary-badge error" id="summary-errors">
              <span>❌</span><span id="count-errors">0</span>
            </span>
            <span class="summary-badge warning" id="summary-warnings">
              <span>⚠️</span><span id="count-warnings">0</span>
            </span>
            <span class="summary-badge info" id="summary-infos">
              <span>ℹ️</span><span id="count-infos">0</span>
            </span>
          </div>
          
          <div class="check-list" id="check-list">
            ${this.renderCheckList()}
          </div>
          
          <div class="properties-panel" id="properties-panel">
            <div class="properties-header">
              <div class="properties-title">
                <span class="panel-header-icon">📝</span>
                <span>属性</span>
              </div>
            </div>
            <div class="properties-content" id="properties-content">
              ${this.renderPropertiesContent()}
            </div>
          </div>
        </div>
      </div>
      
      <div class="dropdown-menu" id="examples-dropdown">
        ${EXAMPLE_PLANS.map(plan => `
          <div class="dropdown-item" data-example-id="${plan.id}">
            <span>📋</span>
            <span>${plan.name}</span>
          </div>
        `).join('')}
        <div class="dropdown-divider"></div>
        <div class="dropdown-item" id="clear-plan">
          <span>🗑️</span>
          <span>清空方案</span>
        </div>
      </div>
      
      <div class="dropdown-menu" id="file-dropdown">
        <div class="dropdown-item" id="save-to-library">
          <span>💾</span>
          <span>保存到库</span>
        </div>
        <div class="dropdown-item" id="load-from-library">
          <span>📂</span>
          <span>从库加载</span>
        </div>
      </div>
    `;
    
    this.bindEvents();
  }
  
  private renderObjectList(): string {
    let templates = OBJECT_TEMPLATES;
    if (this.selectedCategory !== 'all') {
      templates = getTemplatesByCategory(this.selectedCategory);
    }
    
    if (templates.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <div class="empty-state-text">该分类暂无物件</div>
        </div>
      `;
    }
    
    return templates.map(template => `
      <div class="object-item" data-object-type="${template.type}" data-template-name="${template.name}">
        <div class="object-icon">${template.icon}</div>
        <div class="object-info">
          <div class="object-name">${template.name}</div>
          <div class="object-desc">${template.description}</div>
        </div>
      </div>
    `).join('');
  }
  
  private renderCheckList(): string {
    if (this.checkResults.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-state-icon">✨</div>
          <div class="empty-state-text">暂无检查结果<br>点击"刷新"运行检查</div>
        </div>
      `;
    }
    
    return this.checkResults.map(check => {
      const icon = check.severity === 'error' ? '❌' : check.severity === 'warning' ? '⚠️' : 'ℹ️';
      
      return `
        <div class="check-item ${check.severity}">
          <div class="check-header-row">
            <span class="check-icon">${icon}</span>
            <div class="check-message">${check.message}</div>
          </div>
          ${check.suggestions && check.suggestions.length > 0 ? `
            <div class="check-suggestions">
              <div class="check-suggestions-title">💡 建议调整方案:</div>
              <ul class="check-suggestions-list">
                ${check.suggestions.map(s => `<li>${s}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }
  
  private renderPropertiesContent(): string {
    const selectedObj = this.interactionManager?.getSelectedObject();
    
    if (!selectedObj) {
      return `
        <div class="empty-state" style="padding: 20px;">
          <div class="empty-state-icon">👆</div>
          <div class="empty-state-text" style="font-size: 12px;">点击场景中的物件<br>查看和编辑属性</div>
        </div>
      `;
    }
    
    return `
      <div class="property-row">
        <label class="property-label">名称</label>
        <input type="text" class="property-input" id="prop-name" value="${selectedObj.name}" />
      </div>
      <div class="property-row">
        <label class="property-label">类型</label>
        <input type="text" class="property-input" value="${OBJECT_TYPE_LABELS[selectedObj.type] || selectedObj.type}" disabled />
      </div>
      <div class="property-row">
        <label class="property-label">位置</label>
        <div class="property-input-group">
          <input type="number" class="property-input" id="pos-x" value="${selectedObj.position.x.toFixed(2)}" step="0.5" />
          <input type="number" class="property-input" id="pos-z" value="${selectedObj.position.z.toFixed(2)}" step="0.5" />
        </div>
      </div>
      <div class="property-row">
        <label class="property-label">旋转</label>
        <input type="number" class="property-input" id="prop-rotation" value="${selectedObj.rotation.toFixed(0)}" step="45" />
      </div>
      <div class="property-row">
        <label class="property-label">尺寸</label>
        <div class="property-input-group">
          <input type="number" class="property-input" id="size-x" value="${selectedObj.dimensions.x.toFixed(2)}" step="0.5" min="0.1" />
          <input type="number" class="property-input" id="size-z" value="${selectedObj.dimensions.z.toFixed(2)}" step="0.5" min="0.1" />
        </div>
      </div>
      <button class="delete-btn" id="btn-delete-object">
        🗑️ 删除物件
      </button>
    `;
  }
  
  private bindEvents(): void {
    document.getElementById('category-tabs')?.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('.category-tab');
      if (target) {
        const category = target.getAttribute('data-category');
        if (category) {
          this.selectedCategory = category;
          this.updateCategoryTabs();
          this.updateObjectList();
        }
      }
    });
    
    document.getElementById('object-list')?.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest('.object-item');
      if (item) {
        const type = item.getAttribute('data-object-type') as ObjectType;
        const templateName = item.getAttribute('data-template-name');
        if (type) {
          this.addObjectFromTemplate(type, templateName);
        }
      }
    });
    
    document.getElementById('btn-examples')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const dropdown = document.getElementById('examples-dropdown');
      const btn = document.getElementById('btn-examples');
      if (dropdown && btn) {
        const rect = btn.getBoundingClientRect();
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.top = `${rect.bottom + 4}px`;
        dropdown.classList.toggle('active');
      }
    });
    
    document.getElementById('examples-dropdown')?.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest('.dropdown-item');
      if (item) {
        const exampleId = item.getAttribute('data-example-id');
        if (exampleId) {
          this.loadExamplePlan(exampleId);
        }
        document.getElementById('examples-dropdown')?.classList.remove('active');
      }
    });
    
    document.getElementById('clear-plan')?.addEventListener('click', () => {
      if (confirm('确定要清空当前方案吗？此操作不可撤销。')) {
        this.loadPlan(createDefaultPlan());
      }
      document.getElementById('examples-dropdown')?.classList.remove('active');
    });
    
    document.getElementById('view-top')?.addEventListener('click', () => {
      this.sceneManager?.setCameraView('top');
      this.updateViewButtons('top');
    });
    
    document.getElementById('view-front')?.addEventListener('click', () => {
      this.sceneManager?.setCameraView('front');
      this.updateViewButtons('front');
    });
    
    document.getElementById('view-side')?.addEventListener('click', () => {
      this.sceneManager?.setCameraView('side');
      this.updateViewButtons('side');
    });
    
    document.getElementById('view-perspective')?.addEventListener('click', () => {
      this.sceneManager?.setCameraView('perspective');
      this.updateViewButtons('perspective');
    });
    
    document.getElementById('btn-snap')?.addEventListener('click', () => {
      if (this.interactionManager) {
        const newMode = this.interactionManager.toggleSnapMode();
        const btn = document.getElementById('btn-snap');
        if (btn) {
          btn.classList.toggle('active', newMode === 'grid');
        }
      }
    });
    
    document.getElementById('btn-run-checks')?.addEventListener('click', () => {
      this.runChecks();
    });
    
    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      const json = exportPlanToJson(this.currentPlan);
      const safeName = this.currentPlan.name.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_');
      downloadJson(json, `${safeName || 'booth_plan'}.json`);
    });
    
    document.getElementById('btn-import-json')?.addEventListener('click', async () => {
      const file = await loadFileFromInput();
      if (file) {
        try {
          const content = await readFileAsText(file);
          const plan = importPlanFromJson(content);
          if (plan) {
            this.loadPlan(plan);
            this.showToast('方案导入成功！');
          } else {
            alert('无法解析文件，请确保是有效的摊位方案JSON文件。');
          }
        } catch (error) {
          alert('导入失败: ' + (error as Error).message);
        }
      }
    });
    
    document.getElementById('btn-report')?.addEventListener('click', () => {
      this.showReportModal();
    });
    
    document.getElementById('btn-new')?.addEventListener('click', () => {
      if (confirm('确定要创建新方案吗？当前方案将被替换。')) {
        this.loadPlan(createDefaultPlan());
      }
    });
    
    const planNameInput = document.getElementById('plan-name-input') as HTMLInputElement;
    planNameInput?.addEventListener('change', () => {
      this.currentPlan.name = planNameInput.value || '新方案';
      this.scheduleAutoSave();
    });
    
    document.addEventListener('click', () => {
      document.querySelectorAll('.dropdown-menu.active').forEach(menu => {
        menu.classList.remove('active');
      });
    });
    
    document.getElementById('properties-content')?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.id === 'prop-name') {
        const selectedObj = this.interactionManager?.getSelectedObject();
        if (selectedObj) {
          selectedObj.name = target.value;
          this.scheduleAutoSave();
        }
      } else if (target.id === 'pos-x' || target.id === 'pos-z') {
        const selectedObj = this.interactionManager?.getSelectedObject();
        if (selectedObj) {
          if (target.id === 'pos-x') {
            selectedObj.position.x = parseFloat(target.value) || 0;
          } else {
            selectedObj.position.z = parseFloat(target.value) || 0;
          }
          this.sceneManager?.updateObjectPosition(selectedObj.id, selectedObj.position);
          this.scheduleAutoSave();
          this.runChecks();
        }
      } else if (target.id === 'prop-rotation') {
        const selectedObj = this.interactionManager?.getSelectedObject();
        if (selectedObj) {
          selectedObj.rotation = parseFloat(target.value) || 0;
          this.sceneManager?.updateObjectRotation(selectedObj.id, selectedObj.rotation);
          this.scheduleAutoSave();
          this.runChecks();
        }
      } else if (target.id === 'size-x' || target.id === 'size-z') {
        const selectedObj = this.interactionManager?.getSelectedObject();
        if (selectedObj) {
          if (target.id === 'size-x') {
            selectedObj.dimensions.x = Math.max(0.1, parseFloat(target.value) || 0.1);
          } else {
            selectedObj.dimensions.z = Math.max(0.1, parseFloat(target.value) || 0.1);
          }
          this.sceneManager?.updateObjectDimensions(selectedObj.id, selectedObj.dimensions, selectedObj);
          this.scheduleAutoSave();
          this.runChecks();
        }
      }
    });
    
    document.getElementById('btn-delete-object')?.addEventListener('click', () => {
      if (confirm('确定要删除此物件吗？')) {
        this.interactionManager?.deleteSelectedObject();
        this.updatePropertiesPanel();
      }
    });
  }
  
  private updateCategoryTabs(): void {
    const tabs = document.querySelectorAll('.category-tab');
    tabs.forEach(tab => {
      const cat = tab.getAttribute('data-category');
      (tab as HTMLElement).classList.toggle('active', cat === this.selectedCategory);
    });
  }
  
  private updateObjectList(): void {
    const list = document.getElementById('object-list');
    if (list) {
      list.innerHTML = this.renderObjectList();
    }
  }
  
  private updateViewButtons(activeView: string): void {
    const views = ['top', 'front', 'side', 'perspective'];
    views.forEach(view => {
      const btn = document.getElementById(`view-${view}`);
      if (btn) {
        btn.classList.toggle('active', view === activeView);
      }
    });
  }
  
  private updateCheckSummary(): void {
    const errors = this.checkResults.filter(r => r.severity === 'error').length;
    const warnings = this.checkResults.filter(r => r.severity === 'warning').length;
    const infos = this.checkResults.filter(r => r.severity === 'info').length;
    
    const countErrors = document.getElementById('count-errors');
    const countWarnings = document.getElementById('count-warnings');
    const countInfos = document.getElementById('count-infos');
    
    if (countErrors) countErrors.textContent = String(errors);
    if (countWarnings) countWarnings.textContent = String(warnings);
    if (countInfos) countInfos.textContent = String(infos);
  }
  
  private updatePropertiesPanel(): void {
    const content = document.getElementById('properties-content');
    if (content) {
      content.innerHTML = this.renderPropertiesContent();
    }
  }
  
  private addObjectFromTemplate(type: ObjectType, templateName?: string): void {
    const template = templateName 
      ? OBJECT_TEMPLATES.find(t => t.type === type && t.name === templateName)
      : getTemplateByType(type);
    
    if (!template) return;
    
    const newObject: BoothObject = {
      id: generateId(),
      type: template.type,
      name: template.name,
      position: { x: 0, y: template.defaultDimensions.y / 2, z: 0 },
      rotation: 0,
      dimensions: { ...template.defaultDimensions },
      color: { ...template.defaultColor },
    };
    
    this.currentPlan.objects.push(newObject);
    this.sceneManager?.createObjectMesh(newObject);
    this.interactionManager?.selectObject(newObject.id);
    this.scheduleAutoSave();
    this.runChecks();
    
    this.showToast(`已添加「${template.name}」`);
  }
  
  private onObjectSelect(_objectId: string, _object?: BoothObject): void {
    this.updatePropertiesPanel();
  }
  
  private onObjectDeselect(): void {
    this.updatePropertiesPanel();
  }
  
  public loadPlan(plan: Plan): void {
    this.currentPlan = plan;
    
    const nameInput = document.getElementById('plan-name-input') as HTMLInputElement;
    if (nameInput) {
      nameInput.value = plan.name;
    }
    
    this.sceneManager?.loadPlan(plan);
    this.interactionManager?.setPlan(plan);
    this.interactionManager?.deselectAll();
    
    this.scheduleAutoSave();
    this.runChecks();
    this.updatePropertiesPanel();
  }
  
  private loadExamplePlan(exampleId: string): void {
    const example = EXAMPLE_PLANS.find(p => p.id === exampleId);
    if (example) {
      const newPlan = JSON.parse(JSON.stringify(example)) as Plan;
      newPlan.id = `plan_${Date.now()}`;
      newPlan.createdAt = Date.now();
      newPlan.updatedAt = Date.now();
      this.loadPlan(newPlan);
      this.showToast(`已加载示例: ${example.name}`);
    }
  }
  
  private runChecks(): void {
    this.checkResults = runAllChecks(this.currentPlan);
    this.updateCheckSummary();
    
    const list = document.getElementById('check-list');
    if (list) {
      list.innerHTML = this.renderCheckList();
    }
  }
  
  private startAutoSave(): void {
    setInterval(() => {
      if (this.autoSaveTimer !== null) {
        this.doAutoSave();
      }
    }, 5000);
  }
  
  private scheduleAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
    }
    this.autoSaveTimer = window.setTimeout(() => {
      this.doAutoSave();
    }, 1000);
  }
  
  private doAutoSave(): void {
    this.currentPlan.updatedAt = Date.now();
    planStorage.saveCurrentPlan(this.currentPlan);
    this.autoSaveTimer = null;
  }
  
  private showToast(message: string): void {
    const existing = document.querySelector('.example-toast');
    if (existing) {
      existing.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = 'example-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
  
  private showReportModal(): void {
    const format = confirm('点击确定导出HTML报告，取消导出Markdown报告');
    
    if (format) {
      const html = generateHtmlReport(this.currentPlan);
      const safeName = this.currentPlan.name.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_');
      downloadHtml(html, `${safeName || 'booth_report'}.html`);
    } else {
      const markdown = generateMarkdownReport(this.currentPlan);
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = this.currentPlan.name.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_');
      a.download = `${safeName || 'booth_report'}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    
    this.showToast('报告已生成并下载');
  }
}
