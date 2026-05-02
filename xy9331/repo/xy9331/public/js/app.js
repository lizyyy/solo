const API_BASE = '/api';

let currentUser = null;
let currentWeekOffset = 0;

async function apiRequest(url, options = {}) {
  const token = localStorage.getItem('token');
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options
  };
  
  if (token) {
    defaultOptions.headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(API_BASE + url, defaultOptions);
    const data = await response.json();
    
    if (!response.ok) {
      if (response.status === 401 && url !== '/auth/login') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        showLoginPage();
        throw new Error('请重新登录');
      }
      throw new Error(data.error || '请求失败');
    }
    
    return data;
  } catch (error) {
    console.error('API请求错误:', error);
    throw error;
  }
}

async function login(username, password) {
  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    currentUser = data.user;
    
    return data;
  } catch (error) {
    throw error;
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  currentUser = null;
  showLoginPage();
}

function checkAuth() {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  if (token && userStr) {
    currentUser = JSON.parse(userStr);
    return true;
  }
  
  return false;
}

function showMessage(message, type = 'info') {
  const messageDiv = document.createElement('div');
  messageDiv.className = `alert alert-${type}`;
  messageDiv.textContent = message;
  
  const container = document.querySelector('.container') || document.body;
  container.insertBefore(messageDiv, container.firstChild);
  
  setTimeout(() => {
    messageDiv.remove();
  }, 5000);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${dateStr} ${weekDays[date.getDay()]}`;
}

function getStatusBadgeClass(status) {
  const classMap = {
    'pending_confirm': 'badge-warning',
    'pending_approval': 'badge-info',
    'completed': 'badge-success',
    'rejected': 'badge-danger',
    'expired': 'badge-secondary'
  };
  return classMap[status] || 'badge-secondary';
}

function getWeekDates(offset = 0) {
  const dates = [];
  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + (parseInt(offset) * 7));
  
  const day = targetDate.getDay();
  const monday = new Date(targetDate);
  monday.setDate(targetDate.getDate() - day + (day === 0 ? -6 : 1));
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

function showLoginPage() {
  const appDiv = document.getElementById('app');
  appDiv.innerHTML = `
    <div class="login-container">
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">小餐馆排班换班系统</h2>
        </div>
        <div class="card-body">
          <form id="loginForm">
            <div class="form-group">
              <label for="username">用户名</label>
              <input type="text" class="form-control" id="username" required>
            </div>
            <div class="form-group">
              <label for="password">密码</label>
              <input type="password" class="form-control" id="password" required>
            </div>
            <button type="submit" class="btn btn-primary btn-block">登录</button>
          </form>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
      await login(username, password);
      showMainApp();
    } catch (error) {
      showMessage(error.message, 'error');
    }
  });
}

