const API_BASE = '/api/leases';
let allLeases = [];
let currentLeaseId = null;

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getStatusText(status) {
    const statusMap = {
        'ACTIVE': '活跃',
        'PENDING_APPROVAL': '待审批',
        'EXPIRED': '已过期',
        'REVOKED': '已吊销',
        'REJECTED': '已拒绝'
    };
    return statusMap[status] || status;
}

function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

function showCreateModal() {
    showModal('createModal');
}

async function submitCreate() {
    const applicant = document.getElementById('applicant').value.trim();
    const resourceId = document.getElementById('resourceId').value.trim();
    const durationHours = parseInt(document.getElementById('durationHours').value);
    const approvalStrategy = document.getElementById('approvalStrategy').value;
    const reason = document.getElementById('reason').value.trim();

    if (!applicant || !resourceId || !durationHours) {
        showToast('请填写必填字段', 'error');
        return;
    }

    try {
        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicant, resourceId, durationHours, approvalStrategy, reason })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('租约申请成功！');
            closeModal('createModal');
            document.getElementById('createForm').reset();
            refreshLeases();
        } else {
            showToast(result.error || '申请失败', 'error');
        }
    } catch (error) {
        showToast('网络错误，请重试', 'error');
        console.error(error);
    }
}

async function refreshLeases() {
    try {
        const response = await fetch(API_BASE);
        const result = await response.json();
        
        if (result.success) {
            allLeases = result.data;
            applyFilters();
            updateStats();
        }
    } catch (error) {
        console.error('加载租约列表失败:', error);
        document.getElementById('leaseList').innerHTML = '<div class="error">加载失败，请刷新页面重试</div>';
    }
}

function applyFilters() {
    const searchText = document.getElementById('searchInput').value.toLowerCase();
    const filterApplicant = document.getElementById('filterApplicant').value.toLowerCase();
    const filterResource = document.getElementById('filterResource').value.toLowerCase();
    const filterStatus = document.getElementById('filterStatus').value;

    let filtered = allLeases.filter(lease => {
        const matchSearch = !searchText || 
            lease.applicant.toLowerCase().includes(searchText) ||
            lease.resourceId.toLowerCase().includes(searchText) ||
            lease.id.toLowerCase().includes(searchText);
        
        const matchApplicant = !filterApplicant || lease.applicant.toLowerCase().includes(filterApplicant);
        const matchResource = !filterResource || lease.resourceId.toLowerCase().includes(filterResource);
        const matchStatus = !filterStatus || lease.status === filterStatus;

        return matchSearch && matchApplicant && matchResource && matchStatus;
    });

    renderLeaseList(filtered);
}

