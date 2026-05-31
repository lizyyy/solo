const App = (() => {
  let currentTab = 'review';
  let currentFilter = JSON.parse(localStorage.getItem('fire_escape_filter') || 'null') || { status: 'all', className: 'all', search: '', dateFrom: '', dateTo: '' };
  let selectedIds = new Set();
  let lastSnapshot = null;

  const STATUS_LABELS = {
    pending: '待处理',
    reviewing: '复核中',
    corrected: '已修正',
    approved: '已通过'
  };

  const STATUS_COLORS = {
    pending: '#ff9800',
    reviewing: '#2196f3',
    corrected: '#9c27b0',
    approved: '#4caf50'
  };

  function init() {
    _renderNavigation();
    _renderUserBar();
    _bindGlobalEvents();
    _applyFilter();
    switchTab('review');
  }

  function _renderNavigation() {
    const nav = document.getElementById('nav-tabs');
    if (!nav) return;
    const tabs = [
      { id: 'review', label: '复核', icon: '📋' },
      { id: 'import', label: '导入', icon: '📥' },
      { id: 'correct', label: '修正', icon: '✏️' },
      { id: 'history', label: '历史', icon: '📜' },
      { id: 'export', label: '导出', icon: '📤' },
      { id: 'scene', label: '3D场景', icon: '🏠' }
    ];

    nav.innerHTML = tabs.map(t =>
      `<button class="nav-tab ${t.id === currentTab ? 'active' : ''}" data-tab="${t.id}">${t.icon} ${t.label}</button>`
    ).join('');
  }

  function _renderUserBar() {
    const bar = document.getElementById('user-bar');
    if (!bar) return;
    const user = FireEscapeStore.getUser();
    bar.innerHTML = `
      <span class="user-label">当前操作人：</span>
      <input type="text" id="user-name" value="${user}" class="user-input" />
      <button id="save-user" class="btn btn-sm">保存</button>
    `;
    document.getElementById('save-user').addEventListener('click', () => {
      const name = document.getElementById('user-name').value.trim();
      if (name) {
        FireEscapeStore.setUser(name);
        _showToast('操作人已更新为: ' + name);
      }
    });
  }

  function _bindGlobalEvents() {
    document.getElementById('nav-tabs').addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (tab) switchTab(tab.dataset.tab);
    });

    window.addEventListener('beforeunload', () => {
      lastSnapshot = FireEscapeStore.getSnapshot(currentFilter);
    });
  }

  function switchTab(tabId) {
    currentTab = tabId;
    selectedIds.clear();

    document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));

    const content = document.getElementById('main-content');
    content.innerHTML = '';

    switch (tabId) {
      case 'review': _renderReview(content); break;
      case 'import': _renderImport(content); break;
      case 'correct': _renderCorrect(content); break;
      case 'history': _renderHistory(content); break;
      case 'export': _renderExport(content); break;
      case 'scene': _renderScene(content); break;
    }
  }

  function _applyFilter() {
    currentFilter = {
      status: document.getElementById('filter-status')?.value || currentFilter.status,
      className: document.getElementById('filter-class')?.value || currentFilter.className,
      search: document.getElementById('filter-search')?.value || currentFilter.search,
      dateFrom: document.getElementById('filter-date-from')?.value || currentFilter.dateFrom,
      dateTo: document.getElementById('filter-date-to')?.value || currentFilter.dateTo
    };
    localStorage.setItem('fire_escape_filter', JSON.stringify(currentFilter));
  }

  function _renderFilterBar(container, extraActions) {
    const classes = FireEscapeStore.getClasses();
    const counts = FireEscapeStore.getStatusCounts();

    const bar = document.createElement('div');
    bar.className = 'filter-bar';
    bar.innerHTML = `
      <div class="filter-row">
        <div class="filter-group">
          <label>状态</label>
          <select id="filter-status" class="filter-select">
            <option value="all" ${currentFilter.status === 'all' ? 'selected' : ''}>全部 (${Object.values(counts).reduce((a, b) => a + b, 0)})</option>
            <option value="pending" ${currentFilter.status === 'pending' ? 'selected' : ''}>待处理 (${counts.pending})</option>
            <option value="reviewing" ${currentFilter.status === 'reviewing' ? 'selected' : ''}>复核中 (${counts.reviewing})</option>
            <option value="corrected" ${currentFilter.status === 'corrected' ? 'selected' : ''}>已修正 (${counts.corrected})</option>
            <option value="approved" ${currentFilter.status === 'approved' ? 'selected' : ''}>已通过 (${counts.approved})</option>
          </select>
        </div>
        <div class="filter-group">
          <label>班级</label>
          <select id="filter-class" class="filter-select">
            <option value="all" ${currentFilter.className === 'all' ? 'selected' : ''}>全部班级</option>
            ${classes.map(c => `<option value="${c}" ${currentFilter.className === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label>搜索</label>
          <input type="text" id="filter-search" class="filter-input" placeholder="姓名/班级/ID" value="${currentFilter.search}" />
        </div>
        <div class="filter-group">
          <label>日期从</label>
          <input type="date" id="filter-date-from" class="filter-input" value="${currentFilter.dateFrom}" />
        </div>
        <div class="filter-group">
          <label>日期至</label>
          <input type="date" id="filter-date-to" class="filter-input" value="${currentFilter.dateTo}" />
        </div>
        <button id="filter-apply" class="btn btn-primary">筛选</button>
        <button id="filter-reset" class="btn">重置</button>
      </div>
      ${extraActions || ''}
    `;
    container.appendChild(bar);

    bar.querySelector('#filter-apply').addEventListener('click', () => {
      _applyFilter();
      switchTab(currentTab);
    });

    bar.querySelector('#filter-reset').addEventListener('click', () => {
      currentFilter = { status: 'all', className: 'all', search: '', dateFrom: '', dateTo: '' };
      localStorage.setItem('fire_escape_filter', JSON.stringify(currentFilter));
      switchTab(currentTab);
    });
  }

  function _renderReview(container) {
    _renderFilterBar(container);

    const records = FireEscapeStore.getRecords(currentFilter);
    const listDiv = document.createElement('div');
    listDiv.className = 'record-list';

    if (records.length === 0) {
      listDiv.innerHTML = '<div class="empty-state">暂无记录，请先导入数据</div>';
      container.appendChild(listDiv);
      return;
    }

    const batchActions = document.createElement('div');
    batchActions.className = 'batch-bar';
    batchActions.innerHTML = `
      <span class="selected-count">已选 <strong id="sel-count">0</strong> 条</span>
      <button id="batch-reviewing" class="btn btn-sm btn-blue">批量→复核中</button>
      <button id="batch-approved" class="btn btn-sm btn-green">批量→已通过</button>
      <button id="batch-corrected" class="btn btn-sm btn-purple">批量→已修正</button>
    `;
    container.appendChild(batchActions);

    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th><input type="checkbox" id="select-all" /></th>
          <th>ID</th>
          <th>班级</th>
          <th>姓名</th>
          <th>训练日期</th>
          <th>路线</th>
          <th>成绩</th>
          <th>状态</th>
          <th>来源</th>
          <th>待处理原因</th>
          <th>最后修改</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody id="review-tbody"></tbody>
    `;
    listDiv.appendChild(table);
    container.appendChild(listDiv);

    const tbody = table.querySelector('#review-tbody');
    for (const r of records) {
      const tr = document.createElement('tr');
      tr.className = 'status-' + r.status;
      tr.innerHTML = `
        <td><input type="checkbox" class="row-check" data-id="${r.id}" ${selectedIds.has(r.id) ? 'checked' : ''} /></td>
        <td class="cell-id" title="${r.id}">${r.id.slice(0, 12)}…</td>
        <td>${_esc(r.className)}</td>
        <td>${_esc(r.studentName)}</td>
        <td>${r.trainingDate}</td>
        <td>${_esc(r.route)}</td>
        <td>${r.score != null ? r.score : '-'}</td>
        <td><span class="status-badge" style="background:${STATUS_COLORS[r.status]}">${STATUS_LABELS[r.status]}</span></td>
        <td class="cell-source" title="${_esc(r.source)}">${_esc(r.source || '-').slice(0, 15)}</td>
        <td class="cell-reason" title="${_esc(r.pendingReason || '')}">${_esc(r.pendingReason || '-').slice(0, 20)}</td>
        <td class="cell-meta">${r.updatedBy} ${r.updatedAt.slice(0, 16).replace('T', ' ')}</td>
        <td class="cell-actions">
          <button class="btn btn-sm btn-detail" data-id="${r.id}">详情</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    table.querySelector('#select-all').addEventListener('change', (e) => {
      const checked = e.target.checked;
      table.querySelectorAll('.row-check').forEach(cb => {
        cb.checked = checked;
        if (checked) selectedIds.add(cb.dataset.id);
        else selectedIds.delete(cb.dataset.id);
      });
      _updateSelCount();
    });

    table.addEventListener('change', (e) => {
      if (e.target.classList.contains('row-check')) {
        if (e.target.checked) selectedIds.add(e.target.dataset.id);
        else selectedIds.delete(e.target.dataset.id);
        _updateSelCount();
      }
    });

    table.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-detail');
      if (btn) _showDetail(btn.dataset.id);
    });

    batchActions.querySelector('#batch-reviewing').addEventListener('click', () => _batchTransition('reviewing'));
    batchActions.querySelector('#batch-approved').addEventListener('click', () => _batchTransition('approved'));
    batchActions.querySelector('#batch-corrected').addEventListener('click', () => _batchTransition('corrected'));
  }

  function _renderImport(container) {
    const div = document.createElement('div');
    div.className = 'import-panel';
    div.innerHTML = `
      <h2>导入课堂记录</h2>
      <div class="import-section">
        <h3>上传文件</h3>
        <div class="import-dropzone" id="drop-zone">
          <p>拖拽 CSV 或 JSON 文件到此处，或点击选择文件</p>
          <input type="file" id="file-input" accept=".csv,.json" class="file-input" />
        </div>
        <div class="import-source">
          <label>数据来源标记：</label>
          <input type="text" id="import-source" class="filter-input" placeholder="如：2024春季演练录入" value="手动导入" />
        </div>
      </div>
      <div class="import-section">
        <h3>生成示例数据</h3>
        <p class="hint">用于测试，生成包含多条记录的示例数据集</p>
        <div class="import-gen-row">
          <label>记录数量：</label>
          <input type="number" id="gen-count" class="filter-input" value="10" min="1" max="200" />
          <button id="gen-sample" class="btn btn-primary">生成并导入</button>
        </div>
      </div>
      <div id="import-result" class="import-result"></div>
    `;
    container.appendChild(div);

    const dropZone = div.querySelector('#drop-zone');
    const fileInput = div.querySelector('#file-input');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files.length) _handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) _handleFile(fileInput.files[0]);
    });
    div.querySelector('#gen-sample').addEventListener('click', _generateSample);
  }

  function _handleFile(file) {
    const source = document.getElementById('import-source').value.trim() || file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let data;
        if (file.name.endsWith('.json')) {
          data = JSON.parse(e.target.result);
        } else {
          data = _parseCSV(e.target.result);
        }
        const result = FireEscapeStore.importRecords(data, source);
        document.getElementById('import-result').innerHTML =
          `<div class="toast-success">导入完成：新增 ${result.added} 条，跳过 ${result.skipped} 条（重复），总计 ${result.total} 条</div>`;
        _refreshScene();
      } catch (err) {
        document.getElementById('import-result').innerHTML =
          `<div class="toast-error">导入失败：${err.message}</div>`;
      }
    };
    reader.readAsText(file);
  }

  function _parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) throw new Error('CSV 至少需要表头和一行数据');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const records = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = _splitCSVLine(lines[i]);
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (vals[idx] || '').trim(); });
      records.push(obj);
    }
    return records;
  }

  function _splitCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { result.push(current); current = ''; }
        else { current += ch; }
      }
    }
    result.push(current);
    return result;
  }

  function _generateSample() {
    const count = Math.min(Math.max(parseInt(document.getElementById('gen-count').value) || 10, 1), 200);
    const source = document.getElementById('import-source').value.trim() || '示例数据';
    const classNames = ['三年一班', '三年二班', '四年一班', '四年二班', '五年一班'];
    const routes = ['默认路线', '东侧楼梯', '西侧楼梯', '中央通道', '紧急出口A', '紧急出口B'];
    const names = ['张伟', '李娜', '王芳', '刘洋', '陈明', '杨丽', '赵强', '黄敏', '周杰', '吴静',
      '徐磊', '孙燕', '马超', '朱红', '胡波', '郭晶', '何军', '林慧', '罗勇', '梁萍'];

    const data = [];
    for (let i = 0; i < count; i++) {
      data.push({
        externalId: 'SAMPLE-' + (Date.now().toString(36)) + '-' + i,
        className: classNames[Math.floor(Math.random() * classNames.length)],
        studentName: names[Math.floor(Math.random() * names.length)] + (Math.floor(Math.random() * 30) + 1),
        trainingDate: '2024-' + String(Math.floor(Math.random() * 3) + 9).padStart(2, '0') + '-' + String(Math.floor(Math.random() * 28) + 1).padStart(2, '0'),
        route: routes[Math.floor(Math.random() * routes.length)],
        score: Math.floor(Math.random() * 40) + 60
      });
    }

    const result = FireEscapeStore.importRecords(data, source);
    document.getElementById('import-result').innerHTML =
      `<div class="toast-success">示例数据已导入：新增 ${result.added} 条，总计 ${result.total} 条</div>`;
    _refreshScene();
  }

  function _renderCorrect(container) {
    _renderFilterBar(container);

    const records = FireEscapeStore.getRecords(currentFilter);
    const div = document.createElement('div');
    div.className = 'correct-panel';

    if (records.length === 0) {
      div.innerHTML = '<div class="empty-state">无匹配记录</div>';
      container.appendChild(div);
      return;
    }

    const batchBar = document.createElement('div');
    batchBar.className = 'batch-bar';
    batchBar.innerHTML = `
      <span class="selected-count">已选 <strong id="sel-count">0</strong> 条</span>
      <button id="batch-edit" class="btn btn-sm btn-blue">批量修正</button>
    `;
    container.appendChild(batchBar);

    const listHtml = records.map(r => `
      <div class="correct-card status-${r.status}" data-id="${r.id}">
        <div class="card-header">
          <label class="card-check"><input type="checkbox" class="row-check" data-id="${r.id}" ${selectedIds.has(r.id) ? 'checked' : ''} /></label>
          <span class="status-badge" style="background:${STATUS_COLORS[r.status]}">${STATUS_LABELS[r.status]}</span>
          <span class="card-id">${r.id.slice(0, 15)}…</span>
          <span class="card-meta">${r.updatedBy} · ${r.updatedAt.slice(0, 16).replace('T', ' ')}</span>
        </div>
        <div class="card-body">
          <div class="card-field"><label>班级</label><span>${_esc(r.className)}</span></div>
          <div class="card-field"><label>姓名</label><span>${_esc(r.studentName)}</span></div>
          <div class="card-field"><label>日期</label><span>${r.trainingDate}</span></div>
          <div class="card-field"><label>路线</label><span>${_esc(r.route)}</span></div>
          <div class="card-field"><label>成绩</label><span>${r.score != null ? r.score : '-'}</span></div>
          <div class="card-field"><label>来源</label><span>${_esc(r.source || '-')}</span></div>
          <div class="card-field full"><label>待处理原因</label><span>${_esc(r.pendingReason || '-')}</span></div>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm btn-edit" data-id="${r.id}">编辑</button>
          <button class="btn btn-sm btn-del" data-id="${r.id}">删除</button>
        </div>
      </div>
    `).join('');
    div.innerHTML = listHtml;
    container.appendChild(div);

    div.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.btn-edit');
      const delBtn = e.target.closest('.btn-del');
      if (editBtn) _showEditModal(editBtn.dataset.id);
      if (delBtn) _confirmDelete(delBtn.dataset.id);
    });

    div.addEventListener('change', (e) => {
      if (e.target.classList.contains('row-check')) {
        if (e.target.checked) selectedIds.add(e.target.dataset.id);
        else selectedIds.delete(e.target.dataset.id);
        _updateSelCount();
      }
    });

    batchBar.querySelector('#batch-edit').addEventListener('click', _batchEdit);
  }

  function _renderHistory(container) {
    const history = FireEscapeStore.getHistory();

    const div = document.createElement('div');
    div.className = 'history-panel';
    div.innerHTML = `
      <h2>操作历史</h2>
      <div class="history-controls">
        <input type="text" id="history-search" class="filter-input" placeholder="按记录ID或操作人搜索" />
        <button id="history-clear" class="btn btn-danger">清空所有数据</button>
      </div>
      <div class="history-timeline" id="history-timeline"></div>
    `;
    container.appendChild(div);

    const timeline = div.querySelector('#history-timeline');
    const sorted = [...history].reverse();
    if (sorted.length === 0) {
      timeline.innerHTML = '<div class="empty-state">暂无操作历史</div>';
    } else {
      timeline.innerHTML = sorted.slice(0, 200).map(h => `
        <div class="history-item">
          <div class="history-time">${h.timestamp.slice(0, 19).replace('T', ' ')}</div>
          <div class="history-content">
            <span class="history-operator">${_esc(h.operator)}</span>
            <span class="history-action action-${h.action}">${h.action === 'create' ? '创建' : h.action === 'update' ? '修改' : h.action === 'status_change' ? '状态变更' : '删除'}</span>
            <span class="history-detail">${_esc(h.detail)}</span>
            <span class="history-record-id" title="${h.recordId}">记录: ${h.recordId.slice(0, 12)}…</span>
            ${h.oldValue ? `<span class="history-diff">${_esc(h.oldValue)} → ${_esc(h.newValue)}</span>` : ''}
          </div>
        </div>
      `).join('');
    }

    div.querySelector('#history-search').addEventListener('input', (e) => {
      const s = e.target.value.toLowerCase();
      timeline.querySelectorAll('.history-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(s) ? '' : 'none';
      });
    });

    div.querySelector('#history-clear').addEventListener('click', () => {
      if (confirm('确定要清空所有记录和历史吗？此操作不可恢复！')) {
        FireEscapeStore.clearAll();
        _showToast('所有数据已清空');
        switchTab(currentTab);
        _refreshScene();
      }
    });
  }

  function _renderExport(container) {
    const snapshot = FireEscapeStore.getSnapshot(currentFilter);
    lastSnapshot = snapshot;

    const div = document.createElement('div');
    div.className = 'export-panel';
    div.innerHTML = `
      <h2>导出课堂记录</h2>
      <div class="export-snapshot">
        <h3>当前筛选快照</h3>
        <div class="snapshot-grid">
          <div class="snapshot-item"><label>筛选条件</label><span>${_describeFilter(currentFilter)}</span></div>
          <div class="snapshot-item"><label>匹配记录数</label><span>${snapshot.recordCount}</span></div>
          <div class="snapshot-item"><label>快照时间</label><span>${snapshot.timestamp.slice(0, 19).replace('T', ' ')}</span></div>
          <div class="snapshot-item"><label>待处理</label><span>${snapshot.statusCounts.pending}</span></div>
          <div class="snapshot-item"><label>复核中</label><span>${snapshot.statusCounts.reviewing}</span></div>
          <div class="snapshot-item"><label>已修正</label><span>${snapshot.statusCounts.corrected}</span></div>
          <div class="snapshot-item"><label>已通过</label><span>${snapshot.statusCounts.approved}</span></div>
        </div>
      </div>
      <div class="export-actions">
        <button id="export-csv" class="btn btn-primary">导出 CSV</button>
        <button id="export-json" class="btn btn-primary">导出 JSON</button>
      </div>
      <div id="export-preview" class="export-preview"></div>
    `;
    container.appendChild(div);

    div.querySelector('#export-csv').addEventListener('click', () => {
      const csv = FireEscapeStore.exportAsCSV(currentFilter);
      _downloadFile(csv, 'fire_escape_records.csv', 'text/csv');
      _showToast('CSV 已导出');
    });

    div.querySelector('#export-json').addEventListener('click', () => {
      const json = FireEscapeStore.exportAsJSON(currentFilter);
      _downloadFile(json, 'fire_escape_records.json', 'application/json');
      _showToast('JSON 已导出');
    });

    const previewCount = Math.min(FireEscapeStore.getRecords(currentFilter).length, 5);
    if (previewCount > 0) {
      const records = FireEscapeStore.getRecords(currentFilter).slice(0, 5);
      div.querySelector('#export-preview').innerHTML = `
        <h3>预览（前 ${previewCount} 条）</h3>
        <table class="data-table compact">
          <thead><tr><th>ID</th><th>班级</th><th>姓名</th><th>日期</th><th>路线</th><th>成绩</th><th>状态</th></tr></thead>
          <tbody>${records.map(r => `<tr>
            <td>${r.id.slice(0, 12)}…</td><td>${_esc(r.className)}</td><td>${_esc(r.studentName)}</td>
            <td>${r.trainingDate}</td><td>${_esc(r.route)}</td><td>${r.score != null ? r.score : '-'}</td>
            <td><span class="status-badge" style="background:${STATUS_COLORS[r.status]}">${STATUS_LABELS[r.status]}</span></td>
          </tr>`).join('')}</tbody>
        </table>
        ${FireEscapeStore.getRecords(currentFilter).length > 5 ? '<p class="hint">…还有更多记录，请导出查看完整数据</p>' : ''}
      `;
    }
  }

  function _renderScene(container) {
    const div = document.createElement('div');
    div.className = 'scene-panel';
    div.innerHTML = `
      <div class="scene-header">
        <h2>3D 逃生路线可视化</h2>
        <button id="scene-reset-cam" class="btn">重置视角</button>
      </div>
      <div id="three-container" class="three-container"></div>
      <div class="scene-legend">
        <h3>路线图例</h3>
        <div id="scene-legend-items" class="legend-items"></div>
      </div>
    `;
    container.appendChild(div);

    requestAnimationFrame(() => {
      FireEscapeScene.init('three-container');
      _refreshScene();

      const legendItems = document.getElementById('scene-legend-items');
      const routeColors = {
        '默认路线': '#4fc3f7', '东侧楼梯': '#66bb6a', '西侧楼梯': '#ffa726',
        '中央通道': '#ef5350', '紧急出口A': '#ab47bc', '紧急出口B': '#26c6da'
      };
      legendItems.innerHTML = Object.entries(routeColors).map(([name, color]) =>
        `<div class="legend-item"><span class="legend-color" style="background:${color}"></span>${name}</div>`
      ).join('');

      document.getElementById('scene-reset-cam').addEventListener('click', () => {
        FireEscapeScene.resetCamera();
      });
    });
  }

  function _refreshScene() {
    if (currentTab === 'scene') {
      const records = FireEscapeStore.getRecords();
      FireEscapeScene.updateRoutes(records);
    }
  }

  function _showDetail(recordId) {
    const record = FireEscapeStore.getRecordById(recordId);
    if (!record) return;
    const history = FireEscapeStore.getHistory(recordId);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>记录详情</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-item"><label>ID</label><span>${record.id}</span></div>
            <div class="detail-item"><label>外部ID</label><span>${record.externalId || '-'}</span></div>
            <div class="detail-item"><label>班级</label><span>${_esc(record.className)}</span></div>
            <div class="detail-item"><label>姓名</label><span>${_esc(record.studentName)}</span></div>
            <div class="detail-item"><label>训练日期</label><span>${record.trainingDate}</span></div>
            <div class="detail-item"><label>路线</label><span>${_esc(record.route)}</span></div>
            <div class="detail-item"><label>成绩</label><span>${record.score != null ? record.score : '-'}</span></div>
            <div class="detail-item"><label>状态</label><span class="status-badge" style="background:${STATUS_COLORS[record.status]}">${STATUS_LABELS[record.status]}</span></div>
            <div class="detail-item"><label>来源</label><span>${_esc(record.source || '-')}</span></div>
            <div class="detail-item"><label>待处理原因</label><span>${_esc(record.pendingReason || '-')}</span></div>
            <div class="detail-item"><label>创建人</label><span>${_esc(record.createdBy)}</span></div>
            <div class="detail-item"><label>创建时间</label><span>${record.createdAt.slice(0, 19).replace('T', ' ')}</span></div>
            <div class="detail-item"><label>最后修改人</label><span>${_esc(record.updatedBy)}</span></div>
            <div class="detail-item"><label>最后修改时间</label><span>${record.updatedAt.slice(0, 19).replace('T', ' ')}</span></div>
          </div>
          <h4>变更历史</h4>
          <div class="history-timeline compact">
            ${history.length === 0 ? '<div class="empty-state">无变更记录</div>' :
              history.map(h => `
                <div class="history-item">
                  <div class="history-time">${h.timestamp.slice(0, 19).replace('T', ' ')}</div>
                  <div class="history-content">
                    <span class="history-operator">${_esc(h.operator)}</span>
                    <span class="history-action action-${h.action}">${h.action === 'create' ? '创建' : h.action === 'update' ? '修改' : h.action === 'status_change' ? '状态变更' : '删除'}</span>
                    <span class="history-detail">${_esc(h.detail)}</span>
                    ${h.oldValue ? `<span class="history-diff">${_esc(h.oldValue)} → ${_esc(h.newValue)}</span>` : ''}
                  </div>
                </div>
              `).join('')}
          </div>
        </div>
        <div class="modal-footer">
          ${record.status === 'pending' ? '<button class="btn btn-blue" data-action="reviewing">→复核中</button>' : ''}
          ${record.status === 'reviewing' ? '<button class="btn btn-green" data-action="approved">→已通过</button>' : ''}
          ${record.status === 'reviewing' ? '<button class="btn btn-purple" data-action="corrected">→已修正</button>' : ''}
          ${record.status === 'corrected' ? '<button class="btn btn-green" data-action="approved">→已通过</button>' : ''}
          ${record.status === 'approved' ? '<button class="btn btn-purple" data-action="corrected">→已修正</button>' : ''}
          <button class="btn modal-close-btn">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeModal = () => {
      document.body.removeChild(modal);
      switchTab(currentTab);
    };

    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('modal-close') || e.target.classList.contains('modal-close-btn')) {
        closeModal();
      }
      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn) {
        const newStatus = actionBtn.dataset.action;
        const reason = prompt(`请输入将状态变更为"${STATUS_LABELS[newStatus]}"的原因：`);
        if (reason !== null) {
          const result = FireEscapeStore.transitionStatus(recordId, newStatus, reason);
          if (result.success) {
            _showToast('状态已更新');
            closeModal();
          } else {
            _showToast('操作失败：' + result.error);
          }
        }
      }
    });
  }

  function _showEditModal(recordId) {
    const record = FireEscapeStore.getRecordById(recordId);
    if (!record) return;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>编辑记录</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="edit-form" class="edit-form">
            <div class="form-row">
              <label>班级</label>
              <input type="text" name="className" value="${_esc(record.className)}" />
            </div>
            <div class="form-row">
              <label>姓名</label>
              <input type="text" name="studentName" value="${_esc(record.studentName)}" />
            </div>
            <div class="form-row">
              <label>训练日期</label>
              <input type="date" name="trainingDate" value="${record.trainingDate}" />
            </div>
            <div class="form-row">
              <label>路线</label>
              <select name="route">
                ${['默认路线', '东侧楼梯', '西侧楼梯', '中央通道', '紧急出口A', '紧急出口B'].map(r =>
                  `<option value="${r}" ${record.route === r ? 'selected' : ''}>${r}</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-row">
              <label>成绩</label>
              <input type="number" name="score" value="${record.score != null ? record.score : ''}" min="0" max="100" />
            </div>
            <div class="form-row">
              <label>修改原因</label>
              <input type="text" name="reason" required placeholder="必填：说明修改原因" />
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button id="edit-save" class="btn btn-primary">保存</button>
          <button class="btn modal-close-btn">取消</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeModal = () => {
      if (modal.parentNode) document.body.removeChild(modal);
    };

    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('modal-close') || e.target.classList.contains('modal-close-btn')) {
        closeModal();
      }
    });

    modal.querySelector('#edit-save').addEventListener('click', () => {
      const form = modal.querySelector('#edit-form');
      const formData = new FormData(form);
      const reason = formData.get('reason');
      if (!reason.trim()) {
        _showToast('修改原因不能为空');
        return;
      }

      const updates = {
        className: formData.get('className'),
        studentName: formData.get('studentName'),
        trainingDate: formData.get('trainingDate'),
        route: formData.get('route'),
        score: formData.get('score') !== '' ? Number(formData.get('score')) : null
      };

      FireEscapeStore.updateRecord(recordId, updates, reason);
      _showToast('记录已更新');
      closeModal();
      switchTab(currentTab);
    });
  }

  function _confirmDelete(recordId) {
    const reason = prompt('请输入删除原因：');
    if (reason !== null) {
      FireEscapeStore.deleteRecord(recordId, reason);
      _showToast('记录已删除');
      switchTab(currentTab);
    }
  }

  function _batchTransition(newStatus) {
    if (selectedIds.size === 0) {
      _showToast('请先选择记录');
      return;
    }
    const reason = prompt(`批量变更状态为"${STATUS_LABELS[newStatus]}"，请输入原因：`);
    if (reason === null) return;

    const result = FireEscapeStore.batchTransitionStatus([...selectedIds], newStatus, reason);
    selectedIds.clear();
    _showToast(`成功 ${result.success.length} 条，失败 ${result.failed.length} 条`);
    switchTab(currentTab);
  }

  function _batchEdit() {
    if (selectedIds.size === 0) {
      _showToast('请先选择记录');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>批量修正（${selectedIds.size} 条）</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="batch-edit-form" class="edit-form">
            <div class="form-row">
              <label>班级</label>
              <input type="text" name="className" placeholder="留空则不修改" />
            </div>
            <div class="form-row">
              <label>路线</label>
              <select name="route">
                <option value="">不修改</option>
                ${['默认路线', '东侧楼梯', '西侧楼梯', '中央通道', '紧急出口A', '紧急出口B'].map(r =>
                  `<option value="${r}">${r}</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-row">
              <label>成绩</label>
              <input type="number" name="score" placeholder="留空则不修改" min="0" max="100" />
            </div>
            <div class="form-row">
              <label>修改原因</label>
              <input type="text" name="reason" required placeholder="必填：说明批量修改原因" />
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button id="batch-edit-save" class="btn btn-primary">保存</button>
          <button class="btn modal-close-btn">取消</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeModal = () => {
      if (modal.parentNode) document.body.removeChild(modal);
    };

    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('modal-close') || e.target.classList.contains('modal-close-btn')) {
        closeModal();
      }
    });

    modal.querySelector('#batch-edit-save').addEventListener('click', () => {
      const form = modal.querySelector('#batch-edit-form');
      const formData = new FormData(form);
      const reason = formData.get('reason');
      if (!reason.trim()) {
        _showToast('修改原因不能为空');
        return;
      }

      const updates = {};
      if (formData.get('className')) updates.className = formData.get('className');
      if (formData.get('route')) updates.route = formData.get('route');
      if (formData.get('score') !== '') updates.score = Number(formData.get('score'));

      if (Object.keys(updates).length === 0) {
        _showToast('请至少填写一个修改项');
        return;
      }

      FireEscapeStore.batchUpdate([...selectedIds], updates, reason);
      selectedIds.clear();
      _showToast('批量修正完成');
      closeModal();
      switchTab(currentTab);
    });
  }

  function _updateSelCount() {
    const el = document.getElementById('sel-count');
    if (el) el.textContent = selectedIds.size;
  }

  function _describeFilter(filter) {
    const parts = [];
    if (filter.status !== 'all') parts.push(`状态=${STATUS_LABELS[filter.status]}`);
    if (filter.className !== 'all') parts.push(`班级=${filter.className}`);
    if (filter.search) parts.push(`搜索="${filter.search}"`);
    if (filter.dateFrom) parts.push(`从${filter.dateFrom}`);
    if (filter.dateTo) parts.push(`至${filter.dateTo}`);
    return parts.length ? parts.join('，') : '无筛选（全部）';
  }

  function _downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function _showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => { if (toast.parentNode) document.body.removeChild(toast); }, 400);
    }, 2500);
  }

  function _esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { init, switchTab };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
