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
        'ready': ['已就绪', 'badge-info'],
        'suspended': ['已暂停', 'badge-secondary']
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

function getTraceTypeBadge(traceType) {
    const map = {
        'create': ['创建', 'badge-info'],
        'item_delete': ['删除数据', 'badge-danger'],
        'item_correct': ['修正数据', 'badge-warning'],
        'old_caliber_add': ['补录旧口径', 'badge-warning'],
        'suspend': ['暂停', 'badge-secondary'],
        'resume': ['恢复', 'badge-success'],
        'param_update': ['参数变更', 'badge-primary']
    };
    const [text, cls] = map[traceType] || [traceType, 'badge-secondary'];
    return `<span class="badge ${cls}">${text}</span>`;
}

function formatValue(v) {
    if (v === null || v === undefined) return '-';
    if (typeof v === 'object') return JSON.stringify(v, null, 2);
    return String(v);
}

function safeToFixed(v, n = 6) {
    if (v === null || v === undefined || isNaN(v)) return '-';
    return Number(v).toFixed(n);
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
            <td>${lr.trace_count || 0}</td>
            <td>${lr.version_count || 0}${lr.latest_version ? ` (v${lr.latest_version})` : ''}</td>
            <td><span style="color: ${lr.next_handler ? '#dc2626' : '#6b7280'}; font-weight: ${lr.next_handler ? 'bold' : 'normal'};">${lr.next_handler || '-'}</span></td>
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
        'gap': { class: 'gap', title: '🟡 断档记录', desc: '人工删除后编号断档，待教研组复核' },
        'old': { class: 'old', title: '🟣 旧口径记录', desc: '从旧公式截图补录旧口径数据' }
    };
    
    results.forEach((r, idx) => {
        let typeKey;
        if (r.has_gap) {
            typeKey = 'gap';
        } else if (r.is_old_caliber) {
            typeKey = 'old';
        } else {
            typeKey = 'normal';
        }
        const type = types[typeKey];
        
        const extraInfo = [];
        if (r.has_gap) {
            extraInfo.push('<div style="font-size: 12px; color: #f59e0b; margin-top: 4px;"><strong>⚠️ 待复核四要素:</strong></div>');
            extraInfo.push(`<div style="font-size: 11px; color: #78350f; margin-top: 2px;"><strong>原始:</strong> ${formatValue(r.gap_original_claim).substring(0, 60)}...</div>`);
            extraInfo.push(`<div style="font-size: 11px; color: #78350f; margin-top: 2px;"><strong>改后:</strong> ${formatValue(r.gap_corrected_value).substring(0, 60)}...</div>`);
            extraInfo.push(`<div style="font-size: 11px; color: #78350f; margin-top: 2px;"><strong>原因:</strong> ${formatValue(r.gap_reason).substring(0, 60)}...</div>`);
            extraInfo.push(`<div style="font-size: 11px; color: #dc2626; margin-top: 2px;"><strong>下一步:</strong> ${formatValue(r.gap_next_handler)}</div>`);
        }
        if (r.is_suspended) {
            extraInfo.push(`<div style="font-size: 12px; color: #6b7280; margin-top: 6px;">⏸️ ${formatValue(r.suspension_note)}</div>`);
        }
        
        const card = document.createElement('div');
        card.className = `compare-card ${type.class}`;
        card.innerHTML = `
            <h3>${type.title}</h3>
            <p style="font-size: 12px; color: #6b7280; margin-bottom: 16px;">${r.title}</p>
            <div class="param-box">
                <div class="label">斜率 (k)</div>
                <div class="value" style="color: ${r.slope ? '#1f2937' : '#9ca3af'};">${safeToFixed(r.slope)}</div>
            </div>
            <div class="param-box">
                <div class="label">截距 (b)</div>
                <div class="value" style="color: ${r.intercept ? '#1f2937' : '#9ca3af'};">${safeToFixed(r.intercept)}</div>
            </div>
            <div class="param-box">
                <div class="label">R²</div>
                <div class="value" style="color: ${r.r_squared ? '#1f2937' : '#9ca3af'};">${safeToFixed(r.r_squared)}</div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 12px; font-size: 12px; color: #6b7280;">
                <span>有效数据: ${r.active_count || 0}</span>
                <span>状态: ${getStatusBadge(r.status)}</span>
            </div>
            ${r.deleted_count > 0 ? `<div style="margin-top: 8px; font-size: 12px; color: #dc2626;">已删除 ${r.deleted_count} 行</div>` : ''}
            ${r.has_gap ? `<div style="margin-top: 4px; font-size: 12px; color: #f59e0b;">⚠️ 编号断档待教研组复核</div>` : ''}
            ${r.is_old_caliber ? `<div style="margin-top: 4px; font-size: 12px; color: #8b5cf6;">📜 含旧口径补录数据 ${r.old_caliber_count || 0} 条</div>` : ''}
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #e5e7eb;">
                ${extraInfo.join('')}
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
    const record = await apiCall(`/ledgers/${id}`);
    
    if (!record || record.error) {
        alert('记录不存在');
        return;
    }
    
    document.getElementById('detail-empty').style.display = 'none';
    document.getElementById('detail-content').style.display = 'block';
    
    const history = record.history || [];
    const paramVersions = record.param_versions || [];
    const changeTraces = record.change_traces || [];
    
    document.getElementById('detail-serial').textContent = record.serial_no;
    document.getElementById('detail-title').textContent = record.title;
    document.getElementById('detail-status').innerHTML = getStatusBadge(record.status);
    document.getElementById('detail-review-status').innerHTML = getReviewBadge(record.review_status);
    document.getElementById('detail-latest-version').textContent = record.latest_version ? `v${record.latest_version}` : '-';
    document.getElementById('detail-created').textContent = formatDate(record.created_at);
    document.getElementById('detail-created-by').textContent = record.created_by;
    document.getElementById('detail-next-handler').textContent = record.next_handler || '-';
    document.getElementById('detail-next-handler').style.display = record.next_handler ? 'inline' : 'none';
    
    document.getElementById('btn-suspend').style.display = record.status === 'suspended' ? 'none' : 'inline-block';
    document.getElementById('btn-resume').style.display = record.status === 'suspended' ? 'inline-block' : 'none';
    
    const alertsDiv = document.getElementById('detail-alerts');
    alertsDiv.innerHTML = '';
    
    if (record.has_gap) {
        const gaps = record.gap_detail && record.gap_detail.gaps ? JSON.stringify(record.gap_detail.gaps) : '';
        alertsDiv.innerHTML += `
            <div class="alert alert-warning">
                <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
                    <strong>⚠️ 编号断档:</strong> ${record.gap_note || ''}
                    <button class="btn btn-danger btn-sm" style="margin-left: auto;" onclick="showReviewModal(${id})">教研组复核</button>
                </div>
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
                <strong>🔍 待教研组复核:</strong> 编号断档后未通过复核，数据暂不可用（参数不归为正常结果）
            </div>
        `;
    }
    
    if (record.status === 'suspended') {
        alertsDiv.innerHTML += `
            <div class="alert alert-secondary">
                <strong>⏸️ 已暂停处理:</strong> ${record.suspension_note || '流程已暂停'}
                ${record.next_handler ? `，下一步: <strong style="color: #dc2626;">${record.next_handler}</strong>` : ''}
            </div>
        `;
    }
    
    const showSuspension = record.has_gap || record.status === 'suspended' || record.review_status === 'pending_review';
    const suspensionCard = document.getElementById('suspension-card');
    if (showSuspension) {
        suspensionCard.style.display = 'block';
        document.getElementById('suspension-original').textContent = record.gap_original_claim || record.suspension_note || '（暂无）';
        document.getElementById('suspension-corrected').textContent = record.gap_corrected_value || '（暂无）';
        document.getElementById('suspension-reason').textContent = record.gap_reason || record.correction_reason || '（暂无）';
        document.getElementById('suspension-next').textContent = record.gap_next_handler || record.next_handler || '（暂无）';
        const noteEl = document.getElementById('suspension-note');
        if (record.suspension_note && !record.has_gap) {
            noteEl.style.display = 'block';
            noteEl.textContent = '备注: ' + record.suspension_note;
        } else {
            noteEl.style.display = 'none';
        }
    } else {
        suspensionCard.style.display = 'none';
    }
    
    const steps = [
        { key: 'import', title: '第一步：导入评分权重表', desc: '导入评分权重表作为计算基准' },
        { key: 'screenshot', title: '第二步：唐老师补看旧公式截图', desc: '竞赛教练唐老师核对旧公式截图' },
        { key: 'params', title: '第三步：参数版本页更新', desc: '更新参数版本，记录变更历史' }
    ];
    
    const stepsDiv = document.getElementById('three-steps');
    stepsDiv.innerHTML = '';
    
    steps.forEach((step, idx) => {
        const titlePart = step.title.split('：')[1] || step.title;
        const hasHistory = history.some(h => 
            (h.action && (h.action.includes('第一步') || h.action.includes('导入')) && idx === 0) ||
            (h.action && (h.action.includes('第二步') || h.action.includes('旧公式') || h.action.includes('截图')) && idx === 1) ||
            (h.action && (h.action.includes('第三步') || h.action.includes('参数版本') || h.action.includes('参数版本页')) && idx === 2)
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
    
    const summary = record.summary || {};
    const summaryDiv = document.getElementById('detail-summary');
    summaryDiv.innerHTML = `
        <div class="summary-item">
            <div class="summary-label">📊 总数据点</div>
            <div class="summary-value">${summary.total || 0}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">✅ 有效数据</div>
            <div class="summary-value" style="color: #059669;">${summary.active || 0}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">🗑️ 已删除</div>
            <div class="summary-value" style="color: #dc2626;">${summary.deleted || 0}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">📜 旧口径</div>
            <div class="summary-value" style="color: #8b5cf6;">${summary.old_caliber || 0}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">🔀 变更次数</div>
            <div class="summary-value" style="color: #f59e0b;">${summary.traces || 0}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">📈 参数版本</div>
            <div class="summary-value" style="color: #3b82f6;">${summary.param_versions || 0}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">🔍 复核记录</div>
            <div class="summary-value">${summary.reviews || 0}</div>
        </div>
        <div class="summary-item" style="background: ${record.is_suspended ? '#fef3c7' : '#f0fdf4'};">
            <div class="summary-label">⏸️ 是否暂停</div>
            <div class="summary-value" style="color: ${record.is_suspended ? '#dc2626' : '#059669'};">${record.is_suspended ? '是（不归正常）' : '否'}</div>
        </div>
    `;
    
    const paramsDiv = document.getElementById('detail-params');
    const p = record.params || {};
    const isSuspendedParams = record.is_suspended || !record.params;
    paramsDiv.innerHTML = `
        <div class="detail-item" style="${isSuspendedParams ? 'opacity: 0.6; background: #fef3c7;' : ''}">
            <label>斜率 k</label>
            <div class="value">${safeToFixed(p.slope)}${isSuspendedParams ? ' <span class="badge badge-warning">待复核</span>' : ''}</div>
        </div>
        <div class="detail-item" style="${isSuspendedParams ? 'opacity: 0.6; background: #fef3c7;' : ''}">
            <label>截距 b</label>
            <div class="value">${safeToFixed(p.intercept)}${isSuspendedParams ? ' <span class="badge badge-warning">待复核</span>' : ''}</div>
        </div>
        <div class="detail-item" style="${isSuspendedParams ? 'opacity: 0.6; background: #fef3c7;' : ''}">
            <label>R² 决定系数</label>
            <div class="value">${safeToFixed(p.r_squared)}${isSuspendedParams ? ' <span class="badge badge-warning">待复核</span>' : ''}</div>
        </div>
        <div class="detail-item">
            <label>有效数据点数</label>
            <div class="value">${summary.active || 0}</div>
        </div>
        <div class="detail-item">
            <label>公式 y = kx + b</label>
            <div class="value" style="font-family: monospace; color: #7c3aed;">
                ${isSuspendedParams ? '（参数待复核后生效）' : `y = ${safeToFixed(p.slope, 4)}x ${(p.intercept || 0) >= 0 ? '+' : ''} ${safeToFixed(p.intercept, 4)}`}
            </div>
        </div>
        <div class="detail-item">
            <label>原始参数（补录前）</label>
            <div class="value" style="font-size: 13px; color: #6b7280;">
                ${record.original_params ? `k=${safeToFixed(record.original_params.slope,4)}, b=${safeToFixed(record.original_params.intercept,4)}` : '（无变更）'}
            </div>
        </div>
    `;
    
    const screenshots = record.screenshots || [];
    const screenshotsHtml = screenshots.length > 0 ? screenshots.map(s => `
        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                <span class="badge badge-info">📸 截图 #${s.id}</span>
                <strong>${s.description || '旧公式截图'}</strong>
                <span style="margin-left: auto; font-size: 12px; color: #6b7280;">上传人: ${s.uploaded_by} | ${formatDate(s.created_at)}</span>
            </div>
            <div style="font-family: monospace; background: white; padding: 8px; border-radius: 4px; color: #7c3aed;">
                📐 ${s.formula_content || '-'}
            </div>
        </div>
    `).join('') : '<p style="color: #6b7280; padding: 12px;">暂无关联截图</p>';
    
    const screenshotsSection = document.getElementById('detail-screenshots');
    if (screenshotsSection) {
        screenshotsSection.innerHTML = screenshotsHtml;
    }
    
    const reviewsDiv = document.getElementById('detail-reviews');
    const reviews = record.reviews || [];
    if (reviews.length === 0) {
        reviewsDiv.innerHTML = '<p style="color: #6b7280; padding: 16px;">暂无复核记录</p>';
    } else {
        reviewsDiv.innerHTML = reviews.map(rv => `
            <div class="review-card">
                <div class="review-header">
                    <span class="badge ${rv.review_result === 'approve' ? 'badge-success' : 'badge-danger'}">
                        ${rv.review_result === 'approve' ? '✅ 通过' : '❌ 驳回'}
                    </span>
                    <span style="margin-left: 8px; color: #6b7280; font-size: 13px;">${formatDate(rv.created_at)}</span>
                    <span style="margin-left: auto; font-weight: bold;">复核人: ${rv.reviewed_by}</span>
                </div>
                ${rv.review_note ? `<div class="review-body"><strong>意见:</strong> ${rv.review_note}</div>` : ''}
                <div class="review-four">
                    <div><strong>原始说法:</strong> ${formatValue(rv.original_claim)}</div>
                    <div><strong>改后的值:</strong> ${formatValue(rv.corrected_value)}</div>
                    <div><strong>下一步:</strong> ${formatValue(rv.next_step)}</div>
                    <div><strong>找谁:</strong> ${formatValue(rv.next_handler)}</div>
                </div>
            </div>
        `).join('');
    }
    
    renderItems(record);
    renderParamVersions(paramVersions);
    renderChangeTraces(changeTraces);
    renderHistory(history);
    
    switchTab('detail');
    switchSubTab('sub-overview');
}

function renderItems(record) {
    const itemsTbody = document.querySelector('#items-table tbody');
    itemsTbody.innerHTML = '';
    
    record.items.forEach(item => {
        const tr = document.createElement('tr');
        if (item.is_old_caliber) {
            tr.className = 'old-caliber-row';
        }
        const xChanged = item.original_x !== null && item.original_x !== undefined && item.original_x !== item.x_value;
        const yChanged = item.original_y !== null && item.original_y !== undefined && item.original_y !== item.y_value;
        
        tr.innerHTML = `
            <td>${item.item_no}${item.is_old_caliber ? ' <span class="badge badge-warning">旧口径</span>' : ''}</td>
            <td>${xChanged ? `<span style="color: #dc2626; text-decoration: line-through;">${item.original_x}</span>` : item.original_x ?? '-'}</td>
            <td>${yChanged ? `<span style="color: #dc2626; text-decoration: line-through;">${item.original_y}</span>` : item.original_y ?? '-'}</td>
            <td>${xChanged ? `<strong style="color: #059669;">${item.x_value}</strong>` : item.x_value}</td>
            <td>${yChanged ? `<strong style="color: #059669;">${item.y_value}</strong>` : item.y_value}</td>
            <td>${safeToFixed(item.calculated_y, 4)}</td>
            <td>${safeToFixed(item.residual, 4)}</td>
            <td>${item.is_old_caliber ? item.old_caliber_source : '-'}</td>
            <td>${item.correction_reason ? `<span class="badge badge-warning">${item.correction_reason}</span>` : '-'}</td>
            <td>
                <button class="btn btn-warning btn-sm" onclick="showCorrectModal(${item.id}, ${item.x_value}, ${item.y_value})">修正</button>
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
                <td colspan="2" style="color: #dc2626; text-decoration: line-through;">x=${item.original_x ?? item.x_value}, y=${item.original_y ?? item.y_value}</td>
                <td style="color: #dc2626; text-decoration: line-through;">${item.x_value}</td>
                <td style="color: #dc2626; text-decoration: line-through;">${item.y_value}</td>
                <td>-</td>
                <td>-</td>
                <td>删除人: ${item.deleted_by}</td>
                <td>${item.delete_reason || '-'}</td>
                <td>${formatDate(item.deleted_at)}</td>
            `;
            itemsTbody.appendChild(tr);
        });
    }
}

function renderParamVersions(versions) {
    const tbody = document.querySelector('#param-versions-table tbody');
    tbody.innerHTML = '';
    
    versions.forEach(pv => {
        const p = pv.params || {};
        const isSuspended = pv.is_suspended;
        const tr = document.createElement('tr');
        if (isSuspended) {
            tr.style.background = '#fef3c7';
        }
        tr.innerHTML = `
            <td><span class="badge badge-info">v${pv.version_no}</span></td>
            <td>${isSuspended 
                ? '<span class="badge badge-warning">⏸️ 暂停（不归正常）</span>' 
                : '<span class="badge badge-success">✅ 已生效</span>'}
            </td>
            <td><code style="${isSuspended ? 'opacity: 0.6;' : ''}">k=${safeToFixed(p.slope)}, b=${safeToFixed(p.intercept)}, R²=${safeToFixed(p.r_squared)}</code></td>
            <td>${pv.change_type === 'rerun' ? '重跑计算' : '手动更新'}</td>
            <td>${pv.change_note || '-'}${isSuspended && pv.suspension_note ? `<br><span style="color: #92400e;">⏸️ ${pv.suspension_note}</span>` : ''}</td>
            <td style="color: ${pv.next_handler ? '#dc2626' : '#6b7280'}; font-weight: ${pv.next_handler ? 'bold' : 'normal'};">${pv.next_handler || '-'}</td>
            <td>${pv.weight_table_name || '-'}</td>
            <td>${pv.screenshot_desc || '-'}</td>
            <td>${pv.created_by}</td>
            <td>${formatDate(pv.created_at)}</td>
        `;
        tbody.appendChild(tr);
    });
    
    if (versions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #6b7280; padding: 40px;">暂无参数版本记录</td></tr>';
    }
}

function renderChangeTraces(traces) {
    const container = document.getElementById('traces-list');
    container.innerHTML = '';
    
    if (traces.length === 0) {
        container.innerHTML = '<p style="color: #6b7280; padding: 20px;">暂无变更轨迹记录</p>';
        return;
    }
    
    traces.forEach(t => {
        const origStr = formatValue(t.original_value);
        const corrStr = formatValue(t.corrected_value);
        const card = document.createElement('div');
        card.className = 'trace-card';
        if (t.is_suspended) {
            card.style.borderLeftColor = '#f59e0b';
            card.style.background = '#fffbeb';
        }
        card.innerHTML = `
            <div class="trace-header">
                ${getTraceTypeBadge(t.trace_type)}
                ${t.item_no ? `<span class="badge badge-secondary">数据点 #${t.item_no}</span>` : ''}
                ${t.is_suspended ? '<span class="badge badge-warning">⏸️ 待处理</span>' : ''}
                ${t.handled_at ? '<span class="badge badge-success">✅ 已处理</span>' : ''}
                <span style="margin-left: auto; color: #6b7280; font-size: 12px;">${formatDate(t.created_at)}</span>
                <span style="margin-left: 12px; font-size: 13px;">操作人: <strong>${t.operator}</strong></span>
            </div>
            <div class="trace-body">
                <div class="trace-row">
                    <div class="trace-col">
                        <div class="trace-label">📌 原始值</div>
                        <div class="trace-value trace-orig">${origStr}</div>
                    </div>
                    <div class="trace-arrow">→</div>
                    <div class="trace-col">
                        <div class="trace-label">✨ 改后值</div>
                        <div class="trace-value trace-corr">${corrStr}</div>
                    </div>
                </div>
                <div class="trace-four">
                    <div class="trace-four-item">
                        <span class="trace-four-label">处理原因:</span>
                        <span>${formatValue(t.change_reason)}</span>
                    </div>
                    <div class="trace-four-item">
                        <span class="trace-four-label">数据来源:</span>
                        <span>${formatValue(t.source_ref)}</span>
                    </div>
                    <div class="trace-four-item" style="color: #dc2626;">
                        <span class="trace-four-label">下一步找谁:</span>
                        <span style="font-weight: bold;">${formatValue(t.next_handler)}</span>
                    </div>
                    <div class="trace-four-item">
                        <span class="trace-four-label">处理人:</span>
                        <span>${formatValue(t.handled_by)}</span>
                    </div>
                </div>
                ${t.suspension_note ? `<div class="trace-suspend">⏸️ ${t.suspension_note}</div>` : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

function renderHistory(logs) {
    const timeline = document.getElementById('history-timeline');
    timeline.innerHTML = '';
    
    logs.forEach(log => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        
        let detailHtml = '';
        if (log.detail && typeof log.detail === 'object') {
            detailHtml = `<div class="detail" style="white-space: pre-wrap;">${JSON.stringify(log.detail, null, 2)}</div>`;
        } else if (log.detail) {
            detailHtml = `<div class="detail">${log.detail}</div>`;
        }
        
        const ctInfo = [];
        if (log.ct_original) ctInfo.push(`<div style="font-size: 11px; color: #78350f; margin-top: 2px;">原始: ${formatValue(log.ct_original).substring(0, 80)}</div>`);
        if (log.ct_corrected) ctInfo.push(`<div style="font-size: 11px; color: #065f46; margin-top: 2px;">改后: ${formatValue(log.ct_corrected).substring(0, 80)}</div>`);
        if (log.ct_reason) ctInfo.push(`<div style="font-size: 11px; color: #1e40af; margin-top: 2px;">原因: ${formatValue(log.ct_reason).substring(0, 80)}</div>`);
        if (log.ct_next_handler) ctInfo.push(`<div style="font-size: 11px; color: #dc2626; margin-top: 2px; font-weight: bold;">下一步: ${formatValue(log.ct_next_handler)}</div>`);
        
        item.innerHTML = `
            <div class="time">${formatDate(log.created_at)}</div>
            <div class="action">
                ${log.action}
                ${log.param_version_no ? ` <span class="badge badge-info">v${log.param_version_no}</span>` : ''}
                ${log.change_trace_id ? ` <span class="badge badge-warning">轨迹#${log.change_trace_id}</span>` : ''}
            </div>
            <div class="operator">操作人: ${log.operator}</div>
            ${detailHtml}
            ${ctInfo.join('')}
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
    
    try {
        const result = await apiCall('/init-demo', 'POST', { operator });
        if (result.status === 'success') {
            alert('演示数据初始化成功！\n\n创建了3条台账记录:\n1. 【正常】顺利完成的记录\n2. 【断档】人工删除一行导致编号断档（四要素完整，不归正常）\n3. 【旧口径】从旧公式截图补录数据\n\n同时创建了2套评分权重表和旧公式截图\n\n⚠️ 注意：第2条断档记录参数不归为正常，必须教研组复核后才能继续');
            loadLedgers();
            loadWeightTables();
        }
    } catch (e) {
        alert('初始化失败: ' + e.message);
    }
}

async function runCalculation(id) {
    if (!confirm('确定要重新计算吗？这将生成新的参数版本。\n\n⚠️ 如果记录有断档且未复核，参数将标记为"暂停"，不归为正常结果。')) return;
    
    const operator = prompt('请输入操作人姓名:', '唐老师');
    if (!operator) return;
    
    try {
        const result = await apiCall(`/ledgers/${id}/run`, 'POST', { operator });
        if (result.error) {
            alert('计算失败: ' + result.error + (result.next_handler ? `\n\n下一步请找: ${result.next_handler}` : ''));
            return;
        }
        
        const msgParts = [
            `计算完成！`,
            ``,
            `斜率: ${safeToFixed(result.params?.slope)}`,
            `截距: ${safeToFixed(result.params?.intercept)}`,
            `R²: ${safeToFixed(result.params?.r_squared)}`,
            ``
        ];
        if (result.has_gap) msgParts.push('⚠️ 包含断档数据');
        if (result.is_old_caliber) msgParts.push('📜 包含旧口径数据');
        if (result.is_suspended) msgParts.push('⏸️ 参数版本已标记暂停，待教研组复核后才会归为正常结果');
        if (result.next_handler) msgParts.push(`👤 下一步请找: ${result.next_handler}`);
        msgParts.push(``);
        msgParts.push(`参数版本ID: ${result.param_version_id}`);
        
        alert(msgParts.join('\n'));
    } catch (e) {
        alert('请求失败: ' + e.message);
    }
    
    if (window.currentLedgerId === id) {
        viewLedger(id);
    }
    loadLedgers();
}

async function deleteItem(itemId) {
    const reason = prompt('请输入删除原因:', '人工识别为异常点');
    if (reason === null) return;
    
    if (!confirm('确定要删除这条数据行吗？\n\n⚠️ 删除后会自动检测编号断档。\n如果产生断档，会自动记录四要素（原始说法/改后值/原因/下一步找教研组复核），并且参数不归为正常。')) return;
    
    const operator = prompt('请输入操作人姓名:', '管理员');
    if (!operator) return;
    
    await apiCall(`/ledgers/${window.currentLedgerId}/items/${itemId}/delete`, 'POST', { 
        operator, 
        delete_reason: reason 
    });
    alert('删除成功！\n\n系统已自动：\n1. 检测编号断档状态\n2. 记录变更轨迹（原始值→改值→原因→下一步）\n3. 如产生断档，状态变更为"待教研组复核"，参数不归为正常');
    viewLedger(window.currentLedgerId);
    loadLedgers();
}

function showCorrectModal(itemId, curX, curY) {
    window.currentCorrectItemId = itemId;
    document.getElementById('correct-x').value = curX;
    document.getElementById('correct-y').value = curY;
    document.getElementById('correct-reason').value = '';
    document.getElementById('correct-source').value = '';
    document.getElementById('correct-modal').style.display = 'flex';
}

async function submitCorrect() {
    const newX = parseFloat(document.getElementById('correct-x').value);
    const newY = parseFloat(document.getElementById('correct-y').value);
    const reason = document.getElementById('correct-reason').value;
    const source = document.getElementById('correct-source').value;
    const operator = prompt('请输入操作人姓名:', '管理员');
    
    if (!operator) return;
    if (isNaN(newX) || isNaN(newY)) {
        alert('请输入有效的数值');
        return;
    }
    if (!reason) {
        alert('请填写修正原因');
        return;
    }
    
    const result = await apiCall(`/ledgers/${window.currentLedgerId}/items/${window.currentCorrectItemId}/correct`, 'POST', {
        new_x: newX, new_y: newY, correction_reason: reason, source, operator
    });
    
    if (result.error) {
        alert('修正失败: ' + result.error);
        return;
    }
    
    alert('修正成功！\n\n变更轨迹已记录：\n1. 保留了原始值和改后值\n2. 记录了修正原因和来源\n3. 可在"变更轨迹"子Tab中查看完整记录');
    document.getElementById('correct-modal').style.display = 'none';
    viewLedger(window.currentLedgerId);
    loadLedgers();
}

async function addOldCaliberItem() {
    const x = parseFloat(prompt('请输入 X 值:'));
    const y = parseFloat(prompt('请输入 Y 值:'));
    const source = prompt('请输入数据来源:', '旧公式截图2025赛季第3页');
    const reason = prompt('请输入补录原因:', '从旧公式截图补录，用于新旧口径对比');
    const operator = prompt('请输入操作人姓名:', '唐老师');
    
    if (isNaN(x) || isNaN(y) || !source || !reason || !operator) {
        alert('请填写完整信息');
        return;
    }
    
    await apiCall(`/ledgers/${window.currentLedgerId}/items/old-caliber`, 'POST', {
        x_value: x, y_value: y, source, operator, reason
    });
    
    alert('旧口径数据补录成功！\n\n系统已自动：\n1. 记录了原始参数作为对比\n2. 记录了补录来源和原因\n3. 标记下一步为"唐老师复核旧口径适用性"\n4. 变更轨迹完整可查');
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
    window.reviewLedgerId = ledgerId;
    const recordDataPromise = apiCall(`/ledgers/${ledgerId}`);
    recordDataPromise.then(record => {
        document.getElementById('review-original').value = record.gap_original_claim || '';
        document.getElementById('review-corrected').value = record.gap_corrected_value || '';
        document.getElementById('review-note').value = record.gap_reason || '';
        document.getElementById('review-next').value = record.gap_next_handler || '唐老师继续参数拟合';
        document.getElementById('review-modal').style.display = 'flex';
    });
}

async function submitReview() {
    const result = document.getElementById('review-result').value;
    const note = document.getElementById('review-note').value;
    const original = document.getElementById('review-original').value;
    const corrected = document.getElementById('review-corrected').value;
    const nextStep = document.getElementById('review-next').value;
    const reviewer = prompt('请输入复核人姓名:', '教研组长');
    
    if (!reviewer) return;
    if (!note) {
        alert('请填写复核意见');
        return;
    }
    
    const nextHandler = result === 'approve' ? nextStep : '补充数据后重新提交';
    
    await apiCall(`/ledgers/${window.reviewLedgerId}/review`, 'POST', {
        review_type: 'gap_review',
        review_result: result,
        review_note: note,
        reviewed_by: reviewer,
        original_claim: original,
        corrected_value: corrected,
        next_step: nextStep,
        next_handler: nextHandler
    });
    
    alert(`复核完成！\n\n结果: ${result === 'approve' ? '通过 ✅' : '驳回 ❌'}\n\n四要素已完整保存：\n1. 原始说法\n2. 改后的值\n3. 处理原因\n4. 下一步找谁\n\n${result === 'approve' ? '状态变更为"已就绪"，参数可归为正常结果' : '状态变更为"已驳回"，需补充数据后重新提交'}`);
    document.getElementById('review-modal').style.display = 'none';
    viewLedger(window.reviewLedgerId);
    loadLedgers();
}

async function suspendLedger() {
    const note = prompt('请输入暂停原因:', '流程暂停，等待进一步确认');
    if (note === null) return;
    const nextHandler = prompt('下一步找谁处理:', '教研组复核');
    if (nextHandler === null) return;
    const operator = prompt('请输入操作人姓名:', '管理员');
    if (!operator) return;
    
    await apiCall(`/ledgers/${window.currentLedgerId}/suspend`, 'POST', {
        operator, suspension_note: note, next_handler: nextHandler || null
    });
    
    alert('已暂停处理流程！\n\n变更轨迹已记录，状态更新为"已暂停"');
    viewLedger(window.currentLedgerId);
    loadLedgers();
}

async function resumeLedger() {
    const note = prompt('请输入恢复说明:', '问题已解决，恢复处理');
    if (note === null) return;
    const operator = prompt('请输入操作人姓名:', '管理员');
    if (!operator) return;
    
    await apiCall(`/ledgers/${window.currentLedgerId}/resume`, 'POST', {
        operator, resume_note: note
    });
    
    alert('已恢复处理流程！\n\n如果记录仍有断档且未复核，状态会恢复为"待教研组复核"');
    viewLedger(window.currentLedgerId);
    loadLedgers();
}

function exportReport(format) {
    if (!window.currentLedgerId) {
        alert('请先选择一条台账记录');
        return;
    }
    
    if (format === 'json') {
        apiCall(`/ledgers/${window.currentLedgerId}/report?format=json`).then(report => {
            const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ledger-${window.currentLedgerId}-report.json`;
            a.click();
            URL.revokeObjectURL(url);
            alert('JSON报告已下载！\n\n报告包含9个章节：\n1. 基本信息\n2. 权重表信息\n3. 当前参数\n4. 断档信息（含四要素）\n5. 复核信息\n6. 数据明细\n7. 变更轨迹\n8. 参数版本历史\n9. 复核历史');
        });
    } else if (format === 'csv') {
        window.open(`${API_BASE}/ledgers/${window.currentLedgerId}/report?format=csv`, '_blank');
    }
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
    document.getElementById(`sub-${tabName.replace('sub-', '')}`).classList.add('active');
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
    
    document.getElementById('correct-modal').addEventListener('click', (e) => {
        if (e.target.id === 'correct-modal') {
            e.target.style.display = 'none';
        }
    });
});
