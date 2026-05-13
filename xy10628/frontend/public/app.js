const API_BASE = 'http://localhost:3001/api';

let allOrders = [];
let allHeartbeats = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboard();
  await loadHeartbeats();
  await loadOrders();
  await loadRestarts();
  await loadTickets();
  await loadPaymentFailures();
  await loadRefunds();
  await loadLogs();
  await loadStats();
  setupForms();
});

async function fetchData(endpoint) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`);
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    return [];
  }
}

async function postData(endpoint, data) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await response.json();
  } catch (error) {
    console.error(`Error posting ${endpoint}:`, error);
    return null;
  }
}

async function putData(endpoint, data) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await response.json();
  } catch (error) {
    console.error(`Error putting ${endpoint}:`, error);
    return null;
  }
}

function getStatusBadge(status) {
  const badges = {
    'online': 'bg-success',
    'offline': 'bg-danger',
    'charging': 'bg-primary',
    'completed': 'bg-success',
    'pending': 'bg-warning',
    'pending_review': 'bg-warning',
    'failed': 'bg-danger',
    'retry_failed': 'bg-danger',
    'paid': 'bg-success',
    'in_progress': 'bg-primary',
    'open': 'bg-info',
    'resolved': 'bg-success',
    'rejected': 'bg-danger',
    'high': 'bg-danger',
    'medium': 'bg-warning',
    'low': 'bg-info'
  };
  return `<span class="badge ${badges[status] || 'bg-secondary'} status-badge">${status}</span>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN');
}

async function loadDashboard() {
  const heartbeats = await fetchData('/heartbeats');
  const orders = await fetchData('/orders');
  const tickets = await fetchData('/tickets');
  const refunds = await fetchData('/refunds');

  document.getElementById('totalDevices').textContent = new Set(heartbeats.map(h => h.device_id)).size;
  document.getElementById('totalOrders').textContent = orders.length;
  document.getElementById('pendingTickets').textContent = tickets.filter(t => 
    ['open', 'in_progress', 'pending_review'].includes(t.status)
  ).length;
  
  const pendingRefundAmount = refunds
    .filter(r => ['pending', 'pending_review'].includes(r.status))
    .reduce((sum, r) => sum + r.amount, 0);
  document.getElementById('pendingRefunds').textContent = `¥${pendingRefundAmount.toFixed(2)}`;
}

async function loadHeartbeats() {
  const data = await fetchData('/heartbeats');
  allHeartbeats = data;
  
  const tbody = document.getElementById('heartbeatsTable');
  tbody.innerHTML = data.map(h => `
    <tr>
      <td>${h.device_id}</td>
      <td>${h.device_name || '-'}</td>
      <td>${getStatusBadge(h.status)}</td>
      <td>${h.voltage || '-'}</td>
      <td>${h.current || '-'}</td>
      <td>${h.temperature || '-'}</td>
      <td>${h.previous_status ? getStatusBadge(h.previous_status) : '-'}</td>
      <td>${formatDate(h.updated_at)}</td>
    </tr>
  `).join('');
}

async function loadOrders() {
  const data = await fetchData('/orders');
  allOrders = data;
  
  const tbody = document.getElementById('ordersTable');
  tbody.innerHTML = data.map(o => `
    <tr>
      <td>${o.order_no}</td>
      <td>${o.device_id}</td>
      <td>${o.user_id}</td>
      <td>${o.charged_kwh?.toFixed(2) || '-'}</td>
      <td>¥${o.amount?.toFixed(2) || '-'}</td>
      <td>${getStatusBadge(o.status)}</td>
      <td>${getStatusBadge(o.payment_status)}</td>
      <td>${o.previous_status ? getStatusBadge(o.previous_status) : '-'}</td>
      <td>${formatDate(o.created_at)}</td>
    </tr>
  `).join('');

  const select = document.getElementById('refundOrder');
  select.innerHTML = '<option value="">选择订单</option>' + 
    data.map(o => `<option value="${o.id}">${o.order_no}</option>`).join('');
}

