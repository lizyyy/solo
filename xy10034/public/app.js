const API_BASE = 'http://localhost:3000/api';

let currentPage = 1;
const pageSize = 20;
let pendingRequests = new Map();

const userId = 'user_' + Math.random().toString(36).substr(2, 9);

class HttpClient {
    static async request(method, url, options = {}) {
        const requestId = options.requestId || this.generateRequestId();
        const maxRetries = options.maxRetries || 3;
        const retryDelay = options.retryDelay || 1000;
        
        let lastError;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await fetch(url, {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Request-Id': requestId,
                        'X-User-Id': userId,
                        ...options.headers
                    },
                    body: options.body ? JSON.stringify(options.body) : undefined
                });

                const data = await response.json();
                
                if (!response.ok) {
                    if (response.status === 409) {
                        throw new Error('数据已被其他用户修改，请刷新后重试');
                    }
                    throw new Error(data.message || '请求失败');
                }

                return data;
            } catch (error) {
                lastError = error;
                
                if (error.message.includes('数据已被其他用户修改')) {
                    throw error;
                }
                
                if (attempt < maxRetries - 1) {
                    console.warn(`请求重试 ${attempt + 1}/${maxRetries}: ${url}`);
                    await this.sleep(retryDelay * Math.pow(2, attempt));
                }
            }
        }
        
        throw lastError;
    }

    static async get(url, options = {}) {
        return this.request('GET', url, options);
    }

    static async post(url, body, options = {}) {
        return this.request('POST', url, { ...options, body });
    }

    static async put(url, body, options = {}) {
        return this.request('PUT', url, { ...options, body });
    }

    static async delete(url, options = {}) {
        return this.request('DELETE', url, options);
    }

    static generateRequestId() {
        return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function formatStatus(status) {
    const statusMap = {
        'pending': '待处理',
        'processed': '已处理',
        'ignored': '已忽略'
    };
    return statusMap[status] || status;
}

function formatSourceType(type) {
    const typeMap = {
        'file': '文件',
        'database': '数据库',
        'api': 'API',
        'other': '其他'
    };
    return typeMap[type] || type;
}

function formatAction(action) {
    const actionMap = {
        'CREATE_LOG': '创建日志',
        'UPDATE_LOG': '更新日志',
        'DELETE_LOG': '删除日志',
        'GENERATE_REPORT': '生成日志报告',
        'GENERATE_AUDIT_REPORT': '生成审计报告',
        'GENERATE_STATS_REPORT': '生成统计报告',
        'EXPORT_CSV': '导出CSV'
    };
    return actionMap[action] || action;
}

function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            button.classList.add('active');
            document.getElementById(`tab-${tabId}`).classList.add('active');

            if (tabId === 'logs') {
                loadLogs();
            } else if (tabId === 'audit') {
                loadAuditActions();
                loadAuditLogs();
            }
        });
    });
}

async function checkHealth() {
    try {
        const response = await fetch('http://localhost:3000/health');
        const data = await response.json();
        
        if (data.status === 'ok') {
            document.getElementById('status-badge').textContent = '运行中';
            document.getElementById('status-badge').className = 'status-badge status-ok';
        }
    } catch (error) {
        document.getElementById('status-badge').textContent = '离线';
        document.getElementById('status-badge').className = 'status-badge status-error';
    }
}

async function loadOverview() {
    try {
        const statsResponse = await HttpClient.get(`${API_BASE}/logs/stats`);
        const stats = statsResponse.data;

        document.getElementById('stat-total').textContent = stats.total;
        document.getElementById('stat-error').textContent = stats.byLevel.ERROR;
        document.getElementById('stat-warn').textContent = stats.byLevel.WARN;
        document.getElementById('stat-info').textContent = stats.byLevel.INFO;

        const recentResponse = await HttpClient.get(`${API_BASE}/logs?level=ERROR&limit=10&sortBy=timestamp&sortOrder=DESC`);
        const recentErrors = recentResponse.data;

        const container = document.getElementById('recent-errors');
        container.innerHTML = '';

        if (recentErrors.length === 0) {
            container.innerHTML = '<p style="color: #666;">暂无错误日志</p>';
            return;
        }

        recentErrors.forEach(log => {
            const div = document.createElement('div');
            div.className = 'log-item';
            div.innerHTML = `
                <span class="log-level ${log.level}">${log.level}</span>
                <span class="log-time">${formatTimestamp(log.timestamp)}</span>
                <p style="margin-top: 0.5rem;">${log.message}</p>
            `;
            container.appendChild(div);
        });
    } catch (error) {
        showToast('加载概览数据失败: ' + error.message, 'error');
    }
}

