const API = '/api';
let currentReviewId = null;

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initUpload();
    loadStats();
    loadImports();
    loadLocations();
    initEventListeners();
});

function initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
            
            if (tab.dataset.tab === 'predictions') {
                loadPredictions();
                populateImportSelects();
            }
            if (tab.dataset.tab === 'route') {
                populateRouteSelect();
            }
        });
    });
}

function initUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    
    uploadArea.addEventListener('click', () => fileInput.click());
    
    uploadArea.addEventListener('dragover', e => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
    uploadArea.addEventListener('drop', e => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });
    fileInput.addEventListener('change', e => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });
}

function initEventListeners() {
    document.getElementById('loadSampleBtn').addEventListener('click', loadSampleData);
    document.getElementById('refreshPredictions').addEventListener('click', loadPredictions);
    document.getElementById('exportBtn').addEventListener('click', exportPredictions);
    document.getElementById('loadRouteBtn').addEventListener('click', loadRoute);
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelReview').addEventListener('click', closeModal);
    document.getElementById('saveReview').addEventListener('click', saveReview);
}

async function apiCall(url, options = {}) {
    const opts = { headers: { ...options.headers } };
    if (options.body && !(options.body instanceof FormData)) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(options.body);
    } else {
        opts.body = options.body;
    }
    const res = await fetch(API + url, { method: options.method || 'GET', ...opts });
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
        return res.json();
    }
    return res;
}

function showAlert(containerId, type, message) {
    const el = document.getElementById(containerId);
    if (el) {
        el.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
        setTimeout(() => el.innerHTML = '', 5000);
    }
}

async function handleFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    document.getElementById('uploadResult').innerHTML = '<div class="alert alert-info">正在上传...</div>';
    
    try {
        const data = await apiCall('/import/upload', { method: 'POST', body: fd });
        if (data.duplicate) {
            showAlert('uploadResult', 'warning', `⚠️ ${data.message}（导入ID: ${data.existing_import_id}）`);
        } else if (data.success) {
            showAlert('uploadResult', 'success', `✅ 导入成功！处理了 ${data.processed_count} 条记录。`);
        } else {
            showAlert('uploadResult', 'error', data.error || '导入失败');
        }
    } catch (e) {
        showAlert('uploadResult', 'error', '上传失败: ' + e.message);
    }
    await loadStats();
    await loadImports();
}

async function loadStats() {
    const data = await apiCall('/stats');
    document.getElementById('statImports').textContent = data.imports || 0;
    document.getElementById('statLocations').textContent = data.locations || 0;
    document.getElementById('statPredictions').textContent = data.predictions || 0;
    document.getElementById('statPending').textContent = data.pending_reviews || 0;
}

