const API_BASE = '';

const STATUS_ORDER = ['pending', 'quoted', 'paid', 'locked', 'scheduled', 'ready', 'completed', 'cancelled'];
const STATUS_NAMES = {
  pending: '待确认',
  quoted: '已报价',
  paid: '已收款',
  locked: '已锁料',
  scheduled: '排产中',
  ready: '待取件',
  completed: '已交付',
  cancelled: '已取消'
};

const STATUS_COLORS = {
  pending: '#f59e0b',
  quoted: '#3b82f6',
  paid: '#6366f1',
  locked: '#8b5cf6',
  scheduled: '#0ea5e9',
  ready: '#22c55e',
  completed: '#10b981',
  cancelled: '#6b7280'
};

let currentTab = 'dashboard';
let customersCache = [];
let papersCache = [];
let processesCache = [];
let templatesCache = [];
let machinesCache = [];

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadDashboard();
  loadFormData();
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(17, 0, 0, 0);
  document.getElementById('order-pickup').value = formatDateTimeLocal(tomorrow);
  
  document.getElementById('schedule-date').value = formatDateInput(new Date());
});

function initTabs() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      switchTab(tabId);
    });
  });
}

function switchTab(tabId) {
  currentTab = tabId;
  
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === tabId);
  });
  
  switch (tabId) {
    case 'dashboard':
      loadDashboard();
      break;
    case 'orders':
      loadOrders();
      break;
    case 'precheck':
      loadPrecheckIssues();
      break;
    case 'schedule':
      loadSchedule();
      break;
    case 'stock':
      loadStock();
      break;
    case 'customers':
      loadCustomers();
      break;
  }
}

async function fetchAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}/api${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    return await response.json();
  } catch (err) {
    console.error('API Error:', err);
    showToast('网络请求失败', 'error');
    return { success: false, message: err.message };
  }
}

async function loadFormData() {
  const [customers, papers, processes, templates, machines] = await Promise.all([
    fetchAPI('/customers'),
    fetchAPI('/paper-stock'),
    fetchAPI('/processes'),
    fetchAPI('/spec-templates'),
    fetchAPI('/machines')
  ]);
  
  if (customers.success) {
    customersCache = customers.data;
    populateCustomerSelect(customers.data);
  }
  
  if (papers.success) {
    papersCache = papers.data;
    populatePaperSelect(papers.data);
    populateAdjustPaperSelect(papers.data);
  }
  
  if (processes.success) {
    processesCache = processes.data;
    populateProcessSelect(processes.data);
  }
  
  if (templates.success) {
    templatesCache = templates.data;
    populateTemplateSelect(templates.data);
  }
  
  if (machines.success) {
    machinesCache = machines.data;
  }
  
  populateStatusFilter();
}

function populateCustomerSelect(customers) {
  const select = document.getElementById('order-customer');
  select.innerHTML = '<option value="">散客</option>';
  customers.forEach(c => {
    select.innerHTML += `<option value="${c.id}">${c.name} ${c.phone ? `(${c.phone})` : ''}</option>`;
  });
}

function populatePaperSelect(papers) {
  const select = document.getElementById('order-paper');
  select.innerHTML = '<option value="">请选择</option>';
  papers.forEach(p => {
    const available = p.available || p.stock_qty;
    select.innerHTML += `<option value="${p.id}">${p.name} (${p.size || ''} ${p.weight || ''}g) - 可用: ${available}</option>`;
  });
}

function populateAdjustPaperSelect(papers) {
  const select = document.getElementById('adjust-paper');
  select.innerHTML = '<option value="">请选择</option>';
  papers.forEach(p => {
    select.innerHTML += `<option value="${p.id}">${p.name} (当前库存: ${p.stock_qty})</option>`;
  });
}

function populateProcessSelect(processes) {
  const select = document.getElementById('order-processes');
  select.innerHTML = '';
  processes.forEach(p => {
    select.innerHTML += `<option value="${p.id}">${p.name} (¥${p.cost_per_unit}/份)</option>`;
  });
}

