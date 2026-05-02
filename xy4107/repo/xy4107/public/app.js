const API_BASE = '/api';

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    refreshStats();
    refreshRecentAudit();
});

function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    if (tabName === 'users') refreshUsers();
    if (tabName === 'audit') refreshAudit();
    if (tabName === 'dashboard') {
        refreshStats();
        refreshRecentAudit();
    }
}

async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const response = await fetch(url, {
        ...defaultOptions,
        ...options,
        body: options.body ? JSON.stringify(options.body) : undefined
    });

    return response.json();
}

async function refreshStats() {
    try {
        const result = await apiCall('/audit/stats');
        if (result.success) {
            const stats = result.stats;
            const html = `
                <div class="stat-item">
                    <div class="stat-value">${stats.users.total}</div>
                    <div class="stat-label">总用户数</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${stats.users.withCredentials}</div>
                    <div class="stat-label">有凭证用户</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${stats.credentials.active}</div>
                    <div class="stat-label">活跃凭证</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${stats.audit.total}</div>
                    <div class="stat-label">审计记录</div>
                </div>
            `;
            document.getElementById('stats-grid').innerHTML = html;
        }
    } catch (e) {
        console.error('Failed to refresh stats:', e);
    }
}

function formatActionName(action) {
    const names = {
        'REGISTRATION_STARTED': '注册开始',
        'REGISTRATION_CHALLENGE_ISSUED': '注册挑战',
        'REGISTRATION_COMPLETED': '注册完成',
        'AUTHENTICATION_CHALLENGE_ISSUED': '认证挑战',
        'AUTHENTICATION_COMPLETED': '认证完成',
        'BACKUP_CODE_USED': '备用码使用',
        'CREDENTIAL_REVOKED': '凭证撤销',
        'BACKUP_CODES_REGENERATED': '备用码重生成',
        'USER_IMPORTED': '用户导入',
        'USER_DELETED': '用户删除',
        'DATA_RESET': '数据重置'
    };
    return names[action] || action;
}

function renderAuditTable(containerId, logs, limit = null) {
    const table = document.querySelector(`#${containerId} tbody`);
    if (!table) return;

    const displayLogs = limit ? logs.slice(0, limit) : logs;

    table.innerHTML = displayLogs.map(log => `
        <tr>
            <td>${log.timestamp}</td>
            <td>${log.username || '-'}</td>
            <td><span class="badge badge-info">${formatActionName(log.action)}</span></td>
            <td><span class="badge ${log.success ? 'badge-success' : 'badge-danger'}">${log.success ? '成功' : '失败'}</span></td>
            <td>${JSON.stringify(log.details || {}).substring(0, 50)}...</td>
        </tr>
    `).join('');
}

async function refreshRecentAudit() {
    try {
        const result = await apiCall('/audit');
        if (result.success) {
            renderAuditTable('recent-audit-table', result.logs, 10);
        }
    } catch (e) {
        console.error('Failed to refresh audit:', e);
    }
}

async function refreshAudit() {
    try {
        const action = document.getElementById('audit-filter-action').value;
        const startDate = document.getElementById('audit-filter-start').value;
        const endDate = document.getElementById('audit-filter-end').value;

        let endpoint = '/audit';
        const params = [];
        if (action) params.push(`action=${encodeURIComponent(action)}`);
        if (startDate) params.push(`startDate=${encodeURIComponent(startDate)}`);
        if (endDate) params.push(`endDate=${encodeURIComponent(endDate)}`);
        
        if (params.length > 0) {
            endpoint += '?' + params.join('&');
        }

        const result = await apiCall(endpoint);
        if (result.success) {
            renderAuditTable('audit-table', result.logs);
        }
    } catch (e) {
        console.error('Failed to refresh audit:', e);
    }
}

function applyAuditFilter() {
    refreshAudit();
}

