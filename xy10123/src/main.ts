import './style.css';
import { SceneManager } from './scene/SceneManager';
import type { 
  ProjectData, 
  Booth, 
  Exit, 
  Zone, 
  ThreeDObjectData
} from './types';
import {
  calculateAllEvacuationPaths,
  getShortestPathForZone,
  validateProject,
  getValidationSummary,
  saveProject,
  downloadProject,
  importProjectFromJson,
  generateReportData,
  downloadReportHTML,
  downloadReportCSV
} from './utils';
import { 
  createSampleProject, 
  createEmptyProject, 
  BOOTH_COLORS, 
  ZONE_COLORS 
} from './data/sampleData';

class App {
  private sceneManager: SceneManager;
  private project: ProjectData;
  private showAllPaths: boolean = false;

  constructor() {
    const app = document.getElementById('app');
    if (!app) throw new Error('App container not found');

    this.createUI(app);
    
    const canvasContainer = document.getElementById('canvas-container');
    if (!canvasContainer) throw new Error('Canvas container not found');
    
    this.sceneManager = new SceneManager(canvasContainer);
    this.project = createEmptyProject('新项目');
    
    this.setupEventListeners();
    this.loadDefaultProject();
  }

  private createUI(container: HTMLElement): void {
    container.innerHTML = `
      <div id="canvas-container"></div>
      
      <div class="fixed top-0 left-0 right-0 z-10 p-4">
        <div class="panel px-6 py-3 flex items-center justify-between max-w-7xl mx-auto">
          <div class="flex items-center gap-4">
            <h1 class="text-xl font-bold text-gray-800">
              🏛️ 展馆疏散路线三维预演
            </h1>
            <span class="text-sm text-gray-500" id="project-name">新项目</span>
          </div>
          
          <div class="flex items-center gap-2">
            <button id="btn-new-project" class="btn btn-secondary text-sm">
              📁 新建
            </button>
            <button id="btn-load-sample" class="btn btn-secondary text-sm">
              📦 示例
            </button>
            <button id="btn-save" class="btn btn-primary text-sm">
              💾 保存
            </button>
            <button id="btn-export" class="btn btn-secondary text-sm">
              📤 导出
            </button>
            <button id="btn-import" class="btn btn-secondary text-sm">
              📥 导入
            </button>
            <input type="file" id="file-import" accept=".json" class="hidden" />
          </div>
        </div>
      </div>

      <div class="fixed top-20 left-4 z-10">
        <div class="panel p-4 w-72">
          <h2 class="text-sm font-semibold text-gray-700 mb-3">工具</h2>
          <div class="grid grid-cols-2 gap-2 mb-4">
            <button id="tool-select" class="btn btn-primary text-xs">✋ 选择</button>
            <button id="tool-add-booth" class="btn btn-secondary text-xs">🏪 添加展位</button>
            <button id="tool-add-exit" class="btn btn-secondary text-xs">🚪 添加出口</button>
            <button id="tool-add-zone" class="btn btn-secondary text-xs">🔲 添加区域</button>
          </div>

          <h2 class="text-sm font-semibold text-gray-700 mb-3">疏散预览</h2>
          <div class="space-y-2">
            <button id="btn-calculate-paths" class="btn btn-success text-xs w-full">
              🔄 计算疏散路线
            </button>
            <button id="btn-toggle-paths" class="btn btn-secondary text-xs w-full">
              👁️ 显示所有路线
            </button>
            <div id="zone-path-selector" class="mt-2">
              <label class="label text-xs">查看区域路线：</label>
              <select id="select-zone-path" class="input-field text-xs">
                <option value="">选择区域...</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="fixed top-20 right-4 z-10 w-80">
        <div class="panel p-4 mb-4">
          <h2 class="text-sm font-semibold text-gray-700 mb-3">验证状态</h2>
          <div id="validation-summary" class="flex items-center justify-around text-xs">
            <div class="text-center">
              <div class="status-indicator status-ok"></div>
              <span id="val-ok">0</span>
            </div>
            <div class="text-center">
              <div class="status-indicator status-warning"></div>
              <span id="val-warning">0</span>
            </div>
            <div class="text-center">
              <div class="status-indicator status-danger"></div>
              <span id="val-error">0</span>
            </div>
          </div>
          <button id="btn-validate" class="btn btn-primary text-xs w-full mt-3">
            ✓ 执行验证
          </button>
        </div>

        <div class="panel p-4 max-h-96 overflow-y-auto scrollbar-thin">
          <h2 class="text-sm font-semibold text-gray-700 mb-3">验证结果</h2>
          <div id="validation-results" class="space-y-2 text-xs">
            <p class="text-gray-400">点击"执行验证"查看结果</p>
          </div>
        </div>
      </div>

      <div class="fixed bottom-4 right-4 z-10">
        <button id="btn-generate-report" class="btn btn-warning text-sm">
          📊 生成报告
        </button>
      </div>

      <div id="selected-object-panel" class="fixed bottom-4 left-4 z-10 panel p-4 w-80 hidden">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-gray-700">属性编辑</h2>
          <button id="btn-close-panel" class="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div id="selected-object-form" class="space-y-3">
        </div>
      </div>

      <div class="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-10">
        <div class="panel px-4 py-2 text-xs text-gray-500">
          💡 提示：点击选择对象 | 拖拽移动对象 | 滚轮缩放 | 右键拖动旋转视角
        </div>
      </div>

      <div id="modal-overlay" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center">
        <div id="modal-content" class="panel p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
        </div>
      </div>
    `;
  }

