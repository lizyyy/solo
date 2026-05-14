const API_BASE = 'http://localhost:5000/api';
let currentLogPage = 1;
let policies = [];
let apps = [];

document.addEventListener('DOMContentLoaded', function() {
    initTabs();
    loadStats();
    loadApps();
    loadLogs();
    loadRisks();
    loadRollback();
    loadPolicies();
});

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabId).classList.add('active');
            
            if (tabId === 'keys') {
                loadKeys();
            }
        });
    });
}

async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/dashboard/stats`);
        const data = await response.json();
        
        document.getElementById('stat-apps').textContent = data.total_apps;
        document.getElementById('stat-keys').textContent = data.active_keys;
        document.getElementById('stat-expiring').textContent = data.expiring_soon;
        document.getElementById('stat-failed').textContent = data.failed_logs;
        document.getElementById('stat-risks').textContent = data.active_risks;
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

async function loadApps() {
    try {
        const response = await fetch(`${API_BASE}/apps`);
        apps = await response.json();
        
        const tbody = document.getElementById('apps-table-body');
        tbody.innerHTML = apps.map(app => `
            <tr>
                <td><strong>${app.app_name}</strong></td>
                <td><code>${app.app_id}</code></td>
                <td>${app.owner}</td>
                <td><span class="environment-tag ${app.environment}">${app.environment}</span></td>
                <td>${app.latest_key_version || '-'}</td>
                <td>${app.expires_at ? formatDate(app.expires_at) : '-'}</td>
                <td><span class="status-badge ${app.status}">${app.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="viewAppKeys(${app.id})">查看密钥</button>
                </td>
            </tr>
        `).join('');
        
        updateAppSelects();
    } catch (error) {
        console.error('Failed to load apps:', error);
    }
}

function updateAppSelects() {
    const selects = ['key-app-filter', 'key-app-select'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            const currentValue = select.value;
            select.innerHTML = '<option value="">选择应用</option>' + 
                apps.map(app => `<option value="${app.id}">${app.app_name}</option>`).join('');
            select.value = currentValue;
        }
    });
}

async function loadPolicies() {
    try {
        const response = await fetch(`${API_BASE}/policies`);
        policies = await response.json();
        
        const select = document.getElementById('key-policy-select');
        if (select) {
            select.innerHTML = '<option value="">请选择过期策略</option>' + 
                policies.map(p => `<option value="${p.id}">${p.name} (${p.days}天)</option>`).join('');
        }
    } catch (error) {
        console.error('Failed to load policies:', error);
    }
}

async function loadKeys() {
    try {
        const appId = document.getElementById('key-app-filter').value;
        let url = `${API_BASE}/keys`;
        
        if (appId) {
            url = `${API_BASE}/apps/${appId}/keys`;
        } else {
            const allKeys = [];
            for (const app of apps) {
                const response = await fetch(`${API_BASE}/apps/${app.id}/keys`);
                const keys = await response.json();
                keys.forEach(k => {
                    k.app_name = app.app_name;
                    allKeys.push(k);
                });
            }
            
            const tbody = document.getElementById('keys-table-body');
            tbody.innerHTML = allKeys.map(key => `
                <tr>
                    <td>${key.app_name || '-'}</td>
                    <td>${key.version}</td>
                    <td><code>${key.key_prefix || '-'}</code></td>
                    <td>${getPolicyName(key.policy_id)}</td>
                    <td>${formatDate(key.created_at)}</td>
                    <td>${key.expires_at ? formatDate(key.expires_at) : '-'}</td>
                    <td><span class="status-badge ${key.status}">${key.status}</span></td>
                </tr>
            `).join('');
            return;
        }
        
        const response = await fetch(url);
        const keys = await response.json();
        const app = apps.find(a => a.id == appId);
        
        const tbody = document.getElementById('keys-table-body');
        tbody.innerHTML = keys.map(key => `
            <tr>
                <td>${app ? app.app_name : '-'}</td>
                <td>${key.version}</td>
                <td><code>${key.key_prefix || '-'}</code></td>
                <td>${getPolicyName(key.policy_id)}</td>
                <td>${formatDate(key.created_at)}</td>
                <td>${key.expires_at ? formatDate(key.expires_at) : '-'}</td>
                <td><span class="status-badge ${key.status}">${key.status}</span></td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load keys:', error);
    }
}

