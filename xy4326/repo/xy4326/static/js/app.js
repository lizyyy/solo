const API_BASE = '/api';

let currentBatchId = null;
let allRisks = [];
let trendChart = null;
let detailTrendChart = null;
let toastElement = null;

document.addEventListener('DOMContentLoaded', function() {
    toastElement = new bootstrap.Toast(document.getElementById('notificationToast'));
    loadBatches();
    
    const savedBatchId = localStorage.getItem('currentBatchId');
    if (savedBatchId) {
        selectBatch(parseInt(savedBatchId));
    }
});

function showToast(message, title = '提示') {
    document.getElementById('toastTitle').textContent = title;
    document.getElementById('toastMessage').textContent = message;
    toastElement.show();
}

async function apiRequest(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    if (options.body && typeof options.body === 'object') {
        options.body = JSON.stringify(options.body);
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...defaultOptions,
        ...options
    });
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '请求失败' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return response.json();
}

async function loadBatches() {
    try {
        const batches = await apiRequest('/batches');
        const batchList = document.getElementById('batchList');
        
        batchList.innerHTML = `
            <li><a class="dropdown-item" href="#" onclick="showCreateBatchModal()">+ 新建批次</a></li>
            ${batches.length > 0 ? '<li><hr class="dropdown-divider"></li>' : ''}
            ${batches.map(b => `
                <li>
                    <a class="dropdown-item" href="#" onclick="selectBatch(${b.id})">
                        <i class="bi bi-folder2-open me-2"></i>${b.batch_name}
                        <span class="text-muted ms-2">${b.inspection_date || ''}</span>
                    </a>
                </li>
            `).join('')}
        `;
    } catch (error) {
        showToast(error.message, '错误');
    }
}