function showMainApp() {
  const appDiv = document.getElementById('app');
  const isAdmin = currentUser.role === 'admin';
  
  appDiv.innerHTML = `
    <nav class="navbar">
      <div class="navbar-brand">
        <h2>小餐馆排班换班系统</h2>
      </div>
      <div class="navbar-menu">
        <span class="user-info">欢迎，${currentUser.name} (${isAdmin ? '店长' : '员工'})</span>
        <button class="btn btn-outline" id="logoutBtn">退出登录</button>
      </div>
    </nav>
    
    <div class="tabs">
      <button class="tab-btn active" data-tab="schedule">排班表</button>
      <button class="tab-btn" data-tab="swap-requests">换班请求</button>
      ${isAdmin ? `
        <button class="tab-btn" data-tab="admin">店长管理</button>
        <button class="tab-btn" data-tab="reports">工时报表</button>
      ` : ''}
    </div>
    
    <div class="tab-content" id="tab-content">
      <div id="schedule-tab" class="tab-panel active">
        <div class="card">
          <div class="card-header">
            <div class="header-actions">
              <button class="btn btn-sm" id="prevWeek">上一周</button>
              <h3 class="card-title" id="weekTitle">本周排班</h3>
              <button class="btn btn-sm" id="nextWeek">下一周</button>
              ${isAdmin ? `
                <button class="btn btn-primary btn-sm ml-2" id="addShiftBtn">新建班次</button>
              ` : ''}
            </div>
          </div>
          <div class="card-body">
            <div id="scheduleTable"></div>
          </div>
        </div>
      </div>
      
      <div id="swap-requests-tab" class="tab-panel">
        <div class="card">
          <div class="card-header">
            <div class="header-actions">
              <h3 class="card-title">我的换班请求</h3>
              <button class="btn btn-primary btn-sm" id="newSwapRequestBtn">发起换班</button>
            </div>
          </div>
          <div class="card-body">
            <div id="swapRequestsList"></div>
          </div>
        </div>
        
        <div class="card mt-3">
          <div class="card-header">
            <h3 class="card-title">开放换班接单</h3>
          </div>
          <div class="card-body">
            <div id="openSwapRequests"></div>
          </div>
        </div>
      </div>
      
      ${isAdmin ? `
        <div id="admin-tab" class="tab-panel">
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">待批准换班</h3>
            </div>
            <div class="card-body">
              <div id="pendingApprovals"></div>
            </div>
          </div>
          
          <div class="card mt-3">
            <div class="card-header">
              <h3 class="card-title">换班历史记录</h3>
            </div>
            <div class="card-body">
              <div id="swapHistory"></div>
            </div>
          </div>
        </div>
        
        <div id="reports-tab" class="tab-panel">
          <div class="card">
            <div class="card-header">
              <div class="header-actions">
                <h3 class="card-title">工时报表</h3>
                <div class="date-selector">
                  <select class="form-control" id="reportYear">
                    ${generateYearOptions()}
                  </select>
                  <select class="form-control" id="reportMonth">
                    ${generateMonthOptions()}
                  </select>
                  <button class="btn btn-primary btn-sm" id="loadReportBtn">查询</button>
                  <button class="btn btn-success btn-sm" id="exportReportBtn">导出CSV</button>
                </div>
              </div>
            </div>
            <div class="card-body">
              <div id="reportTable"></div>
            </div>
          </div>
        </div>
      ` : ''}
    </div>
    
    <div id="modalContainer"></div>
  `;
  
  document.getElementById('logoutBtn').addEventListener('click', logout);
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = e.target.dataset.tab;
      switchTab(tab);
    });
  });
  
  document.getElementById('prevWeek').addEventListener('click', () => {
    currentWeekOffset--;
    loadSchedule();
  });
  
  document.getElementById('nextWeek').addEventListener('click', () => {
    currentWeekOffset++;
    loadSchedule();
  });
  
  document.getElementById('newSwapRequestBtn').addEventListener('click', showNewSwapRequestModal);
  
  if (isAdmin) {
    document.getElementById('addShiftBtn').addEventListener('click', showAddShiftModal);
    document.getElementById('loadReportBtn').addEventListener('click', loadReport);
    document.getElementById('exportReportBtn').addEventListener('click', exportReport);
  }
  
  loadSchedule();
  loadSwapRequests();
  
  if (isAdmin) {
    loadPendingApprovals();
    loadSwapHistory();
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `${tabName}-tab`);
  });
}

async function loadSchedule() {
  try {
    const data = await apiRequest(`/shifts/week?weekOffset=${currentWeekOffset}`);
    renderScheduleTable(data);
  } catch (error) {
    showMessage('加载排班表失败: ' + error.message, 'error');
  }
}