async function refreshUsers() {
    try {
        const result = await apiCall('/users');
        if (result.success) {
            const table = document.querySelector('#users-table tbody');
            table.innerHTML = result.users.map(user => `
                <tr>
                    <td><strong>${user.username}</strong></td>
                    <td>${user.displayName || '-'}</td>
                    <td>${user.email || '-'}</td>
                    <td><span class="badge ${user.hasCredentials ? 'badge-success' : 'badge-warning'}">${user.hasCredentials ? '已注册' : '待注册'}</span></td>
                    <td>${user.credentialCount || 0}</td>
                    <td>${user.createdAt || '-'}</td>
                    <td>
                        <div class="action-links">
                            <button class="action-link view" onclick="viewUserDetails('${user.id}')">查看</button>
                            ${user.credentialCount > 0 ? `<button class="action-link" onclick="loadUserCredentialsForRevoke('${user.id}', '${user.username}')">撤销凭证</button>` : ''}
                            <button class="action-link revoke" onclick="confirmDeleteUser('${user.id}', '${user.username}')">删除</button>
                        </div>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) {
        console.error('Failed to refresh users:', e);
    }
}

async function startRegistration() {
    const username = document.getElementById('reg-username').value.trim();
    const displayName = document.getElementById('reg-displayName').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const deviceName = document.getElementById('reg-deviceName').value.trim();
    const deviceType = document.getElementById('reg-deviceType').value;
    const useSimulation = document.getElementById('reg-useSimulation').checked;

    if (!username) {
        showResult('reg-result', '请输入用户名', false);
        return;
    }

    try {
        const result = await apiCall('/auth/register/start', {
            method: 'POST',
            body: {
                username,
                displayName: displayName || username,
                email: email || null,
                deviceInfo: {
                    name: deviceName || '演练设备',
                    type: deviceType
                },
                useSimulation
            }
        });

        if (result.success) {
            document.getElementById('reg-userId').value = result.user.id;
            document.getElementById('reg-challenge').value = result.challenge;
            
            document.getElementById('reg-info').style.display = 'none';
            document.getElementById('reg-challenge-group').style.display = 'block';
            document.getElementById('reg-userId-group').style.display = 'block';
            document.getElementById('reg-complete-btn').style.display = 'inline-flex';

            showResult('reg-result', `用户 ${result.user.username} 创建成功！挑战值已生成。`, true);
        } else {
            showResult('reg-result', result.error || '注册失败', false);
        }
    } catch (e) {
        showResult('reg-result', `错误: ${e.message}`, false);
    }
}

async function completeRegistration() {
    const userId = document.getElementById('reg-userId').value;
    const useSimulation = document.getElementById('reg-useSimulation').checked;

    try {
        const result = await apiCall('/auth/register/complete', {
            method: 'POST',
            body: {
                userId,
                useSimulation
            }
        });

        if (result.success) {
            document.getElementById('reg-credentials-card').style.display = 'block';
            
            const credHtml = `
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <h4 style="margin-bottom: 12px;">📱 凭证信息</h4>
                        <div class="result-box success">
设备名称: ${result.credential.deviceName || '未知'}
设备类型: ${result.credential.deviceType || '未知'}
凭证ID: ${result.credential.credentialID?.substring(0, 30)}...
公钥: ${result.credential.credentialPublicKey?.substring(0, 40)}...
计数器: ${result.credential.counter}
注册时间: ${result.credential.registeredAt}
                        </div>
                    </div>
                    <div>
                        <h4 style="margin-bottom: 12px;">🔑 备用码 (请妥善保存!)</h4>
                        <div class="backup-codes-grid">
                            ${result.backupCodes.map(code => `<div class="backup-code">${code}</div>`).join('')}
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('reg-credentials-display').innerHTML = credHtml;

            showResult('reg-result', '注册完成！凭证和备用码已生成。', true);
            refreshStats();
            refreshRecentAudit();
        } else {
            showResult('reg-result', result.error || '完成注册失败', false);
        }
    } catch (e) {
        showResult('reg-result', `错误: ${e.message}`, false);
    }
}

async function startLogin() {
    const username = document.getElementById('login-username').value.trim();
    const useSimulation = document.getElementById('login-useSimulation').checked;

    if (!username) {
        showResult('login-result', '请输入用户名', false);
        return;
    }

    try {
        const result = await apiCall('/auth/login/start', {
            method: 'POST',
            body: { username, useSimulation }
        });

        if (result.success) {
            document.getElementById('login-userId').value = result.user.id;
            document.getElementById('login-challenge').value = result.challenge;

            const credSelect = document.getElementById('login-credentialId');
            credSelect.innerHTML = '<option value="">请选择...</option>' +
                result.availableCredentials.map(c => 
                    `<option value="${c.id}">${c.deviceName} (${c.deviceType})</option>`
                ).join('');

            document.getElementById('login-info').style.display = 'none';
            document.getElementById('login-userId-group').style.display = 'block';
            document.getElementById('login-credentials-group').style.display = 'block';
            document.getElementById('login-challenge-group').style.display = 'block';
            document.getElementById('login-complete-btn').style.display = 'inline-flex';

            showResult('login-result', `找到用户 ${result.user.username}，挑战值已生成。`, true);
        } else {
            showResult('login-result', result.error || '登录失败', false);
        }
    } catch (e) {
        showResult('login-result', `错误: ${e.message}`, false);
    }
}

async function completeLogin() {
    const userId = document.getElementById('login-userId').value;
    const credentialId = document.getElementById('login-credentialId').value;
    const useSimulation = document.getElementById('login-useSimulation').checked;

    if (!credentialId) {
        showResult('login-result', '请选择凭证设备', false);
        return;
    }

    try {
        const result = await apiCall('/auth/login/complete', {
            method: 'POST',
            body: {
                userId,
                credentialId,
                useSimulation
            }
        });

        if (result.success) {
            showResult('login-result', `登录成功！用户: ${result.user.username}, 设备: ${result.credential.deviceName}`, true);
            refreshStats();
            refreshRecentAudit();
        } else {
            showResult('login-result', result.error || '登录失败', false);
        }
    } catch (e) {
        showResult('login-result', `错误: ${e.message}`, false);
    }
}

async function loginWithBackupCode() {
    const userId = document.getElementById('backup-userId').value.trim();
    const code = document.getElementById('backup-code').value.trim().toUpperCase();

    if (!userId || !code) {
        showResult('login-result', '请输入用户ID和备用码', false);
        return;
    }

    try {
        const result = await apiCall('/auth/login/backup-code', {
            method: 'POST',
            body: { userId, code }
        });

        if (result.success) {
            showResult('login-result', `备用码登录成功！剩余备用码: ${result.remainingCodes} 个`, true);
            refreshStats();
            refreshRecentAudit();
        } else {
            showResult('login-result', result.error || '备用码验证失败', false);
        }
    } catch (e) {
        showResult('login-result', `错误: ${e.message}`, false);
    }
}

async function loadCredentialsForRevoke() {
    const username = prompt('请输入用户名:');
    if (!username) return;

    try {
        const result = await apiCall('/users');
        if (result.success) {
            const user = result.users.find(u => u.username === username);
            if (user) {
                loadUserCredentialsForRevoke(user.id, user.username);
            } else {
                alert('未找到该用户');
            }
        }
    } catch (e) {
        alert('加载失败: ' + e.message);
    }
}

async function loadUserCredentialsForRevoke(userId, username) {
    try {
        const result = await apiCall(`/users/${userId}`);
        if (result.success) {
            const credSelect = document.getElementById('revoke-credentialId');
            const credentials = result.user.credentials.filter(c => c.isActive);
            
            if (credentials.length === 0) {
                alert(`用户 ${username} 没有活跃的凭证`);
                return;
            }

            credSelect.innerHTML = credentials.map(c => 
                `<option value="${c.id}">${c.deviceName || '未知设备'} (${c.deviceType || '未知'})</option>`
            ).join('');

            switchTab('login');
        }
    } catch (e) {
        alert('加载失败: ' + e.message);
    }
}

async function revokeCredential() {
    const credentialId = document.getElementById('revoke-credentialId').value;
    const reason = document.getElementById('revoke-reason').value.trim();

    if (!credentialId) {
        showResult('revoke-result', '请选择要撤销的凭证', false);
        return;
    }

    if (!confirm('确定要撤销该凭证吗？撤销后该设备将无法登录。')) {
        return;
    }

    try {
        const result = await apiCall(`/auth/credentials/${credentialId}/revoke`, {
            method: 'POST',
            body: { reason: reason || '管理员撤销' }
        });

        if (result.success) {
            showResult('revoke-result', '凭证已撤销！该设备将无法再用于登录。', true);
            refreshStats();
            refreshRecentAudit();
            refreshUsers();
        } else {
            showResult('revoke-result', result.error || '撤销失败', false);
        }
    } catch (e) {
        showResult('revoke-result', `错误: ${e.message}`, false);
    }
}

function handleCsvSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('import-csv-content').value = e.target.result;
    };
    reader.readAsText(file);
}

