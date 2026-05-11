function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function openModal(content, title = '') {
  const container = document.getElementById('modal-container');
  container.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal">
        ${title ? `<div class="modal-header">
          <h2>${escapeHtml(title)}</h2>
          <button class="modal-close" id="modal-close">&times;</button>
        </div>` : ''}
        <div class="modal-body">${content}</div>
      </div>
    </div>
  `;

  const overlay = document.getElementById('modal-overlay');
  const closeBtn = document.getElementById('modal-close');

  const close = () => container.innerHTML = '';

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', close);
  }

  return { close };
}

const UI = {
  currentTab: 'tasks',

  state: {
    taskFilters: {},
    facilityFilters: {}
  },

  render(tab = this.currentTab) {
    this.currentTab = tab;

    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });

    const main = document.getElementById('main-content');

    switch (tab) {
      case 'tasks':
        main.innerHTML = this.renderTasksTab();
        this.bindTasksEvents();
        break;
      case 'facilities':
        main.innerHTML = this.renderFacilitiesTab();
        this.bindFacilitiesEvents();
        break;
      case 'problems':
        main.innerHTML = this.renderProblemsTab();
        this.bindProblemsEvents();
        break;
      case 'stats':
        main.innerHTML = this.renderStatsTab();
        this.bindStatsEvents();
        break;
    }
  },

  renderTasksTab() {
    const tasks = PriorityEngine.getTasksSortedByPriority(this.state.taskFilters);
    const facilities = DataStore.getFacilities();

    if (tasks.length === 0) {
      return `
        <div class="empty-state">
          <h3>暂无维修任务</h3>
          <p>创建设施并上报破损记录后，系统会自动生成维修任务</p>
        </div>
      `;
    }

    return `
      <div class="filters">
        <div class="filter-group">
          <label>状态</label>
          <select id="filter-task-status">
            <option value="">全部状态</option>
            ${TASK_STATUSES.map(s => `<option value="${s.value}" ${this.state.taskFilters.status === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label>设施类型</label>
          <select id="filter-task-type">
            <option value="">全部类型</option>
            ${FACILITY_TYPES.map(t => `<option value="${t.value}" ${this.state.taskFilters.facilityType === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label>最小优先级分数</label>
          <select id="filter-task-min-priority">
            <option value="">不限</option>
            <option value="18" ${this.state.taskFilters.minPriority === 18 ? 'selected' : ''}>≥ 18 (紧急)</option>
            <option value="13" ${this.state.taskFilters.minPriority === 13 ? 'selected' : ''}>≥ 13 (高)</option>
            <option value="8" ${this.state.taskFilters.minPriority === 8 ? 'selected' : ''}>≥ 8 (中)</option>
          </select>
        </div>
        <div class="filter-group">
          <label>搜索</label>
          <input type="text" id="filter-task-search" placeholder="设施名称/位置..." value="${this.state.taskFilters.search || ''}">
        </div>
        <button class="btn btn-sm btn-outline" id="reset-task-filters">重置筛选</button>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>优先级</th>
              <th>分数</th>
              <th>设施</th>
              <th>类型</th>
              <th>破损等级</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.map((task, index) => {
              const facility = DataStore.getFacilityById(task.facilityId);
              const damage = DataStore.getDamageReportById(task.damageId);
              const facilityType = facility ? FACILITY_TYPES.find(t => t.value === facility.type) : null;
              const damageLevel = damage ? DAMAGE_LEVELS.find(l => l.value === damage.level) : null;
              const statusInfo = TASK_STATUSES.find(s => s.value === task.status);
              const nextStatus = statusInfo ? TASK_STATUSES.find(s => s.value === statusInfo.next) : null;

              return `
                <tr>
                  <td>
                    <span class="priority-badge ${PriorityEngine.getPriorityBadgeClass(task.priority)}">
                      ${PriorityEngine.getPriorityLabel(task.priority)}
                    </span>
                    <small style="display:block;color:#666">#${index + 1}</small>
                  </td>
                  <td>
                    <strong>${task.priority.toFixed(1)}</strong>
                    <small style="display:block;color:#666">/ ${PriorityEngine.MAX_SCORE}</small>
                  </td>
                  <td>
                    <div><strong>${facility ? escapeHtml(facility.name) : '未知设施'}</strong></div>
                    <small style="color:#666">${facility ? escapeHtml(facility.location) : ''}</small>
                  </td>
                  <td>${facilityType ? `<span class="facility-type">${facilityType.label}</span>` : '-'}</td>
                  <td>${damageLevel ? `<span class="damage-badge damage-${damageLevel.value}">${damageLevel.label}</span>` : '-'}</td>
                  <td><span class="status-badge status-${task.status}">${statusInfo ? statusInfo.label : task.status}</span></td>
                  <td>${formatDateShort(task.createdAt)}</td>
                  <td>
                    <div class="action-buttons">
                      <button class="btn btn-sm btn-outline" data-action="view-task" data-id="${task.id}">详情</button>
                      ${nextStatus ? `<button class="btn btn-sm btn-primary" data-action="advance-task" data-id="${task.id}">${nextStatus.label}</button>` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderFacilitiesTab() {
    const facilities = DataStore.getFacilities();

    if (facilities.length === 0) {
      return `
        <div class="empty-state">
          <h3>暂无设施</h3>
          <p>点击右上角"+新建设施"开始添加</p>
        </div>
      `;
    }

    return `
      <div class="filters">
        <div class="filter-group">
          <label>设施类型</label>
          <select id="filter-facility-type">
            <option value="">全部类型</option>
            ${FACILITY_TYPES.map(t => `<option value="${t.value}" ${this.state.facilityFilters.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <label>搜索</label>
          <input type="text" id="filter-facility-search" placeholder="设施名称/位置..." value="${this.state.facilityFilters.search || ''}">
        </div>
        <button class="btn btn-sm btn-outline" id="reset-facility-filters">重置筛选</button>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>设施名称</th>
              <th>类型</th>
              <th>位置</th>
              <th>风险系数</th>
              <th>安装日期</th>
              <th>当前破损</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${facilities
              .filter(f => {
                if (this.state.facilityFilters.type && f.type !== this.state.facilityFilters.type) return false;
                if (this.state.facilityFilters.search) {
                  const q = this.state.facilityFilters.search.toLowerCase();
                  return f.name.toLowerCase().includes(q) || f.location.toLowerCase().includes(q);
                }
                return true;
              })
              .map(facility => {
                const facilityType = FACILITY_TYPES.find(t => t.value === facility.type);
                const activeDamage = DataStore.getActiveDamageReportByFacility(facility.id);
                const damageLevel = activeDamage ? DAMAGE_LEVELS.find(l => l.value === activeDamage.level) : null;

                return `
                  <tr>
                    <td><strong>${escapeHtml(facility.name)}</strong></td>
                    <td>${facilityType ? `<span class="facility-type">${facilityType.label}</span>` : '-'}</td>
                    <td>${escapeHtml(facility.location)}</td>
                    <td>
                      <strong>${facilityType ? facilityType.riskMultiplier.toFixed(1) : '-'}</strong>
                      <small style="color:#666">× 4</small>
                    </td>
                    <td>${formatDateShort(facility.installDate)}</td>
                    <td>
                      ${activeDamage
                        ? `<span class="damage-badge damage-${damageLevel.value}">${damageLevel.label}</span>`
                        : '<span style="color:#00b894">无</span>'}
                    </td>
                    <td>
                      <div class="action-buttons">
                        <button class="btn btn-sm btn-outline" data-action="view-facility" data-id="${facility.id}">详情</button>
                        <button class="btn btn-sm btn-primary" data-action="report-damage" data-id="${facility.id}">报破损</button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderProblemsTab() {
    const problems = DataStore.getProblems();

    if (problems.length === 0) {
      return `
        <div class="empty-state">
          <h3>暂无问题数据</h3>
          <p>数据导入或创建时的无效数据会显示在这里</p>
        </div>
      `;
    }

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <p style="color:#666">共 ${problems.length} 条问题记录（原始数据保留，方便排查）</p>
        <button class="btn btn-sm btn-danger" id="clear-all-problems">清空问题列表</button>
      </div>
      ${problems
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(p => `
          <div class="problem-item">
            <div class="problem-header">
              <span class="problem-type">${escapeHtml(p.type)}</span>
              <span class="problem-source">来源: ${escapeHtml(p.source || 'unknown')}</span>
            </div>
            <div class="problem-message">${escapeHtml(p.message)}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div class="problem-data">${escapeHtml(p.rawData || '无原始数据')}</div>
              <button class="btn btn-sm btn-outline" data-action="clear-problem" data-id="${p.id}" style="margin-left:12px;flex-shrink:0;">清除</button>
            </div>
            <small style="color:#999">${formatDate(p.createdAt)}</small>
          </div>
        `).join('')}
    `;
  },

  renderStatsTab() {
    const facilities = DataStore.getFacilities();
    const damageReports = DataStore.getDamageReports();
    const tasks = DataStore.getRepairTasks();
    const problems = DataStore.getProblems();

    const statusCount = {};
    TASK_STATUSES.forEach(s => statusCount[s.value] = 0);
    tasks.forEach(t => {
      if (statusCount[t.status] !== undefined) statusCount[t.status]++;
    });

    const typeCount = {};
    FACILITY_TYPES.forEach(t => typeCount[t.value] = 0);
    facilities.forEach(f => {
      if (typeCount[f.type] !== undefined) typeCount[f.type]++;
    });

    const damageCount = {};
    DAMAGE_LEVELS.forEach(l => damageCount[l.value] = 0);
    damageReports.filter(d => d.status !== 'resolved').forEach(d => {
      if (damageCount[d.level] !== undefined) damageCount[d.level]++;
    });

    const priorityDist = { critical: 0, high: 0, medium: 0, low: 0 };
    tasks.forEach(t => {
      const cat = PriorityEngine.getPriorityCategory(t.priority);
      if (priorityDist[cat] !== undefined) priorityDist[cat]++;
    });

    const maxTasks = Math.max(...Object.values(statusCount), 1);
    const maxPriority = Math.max(...Object.values(priorityDist), 1);

    return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${facilities.length}</div>
          <div class="stat-label">设施总数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${tasks.length}</div>
          <div class="stat-label">维修任务</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${statusCount['done']}</div>
          <div class="stat-label">已完成</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${problems.length}</div>
          <div class="stat-label">问题数据</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <div class="chart-section">
          <h3>任务状态分布</h3>
          <div class="bars">
            ${TASK_STATUSES.map(s => `
              <div class="bar-row">
                <span class="bar-label">${s.label}</span>
                <div class="bar-container">
                  <div class="bar-fill" style="width:${(statusCount[s.value] / maxTasks) * 100}%;background:${s.value === 'done' ? '#00b894' : s.value === 'in-progress' ? '#0984e3' : s.value === 'assessing' ? '#fdcb6e' : '#e17055'}">
                    ${statusCount[s.value] > 0 ? statusCount[s.value] : ''}
                  </div>
                </div>
                <span class="bar-count">${statusCount[s.value]}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="chart-section">
          <h3>优先级分布</h3>
          <div class="bars">
            ${[
              { key: 'critical', label: '紧急', color: '#ff4757' },
              { key: 'high', label: '高优先级', color: '#ff6b81' },
              { key: 'medium', label: '中优先级', color: '#ffa502' },
              { key: 'low', label: '低优先级', color: '#7bed9f' }
            ].map(p => `
              <div class="bar-row">
                <span class="bar-label">${p.label}</span>
                <div class="bar-container">
                  <div class="bar-fill" style="width:${(priorityDist[p.key] / maxPriority) * 100}%;background:${p.color}">
                    ${priorityDist[p.key] > 0 ? priorityDist[p.key] : ''}
                  </div>
                </div>
                <span class="bar-count">${priorityDist[p.key]}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px;">
        <div class="chart-section">
          <h3>设施类型分布</h3>
          <div class="bars">
            ${FACILITY_TYPES
              .filter(t => typeCount[t.value] > 0)
              .map(t => `
                <div class="bar-row">
                  <span class="bar-label">${t.label}</span>
                  <div class="bar-container">
                    <div class="bar-fill" style="width:${(typeCount[t.value] / Math.max(...Object.values(typeCount), 1)) * 100}%;background:#ff6b35">
                      ${typeCount[t.value] > 0 ? typeCount[t.value] : ''}
                    </div>
                  </div>
                  <span class="bar-count">${typeCount[t.value]}</span>
                </div>
              `).join('')}
          </div>
        </div>

        <div class="chart-section">
          <h3>当前破损等级分布</h3>
          <div class="bars">
            ${DAMAGE_LEVELS.map(l => `
              <div class="bar-row">
                <span class="bar-label">${l.label}</span>
                <div class="bar-container">
                  <div class="bar-fill" style="width:${(damageCount[l.value] / Math.max(...Object.values(damageCount), 1)) * 100}%;background:${l.value === 4 ? '#ff4757' : l.value === 3 ? '#fab1a0' : l.value === 2 ? '#ffeaa7' : '#dfe6e9'};color:${l.value <= 2 ? '#2f3542' : 'white'}">
                    ${damageCount[l.value] > 0 ? damageCount[l.value] : ''}
                  </div>
                </div>
                <span class="bar-count">${damageCount[l.value]}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  renderTaskDetail(taskId) {
    const task = DataStore.getRepairTaskById(taskId);
    if (!task) return '<p>任务不存在</p>';

    const facility = DataStore.getFacilityById(task.facilityId);
    const damage = DataStore.getDamageReportById(task.damageId);
    const facilityType = facility ? FACILITY_TYPES.find(t => t.value === facility.type) : null;
    const damageLevel = damage ? DAMAGE_LEVELS.find(l => l.value === damage.level) : null;
    const statusInfo = TASK_STATUSES.find(s => s.value === task.status);
    const nextStatus = statusInfo ? TASK_STATUSES.find(s => s.value === statusInfo.next) : null;
    const bd = task.priorityBreakdown;

    const popularityRecords = DataStore.getPopularityByFacility(task.facilityId, 30);
    const avgUsage = popularityRecords.length > 0
      ? (popularityRecords.reduce((s, r) => s + (r.usageCount || 0), 0) / popularityRecords.length).toFixed(1)
      : 0;

    return `
      <div class="detail-section">
        <h3>基本信息</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-item-label">任务ID</span>
            <span class="detail-item-value">${escapeHtml(task.id)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-item-label">当前状态</span>
            <span class="detail-item-value"><span class="status-badge status-${task.status}">${statusInfo ? statusInfo.label : task.status}</span></span>
          </div>
          <div class="detail-item">
            <span class="detail-item-label">创建时间</span>
            <span class="detail-item-value">${formatDate(task.createdAt)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-item-label">更新时间</span>
            <span class="detail-item-value">${formatDate(task.updatedAt)}</span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3>关联设施</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-item-label">设施名称</span>
            <span class="detail-item-value">${facility ? escapeHtml(facility.name) : '-'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-item-label">设施类型</span>
            <span class="detail-item-value">${facilityType ? facilityType.label : '-'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-item-label">位置</span>
            <span class="detail-item-value">${facility ? escapeHtml(facility.location) : '-'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-item-label">安装日期</span>
            <span class="detail-item-value">${formatDateShort(facility ? facility.installDate : null)}</span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3>破损信息</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-item-label">破损等级</span>
            <span class="detail-item-value">${damageLevel ? `<span class="damage-badge damage-${damageLevel.value}">${damageLevel.label}</span>` : '-'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-item-label">类别</span>
            <span class="detail-item-value">${damage ? escapeHtml(damage.category) : '-'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-item-label">报告人</span>
            <span class="detail-item-value">${damage ? escapeHtml(damage.reporter || '匿名') : '-'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-item-label">报告时间</span>
            <span class="detail-item-value">${formatDate(damage ? damage.reportedAt : null)}</span>
          </div>
        </div>
        ${damage && damage.description ? `<p style="margin-top:12px;background:#f8f9fa;padding:12px;border-radius:6px;">${escapeHtml(damage.description)}</p>` : ''}
      </div>

      <div class="detail-section">
        <h3>优先级计算详情</h3>
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
          <div>
            <span class="priority-badge ${PriorityEngine.getPriorityBadgeClass(task.priority)}" style="font-size:14px;padding:6px 14px;">
              ${PriorityEngine.getPriorityLabel(task.priority)}
            </span>
          </div>
          <div>
            <strong style="font-size:24px;">${task.priority.toFixed(1)}</strong>
            <span style="color:#666"> / ${PriorityEngine.MAX_SCORE} 分</span>
            <span style="color:#666;margin-left:8px;">(归一化 ${bd ? bd.normalized : 0}%)</span>
          </div>
        </div>

        ${bd ? `
          <div class="priority-breakdown">
            <h4>📋 计算明细 (权重: 破损40% + 热度30% + 风险30%)</h4>

            <div class="priority-row">
              <div>
                <strong>🔧 破损等级 (×40%)</strong>
                <div style="color:#666;font-size:12px;">等级 ${bd.input.damageLevel} = ${bd.components.damage.rawScore} 分</div>
              </div>
              <div style="text-align:right;">
                <strong>${bd.components.damage.weightedScore.toFixed(1)}</strong>
                <div style="color:#666;font-size:12px;">= ${bd.components.damage.rawScore} × ${bd.components.damage.weight}</div>
              </div>
            </div>

            <div class="priority-row">
              <div>
                <strong>👥 使用热度 (×30%)</strong>
                <div style="color:#666;font-size:12px;">热度指数 ${bd.components.popularity.index.toFixed(1)} (近30天 ${bd.input.popularityRecords} 条记录, 日均 ${avgUsage} 次)</div>
              </div>
              <div style="text-align:right;">
                <strong>${bd.components.popularity.weightedScore.toFixed(1)}</strong>
                <div style="color:#666;font-size:12px;">= ${bd.components.popularity.index.toFixed(1)} × ${bd.components.popularity.weight}</div>
              </div>
            </div>

            <div class="priority-row">
              <div>
                <strong>⚠️ 设施风险 (×30%)</strong>
                <div style="color:#666;font-size:12px;">${facilityType ? facilityType.label : bd.input.facilityType} (风险系数 ${bd.components.risk.riskMultiplier})</div>
              </div>
              <div style="text-align:right;">
                <strong>${bd.components.risk.weightedScore.toFixed(1)}</strong>
                <div style="color:#666;font-size:12px;">= ${bd.components.risk.riskScore.toFixed(1)} × ${bd.components.risk.weight}</div>
              </div>
            </div>

            <div class="priority-row" style="border-top:2px solid #999;margin-top:8px;padding-top:12px;">
              <div><strong style="font-size:16px;">📊 总分</strong></div>
              <div style="text-align:right;"><strong style="font-size:20px;color:var(--primary);">${bd.total.toFixed(1)}</strong></div>
            </div>
          </div>
        ` : '<p style="color:#666">无优先级明细数据</p>'}
      </div>

      <div class="modal-footer">
        ${nextStatus ? `<button class="btn btn-primary" id="modal-advance-task" data-id="${task.id}">推进到: ${nextStatus.label}</button>` : '<button class="btn btn-success" disabled>✓ 已完成</button>'}
        <button class="btn btn-outline" id="modal-close-btn">关闭</button>
      </div>
    `;
  },

  renderFacilityDetail(facilityId) {
    const facility = DataStore.getFacilityById(facilityId);
    if (!facility) return '<p>设施不存在</p>';

    const facilityType = FACILITY_TYPES.find(t => t.value === facility.type);
    const damages = DataStore.getDamageReportsByFacility(facilityId);
    const activeDamage = damages.find(d => d.status !== 'resolved');
    const tasks = DataStore.getRepairTasks().filter(t => t.facilityId === facilityId);
    const popularity = DataStore.getPopularityByFacility(facilityId, 30);

    const avgUsage = popularity.length > 0
      ? (popularity.reduce((s, r) => s + (r.usageCount || 0), 0) / popularity.length).toFixed(1)
      : 0;
    const totalUsage = popularity.reduce((s, r) => s + (r.usageCount || 0), 0);

    return `
      <div class="detail-section">
        <h3>设施档案</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-item-label">设施名称</span>
            <span class="detail-item-value">${escapeHtml(facility.name)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-item-label">类型</span>
            <span class="detail-item-value">${facilityType ? `<span class="facility-type">${facilityType.label}</span>` : '-'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-item-label">位置</span>
            <span class="detail-item-value">${escapeHtml(facility.location)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-item-label">安装日期</span>
            <span class="detail-item-value">${formatDateShort(facility.installDate)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-item-label">风险系数</span>
            <span class="detail-item-value">${facilityType ? facilityType.riskMultiplier.toFixed(1) : '-'} (×4 = ${facilityType ? (facilityType.riskMultiplier * 4).toFixed(1) : '-'} 分)</span>
          </div>
          <div class="detail-item">
            <span class="detail-item-label">创建时间</span>
            <span class="detail-item-value">${formatDate(facility.createdAt)}</span>
          </div>
        </div>
        ${facility.notes ? `<p style="margin-top:12px;background:#f0f7ff;padding:12px;border-radius:6px;">📝 ${escapeHtml(facility.notes)}</p>` : ''}
      </div>

      <div class="detail-section">
        <h3>使用热度 (近30天)</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-item-label">数据条数</span>
            <span class="detail-item-value">${popularity.length}</span>
          </div>
          <div class="detail-item">
            <span class="detail-item-label">日均使用次数</span>
            <span class="detail-item-value">${avgUsage}</span>
          </div>
          <div class="detail-item">
            <span class="detail-item-label">累计使用次数</span>
            <span class="detail-item-value">${totalUsage}</span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3>当前破损状态</h3>
        ${activeDamage ? `
          <div style="background:#fff3cd;padding:12px;border-radius:6px;border-left:4px solid #ffc107;">
            <p><strong>${DAMAGE_LEVELS.find(l => l.value === activeDamage.level)?.label || '未知'}:</strong> ${escapeHtml(activeDamage.category)}</p>
            <p style="color:#666;font-size:13px;margin-top:4px;">${escapeHtml(activeDamage.description || '无描述')}</p>
            <p style="color:#666;font-size:12px;margin-top:4px;">报告人: ${escapeHtml(activeDamage.reporter || '匿名')} | ${formatDate(activeDamage.reportedAt)}</p>
          </div>
        ` : '<p style="color:#00b894;">✅ 无未解决的破损</p>'}
      </div>

      <div class="detail-section">
        <h3>历史维修任务 (${tasks.length})</h3>
        ${tasks.length > 0 ? `
          <div class="table-container">
            <table>
              <thead>
                <tr><th>优先级</th><th>状态</th><th>创建时间</th></tr>
              </thead>
              <tbody>
                ${tasks.map(t => `
                  <tr>
                    <td><span class="priority-badge ${PriorityEngine.getPriorityBadgeClass(t.priority)}">${PriorityEngine.getPriorityLabel(t.priority)}</span></td>
                    <td><span class="status-badge status-${t.status}">${TASK_STATUSES.find(s => s.value === t.status)?.label || t.status}</span></td>
                    <td>${formatDateShort(t.createdAt)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : '<p style="color:#666">暂无维修任务</p>'}
      </div>

      <div class="modal-footer">
        ${!activeDamage ? `<button class="btn btn-primary" id="modal-report-damage" data-id="${facility.id}">上报破损</button>` : ''}
        <button class="btn btn-outline" id="modal-close-btn">关闭</button>
      </div>
    `;
  },

  renderCreateFacilityForm() {
    return `
      <div class="form-group">
        <label>设施名称 *</label>
        <input type="text" id="facility-name" placeholder="例如: 主U池、东区栏杆群">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>设施类型 *</label>
          <select id="facility-type">
            <option value="">请选择...</option>
            ${FACILITY_TYPES.map(t => `<option value="${t.value}">${t.label} (风险系数: ${t.riskMultiplier})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>安装日期</label>
          <input type="date" id="facility-install-date">
        </div>
      </div>
      <div class="form-group">
        <label>位置 *</label>
        <input type="text" id="facility-location" placeholder="例如: 公园北区、东区入口">
      </div>
      <div class="form-group">
        <label>备注</label>
        <textarea id="facility-notes" rows="3" placeholder="设施描述、特殊说明等..."></textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" id="submit-create-facility">创建设施</button>
        <button class="btn btn-outline" id="modal-close-btn">取消</button>
      </div>
    `;
  },

  renderReportDamageForm(facilityId) {
    const facility = DataStore.getFacilityById(facilityId);
    if (!facility) return '<p>设施不存在</p>';

    return `
      <div style="background:#f0f7ff;padding:12px;border-radius:6px;margin-bottom:16px;">
        <strong>设施:</strong> ${escapeHtml(facility.name)} (${escapeHtml(facility.location)})
      </div>

      <div class="form-group">
        <label>破损等级 *</label>
        <select id="damage-level">
          <option value="">请选择...</option>
          ${DAMAGE_LEVELS.map(l => `<option value="${l.value}">${l.label} - ${l.description}</option>`).join('')}
        </select>
        <div class="help-text">1-轻微(4分) → 2-中等(8分) → 3-严重(12分) → 4-危险(16分)</div>
      </div>

      <div class="form-group">
        <label>破损类别 *</label>
        <select id="damage-category">
          <option value="">请选择...</option>
          ${DAMAGE_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label>描述</label>
        <textarea id="damage-description" rows="3" placeholder="详细描述破损情况..."></textarea>
      </div>

      <div class="form-group">
        <label>报告人</label>
        <input type="text" id="damage-reporter" placeholder="您的姓名">
      </div>

      <div class="modal-footer">
        <button class="btn btn-primary" id="submit-report-damage" data-facility="${facilityId}">提交并创建任务</button>
        <button class="btn btn-outline" id="modal-close-btn">取消</button>
      </div>
    `;
  },

  renderImportForm() {
    return `
      <div style="margin-bottom:16px;">
        <p style="color:#666;margin-bottom:8px;">支持 JSON 格式，与导出格式一致。</p>
        <p style="color:#d63031;font-size:13px;">⚠️ 脏数据不会被跳过，会进入「问题列表」并保留原始数据</p>
      </div>

      <div class="form-group">
        <label>数据来源</label>
        <input type="text" id="import-source" placeholder="例如: 巡检Excel导入、API同步" value="manual_import">
        <div class="help-text">用于标记问题数据的来源</div>
      </div>

      <div class="form-group">
        <label>JSON 数据 *</label>
        <textarea id="import-json" rows="12" placeholder='{
  "facilities": [...],
  "damageReports": [...],
  "popularityRecords": [...],
  "repairTasks": [...]
}'></textarea>
      </div>

      <div style="background:#f8f9fa;padding:12px;border-radius:6px;font-size:12px;">
        <strong>示例格式 (最小):</strong>
        <pre style="margin-top:8px;white-space:pre-wrap;font-family:monospace;">{
  "facilities": [
    {"name": "测试U池", "type": "halfpipe", "location": "北区"}
  ],
  "damageReports": [
    {"facilityId": "xxx", "level": 2, "category": "表面磨损"}
  ]
}</pre>
      </div>

      <div class="modal-footer">
        <button class="btn btn-primary" id="submit-import">导入数据</button>
        <button class="btn btn-outline" id="modal-close-btn">取消</button>
      </div>
    `;
  },

  renderRulesVerification() {
    const results = runAllTests();
    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    return `
      <div class="rules-panel">
        <h3>📋 优先级规则配置</h3>
        <div class="rule-item">
          <span class="rule-indicator"></span>
          <span><strong>破损等级:</strong> 权重 ${(PRIORITY_WEIGHTS.damage * 100).toFixed(0)}%</span>
        </div>
        <div class="rule-item">
          <span class="rule-indicator"></span>
          <span><strong>使用热度:</strong> 权重 ${(PRIORITY_WEIGHTS.popularity * 100).toFixed(0)}%</span>
        </div>
        <div class="rule-item">
          <span class="rule-indicator"></span>
          <span><strong>设施风险:</strong> 权重 ${(PRIORITY_WEIGHTS.risk * 100).toFixed(0)}%</span>
        </div>
        <div class="rule-item">
          <span class="rule-indicator"></span>
          <span><strong>分数区间:</strong> ≥18紧急 | ≥13高 | ≥8中 | &lt;8低</span>
        </div>
        <div class="rule-item">
          <span class="rule-indicator"></span>
          <span><strong>状态流转:</strong> 待评估 → 评估中 → 维修中 → 已完成</span>
        </div>
        <div class="rule-item">
          <span class="rule-indicator"></span>
          <span><strong>脏数据处理:</strong> 进入问题列表，保留原始数据和来源</span>
        </div>
      </div>

      <h3 style="margin-bottom:16px;">🧪 规则验证测试 (${passed}/${total} 通过)</h3>

      ${results.map(tc => `
        <div class="test-case">
          <div class="test-case-header">
            <span class="test-case-title">${escapeHtml(tc.title)}</span>
            <span class="test-case-status ${tc.passed ? 'pass' : 'fail'}">
              ${tc.passed ? '✓ 通过' : '✗ 失败'}
            </span>
          </div>
          <p style="color:#666;margin-bottom:12px;">${escapeHtml(tc.description)}</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <div style="font-size:12px;color:#00b894;margin-bottom:4px;">期望结果:</div>
              <div class="test-expected">${tc.expected}</div>
            </div>
            <div>
              <div style="font-size:12px;color:${tc.passed ? '#00b894' : '#d63031'};margin-bottom:4px;">实际结果:</div>
              <div class="test-expected">${tc.actual}</div>
            </div>
          </div>
        </div>
      `).join('')}

      <div class="modal-footer">
        <button class="btn btn-secondary" id="rerun-tests">重新运行</button>
        <button class="btn btn-outline" id="modal-close-btn">关闭</button>
      </div>
    `;
  },

  bindTasksEvents() {
    const main = document.getElementById('main-content');

    main.querySelectorAll('[data-action="view-task"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = openModal(this.renderTaskDetail(btn.dataset.id), '维修任务详情');
        document.getElementById('modal-close-btn')?.addEventListener('click', () => modal.close());
        document.getElementById('modal-advance-task')?.addEventListener('click', () => {
          const result = PriorityEngine.advanceTaskStatus(document.getElementById('modal-advance-task').dataset.id);
          if (result.success) {
            showToast('任务状态已更新', 'success');
            modal.close();
            this.render();
          } else {
            showToast(result.error, 'error');
          }
        });
      });
    });

    main.querySelectorAll('[data-action="advance-task"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const result = PriorityEngine.advanceTaskStatus(btn.dataset.id);
        if (result.success) {
          showToast('任务状态已更新', 'success');
          this.render();
        } else {
          showToast(result.error, 'error');
        }
      });
    });

    document.getElementById('filter-task-status')?.addEventListener('change', (e) => {
      this.state.taskFilters.status = e.target.value || undefined;
      this.render();
    });

    document.getElementById('filter-task-type')?.addEventListener('change', (e) => {
      this.state.taskFilters.facilityType = e.target.value || undefined;
      this.render();
    });

    document.getElementById('filter-task-min-priority')?.addEventListener('change', (e) => {
      this.state.taskFilters.minPriority = e.target.value ? parseInt(e.target.value) : undefined;
      this.render();
    });

    document.getElementById('filter-task-search')?.addEventListener('input', (e) => {
      clearTimeout(this._searchTimeout);
      this._searchTimeout = setTimeout(() => {
        this.state.taskFilters.search = e.target.value || undefined;
        this.render();
      }, 300);
    });

    document.getElementById('reset-task-filters')?.addEventListener('click', () => {
      this.state.taskFilters = {};
      this.render();
    });
  },

  bindFacilitiesEvents() {
    const main = document.getElementById('main-content');

    main.querySelectorAll('[data-action="view-facility"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = openModal(this.renderFacilityDetail(btn.dataset.id), '设施详情');
        document.getElementById('modal-close-btn')?.addEventListener('click', () => modal.close());
        document.getElementById('modal-report-damage')?.addEventListener('click', () => {
          modal.close();
          const m2 = openModal(this.renderReportDamageForm(document.getElementById('modal-report-damage').dataset.id), '上报破损');
          this.bindReportDamageForm(m2);
        });
      });
    });

    main.querySelectorAll('[data-action="report-damage"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = openModal(this.renderReportDamageForm(btn.dataset.id), '上报破损');
        this.bindReportDamageForm(modal);
      });
    });

    document.getElementById('filter-facility-type')?.addEventListener('change', (e) => {
      this.state.facilityFilters.type = e.target.value || undefined;
      this.render();
    });

    document.getElementById('filter-facility-search')?.addEventListener('input', (e) => {
      clearTimeout(this._searchTimeout);
      this._searchTimeout = setTimeout(() => {
        this.state.facilityFilters.search = e.target.value || undefined;
        this.render();
      }, 300);
    });

    document.getElementById('reset-facility-filters')?.addEventListener('click', () => {
      this.state.facilityFilters = {};
      this.render();
    });
  },

  bindProblemsEvents() {
    const main = document.getElementById('main-content');

    main.querySelectorAll('[data-action="clear-problem"]').forEach(btn => {
      btn.addEventListener('click', () => {
        DataStore.clearProblem(btn.dataset.id);
        showToast('已清除该问题记录', 'success');
        this.render();
      });
    });

    document.getElementById('clear-all-problems')?.addEventListener('click', () => {
      if (confirm('确定清空所有问题记录？此操作不可撤销。')) {
        DataStore.clearAllProblems();
        showToast('问题列表已清空', 'success');
        this.render();
      }
    });
  },

  bindStatsEvents() {
  },

  bindCreateFacilityForm(modal) {
    document.getElementById('modal-close-btn')?.addEventListener('click', () => modal.close());

    document.getElementById('submit-create-facility')?.addEventListener('click', () => {
      const name = document.getElementById('facility-name').value.trim();
      const type = document.getElementById('facility-type').value;
      const location = document.getElementById('facility-location').value.trim();
      const installDate = document.getElementById('facility-install-date').value;
      const notes = document.getElementById('facility-notes').value.trim();

      const errors = [];
      if (!name) errors.push('设施名称不能为空');
      if (!type) errors.push('请选择设施类型');
      if (!location) errors.push('位置不能为空');

      if (errors.length > 0) {
        showToast(errors.join('; '), 'error');
        return;
      }

      const facility = DataStore.addFacility({
        name, type, location,
        installDate: installDate || null,
        notes: notes || null
      });

      showToast(`设施 "${facility.name}" 创建成功`, 'success');
      modal.close();
      this.render();
    });
  },

  bindReportDamageForm(modal) {
    document.getElementById('modal-close-btn')?.addEventListener('click', () => modal.close());

    document.getElementById('submit-report-damage')?.addEventListener('click', () => {
      const facilityId = document.getElementById('submit-report-damage').dataset.facility;
      const level = parseInt(document.getElementById('damage-level').value);
      const category = document.getElementById('damage-category').value;
      const description = document.getElementById('damage-description').value.trim();
      const reporter = document.getElementById('damage-reporter').value.trim();

      const errors = [];
      if (!level) errors.push('请选择破损等级');
      if (!category) errors.push('请选择破损类别');

      if (errors.length > 0) {
        showToast(errors.join('; '), 'error');
        return;
      }

      const damage = DataStore.addDamageReport({
        facilityId,
        level,
        category,
        description: description || null,
        reporter: reporter || null
      });

      const taskResult = PriorityEngine.createRepairTaskForDamage(damage.id);

      if (taskResult.success) {
        const fac = DataStore.getFacilityById(facilityId);
        showToast(`已创建维修任务，优先级: ${PriorityEngine.getPriorityLabel(taskResult.task.priority)} (${taskResult.task.priority.toFixed(1)}分)`, 'success');
        modal.close();
        this.render();
      } else {
        showToast(taskResult.error, 'error');
      }
    });
  },

  bindImportForm(modal) {
    document.getElementById('modal-close-btn')?.addEventListener('click', () => modal.close());

    document.getElementById('submit-import')?.addEventListener('click', () => {
      const source = document.getElementById('import-source').value.trim() || 'manual_import';
      const jsonStr = document.getElementById('import-json').value.trim();

      if (!jsonStr) {
        showToast('请输入JSON数据', 'error');
        return;
      }

      let data;
      try {
        data = JSON.parse(jsonStr);
      } catch (e) {
        DataStore.addProblem({
          type: 'JSON_PARSE_ERROR',
          source,
          message: `JSON解析失败: ${e.message}`,
          rawData: jsonStr
        });
        showToast('JSON格式错误，已记录到问题列表', 'error');
        modal.close();
        this.render();
        return;
      }

      const result = DataStore.importAll(data, source);

      let msg = `导入完成: `;
      msg += `设施${result.stats.facilities.imported}成功/${result.stats.facilities.failed}失败 `;
      msg += `破损${result.stats.damageReports.imported}成功/${result.stats.damageReports.failed}失败 `;
      msg += `热度${result.stats.popularityRecords.imported}成功/${result.stats.popularityRecords.failed}失败`;

      if (result.errors.length > 0) {
        showToast(msg + ' (失败数据已进入问题列表)', 'info');
      } else {
        showToast(msg, 'success');
      }

      PriorityEngine.recalculateAllPriorities();
      modal.close();
      this.render();
    });
  },

  bindRulesVerification(modal) {
    document.getElementById('modal-close-btn')?.addEventListener('click', () => modal.close());

    document.getElementById('rerun-tests')?.addEventListener('click', () => {
      const container = document.querySelector('.modal-body');
      if (container) {
        container.innerHTML = this.renderRulesVerification();
        this.bindRulesVerification(modal);
      }
    });
  }
};
