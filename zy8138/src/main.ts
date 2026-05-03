import './style.css';
import type { Scene, Prop, PropAppearance, ContinuityRule, ContinuityIssue, ConfirmedIssue } from './types';
import { sampleDataSet } from './data';
import { runContinuityChecks } from './engine';
import {
  loadSampleDataSet,
  getCurrentDataSet,
  saveConfirmedIssue,
  saveScenes,
  saveProps,
  saveAppearances,
  saveRules,
  initDB,
} from './storage';
import {
  renderTimeline,
  renderIssuesList,
  renderImportSection,
  renderExportSection,
  handleFileImport,
  generateReviewReport,
  generateIssuesCsv,
  downloadFile,
} from './components';

interface AppState {
  scenes: Scene[];
  props: Prop[];
  appearances: PropAppearance[];
  rules: ContinuityRule[];
  issues: ContinuityIssue[];
  confirmedIssues: ConfirmedIssue[];
  projectName: string;
}

class ContinuityCheckerApp {
  private state: AppState;

  constructor() {
    this.state = {
      scenes: [],
      props: [],
      appearances: [],
      rules: [],
      issues: [],
      confirmedIssues: [],
      projectName: '道具连续性检查工具',
    };
  }

  async init(): Promise<void> {
    await initDB();
    await this.loadData();
    this.render();
    this.setupEventListeners();
  }

  private async loadData(): Promise<void> {
    const existingData = await getCurrentDataSet();
    
    if (existingData.scenes.length > 0 && existingData.props.length > 0) {
      this.state.scenes = existingData.scenes;
      this.state.props = existingData.props;
      this.state.appearances = existingData.appearances;
      this.state.rules = existingData.rules;
      this.state.confirmedIssues = existingData.confirmedIssues;
      this.state.projectName = existingData.projectSettings?.projectName || '加载的项目';
    } else {
      this.state.scenes = [...sampleDataSet.scenes];
      this.state.props = [...sampleDataSet.props];
      this.state.appearances = [...sampleDataSet.appearances];
      this.state.rules = [...sampleDataSet.rules];
      this.state.confirmedIssues = [];
      this.state.projectName = sampleDataSet.projectName;
      
      await loadSampleDataSet(sampleDataSet);
    }

    this.runChecks();
  }

  private runChecks(): void {
    const result = runContinuityChecks({
      scenes: this.state.scenes,
      props: this.state.props,
      appearances: this.state.appearances,
      rules: this.state.rules,
    });
    this.state.issues = result.issues;
  }

  private render(): void {
    const app = document.querySelector<HTMLDivElement>('#app')!;
    
    app.innerHTML = `
      <header class="app-header">
        <h1 class="app-title">🎬 道具连续性检查工具</h1>
        <div class="project-info">
          <span class="project-name">${this.state.projectName}</span>
          <span class="project-stats">
            ${this.state.scenes.length} 场 · ${this.state.props.length} 道具 · ${this.state.issues.filter(
              i => !this.state.confirmedIssues.some(ci => ci.issueId === i.id)
            ).length} 待确认问题
          </span>
        </div>
      </header>

      <nav class="app-nav">
        <button class="nav-btn active" data-view="timeline">时间线</button>
        <button class="nav-btn" data-view="issues">问题列表</button>
        <button class="nav-btn" data-view="import">导入数据</button>
        <button class="nav-btn" data-view="export">导出报告</button>
      </nav>

      <main class="app-main">
        <div class="view-container" id="view-timeline">
          ${renderTimeline({
            scenes: this.state.scenes,
            props: this.state.props,
            appearances: this.state.appearances,
            issues: this.state.issues,
            confirmedIssues: this.state.confirmedIssues,
          })}
        </div>

        <div class="view-container" id="view-issues" style="display: none;">
          ${renderIssuesList(
            this.state.issues,
            this.state.confirmedIssues
          )}
        </div>

        <div class="view-container" id="view-import" style="display: none;">
          ${renderImportSection({})}
          <div class="sample-data-section">
            <h3>加载示例数据</h3>
            <button class="sample-btn" id="load-sample">加载预设示例数据</button>
            <p class="sample-hint">点击加载包含场景、道具和连续性规则的示例数据，用于演示工具功能。</p>
          </div>
        </div>

        <div class="view-container" id="view-export" style="display: none;">
          ${renderExportSection()}
        </div>
      </main>

      <footer class="app-footer">
        <p>道具连续性检查工具 · 影视场记补拍复核助手</p>
      </footer>
    `;
  }

