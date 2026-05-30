const API_BASE = '/api';
let currentEditingId = null;
let accounts = [];

const SourceTypeLabel = {
  supplement_email: '补充邮件',
  review_daily: '复核日报',
  credit_ledger: '授信台账'
};

const RecordStatusLabel = {
  confirmed: '已确认',
  pending_supplement: '待补材料',
  manually_modified: '人工修改'
};

const OperationTypeLabel = {
  material_supplement: '补充材料',
  conclusion_change: '修改结论'
};

const StatusTagClass = {
  confirmed: 'tag-success',
  pending_supplement: 'tag-warning',
  manually_modified: 'tag-danger'
};

async function api(url, options = {}) {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  return response.json();
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });

  if (tabName === 'summary') loadSummary();
  else if (tabName === 'records') loadRecords();
  else if (tabName === 'review') loadReviewList();
}

async function loadAccounts() {
  const result = await api('/accounts');
  if (result.success) {
    accounts = result.data;
    const select = document.getElementById('form-accountId');
    select.innerHTML = '<option value="">请选择账户</option>' + 
      accounts.map(a => `<option value="${a.id}">${a.name} - ${a.customerName}</option>`).join('');
  }
}

function updateAccountName() {
  const accountId = document.getElementById('form-accountId').value;
  const account = accounts.find(a => a.id === accountId);
  if (account) {
    document.getElementById('form-accountName').value = account.name;
  }
}