function getPolicyName(policyId) {
    const policy = policies.find(p => p.id == policyId);
    return policy ? policy.name : '-';
}

async function loadLogs() {
    try {
        const status = document.getElementById('log-status-filter').value;
        let url = `${API_BASE}/logs?page=${currentLogPage}&per_page=20`;
        if (status) {
            url += `&status=${status}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        const tbody = document.getElementById('logs-table-body');
        tbody.innerHTML = data.logs.map(log => `
            <tr>
                <td>${log.app_name}</td>
                <td>${log.key_version || '-'}</td>
                <td>${log.action}</td>
                <td><span class="status-badge ${log.status}">${log.status}</span></td>
                <td>${log.error_message || '-'}</td>
                <td>${log.operator || '-'}</td>
                <td>${formatDate(log.created_at)}</td>
                <td>
                    <button class="link-btn" onclick="viewLogDetail(${log.id})">查看详情</button>
                </td>
            </tr>
        `).join('');
        
        renderPagination(data.page, data.pages);
    } catch (error) {
        console.error('Failed to load logs:', error);
    }
}

function renderPagination(page, pages) {
    const pagination = document.getElementById('logs-pagination');
    let html = '';
    
    if (page > 1) {
        html += `<button onclick="goToPage(${page - 1})">上一页</button>`;
    }
    
    for (let i = 1; i <= pages; i++) {
        if (i === page) {
            html += `<button class="active">${i}</button>`;
        } else if (i === 1 || i === pages || (i >= page - 2 && i <= page + 2)) {
            html += `<button onclick="goToPage(${i})">${i}</button>`;
        } else if (i === page - 3 || i === page + 3) {
            html += `<button disabled>...</button>`;
        }
    }
    
    if (page < pages) {
        html += `<button onclick="goToPage(${page + 1})">下一页</button>`;
    }
    
    pagination.innerHTML = html;
}

function goToPage(page) {
    currentLogPage = page;
    loadLogs();
}

async function viewLogDetail(logId) {
    try {
        const response = await fetch(`${API_BASE}/logs/${logId}`);
        const log = await response.json();
        
        const content = document.getElementById('log-detail-content');
        content.innerHTML = `
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="detail-label">应用名称</div>
                    <div class="detail-value">${log.app_name}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">负责人</div>
                    <div class="detail-value">${log.app_owner || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">操作</div>
                    <div class="detail-value">${log.action}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">状态</div>
                    <div class="detail-value"><span class="status-badge ${log.status}">${log.status}</span></div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">操作人</div>
                    <div class="detail-value">${log.operator || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">操作时间</div>
                    <div class="detail-value">${formatDate(log.created_at)}</div>
                </div>
                ${log.resolved_at ? `
                <div class="detail-item">
                    <div class="detail-label">处理人</div>
                    <div class="detail-value">${log.resolved_by || '-'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">处理时间</div>
                    <div class="detail-value">${formatDate(log.resolved_at)}</div>
                </div>
                ` : ''}
                <div class="detail-item detail-full">
                    <div class="detail-label">失败原因</div>
                    <div class="detail-value">${log.error_message || '-'}</div>
                </div>
                ${log.resolution_notes ? `
                <div class="detail-item detail-full">
                    <div class="detail-label">处理备注</div>
                    <div class="detail-value">${log.resolution_notes}</div>
                </div>
                ` : ''}
            </div>
            ${log.status === 'failed' && !log.resolved_at ? `
            <div class="resolve-form">
                <div class="form-group">
                    <label>处理人：</label>
                    <input type="text" id="resolve-by" placeholder="请输入处理人姓名">
                </div>
                <div class="form-group">
                    <label>处理备注：</label>
                    <textarea id="resolve-notes" rows="3" placeholder="请输入处理备注"></textarea>
                </div>
            </div>
            ` : ''}
        `;
        
        const footer = document.getElementById('log-detail-footer');
        if (log.status === 'failed' && !log.resolved_at) {
            footer.innerHTML = `
                <button class="btn btn-secondary" onclick="closeModal('log-detail-modal')">关闭</button>
                <button class="btn btn-primary" onclick="resolveLog(${logId})">标记已处理</button>
            `;
        } else {
            footer.innerHTML = `
                <button class="btn btn-secondary" onclick="closeModal('log-detail-modal')">关闭</button>
            `;
        }
        
        showModal('log-detail-modal');
    } catch (error) {
        console.error('Failed to load log detail:', error);
    }
}

async function resolveLog(logId) {
    try {
        const resolvedBy = document.getElementById('resolve-by').value;
        const resolutionNotes = document.getElementById('resolve-notes').value;
        
        if (!resolvedBy || !resolutionNotes) {
            showToast('请填写处理人和处理备注', 'warning');
            return;
        }
        
        const response = await fetch(`${API_BASE}/logs/${logId}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolved_by: resolvedBy, resolution_notes: resolutionNotes })
        });
        
        if (response.ok) {
            showToast('问题已标记为处理', 'success');
            closeModal('log-detail-modal');
            loadLogs();
            loadStats();
        }
    } catch (error) {
        console.error('Failed to resolve log:', error);
        showToast('处理失败', 'error');
    }
}