function renderScheduleTable(data) {
  const { shifts, weekDates } = data;
  const weekTitle = document.getElementById('weekTitle');
  
  if (currentWeekOffset === 0) {
    weekTitle.textContent = '本周排班';
  } else if (currentWeekOffset < 0) {
    weekTitle.textContent = `前${Math.abs(currentWeekOffset)}周排班`;
  } else {
    weekTitle.textContent = `后${currentWeekOffset}周排班`;
  }
  
  const isAdmin = currentUser.role === 'admin';
  
  let tableHtml = `
    <table class="table">
      <thead>
        <tr>
          <th>日期</th>
          <th>班次类型</th>
          <th>时间</th>
          <th>员工</th>
          ${isAdmin ? '<th>操作</th>' : ''}
        </tr>
      </thead>
      <tbody>
  `;
  
  if (shifts.length === 0) {
    tableHtml += `
      <tr>
        <td colspan="${isAdmin ? 5 : 4}" class="text-center">暂无排班</td>
      </tr>
    `;
  } else {
    const shiftsByDate = {};
    weekDates.forEach(date => {
      shiftsByDate[date] = [];
    });
    
    shifts.forEach(shift => {
      if (shiftsByDate[shift.date]) {
        shiftsByDate[shift.date].push(shift);
      }
    });
    
    weekDates.forEach(date => {
      const dateShifts = shiftsByDate[date];
      const formattedDate = formatDate(date);
      
      if (dateShifts.length === 0) {
        tableHtml += `
          <tr>
            <td>${formattedDate}</td>
            <td colspan="${isAdmin ? 4 : 3}" class="text-center text-muted">无排班</td>
          </tr>
        `;
      } else {
        dateShifts.forEach((shift, index) => {
          const isMyShift = shift.user_id === currentUser.id;
          tableHtml += `
            <tr class="${isMyShift ? 'my-shift' : ''}">
              <td>${index === 0 ? formattedDate : ''}</td>
              <td><span class="shift-type">${shift.shift_type}</span></td>
              <td>${shift.start_time} - ${shift.end_time}</td>
              <td>${shift.user_name}</td>
              ${isAdmin ? `
                <td>
                  <button class="btn btn-sm" onclick="editShift(${shift.id})">编辑</button>
                  <button class="btn btn-sm btn-danger" onclick="deleteShift(${shift.id})">删除</button>
                </td>
              ` : ''}
            </tr>
          `;
        });
      }
    });
  }
  
  tableHtml += `
      </tbody>
    </table>
  `;
  
  document.getElementById('scheduleTable').innerHTML = tableHtml;
}

async function loadSwapRequests() {
  try {
    const data = await apiRequest('/swap-requests/my');
    renderSwapRequests(data.requests);
    
    const openData = await apiRequest('/swap-requests?status=pending_confirm');
    const openRequests = openData.requests.filter(r => 
      r.open_to_all === 1 && r.requester_id !== currentUser.id
    );
    renderOpenSwapRequests(openRequests);
  } catch (error) {
    console.error('加载换班请求失败:', error);
  }
}

function renderSwapRequests(requests) {
  const listDiv = document.getElementById('swapRequestsList');
  
  if (requests.length === 0) {
    listDiv.innerHTML = '<p class="text-muted">暂无换班请求</p>';
    return;
  }
  
  let html = '';
  requests.forEach(req => {
    const isRequester = req.requester_id === currentUser.id;
    const isResponder = req.responder_id === currentUser.id;
    
    html += `
      <div class="swap-request-card">
        <div class="swap-request-header">
          <span class="badge ${getStatusBadgeClass(req.status)}">${req.status_text}</span>
          <span class="swap-type">
            ${req.open_to_all === 1 ? '开放换班' : '指定换班'}
            ${isRequester ? '(我发起的)' : ''}
            ${isResponder ? '(指定我的)' : ''}
          </span>
        </div>
        <div class="swap-request-body">
          <div class="shift-info">
            <strong>我要换出:</strong> ${req.requester_shift_date} ${req.requester_shift_type} (${req.requester_shift_start} - ${req.requester_shift_end})
          </div>
          ${req.responder_shift_date ? `
            <div class="shift-info">
              <strong>我要换入:</strong> ${req.responder_shift_date} ${req.responder_shift_type} (${req.responder_shift_start} - ${req.responder_shift_end})
            </div>
          ` : ''}
          ${req.responder_name ? `
            <div class="user-info">对方: ${req.responder_name}</div>
          ` : ''}
          ${req.notes ? `<div class="notes">备注: ${req.notes}</div>` : ''}
        </div>
        <div class="swap-request-actions">
          ${renderSwapRequestActions(req)}
        </div>
      </div>
    `;
  });
  
  listDiv.innerHTML = html;
}

function renderSwapRequestActions(req) {
  const isRequester = req.requester_id === currentUser.id;
  const isResponder = req.responder_id === currentUser.id;
  const isAdmin = currentUser.role === 'admin';
  
  let actions = '';
  
  if (req.status === 'pending_confirm') {
    if (isRequester) {
      actions += `<button class="btn btn-sm" onclick="cancelSwapRequest(${req.id})">撤销</button>`;
    }
    if (isResponder) {
      actions += `
        <button class="btn btn-sm btn-primary" onclick="confirmSwapRequest(${req.id})">确认</button>
        <button class="btn btn-sm btn-danger" onclick="rejectSwapRequest(${req.id})">拒绝</button>
      `;
    }
  }
  
  if (req.status === 'pending_approval') {
    if (isAdmin) {
      actions += `
        <button class="btn btn-sm btn-primary" onclick="approveSwapRequest(${req.id})">批准</button>
        <button class="btn btn-sm btn-danger" onclick="rejectSwapRequest(${req.id})">拒绝</button>
      `;
    }
  }
  
  return actions || '<span class="text-muted">无操作</span>';
}

