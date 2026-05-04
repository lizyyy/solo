const API_BASE = '';

let observationPoints = [];
let devices = [];
let targets = [];
let exposureBatches = [];

document.addEventListener('DOMContentLoaded', function() {
    initTabs();
    loadAllData();
    initForms();
    initUploadArea();
    initModal();
});

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
            
            if (tabId === 'records') {
                loadExposureBatches();
            }
            if (tabId === 'add-record') {
                loadSelectOptions();
            }
            if (tabId === 'settings') {
                loadAllData();
            }
        });
    });
}

async function loadAllData() {
    await Promise.all([
        loadObservationPoints(),
        loadDevices(),
        loadTargets(),
        loadStats(),
        loadExposureBatches()
    ]);
}

async function loadObservationPoints() {
    try {
        const response = await fetch(`${API_BASE}/api/observation-points`);
        observationPoints = await response.json();
        renderPointsList();
        updateSelectOptions('form-point', observationPoints);
    } catch (error) {
        console.error('加载观测点失败:', error);
    }
}

async function loadDevices() {
    try {
        const response = await fetch(`${API_BASE}/api/devices`);
        devices = await response.json();
        renderDevicesList();
        updateSelectOptions('form-device', devices);
    } catch (error) {
        console.error('加载设备失败:', error);
    }
}

async function loadTargets() {
    try {
        const response = await fetch(`${API_BASE}/api/targets`);
        targets = await response.json();
        renderTargetsList();
        updateSelectOptions('form-target', targets);
    } catch (error) {
        console.error('加载目标失败:', error);
    }
}

async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const stats = await response.json();
        
        document.getElementById('stat-points').textContent = stats.observation_points;
        document.getElementById('stat-devices').textContent = stats.devices;
        document.getElementById('stat-targets').textContent = stats.targets;
        document.getElementById('stat-records').textContent = stats.exposure_batches.total;
        document.getElementById('stat-pending').textContent = stats.exposure_batches.pending;
        document.getElementById('stat-risks').textContent = stats.exposure_batches.with_risks;
    } catch (error) {
        console.error('加载统计失败:', error);
    }
}

async function loadExposureBatches() {
    try {
        const statusFilter = document.getElementById('filter-status').value;
        const dateFrom = document.getElementById('filter-date-from').value;
        const dateTo = document.getElementById('filter-date-to').value;
        
        let url = `${API_BASE}/api/exposure-batches`;
        const params = new URLSearchParams();
        
        if (statusFilter && statusFilter !== 'all') {
            params.append('status', statusFilter);
        }
        if (dateFrom) {
            params.append('date_from', dateFrom);
        }
        if (dateTo) {
            params.append('date_to', dateTo);
        }
        
        if (params.toString()) {
            url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        exposureBatches = await response.json();
        
        renderRecordsTable(exposureBatches);
        renderRecentTable(exposureBatches.slice(0, 10));
    } catch (error) {
        console.error('加载记录失败:', error);
    }
}

function loadSelectOptions() {
    updateSelectOptions('form-point', observationPoints);
    updateSelectOptions('form-device', devices);
    updateSelectOptions('form-target', targets);
}

function updateSelectOptions(selectId, data) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    const currentValue = select.value;
    select.innerHTML = '';
    
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = selectId === 'form-point' ? '请选择观测点' : 
                              selectId === 'form-device' ? '请选择设备' : '请选择目标';
    select.appendChild(placeholder);
    
    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        if (item.ra && item.dec) {
            option.textContent += ` (${item.ra}, ${item.dec})`;
        }
        select.appendChild(option);
    });
    
    if (currentValue) {
        select.value = currentValue;
    }
}

function renderPointsList() {
    const list = document.getElementById('points-list');
    if (!list) return;
    
    list.innerHTML = observationPoints.map(point => `
        <li>
            <div class="item-info">
                <span class="item-name">${escapeHtml(point.name)}</span>
                <span class="item-meta">${escapeHtml(point.description || '无描述')}</span>
            </div>
        </li>
    `).join('');
}

function renderDevicesList() {
    const list = document.getElementById('devices-list');
    if (!list) return;
    
    list.innerHTML = devices.map(device => `
        <li>
            <div class="item-info">
                <span class="item-name">${escapeHtml(device.name)}</span>
                <span class="item-meta">${escapeHtml(device.type || '未知类型')}</span>
            </div>
        </li>
    `).join('');
}