async function loadRestarts() {
  const data = await fetchData('/restarts');
  
  const tbody = document.getElementById('restartsTable');
  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${r.device_id}</td>
      <td>${r.operator}</td>
      <td>${r.reason}</td>
      <td>${getStatusBadge(r.status)}</td>
      <td>${r.previous_status ? getStatusBadge(r.previous_status) : '-'}</td>
      <td>${formatDate(r.restart_time)}</td>
      <td>${formatDate(r.created_at)}</td>
      <td>
        ${r.status === 'pending' ? 
          `<button class="btn btn-sm btn-success" onclick="updateRestart('${r.id}', 'completed')">完成</button>` : 
          '-'
        }
      </td>
    </tr>
  `).join('');

  const devices = [...new Set(allHeartbeats.map(h => h.device_id))];
  const deviceSelect = document.getElementById('restartDevice');
  deviceSelect.innerHTML = '<option value="">选择设备</option>' + 
    devices.map(d => `<option value="${d}">${d}</option>`).join('');
}

async function updateRestart(id, status) {
  await putData(`/restarts/${id}`, { 
    status, 
    restart_time: new Date().toISOString(),
    operator: '管理员'
  });
  await loadRestarts();
}

async function loadTickets() {
  const data = await fetchData('/tickets');
  
  const tbody = document.getElementById('ticketsTable');
  tbody.innerHTML = data.map(t => `
    <tr>
      <td>${t.ticket_no}</td>
      <td>${t.device_id}</td>
      <td>${t.reporter}</td>
      <td>${t.assignee || '-'}</td>
      <td>${t.issue_type}</td>
      <td>${getStatusBadge(t.priority)}</td>
      <td>${getStatusBadge(t.status)}</td>
      <td>${formatDate(t.created_at)}</td>
      <td>
        ${['open', 'in_progress'].includes(t.status) ? 
          `<button class="btn btn-sm btn-primary" onclick="openTicketReview('${t.id}', '${t.ticket_no}')">处理</button>` : 
          '-'
        }
      </td>
    </tr>
  `).join('');

  const pendingTbody = document.getElementById('pendingReviewTable');
  const pendingTickets = data.filter(t => ['pending_review', 'open', 'in_progress'].includes(t.status));
  pendingTbody.innerHTML = pendingTickets.map(t => `
    <tr>
      <td>${t.ticket_no}</td>
      <td>${t.device_id}</td>
      <td>${t.assignee || '-'}</td>
      <td>${t.issue_type}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="openTicketReview('${t.id}', '${t.ticket_no}')">复核</button>
      </td>
    </tr>
  `).join('');
}

async function loadPaymentFailures() {
  const data = await fetchData('/payment-failures');
  
  const tbody = document.getElementById('paymentFailuresTable');
  tbody.innerHTML = data.map(p => `
    <tr>
      <td>${p.order_id?.substring(0, 8)}...</td>
      <td>${p.failure_code || '-'}</td>
      <td>${p.failure_reason || '-'}</td>
      <td>${p.retry_count || 0}</td>
      <td>${getStatusBadge(p.status)}</td>
      <td>${formatDate(p.created_at)}</td>
      <td>
        ${p.status !== 'completed' ? 
          `<button class="btn btn-sm btn-warning" onclick="retryPayment('${p.id}')">重试</button>` : 
          '-'
        }
      </td>
    </tr>
  `).join('');
}

async function retryPayment(id) {
  await putData(`/payment-failures/${id}/retry`, { status: 'completed', operator: '管理员' });
  await loadPaymentFailures();
}

async function loadRefunds() {
  const data = await fetchData('/refunds');
  
  const tbody = document.getElementById('refundsTable');
  tbody.innerHTML = data.map(r => `
    <tr>
      <td>${r.refund_no}</td>
      <td>${r.order_id?.substring(0, 12)}...</td>
      <td>¥${r.amount?.toFixed(2)}</td>
      <td>${r.reason || '-'}</td>
      <td>${getStatusBadge(r.status)}</td>
      <td>${r.operator || '-'}</td>
      <td>${r.reviewer || '-'}</td>
      <td>${formatDate(r.created_at)}</td>
    </tr>
  `).join('');

  const reviewTbody = document.getElementById('refundReviewTable');
  const pendingRefunds = data.filter(r => ['pending', 'pending_review'].includes(r.status));
  reviewTbody.innerHTML = pendingRefunds.map(r => `
    <tr>
      <td>${r.refund_no}</td>
      <td>¥${r.amount?.toFixed(2)}</td>
      <td>${r.reason || '-'}</td>
      <td>${r.operator || '-'}</td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="openRefundReview('${r.id}', '${r.refund_no}')">复核</button>
      </td>
    </tr>
  `).join('');
}

function openTicketReview(id, no) {
  document.getElementById('reviewId').value = id;
  document.getElementById('reviewType').value = 'ticket';
  new bootstrap.Modal(document.getElementById('reviewModal')).show();
}

function openRefundReview(id, no) {
  document.getElementById('reviewId').value = id;
  document.getElementById('reviewType').value = 'refund';
  new bootstrap.Modal(document.getElementById('reviewModal')).show();
}

async function submitReview() {
  const id = document.getElementById('reviewId').value;
  const type = document.getElementById('reviewType').value;
  const status = document.getElementById('reviewStatus').value;
  const reviewer = document.getElementById('reviewer').value;

  if (type === 'ticket') {
    await putData(`/tickets/${id}`, { status, operator: reviewer });
    await loadTickets();
  } else {
    await putData(`/refunds/${id}/review`, { status, reviewer, operator: reviewer });
    await loadRefunds();
  }

  bootstrap.Modal.getInstance(document.getElementById('reviewModal')).hide();
  await loadDashboard();
}

async function loadLogs(module = '', operator = '') {
  let url = '/logs';
  const params = [];
  if (module) params.push(`module=${module}`);
  if (operator) params.push(`operator=${operator}`);
  if (params.length) url += '?' + params.join('&');

  const data = await fetchData(url);
  
  const tbody = document.getElementById('logsTable');
  tbody.innerHTML = data.map(l => `
    <tr>
      <td>${l.operator}</td>
      <td><span class="badge bg-info">${l.action}</span></td>
      <td>${l.module}</td>
      <td>${l.record_id?.substring(0, 12) || '-'}</td>
      <td><small class="text-muted">${l.details || '-'}</small></td>
      <td>${formatDate(l.created_at)}</td>
    </tr>
  `).join('');
}

async function loadStats() {
  const data = await fetchData('/reports/statistics');
  
  const container = document.getElementById('statsContainer');
  
  let html = '';
  
  if (data.tickets) {
    html += '<div class="col-md-6"><h6>工单状态统计</h6><table class="table table-sm">';
    data.tickets.forEach(t => {
      html += `<tr><td>${t.status}</td><td>${t.count}条</td><td>${t.assignee || '-'}</td></tr>`;
    });
    html += '</table></div>';
  }
  
  if (data.refunds) {
    html += '<div class="col-md-6"><h6>退款状态统计</h6><table class="table table-sm">';
    data.refunds.forEach(r => {
      html += `<tr><td>${r.status}</td><td>${r.count}条</td><td>¥${r.total_amount?.toFixed(2) || '0.00'}</td></tr>`;
    });
    html += '</table></div>';
  }
  
  container.innerHTML = html;
}

function setupForms() {
  document.getElementById('restartForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await postData('/restarts', {
      device_id: document.getElementById('restartDevice').value,
      operator: document.getElementById('restartOperator').value,
      reason: document.getElementById('restartReason').value,
      status: 'pending'
    });
    await loadRestarts();
    e.target.reset();
    document.getElementById('restartOperator').value = '张三';
  });

  document.getElementById('refundForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await postData('/refunds', {
      refund_no: document.getElementById('refundNo').value,
      order_id: document.getElementById('refundOrder').value,
      amount: parseFloat(document.getElementById('refundAmount').value),
      reason: '测试退款',
      status: 'pending_review',
      operator: document.getElementById('refundOperator').value,
      idempotency_key: document.getElementById('refundKey').value
    });
    await loadRefunds();
    await loadDashboard();
    alert('退款申请已提交（使用相同幂等键重复提交不会创建新记录）');
  });

  document.getElementById('logsFilter').addEventListener('submit', async (e) => {
    e.preventDefault();
    await loadLogs(
      document.getElementById('logModule').value,
      document.getElementById('logOperator').value
    );
  });

  document.getElementById('reportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const params = [];
    const assignee = document.getElementById('reportAssignee').value;
    const start = document.getElementById('reportStartDate').value;
    const end = document.getElementById('reportEndDate').value;
    
    if (assignee) params.push(`assignee=${assignee}`);
    if (start) params.push(`start_date=${start}`);
    if (end) params.push(`end_date=${end}`);
    
    const url = `${API_BASE}/reports/export${params.length ? '?' + params.join('&') : ''}`;
    window.open(url, '_blank');
  });

  const ticketsTab = document.querySelector('button[data-bs-target="#tickets"]');
  if (ticketsTab) {
    ticketsTab.addEventListener('click', () => loadTickets());
  }
}
