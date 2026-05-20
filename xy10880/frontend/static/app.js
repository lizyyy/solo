const API_BASE = '/api';
let currentBatchId = null;
let deviceModels = [];
let firmwareVersions = [];

async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(API_BASE + url, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

function showSection(section) {
    document.querySelectorAll('section').forEach(s => s.style.display = 'none');
    document.getElementById(section + '-section').style.display = 'block';
    
    if (section === 'batches') loadBatches();
    if (section === 'devices') loadDeviceModels();
    if (section === 'firmware') loadFirmwareVersions();
}

function showTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector(`[onclick="showTab('${tab}')"]`).classList.add('active');
    document.getElementById(tab + '-tab').classList.add('active');
}

function showModal(content) {
    document.getElementById('modal-content').innerHTML = content;
    document.getElementById('modal-overlay').style.display = 'flex';
}

function hideModal() {
    document.getElementById('modal-overlay').style.display = 'none';
}

function getStatusLabel(status) {
    const labels = {
        created: '已创建',
        running: '运行中',
        paused: '已暂停',
        completed: '已完成',
        rolled_back: '已回滚'
    };
    return labels[status] || status;
}

async function loadBatches() {
    const statusFilter = document.getElementById('status-filter').value;
    const modelFilter = document.getElementById('model-filter').value;
    
    let url = '/batches';
    const params = [];
    if (statusFilter) params.push(`status=${statusFilter}`);
    if (modelFilter) params.push(`model_id=${modelFilter}`);
    if (params.length) url += '?' + params.join('&');
    
    const batches = await apiRequest(url);
    const container = document.getElementById('batches-list');
    
    if (!batches || batches.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><p>暂无灰度批次</p></div>';
        return;
    }
    
    container.innerHTML = batches.map(batch => {
        const progress = batch.target_devices > 0 
            ? Math.round((batch.success_count + batch.failed_count) / batch.target_devices * 100) 
            : 0;
        
        return `
            <div class="list-item" onclick="showBatchDetail(${batch.id})">
                <div class="list-item-header">
                    <span class="list-item-title">${batch.name}</span>
                    <span class="status-badge status-${batch.status}">${getStatusLabel(batch.status)}</span>
                </div>
                <div class="list-item-meta">
                    <span class="meta-item">📱 ${batch.model_name} (${batch.model_code})</span>
                    <span class="meta-item">🔢 ${batch.firmware_version}</span>
                    <span class="meta-item">✅ ${batch.success_count} 成功</span>
                    <span class="meta-item">❌ ${batch.failed_count} 失败</span>
                    <span class="meta-item">🎯 ${batch.target_devices} 台</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

async function loadDeviceModels() {
    const models = await apiRequest('/device-models');
    deviceModels = models || [];
    
    const modelFilter = document.getElementById('model-filter');
    modelFilter.innerHTML = '<option value="">全部型号</option>';
    models.forEach(m => {
        modelFilter.innerHTML += `<option value="${m.id}">${m.model_name}</option>`;
    });
    
    const container = document.getElementById('devices-list');
    if (!models || models.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📱</div><p>暂无设备型号</p></div>';
        return;
    }
    
    container.innerHTML = models.map(model => `
        <div class="list-item">
            <div class="list-item-header">
                <span class="list-item-title">${model.model_name}</span>
                <span class="status-badge status-created">${model.model_code}</span>
            </div>
            <div class="list-item-meta">
                <span class="meta-item">📝 ${model.description || '无描述'}</span>
            </div>
        </div>
    `).join('');
}

async function loadFirmwareVersions() {
    const firmware = await apiRequest('/firmware');
    firmwareVersions = firmware || [];
    
    const container = document.getElementById('firmware-list');
    if (!firmware || firmware.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💾</div><p>暂无固件版本</p></div>';
        return;
    }
    
    container.innerHTML = firmware.map(fw => `
        <div class="list-item">
            <div class="list-item-header">
                <span class="list-item-title">${fw.version}</span>
                <span class="status-badge status-created">${fw.model_name}</span>
            </div>
            <div class="list-item-meta">
                <span class="meta-item">📁 ${fw.file_path || '未设置'}</span>
                <span class="meta-item">📝 ${fw.release_notes || '无说明'}</span>
            </div>
        </div>
    `).join('');
}

async function showBatchDetail(batchId) {
    currentBatchId = batchId;
    const batch = await apiRequest(`/batches/${batchId}`);
    if (!batch) return;
    
    document.getElementById('batch-title').textContent = batch.name;
    
    document.getElementById('batch-info').innerHTML = `
        <div class="info-card">
            <div class="info-card-label">状态</div>
            <div class="info-card-value"><span class="status-badge status-${batch.status}">${getStatusLabel(batch.status)}</span></div>
        </div>
        <div class="info-card">
            <div class="info-card-label">设备型号</div>
            <div class="info-card-value" style="font-size:16px">${batch.model_name}</div>
        </div>
        <div class="info-card">
            <div class="info-card-label">固件版本</div>
            <div class="info-card-value" style="font-size:16px">${batch.firmware_version}</div>
        </div>
        <div class="info-card">
            <div class="info-card-label">目标设备</div>
            <div class="info-card-value">${batch.target_devices}</div>
        </div>
        <div class="info-card">
            <div class="info-card-label">成功</div>
            <div class="info-card-value" style="color:#1e8e3e">${batch.success_count}</div>
        </div>
        <div class="info-card">
            <div class="info-card-label">失败</div>
            <div class="info-card-value" style="color:#d93025">${batch.failed_count}</div>
        </div>
    `;
    
    if (batch.pause_reason) {
        document.getElementById('batch-info').innerHTML += `
            <div class="info-card" style="grid-column:1/-1;background:#fef7e0">
                <div class="info-card-label">暂停原因</div>
                <div class="info-card-value" style="font-size:14px;color:#f9ab00">${batch.pause_reason}</div>
            </div>
        `;
    }
    
    let actionsHtml = '';
    if (batch.status === 'created') {
        actionsHtml += `<button onclick="startBatch(${batchId})" class="btn-success">启动</button>`;
    }
    if (batch.status === 'running') {
        actionsHtml += `<button onclick="pauseBatch(${batchId})" class="btn-warning">暂停</button>`;
        actionsHtml += `<button onclick="completeBatch(${batchId})" class="btn-success">完成</button>`;
    }
    if (batch.status === 'paused') {
        actionsHtml += `<button onclick="resumeBatch(${batchId})" class="btn-success">恢复</button>`;
    }
    if (batch.status !== 'rolled_back') {
        actionsHtml += `<button onclick="rollbackBatch(${batchId})" class="btn-danger">回滚</button>`;
    }
    document.getElementById('batch-actions').innerHTML = actionsHtml;
    
    showSection('batch-detail');
    loadTimeline(batchId);
    loadReceipts(batchId);
    loadReport(batchId);
}

async function loadTimeline(batchId) {
    const timeline = await apiRequest(`/batches/${batchId}/timeline`);
    const container = document.getElementById('timeline-container');
    
    if (!timeline || timeline.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><p>暂无时间线记录</p></div>';
        return;
    }
    
    container.innerHTML = timeline.map(item => {
        let dotClass = '';
        if (item.status === 'success') dotClass = 'timeline-dot-success';
        else if (item.status === 'failed') dotClass = 'timeline-dot-failed';
        else if (item.status === 'pending') dotClass = 'timeline-dot-pending';
        
        return `
            <div class="timeline-item">
                <div class="timeline-dot ${dotClass}"></div>
                <div class="timeline-time">${item.time}</div>
                <div class="timeline-device">设备: ${item.device_sn}</div>
                <div class="timeline-event">${item.event}</div>
            </div>
        `;
    }).join('');
}

async function loadReceipts(batchId) {
    const receipts = await apiRequest(`/batches/${batchId}/receipts`);
    const container = document.getElementById('receipts-list');
    
    if (!receipts || receipts.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><p>暂无升级回执</p></div>';
        return;
    }
    
    container.innerHTML = receipts.map(r => `
        <div class="list-item">
            <div class="list-item-header">
                <span class="list-item-title">${r.device_sn}</span>
                <span class="status-badge status-${r.status}">${getStatusLabel(r.status)}</span>
            </div>
            <div class="list-item-meta">
                <span class="meta-item">🕐 创建: ${r.created_at}</span>
                ${r.completed_at ? `<span class="meta-item">✅ 完成: ${r.completed_at}</span>` : ''}
                ${r.error_message ? `<span class="meta-item" style="color:#d93025">❌ ${r.error_message}</span>` : ''}
            </div>
        </div>
    `).join('');
}

async function loadReport(batchId) {
    const report = await apiRequest(`/batches/${batchId}/report`);
    const container = document.getElementById('report-content');
    
    if (!report) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><p>暂无报告数据</p></div>';
        return;
    }
    
    let failureReasonsHtml = '';
    if (Object.keys(report.failure_reasons || {}).length > 0) {
        failureReasonsHtml = `
            <div class="failure-reasons">
                <h4>失败原因统计</h4>
                ${Object.entries(report.failure_reasons).map(([reason, count]) => `
                    <div class="reason-item">
                        <span>${reason}</span>
                        <span>${count} 次</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="report-summary">
            <div class="report-item">
                <div class="report-item-label">总设备数</div>
                <div class="report-item-value">${report.summary.total}</div>
            </div>
            <div class="report-item">
                <div class="report-item-label">成功</div>
                <div class="report-item-value" style="color:#1e8e3e">${report.summary.success}</div>
            </div>
            <div class="report-item">
                <div class="report-item-label">失败</div>
                <div class="report-item-value" style="color:#d93025">${report.summary.failed}</div>
            </div>
            <div class="report-item">
                <div class="report-item-label">进行中</div>
                <div class="report-item-value" style="color:#1a73e8">${report.summary.in_progress}</div>
            </div>
            <div class="report-item">
                <div class="report-item-label">成功率</div>
                <div class="report-item-value">${(report.summary.success_rate * 100).toFixed(1)}%</div>
            </div>
        </div>
        ${failureReasonsHtml}
    `;
}

function downloadReport() {
    if (!currentBatchId) return;
    window.open(`${API_BASE}/batches/${currentBatchId}/report/download`, '_blank');
}

function showCreateBatchModal() {
    const modelOptions = deviceModels.map(m => `<option value="${m.id}">${m.model_name}</option>`).join('');
    const firmwareOptions = firmwareVersions.map(f => `<option value="${f.id}">${f.version} (${f.model_name})</option>`).join('');
    
    showModal(`
        <h3>创建灰度批次</h3>
        <form onsubmit="createBatch(event)">
            <div class="form-group">
                <label>批次名称</label>
                <input type="text" id="batch-name" required>
            </div>
            <div class="form-group">
                <label>设备型号</label>
                <select id="batch-model" required>${modelOptions}</select>
            </div>
            <div class="form-group">
                <label>固件版本</label>
                <select id="batch-firmware" required>${firmwareOptions}</select>
            </div>
            <div class="form-group">
                <label>失败暂停阈值 (%)</label>
                <input type="number" id="batch-threshold" value="10" min="1" max="100">
            </div>
            <div class="form-actions">
                <button type="button" onclick="hideModal()" class="btn-secondary">取消</button>
                <button type="submit" class="btn-primary">创建</button>
            </div>
        </form>
    `);
}

async function createBatch(event) {
    event.preventDefault();
    const data = {
        name: document.getElementById('batch-name').value,
        model_id: parseInt(document.getElementById('batch-model').value),
        firmware_id: parseInt(document.getElementById('batch-firmware').value),
        pause_threshold: parseInt(document.getElementById('batch-threshold').value) / 100
    };
    
    await apiRequest('/batches', { method: 'POST', body: JSON.stringify(data) });
    hideModal();
    loadBatches();
}

function showCreateDeviceModal() {
    showModal(`
        <h3>创建设备型号</h3>
        <form onsubmit="createDeviceModel(event)">
            <div class="form-group">
                <label>型号名称</label>
                <input type="text" id="model-name" required>
            </div>
            <div class="form-group">
                <label>型号代码</label>
                <input type="text" id="model-code" required>
            </div>
            <div class="form-group">
                <label>描述</label>
                <textarea id="model-description"></textarea>
            </div>
            <div class="form-actions">
                <button type="button" onclick="hideModal()" class="btn-secondary">取消</button>
                <button type="submit" class="btn-primary">创建</button>
            </div>
        </form>
    `);
}

async function createDeviceModel(event) {
    event.preventDefault();
    const data = {
        model_name: document.getElementById('model-name').value,
        model_code: document.getElementById('model-code').value,
        description: document.getElementById('model-description').value
    };
    
    await apiRequest('/device-models', { method: 'POST', body: JSON.stringify(data) });
    hideModal();
    loadDeviceModels();
}

function showCreateFirmwareModal() {
    const modelOptions = deviceModels.map(m => `<option value="${m.id}">${m.model_name}</option>`).join('');
    
    showModal(`
        <h3>创建固件版本</h3>
        <form onsubmit="createFirmware(event)">
            <div class="form-group">
                <label>设备型号</label>
                <select id="firmware-model" required>${modelOptions}</select>
            </div>
            <div class="form-group">
                <label>版本号</label>
                <input type="text" id="firmware-version" required>
            </div>
            <div class="form-group">
                <label>文件路径</label>
                <input type="text" id="firmware-path">
            </div>
            <div class="form-group">
                <label>发布说明</label>
                <textarea id="firmware-notes"></textarea>
            </div>
            <div class="form-actions">
                <button type="button" onclick="hideModal()" class="btn-secondary">取消</button>
                <button type="submit" class="btn-primary">创建</button>
            </div>
        </form>
    `);
}

async function createFirmware(event) {
    event.preventDefault();
    const data = {
        model_id: parseInt(document.getElementById('firmware-model').value),
        version: document.getElementById('firmware-version').value,
        file_path: document.getElementById('firmware-path').value,
        release_notes: document.getElementById('firmware-notes').value
    };
    
    await apiRequest('/firmware', { method: 'POST', body: JSON.stringify(data) });
    hideModal();
    loadFirmwareVersions();
}

function showBulkImportModal() {
    showModal(`
        <h3>批量导入设备</h3>
        <form onsubmit="bulkImportDevices(event)">
            <div class="form-group">
                <label>设备序列号 (每行一个)</label>
                <textarea id="device-sns" rows="10" placeholder="DEV001&#10;DEV002&#10;DEV003" required></textarea>
            </div>
            <div class="form-actions">
                <button type="button" onclick="hideModal()" class="btn-secondary">取消</button>
                <button type="submit" class="btn-primary">导入</button>
            </div>
        </form>
    `);
}

async function bulkImportDevices(event) {
    event.preventDefault();
    const sns = document.getElementById('device-sns').value.split('\n').map(s => s.trim()).filter(s => s);
    
    await apiRequest('/receipts/bulk', {
        method: 'POST',
        body: JSON.stringify({ batch_id: currentBatchId, device_sns: sns })
    });
    
    hideModal();
    loadReceipts(currentBatchId);
    showBatchDetail(currentBatchId);
}

async function startBatch(batchId) {
    await apiRequest(`/batches/${batchId}/start`, { method: 'POST' });
    showBatchDetail(batchId);
}

async function pauseBatch(batchId) {
    await apiRequest(`/batches/${batchId}/pause`, { method: 'POST' });
    showBatchDetail(batchId);
}

async function resumeBatch(batchId) {
    await apiRequest(`/batches/${batchId}/resume`, { method: 'POST' });
    showBatchDetail(batchId);
}

async function rollbackBatch(batchId) {
    if (confirm('确定要回滚此批次吗？')) {
        await apiRequest(`/batches/${batchId}/rollback`, { method: 'POST' });
        showBatchDetail(batchId);
    }
}

async function completeBatch(batchId) {
    if (confirm('确定要完成此批次吗？')) {
        await apiRequest(`/batches/${batchId}/complete`, { method: 'POST' });
        showBatchDetail(batchId);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadDeviceModels();
    loadFirmwareVersions();
    loadBatches();
});
