const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', () => {
    loadStatistics();
    loadRecords();
});

async function loadStatistics() {
    try {
        const response = await fetch(`${API_BASE}/statistics`);
        const stats = await response.json();
        
        document.getElementById('totalRecords').textContent = stats.total || 0;
        document.getElementById('activeRecords').textContent = stats.active || 0;
        document.getElementById('conflictRecords').textContent = stats.conflict || 0;
        document.getElementById('reusedRequests').textContent = stats.reusedRequests || 0;
    } catch (error) {
        console.error('Failed to load statistics:', error);
    }
}

async function loadRecords() {
    try {
        const searchKey = document.getElementById('searchKey').value;
        const filterService = document.getElementById('filterService').value;
        const filterStatus = document.getElementById('filterStatus').value;
        
        let url = `${API_BASE}/records?`;
        const params = new URLSearchParams();
        
        if (searchKey) params.append('idempotencyKey', searchKey);
        if (filterService) params.append('serviceName', filterService);
        if (filterStatus) params.append('status', filterStatus);
        
        url += params.toString();
        
        const response = await fetch(url);
        const data = await response.json();
        
        renderRecords(data.records || []);
    } catch (error) {
        console.error('Failed to load records:', error);
    }
}

function renderRecords(records) {
    const tbody = document.getElementById('recordsTableBody');
    
    if (!records || records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <h3>暂无数据</h3>
                    <p>点击"模拟请求"按钮开始创建演示数据</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = records.map(record => `
        <tr>
            <td><code>${record.idempotency_key.substring(0, 20)}...</code></td>
            <td>${record.service_name}</td>
            <td><code>${record.api_endpoint}</code></td>
            <td><span class="status-badge status-${record.status}">${getStatusLabel(record.status)}</span></td>
            <td>${record.request_count}</td>
            <td>${formatDateTime(record.first_request_at)}</td>
            <td>${formatDateTime(record.last_request_at)}</td>
            <td>
                <button onclick="viewDetail(${record.id})" class="btn btn-small btn-primary">详情</button>
            </td>
        </tr>
    `).join('');
}

function getStatusLabel(status) {
    const labels = {
        'active': '活跃',
        'conflict': '冲突',
        'expired': '过期'
    };
    return labels[status] || status;
}

function formatDateTime(dateStr) {
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

async function viewDetail(id) {
    try {
        const response = await fetch(`${API_BASE}/records/${id}`);
        const data = await response.json();
        
        renderDetail(data);
        document.getElementById('detailModal').classList.add('show');
    } catch (error) {
        console.error('Failed to load detail:', error);
    }
}

function renderDetail(data) {
    const { record, logs, audits } = data;
    
    const detailContent = document.getElementById('detailContent');
    
    detailContent.innerHTML = `
        <div class="detail-section">
            <h3>📊 基本信息</h3>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">幂等键</div>
                    <div class="detail-value"><code>${record.idempotency_key}</code></div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">服务名称</div>
                    <div class="detail-value">${record.service_name}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">API端点</div>
                    <div class="detail-value"><code>${record.api_endpoint}</code></div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">状态</div>
                    <div class="detail-value"><span class="status-badge status-${record.status}">${getStatusLabel(record.status)}</span></div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">请求次数</div>
                    <div class="detail-value">${record.request_count}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">过期时间</div>
                    <div class="detail-value">${formatDateTime(record.expires_at)}</div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3>🔑 请求指纹</h3>
            <div class="detail-item">
                <div class="detail-label">SHA256 指纹</div>
                <div class="detail-value"><code>${record.request_fingerprint}</code></div>
            </div>
        </div>

        <div class="detail-section">
            <h3>📄 首次请求与响应</h3>
            <div class="detail-item">
                <div class="detail-label">请求体</div>
                <div class="code-block">${record.request_body || '{}'}</div>
            </div>
            <div class="detail-item" style="margin-top: 10px;">
                <div class="detail-label">响应状态: ${record.first_response_status}</div>
                <div class="code-block">${record.first_response_body || '{}'}</div>
            </div>
        </div>

        <div class="detail-section">
            <h3>📅 请求历史时间线</h3>
            <div class="timeline">
                ${renderTimeline(logs)}
            </div>
        </div>
    `;
}

function renderTimeline(logs) {
    if (!logs || logs.length === 0) {
        return '<p style="color: #666; text-align: center; padding: 20px;">暂无请求记录</p>';
    }
    
    return logs.map((log, index) => {
        let dotClass = '';
        let typeText = '';
        
        if (log.is_conflict) {
            dotClass = 'conflict';
            typeText = '⚠️ 冲突请求';
        } else if (log.is_reused) {
            dotClass = 'reused';
            typeText = '🔄 复用响应';
        } else {
            dotClass = 'first';
            typeText = '✅ 首次请求';
        }
        
        return `
            <div class="timeline-item">
                <div class="timeline-dot ${dotClass}"></div>
                <div class="timeline-time">${formatDateTime(log.requested_at)}</div>
                <div class="timeline-type">${typeText}</div>
                <div class="timeline-body">
                    <div><strong>请求体:</strong></div>
                    <div class="code-block">${log.request_body || '{}'}</div>
                    ${log.response_body ? `
                        <div style="margin-top: 8px;"><strong>响应体:</strong></div>
                        <div class="code-block">${log.response_body}</div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

function openSimulateModal() {
    document.getElementById('simResult').classList.remove('show');
    document.getElementById('simulateModal').classList.add('show');
}

function openImportModal() {
    document.getElementById('importResult').classList.remove('show');
    document.getElementById('importModal').classList.add('show');
}

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
});

async function simulateRequest(isConflict = false) {
    const key = document.getElementById('simKey').value;
    const service = document.getElementById('simService').value;
    const endpoint = document.getElementById('simEndpoint').value;
    let body = document.getElementById('simBody').value;
    
    if (!key || !service || !endpoint) {
        alert('请填写必填字段');
        return;
    }
    
    if (isConflict) {
        try {
            const bodyObj = JSON.parse(body || '{}');
            bodyObj.amount = (bodyObj.amount || 100) + 1;
            body = JSON.stringify(bodyObj);
        } catch (e) {
            body = '{"amount": 999}';
        }
    }
    
    try {
        const response = await fetch(`${API_BASE}/simulate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idempotencyKey: key,
                serviceName: service,
                apiEndpoint: endpoint,
                requestMethod: 'POST',
                requestBody: body
            })
        });
        
        const result = await response.json();
        showSimulationResult(result);
    } catch (error) {
        console.error('Simulation error:', error);
    }
}

function showSimulationResult(result) {
    const resultDiv = document.getElementById('simResult');
    resultDiv.classList.add('show');
    
    let resultClass = '';
    let resultHtml = '';
    
    switch (result.type) {
        case 'FIRST':
            resultClass = 'result-first';
            resultHtml = `
                <strong>✅ 首次请求</strong>
                <p>${result.message}</p>
                <p><strong>指纹:</strong> <code>${result.fingerprint.substring(0, 20)}...</code></p>
                <p><strong>响应:</strong></p>
                <div class="code-block">${JSON.stringify(result.response, null, 2)}</div>
            `;
            break;
        case 'REUSE':
            resultClass = 'result-reuse';
            resultHtml = `
                <strong>🔄 响应复用</strong>
                <p>${result.message}</p>
                <p><strong>指纹匹配:</strong> ✅ 匹配</p>
                <p><strong>请求次数:</strong> ${result.requestCount}</p>
                <p><strong>原始响应:</strong></p>
                <div class="code-block">${JSON.stringify(result.firstResponse.body, null, 2)}</div>
            `;
            break;
        case 'CONFLICT':
            resultClass = 'result-conflict';
            resultHtml = `
                <strong>⚠️ 幂等冲突</strong>
                <p>${result.message}</p>
                <p><strong>指纹不匹配!</strong></p>
                <p><strong>原始指纹:</strong> <code>${result.fingerprint.existing.substring(0, 30)}...</code></p>
                <p><strong>当前指纹:</strong> <code>${result.fingerprint.current.substring(0, 30)}...</code></p>
            `;
            break;
    }
    
    resultDiv.className = `simulation-result show ${resultClass}`;
    resultDiv.innerHTML = resultHtml;
}

async function batchImport() {
    const importData = document.getElementById('importData').value;
    
    if (!importData.trim()) {
        alert('请输入JSON数据');
        return;
    }
    
    try {
        const records = JSON.parse(importData);
        
        const response = await fetch(`${API_BASE}/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records })
        });
        
        const result = await response.json();
        showImportResult(result);
    } catch (error) {
        alert('JSON格式错误: ' + error.message);
    }
}

function showImportResult(result) {
    const resultDiv = document.getElementById('importResult');
    resultDiv.classList.add('show');
    
    const isSuccess = result.failed === 0;
    resultDiv.className = `import-result show ${isSuccess ? 'result-success' : 'result-error'}`;
    
    resultDiv.innerHTML = `
        <strong>导入完成</strong>
        <p>成功: ${result.success} 条</p>
        <p>失败: ${result.failed} 条</p>
        ${result.errors && result.errors.length > 0 ? `
            <p><strong>错误详情:</strong></p>
            <ul>
                ${result.errors.map(e => `<li>${e.record}: ${e.error}</li>`).join('')}
            </ul>
        ` : ''}
    `;
}

async function exportRecords() {
    try {
        const filterService = document.getElementById('filterService').value;
        const filterStatus = document.getElementById('filterStatus').value;
        
        let url = `${API_BASE}/export?`;
        const params = new URLSearchParams();
        
        if (filterService) params.append('serviceName', filterService);
        if (filterStatus) params.append('status', filterStatus);
        
        url += params.toString();
        
        const response = await fetch(url);
        
        if (response.ok) {
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `idempotency-audit-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);
        }
    } catch (error) {
        console.error('Export error:', error);
    }
}
