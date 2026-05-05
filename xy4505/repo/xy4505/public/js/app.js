class StreetlightApp {
  constructor() {
    this.apiBase = '/api';
    this.currentRisk = null;
    this.allRisks = [];
    this.sortMode = 'priority';
    this.filters = {
      road: '',
      priority: '',
      status: ''
    };
    
    this.init();
  }
  
  async init() {
    this.bindEvents();
    await this.loadData();
  }
  
  bindEvents() {
    // 文件选择
    document.getElementById('illuminationFile').addEventListener('change', (e) => this.handleFileSelect(e, 'illuminationStatus'));
    document.getElementById('currentFile').addEventListener('change', (e) => this.handleFileSelect(e, 'currentStatus'));
    document.getElementById('complaintsFile').addEventListener('change', (e) => this.handleFileSelect(e, 'complaintsStatus'));
    document.getElementById('workOrdersFile').addEventListener('change', (e) => this.handleFileSelect(e, 'workOrdersStatus'));
    
    // 导入按钮
    document.getElementById('importBtn').addEventListener('click', () => this.importData());
    
    // 筛选器
    document.getElementById('roadFilter').addEventListener('change', (e) => {
      this.filters.road = e.target.value;
      this.renderRisks();
    });
    
    document.getElementById('priorityFilter').addEventListener('change', (e) => {
      this.filters.priority = e.target.value;
      this.renderRisks();
    });
    
    document.getElementById('statusFilter').addEventListener('change', (e) => {
      this.filters.status = e.target.value;
      this.renderRisks();
    });
    
    // 排序按钮
    document.getElementById('sortByPriority').addEventListener('click', () => {
      this.sortMode = 'priority';
      this.renderRisks();
    });
    
    document.getElementById('sortByRoad').addEventListener('click', () => {
      this.sortMode = 'road';
      this.renderRisks();
    });
    
    // 模态框
    document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
    document.getElementById('modalOverlay').addEventListener('click', () => this.closeModal());
    
    // 保存备注
    document.getElementById('saveRemarks').addEventListener('click', () => this.saveRemarks());
    
    // 导出按钮
    document.getElementById('exportMarkdown').addEventListener('click', () => this.exportMarkdown());
    document.getElementById('exportJson').addEventListener('click', () => this.exportJson());
    
    // ESC关闭模态框
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    });
  }
  
  handleFileSelect(e, statusId) {
    const file = e.target.files[0];
    const statusElement = document.getElementById(statusId);
    
    if (file) {
      statusElement.textContent = file.name;
      statusElement.classList.add('selected');
    } else {
      statusElement.textContent = '未选择';
      statusElement.classList.remove('selected');
    }
  }
  
  async importData() {
    const illuminationFile = document.getElementById('illuminationFile').files[0];
    const currentFile = document.getElementById('currentFile').files[0];
    const complaintsFile = document.getElementById('complaintsFile').files[0];
    const workOrdersFile = document.getElementById('workOrdersFile').files[0];
    
    if (!illuminationFile && !currentFile && !complaintsFile && !workOrdersFile) {
      this.showToast('请至少选择一个文件', 'error');
      return;
    }
    
    const formData = new FormData();
    
    if (illuminationFile) formData.append('illumination', illuminationFile);
    if (currentFile) formData.append('currentLog', currentFile);
    if (complaintsFile) formData.append('complaints', complaintsFile);
    if (workOrdersFile) formData.append('workOrders', workOrdersFile);
    
    // 显示进度
    const progressContainer = document.getElementById('importProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const importBtn = document.getElementById('importBtn');
    
    progressContainer.classList.remove('hidden');
    importBtn.disabled = true;
    
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 5;
      if (progress > 90) progress = 90;
      progressFill.style.width = progress + '%';
    }, 200);
    
    try {
      progressText.textContent = '正在上传数据...';
      
      const response = await fetch(`${this.apiBase}/import`, {
        method: 'POST',
        body: formData
      });
      
      clearInterval(progressInterval);
      progressFill.style.width = '100%';
      
      if (response.ok) {
        const result = await response.json();
        progressText.textContent = '分析完成！';
        
        let importedCount = 0;
        if (result.results.illumination) importedCount += result.results.illumination.count;
        if (result.results.currentLog) importedCount += result.results.currentLog.count;
        if (result.results.complaints) importedCount += result.results.complaints.count;
        if (result.results.workOrders) importedCount += result.results.workOrders.count;
        
        this.showToast(`成功导入 ${importedCount} 条数据`, 'success');
        
        // 重置文件选择
        this.resetFileInputs();
        
        // 重新加载数据
        await this.loadData();
        
        setTimeout(() => {
          progressContainer.classList.add('hidden');
          progressFill.style.width = '0%';
          importBtn.disabled = false;
        }, 1000);
      } else {
        const error = await response.json();
        throw new Error(error.error || '导入失败');
      }
    } catch (error) {
      clearInterval(progressInterval);
      progressContainer.classList.add('hidden');
      progressFill.style.width = '0%';
      importBtn.disabled = false;
      
      this.showToast(error.message, 'error');
      console.error('Import error:', error);
    }
  }
  
  resetFileInputs() {
    const inputs = ['illuminationFile', 'currentFile', 'complaintsFile', 'workOrdersFile'];
    const statuses = ['illuminationStatus', 'currentStatus', 'complaintsStatus', 'workOrdersStatus'];
    
    inputs.forEach((id, index) => {
      document.getElementById(id).value = '';
      document.getElementById(statuses[index]).textContent = '未选择';
      document.getElementById(statuses[index]).classList.remove('selected');
    });
  }
  
  async loadData() {
    try {
      // 并行加载所有数据
      const [risksResponse, roadsResponse, statsResponse] = await Promise.all([
        fetch(`${this.apiBase}/risks`),
        fetch(`${this.apiBase}/roads`),
        fetch(`${this.apiBase}/stats`)
      ]);
      
      if (risksResponse.ok) {
        const risksData = await risksResponse.json();
        this.allRisks = risksData.data || [];
        this.renderRisks();
      }
      
      if (roadsResponse.ok) {
        const roadsData = await roadsResponse.json();
        this.updateRoadFilter(roadsData.data || []);
      }
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        this.updateStats(statsData.data || {});
      }
    } catch (error) {
      console.error('Load data error:', error);
    }
  }
  
  updateRoadFilter(roads) {
    const select = document.getElementById('roadFilter');
    const currentValue = select.value;
    
    // 保留"全部道路"选项
    select.innerHTML = '<option value="">全部道路</option>';
    
    roads.forEach(road => {
      const option = document.createElement('option');
      option.value = road;
      option.textContent = road;
      if (road === currentValue) option.selected = true;
      select.appendChild(option);
    });
  }
  
  updateStats(stats) {
    document.getElementById('statHighPriority').textContent = stats.priorityStats?.高 || 0;
    document.getElementById('statMediumPriority').textContent = stats.priorityStats?.中 || 0;
    document.getElementById('statLowPriority').textContent = stats.priorityStats?.低 || 0;
    document.getElementById('statDimming').textContent = stats.typeStats?.['灯具衰减'] || 0;
    document.getElementById('statFault').textContent = stats.typeStats?.['线路故障'] || 0;
    document.getElementById('statFalse').textContent = stats.typeStats?.['误报'] || 0;
    document.getElementById('statTotalRisks').textContent = stats.totalRisks || 0;
  }
  
  getFilteredRisks() {
    return this.allRisks.filter(risk => {
      if (this.filters.road && risk.road !== this.filters.road) return false;
      if (this.filters.priority && risk.priority !== this.filters.priority) return false;
      if (this.filters.status && risk.status !== this.filters.status) return false;
      return true;
    });
  }
  
  renderRisks() {
    const container = document.getElementById('riskList');
    const emptyState = document.getElementById('emptyState');
    
    const filteredRisks = this.getFilteredRisks();
    
    if (filteredRisks.length === 0) {
      container.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }
    
    container.classList.remove('hidden');
    emptyState.classList.add('hidden');
    
    if (this.sortMode === 'road') {
      this.renderRisksByRoad(container, filteredRisks);
    } else {
      this.renderRisksByPriority(container, filteredRisks);
    }
  }
  
  renderRisksByPriority(container, risks) {
    const priorityOrder = { '高': 0, '中': 1, '低': 2 };
    const sortedRisks = [...risks].sort((a, b) => {
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.score - a.score;
    });
    
    container.innerHTML = sortedRisks.map(risk => this.createRiskCard(risk)).join('');
    
    // 绑定点击事件
    container.querySelectorAll('.risk-item').forEach(card => {
      card.addEventListener('click', () => {
        const riskId = card.dataset.riskId;
        const risk = this.allRisks.find(r => r.id === riskId);
        if (risk) this.openRiskDetail(risk);
      });
    });
  }
  
  renderRisksByRoad(container, risks) {
    const roadGroups = new Map();
    
    risks.forEach(risk => {
      const road = risk.road || '未知道路';
      if (!roadGroups.has(road)) {
        roadGroups.set(road, []);
      }
      roadGroups.get(road).push(risk);
    });
    
    let html = '';
    
    const sortedRoads = Array.from(roadGroups.keys()).sort();
    
    sortedRoads.forEach(road => {
      const roadRisks = roadGroups.get(road);
      const highCount = roadRisks.filter(r => r.priority === '高').length;
      const mediumCount = roadRisks.filter(r => r.priority === '中').length;
      const lowCount = roadRisks.filter(r => r.priority === '低').length;
      
      html += `
        <div class="road-group">
          <div class="road-group-header">
            <span class="road-group-title">${road}</span>
            <span class="road-group-stats">高${highCount} | 中${mediumCount} | 低${lowCount}</span>
          </div>
          <div class="road-group-content">
            ${roadRisks.map(risk => this.createRiskCard(risk)).join('')}
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
    
    // 绑定点击事件
    container.querySelectorAll('.risk-item').forEach(card => {
      card.addEventListener('click', () => {
        const riskId = card.dataset.riskId;
        const risk = this.allRisks.find(r => r.id === riskId);
        if (risk) this.openRiskDetail(risk);
      });
    });
  }
  
  createRiskCard(risk) {
    const priorityClass = `priority-${risk.priority === '高' ? 'high' : risk.priority === '中' ? 'medium' : 'low'}`;
    const typeClass = `type-${risk.riskType === '灯具衰减' ? 'dimming' : risk.riskType === '线路故障' ? 'fault' : 'false'}`;
    
    const statusDotClass = this.getStatusDotClass(risk.status);
    
    return `
      <div class="risk-item ${priorityClass}" data-risk-id="${risk.id}">
        <div class="risk-header">
          <div>
            <span class="risk-road">${risk.road || '未知道路'}</span>
            <span class="risk-pole">灯杆 ${risk.poleId || '未知'}</span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span class="risk-badge ${typeClass}">${risk.riskType}</span>
            <span class="risk-badge ${priorityClass}">${risk.priority}优先级</span>
          </div>
        </div>
        <div class="risk-body">
          <p class="risk-reason">${risk.reason}</p>
        </div>
        <div class="risk-footer">
          <span class="risk-status">
            <span class="status-dot ${statusDotClass}"></span>
            ${risk.status || '待复核'}
          </span>
          <span>得分: ${risk.score}分</span>
        </div>
      </div>
    `;
  }
  
  getStatusDotClass(status) {
    switch (status) {
      case '已确认': return 'confirmed';
      case '已派工': return 'assigned';
      case '已完成': return 'completed';
      default: return 'pending';
    }
  }
  
  openRiskDetail(risk) {
    this.currentRisk = risk;
    
    const modal = document.getElementById('riskModal');
    const modalBody = document.getElementById('modalBody');
    
    // 填充模态框内容
    modalBody.innerHTML = this.createRiskDetailContent(risk);
    
    // 填充备注和状态
    document.getElementById('remarksText').value = risk.remarks || '';
    document.getElementById('statusSelect').value = risk.status || '待复核';
    
    modal.classList.remove('hidden');
  }
  
  createRiskDetailContent(risk) {
    const suggestionsHtml = risk.suggestions && risk.suggestions.length > 0
      ? `<ul class="suggestions-list">${risk.suggestions.map(s => `<li>${s}</li>`).join('')}</ul>`
      : '<p class="text-muted">暂无建议</p>';
    
    let historyHtml = '';
    if (risk.history && risk.history.length > 0) {
      historyHtml = `
        <div class="detail-section">
          <h4 class="detail-title">相似历史记录</h4>
          <ul class="history-list">
            ${risk.history.map(h => `
              <li>
                <span class="history-item-title">${h.issueType || '未标注类型'}</span>
                <span class="history-item-date">${h.date || ''}</span>
                ${h.solution ? `<p style="margin-top: 4px;">处置: ${h.solution}</p>` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }
    
    const sourcesHtml = risk.sources && risk.sources.length > 0
      ? risk.sources.map(s => {
          const sourceNames = {
            'illumination': '照度传感器',
            'current': '电流传感器',
            'complaint': '居民报修',
            'analysis': '综合分析'
          };
          return sourceNames[s] || s;
        }).join(', ')
      : '未知';
    
    return `
      <div class="detail-section">
        <h4 class="detail-title">基本信息</h4>
        <div class="detail-row">
          <span class="detail-label">道路</span>
          <span class="detail-value">${risk.road || '未知'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">灯杆号</span>
          <span class="detail-value">${risk.poleId || '未知'}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">风险类型</span>
          <span class="detail-value">${risk.riskType}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">优先级</span>
          <span class="detail-value">${risk.priority} (${risk.score}分)</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">数据来源</span>
          <span class="detail-value">${sourcesHtml}</span>
        </div>
      </div>
      
      <div class="detail-section">
        <h4 class="detail-title">风险原因</h4>
        <p style="line-height: 1.8; color: var(--text-primary);">${risk.reason}</p>
      </div>
      
      <div class="detail-section">
        <h4 class="detail-title">处置建议</h4>
        ${suggestionsHtml}
      </div>
      
      ${historyHtml}
      
      ${risk.details ? `
        <div class="detail-section">
          <h4 class="detail-title">详细数据</h4>
          <pre style="background: var(--bg-tertiary); padding: 12px; border-radius: var(--radius-md); overflow-x: auto; font-size: 0.75rem;">
${JSON.stringify(risk.details, null, 2)}</pre>
        </div>
      ` : ''}
    `;
  }
  
  closeModal() {
    const modal = document.getElementById('riskModal');
    modal.classList.add('hidden');
    this.currentRisk = null;
  }
  
  async saveRemarks() {
    if (!this.currentRisk) return;
    
    const remarks = document.getElementById('remarksText').value;
    const status = document.getElementById('statusSelect').value;
    
    try {
      const response = await fetch(`${this.apiBase}/remarks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          riskId: this.currentRisk.id,
          remarks,
          status
        })
      });
      
      if (response.ok) {
        this.showToast('保存成功', 'success');
        
        // 更新本地数据
        const index = this.allRisks.findIndex(r => r.id === this.currentRisk.id);
        if (index !== -1) {
          this.allRisks[index].remarks = remarks;
          this.allRisks[index].status = status;
        }
        
        this.renderRisks();
        this.loadData(); // 重新加载统计数据
        this.closeModal();
      } else {
        throw new Error('保存失败');
      }
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  }
  
  exportMarkdown() {
    window.open(`${this.apiBase}/export/markdown`, '_blank');
  }
  
  exportJson() {
    window.open(`${this.apiBase}/export/json`, '_blank');
  }
  
  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    toast.className = 'toast';
    if (type === 'success') toast.classList.add('success');
    if (type === 'error') toast.classList.add('error');
    
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3000);
  }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
  new StreetlightApp();
});
