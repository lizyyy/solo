const API_BASE = '/api';

async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (data) {
        options.body = JSON.stringify(data);
    }
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const result = await response.json();
    return result;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

function getStatusBadge(status) {
    const map = {
        'pending': ['待处理', 'badge-warning'],
        'completed': ['已完成', 'badge-success'],
        'pending_review': ['待复核', 'badge-danger'],
        'rejected': ['已驳回', 'badge-danger'],
        'ready': ['已就绪', 'badge-info']
    };
    const [text, cls] = map[status] || [status, 'badge-secondary'];
    return `<span class="badge ${cls}">${text}</span>`;
}

function getReviewBadge(status) {
    const map = {
        'pending': ['待复核', 'badge-warning'],
        'pending_review': ['待教研组复核', 'badge-danger'],
        'reviewed': ['已复核', 'badge-success'],
        'rejected': ['已驳回', 'badge-danger']
    };
    const [text, cls] = map[status] || [status, 'badge-secondary'];
    return `<span class="badge ${cls}">${text}</span>`;
}

async function loadLedgers() {
    const ledgers = await apiCall('/ledgers');
    const tbody = document.querySelector('#ledger-table tbody');
    tbody.innerHTML = '';
    
    ledgers.forEach(lr => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${lr.serial_no}</td>
            <td>${lr.title}</td>
            <td>${getStatusBadge(lr.status)}</td>
            <td>${lr.has_gap ? '<span class="badge badge-danger">有断档</span>' : '<span class="badge badge-success">正常</span>'}</td>
            <td>${lr.is_old_caliber ? '<span class="badge badge-warning">含旧口径</span>' : '<span class="badge badge-info">新口径</span>'}</td>
            <td>${getReviewBadge(lr.review_status)}</td>
            <td>${lr.weight_table_name || '-'}</td>
            <td>${formatDate(lr.created_at)}</td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="viewLedger(${lr.id})">查看</button>
                <button class="btn btn-primary btn-sm" onclick="runCalculation(${lr.id})">重跑</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    loadComparison();
}

async function loadComparison() {
    const results = await apiCall('/demo-results');
    const container = document.getElementById('compare-cards');
    container.innerHTML = '';
    
    const types = {
        'normal': { class: 'normal', title: '🟢 正常记录', desc: '顺利完成，无任何问题' },
        'gap': { class: 'gap', title: '🟡 断档记录', desc: '人工删除后编号断档，待复核' },
        'old': { class: 'old', title: '🟣 旧口径记录', desc: '从旧公式截图补录旧口径数据' }
    };
    
    results.forEach((r, idx) => {
        const typeKey = ['normal', 'gap', 'old'][idx] || 'normal';
        const type = types[typeKey];
        
        const card = document.createElement('div');
        card.className = `compare-card ${type.class}`;
        card.innerHTML = `
            <h3>${type.title}</h3>
            <p style="font-size: 12px; color: #6b7280; margin-bottom: 16px;">${r.title}</p>
            <div class="param-box">
                <div class="label">斜率 (k)</div>
                <div class="value">${r.slope !== null && r.slope !== undefined ? r.slope.toFixed(6) : '-'}</div>
            </div>
            <div class="param-box">
                <div class="label">截距 (b)</div>
                <div class="value">${r.intercept !== null && r.intercept !== undefined ? r.intercept.toFixed(6) : '-'}</div>
            </div>
            <div class="param-box">
                <div class="label">R²</div>
                <div class="value">${r.r_squared !== null && r.r_squared !== undefined ? r.r_squared.toFixed(6) : '-'}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 12px; font-size: 12px; color: #6b7280;">
                <span>数据点: ${r.item_count}</span>
                <span>状态: ${getStatusBadge(r.status)}</span>
            </div>
            ${r.deleted_count > 0 ? `<div style="margin-top: 8px; font-size: 12px; color: #dc2626;">已删除 ${r.deleted_count} 行</div>` : ''}
            ${r.has_gap ? `<div style="margin-top: 4px; font-size: 12px; color: #f59e0b;">⚠️ 编号断档待复核</div>` : ''}
            ${r.is_old_caliber ? `<div style="margin-top: 4px; font-size: 12px; color: #8b5cf6;">📜 含旧口径补录数据</div>` : ''}
        `;
        container.appendChild(card);
    });
}

async function loadWeightTables() {
    const tables = await apiCall('/weight-tables');
    const tbody = document.querySelector('#weight-table tbody');
    const select = document.getElementById('weight-table-select');
    
    tbody.innerHTML = '';
    select.innerHTML = '';
    
    tables.forEach(wt => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${wt.id}</td>
            <td>${wt.version}</td>
            <td>${wt.name}</td>
            <td><code>x: ${wt.data.x}, y: ${wt.data.y}, intercept: ${wt.data.intercept}</code></td>
            <td>${wt.created_by}</td>
            <td>${formatDate(wt.created_at)}</td>
        `;
        tbody.appendChild(tr);
        
        const opt = document.createElement('option');
        opt.value = wt.id;
        opt.textContent = `${wt.version} - ${wt.name}`;
        select.appendChild(opt);
    });
}

async function viewLedger(id) {
    window.currentLedgerId = id;
    const record = await apiCall(`/ledgers/${id}`);
    const history = await apiCall(`/ledgers/${id}/history`);
    const paramVersions = await apiCall(`/ledgers/${id}/param-versions`);
    const gapInfo = await apiCall(`/ledgers/${id}/check-gap`);
    
    document.getElementById('detail-serial').textContent = record.serial_no;
    document.getElementById('detail-title').textContent = record.title;
    document.getElementById('detail-status').innerHTML = getStatusBadge(record.status);
    document.getElementById('detail-created').textContent = formatDate(record.created_at);
    document.getElementById('detail-created-by').textContent = record.created_by;
    
    const alertsDiv = document.getElementById('detail-alerts');
    alertsDiv.innerHTML = '';
    
    if (record.has_gap) {
        alertsDiv.innerHTML += `
            <div class="alert alert-warning">
                <strong>⚠️ 编号断档:</strong> ${record.gap_note || ''}
                断档位置: ${JSON.stringify(gapInfo.gaps)}
                <button class="btn btn-danger" style="margin-left: auto;" onclick="showReviewModal(${id})">教研组复核</button>
            </div>
        `;
    }
    
    if (record.is_old_caliber) {
        alertsDiv.innerHTML += `
            <div class="alert alert-info">
                <strong>📜 旧口径数据:</strong> ${record.old_caliber_note || ''}
            </div>
        `;
    }
    
    if (record.review_status === 'pending_review') {
        alertsDiv.innerHTML += `
            <div class="alert alert-danger">
                <strong>🔍 待教研组复核:</strong> 编号断档后未通过复核，数据暂不可用
            </div>
        `;
    }
    
    const paramsDiv = document.getElementById('detail-params');
    if (record.params) {
        paramsDiv.innerHTML = `
            <div class="detail-item">
                <label>斜率 k</label>
                <div class="value">${record.params.slope.toFixed(6)}</div>
            </div>
            <div class="detail-item">
                <label>截距 b</label>
                <div class="value">${record.params.intercept.toFixed(6)}</div>
            </div>
            <div class="detail-item">
                <label>R²</label>
                <div class="value">${record.params.r_squared.toFixed(6)}</div>
            </div>
            <div class="detail-item">
                <label>数据点数</label>
                <div class="value">${record.items.length}</div>
            </div>
        `;
    } else {
        paramsDiv.innerHTML = '<p style="color: #6b7280; grid-column: 1/-1;">暂无计算结果，请点击"重跑"按钮</p>';
    }
    
    const itemsTbody = document.querySelector('#items-table tbody');
    itemsTbody.innerHTML = '';
    
    record.items.forEach(item => {
        const tr = document.createElement('tr');
        if (item.is_old_caliber) {
            tr.className = 'old-caliber-row';
        }
        tr.innerHTML = `
            <td>${item.item_no}${item.is_old_caliber ? ' <span class="badge badge-warning">旧口径</span>' : ''}</td>
            <td>${item.x_value}</td>
            <td>${item.y_value}</td>
            <td>${item.calculated_y !== null && item.calculated_y !== undefined ? item.calculated_y.toFixed(4) : '-'}</td>
            <td>${item.residual !== null && item.residual !== undefined ? item.residual.toFixed(4) : '-'}</td>
            <td>${item.is_old_caliber ? item.old_caliber_source : '-'}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteItem(${item.id})">删除</button>
            </td>
        `;
        itemsTbody.appendChild(tr);
    });
    
    if (record.deleted_items && record.deleted_items.length > 0) {
        record.deleted_items.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'deleted-row';
            tr.innerHTML = `
                <td class="gap-indicator">${item.item_no}</td>
                <td>${item.x_value}</td>
                <td>${item.y_value}</td>
                <td>-</td>
                <td>-</td>
                <td>删除人: ${item.deleted_by}</td>
                <td>${formatDate(item.deleted_at)}</td>
            `;
            itemsTbody.appendChild(tr);
        });
    }
    
    const steps = [
        { key: 'import', title: '第一步：导入评分权重表', desc: '导入评分权重表作为计算基准' },
        { key: 'screenshot', title: '第二步：唐老师补看旧公式截图', desc: '竞赛教练唐老师核对旧公式截图' },
        { key: 'params', title: '第三步：参数版本页更新', desc: '更新参数版本，记录变更历史' }
    ];
    
    const stepsDiv = document.getElementById('three-steps');
    stepsDiv.innerHTML = '';
    
    steps.forEach((step, idx) => {
        const hasHistory = history.some(h => h.action.includes(step.title.split('：')[0]) || 
                                              h.action.includes(step.title.split('：')[1]));
        const isLastActive = idx === steps.length - 1 && !hasHistory;
        
        const card = document.createElement('div');
        card.className = `step-card ${hasHistory ? 'completed' : ''} ${isLastActive ? 'active' : ''}`;
        card.innerHTML = `
            <div class="step-number">${hasHistory ? '✓' : idx + 1}</div>
            <div class="step-title">${step.title}</div>
            <div class="step-desc">${step.desc}</div>
            ${idx < steps.length - 1 ? '<div class="step-connector">→</div>' : ''}
        `;
        stepsDiv.appendChild(card);
    });
    
    renderParamVersions(paramVersions);
    renderHistory(history);
    
    switchTab('detail');
    switchSubTab('sub-overview');
}

function renderParamVersions(versions) {
    const tbody = document.querySelector('#param-versions-table tbody');
    tbody.innerHTML = '';
    
    versions.forEach(pv => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="badge badge-info">v${pv.version_no}</span></td>
            <td><code>k=${pv.params.slope.toFixed(6)}, b=${pv.params.intercept.toFixed(6)}, R²=${pv.params.r_squared.toFixed(6)}</code></td>
            <td>${pv.change_type === 'rerun' ? '重跑计算' : '手动更新'}</td>
            <td>${pv.change_note || '-'}</td>
            <td>${pv.weight_table_name || '-'}</td>
            <td>${pv.screenshot_desc || '-'}</td>
            <td>${pv.created_by}</td>
            <td>${formatDate(pv.created_at)}</td>
        `;
        tbody.appendChild(tr);
    });
    
    if (versions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #6b7280; padding: 40px;">暂无参数版本记录</td></tr>';
    }
}