async function loadLogs() {
    try {
        const params = new URLSearchParams({
            level: document.getElementById('filter-level').value,
            source_type: document.getElementById('filter-source').value,
            status: document.getElementById('filter-status').value,
            search: document.getElementById('filter-search').value,
            limit: pageSize,
            offset: (currentPage - 1) * pageSize
        });

        const response = await HttpClient.get(`${API_BASE}/logs?${params.toString()}`);
        const logs = response.data;

        const tbody = document.getElementById('logs-tbody');
        tbody.innerHTML = '';

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #666;">暂无数据</td></tr>';
            updatePagination(0);
            return;
        }

        logs.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatTimestamp(log.timestamp)}</td>
                <td><span class="log-level ${log.level}">${log.level}</span></td>
                <td>${formatSourceType(log.source_type)}</td>
                <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${log.message}</td>
                <td>${formatStatus(log.status)}</td>
                <td>
                    <button onclick="viewLog('${log.id}')" class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">查看</button>
                    <button onclick="editLog('${log.id}', ${log.version})" class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">编辑</button>
                    <button onclick="deleteLog('${log.id}')" class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">删除</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        updatePagination(logs.length);
    } catch (error) {
        showToast('加载日志失败: ' + error.message, 'error');
    }
}

function updatePagination(itemCount) {
    const pagination = document.getElementById('logs-pagination');
    pagination.innerHTML = '';

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '上一页';
    prevBtn.disabled = currentPage === 1;
    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            loadLogs();
        }
    };
    pagination.appendChild(prevBtn);

    const currentBtn = document.createElement('button');
    currentBtn.textContent = `第 ${currentPage} 页`;
    currentBtn.className = 'active';
    pagination.appendChild(currentBtn);

    const nextBtn = document.createElement('button');
    nextBtn.textContent = '下一页';
    nextBtn.disabled = itemCount < pageSize;
    nextBtn.onclick = () => {
        if (itemCount >= pageSize) {
            currentPage++;
            loadLogs();
        }
    };
    pagination.appendChild(nextBtn);
}

function applyFilters() {
    currentPage = 1;
    loadLogs();
}

async function viewLog(id) {
    try {
        const response = await HttpClient.get(`${API_BASE}/logs/${id}`);
        const log = response.data;

        showModal('日志详情', `
            <div class="form-group">
                <label>ID</label>
                <input type="text" value="${log.id}" readonly>
            </div>
            <div class="form-group">
                <label>级别</label>
                <input type="text" value="${log.level}" readonly>
            </div>
            <div class="form-group">
                <label>来源</label>
                <input type="text" value="${formatSourceType(log.source_type)}" readonly>
            </div>
            <div class="form-group">
                <label>时间</label>
                <input type="text" value="${formatTimestamp(log.timestamp)}" readonly>
            </div>
            <div class="form-group">
                <label>状态</label>
                <input type="text" value="${formatStatus(log.status)}" readonly>
            </div>
            <div class="form-group">
                <label>版本</label>
                <input type="text" value="${log.version}" readonly>
            </div>
            <div class="form-group">
                <label>消息</label>
                <textarea readonly>${log.message}</textarea>
            </div>
            ${log.metadata ? `
            <div class="form-group">
                <label>元数据</label>
                <textarea readonly>${JSON.stringify(log.metadata, null, 2)}</textarea>
            </div>
            ` : ''}
        `, `
            <button onclick="closeModal()" class="btn btn-secondary">关闭</button>
        `);
    } catch (error) {
        showToast('加载日志详情失败: ' + error.message, 'error');
    }
}