function populateTemplateSelect(templates) {
  const select = document.getElementById('order-spec-template');
  select.innerHTML = '<option value="">自定义</option>';
  templates.forEach(t => {
    select.innerHTML += `<option value="${t.id}">${t.name} (${t.width}x${t.height}mm)</option>`;
  });
  
  select.addEventListener('change', (e) => {
    const templateId = e.target.value;
    if (templateId) {
      const template = templatesCache.find(t => t.id === parseInt(templateId));
      if (template) {
        document.getElementById('order-width').value = template.width;
        document.getElementById('order-height').value = template.height;
        document.getElementById('order-product-type').value = template.product_type || '';
      }
    }
  });
}

function populateStatusFilter() {
  const select = document.getElementById('order-status-filter');
  select.innerHTML = '<option value="">全部状态</option>';
  for (const [key, name] of Object.entries(STATUS_NAMES)) {
    select.innerHTML += `<option value="${key}">${name}</option>`;
  }
}

async function loadDashboard() {
  const stats = await fetchAPI('/dashboard/stats');
  const orders = await fetchAPI('/orders');
  const precheck = await fetchAPI('/precheck-issues?status=pending');
  const stock = await fetchAPI('/paper-stock');
  
  if (stats.success) {
    updateStats(stats.data);
  }
  
  if (orders.success) {
    renderKanban(orders.data);
  }
  
  if (precheck.success) {
    renderShortPrecheckList(precheck.data);
  }
  
  if (stock.success) {
    renderStockAlerts(stock.data.filter(p => p.needs_restock));
  }
}

function updateStats(data) {
  const stats = data.order_stats;
  const totalOrders = Object.values(stats).reduce((a, b) => a + b, 0);
  
  document.getElementById('stat-total-orders').textContent = totalOrders;
  document.getElementById('stat-pending-orders').textContent = stats.pending || 0;
  document.getElementById('stat-pending-issues').textContent = data.pending_issues || 0;
  document.getElementById('stat-low-stock').textContent = data.low_stock || 0;
  document.getElementById('stat-today-revenue').textContent = '¥' + (data.today_revenue || 0);
  document.getElementById('stat-today-pickup').textContent = data.today_pickup || 0;
}

function renderKanban(orders) {
  const board = document.getElementById('kanban-board');
  board.innerHTML = '';
  
  const grouped = {};
  STATUS_ORDER.forEach(s => grouped[s] = []);
  orders.forEach(o => {
    if (grouped[o.status]) {
      grouped[o.status].push(o);
    }
  });
  
  STATUS_ORDER.slice(0, -1).forEach(status => {
    const column = document.createElement('div');
    column.className = 'kanban-column';
    column.innerHTML = `
      <div class="kanban-column-header">
        <span class="kanban-column-title" style="color: ${STATUS_COLORS[status]}">${STATUS_NAMES[status]}</span>
        <span class="kanban-count">${grouped[status].length}</span>
      </div>
    `;
    
    grouped[status].slice(0, 5).forEach(order => {
      const card = document.createElement('div');
      card.className = 'kanban-card';
      card.style.borderLeftColor = STATUS_COLORS[status];
      card.onclick = () => showOrderDetail(order.id);
      card.innerHTML = `
        <div class="no">${order.order_no}</div>
        <div class="customer">${order.customer_name || '散客'}</div>
        <div class="info">${order.product_type || ''} ${order.quantity}份</div>
        <div class="price">¥${order.total_price || '-'}</div>
      `;
      column.appendChild(card);
    });
    
    if (grouped[status].length > 5) {
      const more = document.createElement('div');
      more.style.textAlign = 'center';
      more.style.color = '#64748b';
      more.style.fontSize = '12px';
      more.style.padding = '8px';
      more.textContent = `还有 ${grouped[status].length - 5} 个订单...`;
      column.appendChild(more);
    }
    
    board.appendChild(column);
  });
}

function renderShortPrecheckList(issues) {
  const container = document.getElementById('precheck-list-short');
  
  if (issues.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div>暂无待处理预检问题</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  issues.slice(0, 5).forEach(issue => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="list-item-content">
        <div class="list-item-title">${issue.order_no} - ${issue.issue_name}</div>
        <div class="list-item-desc">${issue.description}</div>
      </div>
      <span class="badge badge-${issue.severity === 'critical' ? 'critical' : 'warning'}">${issue.severity === 'critical' ? '严重' : '警告'}</span>
    `;
    container.appendChild(item);
  });
}

function renderStockAlerts(papers) {
  const container = document.getElementById('stock-alert-list');
  
  if (papers.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <div>库存充足</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = '';
  papers.forEach(p => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div class="list-item-content">
        <div class="list-item-title">${p.name}</div>
        <div class="list-item-desc">可用: ${p.available} / 安全库存: ${p.min_stock}</div>
      </div>
      <span class="badge badge-danger">缺货</span>
    `;
    container.appendChild(item);
  });
}

