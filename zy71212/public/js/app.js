
const API_BASE = '/api';
const state = {
    currentTab: 'dashboard',
    data: {},
    config: {},
    selectedReminders: new Set(),
    filters: {
        urgency: '',
        includeStopIntent: false,
        policySearch: ''
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    initNavigation();
    initEventListeners();
    loadConfig();
    loadDashboard();
}

function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
}

function switchTab(tabName) {
    state.currentTab = tabName;
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
    loadTabData(tabName);
}

function loadTabData(tabName) {
    switch (tabName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'grace':
            loadGraceData();
            break;
        case 'reminder':
            loadReminderData();
            break;
        case 'advance':
            loadAdvanceData();
            break;
        case 'policies':
            loadPoliciesData();
            break;
        case 'reports':
            loadReportsData();
            break;
        case 'settings':
            loadSettingsData();
            break;
    }
}

function initEventListeners() {
    document.getElementById('refreshDashboard').addEventListener('click', loadDashboard);
    document.getElementById('runGraceAnalysis').addEventListener('click', runGraceAnalysis);
    document.getElementById('updateGraceDates').addEventListener('click', updateGraceDates);
    document.getElementById('processDirectory').addEventListener('click', processDirectory);
    document.getElementById('fileUpload').addEventListener('change', handleFileUpload);
    document.getElementById('urgencyFilter').addEventListener('change', (e) => {
        state.filters.urgency = e.target.value;
        renderGraceTable();
    });
    document.getElementById('generateReminderList').addEventListener('click', generateReminderList);
    document.getElementById('executeReminders').addEventListener('click', executeBulkReminders);
    document.getElementById('includeStopIntent').addEventListener('change', (e) => {
        state.filters.includeStopIntent = e.target.checked;
        renderReminderTable();
    });
    document.getElementById('selectAllReminders').addEventListener('change', (e) => {
        document.querySelectorAll('.reminder-checkbox').forEach(cb => {
            cb.checked = e.target.checked;
            if (cb.checked) {
                state.selectedReminders.add(cb.value);
            } else {
                state.selectedReminders.delete(cb.value);
            }
        });
    });
    document.getElementById('processAdvances').addEventListener('click', processAutoAdvances);
    document.getElementById('refreshAdvances').addEventListener('click', loadAdvanceData);
    document.getElementById('policySearch').addEventListener('input', (e) => {
        state.filters.policySearch = e.target.value.toLowerCase();
        renderPoliciesTable();
    });
    document.getElementById('addVisitRecord').addEventListener('click', showAddVisitModal);
    document.getElementById('closePolicyDetail').addEventListener('click', () => {
        document.getElementById('policyDetailCard').style.display = 'none';
    });
    document.getElementById('generateNewReport').addEventListener('click', generateNewReport);
    document.getElementById('closeReportDetail').addEventListener('click', () => {
        document.getElementById('reportDetailCard').style.display = 'none';
    });
    document.getElementById('exportReportJson').addEventListener('click', exportReportJson);
    document.getElementById('exportReportCsv').addEventListener('click', exportReportCsv);
    document.getElementById('saveConfig').addEventListener('click', saveConfig);
    document.getElementById('addHoliday').addEventListener('click', () => addHoliday('holiday'));
    document.getElementById('addWorkday').addEventListener('click', () => addHoliday('workday'));
    document.getElementById('createBackup').addEventListener('click', createBackup);
    document.getElementById('exportAllData').addEventListener('click', exportAllData);
    document.getElementById('importFile').addEventListener('change', handleImportFile);
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'modalOverlay') closeModal();
    });
}

async function apiCall(endpoint, options = {}) {
    showLoading(options.loadingText || '处理中...');
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options
        });
        const result = await response.json();
        hideLoading();
        if (!response.ok) {
            throw new Error(result.error || '请求失败');
        }
        return result.data;
    } catch (error) {
        hideLoading();
        showMessage(error.message, 'error');
        throw error;
    }
}

async function loadDashboard() {
    try {
        const [dashboard, nextStepsData] = await Promise.all([
            apiCall('/dashboard'),
            apiCall('/next-steps')
        ]);
        state.data.dashboard = dashboard;
        
        const nextSteps = nextStepsData.nextSteps || nextStepsData || [];
        state.data.nextSteps = Array.isArray(nextSteps) ? nextSteps : (nextSteps.nextSteps || []);
        
        const stats = {
            totalPolicies: dashboard.overview?.totalPolicies || 0,
            pendingPayment: dashboard.overview?.needingReminder || 0,
            inGracePeriod: dashboard.overview?.inGracePeriod || 0,
            overdue: dashboard.overview?.graceExpired || 0,
            advancePayment: dashboard.overview?.pendingAdvance || 0,
            paid: 0
        };
        
        renderStats(stats);
        renderNextSteps(state.data.nextSteps);
        renderGraceDistribution(dashboard.byUrgency || dashboard.graceAnalysis?.summary?.countByUrgency || {});
        renderConsistencyStatus(dashboard.consistency || {});
        renderFinancialOverview(dashboard.financial || {});
    } catch (error) {
        console.error('加载仪表盘失败:', error);
    }
}

function renderStats(stats) {
    const grid = document.getElementById('statsGrid');
    const statItems = [
        { label: '保单总数', value: stats.totalPolicies, icon: '📋', color: 'primary' },
        { label: '待缴费', value: stats.pendingPayment, icon: '⏳', color: 'warning' },
        { label: '宽限期内', value: stats.inGracePeriod, icon: '⏰', color: 'info' },
        { label: '已过期', value: stats.overdue, icon: '⚠️', color: 'danger' },
        { label: '已垫交', value: stats.advancePayment, icon: '💰', color: 'secondary' },
        { label: '已缴费', value: stats.paid, icon: '✅', color: 'success' }
    ];
    grid.innerHTML = statItems.map(item => `
        <div class="stat-card stat-${item.color}">
            <div class="stat-icon">${item.icon}</div>
            <div class="stat-content">
                <div class="stat-value">${item.value}</div>
                <div class="stat-label">${item.label}</div>
            </div>
        </div>
    `).join('');
}

function renderNextSteps(nextSteps) {
    document.getElementById('nextStepsCount').textContent = nextSteps.length;
    const list = document.getElementById('nextStepsList');
    if (nextSteps.length === 0) {
        list.innerHTML = '<div class="empty-state">暂无待办事项</div>';
        return;
    }
    list.innerHTML = nextSteps.map((step, index) => `
        <div class="next-step-item urgency-${step.urgency || 'medium'}">
            <div class="step-number">${index + 1}</div>
            <div class="step-content">
                <div class="step-title">${step.action}</div>
                <div class="step-desc">${step.description}</div>
                <div class="step-meta">
                    ${step.policyCount ? `<span>涉及保单: ${step.policyCount}份</span>` : ''}
                    ${step.deadline ? `<span>截止: ${step.deadline}</span>` : ''}
                </div>
            </div>
            <button class="btn btn-sm btn-primary" onclick="handleNextStep('${step.type}')">
                去处理
            </button>
        </div>
    `).join('');
}

