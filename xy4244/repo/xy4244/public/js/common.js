const API_BASE = '/api';

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  const config = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  };
  
  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }
  
  try {
    const response = await fetch(url, config);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API请求失败:', error);
    return { success: false, error: error.message };
  }
}

function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;
  alertDiv.style.position = 'fixed';
  alertDiv.style.top = '20px';
  alertDiv.style.right = '20px';
  alertDiv.style.zIndex = '9999';
  alertDiv.style.maxWidth = '400px';
  
  document.body.appendChild(alertDiv);
  
  setTimeout(() => {
    alertDiv.style.transition = 'opacity 0.3s';
    alertDiv.style.opacity = '0';
    setTimeout(() => alertDiv.remove(), 300);
  }, 3000);
}

function showModal(content, title = '提示') {
  let modal = document.getElementById('globalModal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'globalModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3 id="modalTitle">${title}</h3>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
        <div id="modalBody"></div>
      </div>
    `;
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }
  
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = content;
  modal.classList.add('show');
}

function closeModal() {
  const modal = document.getElementById('globalModal');
  if (modal) {
    modal.classList.remove('show');
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getStatusBadgeClass(status) {
  const classes = {
    'active': 'badge-active',
    'checked_in': 'badge-checked_in',
    'revoked': 'badge-revoked',
    'expired': 'badge-expired',
    'registered': 'badge-active'
  };
  return classes[status] || 'badge-active';
}

function getStatusLabel(status) {
  const labels = {
    'active': '有效',
    'checked_in': '已入场',
    'revoked': '已撤销',
    'expired': '已过期',
    'registered': '已注册'
  };
  return labels[status] || status;
}

function getErrorCodeMessage(errorCode) {
  const messages = {
    'NOT_FOUND': '凭证不存在',
    'SIGNATURE_INVALID': '签名验证失败，凭证可能被篡改',
    'EXPIRED': '凭证已过期',
    'NOT_YET_VALID': '凭证尚未生效',
    'PARSE_ERROR': '凭证格式错误',
    'DUPLICATE_CHECKIN': '重复入场',
    'REVOKED': '凭证已被撤销',
    'INVALID_STATE': '凭证状态无效'
  };
  return messages[errorCode] || '未知错误';
}

function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      tab.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function copyToClipboard(text) {
  return navigator.clipboard.writeText(text).then(() => {
    showAlert('已复制到剪贴板', 'success');
    return true;
  }).catch(() => {
    showAlert('复制失败，请手动复制', 'danger');
    return false;
  });
}

function downloadFile(content, filename, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