async function loadOrders() {
  const status = document.getElementById('order-status-filter').value;
  const dateFrom = document.getElementById('order-date-from').value;
  const dateTo = document.getElementById('order-date-to').value;
  
  let url = '/orders';
  const params = [];
  if (status) params.push(`status=${status}`);
  if (dateFrom) params.push(`date_from=${dateFrom}`);
  if (dateTo) params.push(`date_to=${dateTo}`);
  if (params.length > 0) url += '?' + params.join('&');
  
  const result = await fetchAPI(url);
  
  if (result.success) {
    renderOrdersTable(result.data);
  }
}

function renderOrdersTable(orders) {
  const container = document.getElementById('orders-table');
  
  if (orders.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div>暂无订单</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>订单号</th>
          <th>客户</th>
          <th>产品</th>
          <th>数量</th>
          <th>报价</th>
          <th>取件时间</th>
          <th>状态</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${orders.map(o => `
          <tr>
            <td><strong>${o.order_no}</strong></td>
            <td>${o.customer_name || '散客'}</td>
            <td>${o.product_type || '-'} ${o.width}x${o.height}mm</td>
            <td>${o.quantity}</td>
            <td><strong>¥${o.total_price || '-'}</strong></td>
            <td>${formatDateTime(o.pickup_time)}</td>
            <td><span class="badge" style="background: ${STATUS_COLORS[o.status]}20; color: ${STATUS_COLORS[o.status]}">${o.status_name}</span></td>
            <td>
              <div class="action-buttons">
                <button class="btn btn-sm" onclick="showOrderDetail(${o.id})">详情</button>
                ${renderStatusActions(o)}
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderStatusActions(order) {
  const buttons = [];
  const status = order.status;
  
  if (status === 'pending') {
    buttons.push(`<button class="btn btn-sm btn-primary" onclick="quickUpdateStatus(${order.id}, 'quoted', '确认报价')">报价</button>`);
  }
  if (status === 'quoted') {
    buttons.push(`<button class="btn btn-sm btn-success" onclick="showPaymentModal(${order.id})">收款</button>`);
  }
  if (status === 'paid') {
    buttons.push(`<button class="btn btn-sm btn-primary" onclick="quickUpdateStatus(${order.id}, 'locked', '锁定库存')">锁料</button>`);
  }
  if (status === 'locked') {
    buttons.push(`<button class="btn btn-sm btn-primary" onclick="quickUpdateStatus(${order.id}, 'scheduled', '安排生产')">排产</button>`);
  }
  if (status === 'scheduled') {
    buttons.push(`<button class="btn btn-sm btn-success" onclick="quickUpdateStatus(${order.id}, 'ready', '生产完成')">完成</button>`);
  }
  if (status === 'ready') {
    buttons.push(`<button class="btn btn-sm btn-success" onclick="quickUpdateStatus(${order.id}, 'completed', '客户已取件')">交付</button>`);
  }
  if (status !== 'completed' && status !== 'cancelled') {
    buttons.push(`<button class="btn btn-sm btn-danger" onclick="quickUpdateStatus(${order.id}, 'cancelled', '取消订单')">取消</button>`);
  }
  
  return buttons.join('');
}

async function quickUpdateStatus(orderId, status, reason) {
  if (status === 'cancelled' && !confirm('确定要取消这个订单吗？')) {
    return;
  }
  
  const result = await fetchAPI(`/orders/${orderId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, reason })
  });
  
  if (result.success) {
    showToast(`订单已${STATUS_NAMES[status]}`, 'success');
    loadOrders();
    loadDashboard();
  } else {
    showToast(result.message || '操作失败', 'error');
  }
}

function showPaymentModal(orderId) {
  const amount = prompt('请输入收款金额:', '');
  if (amount !== null) {
    const paidAmount = parseFloat(amount) || 0;
    quickUpdateStatusWithPayment(orderId, 'paid', '已收款', paidAmount);
  }
}