function renderHistory(logs) {
    const timeline = document.getElementById('history-timeline');
    timeline.innerHTML = '';
    
    logs.forEach(log => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        
        let detailHtml = '';
        if (log.detail && typeof log.detail === 'object') {
            detailHtml = `<div class="detail">${JSON.stringify(log.detail, null, 2).replace(/\n/g, '<br>')}</div>`;
        }
        
        item.innerHTML = `
            <div class="time">${formatDate(log.created_at)}</div>
            <div class="action">${log.action}${log.param_version_no ? ` <span class="badge badge-info">v${log.param_version_no}</span>` : ''}</div>
            <div class="operator">操作人: ${log.operator}</div>
            ${detailHtml}
        `;
        timeline.appendChild(item);
    });
    
    if (logs.length === 0) {
        timeline.innerHTML = '<p style="color: #6b7280; padding: 20px;">暂无历史记录</p>';
    }
}

async function initDemo() {
    const operator = prompt('请输入操作人姓名:', '唐老师');
    if (!operator) return;
    
    const result = await apiCall('/init-demo', 'POST', { operator });
    if (result.status === 'success') {
        alert('演示数据初始化成功！\n\n创建了3条台账记录:\n1. 【正常】顺利完成的记录\n2. 【断档】人工删除一行导致编号断档\n3. 【旧口径】从旧公式截图补录数据\n\n同时创建了2套评分权重表和旧公式截图');
        loadLedgers();
        loadWeightTables();
    }
}

