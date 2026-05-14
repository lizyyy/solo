const API_BASE = 'http://localhost:3001/api';

let tenants = [];
let apiGroups = [];
let quotas = [];
let events = [];

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadAll();
});

function initTabs() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });
}

async function loadAll() {
    await Promise.all([
        loadTenants(),
        loadApiGroups(),
        loadQuotas(),
        loadEvents(),
        loadCompensations(),
        loadBilling(),
        loadOverview()
    ]);
}

function refreshAll() {
    loadAll();
}

async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        const data = await response.json();
        return { ok: response.ok, data };
    } catch (err) {
        console.error('API Error:', err);
        return { ok: false, data: { error: '网络错误' } };
    }
}

async function loadOverview() {
    const result = await apiCall('/rate-limit/overview');
    if (result.ok) {
        document.getElementById('stat-tenants').textContent = result.data.total_tenants || 0;
        document.getElementById('stat-pending').textContent = result.data.pending_events || 0;
        document.getElementById('stat-today').textContent = result.data.total_events_today || 0;
        document.getElementById('stat-compensation').textContent = result.data.total_compensation || 0;
    }
}

async function loadTenants() {
    const result = await apiCall('/tenants');
    if (result.ok) {
        tenants = result.data;
        renderTenants();
        updateTenantSelects();
    }
}