function showCreateBatchModal() {
    document.getElementById('batchName').value = '';
    document.getElementById('inspectionDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('inspector').value = '';
    document.getElementById('weather').value = '';
    document.getElementById('batchNotes').value = '';
    
    new bootstrap.Modal(document.getElementById('createBatchModal')).show();
}

async function createBatch() {
    const batchName = document.getElementById('batchName').value.trim();
    if (!batchName) {
        showToast('请输入批次名称', '错误');
        return;
    }
    
    try {
        const batch = await apiRequest('/batches', {
            method: 'POST',
            body: {
                batch_name: batchName,
                inspection_date: document.getElementById('inspectionDate').value,
                inspector: document.getElementById('inspector').value.trim(),
                weather: document.getElementById('weather').value.trim(),
                notes: document.getElementById('batchNotes').value.trim()
            }
        });
        
        bootstrap.Modal.getInstance(document.getElementById('createBatchModal')).hide();
        showToast('批次创建成功');
        await loadBatches();
        selectBatch(batch.id);
    } catch (error) {
        showToast(error.message, '错误');
    }
}

function selectBatch(batchId) {
    currentBatchId = batchId;
    localStorage.setItem('currentBatchId', batchId);
    
    loadBatchData();
    loadBatchStats();
    loadRisks();
    loadPoints();
    loadReviews();
}

async function loadBatchData() {
    if (!currentBatchId) return;
    
    try {
        const batch = await apiRequest(`/batches/${currentBatchId}`);
        document.getElementById('currentBatchInfo').innerHTML = `
            <span class="text-light">
                <i class="bi bi-folder2-open"></i> ${batch.batch_name}
            </span>
        `;
        document.getElementById('batchDropdown').textContent = batch.batch_name;
    } catch (error) {
        console.error('加载批次信息失败:', error);
    }
}

async function loadBatchStats() {
    if (!currentBatchId) return;
    
    try {
        const stats = await apiRequest(`/stats/${currentBatchId}`);
        const statsCard = document.getElementById('statsCard');
        
        statsCard.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item stat-primary">
                    <span class="stat-value">${stats.points.total}</span>
                    <span class="stat-label">巡检点位</span>
                </div>
                <div class="stat-item stat-info">
                    <span class="stat-value">${stats.temperatures.total_records}</span>
                    <span class="stat-label">温度记录</span>
                </div>
                <div class="stat-item stat-danger">
                    <span class="stat-value">${stats.risks.high_pending}</span>
                    <span class="stat-label">高风险</span>
                </div>
                <div class="stat-item stat-warning">
                    <span class="stat-value">${stats.risks.medium_pending}</span>
                    <span class="stat-label">中风险</span>
                </div>
                <div class="stat-item stat-success">
                    <span class="stat-value">${stats.risks.closed}</span>
                    <span class="stat-label">已闭环</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${stats.photos.total}</span>
                    <span class="stat-label">照片</span>
                </div>
            </div>
            <div class="mt-3">
                <small class="text-muted">
                    温度: 平均 ${stats.temperatures.average}°C | 
                    最高 ${stats.temperatures.max}°C | 
                    最低 ${stats.temperatures.min}°C
                </small>
            </div>
        `;
        
        document.getElementById('highRiskCount').textContent = stats.risks.high_pending;
    } catch (error) {
        console.error('加载统计数据失败:', error);
    }
}

async function importCsv() {
    if (!currentBatchId) {
        showToast('请先选择巡检批次', '错误');
        return;
    }
    
    const fileInput = document.getElementById('csvFileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        showToast('请选择CSV文件', '错误');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(`${API_BASE}/batches/${currentBatchId}/import/csv`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message);
            fileInput.value = '';
            loadBatchStats();
            loadPoints();
        } else {
            showToast(result.error, '错误');
        }
    } catch (error) {
        showToast(error.message, '错误');
    }
}

async function importLogs() {
    if (!currentBatchId) {
        showToast('请先选择巡检批次', '错误');
        return;
    }
    
    const fileInput = document.getElementById('logFileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        showToast('请选择日志文件', '错误');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(`${API_BASE}/batches/${currentBatchId}/import/logs`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message);
            fileInput.value = '';
            loadBatchStats();
        } else {
            showToast(result.error, '错误');
        }
    } catch (error) {
        showToast(error.message, '错误');
    }
}

async function uploadPhotos() {
    if (!currentBatchId) {
        showToast('请先选择巡检批次', '错误');
        return;
    }
    
    const fileInput = document.getElementById('photoFileInput');
    const files = fileInput.files;
    
    if (!files.length) {
        showToast('请选择照片文件', '错误');
        return;
    }
    
    const formData = new FormData();
    for (let file of files) {
        formData.append('files', file);
    }
    
    const pointCode = document.getElementById('photoPointCode').value.trim();
    if (pointCode) {
        formData.append('point_code', pointCode);
    }
    
    try {
        const response = await fetch(`${API_BASE}/batches/${currentBatchId}/import/photos`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast(result.message);
            fileInput.value = '';
            document.getElementById('photoPointCode').value = '';
            loadBatchStats();
        } else {
            showToast(result.error, '错误');
        }
    } catch (error) {
        showToast(error.message, '错误');
    }
}

async function runAnalysis() {
    if (!currentBatchId) {
        showToast('请先选择巡检批次', '错误');
        return;
    }
    
    try {
        showToast('正在分析...');
        const result = await apiRequest(`/batches/${currentBatchId}/analyze`, {
            method: 'POST'
        });
        
        showToast(`分析完成，发现 ${result.result.risks_created} 个风险`);
        loadBatchStats();
        loadRisks();
        loadPoints();
    } catch (error) {
        showToast(error.message, '错误');
    }
}

async function loadRisks() {
    if (!currentBatchId) return;
    
    try {
        allRisks = await apiRequest(`/risks?batch_id=${currentBatchId}`);
        filterRisks();
    } catch (error) {
        console.error('加载风险数据失败:', error);
    }
}

function filterRisks() {
    const levelFilter = document.getElementById('riskLevelFilter').value;
    const statusFilter = document.getElementById('riskStatusFilter').value;
    const searchText = document.getElementById('riskSearchInput').value.toLowerCase();
    
    let filtered = allRisks;
    
    if (levelFilter) {
        filtered = filtered.filter(r => r.risk_level === levelFilter);
    }
    
    if (statusFilter) {
        const isClosed = statusFilter === 'true';
        filtered = filtered.filter(r => r.is_closed === isClosed);
    }
    
    if (searchText) {
        filtered = filtered.filter(r => 
            (r.point_code || '').toLowerCase().includes(searchText) ||
            (r.point_name || '').toLowerCase().includes(searchText) ||
            (r.description || '').toLowerCase().includes(searchText)
        );
    }
    
    renderRiskTable(filtered);
}

function renderRiskTable(risks) {
    const tbody = document.getElementById('riskTableBody');
    
    if (!risks || risks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">暂无风险数据</td></tr>';
        return;
    }
    
    tbody.innerHTML = risks.map(r => `
        <tr class="${r.risk_level === 'high' ? 'table-danger bg-opacity-25' : (r.risk_level === 'medium' ? 'table-warning bg-opacity-25' : '')}">
            <td>
                <span class="badge ${getRiskBadgeClass(r.risk_level)}">
                    ${getRiskLevelText(r.risk_level)}
                </span>
            </td>
            <td><strong>${r.point_code || '-'}</strong></td>
            <td>${r.point_name || '-'}</td>
            <td>${getRiskTypeText(r.risk_type)}</td>
            <td>${r.temperature_value ? r.temperature_value.toFixed(1) + '°C' : '-'}</td>
            <td class="text-nowrap">${formatDateTime(r.detected_at)}</td>
            <td>
                ${r.manual_judgment ? 
                    `<span class="badge ${getJudgmentBadgeClass(r.manual_judgment)}">${getJudgmentText(r.manual_judgment)}</span>` : 
                    '<span class="text-muted">未判定</span>'}
            </td>
            <td>
                <span class="badge ${r.is_closed ? 'bg-success' : 'bg-secondary'}">
                    ${r.is_closed ? '已闭环' : '待处理'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="viewRiskDetail(${r.id})">
                    <i class="bi bi-eye"></i> 详情
                </button>
            </td>
        </tr>
    `).join('');
}

function getRiskBadgeClass(level) {
    switch (level) {
        case 'high': return 'bg-danger';
        case 'medium': return 'bg-warning text-dark';
        case 'low': return 'bg-info text-dark';
        default: return 'bg-secondary';
    }
}

function getRiskLevelText(level) {
    switch (level) {
        case 'high': return '高风险';
        case 'medium': return '中风险';
        case 'low': return '低风险';
        default: return level;
    }
}

function getRiskTypeText(type) {
    const typeMap = {
        'high_temperature': '高温异常',
        'medium_temperature': '温度异常',
        'temperature_rise': '温度突变',
        'continuous_high_temp': '连续高温',
        'unclosed_alert': '未闭环告警',
        'duplicate_point': '重复点位'
    };
    return typeMap[type] || type;
}

function getJudgmentBadgeClass(judgment) {
    switch (judgment) {
        case 'confirmed': return 'bg-danger';
        case 'false_alarm': return 'bg-success';
        case 'low_priority': return 'bg-info';
        case 'needs_monitoring': return 'bg-warning text-dark';
        default: return 'bg-secondary';
    }
}

function getJudgmentText(judgment) {
    const map = {
        'confirmed': '确认风险',
        'false_alarm': '误报',
        'low_priority': '低优先级',
        'needs_monitoring': '需持续关注'
    };
    return map[judgment] || judgment;
}

function formatDateTime(dtStr) {
    if (!dtStr) return '-';
    const dt = new Date(dtStr);
    return dt.toLocaleDateString('zh-CN') + ' ' + dt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

async function viewRiskDetail(riskId) {
    try {
        const risk = await apiRequest(`/risks/${riskId}`);
        
        document.getElementById('currentRiskId').value = riskId;
        document.getElementById('detailRiskTitle').textContent = 
            `${getRiskLevelText(risk.risk_level)} - ${getRiskTypeText(risk.risk_type)}`;
        
        document.getElementById('detailPointCode').textContent = risk.point?.point_code || '-';
        document.getElementById('detailPointName').textContent = risk.point?.point_name || '-';
        document.getElementById('detailPointType').textContent = risk.point?.point_type || '-';
        document.getElementById('detailLocation').textContent = risk.point?.location || '-';
        
        document.getElementById('detailRiskLevel').innerHTML = 
            `<span class="badge ${getRiskBadgeClass(risk.risk_level)}">${getRiskLevelText(risk.risk_level)}</span>`;
        document.getElementById('detailRiskType').textContent = getRiskTypeText(risk.risk_type);
        document.getElementById('detailTemperature').textContent = 
            risk.temperature_value ? risk.temperature_value.toFixed(1) + '°C' : '-';
        document.getElementById('detailDetectedAt').textContent = formatDateTime(risk.detected_at);
        document.getElementById('detailDescription').textContent = risk.description || '-';
        
        document.getElementById('judgmentSelect').value = risk.manual_judgment || '';
        document.getElementById('judgmentNotes').value = risk.judgment_notes || '';
        
        const closeBtn = document.getElementById('closeRiskBtn');
        if (risk.is_closed) {
            closeBtn.style.display = 'none';
        } else {
            closeBtn.style.display = 'inline-block';
        }
        
        renderDetailTrendChart(risk.temperature_history);
        await loadPointPhotos(risk.point_id);
        
        new bootstrap.Modal(document.getElementById('riskDetailModal')).show();
    } catch (error) {
        showToast(error.message, '错误');
    }
}

function renderDetailTrendChart(temperatureHistory) {
    const ctx = document.getElementById('detailTrendChart').getContext('2d');
    
    if (detailTrendChart) {
        detailTrendChart.destroy();
    }
    
    if (!temperatureHistory || temperatureHistory.length === 0) {
        return;
    }
    
    const sorted = temperatureHistory.sort((a, b) => 
        new Date(a.record_time) - new Date(b.record_time)
    );
    
    detailTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sorted.map(t => formatDateTime(t.record_time)),
            datasets: [{
                label: '温度 (°C)',
                data: sorted.map(t => t.temperature),
                borderColor: '#dc3545',
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: { display: true, text: '温度 (°C)' }
                }
            }
        }
    });
}

async function loadPointPhotos(pointId) {
    const container = document.getElementById('detailPhotos');
    container.innerHTML = '';
    
    if (!pointId) return;
    
    try {
        const photos = await apiRequest(`/points/${pointId}/photos`);
        
        photos.forEach(photo => {
            const img = document.createElement('img');
            img.className = 'photo-thumbnail';
            img.src = `${API_BASE}/photos/${photo.filename}`;
            img.alt = photo.original_name;
            img.title = photo.original_name;
            img.onclick = () => window.open(img.src, '_blank');
            container.appendChild(img);
        });
    } catch (error) {
        console.error('加载照片失败:', error);
    }
}

async function submitJudgment() {
    const riskId = document.getElementById('currentRiskId').value;
    const judgment = document.getElementById('judgmentSelect').value;
    
    if (!judgment) {
        showToast('请选择复核判定结果', '错误');
        return;
    }
    
    try {
        await apiRequest(`/risks/${riskId}/judge`, {
            method: 'POST',
            body: {
                judgment: judgment,
                notes: document.getElementById('judgmentNotes').value.trim(),
                follow_up_actions: document.getElementById('followUpActions').value.trim(),
                recommended_review_date: document.getElementById('recommendedReviewDate').value
            }
        });
        
        showToast('复核记录已保存');
        bootstrap.Modal.getInstance(document.getElementById('riskDetailModal')).hide();
        loadRisks();
        loadBatchStats();
        loadReviews();
    } catch (error) {
        showToast(error.message, '错误');
    }
}

async function closeRisk() {
    const riskId = document.getElementById('currentRiskId').value;
    
    if (!confirm('确定要将此风险标记为闭环吗？')) {
        return;
    }
    
    try {
        await apiRequest(`/risks/${riskId}/close`, {
            method: 'POST',
            body: {
                close_reason: document.getElementById('judgmentNotes').value.trim() || '风险已闭环'
            }
        });
        
        showToast('风险已闭环');
        bootstrap.Modal.getInstance(document.getElementById('riskDetailModal')).hide();
        loadRisks();
        loadBatchStats();
        loadReviews();
    } catch (error) {
        showToast(error.message, '错误');
    }
}

async function loadPoints() {
    if (!currentBatchId) return;
    
    try {
        const points = await apiRequest(`/points?batch_id=${currentBatchId}`);
        const risks = await apiRequest(`/risks?batch_id=${currentBatchId}`);
        
        const pointRiskMap = {};
        risks.forEach(r => {
            if (!pointRiskMap[r.point_id]) {
                pointRiskMap[r.point_id] = [];
            }
            pointRiskMap[r.point_id].push(r);
        });
        
        updatePointMap(points, pointRiskMap);
        updatePointSelect(points);
    } catch (error) {
        console.error('加载点位数据失败:', error);
    }
}

function updatePointMap(points, pointRiskMap) {
    const mapContainer = document.getElementById('pointMap');
    
    if (!points || points.length === 0) {
        mapContainer.innerHTML = `
            <div class="text-center text-muted h-100 d-flex align-items-center justify-content-center">
                <div>
                    <i class="bi bi-map" style="font-size: 3rem;"></i>
                    <p>导入点位数据后显示分布图</p>
                </div>
            </div>
        `;
        return;
    }
    
    let hasCoordinates = points.some(p => p.x_coordinate !== null && p.y_coordinate !== null);
    
    if (!hasCoordinates) {
        mapContainer.innerHTML = `
            <div class="text-center text-muted h-100 d-flex align-items-center justify-content-center">
                <div>
                    <i class="bi bi-map" style="font-size: 3rem;"></i>
                    <p>点位缺少坐标数据，无法显示分布图</p>
                    <small class="text-muted">共 ${points.length} 个点位</small>
                </div>
            </div>
        `;
        return;
    }
    
    const validPoints = points.filter(p => p.x_coordinate !== null && p.y_coordinate !== null);
    
    const minX = Math.min(...validPoints.map(p => p.x_coordinate));
    const maxX = Math.max(...validPoints.map(p => p.x_coordinate));
    const minY = Math.min(...validPoints.map(p => p.y_coordinate));
    const maxY = Math.max(...validPoints.map(p => p.y_coordinate));
    
    const padding = 0.1;
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    
    mapContainer.innerHTML = '';
    
    validPoints.forEach(point => {
        const pointRisks = pointRiskMap[point.id] || [];
        const hasHighRisk = pointRisks.some(r => r.risk_level === 'high' && !r.is_closed);
        const hasMediumRisk = pointRisks.some(r => r.risk_level === 'medium' && !r.is_closed);
        
        let markerClass = 'marker-normal';
        if (hasHighRisk) markerClass = 'marker-high';
        else if (hasMediumRisk) markerClass = 'marker-medium';
        
        const x = 10 + 80 * ((point.x_coordinate - minX) / (rangeX + padding * rangeX));
        const y = 10 + 80 * ((point.y_coordinate - minY) / (rangeY + padding * rangeY));
        
        const marker = document.createElement('div');
        marker.className = `point-marker ${markerClass}`;
        marker.style.left = `${x}%`;
        marker.style.top = `${y}%`;
        marker.setAttribute('data-code', point.point_code);
        marker.setAttribute('data-id', point.id);
        
        marker.onclick = () => {
            if (pointRisks.length > 0) {
                viewRiskDetail(pointRisks[0].id);
            } else {
                showToast('该点位无风险记录');
            }
        };
        
        mapContainer.appendChild(marker);
    });
}

function resetMapView() {
    loadPoints();
}

function updatePointSelect(points) {
    const select = document.getElementById('pointSelect');
    select.innerHTML = '<option value="">请选择点位</option>' +
        points.map(p => 
            `<option value="${p.id}">${p.point_code} - ${p.point_name || '未命名'}</option>`
        ).join('');
}

async function loadTemperatureTrend() {
    const pointId = document.getElementById('pointSelect').value;
    if (!pointId) return;
    
    try {
        const temperatures = await apiRequest(`/points/${pointId}/temperatures`);
        
        const ctx = document.getElementById('trendChart').getContext('2d');
        
        if (trendChart) {
            trendChart.destroy();
        }
        
        if (!temperatures || temperatures.length === 0) {
            return;
        }
        
        const sorted = temperatures.sort((a, b) => 
            new Date(a.record_time) - new Date(b.record_time)
        );
        
        trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sorted.map(t => formatDateTime(t.record_time)),
                datasets: [{
                    label: '当前温度 (°C)',
                    data: sorted.map(t => t.temperature),
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    fill: true,
                    tension: 0.3
                }, {
                    label: '环境温度 (°C)',
                    data: sorted.map(t => t.ambient_temperature),
                    borderColor: '#17a2b8',
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        title: { display: true, text: '温度 (°C)' }
                    }
                }
            }
        });
    } catch (error) {
        showToast(error.message, '错误');
    }
}

function toggleTrendType(type) {
    if (!trendChart) return;
    trendChart.config.type = type;
    trendChart.update();
}

async function loadReviews() {
    if (!currentBatchId) return;
    
    try {
        const reviews = await apiRequest('/reviews');
        
        const filteredReviews = reviews.filter(r => {
            const risk = allRisks.find(ar => ar.id === r.risk_id);
            return risk && risk.batch_id === currentBatchId;
        });
        
        const tbody = document.getElementById('reviewTableBody');
        
        if (filteredReviews.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">暂无复核记录</td></tr>';
            return;
        }
        
        tbody.innerHTML = filteredReviews.map(r => {
            const risk = allRisks.find(ar => ar.id === r.risk_id);
            return `
                <tr>
                    <td class="text-nowrap">${formatDateTime(r.review_time)}</td>
                    <td>${r.reviewer || '-'}</td>
                    <td>
                        ${risk ? `${risk.point_code || '-'}` : '-'}
                        <span class="text-muted">(${getRiskTypeText(risk?.risk_type) || '-'})</span>
                    </td>
                    <td>
                        <span class="badge ${getJudgmentBadgeClass(r.review_result)}">
                            ${getJudgmentText(r.review_result)}
                        </span>
                    </td>
                    <td>${r.review_notes || '-'}</td>
                    <td>${r.follow_up_actions || '-'}</td>
                    <td>${r.recommended_review_date || '-'}</td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('加载复核记录失败:', error);
    }
}

function exportRiskList() {
    if (!currentBatchId) {
        showToast('请先选择巡检批次', '错误');
        return;
    }
    
    window.open(`${API_BASE}/export/risk_list/${currentBatchId}`, '_blank');
}

function exportReport() {
    if (!currentBatchId) {
        showToast('请先选择巡检批次', '错误');
        return;
    }
    
    window.open(`${API_BASE}/export/report/${currentBatchId}`, '_blank');
}
