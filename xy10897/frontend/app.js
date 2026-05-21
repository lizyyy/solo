const API_BASE = 'http://localhost:8000';

let allowedScopes = [];
let demoCredentials = {};

async function api(url, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
    };
    const response = await fetch(`${API_BASE}${url}`, { ...defaultOptions, ...options });
    return await response.json();
}

function showPage(pageName) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('d-none'));
    document.getElementById(`page-${pageName}`).classList.remove('d-none');
    
    document.querySelectorAll('#navTabs .nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-page="${pageName}"]`).classList.add('active');
    
    loadPageData(pageName);
}

async function loadPageData(pageName) {
    switch(pageName) {
        case 'dashboard':
            await loadStats();
            break;
        case 'apply':
            await loadScopes();
            break;
        case 'approvals':
            await loadPendingApplications();
            break;
        case 'credentials':
            await loadActiveCredentials();
            break;
        case 'expiring':
            await loadExpiringCredentials();
            break;
        case 'audit':
            await loadAuditLogs();
            break;
        case 'recycled':
            await loadRecycledCredentials();
            break;
    }
}

async function loadStats() {
    const stats = await api('/api/stats');
    document.getElementById('stat-pending').textContent = stats.applications.pending;
    document.getElementById('stat-approved').textContent = stats.applications.approved;
    document.getElementById('stat-active').textContent = stats.credentials.active;
    document.getElementById('stat-revoked').textContent = stats.credentials.revoked + stats.credentials.expired;
    document.getElementById('pendingCount').textContent = stats.applications.pending;
    document.getElementById('expiringCount').textContent = '...';
}

