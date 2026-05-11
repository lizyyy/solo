const API_BASE = '';

class TreePondInspector {
  constructor() {
    this.treePonds = [];
    this.treeSpecies = [];
    this.diseaseRecords = [];
    this.statistics = {};
    this.filters = {
      waterLevel: '',
      status: '',
      species: ''
    };
    this.sortBy = 'priority';
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadAllData();
    this.autoRestoreWorkspace();
  }

  setupEventListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    document.getElementById('filterWaterLevel').addEventListener('change', (e) => {
      this.filters.waterLevel = e.target.value;
      this.renderAll();
      this.saveWorkspaceAuto();
    });

    document.getElementById('filterStatus').addEventListener('change', (e) => {
      this.filters.status = e.target.value;
      this.renderAll();
      this.saveWorkspaceAuto();
    });

    document.getElementById('filterSpecies').addEventListener('change', (e) => {
      this.filters.species = e.target.value;
      this.renderAll();
      this.saveWorkspaceAuto();
    });

    document.getElementById('sortBy').addEventListener('change', (e) => {
      this.sortBy = e.target.value;
      this.renderAll();
      this.saveWorkspaceAuto();
    });

    document.getElementById('clearFiltersBtn').addEventListener('click', () => {
      this.clearFilters();
    });

    document.getElementById('saveWorkspaceBtn').addEventListener('click', () => {
      this.saveWorkspace();
    });

    document.getElementById('restoreWorkspaceBtn').addEventListener('click', () => {
      this.showRestoreWorkspaceModal();
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
      this.exportReport();
    });

    document.getElementById('addTreePondBtn').addEventListener('click', () => {
      this.showTreePondModal();
    });

    document.getElementById('addSpeciesBtn').addEventListener('click', () => {
      this.showSpeciesModal();
    });

    document.getElementById('addDiseaseBtn').addEventListener('click', () => {
      this.showDiseaseModal();
    });