function renderTargetsList() {
    const list = document.getElementById('targets-list');
    if (!list) return;
    
    list.innerHTML = targets.map(target => `
        <li>
            <div class="item-info">
                <span class="item-name">${escapeHtml(target.name)}</span>
                <span class="item-meta">${target.ra && target.dec ? `RA: ${target.ra}, Dec: ${target.dec}` : '无坐标'}</span>
            </div>
        </li>
    `).join('');
}

function renderRecordsTable(batches) {
    const tbody = document.querySelector('#records-table tbody');
    if (!tbody) return;
    
    if (batches.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11">
                    <div class="empty-state">
                        <div class="empty-state-icon">📋</div>
                        <p>暂无观测记录</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = batches.map(batch => {
        const statusClass = `status-${batch.status}`;
        const statusNames = {
            'pending': '待复核',
            'approved': '已通过',
            'rejected': '已驳回',
            'needs_review': '需重新复核'
        };
        
        const hasRisks = batch.risk_flags && batch.risk_flags.length > 0;
        const riskSeverity = hasRisks ? getHighestRiskSeverity(batch.risk_flags) : null;
        
        return `
            <tr>
                <td>${batch.id}</td>
                <td>${escapeHtml(batch.observation_date || '-')}</td>
                <td>${escapeHtml(batch.observation_time || '-')}</td>
                <td>${escapeHtml(batch.observation_point_name || '-')}</td>
                <td>${escapeHtml(batch.device_name || '-')}</td>
                <td>${escapeHtml(batch.target_name || '-')}</td>
                <td>${batch.cloud_cover || 0}%</td>
                <td>${batch.device_battery || 100}%</td>
                <td><span class="status-badge ${statusClass}">${statusNames[batch.status] || '未知'}</span></td>
                <td>
                    ${hasRisks ? `
                        <span class="risk-indicator risk-${riskSeverity}">
                            ⚠️ ${batch.risk_flags.length}个风险
                        </span>
                    ` : '<span class="text-muted">无</span>'}
                </td>
                <td>
                    <div class="action-btns">
                        <button class="btn btn-small" onclick="showDetail(${batch.id})">查看</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderRecentTable(batches) {
    const tbody = document.querySelector('#recent-table tbody');
    if (!tbody) return;
    
    if (batches.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state" style="padding: 30px;">
                        <p>暂无记录</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = batches.map(batch => {
        const statusClass = `status-${batch.status}`;
        const statusNames = {
            'pending': '待复核',
            'approved': '已通过',
            'rejected': '已驳回',
            'needs_review': '需重新复核'
        };
        
        const hasRisks = batch.risk_flags && batch.risk_flags.length > 0;
        const riskSeverity = hasRisks ? getHighestRiskSeverity(batch.risk_flags) : null;
        
        return `
            <tr>
                <td>${escapeHtml(batch.observation_date || '-')}</td>
                <td>${escapeHtml(batch.target_name || '-')}</td>
                <td>${escapeHtml(batch.observation_point_name || '-')}</td>
                <td>${batch.cloud_cover || 0}%</td>
                <td>${batch.device_battery || 100}%</td>
                <td><span class="status-badge ${statusClass}">${statusNames[batch.status] || '未知'}</span></td>
                <td>
                    ${hasRisks ? `
                        <span class="risk-indicator risk-${riskSeverity}">
                            ⚠️ ${batch.risk_flags.length}
                        </span>
                    ` : '-'}
                </td>
            </tr>
        `;
    }).join('');
}

function getHighestRiskSeverity(risks) {
    const severityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    let highest = 'low';
    
    risks.forEach(risk => {
        if (severityOrder[risk.severity] > severityOrder[highest]) {
            highest = risk.severity;
        }
    });
    
    return highest;
}

function initForms() {
    const pointForm = document.getElementById('point-form');
    if (pointForm) {
        pointForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('point-name').value.trim();
            const desc = document.getElementById('point-desc').value.trim();
            
            if (!name) return;
            
            try {
                const response = await fetch(`${API_BASE}/api/observation-points`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, description: desc || null })
                });
                
                if (response.ok) {
                    showToast('观测点添加成功', 'success');
                    pointForm.reset();
                    await loadObservationPoints();
                    await loadStats();
                } else {
                    const data = await response.json();
                    showToast(data.error || '添加失败', 'error');
                }
            } catch (error) {
                showToast('添加失败: ' + error.message, 'error');
            }
        });
    }
    
    const deviceForm = document.getElementById('device-form');
    if (deviceForm) {
        deviceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('device-name').value.trim();
            const type = document.getElementById('device-type').value.trim();
            
            if (!name) return;
            
            try {
                const response = await fetch(`${API_BASE}/api/devices`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, type: type || null })
                });
                
                if (response.ok) {
                    showToast('设备添加成功', 'success');
                    deviceForm.reset();
                    await loadDevices();
                    await loadStats();
                } else {
                    const data = await response.json();
                    showToast(data.error || '添加失败', 'error');
                }
            } catch (error) {
                showToast('添加失败: ' + error.message, 'error');
            }
        });
    }
    
    const targetForm = document.getElementById('target-form');
    if (targetForm) {
        targetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('target-name').value.trim();
            const ra = document.getElementById('target-ra').value.trim();
            const dec = document.getElementById('target-dec').value.trim();
            
            if (!name) return;
            
            try {
                const response = await fetch(`${API_BASE}/api/targets`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, ra: ra || '', dec: dec || '' })
                });
                
                if (response.ok) {
                    showToast('目标添加成功', 'success');
                    targetForm.reset();
                    await loadTargets();
                    await loadStats();
                } else {
                    const data = await response.json();
                    showToast(data.error || '添加失败', 'error');
                }
            } catch (error) {
                showToast('添加失败: ' + error.message, 'error');
            }
        });
    }
    
    const recordForm = document.getElementById('record-form');
    if (recordForm) {
        recordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const data = {
                observation_point_id: parseInt(document.getElementById('form-point').value) || null,
                device_id: parseInt(document.getElementById('form-device').value) || null,
                target_id: parseInt(document.getElementById('form-target').value) || null,
                observation_date: document.getElementById('form-date').value,
                observation_time: document.getElementById('form-time').value,
                cloud_cover: parseFloat(document.getElementById('form-cloud-cover').value) || 0,
                seeing: parseFloat(document.getElementById('form-seeing').value) || 5,
                device_battery: parseFloat(document.getElementById('form-battery').value) || 100,
                exposure_plan: document.getElementById('form-exposure-plan').value.trim(),
                actual_files: document.getElementById('form-actual-files').value.trim(),
                notes: document.getElementById('form-notes').value.trim()
            };
            
            if (!data.observation_point_id || !data.device_id || !data.target_id ||
                !data.observation_date || !data.observation_time) {
                showToast('请填写所有必填字段', 'error');
                return;
            }
            
            try {
                const response = await fetch(`${API_BASE}/api/exposure-batches`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (response.ok) {
                    const result = await response.json();
                    
                    if (result.risks && result.risks.length > 0) {
                        showToast(`记录已保存，检测到 ${result.risks.length} 个风险`, 'info');
                    } else {
                        showToast('记录保存成功', 'success');
                    }
                    
                    recordForm.reset();
                    await loadExposureBatches();
                    await loadStats();
                } else {
                    showToast('保存失败', 'error');
                }
            } catch (error) {
                showToast('保存失败: ' + error.message, 'error');
            }
        });
    }
    
    const applyFilterBtn = document.getElementById('apply-filter');
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', loadExposureBatches);
    }
    
    const resetFilterBtn = document.getElementById('reset-filter');
    if (resetFilterBtn) {
        resetFilterBtn.addEventListener('click', () => {
            document.getElementById('filter-status').value = 'all';
            document.getElementById('filter-date-from').value = '';
            document.getElementById('filter-date-to').value = '';
            loadExposureBatches();
        });
    }
    
    const exportMarkdownBtn = document.getElementById('export-markdown-btn');
    if (exportMarkdownBtn) {
        exportMarkdownBtn.addEventListener('click', () => {
            const statusFilter = document.getElementById('filter-status').value;
            const dateFrom = document.getElementById('filter-date-from').value;
            const dateTo = document.getElementById('filter-date-to').value;
            
            let url = `${API_BASE}/api/export/markdown`;
            const params = new URLSearchParams();
            
            if (statusFilter && statusFilter !== 'all') {
                params.append('status', statusFilter);
            }
            if (dateFrom) {
                params.append('date_from', dateFrom);
            }
            if (dateTo) {
                params.append('date_to', dateTo);
            }
            
            if (params.toString()) {
                url += '?' + params.toString();
            }
            
            window.location.href = url;
        });
    }
    
    const exportJsonBtn = document.getElementById('export-json-btn');
    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', () => {
            const statusFilter = document.getElementById('filter-status').value;
            const dateFrom = document.getElementById('filter-date-from').value;
            const dateTo = document.getElementById('filter-date-to').value;
            
            let url = `${API_BASE}/api/export/json`;
            const params = new URLSearchParams();
            
            if (statusFilter && statusFilter !== 'all') {
                params.append('status', statusFilter);
            }
            if (dateFrom) {
                params.append('date_from', dateFrom);
            }
            if (dateTo) {
                params.append('date_to', dateTo);
            }
            
            if (params.toString()) {
                url += '?' + params.toString();
            }
            
            window.location.href = url;
        });
    }
    
    const downloadSampleBtn = document.getElementById('download-sample-btn');
    if (downloadSampleBtn) {
        downloadSampleBtn.addEventListener('click', () => {
            const sampleData = `观测点名称,设备名称,目标名称,目标赤经,目标赤纬,观测日期,观测时间,云量(%),视宁度,设备电量(%),曝光计划,实际文件路径,备注
天台观测点,信达小黑望远镜,M42 猎户座大星云,05h35m17s,-05°23'28",2024-01-15,22:30:00,15,3.5,85,L: 10x300s, R: 5x300s, G: 5x300s, B: 5x300s,/Volumes/Data/2024-01-15/M42/,首次观测
南山观测站,高桥EM200,M31 仙女座星系,00h42m44s,+41°16'09",2024-01-16,21:00:00,5,2.0,100,L: 20x300s,/Volumes/Data/2024-01-16/M31/,视宁度极佳`;
            
            const blob = new Blob([sampleData], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = '夜巡记录示例.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }
}

function initUploadArea() {
    const uploadArea = document.getElementById('csv-upload-area');
    const fileInput = document.getElementById('csv-file-input');
    const selectBtn = document.getElementById('select-csv-btn');
    
    if (!uploadArea || !fileInput) return;
    
    if (selectBtn) {
        selectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
    }
    
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleCsvUpload(files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleCsvUpload(e.target.files[0]);
        }
    });
}

async function handleCsvUpload(file) {
    const resultDiv = document.getElementById('import-result');
    
    if (!file.name.endsWith('.csv')) {
        showToast('请上传 CSV 文件', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        showToast('正在导入...', 'info');
        
        const response = await fetch(`${API_BASE}/api/import/csv`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (resultDiv) {
                resultDiv.style.display = 'block';
                resultDiv.className = 'import-result success';
                let message = `成功导入 ${data.imported_count} 条记录`;
                if (data.errors && data.errors.length > 0) {
                    message += `，但有 ${data.errors.length} 行导入失败`;
                }
                resultDiv.innerHTML = `<p>${message}</p>`;
            }
            
            showToast(`成功导入 ${data.imported_count} 条记录`, 'success');
            await loadAllData();
        } else {
            if (resultDiv) {
                resultDiv.style.display = 'block';
                resultDiv.className = 'import-result error';
                resultDiv.innerHTML = `<p>导入失败: ${data.error}</p>`;
            }
            showToast('导入失败: ' + data.error, 'error');
        }
    } catch (error) {
        showToast('导入失败: ' + error.message, 'error');
    }
}

function initModal() {
    const overlay = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

async function showDetail(batchId) {
    const overlay = document.getElementById('modal-overlay');
    const modalBody = document.getElementById('modal-body');
    
    if (!overlay || !modalBody) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/exposure-batches/${batchId}`);
        const batch = await response.json();
        
        if (!batch) {
            showToast('记录不存在', 'error');
            return;
        }
        
        const statusNames = {
            'pending': '待复核',
            'approved': '已通过',
            'rejected': '已驳回',
            'needs_review': '需重新复核'
        };
        
        const riskSeverityNames = {
            'high': '高',
            'medium': '中',
            'low': '低'
        };
        
        let html = `
            <div class="detail-grid">
                <div class="detail-row">
                    <span class="detail-label">记录ID</span>
                    <span class="detail-value">${batch.id}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">观测日期</span>
                    <span class="detail-value">${escapeHtml(batch.observation_date || '-')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">观测时间</span>
                    <span class="detail-value">${escapeHtml(batch.observation_time || '-')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">观测点</span>
                    <span class="detail-value">${escapeHtml(batch.observation_point_name || '-')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">设备</span>
                    <span class="detail-value">${escapeHtml(batch.device_name || '-')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">目标</span>
                    <span class="detail-value">${escapeHtml(batch.target_name || '-')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">赤经</span>
                    <span class="detail-value">${escapeHtml(batch.target_ra || '-')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">赤纬</span>
                    <span class="detail-value">${escapeHtml(batch.target_dec || '-')}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">云量</span>
                    <span class="detail-value">${batch.cloud_cover || 0}%</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">视宁度</span>
                    <span class="detail-value">${batch.seeing || '-'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">设备电量</span>
                    <span class="detail-value">${batch.device_battery || 100}%</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">状态</span>
                    <span class="detail-value">
                        <span class="status-badge status-${batch.status}">${statusNames[batch.status] || '未知'}</span>
                    </span>
                </div>
            </div>
        `;
        
        if (batch.exposure_plan) {
            html += `
                <div class="detail-section">
                    <h4>曝光计划</h4>
                    <p style="white-space: pre-wrap;">${escapeHtml(batch.exposure_plan)}</p>
                </div>
            `;
        }
        
        if (batch.actual_files) {
            html += `
                <div class="detail-section">
                    <h4>实际文件路径</h4>
                    <p style="white-space: pre-wrap; word-break: break-all;">${escapeHtml(batch.actual_files)}</p>
                </div>
            `;
        }
        
        if (batch.notes) {
            html += `
                <div class="detail-section">
                    <h4>备注</h4>
                    <p>${escapeHtml(batch.notes)}</p>
                </div>
            `;
        }
        
        if (batch.risk_flags && batch.risk_flags.length > 0) {
            html += `
                <div class="detail-section">
                    <h4>风险检测 (${batch.risk_flags.length}个)</h4>
                    <ul class="risk-list">
                        ${batch.risk_flags.map(risk => `
                            <li class="risk-${risk.severity}">
                                <strong>[${riskSeverityNames[risk.severity] || '未知'}风险]</strong>
                                ${escapeHtml(risk.message)}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }
        
        if (batch.reviewed_by || batch.reviewed_at) {
            html += `
                <div class="detail-section">
                    <h4>复核信息</h4>
                    <div class="detail-grid">
                        ${batch.reviewed_by ? `
                            <div class="detail-row">
                                <span class="detail-label">复核人</span>
                                <span class="detail-value">${escapeHtml(batch.reviewed_by)}</span>
                            </div>
                        ` : ''}
                        ${batch.reviewed_at ? `
                            <div class="detail-row">
                                <span class="detail-label">复核时间</span>
                                <span class="detail-value">${escapeHtml(batch.reviewed_at)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        
        html += `
            <div class="review-section">
                <h4>复核操作</h4>
                <div class="review-form">
                    <div class="form-group">
                        <label for="reviewer-name">复核人姓名</label>
                        <input type="text" id="reviewer-name" placeholder="请输入您的姓名">
                    </div>
                    <div class="review-actions">
                        <button class="btn btn-success" onclick="updateStatus(${batch.id}, 'approved')">
                            ✓ 通过
                        </button>
                        <button class="btn btn-danger" onclick="updateStatus(${batch.id}, 'rejected')">
                            ✗ 驳回
                        </button>
                        <button class="btn" onclick="updateStatus(${batch.id}, 'needs_review')">
                            ⚠ 需重新复核
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        modalBody.innerHTML = html;
        overlay.classList.add('active');
        
    } catch (error) {
        showToast('加载详情失败: ' + error.message, 'error');
    }
}

async function updateStatus(batchId, status) {
    const reviewerName = document.getElementById('reviewer-name')?.value?.trim() || '';
    
    if (!reviewerName) {
        showToast('请输入复核人姓名', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/exposure-batches/${batchId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: status,
                reviewed_by: reviewerName
            })
        });
        
        if (response.ok) {
            showToast('状态更新成功', 'success');
            closeModal();
            await loadExposureBatches();
            await loadStats();
        } else {
            showToast('更新失败', 'error');
        }
    } catch (error) {
        showToast('更新失败: ' + error.message, 'error');
    }
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