async function quickUpdateStatusWithPayment(orderId, status, reason, paidAmount) {
  const result = await fetchAPI(`/orders/${orderId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, reason, paid_amount: paidAmount })
  });
  
  if (result.success) {
    showToast(`订单已${STATUS_NAMES[status]}`, 'success');
    loadOrders();
    loadDashboard();
  } else {
    showToast(result.message || '操作失败', 'error');
  }
}

async function showOrderDetail(orderId) {
  const result = await fetchAPI(`/orders/${orderId}`);
  
  if (!result.success) {
    showToast('获取订单详情失败', 'error');
    return;
  }
  
  const { order, files, issues, history, changes, schedule } = result.data;
  
  document.getElementById('detail-order-title').textContent = `订单 ${order.order_no} - ${order.status_name}`;
  
  const currentIdx = STATUS_ORDER.indexOf(order.status);
  
  const statusFlowHtml = STATUS_ORDER.slice(0, -1).map((s, i) => {
    const isCompleted = i < currentIdx;
    const isCurrent = i === currentIdx;
    const stepClass = isCompleted ? 'completed' : (isCurrent ? 'current' : '');
    
    let lineHtml = '';
    if (i < STATUS_ORDER.length - 2) {
      const lineClass = i < currentIdx ? 'completed' : '';
      lineHtml = `<div class="status-line ${lineClass}"></div>`;
    }
    
    return `
      <div class="status-step ${stepClass}">
        <div class="status-dot">${isCompleted ? '✓' : (i + 1)}</div>
        <div class="status-step-label">${STATUS_NAMES[s]}</div>
      </div>
      ${lineHtml}
    `;
  }).join('');
  
  let content = `
    <div class="order-detail-section">
      <h4>📊 状态流转</h4>
      <div class="status-flow">${statusFlowHtml}</div>
    </div>
    
    <div class="order-detail-section">
      <h4>📋 订单信息</h4>
      <div class="detail-grid">
        <div class="detail-item">
          <div class="detail-label">客户</div>
          <div class="detail-value">${order.customer_name || '散客'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">联系电话</div>
          <div class="detail-value">${order.customer_phone || '-'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">产品类型</div>
          <div class="detail-value">${order.product_type || '-'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">尺寸</div>
          <div class="detail-value">${order.width}x${order.height}mm</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">数量</div>
          <div class="detail-value">${order.quantity} 份</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">预估用纸</div>
          <div class="detail-value">${order.paper_qty_est || '-'} 张</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">成本</div>
          <div class="detail-value">¥${order.total_cost || '-'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">报价</div>
          <div class="detail-value price">¥${order.total_price || '-'}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">已收款</div>
          <div class="detail-value price">¥${order.paid_amount || 0}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">取件时间</div>
          <div class="detail-value">${formatDateTime(order.pickup_time)}</div>
        </div>
      </div>
    </div>
  `;
  
  if (history && history.length > 0) {
    content += `
      <div class="order-detail-section">
        <h4>📜 状态历史</h4>
        <div class="history-list">
          ${history.map(h => `
            <div class="history-item">
              <div class="history-time">${formatDateTime(h.created_at)}</div>
              <div class="history-content">
                <div>
                  <span class="history-status" style="background: ${STATUS_COLORS[h.to_status]}20; color: ${STATUS_COLORS[h.to_status]}">
                    ${h.to_status_name}
                  </span>
                  ${h.reason ? `<span>${h.reason}</span>` : ''}
                </div>
                <div class="history-operator">操作人: ${h.operator || 'system'}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  if (issues && issues.length > 0) {
    content += `
      <div class="order-detail-section">
        <h4>⚠️ 预检问题</h4>
        <table class="data-table">
          <thead>
            <tr>
              <th>问题类型</th>
              <th>严重程度</th>
              <th>描述</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${issues.map(i => `
              <tr>
                <td>${i.issue_name}</td>
                <td><span class="badge badge-${i.severity === 'critical' ? 'critical' : 'warning'}">${i.severity === 'critical' ? '严重' : '警告'}</span></td>
                <td>${i.description}</td>
                <td>${i.status === 'resolved' ? '已处理' : '待处理'}</td>
                <td>
                  ${i.status !== 'resolved' ? 
                    `<button class="btn btn-sm btn-success" onclick="resolveIssue(${i.id}, ${orderId})">标记处理</button>` : 
                    '<span class="badge badge-success">已处理</span>'
                  }
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <button class="btn btn-primary" style="margin-top:12px" onclick="runPrecheck(${orderId})">重新预检</button>
      </div>
    `;
  } else {
    content += `
      <div class="order-detail-section">
        <h4>⚠️ 预检问题</h4>
        <button class="btn btn-primary" onclick="runPrecheck(${orderId})">执行预检</button>
      </div>
    `;
  }
  
  if (files && files.length > 0) {
    content += `
      <div class="order-detail-section">
        <h4>📁 上传文件</h4>
        <table class="data-table">
          <thead>
            <tr>
              <th>文件名</th>
              <th>大小</th>
              <th>类型</th>
              <th>上传时间</th>
            </tr>
          </thead>
          <tbody>
            ${files.map(f => `
              <tr>
                <td>${f.original_name}</td>
                <td>${formatFileSize(f.file_size)}</td>
                <td>${f.file_type || '-'}</td>
                <td>${formatDateTime(f.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  
  content += `
    <div class="order-detail-section">
      <h4>⚡ 快速操作</h4>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${renderStatusActions(order)}
      </div>
    </div>
  `;
  
  document.getElementById('order-detail-content').innerHTML = content;
  showModal('order-detail-modal');
}

async function runPrecheck(orderId) {
  const result = await fetchAPI(`/orders/${orderId}/precheck`, { method: 'POST' });
  
  if (result.success) {
    showToast(`预检完成，发现 ${result.count} 个问题`, result.count > 0 ? 'warning' : 'success');
    showOrderDetail(orderId);
  } else {
    showToast(result.message || '预检失败', 'error');
  }
}

async function resolveIssue(issueId, orderId) {
  const resolution = prompt('请输入处理说明:', '已处理');
  if (resolution === null) return;
  
  const result = await fetchAPI(`/precheck-issues/${issueId}/resolve`, {
    method: 'PUT',
    body: JSON.stringify({ resolution })
  });
  
  if (result.success) {
    showToast('问题已标记为已处理', 'success');
    showOrderDetail(orderId);
  } else {
    showToast('操作失败', 'error');
  }
}

async function loadPrecheckIssues() {
  const status = document.getElementById('precheck-status-filter').value;
  let url = '/precheck-issues';
  if (status) url += `?status=${status}`;
  
  const result = await fetchAPI(url);
  
  if (result.success) {
    renderPrecheckTable(result.data);
  }
}

function renderPrecheckTable(issues) {
  const container = document.getElementById('precheck-table');
  
  if (issues.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div>暂无预检问题</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>订单号</th>
          <th>客户</th>
          <th>问题类型</th>
          <th>严重程度</th>
          <th>描述</th>
          <th>状态</th>
          <th>创建时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${issues.map(i => `
          <tr>
            <td><strong>${i.order_no}</strong></td>
            <td>${i.customer_name || '-'}</td>
            <td>${i.issue_name}</td>
            <td><span class="badge badge-${i.severity === 'critical' ? 'critical' : 'warning'}">${i.severity === 'critical' ? '严重' : '警告'}</span></td>
            <td>${i.description}</td>
            <td>${i.status === 'resolved' ? '<span class="badge badge-success">已处理</span>' : '<span class="badge badge-warning">待处理</span>'}</td>
            <td>${formatDateTime(i.created_at)}</td>
            <td>
              <div class="action-buttons">
                <button class="btn btn-sm" onclick="showOrderDetail(${i.order_id})">订单详情</button>
                ${i.status !== 'resolved' ? 
                  `<button class="btn btn-sm btn-success" onclick="quickResolveIssue(${i.id})">处理</button>` : ''
                }
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function quickResolveIssue(issueId) {
  const resolution = prompt('请输入处理说明:', '已处理');
  if (resolution === null) return;
  
  const result = await fetchAPI(`/precheck-issues/${issueId}/resolve`, {
    method: 'PUT',
    body: JSON.stringify({ resolution })
  });
  
  if (result.success) {
    showToast('问题已处理', 'success');
    loadPrecheckIssues();
    loadDashboard();
  } else {
    showToast('操作失败', 'error');
  }
}

async function loadSchedule() {
  const date = document.getElementById('schedule-date').value;
  let url = '/schedule';
  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    url += `?date_from=${start.toISOString()}&date_to=${end.toISOString()}`;
  }
  
  const [scheduleResult, machinesResult] = await Promise.all([
    fetchAPI(url),
    fetchAPI('/machines')
  ]);
  
  const machines = machinesResult.success ? machinesResult.data : [];
  const schedules = scheduleResult.success ? scheduleResult.data : [];
  
  const container = document.getElementById('schedule-view');
  
  if (machines.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🖨️</div>
        <div>暂无设备配置</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = machines.map(m => {
    const machineSchedules = schedules.filter(s => s.machine_id === m.id);
    
    return `
      <div class="schedule-machine-row">
        <div class="schedule-machine-name">${m.name} (${m.type})</div>
        <div class="schedule-bars">
          ${machineSchedules.length > 0 ? machineSchedules.map(s => {
            return `<div class="schedule-bar" title="${s.order_no} - ${s.quantity}份" onclick="showOrderDetail(${s.order_id})" style="left:10%;width:80%">${s.order_no}</div>`;
          }).join('') : '<div style="padding:8px;color:#94a3b8;text-align:center">暂无排产</div>'}
        </div>
      </div>
    `;
  }).join('');
}

async function loadStock() {
  const result = await fetchAPI('/paper-stock');
  
  if (result.success) {
    renderStockTable(result.data);
  }
}

function renderStockTable(papers) {
  const container = document.getElementById('stock-table');
  
  if (papers.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <div>暂无纸张库存</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>纸张名称</th>
          <th>类型</th>
          <th>规格</th>
          <th>克重</th>
          <th>颜色</th>
          <th>单价</th>
          <th>总库存</th>
          <th>已锁定</th>
          <th>可用</th>
          <th>安全库存</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        ${papers.map(p => `
          <tr>
            <td><strong>${p.name}</strong></td>
            <td>${p.type || '-'}</td>
            <td>${p.size || '-'}</td>
            <td>${p.weight || '-'}g</td>
            <td>${p.color || '-'}</td>
            <td>¥${p.unit_price}</td>
            <td>${p.stock_qty}</td>
            <td>${p.locked || 0}</td>
            <td><strong>${p.available}</strong></td>
            <td>${p.min_stock}</td>
            <td>${p.needs_restock ? '<span class="badge badge-danger">缺货</span>' : '<span class="badge badge-success">充足</span>'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function loadCustomers() {
  const result = await fetchAPI('/customers');
  
  if (result.success) {
    renderCustomersTable(result.data);
  }
}

function renderCustomersTable(customers) {
  const container = document.getElementById('customers-table');
  
  if (customers.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <div>暂无客户</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>姓名</th>
          <th>电话</th>
          <th>微信</th>
          <th>地址</th>
          <th>备注</th>
          <th>创建时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${customers.map(c => `
          <tr>
            <td><strong>${c.name}</strong></td>
            <td>${c.phone || '-'}</td>
            <td>${c.wechat || '-'}</td>
            <td>${c.address || '-'}</td>
            <td>${c.notes || '-'}</td>
            <td>${formatDateTime(c.created_at)}</td>
            <td>
              <div class="action-buttons">
                <button class="btn btn-sm" onclick="editCustomer(${c.id})">编辑</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function showCustomerModal(customerId = null) {
  document.getElementById('customer-form').reset();
  document.getElementById('customer-id').value = '';
  document.getElementById('customer-modal-title').textContent = '新增客户';
  
  if (customerId) {
    const result = await fetchAPI(`/customers/${customerId}`);
    if (result.success) {
      const c = result.data;
      document.getElementById('customer-id').value = c.id;
      document.getElementById('customer-name').value = c.name || '';
      document.getElementById('customer-phone').value = c.phone || '';
      document.getElementById('customer-wechat').value = c.wechat || '';
      document.getElementById('customer-address').value = c.address || '';
      document.getElementById('customer-notes').value = c.notes || '';
      document.getElementById('customer-modal-title').textContent = '编辑客户';
    }
  }
  
  showModal('customer-modal');
}

function editCustomer(customerId) {
  showCustomerModal(customerId);
}

async function submitCustomer() {
  const id = document.getElementById('customer-id').value;
  const data = {
    name: document.getElementById('customer-name').value,
    phone: document.getElementById('customer-phone').value || null,
    wechat: document.getElementById('customer-wechat').value || null,
    address: document.getElementById('customer-address').value || null,
    notes: document.getElementById('customer-notes').value || null
  };
  
  if (!data.name) {
    showToast('请输入客户姓名', 'error');
    return;
  }
  
  let result;
  if (id) {
    result = await fetchAPI(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  } else {
    result = await fetchAPI('/customers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  if (result.success) {
    showToast(id ? '客户已更新' : '客户已添加', 'success');
    closeModal('customer-modal');
    loadCustomers();
    loadFormData();
  } else {
    showToast(result.message || '操作失败', 'error');
  }
}

function showNewOrderModal() {
  document.getElementById('new-order-form').reset();
  document.getElementById('order-preview').style.display = 'none';
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(17, 0, 0, 0);
  document.getElementById('order-pickup').value = formatDateTimeLocal(tomorrow);
  
  showModal('new-order-modal');
}

async function submitNewOrder() {
  const processSelect = document.getElementById('order-processes');
  const processIds = Array.from(processSelect.selectedOptions).map(o => parseInt(o.value));
  
  const data = {
    customer_id: document.getElementById('order-customer').value ? parseInt(document.getElementById('order-customer').value) : null,
    spec_template_id: document.getElementById('order-spec-template').value ? parseInt(document.getElementById('order-spec-template').value) : null,
    product_type: document.getElementById('order-product-type').value,
    width: parseFloat(document.getElementById('order-width').value),
    height: parseFloat(document.getElementById('order-height').value),
    quantity: parseInt(document.getElementById('order-quantity').value),
    paper_id: document.getElementById('order-paper').value ? parseInt(document.getElementById('order-paper').value) : null,
    process_ids: processIds.length > 0 ? processIds : null,
    pickup_time: document.getElementById('order-pickup').value,
    notes: document.getElementById('order-notes').value || null
  };
  
  if (!data.width || !data.height || !data.quantity) {
    showToast('请填写完整的规格和数量', 'error');
    return;
  }
  
  if (!data.pickup_time) {
    showToast('请选择取件时间', 'error');
    return;
  }
  
  const result = await fetchAPI('/orders', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  
  if (result.success) {
    showToast('订单创建成功', 'success');
    closeModal('new-order-modal');
    loadOrders();
    loadDashboard();
  } else {
    showToast(result.message || '创建订单失败', 'error');
  }
}

async function submitStockAdjust() {
  const paperId = document.getElementById('adjust-paper').value;
  const quantity = parseFloat(document.getElementById('adjust-quantity').value);
  const reason = document.getElementById('adjust-reason').value;
  
  if (!paperId) {
    showToast('请选择纸张', 'error');
    return;
  }
  
  if (isNaN(quantity)) {
    showToast('请输入有效的数量', 'error');
    return;
  }
  
  const result = await fetchAPI(`/paper-stock/${paperId}/adjust`, {
    method: 'PUT',
    body: JSON.stringify({ quantity, reason })
  });
  
  if (result.success) {
    showToast('库存已调整', 'success');
    closeModal('stock-adjust-modal');
    loadStock();
    loadDashboard();
    loadFormData();
  } else {
    showToast(result.message || '调整失败', 'error');
  }
}

function downloadExport(type, format) {
  window.open(`${API_BASE}/api/export/${type}?format=${format}`, '_blank');
}

function showModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

function showStockAdjustModal() {
  document.getElementById('stock-adjust-form').reset();
  showModal('stock-adjust-modal');
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTimeLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatFileSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

let toastTimeout;
function showToast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    padding: 12px 24px;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    z-index: 2000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease;
    ${type === 'success' ? 'background: #22c55e;' : ''}
    ${type === 'error' ? 'background: #ef4444;' : ''}
    ${type === 'warning' ? 'background: #f59e0b;' : ''}
    ${type === 'info' ? 'background: #3b82f6;' : ''}
  `;
  
  document.body.appendChild(toast);
  
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`;
document.head.appendChild(style);