    document.getElementById('closeModal').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') this.closeModal();
    });
  }

  async loadAllData() {
    try {
      const [pondsRes, speciesRes, diseaseRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/tree-ponds`),
        fetch(`${API_BASE}/api/tree-species`),
        fetch(`${API_BASE}/api/disease-records`),
        fetch(`${API_BASE}/api/statistics`)
      ]);

      const pondsData = await pondsRes.json();
      const speciesData = await speciesRes.json();
      const diseaseData = await diseaseRes.json();
      const statsData = await statsRes.json();

      if (pondsData.success) this.treePonds = pondsData.data;
      if (speciesData.success) this.treeSpecies = speciesData.data;
      if (diseaseData.success) this.diseaseRecords = diseaseData.data;
      if (statsData.success) this.statistics = statsData.data;

      this.populateSpeciesFilter();
      this.renderAll();
    } catch (error) {
      this.showNotification('加载数据失败', 'error');
      console.error(error);
    }
  }

  populateSpeciesFilter() {
    const select = document.getElementById('filterSpecies');
    const currentValue = select.value;
    select.innerHTML = '<option value="">全部树种</option>';
    
    this.treeSpecies.forEach(species => {
      const option = document.createElement('option');
      option.value = species.name;
      option.textContent = species.name;
      select.appendChild(option);
    });

    if (this.filters.species) {
      select.value = this.filters.species;
    }
  }

  renderAll() {
    this.renderStats();
    this.renderUrgentList();
    this.renderMap();
    this.renderTreePondTable();
    this.renderSpeciesTable();
    this.renderDiseaseTable();
  }

  renderStats() {
    const grid = document.getElementById('statsGrid');
    const stats = this.statistics;
    
    grid.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${stats.totalTreePonds || 0}</div>
        <div class="stat-label">树池总数</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-value">${(stats.byWaterLevel?.[3] || 0) + (stats.byWaterLevel?.[2] || 0)}</div>
        <div class="stat-label">中度以上积水</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-value">${stats.byStatus?.pending || 0}</div>
        <div class="stat-label">待处理</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.byStatus?.in_progress || 0}</div>
        <div class="stat-label">处理中</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">${stats.byStatus?.completed || 0}</div>
        <div class="stat-label">已完成</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-value">${stats.untreatedDiseases || 0}</div>
        <div class="stat-label">未处理病害</div>
      </div>
    `;
  }

  renderUrgentList() {
    const list = document.getElementById('urgentList');
    const urgent = this.statistics.urgentPonds || [];
    
    if (urgent.length === 0) {
      list.innerHTML = '<div style="text-align: center; color: #666; padding: 1rem;">暂无紧急事项</div>';
      return;
    }

    list.innerHTML = urgent.map(pond => `
      <div class="urgent-item" onclick="inspector.selectTreePond(${pond.id})">
        <div>
          <div style="font-weight: 500;">${pond.code}</div>
          <div style="font-size: 0.75rem; color: #666;">${pond.location}</div>
        </div>
        <span class="badge">${this.getWaterLevelText(pond.waterLevel)}</span>
      </div>
    `).join('');
  }

  renderMap() {
    const mapPoints = document.getElementById('mapPoints');
    const filtered = this.getFilteredTreePonds();
    
    mapPoints.innerHTML = filtered.map((pond, index) => {
      const total = filtered.length;
      const col = index % 4;
      const row = Math.floor(index / 4);
      const maxRows = Math.ceil(total / 4);
      
      const x = 15 + (col * 22) + (Math.random() * 8);
      const y = 15 + (row * (70 / Math.max(maxRows, 1))) + (Math.random() * 8);
      
      return `
        <div class="map-point level-${pond.waterLevel}" 
             style="left: ${x}%; top: ${y}%;"
             onclick="inspector.selectTreePond(${pond.id})">
          <div class="tooltip">
            ${pond.code} - ${pond.location}<br>
            ${this.getWaterLevelText(pond.waterLevel)} - ${this.getStatusText(pond.status)}
          </div>
        </div>
      `;
    }).join('');
  }

  renderTreePondTable() {
    const tbody = document.getElementById('treePondTableBody');
    const filtered = this.getFilteredTreePonds();
    
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #666;">暂无符合条件的树池记录</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(pond => `
      <tr>
        <td><strong>${pond.code}</strong></td>
        <td>${pond.location}</td>
        <td>${pond.treeSpecies || '-'}</td>
        <td><span class="badge badge-water-${pond.waterLevel}">${this.getWaterLevelText(pond.waterLevel)}</span></td>
        <td><span class="badge badge-${pond.status}">${this.getStatusText(pond.status)}</span></td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-sm btn-secondary" onclick="inspector.editTreePond(${pond.id})">编辑</button>
            <button class="btn btn-sm btn-primary" onclick="inspector.updateTreePondStatus(${pond.id})">更新状态</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  renderSpeciesTable() {
    const tbody = document.getElementById('speciesTableBody');
    
    if (this.treeSpecies.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #666;">暂无树种档案</td></tr>';
      return;
    }

    tbody.innerHTML = this.treeSpecies.map(species => `
      <tr>
        <td><strong>${species.name}</strong></td>
        <td><em>${species.scientificName || '-'}</em></td>
        <td>${species.waterTolerance || '-'}</td>
        <td>${species.diseaseRisk || '-'}</td>
        <td>
          <div class="action-buttons">
            <button class="btn btn-sm btn-secondary" onclick="inspector.viewSpecies(${species.id})">查看</button>
            <button class="btn btn-sm btn-secondary" onclick="inspector.editSpecies(${species.id})">编辑</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  renderDiseaseTable() {
    const tbody = document.getElementById('diseaseTableBody');
    
    if (this.diseaseRecords.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #666;">暂无病害记录</td></tr>';
      return;
    }

    tbody.innerHTML = this.diseaseRecords.map(record => {
      const pond = this.treePonds.find(p => p.id === record.treePondId);
      const severityClass = record.severity === '严重' ? 'high' : 
                            record.severity === '中等' ? 'medium' : 'low';
      return `
        <tr>
          <td>${pond ? pond.code : '未知树池'}</td>
          <td>${record.diseaseName}</td>
          <td><span class="badge badge-severity-${severityClass}">${record.severity}</span></td>
          <td><span class="badge badge-${record.status}">${this.getDiseaseStatusText(record.status)}</span></td>
          <td>
            <div class="action-buttons">
              <button class="btn btn-sm btn-secondary" onclick="inspector.editDisease(${record.id})">编辑</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  getFilteredTreePonds() {
    let filtered = [...this.treePonds];

    if (this.filters.waterLevel !== '') {
      filtered = filtered.filter(p => p.waterLevel === parseInt(this.filters.waterLevel));
    }

    if (this.filters.status !== '') {
      filtered = filtered.filter(p => p.status === this.filters.status);
    }

    if (this.filters.species !== '') {
      filtered = filtered.filter(p => p.treeSpecies === this.filters.species);
    }

    filtered.sort((a, b) => {
      switch (this.sortBy) {
        case 'priority':
          const levelDiff = b.waterLevel - a.waterLevel;
          if (levelDiff !== 0) return levelDiff;
          const statusOrder = { pending: 0, in_progress: 1, completed: 2 };
          return statusOrder[a.status] - statusOrder[b.status];
        case 'waterLevel':
          return b.waterLevel - a.waterLevel;
        case 'date':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'code':
          return a.code.localeCompare(b.code);
        default:
          return 0;
      }
    });

    return filtered;
  }

  getWaterLevelText(level) {
    const texts = ['无积水', '轻度积水', '中度积水', '严重积水'];
    return texts[level] || '未知';
  }

  getStatusText(status) {
    const texts = {
      pending: '待处理',
      in_progress: '处理中',
      completed: '已完成'
    };
    return texts[status] || status;
  }

  getDiseaseStatusText(status) {
    const texts = {
      untreated: '未处理',
      in_progress: '处理中',
      treated: '已治愈'
    };
    return texts[status] || status;
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `${tabName}-tab`);
    });
  }

  clearFilters() {
    this.filters = { waterLevel: '', status: '', species: '' };
    this.sortBy = 'priority';
    document.getElementById('filterWaterLevel').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterSpecies').value = '';
    document.getElementById('sortBy').value = 'priority';
    this.renderAll();
    this.showNotification('筛选条件已清除', 'success');
  }

  selectTreePond(id) {
    const pond = this.treePonds.find(p => p.id === id);
    if (pond) {
      this.switchTab('list');
      this.showTreePondModal(pond);
    }
  }

  async showTreePondModal(existing = null) {
    const isEdit = !!existing;
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    title.textContent = isEdit ? '编辑树池记录' : '新增树池记录';
    
    body.innerHTML = `
      <form id="treePondForm">
        <div class="form-group">
          <label>树池编号 *</label>
          <input type="text" class="form-control" name="code" value="${existing?.code || ''}" required placeholder="如: TP-001">
        </div>
        <div class="form-group">
          <label>位置 *</label>
          <input type="text" class="form-control" name="location" value="${existing?.location || ''}" required placeholder="如: 人民路88号">
        </div>
        <div class="form-group">
          <label>树种</label>
          <select class="form-control" name="treeSpecies">
            <option value="">请选择</option>
            ${this.treeSpecies.map(s => 
              `<option value="${s.name}" ${existing?.treeSpecies === s.name ? 'selected' : ''}>${s.name}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>积水等级</label>
          <select class="form-control" name="waterLevel">
            <option value="0" ${existing?.waterLevel === 0 ? 'selected' : ''}>0级 - 无积水</option>
            <option value="1" ${existing?.waterLevel === 1 ? 'selected' : ''}>1级 - 轻度</option>
            <option value="2" ${existing?.waterLevel === 2 ? 'selected' : ''}>2级 - 中度</option>
            <option value="3" ${existing?.waterLevel === 3 ? 'selected' : ''}>3级 - 严重</option>
          </select>
        </div>
        <div class="form-group">
          <label>处置状态</label>
          <select class="form-control" name="status">
            <option value="pending" ${existing?.status === 'pending' ? 'selected' : ''}>待处理</option>
            <option value="in_progress" ${existing?.status === 'in_progress' ? 'selected' : ''}>处理中</option>
            <option value="completed" ${existing?.status === 'completed' ? 'selected' : ''}>已完成</option>
          </select>
        </div>
        <div class="form-group">
          <label>备注</label>
          <textarea class="form-control" name="notes" rows="3">${existing?.notes || ''}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="inspector.closeModal()">取消</button>
          <button type="submit" class="btn btn-primary">${isEdit ? '保存' : '创建'}</button>
        </div>
      </form>
    `;

    document.getElementById('treePondForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = {
        code: formData.get('code'),
        location: formData.get('location'),
        treeSpecies: formData.get('treeSpecies') || null,
        waterLevel: parseInt(formData.get('waterLevel')),
        status: formData.get('status'),
        notes: formData.get('notes') || null
      };

      try {
        let response;
        if (isEdit) {
          response = await fetch(`${API_BASE}/api/tree-ponds/${existing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
        } else {
          response = await fetch(`${API_BASE}/api/tree-ponds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
        }

        const result = await response.json();

        if (result.success) {
          this.showNotification(result.message, 'success');
          this.closeModal();
          await this.loadAllData();
        } else {
          if (result.conflictField) {
            this.showNotification(`冲突：${result.error}（已存在记录ID: ${result.existingId}）`, 'error');
          } else if (result.missingFields) {
            this.showNotification(`缺失字段：${result.missingFields.join(', ')}`, 'error');
          } else {
            this.showNotification(result.error, 'error');
          }
        }
      } catch (error) {
        this.showNotification('操作失败', 'error');
      }
    });

    modal.classList.add('active');
  }

  async updateTreePondStatus(id) {
    const pond = this.treePonds.find(p => p.id === id);
    if (!pond) return;

    const statusOrder = ['pending', 'in_progress', 'completed'];
    const currentIndex = statusOrder.indexOf(pond.status);
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length];

    try {
      const response = await fetch(`${API_BASE}/api/tree-ponds/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });

      const result = await response.json();
      if (result.success) {
        this.showNotification(`状态已更新为：${this.getStatusText(nextStatus)}`, 'success');
        await this.loadAllData();
      } else {
        this.showNotification(result.error, 'error');
      }
    } catch (error) {
      this.showNotification('操作失败', 'error');
    }
  }

  editTreePond(id) {
    const pond = this.treePonds.find(p => p.id === id);
    if (pond) this.showTreePondModal(pond);
  }

  async showSpeciesModal(existing = null) {
    const isEdit = !!existing;
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    title.textContent = isEdit ? '编辑树种档案' : '新增树种档案';
    
    body.innerHTML = `
      <form id="speciesForm">
        <div class="form-group">
          <label>树种名称 *</label>
          <input type="text" class="form-control" name="name" value="${existing?.name || ''}" required>
        </div>
        <div class="form-group">
          <label>学名</label>
          <input type="text" class="form-control" name="scientificName" value="${existing?.scientificName || ''}">
        </div>
        <div class="form-group">
          <label>耐水性</label>
          <select class="form-control" name="waterTolerance">
            <option value="较差" ${existing?.waterTolerance === '较差' ? 'selected' : ''}>较差</option>
            <option value="中等" ${existing?.waterTolerance === '中等' ? 'selected' : ''}>中等</option>
            <option value="较强" ${existing?.waterTolerance === '较强' ? 'selected' : ''}>较强</option>
          </select>
        </div>
        <div class="form-group">
          <label>病害风险</label>
          <select class="form-control" name="diseaseRisk">
            <option value="较低" ${existing?.diseaseRisk === '较低' ? 'selected' : ''}>较低</option>
            <option value="中等" ${existing?.diseaseRisk === '中等' ? 'selected' : ''}>中等</option>
            <option value="较高" ${existing?.diseaseRisk === '较高' ? 'selected' : ''}>较高</option>
          </select>
        </div>
        <div class="form-group">
          <label>说明</label>
          <textarea class="form-control" name="notes" rows="3">${existing?.notes || ''}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="inspector.closeModal()">取消</button>
          <button type="submit" class="btn btn-primary">${isEdit ? '保存' : '创建'}</button>
        </div>
      </form>
    `;

    document.getElementById('speciesForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = {
        name: formData.get('name'),
        scientificName: formData.get('scientificName') || null,
        waterTolerance: formData.get('waterTolerance'),
        diseaseRisk: formData.get('diseaseRisk'),
        notes: formData.get('notes') || null
      };

      try {
        let response;
        if (isEdit) {
          response = await fetch(`${API_BASE}/api/tree-species/${existing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
        } else {
          response = await fetch(`${API_BASE}/api/tree-species`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
        }

        const result = await response.json();
        if (result.success) {
          this.showNotification(result.message, 'success');
          this.closeModal();
          await this.loadAllData();
        } else {
          this.showNotification(result.error, 'error');
        }
      } catch (error) {
        this.showNotification('操作失败', 'error');
      }
    });

    modal.classList.add('active');
  }

  viewSpecies(id) {
    const species = this.treeSpecies.find(s => s.id === id);
    if (!species) return;

    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    title.textContent = species.name;
    body.innerHTML = `
      <div style="line-height: 1.8;">
        <p><strong>学名：</strong><em>${species.scientificName || '-'}</em></p>
        <p><strong>耐水性：</strong>${species.waterTolerance || '-'}</p>
        <p><strong>病害风险：</strong>${species.diseaseRisk || '-'}</p>
        <p><strong>常见病害：</strong>${(species.commonDiseases || []).join('、') || '-'}</p>
        <p style="margin-top: 1rem;"><strong>说明：</strong>${species.notes || '-'}</p>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" onclick="inspector.closeModal()">关闭</button>
      </div>
    `;

    modal.classList.add('active');
  }

  editSpecies(id) {
    const species = this.treeSpecies.find(s => s.id === id);
    if (species) this.showSpeciesModal(species);
  }

  async showDiseaseModal(existing = null) {
    const isEdit = !!existing;
    const modal = document.getElementById('modal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    title.textContent = isEdit ? '编辑病害记录' : '新增病害记录';
    
    body.innerHTML = `
      <form id="diseaseForm">
        <div class="form-group">
          <label>关联树池 *</label>
          <select class="form-control" name="treePondId" required>
            <option value="">请选择树池</option>
            ${this.treePonds.map(p => 
              `<option value="${p.id}" ${existing?.treePondId === p.id ? 'selected' : ''}>${p.code} - ${p.location}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>病害名称 *</label>
          <input type="text" class="form-control" name="diseaseName" value="${existing?.diseaseName || ''}" required>
        </div>
        <div class="form-group">
          <label>严重程度</label>
          <select class="form-control" name="severity">
            <option value="轻微" ${existing?.severity === '轻微' ? 'selected' : ''}>轻微</option>
            <option value="中等" ${existing?.severity === '中等' ? 'selected' : ''}>中等</option>
            <option value="严重" ${existing?.severity === '严重' ? 'selected' : ''}>严重</option>
          </select>
        </div>
        <div class="form-group">
          <label>状态</label>
          <select class="form-control" name="status">
            <option value="untreated" ${existing?.status === 'untreated' ? 'selected' : ''}>未处理</option>
            <option value="in_progress" ${existing?.status === 'in_progress' ? 'selected' : ''}>处理中</option>
            <option value="treated" ${existing?.status === 'treated' ? 'selected' : ''}>已治愈</option>
          </select>
        </div>
        <div class="form-group">
          <label>备注</label>
          <textarea class="form-control" name="notes" rows="3">${existing?.notes || ''}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="inspector.closeModal()">取消</button>
          <button type="submit" class="btn btn-primary">${isEdit ? '保存' : '创建'}</button>
        </div>
      </form>
    `;

    document.getElementById('diseaseForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = {
        treePondId: parseInt(formData.get('treePondId')),
        diseaseName: formData.get('diseaseName'),
        severity: formData.get('severity'),
        status: formData.get('status'),
        notes: formData.get('notes') || null
      };

      try {
        let response;
        if (isEdit) {
          response = await fetch(`${API_BASE}/api/disease-records/${existing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
        } else {
          response = await fetch(`${API_BASE}/api/disease-records`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
        }

        const result = await response.json();
        if (result.success) {
          this.showNotification(result.message, 'success');
          this.closeModal();
          await this.loadAllData();
        } else {
          this.showNotification(result.error, 'error');
        }
      } catch (error) {
        this.showNotification('操作失败', 'error');
      }
    });

    modal.classList.add('active');
  }

  editDisease(id) {
    const record = this.diseaseRecords.find(r => r.id === id);
    if (record) this.showDiseaseModal(record);
  }

  closeModal() {
    document.getElementById('modal').classList.remove('active');
  }

  showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  }

  async saveWorkspace() {
    const name = prompt('请输入工作区名称：', '默认工作区');
    if (!name) return;

    const workspace = {
      filters: this.filters,
      sortBy: this.sortBy,
      timestamp: Date.now()
    };

    try {
      const response = await fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workspace)
      });

      const result = await response.json();
      if (result.success) {
        this.showNotification(`工作区 '${name}' 已保存`, 'success');
      } else {
        this.showNotification(result.error, 'error');
      }
    } catch (error) {
      this.showNotification('保存失败', 'error');
    }
  }

  saveWorkspaceAuto() {
    const workspace = {
      filters: this.filters,
      sortBy: this.sortBy,
      timestamp: Date.now()
    };
    localStorage.setItem('treeInspector_workspace_auto', JSON.stringify(workspace));
  }

  autoRestoreWorkspace() {
    const saved = localStorage.getItem('treeInspector_workspace_auto');
    if (saved) {
      try {
        const workspace = JSON.parse(saved);
        this.filters = workspace.filters || this.filters;
        this.sortBy = workspace.sortBy || 'priority';
        
        document.getElementById('filterWaterLevel').value = this.filters.waterLevel;
        document.getElementById('filterStatus').value = this.filters.status;
        document.getElementById('sortBy').value = this.sortBy;
        
        this.renderAll();
      } catch (e) {
        console.error('自动恢复工作区失败', e);
      }
    }
  }

  async showRestoreWorkspaceModal() {
    const savedAuto = localStorage.getItem('treeInspector_workspace_auto');
    
    let html = '<div style="line-height: 1.8;">';
    
    if (savedAuto) {
      const workspace = JSON.parse(savedAuto);
      const date = new Date(workspace.timestamp);
      html += `
        <div style="padding: 1rem; background: #e3f2fd; border-radius: 8px; margin-bottom: 1rem;">
          <p><strong>上次会话</strong></p>
          <p style="font-size: 0.875rem; color: #666;">保存时间: ${date.toLocaleString()}</p>
          <p style="font-size: 0.875rem;">
            积水等级: ${workspace.filters?.waterLevel === '' ? '全部' : this.getWaterLevelText(parseInt(workspace.filters?.waterLevel))}<br>
            处置状态: ${workspace.filters?.status === '' ? '全部' : this.getStatusText(workspace.filters?.status)}<br>
            树种: ${workspace.filters?.species === '' ? '全部' : workspace.filters?.species}
          </p>
          <button class="btn btn-primary btn-sm" onclick="inspector.restoreFromLocal()" style="margin-top: 0.5rem;">恢复此工作区</button>
        </div>
      `;
    } else {
      html += '<p style="color: #666; margin-bottom: 1rem;">暂无保存的工作区</p>';
    }

    html += `
      <div class="form-actions">
        <button class="btn btn-secondary" onclick="inspector.closeModal()">关闭</button>
      </div>
    </div>`;

    const modal = document.getElementById('modal');
    document.getElementById('modalTitle').textContent = '恢复工作区';
    document.getElementById('modalBody').innerHTML = html;
    modal.classList.add('active');
  }

  restoreFromLocal() {
    const saved = localStorage.getItem('treeInspector_workspace_auto');
    if (saved) {
      const workspace = JSON.parse(saved);
      this.filters = workspace.filters || this.filters;
      this.sortBy = workspace.sortBy || 'priority';
      
      document.getElementById('filterWaterLevel').value = this.filters.waterLevel;
      document.getElementById('filterStatus').value = this.filters.status;
      document.getElementById('filterSpecies').value = this.filters.species;
      document.getElementById('sortBy').value = this.sortBy;
      
      this.renderAll();
      this.closeModal();
      this.showNotification('工作区已恢复', 'success');
    }
  }

  async exportReport() {
    try {
      const params = new URLSearchParams();
      if (this.filters.waterLevel !== '') params.append('waterLevel', this.filters.waterLevel);
      if (this.filters.status !== '') params.append('status', this.filters.status);
      if (this.filters.species !== '') params.append('treeSpecies', this.filters.species);

      const response = await fetch(`${API_BASE}/api/export?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.fileName;
        a.click();
        URL.revokeObjectURL(url);
        
        const stats = result.data.statistics;
        this.showNotification(
          `导出成功！共 ${stats.total} 条记录，文件已下载`,
          'success'
        );
      } else {
        this.showNotification(result.error, 'error');
      }
    } catch (error) {
      this.showNotification('导出失败', 'error');
    }
  }
}

const inspector = new TreePondInspector();