async function importUsers() {
    const csvContent = document.getElementById('import-csv-content').value.trim();
    
    if (!csvContent) {
        showResult('import-result', '请选择文件或粘贴 CSV 内容', false);
        return;
    }

    try {
        const result = await apiCall('/audit/import/users', {
            method: 'POST',
            body: { csvContent }
        });

        if (result.success) {
            showResult('import-result', 
                `导入完成！总计: ${result.total}, 成功: ${result.imported}, 失败: ${result.failed}`, 
                true);
            refreshStats();
            refreshRecentAudit();
            refreshUsers();
        } else {
            showResult('import-result', result.error || '导入失败', false);
        }
    } catch (e) {
        showResult('import-result', `错误: ${e.message}`, false);
    }
}

function clearImport() {
    document.getElementById('import-csv-content').value = '';
    document.getElementById('import-result').innerHTML = '';
}

function exportUsersCsv() {
    window.location.href = '/api/audit/export/users';
}

function exportReport() {
    window.location.href = '/api/audit/export/report';
}

function exportAuditPackage() {
    window.location.href = '/api/audit/export/audit';
}

async function loadSampleData() {
    if (!confirm('确定要加载示例数据吗？这将添加示例用户、凭证和审计记录。')) {
        return;
    }

    try {
        const sampleUsers = [
            { username: 'admin', displayName: '系统管理员', email: 'admin@example.com' },
            { username: 'zhangsan', displayName: '张三', email: 'zhangsan@example.com' },
            { username: 'lisi', displayName: '李四', email: 'lisi@example.com' }
        ];

        for (const userData of sampleUsers) {
            try {
                const createResult = await apiCall('/users', {
                    method: 'POST',
                    body: userData
                });

                if (createResult.success) {
                    const regResult = await apiCall('/auth/register/start', {
                        method: 'POST',
                        body: {
                            username: userData.username,
                            deviceInfo: {
                                name: userData.username === 'admin' ? 'MacBook Pro (管理员)' : 'iPhone 15',
                                type: 'platform'
                            },
                            useSimulation: true
                        }
                    });

                    if (regResult.success) {
                        await apiCall('/auth/register/complete', {
                            method: 'POST',
                            body: {
                                userId: regResult.user.id,
                                useSimulation: true
                            }
                        });
                    }
                }
            } catch (e) {
                console.error('Failed to create sample user:', e);
            }
        }

        showResult('sample-result', '示例数据加载成功！', true);
        refreshStats();
        refreshRecentAudit();
        refreshUsers();
    } catch (e) {
        showResult('sample-result', `加载失败: ${e.message}`, false);
    }
}