async function loadScopes() {
    const data = await api('/api/scopes');
    allowedScopes = data.scopes;
    const container = document.getElementById('scopeCheckboxes');
    container.innerHTML = allowedScopes.map(scope => `
        <div class="col-md-4">
            <div class="form-check">
                <input class="form-check-input scope-checkbox" type="checkbox" value="${scope}" id="scope-${scope}">
                <label class="form-check-label" for="scope-${scope}">${scope}</label>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.scope-checkbox').forEach(cb => {
        cb.addEventListener('change', updateScopesValue);
    });
}

function updateScopesValue() {
    const checked = Array.from(document.querySelectorAll('.scope-checkbox:checked')).map(cb => cb.value);
    document.getElementById('apiScopes').value = checked.join(',');
}

async function loadPendingApplications() {
    const apps = await api('/api/applications/pending');
    const container = document.getElementById('pendingApplicationsList');
    
    if (apps.length === 0) {
        container.innerHTML = '<div class="alert alert-info">暂无待审批申请</div>';
        return;
    }
    
    container.innerHTML = apps.map(app => `
        <div class="card card-dashboard mb-3">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h5>${app.applicant.name} <small class="text-muted">(${app.applicant.email})</small></h5>
                        <p class="text-muted mb-2">${app.applicant.company}</p>
                        <p><strong>申请权限：</strong><span class="badge bg-info">${app.api_scopes}</span></p>
                        <p><strong>有效期：</strong>${app.validity_days} 天</p>
                        <p><strong>申请理由：</strong>${app.reason}</p>
                        <small class="text-muted">申请时间：${new Date(app.created_at).toLocaleString()}</small>
                    </div>
                    <div class="d-flex flex-column gap-2">
                        <button class="btn btn-success" onclick="approveApplication(${app.id}, true)">批准</button>
                        <button class="btn btn-danger" onclick="approveApplication(${app.id}, false)">拒绝</button>
                    </div>
                </div>
                <div class="mt-3">
                    <input type="text" class="form-control" id="comment-${app.id}" placeholder="审批意见（可选）">
                </div>
            </div>
        </div>
    `).join('');
}

async function approveApplication(appId, approved) {
    const comment = document.getElementById(`comment-${appId}`)?.value || '';
    await api('/api/approvals', {
        method: 'POST',
        body: JSON.stringify({
            application_id: appId,
            approved: approved,
            reviewer_comment: comment
        })
    });
    alert(approved ? '已批准，凭证已生成' : '已拒绝');
    loadPendingApplications();
    loadStats();
}

async function loadActiveCredentials() {
    const creds = await api('/api/credentials/active');
    const container = document.getElementById('activeCredentialsList');
    
    if (creds.length === 0) {
        container.innerHTML = '<div class="alert alert-info">暂无有效凭证</div>';
        return;
    }
    
    container.innerHTML = creds.map(cred => `
        <div class="card card-dashboard mb-3">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <h5>凭证 #${cred.id}</h5>
                        <p><strong>API Key：</strong><code>${cred.api_key}</code></p>
                        <p><strong>权限范围：</strong><span class="badge bg-info">${cred.scopes}</span></p>
                        <p><strong>状态：</strong><span class="badge status-${cred.status}">${cred.status === 'active' ? '有效' : cred.status}</span></p>
                        <p><strong>签发时间：</strong>${new Date(cred.issued_at).toLocaleString()}</p>
                        <p><strong>到期时间：</strong>${new Date(cred.expires_at).toLocaleString()}</p>
                    </div>
                    <button class="btn btn-danger" onclick="revokeCredential(${cred.id})">提前撤销</button>
                </div>
                <div class="mt-3">
                    <input type="text" class="form-control" id="revoke-reason-${cred.id}" placeholder="撤销原因">
                </div>
            </div>
        </div>
    `).join('');
}

async function revokeCredential(credId) {
    const reason = document.getElementById(`revoke-reason-${credId}`)?.value || '手动撤销';
    if (!confirm('确定要撤销此凭证吗？')) return;
    
    await api('/api/credentials/revoke', {
        method: 'POST',
        body: JSON.stringify({
            credential_id: credId,
            reason: reason
        })
    });
    alert('凭证已撤销');
    loadActiveCredentials();
    loadStats();
}

async function loadExpiringCredentials() {
    const creds = await api('/api/credentials/expiring-soon');
    const container = document.getElementById('expiringCredentialsList');
    
    document.getElementById('expiringCount').textContent = creds.length;
    
    if (creds.length === 0) {
        container.innerHTML = '<div class="alert alert-info">暂无即将到期的凭证</div>';
        return;
    }
    
    container.innerHTML = creds.map(cred => `
        <div class="card card-dashboard mb-3 border-warning">
            <div class="card-body">
                <h5 class="text-warning">⚠️ 即将到期</h5>
                <p><strong>凭证 #${cred.id}</strong></p>
                <p><strong>API Key：</strong><code>${cred.api_key}</code></p>
                <p><strong>到期时间：</strong>${new Date(cred.expires_at).toLocaleString()}</p>
                <p><strong>权限范围：</strong>${cred.scopes}</p>
            </div>
        </div>
    `).join('');
}

async function loadAuditLogs() {
    const logs = await api('/api/audit-logs');
    const container = document.getElementById('auditLogsList');
    
    if (logs.length === 0) {
        container.innerHTML = '<div class="alert alert-info">暂无审计日志</div>';
        return;
    }
    
    container.innerHTML = logs.map(log => `
        <div class="audit-chain-item ${log.status === 'success' ? 'log-success' : 'log-failed'}">
            <div class="d-flex justify-content-between">
                <strong>${log.action}</strong>
                <span class="badge ${log.status === 'success' ? 'bg-success' : 'bg-danger'}">${log.status}</span>
            </div>
            <p class="mb-1">
                ${log.endpoint ? `<strong>接口：</strong>${log.method} ${log.endpoint}` : ''}
            </p>
            ${log.error_message ? `<p class="text-danger mb-1"><strong>原因：</strong>${log.error_message}</p>` : ''}
            <small class="text-muted">凭证 #${log.credential_id} | ${new Date(log.timestamp).toLocaleString()}</small>
        </div>
    `).join('');
}

async function viewAuditChain() {
    const credId = document.getElementById('filterCredentialId').value;
    if (!credId) {
        alert('请输入凭证ID');
        return;
    }
    
    const chain = await api(`/api/audit-chain/${credId}`);
    const container = document.getElementById('auditChainContent');
    document.getElementById('auditChainView').classList.remove('d-none');
    
    container.innerHTML = `
        <h6>申请人信息</h6>
        <p>姓名：${chain.applicant.name} | 邮箱：${chain.applicant.email} | 公司：${chain.applicant.company}</p>
        
        <h6>申请信息</h6>
        <p>申请权限：${chain.application.api_scopes} | 有效期：${chain.application.validity_days}天 | 状态：${chain.application.status}</p>
        
        <h6>凭证信息</h6>
        <p>API Key：<code>${chain.credential.api_key}</code> | 状态：${chain.credential.status}</p>
        <p>签发时间：${new Date(chain.credential.issued_at).toLocaleString()}</p>
        <p>到期时间：${new Date(chain.credential.expires_at).toLocaleString()}</p>
        ${chain.credential.revoked_at ? `<p>撤销时间：${new Date(chain.credential.revoked_at).toLocaleString()}</p>` : ''}
        
        <h6 class="mt-3">审计日志链路</h6>
        ${chain.audit_logs.map(log => `
            <div class="audit-chain-item ${log.status === 'success' ? 'log-success' : 'log-failed'}">
                <div class="d-flex justify-content-between">
                    <strong>${log.action}</strong>
                    <span class="badge ${log.status === 'success' ? 'bg-success' : 'bg-danger'}">${log.status}</span>
                </div>
                ${log.endpoint ? `<p class="mb-1"><strong>${log.method}</strong> ${log.endpoint}</p>` : ''}
                ${log.error_message ? `<p class="text-danger mb-1">${log.error_message}</p>` : ''}
                <small class="text-muted">${new Date(log.timestamp).toLocaleString()}</small>
            </div>
        `).join('')}
    `;
}

async function loadRecycledCredentials() {
    const creds = await api('/api/credentials/revoked');
    const container = document.getElementById('recycledCredentialsList');
    
    if (creds.length === 0) {
        container.innerHTML = '<div class="alert alert-info">暂无回收记录</div>';
        return;
    }
    
    container.innerHTML = creds.map(cred => `
        <div class="card card-dashboard mb-3">
            <div class="card-body">
                <h5>凭证 #${cred.id} <span class="badge status-${cred.status}">${cred.status === 'revoked' ? '已撤销' : '已过期'}</span></h5>
                <p><strong>API Key：</strong><code>${cred.api_key}</code></p>
                <p><strong>权限范围：</strong>${cred.scopes}</p>
                <p><strong>签发时间：</strong>${new Date(cred.issued_at).toLocaleString()}</p>
                ${cred.revoked_at ? `<p><strong>撤销时间：</strong>${new Date(cred.revoked_at).toLocaleString()}</p>` : ''}
                ${cred.revoked_reason ? `<p><strong>撤销原因：</strong>${cred.revoked_reason}</p>` : ''}
                <p><strong>到期时间：</strong>${new Date(cred.expires_at).toLocaleString()}</p>
            </div>
        </div>
    `).join('');
}

async function loadDemoData() {
    if (!confirm('确定要加载演示数据吗？这将创建四类演示场景。')) return;
    
    await createNormalApplication();
    await createScopeRejectedApplication();
    await createRevokedCredential();
    await createExpiredCredential();
    
    alert('演示数据加载完成！');
    refreshAll();
}

async function createNormalApplication() {
    await api('/api/applications', {
        method: 'POST',
        body: JSON.stringify({
            applicant_name: '张三',
            applicant_email: 'zhangsan@example.com',
            applicant_company: '外包团队A',
            api_scopes: 'users:read,orders:read',
            validity_days: 30,
            reason: '项目集成需要访问用户和订单数据进行同步'
        })
    });
}

async function createScopeRejectedApplication() {
    const app = await api('/api/applications', {
        method: 'POST',
        body: JSON.stringify({
            applicant_name: '李四',
            applicant_email: 'lisi@example.com',
            applicant_company: '外包团队B',
            api_scopes: 'users:read,admin:full,invalid:scope',
            validity_days: 14,
            reason: '申请管理员权限进行系统维护'
        })
    });
    
    await api('/api/approvals', {
        method: 'POST',
        body: JSON.stringify({
            application_id: app.id,
            approved: true,
            reviewer_comment: '测试超范围自动拒绝'
        })
    });
}

async function createRevokedCredential() {
    const app = await api('/api/applications', {
        method: 'POST',
        body: JSON.stringify({
            applicant_name: '王五',
            applicant_email: 'wangwu@example.com',
            applicant_company: '外包团队C',
            api_scopes: 'products:read,users:read',
            validity_days: 30,
            reason: '电商产品数据同步'
        })
    });
    
    const cred = await api('/api/approvals', {
        method: 'POST',
        body: JSON.stringify({
            application_id: app.id,
            approved: true,
            reviewer_comment: '批准'
        })
    });
    
    await api('/api/verify-access', {
        method: 'POST',
        body: JSON.stringify({
            api_key: cred.api_key,
            api_secret: cred.api_secret,
            endpoint: '/api/users',
            method: 'GET'
        })
    });
    
    await api('/api/verify-access', {
        method: 'POST',
        body: JSON.stringify({
            api_key: cred.api_key,
            api_secret: cred.api_secret,
            endpoint: '/api/orders',
            method: 'GET'
        })
    });
    
    await api('/api/credentials/revoke', {
        method: 'POST',
        body: JSON.stringify({
            credential_id: cred.id,
            reason: '项目提前结束，回收权限'
        })
    });
}

async function createExpiredCredential() {
    const cred = await api('/api/demo/create-expired-credential', {
        method: 'POST',
        body: JSON.stringify({
            applicant_name: '赵六',
            applicant_email: 'zhaoliu@example.com',
            applicant_company: '外包团队D',
            api_scopes: 'users:read',
            validity_days: 7,
            reason: '短期测试使用（已过期）'
        })
    });
    
    demoCredentials.expired = cred;
    
    await api('/api/verify-access', {
        method: 'POST',
        body: JSON.stringify({
            api_key: cred.api_key,
            api_secret: cred.api_secret,
            endpoint: '/api/users',
            method: 'GET'
        })
    });
}

function refreshAll() {
    loadStats();
    const activePage = document.querySelector('#navTabs .nav-link.active').dataset.page;
    loadPageData(activePage);
}

async function submitApplication(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const scopes = formData.get('api_scopes');
    if (!scopes) {
        alert('请至少选择一个权限范围');
        return;
    }
    
    try {
        await api('/api/applications', {
            method: 'POST',
            body: JSON.stringify({
                applicant_name: formData.get('applicant_name'),
                applicant_email: formData.get('applicant_email'),
                applicant_company: formData.get('applicant_company'),
                api_scopes: scopes,
                validity_days: parseInt(formData.get('validity_days')),
                reason: formData.get('reason')
            })
        });
        
        alert('申请提交成功！请等待管理员审批。');
        form.reset();
        refreshAll();
    } catch (error) {
        alert('提交失败：' + error.message);
    }
}

async function testAccess(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const resultDiv = document.getElementById('testResult');
    resultDiv.classList.remove('d-none');
    resultDiv.innerHTML = '<div class="alert alert-info">正在测试...</div>';
    
    try {
        const result = await api('/api/verify-access', {
            method: 'POST',
            body: JSON.stringify({
                api_key: formData.get('api_key'),
                api_secret: formData.get('api_secret'),
                endpoint: formData.get('endpoint'),
                method: formData.get('method')
            })
        });
        
        if (result.granted) {
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    <h6>✅ 访问授权成功</h6>
                    <p><strong>权限范围：</strong>${result.scopes?.join(', ') || 'N/A'}</p>
                    <p class="mb-0 text-muted">审计日志已记录本次访问</p>
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div class="alert alert-danger">
                    <h6>❌ 访问被拒绝</h6>
                    <p><strong>原因：</strong>${result.reason}</p>
                    <p class="mb-0 text-muted">拒绝访问已记录到审计日志</p>
                </div>
            `;
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="alert alert-warning">测试出错：${error.message}</div>`;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    showPage('dashboard');
    
    const appForm = document.getElementById('applicationForm');
    if (appForm) {
        appForm.addEventListener('submit', submitApplication);
    }
    
    const testForm = document.getElementById('testAccessForm');
    if (testForm) {
        testForm.addEventListener('submit', testAccess);
    }
});