async function runCalculation(id) {
    if (!confirm('确定要重新计算吗？这将生成新的参数版本。')) return;
    
    const operator = prompt('请输入操作人姓名:', '唐老师');
    if (!operator) return;
    
    const result = await apiCall(`/ledgers/${id}/run`, 'POST', { operator });
    if (result.error) {
        alert('计算失败: ' + result.error);
        return;
    }
    
    alert(`计算完成！\n\n斜率: ${result.params.slope}\n截距: ${result.params.intercept}\nR²: ${result.params.r_squared}\n\n${result.has_gap ? '⚠️ 包含断档数据\n' : ''}${result.is_old_caliber ? '📜 包含旧口径数据\n' : ''}\n参数版本ID: ${result.param_version_id}`);
    
    if (window.currentLedgerId === id) {
        viewLedger(id);
    }
    loadLedgers();
}

async function deleteItem(itemId) {
    if (!confirm('确定要删除这条数据行吗？删除后会检测编号断档。')) return;
    
    const operator = prompt('请输入操作人姓名:', '管理员');
    if (!operator) return;
    
    await apiCall(`/ledgers/${window.currentLedgerId}/items/${itemId}/delete`, 'POST', { operator });
    alert('删除成功！系统已自动检测编号断档状态。');
    viewLedger(window.currentLedgerId);
    loadLedgers();
}