function showCreateLogModal() {
    showModal('添加日志', `
        <div class="form-group">
            <label>级别 *</label>
            <select id="new-log-level">
                <option value="DEBUG">DEBUG</option>
                <option value="INFO" selected>INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
                <option value="FATAL">FATAL</option>
            </select>
        </div>
        <div class="form-group">
            <label>来源 *</label>
            <select id="new-log-source">
                <option value="file">文件</option>
                <option value="database">数据库</option>
                <option value="api" selected>API</option>
                <option value="other">其他</option>
            </select>
        </div>
        <div class="form-group">
            <label>消息 *</label>
            <textarea id="new-log-message" placeholder="输入日志消息..."></textarea>
        </div>
    `, `
        <button onclick="closeModal()" class="btn btn-secondary">取消</button>
        <button onclick="createLog()" class="btn btn-primary">保存</button>
    `);
}

async function createLog() {
    const level = document.getElementById('new-log-level').value;
    const source_type = document.getElementById('new-log-source').value;
    const message = document.getElementById('new-log-message').value;

    if (!message.trim()) {
        showToast('请输入日志消息', 'warning');
        return;
    }

    try {
        await HttpClient.post(`${API_BASE}/logs`, {
            source_type,
            level,
            message,
            timestamp: Date.now()
        });

        closeModal();
        showToast('日志创建成功', 'success');
        loadLogs();
        loadOverview();
    } catch (error) {
        showToast('创建日志失败: ' + error.message, 'error');
    }
}

async function editLog(id, expectedVersion) {
    try {
        const response = await HttpClient.get(`${API_BASE}/logs/${id}`);
        const log = response.data;

        showModal('编辑日志', `
            <div class="form-group">
                <label>状态</label>
                <select id="edit-log-status">
                    <option value="pending" ${log.status === 'pending' ? 'selected' : ''}>待处理</option>
                    <option value="processed" ${log.status === 'processed' ? 'selected' : ''}>已处理</option>
                    <option value="ignored" ${log.status === 'ignored' ? 'selected' : ''}>已忽略</option>
                </select>
            </div>
            <div class="form-group">
                <label>消息</label>
                <textarea id="edit-log-message">${log.message}</textarea>
            </div>
        `, `
            <button onclick="closeModal()" class="btn btn-secondary">取消</button>
            <button onclick="updateLog('${id}', ${expectedVersion})" class="btn btn-primary">保存</button>
        `);
    } catch (error) {
        showToast('加载日志失败: ' + error.message, 'error');
    }
}

async function updateLog(id, expectedVersion) {
    const status = document.getElementById('edit-log-status').value;
    const message = document.getElementById('edit-log-message').value;

    try {
        await HttpClient.put(`${API_BASE}/logs/${id}`, {
            status,
            message
        }, {
            headers: {
                'X-Expected-Version': expectedVersion
            }
        });

        closeModal();
        showToast('日志更新成功', 'success');
        loadLogs();
        loadOverview();
    } catch (error) {
        if (error.message.includes('数据已被其他用户修改')) {
            showToast(error.message + ' 正在刷新...', 'warning');
            setTimeout(() => {
                loadLogs();
            }, 1000);
        } else {
            showToast('更新日志失败: ' + error.message, 'error');
        }
    }
}

async function deleteLog(id) {
    if (!confirm('确定要删除这条日志吗？此操作不可撤销。')) {
        return;
    }

    try {
        await HttpClient.delete(`${API_BASE}/logs/${id}`);
        showToast('日志删除成功', 'success');
        loadLogs();
        loadOverview();
    } catch (error) {
        showToast('删除日志失败: ' + error.message, 'error');
    }
}

async function exportLogs() {
    try {
        const params = new URLSearchParams();
        const level = document.getElementById('filter-level')?.value;
        const source = document.getElementById('filter-source')?.value;
        const status = document.getElementById('filter-status')?.value;

        if (level) params.append('level', level);
        if (source) params.append('source_type', source);
        if (status) params.append('status', status);

        window.location.href = `${API_BASE}/reports/logs/export?${params.toString()}`;
        showToast('导出已开始', 'success');
    } catch (error) {
        showToast('导出失败: ' + error.message, 'error');
    }
}