  private setupEventListeners(): void {
    document.getElementById('btn-new-project')?.addEventListener('click', () => this.newProject());
    document.getElementById('btn-load-sample')?.addEventListener('click', () => this.loadSampleProject());
    document.getElementById('btn-save')?.addEventListener('click', () => this.saveCurrentProject());
    document.getElementById('btn-export')?.addEventListener('click', () => this.exportProject());
    document.getElementById('btn-import')?.addEventListener('click', () => {
      document.getElementById('file-import')?.click();
    });
    document.getElementById('file-import')?.addEventListener('change', (e) => this.importProject(e));

    document.getElementById('tool-select')?.addEventListener('click', () => this.setTool('select'));
    document.getElementById('tool-add-booth')?.addEventListener('click', () => this.addBooth());
    document.getElementById('tool-add-exit')?.addEventListener('click', () => this.addExit());
    document.getElementById('tool-add-zone')?.addEventListener('click', () => this.addZone());

    document.getElementById('btn-calculate-paths')?.addEventListener('click', () => this.calculatePaths());
    document.getElementById('btn-toggle-paths')?.addEventListener('click', () => this.toggleAllPaths());
    document.getElementById('select-zone-path')?.addEventListener('change', (e) => this.showZonePath(e));

    document.getElementById('btn-validate')?.addEventListener('click', () => this.runValidation());
    document.getElementById('btn-generate-report')?.addEventListener('click', () => this.generateReport());

    document.getElementById('btn-close-panel')?.addEventListener('click', () => this.closeObjectPanel());

    this.sceneManager.setOnObjectSelect((data) => this.onObjectSelect(data));
    this.sceneManager.setOnObjectMove((data, position) => this.onObjectMove(data, position));
  }

  private loadDefaultProject(): void {
    const sample = createSampleProject();
    this.project = sample;
    this.renderProject();
    document.getElementById('project-name')!.textContent = sample.name;
  }

