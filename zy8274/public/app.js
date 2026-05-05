const API_BASE = '/api';

let currentTickets = [];
let currentFilterMode = 'hq-timezone';
let currentRangeType = 'month';
let currentCustomStart = null;
let currentCustomEnd = null;
let currentTab = 'in-range';

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  setDefaultDates();
  fetchTickets();
});

function initEventListeners() {
  document.querySelectorAll('input[name="filterMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentFilterMode = e.target.value;
    });
  });

  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const range = e.target.dataset.range;
      selectRange(range);
    });
  });

  document.getElementById('searchBtn').addEventListener('click', fetchTickets);

  document.getElementById('exportBtn').addEventListener('click', exportReport);

  document.getElementById('resetDataBtn').addEventListener('click', resetData);

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = e.target.dataset.tab;
      selectTab(tab);
    });
  });
}

function setDefaultDates() {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  document.getElementById('customStart').value = formatDateForInput(startOfMonth);
  document.getElementById('customEnd').value = formatDateForInput(endOfMonth);
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function selectRange(range) {
  currentRangeType = range;

  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.range === range) {
      btn.classList.add('active');
    }
  });

  const customFields = document.getElementById('customRangeFields');
  customFields.style.display = range === 'custom' ? 'flex' : 'none';
}

function selectTab(tab) {
  currentTab = tab;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.tab === tab) {
      btn.classList.add('active');
    }
  });

  renderTickets();
}

async function fetchTickets() {
  const filterMode = document.querySelector('input[name="filterMode"]:checked').value;
  const customStart = document.getElementById('customStart').value;
  const customEnd = document.getElementById('customEnd').value;

  currentFilterMode = filterMode;
  currentCustomStart = customStart;
  currentCustomEnd = customEnd;

  const params = new URLSearchParams({
    filter_mode: filterMode,
    range_type: currentRangeType
  });

  if (currentRangeType === 'custom' && customStart && customEnd) {
    params.append('custom_start', customStart);
    params.append('custom_end', customEnd);
  }

  try {
    showLoading();
    const response = await fetch(`${API_BASE}/tickets?${params}`);
    const data = await response.json();

    if (data.success) {
      currentTickets = data.data.tickets;
      renderSummary(data.data.summary);
      renderTickets();
    } else {
      showError(data.error);
    }
  } catch (error) {
    showError('网络请求失败: ' + error.message);
  } finally {
    hideLoading();
  }
}

function renderSummary(summary) {
  const summarySection = document.getElementById('summarySection');
  summarySection.style.display = 'block';

  document.getElementById('totalCount').textContent = summary.total;
  document.getElementById('inRangeCount').textContent = summary.inRange;
  document.getElementById('outRangeCount').textContent = summary.outOfRange;

  const rangeInfo = summary.rangeInfo || {};
  const rangeInfoEl = document.getElementById('rangeInfo');
  if (rangeInfo.rangeStart && rangeInfo.rangeEnd) {
    rangeInfoEl.textContent = `筛选范围: ${rangeInfo.rangeStart} ~ ${rangeInfo.rangeEnd} (${rangeInfo.timezone || 'N/A'})`;
  } else {
    rangeInfoEl.textContent = '';
  }

  const detailsEl = document.getElementById('summaryDetails');
  let detailsHtml = '';

  if (Object.keys(summary.statusBreakdown).length > 0) {
    detailsHtml += `
      <div class="detail-group">
        <h4>按状态统计</h4>
        <ul class="detail-list">
          ${Object.entries(summary.statusBreakdown).map(([status, count]) => 
            `<li><span>${getStatusLabel(status)}</span><span>${count} 条</span></li>`
          ).join('')}
        </ul>
      </div>
    `;
  }

  if (Object.keys(summary.storeBreakdown).length > 0) {
    detailsHtml += `
      <div class="detail-group">
        <h4>按门店统计</h4>
        <ul class="detail-list">
          ${Object.entries(summary.storeBreakdown).map(([store, count]) => 
            `<li><span>${store}</span><span>${count} 条</span></li>`
          ).join('')}
        </ul>
      </div>
    `;
  }

  detailsEl.innerHTML = detailsHtml;
}

function getStatusLabel(status) {
  const labels = {
    'open': '待处理',
    'in_progress': '处理中',
    'resolved': '已解决'
  };
  return labels[status] || status;
}

function renderTickets() {
  const listEl = document.getElementById('ticketList');
  
  let ticketsToShow = [];
  switch (currentTab) {
    case 'in-range':
      ticketsToShow = currentTickets.filter(t => t.isInRange);
      break;
    case 'out-range':
      ticketsToShow = currentTickets.filter(t => !t.isInRange);
      break;
    case 'all':
    default:
      ticketsToShow = [...currentTickets];
  }

  ticketsToShow.sort((a, b) => b.created_utc - a.created_utc);

  if (ticketsToShow.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <h4>暂无工单数据</h4>
        <p>当前筛选条件下没有符合的工单</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = ticketsToShow.map(ticket => `
    <div class="ticket-item ${ticket.isInRange ? 'in-range' : 'out-range'}">
      <div class="ticket-header">
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <span class="ticket-id">${ticket.id}</span>
          <span class="ticket-status status-${ticket.status}">${getStatusLabel(ticket.status)}</span>
        </div>
        ${!ticket.isInRange ? '<span style="color: #e74c3c; font-size: 12px; font-weight: 500;">范围外</span>' : ''}
      </div>
      <div class="ticket-title">${escapeHtml(ticket.title)}</div>
      <div class="ticket-meta">
        <span class="ticket-store">${ticket.store_name}</span>
        <span class="ticket-time">${ticket.displayTime}</span>
        <span>时区: ${ticket.displayTimezone}</span>
      </div>
      ${ticket.description ? `<div class="ticket-desc">${escapeHtml(ticket.description)}</div>` : ''}
    </div>
  `).join('');
}

async function exportReport() {
  try {
    const params = {
      filter_mode: currentFilterMode,
      range_type: currentRangeType
    };

    if (currentRangeType === 'custom' && currentCustomStart && currentCustomEnd) {
      params.custom_start = currentCustomStart;
      params.custom_end = currentCustomEnd;
    }

    const response = await fetch(`${API_BASE}/report/markdown`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'ticket-report.md';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } else {
      const data = await response.json();
      showError(data.error || '导出失败');
    }
  } catch (error) {
    showError('导出失败: ' + error.message);
  }
}

async function resetData() {
  if (!confirm('确定要重置所有数据吗？这将删除现有数据并重新初始化样例数据。')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/reset-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (data.success) {
      alert('数据已重置');
      fetchTickets();
    } else {
      showError(data.error);
    }
  } catch (error) {
    showError('重置数据失败: ' + error.message);
  }
}

function showLoading() {
  const listEl = document.getElementById('ticketList');
  listEl.innerHTML = '<div class="loading">加载中...</div>';
}

function hideLoading() {
}

function showError(message) {
  alert('错误: ' + message);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
