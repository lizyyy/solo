const app = {
  kilns: [],
  bodies: [],
  glazes: [],
  pieces: [],
  plans: [],
  records: [],
  currentTab: 'dashboard',
  currentMaterialTab: 'bodies',
  currentPlan: null,
  currentPlanStages: [],
  editMode: false,
  editItem: null,

  async init() {
    this.setupEventListeners();
    await this.loadAllData();
  },

  setupEventListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.dataset.tab);
      });
    });

    document.querySelectorAll('.material-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchMaterialTab(btn.dataset.material);
      });
    });

    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.closeModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    });
  },

  switchTab(tabName) {
    this.currentTab = tabName;
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    switch (tabName) {
      case 'kilns':
        this.loadKilns();
        break;
      case 'materials':
        this.loadBodies();
        this.loadGlazes();
        break;
      case 'pieces':
        this.loadPieces();
        break;
      case 'plans':
        this.loadPlans();
        break;
      case 'records':
        this.loadRecords();
        break;
      case 'dashboard':
      default:
        this.loadDashboard();
        break;
    }
  },

  switchMaterialTab(materialType) {
    this.currentMaterialTab = materialType;
    
    document.querySelectorAll('.material-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.material === materialType);
    });

    document.getElementById('bodies-section').classList.toggle('hidden', materialType !== 'bodies');
    document.getElementById('glazes-section').classList.toggle('hidden', materialType !== 'glazes');
  },

  async loadAllData() {
    try {
      await Promise.all([
        this.loadKilns(),
        this.loadBodies(),
        this.loadGlazes(),
        this.loadPieces(),
        this.loadPlans(),
        this.loadRecords()
      ]);
      this.loadDashboard();
    } catch (error) {
      this.showToast('加载数据失败: ' + error.message, 'error');
    }
  },

  async loadKilns() {
    try {
      this.kilns = await api.getKilns();
      this.renderKilns();
      return this.kilns;
    } catch (error) {
      console.error('加载窑炉失败:', error);
      return [];
    }
  },

  async loadBodies() {
    try {
      this.bodies = await api.getBodies();
      this.renderBodies();
      return this.bodies;
    } catch (error) {
      console.error('加载坯体失败:', error);
      return [];
    }
  },

  async loadGlazes() {
    try {
      this.glazes = await api.getGlazes();
      this.renderGlazes();
      return this.glazes;
    } catch (error) {
      console.error('加载釉料失败:', error);
      return [];
    }
  },

  async loadPieces() {
    try {
      this.pieces = await api.getPieces();
      this.renderPieces();
      return this.pieces;
    } catch (error) {
      console.error('加载作品失败:', error);
      return [];
    }
  },

  async loadPlans() {
    try {
      this.plans = await api.getPlans();
      this.renderPlans();
      return this.plans;
    } catch (error) {
      console.error('加载方案失败:', error);
      return [];
    }
  },

  async loadRecords() {
    try {
      this.records = await api.getRecords();
      this.renderRecords();
      return this.records;
    } catch (error) {
      console.error('加载记录失败:', error);
      return [];
    }
  },

  loadDashboard() {
    document.getElementById('stat-kilns').textContent = this.kilns.length;
    document.getElementById('stat-pieces').textContent = this.pieces.length;
    document.getElementById('stat-plans').textContent = this.plans.length;
    document.getElementById('stat-records').textContent = this.records.length;

    const recentPlans = this.plans.slice(0, 5);
    const container = document.getElementById('recent-plans-list');
    
    if (recentPlans.length === 0) {
      container.innerHTML = '<p class="empty-state">暂无烧成方案</p>';
    } else {
      container.innerHTML = recentPlans.map(plan => `
        <div class="list-item">
          <div class="list-item-header">
            <div>
              <div class="list-item-title">${plan.name}</div>
              <div class="list-item-meta" style="margin-top: 4px;">
                <span class="meta-item">窑炉: ${plan.kiln_name || '未指定'}</span>
                <span class="meta-item">预计: ${plan.estimated_duration ? plan.estimated_duration.toFixed(1) : '-'}小时</span>
                <span class="meta-item">费用: ¥${plan.estimated_cost ? plan.estimated_cost.toFixed(2) : '-'}</span>
              </div>
            </div>
            <div class="list-item-actions">
              <button class="btn btn-small btn-primary" onclick="app.viewPlan('${plan.id}')">查看</button>
            </div>
          </div>
        </div>
      `).join('');
    }
  },

  renderKilns() {
    const container = document.getElementById('kilns-list');
    
    if (this.kilns.length === 0) {
      container.innerHTML = '<p class="empty-state">暂无窑炉数据</p>';
      return;
    }

    container.innerHTML = this.kilns.map(kiln => `
      <div class="list-item">
        <div class="list-item-header">
          <div>
            <div class="list-item-title">${kiln.name}</div>
            <div class="list-item-meta" style="margin-top: 4px;">
              <span class="meta-item">功率: ${kiln.power}kW</span>
              <span class="meta-item">容量: ${kiln.capacity}m³</span>
              <span class="meta-item">最高温: ${kiln.max_temperature}°C</span>
            </div>
            ${kiln.description ? `<p style="margin-top: 8px; font-size: 13px; color: var(--text-light);">${kiln.description}</p>` : ''}
          </div>
          <div class="list-item-actions">
            <button class="btn btn-small btn-secondary" onclick="app.editKiln('${kiln.id}')">编辑</button>
            <button class="btn btn-small btn-danger" onclick="app.deleteKiln('${kiln.id}')">删除</button>
          </div>
        </div>
      </div>
    `).join('');
  },

  renderBodies() {
    const container = document.getElementById('bodies-list');
    
    if (this.bodies.length === 0) {
      container.innerHTML = '<p class="empty-state">暂无坯体数据</p>';
      return;
    }

    container.innerHTML = this.bodies.map(body => `
      <div class="list-item">
        <div class="list-item-header">
          <div>
            <div class="list-item-title">${body.name}</div>
            <div class="list-item-meta" style="margin-top: 4px;">
              <span class="meta-item">最大升温: ${body.max_heating_rate}°C/小时</span>
              <span class="meta-item">最大降温: ${body.max_cooling_rate}°C/小时</span>
              <span class="meta-item">最少保温: ${body.min_hold_time}小时</span>
              <span class="meta-item">厚坯安全升温: ${body.safe_heating_rate_for_thick}°C/小时</span>
            </div>
            ${body.description ? `<p style="margin-top: 8px; font-size: 13px; color: var(--text-light);">${body.description}</p>` : ''}
          </div>
          <div class="list-item-actions">
            <button class="btn btn-small btn-secondary" onclick="app.editBody('${body.id}')">编辑</button>
            <button class="btn btn-small btn-danger" onclick="app.deleteBody('${body.id}')">删除</button>
          </div>
        </div>
      </div>
    `).join('');
  },

  renderGlazes() {
    const container = document.getElementById('glazes-list');
    
    if (this.glazes.length === 0) {
      container.innerHTML = '<p class="empty-state">暂无釉料数据</p>';
      return;
    }

    const sensitivityLabels = { low: '低', medium: '中', high: '高' };

    container.innerHTML = this.glazes.map(glaze => `
      <div class="list-item">
        <div class="list-item-header">
          <div>
            <div class="list-item-title">${glaze.name}</div>
            <div class="list-item-meta" style="margin-top: 4px;">
              <span class="meta-item">成熟温区: ${glaze.min_firing_temp}°C - ${glaze.max_firing_temp}°C</span>
              <span class="meta-item">最佳温度: ${glaze.optimal_firing_temp}°C</span>
              <span class="meta-item">保温时间: ${glaze.hold_time_required}小时</span>
              <span class="meta-item">降温敏感度: ${sensitivityLabels[glaze.cooling_sensitivity] || glaze.cooling_sensitivity}</span>
            </div>
            ${glaze.description ? `<p style="margin-top: 8px; font-size: 13px; color: var(--text-light);">${glaze.description}</p>` : ''}
          </div>
          <div class="list-item-actions">
            <button class="btn btn-small btn-secondary" onclick="app.editGlaze('${glaze.id}')">编辑</button>
            <button class="btn btn-small btn-danger" onclick="app.deleteGlaze('${glaze.id}')">删除</button>
          </div>
        </div>
      </div>
    `).join('');
  },

  renderPieces() {
    const container = document.getElementById('pieces-list');
    
    if (this.pieces.length === 0) {
      container.innerHTML = '<p class="empty-state">暂无作品数据</p>';
      return;
    }

    container.innerHTML = this.pieces.map(piece => `
      <div class="list-item">
        <div class="list-item-header">
          <div>
            <div class="list-item-title">${piece.name}</div>
            <div class="list-item-meta" style="margin-top: 4px;">
              <span class="meta-item">坯体: ${piece.body_name || '未指定'}</span>
              <span class="meta-item">釉料: ${piece.glaze_name || '无釉'}</span>
              <span class="meta-item">厚度: ${piece.thickness}cm</span>
              <span class="meta-item">重量: ${piece.weight}kg</span>
              ${piece.type ? `<span class="meta-item">类型: ${piece.type}</span>` : ''}
            </div>
            ${piece.notes ? `<p style="margin-top: 8px; font-size: 13px; color: var(--text-light);">${piece.notes}</p>` : ''}
          </div>
          <div class="list-item-actions">
            <button class="btn btn-small btn-secondary" onclick="app.editPiece('${piece.id}')">编辑</button>
            <button class="btn btn-small btn-danger" onclick="app.deletePiece('${piece.id}')">删除</button>
          </div>
        </div>
      </div>
    `).join('');
  },

  renderPlans() {
    const container = document.getElementById('plans-list');
    
    if (this.plans.length === 0) {
      container.innerHTML = '<p class="empty-state">暂无烧成方案</p>';
      return;
    }

    container.innerHTML = this.plans.map(plan => `
      <div class="list-item">
        <div class="list-item-header">
          <div>
            <div class="list-item-title">${plan.name}</div>
            <div class="list-item-meta" style="margin-top: 4px;">
              <span class="meta-item">窑炉: ${plan.kiln_name || '未指定'}</span>
              <span class="meta-item">预计时长: ${plan.estimated_duration ? plan.estimated_duration.toFixed(1) : '-'}小时</span>
              <span class="meta-item">预计费用: ¥${plan.estimated_cost ? plan.estimated_cost.toFixed(2) : '-'}</span>
            </div>
          </div>
          <div class="list-item-actions">
            <button class="btn btn-small btn-primary" onclick="app.viewPlan('${plan.id}')">查看</button>
            <button class="btn btn-small btn-secondary" onclick="app.editPlan('${plan.id}')">编辑</button>
            <button class="btn btn-small btn-danger" onclick="app.deletePlan('${plan.id}')">删除</button>
          </div>
        </div>
      </div>
    `).join('');
  },

  renderRecords() {
    const container = document.getElementById('records-list');
    
    if (this.records.length === 0) {
      container.innerHTML = '<p class="empty-state">暂无烧成记录</p>';
      return;
    }

    container.innerHTML = this.records.map(record => `
      <div class="list-item">
        <div class="list-item-header">
          <div>
            <div class="list-item-title">
              ${record.plan_name || '未关联方案'}
              <span class="risk-badge ${record.had_cracks ? 'risk-high' : 'risk-low'}" style="margin-left: 8px;">
                ${record.had_cracks ? '有开裂' : '无开裂'}
              </span>
            </div>
            <div class="list-item-meta" style="margin-top: 4px;">
              <span class="meta-item">实际时长: ${record.actual_duration ? record.actual_duration.toFixed(1) : '-'}小时</span>
              <span class="meta-item">实际费用: ¥${record.actual_cost ? record.actual_cost.toFixed(2) : '-'}</span>
              <span class="meta-item">釉面成熟: ${record.glaze_matured ? '是' : '否'}</span>
            </div>
            ${record.issues ? `<p style="margin-top: 8px; font-size: 13px; color: var(--danger-color);"><strong>问题:</strong> ${record.issues}</p>` : ''}
            ${record.notes ? `<p style="margin-top: 4px; font-size: 13px; color: var(--text-light);">${record.notes}</p>` : ''}
          </div>
          <div class="list-item-actions">
            <button class="btn btn-small btn-secondary" onclick="app.editRecord('${record.id}')">编辑</button>
            <button class="btn btn-small btn-danger" onclick="app.deleteRecord('${record.id}')">删除</button>
          </div>
        </div>
      </div>
    `).join('');
  },

  showModal(title, content, wide = false) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = content;
    
    const modal = document.getElementById('generic-modal');
    modal.classList.toggle('wide', wide);
    
    document.getElementById('modal-overlay').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    this.editMode = false;
    this.editItem = null;
    this.currentPlanStages = [];
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ'
    };
    
    toast.innerHTML = `
      <span style="font-size: 18px;">${icons[type] || icons.info}</span>
      <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },

  openKilnModal(kiln = null) {
    this.editMode = !!kiln;
    this.editItem = kiln;
    
    const content = `
      <form id="kiln-form">
        <div class="form-group">
          <label class="form-label">窑炉名称 <span class="required">*</span></label>
          <input type="text" class="form-input" name="name" value="${kiln?.name || ''}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">功率 (kW) <span class="required">*</span></label>
            <input type="number" class="form-input" name="power" step="0.1" min="0" value="${kiln?.power || 6}" required>
          </div>
          <div class="form-group">
            <label class="form-label">容量 (m³) <span class="required">*</span></label>
            <input type="number" class="form-input" name="capacity" step="0.001" min="0" value="${kiln?.capacity || 0.05}" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">最高温度 (°C) <span class="required">*</span></label>
          <input type="number" class="form-input" name="max_temperature" step="10" min="100" value="${kiln?.max_temperature || 1300}" required>
        </div>
        <div class="form-group">
          <label class="form-label">描述</label>
          <textarea class="form-input form-textarea" name="description">${kiln?.description || ''}</textarea>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">取消</button>
          <button type="submit" class="btn btn-primary">${kiln ? '保存' : '添加'}</button>
        </div>
      </form>
    `;

    this.showModal(kiln ? '编辑窑炉' : '添加窑炉', content);
    
    document.getElementById('kiln-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveKiln(new FormData(e.target));
    });
  },

  async saveKiln(formData) {
    const data = {
      name: formData.get('name'),
      power: parseFloat(formData.get('power')),
      capacity: parseFloat(formData.get('capacity')),
      max_temperature: parseFloat(formData.get('max_temperature')),
      description: formData.get('description')
    };

    try {
      if (this.editMode && this.editItem) {
        await api.updateKiln(this.editItem.id, data);
        this.showToast('窑炉已更新', 'success');
      } else {
        await api.createKiln(data);
        this.showToast('窑炉已添加', 'success');
      }
      this.closeModal();
      await this.loadKilns();
      this.loadDashboard();
    } catch (error) {
      this.showToast('保存失败: ' + error.message, 'error');
    }
  },

  editKiln(id) {
    const kiln = this.kilns.find(k => k.id === id);
    if (kiln) {
      this.openKilnModal(kiln);
    }
  },

  async deleteKiln(id) {
    if (!confirm('确定要删除这个窑炉吗？')) return;
    
    try {
      await api.deleteKiln(id);
      this.showToast('窑炉已删除', 'success');
      await this.loadKilns();
      this.loadDashboard();
    } catch (error) {
      this.showToast('删除失败: ' + error.message, 'error');
    }
  },

  openBodyModal(body = null) {
    this.editMode = !!body;
    this.editItem = body;
    
    const content = `
      <form id="body-form">
        <div class="form-group">
          <label class="form-label">坯体名称 <span class="required">*</span></label>
          <input type="text" class="form-input" name="name" value="${body?.name || ''}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">最大升温速率 (°C/小时) <span class="required">*</span></label>
            <input type="number" class="form-input" name="max_heating_rate" step="10" min="50" value="${body?.max_heating_rate || 300}" required>
            <p class="form-hint">普通坯体建议200-300°C/小时</p>
          </div>
          <div class="form-group">
            <label class="form-label">最大降温速率 (°C/小时) <span class="required">*</span></label>
            <input type="number" class="form-input" name="max_cooling_rate" step="10" min="30" value="${body?.max_cooling_rate || 200}" required>
            <p class="form-hint">降温通常比升温慢</p>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">最少保温时间 (小时) <span class="required">*</span></label>
            <input type="number" class="form-input" name="min_hold_time" step="0.25" min="0" value="${body?.min_hold_time || 0.5}" required>
          </div>
          <div class="form-group">
            <label class="form-label">厚坯安全升温速率 (°C/小时) <span class="required">*</span></label>
            <input type="number" class="form-input" name="safe_heating_rate_for_thick" step="10" min="30" value="${body?.safe_heating_rate_for_thick || 150}" required>
            <p class="form-hint">厚度超过1cm的厚坯适用</p>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">描述</label>
          <textarea class="form-input form-textarea" name="description">${body?.description || ''}</textarea>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">取消</button>
          <button type="submit" class="btn btn-primary">${body ? '保存' : '添加'}</button>
        </div>
      </form>
    `;

    this.showModal(body ? '编辑坯体' : '添加坯体', content);
    
    document.getElementById('body-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveBody(new FormData(e.target));
    });
  },

  async saveBody(formData) {
    const data = {
      name: formData.get('name'),
      max_heating_rate: parseFloat(formData.get('max_heating_rate')),
      max_cooling_rate: parseFloat(formData.get('max_cooling_rate')),
      min_hold_time: parseFloat(formData.get('min_hold_time')),
      safe_heating_rate_for_thick: parseFloat(formData.get('safe_heating_rate_for_thick')),
      description: formData.get('description')
    };

    try {
      if (this.editMode && this.editItem) {
        await api.updateBody(this.editItem.id, data);
        this.showToast('坯体已更新', 'success');
      } else {
        await api.createBody(data);
        this.showToast('坯体已添加', 'success');
      }
      this.closeModal();
      await this.loadBodies();
    } catch (error) {
      this.showToast('保存失败: ' + error.message, 'error');
    }
  },

  editBody(id) {
    const body = this.bodies.find(b => b.id === id);
    if (body) {
      this.openBodyModal(body);
    }
  },

  async deleteBody(id) {
    if (!confirm('确定要删除这个坯体吗？')) return;
    
    try {
      await api.deleteBody(id);
      this.showToast('坯体已删除', 'success');
      await this.loadBodies();
    } catch (error) {
      this.showToast('删除失败: ' + error.message, 'error');
    }
  },

  openGlazeModal(glaze = null) {
    this.editMode = !!glaze;
    this.editItem = glaze;
    
    const content = `
      <form id="glaze-form">
        <div class="form-group">
          <label class="form-label">釉料名称 <span class="required">*</span></label>
          <input type="text" class="form-input" name="name" value="${glaze?.name || ''}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">最低成熟温度 (°C) <span class="required">*</span></label>
            <input type="number" class="form-input" name="min_firing_temp" step="10" min="500" value="${glaze?.min_firing_temp || 1200}" required>
          </div>
          <div class="form-group">
            <label class="form-label">最高成熟温度 (°C) <span class="required">*</span></label>
            <input type="number" class="form-input" name="max_firing_temp" step="10" min="500" value="${glaze?.max_firing_temp || 1280}" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">最佳成熟温度 (°C) <span class="required">*</span></label>
            <input type="number" class="form-input" name="optimal_firing_temp" step="10" min="500" value="${glaze?.optimal_firing_temp || 1240}" required>
          </div>
          <div class="form-group">
            <label class="form-label">保温时间要求 (小时) <span class="required">*</span></label>
            <input type="number" class="form-input" name="hold_time_required" step="0.25" min="0" value="${glaze?.hold_time_required || 0.5}" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">降温敏感度 <span class="required">*</span></label>
          <select class="form-input form-select" name="cooling_sensitivity" required>
            <option value="low" ${glaze?.cooling_sensitivity === 'low' ? 'selected' : ''}>低 - 对降温不敏感</option>
            <option value="medium" ${glaze?.cooling_sensitivity === 'medium' ? 'selected' : ''}>中 - 需要适当控制</option>
            <option value="high" ${glaze?.cooling_sensitivity === 'high' ? 'selected' : ''}>高 - 需要缓慢降温</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">描述</label>
          <textarea class="form-input form-textarea" name="description">${glaze?.description || ''}</textarea>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">取消</button>
          <button type="submit" class="btn btn-primary">${glaze ? '保存' : '添加'}</button>
        </div>
      </form>
    `;

    this.showModal(glaze ? '编辑釉料' : '添加釉料', content);
    
    document.getElementById('glaze-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveGlaze(new FormData(e.target));
    });
  },

  async saveGlaze(formData) {
    const data = {
      name: formData.get('name'),
      min_firing_temp: parseFloat(formData.get('min_firing_temp')),
      max_firing_temp: parseFloat(formData.get('max_firing_temp')),
      optimal_firing_temp: parseFloat(formData.get('optimal_firing_temp')),
      hold_time_required: parseFloat(formData.get('hold_time_required')),
      cooling_sensitivity: formData.get('cooling_sensitivity'),
      description: formData.get('description')
    };

    try {
      if (this.editMode && this.editItem) {
        await api.updateGlaze(this.editItem.id, data);
        this.showToast('釉料已更新', 'success');
      } else {
        await api.createGlaze(data);
        this.showToast('釉料已添加', 'success');
      }
      this.closeModal();
      await this.loadGlazes();
    } catch (error) {
      this.showToast('保存失败: ' + error.message, 'error');
    }
  },

  editGlaze(id) {
    const glaze = this.glazes.find(g => g.id === id);
    if (glaze) {
      this.openGlazeModal(glaze);
    }
  },

  async deleteGlaze(id) {
    if (!confirm('确定要删除这个釉料吗？')) return;
    
    try {
      await api.deleteGlaze(id);
      this.showToast('釉料已删除', 'success');
      await this.loadGlazes();
    } catch (error) {
      this.showToast('删除失败: ' + error.message, 'error');
    }
  },

  openPieceModal(piece = null) {
    this.editMode = !!piece;
    this.editItem = piece;
    
    const bodyOptions = this.bodies.map(b => 
      `<option value="${b.id}" ${piece?.body_id === b.id ? 'selected' : ''}>${b.name}</option>`
    ).join('');
    
    const glazeOptions = [
      '<option value="">无釉</option>',
      ...this.glazes.map(g => 
        `<option value="${g.id}" ${piece?.glaze_id === g.id ? 'selected' : ''}>${g.name}</option>`
      )
    ].join('');

    const typeOptions = ['杯子', '盘子', '碗', '花瓶', '雕塑', '摆件', '其他']
      .map(t => `<option value="${t}" ${piece?.type === t ? 'selected' : ''}>${t}</option>`)
      .join('');

    const content = `
      <form id="piece-form">
        <div class="form-group">
          <label class="form-label">作品名称 <span class="required">*</span></label>
          <input type="text" class="form-input" name="name" value="${piece?.name || ''}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">坯体 <span class="required">*</span></label>
            <select class="form-input form-select" name="body_id" required>
              <option value="">请选择坯体</option>
              ${bodyOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">釉料</label>
            <select class="form-input form-select" name="glaze_id">
              ${glazeOptions}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">厚度 (cm) <span class="required">*</span></label>
            <input type="number" class="form-input" name="thickness" step="0.1" min="0.1" value="${piece?.thickness || 0.5}" required>
            <p class="form-hint">影响升温速率限制，超过1cm为厚坯</p>
          </div>
          <div class="form-group">
            <label class="form-label">重量 (kg) <span class="required">*</span></label>
            <input type="number" class="form-input" name="weight" step="0.1" min="0.1" value="${piece?.weight || 0.3}" required>
            <p class="form-hint">影响装窑容量估算</p>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">作品类型</label>
          <select class="form-input form-select" name="type">
            <option value="">请选择类型</option>
            ${typeOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">备注</label>
          <textarea class="form-input form-textarea" name="notes">${piece?.notes || ''}</textarea>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">取消</button>
          <button type="submit" class="btn btn-primary">${piece ? '保存' : '添加'}</button>
        </div>
      </form>
    `;

    this.showModal(piece ? '编辑作品' : '添加作品', content);
    
    document.getElementById('piece-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.savePiece(new FormData(e.target));
    });
  },

  async savePiece(formData) {
    const data = {
      name: formData.get('name'),
      body_id: formData.get('body_id'),
      glaze_id: formData.get('glaze_id') || null,
      thickness: parseFloat(formData.get('thickness')),
      weight: parseFloat(formData.get('weight')),
      type: formData.get('type') || null,
      notes: formData.get('notes')
    };

    try {
      if (this.editMode && this.editItem) {
        await api.updatePiece(this.editItem.id, data);
        this.showToast('作品已更新', 'success');
      } else {
        await api.createPiece(data);
        this.showToast('作品已添加', 'success');
      }
      this.closeModal();
      await this.loadPieces();
      this.loadDashboard();
    } catch (error) {
      this.showToast('保存失败: ' + error.message, 'error');
    }
  },

  editPiece(id) {
    const piece = this.pieces.find(p => p.id === id);
    if (piece) {
      this.openPieceModal(piece);
    }
  },

  async deletePiece(id) {
    if (!confirm('确定要删除这个作品吗？')) return;
    
    try {
      await api.deletePiece(id);
      this.showToast('作品已删除', 'success');
      await this.loadPieces();
      this.loadDashboard();
    } catch (error) {
      this.showToast('删除失败: ' + error.message, 'error');
    }
  },

  openPlanModal(plan = null) {
    this.editMode = !!plan;
    this.editItem = plan;
    this.currentPlanStages = plan?.stages ? [...plan.stages] : [
      { stage_type: 'heating', start_temp: 25, target_temp: 600, heating_rate: 200, description: '低温升温段' },
      { stage_type: 'heating', start_temp: 600, target_temp: 1240, heating_rate: 150, description: '高温升温段' },
      { stage_type: 'holding', start_temp: 1240, hold_duration: 1, description: '保温阶段' },
      { stage_type: 'cooling', start_temp: 1240, target_temp: 800, cooling_rate: 100, description: '快速降温' },
      { stage_type: 'cooling', start_temp: 800, target_temp: 200, cooling_rate: 80, description: '缓慢降温' }
    ];

    const kilnOptions = this.kilns.map(k => 
      `<option value="${k.id}" ${plan?.kiln_id === k.id ? 'selected' : ''}>${k.name} (${k.power}kW)</option>`
    ).join('');

    const piecesHtml = this.pieces.map(p => `
      <label class="piece-checkbox">
        <input type="checkbox" name="piece_ids" value="${p.id}" ${plan?.pieces?.some(pp => pp.id === p.id) ? 'checked' : ''}>
        <div class="piece-info">
          <div class="piece-info-name">${p.name}</div>
          <div class="piece-info-meta">${p.body_name || '未知坯体'} | 厚度: ${p.thickness}cm | 重量: ${p.weight}kg</div>
        </div>
      </label>
    `).join('');

    const content = `
      <form id="plan-form">
        <div class="form-group">
          <label class="form-label">方案名称 <span class="required">*</span></label>
          <input type="text" class="form-input" name="name" value="${plan?.name || ''}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">窑炉 <span class="required">*</span></label>
            <select class="form-input form-select" name="kiln_id" required>
              <option value="">请选择窑炉</option>
              ${kilnOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">电价 (元/度) <span class="required">*</span></label>
            <input type="number" class="form-input" name="electricity_price" step="0.01" min="0" value="${plan?.electricity_price || 1.0}" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">预期最长时间 (小时)</label>
            <input type="number" class="form-input" name="expected_max_duration" step="0.5" min="0" value="${plan?.expected_max_duration || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">预期最高电费 (元)</label>
            <input type="number" class="form-input" name="expected_max_cost" step="1" min="0" value="${plan?.expected_max_cost || ''}">
          </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">选择待烧作品</label>
          <div class="pieces-selector">
            ${this.pieces.length > 0 ? piecesHtml : '<p style="padding: 16px; color: var(--text-light); text-align: center;">暂无作品，请先添加作品</p>'}
          </div>
        </div>

        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <label class="form-label" style="margin-bottom: 0;">烧成曲线阶段</label>
            <div>
              <button type="button" class="btn btn-small btn-secondary" onclick="app.addStage('heating')">+ 升温</button>
              <button type="button" class="btn btn-small btn-secondary" onclick="app.addStage('holding')">+ 保温</button>
              <button type="button" class="btn btn-small btn-secondary" onclick="app.addStage('cooling')">+ 降温</button>
            </div>
          </div>
          <div id="stages-list" class="stage-list">
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">取消</button>
          <button type="submit" class="btn btn-primary">${plan ? '保存' : '创建'}</button>
        </div>
      </form>
    `;

    this.showModal(plan ? '编辑烧成方案' : '新建烧成方案', content, true);
    
    this.renderStagesList();
    
    document.getElementById('plan-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.savePlan(new FormData(e.target));
    });
  },

  renderStagesList() {
    const container = document.getElementById('stages-list');
    if (!container) return;

    if (this.currentPlanStages.length === 0) {
      container.innerHTML = '<p class="empty-state" style="padding: 20px;">暂无阶段，请添加烧成阶段</p>';
      return;
    }

    const typeLabels = { heating: '升温', holding: '保温', cooling: '降温' };
    const typeClasses = { heating: 'heating', holding: 'holding', cooling: 'cooling' };

    container.innerHTML = this.currentPlanStages.map((stage, index) => {
      let extraFields = '';
      
      if (stage.stage_type === 'heating') {
        extraFields = `
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">目标温度 (°C)</label>
              <input type="number" class="form-input" name="target_temp_${index}" step="10" min="0" value="${stage.target_temp || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">升温速率 (°C/小时)</label>
              <input type="number" class="form-input" name="heating_rate_${index}" step="10" min="0" value="${stage.heating_rate || 150}">
            </div>
          </div>
        `;
      } else if (stage.stage_type === 'holding') {
        extraFields = `
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">保温时长 (小时)</label>
              <input type="number" class="form-input" name="hold_duration_${index}" step="0.25" min="0" value="${stage.hold_duration || 1}">
            </div>
          </div>
        `;
      } else if (stage.stage_type === 'cooling') {
        extraFields = `
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">目标温度 (°C)</label>
              <input type="number" class="form-input" name="target_temp_${index}" step="10" min="0" value="${stage.target_temp || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">降温速率 (°C/小时)</label>
              <input type="number" class="form-input" name="cooling_rate_${index}" step="10" min="0" value="${stage.cooling_rate || 100}">
            </div>
          </div>
        `;
      }

      return `
        <div class="stage-item" data-index="${index}">
          <div class="stage-header">
            <span class="stage-type-badge stage-type-${typeClasses[stage.stage_type]}">
              阶段 ${index + 1}: ${typeLabels[stage.stage_type]}
            </span>
            <div>
              ${index > 0 ? `<button type="button" class="btn btn-small btn-secondary" onclick="app.moveStage(${index}, -1)">↑</button>` : ''}
              ${index < this.currentPlanStages.length - 1 ? `<button type="button" class="btn btn-small btn-secondary" onclick="app.moveStage(${index}, 1)">↓</button>` : ''}
              <button type="button" class="btn btn-small btn-danger" onclick="app.removeStage(${index})">删除</button>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">起始温度 (°C)</label>
              <input type="number" class="form-input" name="start_temp_${index}" step="10" min="0" value="${stage.start_temp || 25}">
            </div>
            <div class="form-group">
              <label class="form-label">阶段描述</label>
              <input type="text" class="form-input" name="description_${index}" value="${stage.description || ''}">
            </div>
          </div>
          ${extraFields}
        </div>
      `;
    }).join('');
  },

  addStage(type) {
    let lastTemp = 25;
    if (this.currentPlanStages.length > 0) {
      const lastStage = this.currentPlanStages[this.currentPlanStages.length - 1];
      lastTemp = lastStage.target_temp || lastStage.start_temp || 25;
    }

    const newStage = {
      stage_type: type,
      start_temp: lastTemp,
      description: ''
    };

    if (type === 'heating') {
      newStage.target_temp = Math.min(lastTemp + 300, 1300);
      newStage.heating_rate = 150;
    } else if (type === 'holding') {
      newStage.hold_duration = 1;
    } else if (type === 'cooling') {
      newStage.target_temp = Math.max(lastTemp - 300, 100);
      newStage.cooling_rate = 100;
    }

    this.currentPlanStages.push(newStage);
    this.renderStagesList();
  },

  removeStage(index) {
    this.currentPlanStages.splice(index, 1);
    this.renderStagesList();
  },

  moveStage(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= this.currentPlanStages.length) return;
    
    [this.currentPlanStages[index], this.currentPlanStages[newIndex]] = 
    [this.currentPlanStages[newIndex], this.currentPlanStages[index]];
    
    this.renderStagesList();
  },

  collectStagesFromForm(formData) {
    const stages = [];
    const stageItems = document.querySelectorAll('.stage-item');
    
    stageItems.forEach((item, index) => {
      const stage = {
        stage_type: this.currentPlanStages[index]?.stage_type || 'heating',
        start_temp: parseFloat(formData.get(`start_temp_${index}`)) || 25,
        description: formData.get(`description_${index}`) || ''
      };

      if (stage.stage_type === 'heating') {
        stage.target_temp = parseFloat(formData.get(`target_temp_${index}`)) || 600;
        stage.heating_rate = parseFloat(formData.get(`heating_rate_${index}`)) || 150;
      } else if (stage.stage_type === 'holding') {
        stage.hold_duration = parseFloat(formData.get(`hold_duration_${index}`)) || 1;
      } else if (stage.stage_type === 'cooling') {
        stage.target_temp = parseFloat(formData.get(`target_temp_${index}`)) || 200;
        stage.cooling_rate = parseFloat(formData.get(`cooling_rate_${index}`)) || 100;
      }

      stages.push(stage);
    });

    return stages;
  },

  async savePlan(formData) {
    const pieceIds = Array.from(formData.getAll('piece_ids')).filter(id => id);
    const stages = this.collectStagesFromForm(formData);

    const data = {
      name: formData.get('name'),
      kiln_id: formData.get('kiln_id'),
      electricity_price: parseFloat(formData.get('electricity_price')) || 1.0,
      expected_max_duration: formData.get('expected_max_duration') ? parseFloat(formData.get('expected_max_duration')) : null,
      expected_max_cost: formData.get('expected_max_cost') ? parseFloat(formData.get('expected_max_cost')) : null,
      pieces: pieceIds,
      stages: stages
    };

    try {
      if (this.editMode && this.editItem) {
        await api.updatePlan(this.editItem.id, data);
        this.showToast('方案已更新', 'success');
      } else {
        const newPlan = await api.createPlan(data);
        await api.calculatePlan(newPlan.id);
        this.showToast('方案已创建并计算', 'success');
      }
      this.closeModal();
      await this.loadPlans();
      this.loadDashboard();
    } catch (error) {
      this.showToast('保存失败: ' + error.message, 'error');
    }
  },

  async viewPlan(id) {
    try {
      const plan = await api.getPlan(id);
      this.renderPlanDetail(plan);
    } catch (error) {
      this.showToast('加载方案失败: ' + error.message, 'error');
    }
  },

  renderPlanDetail(plan) {
    const typeLabels = { heating: '升温', holding: '保温', cooling: '降温' };
    const riskLevelLabels = { high: '高风险', medium: '中风险', low: '低风险' };
    const riskLevelClasses = { high: 'high', medium: 'medium', low: 'low' };

    const stagesHtml = plan.stages?.map((stage, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${typeLabels[stage.stage_type] || stage.stage_type}</td>
        <td>${stage.start_temp}°C</td>
        <td>${stage.target_temp || '-'}°C</td>
        <td>${stage.heating_rate ? stage.heating_rate + '°C/小时' : (stage.cooling_rate ? stage.cooling_rate + '°C/小时' : '-')}</td>
        <td>${stage.estimated_duration ? stage.estimated_duration.toFixed(1) : (stage.hold_duration || 0)}小时</td>
      </tr>
    `).join('') || '<tr><td colspan="6" style="text-align: center;">暂无阶段数据</td></tr>';

    const piecesHtml = plan.pieces?.map(piece => `
      <tr>
        <td>${piece.name}</td>
        <td>${piece.thickness}cm</td>
        <td>${piece.weight}kg</td>
        <td>${piece.body_name || '-'}</td>
        <td>${piece.glaze_name || '-'}</td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="text-align: center;">暂无作品</td></tr>';

    const risksHtml = plan.risks?.map(risk => `
      <div class="risk-item ${riskLevelClasses[risk.risk_level]}">
        <div class="risk-message">
          <span class="risk-badge risk-${risk.risk_level}">${riskLevelLabels[risk.risk_level]}</span>
          ${risk.message}
          ${risk.piece_name ? `<small style="margin-left: 8px; color: var(--text-light);">(${risk.piece_name})</small>` : ''}
        </div>
        ${risk.details ? `<div class="risk-details">${risk.details}</div>` : ''}
      </div>
    `).join('') || '<p style="color: var(--success-color); font-weight: 600;">暂无风险，方案安全！</p>';

    const content = `
      <div class="card" style="box-shadow: none; margin-bottom: 0; padding: 0;">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">窑炉</label>
            <div class="form-input" style="background: var(--bg-color);">${plan.kiln_name || '未指定'}</div>
          </div>
          <div class="form-group">
            <label class="form-label">窑炉功率</label>
            <div class="form-input" style="background: var(--bg-color);">${plan.kiln_power || 0} kW</div>
          </div>
        </div>
        <div class="curve-stats">
          <div class="curve-stat">
            <div class="curve-stat-label">预计时长</div>
            <div class="curve-stat-value">${plan.estimated_duration ? plan.estimated_duration.toFixed(1) : '-'} 小时</div>
          </div>
          <div class="curve-stat">
            <div class="curve-stat-label">预计电费</div>
            <div class="curve-stat-value">¥${plan.estimated_cost ? plan.estimated_cost.toFixed(2) : '-'}</div>
          </div>
          <div class="curve-stat">
            <div class="curve-stat-label">作品数量</div>
            <div class="curve-stat-value">${plan.pieces?.length || 0} 件</div>
          </div>
          <div class="curve-stat">
            <div class="curve-stat-label">风险数量</div>
            <div class="curve-stat-value" style="color: ${plan.risks?.length > 0 ? 'var(--warning-color)' : 'var(--success-color)'}">${plan.risks?.length || 0} 项</div>
          </div>
        </div>

        <h4 style="margin-top: 24px; margin-bottom: 12px;">烧成曲线阶段</h4>
        <table class="comparison-table">
          <thead>
            <tr>
              <th>阶段</th>
              <th>类型</th>
              <th>起始温</th>
              <th>目标温</th>
              <th>速率</th>
              <th>时长</th>
            </tr>
          </thead>
          <tbody>
            ${stagesHtml}
          </tbody>
        </table>

        <h4 style="margin-top: 24px; margin-bottom: 12px;">待烧作品</h4>
        <table class="comparison-table">
          <thead>
            <tr>
              <th>作品名称</th>
              <th>厚度</th>
              <th>重量</th>
              <th>坯体</th>
              <th>釉料</th>
            </tr>
          </thead>
          <tbody>
            ${piecesHtml}
          </tbody>
        </table>

        <h4 style="margin-top: 24px; margin-bottom: 12px;">风险检查结果</h4>
        ${risksHtml}
      </div>

      <div class="modal-footer" style="margin-top: 24px; padding-left: 0; padding-right: 0;">
        <button type="button" class="btn btn-secondary" onclick="app.closeModal()">关闭</button>
        <button type="button" class="btn btn-secondary" onclick="app.editPlan('${plan.id}')">编辑方案</button>
        <button type="button" class="btn btn-warning" onclick="app.calculatePlan('${plan.id}')">重新计算</button>
        <button type="button" class="btn btn-primary" onclick="app.exportPlan('${plan.id}', 'markdown')">导出Markdown</button>
        <button type="button" class="btn btn-success" onclick="app.exportPlan('${plan.id}', 'html')">导出HTML</button>
      </div>
    `;

    this.showModal(`方案详情: ${plan.name}`, content, true);
  },

  async calculatePlan(id) {
    try {
      this.showToast('正在计算...', 'info');
      const result = await api.calculatePlan(id);
      
      if (result.risks && result.risks.length > 0) {
        const highRisks = result.risks.filter(r => r.risk_level === 'high').length;
        const medRisks = result.risks.filter(r => r.risk_level === 'medium').length;
        this.showToast(`计算完成！发现 ${highRisks} 个高风险、${medRisks} 个中风险`, 'warning');
      } else {
        this.showToast('计算完成！方案安全', 'success');
      }
      
      this.closeModal();
      await this.loadPlans();
      this.viewPlan(id);
    } catch (error) {
      this.showToast('计算失败: ' + error.message, 'error');
    }
  },

  async exportPlan(id, format) {
    try {
      const response = format === 'markdown' 
        ? await api.exportPlanMarkdown(id)
        : await api.exportPlanHtml(id);
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `firing_plan_${id}.${format === 'markdown' ? 'md' : 'html'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      this.showToast(`已导出${format === 'markdown' ? 'Markdown' : 'HTML'}文件`, 'success');
    } catch (error) {
      this.showToast('导出失败: ' + error.message, 'error');
    }
  },

  async editPlan(id) {
    try {
      const plan = await api.getPlan(id);
      this.closeModal();
      this.openPlanModal(plan);
    } catch (error) {
      this.showToast('加载方案失败: ' + error.message, 'error');
    }
  },

  async deletePlan(id) {
    if (!confirm('确定要删除这个烧成方案吗？')) return;
    
    try {
      await api.deletePlan(id);
      this.showToast('方案已删除', 'success');
      await this.loadPlans();
      this.loadDashboard();
    } catch (error) {
      this.showToast('删除失败: ' + error.message, 'error');
    }
  },

  openRecordModal(record = null) {
    this.editMode = !!record;
    this.editItem = record;

    const planOptions = this.plans.map(p => 
      `<option value="${p.id}" ${record?.plan_id === p.id ? 'selected' : ''}>${p.name}</option>`
    ).join('');

    const content = `
      <form id="record-form">
        <div class="form-group">
          <label class="form-label">关联方案 <span class="required">*</span></label>
          <select class="form-input form-select" name="plan_id" required>
            <option value="">请选择方案</option>
            ${planOptions}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">实际开始时间</label>
            <input type="datetime-local" class="form-input" name="actual_start_time" value="${record?.actual_start_time ? new Date(record.actual_start_time).toISOString().slice(0, 16) : ''}">
          </div>
          <div class="form-group">
            <label class="form-label">实际结束时间</label>
            <input type="datetime-local" class="form-input" name="actual_end_time" value="${record?.actual_end_time ? new Date(record.actual_end_time).toISOString().slice(0, 16) : ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">实际时长 (小时)</label>
            <input type="number" class="form-input" name="actual_duration" step="0.5" min="0" value="${record?.actual_duration || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">实际电费 (元)</label>
            <input type="number" class="form-input" name="actual_cost" step="1" min="0" value="${record?.actual_cost || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="checkbox-group">
              <label class="checkbox-item">
                <input type="checkbox" name="had_cracks" ${record?.had_cracks ? 'checked' : ''}>
                <span>是否开裂</span>
              </label>
            </label>
          </div>
          <div class="form-group">
            <label class="checkbox-group">
              <label class="checkbox-item">
                <input type="checkbox" name="glaze_matured" ${record?.glaze_matured ? 'checked' : ''}>
                <span>釉面是否成熟</span>
              </label>
            </label>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">遇到的问题</label>
          <textarea class="form-input form-textarea" name="issues">${record?.issues || ''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">复盘备注</label>
          <textarea class="form-input form-textarea" name="notes">${record?.notes || ''}</textarea>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">取消</button>
          <button type="submit" class="btn btn-primary">${record ? '保存' : '添加'}</button>
        </div>
      </form>
    `;

    this.showModal(record ? '编辑烧成记录' : '添加烧成记录', content);
    
    document.getElementById('record-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveRecord(new FormData(e.target));
    });
  },

  async saveRecord(formData) {
    const data = {
      plan_id: formData.get('plan_id'),
      actual_start_time: formData.get('actual_start_time') || null,
      actual_end_time: formData.get('actual_end_time') || null,
      actual_duration: formData.get('actual_duration') ? parseFloat(formData.get('actual_duration')) : null,
      actual_cost: formData.get('actual_cost') ? parseFloat(formData.get('actual_cost')) : null,
      had_cracks: formData.get('had_cracks') === 'on',
      glaze_matured: formData.get('glaze_matured') === 'on',
      issues: formData.get('issues') || null,
      notes: formData.get('notes') || null
    };

    try {
      if (this.editMode && this.editItem) {
        await api.updateRecord(this.editItem.id, data);
        this.showToast('记录已更新', 'success');
      } else {
        await api.createRecord(data);
        this.showToast('记录已添加', 'success');
      }
      this.closeModal();
      await this.loadRecords();
      this.loadDashboard();
    } catch (error) {
      this.showToast('保存失败: ' + error.message, 'error');
    }
  },

  async editRecord(id) {
    const record = this.records.find(r => r.id === id);
    if (record) {
      this.openRecordModal(record);
    }
  },

  async deleteRecord(id) {
    if (!confirm('确定要删除这个烧成记录吗？')) return;
    
    try {
      await api.deleteRecord(id);
      this.showToast('记录已删除', 'success');
      await this.loadRecords();
      this.loadDashboard();
    } catch (error) {
      this.showToast('删除失败: ' + error.message, 'error');
    }
  },

  async openCompareModal() {
    if (this.plans.length < 2) {
      this.showToast('需要至少两个方案才能对比', 'warning');
      return;
    }

    const planOptions = this.plans.map(p => 
      `<option value="${p.id}">${p.name}</option>`
    ).join('');

    const content = `
      <form id="compare-form">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">方案1 <span class="required">*</span></label>
            <select class="form-input form-select" name="plan1_id" required>
              <option value="">请选择方案</option>
              ${planOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">方案2 <span class="required">*</span></label>
            <select class="form-input form-select" name="plan2_id" required>
              <option value="">请选择方案</option>
              ${planOptions}
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">取消</button>
          <button type="submit" class="btn btn-primary">对比方案</button>
        </div>
      </form>
    `;

    this.showModal('方案对比', content);
    
    document.getElementById('compare-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.comparePlans(new FormData(e.target));
    });
  },

  async comparePlans(formData) {
    const plan1Id = formData.get('plan1_id');
    const plan2Id = formData.get('plan2_id');

    if (plan1Id === plan2Id) {
      this.showToast('请选择两个不同的方案', 'warning');
      return;
    }

    try {
      const comparison = await api.comparePlans(plan1Id, plan2Id);
      
      const content = `
        <div class="card" style="box-shadow: none; margin-bottom: 0; padding: 0;">
          <table class="comparison-table">
            <thead>
              <tr>
                <th>对比项</th>
                <th>${comparison.plan1.name}</th>
                <th>${comparison.plan2.name}</th>
                <th>差异</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>窑炉</td>
                <td>${comparison.plan1.kiln_name}</td>
                <td>${comparison.plan2.kiln_name}</td>
                <td>-</td>
              </tr>
              <tr>
                <td>预计时长</td>
                <td>${comparison.plan1.estimated_duration?.toFixed(1) || '-'} 小时</td>
                <td>${comparison.plan2.estimated_duration?.toFixed(1) || '-'} 小时</td>
                <td class="${comparison.differences.duration_diff < 0 ? 'positive' : comparison.differences.duration_diff > 0 ? 'negative' : ''}">
                  ${comparison.differences.duration_diff > 0 ? '+' : ''}${comparison.differences.duration_diff.toFixed(1)} 小时
                </td>
              </tr>
              <tr>
                <td>预计电费</td>
                <td>¥${comparison.plan1.estimated_cost?.toFixed(2) || '-'}</td>
                <td>¥${comparison.plan2.estimated_cost?.toFixed(2) || '-'}</td>
                <td class="${comparison.differences.cost_diff < 0 ? 'positive' : comparison.differences.cost_diff > 0 ? 'negative' : ''}">
                  ${comparison.differences.cost_diff > 0 ? '+' : ''}¥${comparison.differences.cost_diff.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td>阶段数量</td>
                <td>${comparison.plan1.stages_count} 个</td>
                <td>${comparison.plan2.stages_count} 个</td>
                <td>-</td>
              </tr>
              <tr>
                <td>风险总数</td>
                <td><span class="risk-badge ${comparison.plan1.risks_count > 0 ? 'risk-medium' : 'risk-low'}">${comparison.plan1.risks_count}</span></td>
                <td><span class="risk-badge ${comparison.plan2.risks_count > 0 ? 'risk-medium' : 'risk-low'}">${comparison.plan2.risks_count}</span></td>
                <td class="${comparison.differences.risk_diff < 0 ? 'positive' : comparison.differences.risk_diff > 0 ? 'negative' : ''}">
                  ${comparison.differences.risk_diff > 0 ? '+' : ''}${comparison.differences.risk_diff}
                </td>
              </tr>
              <tr>
                <td>高风险数量</td>
                <td><span class="risk-badge ${comparison.plan1.high_risks_count > 0 ? 'risk-high' : 'risk-low'}">${comparison.plan1.high_risks_count}</span></td>
                <td><span class="risk-badge ${comparison.plan2.high_risks_count > 0 ? 'risk-high' : 'risk-low'}">${comparison.plan2.high_risks_count}</span></td>
                <td>-</td>
              </tr>
            </tbody>
          </table>

          <div style="margin-top: 16px; padding: 12px; background: var(--bg-color); border-radius: 8px;">
            <h4 style="margin-bottom: 8px;">对比结论</h4>
            <p style="font-size: 14px;">
              ${comparison.plan1.name} 对比 ${comparison.plan2.name}:
              ${comparison.differences.duration_diff < 0 ? '更省时' : comparison.differences.duration_diff > 0 ? '更耗时' : '时长相同'}，
              ${comparison.differences.cost_diff < 0 ? '更省钱' : comparison.differences.cost_diff > 0 ? '更费钱' : '费用相同'}，
              ${comparison.differences.risk_diff < 0 ? '风险更少' : comparison.differences.risk_diff > 0 ? '风险更多' : '风险数量相同'}。
            </p>
          </div>
        </div>

        <div class="modal-footer" style="margin-top: 24px; padding-left: 0; padding-right: 0;">
          <button type="button" class="btn btn-secondary" onclick="app.openCompareModal()">重新选择</button>
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">关闭</button>
        </div>
      `;

      this.showModal(`方案对比: ${comparison.plan1.name} vs ${comparison.plan2.name}`, content, true);
    } catch (error) {
      this.showToast('对比失败: ' + error.message, 'error');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