  private newProject(): void {
    this.showModal('新建项目', `
      <div class="space-y-4">
        <div>
          <label class="label">项目名称</label>
          <input type="text" id="new-project-name" class="input-field" placeholder="输入项目名称" value="新项目" />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="label">展馆宽度 (米)</label>
            <input type="number" id="new-hall-width" class="input-field" value="40" min="10" max="100" />
          </div>
          <div>
            <label class="label">展馆深度 (米)</label>
            <input type="number" id="new-hall-depth" class="input-field" value="30" min="10" max="100" />
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-6">
          <button id="btn-cancel-new" class="btn btn-secondary">取消</button>
          <button id="btn-confirm-new" class="btn btn-primary">创建</button>
        </div>
      </div>
    `);

    document.getElementById('btn-cancel-new')?.addEventListener('click', () => this.closeModal());
    document.getElementById('btn-confirm-new')?.addEventListener('click', () => {
      const name = (document.getElementById('new-project-name') as HTMLInputElement)?.value || '新项目';
      const width = parseFloat((document.getElementById('new-hall-width') as HTMLInputElement)?.value) || 40;
      const depth = parseFloat((document.getElementById('new-hall-depth') as HTMLInputElement)?.value) || 30;

      this.project = createEmptyProject(name);
      this.project.exhibitionHall = { width, depth };
      this.renderProject();
      document.getElementById('project-name')!.textContent = name;
      this.closeModal();
    });
  }

  private loadSampleProject(): void {
    const sample = createSampleProject();
    this.project = sample;
    this.renderProject();
    document.getElementById('project-name')!.textContent = sample.name;
    this.showNotification('已加载示例项目');
  }

  private saveCurrentProject(): void {
    saveProject(this.project);
    this.showNotification('项目已保存');
  }

  private exportProject(): void {
    downloadProject(this.project);
    this.showNotification('项目已导出');
  }

