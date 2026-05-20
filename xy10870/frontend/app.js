const API_BASE = 'http://localhost:8000/api/v1';

let currentPage = 1;
let currentPageSize = 10;
let currentRequestId = null;

async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${url}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || '请求失败');
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

function getStatusClass(status) {
    const statusMap = {
        'pending': 'status-pending',
        'queued': 'status-queued',
        'running': 'status-running',
        'success': 'status-success',
        'failed': 'status-failed',
        'timeout': 'status-timeout',
        'cancelled': 'status-cancelled',
        'merged': 'status-merged'
    };
    return statusMap[status] || 'status-pending';
}

function getStatusText(status) {
    const statusMap = {
        'pending': '待处理',
        'queued': '排队中',
        'running': '运行中',
        'success': '成功',
        'failed': '失败',
        'timeout': '超时',
        'cancelled': '已取消',
        'merged': '已合并'
    };
    return statusMap[status] || status;
}

async function loadStudents() {
    try {
        const students = await apiRequest('/students/');
        const select = document.getElementById('filterStudent');
        select.innerHTML = '<option value="">全部学生</option>';
        students.forEach(s => {
            select.innerHTML += `<option value="${s.student_id}">${s.name} (${s.student_id})</option>`;
        });
    } catch (error) {
        console.error('加载学生失败:', error);
    }
}

async function loadStatuses() {
    try {
        const statuses = await apiRequest('/statuses');
        const select = document.getElementById('filterStatus');
        select.innerHTML = '<option value="">全部状态</option>';
        statuses.forEach(s => {
            select.innerHTML += `<option value="${s}">${getStatusText(s)}</option>`;
        });
    } catch (error) {
        console.error('加载状态失败:', error);
    }
}

async function loadLanguages() {
    try {
        const languages = await apiRequest('/languages/');
        const select = document.getElementById('filterLanguage');
        select.innerHTML = '<option value="">全部语言</option>';
        languages.forEach(l => {
            select.innerHTML += `<option value="${l.name}">${l.name}</option>`;
        });
    } catch (error) {
        console.error('加载语言失败:', error);
    }
}

async function loadRequests() {
    try {
        const studentId = document.getElementById('filterStudent').value;
        const status = document.getElementById('filterStatus').value;
        const language = document.getElementById('filterLanguage').value;

        let url = `/requests/?page=${currentPage}&page_size=${currentPageSize}`;
        if (studentId) url += `&student_id=${studentId}`;
        if (status) url += `&status=${status}`;
        if (language) url += `&language=${language}`;

        const data = await apiRequest(url);
        renderRequestsTable(data.items);
        renderPagination(data.total, data.page, data.page_size);
    } catch (error) {
        console.error('加载请求失败:', error);
    }
}

function renderRequestsTable(requests) {
    const tbody = document.getElementById('requestsTableBody');
    
    if (requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">暂无数据</td></tr>';
        return;
    }

    tbody.innerHTML = requests.map(req => `
        <tr>
            <td><code>${req.request_id}</code></td>
            <td>${req.student ? req.student.name : '-'}</td>
            <td>${req.language ? req.language.name : '-'}</td>
            <td><span class="status-badge ${getStatusClass(req.status)}">${getStatusText(req.status)}</span></td>
            <td>${formatDate(req.created_at)}</td>
            <td>${req.execution_time_ms ? req.execution_time_ms + 'ms' : '-'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="showDetail('${req.request_id}')">
                    详情
                </button>
            </td>
        </tr>
    `).join('');
}

function renderPagination(total, page, pageSize) {
    const totalPages = Math.ceil(total / pageSize);
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '';
    
    html += `<li class="page-item ${page === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="changePage(${page - 1})">上一页</a>
    </li>`;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
            html += `<li class="page-item ${i === page ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage(${i})">${i}</a>
            </li>`;
        } else if (i === page - 2 || i === page + 2) {
            html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
    }

    html += `<li class="page-item ${page === totalPages ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="changePage(${page + 1})">下一页</a>
    </li>`;

    pagination.innerHTML = html;
}

function changePage(page) {
    currentPage = page;
    loadRequests();
    return false;
}

