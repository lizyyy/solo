const API_BASE = '/api';

let invitations = [];
let approvals = [];
let domains = [];
let auditLogs = [];
let roles = [];

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleString('zh-CN');
}

function getStatusBadge(status) {
    const badges = {
        active: '<span class="badge badge-active">有效</span>',
        pending: '<span class="badge badge-pending">待审批</span>',
        used: '<span class="badge badge-used">已使用</span>',
        revoked: '<span class="badge badge-revoked">已撤销</span>',
        expired: '<span class="badge badge-expired">已过期</span>',
        approved: '<span class="badge badge-active">已通过</span>',
        rejected: '<span class="badge badge-revoked">已拒绝</span>'
    };
    return badges[status] || status;
}

function getActionName(action) {
    const names = {
        create_invitation: '创建邀请',
        use_invitation: '使用邀请',
        revoke_invitation: '撤销邀请',
        process_approval: '处理审批',
        add_domain: '添加域名'
    };
    return names[action] || action;
}

async function loadStats() {
    const res = await fetch(`${API_BASE}/stats`);
    const data = await res.json();
    if (data.success) {
        const stats = data.data;
        document.querySelectorAll('#stats .stat-card')[0].querySelector('.stat-value').textContent = stats.total;
        document.querySelectorAll('#stats .stat-card')[1].querySelector('.stat-value').textContent = stats.active;
        document.querySelectorAll('#stats .stat-card')[2].querySelector('.stat-value').textContent = stats.pending;
        document.querySelectorAll('#stats .stat-card')[3].querySelector('.stat-value').textContent = stats.used;
        document.querySelectorAll('#stats .stat-card')[4].querySelector('.stat-value').textContent = stats.revoked;
    }
}

async function loadRoles() {
    const res = await fetch(`${API_BASE}/roles`);
    const data = await res.json();
    if (data.success) {
        roles = data.data;
        const select = document.getElementById('create-role');
        select.innerHTML = roles.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
    }
}

async function loadInvitations() {
    const search = document.getElementById('invite-search').value;
    const status = document.getElementById('invite-status').value;
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    
    const res = await fetch(`${API_BASE}/invitations?${params}`);
    const data = await res.json();
    if (data.success) {
        invitations = data.data;
        renderInvitations();
    }
}

function renderInvitations() {
    const tbody = document.querySelector('#invite-table tbody');
    if (invitations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">暂无邀请数据</td></tr>';
        return;
    }
    tbody.innerHTML = invitations.map(inv => `
        <tr>
            <td>${inv.inviteeEmail}</td>
            <td>${inv.inviterEmail}</td>
            <td>${inv.roleName}</td>
            <td>${inv.projectId}</td>
            <td>${getStatusBadge(inv.status)}</td>
            <td>${formatDate(inv.createdAt)}</td>
            <td>
                <button class="btn btn-outline action-btn" onclick="showDetail('${inv.id}')">详情</button>
                ${inv.status === 'active' ? `<button class="btn btn-success action-btn" onclick="showUseModal('${inv.token}')">使用</button>` : ''}
                ${['active', 'pending'].includes(inv.status) ? `<button class="btn btn-danger action-btn" onclick="showRevokeModal('${inv.id}')">撤销</button>` : ''}
            </td>
        </tr>
    `).join('');
}

async function loadApprovals() {
    const status = document.getElementById('approval-status').value;
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    
    const res = await fetch(`${API_BASE}/approvals?${params}`);
    const data = await res.json();
    if (data.success) {
        approvals = data.data;
        renderApprovals();
    }
}

function renderApprovals() {
    const tbody = document.querySelector('#approval-table tbody');
    if (approvals.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">暂无审批数据</td></tr>';
        return;
    }
    tbody.innerHTML = approvals.map(app => `
        <tr>
            <td>${app.inviteeEmail}</td>
            <td>${app.requesterEmail}</td>
            <td>${app.reason}</td>
            <td>${getStatusBadge(app.status)}</td>
            <td>${formatDate(app.createdAt)}</td>
            <td>
                ${app.status === 'pending' ? `
                    <button class="btn btn-success action-btn" onclick="showApprovalModal('${app.id}', 'approve')">通过</button>
                    <button class="btn btn-danger action-btn" onclick="showApprovalModal('${app.id}', 'reject')">拒绝</button>
                ` : '-'}
            </td>
        </tr>
    `).join('');
}

async function loadDomains() {
    const res = await fetch(`${API_BASE}/domains`);
    const data = await res.json();
    if (data.success) {
        domains = data.data;
        renderDomains();
    }
}

