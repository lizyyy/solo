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

const STATUS_LABELS = {
  'pending': '待处理',
  'reviewed': '已复核',
  'confirmed': '已确认违规',
  'dismissed': '已驳回'
};

let currentScreenshot = null;

document.addEventListener('DOMContentLoaded', () => {
  checkConnection();
  initTabs();
  initForm();
  loadExams();
  loadAnomalies();
  loadStats();
  startConnectionCheck();
});

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function formatDateTime(dateStr) {
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

async function checkConnection() {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  
  try {
    const response = await fetch(`${API_BASE}/health`);
    const data = await response.json();
    
    if (data.status === 'ok') {
      statusDot.className = 'status-dot connected';
      statusText.textContent = '已连接';
      return true;
    }
  } catch (e) {
    console.error('Connection check failed:', e);
  }
  
  statusDot.className = 'status-dot disconnected';
  statusText.textContent = '未连接';
  return false;
}

function startConnectionCheck() {
  setInterval(checkConnection, 10000);
}

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(`${tabId}-tab`).classList.add('active');
      
      if (tabId === 'list') {
        loadAnomalies();
      } else if (tabId === 'stats') {
        loadStats();
      }
    });
  });
}

function initForm() {
  const form = document.getElementById('anomalyForm');
  const captureBtn = document.getElementById('captureScreenshot');
  const uploadBtn = document.getElementById('uploadScreenshot');
  const fileInput = document.getElementById('screenshotInput');
  const removeBtn = document.getElementById('removeScreenshot');
  const quickAddBtn = document.getElementById('quickAdd');

  captureBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          showToast('截图失败: ' + chrome.runtime.lastError.message, 'error');
          return;
        }
        setScreenshot(dataUrl);
        showToast('截图成功');
      });
    } catch (e) {
      showToast('截图失败: ' + e.message, 'error');
    }
  });

  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setScreenshot(event.target.result);
        showToast('图片加载成功');
      };
      reader.readAsDataURL(file);
    }
  });

  removeBtn.addEventListener('click', () => {
    currentScreenshot = null;
    document.getElementById('screenshotPreview').style.display = 'none';
    fileInput.value = '';
  });

  quickAddBtn.addEventListener('click', () => {
    submitForm(true);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitForm(false);
  });
}

function setScreenshot(dataUrl) {
  currentScreenshot = dataUrl;
  const preview = document.getElementById('screenshotPreview');
  const img = document.getElementById('previewImg');
  
  img.src = dataUrl;
  preview.style.display = 'flex';
}

async function submitForm(isQuickAdd) {
  const examCode = document.getElementById('examCode').value.trim();
  const studentId = document.getElementById('studentId').value.trim();
  const studentName = document.getElementById('studentName').value.trim();
  const anomalyType = document.querySelector('input[name="anomalyType"]:checked')?.value;
  const description = document.getElementById('description').value.trim();

  if (!examCode || !studentId || !anomalyType) {
    showToast('请填写必填字段', 'error');
    return;
  }

  const timestamp = new Date().toLocaleString('zh-CN');
  const fullDescription = isQuickAdd 
    ? description 
    : `[${timestamp}] ${description}`.trim();

  const formData = new FormData();
  formData.append('exam_code', examCode);
  formData.append('student_id', studentId);
  formData.append('student_name', studentName);
  formData.append('anomaly_type', anomalyType);
  formData.append('description', fullDescription);

  if (currentScreenshot) {
    const blob = await dataURLtoBlob(currentScreenshot);
    formData.append('screenshot', blob, `screenshot-${Date.now()}.png`);
  }

  try {
    const response = await fetch(`${API_BASE}/anomalies`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '提交失败');
    }

    const result = await response.json();
    console.log('Created anomaly:', result);

    document.getElementById('studentId').value = '';
    document.getElementById('description').value = '';
    currentScreenshot = null;
    document.getElementById('screenshotPreview').style.display = 'none';
    document.querySelectorAll('input[name="anomalyType"]').forEach(r => r.checked = false);

    showToast(isQuickAdd ? '快速录入成功' : '记录成功（带时间戳）');
    
    chrome.storage.local.set({ lastExamCode: examCode });
    
    loadAnomalies();
    loadStats();
  } catch (e) {
    console.error('Submit error:', e);
    showToast('提交失败: ' + e.message, 'error');
  }
}

async function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new Blob([u8arr], { type: mime });
}

async function loadExams() {
  try {
    const response = await fetch(`${API_BASE}/exams`);
    const exams = await response.json();
    
    const select = document.getElementById('filterExamCode');
    select.innerHTML = '<option value="">全部考试</option>';
    
    exams.forEach(exam => {
      const option = document.createElement('option');
      option.value = exam.exam_code;
      option.textContent = exam.exam_name || exam.exam_code;
      select.appendChild(option);
    });

    chrome.storage.local.get('lastExamCode', (result) => {
      if (result.lastExamCode) {
        document.getElementById('examCode').value = result.lastExamCode;
      }
    });
  } catch (e) {
    console.error('Load exams error:', e);
  }
}

async function loadAnomalies() {
  const examCode = document.getElementById('filterExamCode').value;
  const status = document.getElementById('filterStatus').value;
  
  let url = `${API_BASE}/anomalies?`;
  if (examCode) url += `exam_code=${encodeURIComponent(examCode)}&`;
  if (status) url += `status=${encodeURIComponent(status)}&`;

  try {
    const response = await fetch(url);
    const anomalies = await response.json();
    
    renderAnomalyList(anomalies);
  } catch (e) {
    console.error('Load anomalies error:', e);
    document.getElementById('anomalyList').innerHTML = `
      <div class="empty-state">
        <p>加载失败，请检查服务连接</p>
      </div>
    `;
  }
}