async function loadRisks() {
    try {
        const response = await fetch(`${API_BASE}/risks`);
        const risks = await response.json();
        
        const tbody = document.getElementById('risks-table-body');
        tbody.innerHTML = risks.map(risk => `
            <tr>
                <td>${risk.app_name}</td>
                <td>${risk.risk_type}</td>
                <td><span class="severity-${risk.severity}">${risk.severity}</span></td>
                <td>${risk.description}</td>
                <td>${risk.owner || '-'}</td>
                <td><span class="status-badge ${risk.status}">${risk.status}</span></td>
                <td>${formatDate(risk.created_at)}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load risks:', error);
    }
}

function exportRisks() {
    window.location.href = `${API_BASE}/risks/export`;
    showToast('正在导出风险清单...', 'success');
}

async function loadRollback() {
    try {
        const response = await fetch(`${API_BASE}/rollback`);
        const switches = await response.json();
        
        const tbody = document.getElementById('rollback-table-body');
        tbody.innerHTML = switches.map(sw => `
            <tr>
                <td>${sw.app_name || '-'}</td>
                <td><span class="status-badge ${sw.enabled}">${sw.enabled ? '开启' : '关闭'}</span></td>
                <td>${sw.reason || '-'}</td>
                <td>${sw.operator || '-'}</td>
                <td>${formatDate(sw.updated_at)}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="showRollbackModal(${sw.app_id}, ${sw.enabled}, '${sw.reason || ''}')">设置</button>
                </td>
            </tr>
        `).join('');
        
        const existingAppIds = switches.map(sw => sw.app_id);
        apps.forEach(app => {
            if (!existingAppIds.includes(app.id)) {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${app.app_name}</td>
                    <td><span class="status-badge false">关闭</span></td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>
                        <button class="btn btn-sm btn-secondary" onclick="showRollbackModal(${app.id}, false, '')">设置</button>
                    </td>
                `;
                tbody.appendChild(row);
            }
        });
    } catch (error) {
        console.error('Failed to load rollback:', error);
    }
}

function showRollbackModal(appId, enabled, reason) {
    document.getElementById('rollback-app-id').value = appId;
    document.getElementById('rollback-enabled').value = enabled;
    document.getElementById('rollback-reason').value = reason;
    document.getElementById('rollback-operator').value = '';
    showModal('rollback-modal');
}