async function loadAuditActions() {
    try {
        const response = await HttpClient.get(`${API_BASE}/audit/actions`);
        const actions = response.data;

        const select = document.getElementById('audit-action');
        select.innerHTML = '<option value="">全部操作</option>';
        
        actions.forEach(action => {
            const option = document.createElement('option');
            option.value = action.code;
            option.textContent = action.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('加载操作类型失败:', error);
    }
}

async function loadAuditLogs() {
    try {
        const params = new URLSearchParams({
            action: document.getElementById('audit-action').value,
            userId: document.getElementById('audit-user').value,
            limit: 100
        });

        const response = await HttpClient.get(`${API_BASE}/audit?${params.toString()}`);
        const logs = response.data;

        const tbody = document.getElementById('audit-tbody');
        tbody.innerHTML = '';

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #666;">暂无审计日志</td></tr>';
            return;
        }

        logs.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatTimestamp(log.timestamp)}</td>
                <td>${formatAction(log.action)}</td>
                <td>${log.user_id || '-'}</td>
                <td>${log.entity_type || '-'}</td>
                <td style="max-width: 100px; overflow: hidden; text-overflow: ellipsis;">${log.entity_id || '-'}</td>
                <td>
                    <span class="log-level ${log.status === 'success' ? 'INFO' : 'ERROR'}">
                        ${log.status === 'success' ? '成功' : '失败'}
                    </span>
                </td>
                <td>
                    <button onclick="viewAuditDetail('${log.id}')" class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">详情</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        showToast('加载审计日志失败: ' + error.message, 'error');
    }
}

async function viewAuditDetail(id) {
    try {
        const response = await HttpClient.get(`${API_BASE}/audit?limit=1`);
        const logs = response.data;
        const log = logs.find(l => l.id === id);

        if (!log) return;

        showModal('审计日志详情', `
            <div class="form-group">
                <label>操作时间</label>
                <input type="text" value="${formatTimestamp(log.timestamp)}" readonly>
            </div>
            <div class="form-group">
                <label>操作类型</label>
                <input type="text" value="${formatAction(log.action)}" readonly>
            </div>
            <div class="form-group">
                <label>用户ID</label>
                <input type="text" value="${log.user_id || '-'}" readonly>
            </div>
            <div class="form-group">
                <label>IP地址</label>
                <input type="text" value="${log.ip_address || '-'}" readonly>
            </div>
            <div class="form-group">
                <label>实体类型</label>
                <input type="text" value="${log.entity_type || '-'}" readonly>
            </div>
            <div class="form-group">
                <label>实体ID</label>
                <input type="text" value="${log.entity_id || '-'}" readonly>
            </div>
            <div class="form-group">
                <label>状态</label>
                <input type="text" value="${log.status === 'success' ? '成功' : '失败'}" readonly>
            </div>
            ${log.old_value ? `
            <div class="form-group">
                <label>修改前</label>
                <textarea readonly>${JSON.stringify(log.old_value, null, 2)}</textarea>
            </div>
            ` : ''}
            ${log.new_value ? `
            <div class="form-group">
                <label>修改后</label>
                <textarea readonly>${JSON.stringify(log.new_value, null, 2)}</textarea>
            </div>
            ` : ''}
        `, `
            <button onclick="closeModal()" class="btn btn-secondary">关闭</button>
        `);
    } catch (error) {
        showToast('加载详情失败: ' + error.message, 'error');
    }
}

async function exportAuditLogs() {
    try {
        const response = await HttpClient.get(`${API_BASE}/reports/audit`);
        const report = response.data;
        
        showModal('审计报告', `
            <p>报告生成时间: ${report.generatedAt}</p>
            <p>审计记录总数: ${report.summary.totalRecords}</p>
        `, `
            <button onclick="closeModal()" class="btn btn-secondary">关闭</button>
        `);
    } catch (error) {
        showToast('生成审计报告失败: ' + error.message, 'error');
    }
}