  private importProject(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const imported = importProjectFromJson(content);
        this.project = imported;
        this.renderProject();
        document.getElementById('project-name')!.textContent = imported.name;
        this.showNotification('项目导入成功');
      } catch {
        this.showNotification('导入失败：无效的项目文件');
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  private setTool(tool: string): void {
    document.querySelectorAll('[id^="tool-"]').forEach(btn => {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
    });
    document.getElementById(`tool-${tool}`)?.classList.remove('btn-secondary');
    document.getElementById(`tool-${tool}`)?.classList.add('btn-primary');
  }

  private addBooth(): void {
    const colors = BOOTH_COLORS;
    const colorIndex = this.project.booths.length % colors.length;
    
    const newBooth: Booth = {
      id: `booth_${Date.now()}`,
      name: `展位 ${this.project.booths.length + 1}`,
      position: { 
        x: 5 + Math.random() * (this.project.exhibitionHall.width - 10), 
        z: 5 + Math.random() * (this.project.exhibitionHall.depth - 10) 
      },
      dimension: { width: 4, depth: 3 },
      rotation: 0,
      color: colors[colorIndex]
    };

    this.project.booths.push(newBooth);
    this.sceneManager.addBooth(newBooth);
    this.updateZoneSelector();
    this.showNotification('已添加展位');
  }

  private addExit(): void {
    const newExit: Exit = {
      id: `exit_${Date.now()}`,
      name: `出口 ${this.project.exits.length + 1}`,
      position: { 
        x: this.project.exhibitionHall.width / 2, 
        z: this.project.exhibitionHall.depth - 0.5 
      },
      width: 2
    };

    this.project.exits.push(newExit);
    this.sceneManager.addExit(newExit);
    this.showNotification('已添加安全出口');
  }

  private addZone(): void {
    const colors = ZONE_COLORS;
    const colorIndex = this.project.zones.length % colors.length;
    
    const newZone: Zone = {
      id: `zone_${Date.now()}`,
      name: `区域 ${this.project.zones.length + 1}`,
      position: { 
        x: 5 + Math.random() * (this.project.exhibitionHall.width - 20), 
        z: 5 + Math.random() * (this.project.exhibitionHall.depth - 20) 
      },
      dimension: { width: 8, depth: 6 },
      color: colors[colorIndex]
    };

    this.project.zones.push(newZone);
    this.sceneManager.addZone(newZone);
    this.updateZoneSelector();
    this.showNotification('已添加区域');
  }

  private calculatePaths(): void {
    if (this.project.zones.length === 0) {
      this.showNotification('请先添加疏散区域');
      return;
    }
    if (this.project.exits.length === 0) {
      this.showNotification('请先添加安全出口');
      return;
    }

    this.project.evacuationPaths = calculateAllEvacuationPaths(
      this.project.zones,
      this.project.exits,
      this.project.booths,
      this.project.exhibitionHall
    );

    this.updateZoneSelector();
    this.showNotification('疏散路线计算完成');
  }

  private toggleAllPaths(): void {
    this.showAllPaths = !this.showAllPaths;
    
    const btn = document.getElementById('btn-toggle-paths');
    if (btn) {
      btn.textContent = this.showAllPaths ? '🙈 隐藏所有路线' : '👁️ 显示所有路线';
    }

    this.sceneManager.clearAllPaths();

    if (this.showAllPaths) {
      this.project.zones.forEach(zone => {
        const shortest = getShortestPathForZone(zone.id, this.project.evacuationPaths);
        if (shortest) {
          this.sceneManager.drawEvacuationPath(shortest, 0x2ecc71);
        }
      });
    }

    const select = document.getElementById('select-zone-path') as HTMLSelectElement;
    if (select) select.value = '';
  }

  private showZonePath(e: Event): void {
    const select = e.target as HTMLSelectElement;
    const zoneId = select.value;

    this.showAllPaths = false;
    this.sceneManager.clearAllPaths();
    
    const btn = document.getElementById('btn-toggle-paths');
    if (btn) {
      btn.textContent = '👁️ 显示所有路线';
    }

    if (zoneId) {
      const shortest = getShortestPathForZone(zoneId, this.project.evacuationPaths);
      if (shortest) {
        this.sceneManager.drawEvacuationPath(shortest, 0x3498db);
        
        this.showNotification(
          `路线: 距离 ${shortest.distance.toFixed(1)} 米 ${shortest.isBlocked ? '(已阻断)' : ''}`
        );
      }
    }
  }

  private runValidation(): void {
    if (this.project.evacuationPaths.length === 0) {
      this.calculatePaths();
    }

    this.project.validationResults = validateProject(this.project);
    this.updateValidationUI();
    this.showNotification('验证完成');
  }

  private updateValidationUI(): void {
    const summary = getValidationSummary(this.project.validationResults);
    
    const okEl = document.getElementById('val-ok');
    const warningEl = document.getElementById('val-warning');
    const errorEl = document.getElementById('val-error');
    
    if (okEl) okEl.textContent = summary.ok.toString();
    if (warningEl) warningEl.textContent = summary.warning.toString();
    if (errorEl) errorEl.textContent = summary.error.toString();

    const resultsContainer = document.getElementById('validation-results');
    if (!resultsContainer) return;

    if (this.project.validationResults.length === 0) {
      resultsContainer.innerHTML = '<p class="text-gray-400">点击"执行验证"查看结果</p>';
      return;
    }

    resultsContainer.innerHTML = this.project.validationResults.map(result => {
      const statusClass = result.status === 'ok' ? 'status-ok' : 
                         result.status === 'warning' ? 'status-warning' : 'status-danger';
      const statusText = result.status === 'ok' ? '✓' : 
                        result.status === 'warning' ? '⚠' : '✗';
      
      return `
        <div class="p-2 bg-gray-50 rounded border-l-4 ${result.status === 'error' ? 'border-red-400' : result.status === 'warning' ? 'border-yellow-400' : 'border-green-400'}">
          <div class="flex items-center gap-2">
            <span class="${statusClass} text-xs">${statusText}</span>
            <span class="text-gray-700">${result.message}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  private updateZoneSelector(): void {
    const select = document.getElementById('select-zone-path') as HTMLSelectElement;
    if (!select) return;

    const currentValue = select.value;
    select.innerHTML = '<option value="">选择区域...</option>';

    this.project.zones.forEach(zone => {
      const option = document.createElement('option');
      option.value = zone.id;
      option.textContent = zone.name;
      select.appendChild(option);
    });

    if (currentValue) {
      select.value = currentValue;
    }
  }

  private generateReport(): void {
    if (this.project.validationResults.length === 0) {
      this.runValidation();
    }

    const report = generateReportData(this.project);

    this.showModal('生成报告', `
      <div class="space-y-4">
        <div class="text-center">
          <p class="text-sm text-gray-600 mb-4">选择报告格式：</p>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <button id="btn-report-html" class="btn btn-primary py-4">
            📄 HTML 报告
          </button>
          <button id="btn-report-csv" class="btn btn-success py-4">
            📊 CSV 表格
          </button>
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <button id="btn-cancel-report" class="btn btn-secondary">关闭</button>
        </div>
      </div>
    `);

    document.getElementById('btn-report-html')?.addEventListener('click', () => {
      downloadReportHTML(report);
      this.closeModal();
      this.showNotification('HTML 报告已下载');
    });

    document.getElementById('btn-report-csv')?.addEventListener('click', () => {
      downloadReportCSV(report);
      this.closeModal();
      this.showNotification('CSV 报告已下载');
    });

    document.getElementById('btn-cancel-report')?.addEventListener('click', () => this.closeModal());
  }

  private renderProject(): void {
    this.sceneManager.clearAll();
    this.sceneManager.setHallDimensions(this.project.exhibitionHall.width, this.project.exhibitionHall.depth);
    this.sceneManager.createFloor();

    this.project.booths.forEach(booth => this.sceneManager.addBooth(booth));
    this.project.exits.forEach(exit => this.sceneManager.addExit(exit));
    this.project.zones.forEach(zone => this.sceneManager.addZone(zone));

    this.updateZoneSelector();
    
    if (this.project.validationResults.length > 0) {
      this.updateValidationUI();
    }
  }

  private onObjectSelect(data: ThreeDObjectData | null): void {
    if (data) {
      this.showObjectPanel(data);
    } else {
      this.closeObjectPanel();
    }
  }

  private onObjectMove(data: ThreeDObjectData, position: { x: number; z: number }): void {
    if (data.type === 'booth') {
      const booth = this.project.booths.find(b => b.id === data.id);
      if (booth) {
        booth.position.x = position.x - booth.dimension.width / 2;
        booth.position.z = position.z - booth.dimension.depth / 2;
      }
    } else if (data.type === 'exit') {
      const exit = this.project.exits.find(e => e.id === data.id);
      if (exit) {
        exit.position.x = position.x;
        exit.position.z = position.z;
      }
    } else if (data.type === 'zone') {
      const zone = this.project.zones.find(z => z.id === data.id);
      if (zone) {
        zone.position.x = position.x - zone.dimension.width / 2;
        zone.position.z = position.z - zone.dimension.depth / 2;
      }
    }
  }

  private showObjectPanel(data: ThreeDObjectData): void {
    const panel = document.getElementById('selected-object-panel');
    const form = document.getElementById('selected-object-form');
    if (!panel || !form) return;

    panel.classList.remove('hidden');

    let html = '';

    if (data.type === 'booth') {
      const booth = this.project.booths.find(b => b.id === data.id);
      if (booth) {
        html = `
          <div class="text-xs text-gray-500 mb-2">🏪 展位</div>
          <div>
            <label class="label text-xs">名称</label>
            <input type="text" id="edit-name" class="input-field text-xs" value="${booth.name}" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="label text-xs">位置 X</label>
              <input type="number" id="edit-pos-x" class="input-field text-xs" value="${booth.position.x.toFixed(1)}" step="0.5" />
            </div>
            <div>
              <label class="label text-xs">位置 Z</label>
              <input type="number" id="edit-pos-z" class="input-field text-xs" value="${booth.position.z.toFixed(1)}" step="0.5" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="label text-xs">宽度</label>
              <input type="number" id="edit-width" class="input-field text-xs" value="${booth.dimension.width}" min="1" max="30" />
            </div>
            <div>
              <label class="label text-xs">深度</label>
              <input type="number" id="edit-depth" class="input-field text-xs" value="${booth.dimension.depth}" min="1" max="30" />
            </div>
          </div>
          <div>
            <label class="label text-xs">颜色</label>
            <input type="color" id="edit-color" class="input-field h-8" value="${booth.color}" />
          </div>
          <div class="flex gap-2 mt-4">
            <button id="btn-apply-booth" class="btn btn-primary text-xs flex-1">应用</button>
            <button id="btn-delete-booth" class="btn btn-danger text-xs">删除</button>
          </div>
        `;
      }
    } else if (data.type === 'exit') {
      const exit = this.project.exits.find(e => e.id === data.id);
      if (exit) {
        html = `
          <div class="text-xs text-gray-500 mb-2">🚪 安全出口</div>
          <div>
            <label class="label text-xs">名称</label>
            <input type="text" id="edit-name" class="input-field text-xs" value="${exit.name}" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="label text-xs">位置 X</label>
              <input type="number" id="edit-pos-x" class="input-field text-xs" value="${exit.position.x.toFixed(1)}" step="0.5" />
            </div>
            <div>
              <label class="label text-xs">位置 Z</label>
              <input type="number" id="edit-pos-z" class="input-field text-xs" value="${exit.position.z.toFixed(1)}" step="0.5" />
            </div>
          </div>
          <div>
            <label class="label text-xs">宽度</label>
            <input type="number" id="edit-width" class="input-field text-xs" value="${exit.width}" min="1" max="10" />
          </div>
          <div class="flex gap-2 mt-4">
            <button id="btn-apply-exit" class="btn btn-primary text-xs flex-1">应用</button>
            <button id="btn-delete-exit" class="btn btn-danger text-xs">删除</button>
          </div>
        `;
      }
    } else if (data.type === 'zone') {
      const zone = this.project.zones.find(z => z.id === data.id);
      if (zone) {
        html = `
          <div class="text-xs text-gray-500 mb-2">🔲 疏散区域</div>
          <div>
            <label class="label text-xs">名称</label>
            <input type="text" id="edit-name" class="input-field text-xs" value="${zone.name}" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="label text-xs">位置 X</label>
              <input type="number" id="edit-pos-x" class="input-field text-xs" value="${zone.position.x.toFixed(1)}" step="0.5" />
            </div>
            <div>
              <label class="label text-xs">位置 Z</label>
              <input type="number" id="edit-pos-z" class="input-field text-xs" value="${zone.position.z.toFixed(1)}" step="0.5" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="label text-xs">宽度</label>
              <input type="number" id="edit-width" class="input-field text-xs" value="${zone.dimension.width}" min="2" max="40" />
            </div>
            <div>
              <label class="label text-xs">深度</label>
              <input type="number" id="edit-depth" class="input-field text-xs" value="${zone.dimension.depth}" min="2" max="40" />
            </div>
          </div>
          <div class="flex gap-2 mt-4">
            <button id="btn-apply-zone" class="btn btn-primary text-xs flex-1">应用</button>
            <button id="btn-delete-zone" class="btn btn-danger text-xs">删除</button>
          </div>
        `;
      }
    }

    form.innerHTML = html;
    this.bindEditEvents(data);
  }

  private bindEditEvents(data: ThreeDObjectData): void {
    if (data.type === 'booth') {
      document.getElementById('btn-apply-booth')?.addEventListener('click', () => {
        this.applyBoothChanges(data.id);
      });
      document.getElementById('btn-delete-booth')?.addEventListener('click', () => {
        this.deleteBooth(data.id);
      });
    } else if (data.type === 'exit') {
      document.getElementById('btn-apply-exit')?.addEventListener('click', () => {
        this.applyExitChanges(data.id);
      });
      document.getElementById('btn-delete-exit')?.addEventListener('click', () => {
        this.deleteExit(data.id);
      });
    } else if (data.type === 'zone') {
      document.getElementById('btn-apply-zone')?.addEventListener('click', () => {
        this.applyZoneChanges(data.id);
      });
      document.getElementById('btn-delete-zone')?.addEventListener('click', () => {
        this.deleteZone(data.id);
      });
    }
  }

  private applyBoothChanges(id: string): void {
    const booth = this.project.booths.find(b => b.id === id);
    if (!booth) return;

    const name = (document.getElementById('edit-name') as HTMLInputElement)?.value;
    const posX = parseFloat((document.getElementById('edit-pos-x') as HTMLInputElement)?.value);
    const posZ = parseFloat((document.getElementById('edit-pos-z') as HTMLInputElement)?.value);
    const width = parseFloat((document.getElementById('edit-width') as HTMLInputElement)?.value);
    const depth = parseFloat((document.getElementById('edit-depth') as HTMLInputElement)?.value);
    const color = (document.getElementById('edit-color') as HTMLInputElement)?.value;

    if (name) booth.name = name;
    if (!isNaN(posX)) booth.position.x = posX;
    if (!isNaN(posZ)) booth.position.z = posZ;
    if (!isNaN(width) && width > 0) booth.dimension.width = width;
    if (!isNaN(depth) && depth > 0) booth.dimension.depth = depth;
    if (color) booth.color = color;

    this.sceneManager.updateBooth(booth);
    this.showNotification('展位已更新');
  }

  private applyExitChanges(id: string): void {
    const exit = this.project.exits.find(e => e.id === id);
    if (!exit) return;

    const name = (document.getElementById('edit-name') as HTMLInputElement)?.value;
    const posX = parseFloat((document.getElementById('edit-pos-x') as HTMLInputElement)?.value);
    const posZ = parseFloat((document.getElementById('edit-pos-z') as HTMLInputElement)?.value);
    const width = parseFloat((document.getElementById('edit-width') as HTMLInputElement)?.value);

    if (name) exit.name = name;
    if (!isNaN(posX)) exit.position.x = posX;
    if (!isNaN(posZ)) exit.position.z = posZ;
    if (!isNaN(width) && width > 0) exit.width = width;

    this.sceneManager.updateExit(exit);
    this.showNotification('出口已更新');
  }

  private applyZoneChanges(id: string): void {
    const zone = this.project.zones.find(z => z.id === id);
    if (!zone) return;

    const name = (document.getElementById('edit-name') as HTMLInputElement)?.value;
    const posX = parseFloat((document.getElementById('edit-pos-x') as HTMLInputElement)?.value);
    const posZ = parseFloat((document.getElementById('edit-pos-z') as HTMLInputElement)?.value);
    const width = parseFloat((document.getElementById('edit-width') as HTMLInputElement)?.value);
    const depth = parseFloat((document.getElementById('edit-depth') as HTMLInputElement)?.value);

    if (name) zone.name = name;
    if (!isNaN(posX)) zone.position.x = posX;
    if (!isNaN(posZ)) zone.position.z = posZ;
    if (!isNaN(width) && width > 0) zone.dimension.width = width;
    if (!isNaN(depth) && depth > 0) zone.dimension.depth = depth;

    this.sceneManager.updateZone(zone);
    this.updateZoneSelector();
    this.showNotification('区域已更新');
  }

  private deleteBooth(id: string): void {
    this.project.booths = this.project.booths.filter(b => b.id !== id);
    this.sceneManager.removeBooth(id);
    this.closeObjectPanel();
    this.showNotification('展位已删除');
  }

  private deleteExit(id: string): void {
    this.project.exits = this.project.exits.filter(e => e.id !== id);
    this.sceneManager.removeExit(id);
    this.closeObjectPanel();
    this.showNotification('出口已删除');
  }

  private deleteZone(id: string): void {
    this.project.zones = this.project.zones.filter(z => z.id !== id);
    this.sceneManager.removeZone(id);
    this.sceneManager.clearEvacuationPath(id);
    this.updateZoneSelector();
    this.closeObjectPanel();
    this.showNotification('区域已删除');
  }

  private closeObjectPanel(): void {
    const panel = document.getElementById('selected-object-panel');
    if (panel) {
      panel.classList.add('hidden');
    }
  }

  private showModal(title: string, content: string): void {
    const overlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    if (!overlay || !modalContent) return;

    modalContent.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-800">${title}</h3>
        <button id="btn-close-modal" class="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
      </div>
      ${content}
    `;

    overlay.classList.remove('hidden');
    
    document.getElementById('btn-close-modal')?.addEventListener('click', () => this.closeModal());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.closeModal();
    });
  }

  private closeModal(): void {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  }

  private showNotification(message: string): void {
    const notification = document.createElement('div');
    notification.className = 'fixed top-24 left-1/2 transform -translate-x-1/2 z-50 panel px-4 py-2 text-sm bg-gray-800 text-white animate-pulse-slow';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 2000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
});