function renderAnomalyList(anomalies) {
  const container = document.getElementById('anomalyList');
  
  if (anomalies.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>暂无异常记录</p>
      </div>
    `;
    return;
  }

  container.innerHTML = anomalies.map(a => `
    <div class="anomaly-card ${a.status}">
      <div class="card-header">
        <div class="card-title">
          ${a.student_name || a.student_id} (${a.student_id})
        </div>
        <span class="card-status ${a.status}">${STATUS_LABELS[a.status] || a.status}</span>
      </div>
      <div class="card-meta">
        <span>${formatDateTime(a.created_at)}</span>
        <span class="card-type">${ANOMALY_TYPES[a.anomaly_type] || a.anomaly_type}</span>
        <span>考试: ${a.exam_code}</span>
      </div>
      ${a.description ? `<div class="card-description">${escapeHtml(a.description)}</div>` : ''}
      <div class="card-actions">
        <button class="btn-view" onclick="viewDetail(${a.id})">查看详情</button>
        <button class="btn-review" onclick="updateStatus(${a.id}, 'reviewed')">标记已复核</button>
        <button class="btn-delete" onclick="deleteAnomaly(${a.id})">删除</button>
      </div>
    </div>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function viewDetail(id) {
  try {
    const response = await fetch(`${API_BASE}/anomalies/${id}`);
    const anomaly = await response.json();
    
    alert(`
详情信息:
- 学号: ${anomaly.student_id}
- 姓名: ${anomaly.student_name || '无'}
- 考试: ${anomaly.exam_code}
- 异常类型: ${ANOMALY_TYPES[anomaly.anomaly_type] || anomaly.anomaly_type}
- 状态: ${STATUS_LABELS[anomaly.status] || anomaly.status}
- 时间: ${formatDateTime(anomaly.created_at)}
- 描述: ${anomaly.description || '无'}
- 复核人: ${anomaly.reviewed_by || '无'}
- 复核备注: ${anomaly.review_notes || '无'}
    `.trim());
  } catch (e) {
    showToast('获取详情失败', 'error');
  }
}

async function updateStatus(id, status) {
  try {
    const response = await fetch(`${API_BASE}/anomalies/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      throw new Error('更新失败');
    }

    showToast('状态已更新');
    loadAnomalies();
    loadStats();
  } catch (e) {
    showToast('更新失败: ' + e.message, 'error');
  }
}

async function deleteAnomaly(id) {
  if (!confirm('确定要删除这条记录吗？')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/anomalies/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('删除失败');
    }

    showToast('已删除');
    loadAnomalies();
    loadStats();
  } catch (e) {
    showToast('删除失败: ' + e.message, 'error');
  }
}

async function loadStats() {
  try {
    const response = await fetch(`${API_BASE}/stats`);
    const stats = await response.json();
    
    renderStats(stats);
  } catch (e) {
    console.error('Load stats error:', e);
  }
}

function renderStats(stats) {
  const container = document.getElementById('statsContainer');
  
  if (stats.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>暂无统计数据</p>
      </div>
    `;
    return;
  }

  const total = stats.reduce((sum, s) => sum + s.count, 0);
  const pending = stats.filter(s => s.status === 'pending').reduce((sum, s) => sum + s.count, 0);
  const reviewed = stats.filter(s => s.status === 'reviewed').reduce((sum, s) => sum + s.count, 0);
  
  const typeStats = {};
  stats.forEach(s => {
    const type = ANOMALY_TYPES[s.anomaly_type] || s.anomaly_type;
    typeStats[type] = (typeStats[type] || 0) + s.count;
  });

  container.innerHTML = `
    <div class="stat-card">
      <div class="stat-value">${total}</div>
      <div class="stat-label">总异常数</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${pending}</div>
      <div class="stat-label">待处理</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${reviewed}</div>
      <div class="stat-label">已复核</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${Object.keys(typeStats).length}</div>
      <div class="stat-label">异常类型数</div>
    </div>
    
    <div class="type-stats">
      <h3 style="margin-bottom: 12px; font-size: 14px; color: #555;">异常类型分布</h3>
      ${Object.entries(typeStats).sort((a, b) => b[1] - a[1]).map(([type, count]) => `
        <div class="type-stat-item">
          <span class="type-stat-name">${type}</span>
          <span class="type-stat-count">${count} 次</span>
        </div>
      `).join('')}
    </div>
  `;
}

document.getElementById('refreshList').addEventListener('click', loadAnomalies);
document.getElementById('filterExamCode').addEventListener('change', loadAnomalies);
document.getElementById('filterStatus').addEventListener('change', loadAnomalies);

document.getElementById('exportMarkdown').addEventListener('click', () => {
  const examCode = document.getElementById('filterExamCode').value;
  const status = document.getElementById('filterStatus').value;
  
  let url = `${API_BASE}/export/markdown?`;
  if (examCode) url += `exam_code=${encodeURIComponent(examCode)}&`;
  if (status) url += `status=${encodeURIComponent(status)}&`;
  
  window.open(url, '_blank');
});

document.getElementById('exportCSV').addEventListener('click', () => {
  const examCode = document.getElementById('filterExamCode').value;
  const status = document.getElementById('filterStatus').value;
  
  let url = `${API_BASE}/export/csv?`;
  if (examCode) url += `exam_code=${encodeURIComponent(exam_code)}&`;
  if (status) url += `status=${encodeURIComponent(status)}&`;
  
  window.open(url, '_blank');
});
