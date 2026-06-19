const API_BASE = '';
let currentPage = 1;
let currentStatus = '';
let currentKeyword = '';
let showResolved = false;

async function loadProblems() {
    const params = new URLSearchParams({
        page: currentPage,
        per_page: 20
    });
    if (currentStatus) params.append('status', currentStatus);
    if (currentKeyword) params.append('keyword', currentKeyword);

    try {
        const resp = await fetch(API_BASE + '/api/problems?' + params.toString());
        const data = await resp.json();
        renderProblems(data.problems);
        renderPagination(data.total, data.page, data.per_page);
    } catch (e) {
        console.error('加载题目失败:', e);
        document.getElementById('problems-list').innerHTML =
            '<tr><td colspan="8" class="loading">加载失败</td></tr>';
    }
}

function renderProblems(problems) {
    const tbody = document.getElementById('problems-list');
    if (problems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">暂无数据</td></tr>';
        return;
    }

    tbody.innerHTML = problems.map(p => `
        <tr>
            <td><code>${p.problem_id}</code></td>
            <td>${escapeHtml(p.title)}</td>
            <td><span class="badge ${getStatusBadge(p.current_status)}">${getStatusText(p.current_status)}</span></td>
            <td>${p.version_count}</td>
            <td>${p.answer_count}</td>
            <td>${p.anomaly_count > 0 ? `<span class="badge badge-danger">${p.anomaly_count}</span>` : '-'}</td>
            <td>${formatDate(p.updated_at)}</td>
            <td>
                <button class="btn btn-info" onclick="showProblemDetail(${p.id})">详情</button>
                <button class="btn btn-primary" onclick="showEditProblem(${p.id})">编辑</button>
            </td>
        </tr>
    `).join('');
}

function renderPagination(total, page, perPage) {
    const totalPages = Math.ceil(total / perPage);
    const el = document.getElementById('pagination');

    if (totalPages <= 1) {
        el.innerHTML = '';
        return;
    }

    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    el.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    loadProblems();
}

async function loadTasks() {
    try {
        const resp = await fetch(API_BASE + '/api/check/tasks');
        const tasks = await resp.json();
        renderTasks(tasks);
    } catch (e) {
        console.error('加载任务失败:', e);
        document.getElementById('tasks-list').innerHTML =
            '<tr><td colspan="9" class="loading">加载失败</td></tr>';
    }
}

function renderTasks(tasks) {
    const tbody = document.getElementById('tasks-list');
    if (tasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty">暂无任务</td></tr>';
        return;
    }

    tbody.innerHTML = tasks.map(t => `
        <tr>
            <td><code>${t.task_id}</code></td>
            <td>${escapeHtml(t.name)}</td>
            <td><code>${t.params_version || '-'}</code></td>
            <td><span class="badge ${t.status === 'completed' ? 'badge-success' : t.status === 'running' ? 'badge-warning' : 'badge-danger'}">${t.status === 'completed' ? '已完成' : t.status === 'running' ? '运行中' : t.status}</span></td>
            <td>${t.result_count}</td>
            <td>${t.anomaly_count > 0 ? `<span class="badge badge-danger">${t.anomaly_count}</span>` : '0'}</td>
            <td>${t.pending_count > 0 ? `<span class="badge badge-warning">${t.pending_count}</span>` : '0'}</td>
            <td>${formatDate(t.started_at)}</td>
            <td>
                ${t.status !== 'completed' && t.status !== 'running' ?
                    `<button class="btn btn-primary" onclick="runTask(${t.id})">运行</button>` : ''}
                ${t.status === 'completed' ?
                    `<a href="/review/${t.id}" class="btn btn-info">复核</button>` : ''}
                <button class="btn btn-success" onclick="exportTask(${t.id})">导出</button>
            </td>
        </tr>
    `).join('');
}

async function loadAnomalies() {
    try {
        const resp = await fetch(API_BASE + '/api/anomalies?unresolved=' + (!showResolved).toString());
        const anomalies = await resp.json();
        renderAnomalies(anomalies);
    } catch (e) {
        console.error('加载异常失败:', e);
        document.getElementById('anomalies-list').innerHTML =
            '<tr><td colspan="7" class="loading">加载失败</td></tr>';
    }
}