function renderDomains() {
    const tbody = document.querySelector('#domain-table tbody');
    if (domains.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-state">暂无域名白名单，添加域名后只有该域名邮箱可直接加入</td></tr>';
        return;
    }
    tbody.innerHTML = domains.map(d => `
        <tr>
            <td>${d.domain}</td>
            <td>${d.enabled ? '<span class="badge badge-active">启用</span>' : '<span class="badge badge-revoked">禁用</span>'}</td>
            <td>${formatDate(d.createdAt)}</td>
        </tr>
    `).join('');
}

async function loadAudit() {
    const action = document.getElementById('audit-action').value;
    const status = document.getElementById('audit-status').value;
    const params = new URLSearchParams();
    if (action) params.append('action', action);
    if (status) params.append('status', status);
    
    const res = await fetch(`${API_BASE}/audit?${params}`);
    const data = await res.json();
    if (data.success) {
        auditLogs = data.data;
        renderAudit();
    }
}

function renderAudit() {
    const tbody = document.querySelector('#audit-table tbody');
    if (auditLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">暂无审计日志</td></tr>';
        return;
    }
    tbody.innerHTML = auditLogs.map(log => `
        <tr>
            <td>${getActionName(log.action)}</td>
            <td><span class="badge badge-${log.status === 'success' ? 'active' : 'revoked'}">${log.status === 'success' ? '成功' : '失败'}</span></td>
            <td>${log.operator?.user || '-'}</td>
            <td>${formatDate(log.timestamp)}</td>
            <td>
                <button class="btn btn-outline action-btn" onclick="showAuditDetail('${log.id}')">详情</button>
            </td>
        </tr>
    `).join('');
}

async function createInvitation() {
    const inviterEmail = document.getElementById('create-inviter').value;
    const inviteeEmail = document.getElementById('create-invitee').value;
    const roleId = document.getElementById('create-role').value;
    const projectId = document.getElementById('create-project').value;

    const res = await fetch(`${API_BASE}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Operator': 'admin' },
        body: JSON.stringify({ inviterEmail, inviteeEmail, roleId, projectId })
    });
    const data = await res.json();
    if (data.success) {
        showToast('邀请创建成功');
        closeModal('createModal');
        loadInvitations();
        loadStats();
        loadApprovals();
    } else {
        showToast(`创建失败: ${data.message}`, 'error');
    }
}

async function showDetail(id) {
    const res = await fetch(`${API_BASE}/invitations/${id}`);
    const data = await res.json();
    if (data.success) {
        const inv = data.data;
        const content = document.getElementById('detail-content');
        content.innerHTML = `
            <div class="detail-row"><div class="detail-label">邀请ID</div><div class="detail-value">${inv.id}</div></div>
            <div class="detail-row"><div class="detail-label">邀请令牌</div><div class="detail-value">${inv.token}</div></div>
            <div class="detail-row"><div class="detail-label">受邀人</div><div class="detail-value">${inv.inviteeEmail}</div></div>
            <div class="detail-row"><div class="detail-label">邀请人</div><div class="detail-value">${inv.inviterEmail}</div></div>
            <div class="detail-row"><div class="detail-label">角色</div><div class="detail-value">${inv.roleName}</div></div>
            <div class="detail-row"><div class="detail-label">项目ID</div><div class="detail-value">${inv.projectId}</div></div>
            <div class="detail-row"><div class="detail-label">状态</div><div class="detail-value">${getStatusBadge(inv.status)}</div></div>
            <div class="detail-row"><div class="detail-label">需审批</div><div class="detail-value">${inv.requiresApproval ? '是' : '否'}</div></div>
            <div class="detail-row"><div class="detail-label">使用次数</div><div class="detail-value">${inv.usedCount} / ${inv.maxUses}</div></div>
            <div class="detail-row"><div class="detail-label">创建时间</div><div class="detail-value">${formatDate(inv.createdAt)}</div></div>
            <div class="detail-row"><div class="detail-label">过期时间</div><div class="detail-value">${formatDate(inv.expiresAt)}</div></div>
        `;
        document.getElementById('detailModal').classList.add('active');
    }
}

function showCreateModal() {
    document.getElementById('createModal').classList.add('active');
}

function showRevokeModal(id) {
    document.getElementById('revoke-id').value = id;
    document.getElementById('revokeModal').classList.add('active');
}

async function confirmRevoke() {
    const id = document.getElementById('revoke-id').value;
    const reason = document.getElementById('revoke-reason').value;
    
    const res = await fetch(`${API_BASE}/invitations/${id}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Operator': 'admin' },
        body: JSON.stringify({ reason })
    });
    const data = await res.json();
    if (data.success) {
        showToast('撤销成功');
        closeModal('revokeModal');
        loadInvitations();
        loadStats();
        loadAudit();
    } else {
        showToast(`撤销失败: ${data.message}`, 'error');
    }
}