function renderOpenSwapRequests(requests) {
  const listDiv = document.getElementById('openSwapRequests');
  
  if (requests.length === 0) {
    listDiv.innerHTML = '<p class="text-muted">暂无开放换班</p>';
    return;
  }
  
  let html = '';
  requests.forEach(req => {
    html += `
      <div class="swap-request-card">
        <div class="swap-request-header">
          <span class="badge badge-warning">待接单</span>
          <span class="user-info">发起人: ${req.requester_name}</span>
        </div>
        <div class="swap-request-body">
          <div class="shift-info">
            <strong>可换出:</strong> ${req.requester_shift_date} ${req.requester_shift_type} (${req.requester_shift_start} - ${req.requester_shift_end})
          </div>
          ${req.notes ? `<div class="notes">备注: ${req.notes}</div>` : ''}
        </div>
        <div class="swap-request-actions">
          <button class="btn btn-sm btn-primary" onclick="acceptOpenSwap(${req.id})">我要接单</button>
        </div>
      </div>
    `;
  });
  
  listDiv.innerHTML = html;
}

async function loadPendingApprovals() {
  try {
    const data = await apiRequest('/swap-requests?status=pending_approval');
    renderPendingApprovals(data.requests);
  } catch (error) {
    console.error('加载待批准换班失败:', error);
  }
}

function renderPendingApprovals(requests) {
  const listDiv = document.getElementById('pendingApprovals');
  
  if (requests.length === 0) {
    listDiv.innerHTML = '<p class="text-muted">暂无待批准的换班</p>';
    return;
  }
  
  let html = '';
  requests.forEach(req => {
    html += `
      <div class="swap-request-card">
        <div class="swap-request-header">
          <span class="badge badge-info">待批准</span>
        </div>
        <div class="swap-request-body">
          <div class="user-info">${req.requester_name} ↔ ${req.responder_name}</div>
          <div class="shift-info">
            <strong>${req.requester_name}:</strong> ${req.requester_shift_date} ${req.requester_shift_type} (${req.requester_shift_start} - ${req.requester_shift_end})
          </div>
          <div class="shift-info">
            <strong>${req.responder_name}:</strong> ${req.responder_shift_date} ${req.responder_shift_type} (${req.responder_shift_start} - ${req.responder_shift_end})
          </div>
          ${req.notes ? `<div class="notes">备注: ${req.notes}</div>` : ''}
        </div>
        <div class="swap-request-actions">
          <button class="btn btn-sm btn-primary" onclick="approveSwapRequest(${req.id})">批准</button>
          <button class="btn btn-sm btn-danger" onclick="rejectSwapRequest(${req.id})">拒绝</button>
        </div>
      </div>
    `;
  });
  
  listDiv.innerHTML = html;
}

async function loadSwapHistory() {
  try {
    const data = await apiRequest('/swap-requests?all=true');
    const history = data.requests.filter(r => 
      r.status === 'completed' || r.status === 'rejected' || r.status === 'expired'
    );
    renderSwapHistory(history);
  } catch (error) {
    console.error('加载换班历史失败:', error);
  }
}

