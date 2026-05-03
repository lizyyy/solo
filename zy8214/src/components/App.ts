import { AppState } from '../types';
import { store } from '../store';
import { sampleData } from '../data/sampleData';
import { renderFileUpload, handleFileSelect, setupDragDrop } from './FileUpload';
import { renderTimeline, handleTimelineInteraction } from './Timeline';
import { renderRiskList } from './RiskList';
import { renderCueDetails } from './CueDetails';
import { renderChannelMap } from './ChannelMap';
import { showExportModal } from './ExportModal';

let currentState: AppState;
let activeTab: 'risks' | 'details' | 'channels' = 'risks';
let selectedRiskId: string | null = null;

export function renderApp(): void {
  currentState = store.getState();
  const app = document.getElementById('app');
  
  if (!app) return;

  if (!currentState.dataLoaded) {
    renderWelcomeScreen(app);
  } else {
    renderMainContent(app);
  }

  store.subscribe((state) => {
    currentState = state;
    renderApp();
  });
}

function renderWelcomeScreen(app: HTMLElement): void {
  app.innerHTML = `
    <div class="app-container">
      <header class="header">
        <h1>🎭 剧院舞台灯光 Cue 表预演工具</h1>
      </header>
      <main class="main-content">
        <div class="welcome-screen">
          <h2>开始预览灯光 Cue 表</h2>
          <p>
            导入灯具通道配置（JSON）、Cue 表（CSV）和场景规则（YAML），
            即可在时间轴上预览每个 Cue 的淡入淡出、通道占用情况，
            并自动检测潜在的风险问题。
          </p>
          ${renderFileUpload()}
          <div style="margin-top: 24px;">
            <button class="btn btn-primary" id="load-sample-btn">
              📋 加载样本数据
            </button>
          </div>
        </div>
      </main>
    </div>
  `;

  setupEventListeners();
}

function renderMainContent(app: HTMLElement): void {
  const validationResult = store.getValidationResult();
  const risks = currentState.risks;
  const criticalCount = risks.filter((r) => r.severity === 'critical').length;
  const warningCount = risks.filter((r) => r.severity === 'warning').length;
  const infoCount = risks.filter((r) => r.severity === 'info').length;

  app.innerHTML = `
    <div class="app-container">
      <header class="header">
        <h1>🎭 剧院舞台灯光 Cue 表预演工具</h1>
        <div class="header-actions">
          <button class="btn btn-secondary btn-sm" id="export-btn">
            📤 导出报告
          </button>
          <button class="btn btn-secondary btn-sm" id="import-btn">
            📥 导入文件
          </button>
          <button class="btn btn-danger btn-sm" id="clear-btn">
            🗑️ 清空
          </button>
        </div>
      </header>
      <main class="main-content">
        <section class="timeline-section">
          ${renderTimeline(currentState)}
        </section>
        <aside class="sidebar">
          <div class="sidebar-tabs">
            <button class="tab-btn ${activeTab === 'risks' ? 'active' : ''}" id="tab-risks">
              风险清单
              ${criticalCount > 0 ? `<span class="tab-badge critical">${criticalCount}</span>` : ''}
              ${warningCount > 0 && criticalCount === 0 ? `<span class="tab-badge warning">${warningCount}</span>` : ''}
              ${infoCount > 0 && criticalCount === 0 && warningCount === 0 ? `<span class="tab-badge info">${infoCount}</span>` : ''}
            </button>
            <button class="tab-btn ${activeTab === 'details' ? 'active' : ''}" id="tab-details">
              Cue 详情
            </button>
            <button class="tab-btn ${activeTab === 'channels' ? 'active' : ''}" id="tab-channels">
              通道占用
            </button>
          </div>
          <div class="sidebar-content">
            ${activeTab === 'risks' ? renderRiskList(currentState, selectedRiskId) : ''}
            ${activeTab === 'details' ? renderCueDetails(currentState) : ''}
            ${activeTab === 'channels' ? renderChannelMap(currentState) : ''}
          </div>
        </aside>
      </main>
      <footer class="status-bar">
        <div class="status-items">
          <div class="status-item">
            <span class="status-dot ${validationResult && validationResult.summary.critical > 0 ? 'critical' : 'success'}"></span>
            <span>灯具: <strong>${currentState.fixtures.length}</strong></span>
          </div>
          <div class="status-item">
            <span>Cue: <strong>${currentState.cues.length}</strong></span>
          </div>
          ${validationResult ? `
            <div class="status-item">
              <span class="status-dot ${validationResult.summary.critical > 0 ? 'critical' : validationResult.summary.warning > 0 ? 'warning' : 'success'}"></span>
              <span>风险: <strong>${validationResult.summary.total}</strong> (严重: ${validationResult.summary.critical}, 警告: ${validationResult.summary.warning})</span>
            </div>
          ` : ''}
        </div>
      </footer>
    </div>
    <div id="export-modal-container"></div>
    <div id="import-modal-container"></div>
  `;

  setupMainEventListeners();
}