async function generateStatisticsReport() {
    try {
        const params = new URLSearchParams();
        
        const startDate = document.getElementById('report-start').value;
        const endDate = document.getElementById('report-end').value;
        
        if (startDate) {
            params.append('startTime', new Date(startDate).getTime());
        }
        if (endDate) {
            params.append('endTime', new Date(endDate).getTime());
        }

        const response = await HttpClient.get(`${API_BASE}/reports/statistics?${params.toString()}`);
        const report = response.data;

        const stats = report.statistics;
        
        document.getElementById('report-result').classList.remove('hidden');
        document.getElementById('report-content').innerHTML = `
            <div class="stats-grid" style="margin-bottom: 1rem;">
                <div class="stat-card">
                    <div class="stat-title">总日志数</div>
                    <div class="stat-value">${stats.total}</div>
                </div>
            </div>

            <h4 style="margin: 1rem 0 0.5rem;">按级别统计</h4>
            <table class="table">
                <thead>
                    <tr><th>级别</th><th>数量</th></tr>
                </thead>
                <tbody>
                    ${Object.entries(stats.byLevel).map(([level, count]) => 
                        `<tr><td><span class="log-level ${level}">${level}</span></td><td>${count}</td></tr>`
                    ).join('')}
                </tbody>
            </table>

            <h4 style="margin: 1rem 0 0.5rem;">按来源统计</h4>
            <table class="table">
                <thead>
                    <tr><th>来源</th><th>数量</th></tr>
                </thead>
                <tbody>
                    ${Object.entries(stats.bySource).map(([source, count]) => 
                        `<tr><td>${formatSourceType(source)}</td><td>${count}</td></tr>`
                    ).join('')}
                </tbody>
            </table>

            <h4 style="margin: 1rem 0 0.5rem;">按状态统计</h4>
            <table class="table">
                <thead>
                    <tr><th>状态</th><th>数量</th></tr>
                </thead>
                <tbody>
                    ${Object.entries(stats.byStatus).map(([status, count]) => 
                        `<tr><td>${formatStatus(status)}</td><td>${count}</td></tr>`
                    ).join('')}
                </tbody>
            </table>
        `;

        showToast('统计报告生成成功', 'success');
    } catch (error) {
        showToast('生成统计报告失败: ' + error.message, 'error');
    }
}

function closeReport() {
    document.getElementById('report-result').classList.add('hidden');
}

async function generateAuditReport() {
    try {
        const response = await HttpClient.get(`${API_BASE}/reports/audit`);
        const report = response.data;
        
        showModal('审计报告', `
            <div class="form-group">
                <label>生成时间</label>
                <input type="text" value="${report.generatedAt}" readonly>
            </div>
            <div class="form-group">
                <label>审计记录总数</label>
                <input type="text" value="${report.summary.totalRecords}" readonly>
            </div>
            <table class="table">
                <thead>
                    <tr><th>操作</th><th>用户</th><th>时间</th><th>状态</th></tr>
                </thead>
                <tbody>
                    ${report.records.slice(0, 20).map(record => `
                        <tr>
                            <td>${formatAction(record.action)}</td>
                            <td>${record.userId || '-'}</td>
                            <td>${record.timestamp}</td>
                            <td>
                                <span class="log-level ${record.status === 'success' ? 'INFO' : 'ERROR'}">
                                    ${record.status === 'success' ? '成功' : '失败'}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `, `
            <button onclick="closeModal()" class="btn btn-secondary">关闭</button>
        `);
    } catch (error) {
        showToast('生成审计报告失败: ' + error.message, 'error');
    }
}

function showModal(title, body, footer) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-footer').innerHTML = footer;
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

function refreshData() {
    loadOverview();
    if (document.getElementById('tab-logs').classList.contains('active')) {
        loadLogs();
    }
    if (document.getElementById('tab-audit').classList.contains('active')) {
        loadAuditLogs();
    }
    checkHealth();
    showToast('数据已刷新', 'success');
}

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    checkHealth();
    loadOverview();
    
    setInterval(checkHealth, 30000);
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') {
        closeModal();
    }
});
