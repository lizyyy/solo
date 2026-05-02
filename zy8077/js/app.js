class App {
  constructor() {
    this.api = new MockApiService();
    this.localStorage = new LocalStorage();
    this.syncQueue = new SyncQueue();
    this.conflictResolver = new ConflictResolver('last-write-wins');
    this.logs = [];
    this.inspections = [null, null];
    this.isOnline = true;
  }

  async init() {
    await this.localStorage.init();
    await this.syncQueue.init();
    
    this.api.loadSampleData(sampleData);
    
    this.bindEvents();
    this.renderPhotoGrids();
    this.updateUI();
    this.log('系统初始化完成', 'info');
  }

  bindEvents() {
    document.getElementById('toggleOnlineBtn').addEventListener('click', () => this.toggleOnline());
    document.getElementById('createInspectionBtn').addEventListener('click', () => this.createInspection());
    document.getElementById('syncBtn').addEventListener('click', () => this.sync());
    document.getElementById('resetBtn').addEventListener('click', () => this.reset());
    document.getElementById('refreshSnapshotBtn').addEventListener('click', () => this.updateSnapshot());
    
    document.getElementById('conflictStrategy1').addEventListener('change', (e) => {
      this.conflictResolver.setStrategy(e.target.value);
    });
    document.getElementById('conflictStrategy2').addEventListener('change', (e) => {
      this.conflictResolver.setStrategy(e.target.value);
    });
    
    document.getElementById('addAbnormal1').addEventListener('click', () => this.addAbnormalItem(1));
    document.getElementById('addAbnormal2').addEventListener('click', () => this.addAbnormalItem(2));
    
    document.getElementById('inspectionForm1').addEventListener('submit', (e) => this.saveInspection(e, 1));
    document.getElementById('inspectionForm2').addEventListener('submit', (e) => this.saveInspection(e, 2));
    
    this.syncQueue.addListener(() => this.updateQueueUI());
    this.api.addListener(() => this.updateSnapshot());
    this.conflictResolver.addListener(() => this.updateConflictUI());
  }

  toggleOnline() {
    this.isOnline = !this.isOnline;
    this.api.setOnline(this.isOnline);
    
    const badge = document.getElementById('statusBadge');
    const btn = document.getElementById('toggleOnlineBtn');
    
    if (this.isOnline) {
      badge.textContent = '在线';
      badge.className = 'status-badge status-online';
      btn.textContent = '切换离线';
      this.log('网络已连接', 'info');
    } else {
      badge.textContent = '离线';
      badge.className = 'status-badge status-offline';
      btn.textContent = '切换在线';
      this.log('网络已断开', 'warning');
    }
  }

  createInspection() {
    const id = `inspection_${Date.now()}`;
    const inspection = new InspectionModel(id, {
      date: new Date().toISOString().split('T')[0]
    });
    
    let slot = 0;
    if (this.inspections[0] !== null && this.inspections[1] === null) {
      slot = 1;
    }
    
    this.inspections[slot] = inspection;
    this.loadInspectionToForm(slot + 1, inspection);
    this.log(`创建新巡检单: ${id}`, 'info');
  }

  loadInspectionToForm(slotNum, inspection) {
    const prefix = slotNum === 1 ? '' : '2';
    
    document.getElementById(`deviceId${prefix || '1'}`).value = inspection.deviceId || '';
    document.getElementById(`deviceName${prefix || '1'}`).value = inspection.deviceName || '';
    document.getElementById(`inspector${prefix || '1'}`).value = inspection.inspector || '';
    document.getElementById(`date${prefix || '1'}`).value = inspection.date || '';
    document.getElementById(`notes${prefix || '1'}`).value = inspection.notes || '';
    document.getElementById(`status${prefix || '1'}`).value = inspection.status || 'draft';
    
    this.renderAbnormalList(slotNum, inspection.abnormalItems || []);
    this.renderPhotoGrid(slotNum, inspection.photos || []);
  }

  renderAbnormalList(slotNum, items) {
    const list = document.getElementById(`abnormalList${slotNum}`);
    list.innerHTML = '';
    
    items.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'abnormal-item';
      div.innerHTML = `
        <input type="text" value="${item}" data-index="${index}" class="abnormal-input">
        <button type="button" class="danger remove-abnormal" data-index="${index}">删除</button>
      `;
      list.appendChild(div);
    });
    
    list.querySelectorAll('.remove-abnormal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        const currentItems = this.getAbnormalItemsFromForm(slotNum);
        currentItems.splice(index, 1);
        this.inspections[slotNum - 1].abnormalItems = currentItems;
        this.renderAbnormalList(slotNum, currentItems);
      });
    });
  }

  getAbnormalItemsFromForm(slotNum) {
    const list = document.getElementById(`abnormalList${slotNum}`);
    const inputs = list.querySelectorAll('.abnormal-input');
    return Array.from(inputs).map(input => input.value);
  }

  addAbnormalItem(slotNum) {
    if (!this.inspections[slotNum - 1]) {
      this.inspections[slotNum - 1] = new InspectionModel(`inspection_${Date.now()}`);
    }
    
    const items = this.getAbnormalItemsFromForm(slotNum);
    items.push('');
    this.inspections[slotNum - 1].abnormalItems = items;
    this.renderAbnormalList(slotNum, items);
  }

  renderPhotoGrids() {
    this.renderPhotoGrid(1, []);
    this.renderPhotoGrid(2, []);
  }

  renderPhotoGrid(slotNum, photos) {
    const grid = document.getElementById(`photoGrid${slotNum}`);
    grid.innerHTML = '';
    
    for (let i = 0; i < 6; i++) {
      const div = document.createElement('div');
      div.className = 'photo-placeholder';
      div.dataset.index = i;
      
      if (photos[i]) {
        div.classList.add('has-photo');
        div.innerHTML = `
          <span>📷</span>
          <span>照片 ${i + 1}</span>
        `;
      } else {
        div.innerHTML = `
          <span>+</span>
          <span>添加照片</span>
        `;
      }
      
      div.addEventListener('click', () => this.togglePhoto(slotNum, i));
      grid.appendChild(div);
    }
  }

  togglePhoto(slotNum, index) {
    if (!this.inspections[slotNum - 1]) {
      this.inspections[slotNum - 1] = new InspectionModel(`inspection_${Date.now()}`);
    }
    
    const photos = [...(this.inspections[slotNum - 1].photos || [])];
    if (photos[index]) {
      photos[index] = null;
    } else {
      photos[index] = `photo_${Date.now()}_${index}`;
    }
    
    this.inspections[slotNum - 1].photos = photos.filter(p => p !== null);
    this.renderPhotoGrid(slotNum, this.inspections[slotNum - 1].photos);
  }

  async saveInspection(e, slotNum) {
    e.preventDefault();
    
    const prefix = slotNum === 1 ? '' : '2';
    const id = this.inspections[slotNum - 1]?.id || `inspection_${Date.now()}`;
    
    const inspectionData = {
      id,
      deviceId: document.getElementById(`deviceId${prefix || '1'}`).value,
      deviceName: document.getElementById(`deviceName${prefix || '1'}`).value,
      inspector: document.getElementById(`inspector${prefix || '1'}`).value,
      date: document.getElementById(`date${prefix || '1'}`).value,
      notes: document.getElementById(`notes${prefix || '1'}`).value,
      abnormalItems: this.getAbnormalItemsFromForm(slotNum),
      photos: this.inspections[slotNum - 1]?.photos || [],
      status: document.getElementById(`status${prefix || '1'}`).value,
      lastModified: Date.now(),
      version: (this.inspections[slotNum - 1]?.version || 0) + 1
    };
    
    const inspection = InspectionModel.fromJSON(inspectionData);
    this.inspections[slotNum - 1] = inspection;
    
    await this.localStorage.save(inspection.toJSON());
    this.log(`保存巡检单到本地: ${id}`, 'info');
    
    if (this.isOnline) {
      try {
        const existing = await this.api.getInspection(id).catch(() => null);
        if (existing) {
          await this.api.updateInspection(inspection.toJSON());
          this.log(`更新服务器数据: ${id}`, 'success');
        } else {
          await this.api.createInspection(inspection.toJSON());
          this.log(`创建服务器数据: ${id}`, 'success');
        }
      } catch (error) {
        await this.addToQueue(inspection, existing ? 'update' : 'create');
        this.log(`网络请求失败，加入队列: ${id}`, 'warning');
      }
    } else {
      const existing = await this.localStorage.get(id);
      await this.addToQueue(inspection, existing ? 'update' : 'create');
      this.log(`离线模式，加入队列: ${id}`, 'warning');
    }
  }

  async addToQueue(inspection, action) {
    const queueItem = new SyncQueueItem(
      `queue_${Date.now()}`,
      action,
      inspection.toJSON()
    );
    await this.syncQueue.add(queueItem);
  }

  async sync() {
    if (!this.isOnline) {
      this.log('无法同步：当前离线', 'error');
      return;
    }
    
    this.log('开始同步...', 'info');
    
    try {
      await this.syncQueue.process(this.api, this.conflictResolver, this);
      this.log('同步完成', 'success');
    } catch (error) {
      this.log(`同步失败: ${error.message}`, 'error');
    }
  }

  log(message, type = 'info') {
    const log = new SyncLog(message, type);
    this.logs.unshift(log);
    if (this.logs.length > 100) this.logs.pop();
    this.updateLogUI();
  }

  updateUI() {
    this.updateQueueUI();
    this.updateLogUI();
    this.updateSnapshot();
    this.updateConflictUI();
  }

  async updateQueueUI() {
    const items = await this.syncQueue.getAll();
    const countEl = document.getElementById('queueCount');
    const listEl = document.getElementById('queueList');
    
    countEl.textContent = `${items.length} 项`;
    listEl.innerHTML = '';
    
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = `queue-item ${item.status}`;
      div.innerHTML = `
        <div><strong>${item.action.toUpperCase()}</strong> - ${item.data.id}</div>
        <div style="font-size: 12px; color: #666;">
          重试: ${item.retryCount} | ${new Date(item.timestamp).toLocaleTimeString()}
          ${item.error ? `<br><span style="color: #e74c3c;">${item.error}</span>` : ''}
        </div>
      `;
      listEl.appendChild(div);
    });
  }

  updateLogUI() {
    const panel = document.getElementById('logPanel');
    panel.innerHTML = '';
    
    this.logs.forEach(log => {
      const div = document.createElement('div');
      div.className = `log-item ${log.type}`;
      div.textContent = `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}`;
      panel.appendChild(div);
    });
  }

  updateSnapshot() {
    const panel = document.getElementById('snapshotPanel');
    const snapshot = this.api.getSnapshot();
    
    panel.innerHTML = '';
    
    if (snapshot.length === 0) {
      panel.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">暂无数据</p>';
      return;
    }
    
    snapshot.forEach(item => {
      const div = document.createElement('div');
      div.className = 'snapshot-item';
      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <strong>${item.deviceName || item.id}</strong>
          <span style="font-size: 12px; color: #666;">v${item.version}</span>
        </div>
        <div style="font-size: 13px; color: #555;">
          <div>设备编号: ${item.deviceId || '-'}</div>
          <div>巡检员: ${item.inspector || '-'}</div>
          <div>日期: ${item.date || '-'}</div>
          <div>状态: ${item.status || '-'}</div>
          <div>备注: ${item.notes || '-'}</div>
          <div>异常项: ${(item.abnormalItems || []).length} 项</div>
          <div>照片: ${(item.photos || []).length} 张</div>
        </div>
      `;
      panel.appendChild(div);
    });
  }

  updateConflictUI() {
    const panel = document.getElementById('conflictPanel');
    const conflicts = this.conflictResolver.getConflicts();
    
    panel.innerHTML = '';
    
    if (conflicts.length === 0) {
      panel.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">暂无冲突</p>';
      return;
    }
    
    conflicts.forEach(conflict => {
      const div = document.createElement('div');
      div.className = `conflict-item ${conflict.resolved ? 'resolved' : ''}`;
      div.innerHTML = `
        <div style="margin-bottom: 10px;">
          <strong>字段: ${conflict.field}</strong>
          ${conflict.resolved ? `<span style="margin-left: 10px; color: #27ae60;">已解决 (${conflict.resolution})</span>` : ''}
        </div>
        <div class="conflict-compare">
          <div class="conflict-side">
            <h4>本地数据</h4>
            <pre style="font-size: 12px; white-space: pre-wrap; word-break: break-all;">${JSON.stringify(conflict.localData[conflict.field], null, 2)}</pre>
          </div>
          <div class="conflict-side">
            <h4>服务器数据</h4>
            <pre style="font-size: 12px; white-space: pre-wrap; word-break: break-all;">${JSON.stringify(conflict.serverData[conflict.field], null, 2)}</pre>
          </div>
        </div>
      `;
      panel.appendChild(div);
    });
  }

  async reset() {
    if (!confirm('确定要重置所有数据吗？')) return;
    
    this.api.reset();
    await this.localStorage.clear();
    await this.syncQueue.clear();
    this.logs = [];
    this.inspections = [null, null];
    this.conflictResolver.clearConflicts();
    
    this.api.loadSampleData(sampleData);
    
    document.getElementById('inspectionForm1').reset();
    document.getElementById('inspectionForm2').reset();
    this.renderAbnormalList(1, []);
    this.renderAbnormalList(2, []);
    this.renderPhotoGrids();
    
    this.updateUI();
    this.log('系统已重置', 'info');
  }
}

const app = new App();
app.init();