async function showDetail(requestId) {
    try {
        currentRequestId = requestId;
        const request = await apiRequest(`/requests/${requestId}`);
        const timeline = await apiRequest(`/requests/${requestId}/timeline`);
        
        const detailContent = document.getElementById('detailContent');
        detailContent.innerHTML = `
            <div class="row mb-4">
                <div class="col-md-6">
                    <p><strong>请求ID:</strong> <code>${request.request_id}</code></p>
                    <p><strong>学生:</strong> ${request.student ? request.student.name : '-'} (${request.student ? request.student.student_id : '-'})</p>
                    <p><strong>语言:</strong> ${request.language ? request.language.name : '-'}</p>
                </div>
                <div class="col-md-6">
                    <p><strong>状态:</strong> <span class="status-badge ${getStatusClass(request.status)}">${getStatusText(request.status)}</span></p>
                    <p><strong>创建时间:</strong> ${formatDate(request.created_at)}</p>
                    <p><strong>执行时间:</strong> ${request.execution_time_ms ? request.execution_time_ms + 'ms' : '-'}</p>
                </div>
            </div>
            
            <div class="mb-4">
                <h6>代码片段</h6>
                <div class="code-preview">${escapeHtml(request.code_snippet)}</div>
            </div>
            
            ${request.stdout ? `
            <div class="mb-4">
                <h6>标准输出</h6>
                <div class="code-preview">${escapeHtml(request.stdout)}</div>
            </div>
            ` : ''}
            
            ${request.stderr ? `
            <div class="mb-4">
                <h6>错误输出</h6>
                <div class="code-preview text-danger">${escapeHtml(request.stderr)}</div>
            </div>
            ` : ''}
            
            ${request.error_message ? `
            <div class="alert alert-danger">
                <strong>错误信息:</strong> ${request.error_message}
            </div>
            ` : ''}
            
            <div>
                <h6>状态时间线</h6>
                <div class="timeline">
                    ${timeline.map(item => `
                        <div class="timeline-item">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="status-badge ${getStatusClass(item.to_status)}">${getStatusText(item.to_status)}</span>
                            <small class="text-muted">${formatDate(item.timestamp)}</small>
                        </div>
                        ${item.message ? `<p class="mb-0 text-muted">${item.message}</p>` : ''}
                    </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        new bootstrap.Modal(document.getElementById('detailModal')).show();
    } catch (error) {
        console.error('加载详情失败:', error);
        alert('加载详情失败');
    }
}

async function manualFix() {
    if (!currentRequestId) return;
    
    const newStatus = prompt('请输入新状态 (pending/queued/running/success/failed/timeout/cancelled/merged):', 'success');
    if (!newStatus) return;
    
    try {
        await apiRequest(`/requests/${currentRequestId}?manual=true`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
        });
        alert('状态修正成功！');
        bootstrap.Modal.getInstance(document.getElementById('detailModal')).hide();
        loadRequests();
    } catch (error) {
        alert('修正失败: ' + error.message);
    }
}

async function batchImport() {
    const batchData = document.getElementById('batchData').value;
    
    try {
        JSON.parse(batchData);
    } catch (error) {
        alert('JSON格式错误');
        return;
    }
    
    try {
        const results = await apiRequest('/requests/batch-import', {
            method: 'POST',
            body: batchData
        });
        
        const resultsDiv = document.getElementById('batchResults');
        resultsDiv.innerHTML = `
            <div class="alert alert-info">
                共导入 ${results.total} 条记录
            </div>
            <div class="list-group">
                ${results.results.map(r => `
                    <div class="list-group-item list-group-item-${r.success ? 'success' : 'danger'}">
                        <div class="d-flex justify-content-between align-items-center">
                            <span>${r.student_id}</span>
                            ${r.success ? 
                                `<span class="badge bg-success">成功 - ${r.request_id} (${r.is_merged ? '已合并' : '已创建'})</span>` :
                                `<span class="badge bg-danger">失败 - ${r.error}</span>`
                            }
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        loadRequests();
    } catch (error) {
        alert('导入失败: ' + error.message);
    }
}

async function loadReport() {
    try {
        const days = document.getElementById('reportDays').value;
        const report = await apiRequest(`/report/stats?days=${days}`);
        
        document.getElementById('statsCards').innerHTML = `
            <div class="col-md-3">
                <div class="stat-card">
                    <h3>${report.total_requests}</h3>
                    <p>总请求数</p>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stat-card" style="background: linear-gradient(135deg, #56ab2f 0%, #a8e063 100%);">
                    <h3>${report.success_rate}%</h3>
                    <p>成功率</p>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stat-card" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
                    <h3>${report.avg_execution_time}</h3>
                    <p>平均执行时间(ms)</p>
                </div>
            </div>
            <div class="col-md-3">
                <div class="stat-card" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
                    <h3>${report.date_range.split('~')[1] || ''}</h3>
                    <p>统计周期</p>
                </div>
            </div>
        `;
        
        document.getElementById('dailyStats').innerHTML = `
            <table class="table table-sm">
                <thead>
                    <tr>
                        <th>日期</th>
                        <th>请求数</th>
                        <th>成功数</th>
                        <th>成功率</th>
                    </tr>
                </thead>
                <tbody>
                    ${report.daily_stats.map(day => `
                        <tr>
                            <td>${day.date}</td>
                            <td>${day.total}</td>
                            <td>${day.success}</td>
                            <td>${day.success_rate.toFixed(1)}%</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        document.getElementById('topStudents').innerHTML = `
            <div class="list-group">
                ${report.top_students.map((s, i) => `
                    <div class="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                            <span class="badge bg-primary me-2">#${i + 1}</span>
                            ${s.name}
                        </div>
                        <span class="badge bg-success">${s.count} 次</span>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        console.error('加载报告失败:', error);
    }
}

async function exportCSV() {
    window.open(`${API_BASE}/report/export/csv`, '_blank');
}

async function exportExcel() {
    window.open(`${API_BASE}/report/export/excel`, '_blank');
}

function refreshRequests() {
    currentPage = 1;
    loadRequests();
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    loadStudents();
    loadStatuses();
    loadLanguages();
    loadRequests();
    loadReport();
    
    document.getElementById('mainTabs').addEventListener('shown.bs.tab', (e) => {
        if (e.target.id === 'report-tab') {
            loadReport();
        }
    });
});
