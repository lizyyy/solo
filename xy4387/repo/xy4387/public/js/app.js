class NightShiftManagerApp {
  constructor() {
    this.apiBase = '/api';
    this.currentIssue = null;
    this.selectedFiles = [];
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadDashboard();
    this.refreshSystemStatus();
  }

  bindEvents() {
    // 导航切换
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.switchTab(tab);
      });
    });

    // 刷新按钮
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.refreshAll();
    });

    // 快速操作
    document.getElementById('quick-detect').addEventListener('click', () => {
      this.detectIssues();
    });
    document.getElementById('quick-export-report').addEventListener('click', () => {
      this.exportReport();
    });
    document.getElementById('quick-export-audit').addEventListener('click', () => {
      this.exportAudit();
    });

    // 文件上传
    const uploadArea = document.getElementById('file-upload-area');
    const fileInput = document.getElementById('file-input');
    const selectFileBtn = document.getElementById('select-file-btn');

    selectFileBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      this.handleFileSelect(e.target.files);
    });

    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('drag-over');
      this.handleFileSelect(e.dataTransfer.files);
    });

    // 上传确认
    document.getElementById('upload-confirm-btn').addEventListener('click', () => {
      this.uploadFiles();
    });

    // 文件夹导入
    document.getElementById('import-directory-btn').addEventListener('click', () => {
      this.importDirectory();
    });

    // 问题检测
    document.getElementById('detect-issues-btn').addEventListener('click', () => {
      this.detectIssues();
    });

    // 问题筛选
    document.getElementById('issue-status-filter').addEventListener('change', () => {
      this.loadIssues();
    });
    document.getElementById('issue-severity-filter').addEventListener('change', () => {
      this.loadIssues();
    });
    document.getElementById('issue-type-filter').addEventListener('change', () => {
      this.loadIssues();
    });

    // 模态框
    document.getElementById('modal-close').addEventListener('click', () => {
      this.closeModal();
    });
    document.getElementById('modal-overlay').addEventListener('click', () => {
      this.closeModal();
    });
    document.getElementById('modal-cancel-btn').addEventListener('click', () => {
      this.closeModal();
    });
    document.getElementById('modal-dismiss-btn').addEventListener('click', () => {
      this.updateIssueStatus('dismiss');
    });
    document.getElementById('modal-resolve-btn').addEventListener('click', () => {
      this.updateIssueStatus('resolve');
    });

    // 导出按钮
    document.getElementById('export-report-btn').addEventListener('click', () => {
      this.exportReport();
    });
    document.getElementById('export-audit-btn').addEventListener('click', () => {
      this.exportAudit();
    });
  }

  async request(url, options = {}) {
    try {
      const response = await fetch(this.apiBase + url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });
      return response.json();
    } catch (error) {
      console.error('API请求错误:', error);
      throw error;
    }
  }

  showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const messageEl = document.getElementById('notification-message');
    
    messageEl.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.remove('hidden');
    notification.classList.add('show');
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        notification.classList.add('hidden');
      }, 300);
    }, 3000);
  }

  switchTab(tabName) {
    // 更新导航状态
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabName);
    });

    // 更新内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}-tab`);
    });

    // 加载对应数据
    switch (tabName) {
      case 'dashboard':
        this.loadDashboard();
        break;
      case 'issues':
        this.loadIssues();
        break;
      case 'tasks':
        this.loadTasks();
        break;
      case 'machines':
        this.loadMachines();
        break;
    }
  }

  async refreshSystemStatus() {
    try {
      const response = await this.request('/status');
      if (response.success) {
        const statusEl = document.getElementById('system-status');
        statusEl.textContent = '已连接';
        statusEl.style.background = 'rgba(16, 185, 129, 0.2)';
      }
    } catch (error) {
      const statusEl = document.getElementById('system-status');
      statusEl.textContent = '连接失败';
      statusEl.style.background = 'rgba(239, 68, 68, 0.2)';
    }
  }

  async refreshAll() {
    await this.loadDashboard();
    await this.refreshSystemStatus();
    this.showNotification('数据已刷新');
  }

  async loadDashboard() {
    try {
      const response = await this.request('/data/all');
      if (response.success) {
        const data = response.data;
        
        // 更新统计
        document.getElementById('stat-tasks').textContent = data.tasks.length;
        document.getElementById('stat-machines').textContent = data.machines.length;
        
        // 计算未解决问题和严重问题
        const openIssues = data.issues.filter(i => i.status === 'open');
        const criticalIssues = openIssues.filter(i => i.severity === 'critical');
        
        document.getElementById('stat-issues').textContent = openIssues.length;
        document.getElementById('stat-critical').textContent = criticalIssues.length;
        
        // 更新导航徽章
        const issuesBadge = document.getElementById('issues-badge');
        if (openIssues.length > 0) {
          issuesBadge.textContent = openIssues.length;
          issuesBadge.classList.remove('hidden');
        } else {
          issuesBadge.classList.add('hidden');
        }
        
        // 显示最近问题
        this.renderRecentIssues(openIssues.slice(0, 5));
      }
    } catch (error) {
      console.error('加载仪表板失败:', error);
    }
  }

  renderRecentIssues(issues) {
    const container = document.getElementById('recent-issues-list');
    
    if (issues.length === 0) {
      container.innerHTML = '<p class="empty-message">暂无问题数据</p>';
      return;
    }
    
    container.innerHTML = issues.map(issue => this.createIssueCard(issue, true)).join('');
    
    // 绑定详情点击事件
    container.querySelectorAll('.issue-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.issue-actions')) {
          const issueId = card.dataset.issueId;
          this.openIssueDetail(issueId);
        }
      });
    });
  }

  async loadIssues() {
    try {
      const statusFilter = document.getElementById('issue-status-filter').value;
      const severityFilter = document.getElementById('issue-severity-filter').value;
      const typeFilter = document.getElementById('issue-type-filter').value;
      
      let url = '/issues';
      const params = [];
      if (statusFilter) params.push(`status=${encodeURIComponent(statusFilter)}`);
      if (severityFilter) params.push(`severity=${encodeURIComponent(severityFilter)}`);
      if (typeFilter) params.push(`type=${encodeURIComponent(typeFilter)}`);
      
      if (params.length > 0) {
        url += '?' + params.join('&');
      }
      
      const response = await this.request(url);
      if (response.success) {
        this.renderIssues(response.data.issues);
      }
    } catch (error) {
      console.error('加载问题列表失败:', error);
    }
  }

  renderIssues(issues) {
    const container = document.getElementById('issues-list');
    
    if (issues.length === 0) {
      container.innerHTML = '<p class="empty-message">暂无问题数据</p>';
      return;
    }
    
    container.innerHTML = issues.map(issue => this.createIssueCard(issue)).join('');
    
    // 绑定事件
    container.querySelectorAll('.issue-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.issue-actions')) {
          const issueId = card.dataset.issueId;
          this.openIssueDetail(issueId);
        }
      });
    });
    
    // 绑定操作按钮
    container.querySelectorAll('.btn-resolve').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const issueId = btn.dataset.issueId;
        this.quickResolveIssue(issueId);
      });
    });
    
    container.querySelectorAll('.btn-dismiss').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const issueId = btn.dataset.issueId;
        this.quickDismissIssue(issueId);
      });
    });
  }

  createIssueCard(issue, isRecent = false) {
    const typeLabels = {
      temperature_incompatible: '温度不兼容',
      time_overdue: '超时',
      maintenance_overdue: '维护过期',
      nozzle_maintenance_overdue: '喷嘴维护过期',
      queue_conflict: '排队冲突',
      material_low: '耗材不足'
    };
    
    return `
      <div class="issue-card ${issue.severity} ${issue.status}" data-issue-id="${issue.id}">
        <div class="issue-header">
          <div class="issue-title">${issue.description}</div>
          <span class="issue-severity ${issue.severity}">${this.getSeverityLabel(issue.severity)}</span>
        </div>
        <div class="issue-meta">
          <span>类型: ${typeLabels[issue.type] || issue.type}</span>
          <span>状态: ${this.getStatusLabel(issue.status)}</span>
          <span>创建时间: ${new Date(issue.createdAt).toLocaleString('zh-CN')}</span>
        </div>
        ${!isRecent ? `
        <div class="issue-actions">
          <button class="btn btn-success btn-resolve" data-issue-id="${issue.id}">✓ 解决</button>
          <button class="btn btn-warning btn-dismiss" data-issue-id="${issue.id}">✗ 忽略</button>
        </div>
        ` : ''}
      </div>
    `;
  }

  getSeverityLabel(severity) {
    const labels = {
      critical: '🔴 严重',
      high: '🟠 高',
      medium: '🟡 中',
      low: '🟢 低'
    };
    return labels[severity] || severity;
  }

  getStatusLabel(status) {
    const labels = {
      open: '未解决',
      resolved: '已解决',
      dismissed: '已忽略'
    };
    return labels[status] || status;
  }

  async openIssueDetail(issueId) {
    try {
      const response = await this.request(`/issues/${issueId}`);
      if (response.success) {
        this.currentIssue = response.data;
        this.renderIssueModal(response.data);
        document.getElementById('issue-modal').classList.remove('hidden');
      }
    } catch (error) {
      this.showNotification('加载问题详情失败', 'error');
    }
  }

  renderIssueModal(issue) {
    const typeLabels = {
      temperature_incompatible: '温度不兼容',
      time_overdue: '超时',
      maintenance_overdue: '维护过期',
      nozzle_maintenance_overdue: '喷嘴维护过期',
      queue_conflict: '排队冲突',
      material_low: '耗材不足'
    };
    
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalNotes = document.getElementById('modal-notes');
    
    modalTitle.textContent = `问题详情 - ${typeLabels[issue.type] || issue.type}`;
    
    let detailsHtml = `
      <div class="detail-section">
        <h4>基本信息</h4>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">严重程度</span>
            <span class="detail-value">${this.getSeverityLabel(issue.severity)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">状态</span>
            <span class="detail-value">${this.getStatusLabel(issue.status)}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">创建时间</span>
            <span class="detail-value">${new Date(issue.createdAt).toLocaleString('zh-CN')}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">关联实体</span>
            <span class="detail-value">${issue.relatedEntityType} - ${issue.relatedEntityId}</span>
          </div>
        </div>
      </div>
      <div class="detail-section">
        <h4>问题描述</h4>
        <p>${issue.description}</p>
      </div>
    `;
    
    // 添加详细信息
    if (issue.details && Object.keys(issue.details).length > 0) {
      detailsHtml += `
        <div class="detail-section">
          <h4>详细信息</h4>
          <div class="detail-grid">
            ${Object.entries(issue.details).map(([key, value]) => {
              if (typeof value === 'object') return '';
              return `
                <div class="detail-item">
                  <span class="detail-label">${this.formatDetailKey(key)}</span>
                  <span class="detail-value">${value}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
    
    // 显示现有备注
    if (issue.notes) {
      detailsHtml += `
        <div class="detail-section">
          <h4>现有备注</h4>
          <p>${issue.notes}</p>
        </div>
      `;
      modalNotes.value = issue.notes;
    } else {
      modalNotes.value = '';
    }
    
    modalBody.innerHTML = detailsHtml;
  }

  formatDetailKey(key) {
    const keyMap = {
      userName: '用户',
      nozzleTemp: '喷嘴温度',
      bedTemp: '热床温度',
      materialName: '材料名称',
      materialType: '材料类型',
      estimatedPrintTime: '预计打印时间',
      scheduledDuration: '预约时长',
      overdueMinutes: '超时时间',
      machineId: '机器ID',
      machineName: '机器名称'
    };
    return keyMap[key] || key;
  }

  closeModal() {
    document.getElementById('issue-modal').classList.add('hidden');
    this.currentIssue = null;
  }

  async updateIssueStatus(action) {
    if (!this.currentIssue) return;
    
    try {
      const notes = document.getElementById('modal-notes').value;
      
      const response = await this.request(`/issues/${this.currentIssue.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          action: action,
          notes: notes
        })
      });
      
      if (response.success) {
        this.closeModal();
        this.showNotification(action === 'resolve' ? '问题已标记为已解决' : '问题已标记为已忽略');
        await this.loadDashboard();
        await this.loadIssues();
      } else {
        this.showNotification(response.error || '操作失败', 'error');
      }
    } catch (error) {
      this.showNotification('操作失败', 'error');
    }
  }

  async quickResolveIssue(issueId) {
    try {
      const response = await this.request(`/issues/${issueId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          action: 'resolve'
        })
      });
      
      if (response.success) {
        this.showNotification('问题已标记为已解决');
        await this.loadDashboard();
        await this.loadIssues();
      } else {
        this.showNotification(response.error || '操作失败', 'error');
      }
    } catch (error) {
      this.showNotification('操作失败', 'error');
    }
  }

  async quickDismissIssue(issueId) {
    try {
      const response = await this.request(`/issues/${issueId}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          action: 'dismiss'
        })
      });
      
      if (response.success) {
        this.showNotification('问题已标记为已忽略');
        await this.loadDashboard();
        await this.loadIssues();
      } else {
        this.showNotification(response.error || '操作失败', 'error');
      }
    } catch (error) {
      this.showNotification('操作失败', 'error');
    }
  }

  async detectIssues() {
    try {
      this.showNotification('正在检测问题...', 'warning');
      
      const response = await this.request('/detect-issues', {
        method: 'POST'
      });
      
      if (response.success) {
        this.showNotification(`检测完成，共发现 ${response.data.total} 个问题`);
        await this.loadDashboard();
        this.switchTab('issues');
      } else {
        this.showNotification(response.error || '检测失败', 'error');
      }
    } catch (error) {
      this.showNotification('检测失败', 'error');
    }
  }

  handleFileSelect(files) {
    this.selectedFiles = Array.from(files);
    
    if (this.selectedFiles.length === 0) return;
    
    const preview = document.getElementById('upload-preview');
    const fileList = document.getElementById('file-list');
    
    fileList.innerHTML = this.selectedFiles.map(file => `
      <li>📄 ${file.name} (${this.formatFileSize(file.size)})</li>
    `).join('');
    
    preview.classList.remove('hidden');
  }

  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  async uploadFiles() {
    if (this.selectedFiles.length === 0) {
      this.showNotification('请先选择文件', 'warning');
      return;
    }
    
    const dataType = document.getElementById('data-type-select').value;
    const statusEl = document.getElementById('import-status');
    const resultEl = document.getElementById('import-result');
    
    statusEl.className = 'status-message';
    statusEl.textContent = '正在上传...';
    statusEl.classList.remove('hidden');
    
    try {
      let totalImported = 0;
      
      for (const file of this.selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        if (dataType !== 'auto') {
          formData.append('dataType', dataType);
        }
        
        const response = await fetch(this.apiBase + '/import/file', {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
          totalImported++;
        } else {
          throw new Error(result.error || '上传失败');
        }
      }
      
      statusEl.className = 'status-message success';
      statusEl.textContent = `成功导入 ${totalImported} 个文件`;
      
      // 重置选择
      this.selectedFiles = [];
      document.getElementById('upload-preview').classList.add('hidden');
      document.getElementById('file-input').value = '';
      
      this.showNotification(`成功导入 ${totalImported} 个文件`);
      await this.loadDashboard();
      
    } catch (error) {
      statusEl.className = 'status-message error';
      statusEl.textContent = `导入失败: ${error.message}`;
      this.showNotification(`导入失败: ${error.message}`, 'error');
    }
  }

  async importDirectory() {
    const directoryPath = document.getElementById('directory-path').value.trim();
    
    if (!directoryPath) {
      this.showNotification('请输入文件夹路径', 'warning');
      return;
    }
    
    const statusEl = document.getElementById('import-status');
    
    statusEl.className = 'status-message';
    statusEl.textContent = '正在导入文件夹...';
    statusEl.classList.remove('hidden');
    
    try {
      const response = await this.request('/import/directory', {
        method: 'POST',
        body: JSON.stringify({
          directoryPath: directoryPath
        })
      });
      
      if (response.success) {
        statusEl.className = 'status-message success';
        statusEl.textContent = response.message;
        
        // 显示导入结果
        const resultEl = document.getElementById('import-result');
        resultEl.innerHTML = `
          <h4>导入统计：</h4>
          <ul>
            <li>材料信息: ${response.data.materials || 0} 条</li>
            <li>耗材库存: ${response.data.materialInventories || 0} 条</li>
            <li>机器信息: ${response.data.machines || 0} 条</li>
            <li>任务数据: ${response.data.tasks || 0} 条</li>
            <li>维护记录: ${response.data.maintenanceRecords || 0} 条</li>
          </ul>
        `;
        resultEl.classList.remove('hidden');
        
        this.showNotification(response.message);
        await this.loadDashboard();
      } else {
        throw new Error(response.error || '导入失败');
      }
    } catch (error) {
      statusEl.className = 'status-message error';
      statusEl.textContent = `导入失败: ${error.message}`;
      this.showNotification(`导入失败: ${error.message}`, 'error');
    }
  }

  async loadTasks() {
    try {
      const response = await this.request('/tasks');
      if (response.success) {
        this.renderTasks(response.data.tasks);
      }
    } catch (error) {
      console.error('加载任务列表失败:', error);
    }
  }

  renderTasks(tasks) {
    const container = document.getElementById('tasks-list');
    
    if (tasks.length === 0) {
      container.innerHTML = '<p class="empty-message">暂无任务数据</p>';
      return;
    }
    
    container.innerHTML = tasks.map(task => `
      <div class="task-card">
        <div class="task-header">
          <div class="task-user">👤 ${task.userName}</div>
          <span class="task-status ${task.status}">${this.getTaskStatusLabel(task.status)}</span>
        </div>
        <div class="task-details">
          <div class="task-detail-item">
            <span class="task-detail-label">机器ID</span>
            <span class="task-detail-value">${task.machineId}</span>
          </div>
          <div class="task-detail-item">
            <span class="task-detail-label">预约时间</span>
            <span class="task-detail-value">${new Date(task.scheduledStartTime).toLocaleString('zh-CN')}</span>
          </div>
          <div class="task-detail-item">
            <span class="task-detail-label">预约时长</span>
            <span class="task-detail-value">${Math.round(task.scheduledDuration)} 分钟</span>
          </div>
          <div class="task-detail-item">
            <span class="task-detail-label">优先级</span>
            <span class="task-detail-value">${this.getPriorityLabel(task.priority)}</span>
          </div>
          ${task.gcodeInfo ? `
          <div class="task-detail-item">
            <span class="task-detail-label">G-code文件</span>
            <span class="task-detail-value">${task.gcodeInfo.fileName}</span>
          </div>
          <div class="task-detail-item">
            <span class="task-detail-label">预计打印时间</span>
            <span class="task-detail-value ${task.isTimeOverdue ? 'text-warning' : ''}">
              ${task.gcodeInfo.estimatedPrintTime} 分钟
              ${task.isTimeOverdue ? ' ⚠️ 超时' : ''}
            </span>
          </div>
          <div class="task-detail-item">
            <span class="task-detail-label">喷嘴温度</span>
            <span class="task-detail-value">${task.gcodeInfo.nozzleTemp}°C</span>
          </div>
          <div class="task-detail-item">
            <span class="task-detail-label">材料类型</span>
            <span class="task-detail-value">${task.gcodeInfo.materialType}</span>
          </div>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  getTaskStatusLabel(status) {
    const labels = {
      pending: '待处理',
      printing: '打印中',
      completed: '已完成',
      cancelled: '已取消'
    };
    return labels[status] || status;
  }

  getPriorityLabel(priority) {
    const labels = {
      low: '低',
      normal: '普通',
      high: '高',
      urgent: '紧急'
    };
    return labels[priority] || priority;
  }

  async loadMachines() {
    try {
      const response = await this.request('/machines');
      if (response.success) {
        this.renderMachines(response.data.machines);
      }
    } catch (error) {
      console.error('加载机器列表失败:', error);
    }
  }

  renderMachines(machines) {
    const container = document.getElementById('machines-list');
    
    if (machines.length === 0) {
      container.innerHTML = '<p class="empty-message">暂无机器数据</p>';
      return;
    }
    
    container.innerHTML = machines.map(machine => `
      <div class="machine-card">
        <div class="machine-header">
          <div class="machine-name">🖨️ ${machine.name}</div>
          <span class="machine-status ${machine.status}">${this.getMachineStatusLabel(machine.status)}</span>
        </div>
        <div class="machine-details">
          <div class="detail-item">
            <span class="detail-label">型号</span>
            <span class="detail-value">${machine.model}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">类型</span>
            <span class="detail-value">${machine.type}</span>
          </div>
          ${machine.nozzle ? `
          <div class="detail-item">
            <span class="detail-label">喷嘴尺寸</span>
            <span class="detail-value">${machine.nozzle.size}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">喷嘴材质</span>
            <span class="detail-value">${machine.nozzle.material}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">已使用</span>
            <span class="detail-value ${machine.nozzle.isMaintenanceOverdue ? 'text-warning' : ''}">
              ${machine.nozzle.printHoursSinceChange} 小时
              ${machine.nozzle.isMaintenanceOverdue ? ' ⚠️ 需维护' : ''}
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">最大推荐</span>
            <span class="detail-value">${machine.nozzle.maxPrintHours} 小时</span>
          </div>
          ` : ''}
        </div>
      </div>
    `).join('');
  }

  getMachineStatusLabel(status) {
    const labels = {
      available: '可用',
      busy: '使用中',
      maintenance: '维护中',
      offline: '离线'
    };
    return labels[status] || status;
  }

  exportReport() {
    window.open(this.apiBase + '/export/night-shift-report', '_blank');
    this.showNotification('正在导出夜班开机单...');
  }

  exportAudit() {
    window.open(this.apiBase + '/export/audit', '_blank');
    this.showNotification('正在导出审计包...');
  }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
  window.app = new NightShiftManagerApp();
});
