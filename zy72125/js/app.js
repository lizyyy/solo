const App = {
  currentFilter: {},
  filteredRecords: [],
  editingRecordId: null,

  init() {
    DataManager.init();
    this.bindEvents();
    this.renderTable();
    this.updateStats();
  },

  bindEvents() {
    document.getElementById('btnLoadSample').addEventListener('click', () => loadSampleData());
    document.getElementById('btnAddRecord').addEventListener('click', () => this.showAddModal());
    document.getElementById('btnImport').addEventListener('click', () => document.getElementById('fileImport').click());
    document.getElementById('fileImport').addEventListener('change', (e) => this.handleImport(e));
    document.getElementById('btnExport').addEventListener('click', () => this.showExportMenu());
    document.getElementById('btnCheckAll').addEventListener('click', () => this.runFullCheck());
    document.getElementById('btnShowHistory').addEventListener('click', () => this.showHistoryModal());
    document.getElementById('btnClearAll').addEventListener('click', () => this.handleClearAll());
    document.getElementById('btnResetFilter').addEventListener('click', () => this.resetFilter());
    document.getElementById('btnCloseDiff').addEventListener('click', () => this.hideDiff());

    document.getElementById('filterDate').addEventListener('change', () => this.applyFilter());
    document.getElementById('filterCity').addEventListener('input', () => this.applyFilter());
    document.getElementById('filterSong').addEventListener('input', () => this.applyFilter());
    document.getElementById('filterStatus').addEventListener('change', () => this.applyFilter());
    document.getElementById('filterIssue').addEventListener('change', () => this.applyFilter());

    document.getElementById('modalClose').addEventListener('click', () => this.closeModal('modal'));
    document.getElementById('modalCancel').addEventListener('click', () => this.closeModal('modal'));
    document.getElementById('modalSave').addEventListener('click', () => this.saveModal());
    document.getElementById('historyClose').addEventListener('click', () => this.closeModal('historyModal'));
    document.getElementById('suggestionClose').addEventListener('click', () => this.closeModal('suggestionModal'));
    document.getElementById('suggestionCloseBtn').addEventListener('click', () => this.closeModal('suggestionModal'));

    window.addEventListener('click', (e) => {
      if (e.target.id === 'modal') this.closeModal('modal');
      if (e.target.id === 'historyModal') this.closeModal('historyModal');
      if (e.target.id === 'suggestionModal') this.closeModal('suggestionModal');
    });
  },

  applyFilter() {
    this.currentFilter = {
      date: document.getElementById('filterDate').value,
      city: document.getElementById('filterCity').value.trim().toLowerCase(),
      song: document.getElementById('filterSong').value.trim().toLowerCase(),
      status: document.getElementById('filterStatus').value,
      issue: document.getElementById('filterIssue').value
    };
    this.renderTable();
    this.updateStats();
  },

  resetFilter() {
    document.getElementById('filterDate').value = '';
    document.getElementById('filterCity').value = '';
    document.getElementById('filterSong').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterIssue').value = '';
    this.currentFilter = {};
    this.renderTable();
    this.updateStats();
  },

  getFilteredRecords() {
    let records = DataManager.getAllRecords();
    const f = this.currentFilter;

    if (f.date) {
      records = records.filter(r => r.performanceDate === f.date);
    }
    if (f.city) {
      records = records.filter(r =>
        (r.city || '').toLowerCase().includes(f.city) ||
        (r.venue || '').toLowerCase().includes(f.city)
      );
    }
    if (f.song) {
      records = records.filter(r =>
        (r.songName || '').toLowerCase().includes(f.song)
      );
    }
    if (f.status) {
      records = records.filter(r => r.status === f.status);
    }
    if (f.issue) {
      records = records.filter(r => {
        const issueTypes = (r.issues || []).map(i => i.type);
        if (f.issue === '正常') return issueTypes.length === 0;
        return issueTypes.includes(f.issue);
      });
    }

    this.filteredRecords = records;
    return records;
  },

  getFilterDescription() {
    const parts = [];
    const f = this.currentFilter;
    if (f.date) parts.push(`日期=${f.date}`);
    if (f.city) parts.push(`城市/场地含"${f.city}"`);
    if (f.song) parts.push(`曲目含"${f.song}"`);
    if (f.status) parts.push(`状态=${f.status}`);
    if (f.issue) parts.push(`问题=${f.issue}`);
    return parts.length > 0 ? parts.join('，') : '全部记录';
  },

  renderTable() {
    const records = this.getFilteredRecords();
    const tbody = document.getElementById('tableBody');

    if (records.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="13" class="empty-cell">
            <div class="empty-state">
              <div class="empty-icon">📋</div>
              <div class="empty-text">暂无匹配数据</div>
              <div class="empty-hint">点击"加载样例数据"开始体验，或"新增记录"手动录入</div>
            </div>
          </td>
        </tr>`;
      return;
    }

    const allRecords = DataManager.getAllRecords();

    tbody.innerHTML = records.map((r, i) => {
      const issueTypes = (r.issues || []).map(i => i.type);
      const hasIssue = issueTypes.includes('空值') || issueTypes.some(t => t === '重复' && (r.issues.find(i => i.type === t) || {}).severity === 'error');
      const hasWarning = issueTypes.includes('边界') || issueTypes.some(t => t === '重复' && (r.issues.find(i => i.type === t) || {}).severity === 'warning');
      const hasDuplicate = issueTypes.includes('重复');

      let rowClass = '';
      if (hasIssue) rowClass = 'row-issue';
      else if (hasDuplicate) rowClass = 'row-duplicate';
      else if (hasWarning) rowClass = 'row-warning';

      const statusClass = this.getStatusClass(r.status);
      const issueTags = (r.issues || []).map(issue => {
        const tagClass = issue.type === '空值' ? 'issue-empty' :
          issue.type === '重复' ? 'issue-duplicate' : 'issue-boundary';
        return `<span class="issue-tag ${tagClass}">${issue.message}</span>`;
      }).join('');

      return `
        <tr class="${rowClass}" data-id="${r.id}">
          <td>${i + 1} <span class="version-badge">v${r.version}</span></td>
          <td><span class="status-badge ${statusClass}">${r.status}</span>${issueTags ? '<br>' + issueTags : ''}</td>
          <td>${r.performanceDate || '<em style="color:#e53e3e">未填</em>'}</td>
          <td>${r.city || '<em style="color:#e53e3e">未填</em>'}${r.venue ? '<br><small style="color:#718096">' + this.escapeHtml(r.venue) + '</small>' : ''}</td>
          <td>${this.escapeHtml(r.songName) || '<em style="color:#e53e3e">未填</em>'}</td>
          <td>${r.inputType || '<em style="color:#e53e3e">未填</em>'}</td>
          <td>${r.channelNumber || '<em style="color:#e53e3e">未填</em>'}</td>
          <td><span class="filename-cell" title="${this.escapeHtml(r.fileName)}">${this.escapeHtml(r.fileName) || '<em style="color:#e53e3e">未填</em>'}</span></td>
          <td>${r.duration || ''}</td>
          <td>
            ${r.sourceType ? `<span class="source-tag" title="${this.escapeHtml(r.sourceDetail || '')}">${r.sourceType}</span>` : '<em style="color:#ed8936">未标注</em>'}
          </td>
          <td>
            <span class="remark-cell" title="${this.escapeHtml(r.remark || '')}">${this.escapeHtml(r.remark) || '-'}</span>
          </td>
          <td>
            <div class="modified-info">
              <span class="modified-user">${this.escapeHtml(r.updatedBy)}</span><br>
              ${this.formatDateTime(r.updatedAt)}
            </div>
          </td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-primary btn-sm" onclick="App.showEditModal('${r.id}')">编辑</button>
              <button class="btn btn-secondary btn-sm" onclick="App.showRecordHistory('${r.id}')">历史</button>
              <button class="btn btn-secondary btn-sm" onclick="App.quickRemark('${r.id}')">备注</button>
              <button class="btn btn-danger btn-sm" onclick="App.deleteRecord('${r.id}')">删除</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  },

  updateStats() {
    const records = DataManager.getAllRecords();

    let total = records.length;
    let ok = 0, warn = 0, error = 0, dup = 0;

    for (const r of records) {
      const issues = r.issues || [];
      const hasError = issues.some(i => i.severity === 'error');
      const hasWarning = issues.some(i => i.severity === 'warning');
      const hasDuplicate = issues.some(i => i.type === '重复');
      const hasEmpty = issues.some(i => i.type === '空值');

      if (issues.length === 0) ok++;
      if (hasWarning && !hasError) warn++;
      if (hasError) error++;
      if (hasDuplicate) dup++;
    }

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statOk').textContent = ok;
    document.getElementById('statWarn').textContent = warn;
    document.getElementById('statError').textContent = error + (records.filter(r => (r.issues || []).some(i => i.type === '空值')).length > 0 && error === 0 ? records.filter(r => (r.issues || []).some(i => i.type === '空值')).length : 0);
    document.getElementById('statDup').textContent = dup;

    if (total === 0) {
      document.getElementById('statError').textContent = '0';
    }
  },

  getStatusClass(status) {
    switch (status) {
      case '待核对': return 'status-pending';
      case '正常': return 'status-normal';
      case '有疑问': return 'status-warning';
      case '缺材料': return 'status-error';
      case '已确认': return 'status-confirmed';
      default: return 'status-pending';
    }
  },

  showAddModal() {
    this.editingRecordId = null;
    document.getElementById('modalTitle').textContent = '新增记录';
    this.renderModalForm(DataManager.getEmptyRecord());
    this.openModal('modal');
  },

  showEditModal(id) {
    const record = DataManager.getRecord(id);
    if (!record) return;

    this.editingRecordId = id;
    document.getElementById('modalTitle').textContent = '编辑记录 (v' + record.version + ')';
    this.renderModalForm(record);
    this.openModal('modal');
  },

  renderModalForm(record) {
    const body = document.getElementById('modalBody');
    body.innerHTML = `
      <div class="form-row">
        <div class="form-group">
          <label>演出日期 <span class="required">*</span></label>
          <input type="date" id="formDate" value="${record.performanceDate || ''}">
        </div>
        <div class="form-group">
          <label>城市 <span class="required">*</span></label>
          <input type="text" id="formCity" value="${this.escapeHtml(record.city || '')}" placeholder="如：上海">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>场地</label>
          <input type="text" id="formVenue" value="${this.escapeHtml(record.venue || '')}" placeholder="如：梅赛德斯奔驰文化中心">
        </div>
        <div class="form-group">
          <label>曲目名称 <span class="required">*</span></label>
          <input type="text" id="formSong" value="${this.escapeHtml(record.songName || '')}" placeholder="如：夜空中最亮的星">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>输入类型 <span class="required">*</span></label>
          <select id="formInputType">
            <option value="">请选择</option>
            ${INPUT_TYPES.map(t => `<option value="${t}" ${record.inputType === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>通道号</label>
          <input type="text" id="formChannel" value="${this.escapeHtml(record.channelNumber || '')}" placeholder="如：1">
          <div class="form-hint">数字1-128，立体声请分别记录</div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>文件名 <span class="required">*</span></label>
          <input type="text" id="formFileName" value="${this.escapeHtml(record.fileName || '')}" placeholder="如：20260520_SH_夜空中最亮的星_主唱麦.wav">
          <div class="form-hint">推荐格式：日期_城市_曲目_输入类型.扩展名</div>
        </div>
        <div class="form-group">
          <label>文件格式</label>
          <select id="formFileFormat">
            <option value="">自动识别</option>
            <option value="WAV" ${record.fileFormat === 'WAV' ? 'selected' : ''}>WAV</option>
            <option value="AIFF" ${record.fileFormat === 'AIFF' ? 'selected' : ''}>AIFF</option>
            <option value="FLAC" ${record.fileFormat === 'FLAC' ? 'selected' : ''}>FLAC</option>
            <option value="MP3" ${record.fileFormat === 'MP3' ? 'selected' : ''}>MP3</option>
            <option value="M4A" ${record.fileFormat === 'M4A' ? 'selected' : ''}>M4A</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>时长</label>
          <input type="text" id="formDuration" value="${this.escapeHtml(record.duration || '')}" placeholder="如：5:23 或 3:45:00">
        </div>
        <div class="form-group">
          <label>来源类型 <span class="required">*</span></label>
          <select id="formSourceType">
            <option value="">请选择</option>
            ${SOURCE_TYPES.map(t => `<option value="${t}" ${record.sourceType === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>来源详情</label>
        <input type="text" id="formSourceDetail" value="${this.escapeHtml(record.sourceDetail || '')}" placeholder="如：排练群5月19日聊天记录">
        <div class="form-hint">具体说明材料来自哪里，方便追溯</div>
      </div>
      <div class="form-group">
        <label>备注</label>
        <textarea id="formRemark" placeholder="补充说明，如设备型号、特殊情况等">${this.escapeHtml(record.remark || '')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>核对状态</label>
          <select id="formStatus">
            ${STATUS_TYPES.map(t => `<option value="${t}" ${record.status === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>操作人</label>
          <input type="text" id="formUser" value="${this.escapeHtml(DataManager.currentUser)}" placeholder="如：老许">
          <div class="form-hint">记录本次修改的操作人</div>
        </div>
      </div>
    `;
  },

  saveModal() {
    const user = document.getElementById('formUser').value.trim();
    if (user) {
      DataManager.setCurrentUser(user);
    }

    const formData = {
      performanceDate: document.getElementById('formDate').value,
      city: document.getElementById('formCity').value.trim(),
      venue: document.getElementById('formVenue').value.trim(),
      songName: document.getElementById('formSong').value.trim(),
      inputType: document.getElementById('formInputType').value,
      channelNumber: document.getElementById('formChannel').value.trim(),
      fileName: document.getElementById('formFileName').value.trim(),
      fileFormat: document.getElementById('formFileFormat').value || this.detectFormat(document.getElementById('formFileName').value),
      duration: document.getElementById('formDuration').value.trim(),
      sourceType: document.getElementById('formSourceType').value,
      sourceDetail: document.getElementById('formSourceDetail').value.trim(),
      remark: document.getElementById('formRemark').value.trim(),
      status: document.getElementById('formStatus').value
    };

    if (!formData.songName && !formData.fileName) {
      this.showToast('至少需要填写曲目名称或文件名', 'error');
      return;
    }

    if (this.editingRecordId) {
      DataManager.updateRecord(this.editingRecordId, formData);
      this.showToast('记录已更新', 'success');
    } else {
      DataManager.addRecord(formData);
      this.showToast('记录已添加', 'success');
    }

    const allRecords = DataManager.getAllRecords();
    for (const r of allRecords) {
      const { issues, suggestions } = Validator.validateRecord(r, allRecords);
      DataManager.updateRecordIssues(r.id, issues, suggestions);
    }

    this.closeModal('modal');
    this.renderTable();
    this.updateStats();
  },

  detectFormat(fileName) {
    if (!fileName) return '';
    const extMatch = fileName.match(/\.(\w+)$/);
    if (extMatch) {
      const ext = extMatch[1].toUpperCase();
      const valid = ['WAV', 'MP3', 'AIFF', 'FLAC', 'M4A', 'OGG'];
      return valid.includes(ext) ? ext : '';
    }
    return '';
  },

  quickRemark(id) {
    const record = DataManager.getRecord(id);
    if (!record) return;

    const newRemark = prompt('修改备注（当前：' + (record.remark || '无') + '）：', record.remark || '');
    if (newRemark === null) return;

    DataManager.takeSnapshot();
    DataManager.updateRecord(id, { remark: newRemark });

    const allRecords = DataManager.getAllRecords();
    for (const r of allRecords) {
      const { issues, suggestions } = Validator.validateRecord(r, allRecords);
      DataManager.updateRecordIssues(r.id, issues, suggestions);
    }

    const diff = DataManager.compareSnapshot();
    this.renderTable();
    this.updateStats();
    this.showToast('备注已更新', 'success');

    if (diff && diff.modified.length > 0) {
      this.showDiff(diff);
    }
  },

  deleteRecord(id) {
    const record = DataManager.getRecord(id);
    if (!record) return;

    if (!confirm(`确认删除记录：${record.songName || record.fileName || '未命名'}？`)) return;

    DataManager.deleteRecord(id);
    this.renderTable();
    this.updateStats();
    this.showToast('记录已删除', 'success');
  },

  runFullCheck() {
    const { results, stats } = Validator.validateAllRecords();

    this.renderTable();
    this.updateStats();

    const report = Validator.generateSummaryReport();
    this.showSuggestionReport(report);
  },

  showSuggestionReport(report) {
    const body = document.getElementById('suggestionBody');
    let html = '';

    html += `<div class="suggestion-section">`;
    html += `<h3>📊 核对概况</h3>`;
    html += `<div class="suggestion-item info">`;
    html += `<div class="suggestion-title"><span class="icon">📋</span> 本次核对结果</div>`;
    html += `<div class="suggestion-desc">`;
    html += `共核对 ${report.summary.total} 条记录：`;
    html += `核对通过 ${report.summary.ok} 条，`;
    html += `缺材料 ${report.summary.empty} 条，`;
    html += `重复项 ${report.summary.duplicate} 条，`;
    html += `边界异常 ${report.summary.boundary} 条。`;
    html += `</div>`;
    html += `</div></div>`;

    for (const section of report.sections) {
      html += `<div class="suggestion-section">`;
      html += `<h3>${section.title}</h3>`;
      html += `<div class="suggestion-item ${section.type}">`;
      html += `<div class="suggestion-desc">${section.description}</div>`;

      if (section.records && section.records.length > 0) {
        html += `<div style="margin-top:10px;">`;
        for (const rec of section.records) {
          const fullRecord = DataManager.getRecord(rec.id);
          if (fullRecord) {
            html += `<div class="suggestion-action" style="margin-bottom:8px;">`;
            html += `<strong>[${fullRecord.performanceDate || '日期缺失'}] ${fullRecord.city || '城市缺失'} - ${fullRecord.songName || '曲目缺失'}</strong><br>`;
            html += rec.issues.map(i => `· ${i}`).join('<br>');
            html += `</div>`;
          }
        }
        html += `</div>`;
      }
      html += `</div></div>`;
    }

    const allRecords = DataManager.getAllRecords();
    const recordsWithSuggestions = allRecords.filter(r => r.suggestions && r.suggestions.length > 0 && (r.issues || []).length > 0);

    if (recordsWithSuggestions.length > 0) {
      html += `<div class="suggestion-section">`;
      html += `<h3>💡 逐条处理建议</h3>`;

      for (const record of recordsWithSuggestions) {
        for (const s of record.suggestions) {
          html += `<div class="suggestion-item ${s.type}">`;
          html += `<div class="suggestion-title"><span class="icon">${s.icon}</span> ${s.title}`;
          html += `<small style="color:#718096;margin-left:8px;">[${record.performanceDate || '日期缺失'}] ${record.city || ''} - ${record.songName || '曲目缺失'}</small></div>`;
          html += `<div class="suggestion-desc">${s.description}</div>`;
          html += `<div class="suggestion-action">👉 ${s.action}</div>`;
          html += `</div>`;
        }
      }
      html += `</div>`;
    }

    body.innerHTML = html;
    this.openModal('suggestionModal');
  },

  showHistoryModal() {
    const history = DataManager.getAllHistory();
    const body = document.getElementById('historyBody');

    if (history.length === 0) {
      body.innerHTML = '<div style="text-align:center;padding:40px;color:#a0aec0;">暂无修改历史</div>';
      this.openModal('historyModal');
      return;
    }

    let html = '<div class="history-list">';
    for (const h of history.slice(0, 50)) {
      const record = DataManager.getRecord(h.recordId);
      const recordLabel = record
        ? `${record.songName || record.fileName || '未命名'}`
        : `(已删除) ${h.recordId.slice(0, 15)}...`;

      html += `<div class="history-item">`;
      html += `<div class="history-header">`;
      html += `<span class="history-user">${this.escapeHtml(h.user)}</span>`;
      html += `<span>`;
      html += `<span class="history-version">v${h.version}</span>`;
      html += `<span class="history-time">${this.formatDateTime(h.timestamp)}</span>`;
      html += `</span>`;
      html += `</div>`;
      html += `<div class="history-action">${h.action} - <strong>${this.escapeHtml(recordLabel)}</strong></div>`;

      if (h.changes && h.changes.length > 0) {
        html += `<div class="history-changes">`;
        for (const c of h.changes) {
          html += `<div class="change-item">`;
          html += `<span class="change-field">${c.fieldLabel}</span>`;
          html += `<span class="change-old">${this.escapeHtml(String(c.oldValue))}</span>`;
          html += `<span>→</span>`;
          html += `<span class="change-new">${this.escapeHtml(String(c.newValue))}</span>`;
          html += `</div>`;
        }
        html += `</div>`;
      }

      html += `</div>`;
    }
    html += '</div>';

    body.innerHTML = html;
    this.openModal('historyModal');
  },

  showRecordHistory(id) {
    const history = DataManager.getHistoryForRecord(id);
    const record = DataManager.getRecord(id);
    const body = document.getElementById('historyBody');

    if (history.length === 0) {
      body.innerHTML = `<div style="text-align:center;padding:40px;color:#a0aec0;">"${record ? record.songName : id}" 暂无修改历史</div>`;
      this.openModal('historyModal');
      return;
    }

    let html = `<h3 style="margin-bottom:15px;">${record ? this.escapeHtml(record.songName || record.fileName) : id} 的修改历史</h3>`;
    html += '<div class="history-list">';

    for (const h of history) {
      html += `<div class="history-item">`;
      html += `<div class="history-header">`;
      html += `<span class="history-user">${this.escapeHtml(h.user)}</span>`;
      html += `<span>`;
      html += `<span class="history-version">v${h.version}</span>`;
      html += `<span class="history-time">${this.formatDateTime(h.timestamp)}</span>`;
      html += `</span>`;
      html += `</div>`;
      html += `<div class="history-action">${h.action}</div>`;

      if (h.changes && h.changes.length > 0) {
        html += `<div class="history-changes">`;
        for (const c of h.changes) {
          html += `<div class="change-item">`;
          html += `<span class="change-field">${c.fieldLabel}</span>`;
          html += `<span class="change-old">${this.escapeHtml(String(c.oldValue))}</span>`;
          html += `<span>→</span>`;
          html += `<span class="change-new">${this.escapeHtml(String(c.newValue))}</span>`;
          html += `</div>`;
        }
        html += `</div>`;
      }

      html += `</div>`;
    }
    html += '</div>';

    body.innerHTML = html;
    this.openModal('historyModal');
  },

  showExportMenu() {
    const records = this.filteredRecords.length > 0 ? this.filteredRecords : DataManager.getAllRecords();
    const filterDesc = this.getFilterDescription();

    const menuHtml = `
      <div style="padding:10px;">
        <p style="margin-bottom:15px;color:#4a5568;">
          当前导出范围：<strong>${filterDesc}</strong>（${records.length} 条记录）
        </p>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <button class="btn btn-success" onclick="Exporter.exportAsJSON(App.filteredRecords.length > 0 ? App.filteredRecords : DataManager.getAllRecords(), '${this.escapeHtml(filterDesc)}'); App.closeModal('modal');">
            📄 导出为 JSON（完整数据，可再导入）
          </button>
          <button class="btn btn-primary" onclick="Exporter.exportAsCSV(App.filteredRecords.length > 0 ? App.filteredRecords : DataManager.getAllRecords(), '${this.escapeHtml(filterDesc)}'); App.closeModal('modal');">
            📊 导出为 CSV（可用 Excel 打开）
          </button>
          <button class="btn btn-warning" onclick="Exporter.exportAsTextReport(App.filteredRecords.length > 0 ? App.filteredRecords : DataManager.getAllRecords(), '${this.escapeHtml(filterDesc)}'); App.closeModal('modal');">
            📝 导出核对报告（文本格式，适合分享）
          </button>
        </div>
      </div>
    `;

    document.getElementById('modalTitle').textContent = '📤 导出清单';
    document.getElementById('modalBody').innerHTML = menuHtml;
    document.getElementById('modalFooter').style.display = 'none';
    this.openModal('modal');
  },

  handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        DataManager.takeSnapshot();

        const result = DataManager.importData(data, 'add');

        const allRecords = DataManager.getAllRecords();
        for (const r of allRecords) {
          const { issues, suggestions } = Validator.validateRecord(r, allRecords);
          DataManager.updateRecordIssues(r.id, issues, suggestions);
        }

        const diff = DataManager.compareSnapshot();

        this.renderTable();
        this.updateStats();

        this.showToast(`导入完成：新增 ${result.added} 条，更新 ${result.updated} 条，跳过 ${result.skipped} 条`, 'success');

        if (diff && diff.added.length > 0) {
          this.showDiff(diff);
        }
      } catch (err) {
        this.showToast('导入失败：' + err.message, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  },

  handleClearAll() {
    if (!confirm('确认清空所有数据？此操作不可恢复。')) return;
    if (!confirm('再次确认：所有记录和历史将被永久删除。')) return;

    DataManager.clearAllData();
    this.renderTable();
    this.updateStats();
    this.showToast('数据已清空', 'warning');
  },

  showDiff(diff) {
    const section = document.getElementById('diffSection');
    const container = document.getElementById('diffContainer');

    let html = '';

    if (diff.added.length > 0) {
      html += `<div class="diff-col new"><h4>🆕 新增记录 (${diff.added.length})</h4>`;
      for (const r of diff.added) {
        html += `<div class="diff-item"><span class="diff-label">${r.songName || r.fileName || '未命名'}</span><span class="diff-value new">${r.city || ''} ${r.performanceDate || ''}</span></div>`;
      }
      html += `</div>`;
    }

    if (diff.modified.length > 0) {
      html += `<div class="diff-col old"><h4>✏️ 修改记录 (${diff.modified.length})</h4>`;
      for (const m of diff.modified) {
        html += `<div class="diff-item"><span class="diff-label">${m.new.songName || m.new.fileName || '未命名'}</span></div>`;
        for (const c of m.changes) {
          html += `<div class="diff-item"><span class="diff-label">${c.fieldLabel}</span><span class="diff-value old">${c.oldValue}</span></div>`;
          html += `<div class="diff-item"><span class="diff-label">→</span><span class="diff-value new">${c.newValue}</span></div>`;
        }
      }
      html += `</div>`;
    }

    if (diff.deleted.length > 0) {
      html += `<div class="diff-col old"><h4>🗑️ 删除记录 (${diff.deleted.length})</h4>`;
      for (const r of diff.deleted) {
        html += `<div class="diff-item"><span class="diff-label">${r.songName || r.fileName || '未命名'}</span><span class="diff-value old">${r.city || ''} ${r.performanceDate || ''}</span></div>`;
      }
      html += `</div>`;
    }

    if (!diff.added.length && !diff.modified.length) {
      html += `<div class="diff-summary">无差异</div>`;
    } else {
      const summary = [];
      if (diff.added.length) summary.push(`新增 ${diff.added.length} 条`);
      if (diff.modified.length) summary.push(`修改 ${diff.modified.length} 条`);
      if (diff.deleted.length) summary.push(`删除 ${diff.deleted.length} 条`);
      html += `<div class="diff-summary">补录差异总结：${summary.join('，')}。请核对以上变化是否符合预期。</div>`;
    }

    container.innerHTML = html;
    section.style.display = 'block';
  },

  hideDiff() {
    document.getElementById('diffSection').style.display = 'none';
  },

  openModal(id) {
    document.getElementById(id).classList.add('show');
    if (id === 'modal') {
      document.getElementById('modalFooter').style.display = 'flex';
    }
  },

  closeModal(id) {
    document.getElementById(id).classList.remove('show');
    this.editingRecordId = null;
  },

  showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type;
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  formatDateTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