function handleNextStep(type) {
    switch (type) {
        case 'urgent_reminder':
        case 'reminder':
            switchTab('reminder');
            break;
        case 'grace_analysis':
            switchTab('grace');
            break;
        case 'advance_process':
            switchTab('advance');
            break;
        case 'report':
            switchTab('reports');
            break;
        case 'followup':
            switchTab('policies');
            break;
        default:
            showMessage('未知操作类型', 'warning');
    }
}

function renderGraceDistribution(distribution) {
    const container = document.getElementById('graceDistribution');
    const items = [
        { label: '紧急', value: distribution['紧急'] || distribution.urgent || 0, color: '#dc3545' },
        { label: '高', value: distribution['高'] || distribution.high || 0, color: '#fd7e14' },
        { label: '中', value: distribution['中'] || distribution.medium || 0, color: '#ffc107' },
        { label: '低', value: distribution['低'] || distribution.low || 0, color: '#28a745' },
        { label: '已过期', value: distribution['已过期'] || distribution.overdue || 0, color: '#6c757d' }
    ];
    const total = items.reduce((sum, item) => sum + item.value, 0);
    container.innerHTML = total === 0 ? '<div class="empty-state">暂无数据</div>' : `
        <div class="progress-bar-container">
            ${items.map(item => {
                const percent = total > 0 ? (item.value / total * 100).toFixed(1) : 0;
                return `
                    <div class="progress-segment" style="width: ${percent}%; background: ${item.color};" title="${item.label}: ${item.value}">
                        ${percent > 10 ? `<span>${item.value}</span>` : ''}
                    </div>
                `;
            }).join('')}
        </div>
        <div class="legend">
            ${items.map(item => `
                <div class="legend-item">
                    <span class="legend-color" style="background: ${item.color}"></span>
                    <span>${item.label}: ${item.value}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function renderConsistencyStatus(check) {
    const container = document.getElementById('consistencyStatus');
    if (!check) {
        container.innerHTML = '<div class="empty-state">暂无数据</div>';
        return;
    }
    const issues = check.issues || check.errors || [];
    const errorCount = check.errorCount || issues.length;
    const warningCount = check.warningCount || 0;
    const totalIssues = errorCount + warningCount;
    const statusClass = totalIssues === 0 ? 'status-success' : 'status-warning';
    container.innerHTML = `
        <div class="consistency-status ${statusClass}">
            <div class="consistency-icon">${totalIssues === 0 ? '✅' : '⚠️'}</div>
            <div class="consistency-info">
                <div class="consistency-title">
                    ${totalIssues === 0 ? '数据一致性良好' : `发现 ${totalIssues} 个问题`}
                </div>
                <div class="consistency-detail">
                    错误: ${errorCount} 个<br>
                    警告: ${warningCount} 个<br>
                    数据状态: ${check.isValid ? '有效' : '存在问题'}
                </div>
            </div>
        </div>
        ${issues.length > 0 ? `
            <div class="issues-list">
                ${issues.slice(0, 5).map(issue => `
                    <div class="issue-item">
                        <span class="issue-severity">${issue.type === 'error' ? '🔴' : '🟡'}</span>
                        <span>${issue.message}</span>
                    </div>
                `).join('')}
                ${issues.length > 5 ? `<div class="text-muted text-center">还有 ${issues.length - 5} 个问题...</div>` : ''}
            </div>
        ` : ''}
    `;
}

function renderFinancialOverview(financial) {
    const container = document.getElementById('financialOverview');
    if (!financial) {
        container.innerHTML = '<div class="empty-state">暂无数据</div>';
        return;
    }
    const totalDue = financial.totalPremiumDue || 0;
    const totalOverdue = financial.totalPremiumOverdue || 0;
    const totalInGrace = financial.totalPremiumInGrace || 0;
    const totalAdvance = financial.totalAdvanceOwed || 0;
    const totalInterest = financial.totalAdvanceInterest || 0;
    const recoveryRate = totalDue > 0 ? ((totalDue - totalOverdue - totalInGrace) / totalDue * 100) : 0;
    
    container.innerHTML = `
        <div class="financial-item">
            <span class="financial-label">应缴保费总额</span>
            <span class="financial-value">¥${formatNumber(totalDue)}</span>
        </div>
        <div class="financial-item">
            <span class="financial-label">宽限期内</span>
            <span class="financial-value text-info">¥${formatNumber(totalInGrace)}</span>
        </div>
        <div class="financial-item">
            <span class="financial-label">已过期</span>
            <span class="financial-value text-danger">¥${formatNumber(totalOverdue)}</span>
        </div>
        <div class="financial-item">
            <span class="financial-label">垫交本金</span>
            <span class="financial-value text-info">¥${formatNumber(financial.totalAdvancePrincipal || 0)}</span>
        </div>
        <div class="financial-item">
            <span class="financial-label">垫交利息</span>
            <span class="financial-value text-secondary">¥${formatNumber(totalInterest)}</span>
        </div>
        <div class="financial-item highlight">
            <span class="financial-label">回收率</span>
            <span class="financial-value">${recoveryRate.toFixed(1)}%</span>
        </div>
    `;
}

async function loadGraceData() {
    try {
        const result = await apiCall('/grace-analysis');
        state.data.graceAnalysis = result.results || result.analysis || [];
        renderGraceTable();
    } catch (error) {
        console.error('加载宽限期数据失败:', error);
    }
}

async function runGraceAnalysis() {
    try {
        const result = await apiCall('/grace-analysis', {
            method: 'POST',
            loadingText: '正在进行宽限期分析...'
        });
        state.data.graceAnalysis = result.results || result.analysis || [];
        renderGraceTable();
        showMessage(`分析完成，共处理 ${state.data.graceAnalysis.length || 0} 条保单`, 'success');
    } catch (error) {
        console.error('宽限期分析失败:', error);
    }
}

async function updateGraceDates() {
    try {
        const result = await apiCall('/grace-analysis', {
            method: 'POST',
            body: JSON.stringify({ updateDates: true }),
            loadingText: '正在更新宽限日期...'
        });
        state.data.graceAnalysis = result.results || result.analysis || [];
        renderGraceTable();
        showMessage(`已更新 ${state.data.graceAnalysis.length || 0} 条宽限日期`, 'success');
    } catch (error) {
        console.error('更新宽限日期失败:', error);
    }
}

async function processDirectory() {
    const dirPath = document.getElementById('dirPath').value.trim();
    if (!dirPath) {
        showMessage('请输入目录路径', 'warning');
        return;
    }
    try {
        const result = await apiCall('/process-directory', {
            method: 'POST',
            body: JSON.stringify({ dirPath: dirPath }),
            loadingText: '正在处理目录...'
        });
        renderProcessingResult(result);
        loadDashboard();
        loadGraceData();
    } catch (error) {
        console.error('目录处理失败:', error);
    }
}

async function handleFileUpload(e) {
    const files = e.target.files;
    if (files.length === 0) return;
    const formData = new FormData();
    for (const file of files) {
        formData.append('files', file);
    }
    showLoading('正在上传文件...');
    try {
        const response = await fetch(`${API_BASE}/files/upload`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        hideLoading();
        if (!response.ok) throw new Error(result.error || '上传失败');
        renderProcessingResult(result);
        loadDashboard();
        loadGraceData();
    } catch (error) {
        hideLoading();
        showMessage(error.message, 'error');
    }
    e.target.value = '';
}

function renderProcessingResult(result) {
    const container = document.getElementById('processingResult');
    container.style.display = 'block';
    const { summary, results, failed } = result;
    container.innerHTML = `
        <div class="result-summary">
            <div class="summary-item success">
                <span class="summary-icon">✅</span>
                <span>成功: ${summary?.success || 0}</span>
            </div>
            <div class="summary-item warning">
                <span class="summary-icon">⚠️</span>
                <span>警告: ${summary?.warning || 0}</span>
            </div>
            <div class="summary-item error">
                <span class="summary-icon">❌</span>
                <span>失败: ${summary?.failed || 0}</span>
            </div>
            <div class="summary-item info">
                <span class="summary-icon">📄</span>
                <span>总计: ${summary?.total || 0}</span>
            </div>
        </div>
        ${results && results.length > 0 ? `
            <div class="result-details">
                <h4>处理详情</h4>
                ${results.slice(0, 10).map(r => `
                    <div class="result-item ${r.status}">
                        <div class="result-file">${r.fileName}</div>
                        <div class="result-info">
                            <span class="result-type">${r.inputType}</span>
                            ${r.missingFields && r.missingFields.length > 0 ? `
                                <span class="missing-fields">缺失: ${r.missingFields.join(', ')}</span>
                            ` : ''}
                            ${r.message ? `<span class="result-message">${r.message}</span>` : ''}
                        </div>
                    </div>
                `).join('')}
                ${results.length > 10 ? `<div class="text-muted">还有 ${results.length - 10} 条记录...</div>` : ''}
            </div>
        ` : ''}
        ${failed && failed.length > 0 ? `
            <div class="result-failed">
                <h4>失败文件</h4>
                ${failed.map(f => `
                    <div class="result-item error">
                        <div class="result-file">${f.fileName}</div>
                        <div class="result-info">
                            <span class="result-message">${f.error}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
}

function renderGraceTable() {
    const analysis = state.data.graceAnalysis || [];
    const filtered = state.filters.urgency 
        ? analysis.filter(a => a.urgency === state.filters.urgency)
        : analysis;
    const tbody = document.querySelector('#graceTable tbody');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="text-center text-muted">暂无数据</td></tr>';
        return;
    }
    tbody.innerHTML = filtered.map(a => `
        <tr class="urgency-row-${a.urgency}">
            <td>${a.policyNumber}</td>
            <td>${a.policyHolder}</td>
            <td>${a.period}</td>
            <td>¥${formatNumber(a.premiumAmount)}</td>
            <td>${formatDate(a.dueDate)}</td>
            <td>${formatDate(a.graceEndDate)}</td>
            <td>${a.graceDays}</td>
            <td class="${a.daysOverdue > 0 ? 'text-danger' : ''}">${a.daysOverdue || 0}</td>
            <td class="${a.daysRemaining <= 3 ? 'text-danger' : a.daysRemaining <= 7 ? 'text-warning' : 'text-success'}">
                ${a.daysRemaining > 0 ? a.daysRemaining + '天' : '已过期'}
            </td>
            <td><span class="badge badge-${getUrgencyClass(a.urgency)}">${a.urgency}</span></td>
            <td><span class="status-badge status-${a.status}">${a.statusText}</span></td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="viewPolicyDetail('${a.policyNumber}')">详情</button>
                    <button class="btn btn-sm btn-warning" onclick="sendReminder('${a.policyNumber}', '${a.period}')">催缴</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function getUrgencyClass(urgency) {
    const map = { '紧急': 'danger', '高': 'warning', '中': 'info', '低': 'secondary', '已过期': 'dark' };
    return map[urgency] || 'secondary';
}

async function loadReminderData() {
    try {
        const [list, stats] = await Promise.all([
            apiCall('/reminder-list'),
            apiCall('/reminder-statistics')
        ]);
        state.data.reminderList = list.reminders || list || [];
        state.data.reminderHistory = state.data.reminderHistory || [];
        state.data.reminderStats = stats || {};
        renderReminderStats(state.data.reminderStats);
        renderReminderTable();
        renderReminderHistoryTable();
    } catch (error) {
        console.error('加载催缴数据失败:', error);
    }
}

function renderReminderStats(stats) {
    const container = document.getElementById('reminderStats');
    if (!stats) return;
    container.innerHTML = `
        <div class="stat-mini">
            <span class="stat-mini-label">待催缴</span>
            <span class="stat-mini-value text-warning">${stats.pending || 0}</span>
        </div>
        <div class="stat-mini">
            <span class="stat-mini-label">今日催缴</span>
            <span class="stat-mini-value text-primary">${stats.today || 0}</span>
        </div>
        <div class="stat-mini">
            <span class="stat-mini-label">已催缴</span>
            <span class="stat-mini-value text-info">${stats.sent || 0}</span>
        </div>
        <div class="stat-mini">
            <span class="stat-mini-label">客户响应</span>
            <span class="stat-mini-value text-success">${stats.responded || 0}</span>
        </div>
        <div class="stat-mini">
            <span class="stat-mini-label">已去重</span>
            <span class="stat-mini-value text-secondary">${stats.duplicatesRemoved || 0}</span>
        </div>
        <div class="stat-mini">
            <span class="stat-mini-label">垫交排除</span>
            <span class="stat-mini-value text-muted">${stats.advanceExcluded || 0}</span>
        </div>
    `;
}

async function generateReminderList() {
    try {
        const result = await apiCall('/reminder-list', {
            method: 'POST',
            loadingText: '正在生成催缴清单...'
        });
        state.data.reminderList = result.reminders || result || [];
        const stats = await apiCall('/reminder-statistics');
        state.data.reminderStats = stats || {};
        renderReminderStats(state.data.reminderStats);
        renderReminderTable();
        showMessage(`生成催缴清单，共 ${state.data.reminderList.length || 0} 条`, 'success');
    } catch (error) {
        console.error('生成催缴清单失败:', error);
    }
}

function renderReminderTable() {
    let reminders = state.data.reminderList || [];
    if (!state.filters.includeStopIntent) {
        reminders = reminders.filter(r => !r.hasStopIntent);
    }
    const tbody = document.querySelector('#reminderTable tbody');
    if (reminders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted">暂无催缴数据</td></tr>';
        return;
    }
    tbody.innerHTML = reminders.map(r => `
        <tr>
            <td>
                <input type="checkbox" class="reminder-checkbox" value="${r.id}" 
                    ${state.selectedReminders.has(r.id) ? 'checked' : ''}
                    onchange="toggleReminderSelection('${r.id}', this.checked)">
            </td>
            <td>${r.policyNumber}</td>
            <td>${r.policyHolder}</td>
            <td>${r.phone}</td>
            <td>¥${formatNumber(r.premiumAmount)}</td>
            <td class="${r.daysRemaining <= 3 ? 'text-danger' : r.daysRemaining <= 7 ? 'text-warning' : ''}">
                ${r.daysRemaining > 0 ? r.daysRemaining + '天' : '已过期'}
            </td>
            <td><span class="badge badge-${getUrgencyClass(r.urgency)}">${r.urgency}</span></td>
            <td>${r.suggestedMethod}</td>
            <td style="max-width: 200px;" class="text-truncate" title="${r.content}">${r.content}</td>
            <td>${r.lastReminder ? formatDate(r.lastReminder) : '-'}</td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="executeSingleReminder('${r.id}')">执行</button>
                    <button class="btn btn-sm btn-secondary" onclick="skipReminder('${r.id}')">跳过</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function toggleReminderSelection(id, checked) {
    if (checked) {
        state.selectedReminders.add(id);
    } else {
        state.selectedReminders.delete(id);
    }
    const selectAll = document.getElementById('selectAllReminders');
    const total = document.querySelectorAll('.reminder-checkbox').length;
    selectAll.checked = state.selectedReminders.size === total && total > 0;
}

async function executeBulkReminders() {
    if (state.selectedReminders.size === 0) {
        showMessage('请选择要执行的催缴记录', 'warning');
        return;
    }
    try {
        const reminders = Array.from(state.selectedReminders).map(id => {
            return state.data.reminderList.find(r => r.id === id) || { id };
        });
        const result = await apiCall('/execute-reminders', {
            method: 'POST',
            body: JSON.stringify({ reminders }),
            loadingText: '正在执行批量催缴...'
        });
        state.selectedReminders.clear();
        loadReminderData();
        showMessage(`成功执行 ${result.success || result.executed || 0} 条催缴`, 'success');
    } catch (error) {
        console.error('批量催缴失败:', error);
    }
}

async function executeSingleReminder(id) {
    try {
        const reminder = state.data.reminderList.find(r => r.id === id) || { id };
        await apiCall('/execute-reminders', {
            method: 'POST',
            body: JSON.stringify({ reminders: [reminder] }),
            loadingText: '正在执行催缴...'
        });
        loadReminderData();
        showMessage('催缴执行成功', 'success');
    } catch (error) {
        console.error('催缴执行失败:', error);
    }
}

async function skipReminder(id) {
    if (!confirm('确定要跳过这条催缴吗？')) return;
    try {
        state.data.reminderList = state.data.reminderList.filter(r => r.id !== id);
        renderReminderTable();
        showMessage('已跳过', 'info');
    } catch (error) {
        console.error('操作失败:', error);
    }
}

async function sendReminder(policyNo, period) {
    try {
        const result = await apiCall('/execute-reminders', {
            method: 'POST',
            body: JSON.stringify({ reminders: [{ policyNo, period }] }),
            loadingText: '正在发送催缴...'
        });
        showMessage('催缴发送成功', 'success');
        loadReminderData();
    } catch (error) {
        console.error('发送催缴失败:', error);
    }
}

function renderReminderHistoryTable() {
    const history = state.data.reminderHistory || [];
    const tbody = document.querySelector('#reminderHistoryTable tbody');
    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">暂无历史记录</td></tr>';
        return;
    }
    tbody.innerHTML = history.slice(0, 50).map(h => `
        <tr>
            <td>${h.policyNumber}</td>
            <td>${h.period}</td>
            <td>${formatDate(h.reminderDate)}</td>
            <td>${h.reminderType}</td>
            <td><span class="badge badge-${getUrgencyClass(h.urgency)}">${h.urgency}</span></td>
            <td><span class="status-badge status-${h.status}">${h.statusText}</span></td>
            <td>${h.customerResponse || '-'}</td>
            <td>${h.responseDate ? formatDate(h.responseDate) : '-'}</td>
        </tr>
    `).join('');
}

async function loadAdvanceData() {
    try {
        const [stats, advanceResult] = await Promise.all([
            apiCall('/advance-statistics'),
            apiCall('/process-advances', { method: 'POST' })
        ]);
        state.data.eligibleAdvances = advanceResult.eligible || advanceResult.policies || [];
        state.data.unrepaidAdvances = advanceResult.unrepaid || advanceResult.records || [];
        state.data.advanceStats = stats || {};
        renderAdvanceStats(state.data.advanceStats);
        renderEligibleAdvanceTable();
        renderUnrepaidAdvanceTable();
    } catch (error) {
        console.error('加载垫交数据失败:', error);
    }
}

function renderAdvanceStats(stats) {
    const container = document.getElementById('advanceStats');
    if (!stats) return;
    container.innerHTML = `
        <div class="stat-mini">
            <span class="stat-mini-label">待垫交</span>
            <span class="stat-mini-value text-warning">${stats.eligible || 0}</span>
        </div>
        <div class="stat-mini">
            <span class="stat-mini-label">已垫交</span>
            <span class="stat-mini-value text-info">${stats.total || 0}</span>
        </div>
        <div class="stat-mini">
            <span class="stat-mini-label">未偿还</span>
            <span class="stat-mini-value text-danger">${stats.unrepaid || 0}</span>
        </div>
        <div class="stat-mini">
            <span class="stat-mini-label">已偿还</span>
            <span class="stat-mini-value text-success">${stats.repaid || 0}</span>
        </div>
        <div class="stat-mini">
            <span class="stat-mini-label">垫交总额</span>
            <span class="stat-mini-value">¥${formatNumber(stats.totalAmount || 0)}</span>
        </div>
        <div class="stat-mini">
            <span class="stat-mini-label">利息总额</span>
            <span class="stat-mini-value text-secondary">¥${formatNumber(stats.totalInterest || 0)}</span>
        </div>
    `;
}

async function processAutoAdvances() {
    try {
        const result = await apiCall('/process-advances', {
            method: 'POST',
            body: JSON.stringify({ autoProcess: true }),
            loadingText: '正在处理自动垫交...'
        });
        loadAdvanceData();
        showMessage(`处理完成，成功垫交 ${result.processed || result.success || 0} 条`, 'success');
    } catch (error) {
        console.error('自动垫交处理失败:', error);
    }
}

function renderEligibleAdvanceTable() {
    const policies = state.data.eligibleAdvances || [];
    const tbody = document.querySelector('#eligibleAdvanceTable tbody');
    if (policies.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">暂无待垫交保单</td></tr>';
        return;
    }
    tbody.innerHTML = policies.map(p => `
        <tr>
            <td>${p.policyNumber}</td>
            <td>${p.policyHolder}</td>
            <td>${p.period}</td>
            <td>¥${formatNumber(p.premiumAmount)}</td>
            <td>${p.daysRemaining}天</td>
            <td>¥${formatNumber(p.cashValue)}</td>
            <td>${p.autoAdvanceEnabled ? '✅' : '❌'}</td>
            <td>${p.isEligible ? '✅' : '❌'}</td>
            <td style="max-width: 150px;" class="text-truncate" title="${p.reason}">${p.reason || '-'}</td>
            <td>
                ${p.isEligible ? `
                    <button class="btn btn-sm btn-primary" onclick="processSingleAdvance('${p.policyNumber}', '${p.period}')">
                        垫交
                    </button>
                ` : '<span class="text-muted">不可用</span>'}
            </td>
        </tr>
    `).join('');
}

function renderUnrepaidAdvanceTable() {
    const records = state.data.unrepaidAdvances || [];
    const tbody = document.querySelector('#unrepaidAdvanceTable tbody');
    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">暂无未偿还垫交记录</td></tr>';
        return;
    }
    tbody.innerHTML = records.map(r => `
        <tr>
            <td>${r.policyNumber}</td>
            <td>${r.period}</td>
            <td>${formatDate(r.advanceDate)}</td>
            <td>¥${formatNumber(r.advanceAmount)}</td>
            <td>${r.interestRate}%</td>
            <td class="text-warning">¥${formatNumber(r.currentInterest)}</td>
            <td class="text-danger">¥${formatNumber(r.totalOwed)}</td>
            <td>${r.daysAdvance}天</td>
            <td>
                <button class="btn btn-sm btn-success" onclick="showRepayModal('${r.id}')">还款</button>
            </td>
        </tr>
    `).join('');
}

async function processSingleAdvance(policyNo, period) {
    if (!confirm(`确定为保单 ${policyNo} 第 ${period} 期办理垫交吗？`)) return;
    try {
        const result = await apiCall('/create-advance', {
            method: 'POST',
            body: JSON.stringify({ policyNo, period }),
            loadingText: '正在办理垫交...'
        });
        loadAdvanceData();
        showMessage(`垫交成功`, 'success');
    } catch (error) {
        console.error('垫交处理失败:', error);
    }
}

function showRepayModal(recordId) {
    const record = state.data.unrepaidAdvances?.find(r => r.id === recordId);
    if (!record) return;
    showModal('垫交还款', `
        <div class="form-group">
            <label>保单号</label>
            <input type="text" class="form-control" value="${record.policyNumber}" readonly>
        </div>
        <div class="form-group">
            <label>缴费期次</label>
            <input type="text" class="form-control" value="${record.period}" readonly>
        </div>
        <div class="form-group">
            <label>垫交金额</label>
            <input type="text" class="form-control" value="¥${formatNumber(record.advanceAmount)}" readonly>
        </div>
        <div class="form-group">
            <label>当前利息</label>
            <input type="text" class="form-control" value="¥${formatNumber(record.currentInterest)}" readonly>
        </div>
        <div class="form-group">
            <label>应还总额</label>
            <input type="text" class="form-control text-danger" value="¥${formatNumber(record.totalOwed)}" readonly>
        </div>
        <div class="form-group">
            <label>还款金额</label>
            <input type="number" id="repayAmount" class="form-control" value="${record.totalOwed}" step="0.01">
        </div>
    `, `
        <button class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="executeRepay('${recordId}')">确认还款</button>
    `);
}

async function executeRepay(recordId) {
    const amount = parseFloat(document.getElementById('repayAmount').value);
    if (!amount || amount <= 0) {
        showMessage('请输入有效的还款金额', 'warning');
        return;
    }
    try {
        await apiCall('/repay-advance', {
            method: 'POST',
            body: JSON.stringify({ recordId, amount }),
            loadingText: '正在处理还款...'
        });
        closeModal();
        loadAdvanceData();
        showMessage('还款成功', 'success');
    } catch (error) {
        console.error('还款失败:', error);
    }
}

function mapPolicyFields(p) {
    return {
        policyNumber: p.policyNo || p.policyNumber,
        policyHolder: p.policyholder || p.policyHolder,
        phone: p.phone,
        productName: p.productName,
        premiumAmount: p.premium || p.premiumAmount,
        paymentMethod: p.paymentFrequency || p.paymentMethod,
        effectiveDate: p.policyEffectiveDate || p.effectiveDate,
        graceDays: p.gracePeriodDays || p.graceDays || 60,
        autoAdvanceEnabled: p.autoAdvanceEnabled,
        cashValue: p.cashValue,
        status: p.status || 'normal',
        statusText: p.status || '正常'
    };
}

function mapVisitFields(v) {
    const intentMap = { '续保': 'renew', '缓交': 'delay', '停保': 'stop', '': 'unknown' };
    const intentTextMap = { 'renew': '确定续保', 'delay': '缓交', 'stop': '停保', 'unknown': '未确认' };
    const intent = intentMap[v.customerIntent] || v.intent || 'unknown';
    return {
        visitDate: v.visitDate,
        visitMethod: v.visitType || v.visitMethod,
        intent: intent,
        intentText: intentTextMap[intent] || v.customerIntent || '未确认',
        visitor: v.visitor,
        notes: v.remark || v.notes,
        intentConfirmed: v.intentConfirmed
    };
}

async function loadPoliciesData() {
    try {
        const result = await apiCall('/policies');
        const policies = Array.isArray(result) ? result : (result.policies || []);
        state.data.policies = policies.map(mapPolicyFields);
        renderPoliciesTable();
    } catch (error) {
        console.error('加载保单数据失败:', error);
    }
}

function renderPoliciesTable() {
    let policies = state.data.policies || [];
    if (state.filters.policySearch) {
        policies = policies.filter(p => 
            p.policyNumber.toLowerCase().includes(state.filters.policySearch) ||
            p.policyHolder.toLowerCase().includes(state.filters.policySearch)
        );
    }
    const tbody = document.querySelector('#policiesTable tbody');
    if (policies.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted">暂无保单数据</td></tr>';
        return;
    }
    tbody.innerHTML = policies.map(p => `
        <tr>
            <td>${p.policyNumber}</td>
            <td>${p.policyHolder}</td>
            <td>${p.productName || '-'}</td>
            <td>¥${formatNumber(p.premiumAmount)}</td>
            <td>${p.paymentMethod || '-'}</td>
            <td>${formatDate(p.effectiveDate)}</td>
            <td>${p.graceDays || 60}天</td>
            <td>${p.autoAdvanceEnabled ? '✅' : '❌'}</td>
            <td>¥${formatNumber(p.cashValue || 0)}</td>
            <td><span class="status-badge status-${p.status}">${p.statusText}</span></td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="viewPolicyDetail('${p.policyNumber}')">详情</button>
                    <button class="btn btn-sm btn-secondary" onclick="viewVisitHistory('${p.policyNumber}')">回访</button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function viewPolicyDetail(policyNumber) {
    try {
        const result = await apiCall(`/policies/${policyNumber}`);
        const policy = mapPolicyFields(result.policy || result);
        document.getElementById('policyDetailTitle').textContent = `保单详情 - ${policyNumber}`;
        document.getElementById('policyDetailContent').innerHTML = `
            <div class="detail-grid">
                <div class="detail-item">
                    <label>保单号</label><span>${policy.policyNumber}</span>
                </div>
                <div class="detail-item">
                    <label>投保人</label><span>${policy.policyHolder}</span>
                </div>
                <div class="detail-item">
                    <label>联系电话</label><span>${policy.phone || '-'}</span>
                </div>
                <div class="detail-item">
                    <label>产品名称</label><span>${policy.productName || '-'}</span>
                </div>
                <div class="detail-item">
                    <label>保费金额</label><span>¥${formatNumber(policy.premiumAmount)}</span>
                </div>
                <div class="detail-item">
                    <label>缴费方式</label><span>${policy.paymentMethod || '-'}</span>
                </div>
                <div class="detail-item">
                    <label>生效日期</label><span>${formatDate(policy.effectiveDate)}</span>
                </div>
                <div class="detail-item">
                    <label>宽限天数</label><span>${policy.graceDays || 60}天</span>
                </div>
                <div class="detail-item">
                    <label>自动垫交</label><span>${policy.autoAdvanceEnabled ? '已启用' : '未启用'}</span>
                </div>
                <div class="detail-item">
                    <label>现金价值</label><span>¥${formatNumber(policy.cashValue || 0)}</span>
                </div>
                <div class="detail-item">
                    <label>当前状态</label><span><span class="status-badge status-${policy.status}">${policy.statusText}</span></span>
                </div>
                <div class="detail-item">
                    <label>客户意愿</label><span>${policy.intentText || '未确认'}</span>
                </div>
            </div>
            ${policy.missingFields && policy.missingFields.length > 0 ? `
                <div class="alert alert-warning mt-3">
                    <strong>缺失字段:</strong> ${policy.missingFields.join(', ')}
                </div>
            ` : ''}
            <h4 class="mt-4">缴费计划</h4>
            <table class="data-table">
                <thead>
                    <tr><th>期次</th><th>应缴日期</th><th>应缴金额</th><th>宽限结束</th><th>状态</th></tr>
                </thead>
                <tbody>
                    ${(policy.paymentPlans || []).map(pp => `
                        <tr>
                            <td>${pp.period}</td>
                            <td>${formatDate(pp.dueDate)}</td>
                            <td>¥${formatNumber(pp.amount)}</td>
                            <td>${formatDate(pp.graceEndDate)}</td>
                            <td><span class="status-badge status-${pp.status}">${pp.statusText}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ${(policy.visitRecords || []).length > 0 ? `
                <h4 class="mt-4">回访记录</h4>
                <table class="data-table">
                    <thead>
                        <tr><th>回访日期</th><th>回访方式</th><th>客户意愿</th><th>备注</th></tr>
                    </thead>
                    <tbody>
                        ${policy.visitRecords.map(vr => `
                            <tr>
                                <td>${formatDate(vr.visitDate)}</td>
                                <td>${vr.visitMethod}</td>
                                <td>${vr.intentText}</td>
                                <td>${vr.notes || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : ''}
        `;
        document.getElementById('policyDetailCard').style.display = 'block';
        document.getElementById('policyDetailCard').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('加载保单详情失败:', error);
    }
}

async function viewVisitHistory(policyNumber) {
    try {
        const result = await apiCall(`/visit-records?policyNo=${policyNumber}`);
        const records = Array.isArray(result) ? result : (result.visits || result.records || []);
        const visits = records.map(mapVisitFields);
        showModal(`回访记录 - ${policyNumber}`, `
            <table class="data-table">
                <thead>
                    <tr><th>回访日期</th><th>回访方式</th><th>客户意愿</th><th>回访人</th><th>备注</th></tr>
                </thead>
                <tbody>
                    ${visits.length === 0 ? '<tr><td colspan="5" class="text-center text-muted">暂无回访记录</td></tr>' : 
                        visits.map(v => `
                            <tr>
                                <td>${formatDate(v.visitDate)}</td>
                                <td>${v.visitMethod}</td>
                                <td><span class="status-badge status-${v.intent}">${v.intentText}</span></td>
                                <td>${v.visitor || '-'}</td>
                                <td>${v.notes || '-'}</td>
                            </tr>
                        `).join('')
                    }
                </tbody>
            </table>
            <div class="mt-3">
                <h5>新增回访</h5>
                <div class="form-group">
                    <label>回访方式</label>
                    <select id="newVisitMethod" class="form-control">
                        <option value="电话">电话</option>
                        <option value="短信">短信</option>
                        <option value="微信">微信</option>
                        <option value="上门">上门</option>
                        <option value="其他">其他</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>客户意愿</label>
                    <select id="newVisitIntent" class="form-control">
                        <option value="unknown">未确认</option>
                        <option value="renew">确定续保</option>
                        <option value="delay">缓交</option>
                        <option value="stop">停保</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>备注</label>
                    <textarea id="newVisitNotes" class="form-control" rows="2"></textarea>
                </div>
            </div>
        `, `
            <button class="btn btn-secondary" onclick="closeModal()">关闭</button>
            <button class="btn btn-primary" onclick="saveVisitRecord('${policyNumber}')">保存回访</button>
        `);
    } catch (error) {
        console.error('加载回访记录失败:', error);
    }
}

function showAddVisitModal() {
    if (!state.data.policies || state.data.policies.length === 0) {
        showMessage('请先加载保单数据', 'warning');
        return;
    }
    showModal('新增回访记录', `
        <div class="form-group">
            <label>选择保单</label>
            <select id="newVisitPolicy" class="form-control">
                ${state.data.policies.map(p => `
                    <option value="${p.policyNumber}">${p.policyNumber} - ${p.policyHolder}</option>
                `).join('')}
            </select>
        </div>
        <div class="form-group">
            <label>回访方式</label>
            <select id="newVisitMethod" class="form-control">
                <option value="电话">电话</option>
                <option value="短信">短信</option>
                <option value="微信">微信</option>
                <option value="上门">上门</option>
                <option value="其他">其他</option>
            </select>
        </div>
        <div class="form-group">
            <label>客户意愿</label>
            <select id="newVisitIntent" class="form-control">
                <option value="unknown">未确认</option>
                <option value="renew">确定续保</option>
                <option value="delay">缓交</option>
                <option value="stop">停保</option>
            </select>
        </div>
        <div class="form-group">
            <label>备注</label>
            <textarea id="newVisitNotes" class="form-control" rows="2"></textarea>
        </div>
    `, `
        <button class="btn btn-secondary" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="saveNewVisit()">保存</button>
    `);
}

async function saveVisitRecord(policyNumber) {
    const visitMethod = document.getElementById('newVisitMethod').value;
    const intent = document.getElementById('newVisitIntent').value;
    const notes = document.getElementById('newVisitNotes').value;
    
    const intentMap = { 'renew': '续保', 'delay': '缓交', 'stop': '停保', 'unknown': '' };
    
    try {
        await apiCall('/visit-records', {
            method: 'POST',
            body: JSON.stringify({
                policyNo: policyNumber,
                visitDate: new Date().toISOString().split('T')[0],
                visitType: visitMethod,
                visitor: '当前用户',
                contactResult: '已联系',
                customerIntent: intentMap[intent] || '',
                intentConfirmed: intent !== 'unknown',
                remark: notes
            }),
            loadingText: '正在保存回访记录...'
        });
        closeModal();
        loadPoliciesData();
        showMessage('回访记录保存成功', 'success');
    } catch (error) {
        console.error('保存回访记录失败:', error);
    }
}

async function saveNewVisit() {
    const policyNumber = document.getElementById('newVisitPolicy').value;
    await saveVisitRecord(policyNumber);
}

async function loadReportsData() {
    try {
        const result = await apiCall('/reports');
        state.data.reports = Array.isArray(result) ? result : (result.reports || []);
        renderReportsTable();
    } catch (error) {
        console.error('加载报告数据失败:', error);
    }
}

async function generateNewReport() {
    try {
        const result = await apiCall('/generate-report', {
            method: 'POST',
            loadingText: '正在生成报告...'
        });
        state.data.currentReport = result.report || result;
        loadReportsData();
        showReportDetail(state.data.currentReport);
        showMessage('报告生成成功', 'success');
    } catch (error) {
        console.error('生成报告失败:', error);
    }
}

function renderReportsTable() {
    const reports = state.data.reports || [];
    const tbody = document.querySelector('#reportsTable tbody');
    if (reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">暂无报告</td></tr>';
        return;
    }
    tbody.innerHTML = reports.map(r => `
        <tr>
            <td>${r.reportId}</td>
            <td>${formatDate(r.generatedAt)}</td>
            <td>${r.reportPeriod}</td>
            <td>${r.totalPolicies}</td>
            <td>${r.pendingPayment}</td>
            <td>${r.inGracePeriod}</td>
            <td>${r.overdue}</td>
            <td>${r.paid}</td>
            <td>
                <div class="btn-group">
                    <button class="btn btn-sm btn-primary" onclick="viewReportDetail('${r.reportId}')">查看</button>
                    <button class="btn btn-sm btn-secondary" onclick="downloadReport('${r.reportId}', 'json')">JSON</button>
                    <button class="btn btn-sm btn-success" onclick="downloadReport('${r.reportId}', 'csv')">CSV</button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function viewReportDetail(reportId) {
    try {
        const result = await apiCall(`/reports/${reportId}`);
        state.data.currentReport = result.report || result;
        showReportDetail(state.data.currentReport);
    } catch (error) {
        console.error('加载报告详情失败:', error);
    }
}

function showReportDetail(report) {
    document.getElementById('reportDetailTitle').textContent = `报告详情 - ${report.reportId}`;
    document.getElementById('reportDetailContent').innerHTML = `
        <div class="detail-grid">
            <div class="detail-item">
                <label>报告ID</label><span>${report.reportId}</span>
            </div>
            <div class="detail-item">
                <label>生成时间</label><span>${formatDate(report.generatedAt)}</span>
            </div>
            <div class="detail-item">
                <label>报告期</label><span>${report.reportPeriod}</span>
            </div>
            <div class="detail-item">
                <label>生成人</label><span>${report.generatedBy || '系统'}</span>
            </div>
        </div>
        <h4 class="mt-4">统计概览</h4>
        <div class="stats-row">
            <div class="stat-mini">
                <span class="stat-mini-label">保单总数</span>
                <span class="stat-mini-value">${report.totalPolicies}</span>
            </div>
            <div class="stat-mini">
                <span class="stat-mini-label">待缴费</span>
                <span class="stat-mini-value text-warning">${report.pendingPayment}</span>
            </div>
            <div class="stat-mini">
                <span class="stat-mini-label">宽限期内</span>
                <span class="stat-mini-value text-info">${report.inGracePeriod}</span>
            </div>
            <div class="stat-mini">
                <span class="stat-mini-label">已过期</span>
                <span class="stat-mini-value text-danger">${report.overdue}</span>
            </div>
            <div class="stat-mini">
                <span class="stat-mini-label">已垫交</span>
                <span class="stat-mini-value text-secondary">${report.advancePayment}</span>
            </div>
            <div class="stat-mini">
                <span class="stat-mini-label">已缴费</span>
                <span class="stat-mini-value text-success">${report.paid}</span>
            </div>
        </div>
        <h4 class="mt-4">财务概览</h4>
        <div class="stats-row">
            <div class="stat-mini">
                <span class="stat-mini-label">应收总额</span>
                <span class="stat-mini-value">¥${formatNumber(report.totalReceivable || 0)}</span>
            </div>
            <div class="stat-mini">
                <span class="stat-mini-label">已收金额</span>
                <span class="stat-mini-value text-success">¥${formatNumber(report.totalPaid || 0)}</span>
            </div>
            <div class="stat-mini">
                <span class="stat-mini-label">待收金额</span>
                <span class="stat-mini-value text-warning">¥${formatNumber(report.totalPending || 0)}</span>
            </div>
            <div class="stat-mini">
                <span class="stat-mini-label">回收率</span>
                <span class="stat-mini-value">${(report.recoveryRate || 0).toFixed(1)}%</span>
            </div>
        </div>
        ${report.recommendations && report.recommendations.length > 0 ? `
            <h4 class="mt-4">业务建议</h4>
            <div class="recommendations-list">
                ${report.recommendations.map(rec => `
                    <div class="recommendation-item priority-${rec.priority}">
                        <div class="rec-title">${rec.title}</div>
                        <div class="rec-desc">${rec.description}</div>
                        ${rec.actionItems ? `<div class="rec-actions">建议: ${rec.actionItems}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        ` : ''}
        ${report.nextSteps && report.nextSteps.length > 0 ? `
            <h4 class="mt-4">下一步行动计划</h4>
            <table class="data-table">
                <thead>
                    <tr><th>优先级</th><th>行动项</th><th>说明</th><th>涉及保单</th><th>建议时间</th></tr>
                </thead>
                <tbody>
                    ${report.nextSteps.map(step => `
                        <tr>
                            <td><span class="badge badge-${getUrgencyClass(step.urgency)}">${step.urgency}</span></td>
                            <td>${step.action}</td>
                            <td>${step.description}</td>
                            <td>${step.policyCount || 0}份</td>
                            <td>${step.suggestedTime || '立即'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : ''}
    `;
    document.getElementById('reportDetailCard').style.display = 'block';
    document.getElementById('reportDetailCard').scrollIntoView({ behavior: 'smooth' });
}

function exportReportJson() {
    const report = state.data.currentReport;
    if (!report) return;
    downloadBlob(JSON.stringify(report, null, 2), `report-${report.reportId}.json`, 'application/json');
}

function exportReportCsv() {
    const report = state.data.currentReport;
    if (!report) return;
    const headers = ['保单号', '投保人', '期次', '应缴日期', '应缴金额', '状态', '宽限结束日', '剩余天数'];
    const rows = (report.details || []).map(d => [
        d.policyNumber, d.policyHolder, d.period, formatDate(d.dueDate),
        d.premiumAmount, d.statusText, formatDate(d.graceEndDate), d.daysRemaining
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadBlob(csv, `report-${report.reportId}.csv`, 'text/csv');
}

async function downloadReport(reportId, format) {
    try {
        const response = await fetch(`${API_BASE}/export-report?reportId=${reportId}&format=${format}`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${reportId}.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
        showMessage('下载成功', 'success');
    } catch (error) {
        console.error('下载失败:', error);
    }
}

async function loadSettingsData() {
    try {
        const [config, holidays, backups] = await Promise.all([
            apiCall('/config'),
            apiCall('/holidays'),
            apiCall('/backups')
        ]);
        state.config = config || {};
        state.data.holidays = Array.isArray(holidays) ? holidays : (holidays.holidays || []);
        state.data.backups = Array.isArray(backups) ? backups : (backups.backups || []);
        renderConfigForm(state.config);
        renderHolidaysList(state.data.holidays);
        renderBackupsList(state.data.backups);
    } catch (error) {
        console.error('加载设置数据失败:', error);
    }
}

function renderConfigForm(config) {
    document.getElementById('configGraceDays').value = config.gracePeriodDays || config.graceDays || 60;
    document.getElementById('configInterestRate').value = config.defaultInterestRate || config.interestRate || 5;
    document.getElementById('configReminderIntervals').value = (config.reminderIntervals || [3, 7, 15, 30]).join(',');
    document.getElementById('configAutoAdvance').checked = config.autoAdvanceEnabled || false;
}

async function loadConfig() {
    try {
        const result = await apiCall('/config');
        state.config = result || {};
    } catch (error) {
        console.error('加载配置失败:', error);
    }
}

async function saveConfig() {
    const config = {
        gracePeriodDays: parseInt(document.getElementById('configGraceDays').value),
        defaultInterestRate: parseFloat(document.getElementById('configInterestRate').value),
        reminderIntervals: document.getElementById('configReminderIntervals').value.split(',').map(s => parseInt(s.trim())),
        autoAdvanceEnabled: document.getElementById('configAutoAdvance').checked
    };
    try {
        await apiCall('/config', {
            method: 'POST',
            body: JSON.stringify(config),
            loadingText: '正在保存设置...'
        });
        state.config = config;
        showMessage('设置保存成功', 'success');
    } catch (error) {
        console.error('保存设置失败:', error);
    }
}

function renderHolidaysList(holidays) {
    const container = document.getElementById('holidaysList');
    if (holidays.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无节假日配置</div>';
        return;
    }
    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr><th>日期</th><th>名称</th><th>类型</th><th>操作</th></tr>
            </thead>
            <tbody>
                ${holidays.map(h => `
                    <tr>
                        <td>${formatDate(h.date)}</td>
                        <td>${h.name}</td>
                        <td><span class="badge ${h.type === 'workday' ? 'badge-success' : 'badge-warning'}">
                            ${h.type === 'workday' ? '工作日' : '节假日'}
                        </span></td>
                        <td>
                            <button class="btn btn-sm btn-danger" onclick="deleteHoliday('${h.date}')">删除</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function addHoliday(type) {
    const date = document.getElementById('holidayDate').value;
    const name = document.getElementById('holidayName').value.trim();
    if (!date) {
        showMessage('请选择日期', 'warning');
        return;
    }
    try {
        const endpoint = type === 'workday' ? '/workdays' : '/holidays';
        await apiCall(endpoint, {
            method: 'POST',
            body: JSON.stringify({ date, name }),
            loadingText: '正在添加...'
        });
        document.getElementById('holidayDate').value = '';
        document.getElementById('holidayName').value = '';
        loadSettingsData();
        showMessage('添加成功', 'success');
    } catch (error) {
        console.error('添加失败:', error);
    }
}

async function deleteHoliday(date) {
    if (!confirm('确定要删除这个节假日吗？')) return;
    try {
        state.data.holidays = state.data.holidays.filter(h => h.date !== date);
        renderHolidaysList(state.data.holidays);
        showMessage('已从列表中移除', 'info');
    } catch (error) {
        console.error('删除失败:', error);
    }
}

function renderBackupsList(backups) {
    const container = document.getElementById('backupsList');
    if (backups.length === 0) {
        container.innerHTML = '<div class="empty-state">暂无备份</div>';
        return;
    }
    container.innerHTML = `
        <table class="data-table">
            <thead>
                <tr><th>备份ID</th><th>创建时间</th><th>大小</th><th>版本</th><th>操作</th></tr>
            </thead>
            <tbody>
                ${backups.map(b => `
                    <tr>
                        <td>${b.backupId}</td>
                        <td>${formatDate(b.createdAt)}</td>
                        <td>${formatFileSize(b.size)}</td>
                        <td>v${b.version}</td>
                        <td>
                            <div class="btn-group">
                                <button class="btn btn-sm btn-primary" onclick="restoreBackup('${b.backupId}')">恢复</button>
                                <button class="btn btn-sm btn-secondary" onclick="downloadBackup('${b.backupId}')">下载</button>
                                <button class="btn btn-sm btn-danger" onclick="deleteBackup('${b.backupId}')">删除</button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function createBackup() {
    try {
        const result = await apiCall('/backup', {
            method: 'POST',
            loadingText: '正在创建备份...'
        });
        loadSettingsData();
        showMessage(`备份创建成功`, 'success');
    } catch (error) {
        console.error('创建备份失败:', error);
    }
}

async function restoreBackup(backupFile) {
    if (!confirm('恢复备份将覆盖当前所有数据，确定继续吗？')) return;
    try {
        await apiCall('/restore', {
            method: 'POST',
            body: JSON.stringify({ backupFile }),
            loadingText: '正在恢复备份...'
        });
        loadSettingsData();
        loadDashboard();
        showMessage('备份恢复成功', 'success');
    } catch (error) {
        console.error('恢复备份失败:', error);
    }
}

async function downloadBackup(backupFile) {
    try {
        const result = await apiCall('/export');
        downloadBlob(JSON.stringify(result, null, 2), `backup-${Date.now()}.json`, 'application/json');
        showMessage('下载成功', 'success');
    } catch (error) {
        console.error('下载失败:', error);
    }
}

async function deleteBackup(backupFile) {
    if (!confirm('确定要删除这个备份吗？')) return;
    try {
        state.data.backups = state.data.backups.filter(b => b.backupFile !== backupFile && b.backupId !== backupFile);
        renderBackupsList(state.data.backups);
        showMessage('已从列表中移除', 'info');
    } catch (error) {
        console.error('删除失败:', error);
    }
}

async function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    showLoading('正在导入数据...');
    try {
        const response = await fetch(`${API_BASE}/upload`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        hideLoading();
        if (!response.ok) throw new Error(result.error || '导入失败');
        const data = result.data || result;
        document.getElementById('importResult').innerHTML = `
            <div class="alert alert-success">
                <strong>导入成功!</strong><br>
                处理: ${data.totalFiles || data.total || 0} 个文件<br>
                成功: ${data.successCount || 0} 个<br>
                失败: ${data.failedCount || 0} 个
            </div>
        `;
        loadDashboard();
        loadGraceData();
        showMessage('数据导入成功', 'success');
    } catch (error) {
        hideLoading();
        document.getElementById('importResult').innerHTML = `
            <div class="alert alert-danger">
                <strong>导入失败:</strong> ${error.message}
            </div>
        `;
        showMessage(error.message, 'error');
    }
    e.target.value = '';
}

async function exportAllData() {
    try {
        const result = await apiCall('/export');
        downloadBlob(JSON.stringify(result, null, 2), `insurance-data-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
        showMessage('导出成功', 'success');
    } catch (error) {
        console.error('导出失败:', error);
    }
}

function showLoading(text = '处理中...') {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showMessage(text, type = 'info') {
    const toast = document.getElementById('messageToast');
    const textEl = document.getElementById('messageText');
    toast.className = `message-toast toast-${type}`;
    textEl.textContent = text;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

function showModal(title, body, footer = '') {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modalFooter').innerHTML = footer || '<button class="btn btn-secondary" onclick="closeModal()">关闭</button>';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.getElementById('modalBody').innerHTML = '';
    document.getElementById('modalFooter').innerHTML = '';
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatNumber(num) {
    if (num === undefined || num === null || isNaN(num)) return '0.00';
    return Number(num).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}