async function loadImports() {
    const imports = await apiCall('/imports');
    const tbody = document.querySelector('#importsTable tbody');
    tbody.innerHTML = '';
    if (!imports.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty">暂无导入记录</td></tr>';
        return;
    }
    imports.forEach(imp => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${imp.id}</td>
            <td>${imp.filename}</td>
            <td>${imp.row_count}</td>
            <td>${imp.processed_count}</td>
            <td><span class="badge badge-${imp.status === 'predicted' ? 'approved' : 'pending'}">${imp.status}</span></td>
            <td>${new Date(imp.import_time).toLocaleString()}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="runPrediction(${imp.id})" ${imp.status === 'predicted' ? '' : ''}>
                    ${imp.status === 'predicted' ? '重跑预测' : '运行预测'}
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function runPrediction(importId) {
    const data = await apiCall(`/imports/${importId}/predict`, { method: 'POST' });
    if (data.success) {
        alert(`✅ 预测完成！生成 ${data.predictions_count} 条预测记录`);
        await loadStats();
        await loadImports();
    } else {
        alert('❌ ' + (data.error || '预测失败'));
    }
}

async function loadPredictions() {
    const params = new URLSearchParams();
    const importId = document.getElementById('filterImport').value;
    const priority = document.getElementById('filterPriority').value;
    const reviewed = document.getElementById('filterReviewed').value;
    if (importId) params.append('import_id', importId);
    if (priority) params.append('priority', priority);
    if (reviewed) params.append('reviewed', reviewed);
    
    const data = await apiCall('/predictions?' + params.toString());
    const tbody = document.querySelector('#predictionsTable tbody');
    tbody.innerHTML = '';
    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty">暂无预测数据</td></tr>';
        return;
    }
    const priorityBadge = { critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low' };
    const priorityText = { critical: '紧急', high: '高', medium: '中', low: '低' };
    const reviewBadge = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected', adjusted: 'badge-medium' };
    const reviewText = { pending: '待复核', approved: '通过', rejected: '拒绝', adjusted: '调整', '': '待复核' };
    
    data.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${p.location_name}</strong><br><span style="font-size:11px;color:#999;">${p.location_id}</span></td>
            <td><span class="badge ${priorityBadge[p.priority_level]}">${priorityText[p.priority_level]}</span></td>
            <td>${p.urgency_score}</td>
            <td>${p.recommended_refill}</td>
            <td>${p.predicted_depletion_hours}</td>
            <td class="reason-text">${p.prediction_reason}</td>
            <td><span class="badge ${reviewBadge[p.review_status] || 'badge-pending'}">${reviewText[p.review_status] || '待复核'}</span></td>
            <td><button class="btn btn-sm btn-primary" onclick="openReviewModal(${p.id}, '${p.location_name}', ${p.urgency_score}, '${p.prediction_reason.replace(/'/g, "\\'")}')">复核</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function openReviewModal(id, name, score, reason) {
    currentReviewId = id;
    document.getElementById('reviewContent').innerHTML = `
        <div style="margin-bottom:16px;">
            <p><strong>投放点:</strong> ${name}</p>
            <p><strong>紧急度:</strong> ${score}</p>
            <p><strong>预测原因:</strong></p>
            <div style="background:#f8fafc;padding:12px;border-radius:8px;margin-top:8px;font-size:13px;color:#444;line-height:1.6;">${reason}</div>
        </div>
    `;
    document.getElementById('reviewNote').value = '';
    document.getElementById('reviewModal').classList.add('active');
}

function closeModal() {
    document.getElementById('reviewModal').classList.remove('active');
    currentReviewId = null;
}

async function saveReview() {
    if (!currentReviewId) return;
    const status = document.getElementById('reviewStatus').value;
    const note = document.getElementById('reviewNote').value;
    const data = await apiCall(`/predictions/${currentReviewId}/review`, {
        method: 'POST',
        body: { status, note }
    });
    if (data.success) {
        closeModal();
        await loadStats();
        await loadPredictions();
    } else {
        alert('❌ ' + (data.error || '保存失败'));
    }
}

async function loadLocations() {
    const data = await apiCall('/locations');
    const tbody = document.querySelector('#locationsTable tbody');
    tbody.innerHTML = '';
    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">暂无投放点</td></tr>';
        return;
    }
    data.forEach(loc => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${loc.location_id}</td>
            <td>${loc.name}</td>
            <td>${loc.zone || '-'}</td>
            <td>${loc.capacity}</td>
            <td>${loc.is_outdoor ? '是' : '否'}</td>
            <td>${loc.priority}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function populateImportSelects() {
    const imports = await apiCall('/imports');
    ['filterImport', 'exportImportId'].forEach(id => {
        const select = document.getElementById(id);
        const current = select.value;
        select.innerHTML = '<option value="">全部批次</option>';
        imports.forEach(imp => {
            const opt = document.createElement('option');
            opt.value = imp.id;
            opt.textContent = `#${imp.id} - ${imp.filename}`;
            select.appendChild(opt);
        });
        select.value = current;
    });
}

async function populateRouteSelect() {
    const imports = await apiCall('/imports');
    const select = document.getElementById('routeImportId');
    select.innerHTML = '<option value="">选择导入批次</option>';
    imports.forEach(imp => {
        const opt = document.createElement('option');
        opt.value = imp.id;
        opt.textContent = `#${imp.id} - ${imp.filename} (${imp.predictions_count || 0}预测)`;
        select.appendChild(opt);
    });
}

async function loadRoute() {
    const importId = document.getElementById('routeImportId').value;
    if (!importId) {
        alert('请选择导入批次');
        return;
    }
    const data = await apiCall(`/imports/${importId}/route?limit=20`);
    const summaryBox = document.getElementById('routeSummary');
    const content = document.getElementById('routeContent');
    
    if (!data.route || !data.route.length === 0) {
        summaryBox.style.display = 'none';
        content.innerHTML = '<div class="empty">暂无路线数据</div>';
        return;
    }
    
    summaryBox.style.display = 'block';
    summaryBox.innerHTML = `
        <h4>📊 路线规划摘要</h4>
        <p><strong>总需冰量:</strong> ${data.total_ice_required} 单位</p>
        ${data.summary ? `<ul>${data.summary.map(s => `<li>${s}</li>`).join('')}</ul>` : ''}
        <p style="margin-top:8px;font-size:13px;color:#666;">
            优先级分布: 紧急 ${data.breakdown.critical} | 高 ${data.breakdown.high} | 中 ${data.breakdown.medium} | 低 ${data.breakdown.low}</p>
    `;
    
    const priorityBadge = { critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low' };
    const priorityText = { critical: '紧急', high: '高', medium: '中', low: '低' };
    
    content.innerHTML = `
        <ul class="route-list">
            ${data.route.map((item, i) => `
                <li class="route-item">
                    <div class="route-order">${i + 1}</div>
                    <div style="flex:1;">
                        <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
                            <strong>${item.location_name}</strong>
                            <span class="badge ${priorityBadge[item.priority_level]}">${priorityText[item.priority_level]}</span>
                            <span style="font-size:11px;color:#999;">紧急度: ${item.urgency_score}</span>
                        </div>
                        <div class="reason-text">${item.prediction_reason}</div>
                        <div style="margin-top:6px;font-size:12px;color:#1e3a5f;font-weight:500;">建议补冰: ${item.recommended_refill} 单位</div>
                    </div>
                </li>
            `).join('')}
        </ul>
    `;
}

async function exportPredictions() {
    const importId = document.getElementById('exportImportId').value;
    if (!importId) {
        alert('请选择导入批次');
        return;
    }
    const reviewedOnly = document.getElementById('exportReviewedOnly').checked;
    try {
        const res = await fetch(API + `/imports/${importId}/export`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviewed_only: reviewedOnly })
        });
        if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const cd = res.headers.get('content-disposition') || '';
            const fn = cd.match(/filename="?([^"]+)"?/)?.[1] || 'predictions.xlsx';
            a.href = url;
            a.download = fn;
            a.click();
            URL.revokeObjectURL(url);
        } else {
            const data = await res.json();
            alert('❌ ' + (data.error || '导出失败'));
        }
    } catch (e) {
        alert('导出失败: ' + e.message);
    }
}

