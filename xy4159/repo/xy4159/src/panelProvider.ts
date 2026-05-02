import * as vscode from 'vscode';
import { apiClient } from './apiClient';
import { ReviewCard, PullRequest, Severity, CardStatus } from './types';

export class ReviewPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'prReviewEvidenceFolder.panel';
  private _view?: vscode.WebviewView;
  private _currentPRId: string | null = null;
  private _prs: PullRequest[] = [];
  private _cards: ReviewCard[] = [];

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'ready':
          await this._loadData();
          break;
        case 'selectPR':
          this._currentPRId = message.prId;
          await this._loadCards();
          break;
        case 'createPR':
          await this._createPR(message.title);
          break;
        case 'deletePR':
          await this._deletePR(message.prId);
          break;
        case 'updateCard':
          await this._updateCard(message.cardId, message.updates);
          break;
        case 'deleteCard':
          await this._deleteCard(message.cardId);
          break;
        case 'exportMarkdown':
          await this._exportMarkdown();
          break;
        case 'exportJson':
          await this._exportJson();
          break;
      }
    });
  }

  private async _loadData(): Promise<void> {
    try {
      await apiClient.healthCheck();
      this._prs = await apiClient.getPRs();
      
      if (this._prs.length > 0 && !this._currentPRId) {
        this._currentPRId = this._prs[0].id;
        await this._loadCards();
      } else {
        this._sendMessage({
          type: 'update',
          prs: this._prs,
          currentPRId: this._currentPRId,
          cards: this._cards
        });
      }
    } catch (error) {
      this._sendMessage({
        type: 'error',
        message: '无法连接到本地服务，请确保服务已启动 (http://localhost:38765)'
      });
    }
  }

  private async _loadCards(): Promise<void> {
    if (!this._currentPRId) {
      this._cards = [];
      return;
    }
    try {
      this._cards = await apiClient.getCards(this._currentPRId);
      this._sendMessage({
        type: 'update',
        prs: this._prs,
        currentPRId: this._currentPRId,
        cards: this._cards
      });
    } catch (error) {
      this._sendMessage({
        type: 'error',
        message: '加载卡片失败'
      });
    }
  }

  private async _createPR(title: string): Promise<void> {
    try {
      const prId = await apiClient.createPR(title);
      this._currentPRId = prId;
      await this._loadData();
    } catch (error) {
      this._sendMessage({
        type: 'error',
        message: '创建 PR 失败'
      });
    }
  }

  private async _deletePR(prId: string): Promise<void> {
    try {
      await apiClient.deletePR(prId);
      if (this._currentPRId === prId) {
        this._currentPRId = null;
        this._cards = [];
      }
      await this._loadData();
    } catch (error) {
      this._sendMessage({
        type: 'error',
        message: '删除 PR 失败'
      });
    }
  }

  private async _updateCard(cardId: string, updates: any): Promise<void> {
    try {
      await apiClient.updateCard(cardId, updates);
      await this._loadCards();
    } catch (error) {
      this._sendMessage({
        type: 'error',
        message: '更新卡片失败'
      });
    }
  }

  private async _deleteCard(cardId: string): Promise<void> {
    try {
      await apiClient.deleteCard(cardId);
      await this._loadCards();
    } catch (error) {
      this._sendMessage({
        type: 'error',
        message: '删除卡片失败'
      });
    }
  }

  private async _exportMarkdown(): Promise<void> {
    if (!this._currentPRId) return;
    try {
      const markdown = await apiClient.exportMarkdown(this._currentPRId);
      const uri = await vscode.window.showSaveDialog({
        saveLabel: '保存',
        filters: {
          'Markdown': ['md']
        },
        defaultName: 'review-summary.md'
      });
      if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(markdown, 'utf-8'));
        vscode.window.showInformationMessage('Markdown 已导出');
      }
    } catch (error) {
      vscode.window.showErrorMessage('导出 Markdown 失败');
    }
  }

  private async _exportJson(): Promise<void> {
    if (!this._currentPRId) return;
    try {
      const json = await apiClient.exportJson(this._currentPRId);
      const uri = await vscode.window.showSaveDialog({
        saveLabel: '保存',
        filters: {
          'JSON': ['json']
        },
        defaultName: 'review-audit.json'
      });
      if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf-8'));
        vscode.window.showInformationMessage('JSON 审计包已导出');
      }
    } catch (error) {
      vscode.window.showErrorMessage('导出 JSON 失败');
    }
  }

  private _sendMessage(message: any): void {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PR 评审证据夹</title>
  <style>
    :root {
      --bg-color: var(--vscode-editor-background);
      --text-color: var(--vscode-editor-foreground);
      --border-color: var(--vscode-panel-border);
      --accent-color: var(--vscode-button-background);
      --card-bg: var(--vscode-sideBar-background);
    }
    body {
      margin: 0;
      padding: 12px;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--text-color);
      background: var(--bg-color);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-color);
    }
    .header h2 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }
    .btn {
      padding: 4px 12px;
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
      background: var(--accent-color);
      color: var(--vscode-button-foreground);
    }
    .btn:hover { opacity: 0.9; }
    .btn-small { padding: 2px 8px; font-size: 11px; }
    .btn-danger { background: #dc3545; }
    .pr-selector {
      margin-bottom: 12px;
    }
    .pr-selector select {
      width: 100%;
      padding: 6px 8px;
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      color: var(--text-color);
      border-radius: 3px;
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 12px;
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .card-title {
      font-weight: 600;
      margin: 0;
      flex: 1;
    }
    .severity {
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
      margin-right: 8px;
    }
    .severity-critical { background: #dc3545; color: white; }
    .severity-high { background: #fd7e14; color: white; }
    .severity-medium { background: #ffc107; color: #212529; }
    .severity-low { background: #28a745; color: white; }
    .status {
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      cursor: pointer;
    }
    .status-open { background: #007bff; color: white; }
    .status-in_progress { background: #ffc107; color: #212529; }
    .status-resolved { background: #28a745; color: white; }
    .status-dismissed { background: #6c757d; color: white; }
    .card-description {
      margin: 8px 0;
      font-size: 13px;
      opacity: 0.9;
      white-space: pre-wrap;
    }
    .card-meta {
      font-size: 11px;
      opacity: 0.7;
      margin-top: 8px;
    }
    .card-actions {
      display: flex;
      gap: 4px;
      margin-top: 8px;
    }
    .empty-state {
      text-align: center;
      padding: 24px;
      opacity: 0.6;
    }
    .error {
      background: #dc354520;
      border: 1px solid #dc3545;
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 12px;
      color: #dc3545;
    }
    .stats {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
      padding: 8px;
      background: var(--card-bg);
      border-radius: 4px;
    }
    .stat-item {
      text-align: center;
    }
    .stat-value {
      font-size: 16px;
      font-weight: 600;
    }
    .stat-label {
      font-size: 11px;
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <div id="app">
    <div class="header">
      <h2>📁 PR 评审证据夹</h2>
      <button class="btn btn-small" id="newPRBtn">+ 新建 PR</button>
    </div>
    <div id="errorContainer"></div>
    <div id="content" class="empty-state">
      <p>加载中...</p>
    </div>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    let state = { prs: [], currentPRId: null, cards: [] };

    function showError(message) {
      const container = document.getElementById('errorContainer');
      container.innerHTML = '<div class="error">' + message + '</div>';
      setTimeout(() => { container.innerHTML = ''; }, 5000);
    }

    function getSeverityClass(severity) {
      return 'severity severity-' + severity;
    }

    function getStatusClass(status) {
      return 'status status-' + status;
    }

    function getSeverityLabel(severity) {
      const labels = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
      return labels[severity] || severity;
    }

    function getStatusLabel(status) {
      const labels = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', dismissed: 'Dismissed' };
      return labels[status] || status;
    }

    function render() {
      const content = document.getElementById('content');
      if (state.prs.length === 0) {
        content.innerHTML = '<div class="empty-state"><p>暂无 PR</p><p><button class="btn" id="createFirstPR">创建第一个 PR</button></p></div>';
        bindEvents();
        return;
      }

      const currentPR = state.prs.find(p => p.id === state.currentPRId);
      
      let html = '<div class="pr-selector"><select id="prSelect">';
      state.prs.forEach(pr => {
        const selected = pr.id === state.currentPRId ? ' selected' : '';
        html += '<option value="' + pr.id + '"' + selected + '>' + pr.title + '</option>';
      });
      html += '</select></div>';

      html += '<div class="actions">';
      html += '<button class="btn btn-small" id="exportMdBtn">导出 Markdown</button>';
      html += '<button class="btn btn-small" id="exportJsonBtn">导出 JSON</button>';
      html += '<button class="btn btn-small btn-danger" id="deletePRBtn">删除当前 PR</button>';
      html += '</div>';

      if (currentPR) {
        const stats = {
          total: state.cards.length,
          critical: state.cards.filter(c => c.severity === 'critical').length,
          high: state.cards.filter(c => c.severity === 'high').length,
          medium: state.cards.filter(c => c.severity === 'medium').length,
          low: state.cards.filter(c => c.severity === 'low').length
        };
        html += '<div class="stats">';
        html += '<div class="stat-item"><div class="stat-value">' + stats.total + '</div><div class="stat-label">总计</div></div>';
        html += '<div class="stat-item"><div class="stat-value severity-critical">' + stats.critical + '</div><div class="stat-label">Critical</div></div>';
        html += '<div class="stat-item"><div class="stat-value severity-high">' + stats.high + '</div><div class="stat-label">High</div></div>';
        html += '<div class="stat-item"><div class="stat-value severity-medium">' + stats.medium + '</div><div class="stat-label">Medium</div></div>';
        html += '<div class="stat-item"><div class="stat-value severity-low">' + stats.low + '</div><div class="stat-label">Low</div></div>';
        html += '</div>';
      }

      if (state.cards.length === 0) {
        html += '<div class="empty-state"><p>暂无评审卡片</p><p>在编辑器中右键选择"创建评审卡片"</p></div>';
      } else {
        state.cards.forEach(card => {
          html += '<div class="card" data-card-id="' + card.id + '">';
          html += '<div class="card-header">';
          html += '<span class="' + getSeverityClass(card.severity) + '">' + getSeverityLabel(card.severity) + '</span>';
          html += '<h3 class="card-title">' + card.title + '</h3>';
          html += '<span class="' + getStatusClass(card.status) + '" data-action="change-status" data-card-id="' + card.id + '">' + getStatusLabel(card.status) + '</span>';
          html += '</div>';
          if (card.description) {
            html += '<div class="card-description">' + card.description.replace(/\n/g, '<br>') + '</div>';
          }
          if (card.codeLocations && card.codeLocations.length > 0) {
            html += '<div class="card-meta">📄 代码位置: ' + card.codeLocations.map(loc => 
              loc.filePath + ':' + loc.startLine + '-' + loc.endLine
            ).join(', ') + '</div>';
          }
          if (card.attachments && card.attachments.length > 0) {
            html += '<div class="card-meta">📎 附件: ' + card.attachments.length + ' 个</div>';
          }
          html += '<div class="card-actions">';
          html += '<button class="btn btn-small" data-action="update-severity" data-card-id="' + card.id + '">更改级别</button>';
          html += '<button class="btn btn-small btn-danger" data-action="delete" data-card-id="' + card.id + '">删除</button>';
          html += '</div>';
          html += '</div>';
        });
      }

      content.innerHTML = html;
      bindEvents();
    }

    function bindEvents() {
      const prSelect = document.getElementById('prSelect');
      if (prSelect) {
        prSelect.addEventListener('change', (e) => {
          vscode.postMessage({ type: 'selectPR', prId: e.target.value });
        });
      }

      const newPRBtn = document.getElementById('newPRBtn');
      if (newPRBtn) {
        newPRBtn.addEventListener('click', () => {
          const title = prompt('输入 PR 标题:');
          if (title && title.trim()) {
            vscode.postMessage({ type: 'createPR', title: title.trim() });
          }
        });
      }

      const createFirstPR = document.getElementById('createFirstPR');
      if (createFirstPR) {
        createFirstPR.addEventListener('click', () => {
          const title = prompt('输入 PR 标题:');
          if (title && title.trim()) {
            vscode.postMessage({ type: 'createPR', title: title.trim() });
          }
        });
      }

      const exportMdBtn = document.getElementById('exportMdBtn');
      if (exportMdBtn) {
        exportMdBtn.addEventListener('click', () => {
          vscode.postMessage({ type: 'exportMarkdown' });
        });
      }

      const exportJsonBtn = document.getElementById('exportJsonBtn');
      if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', () => {
          vscode.postMessage({ type: 'exportJson' });
        });
      }

      const deletePRBtn = document.getElementById('deletePRBtn');
      if (deletePRBtn) {
        deletePRBtn.addEventListener('click', () => {
          if (confirm('确定要删除当前 PR 及其所有卡片吗？')) {
            vscode.postMessage({ type: 'deletePR', prId: state.currentPRId });
          }
        });
      }

      document.querySelectorAll('[data-action="change-status"]').forEach(el => {
        el.addEventListener('click', (e) => {
          const cardId = e.target.dataset.cardId;
          const statuses = ['open', 'in_progress', 'resolved', 'dismissed'];
          const labels = ['Open', 'In Progress', 'Resolved', 'Dismissed'];
          const currentCard = state.cards.find(c => c.id === cardId);
          const currentIndex = statuses.indexOf(currentCard.status);
          const nextStatus = statuses[(currentIndex + 1) % statuses.length];
          vscode.postMessage({ type: 'updateCard', cardId, updates: { status: nextStatus } });
        });
      });

      document.querySelectorAll('[data-action="update-severity"]').forEach(el => {
        el.addEventListener('click', (e) => {
          const cardId = e.target.dataset.cardId;
          const severities = ['low', 'medium', 'high', 'critical'];
          const input = prompt('选择严重级别 (low/medium/high/critical):');
          if (input && severities.includes(input.toLowerCase())) {
            vscode.postMessage({ type: 'updateCard', cardId, updates: { severity: input.toLowerCase() } });
          }
        });
      });

      document.querySelectorAll('[data-action="delete"]').forEach(el => {
        el.addEventListener('click', (e) => {
          if (confirm('确定要删除这个卡片吗？')) {
            const cardId = e.target.dataset.cardId;
            vscode.postMessage({ type: 'deleteCard', cardId });
          }
        });
      });
    }

    window.addEventListener('message', (event) => {
      const message = event.data;
      switch (message.type) {
        case 'update':
          state = {
            prs: message.prs || [],
            currentPRId: message.currentPRId,
            cards: message.cards || []
          };
          render();
          break;
        case 'error':
          showError(message.message);
          break;
      }
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}