function renderTenants() {
    const table = document.getElementById('tenants-table');
    if (!tenants.length) {
        table.innerHTML = '<div class="empty-state">暂无租户数据</div>';
        return;
    }
    
    table.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>租户名称</th>
                    <th>联系邮箱</th>
                    <th>状态</th>
                    <th>创建时间</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                ${tenants.map(t => `
                    <tr>
                        <td>${t.name}</td>
                        <td>${t.contact_email || '-'}</td>
                        <td><span class="badge ${t.status === 'active' ? 'badge-success' : 'badge-warning'}">${t.status === 'active' ? '活跃' : '停用'}</span></td>
                        <td>${formatDate(t.created_at)}</td>
                        <td>
                            <button class="btn btn-secondary" onclick="toggleTenantStatus('${t.id}', '${t.status}')">
                                ${t.status === 'active' ? '停用' : '启用'}
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function loadApiGroups() {
    const result = await apiCall('/api-groups');
    if (result.ok) {
        apiGroups = result.data;
        updateGroupSelects();
    }
}

async function loadQuotas() {
    const result = await apiCall('/quotas');
    if (result.ok) {
        quotas = result.data;
        renderQuotas();
    }
}

function renderQuotas() {
    const table = document.getElementById('quotas-table');
    if (!quotas.length) {
        table.innerHTML = '<div class="empty-state">暂无配额配置</div>';
        return;
    }
    
    table.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>租户</th>
                    <th>接口分组</th>
                    <th>日配额</th>
                    <th>剩余日配额</th>
                    <th>月配额</th>
                    <th>剩余月配额</th>
                </tr>
            </thead>
            <tbody>
                ${quotas.map(q => `
                    <tr>
                        <td>${q.tenant_name || '-'}</td>
                        <td>${q.api_group_name || '-'}</td>
                        <td>${q.daily_quota}</td>
                        <td><span class="badge ${q.remaining_daily < 100 ? 'badge-warning' : 'badge-info'}">${q.remaining_daily}</span></td>
                        <td>${q.monthly_quota}</td>
                        <td><span class="badge ${q.remaining_monthly < 1000 ? 'badge-warning' : 'badge-info'}">${q.remaining_monthly}</span></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function loadEvents() {
    const tenantFilter = document.getElementById('event-tenant-filter')?.value || '';
    const statusFilter = document.getElementById('event-status-filter')?.value;
    
    let url = '/rate-limit/events?limit=50';
    if (tenantFilter) url += `&tenant_id=${tenantFilter}`;
    if (statusFilter !== '' && statusFilter !== undefined) url += `&resolved=${statusFilter}`;
    
    const result = await apiCall(url);
    if (result.ok) {
        events = result.data;
        renderEvents();
        renderRecentEvents();
        updateEventSelects();
    }
}

function renderEvents() {
    const table = document.getElementById('events-table');
    if (!events.length) {
        table.innerHTML = '<div class="empty-state">暂无限流事件</div>';
        return;
    }
    
    table.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>时间</th>
                    <th>租户</th>
                    <th>接口分组</th>
                    <th>事件类型</th>
                    <th>原因</th>
                    <th>状态</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                ${events.map(e => `
                    <tr>
                        <td>${formatDate(e.triggered_at)}</td>
                        <td>${e.tenant_name || '-'}</td>
                        <td>${e.api_group_name || '-'}</td>
                        <td><span class="badge badge-danger">${e.event_type}</span></td>
                        <td>${e.reason}</td>
                        <td><span class="badge ${e.resolved ? 'badge-success' : 'badge-warning'}">${e.resolved ? '已处理' : '未处理'}</span></td>
                        <td>
                            ${!e.resolved ? `
                                <button class="btn btn-success" onclick="resolveEvent('${e.id}')">标记已处理</button>
                            ` : e.resolved_by ? `<small>处理人: ${e.resolved_by}</small>` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderRecentEvents() {
    const table = document.getElementById('recent-events-table');
    const recent = events.slice(0, 5);
    
    if (!recent.length) {
        table.innerHTML = '<div class="empty-state">暂无限流事件</div>';
        return;
    }
    
    table.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>时间</th>
                    <th>租户</th>
                    <th>事件类型</th>
                    <th>原因</th>
                    <th>状态</th>
                </tr>
            </thead>
            <tbody>
                ${recent.map(e => `
                    <tr>
                        <td>${formatDate(e.triggered_at)}</td>
                        <td>${e.tenant_name || '-'}</td>
                        <td><span class="badge badge-danger">${e.event_type}</span></td>
                        <td>${e.reason}</td>
                        <td><span class="badge ${e.resolved ? 'badge-success' : 'badge-warning'}">${e.resolved ? '已处理' : '未处理'}</span></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function loadCompensations() {
    const result = await apiCall('/rate-limit/compensations?limit=50');
    if (result.ok) {
        renderCompensations(result.data);
    }
}

function renderCompensations(data) {
    const table = document.getElementById('compensations-table');
    if (!data.length) {
        table.innerHTML = '<div class="empty-state">暂无补偿记录</div>';
        return;
    }
    
    table.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>时间</th>
                    <th>租户</th>
                    <th>接口分组</th>
                    <th>补偿额度</th>
                    <th>原因</th>
                    <th>操作人</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(c => `
                    <tr>
                        <td>${formatDate(c.created_at)}</td>
                        <td>${c.tenant_name || '-'}</td>
                        <td>${c.api_group_name || '-'}</td>
                        <td><span class="badge badge-success">+${c.amount}</span></td>
                        <td>${c.reason}</td>
                        <td>${c.operator}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function loadBilling() {
    const result = await apiCall('/rate-limit/billing');
    if (result.ok) {
        renderBilling(result.data);
    }
}

function renderBilling(data) {
    const table = document.getElementById('billing-table');
    if (!data.length) {
        table.innerHTML = '<div class="empty-state">暂无账单记录</div>';
        return;
    }
    
    table.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>租户</th>
                    <th>周期类型</th>
                    <th>周期开始</th>
                    <th>周期结束</th>
                    <th>总调用</th>
                    <th>限流次数</th>
                    <th>补偿额度</th>
                    <th>状态</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(b => `
                    <tr>
                        <td>${b.tenant_name || '-'}</td>
                        <td><span class="badge badge-info">${b.period_type}</span></td>
                        <td>${formatDate(b.period_start)}</td>
                        <td>${formatDate(b.period_end)}</td>
                        <td>${b.total_calls}</td>
                        <td><span class="badge badge-danger">${b.limited_calls}</span></td>
                        <td><span class="badge badge-success">+${b.compensation_amount}</span></td>
                        <td><span class="badge ${b.exported ? 'badge-success' : 'badge-warning'}">${b.exported ? '已导出' : '待导出'}</span></td>
                        <td>
                            <button class="btn btn-primary" onclick="exportBilling('${b.id}')">导出CSV</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function updateTenantSelects() {
    const selects = ['quota-tenant', 'compensate-tenant', 'call-tenant', 'billing-tenant', 'event-tenant-filter'];
    selects.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            const hasEmpty = select.querySelector('option[value=""]');
            select.innerHTML = hasEmpty ? '<option value="">全部租户</option>' : '';
            tenants.forEach(t => {
                select.innerHTML += `<option value="${t.id}">${t.name}</option>`;
            });
        }
    });
}

function updateGroupSelects() {
    const selects = ['quota-group'];
    selects.forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            select.innerHTML = '';
            apiGroups.forEach(g => {
                select.innerHTML += `<option value="${g.id}">${g.name}</option>`;
            });
        }
    });
}

function updateEventSelects() {
    const select = document.getElementById('compensate-event');
    if (select) {
        const tenantId = document.getElementById('compensate-tenant')?.value;
        const unresovled = events.filter(e => !e.resolved && (!tenantId || e.tenant_id === tenantId));
        select.innerHTML = '<option value="">无</option>';
        unresovled.forEach(e => {
            select.innerHTML += `<option value="${e.id}">${formatDate(e.triggered_at)} - ${e.reason}</option>`;
        });
    }
}

async function loadQuotaGroups() {
    const tenantId = document.getElementById('compensate-tenant')?.value;
    if (!tenantId) return;
    
    const result = await apiCall(`/quotas/tenant/${tenantId}`);
    if (result.ok) {
        const select = document.getElementById('compensate-group');
        if (select) {
            select.innerHTML = '';
            result.data.forEach(q => {
                select.innerHTML += `<option value="${q.api_group_id}">${q.api_group_name || q.api_group_id}</option>`;
            });
        }
    }
    updateEventSelects();
}

async function loadCallGroups() {
    const tenantId = document.getElementById('call-tenant')?.value;
    if (!tenantId) return;
    
    const result = await apiCall(`/quotas/tenant/${tenantId}`);
    if (result.ok) {
        const select = document.getElementById('call-group');
        if (select) {
            select.innerHTML = '';
            result.data.forEach(q => {
                select.innerHTML += `<option value="${q.api_group_id}">${q.api_group_name || q.api_group_id}</option>`;
            });
        }
    }
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function openTenantModal() {
    document.getElementById('tenant-modal').classList.add('active');
    document.getElementById('tenant-name').value = '';
    document.getElementById('tenant-email').value = '';
}

async function createTenant(e) {
    e.preventDefault();
    const name = document.getElementById('tenant-name').value;
    const contact_email = document.getElementById('tenant-email').value;
    
    const result = await apiCall('/tenants', {
        method: 'POST',
        body: JSON.stringify({ name, contact_email })
    });
    
    if (result.ok) {
        closeModal('tenant-modal');
        loadTenants();
        loadOverview();
    } else {
        alert('创建失败: ' + (result.data.error || '未知错误'));
    }
}

async function toggleTenantStatus(id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const result = await apiCall(`/tenants/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
    });
    
    if (result.ok) {
        loadTenants();
    }
}

function openQuotaModal() {
    document.getElementById('quota-modal').classList.add('active');
    document.getElementById('quota-daily').value = 1000;
    document.getElementById('quota-monthly').value = 30000;
}

async function createQuota(e) {
    e.preventDefault();
    const tenant_id = document.getElementById('quota-tenant').value;
    const api_group_id = document.getElementById('quota-group').value;
    const daily_quota = parseInt(document.getElementById('quota-daily').value);
    const monthly_quota = parseInt(document.getElementById('quota-monthly').value);
    
    const result = await apiCall('/quotas', {
        method: 'POST',
        body: JSON.stringify({ tenant_id, api_group_id, daily_quota, monthly_quota })
    });
    
    if (result.ok) {
        closeModal('quota-modal');
        loadQuotas();
    } else {
        alert('创建失败: ' + (result.data.error || '未知错误'));
    }
}

function openCompensateModal() {
    document.getElementById('compensate-modal').classList.add('active');
    document.getElementById('compensate-amount').value = '';
    document.getElementById('compensate-reason').value = '';
    document.getElementById('compensate-operator').value = '';
    updateEventSelects();
}

async function createCompensation(e) {
    e.preventDefault();
    const tenant_id = document.getElementById('compensate-tenant').value;
    const api_group_id = document.getElementById('compensate-group').value;
    const amount = parseInt(document.getElementById('compensate-amount').value);
    const reason = document.getElementById('compensate-reason').value;
    const operator = document.getElementById('compensate-operator').value;
    const rate_limit_event_id = document.getElementById('compensate-event').value || null;
    
    const result = await apiCall('/rate-limit/compensate', {
        method: 'POST',
        body: JSON.stringify({ tenant_id, api_group_id, amount, reason, operator, rate_limit_event_id })
    });
    
    if (result.ok) {
        closeModal('compensate-modal');
        loadCompensations();
        loadQuotas();
        loadEvents();
        loadOverview();
    } else {
        alert('补偿失败: ' + (result.data.error || '未知错误'));
    }
}

function simulateCall() {
    document.getElementById('call-modal').classList.add('active');
    document.getElementById('call-result').innerHTML = '';
}

async function doSimulateCall(e) {
    e.preventDefault();
    const tenant_id = document.getElementById('call-tenant').value;
    const api_group_id = document.getElementById('call-group').value;
    const window_size = parseInt(document.getElementById('call-window').value);
    
    const result = await apiCall('/rate-limit/record', {
        method: 'POST',
        body: JSON.stringify({ tenant_id, api_group_id, window_size })
    });
    
    const resultDiv = document.getElementById('call-result');
    if (result.ok && result.data.success) {
        resultDiv.innerHTML = `
            <div class="alert alert-success">
                <strong>调用成功!</strong><br>
                窗口调用次数: ${result.data.windowCallCount}<br>
                剩余日配额: ${result.data.remainingDaily}<br>
                剩余月配额: ${result.data.remainingMonthly}
            </div>
        `;
    } else {
        resultDiv.innerHTML = `
            <div class="alert alert-error">
                <strong>调用被限流!</strong><br>
                原因: ${result.data.reason || result.data.error}<br>
                消息: ${result.data.message || ''}
            </div>
        `;
    }
    
    loadQuotas();
    loadEvents();
    loadOverview();
}

async function resolveEvent(id) {
    const operator = prompt('请输入操作人姓名:');
    if (!operator) return;
    
    const result = await apiCall(`/rate-limit/events/${id}/resolve`, {
        method: 'PUT',
        body: JSON.stringify({ operator })
    });
    
    if (result.ok) {
        loadEvents();
        loadOverview();
    }
}

function openBillingModal() {
    document.getElementById('billing-modal').classList.add('active');
}

async function generateBilling(e) {
    e.preventDefault();
    const tenant_id = document.getElementById('billing-tenant').value;
    const period_type = document.getElementById('billing-period').value;
    
    const result = await apiCall('/rate-limit/billing/generate', {
        method: 'POST',
        body: JSON.stringify({ tenant_id, period_type })
    });
    
    if (result.ok) {
        closeModal('billing-modal');
        loadBilling();
    } else {
        alert('生成账单失败: ' + (result.data.error || '未知错误'));
    }
}

function exportBilling(id) {
    window.open(`${API_BASE}/rate-limit/billing/export/${id}`, '_blank');
    setTimeout(() => loadBilling(), 1000);
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
