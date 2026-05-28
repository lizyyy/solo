import { formatTime, formatDateTime, formatDuration, downloadFile } from '../utils/helpers.js';
import { VIEW_MODES, VISUAL_MODES, CONFLICT_ACTIONS, EXPORT_FORMATS, GALLERY_DIMENSIONS } from '../utils/constants.js';

export class UIController {
  constructor(app) {
    this.app = app;
    this.dataManager = app.dataManager;
    this.toasts = [];
    this.modals = [];
  }

  init() {
    this.renderToolbar();
    this.renderSidebar();
    this.renderTimeline();
    this.renderHeatmapLegend();
  }

  renderToolbar() {
    const container = document.getElementById('toolbar');
    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
        <div style="font-size: 16px; font-weight: 600; background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
          🎨 画廊观展动线热图分析
        </div>
      </div>
      <button class="toolbar-btn" id="btn-import">
        <span>📁</span> 导入数据
      </button>
      <button class="toolbar-btn" id="btn-records">
        <span>📋</span> 记录管理
      </button>
      <button class="toolbar-btn primary" id="btn-export">
        <span>📊</span> 导出报告
      </button>
      <button class="toolbar-btn" id="btn-settings">
        <span>⚙️</span>
      </button>
    `;

    document.getElementById('btn-import').onclick = () => this.showImportModal();
    document.getElementById('btn-records').onclick = () => this.showRecordsModal();
    document.getElementById('btn-export').onclick = () => this.showExportModal();
    document.getElementById('btn-settings').onclick = () => this.showSettingsModal();
  }

  renderSidebar() {
    const container = document.getElementById('sidebar');
    container.innerHTML = `
      <div class="section">
        <div class="section-title">当前记录</div>
        <div id="current-record-info">
          <div class="empty-state">
            <div class="empty-icon">📊</div>
            <div>暂无数据，请导入观展记录</div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">统计概览</div>
        <div id="stats-overview"></div>
      </div>

      <div class="section">
        <div class="section-title">视图控制</div>
        <div class="view-controls">
          <button class="view-btn active" data-view="${VIEW_MODES.PERSPECTIVE}">透视</button>
          <button class="view-btn" data-view="${VIEW_MODES.TOP}">俯视</button>
          <button class="view-btn" data-view="${VIEW_MODES.FRONT}">正视</button>
          <button class="view-btn" data-view="${VIEW_MODES.SIDE}">侧视</button>
          <button class="view-btn" data-view="${VIEW_MODES.ORBIT}">自由</button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">楼层</div>
        <div class="floor-toggle">
          <button class="floor-btn active" data-floor="all">全部</button>
          <button class="floor-btn" data-floor="1">1层</button>
          <button class="floor-btn" data-floor="2">2层</button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">可视化模式</div>
        <div class="view-controls">
          <button class="view-btn" data-visual="${VISUAL_MODES.NORMAL}">普通</button>
          <button class="view-btn active" data-visual="${VISUAL_MODES.COMBINED}">综合</button>
          <button class="view-btn" data-visual="${VISUAL_MODES.HEATMAP}">热力</button>
          <button class="view-btn" data-visual="${VISUAL_MODES.PATH}">动线</button>
        </div>
      </div>

      <div class="section">
        <div class="section-title">显示设置</div>
        <div class="checkbox-item">
          <input type="checkbox" id="show-labels" checked>
          <label for="show-labels">显示作品标签</label>
        </div>
        <div class="checkbox-item">
          <input type="checkbox" id="show-grid" checked>
          <label for="show-grid">显示网格</label>
        </div>
        <div class="checkbox-item">
          <input type="checkbox" id="show-congestion" checked>
          <label for="show-congestion">显示拥堵点</label>
        </div>
        <div class="checkbox-item">
          <input type="checkbox" id="show-issues" checked>
          <label for="show-issues">显示问题标记</label>
        </div>
      </div>

      <div class="section">
        <div class="section-title">热力图参数</div>
        <div class="slider-container">
          <label>
            <span>透明度</span>
            <span id="heatmap-opacity-value">60%</span>
          </label>
          <input type="range" id="heatmap-opacity" min="0" max="100" value="60">
        </div>
        <div class="slider-container">
          <label>
            <span>影响半径</span>
            <span id="heatmap-radius-value">2.5m</span>
          </label>
          <input type="range" id="heatmap-radius" min="1" max="5" step="0.1" value="2.5">
        </div>
      </div>

      <div class="section">
        <div class="section-title">作品热度</div>
        <div id="artwork-list" class="artwork-list"></div>
      </div>

      <div class="section">
        <div class="section-title">入口批次</div>
        <div id="batch-list"></div>
      </div>

      <div class="section">
        <div class="section-title">问题记录</div>
        <div id="issues-list"></div>
      </div>
    `;

    this.setupSidebarEventListeners();
  }

  setupSidebarEventListeners() {
    document.querySelectorAll('.view-btn[data-view]').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.view-btn[data-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.app.setViewMode(btn.dataset.view);
      };
    });

    document.querySelectorAll('.view-btn[data-visual]').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.view-btn[data-visual]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.app.setVisualMode(btn.dataset.visual);
      };
    });

    document.querySelectorAll('.floor-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.floor-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.app.setActiveFloor(btn.dataset.floor === 'all' ? null : parseInt(btn.dataset.floor));
      };
    });

    document.getElementById('show-labels').onchange = (e) => {
      this.app.setLabelsVisible(e.target.checked);
    };

    document.getElementById('show-grid').onchange = (e) => {
      this.app.setGridVisible(e.target.checked);
    };

    document.getElementById('show-congestion').onchange = (e) => {
      this.app.setCongestionVisible(e.target.checked);
    };

    document.getElementById('show-issues').onchange = (e) => {
      this.app.setIssuesVisible(e.target.checked);
    };

    document.getElementById('heatmap-opacity').oninput = (e) => {
      const value = e.target.value / 100;
      document.getElementById('heatmap-opacity-value').textContent = `${e.target.value}%`;
      this.app.setHeatmapOpacity(value);
    };

    document.getElementById('heatmap-radius').oninput = (e) => {
      document.getElementById('heatmap-radius-value').textContent = `${e.target.value}m`;
      this.app.setHeatmapRadius(parseFloat(e.target.value));
    };
  }

  renderTimeline() {
    const container = document.getElementById('timeline');
    container.innerHTML = `
      <div class="timeline-controls">
        <button class="play-btn" id="play-btn">▶</button>
        <button class="btn small" id="stop-btn" style="width: 36px;">⏹</button>
        <div class="time-display" id="time-display">00:00 / 00:00</div>
        <input type="range" class="timeline-slider" id="timeline-slider" min="0" max="100" value="0" step="0.1">
        <div class="time-display" id="speed-display">1x</div>
        <button class="btn small" id="speed-down">−</button>
        <button class="btn small" id="speed-up">+</button>
        <button class="btn small" id="btn-reset" title="重置">↺</button>
      </div>
      <div class="batch-indicator" id="batch-indicator"></div>
    `;

    document.getElementById('play-btn').onclick = () => {
      const isPlaying = this.app.animationController.toggle();
      document.getElementById('play-btn').textContent = isPlaying ? '⏸' : '▶';
    };

    document.getElementById('stop-btn').onclick = () => {
      this.app.animationController.stop();
      document.getElementById('play-btn').textContent = '▶';
      this.updateTimelineDisplay();
    };

    document.getElementById('timeline-slider').oninput = (e) => {
      const time = parseFloat(e.target.value);
      this.app.animationController.seek(time);
      this.updateTimelineDisplay();
    };

    document.getElementById('speed-down').onclick = () => {
      const newSpeed = Math.max(0.1, this.app.animationController.speed - 0.25);
      this.app.animationController.setSpeed(newSpeed);
      document.getElementById('speed-display').textContent = `${newSpeed.toFixed(1)}x`;
    };

    document.getElementById('speed-up').onclick = () => {
      const newSpeed = Math.min(10, this.app.animationController.speed + 0.25);
      this.app.animationController.setSpeed(newSpeed);
      document.getElementById('speed-display').textContent = `${newSpeed.toFixed(1)}x`;
    };

    document.getElementById('btn-reset').onclick = () => {
      this.app.animationController.seek(0);
      document.getElementById('timeline-slider').value = 0;
      this.updateTimelineDisplay();
    };

    this.app.animationController.onUpdate = (current, duration) => {
      document.getElementById('timeline-slider').value = current;
      this.updateTimelineDisplay();
    };

    this.app.animationController.onComplete = () => {
      document.getElementById('play-btn').textContent = '▶';
    };
  }

  updateTimelineDisplay() {
    const current = this.app.animationController.currentTime;
    const duration = this.app.animationController.duration;
    document.getElementById('time-display').textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    document.getElementById('timeline-slider').max = duration;
  }

  renderHeatmapLegend() {
    const container = document.createElement('div');
    container.className = 'heatmap-legend';
    container.innerHTML = `
      <span class="legend-label">低</span>
      <div class="legend-gradient"></div>
      <span class="legend-label">高</span>
    `;
    document.getElementById('canvas-container').appendChild(container);
  }

  updateRecordDisplay() {
    const record = this.dataManager.getCurrentRecord();
    const container = document.getElementById('current-record-info');

    if (!record) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <div>暂无数据，请导入观展记录</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="stat-card">
        <div class="label">记录名称</div>
        <div class="value small">${record.name}</div>
      </div>
      <div class="stat-card">
        <div class="label">更新时间</div>
        <div class="value small">${formatDateTime(record.updatedAt)}</div>
      </div>
      <div class="stat-card">
        <div class="label">来源文件</div>
        <div class="value small" style="font-size: 11px; color: #888;">${record.fileName || '-'}</div>
      </div>
      ${record.parentRecordId ? `
        <div class="stat-card">
          <div class="label" style="color: #fbbf24;">📎 基于记录</div>
          <div class="value small" style="font-size: 11px;">${this.dataManager.getRecord(record.parentRecordId)?.name || '已删除'}</div>
        </div>
      ` : ''}
      <div class="btn-group">
        <button class="btn small" id="btn-rename-record">重命名</button>
        <button class="btn small" id="btn-duplicate-record">复制</button>
      </div>
    `;

    document.getElementById('btn-rename-record').onclick = () => this.renameRecord(record);
    document.getElementById('btn-duplicate-record').onclick = () => this.duplicateRecord(record);

    this.updateStats();
    this.updateArtworkList();
    this.updateBatchList();
    this.updateIssuesList();
    this.updateTimelineDisplay();
  }

