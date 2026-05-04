const API_BASE = '/api';

async function apiRequest(endpoint, options = {}) {
    const url = API_BASE + endpoint;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    if (options.body && typeof options.body === 'object') {
        options.body = JSON.stringify(options.body);
    }
    
    try {
        const response = await fetch(url, { ...defaultOptions, ...options });
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || '请求失败');
        }
        
        return data;
    } catch (error) {
        console.error('API 请求错误:', error);
        throw error;
    }
}

function showAlert(message, type = 'info') {
    const container = document.getElementById('alert-container');
    if (!container) return;
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    container.innerHTML = '';
    container.appendChild(alertDiv);
    
    setTimeout(() => {
        if (alertDiv.parentNode === container) {
            container.removeChild(alertDiv);
        }
    }, 5000);
}

function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>加载中...</p>
            </div>
        `;
    }
}

function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const contents = document.querySelectorAll('.tab-content');
            contents.forEach(content => content.classList.remove('active'));
            document.getElementById(tabId)?.classList.add('active');
        });
    });
}

function initModals() {
    document.querySelectorAll('[data-modal]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.modal;
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.add('active');
            }
        });
    });
    
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) {
                modal.classList.remove('active');
            }
        });
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN');
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
}

function getBadgeClass(pass) {
    return pass ? 'badge-success' : 'badge-danger';
}

function getBadgeText(pass) {
    return pass ? '达标' : '未达标';
}

function getSeverityBadge(severity) {
    const classes = {
        'high': 'badge-danger',
        'normal': 'badge-warning',
        'low': 'badge-info'
    };
    const texts = {
        'high': '高优先级',
        'normal': '普通',
        'low': '低'
    };
    return {
        class: classes[severity] || 'badge-secondary',
        text: texts[severity] || severity
    };
}

async function uploadFile(endpoint, fileInputId, classId, successMessage) {
    const fileInput = document.getElementById(fileInputId);
    const file = fileInput.files[0];
    
    if (!file) {
        showAlert('请选择文件', 'danger');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}/${classId}`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || '上传失败');
        }
        
        showAlert(successMessage, 'success');
        fileInput.value = '';
        
        return data;
        
    } catch (error) {
        showAlert(error.message, 'danger');
        throw error;
    }
}

function renderTable(containerId, columns, data, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!data || data.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📋</div>
                <p>${options.emptyText || '暂无数据'}</p>
            </div>
        `;
        return;
    }
    
    let html = '<table>';
    html += '<thead><tr>';
    columns.forEach(col => {
        html += `<th>${col.label}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    data.forEach((row, index) => {
        const rowClass = options.highlightRow && options.highlightRow(row, index) ? 'highlight-row' : '';
        html += `<tr class="${rowClass}">`;
        
        columns.forEach(col => {
            let value = row[col.key];
            if (col.render) {
                value = col.render(value, row, index);
            }
            html += `<td>${value ?? '-'}</td>`;
        });
        
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
}