async function loadSummary() {
  const container = document.getElementById('summary-content');
  container.innerHTML = '<p style="text-align:center;padding:40px;">加载中...</p>';

  const result = await api('/fund-level-summary');
  
  if (!result.success || result.data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-text">暂无数据，请先初始化示例数据或添加账户</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="summary-cards">
      ${result.data.map(item => {
        const usageRate = parseFloat(item.usageRate);
        const isWarning = usageRate > 70;
        const isDanger = usageRate > 90;
        let cardClass = '';
        if (isDanger) cardClass = 'danger';
        else if (isWarning) cardClass = 'warning';

        return `
          <div class="summary-card ${cardClass}">
            <div class="summary-card-header">
              <div>
                <div class="summary-card-title">${item.accountName}</div>
                <div class="summary-card-subtitle">${item.customerName} · ${item.branch}</div>
              </div>
              <div class="summary-tags">
                ${item.hasPending ? '<span class="tag tag-warning">待补材料</span>' : ''}
                ${item.hasModified ? '<span class="tag tag-danger">人工修改</span>' : ''}
              </div>
            </div>
            <div class="summary-card-stats">
              <div class="stat-item">
                <div class="stat-value">${item.totalCredit.toFixed(2)}</div>
                <div class="stat-label">授信总额(万元)</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">${item.totalUsed.toFixed(2)}</div>
                <div class="stat-label">已用额度(万元)</div>
              </div>
              <div class="stat-item">
                <div class="stat-value" style="color: ${item.availableAmount < 0 ? '#f56c6c' : '#67c23a'}">${item.availableAmount.toFixed(2)}</div>
                <div class="stat-label">可用额度(万元)</div>
              </div>
            </div>
            <div class="progress-container">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;">
                <span>使用率</span>
                <span style="font-weight:600;">${item.usageRate}</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill ${isWarning ? 'warning' : ''}" style="width:${Math.min(usageRate, 100)}%"></div>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function loadRecords() {
  const container = document.getElementById('records-table');
  container.innerHTML = '<p style="text-align:center;padding:40px;">加载中...</p>';

  const status = document.getElementById('filter-status').value;
  const source = document.getElementById('filter-source').value;
  const operation = document.getElementById('filter-operation').value;

  const queryParams = new URLSearchParams();
  if (status) queryParams.append('status', status);
  if (source) queryParams.append('sourceType', source);
  if (operation) queryParams.append('operationType', operation);

  const result = await api(`/credit-records?${queryParams.toString()}`);
  
  if (!result.success || result.data.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">暂无记录</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>账户名称</th>
            <th>授信额度</th>
            <th>已用额度</th>
            <th>可用额度</th>
            <th>数据来源</th>
            <th>操作类型</th>
            <th>状态</th>
            <th>处理人</th>
            <th>来源日期</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          ${result.data.map(item => `
            <tr>
              <td><strong>${item.accountName}</strong></td>
              <td class="text-right">${item.creditAmount.toFixed(2)}</td>
              <td class="text-right">${item.usedAmount.toFixed(2)}</td>
              <td class="text-right" style="color:${item.availableAmount < 0 ? '#f56c6c' : '#67c23a'};font-weight:600;">${item.availableAmount.toFixed(2)}</td>
              <td><span class="tag tag-info">${SourceTypeLabel[item.sourceType] || item.sourceType}</span></td>
              <td>${OperationTypeLabel[item.operationType] || item.operationType}</td>
              <td><span class="tag ${StatusTagClass[item.status]}">${RecordStatusLabel[item.status] || item.status}</span></td>
              <td>${item.handler || '-'}</td>
              <td>${item.sourceDate}</td>
              <td>
                <div class="actions">
                  <button onclick="editRecord('${item.id}')" class="btn btn-sm btn-primary">编辑</button>
                  <button onclick="deleteRecord('${item.id}')" class="btn btn-sm btn-danger">删除</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function loadReviewList() {
  const container = document.getElementById('review-content');
  container.innerHTML = '<p style="text-align:center;padding:40px;">加载中...</p>';

  const result = await api('/review-list');
  
  if (!result.success) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">❌</div>
        <div class="empty-state-text">加载失败</div>
      </div>
    `;
    return;
  }

  const { confirmed, pendingSupplement, manuallyModified } = result.data;

  container.innerHTML = `
    <div class="review-section">
      <h3>✅ 已确认记录 <span class="review-count">${confirmed.length}</span></h3>
      ${confirmed.length === 0 ? '<p style="color:#909399;padding:20px;background:white;border-radius:8px;">暂无已确认记录</p>' : 
        confirmed.map(item => renderReviewItem(item, 'confirmed')).join('')}
    </div>

    <div class="review-section">
      <h3>⏳ 待补材料 <span class="review-count" style="background:#e6a23c;">${pendingSupplement.length}</span></h3>
      ${pendingSupplement.length === 0 ? '<p style="color:#909399;padding:20px;background:white;border-radius:8px;">暂无待补材料</p>' : 
        pendingSupplement.map(item => renderReviewItem(item, 'pending')).join('')}
    </div>

    <div class="review-section">
      <h3>✏️ 人工修改记录 <span class="review-count" style="background:#f56c6c;">${manuallyModified.length}</span></h3>
      ${manuallyModified.length === 0 ? '<p style="color:#909399;padding:20px;background:white;border-radius:8px;">暂无人工修改记录</p>' : 
        manuallyModified.map(item => renderReviewItem(item, 'modified')).join('')}
    </div>
  `;
}

function renderReviewItem(item, type) {
  return `
    <div class="review-item ${type}">
      <div class="review-item-header">
        <div class="review-item-title">${item.accountName}</div>
        <div style="display:flex;gap:8px;">
          <span class="tag tag-info">${SourceTypeLabel[item.sourceType] || item.sourceType}</span>
          <span class="tag ${type === 'confirmed' ? 'tag-success' : type === 'pending' ? 'tag-warning' : 'tag-danger'}">${OperationTypeLabel[item.operationType] || item.operationType}</span>
        </div>
      </div>
      <div class="review-item-meta">
        <div class="meta-item"><strong>授信额度：</strong>${item.creditAmount.toFixed(2)} 万元</div>
        <div class="meta-item"><strong>已用额度：</strong>${item.usedAmount.toFixed(2)} 万元</div>
        <div class="meta-item"><strong>可用额度：</strong>${item.availableAmount.toFixed(2)} 万元</div>
        <div class="meta-item"><strong>处理人：</strong>${item.handler || '-'}</div>
        <div class="meta-item"><strong>来源日期：</strong>${item.sourceDate}</div>
        <div class="meta-item"><strong>来源编号：</strong>${item.sourceId || '-'}</div>
      </div>
      ${item.remark ? `<div style="margin-bottom:12px;font-size:13px;color:#606266;"><strong>备注：</strong>${item.remark}</div>` : ''}
      <div class="review-guide">
        <strong>📋 处理口径：</strong>${item.processingGuide}
      </div>
    </div>
  `;
}

function openAddModal() {
  currentEditingId = null;
  document.getElementById('modal-title').textContent = '新增授信记录';
  document.getElementById('record-form').reset();
  document.getElementById('form-error').style.display = 'none';
  document.getElementById('form-warning').style.display = 'none';
  document.getElementById('form-sourceDate').value = new Date().toISOString().split('T')[0];
  loadAccounts();
  document.getElementById('modal').classList.add('show');
}

async function editRecord(recordId) {
  currentEditingId = recordId;
  document.getElementById('modal-title').textContent = '编辑授信记录';
  document.getElementById('form-error').style.display = 'none';
  document.getElementById('form-warning').style.display = 'none';
  
  await loadAccounts();
  
  const result = await api(`/credit-records/${recordId}`);
  if (result.success) {
    const record = result.data;
    document.getElementById('form-accountId').value = record.accountId;
    document.getElementById('form-accountName').value = record.accountName;
    document.getElementById('form-creditAmount').value = record.creditAmount;
    document.getElementById('form-usedAmount').value = record.usedAmount;
    document.getElementById('form-sourceType').value = record.sourceType;
    document.getElementById('form-sourceId').value = record.sourceId || '';
    document.getElementById('form-sourceDate').value = record.sourceDate;
    document.getElementById('form-operationType').value = record.operationType;
    document.getElementById('form-status').value = record.status;
    document.getElementById('form-handler').value = record.handler || '';
    document.getElementById('form-remark').value = record.remark || '';
  }
  
  document.getElementById('modal').classList.add('show');
}

function closeModal() {
  document.getElementById('modal').classList.remove('show');
}

async function saveRecord() {
  const data = {
    accountId: document.getElementById('form-accountId').value,
    accountName: document.getElementById('form-accountName').value,
    creditAmount: document.getElementById('form-creditAmount').value,
    usedAmount: document.getElementById('form-usedAmount').value,
    sourceType: document.getElementById('form-sourceType').value,
    sourceId: document.getElementById('form-sourceId').value,
    sourceDate: document.getElementById('form-sourceDate').value,
    operationType: document.getElementById('form-operationType').value,
    status: document.getElementById('form-status').value,
    handler: document.getElementById('form-handler').value,
    remark: document.getElementById('form-remark').value,
    operator: '当前用户'
  };

  const errorEl = document.getElementById('form-error');
  const warningEl = document.getElementById('form-warning');
  errorEl.style.display = 'none';
  warningEl.style.display = 'none';

  try {
    let result;
    if (currentEditingId) {
      result = await api(`/credit-records/${currentEditingId}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } else {
      result = await api('/credit-records', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }

    if (result.success) {
      closeModal();
      showToast(currentEditingId ? '修改成功' : '添加成功', 'success');
      loadRecords();
      loadSummary();
    } else {
      if (result.details && result.details.isDuplicate) {
        warningEl.innerHTML = `
          <strong>⚠️ ${result.message}</strong>
          <div>该账户已有来自 <strong>${result.details.existingSource}</strong> 的记录，新记录来自 <strong>${result.details.newSource}</strong>。</div>
          <div style="margin-top:8px;">💡 ${result.details.suggestion}</div>
          <div style="margin-top:8px;">如需继续，可将操作类型改为"修改结论"或调整日期。</div>
        `;
        warningEl.style.display = 'block';
      } else {
        let errorHtml = `<strong>❌ ${result.message}</strong>`;
        if (result.details && result.details.suggestion) {
          errorHtml += `<div style="margin-top:8px;">💡 ${result.details.suggestion}</div>`;
        }
        errorEl.innerHTML = errorHtml;
        errorEl.style.display = 'block';
      }
    }
  } catch (e) {
    errorEl.innerHTML = '<strong>❌ 网络错误</strong><div>请检查网络连接后重试</div>';
    errorEl.style.display = 'block';
  }
}

async function deleteRecord(recordId) {
  if (!confirm('确定要删除这条记录吗？此操作不可恢复。')) return;

  const result = await api(`/credit-records/${recordId}`, {
    method: 'DELETE'
  });

  if (result.success) {
    showToast('删除成功', 'success');
    loadRecords();
    loadSummary();
  } else {
    showToast(result.message || '删除失败', 'error');
  }
}

async function initSampleData() {
  if (!confirm('确定要初始化示例数据吗？这将添加一些示例账户和授信记录。')) return;

  const result = await api('/init-sample-data', {
    method: 'POST'
  });

  if (result.success) {
    showToast(`示例数据已初始化：${result.stats.accounts} 个账户，${result.stats.records} 条记录`, 'success');
    loadAccounts();
    loadSummary();
    loadRecords();
    loadReviewList();
  } else {
    showToast(result.message || '初始化失败', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadAccounts();
  loadSummary();
});

document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal') {
    closeModal();
  }
});