function renderLeaseList(leases) {
    const container = document.getElementById('leaseList');
    
    if (leases.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <h3>暂无租约数据</h3>
                <p>点击左侧"申请租约"按钮创建第一个租约</p>
            </div>
        `;
        return;
    }

    container.innerHTML = leases.map(lease => `
        <div class="lease-card">
            <div class="lease-header">
                <div class="lease-title">${lease.applicant} - ${lease.resourceId}</div>
                <span class="lease-status status-${lease.status}">${getStatusText(lease.status)}</span>
            </div>
            <div class="lease-info">
                <div class="lease-info-item"><strong>租约ID:</strong> ${lease.id.substring(0, 12)}...</div>
                <div class="lease-info-item"><strong>时长:</strong> ${lease.durationHours}小时</div>
                <div class="lease-info-item"><strong>创建时间:</strong> ${formatDate(lease.createdAt)}</div>
                <div class="lease-info-item"><strong>到期时间:</strong> ${formatDate(lease.expiresAt)}</div>
            </div>
            <div class="lease-actions">
                <button class="btn btn-info btn-small" onclick="viewDetail('${lease.id}')">查看详情</button>
                ${lease.status === 'PENDING_APPROVAL' ? `
                    <button class="btn btn-success btn-small" onclick="approveLease('${lease.id}')">批准</button>
                    <button class="btn btn-danger btn-small" onclick="rejectLease('${lease.id}')">拒绝</button>
                ` : ''}
                ${lease.status === 'ACTIVE' ? `
                    <button class="btn btn-warning btn-small" onclick="renewLease('${lease.id}')">续租</button>
                    <button class="btn btn-danger btn-small" onclick="revokeLease('${lease.id}')">吊销</button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function updateStats() {
    document.getElementById('statTotal').textContent = allLeases.length;
    document.getElementById('statActive').textContent = allLeases.filter(l => l.status === 'ACTIVE').length;
    document.getElementById('statPending').textContent = allLeases.filter(l => l.status === 'PENDING_APPROVAL').length;
}

async function viewDetail(id) {
    currentLeaseId = id;
    try {
        const response = await fetch(`${API_BASE}/${id}`);
        const result = await response.json();
        
        if (result.success) {
            renderDetail(result.data);
            showModal('detailModal');
        } else {
            showToast('加载详情失败', 'error');
        }
    } catch (error) {
        showToast('网络错误', 'error');
        console.error(error);
    }
}

function renderDetail(lease) {
    const history = lease.history || { auditLogs: [], approvals: [], renewals: [], invalidations: [] };
    
    let historyHtml = '';
    if (history.auditLogs && history.auditLogs.length > 0) {
        historyHtml = history.auditLogs.map(log => `
            <div class="history-item">
                <div class="history-action">${log.action}</div>
                <div class="history-time">${formatDate(log.timestamp)}</div>
                ${log.details ? `<div class="history-details">${JSON.stringify(log.details)}</div>` : ''}
            </div>
        `).join('');
    } else {
        historyHtml = '<div style="color: #718096; padding: 20px; text-align: center;">暂无操作记录</div>';
    }

    document.getElementById('detailContent').innerHTML = `
        <div class="detail-section">
            <h4>基本信息</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">租约ID</div>
                    <div class="detail-value">${lease.id}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">状态</div>
                    <div class="detail-value"><span class="lease-status status-${lease.status}">${getStatusText(lease.status)}</span></div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">申请人</div>
                    <div class="detail-value">${lease.applicant}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">资源标识</div>
                    <div class="detail-value">${lease.resourceId}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">租约时长</div>
                    <div class="detail-value">${lease.durationHours} 小时</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">审批策略</div>
                    <div class="detail-value">${lease.approvalStrategy === 'AUTO' ? '自动审批' : '人工审批'}</div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h4>密钥令牌</h4>
            <div class="secret-token">${lease.secretToken}</div>
        </div>

        <div class="detail-section">
            <h4>时间信息</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">创建时间</div>
                    <div class="detail-value">${formatDate(lease.createdAt)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">到期时间</div>
                    <div class="detail-value">${formatDate(lease.expiresAt)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">批准时间</div>
                    <div class="detail-value">${formatDate(lease.approvedAt)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">批准人</div>
                    <div class="detail-value">${lease.approvedBy || '-'}</div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h4>操作历史</h4>
            ${historyHtml}
        </div>

        <div class="action-buttons">
            ${lease.status === 'PENDING_APPROVAL' ? `
                <button class="btn btn-success" onclick="approveLease('${lease.id}')">批准租约</button>
                <button class="btn btn-danger" onclick="rejectLease('${lease.id}')">拒绝租约</button>
            ` : ''}
            ${lease.status === 'ACTIVE' ? `
                <button class="btn btn-warning" onclick="renewLease('${lease.id}')">续租</button>
                <button class="btn btn-danger" onclick="revokeLease('${lease.id}')">吊销租约</button>
            ` : ''}
            <button class="btn btn-secondary" onclick="closeModal('detailModal')">关闭</button>
        </div>
    `;
}

async function approveLease(id) {
    const approver = prompt('请输入审批人姓名:');
    if (!approver) return;

    const comment = prompt('审批意见(可选):');

    try {
        const response = await fetch(`${API_BASE}/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approver, comment })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('租约已批准！');
            closeModal('detailModal');
            refreshLeases();
        } else {
            showToast(result.error || '操作失败', 'error');
        }
    } catch (error) {
        showToast('网络错误', 'error');
        console.error(error);
    }
}

async function rejectLease(id) {
    const rejector = prompt('请输入拒绝人姓名:');
    if (!rejector) return;

    const reason = prompt('拒绝理由(可选):');

    try {
        const response = await fetch(`${API_BASE}/${id}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejector, reason })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('租约已拒绝！');
            closeModal('detailModal');
            refreshLeases();
        } else {
            showToast(result.error || '操作失败', 'error');
        }
    } catch (error) {
        showToast('网络错误', 'error');
        console.error(error);
    }
}

async function renewLease(id) {
    const hours = prompt('请输入续时时长(小时):', '24');
    if (!hours || isNaN(hours) || parseInt(hours) <= 0) {
        showToast('请输入有效的时长', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/${id}/renew`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ durationHours: parseInt(hours) })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('续租成功！');
            closeModal('detailModal');
            refreshLeases();
        } else {
            showToast(result.error || '操作失败', 'error');
        }
    } catch (error) {
        showToast('网络错误', 'error');
        console.error(error);
    }
}

async function revokeLease(id) {
    if (!confirm('确定要吊销此租约吗？')) return;

    const operator = prompt('请输入操作人姓名:');
    if (!operator) return;

    const reason = prompt('吊销理由(可选):');

    try {
        const response = await fetch(`${API_BASE}/${id}/revoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operator, reason })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('租约已吊销！');
            closeModal('detailModal');
            refreshLeases();
        } else {
            showToast(result.error || '操作失败', 'error');
        }
    } catch (error) {
        showToast('网络错误', 'error');
        console.error(error);
    }
}

async function exportLeases() {
    try {
        const response = await fetch(`${API_BASE}/export`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leases-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showToast('导出成功！');
    } catch (error) {
        showToast('导出失败', 'error');
        console.error(error);
    }
}

async function checkExpired() {
    try {
        const response = await fetch(`${API_BASE}/check-expired`, {
            method: 'POST'
        });
        const result = await response.json();
        if (result.success) {
            showToast(`已处理 ${result.data.expiredCount} 个过期租约`, 'info');
            refreshLeases();
        }
    } catch (error) {
        console.error(error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    refreshLeases();
    setInterval(checkExpired, 60000);
});