async function addOldCaliberItem() {
    const x = parseFloat(prompt('请输入 X 值:'));
    const y = parseFloat(prompt('请输入 Y 值:'));
    const source = prompt('请输入数据来源:', '旧公式截图');
    const operator = prompt('请输入操作人姓名:', '唐老师');
    
    if (isNaN(x) || isNaN(y) || !source || !operator) {
        alert('请填写完整信息');
        return;
    }
    
    await apiCall(`/ledgers/${window.currentLedgerId}/items/old-caliber`, 'POST', {
        x_value: x, y_value: y, source, operator
    });
    
    alert('旧口径数据补录成功！');
    viewLedger(window.currentLedgerId);
    loadLedgers();
}

async function addScreenshot() {
    const desc = prompt('请输入截图描述:', '旧公式截图');
    const formula = prompt('请输入公式内容:', 'y = kx + b');
    const operator = prompt('请输入操作人姓名:', '唐老师');
    
    if (!desc || !formula || !operator) {
        alert('请填写完整信息');
        return;
    }
    
    await apiCall(`/ledgers/${window.currentLedgerId}/screenshot`, 'POST', {
        description: desc, formula_content: formula, uploaded_by: operator
    });
    
    alert('旧公式截图上传成功！');
    viewLedger(window.currentLedgerId);
}

function showReviewModal(ledgerId) {
    const modal = document.getElementById('review-modal');
    modal.style.display = 'block';
    window.reviewLedgerId = ledgerId;
}

async function submitReview() {
    const result = document.getElementById('review-result').value;
    const note = document.getElementById('review-note').value;
    const reviewer = prompt('请输入复核人姓名:', '教研组长');
    
    if (!reviewer) return;
    
    await apiCall(`/ledgers/${window.reviewLedgerId}/review`, 'POST', {
        review_type: 'gap_review',
        review_result: result,
        review_note: note,
        reviewed_by: reviewer
    });
    
    alert('复核完成！');
    document.getElementById('review-modal').style.display = 'none';
    viewLedger(window.reviewLedgerId);
    loadLedgers();
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`tab-${tabName}`).classList.add('active');
}

function switchSubTab(tabName) {
    document.querySelectorAll('.tab-sub-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-sub-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`[data-subtab="${tabName}"]`).classList.add('active');
    document.getElementById(`sub-${tabName}`).classList.add('active');
}

async function createWeightTable() {
    const version = document.getElementById('wt-version').value;
    const name = document.getElementById('wt-name').value;
    const x = parseFloat(document.getElementById('wt-x').value);
    const y = parseFloat(document.getElementById('wt-y').value);
    const intercept = parseFloat(document.getElementById('wt-intercept').value);
    const operator = prompt('请输入操作人姓名:', '管理员');
    
    if (!version || !name || isNaN(x) || isNaN(y) || isNaN(intercept) || !operator) {
        alert('请填写完整信息');
        return;
    }
    
    await apiCall('/weight-tables', 'POST', {
        version, name, data: { x, y, intercept }, created_by: operator
    });
    
    alert('评分权重表创建成功！');
    loadWeightTables();
    
    document.getElementById('wt-version').value = '';
    document.getElementById('wt-name').value = '';
    document.getElementById('wt-x').value = '1.0';
    document.getElementById('wt-y').value = '1.0';
    document.getElementById('wt-intercept').value = '1.0';
}

async function createLedger() {
    const serialNo = document.getElementById('ld-serial').value;
    const title = document.getElementById('ld-title').value;
    const wtId = parseInt(document.getElementById('weight-table-select').value);
    const itemsText = document.getElementById('ld-items').value;
    const operator = prompt('请输入操作人姓名:', '管理员');
    
    if (!serialNo || !title || !wtId || !itemsText || !operator) {
        alert('请填写完整信息');
        return;
    }
    
    let items;
    try {
        items = JSON.parse(itemsText);
    } catch (e) {
        alert('数据点格式错误，请输入JSON数组，例如: [{"x": 1, "y": 2}, {"x": 2, "y": 4}]');
        return;
    }
    
    await apiCall('/ledgers', 'POST', {
        serial_no: serialNo, title, weight_table_id: wtId, items, created_by: operator
    });
    
    alert('台账创建成功！');
    loadLedgers();
    
    document.getElementById('ld-serial').value = '';
    document.getElementById('ld-title').value = '';
    document.getElementById('ld-items').value = '[{"x": 1.0, "y": 2.0}, {"x": 2.0, "y": 4.0}, {"x": 3.0, "y": 6.0}]';
}

document.addEventListener('DOMContentLoaded', () => {
    loadLedgers();
    loadWeightTables();
    
    document.getElementById('review-modal').addEventListener('click', (e) => {
        if (e.target.id === 'review-modal') {
            e.target.style.display = 'none';
        }
    });
});