async function loadSampleData() {
    const sampleCsv = `date,location,sales,temperature,humidity,hour,event
2026-05-08,PARK_A,120,36,45,12,马拉松赛事
2026-05-08,PARK_A,150,37,42,13,马拉松赛事
2026-05-08,PARK_A,180,38,40,14,马拉松赛事
2026-05-08,PARK_B,80,35,48,12,音乐节
2026-05-08,PARK_B,95,36,46,13,音乐节
2026-05-08,PARK_B,110,37,44,14,音乐节
2026-05-08,STADIUM_C,200,34,50,11,足球赛
2026-05-08,STADIUM_C,250,35,48,12,足球赛
2026-05-08,STADIUM_C,280,36,46,13,足球赛
2026-05-08,BEACH_D,60,33,60,15,沙滩活动
2026-05-08,BEACH_D,75,34,58,16,沙滩活动
2026-05-08,MALL_E,40,28,55,12,日常
2026-05-08,MALL_E,45,29,54,13,日常
2026-05-09,PARK_A,90,30,50,12,周末公园
2026-05-09,PARK_A,130,32,48,13,周末公园
2026-05-09,PARK_A,160,34,45,14,周末公园
2026-05-09,STADIUM_C,180,33,52,12,户外集会
2026-05-09,STADIUM_C,220,35,50,13,户外集会`;
    
    const blob = new Blob([sampleCsv], { type: 'text/csv' });
    const file = new File([blob], 'sample_sales.csv', { type: 'text/csv' });
    const fd = new FormData();
    fd.append('file', file);
    
    document.getElementById('uploadResult').innerHTML = '<div class="alert alert-info">正在加载样例数据...</div>';
    
    try {
        const data = await apiCall('/import/upload', { method: 'POST', body: fd });
        if (data.duplicate) {
            showAlert('uploadResult', 'warning', `⚠️ ${data.message}`);
        } else if (data.success) {
            showAlert('uploadResult', 'success', `✅ 样例数据导入成功！处理了 ${data.processed_count} 条记录，包含5个户外投放点。`);
        } else {
            showAlert('uploadResult', 'error', data.error || '导入失败');
        }
    } catch (e) {
        showAlert('uploadResult', 'error', '加载失败: ' + e.message);
    }
    await loadStats();
    await loadImports();
}