function setupEventListeners(): void {
  const loadSampleBtn = document.getElementById('load-sample-btn');
  if (loadSampleBtn) {
    loadSampleBtn.addEventListener('click', () => {
      store.loadSampleData(sampleData);
    });
  }

  const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        handleFileSelect(target.files);
      }
    });
  }

  const uploadArea = document.getElementById('upload-area');
  if (uploadArea) {
    setupDragDrop(uploadArea);
  }
}

function setupMainEventListeners(): void {
  document.getElementById('export-btn')?.addEventListener('click', () => {
    showExportModal(currentState);
  });

  document.getElementById('clear-btn')?.addEventListener('click', () => {
    if (confirm('确定要清空所有数据吗？')) {
      store.clearAll();
      selectedRiskId = null;
      activeTab = 'risks';
    }
  });

  document.getElementById('import-btn')?.addEventListener('click', () => {
    renderImportModal();
  });

  document.getElementById('tab-risks')?.addEventListener('click', () => {
    activeTab = 'risks';
    renderApp();
  });

  document.getElementById('tab-details')?.addEventListener('click', () => {
    activeTab = 'details';
    renderApp();
  });

  document.getElementById('tab-channels')?.addEventListener('click', () => {
    activeTab = 'channels';
    renderApp();
  });

  handleTimelineInteraction(currentState);
  handleRiskListInteraction();
}

function handleRiskListInteraction(): void {
  const riskItems = document.querySelectorAll('.risk-item');
  riskItems.forEach((item) => {
    item.addEventListener('click', () => {
      const riskId = item.getAttribute('data-risk-id');
      const cueId = item.getAttribute('data-cue-id');
      
      selectedRiskId = riskId;
      
      if (cueId) {
        store.setSelectedCue(cueId);
      }
      
      renderApp();
    });
  });
}

function renderImportModal(): void {
  const container = document.getElementById('import-modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="modal-overlay" id="import-modal-overlay">
      <div class="modal">
        <header class="modal-header">
          <h3>导入数据文件</h3>
          <button class="modal-close" id="import-modal-close">&times;</button>
        </header>
        <div class="modal-body">
          <div style="margin-bottom: 16px;">
            <p style="color: var(--text-secondary); margin-bottom: 16px;">
              选择要导入的数据文件。你可以同时选择多个文件（灯具 JSON、Cue 表 CSV、规则 YAML）。
            </p>
            ${renderFileUpload()}
          </div>
          <div class="file-list" id="import-file-list">
          </div>
        </div>
        <footer class="modal-footer">
          <button class="btn btn-secondary" id="import-modal-cancel">取消</button>
          <button class="btn btn-primary" id="import-modal-confirm">确认导入</button>
        </footer>
      </div>
    </div>
  `;

  const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        updateImportFileList(target.files);
      }
    });
  }

  const uploadArea = document.getElementById('upload-area');
  if (uploadArea) {
    setupDragDrop(uploadArea, (files) => {
      updateImportFileList(files);
    });
  }

  document.getElementById('import-modal-close')?.addEventListener('click', closeImportModal);
  document.getElementById('import-modal-cancel')?.addEventListener('click', closeImportModal);
  document.getElementById('import-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      closeImportModal();
    }
  });

  document.getElementById('import-modal-confirm')?.addEventListener('click', () => {
    const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
    if (fileInput?.files && fileInput.files.length > 0) {
      handleFileSelect(fileInput.files);
    }
    closeImportModal();
  });
}

function closeImportModal(): void {
  const container = document.getElementById('import-modal-container');
  if (container) {
    container.innerHTML = '';
  }
}

function updateImportFileList(files: FileList): void {
  const fileList = document.getElementById('import-file-list');
  if (!fileList) return;

  const getFileIcon = (type: string): string => {
    if (type.includes('json') || type.includes('application')) return '📄';
    if (type.includes('csv') || type.includes('spreadsheet')) return '📊';
    if (type.includes('yaml') || type.includes('text')) return '📋';
    return '📁';
  };

  let html = '';
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const typeLabel = ext === 'json' ? '灯具配置' : ext === 'csv' ? 'Cue 表' : ext === 'yaml' ? '场景规则' : '未知';
    html += `
      <div class="file-item">
        <span class="file-icon">${getFileIcon(file.type)}</span>
        <div class="file-info">
          <div class="file-name">${file.name}</div>
          <div class="file-type">${typeLabel} · ${(file.size / 1024).toFixed(1)} KB</div>
        </div>
        <span class="file-status success">已选择</span>
      </div>
    `;
  }
  fileList.innerHTML = html;
}
