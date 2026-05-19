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
        'PENDING_RENEWAL': '待续租审批',
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

function showValidateModal() {
    document.getElementById('validateResult').style.display = 'none';
    showModal('validateModal');
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`.tab-btn[onclick="switchTab('${tab}')"]`).classList.add('active');
    document.getElementById(`${tab}Tab`).classList.add('active');
    
    if (tab === 'renewals') {
        loadPendingRenewals();
    } else if (tab === 'audit') {
        loadAuditLogs();
    }
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

async function submitValidate() {
    const secretToken = document.getElementById('validateToken').value.trim();
    const resourceId = document.getElementById('validateResource').value.trim();
    const operator = document.getElementById('validateOperator').value.trim();

    if (!secretToken || !resourceId) {
        showToast('请填写必填字段', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secretToken, resourceId, operator })
        });
        
        const result = await response.json();
        
        const resultDiv = document.getElementById('validateResult');
        resultDiv.style.display = 'block';
        
        if (result.success && result.data.valid) {
            resultDiv.className = 'validate-result success';
            resultDiv.innerHTML = `
                <strong>✅ 验证成功</strong><br>
                <br>
                申请人: ${result.data.lease.applicant}<br>
                资源: ${result.data.lease.resourceId}<br>
                状态: ${getStatusText(result.data.lease.status)}<br>
                到期时间: ${formatDate(result.data.lease.expiresAt)}
            `;
        } else {
            resultDiv.className = 'validate-result error';
            resultDiv.innerHTML = `
                <strong>❌ 验证失败</strong><br>
                <br>
                原因: ${result.data ? result.data.reason : result.error}
            `;
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
            loadInvalidations();
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
                    <button class="btn btn-warning btn-small" onclick="showRenewalModal('${lease.id}')">申请续租</button>
                    <button class="btn btn-danger btn-small" onclick="revokeLease('${lease.id}')">吊销</button>
                ` : ''}
                ${lease.status === 'PENDING_RENEWAL' ? `
                    <button class="btn btn-info btn-small" onclick="viewDetail('${lease.id}')">查看续租申请</button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function updateStats() {
    document.getElementById('statTotal').textContent = allLeases.length;
    document.getElementById('statActive').textContent = allLeases.filter(l => l.status === 'ACTIVE').length;
    document.getElementById('statPending').textContent = allLeases.filter(l => l.status === 'PENDING_APPROVAL').length;
    document.getElementById('statPendingRenewal').textContent = allLeases.filter(l => l.status === 'PENDING_RENEWAL').length;
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
                ${log.details ? `<div class="history-details">${JSON.stringify(log.details, null, 2)}</div>` : ''}
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
                <button class="btn btn-warning" onclick="showRenewalModal('${lease.id}')">申请续租</button>
                <button class="btn btn-danger" onclick="revokeLease('${lease.id}')">吊销租约</button>
            ` : ''}
            ${lease.status === 'PENDING_RENEWAL' ? `
                <span style="color: #718096;">续租审批中...</span>
            ` : ''}
            <button class="btn btn-secondary" onclick="closeModal('detailModal')">关闭</button>
        </div>
    `;
}

function showRenewalModal(leaseId) {
    currentLeaseId = leaseId;
    document.getElementById('renewalLeaseId').value = leaseId;
    document.getElementById('renewalDuration').value = 24;
    document.getElementById('renewalApplicant').value = '';
    document.getElementById('renewalReason').value = '';
    showModal('renewalModal');
}

async function submitRenewalRequest() {
    const durationHours = parseInt(document.getElementById('renewalDuration').value);
    const applicant = document.getElementById('renewalApplicant').value.trim();
    const reason = document.getElementById('renewalReason').value.trim();

    if (!durationHours || !applicant) {
        showToast('请填写必填字段', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/${currentLeaseId}/request-renewal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ durationHours, applicant, reason })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('续租申请已提交！');
            closeModal('renewalModal');
            refreshLeases();
        } else {
            showToast(result.error || '申请失败', 'error');
        }
    } catch (error) {
        showToast('网络错误，请重试', 'error');
        console.error(error);
    }
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