async function saveRollback() {
    try {
        const appId = document.getElementById('rollback-app-id').value;
        const enabled = document.getElementById('rollback-enabled').value === 'true';
        const reason = document.getElementById('rollback-reason').value;
        const operator = document.getElementById('rollback-operator').value;
        
        if (!operator) {
            showToast('请输入操作人姓名', 'warning');
            return;
        }
        
        const response = await fetch(`${API_BASE}/rollback/${appId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled, reason, operator })
        });
        
        if (response.ok) {
            showToast('回滚开关设置成功', 'success');
            closeModal('rollback-modal');
            loadRollback();
            loadLogs();
        }
    } catch (error) {
        console.error('Failed to save rollback:', error);
        showToast('设置失败', 'error');
    }
}

async function checkExpiringKeys() {
    try {
        const response = await fetch(`${API_BASE}/check-expiring`, {
            method: 'POST'
        });
        const data = await response.json();
        
        showToast(`发现 ${data.count} 个即将过期的密钥`, data.count > 0 ? 'warning' : 'success');
        loadStats();
        loadRisks();
    } catch (error) {
        console.error('Failed to check expiring keys:', error);
    }
}

function showImportModal() {
    document.getElementById('import-data').value = '';
    showModal('import-modal');
}

function loadSampleData() {
    const sample = JSON.stringify([
        {
            "app_name": "用户认证服务",
            "app_id": "auth-service-001",
            "owner": "张三",
            "owner_email": "zhangsan@example.com",
            "environment": "production"
        },
        {
            "app_name": "支付网关",
            "app_id": "payment-gateway-002",
            "owner": "李四",
            "owner_email": "lisi@example.com",
            "environment": "production"
        },
        {
            "app_name": "订单服务",
            "app_id": "order-service-003",
            "owner": "王五",
            "owner_email": "wangwu@example.com",
            "environment": "staging"
        }
    ], null, 2);
    document.getElementById('import-data').value = sample;
}

async function batchImportApps() {
    try {
        const data = document.getElementById('import-data').value;
        const apps = JSON.parse(data);
        
        const response = await fetch(`${API_BASE}/apps/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apps })
        });
        
        const result = await response.json();
        showToast(`成功导入 ${result.success} 个应用，失败 ${result.failed} 个`, result.failed > 0 ? 'warning' : 'success');
        
        if (result.errors && result.errors.length > 0) {
            console.warn('Import errors:', result.errors);
        }
        
        closeModal('import-modal');
        loadApps();
        loadStats();
    } catch (error) {
        console.error('Failed to import apps:', error);
        showToast('导入失败，请检查JSON格式', 'error');
    }
}

function showAddAppModal() {
    document.getElementById('app-name').value = '';
    document.getElementById('app-id').value = '';
    document.getElementById('app-owner').value = '';
    document.getElementById('app-owner-email').value = '';
    document.getElementById('app-environment').value = 'production';
    showModal('add-app-modal');
}

async function addApp() {
    try {
        const appName = document.getElementById('app-name').value;
        const appId = document.getElementById('app-id').value;
        const owner = document.getElementById('app-owner').value;
        const ownerEmail = document.getElementById('app-owner-email').value;
        const environment = document.getElementById('app-environment').value;
        
        if (!appName || !appId || !owner || !ownerEmail) {
            showToast('请填写所有必填字段', 'warning');
            return;
        }
        
        const response = await fetch(`${API_BASE}/apps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                app_name: appName,
                app_id: appId,
                owner: owner,
                owner_email: ownerEmail,
                environment: environment
            })
        });
        
        if (response.ok) {
            showToast('应用添加成功', 'success');
            closeModal('add-app-modal');
            loadApps();
            loadStats();
        }
    } catch (error) {
        console.error('Failed to add app:', error);
        showToast('添加失败', 'error');
    }
}

function showAddKeyModal() {
    document.getElementById('key-prefix').value = '';
    document.getElementById('key-app-select').value = '';
    document.getElementById('key-policy-select').value = '';
    showModal('add-key-modal');
}

async function addKey() {
    try {
        const appId = document.getElementById('key-app-select').value;
        const keyPrefix = document.getElementById('key-prefix').value;
        const policyId = document.getElementById('key-policy-select').value;
        
        if (!appId || !keyPrefix || !policyId) {
            showToast('请填写所有必填字段', 'warning');
            return;
        }
        
        const response = await fetch(`${API_BASE}/apps/${appId}/keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                key_prefix: keyPrefix,
                policy_id: parseInt(policyId)
            })
        });
        
        if (response.ok) {
            showToast('密钥创建成功', 'success');
            closeModal('add-key-modal');
            loadKeys();
            loadApps();
            loadStats();
        }
    } catch (error) {
        console.error('Failed to add key:', error);
        showToast('创建失败', 'error');
    }
}

function viewAppKeys(appId) {
    document.getElementById('key-app-filter').value = appId;
    document.querySelector('[data-tab="keys"]').click();
}

function showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

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

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === this) {
            this.classList.remove('show');
        }
    });
});
