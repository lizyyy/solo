const API_BASE = 'http://localhost:3000/api';

const ANOMALY_TYPES = {
  'suspicious_behavior': '可疑行为',
  'screen_sharing': '屏幕共享',
  'multiple_faces': '多人出镜',
  'no_face': '无人出镜',
  'look_away': '视线偏离',
  'phone_usage': '使用手机',
  'id_verification': '身份验证异常',
  'other': '其他异常'
};

document.addEventListener('DOMContentLoaded', () => {
  checkConnection();
  loadRecentAnomalies();
  loadPendingCount();
  setupEventListeners();
});

async function checkConnection() {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    
    if (data.status === 'ok') {
      statusDot.className = 'dot connected';
      statusText.textContent = '服务已连接';
      return;
    }
  } catch (e) {
    console.error('Connection check failed:', e);
  }
  
  statusDot.className = 'dot disconnected';
  statusText.textContent = '服务未连接';
}

async function loadPendingCount() {
  try {
    const response = await fetch(`${API_BASE}/anomalies?status=pending`);
    const anomalies = await response.json();
    
    document.getElementById('pendingCount').textContent = anomalies.length;
  } catch (e) {
    console.error('Load pending count failed:', e);
  }
}

async function loadRecentAnomalies() {
  try {
    const response = await fetch(`${API_BASE}/anomalies`);
    const anomalies = await response.json();
    
    const recentList = document.getElementById('recentList');
    const emptyEl = document.getElementById('recentEmpty');
    
    if (anomalies.length === 0) {
      emptyEl.style.display = 'block';
      return;
    }
    
    emptyEl.style.display = 'none';
    
    const recent = anomalies.slice(0, 3);
    
    let html = '';
    recent.forEach(a => {
      const initial = (a.student_name || a.student_id).charAt(0).toUpperCase();
      const type = ANOMALY_TYPES[a.anomaly_type] || a.anomaly_type;
      const statusClass = a.status === 'reviewed' ? 'reviewed' : '';
      
      html += `
        <div class="recent-item">
          <div class="avatar">${initial}</div>
          <div class="info">
            <div class="name">${a.student_name || a.student_id}</div>
            <div class="type">${type}</div>
          </div>
          <span class="status ${statusClass}">${getStatusLabel(a.status)}</span>
        </div>
      `;
    });
    
    recentList.innerHTML += html;
  } catch (e) {
    console.error('Load recent anomalies failed:', e);
  }
}

function getStatusLabel(status) {
  const labels = {
    'pending': '待处理',
    'reviewed': '已复核',
    'confirmed': '已确认',
    'dismissed': '已驳回'
  };
  return labels[status] || status;
}

function setupEventListeners() {
  document.getElementById('openSidebar').addEventListener('click', () => {
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    window.close();
  });

  document.getElementById('quickCapture').addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          alert('截图失败: ' + chrome.runtime.lastError.message);
          return;
        }
        
        chrome.storage.local.set({ pendingScreenshot: dataUrl }, () => {
          chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
          window.close();
        });
      });
    } catch (e) {
      alert('截图失败: ' + e.message);
    }
  });

  document.getElementById('viewPending').addEventListener('click', () => {
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
    window.close();
  });
}