  updateStats() {
    const record = this.dataManager.getCurrentRecord();
    const container = document.getElementById('stats-overview');

    if (!record) {
      container.innerHTML = '';
      return;
    }

    const stats = record.statistics;
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <div class="stat-card">
          <div class="label">访客总数</div>
          <div class="value">${stats.totalVisitors}</div>
        </div>
        <div class="stat-card">
          <div class="label">独立访客</div>
          <div class="value">${stats.uniqueVisitors}</div>
        </div>
        <div class="stat-card">
          <div class="label">平均停留</div>
          <div class="value small">${formatDuration(stats.avgDuration)}</div>
        </div>
        <div class="stat-card">
          <div class="label">平均观看作品</div>
          <div class="value">${stats.avgArtworksPerVisitor.toFixed(1)}</div>
        </div>
        <div class="stat-card">
          <div class="label">拥堵点</div>
          <div class="value" style="color: ${record.congestionPoints.length > 3 ? '#ef4444' : '#fbbf24'};">${record.congestionPoints.length}</div>
        </div>
        <div class="stat-card">
          <div class="label">问题记录</div>
          <div class="value" style="color: #fbbf24;">${stats.issues.duplicates + stats.issues.occlusions + stats.issues.biases}</div>
        </div>
      </div>
    `;
  }

  updateArtworkList() {
    const record = this.dataManager.getCurrentRecord();
    const container = document.getElementById('artwork-list');

    if (!record) {
      container.innerHTML = '';
      return;
    }

    const artworks = record.statistics.artworks.slice(0, 10);
    const maxHeat = Math.max(...artworks.map(a => a.heatValue), 1);

    container.innerHTML = artworks.map((artwork, index) => {
      const heatPercent = (artwork.heatValue / maxHeat * 100).toFixed(0);
      const rgb = this.getHeatColorRGB(artwork.heatValue / maxHeat);
      return `
        <div class="artwork-item ${this.app.highlightedArtworks?.includes(artwork.id) ? 'highlighted' : ''}" data-artwork="${artwork.id}">
          <div class="artwork-color" style="background: rgb(${rgb.join(',')});"></div>
          <div class="artwork-info">
            <div class="artwork-name">${index + 1}. ${artwork.name}</div>
            <div class="artwork-stats">
              ${artwork.totalVisitors}人 · ${formatDuration(artwork.avgStayDuration)} · 热度 ${heatPercent}%
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.artwork-item').forEach(item => {
      item.onclick = () => {
        const artworkId = item.dataset.artwork;
        this.app.toggleArtworkHighlight(artworkId);
        item.classList.toggle('highlighted');
      };
    });
  }

  updateBatchList() {
    const record = this.dataManager.getCurrentRecord();
    const container = document.getElementById('batch-list');

    if (!record) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = record.batches.map(batch => `
      <div class="checkbox-item">
        <input type="checkbox" id="batch-${batch.id}" 
               ${!record.filters.selectedBatches.length || record.filters.selectedBatches.includes(batch.id) ? 'checked' : ''}>
        <label for="batch-${batch.id}" style="display: flex; align-items: center; gap: 8px; flex: 1;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: #${batch.color.toString(16).padStart(6, '0')};"></span>
          <span>${batch.name}</span>
          <span style="color: #888; margin-left: auto;">${batch.visitorCount}人</span>
        </label>
      </div>
    `).join('');

    record.batches.forEach(batch => {
      const checkbox = document.getElementById(`batch-${batch.id}`);
      checkbox.onchange = (e) => {
        this.app.toggleBatchFilter(batch.id, e.target.checked);
      };
    });
  }

  updateIssuesList() {
    const record = this.dataManager.getCurrentRecord();
    const container = document.getElementById('issues-list');

    if (!record) {
      container.innerHTML = '';
      return;
    }

    const { duplicates, occlusions, biases } = record.issues;
    const totalIssues = duplicates.length + occlusions.length + biases.length;

    if (totalIssues === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #22c55e; font-size: 12px;">
          ✅ 未检测到数据质量问题
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="stat-card" style="cursor: pointer;" id="issues-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div class="label">数据质量问题</div>
            <div class="value small" style="color: #fbbf24;">${totalIssues} 项待处理</div>
          </div>
          <span style="font-size: 20px;">⚠️</span>
        </div>
        <div style="margin-top: 8px; display: flex; flex-direction: column; gap: 4px;">
          ${duplicates.length > 0 ? `
            <div style="display: flex; align-items: center; gap: 6px; font-size: 11px;">
              <span class="issue-badge duplicate">重复</span>
              <span>${duplicates.length} 条重复访客记录</span>
            </div>
          ` : ''}
          ${occlusions.length > 0 ? `
            <div style="display: flex; align-items: center; gap: 6px; font-size: 11px;">
              <span class="issue-badge occlusion">遮挡</span>
              <span>${occlusions.length} 条楼层遮挡记录</span>
            </div>
          ` : ''}
          ${biases.length > 0 ? `
            <div style="display: flex; align-items: center; gap: 6px; font-size: 11px;">
              <span class="issue-badge bias">偏差</span>
              <span>${biases.length} 条入口热度偏差</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    document.getElementById('issues-card').onclick = () => this.showIssuesModal(record);
  }

  showImportModal() {
    const modal = this.createModal({
      title: '导入观展数据',
      width: '600px',
      body: `
        <div id="drop-zone" class="drop-zone">
          <div class="drop-icon">📁</div>
          <div class="drop-text">拖拽 JSON 文件到此处，或点击选择文件</div>
          <div style="font-size: 11px; color: #666; margin-top: 8px;">
            支持格式: <code>.json</code> | 需要包含 artworks 和 visitors 数组
          </div>
          <input type="file" id="file-input" accept=".json" multiple style="display: none;">
        </div>
        
        <div class="section" style="margin-top: 20px;">
          <div class="section-title">追加到现有记录</div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <select id="append-to-record" style="flex: 1;">
              <option value="">不追加（创建新记录）</option>
              ${this.dataManager.getAllRecords().map(r => 
                `<option value="${r.id}">${r.name}</option>`
              ).join('')}
            </select>
          </div>
          <div style="font-size: 11px; color: #666; margin-top: 4px;">
            选择现有记录将把新数据追加到同一条记录中
          </div>
        </div>

        <div id="import-preview" style="margin-top: 20px; display: none;">
          <div class="section-title">导入预览</div>
          <div id="import-results"></div>
        </div>
      `,
      footer: `
        <button class="btn" id="btn-cancel-import">取消</button>
        <button class="btn primary" id="btn-confirm-import" disabled>确认导入</button>
      `
    });

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const appendSelect = document.getElementById('append-to-record');

    dropZone.onclick = () => fileInput.click();

    dropZone.ondragover = (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    };

    dropZone.ondragleave = () => {
      dropZone.classList.remove('dragover');
    };

    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      this.handleFilesSelected(e.dataTransfer.files, appendSelect.value);
    };

    fileInput.onchange = (e) => {
      this.handleFilesSelected(e.target.files, appendSelect.value);
    };

    document.getElementById('btn-cancel-import').onclick = () => this.closeModal(modal);
    document.getElementById('btn-confirm-import').onclick = () => {
      this.closeModal(modal);
      this.showToast('导入成功！', 'success');
      this.updateRecordDisplay();
      this.app.loadCurrentRecord();
    };
  }

  async handleFilesSelected(files, appendToRecordId) {
    const previewContainer = document.getElementById('import-preview');
    const resultsContainer = document.getElementById('import-results');
    const confirmBtn = document.getElementById('btn-confirm-import');

    previewContainer.style.display = 'block';
    resultsContainer.innerHTML = '<div style="text-align: center; padding: 20px;">正在分析文件...</div>';

    try {
      const results = await this.dataManager.importFiles(
        Array.from(files),
        (conflicts) => this.showConflictModal(conflicts)
      );

      if (appendToRecordId) {
        for (const item of results.success) {
          this.dataManager.createRecordFromExisting(appendToRecordId, item.data, item.file);
        }
      }

      let html = '';
      
      if (results.success.length > 0) {
        html += `
          <div style="color: #22c55e; margin-bottom: 8px;">
            ✅ 成功导入 ${results.success.length} 个文件
          </div>
          ${results.success.map(r => `
            <div class="conflict-item" style="margin-bottom: 4px;">
              <div class="file-name">${r.file}</div>
            </div>
          `).join('')}
        `;
      }

      if (results.errors.length > 0) {
        html += `
          <div style="color: #ef4444; margin: 12px 0 8px;">
            ❌ 导入失败 ${results.errors.length} 个文件
          </div>
          ${results.errors.map(r => `
            <div class="conflict-item" style="margin-bottom: 4px; border-left: 3px solid #ef4444;">
              <div class="file-name">${r.file}</div>
              <div style="font-size: 11px; color: #f87171;">${r.error}</div>
            </div>
          `).join('')}
        `;
      }

      if (results.skipped.length > 0) {
        html += `
          <div style="color: #fbbf24; margin: 12px 0 8px;">
            ⚠️ 跳过 ${results.skipped.length} 个文件
          </div>
          ${results.skipped.map(r => `
            <div class="conflict-item" style="margin-bottom: 4px; border-left: 3px solid #fbbf24;">
              <div class="file-name">${r.file}</div>
              <div style="font-size: 11px; color: #fbbf24;">${r.reason}</div>
            </div>
          `).join('')}
        `;
      }

      resultsContainer.innerHTML = html;
      confirmBtn.disabled = results.success.length === 0;

    } catch (e) {
      resultsContainer.innerHTML = `<div style="color: #ef4444;">导入出错: ${e.message}</div>`;
    }
  }

  showConflictModal(conflicts) {
    return new Promise((resolve) => {
      const conflictActions = conflicts.map(c => ({ ...c, action: CONFLICT_ACTIONS.SKIP }));

      const modal = this.createModal({
        title: '检测到重复文件',
        width: '600px',
        body: `
          <div style="margin-bottom: 12px; font-size: 13px; color: #aaa;">
            以下文件之前已导入过，请选择处理方式：
          </div>
          <div class="conflict-list">
            ${conflictActions.map((conflict, index) => `
              <div class="conflict-item">
                <div class="file-name">${conflict.file}</div>
                <div class="conflict-reason">
                  ${conflict.reason}<br>
                  <span style="color: #888;">已存在: ${conflict.existingRecordName} · ${formatDateTime(conflict.importedAt)}</span>
                </div>
                <div class="conflict-actions">
                  <button data-action="${CONFLICT_ACTIONS.SKIP}" data-index="${index}" class="active">跳过</button>
                  <button data-action="${CONFLICT_ACTIONS.OVERWRITE}" data-index="${index}">覆盖</button>
                  <button data-action="${CONFLICT_ACTIONS.APPEND}" data-index="${index}">追加</button>
                </div>
              </div>
            `).join('')}
          </div>
          <div style="display: flex; gap: 8px; margin-top: 12px;">
            <button class="btn" data-action-all="${CONFLICT_ACTIONS.SKIP}">全部跳过</button>
            <button class="btn" data-action-all="${CONFLICT_ACTIONS.OVERWRITE}">全部覆盖</button>
            <button class="btn" data-action-all="${CONFLICT_ACTIONS.APPEND}">全部追加</button>
          </div>
        `,
        footer: `
          <button class="btn" id="btn-cancel-conflict">取消导入</button>
          <button class="btn primary" id="btn-confirm-conflict">确认处理</button>
        `
      });

      const updateActionButtons = (index, action) => {
        conflictActions[index].action = action;
        const buttons = modal.querySelectorAll(`.conflict-actions button[data-index="${index}"]`);
        buttons.forEach(btn => btn.classList.remove('active'));
        modal.querySelector(`.conflict-actions button[data-action="${action}"][data-index="${index}"]`).classList.add('active');
      };

      modal.querySelectorAll('.conflict-actions button').forEach(btn => {
        btn.onclick = () => updateActionButtons(parseInt(btn.dataset.index), btn.dataset.action);
      });

      modal.querySelectorAll('[data-action-all]').forEach(btn => {
        btn.onclick = () => {
          conflictActions.forEach((_, index) => updateActionButtons(index, btn.dataset.actionAll));
        };
      });

      document.getElementById('btn-cancel-conflict').onclick = () => {
        this.closeModal(modal);
        resolve(conflicts.map(c => ({ ...c, action: CONFLICT_ACTIONS.SKIP })));
      };

      document.getElementById('btn-confirm-conflict').onclick = () => {
        this.closeModal(modal);
        resolve(conflictActions);
      };
    });
  }

  showRecordsModal() {
    const records = this.dataManager.getAllRecords();
    const currentRecord = this.dataManager.getCurrentRecord();

    const modal = this.createModal({
      title: '记录管理',
      width: '700px',
      body: `
        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
          <input type="text" id="record-search" placeholder="搜索记录..." style="flex: 1;">
          <button class="btn small primary" id="btn-new-record">+ 新建记录</button>
        </div>
        
        <div class="record-list" id="record-list">
          ${records.length === 0 ? `
            <div class="empty-state">
              <div class="empty-icon">📋</div>
              <div>暂无记录，点击"导入数据"开始</div>
            </div>
          ` : records.map(record => `
            <div class="record-item ${record.id === currentRecord?.id ? 'active' : ''}" data-id="${record.id}">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="flex: 1;">
                  <div class="record-name">${record.name}</div>
                  <div class="record-meta">
                    ${record.statistics.totalVisitors} 访客 · ${record.statistics.totalArtworks} 作品 · ${formatDateTime(record.updatedAt)}
                    ${record.parentRecordId ? ' · 📎 派生记录' : ''}
                  </div>
                </div>
                <div style="display: flex; gap: 4px; margin-left: 12px;">
                  <button class="btn small" data-action="load" data-id="${record.id}">加载</button>
                  <button class="btn small" data-action="export" data-id="${record.id}">导出</button>
                  <button class="btn small" data-action="delete" data-id="${record.id}" style="color: #f87171;">删除</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `
    });

    modal.querySelectorAll('[data-action]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const id = btn.dataset.id;

        if (action === 'load') {
          this.dataManager.setCurrentRecord(id);
          this.closeModal(modal);
          this.updateRecordDisplay();
          this.app.loadCurrentRecord();
          this.showToast('记录已加载', 'success');
        } else if (action === 'export') {
          const data = this.dataManager.exportRecord(id, 'json');
          const record = this.dataManager.getRecord(id);
          downloadFile(data, `${record.name}.json`, 'application/json');
          this.showToast('记录已导出', 'success');
        } else if (action === 'delete') {
          if (confirm('确定要删除这条记录吗？此操作不可撤销。')) {
            this.dataManager.deleteRecord(id);
            this.closeModal(modal);
            this.showRecordsModal();
            this.updateRecordDisplay();
            this.showToast('记录已删除', 'info');
          }
        }
      };
    });

    modal.querySelectorAll('.record-item').forEach(item => {
      item.onclick = () => {
        const id = item.dataset.id;
        this.dataManager.setCurrentRecord(id);
        this.closeModal(modal);
        this.updateRecordDisplay();
        this.app.loadCurrentRecord();
      };
    });

    document.getElementById('btn-new-record').onclick = () => {
      this.closeModal(modal);
      this.showImportModal();
    };

    document.getElementById('record-search').oninput = (e) => {
      const query = e.target.value.toLowerCase();
      modal.querySelectorAll('.record-item').forEach(item => {
        const name = item.querySelector('.record-name').textContent.toLowerCase();
        item.style.display = name.includes(query) ? '' : 'none';
      });
    };
  }

  showExportModal() {
    const record = this.dataManager.getCurrentRecord();
    if (!record) {
      this.showToast('请先加载一条记录', 'warning');
      return;
    }

    const modal = this.createModal({
      title: '导出分析报告',
      width: '500px',
      body: `
        <div class="form-group">
          <label>报告名称</label>
          <input type="text" id="export-name" value="${record.name} - 分析报告">
        </div>

        <div class="form-group">
          <label>导出格式</label>
          <div style="display: flex; gap: 8px;">
            <label class="checkbox-item" style="flex: 1;">
              <input type="radio" name="export-format" value="${EXPORT_FORMATS.HTML}" checked>
              <span>HTML 网页报告</span>
            </label>
            <label class="checkbox-item" style="flex: 1;">
              <input type="radio" name="export-format" value="${EXPORT_FORMATS.JSON}">
              <span>JSON 数据</span>
            </label>
            <label class="checkbox-item" style="flex: 1;">
              <input type="radio" name="export-format" value="${EXPORT_FORMATS.CSV}">
              <span>CSV 表格</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>包含内容</label>
          <div class="checkbox-item">
            <input type="checkbox" id="include-visitors" checked>
            <label for="include-visitors">访客动线数据</label>
          </div>
          <div class="checkbox-item">
            <input type="checkbox" id="include-artworks" checked>
            <label for="include-artworks">作品热度数据</label>
          </div>
          <div class="checkbox-item">
            <input type="checkbox" id="include-heatmap" checked>
            <label for="include-heatmap">热力图数据</label>
          </div>
          <div class="checkbox-item">
            <input type="checkbox" id="include-issues" checked>
            <label for="include-issues">数据质量问题</label>
          </div>
          <div class="checkbox-item">
            <input type="checkbox" id="include-congestion" checked>
            <label for="include-congestion">拥堵点分析</label>
          </div>
        </div>
      `,
      footer: `
        <button class="btn" id="btn-cancel-export">取消</button>
        <button class="btn primary" id="btn-confirm-export">导出</button>
      `
    });

    document.getElementById('btn-cancel-export').onclick = () => this.closeModal(modal);
    document.getElementById('btn-confirm-export').onclick = () => {
      const format = document.querySelector('input[name="export-format"]:checked').value;
      const options = {
        includeVisitors: document.getElementById('include-visitors').checked,
        includeArtworks: document.getElementById('include-artworks').checked,
        includeHeatmap: document.getElementById('include-heatmap').checked,
        includeIssues: document.getElementById('include-issues').checked,
        includeCongestion: document.getElementById('include-congestion').checked
      };

      const name = document.getElementById('export-name').value;
      this.app.exportReport(format, name, options);
      this.closeModal(modal);
      this.showToast('报告已导出', 'success');
    };
  }

  showSettingsModal() {
    const settings = this.dataManager.settings;

    const modal = this.createModal({
      title: '设置',
      width: '500px',
      body: `
        <div class="form-group">
          <label>动画播放速度 (默认)</label>
          <input type="number" id="setting-speed" value="${settings.animationSpeed}" step="0.1" min="0.1" max="10">
        </div>

        <div class="form-group">
          <label>热力图默认透明度</label>
          <input type="range" id="setting-opacity" min="0" max="100" value="${settings.heatmapOpacity * 100}">
        </div>

        <div class="form-group">
          <label>默认视图模式</label>
          <select id="setting-viewmode">
            <option value="${VIEW_MODES.PERSPECTIVE}" ${settings.viewMode === VIEW_MODES.PERSPECTIVE ? 'selected' : ''}>透视视图</option>
            <option value="${VIEW_MODES.TOP}" ${settings.viewMode === VIEW_MODES.TOP ? 'selected' : ''}>俯视视图</option>
            <option value="${VIEW_MODES.FRONT}" ${settings.viewMode === VIEW_MODES.FRONT ? 'selected' : ''}>正视视图</option>
            <option value="${VIEW_MODES.ORBIT}" ${settings.viewMode === VIEW_MODES.ORBIT ? 'selected' : ''}>自由视图</option>
          </select>
        </div>

        <div class="section" style="margin-top: 24px;">
          <div class="section-title">数据管理</div>
          <div class="btn-group">
            <button class="btn small" id="btn-clear-storage" style="color: #f87171;">清除所有本地数据</button>
            <button class="btn small" id="btn-export-all">导出全部数据</button>
          </div>
        </div>
      `,
      footer: `
        <button class="btn" id="btn-cancel-settings">取消</button>
        <button class="btn primary" id="btn-save-settings">保存</button>
      `
    });

    document.getElementById('btn-clear-storage').onclick = () => {
      if (confirm('确定要清除所有本地存储的数据吗？此操作不可撤销。')) {
        localStorage.clear();
        location.reload();
      }
    };

    document.getElementById('btn-export-all').onclick = () => {
      const allData = {
        records: this.dataManager.records,
        settings: this.dataManager.settings,
        exportedAt: Date.now()
      };
      downloadFile(JSON.stringify(allData, null, 2), `gallery-backup-${Date.now()}.json`);
      this.showToast('全部数据已导出', 'success');
    };

    document.getElementById('btn-cancel-settings').onclick = () => this.closeModal(modal);
    document.getElementById('btn-save-settings').onclick = () => {
      this.dataManager.updateSettings({
        animationSpeed: parseFloat(document.getElementById('setting-speed').value),
        heatmapOpacity: parseInt(document.getElementById('setting-opacity').value) / 100,
        viewMode: document.getElementById('setting-viewmode').value
      });
      this.closeModal(modal);
      this.showToast('设置已保存', 'success');
    };
  }

  showIssuesModal(record) {
    const { duplicates, occlusions, biases } = record.issues;

    const modal = this.createModal({
      title: '数据质量问题分析',
      width: '800px',
      body: `
        <div style="margin-bottom: 16px; padding: 12px; background: rgba(251, 191, 36, 0.1); border-radius: 8px; border-left: 3px solid #fbbf24;">
          <div style="font-weight: 500; margin-bottom: 4px;">⚡ 关于这些问题</div>
          <div style="font-size: 12px; color: #aaa;">
            系统自动检测了三类常见的数据质量问题。点击问题条目可在3D视图中定位相关位置。
            这些问题已在统计中剔除或标记，不影响主要分析结果。
          </div>
        </div>

        <div class="report-section">
          <h3>🔄 重复访客记录 (${duplicates.length})</h3>
          <p style="font-size: 12px; color: #888; margin-bottom: 8px;">
            同一设备在短时间内多次进入，可能是WiFi探针重复计数。
          </p>
          ${duplicates.length === 0 ? '<div style="color: #22c55e; font-size: 12px;">未检测到</div>' : `
            <table class="report-table">
              <thead><tr><th>访客ID</th><th>设备标识</th><th>与上一次间隔</th><th>操作</th></tr></thead>
              <tbody>
                ${duplicates.map(d => `
                  <tr>
                    <td><code>${d.visitorId.slice(0, 8)}...</code></td>
                    <td><code>${d.deviceId.slice(0, 12)}...</code></td>
                    <td>${Math.round(d.timeDiff / 60000)} 分钟</td>
                    <td><button class="btn small" data-locate-duplicate="${d.visitorId}">定位</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>

        <div class="report-section">
          <h3>🏢 楼层遮挡记录 (${occlusions.length})</h3>
          <p style="font-size: 12px; color: #888; margin-bottom: 8px;">
            跨楼层时信号不稳定，可能导致定位点跳变。已做平滑处理。
          </p>
          ${occlusions.length === 0 ? '<div style="color: #22c55e; font-size: 12px;">未检测到</div>' : `
            <table class="report-table">
              <thead><tr><th>访客ID</th><th>楼层切换</th><th>遮挡时长</th><th>操作</th></tr></thead>
              <tbody>
                ${occlusions.slice(0, 10).map(o => `
                  <tr>
                    <td><code>${o.visitorId.slice(0, 8)}...</code></td>
                    <td>${o.fromFloor}层 → ${o.toFloor}层</td>
                    <td>${o.duration.toFixed(1)}秒</td>
                    <td><button class="btn small" data-locate-occlusion="${o.visitorId}">定位</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${occlusions.length > 10 ? `<div style="font-size: 11px; color: #666; margin-top: 4px;">仅显示前10条</div>` : ''}
          `}
        </div>

        <div class="report-section">
          <h3>🚪 入口热度偏差 (${biases.length})</h3>
          <p style="font-size: 12px; color: #888; margin-bottom: 8px;">
            入口附近作品热度可能被人流带偏，已在报告中单独标注。
          </p>
          ${biases.length === 0 ? '<div style="color: #22c55e; font-size: 12px;">未检测到</div>' : `
            <table class="report-table">
              <thead><tr><th>作品</th><th>访客ID</th><th>入口到达时间</th><th>距入口距离</th><th>操作</th></tr></thead>
              <tbody>
                ${biases.slice(0, 10).map(b => `
                  <tr>
                    <td>${b.artworkId}</td>
                    <td><code>${b.visitorId.slice(0, 8)}...</code></td>
                    <td>${b.timeFromEntrance.toFixed(1)}秒</td>
                    <td>${b.distToEntrance}m</td>
                    <td><button class="btn small" data-locate-bias="${b.artworkId}">定位</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${biases.length > 10 ? `<div style="font-size: 11px; color: #666; margin-top: 4px;">仅显示前10条</div>` : ''}
          `}
        </div>
      `
    });

    modal.querySelectorAll('[data-locate-duplicate]').forEach(btn => {
      btn.onclick = () => {
        const visitorId = btn.dataset.locateDuplicate;
        this.app.focusVisitor(visitorId);
      };
    });

    modal.querySelectorAll('[data-locate-occlusion]').forEach(btn => {
      btn.onclick = () => {
        const visitorId = btn.dataset.locateOcclusion;
        this.app.focusVisitor(visitorId);
      };
    });

    modal.querySelectorAll('[data-locate-bias]').forEach(btn => {
      btn.onclick = () => {
        const artworkId = btn.dataset.locateBias;
        this.app.focusArtwork(artworkId);
        this.closeModal(modal);
      };
    });
  }

  renameRecord(record) {
    const newName = prompt('请输入新的记录名称：', record.name);
    if (newName && newName.trim()) {
      this.dataManager.updateRecord(record.id, { name: newName.trim() });
      this.updateRecordDisplay();
      this.showToast('记录已重命名', 'success');
    }
  }

  duplicateRecord(record) {
    const newRecord = {
      ...record,
      id: this.dataManager.generateId ? this.dataManager.generateId() : Date.now().toString(36),
      name: `${record.name} (副本)`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.dataManager.records.push(newRecord);
    this.dataManager.saveToStorage();
    this.updateRecordDisplay();
    this.showToast('记录已复制', 'success');
  }

  createModal({ title, body, footer, width = '480px' }) {
    const container = document.getElementById('modal-container');
    container.classList.add('active');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="min-width: ${width};">
        <div class="modal-header">
          <div class="modal-title">${title}</div>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    `;

    modal.querySelector('.modal-close').onclick = () => this.closeModal(modal);
    modal.onclick = (e) => {
      if (e.target === modal) this.closeModal(modal);
    };

    container.appendChild(modal);
    this.modals.push(modal);

    return modal;
  }

  closeModal(modal) {
    if (modal && modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }
    this.modals = this.modals.filter(m => m !== modal);
    
    if (this.modals.length === 0) {
      document.getElementById('modal-container').classList.remove('active');
    }
  }

  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastIn 0.3s reverse';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
  }

  getHeatColorRGB(value) {
    if (value < 0.33) {
      return [34, 197, 94];
    } else if (value < 0.66) {
      return [234, 179, 8];
    } else {
      return [239, 68, 68];
    }
  }
}