function renderSwapHistory(requests) {
  const listDiv = document.getElementById('swapHistory');
  
  if (requests.length === 0) {
    listDiv.innerHTML = '<p class="text-muted">暂无换班历史</p>';
    return;
  }
  
  let html = `
    <table class="table">
      <thead>
        <tr>
          <th>发起人</th>
          <th>对方</th>
          <th>发起人班次</th>
          <th>对方班次</th>
          <th>状态</th>
          <th>时间</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  requests.forEach(req => {
    html += `
      <tr>
        <td>${req.requester_name}</td>
        <td>${req.responder_name || '-'}</td>
        <td>${req.requester_shift_date} ${req.requester_shift_type}</td>
        <td>${req.responder_shift_date ? req.responder_shift_date + ' ' + req.responder_shift_type : '-'}</td>
        <td><span class="badge ${getStatusBadgeClass(req.status)}">${req.status_text}</span></td>
        <td>${new Date(req.created_at).toLocaleString()}</td>
      </tr>
    `;
  });
  
  html += `
      </tbody>
    </table>
  `;
  
  listDiv.innerHTML = html;
}

function generateYearOptions() {
  const currentYear = new Date().getFullYear();
  let options = '';
  for (let year = currentYear - 2; year <= currentYear + 1; year++) {
    options += `<option value="${year}" ${year === currentYear ? 'selected' : ''}>${year}年</option>`;
  }
  return options;
}

function generateMonthOptions() {
  const currentMonth = new Date().getMonth() + 1;
  let options = '';
  for (let month = 1; month <= 12; month++) {
    options += `<option value="${month}" ${month === currentMonth ? 'selected' : ''}>${month}月</option>`;
  }
  return options;
}

async function loadReport() {
  const year = document.getElementById('reportYear').value;
  const month = document.getElementById('reportMonth').value;
  
  try {
    const data = await apiRequest(`/admin/work-hours?year=${year}&month=${month}`);
    renderReportTable(data);
  } catch (error) {
    showMessage('加载报表失败: ' + error.message, 'error');
  }
}

function renderReportTable(data) {
  const { workHours, year, month } = data;
  const tableDiv = document.getElementById('reportTable');
  
  if (workHours.length === 0) {
    tableDiv.innerHTML = '<p class="text-muted">该月无工时记录</p>';
    return;
  }
  
  let html = `
    <h4>${year}年${month}月工时统计</h4>
    <table class="table">
      <thead>
        <tr>
          <th>员工</th>
          <th>总工时(小时)</th>
          <th>班次详情</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  workHours.forEach(user => {
    html += `
      <tr>
        <td><strong>${user.user_name}</strong></td>
        <td><span class="total-hours">${user.total_hours.toFixed(2)}</span></td>
        <td>
          <div class="shifts-list">
            ${user.shifts.map(shift => `
              <div class="shift-item">
                ${shift.date} ${shift.shift_type} (${shift.start_time} - ${shift.end_time}) = ${shift.hours}小时
              </div>
            `).join('')}
          </div>
        </td>
      </tr>
    `;
  });
  
  html += `
      </tbody>
    </table>
  `;
  
  tableDiv.innerHTML = html;
}

async function exportReport() {
  const year = document.getElementById('reportYear').value;
  const month = document.getElementById('reportMonth').value;
  
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE}/admin/export/work-hours?year=${year}&month=${month}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (response.ok) {
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `工时报表-${year}年${month}月.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } else {
    const data = await response.json();
    showMessage('导出失败: ' + (data.error || '未知错误'), 'error');
  }
}

function showModal(title, content, footer = '') {
  const modalContainer = document.getElementById('modalContainer');
  modalContainer.innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="close-btn" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    </div>
  `;
  
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') {
      closeModal();
    }
  });
}

function closeModal() {
  document.getElementById('modalContainer').innerHTML = '';
}

async function showNewSwapRequestModal() {
  try {
    const myShiftsData = await apiRequest(`/shifts/my?weekOffset=0`);
    const employeesData = await apiRequest('/shifts/employees');
    
    const myShifts = myShiftsData.shifts;
    const employees = employeesData.users.filter(u => u.id !== currentUser.id);
    
    const content = `
      <form id="newSwapForm">
        <div class="form-group">
          <label for="requesterShift">选择您要换出的班次 *</label>
          <select class="form-control" id="requesterShift" required>
            <option value="">请选择</option>
            ${myShifts.map(shift => `
              <option value="${shift.id}">${shift.date} ${shift.shift_type} (${shift.start_time} - ${shift.end_time})</option>
            `).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label>换班方式</label>
          <div class="radio-group">
            <label>
              <input type="radio" name="swapType" value="specific" checked onchange="toggleSwapType()">
              指定员工换班
            </label>
            <label>
              <input type="radio" name="swapType" value="open" onchange="toggleSwapType()">
              开放给所有人接单
            </label>
          </div>
        </div>
        
        <div id="specificSwapFields">
          <div class="form-group">
            <label for="responder">选择要换班的员工 *</label>
            <select class="form-control" id="responder" onchange="loadResponderShifts()">
              <option value="">请选择</option>
              ${employees.map(emp => `
                <option value="${emp.id}">${emp.name}</option>
              `).join('')}
            </select>
          </div>
          
          <div class="form-group">
            <label for="responderShift">选择对方要换出的班次 *</label>
            <select class="form-control" id="responderShift">
              <option value="">请先选择员工</option>
            </select>
          </div>
        </div>
        
        <div class="form-group">
          <label for="notes">备注</label>
          <textarea class="form-control" id="notes" rows="3" placeholder="可选的备注信息"></textarea>
        </div>
      </form>
    `;
    
    const footer = `
      <button class="btn" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="submitNewSwapRequest()">发起换班</button>
    `;
    
    showModal('发起换班请求', content, footer);
  } catch (error) {
    showMessage('加载数据失败: ' + error.message, 'error');
  }
}