function confirmReset() {
    if (confirm('⚠️ 确定要重置所有数据吗？这将删除所有用户、凭证和审计记录！此操作不可撤销。')) {
        resetAllData();
    }
}

async function resetAllData() {
    try {
        const result = await apiCall('/audit/reset', { method: 'POST' });
        if (result.success) {
            alert('所有数据已重置！');
            refreshStats();
            refreshRecentAudit();
            refreshUsers();
        } else {
            alert('重置失败: ' + result.error);
        }
    } catch (e) {
        alert('重置失败: ' + e.message);
    }
}

async function viewUserDetails(userId) {
    try {
        const result = await apiCall(`/users/${userId}`);
        if (result.success) {
            const user = result.user;
            const html = `
                <div style="margin-bottom: 16px;">
                    <strong>用户名:</strong> ${user.username}<br>
                    <strong>显示名称:</strong> ${user.displayName || '-'}<br>
                    <strong>邮箱:</strong> ${user.email || '-'}<br>
                    <strong>状态:</strong> ${user.state || '初始'}<br>
                    <strong>活跃凭证:</strong> ${user.activeCredentialCount} 个<br>
                    <strong>剩余备用码:</strong> ${user.remainingBackupCodes} 个<br>
                    <strong>创建时间:</strong> ${user.createdAt}<br>
                    <strong>最后登录:</strong> ${user.lastLoginAt || '从未'}
                </div>
                
                <h4 style="margin-bottom: 12px;">凭证列表</h4>
                ${user.credentials.length > 0 ? `
                <table style="width:100%; font-size:0.85rem;">
                    <thead>
                        <tr>
                            <th>设备名称</th>
                            <th>类型</th>
                            <th>状态</th>
                            <th>注册时间</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${user.credentials.map(c => `
                            <tr>
                                <td>${c.deviceName || '未知'}</td>
                                <td>${c.deviceType || '未知'}</td>
                                <td><span class="badge ${c.isActive ? 'badge-success' : 'badge-danger'}">${c.isActive ? '活跃' : '已撤销'}</span></td>
                                <td>${c.registeredAt || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                ` : '<p>暂无凭证</p>'}
                
                <div style="margin-top: 20px;">
                    ${user.remainingBackupCodes > 0 ? `
                    <button class="btn btn-warning" onclick="regenerateBackupCodes('${userId}')">🔄 重新生成备用码</button>
                    ` : ''}
                </div>
            `;
            
            showModal(`用户详情: ${user.username}`, html);
        }
    } catch (e) {
        alert('获取用户详情失败: ' + e.message);
    }
}

async function regenerateBackupCodes(userId) {
    if (!confirm('确定要重新生成备用码吗？原有的备用码将全部失效！')) {
        return;
    }

    try {
        const result = await apiCall(`/auth/users/${userId}/backup-codes/regenerate`, {
            method: 'POST'
        });

        if (result.success) {
            const html = `
                <div class="alert alert-warning">
                    <strong>重要：</strong>请立即保存以下备用码！关闭后将无法再次查看。
                </div>
                <div class="backup-codes-grid">
                    ${result.backupCodes.map(code => `<div class="backup-code">${code}</div>`).join('')}
                </div>
            `;
            showModal('新的备用码', html);
            refreshStats();
            refreshRecentAudit();
        } else {
            alert('重新生成失败: ' + result.error);
        }
    } catch (e) {
        alert('重新生成失败: ' + e.message);
    }
}

function confirmDeleteUser(userId, username) {
    if (confirm(`确定要删除用户 "${username}" 吗？该用户的所有凭证和备用码都将被撤销。`)) {
        deleteUser(userId);
    }
}

async function deleteUser(userId) {
    try {
        const result = await apiCall(`/users/${userId}`, { method: 'DELETE' });
        if (result.success) {
            refreshUsers();
            refreshStats();
            refreshRecentAudit();
        } else {
            alert('删除失败: ' + result.error);
        }
    } catch (e) {
        alert('删除失败: ' + e.message);
    }
}

function showResult(containerId, message, isSuccess) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = `<div class="result-box ${isSuccess ? 'success' : 'error'}">${message}</div>`;
    }
}

function showModal(title, body) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal').classList.add('active');
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

document.getElementById('modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal') {
        closeModal();
    }
});
