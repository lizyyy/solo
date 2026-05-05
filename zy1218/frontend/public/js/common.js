// 通用脚本

// 健康检查
async function checkHealth() {
  try {
    const health = await API.Health.check();
    const statusEl = document.getElementById('health-status');
    if (health.status === 'healthy') {
      statusEl.innerHTML = '<i class="fa fa-circle text-success me-1"></i>已连接';
    } else {
      statusEl.innerHTML = '<i class="fa fa-circle text-warning me-1"></i>状态异常';
    }
  } catch (error) {
    const statusEl = document.getElementById('health-status');
    statusEl.innerHTML = '<i class="fa fa-circle text-danger me-1"></i>未连接';
    console.error('Health check failed:', error);
  }
}

// 显示 Toast 通知
function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toast-container') || createToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast align-items-center text-white bg-${type} border-0`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        <i class="fa fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation' : 'info'}-circle me-2"></i>
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  
  toastContainer.appendChild(toast);
  const bsToast = new bootstrap.Toast(toast, { autohide: true, delay: 3000 });
  bsToast.show();
  
  toast.addEventListener('hidden.bs.toast', () => {
    toast.remove();
  });
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'toast-container';
  document.body.appendChild(container);
  return container;
}

// 确认对话框
function confirmDialog(message, title = '确认操作') {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.setAttribute('tabindex', '-1');
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${title}</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p>${message}</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
            <button type="button" class="btn btn-primary" id="confirm-btn">确认</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    const confirmBtn = modal.querySelector('#confirm-btn');
    
    confirmBtn.addEventListener('click', () => {
      bsModal.hide();
      resolve(true);
    });
    
    modal.addEventListener('hidden.bs.modal', () => {
      modal.remove();
      resolve(false);
    });
  });
}

// 加载状态
function setLoading(elementId, loading = true) {
  const el = document.getElementById(elementId);
  if (!el) return;
  
  if (loading) {
    el.disabled = true;
    el.dataset.originalText = el.innerHTML;
    el.innerHTML = '<span class="loading me-2"></span>加载中...';
  } else {
    el.disabled = false;
    el.innerHTML = el.dataset.originalText || el.innerHTML;
  }
}

// 格式化数字
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// 复制到剪贴板
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板', 'success');
    return true;
  } catch (error) {
    console.error('Copy failed:', error);
    showToast('复制失败', 'error');
    return false;
  }
}

// 下载文件
function downloadFile(content, filename, contentType = 'text/plain') {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 节流函数
function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
  // 定期检查健康状态
  checkHealth();
  setInterval(checkHealth, 30000);
  
  // 初始化工具提示
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltipTriggerList.forEach(tooltipTriggerEl => {
    new bootstrap.Tooltip(tooltipTriggerEl);
  });
  
  // 初始化弹出框
  const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
  popoverTriggerList.forEach(popoverTriggerEl => {
    new bootstrap.Popover(popoverTriggerEl);
  });
});

// 导出工具函数
window.Common = {
  showToast,
  confirmDialog,
  setLoading,
  formatNumber,
  copyToClipboard,
  downloadFile,
  debounce,
  throttle,
};
