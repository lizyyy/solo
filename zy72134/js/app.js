// ========== 主应用 ==========
const App = {
  state: {
    records: [],
    failedItems: [],
    selectedRecordId: null,
    currentFilter: 'all',
    searchKeyword: '',
    operator: '小李'
  },

  // 初始化
  init() {
    this.loadFromStorage();
    this.bindEvents();
    this.renderAll();
    
    // 如果没有数据，自动载入样例
    if (this.state.records.length === 0) {
      // 不自动载入，等用户点按钮
    } else {
      this.showToast(`已加载 ${this.state.records.length} 条历史记录`, 'info');
    }
  },

  // 从本地存储加载
  loadFromStorage() {
    const data = window.Storage.loadAll();
    if (data.loaded) {
      this.state.records = data.records || [];
      this.state.failedItems = data.failedItems || [];
    }
  },

  // 保存到本地存储
  saveToStorage() {
    window.Storage.saveAll(this.state.records, this.state.failedItems);
  },

  // 绑定事件
  bindEvents() {
    // 处理人输入
    document.getElementById('operatorName').addEventListener('input', (e) => {
      this.state.operator = e.target.value || '当前处理人';
    });

    // 载入样例数据按钮
    document.getElementById('loadSampleBtn').addEventListener('click', () => {
      this.loadSampleData();
    });

    // 跑一遍样例按钮
    document.getElementById('runSampleBtn').addEventListener('click', () => {
      this.runSampleImport();
    });

    // 清空数据按钮
    document.getElementById('clearBtn').addEventListener('click', () => {
      if (confirm('确定要清空所有数据吗？这个操作不可撤销。')) {
        window.Storage.clearAll();
        this.state.records = [];
        this.state.failedItems = [];
        this.state.selectedRecordId = null;
        this.renderAll();
        this.showToast('已清空所有数据', 'success');
      }
    });

    // 导出按钮
    document.getElementById('exportBtn').addEventListener('click', () => {
      this.exportData();
    });

    // 文件选择
    document.getElementById('browseBtn').addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', (e) => {
      this.handleFileSelect(e.target.files);
    });

    // 拖放
    const dropzone = document.getElementById('dropzone');
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('drag-over');
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      this.handleFileSelect(e.dataTransfer.files);
    });

    // 筛选按钮
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.state.currentFilter = e.target.dataset.filter;
        this.renderTrackList();
      });
    });

    // 搜索框
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.state.searchKeyword = e.target.value.toLowerCase();
      this.renderTrackList();
    });

    // 报告模态框
    document.getElementById('closeReport').addEventListener('click', () => {
      this.closeReportModal();
    });
    document.getElementById('closeReportBtn').addEventListener('click', () => {
      this.closeReportModal();
    });
    document.getElementById('copyReport').addEventListener('click', () => {
      this.copyReport();
    });
    document.getElementById('reportModal').addEventListener('click', (e) => {
      if (e.target.id === 'reportModal') {
        this.closeReportModal();
      }
    });
  },

  // 载入样例数据（直接导入，不经过导入流程）
  loadSampleData() {
    const samples = window.SampleData.getAllRecords();
    const corrupt = window.SampleData.corruptRawData;
    
    this.state.records = samples;
    this.state.failedItems = [{
      index: 10,
      fileName: corrupt.fileName,
      error: '文件损坏，读不了音频元数据',
      raw: corrupt
    }];
    this.state.selectedRecordId = null;
    
    this.saveToStorage();
    this.renderAll();
    this.showToast(`已载入 ${samples.length} 条样例记录 + 1 条失败记录`, 'success');
  },

  // 跑一遍样例导入（模拟真实导入流程）
  async runSampleImport() {
    const samples = window.SampleData.getAllRecords();
    const corrupt = window.SampleData.corruptRawData;
    
    // 把完整记录转成"原始数据"格式
    const rawItems = samples.map(r => ({
      fileName: r.fileName,
      trackName: r.trackName,
      artist: r.artist,
      durationMinutes: r.durationMinutes,
      roomNumber: r.roomNumber,
      bookingDate: r.bookingDate,
      bookingTime: r.bookingTime,
      depositAmount: r.depositAmount,
      licenseStatus: r.licenseStatus,
      isOldMaster: r.isOldMaster,
      isRenamed: r.isRenamed,
      source: r.source,
      sourceNote: r.sourceNote,
      annotations: r.annotations,
      processingNotes: r.processingNotes,
      status: r.status
    }));
    
    // 混入坏文件
    rawItems.push(corrupt);
    
    await this.importRawData(rawItems);
  },

  // 导入原始数据
  async importRawData(rawItems) {
    // 显示进度
    const progressEl = document.getElementById('importProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    progressEl.classList.remove('hidden');
    progressFill.style.width = '0%';
    progressText.textContent = `准备导入 ${rawItems.length} 条...`;

    try {
      const results = await window.CoreLogic.BatchImportEngine.importBatch(rawItems, {
        keepRaw: true
      });

      // 更新进度到100%
      progressFill.style.width = '100%';
      progressText.textContent = `完成：成功 ${results.success.length} 条，失败 ${results.failed.length} 条`;

      // 合并到现有数据
      this.state.records = [...this.state.records, ...results.success];
      this.state.failedItems = [...this.state.failedItems, ...results.failed];
      
      this.saveToStorage();
      this.renderAll();

      // 显示结果
      if (results.failed.length > 0) {
        this.showToast(`导入完成：${results.success.length} 条成功，${results.failed.length} 条失败`, 'warning');
      } else {
        this.showToast(`导入完成：${results.success.length} 条全部成功`, 'success');
      }

      // 自动选中第一条待处理的
      const firstPending = this.state.records.find(r => 
        r.status === window.DataModels.STATUS.PENDING || 
        r.status === window.DataModels.STATUS.NEEDS_REVIEW
      );
      if (firstPending) {
        this.selectRecord(firstPending.id);
      }

    } catch (error) {
      console.error('导入出错:', error);
      this.showToast('导入过程出错：' + error.message, 'error');
    }

    // 2秒后隐藏进度
    setTimeout(() => {
      progressEl.classList.add('hidden');
    }, 2000);
  },

  // 处理文件选择
  async handleFileSelect(files) {
    if (!files || files.length === 0) return;

    const rawItems = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // 处理 JSON 文件
      if (file.name.endsWith('.json')) {
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            rawItems.push(...data);
          } else if (data.records && Array.isArray(data.records)) {
            // 支持从导出的JSON恢复
            if (confirm('检测到系统导出的备份文件，是否恢复全部数据？')) {
              this.state.records = data.records;
              this.state.failedItems = data.failedItems || [];
              this.saveToStorage();
              this.renderAll();
              this.showToast(`已恢复 ${data.records.length} 条记录`, 'success');
              return;
            }
          }
        } catch (e) {
          this.showToast(`解析JSON文件失败：${file.name}`, 'error');
        }
      } else {
        // 模拟解析音频/图片文件
        rawItems.push({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          // 尝试从文件名解析信息
          trackName: this.parseTrackNameFromFileName(file.name),
          artist: this.parseArtistFromFileName(file.name),
          durationMinutes: 0,
          roomNumber: '',
          bookingDate: this.parseDateFromFileName(file.name),
          bookingTime: '',
          depositAmount: 200,
          licenseStatus: 'pending',
          isOldMaster: /OLD|旧版|master/i.test(file.name),
          isRenamed: false,
          source: 'system'
        });
      }
    }

    if (rawItems.length > 0) {
      await this.importRawData(rawItems);
    }
  },

  // 从文件名解析曲目名
  parseTrackNameFromFileName(fileName) {
    const withoutExt = fileName.replace(/\.[^/.]+$/, '');
    const parts = withoutExt.split(/[_-]/);
    if (parts.length > 0) {
      return parts[0];
    }
    return withoutExt;
  },

  // 从文件名解析艺术家
  parseArtistFromFileName(fileName) {
    const withoutExt = fileName.replace(/\.[^/.]+$/, '');
    const parts = withoutExt.split(/[_-]/);
    if (parts.length > 1) {
      return parts[1];
    }
    return '';
  },

  // 从文件名解析日期
  parseDateFromFileName(fileName) {
    const match = fileName.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
    return '';
  },

  // 渲染全部
  renderAll() {
    this.renderStats();
    this.renderTrackList();
    this.renderFailedList();
    this.renderDetail();
  },

  // 渲染统计
  renderStats() {
    const records = this.state.records;
    const { STATUS } = window.DataModels;
    
    const counts = {
      total: records.length,
      confirmed: records.filter(r => r.status === STATUS.CONFIRMED).length,
      needs_review: records.filter(r => r.status === STATUS.NEEDS_REVIEW).length,
      pending: records.filter(r => r.status === STATUS.PENDING).length,
      settled: records.filter(r => r.status === STATUS.SETTLED).length,
      error: records.filter(r => r.status === STATUS.ERROR).length
    };

    document.getElementById('statTotal').textContent = counts.total;
    document.getElementById('statConfirmed').textContent = counts.confirmed;
    document.getElementById('statReview').textContent = counts.needs_review;
    document.getElementById('statPending').textContent = counts.pending;
    document.getElementById('statSettled').textContent = counts.settled;
    document.getElementById('statError').textContent = counts.error;

    // 计算金额
    let totalDeposit = 0;
    let totalRefund = 0;
    let totalDeduction = 0;
    
    records.forEach(r => {
      totalDeposit += r.depositAmount || 0;
      if (r.settlement) {
        totalRefund += r.settlement.refundAmount || 0;
        totalDeduction += (r.settlement.originalDeposit || 0) - (r.settlement.refundAmount || 0);
      }
    });

    document.getElementById('totalDeposit').textContent = window.DataModels.formatCurrency(totalDeposit);
    document.getElementById('totalRefund').textContent = window.DataModels.formatCurrency(totalRefund);
    document.getElementById('totalDeduction').textContent = window.DataModels.formatCurrency(totalDeduction);
  },

  // 渲染失败列表
  renderFailedList() {
    const section = document.getElementById('failedSection');
    const list = document.getElementById('failedList');
    const count = document.getElementById('failedCount');

    if (this.state.failedItems.length === 0) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    count.textContent = this.state.failedItems.length;

    list.innerHTML = this.state.failedItems.map(item => `
      <div class="failed-item">
        <div class="failed-item-header">
          <span class="failed-file-name">${item.fileName}</span>
          <span class="badge badge-danger">第${item.index + 1}条</span>
        </div>
        <div class="failed-error">${item.error}</div>
      </div>
    `).join('');
  },

  // 渲染曲目列表
  renderTrackList() {
    const listEl = document.getElementById('trackList');
    const countEl = document.getElementById('listCount');
    
    let records = [...this.state.records];

    // 筛选
    switch (this.state.currentFilter) {
      case 'needs_review':
        records = records.filter(r => r.status === window.DataModels.STATUS.NEEDS_REVIEW);
        break;
      case 'pending':
        records = records.filter(r => r.status === window.DataModels.STATUS.PENDING);
        break;
      case 'has_anomaly':
        records = records.filter(r => r.anomalies.some(a => !a.resolved));
        break;
      case 'settled':
        records = records.filter(r => r.status === window.DataModels.STATUS.SETTLED);
        break;
    }

    // 搜索
    if (this.state.searchKeyword) {
      const kw = this.state.searchKeyword;
      records = records.filter(r => 
        r.trackName.toLowerCase().includes(kw) ||
        r.artist.toLowerCase().includes(kw) ||
        r.roomNumber.toLowerCase().includes(kw) ||
        r.fileName.toLowerCase().includes(kw)
      );
    }

    countEl.textContent = `共 ${records.length} 条`;

    if (records.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <p class="empty-icon">🔍</p>
          <p>没有找到匹配的记录</p>
          <p class="empty-hint">试试其他筛选条件或搜索词</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = records.map(record => this.renderTrackCard(record)).join('');

    // 绑定点击事件
    listEl.querySelectorAll('.track-card').forEach(card => {
      card.addEventListener('click', () => {
        this.selectRecord(card.dataset.id);
      });
    });
  },

  // 渲染单条曲目卡片
  renderTrackCard(record) {
    const { STATUS, formatCurrency, getStatusLabel, getAnomalyLabel, SEVERITY } = window.DataModels;
    const isSelected = record.id === this.state.selectedRecordId;
    
    // 状态徽章样式
    let statusClass = 'badge-default';
    switch (record.status) {
      case STATUS.CONFIRMED: statusClass = 'badge-success'; break;
      case STATUS.NEEDS_REVIEW: statusClass = 'badge-warning'; break;
      case STATUS.SETTLED: statusClass = 'badge-info'; break;
      case STATUS.ERROR: statusClass = 'badge-danger'; break;
      default: statusClass = 'badge-default';
    }

    // 异常标签
    const anomalyTags = record.anomalies.filter(a => !a.resolved).map(a => {
      let severityClass = 'warn';
      if (a.severity === SEVERITY.ERROR) severityClass = 'error';
      if (a.severity === SEVERITY.REVIEW) severityClass = 'review';
      return `<span class="anomaly-tag ${severityClass}">${getAnomalyLabel(a.type)}</span>`;
    }).join('');

    // 结算信息
    let settlementHtml = '';
    if (record.settlement) {
      const refund = record.settlement.refundAmount;
      const original = record.settlement.originalDeposit;
      const deduction = original - refund;
      settlementHtml = `
        <div class="track-settlement">
          <span class="settlement-label">押金 ${formatCurrency(original)}</span>
          <span class="settlement-amount refund">应退 ${formatCurrency(refund)}</span>
        </div>
      `;
    }

    const selectedClass = isSelected ? 'selected' : '';

    return `
      <div class="track-card ${selectedClass}" data-id="${record.id}">
        <div class="track-card-header">
          <div class="track-name">${record.trackName || '(未填写曲目名)'}</div>
          <span class="badge ${statusClass}">${getStatusLabel(record.status)}</span>
        </div>
        <div class="track-meta">
          <span>👤 ${record.artist || '-'}</span>
          <span>🎹 ${record.roomNumber || '-'}</span>
          <span>📅 ${record.bookingDate || '-'}</span>
          ${record.source === 'group_screenshot' ? '<span class="badge badge-warning">群截图</span>' : ''}
          ${record.isRenamed ? '<span class="badge badge-info">已改名</span>' : ''}
        </div>
        ${anomalyTags ? `<div class="track-anomalies">${anomalyTags}</div>` : ''}
        ${settlementHtml}
      </div>
    `;
  },

  // 选中记录
  selectRecord(id) {
    this.state.selectedRecordId = id;
    this.renderTrackList();
    this.renderDetail();
  },

  // 渲染详情面板
  renderDetail() {
    const emptyEl = document.getElementById('detailEmpty');
    const contentEl = document.getElementById('detailContent');
    
    if (!this.state.selectedRecordId) {
      emptyEl.classList.remove('hidden');
      contentEl.classList.add('hidden');
      return;
    }

    const record = this.state.records.find(r => r.id === this.state.selectedRecordId);
    if (!record) {
      emptyEl.classList.remove('hidden');
      contentEl.classList.add('hidden');
      return;
    }

    emptyEl.classList.add('hidden');
    contentEl.classList.remove('hidden');
    
    contentEl.innerHTML = this.renderDetailContent(record);
    this.bindDetailEvents(record);
  },

  // 渲染详情内容
  renderDetailContent(record) {
    const { STATUS, formatCurrency, getStatusLabel, getAnomalyLabel, SEVERITY, formatDate } = window.DataModels;

    // 状态徽章
    let statusClass = 'badge-default';
    switch (record.status) {
      case STATUS.CONFIRMED: statusClass = 'badge-success'; break;
      case STATUS.NEEDS_REVIEW: statusClass = 'badge-warning'; break;
      case STATUS.SETTLED: statusClass = 'badge-info'; break;
      case STATUS.ERROR: statusClass = 'badge-danger'; break;
      default: statusClass = 'badge-default';
    }

    // 基本信息
    const html = `
      <div class="detail-header">
        <div class="detail-title">${record.trackName || '(未填写曲目名)'}</div>
        <div class="detail-subtitle">
          <span>👤 ${record.artist || '-'}</span>
          <span>🎹 ${record.roomNumber || '-'}</span>
          <span>📅 ${record.bookingDate || '-'} ${record.bookingTime || ''}</span>
          <span class="badge ${statusClass}">${getStatusLabel(record.status)}</span>
          <span>v${record.version}</span>
        </div>
      </div>

      <!-- 文件信息 -->
      <div class="detail-section">
        <h3 class="detail-section-title">📁 文件信息</h3>
        <div class="detail-info-grid">
          <span class="detail-info-label">文件名</span>
          <span class="detail-info-value">${record.fileName}</span>
          <span class="detail-info-label">时长</span>
          <span class="detail-info-value">${record.durationMinutes ? record.durationMinutes + ' 分钟' : '-'}</span>
          <span class="detail-info-label">来源</span>
          <span class="detail-info-value">${this.getSourceLabel(record.source)}</span>
          ${record.sourceNote ? `<span class="detail-info-label">来源备注</span><span class="detail-info-value">${record.sourceNote}</span>` : ''}
          ${record.isRenamed ? `<span class="detail-info-label">改名记录</span><span class="detail-info-value">是，原始文件名已备注</span>` : ''}
        </div>
      </div>

      <!-- 异常列表 -->
      <div class="detail-section">
        <h3 class="detail-section-title">⚠️ 异常标记 (${record.anomalies.filter(a => !a.resolved).length}/${record.anomalies.length})</h3>
        <div class="anomaly-list">
          ${record.anomalies.length === 0 ? 
            '<p style="color: var(--text-muted); font-size: 13px;">没有异常</p>' : 
            record.anomalies.map(a => this.renderAnomalyItem(a, record.id)).join('')
          }
        </div>
      </div>

      <!-- 结算信息 -->
      <div class="detail-section">
        <h3 class="detail-section-title">💰 押金结算</h3>
        ${record.settlement ? this.renderSettlementBox(record) : this.renderSettlementPending(record)}
      </div>

      <!-- 批注 -->
      <div class="detail-section">
        <h3 class="detail-section-title">💬 批注 (${record.annotations.length})</h3>
        <div class="annotation-list">
          ${record.annotations.length === 0 ? 
            '<p style="color: var(--text-muted); font-size: 13px;">还没有批注</p>' : 
            record.annotations.map(a => this.renderAnnotationItem(a)).join('')
          }
        </div>
        <div class="annotation-add">
          <textarea class="annotation-input" id="newAnnotationInput" placeholder="写点什么，比如"这孩子最近进步很快"或者"等林老师确认后再结算"..."></textarea>
          <button class="btn btn-primary" id="addAnnotationBtn">添加</button>
        </div>
      </div>

      <!-- 处理历史 -->
      <div class="detail-section">
        <h3 class="detail-section-title">📜 处理历史 (${record.processingNotes.length})</h3>
        <div class="history-list">
          ${record.processingNotes.length === 0 ? 
            '<p style="color: var(--text-muted); font-size: 13px;">还没有处理记录</p>' : 
            record.processingNotes.slice().reverse().map(n => `
              <div class="history-item">
                <div class="history-time">${n.time} · <span class="history-author">${n.author}</span></div>
                <div class="history-content">${n.content}</div>
              </div>
            `).join('')
          }
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="detail-actions">
        ${record.status !== STATUS.SETTLED ? `
          <button class="btn btn-primary" id="confirmSettlementBtn">✅ 确认结算</button>
        ` : ''}
        ${record.status !== STATUS.CONFIRMED && record.status !== STATUS.SETTLED ? `
          <button class="btn btn-secondary" id="markOkBtn">✓ 标记正常</button>
        ` : ''}
        <button class="btn btn-secondary" id="generateReportBtn">📄 生成报告</button>
      </div>
    `;

    return html;
  },

  // 渲染异常项
  renderAnomalyItem(anomaly, recordId) {
    const { getAnomalyLabel, SEVERITY, formatDate } = window.DataModels;
    
    let severityClass = 'severity-warn';
    if (anomaly.severity === SEVERITY.ERROR) severityClass = 'severity-error';
    if (anomaly.severity === SEVERITY.REVIEW) severityClass = 'severity-review';
    
    const resolvedClass = anomaly.resolved ? 'resolved' : '';

    let resolutionHtml = '';
    if (anomaly.resolved) {
      resolutionHtml = `
        <div class="anomaly-resolution">
          ✅ 已解决：${anomaly.resolutionNote}
          <br><span style="font-size: 11px; opacity: 0.8;">${anomaly.resolvedBy} · ${formatDate(anomaly.resolvedAt)}</span>
        </div>
      `;
    }

    let actionsHtml = '';
    if (!anomaly.resolved) {
      actionsHtml = `
        <div class="anomaly-actions">
          <input type="text" class="resolve-input" id="resolveInput_${anomaly.id}" placeholder="说明一下怎么处理的...">
          <button class="resolve-btn" data-anomaly-id="${anomaly.id}" data-record-id="${recordId}">标记解决</button>
        </div>
      `;
    }

    return `
      <div class="anomaly-item ${severityClass} ${resolvedClass}">
        <div class="anomaly-item-header">
          <span class="anomaly-type">${getAnomalyLabel(anomaly.type)}</span>
          <span class="badge ${anomaly.severity === SEVERITY.ERROR ? 'badge-danger' : anomaly.severity === SEVERITY.REVIEW ? 'badge-warning' : 'badge-default'}">
            ${anomaly.severity === SEVERITY.ERROR ? '错误' : anomaly.severity === SEVERITY.REVIEW ? '待确认' : '警告'}
          </span>
        </div>
        <div class="anomaly-reason">${anomaly.reason}</div>
        ${resolutionHtml}
        ${actionsHtml}
      </div>
    `;
  },

  // 渲染结算框
  renderSettlementBox(record) {
    const { formatCurrency } = window.DataModels;
    const s = record.settlement;
    
    let statusText = '正常结算';
    let statusClass = '';
    switch (s.status) {
      case 'partial': statusText = '部分扣款'; break;
      case 'full': statusText = '全额扣款'; statusClass = 'style="color: #ef4444;"'; break;
      case 'pending': statusText = '待确认'; statusClass = 'style="color: #f59e0b;"'; break;
    }

    const deductionHtml = s.deductions.length > 0 ? `
      <div class="deduction-list">
        ${s.deductions.map(d => `
          <div class="deduction-item">
            <span>${d.reason}${d.note ? ' (' + d.note + ')' : ''}</span>
            <span>-${formatCurrency(d.amount)}</span>
          </div>
        `).join('')}
      </div>
    ` : '';

    return `
      <div class="settlement-box">
        <div class="settlement-row">
          <span>原始押金</span>
          <span>${formatCurrency(s.originalDeposit)}</span>
        </div>
        ${deductionHtml}
        <div class="settlement-row total" ${statusClass}>
          <span>应退押金 · ${statusText}</span>
          <span>${formatCurrency(s.refundAmount)}</span>
        </div>
      </div>
    `;
  },

  // 渲染待结算
  renderSettlementPending(record) {
    const { formatCurrency } = window.DataModels;
    return `
      <div class="settlement-box" style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border-color: #fcd34d;">
        <div class="settlement-row">
          <span>原始押金</span>
          <span>${formatCurrency(record.depositAmount || 200)}</span>
        </div>
        <div class="settlement-row total" style="color: #92400e;">
          <span>状态</span>
          <span>⚠️ 有待处理的异常，先处理完再结算</span>
        </div>
        <p style="font-size: 12px; color: #92400e; margin-top: 8px;">
          提示：把上面的异常都处理掉，系统会自动算出应退金额，然后点"确认结算"
        </p>
      </div>
    `;
  },

  // 渲染批注项
  renderAnnotationItem(annotation) {
    const { formatDate } = window.DataModels;
    return `
      <div class="annotation-item">
        <div class="annotation-header">
          <span class="annotation-author">${annotation.author}</span>
          <span>${formatDate(annotation.timestamp)}</span>
        </div>
        <div class="annotation-content">${annotation.content}</div>
      </div>
    `;
  },

  // 绑定详情页事件
  bindDetailEvents(record) {
    const { STATUS, createAnnotation } = window.DataModels;

    // 添加批注
    const addBtn = document.getElementById('addAnnotationBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const input = document.getElementById('newAnnotationInput');
        const content = input.value.trim();
        if (!content) {
          this.showToast('写点什么再添加吧', 'warning');
          return;
        }
        
        const annotation = createAnnotation(content, 'manual', this.state.operator);
        const updated = window.Storage.addAnnotation(record.id, annotation);
        if (updated) {
          // 更新本地状态
          const idx = this.state.records.findIndex(r => r.id === record.id);
          this.state.records[idx] = updated;
          input.value = '';
          this.renderAll();
          this.showToast('批注已添加', 'success');
        }
      });
    }

    // 解决异常
    document.querySelectorAll('.resolve-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const anomalyId = btn.dataset.anomalyId;
        const recordId = btn.dataset.recordId;
        const input = document.getElementById(`resolveInput_${anomalyId}`);
        const note = input.value.trim();
        
        if (!note) {
          this.showToast('请填写处理说明', 'warning');
          return;
        }

        const updated = window.Storage.resolveAnomaly(recordId, anomalyId, note, this.state.operator);
        if (updated) {
          const idx = this.state.records.findIndex(r => r.id === recordId);
          this.state.records[idx] = updated;
          this.renderAll();
          this.showToast('异常已标记为解决', 'success');
        }
      });
    });

    // 确认结算
    const confirmBtn = document.getElementById('confirmSettlementBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        const unresolved = record.anomalies.filter(a => !a.resolved);
        if (unresolved.length > 0) {
          if (!confirm(`还有 ${unresolved.length} 个异常没处理，确定要直接结算吗？`)) {
            return;
          }
        }
        
        const updated = window.Storage.confirmSettlement(record.id, this.state.operator);
        if (updated) {
          const idx = this.state.records.findIndex(r => r.id === record.id);
          this.state.records[idx] = updated;
          this.renderAll();
          this.showToast('结算已确认', 'success');
        }
      });
    }

    // 标记正常
    const markOkBtn = document.getElementById('markOkBtn');
    if (markOkBtn) {
      markOkBtn.addEventListener('click', () => {
        if (!confirm('确认这条没问题，可以正常通过吗？')) return;
        
        record.status = STATUS.CONFIRMED;
        // 自动结算
        const { SettlementEngine } = window.CoreLogic;
        record.settlement = SettlementEngine.calculate(record);
        record.status = STATUS.CONFIRMED;
        
        const updated = window.Storage.updateRecord(record, this.state.operator);
        const idx = this.state.records.findIndex(r => r.id === record.id);
        this.state.records[idx] = updated;
        
        this.renderAll();
        this.showToast('已标记为正常', 'success');
      });
    }

    // 生成报告
    const reportBtn = document.getElementById('generateReportBtn');
    if (reportBtn) {
      reportBtn.addEventListener('click', () => {
        this.generateReport();
      });
    }
  },

  // 生成报告
  generateReport() {
    const report = window.ReportGenerator.generateFullReport(
      this.state.records,
      this.state.failedItems,
      this.state.operator
    );
    
    document.getElementById('reportContent').innerHTML = report.html;
    document.getElementById('reportModal').classList.remove('hidden');
    
    // 保存纯文本供复制
    this.currentReportText = report.text;
  },

  // 关闭报告
  closeReportModal() {
    document.getElementById('reportModal').classList.add('hidden');
  },

  // 复制报告
  async copyReport() {
    if (!this.currentReportText) return;
    
    try {
      await navigator.clipboard.writeText(this.currentReportText);
      this.showToast('报告已复制到剪贴板，直接粘贴到群里就行', 'success');
    } catch (e) {
      // 降级方案
      const textarea = document.createElement('textarea');
      textarea.value = this.currentReportText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.showToast('报告已复制到剪贴板', 'success');
    }
  },

  // 导出数据
  exportData() {
    const json = window.Storage.exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `琴房押金结算_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('数据已导出', 'success');
  },

  // 获取来源标签
  getSourceLabel(source) {
    const labels = {
      system: '系统导入',
      group_screenshot: '排练群截图',
      manual: '手工录入'
    };
    return labels[source] || source;
  },

  // 显示Toast
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

// 导出
window.App = App;