function toggleSwapType() {
  const swapType = document.querySelector('input[name="swapType"]:checked').value;
  const specificFields = document.getElementById('specificSwapFields');
  specificFields.style.display = swapType === 'specific' ? 'block' : 'none';
}

async function loadResponderShifts() {
  const responderId = document.getElementById('responder').value;
  const responderShiftSelect = document.getElementById('responderShift');
  
  if (!responderId) {
    responderShiftSelect.innerHTML = '<option value="">请先选择员工</option>';
    return;
  }
  
  try {
    const data = await apiRequest(`/shifts/my?weekOffset=0`, {
      headers: {
        'X-Override-User': responderId
      }
    });
    
    const shifts = data.shifts;
    responderShiftSelect.innerHTML = `
      <option value="">请选择班次</option>
      ${shifts.map(shift => `
        <option value="${shift.id}">${shift.date} ${shift.shift_type} (${shift.start_time} - ${shift.end_time})</option>
      `).join('')}
    `;
  } catch (error) {
    showMessage('加载对方班次失败: ' + error.message, 'error');
  }
}

async function submitNewSwapRequest() {
  const requesterShiftId = document.getElementById('requesterShift').value;
  const swapType = document.querySelector('input[name="swapType"]:checked').value;
  const notes = document.getElementById('notes').value;
  
  const requestData = {
    requester_shift_id: parseInt(requesterShiftId),
    notes: notes
  };
  
  if (swapType === 'specific') {
    const responderId = document.getElementById('responder').value;
    const responderShiftId = document.getElementById('responderShift').value;
    
    if (!responderId || !responderShiftId) {
      showMessage('请选择要换班的员工和班次', 'error');
      return;
    }
    
    requestData.responder_id = parseInt(responderId);
    requestData.responder_shift_id = parseInt(responderShiftId);
    requestData.open_to_all = false;
  } else {
    requestData.open_to_all = true;
  }
  
  try {
    await apiRequest('/swap-requests', {
      method: 'POST',
      body: JSON.stringify(requestData)
    });
    
    closeModal();
    showMessage('换班请求已发送', 'success');
    loadSwapRequests();
  } catch (error) {
    showMessage('发起换班失败: ' + error.message, 'error');
  }
}

async function confirmSwapRequest(requestId) {
  try {
    await apiRequest(`/swap-requests/${requestId}/confirm`, {
      method: 'POST'
    });
    
    showMessage('已确认换班，等待店长批准', 'success');
    loadSwapRequests();
    if (currentUser.role === 'admin') {
      loadPendingApprovals();
    }
  } catch (error) {
    showMessage('确认失败: ' + error.message, 'error');
  }
}