async function approveRenewal(renewalId) {
    const approver = prompt('请输入审批人姓名:');
    if (!approver) return;

    const comment = prompt('审批意见(可选):');

    try {
        const response = await fetch(`${API_BASE}/renewals/${renewalId}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approver, comment })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('续租审批通过！');
            refreshLeases();
            loadPendingRenewals();
        } else {
            showToast(result.error || '操作失败', 'error');
        }
    } catch (error) {
        showToast('网络错误', 'error');
        console.error(error);
    }
}

async function rejectRenewal(renewalId) {
    const rejector = prompt('请输入拒绝人姓名:');
    if (!rejector) return;

    const reason = prompt('拒绝理由(可选):');

    try {
        const response = await fetch(`${API_BASE}/renewals/${renewalId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rejector, reason })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('续租申请已拒绝！');
            refreshLeases();
            loadPendingRenewals();
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

async function loadPendingRenewals() {
    try {
        const response = await fetch(`${API_BASE}/pending-renewals`);
        const result = await response.json();
        
        if (result.success) {
            renderRenewalList(result.data);
        }
    } catch (error) {
        console.error('加载续租申请失败:', error);
    }
}

function renderRenewalList(renewals) {
    const container = document.getElementById('renewalList');
    
    if (renewals.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <h3>暂无待审批的续租申请</h3>
            </div>
        `;
        return;
    }

    container.innerHTML = renewals.map(renewal => `
        <div class="renewal-card">
            <div class="renewal-header">
                <div class="renewal-title">续租申请 - ${renewal.applicant}</div>
                <span class="lease-status status-PENDING_APPROVAL">待审批</span>
            </div>
            <div class="renewal-info">
                <div class="lease-info-item"><strong>续租时长:</strong> ${renewal.durationHours}小时</div>
                <div class="lease-info-item"><strong>申请时间:</strong> ${formatDate(renewal.requestedAt)}</div>
                <div class="lease-info-item"><strong>租约ID:</strong> ${renewal.leaseId.substring(0, 16)}...</div>
            </div>
            ${renewal.reason ? `<div style="margin-bottom: 12px; color: #718096;"><strong>理由:</strong> ${renewal.reason}</div>` : ''}
            <div class="lease-actions">
                <button class="btn btn-success btn-small" onclick="approveRenewal('${renewal.id}')">批准续租</button>
                <button class="btn btn-danger btn-small" onclick="rejectRenewal('${renewal.id}')">拒绝续租</button>
            </div>
        </div>
    `).join('');
}

async function loadAuditLogs() {
    try {
        const response = await fetch(`${API_BASE}/audit-logs`);
        const result = await response.json();
        
        if (result.success) {
            renderAuditList(result.data);
        }
    } catch (error) {
        console.error('加载审计日志失败:', error);
    }
}

function renderAuditList(logs) {
    const container = document.getElementById('auditList');
    
    if (logs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <h3>暂无审计日志</h3>
            </div>
        `;
        return;
    }

    container.innerHTML = logs.map(log => {
        const isFailed = log.action.includes('FAILED') || log.action.includes('REJECTED');
        const isSuccess = !isFailed;
        return `
        <div class="audit-item ${isFailed ? 'failed' : 'success'}">
            <div class="audit-action">${log.action}</div>
            <div class="audit-meta">
                <span>时间: ${formatDate(log.timestamp)}</span>
                ${log.details && log.details.operator ? `<span>操作人: ${log.details.operator}</span>` : ''}
            </div>
            ${log.details ? `<div class="audit-details">${JSON.stringify(log.details, null, 2)}</div>` : ''}
        </div>
    `}).join('');
}

async function loadInvalidations() {
    try {
        const response = await fetch(`${API_BASE}/invalidations`);
        const result = await response.json();
        
        if (result.success) {
            renderInvalidationList(result.data);
        }
    } catch (error) {
        console.error('加载失效记录失败:', error);
    }
}

function renderInvalidationList(invalidations) {
    const container = document.getElementById('notificationList');
    
    if (invalidations.length === 0) {
        container.innerHTML = '<div class="empty-text">暂无失效记录</div>';
        return;
    }

    container.innerHTML = invalidations.slice(0, 8).map(inv => `
        <div class="notification-item ${inv.type === 'EXPIRATION' ? 'expiration' : ''}">
            <div class="notification-title">
                ${inv.type === 'EXPIRATION' ? '⏰ 租约到期' : '🚫 租约吊销'}
            </div>
            <div class="notification-detail">
                操作人: ${inv.operator}
                ${inv.reason ? `<br>原因: ${inv.reason}` : ''}
            </div>
            <div class="notification-time">${formatDate(inv.invalidatedAt)}</div>
        </div>
    `).join('');
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