function showUseModal(token) {
    document.getElementById('use-token').value = token;
    document.getElementById('useModal').classList.add('active');
}

async function confirmUse() {
    const token = document.getElementById('use-token').value;
    const userEmail = document.getElementById('use-email').value;
    
    const res = await fetch(`${API_BASE}/invitations/use/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Operator': 'admin' },
        body: JSON.stringify({ userEmail })
    });
    const data = await res.json();
    if (data.success) {
        showToast('使用成功');
        closeModal('useModal');
        loadInvitations();
        loadStats();
        loadAudit();
    } else {
        showToast(`使用失败: ${data.message}`, 'error');
    }
}

function showApprovalModal(id, action) {
    document.getElementById('approval-id').value = id;
    document.getElementById('approval-action').value = action;
    document.getElementById('approval-title').textContent = action === 'approve' ? '通过审批' : '拒绝审批';
    document.getElementById('approval-btn').className = `btn ${action === 'approve' ? 'btn-success' : 'btn-danger'}`;
    document.getElementById('approvalModal').classList.add('active');
}

async function confirmApproval() {
    const id = document.getElementById('approval-id').value;
    const action = document.getElementById('approval-action').value;
    const approver = document.getElementById('approval-approver').value;
    const reason = document.getElementById('approval-reason').value;
    
    const res = await fetch(`${API_BASE}/approvals/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Operator': 'admin' },
        body: JSON.stringify({ action, approver, reason })
    });
    const data = await res.json();
    if (data.success) {
        showToast('审批成功');
        closeModal('approvalModal');
        loadApprovals();
        loadInvitations();
        loadStats();
        loadAudit();
    } else {
        showToast(`审批失败: ${data.message}`, 'error');
    }
}

function showAddDomainModal() {
    document.getElementById('addDomainModal').classList.add('active');
}

async function addDomain() {
    const domain = document.getElementById('domain-name').value;
    
    const res = await fetch(`${API_BASE}/domains`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Operator': 'admin' },
        body: JSON.stringify({ domain })
    });
    const data = await res.json();
    if (data.success) {
        showToast('域名添加成功');
        closeModal('addDomainModal');
        loadDomains();
        loadAudit();
    } else {
        showToast(`添加失败: ${data.message}`, 'error');
    }
}

function showAuditDetail(id) {
    const log = auditLogs.find(l => l.id === id);
    if (log) {
        const content = document.getElementById('audit-detail-content');
        content.innerHTML = `
            <div class="detail-row"><div class="detail-label">操作类型</div><div class="detail-value">${getActionName(log.action)}</div></div>
            <div class="detail-row"><div class="detail-label">结果</div><div class="detail-value">${log.status === 'success' ? '成功' : '失败'}</div></div>
            <div class="detail-row"><div class="detail-label">操作者</div><div class="detail-value">${log.operator?.user || '-'} (${log.operator?.ip || '-'})</div></div>
            <div class="detail-row"><div class="detail-label">请求ID</div><div class="detail-value">${log.requestId}</div></div>
            <div class="detail-row"><div class="detail-label">时间</div><div class="detail-value">${formatDate(log.timestamp)}</div></div>
            <div class="detail-row"><div class="detail-label">输入参数</div><div class="detail-value"><pre style="background:#f5f5f5;padding:10px;border-radius:6px;overflow:auto;">${JSON.stringify(log.input, null, 2)}</pre></div></div>
            <div class="detail-row"><div class="detail-label">返回结果</div><div class="detail-value"><pre style="background:#f5f5f5;padding:10px;border-radius:6px;overflow:auto;">${JSON.stringify(log.result, null, 2)}</pre></div></div>
        `;
        document.getElementById('auditDetailModal').classList.add('active');
    }
}

async function exportData() {
    const res = await fetch(`${API_BASE}/export`);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invitation-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('导出成功');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
    });
});

document.getElementById('invite-search').addEventListener('input', loadInvitations);
document.getElementById('invite-status').addEventListener('change', loadInvitations);
document.getElementById('approval-status').addEventListener('change', loadApprovals);
document.getElementById('audit-action').addEventListener('change', loadAudit);
document.getElementById('audit-status').addEventListener('change', loadAudit);

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });
});

async function init() {
    await loadRoles();
    await loadStats();
    await loadInvitations();
    await loadApprovals();
    await loadDomains();
    await loadAudit();
}

init();
