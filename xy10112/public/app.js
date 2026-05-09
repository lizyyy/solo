class MemberRecordApp {
  constructor() {
    this.selectedRecords = new Set();
    this.currentRecords = [];
    this.init();
  }

  init() {
    this.bindElements();
    this.bindEvents();
    this.loadStats();
    this.loadRecords();
    this.loadHistory();
  }

  bindElements() {
    this.fileInput = document.getElementById('file-input');
    this.uploadArea = document.getElementById('upload-area');
    this.selectFileBtn = document.getElementById('select-file-btn');
    this.downloadSampleBtn = document.getElementById('download-sample-btn');
    this.statusFilter = document.getElementById('status-filter');
    this.selectAll = document.getElementById('select-all');
    this.recordsTbody = document.getElementById('records-tbody');
    this.batchApproveBtn = document.getElementById('batch-approve-btn');
    this.batchRejectBtn = document.getElementById('batch-reject-btn');
    this.historyList = document.getElementById('history-list');
    this.exportBtn = document.getElementById('export-btn');
    this.exportFormat = document.getElementById('export-format');
    this.exportCheckboxes = document.querySelectorAll('.export-checkbox');
    this.modal = document.getElementById('modal');
    this.modalTitle = document.getElementById('modal-title');
    this.modalBody = document.getElementById('modal-body');
    this.modalFooter = document.getElementById('modal-footer');
    this.modalClose = document.getElementById('modal-close');
    this.modalCancel = document.getElementById('modal-cancel');
    this.modalConfirm = document.getElementById('modal-confirm');
    this.toast = document.getElementById('toast');
    this.statPending = document.getElementById('stat-pending');
    this.statApproved = document.getElementById('stat-approved');
    this.statRejected = document.getElementById('stat-rejected');
    this.statAmount = document.getElementById('stat-amount');
  }

  bindEvents() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    this.uploadArea.addEventListener('click', () => this.fileInput.click());
    this.selectFileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.fileInput.click();
    });
    this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
    this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
    this.downloadSampleBtn.addEventListener('click', () => this.downloadSample());
    this.statusFilter.addEventListener('change', () => this.loadRecords());
    this.selectAll.addEventListener('change', (e) => this.handleSelectAll(e));
    this.batchApproveBtn.addEventListener('click', () => this.handleBatchAction('approved'));
    this.batchRejectBtn.addEventListener('click', () => this.handleBatchAction('rejected'));
    this.exportBtn.addEventListener('click', () => this.handleExport());
    this.modalClose.addEventListener('click', () => this.closeModal());
    this.modalCancel.addEventListener('click', () => this.closeModal());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.closeModal();
    });
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
    if (tabName === 'history') {
      this.loadHistory();
    }
  }

  async loadStats() {
    try {
      const response = await fetch('/api/stats');
      const result = await response.json();
      if (result.success) {
        this.statPending.textContent = result.data.pending;
        this.statApproved.textContent = result.data.approved;
        this.statRejected.textContent = result.data.rejected;
        this.statAmount.textContent = `¥${result.data.totalAmount.toFixed(2)}`;
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }

  async loadRecords() {
    const status = this.statusFilter.value;
    const url = status ? `/api/records?status=${status}` : '/api/records';
    
    try {
      const response = await fetch(url);
      const result = await response.json();
      if (result.success) {
        this.currentRecords = result.data;
        this.renderRecords(result.data);
      }
    } catch (error) {
      console.error('加载记录失败:', error);
      this.showToast('加载记录失败', 'error');
    }
  }

  renderRecords(records) {
    if (records.length === 0) {
      this.recordsTbody.innerHTML = `
        <tr>
          <td colspan="9" class="empty-state">暂无数据，请先导入文件</td>
        </tr>
      `;
      return;
    }

    this.recordsTbody.innerHTML = records.map(record => `
      <tr>
        <td>
          <input type="checkbox" value="${record.id}" class="record-checkbox" 
            ${this.selectedRecords.has(record.id) ? 'checked' : ''}>
        </td>
        <td>${record.phone}</td>
        <td>${record.name}${record.memberName ? `<br><small style="color:#666">(${record.memberName})</small>` : ''}</td>
        <td>¥${parseFloat(record.amount).toFixed(2)}</td>
        <td>${record.date}</td>
        <td>${record.note || '-'}</td>
        <td>
          <span class="status-badge status-${record.status}">
            ${this.getStatusText(record.status)}
          </span>
        </td>
        <td>${record.importedFrom}</td>
        <td>
          <div class="action-buttons">
            ${record.status === 'pending' ? `
              <button class="btn btn-sm btn-success" onclick="app.approveRecord('${record.id}')">通过</button>
              <button class="btn btn-sm btn-danger" onclick="app.rejectRecord('${record.id}')">拒绝</button>
            ` : '-'}
          </div>
        </td>
      </tr>
    `).join('');

    const checkboxes = this.recordsTbody.querySelectorAll('.record-checkbox');
    checkboxes.forEach(cb => {
      cb.addEventListener('change', (e) => this.handleCheckboxChange(e));
    });

    this.updateSelectAllState();
  }

  getStatusText(status) {
    const map = {
      'pending': '待审核',
      'approved': '已通过',
      'rejected': '已拒绝'
    };
    return map[status] || status;
  }

  handleCheckboxChange(e) {
    const id = e.target.value;
    if (e.target.checked) {
      this.selectedRecords.add(id);
    } else {
      this.selectedRecords.delete(id);
    }
    this.updateSelectAllState();
  }

  updateSelectAllState() {
    const checkboxes = this.recordsTbody.querySelectorAll('.record-checkbox');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    this.selectAll.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
    this.selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
  }

  handleSelectAll(e) {
    const checkboxes = this.recordsTbody.querySelectorAll('.record-checkbox');
    const isChecked = e.target.checked;
    
    checkboxes.forEach(cb => {
      cb.checked = isChecked;
      if (isChecked) {
        this.selectedRecords.add(cb.value);
      } else {
        this.selectedRecords.delete(cb.value);
      }
    });
  }

  async approveRecord(id) {
    await this.updateRecordStatus(id, 'approved');
  }

  async rejectRecord(id) {
    await this.updateRecordStatus(id, 'rejected');
  }

  async updateRecordStatus(id, status) {
    try {
      const response = await fetch(`/api/records/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const result = await response.json();
      
      if (result.success) {
        this.showToast(result.message, 'success');
        this.loadStats();
        this.loadRecords();
      } else {
        this.showToast(result.message, 'error');
      }
    } catch (error) {
      console.error('更新状态失败:', error);
      this.showToast('操作失败，请重试', 'error');
    }
  }

  async handleBatchAction(status) {
    if (this.selectedRecords.size === 0) {
      this.showToast('请先选择要操作的记录', 'warning');
      return;
    }

    const pendingRecords = Array.from(this.selectedRecords).filter(id => {
      const record = this.currentRecords.find(r => r.id === id);
      return record && record.status === 'pending';
    });

    if (pendingRecords.length === 0) {
      this.showToast('选中的记录都已处理过了', 'warning');
      return;
    }

    const confirmText = status === 'approved' ? '通过' : '拒绝';
    this.showConfirmModal(
      `批量${confirmText}`,
      `<p>确定要${confirmText}选中的 <strong>${pendingRecords.length}</strong> 条记录吗？</p>`,
      async () => {
        try {
          const response = await fetch('/api/records/batch/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: pendingRecords, status })
          });
          const result = await response.json();
          
          if (result.success) {
            this.showToast(result.message, 'success');
            this.selectedRecords.clear();
            this.loadStats();
            this.loadRecords();
          } else {
            this.showToast(result.message, 'error');
          }
        } catch (error) {
          console.error('批量操作失败:', error);
          this.showToast('操作失败，请重试', 'error');
        }
      }
    );
  }

  async loadHistory() {
    try {
      const response = await fetch('/api/history');
      const result = await response.json();
      if (result.success) {
        this.renderHistory(result.data);
      }
    } catch (error) {
      console.error('加载历史记录失败:', error);
    }
  }

  renderHistory(history) {
    if (history.length === 0) {
      this.historyList.innerHTML = '<div class="empty-state">暂无历史记录</div>';
      return;
    }

    this.historyList.innerHTML = history.map(item => `
      <div class="history-item">
        <div class="history-header">
          <span class="history-file">📁 ${item.fileName}</span>
          <span class="history-time">${this.formatDate(item.importedAt)}</span>
        </div>
        <div class="history-stats">
          <div class="history-stat">
            <span class="history-stat-label">总记录数</span>
            <span class="history-stat-value">${item.totalCount}</span>
          </div>
          <div class="history-stat">
            <span class="history-stat-label">成功导入</span>
            <span class="history-stat-value" style="color: #28a745">${item.successCount}</span>
          </div>
          <div class="history-stat">
            <span class="history-stat-label">格式错误</span>
            <span class="history-stat-value" style="color: #dc3545">${item.errorCount}</span>
          </div>
          <div class="history-stat">
            <span class="history-stat-label">重复跳过</span>
            <span class="history-stat-value" style="color: #ffc107">${item.duplicateCount}</span>
          </div>
        </div>
      </div>
    `).join('');
  }

  formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  handleDragOver(e) {
    e.preventDefault();
    this.uploadArea.classList.add('dragover');
  }

  handleDragLeave(e) {
    e.preventDefault();
    this.uploadArea.classList.remove('dragover');
  }

  handleDrop(e) {
    e.preventDefault();
    this.uploadArea.classList.remove('dragover');
    
    if (e.dataTransfer.files.length > 0) {
      this.uploadFile(e.dataTransfer.files[0]);
    }
  }

  handleFileSelect(e) {
    if (e.target.files.length > 0) {
      this.uploadFile(e.target.files[0]);
    }
  }

  async uploadFile(file) {
    const allowedTypes = ['.csv', '.xlsx', '.xls'];
    const fileName = file.name.toLowerCase();
    const isValid = allowedTypes.some(ext => fileName.endsWith(ext));
    
    if (!isValid) {
      this.showToast('请上传 CSV 或 Excel 文件', 'error');
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      this.showToast('文件大小超过限制（最大10MB）', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    this.showToast('正在上传文件...', 'info');

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();

      if (result.success) {
        const data = result.data;
        let content = `<p>${result.message}</p>`;
        
        if (data.errors && data.errors.length > 0) {
          content += `<div class="error-list"><h4>❌ 格式错误（${data.errors.length} 条）：</h4>`;
          data.errors.slice(0, 10).forEach(err => {
            content += `
              <div class="error-item">
                <div class="error-row">第 ${err.row} 行</div>
                <div class="error-message">${err.message}</div>
              </div>
            `;
          });
          if (data.errors.length > 10) {
            content += `<p style="color:#721c24;margin-top:0.5rem">...还有 ${data.errors.length - 10} 条错误未显示</p>`;
          }
          content += '</div>';
        }
        
        if (data.duplicates && data.duplicates.length > 0) {
          content += `<div class="error-list"><h4>⚠️ 重复记录（${data.duplicates.length} 条已跳过）：</h4>`;
          data.duplicates.slice(0, 5).forEach(dup => {
            content += `
              <div class="duplicate-item">
                <div class="duplicate-row">第 ${dup.row} 行 - ${dup.record.name} (${dup.record.phone})</div>
                <div class="error-message">¥${dup.record.amount} - ${dup.record.date}</div>
              </div>
            `;
          });
          if (data.duplicates.length > 5) {
            content += `<p style="color:#856404;margin-top:0.5rem">...还有 ${data.duplicates.length - 5} 条重复记录未显示</p>`;
          }
          content += '</div>';
        }

        this.showModal('导入结果', content, () => {
          this.loadStats();
          this.loadRecords();
          this.loadHistory();
          this.switchTab('review');
        });
      } else {
        this.showModal('导入失败', `<p style="color:#dc3545">${result.message}</p>`);
      }
    } catch (error) {
      console.error('上传失败:', error);
      this.showToast('上传失败，请重试', 'error');
    } finally {
      this.fileInput.value = '';
    }
  }

  async handleExport() {
    const selectedStatuses = Array.from(this.exportCheckboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value);

    if (selectedStatuses.length === 0) {
      this.showToast('请至少选择一种状态', 'warning');
      return;
    }

    const format = this.exportFormat.value;
    const url = `/api/export?statuses=${selectedStatuses.join(',')}&format=${format}`;

    try {
      this.showToast('正在生成导出文件...', 'info');
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const error = await response.json();
        this.showToast(error.message, 'error');
        return;
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const ext = format === 'csv' ? 'csv' : 'xlsx';
      a.download = `会员消费记录_${timestamp}.${ext}`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      
      this.showToast('导出成功', 'success');
    } catch (error) {
      console.error('导出失败:', error);
      this.showToast('导出失败，请重试', 'error');
    }
  }

  downloadSample() {
    const csvContent = '手机号,姓名,金额,日期,备注\n13800138001,张三,199.00,2024-01-15,购买商品A\n13800138002,李四,58.50,2024-01-15,充值\n13800138003,王五,320.00,2024-01-16,购买商品B和C';
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '会员消费记录示例.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  showModal(title, content, onConfirm) {
    this.modalTitle.textContent = title;
    this.modalBody.innerHTML = content;
    
    if (onConfirm) {
      this.modalFooter.style.display = 'flex';
      this.modalConfirm.onclick = () => {
        onConfirm();
        this.closeModal();
      };
    } else {
      this.modalFooter.style.display = 'none';
    }
    
    this.modal.classList.add('active');
  }

  showConfirmModal(title, content, onConfirm) {
    this.modalTitle.textContent = title;
    this.modalBody.innerHTML = content;
    this.modalFooter.style.display = 'flex';
    
    this.modalConfirm.onclick = () => {
      onConfirm();
      this.closeModal();
    };
    
    this.modal.classList.add('active');
  }

  closeModal() {
    this.modal.classList.remove('active');
  }

  showToast(message, type = 'info') {
    this.toast.textContent = message;
    this.toast.className = `toast ${type} show`;
    
    setTimeout(() => {
      this.toast.classList.remove('show');
    }, 3000);
  }
}

const app = new MemberRecordApp();