  private setupEventListeners(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      if (target.classList.contains('nav-btn')) {
        this.handleNavClick(target);
      }

      if (target.classList.contains('confirm-issue')) {
        const issueId = target.dataset.issueId;
        if (issueId) {
          this.handleConfirmIssue(issueId);
        }
      }

      if (target.classList.contains('sample-btn') && target.id === 'load-sample') {
        this.handleLoadSample();
      }

      if (target.classList.contains('export-btn')) {
        const format = target.dataset.format;
        if (format === 'report') {
          this.handleExportReport();
        } else if (format === 'issues') {
          this.handleExportIssues();
        }
      }

      if (target.classList.contains('import-btn')) {
        const targetType = target.dataset.target as 'scenes' | 'props' | 'rules';
        if (targetType) {
          const input = document.getElementById(`import-${targetType}`) as HTMLInputElement;
          if (input) {
            input.click();
          }
        }
      }
    });

    const importInputs = ['scenes', 'props', 'rules'] as const;
    for (const type of importInputs) {
      const input = document.getElementById(`import-${type}`) as HTMLInputElement;
      if (input) {
        input.addEventListener('change', (e) => {
          const fileInput = e.target as HTMLInputElement;
          const file = fileInput.files?.[0];
          if (file) {
            this.handleImport(file, type);
          }
        });
      }
    }
  }

  private handleNavClick(button: HTMLElement): void {
    const view = button.dataset.view;
    if (!view) return;

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    document.querySelectorAll('.view-container').forEach(container => {
      (container as HTMLElement).style.display = 'none';
    });

    const targetView = document.getElementById(`view-${view}`);
    if (targetView) {
      targetView.style.display = 'block';
    }

    if (view === 'issues') {
      this.refreshIssuesView();
    }
  }

  private handleConfirmIssue(issueId: string): void {
    const issue = this.state.issues.find(i => i.id === issueId);
    if (!issue) return;

    const confirmed: ConfirmedIssue = {
      id: `confirmed-${Date.now()}`,
      issueId: issue.id,
      confirmedBy: '当前用户',
      confirmedAt: Date.now(),
    };

    this.state.confirmedIssues.push(confirmed);
    saveConfirmedIssue(confirmed);

    this.refreshIssuesView();
    this.updateProjectStats();
  }

  private refreshIssuesView(): void {
    const issuesContainer = document.getElementById('view-issues');
    if (issuesContainer) {
      issuesContainer.innerHTML = renderIssuesList(
        this.state.issues,
        this.state.confirmedIssues
      );
    }
  }

  private updateProjectStats(): void {
    const statsElement = document.querySelector('.project-stats');
    if (statsElement) {
      const unconfirmedCount = this.state.issues.filter(
        i => !this.state.confirmedIssues.some(ci => ci.issueId === i.id)
      ).length;
      statsElement.textContent = 
        `${this.state.scenes.length} 场 · ${this.state.props.length} 道具 · ${unconfirmedCount} 待确认问题`;
    }
  }

  private async handleLoadSample(): Promise<void> {
    this.state.scenes = [...sampleDataSet.scenes];
    this.state.props = [...sampleDataSet.props];
    this.state.appearances = [...sampleDataSet.appearances];
    this.state.rules = [...sampleDataSet.rules];
    this.state.confirmedIssues = [];
    this.state.projectName = sampleDataSet.projectName;

    await loadSampleDataSet(sampleDataSet);
    this.runChecks();
    this.render();
    this.setupEventListeners();
    this.showStatus('示例数据加载成功！', 'success');
  }

  private async handleImport(file: File, type: 'scenes' | 'props' | 'rules'): Promise<void> {
    this.showStatus(`正在导入 ${file.name}...`, 'info');

    const options = {
      onScenesImported: async (scenes: Scene[]) => {
        this.state.scenes = scenes;
        await saveScenes(scenes);
        this.runChecks();
        this.showStatus(`成功导入 ${scenes.length} 个场景`, 'success');
      },
      onPropsImported: async (props: Prop[], appearances: PropAppearance[]) => {
        this.state.props = props;
        this.state.appearances = appearances;
        await saveProps(props);
        await saveAppearances(appearances);
        this.runChecks();
        this.showStatus(`成功导入 ${props.length} 个道具`, 'success');
      },
      onRulesImported: async (rules: ContinuityRule[]) => {
        this.state.rules = rules;
        await saveRules(rules);
        this.runChecks();
        this.showStatus(`成功导入 ${rules.length} 条规则`, 'success');
      },
      onError: (error: string) => {
        this.showStatus(`导入失败: ${error}`, 'error');
      },
      onSuccess: (_message: string) => {
        this.render();
        this.setupEventListeners();
      },
    };

    await handleFileImport(file, type, options);
  }

  private handleExportReport(): void {
    const report = generateReviewReport({
      scenes: this.state.scenes,
      props: this.state.props,
      appearances: this.state.appearances,
      rules: this.state.rules,
      issues: this.state.issues,
      confirmedIssues: this.state.confirmedIssues,
      projectName: this.state.projectName,
    });

    downloadFile(report, 'review_report.md', 'text/markdown');
    this.showStatus('报告已导出：review_report.md', 'success');
  }

  private handleExportIssues(): void {
    const csv = generateIssuesCsv({
      scenes: this.state.scenes,
      props: this.state.props,
      appearances: this.state.appearances,
      rules: this.state.rules,
      issues: this.state.issues,
      confirmedIssues: this.state.confirmedIssues,
      projectName: this.state.projectName,
    });

    downloadFile(csv, 'issues.csv', 'text/csv');
    this.showStatus('问题列表已导出：issues.csv', 'success');
  }

  private showStatus(message: string, type: 'success' | 'error' | 'info'): void {
    let statusElement = document.getElementById('import-status');
    
    if (!statusElement) {
      statusElement = document.createElement('div');
      statusElement.id = 'import-status';
      document.querySelector('.app-main')?.prepend(statusElement);
    }

    statusElement.className = `status-message status-${type}`;
    statusElement.textContent = message;
    statusElement.style.display = 'block';

    setTimeout(() => {
      if (statusElement) {
        statusElement.style.display = 'none';
      }
    }, 5000);
  }
}

const app = new ContinuityCheckerApp();
app.init();