async function rejectSwapRequest(requestId) {
  const reason = prompt('请输入拒绝原因（可选）:');
  if (reason === null) return;
  
  try {
    await apiRequest(`/swap-requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
    
    showMessage('已拒绝换班请求', 'success');
    loadSwapRequests();
    if (currentUser.role === 'admin') {
      loadPendingApprovals();
      loadSwapHistory();
    }
  } catch (error) {
    showMessage('操作失败: ' + error.message, 'error');
  }
}

async function cancelSwapRequest(requestId) {
  if (!confirm('确定要撤销这个换班请求吗？')) return;
  
  try {
    await apiRequest(`/swap-requests/${requestId}/cancel`, {
      method: 'POST'
    });
    
    showMessage('换班请求已撤销', 'success');
    loadSwapRequests();
  } catch (error) {
    showMessage('撤销失败: ' + error.message, 'error');
  }
}

async function approveSwapRequest(requestId) {
  if (!confirm('确定要批准这个换班吗？批准后两人的班次将互换。')) return;
  
  try {
    await apiRequest(`/swap-requests/${requestId}/approve`, {
      method: 'POST'
    });
    
    showMessage('换班已批准，班次已互换', 'success');
    loadSchedule();
    loadSwapRequests();
    loadPendingApprovals();
    loadSwapHistory();
  } catch (error) {
    showMessage('批准失败: ' + error.message, 'error');
  }
}

async function acceptOpenSwap(requestId) {
  try {
    const myShiftsData = await apiRequest(`/shifts/my?weekOffset=0`);
    const myShifts = myShiftsData.shifts;
    
    const content = `
      <div class="form-group">
        <label for="acceptResponderShift">请选择您要换出的班次 *</label>
        <select class="form-control" id="acceptResponderShift" required>
          <option value="">请选择</option>
          ${myShifts.map(shift => `
            <option value="${shift.id}">${shift.date} ${shift.shift_type} (${shift.start_time} - ${shift.end_time})</option>
          `).join('')}
        </select>
      </div>
    `;
    
    const footer = `
      <button class="btn" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="submitAcceptOpenSwap(${requestId})">确认接单</button>
    `;
    
    showModal('接单确认', content, footer);
  } catch (error) {
    showMessage('加载数据失败: ' + error.message, 'error');
  }
}

async function submitAcceptOpenSwap(requestId) {
  const responderShiftId = document.getElementById('acceptResponderShift').value;
  
  if (!responderShiftId) {
    showMessage('请选择您要换出的班次', 'error');
    return;
  }
  
  try {
    await apiRequest(`/swap-requests/${requestId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ responder_shift_id: parseInt(responderShiftId) })
    });
    
    closeModal();
    showMessage('已确认接单，等待店长批准', 'success');
    loadSwapRequests();
  } catch (error) {
    showMessage('接单失败: ' + error.message, 'error');
  }
}

async function showAddShiftModal() {
  try {
    const employeesData = await apiRequest('/shifts/employees');
    const employees = employeesData.users.filter(u => u.role === 'employee');
    
    const today = new Date().toISOString().split('T')[0];
    
    const content = `
      <form id="addShiftForm">
        <div class="form-group">
          <label for="shiftUser">选择员工 *</label>
          <select class="form-control" id="shiftUser" required>
            <option value="">请选择</option>
            ${employees.map(emp => `
              <option value="${emp.id}">${emp.name}</option>
            `).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label for="shiftDate">日期 *</label>
          <input type="date" class="form-control" id="shiftDate" value="${today}" required>
        </div>
        
        <div class="form-group">
          <label for="shiftType">班次类型</label>
          <select class="form-control" id="shiftType">
            <option value="早班">早班</option>
            <option value="中班">中班</option>
            <option value="晚班">晚班</option>
            <option value="加班">加班</option>
          </select>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="shiftStartTime">开始时间 *</label>
            <input type="time" class="form-control" id="shiftStartTime" value="08:00" required>
          </div>
          <div class="form-group">
            <label for="shiftEndTime">结束时间 *</label>
            <input type="time" class="form-control" id="shiftEndTime" value="16:00" required>
          </div>
        </div>
        
        <div class="form-group">
          <label for="shiftNotes">备注</label>
          <textarea class="form-control" id="shiftNotes" rows="2"></textarea>
        </div>
      </form>
    `;
    
    const footer = `
      <button class="btn" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="submitAddShift()">保存</button>
    `;
    
    showModal('新建班次', content, footer);
  } catch (error) {
    showMessage('加载数据失败: ' + error.message, 'error');
  }
}

