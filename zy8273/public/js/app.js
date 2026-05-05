class App {
  constructor() {
    this.wizard = new Wizard();
    this.autoSaveManager = null;
    this.currentView = 'home';
  }

  async init() {
    this.bindGlobalEvents();
    this.wizard.init();
    await this.checkResumeState();
    await this.loadHomePage();
  }

  bindGlobalEvents() {
    document.getElementById('new-draft-btn').addEventListener('click', () => this.createNewDraft());
    document.getElementById('back-to-list-btn').addEventListener('click', () => this.returnToList());
    document.getElementById('back-home-btn').addEventListener('click', () => this.showHomeView());
  }

  async checkResumeState() {
    const draftId = storage.getCurrentDraftId();
    
    if (draftId) {
      try {
        const unsavedData = storage.getUnsavedData();
        if (unsavedData) {
          console.log('Found unsaved local data, will prompt on load');
        }
        
        const result = await api.getDraft(draftId);
        if (result.success) {
          const shouldResume = confirm(
            `检测到未完成的草稿："${result.data.title}"\n是否继续编辑？`
          );
          
          if (shouldResume) {
            await this.loadDraft(draftId);
            return;
          } else {
            storage.clearDraftState();
          }
        }
      } catch (error) {
        console.log('No draft to resume or draft not found');
        storage.clearDraftState();
      }
    }
  }

  async loadHomePage() {
    await Promise.all([
      this.loadDrafts(),
      this.loadSubmissions()
    ]);
  }

  async loadDrafts() {
    try {
      const result = await api.getDrafts();
      this.renderDrafts(result.data);
    } catch (error) {
      console.error('Load drafts failed:', error);
      this.renderDrafts([]);
    }
  }

  async loadSubmissions() {
    try {
      const result = await api.getSubmissions();
      this.renderSubmissions(result.data);
    } catch (error) {
      console.error('Load submissions failed:', error);
      this.renderSubmissions([]);
    }
  }

  renderDrafts(drafts) {
    const container = document.getElementById('draft-list');
    const emptyState = document.getElementById('empty-drafts');

    if (!drafts || drafts.length === 0) {
      container.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = drafts.map(draft => `
      <div class="draft-item" data-id="${draft.id}">
        <div class="draft-info">
          <div class="draft-title">
            ${draft.title}
            ${draft.isSchemaOutdated ? '<span class="schema-outdated-badge">⚠️ 格式较旧</span>' : ''}
          </div>
          <div class="draft-meta">
            <span>进度: ${draft.progress}%</span>
            <span>版本: v${draft.version}</span>
            <span>更新: ${this.formatDateTime(draft.updated_at)}</span>
          </div>
        </div>
        <div class="draft-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${draft.progress}%"></div>
          </div>
        </div>
        <div class="draft-actions">
          <button class="btn btn-secondary" data-action="edit" data-id="${draft.id}">编辑</button>
          <button class="btn btn-danger" data-action="delete" data-id="${draft.id}">删除</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.draft-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.draft-actions')) {
          const id = item.dataset.id;
          this.loadDraft(id);
        }
      });
    });

    container.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this.loadDraft(id);
      });
    });

    container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this.deleteDraft(id);
      });
    });
  }

  renderSubmissions(submissions) {
    const container = document.getElementById('submissions-list');

    if (!submissions || submissions.length === 0) {
      container.innerHTML = '<div class="submission-item"><span class="no-data">暂无提交记录</span></div>';
      return;
    }

    container.innerHTML = submissions.slice(0, 10).map(sub => `
      <div class="submission-item">
        <div class="submission-info">
          <div class="submission-title">${sub.title}</div>
          <div class="submission-meta">
            提交人: ${sub.submitter || '系统'} | 
            提交时间: ${this.formatDateTime(sub.submitted_at)}
            ${sub.isSchemaOutdated ? ' | <span class="schema-outdated-badge">⚠️ 格式较旧</span>' : ''}
          </div>
        </div>
        <span class="submission-status">已提交</span>
      </div>
    `).join('');
  }

  async createNewDraft() {
    const title = prompt('请输入申请项目名称：', '新建采购申请');
    if (title === null || title.trim() === '') {
      return;
    }

    try {
      const result = await api.createDraft(title.trim());
      if (result.success) {
        await this.loadDraft(result.data.id);
      }
    } catch (error) {
      console.error('Create draft failed:', error);
      alert('创建草稿失败：' + (error.message || '未知错误'));
    }
  }

  async loadDraft(id) {
    try {
      const result = await api.getDraft(id);
      
      if (!result.success) {
        alert('草稿不存在或已被删除');
        return;
      }

      const draft = result.data;

      storage.setCurrentDraftId(id);
      storage.setDraftVersion(draft.version);
      storage.setCurrentStep(draft.current_step);

      this.wizard.populateFormData(draft.data);
      this.wizard.goToStep(draft.current_step);
      
      if (draft.isSchemaOutdated) {
        this.wizard.showSchemaWarning(true, 
          '该草稿使用旧数据格式，保存后将自动更新到最新格式。'
        );
      } else {
        this.wizard.showSchemaWarning(false);
      }

      this.autoSaveManager = new AutoSaveManager(this.wizard, api);
      this.wizard.setAutoSaveManager(this.autoSaveManager);
      this.autoSaveManager.start();

      this.showWizardView();
      
      document.getElementById('manual-save-btn').style.display = 'inline-flex';
      
      this.wizard.updateSaveStatus('saved');

    } catch (error) {
      console.error('Load draft failed:', error);
      alert('加载草稿失败：' + (error.message || '未知错误'));
    }
  }

  async deleteDraft(id) {
    if (!confirm('确定要删除此草稿吗？此操作不可撤销。')) {
      return;
    }

    try {
      const result = await api.deleteDraft(id);
      if (result.success) {
        this.loadDrafts();
      }
    } catch (error) {
      console.error('Delete draft failed:', error);
      alert('删除草稿失败：' + (error.message || '未知错误'));
    }
  }

  async returnToList() {
    if (this.autoSaveManager && this.autoSaveManager.hasUnsyncedChanges) {
      const shouldSave = confirm('有未保存的更改，是否先保存？');
      if (shouldSave) {
        await this.autoSaveManager.manualSave();
      }
    }

    if (this.autoSaveManager) {
      this.autoSaveManager.stop();
    }

    storage.clearDraftState();
    this.showHomeView();
    await this.loadHomePage();
  }

  showHomeView() {
    this.currentView = 'home';
    document.getElementById('home-view').style.display = 'block';
    document.getElementById('wizard-view').style.display = 'none';
    document.getElementById('submitted-view').style.display = 'none';
    document.getElementById('manual-save-btn').style.display = 'none';
    this.wizard.showSchemaWarning(false);
  }

  showWizardView() {
    this.currentView = 'wizard';
    document.getElementById('home-view').style.display = 'none';
    document.getElementById('wizard-view').style.display = 'block';
    document.getElementById('submitted-view').style.display = 'none';
  }

  showSubmittedView(data) {
    this.currentView = 'submitted';
    
    if (this.autoSaveManager) {
      this.autoSaveManager.stop();
    }
    storage.clearDraftState();

    document.getElementById('home-view').style.display = 'none';
    document.getElementById('wizard-view').style.display = 'none';
    document.getElementById('submitted-view').style.display = 'block';
    document.getElementById('manual-save-btn').style.display = 'none';
    this.wizard.showSchemaWarning(false);

    document.getElementById('submitted-title').textContent = `"${data.title}"`;
    document.getElementById('submitted-time').textContent = 
      `提交时间: ${this.formatDateTime(data.submitted_at)}`;
  }

  formatDateTime(dateStr) {
    if (!dateStr) return '-';
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;

    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

const app = new App();

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
