const API_BASE = '/api';

let currentModalType = null;
let currentModalData = null;

const typeLabels = {
  borrow: '借出',
  return: '归还',
  sell: '销售转正',
  loss: '损耗'
};

const statusLabels = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已拒绝'
};

const scheduleStatusLabels = {
  active: '进行中',
  completed: '已完成'
};

document.addEventListener('DOMContentLoaded', () => {
  initNavTabs();
  loadAllData();
});

function initNavTabs() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      const tabId = tab.dataset.tab;
      document.getElementById(tabId).classList.add('active');
      
      if (tabId === 'dashboard') refreshAnomalies();
      else if (tabId === 'transactions') loadTransactions();
      else if (tabId === 'samples') loadSamples();
      else if (tabId === 'schedules') loadSchedules();
    });
  });
}

async function loadAllData() {
  await Promise.all([
    loadResponsiblePersons(),
    loadHosts(),
    refreshAnomalies()
  ]);
}

async function fetchAPI(endpoint, options = {}) {
  const response = await fetch(API_BASE + endpoint, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });
  
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.message || '请求失败');
  }
  return data.data;
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

async function refreshAnomalies() {
  try {
    const anomalies = await fetchAPI('/transactions/anomalies');
    renderAnomalies(anomalies);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderAnomalies(anomalies) {
  const container = document.getElementById('anomalies-container');
  
  if (!anomalies || anomalies.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <div class="empty-state-icon">🎉</div>
        <div class="empty-state-text">暂无异常，系统运行良好！</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = anomalies.map(anomaly => `
    <div class="anomaly-card ${anomaly.status}">
      <div class="anomaly-header">
        <div class="anomaly-title">${anomaly.title}</div>
        <div class="anomaly-count">${anomaly.count}</div>
      </div>
      <div class="anomaly-description">${anomaly.description}</div>
      ${anomaly.details ? `
        <div class="anomaly-details">
          ${anomaly.details.map(detail => `
            <div class="anomaly-detail-item">
              <span>${detail.sku || detail.sku || detail.sample_name || detail.responsible_person || detail.name}</span>
              <span>${detail.total_quantity ? detail.total_quantity + '件' : detail.quantity_in_stock !== undefined ? detail.quantity_in_stock + '件' : ''}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');
}

async function loadResponsiblePersons() {
  try {
    const persons = await fetchAPI('/responsible-persons');
    const select = document.getElementById('filter-responsible');
    select.innerHTML = '<option value="">全部责任人</option>' + 
      persons.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadHosts() {
  try {
    const hosts = await fetchAPI('/hosts/hosts');
    const select = document.getElementById('filter-schedule-host');
    select.innerHTML = '<option value="">全部主播</option>' + 
      hosts.map(h => `<option value="${h.id}">${h.name}</option>`).join('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadTransactions() {
  try {
    const params = new URLSearchParams();
    
    const search = document.getElementById('transaction-search').value;
    if (search) params.append('keyword', search);
    
    const type = document.getElementById('filter-type').value;
    if (type) params.append('transaction_type', type);
    
    const status = document.getElementById('filter-status').value;
    if (status) params.append('status', status);
    
    const responsible = document.getElementById('filter-responsible').value;
    if (responsible) params.append('responsible_person_id', responsible);
    
    const startDate = document.getElementById('filter-start-date').value;
    if (startDate) params.append('start_date', startDate);
    
    const endDate = document.getElementById('filter-end-date').value;
    if (endDate) params.append('end_date', endDate);
    
    const queryString = params.toString();
    const transactions = await fetchAPI('/transactions' + (queryString ? `?${queryString}` : ''));
    renderTransactions(transactions);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderTransactions(transactions) {
  const tbody = document.getElementById('transactions-table-body');
  
  if (!transactions || transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11">
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <div class="empty-state-text">暂无交易记录</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = transactions.map(t => `
    <tr>
      <td><span class="type-badge type-${t.transaction_type}">${typeLabels[t.transaction_type]}</span></td>
      <td><code>${t.sku}</code></td>
      <td>${t.sample_name}</td>
      <td>${t.quantity}</td>
      <td>${t.host_name || '-'}</td>
      <td>${t.schedule_date || '-'}</td>
      <td>${t.responsible_person_name || '-'}</td>
      <td title="${t.loss_description || '-'}">${t.loss_description ? (t.loss_description.length > 20 ? t.loss_description.slice(0, 20) + '...' : t.loss_description) : '-'}</td>
      <td><span class="status-badge status-${t.status}">${statusLabels[t.status]}</span></td>
      <td>${new Date(t.created_at).toLocaleString('zh-CN')}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="viewTransaction('${t.id}')">查看</button>
        ${t.status === 'pending' ? `
          <button class="btn btn-sm btn-success" onclick="approveTransaction('${t.id}')">通过</button>
          <button class="btn btn-sm btn-danger" onclick="rejectTransaction('${t.id}')">拒绝</button>
        ` : ''}
      </td>
    </tr>
  `).join('');
}

async function loadSamples() {
  try {
    const params = new URLSearchParams();
    const search = document.getElementById('sample-search').value;
    if (search) params.append('keyword', search);
    
    const queryString = params.toString();
    const samples = await fetchAPI('/samples' + (queryString ? `?${queryString}` : ''));
    renderSamples(samples);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderSamples(samples) {
  const tbody = document.getElementById('samples-table-body');
  
  if (!samples || samples.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <div class="empty-state-icon">📦</div>
            <div class="empty-state-text">暂无样品</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = samples.map(s => `
    <tr>
      <td><code>${s.sku}</code></td>
      <td>${s.name}</td>
      <td>${s.category || '-'}</td>
      <td>¥${s.unit_cost.toFixed(2)}</td>
      <td>
        <span class="${s.quantity_in_stock <= 5 ? 'status-pending' : 'status-approved'}" style="padding: 0.25rem 0.5rem; border-radius: 0.25rem;">
          ${s.quantity_in_stock}
        </span>
      </td>
      <td>${new Date(s.created_at).toLocaleString('zh-CN')}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="viewSample('${s.id}')">查看</button>
        <button class="btn btn-sm btn-primary" onclick="showEditSampleModal('${s.id}')">编辑</button>
      </td>
    </tr>
  `).join('');
}

async function loadSchedules() {
  try {
    const params = new URLSearchParams();
    
    const hostId = document.getElementById('filter-schedule-host').value;
    if (hostId) params.append('host_id', hostId);
    
    const status = document.getElementById('filter-schedule-status').value;
    if (status) params.append('status', status);
    
    const queryString = params.toString();
    const schedules = await fetchAPI('/hosts/schedules' + (queryString ? `?${queryString}` : ''));
    renderSchedules(schedules);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderSchedules(schedules) {
  const tbody = document.getElementById('schedules-table-body');
  
  if (!schedules || schedules.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <div class="empty-state-icon">📅</div>
            <div class="empty-state-text">暂无排期</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = schedules.map(s => `
    <tr>
      <td>${s.host_name || '-'}</td>
      <td>${s.schedule_date}</td>
      <td>${s.start_time || '-'} ${s.end_time ? '~ ' + s.end_time : ''}</td>
      <td>${s.description || '-'}</td>
      <td><span class="status-badge ${s.status === 'completed' ? 'status-approved' : 'status-pending'}">${scheduleStatusLabels[s.status]}</span></td>
      <td>${new Date(s.created_at).toLocaleString('zh-CN')}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="viewSchedule('${s.id}')">查看</button>
        <button class="btn btn-sm btn-primary" onclick="showEditScheduleModal('${s.id}')">编辑</button>
      </td>
    </tr>
  `).join('');
}

function openModal(type, data = null) {
  currentModalType = type;
  currentModalData = data;
  
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');
  
  switch (type) {
    case 'create-transaction':
      title.textContent = '新建交易记录';
      renderTransactionForm();
      break;
    case 'view-transaction':
      title.textContent = '查看交易记录';
      renderTransactionDetail(data);
      break;
    case 'approve-transaction':
      title.textContent = '审批通过';
      renderReviewForm(data, 'approve');
      break;
    case 'reject-transaction':
      title.textContent = '审批拒绝';
      renderReviewForm(data, 'reject');
      break;
    case 'create-sample':
      title.textContent = '新增样品';
      renderSampleForm();
      break;
    case 'edit-sample':
      title.textContent = '编辑样品';
      renderSampleForm(data);
      break;
    case 'view-sample':
      title.textContent = '查看样品';
      renderSampleDetail(data);
      break;
    case 'create-schedule':
      title.textContent = '新增排期';
      renderScheduleForm();
      break;
    case 'edit-schedule':
      title.textContent = '编辑排期';
      renderScheduleForm(data);
      break;
    case 'view-schedule':
      title.textContent = '查看排期';
      renderScheduleDetail(data);
      break;
    case 'export':
      title.textContent = '导出报告';
      renderExportForm();
      break;
  }
  
  overlay.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  currentModalType = null;
  currentModalData = null;
}

async function confirmModal() {
  switch (currentModalType) {
    case 'create-transaction':
      await handleCreateTransaction();
      break;
    case 'approve-transaction':
      await handleApproveTransaction();
      break;
    case 'reject-transaction':
      await handleRejectTransaction();
      break;
    case 'create-sample':
      await handleCreateSample();
      break;
    case 'edit-sample':
      await handleEditSample();
      break;
    case 'create-schedule':
      await handleCreateSchedule();
      break;
    case 'edit-schedule':
      await handleEditSchedule();
      break;
    case 'export':
      await handleExport();
      break;
  }
}

async function renderTransactionForm() {
  const [samples, schedules, responsiblePersons] = await Promise.all([
    fetchAPI('/samples'),
    fetchAPI('/hosts/schedules'),
    fetchAPI('/responsible-persons')
  ]);
  
  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <form id="transaction-form">
      <div class="form-group">
        <label>交易类型 *</label>
        <select id="form-transaction-type" required onchange="toggleLossDescription()">
          <option value="">请选择</option>
          <option value="borrow">借出</option>
          <option value="return">归还</option>
          <option value="sell">销售转正</option>
          <option value="loss">损耗</option>
        </select>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>样品 *</label>
          <select id="form-sample" required>
            <option value="">请选择样品</option>
            ${samples.map(s => `<option value="${s.id}" data-stock="${s.quantity_in_stock}">${s.sku} - ${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>排期 *</label>
          <select id="form-schedule" required>
            <option value="">请选择排期</option>
            ${schedules.map(s => `<option value="${s.id}" data-status="${s.status}" data-host="${s.host_id}">${s.schedule_date} - ${s.description || s.host_name}</option>`).join('')}
          </select>
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>数量 *</label>
          <input type="number" id="form-quantity" min="1" required>
        </div>
        <div class="form-group">
          <label>责任人</label>
          <select id="form-responsible">
            <option value="">请选择</option>
            ${responsiblePersons.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
          </select>
        </div>
      </div>
      
      <div class="form-group" id="loss-description-group" style="display: none;">
        <label>损耗说明</label>
        <textarea id="form-loss-description" placeholder="请描述损耗情况..."></textarea>
      </div>
    </form>
  `;
}

function toggleLossDescription() {
  const type = document.getElementById('form-transaction-type').value;
  const lossGroup = document.getElementById('loss-description-group');
  lossGroup.style.display = (type === 'return' || type === 'loss') ? 'block' : 'none';
}

async function handleCreateTransaction() {
  const formData = {
    transaction_type: document.getElementById('form-transaction-type').value,
    sample_id: document.getElementById('form-sample').value,
    schedule_id: document.getElementById('form-schedule').value,
    quantity: parseInt(document.getElementById('form-quantity').value),
    responsible_person_id: document.getElementById('form-responsible').value || null,
    loss_description: document.getElementById('form-loss-description').value || null,
    created_by: 'web_user'
  };
  
  const scheduleSelect = document.getElementById('form-schedule');
  const selectedOption = scheduleSelect.options[scheduleSelect.selectedIndex];
  if (selectedOption) {
    formData.host_id = selectedOption.dataset.host;
  }
  
  try {
    await fetchAPI('/transactions', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    
    showToast('交易记录创建成功');
    closeModal();
    loadTransactions();
    refreshAnomalies();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function viewTransaction(id) {
  const transaction = await fetchAPI(`/transactions/${id}`);
  openModal('view-transaction', transaction);
}

async function renderTransactionDetail(transaction) {
  const versions = await fetchAPI(`/transactions/${transaction.id}/versions`);
  const reviews = await fetchAPI(`/transactions/${transaction.id}/reviews`);
  
  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <div class="detail-section">
      <div class="form-row">
        <div class="form-group">
          <label>交易类型</label>
          <div><span class="type-badge type-${transaction.transaction_type}">${typeLabels[transaction.transaction_type]}</span></div>
        </div>
        <div class="form-group">
          <label>状态</label>
          <div><span class="status-badge status-${transaction.status}">${statusLabels[transaction.status]}</span></div>
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>SKU</label>
          <div><code>${transaction.sku}</code></div>
        </div>
        <div class="form-group">
          <label>样品名称</label>
          <div>${transaction.sample_name}</div>
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>数量</label>
          <div>${transaction.quantity}</div>
        </div>
        <div class="form-group">
          <label>单位成本</label>
          <div>¥${transaction.unit_cost.toFixed(2)}</div>
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>主播</label>
          <div>${transaction.host_name || '-'}</div>
        </div>
        <div class="form-group">
          <label>排期日期</label>
          <div>${transaction.schedule_date || '-'}</div>
        </div>
      </div>
      
      <div class="form-group">
        <label>责任人</label>
        <div>${transaction.responsible_person_name || '-'}</div>
      </div>
      
      ${transaction.loss_description ? `
        <div class="form-group">
          <label>损耗说明</label>
          <div>${transaction.loss_description}</div>
        </div>
      ` : ''}
      
      <div class="form-row">
        <div class="form-group">
          <label>创建人</label>
          <div>${transaction.created_by}</div>
        </div>
        <div class="form-group">
          <label>创建时间</label>
          <div>${new Date(transaction.created_at).toLocaleString('zh-CN')}</div>
        </div>
      </div>
      
      ${transaction.reviewed_by ? `
        <div class="form-row">
          <div class="form-group">
            <label>审批人</label>
            <div>${transaction.reviewed_by}</div>
          </div>
          <div class="form-group">
            <label>审批时间</label>
            <div>${transaction.reviewed_at ? new Date(transaction.reviewed_at).toLocaleString('zh-CN') : '-'}</div>
          </div>
        </div>
      ` : ''}
      
      ${versions && versions.length > 1 ? `
        <div class="form-group">
          <label>修改历史 (${versions.length}条)</label>
          <div class="version-list">
            ${versions.slice(0, 5).map(v => `
              <div class="version-item">
                <div class="version-header">
                  <span>${v.change_reason}</span>
                  <span>${new Date(v.created_at).toLocaleString('zh-CN')}</span>
                </div>
                <div class="version-changes">
                  ${v.created_by} · 数量: ${v.quantity}
                  ${v.loss_description ? ` · 损耗说明: ${v.loss_description}` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

async function approveTransaction(id) {
  const transaction = await fetchAPI(`/transactions/${id}`);
  openModal('approve-transaction', transaction);
}

async function rejectTransaction(id) {
  const transaction = await fetchAPI(`/transactions/${id}`);
  openModal('reject-transaction', transaction);
}

function renderReviewForm(transaction, action) {
  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <div class="detail-section">
      <div class="form-group">
        <label>确认信息</label>
        <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem;">
          <p><strong>交易类型:</strong> ${typeLabels[transaction.transaction_type]}</p>
          <p><strong>样品:</strong> ${transaction.sku} - ${transaction.sample_name}</p>
          <p><strong>数量:</strong> ${transaction.quantity}</p>
        </div>
      </div>
      
      <div class="form-group">
        <label>审批人</label>
        <input type="text" id="form-reviewer" placeholder="请输入审批人姓名">
      </div>
      
      <div class="form-group">
        <label>审批意见</label>
        <textarea id="form-review-comments" placeholder="请输入审批意见（可选）"></textarea>
      </div>
    </div>
  `;
}

async function handleApproveTransaction() {
  const reviewer = document.getElementById('form-reviewer').value || '系统管理员';
  const comments = document.getElementById('form-review-comments').value;
  
  try {
    await fetchAPI(`/transactions/${currentModalData.id}/approve`, {
      method: 'POST',
      body: JSON.stringify({
        reviewed_by: reviewer,
        comments
      })
    });
    
    showToast('审批通过成功');
    closeModal();
    loadTransactions();
    refreshAnomalies();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleRejectTransaction() {
  const reviewer = document.getElementById('form-reviewer').value || '系统管理员';
  const comments = document.getElementById('form-review-comments').value;
  
  try {
    await fetchAPI(`/transactions/${currentModalData.id}/reject`, {
      method: 'POST',
      body: JSON.stringify({
        reviewed_by: reviewer,
        comments
      })
    });
    
    showToast('已拒绝该申请');
    closeModal();
    loadTransactions();
    refreshAnomalies();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function showCreateTransactionModal() {
  openModal('create-transaction');
}

async function showCreateSampleModal() {
  openModal('create-sample');
}

function renderSampleForm(data = null) {
  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <form id="sample-form">
      <div class="form-group">
        <label>SKU *</label>
        <input type="text" id="form-sku" value="${data?.sku || ''}" required ${data ? 'readonly' : ''}>
      </div>
      
      <div class="form-group">
        <label>样品名称 *</label>
        <input type="text" id="form-sample-name" value="${data?.name || ''}" required>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>分类</label>
          <input type="text" id="form-category" value="${data?.category || ''}">
        </div>
        <div class="form-group">
          <label>单位成本</label>
          <input type="number" id="form-unit-cost" value="${data?.unit_cost || ''}" step="0.01" min="0">
        </div>
      </div>
      
      <div class="form-group">
        <label>库存数量</label>
        <input type="number" id="form-stock" value="${data?.quantity_in_stock || 0}" min="0">
      </div>
      
      ${data ? `
        <div class="form-group">
          <label>修改原因</label>
          <textarea id="form-change-reason" placeholder="请描述修改原因..."></textarea>
        </div>
      ` : ''}
    </form>
  `;
}

async function handleCreateSample() {
  const formData = {
    sku: document.getElementById('form-sku').value,
    name: document.getElementById('form-sample-name').value,
    category: document.getElementById('form-category').value || null,
    unit_cost: parseFloat(document.getElementById('form-unit-cost').value) || 0,
    quantity_in_stock: parseInt(document.getElementById('form-stock').value) || 0,
    created_by: 'web_user'
  };
  
  try {
    await fetchAPI('/samples', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    
    showToast('样品创建成功');
    closeModal();
    loadSamples();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function showEditSampleModal(id) {
  const sample = await fetchAPI(`/samples/${id}`);
  openModal('edit-sample', sample);
}

async function handleEditSample() {
  const formData = {
    name: document.getElementById('form-sample-name').value,
    category: document.getElementById('form-category').value || null,
    unit_cost: parseFloat(document.getElementById('form-unit-cost').value) || 0,
    quantity_in_stock: parseInt(document.getElementById('form-stock').value) || 0,
    change_reason: document.getElementById('form-change-reason').value || null
  };
  
  try {
    await fetchAPI(`/samples/${currentModalData.id}`, {
      method: 'PUT',
      body: JSON.stringify(formData)
    });
    
    showToast('样品更新成功');
    closeModal();
    loadSamples();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function viewSample(id) {
  const sample = await fetchAPI(`/samples/${id}`);
  openModal('view-sample', sample);
}

async function renderSampleDetail(sample) {
  const versions = await fetchAPI(`/samples/${sample.id}/versions`);
  
  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <div class="detail-section">
      <div class="form-row">
        <div class="form-group">
          <label>SKU</label>
          <div><code>${sample.sku}</code></div>
        </div>
        <div class="form-group">
          <label>分类</label>
          <div>${sample.category || '-'}</div>
        </div>
      </div>
      
      <div class="form-group">
        <label>样品名称</label>
        <div>${sample.name}</div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>单位成本</label>
          <div>¥${sample.unit_cost.toFixed(2)}</div>
        </div>
        <div class="form-group">
          <label>库存</label>
          <div>${sample.quantity_in_stock}</div>
        </div>
      </div>
      
      <div class="form-group">
        <label>创建时间</label>
        <div>${new Date(sample.created_at).toLocaleString('zh-CN')}</div>
      </div>
      
      ${versions && versions.length > 1 ? `
        <div class="form-group">
          <label>修改历史 (${versions.length}条)</label>
          <div class="version-list">
            ${versions.slice(0, 5).map(v => `
              <div class="version-item">
                <div class="version-header">
                  <span>${v.change_reason}</span>
                  <span>${new Date(v.created_at).toLocaleString('zh-CN')}</span>
                </div>
                <div class="version-changes">
                  ${v.created_by} · ${v.sku} - ${v.name}
                  ${v.unit_cost !== undefined ? ` · 成本: ¥${v.unit_cost}` : ''}
                  ${v.quantity_in_stock !== undefined ? ` · 库存: ${v.quantity_in_stock}` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

async function showCreateScheduleModal() {
  openModal('create-schedule');
}

async function renderScheduleForm(data = null) {
  const hosts = await fetchAPI('/hosts/hosts');
  
  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <form id="schedule-form">
      <div class="form-group">
        <label>主播 *</label>
        <select id="form-host" required>
          <option value="">请选择主播</option>
          ${hosts.map(h => `<option value="${h.id}" ${data?.host_id === h.id ? 'selected' : ''}>${h.name} (${h.department || '-'})</option>`).join('')}
        </select>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>排期日期 *</label>
          <input type="date" id="form-schedule-date" value="${data?.schedule_date || ''}" required>
        </div>
        <div class="form-group">
          <label>状态</label>
          <select id="form-schedule-status">
            <option value="active" ${data?.status === 'active' ? 'selected' : ''}>进行中</option>
            <option value="completed" ${data?.status === 'completed' ? 'selected' : ''}>已完成</option>
          </select>
        </div>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label>开始时间</label>
          <input type="time" id="form-start-time" value="${data?.start_time || ''}">
        </div>
        <div class="form-group">
          <label>结束时间</label>
          <input type="time" id="form-end-time" value="${data?.end_time || ''}">
        </div>
      </div>
      
      <div class="form-group">
        <label>描述</label>
        <textarea id="form-schedule-desc" placeholder="请输入排期描述...">${data?.description || ''}</textarea>
      </div>
      
      ${data ? `
        <div class="form-group">
          <label>修改原因</label>
          <textarea id="form-change-reason" placeholder="请描述修改原因..."></textarea>
        </div>
      ` : ''}
    </form>
  `;
}

async function handleCreateSchedule() {
  const formData = {
    host_id: document.getElementById('form-host').value,
    schedule_date: document.getElementById('form-schedule-date').value,
    start_time: document.getElementById('form-start-time').value || null,
    end_time: document.getElementById('form-end-time').value || null,
    description: document.getElementById('form-schedule-desc').value || null,
    status: document.getElementById('form-schedule-status').value,
    created_by: 'web_user'
  };
  
  try {
    await fetchAPI('/hosts/schedules', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    
    showToast('排期创建成功');
    closeModal();
    loadSchedules();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function showEditScheduleModal(id) {
  const schedule = await fetchAPI(`/hosts/schedules/${id}`);
  openModal('edit-schedule', schedule);
}

async function handleEditSchedule() {
  const formData = {
    host_id: document.getElementById('form-host').value,
    schedule_date: document.getElementById('form-schedule-date').value,
    start_time: document.getElementById('form-start-time').value || null,
    end_time: document.getElementById('form-end-time').value || null,
    description: document.getElementById('form-schedule-desc').value || null,
    status: document.getElementById('form-schedule-status').value,
    change_reason: document.getElementById('form-change-reason').value || null
  };
  
  try {
    await fetchAPI(`/hosts/schedules/${currentModalData.id}`, {
      method: 'PUT',
      body: JSON.stringify(formData)
    });
    
    showToast('排期更新成功');
    closeModal();
    loadSchedules();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function viewSchedule(id) {
  const schedule = await fetchAPI(`/hosts/schedules/${id}`);
  openModal('view-schedule', schedule);
}

async function renderScheduleDetail(schedule) {
  const versions = await fetchAPI(`/hosts/schedules/${schedule.id}/versions`);
  
  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <div class="detail-section">
      <div class="form-row">
        <div class="form-group">
          <label>主播</label>
          <div>${schedule.host_name || '-'}</div>
        </div>
        <div class="form-group">
          <label>状态</label>
          <div><span class="status-badge ${schedule.status === 'completed' ? 'status-approved' : 'status-pending'}">${scheduleStatusLabels[schedule.status]}</span></div>
        </div>
      </div>
      
      <div class="form-group">
        <label>排期日期</label>
        <div>${schedule.schedule_date}</div>
      </div>
      
      <div class="form-group">
        <label>时间</label>
        <div>${schedule.start_time || '-'} ${schedule.end_time ? '~ ' + schedule.end_time : ''}</div>
      </div>
      
      <div class="form-group">
        <label>描述</label>
        <div>${schedule.description || '-'}</div>
      </div>
      
      <div class="form-group">
        <label>创建时间</label>
        <div>${new Date(schedule.created_at).toLocaleString('zh-CN')}</div>
      </div>
      
      ${versions && versions.length > 1 ? `
        <div class="form-group">
          <label>修改历史 (${versions.length}条)</label>
          <div class="version-list">
            ${versions.slice(0, 5).map(v => `
              <div class="version-item">
                <div class="version-header">
                  <span>${v.change_reason}</span>
                  <span>${new Date(v.created_at).toLocaleString('zh-CN')}</span>
                </div>
                <div class="version-changes">
                  ${v.created_by} · ${v.schedule_date}
                  ${v.start_time ? ` · ${v.start_time}` : ''}
                  ${v.end_time ? `~ ${v.end_time}` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

async function showExportModal() {
  const responsiblePersons = await fetchAPI('/responsible-persons');
  openModal('export', { responsiblePersons });
}

function renderExportForm() {
  const { responsiblePersons } = currentModalData;
  
  const body = document.getElementById('modal-body');
  body.innerHTML = `
    <form id="export-form">
      <div class="form-row">
        <div class="form-group">
          <label>开始日期</label>
          <input type="date" id="export-start-date">
        </div>
        <div class="form-group">
          <label>结束日期</label>
          <input type="date" id="export-end-date">
        </div>
      </div>
      
      <div class="form-group">
        <label>责任人</label>
        <select id="export-responsible">
          <option value="">全部责任人</option>
          ${responsiblePersons.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
        </select>
      </div>
      
      <div class="form-group">
        <label>交易类型</label>
        <select id="export-type">
          <option value="">全部类型</option>
          <option value="borrow">借出</option>
          <option value="return">归还</option>
          <option value="sell">销售转正</option>
          <option value="loss">损耗</option>
        </select>
      </div>
    </form>
  `;
}

async function handleExport() {
  const filter = {};
  
  const startDate = document.getElementById('export-start-date').value;
  if (startDate) filter.start_date = startDate;
  
  const endDate = document.getElementById('export-end-date').value;
  if (endDate) filter.end_date = endDate;
  
  const responsible = document.getElementById('export-responsible').value;
  if (responsible) filter.responsible_person_id = responsible;
  
  const type = document.getElementById('export-type').value;
  if (type) filter.transaction_type = type;
  
  try {
    const result = await fetchAPI('/transactions/export', {
      method: 'POST',
      body: JSON.stringify(filter)
    });
    
    showToast(`导出成功，共 ${result.count} 条记录`);
    closeModal();
    
    window.open(result.download_url, '_blank');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