async function submitAddShift() {
  const userId = document.getElementById('shiftUser').value;
  const date = document.getElementById('shiftDate').value;
  const shiftType = document.getElementById('shiftType').value;
  const startTime = document.getElementById('shiftStartTime').value;
  const endTime = document.getElementById('shiftEndTime').value;
  const notes = document.getElementById('shiftNotes').value;
  
  if (!userId || !date || !startTime || !endTime) {
    showMessage('请填写所有必填项', 'error');
    return;
  }
  
  try {
    await apiRequest('/shifts', {
      method: 'POST',
      body: JSON.stringify({
        user_id: parseInt(userId),
        date: date,
        start_time: startTime,
        end_time: endTime,
        shift_type: shiftType,
        notes: notes
      })
    });
    
    closeModal();
    showMessage('班次创建成功', 'success');
    loadSchedule();
  } catch (error) {
    showMessage('创建班次失败: ' + error.message, 'error');
  }
}

async function editShift(shiftId) {
  try {
    const shiftData = await apiRequest(`/shifts/${shiftId}`);
    const shift = shiftData.shift;
    
    const employeesData = await apiRequest('/shifts/employees');
    const employees = employeesData.users.filter(u => u.role === 'employee');
    
    const content = `
      <form id="editShiftForm">
        <div class="form-group">
          <label for="editShiftUser">员工 *</label>
          <select class="form-control" id="editShiftUser" required>
            <option value="">请选择</option>
            ${employees.map(emp => `
              <option value="${emp.id}" ${emp.id === shift.user_id ? 'selected' : ''}>${emp.name}</option>
            `).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label for="editShiftDate">日期 *</label>
          <input type="date" class="form-control" id="editShiftDate" value="${shift.date}" required>
        </div>
        
        <div class="form-group">
          <label for="editShiftType">班次类型</label>
          <select class="form-control" id="editShiftType">
            <option value="早班" ${shift.shift_type === '早班' ? 'selected' : ''}>早班</option>
            <option value="中班" ${shift.shift_type === '中班' ? 'selected' : ''}>中班</option>
            <option value="晚班" ${shift.shift_type === '晚班' ? 'selected' : ''}>晚班</option>
            <option value="加班" ${shift.shift_type === '加班' ? 'selected' : ''}>加班</option>
          </select>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label for="editShiftStartTime">开始时间 *</label>
            <input type="time" class="form-control" id="editShiftStartTime" value="${shift.start_time}" required>
          </div>
          <div class="form-group">
            <label for="editShiftEndTime">结束时间 *</label>
            <input type="time" class="form-control" id="editShiftEndTime" value="${shift.end_time}" required>
          </div>
        </div>
        
        <div class="form-group">
          <label for="editShiftNotes">备注</label>
          <textarea class="form-control" id="editShiftNotes" rows="2">${shift.notes || ''}</textarea>
        </div>
      </form>
    `;
    
    const footer = `
      <button class="btn" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="submitEditShift(${shiftId})">保存</button>
    `;
    
    showModal('编辑班次', content, footer);
  } catch (error) {
    showMessage('加载数据失败: ' + error.message, 'error');
  }
}

async function submitEditShift(shiftId) {
  const userId = document.getElementById('editShiftUser').value;
  const date = document.getElementById('editShiftDate').value;
  const shiftType = document.getElementById('editShiftType').value;
  const startTime = document.getElementById('editShiftStartTime').value;
  const endTime = document.getElementById('editShiftEndTime').value;
  const notes = document.getElementById('editShiftNotes').value;
  
  if (!userId || !date || !startTime || !endTime) {
    showMessage('请填写所有必填项', 'error');
    return;
  }
  
  try {
    await apiRequest(`/shifts/${shiftId}`, {
      method: 'PUT',
      body: JSON.stringify({
        user_id: parseInt(userId),
        date: date,
        start_time: startTime,
        end_time: endTime,
        shift_type: shiftType,
        notes: notes
      })
    });
    
    closeModal();
    showMessage('班次更新成功', 'success');
    loadSchedule();
  } catch (error) {
    showMessage('更新班次失败: ' + error.message, 'error');
  }
}

async function deleteShift(shiftId) {
  if (!confirm('确定要删除这个班次吗？')) return;
  
  try {
    await apiRequest(`/shifts/${shiftId}`, {
      method: 'DELETE'
    });
    
    showMessage('班次删除成功', 'success');
    loadSchedule();
  } catch (error) {
    showMessage('删除失败: ' + error.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (checkAuth()) {
    showMainApp();
  } else {
    showLoginPage();
  }
});
