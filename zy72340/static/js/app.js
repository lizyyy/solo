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
        'pending_review': ['待复核（暂停）', 'badge-danger'],
        'rejected': ['已驳回', 'badge-danger'],
        'ready': ['已就绪（续局后）', 'badge-info']
    };
    const [text, cls] = map[status] || [status, 'badge-secondary'];
    return `<span class="badge ${cls}">${text}</span>`;
}

function getWorkflowBadge(wfState) {
    const map = {
        'normal': ['🟢 正常流程', 'badge-success'],
        'paused': ['🔴 暂停中·待教研组长复核', 'badge-danger'],
        'resumed': ['🟡 已续局·复核后继续', 'badge-info']
    };
    const [text, cls] = map[wfState] || [wfState, 'badge-secondary'];
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

function safeFixed(val, digits = 6) {
    if (val === null || val === undefined || isNaN(val)) return '-';
    return Number(val).toFixed(digits);
}

async function loadLedgers() {
    const ledgers = await apiCall('/ledgers');
    const tbody = document.querySelector('#ledger-table tbody');
    tbody.innerHTML = '';

    ledgers.forEach(lr => {
        const canRun = lr.workflow_state !== 'paused' && lr.status !== 'pending_review';
        const showReview = lr.workflow_state === 'paused' || lr.review_status === 'pending_review';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${lr.serial_no}</td>
            <td>${lr.title}</td>
            <td>${getStatusBadge(lr.status)}</td>
            <td>${getWorkflowBadge(lr.workflow_state || 'normal')}</td>
            <td>${lr.has_gap ? '<span class="badge badge-danger">有断档</span>' : '<span class="badge badge-success">正常</span>'}</td>
            <td>${lr.is_old_caliber ? '<span class="badge badge-warning">含旧口径</span>' : '<span class="badge badge-info">新口径</span>'}</td>
            <td>${getReviewBadge(lr.review_status)}</td>
            <td>${lr.weight_table_name || '-'}</td>
            <td>${formatDate(lr.created_at)}</td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="viewLedger(${lr.id})">查看</button>
                ${showReview ? `<button class="btn btn-danger btn-sm" onclick="showReviewModal(${lr.id})">复核</button>` : ''}
                <button class="btn btn-primary btn-sm" onclick="runCalculation(${lr.id})" ${canRun ? '' : 'disabled title="暂停状态下不能计算，请先复核"'}>重跑</button>
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

    const typeKeys = ['normal', 'gap', 'old'];
    const types = {
        'normal': { class: 'normal', title: '🟢 正常记录', desc: '顺利完成，无任何问题' },
        'gap': { class: 'gap', title: '🟡 断档记录', desc: '人工删除后编号断档，待教研组长复核' },
        'old': { class: 'old', title: '🟣 旧口径记录', desc: '从旧公式截图补录旧口径数据' }
    };

    results.forEach((r, idx) => {
        const typeKey = typeKeys[idx] || 'normal';
        const type = types[typeKey];
        const isPaused = r.workflow_state === 'paused' || r.status === 'pending_review';

        const card = document.createElement('div');
        card.className = `compare-card ${type.class}`;
        let paramsHtml;
        if (isPaused) {
            paramsHtml = `
                <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px;margin-bottom:8px;">
                    <div style="font-weight:bold;color:#991b1b;">🔴 暂停中 · 待教研组长复核</div>
                    <div style="font-size:12px;color:#7f1d1d;margin-top:4px;">${r.pause_reason || '编号断档未通过复核'}</div>
                    <div style="font-size:12px;color:#b91c1c;margin-top:4px;">下一步：${r.next_owner || '教研组长'}</div>
                </div>
                <div class="param-box">
                    <div class="label">斜率 (k)</div>
                    <div class="value" style="color:#9ca3af;">未计算</div>
                </div>
                <div class="param-box">
                    <div class="label">截距 (b)</div>
                    <div class="value" style="color:#9ca3af;">未计算</div>
                </div>
                <div class="param-box">
                    <div class="label">R²</div>
                    <div class="value" style="color:#9ca3af;">未计算</div>
                </div>
            `;
        } else {
            paramsHtml = `
                <div class="param-box">
                    <div class="label">斜率 (k)</div>
                    <div class="value">${safeFixed(r.slope)}</div>
                </div>
                <div class="param-box">
                    <div class="label">截距 (b)</div>
                    <div class="value">${safeFixed(r.intercept)}</div>
                </div>
                <div class="param-box">
                    <div class="label">R²</div>
                    <div class="value">${safeFixed(r.r_squared)}</div>
                </div>
            `;
        }

        card.innerHTML = `
            <h3>${type.title}</h3>
            <p style="font-size:12px;color:#6b7280;margin-bottom:12px;">${r.title}</p>
            ${paramsHtml}
            <div style="display:flex;justify-content:space-between;margin-top:12px;font-size:12px;color:#6b7280;">
                <span>数据点: ${r.item_count}</span>
                <span>${getWorkflowBadge(r.workflow_state || 'normal')}</span>
            </div>
            ${r.deleted_count > 0 ? `<div style="margin-top:6px;font-size:12px;color:#dc2626;">已删除 ${r.deleted_count} 行</div>` : ''}
            ${r.has_gap ? `<div style="margin-top:4px;font-size:12px;color:#f59e0b;">⚠️ 编号断档</div>` : ''}
            ${r.is_old_caliber ? `<div style="margin-top:4px;font-size:12px;color:#8b5cf6;">📜 含旧口径补录数据</div>` : ''}
            <div style="margin-top:10px;text-align:right;">
                <button class="btn btn-secondary btn-sm" onclick="viewLedger(${r.id})">查看详情 →</button>
            </div>
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
    const [record, history, paramVersions, gapInfo] = await Promise.all([
        apiCall(`/ledgers/${id}`),
        apiCall(`/ledgers/${id}/history`),
        apiCall(`/ledgers/${id}/param-versions`),
        apiCall(`/ledgers/${id}/check-gap`)
    ]);

    document.getElementById('detail-serial').textContent = record.serial_no;
    document.getElementById('detail-title').textContent = record.title;
    document.getElementById('detail-status').innerHTML = getStatusBadge(record.status) + ' ' + getWorkflowBadge(record.workflow_state || 'normal');
    document.getElementById('detail-created').textContent = formatDate(record.created_at);
    document.getElementById('detail-created-by').textContent = record.created_by;

    const runBtn = document.getElementById('btn-run-calc');
    const canRun = record.workflow_state !== 'paused' && record.status !== 'pending_review';
    if (canRun) {
        runBtn.disabled = false;
        runBtn.removeAttribute('title');
    } else {
        runBtn.disabled = true;
        runBtn.title = '暂停状态下不能计算，请先完成教研组复核';
    }

    const alertsDiv = document.getElementById('detail-alerts');
    alertsDiv.innerHTML = '';

    if (record.workflow_state === 'paused' || record.status === 'pending_review' || record.review_status === 'pending_review') {
        alertsDiv.innerHTML += `
            <div class="alert alert-danger" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                <div style="flex:1;min-width:260px;">
                    <strong>🔴 暂停中 · 待教研组长复核</strong><br>
                    <span style="font-size:13px;">${record.pause_reason || '编号断档未通过复核，数据暂不能进入计算'}</span>
                    ${record.next_owner ? `<div style="font-size:13px;margin-top:4px;">👉 下一步责任人：<strong>${record.next_owner}</strong></div>` : ''}
                </div>
                <button class="btn btn-danger" onclick="showReviewModal(${id})">立即复核 →</button>
            </div>
        `;
    }

    if (record.workflow_state === 'resumed') {
        alertsDiv.innerHTML += `
            <div class="alert alert-info" style="font-size:13px;">
                <strong>🟡 已续局 · 复核后继续处理</strong><br>
                ${record.resume_reason ? `<span>${record.resume_reason}</span><br>` : ''}
                复核人：${record.resumed_by || '-'}，续局时间：${formatDate(record.resumed_at)}
            </div>
        `;
    }

    if (record.has_gap) {
        alertsDiv.innerHTML += `
            <div class="alert alert-warning">
                <strong>⚠️ 编号断档:</strong> ${record.gap_note || ''}
                断档位置: ${JSON.stringify(gapInfo.gaps)}
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

    const paramsDiv = document.getElementById('detail-params');
    const isPaused = record.workflow_state === 'paused' || record.status === 'pending_review';
    if (record.params && !isPaused) {
        paramsDiv.innerHTML = `
            <div class="detail-item">
                <label>斜率 k</label>
                <div class="value">${safeFixed(record.params.slope)}</div>
            </div>
            <div class="detail-item">
                <label>截距 b</label>
                <div class="value">${safeFixed(record.params.intercept)}</div>
            </div>
            <div class="detail-item">
                <label>R²</label>
                <div class="value">${safeFixed(record.params.r_squared)}</div>
            </div>
            <div class="detail-item">
                <label>数据点数</label>
                <div class="value">${record.items.length}</div>
            </div>
        `;
    } else if (isPaused) {
        paramsDiv.innerHTML = `
            <div style="grid-column:1/-1;padding:20px;background:#fef2f2;border:1px dashed #fca5a5;border-radius:6px;color:#991b1b;">
                <strong>🔴 当前处于暂停（待复核）状态，暂不展示计算结果</strong><br>
                <span style="font-size:13px;">${record.pause_reason || '编号断档导致的暂停'}</span><br>
                <span style="font-size:13px;">请由教研组完成复核后，状态变为"已就绪（续局后）"再查看计算结果。</span>
            </div>
        `;
    } else {
        paramsDiv.innerHTML = '<p style="color:#6b7280;grid-column:1/-1;">暂无计算结果，请点击"重跑计算"按钮</p>';
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
            <td>${safeFixed(item.calculated_y, 4)}</td>
            <td>${safeFixed(item.residual, 4)}</td>
            <td>${item.is_old_caliber ? item.old_caliber_source : '-'}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteItem(${item.id})" ${isPaused ? 'disabled title="暂停状态不能删除，请先续局"' : ''}>删除</button>
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
                <td style="text-decoration:line-through;color:#9ca3af;">${item.x_value}</td>
                <td style="text-decoration:line-through;color:#9ca3af;">${item.y_value}</td>
                <td>-</td>
                <td>-</td>
                <td>删除人: ${item.deleted_by}<br>原因: ${item.delete_reason || '-'}</td>
                <td>${formatDate(item.deleted_at)}</td>
            `;
            itemsTbody.appendChild(tr);
        });
    }

    if (record.reviews && record.reviews.length > 0) {
        const latestRv = record.reviews[0];
        alertsDiv.innerHTML += `
            <div class="alert alert-secondary" style="font-size:13px;">
                <strong>📝 最近复核记录（${formatDate(latestRv.created_at)}，复核人：${latestRv.reviewed_by}）</strong><br>
                复核结果：${latestRv.review_result === 'approve' ? '✅ 通过' : '❌ 驳回'}<br>
                复核意见：${latestRv.review_note || '-'}<br>
                ${latestRv.reason ? `处理原因：${latestRv.reason}<br>` : ''}
                ${latestRv.next_owner ? `下一步：${latestRv.next_owner}` : ''}
            </div>
        `;
    }

    const steps = [
        { key: 'import', title: '第一步：导入评分权重表', desc: '导入评分权重表作为计算基准' },
        { key: 'screenshot', title: '第二步：唐老师补看旧公式截图', desc: '竞赛教练唐老师核对旧公式截图' },
        { key: 'params', title: '第三步：参数版本页更新', desc: '更新参数版本，记录变更历史' }
    ];

    const stepsDiv = document.getElementById('three-steps');
    stepsDiv.innerHTML = '';

    steps.forEach((step, idx) => {
        const hasHistory = history.some(h =>
            h.action.includes(step.title.split('：')[0]) ||
            h.action.includes(step.title.split('：')[1])
        );
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
        const wf = pv.workflow || {};
        const wfTag = wf.workflow_state ? getWorkflowBadge(wf.workflow_state) : '';
        const wfNote = [];
        if (wf.has_gap) wfNote.push('含已复核断档');
        if (wf.is_old_caliber) wfNote.push('含旧口径');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="badge badge-info">v${pv.version_no}</span></td>
            <td><code>k=${safeFixed(pv.params.slope)}, b=${safeFixed(pv.params.intercept)}, R²=${safeFixed(pv.params.r_squared)}</code></td>
            <td>${pv.change_type === 'rerun' ? '重跑计算' : '手动更新'}</td>
            <td>${pv.change_note || '-'}${wfNote.length ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">${wfNote.join(' · ')}</div>` : ''}</td>
            <td>${wfTag || '-'}</td>
            <td>${pv.weight_table_name || '-'}</td>
            <td>${pv.screenshot_desc || '-'}</td>
            <td>${pv.created_by}</td>
            <td>${formatDate(pv.created_at)}</td>
        `;
        tbody.appendChild(tr);
    });

    if (versions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#6b7280;padding:40px;">暂无参数版本记录</td></tr>';
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
            const keys = Object.keys(log.detail);
            if (keys.length > 0) {
                const summaryKeys = ['pause_reason', 'next_owner', 'resume_reason', 'reason', 'review_note', 'review_result', 'delete_reason', 'workflow_tags'];
                const picked = [];
                summaryKeys.forEach(k => {
                    if (log.detail[k] !== undefined && log.detail[k] !== null && log.detail[k] !== '') {
                        picked.push(`<div style="font-size:12px;"><strong>${k}:</strong> ${String(log.detail[k]).slice(0, 80)}</div>`);
                    }
                });
                if (picked.length === 0) {
                    picked.push(`<details style="font-size:12px;color:#6b7280;"><summary>展开详情</summary><pre style="margin:4px 0;white-space:pre-wrap;">${JSON.stringify(log.detail, null, 2)}</pre></details>`);
                }
                detailHtml = `<div class="detail" style="margin-top:4px;">${picked.join('')}</div>`;
            }
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
        timeline.innerHTML = '<p style="color:#6b7280;padding:20px;">暂无历史记录</p>';
    }
}

async function initDemo() {
    const operator = prompt('请输入操作人姓名:', '唐老师');
    if (!operator) return;

    const result = await apiCall('/init-demo', 'POST', { operator });
    if (result.status === 'success') {
        alert('演示数据初始化成功！\n\n创建了3条台账记录:\n1. 【正常】顺利完成的记录\n2. 【断档】人工删除一行导致编号断档（自动进入暂停，待教研组长复核）\n3. 【旧口径】从旧公式截图补录数据\n\n同时创建了2套评分权重表和旧公式截图');
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
        let msg = '计算失败: ' + result.error;
        if (result.hint) msg += '\n\n' + result.hint;
        if (result.pause_reason) msg += '\n\n暂停原因: ' + result.pause_reason;
        if (result.next_owner) msg += '\n下一步: 请联系 ' + result.next_owner + ' 完成复核';
        alert(msg);
        return;
    }

    const tags = [];
    if (result.workflow_tags && result.workflow_tags.length) {
        tags.push(...result.workflow_tags);
    }
    alert(`计算完成！\n\n斜率: ${result.params.slope}\n截距: ${result.params.intercept}\nR²: ${result.params.r_squared}\n\n${tags.join('\n')}\n参数版本ID: ${result.param_version_id}`);

    if (window.currentLedgerId === id) {
        viewLedger(id);
    }
    loadLedgers();
}

async function deleteItem(itemId) {
    if (!confirm('确定要删除这条数据行吗？\n删除后系统会自动检测编号断档，若触发断档会自动进入「暂停·待教研组长复核」状态。')) return;

    const operator = prompt('请输入操作人姓名:', '管理员');
    if (!operator) return;
    const deleteReason = prompt('请输入删除原因（必填，复核时需要）:', '数据异常/采集错误');
    if (!deleteReason) {
        alert('删除原因必填，便于后续教研组复核');
        return;
    }

    const result = await apiCall(`/ledgers/${window.currentLedgerId}/items/${itemId}/delete`, 'POST', {
        operator,
        delete_reason: deleteReason
    });

    let msg = '删除成功！';
    if (result.has_gap) {
        msg += '\n\n⚠️ 系统检测到编号断档，已自动进入「暂停·待教研组长复核」状态。\n数据暂不可用于计算，需要教研组复核通过后续局。';
    }
    alert(msg);
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

async function showReviewModal(ledgerId) {
    window.reviewLedgerId = ledgerId;
    const modal = document.getElementById('review-modal');
    modal.style.display = 'flex';

    const [record, gapInfo] = await Promise.all([
        apiCall(`/ledgers/${ledgerId}`),
        apiCall(`/ledgers/${ledgerId}/check-gap`)
    ]);

    document.getElementById('review-snapshot-content').innerHTML = `
        <div><strong>台账编号:</strong> ${record.serial_no}</div>
        <div><strong>工作流状态:</strong> ${getWorkflowBadge(record.workflow_state || 'normal')}</div>
        <div><strong>暂停原因:</strong> ${record.pause_reason || '-'}</div>
        <div><strong>当前数据点:</strong> ${record.items ? record.items.length : 0} 个</div>
        <div><strong>已删除:</strong> ${record.deleted_items ? record.deleted_items.length : 0} 行</div>
    `;

    const delTbody = document.getElementById('review-deleted-tbody');
    delTbody.innerHTML = '';
    if (record.deleted_items && record.deleted_items.length > 0) {
        record.deleted_items.forEach(it => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${it.item_no}</td>
                <td>${it.x_value}</td>
                <td>${it.y_value}</td>
                <td>${it.deleted_by || '-'}</td>
                <td>${formatDate(it.deleted_at)}</td>
                <td>${it.delete_reason || '-'}</td>
            `;
            delTbody.appendChild(tr);
        });
    } else {
        delTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:12px;color:#6b7280;">暂无已删除数据行</td></tr>';
    }

    const gapDetailDiv = document.getElementById('review-gap-detail');
    if (gapInfo.has_gap) {
        gapDetailDiv.innerHTML = `<strong>检测到 ${gapInfo.gaps.length} 处断档：</strong><br>` +
            gapInfo.gaps.map((g, i) =>
                `第${i + 1}处：序号 ${g.from} 直接跳到 ${g.to}，缺失编号 ${JSON.stringify(g.missing)}`
            ).join('<br>') +
            `<br><br>当前存活编号序列：${JSON.stringify(gapInfo.item_nos)}`;
    } else {
        gapDetailDiv.innerHTML = '当前编号连续，没有检测到断档。';
    }

    document.getElementById('review-note').value = record.pause_reason ? `原始情况：${record.pause_reason}\n\n复核意见：` : '';
    document.getElementById('review-reason').value = '';
    document.getElementById('review-next-owner').value = '';
}

async function submitReview() {
    const result = document.getElementById('review-result').value;
    const note = document.getElementById('review-note').value;
    const reason = document.getElementById('review-reason').value;
    const nextOwner = document.getElementById('review-next-owner').value;
    const reviewer = prompt('请输入复核人姓名:', '教研组长');

    if (!reviewer) return;
    if (!note || note.trim().length < 5) {
        alert('请填写详细的复核意见（至少5字），说明原始说法、改后值、处理原因。');
        return;
    }

    const res = await apiCall(`/ledgers/${window.reviewLedgerId}/review`, 'POST', {
        review_type: 'gap_review',
        review_result: result,
        review_note: note,
        reason: reason,
        next_owner: nextOwner,
        reviewed_by: reviewer
    });

    if (res.status === 'success') {
        alert(`复核完成！\n\n结果：${result === 'approve' ? '✅ 通过 - 已续局，可继续计算' : '❌ 驳回 - 需返工'}\n复核意见：${note}\n${reason ? '处理原因：' + reason + '\n' : ''}${nextOwner ? '下一步责任人：' + nextOwner : ''}`);
        document.getElementById('review-modal').style.display = 'none';
        if (window.currentLedgerId === window.reviewLedgerId) {
            viewLedger(window.reviewLedgerId);
        }
        loadLedgers();
    }
}

async function exportReport() {
    if (!window.currentLedgerId) {
        alert('请先选择一条台账记录');
        return;
    }
    const report = await apiCall(`/ledgers/${window.currentLedgerId}/export`);
    if (report.error) {
        alert('导出失败: ' + report.error);
        return;
    }

    const wf = report.workflow || {};
    const txt = [
        '======================================',
        '  最小二乘标定台账 · 完整导出报告',
        '======================================',
        '',
        `【台账信息】`,
        `编号: ${report.ledger.serial_no}`,
        `标题: ${report.ledger.title}`,
        `创建人: ${report.ledger.created_by}`,
        `创建时间: ${formatDate(report.ledger.created_at)}`,
        `更新时间: ${formatDate(report.ledger.updated_at)}`,
        '',
        `【工作流摘要】`,
        `当前状态: ${wf.current_state || 'normal'} (${wf.status || '-'})`,
        wf.pause_reason ? `暂停原因: ${wf.pause_reason}` : null,
        wf.resume_reason ? `续局原因: ${wf.resume_reason}` : null,
        wf.resumed_by ? `续局人: ${wf.resumed_by} (${formatDate(wf.resumed_at)})` : null,
        wf.next_owner ? `下一步责任人: ${wf.next_owner}` : null,
        wf.has_gap ? `编号断档: 是 (${wf.gap_note || ''})` : '编号断档: 否',
        wf.is_old_caliber ? `含旧口径数据: 是 (${wf.old_caliber_note || ''})` : '含旧口径数据: 否',
        '',
        `【评分权重表】`,
        report.weight_table ? `${report.weight_table.version} - ${report.weight_table.name} (x=${report.weight_table.data.x}, y=${report.weight_table.data.y}, intercept=${report.weight_table.data.intercept})` : '无',
        '',
        `【最新计算参数】`,
        report.latest_params ? `k=${safeFixed(report.latest_params.slope)}, b=${safeFixed(report.latest_params.intercept)}, R²=${safeFixed(report.latest_params.r_squared)}` : '暂无（可能处于暂停状态）',
        '',
        `【参数版本历史】(${report.param_versions.length} 条)`,
        ...report.param_versions.map((pv, i) =>
            `  v${pv.version_no}  k=${safeFixed(pv.params.slope)} b=${safeFixed(pv.params.intercept)} R²=${safeFixed(pv.params.r_squared)}  [${pv.change_type}] ${pv.change_note || ''}  ${pv.workflow ? '(' + pv.workflow.workflow_state + ')' : ''}  by ${pv.created_by} @ ${formatDate(pv.created_at)}`
        ),
        '',
        `【复核记录】(${report.reviews.length} 条)`,
        ...report.reviews.map((rv, i) =>
            `  [${rv.review_result === 'approve' ? '通过' : '驳回'}] ${rv.review_type}  by ${rv.reviewed_by} @ ${formatDate(rv.created_at)}\n    意见: ${rv.review_note || '-'}\n    原因: ${rv.reason || '-'}\n    下一步: ${rv.next_owner || '-'}`
        ),
        '',
        `【操作历史】(${report.history.length} 条)`,
        ...report.history.map((h, i) =>
            `  ${formatDate(h.created_at)}  ${h.action}${h.param_version_no ? ' v' + h.param_version_no : ''}  by ${h.operator}`
        ),
        '',
        `报告生成时间: ${formatDate(report.generated_at)}`,
        ''
    ].filter(Boolean).join('\n');

    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-${report.ledger.serial_no}-report.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