function renderAnomalies(anomalies) {
    const tbody = document.getElementById('anomalies-list');
    if (anomalies.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">✅ 暂无异常记录</td></tr>';
        return;
    }

    tbody.innerHTML = anomalies.map(a => `
        <tr>
            <td><code>${a.problem.problem_id}</code></td>
            <td>${escapeHtml(a.problem.title)}</td>
            <td><span class="badge badge-danger">${a.anomaly_type}</span></td>
            <td>${escapeHtml(a.description)}</td>
            <td>${formatDate(a.detected_at)}</td>
            <td>${a.is_resolved ? '<span class="badge badge-success">已解决</span>' : '<span class="badge badge-warning">未解决</span>'}</td>
            <td>
                ${!a.is_resolved ?
                    `<button class="btn btn-success" onclick="resolveAnomaly(${a.id})">标记解决</button>` : ''}
            </td>
        </tr>
    `).join('');
}

function getStatusBadge(status) {
    const map = {
        'pending': 'badge-secondary',
        'single_covered': 'badge-warning',
        'double_covered': 'badge-success'
    };
    return map[status] || 'badge-secondary';
}

function getStatusText(status) {
    const map = {
        'pending': '待处理',
        'single_covered': '单答案覆盖',
        'double_covered': '双答案覆盖'
    };
    return map[status] || status;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

function showModal(title, bodyHtml, footerHtml = '') {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-footer').innerHTML = footerHtml || '<button class="btn" onclick="closeModal()">关闭</button>';
    document.getElementById('modal').classList.add('active');
}

async function showProblemDetail(id) {
    try {
        const resp = await fetch(API_BASE + `/api/problems/${id}`);
        const p = await resp.json();

        let html = `
            <div class="detail-section">
                <h3>${escapeHtml(p.title)}</h3>
                <p><strong>题目ID:</strong> <code>${p.problem_id}</code></p>
                <p><strong>状态:</strong> <span class="badge ${getStatusBadge(p.current_status)}">${getStatusText(p.current_status)}</span></p>
                ${p.description ? `<p><strong>描述:</strong> ${escapeHtml(p.description)}</p>` : ''}
            </div>
            <div class="detail-section">
                <h4>矩阵数据</h4>
                <pre class="json-pre">${p.matrix_data || '无'}</pre>
            </div>
        `;

        if (p.answers && p.answers.length > 0) {
            html += `
                <div class="detail-section">
                    <h4>关联答案 (${p.answers.length})</h4>
                    ${p.answers.map(a => `
                        <div style="padding: 0.75rem; background: #f7fafc; border-radius: 6px; margin-bottom: 0.5rem;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                                <span><strong>${a.answer_id}</strong> (版本: ${a.version})</span>
                                <span class="badge ${a.problem_answer.coverage_status === 'covered' ? 'badge-success' : 'badge-warning'}">
                                    ${a.problem_answer.coverage_status === 'covered' ? '已覆盖' : '待确认'}
                                </span>
                            </div>
                            ${a.problem_answer.is_manual_override ?
                                `<div style="font-size: 0.8rem; color: #e53e3e; margin-top: 0.25rem;">
                                    ⚠️ 已人工改判: ${escapeHtml(a.problem_answer.override_reason || '')}
                                </div>` : ''}
                            <pre style="margin-top: 0.5rem; font-size: 0.8rem;">${escapeHtml(a.content)}</pre>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (p.versions && p.versions.length > 0) {
            html += `
                <div class="detail-section">
                    <h4>历史版本 (${p.versions.length})</h4>
                    ${p.versions.map(v => `
                        <div style="padding: 0.75rem; background: #f7fafc; border-radius: 6px; margin-bottom: 0.5rem;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                <strong>v${v.version}</strong>
                                <small style="color: #718096;">${formatDate(v.created_at)} by ${escapeHtml(v.modified_by || 'system')}</small>
                            </div>
                            ${v.remark ? `<p style="margin: 0.25rem 0;">${escapeHtml(v.remark)}</p>` : ''}
                            ${v.change_log ? `<p style="margin: 0.25rem 0; font-size: 0.85rem; color: #718096;">变更: ${escapeHtml(v.change_log)}</p>` : ''}
                            ${v.screenshot_path ? `<p style="margin: 0.25rem 0;"><a href="${v.screenshot_path}" target="_blank">查看截图</a></p>` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        if (p.anomalies && p.anomalies.length > 0) {
            html += `
                <div class="detail-section section-anomaly">
                    <h4>异常记录 (${p.anomalies.length})</h4>
                    ${p.anomalies.map(a => `
                        <div style="padding: 0.75rem; background: #fff5f5; border-radius: 6px; margin-bottom: 0.5rem; border: 1px solid #fed7d7;">
                            <div style="display: flex; justify-content: space-between;">
                                <span class="badge badge-danger">${a.anomaly_type}</span>
                                <span class="badge ${a.is_resolved ? 'badge-success' : 'badge-warning'}">
                                    ${a.is_resolved ? '已解决' : '未解决'}
                                </span>
                            </div>
                            <p style="margin: 0.5rem 0;">${escapeHtml(a.description)}</p>
                            <small style="color: #718096;">检测于 ${formatDate(a.detected_at)}</small>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        showModal('题目详情', html);
    } catch (e) {
        alert('加载失败: ' + e.message);
    }
}

function showEditProblem(id) {
    const bodyHtml = `
        <div class="form-group">
            <label>标题</label>
            <input type="text" id="edit-title" class="input" style="width: 100%;">
        </div>
        <div class="form-group">
            <label>描述</label>
            <textarea id="edit-description" class="textarea" rows="2"></textarea>
        </div>
        <div class="form-group">
            <label>矩阵数据 (JSON数组)</label>
            <textarea id="edit-matrix" class="textarea" rows="3" placeholder="如: [[1,2],[3,4]]"></textarea>
        </div>
        <div class="form-group">
            <label>状态</label>
            <select id="edit-status" class="select" style="width: 100%;">
                <option value="pending">待处理</option>
                <option value="single_covered">单答案覆盖</option>
                <option value="double_covered">双答案覆盖</option>
            </select>
        </div>
        <div class="form-group">
            <label>备注 (必填，如果填写将创建新版本)</label>
            <textarea id="edit-remark" class="textarea" rows="2" placeholder="本次修改的说明..."></textarea>
        </div>
        <div class="form-group">
            <label>修改人</label>
            <input type="text" id="edit-modified-by" class="input" style="width: 100%;" value="小孟">
        </div>
    `;

    const footerHtml = `
        <button class="btn" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="submitEditProblem(${id})">保存</button>
    `;

    showModal('编辑题目', bodyHtml, footerHtml);

    fetch(API_BASE + `/api/problems/${id}`).then(r => r.json()).then(p => {
        document.getElementById('edit-title').value = p.title || '';
        document.getElementById('edit-description').value = p.description || '';
        document.getElementById('edit-matrix').value = p.matrix_data || '';
        document.getElementById('edit-status').value = p.current_status || 'pending';
    });
}

async function submitEditProblem(id) {
    const title = document.getElementById('edit-title').value;
    const description = document.getElementById('edit-description').value;
    const matrixStr = document.getElementById('edit-matrix').value;
    const status = document.getElementById('edit-status').value;
    const remark = document.getElementById('edit-remark').value;
    const modifiedBy = document.getElementById('edit-modified-by').value;

    let matrix_data;
    try {
        matrix_data = matrixStr ? JSON.parse(matrixStr) : undefined;
    } catch (e) {
        alert('矩阵数据格式错误，请输入有效的JSON数组');
        return;
    }

    try {
        const resp = await fetch(API_BASE + `/api/problems/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, matrix_data, current_status: status, remark, modified_by: modifiedBy })
        });
        const data = await resp.json();
        if (data.success) {
            alert('保存成功');
            closeModal();
            loadProblems();
        } else {
            alert('保存失败: ' + (data.error || '未知错误'));
        }
    } catch (e) {
        alert('保存失败: ' + e.message);
    }
}

function showAddProblem() {
    const bodyHtml = `
        <div class="form-group">
            <label>题目ID (可选，自动生成)</label>
            <input type="text" id="add-problem-id" class="input" style="width: 100%;" placeholder="如: P001">
        </div>
        <div class="form-group">
            <label>标题 *</label>
            <input type="text" id="add-title" class="input" style="width: 100%;">
        </div>
        <div class="form-group">
            <label>描述</label>
            <textarea id="add-description" class="textarea" rows="2"></textarea>
        </div>
        <div class="form-group">
            <label>矩阵数据 * (JSON数组)</label>
            <textarea id="add-matrix" class="textarea" rows="3" placeholder="如: [[1,2],[3,4]]"></textarea>
        </div>
        <div class="form-group">
            <label>备注</label>
            <textarea id="add-remark" class="textarea" rows="2" placeholder="初始说明..."></textarea>
        </div>
        <div class="form-group">
            <label>创建人</label>
            <input type="text" id="add-modified-by" class="input" style="width: 100%;" value="小孟">
        </div>
    `;

    const footerHtml = `
        <button class="btn" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="submitAddProblem()">创建</button>
    `;

    showModal('新增题目', bodyHtml, footerHtml);
}

async function submitAddProblem() {
    const problem_id = document.getElementById('add-problem-id').value;
    const title = document.getElementById('add-title').value;
    const description = document.getElementById('add-description').value;
    const matrixStr = document.getElementById('add-matrix').value;
    const remark = document.getElementById('add-remark').value;
    const modifiedBy = document.getElementById('add-modified-by').value;

    if (!title.trim()) {
        alert('请输入标题');
        return;
    }

    let matrix_data;
    try {
        matrix_data = matrixStr ? JSON.parse(matrixStr) : [];
    } catch (e) {
        alert('矩阵数据格式错误，请输入有效的JSON数组');
        return;
    }

    try {
        const resp = await fetch(API_BASE + '/api/problems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ problem_id: problem_id || undefined, title, description, matrix_data, remark, modified_by: modifiedBy })
        });
        const data = await resp.json();
        if (data.id) {
            alert('创建成功');
            closeModal();
            loadProblems();
        } else {
            alert('创建失败: ' + (data.error || '未知错误'));
        }
    } catch (e) {
        alert('创建失败: ' + e.message);
    }
}

function showNewTask() {
    const bodyHtml = `
        <div class="form-group">
            <label>任务名称</label>
            <input type="text" id="new-task-name" class="input" style="width: 100%;" placeholder="如: 2024年Q1矩阵验算">
        </div>
        <div class="form-group">
            <label>创建人</label>
            <input type="text" id="new-task-creator" class="input" style="width: 100%;" value="小孟">
        </div>
        <p style="color: #718096; font-size: 0.85rem;">
            将对所有题目执行矩阵分解验算，检测重复样本并生成报告。
        </p>
    `;

    const footerHtml = `
        <button class="btn" onclick="closeModal()">取消</button>
        <button class="btn btn-primary" onclick="submitNewTask()">创建并运行</button>
    `;

    showModal('新建验算任务', bodyHtml, footerHtml);
}

async function submitNewTask() {
    const name = document.getElementById('new-task-name').value;
    const created_by = document.getElementById('new-task-creator').value;

    try {
        const resp = await fetch(API_BASE + '/api/check/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, created_by })
        });
        const data = await resp.json();
        if (data.id) {
            closeModal();
            await runTask(data.id);
        } else {
            alert('创建失败: ' + (data.error || '未知错误'));
        }
    } catch (e) {
        alert('创建失败: ' + e.message);
    }
}

async function runTask(taskId) {
    if (!confirm('确定要运行此验算任务吗？可能需要一些时间。')) return;

    try {
        const resp = await fetch(API_BASE + `/api/check/tasks/${taskId}/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await resp.json();
        if (data.success) {
            alert('验算完成！\n报告已生成: ' + data.report_path);
            loadTasks();
            loadAnomalies();
        } else {
            alert('运行失败: ' + (data.error || '未知错误'));
        }
    } catch (e) {
        alert('运行失败: ' + e.message);
    }
}

async function exportTask(taskId) {
    window.open(`/api/export/${taskId}`, '_blank');
}

async function resolveAnomaly(id) {
    const resolution = prompt('请输入解决说明:');
    if (resolution === null) return;

    try {
        const resp = await fetch(API_BASE + `/api/anomalies/${id}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolution })
        });
        const data = await resp.json();
        if (data.success) {
            alert('已标记为解决');
            loadAnomalies();
        } else {
            alert('操作失败');
        }
    } catch (e) {
        alert('操作失败: ' + e.message);
    }
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + viewName).classList.add('active');

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');

    if (viewName === 'problems') loadProblems();
    else if (viewName === 'tasks') loadTasks();
    else if (viewName === 'anomalies') loadAnomalies();
}

function handleHashChange() {
    const hash = window.location.hash || '#/problems';
    const viewName = hash.replace('#/', '');
    if (['problems', 'tasks', 'anomalies'].includes(viewName)) {
        switchView(viewName);
    }
}

document.getElementById('search-input')?.addEventListener('input', function() {
    currentKeyword = this.value;
    currentPage = 1;
    loadProblems();
});

document.getElementById('status-filter')?.addEventListener('change', function() {
    currentStatus = this.value;
    currentPage = 1;
    loadProblems();
});

document.getElementById('btn-add-problem')?.addEventListener('click', showAddProblem);
document.getElementById('btn-new-task')?.addEventListener('click', showNewTask);

document.getElementById('show-resolved')?.addEventListener('change', function() {
    showResolved = this.checked;
    loadAnomalies();
});

window.addEventListener('hashchange', handleHashChange);
window.closeModal = closeModal;
window.showProblemDetail = showProblemDetail;
window.showEditProblem = showEditProblem;
window.submitEditProblem = submitEditProblem;
window.submitAddProblem = submitAddProblem;
window.submitNewTask = submitNewTask;
window.runTask = runTask;
window.exportTask = exportTask;
window.resolveAnomaly = resolveAnomaly;
window.goToPage = goToPage;

handleHashChange();
