let map = null;
let heatmapLayer = null;
let stationMarkers = [];
let clusterMarkers = [];
let timeChart = null;
let currentView = 'map';
let analysisData = null;

const API_BASE = '';

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    checkHealth();
});

function initMap() {
    map = L.map('map').setView([31.2304, 121.4737], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
}

async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE}/api/health`);
        const data = await response.json();
        
        if (data.hasAnalysis) {
            loadAnalysisResults();
        }
    } catch (e) {
        console.log('健康检查失败');
    }
}

async function loadSampleData() {
    showToast('正在加载示例数据...', 'info');
    
    try {
        const response = await fetch(`${API_BASE}/api/data/upload/sample`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`数据加载成功: ${data.stats.bikeGPS} 辆车, ${data.stats.stations} 个站点`, 'success');
            document.getElementById('analyzeBtn').disabled = false;
            updateStatus('数据已加载', 'ready');
        } else {
            showToast(data.message, 'error');
        }
    } catch (e) {
        showToast('加载示例数据失败: ' + e.message, 'error');
    }
}

async function uploadFile(input, type) {
    const file = input.files[0];
    if (!file) return;
    
    showToast('正在上传文件...', 'info');
    
    const formData = new FormData();
    formData.append(type, file);
    
    try {
        const response = await fetch(`${API_BASE}/api/data/upload`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('文件上传成功', 'success');
            document.getElementById('analyzeBtn').disabled = false;
            updateStatus('数据已加载', 'ready');
        } else {
            showToast(data.message, 'error');
        }
    } catch (e) {
        showToast('上传失败: ' + e.message, 'error');
    }
    
    input.value = '';
}

async function runAnalysis() {
    showToast('正在分析数据...', 'info');
    updateStatus('分析中...', 'analyzing');
    document.getElementById('analyzeBtn').disabled = true;
    
    try {
        const response = await fetch(`${API_BASE}/api/analyze`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('分析完成！', 'success');
            await loadAnalysisResults();
        } else {
            showToast(data.message, 'error');
        }
    } catch (e) {
        showToast('分析失败: ' + e.message, 'error');
    }
    
    document.getElementById('analyzeBtn').disabled = false;
    updateStatus('分析完成', 'ready');
}

async function loadAnalysisResults() {
    try {
        const [summaryRes, stationsRes, suggestionsRes, clustersRes, timeSeriesRes] = await Promise.all([
            fetch(`${API_BASE}/api/analysis/summary`),
            fetch(`${API_BASE}/api/stations`),
            fetch(`${API_BASE}/api/suggestions`),
            fetch(`${API_BASE}/api/clusters`),
            fetch(`${API_BASE}/api/timeseries`)
        ]);
        
        const summary = await summaryRes.json();
        const stations = await stationsRes.json();
        const suggestions = await suggestionsRes.json();
        const clusters = await clustersRes.json();
        const timeSeries = await timeSeriesRes.json();
        
        analysisData = {
            summary: summary.data,
            stations: stations.data,
            suggestions: suggestions.data,
            clusters: clusters.data,
            timeSeries: timeSeries.data
        };
        
        updateDataSummary(analysisData.summary);
        renderStationsTable(analysisData.stations);
        renderSuggestions(analysisData.suggestions);
        renderMap(analysisData.stations, analysisData.clusters);
        renderTimeChart(analysisData.timeSeries);
        
        document.getElementById('dataSummary').style.display = 'block';
        
        const analyzedAt = new Date(analysisData.summary.analyzed_at);
        document.getElementById('lastAnalysis').textContent = 
            `最后分析: ${analyzedAt.toLocaleString('zh-CN')}`;
            
    } catch (e) {
        console.error('加载分析结果失败:', e);
        showToast('加载分析结果失败', 'error');
    }
}

function updateDataSummary(summary) {
    document.getElementById('totalBikes').textContent = summary.stats.totalBikes;
    document.getElementById('totalStations').textContent = summary.stats.totalStations;
    document.getElementById('criticalStations').textContent = summary.stats.criticalStations;
    document.getElementById('highRiskStations').textContent = summary.stats.highRiskStations;
}

function renderMap(stations, clusters) {
    stationMarkers.forEach(m => map.removeLayer(m));
    clusterMarkers.forEach(m => map.removeLayer(m));
    stationMarkers = [];
    clusterMarkers = [];
    
    if (heatmapLayer) {
        map.removeLayer(heatmapLayer);
        heatmapLayer = null;
    }
    
    if (stations.length === 0) return;
    
    const bounds = L.latLngBounds(stations.map(s => [s.latitude, s.longitude]));
    map.fitBounds(bounds, { padding: [50, 50] });
    
    stations.forEach(station => {
        const color = getRiskColor(station.risk_level);
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="
                width: ${getMarkerSize(station.risk_score)}px;
                height: ${getMarkerSize(station.risk_score)}px;
                background: ${color};
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            "></div>`,
            iconSize: [getMarkerSize(station.risk_score), getMarkerSize(station.risk_score)],
            iconAnchor: [getMarkerSize(station.risk_score) / 2, getMarkerSize(station.risk_score) / 2]
        });
        
        const marker = L.marker([station.latitude, station.longitude], { icon })
            .addTo(map)
            .bindPopup(createStationPopup(station));
        
        stationMarkers.push(marker);
    });
    
    clusters.forEach(cluster => {
        const circle = L.circle([cluster.centroid.lat, cluster.centroid.lon], {
            color: '#9c27b0',
            fillColor: '#9c27b0',
            fillOpacity: 0.3,
            radius: 50 + cluster.size * 2
        }).addTo(map).bindPopup(`
            <div class="popup-title">车辆堆积群 ${cluster.id}</div>
            <div class="popup-info">
                <p><strong>车辆数:</strong> ${cluster.size}</p>
                <p><strong>靠近站点:</strong> ${cluster.is_near_station ? '是' : '否'}</p>
                <p><strong>风险等级:</strong> <span class="risk-badge ${cluster.risk_level.toLowerCase()}">${getRiskText(cluster.risk_level)}</span></p>
            </div>
        `);
        
        clusterMarkers.push(circle);
    });
}

function getRiskColor(riskLevel) {
    const colors = {
        'CRITICAL': '#f44336',
        'HIGH': '#ff9800',
        'MEDIUM': '#2196f3',
        'LOW': '#4caf50'
    };
    return colors[riskLevel] || '#999';
}

function getMarkerSize(riskScore) {
    return Math.min(40, 20 + riskScore / 10);
}

function getRiskText(riskLevel) {
    const texts = {
        'CRITICAL': '极高风险',
        'HIGH': '高风险',
        'MEDIUM': '中风险',
        'LOW': '低风险'
    };
    return texts[riskLevel] || riskLevel;
}

function getGapTypeText(gapType) {
    const texts = {
        'CRITICAL_OVERFLOW': '严重爆仓',
        'OVERFLOW': '爆仓',
        'NORMAL_HIGH': '偏高',
        'NORMAL': '正常',
        'LOW': '偏低',
        'CRITICAL_SHORTAGE': '严重缺车'
    };
    return texts[gapType] || gapType;
}

function createStationPopup(station) {
    return `
        <div class="popup-title">${station.station_name}</div>
        <div class="popup-info">
            <p><strong>风险等级:</strong> <span class="risk-badge ${station.risk_level.toLowerCase()}">${getRiskText(station.risk_level)}</span></p>
            <p><strong>供需状态:</strong> <span class="gap-badge ${station.gap_type}">${getGapTypeText(station.gap_type)}</span></p>
            <p><strong>当前车辆:</strong> ${station.total_available} / ${station.capacity}</p>
            <p><strong>利用率:</strong> ${(station.utilization_rate * 100).toFixed(1)}%</p>
            <p><strong>风险分数:</strong> ${station.risk_score}</p>
            ${station.abandoned_bikes_count > 0 ? 
                `<p><strong>遗弃车辆:</strong> ${station.abandoned_bikes_count} 辆</p>` : ''
            }
        </div>
        <div style="margin-top: 12px;">
            <a class="action-link" onclick="showStationDetail('${station.station_id}')">查看详情</a>
        </div>
    `;
}

function renderStationsTable(stations) {
    const tbody = document.getElementById('stationsTableBody');
    
    if (!stations || stations.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <p>📊 暂无数据</p>
                    <p class="text-muted">请先加载数据并运行分析</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = stations.map((station, index) => `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${station.station_name}</strong></td>
            <td><span class="risk-badge ${station.risk_level.toLowerCase()}">${getRiskText(station.risk_level)}</span></td>
            <td><span class="gap-badge ${station.gap_type}">${getGapTypeText(station.gap_type)}</span></td>
            <td>${station.total_available} / ${station.capacity}</td>
            <td>${(station.utilization_rate * 100).toFixed(1)}%</td>
            <td><strong>${station.risk_score}</strong></td>
            <td>${station.abandoned_bikes_count > 0 ? `<span style="color: #f44336;">${station.abandoned_bikes_count} 辆</span>` : '-'}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="showStationDetail('${station.station_id}')">详情</button>
            </td>
        </tr>
    `).join('');
}

function renderSuggestions(suggestions) {
    const container = document.getElementById('suggestionsContainer');
    
    if (!suggestions || suggestions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>💡 暂无调度建议</p>
                <p class="text-muted">请先加载数据并运行分析</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = suggestions.map((suggestion, index) => `
        <div class="suggestion-card ${suggestion.type}">
            <div class="suggestion-header">
                <div>
                    <div class="suggestion-title">${getSuggestionTitle(suggestion.type)}</div>
                    <div class="suggestion-meta">
                        <span class="risk-badge ${suggestion.priority.toLowerCase()}">${getRiskText(suggestion.priority)}</span>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.85rem; color: #999;">建议 #${index + 1}</div>
                </div>
            </div>
            <div class="suggestion-body">
                ${suggestion.reason}
            </div>
            ${renderSuggestionDetails(suggestion)}
            <div class="suggestion-actions">
                <button class="btn btn-sm btn-success" onclick="markSuggestionComplete(${index})">
                    ✅ 标记完成
                </button>
                <button class="btn btn-sm btn-secondary" onclick="focusOnMap(${suggestion})">
                    📍 地图定位
                </button>
            </div>
        </div>
    `).join('');
}

function getSuggestionTitle(type) {
    const titles = {
        'TRANSFER': '🔄 站点间调运',
        'SUPPLY': '🚛 车场补车',
        'REMOVE': '📦 移车入场',
        'ABANDONED': '🔍 遗弃车辆回收'
    };
    return titles[type] || type;
}

function renderSuggestionDetails(suggestion) {
    let detailsHtml = '<div class="suggestion-details">';
    
    switch (suggestion.type) {
        case 'TRANSFER':
            detailsHtml += `
                <div class="detail-item">
                    <span class="detail-label">从站点</span>
                    <span class="detail-value">${suggestion.from_station.name}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">到站点</span>
                    <span class="detail-value">${suggestion.to_station.name}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">调运数量</span>
                    <span class="detail-value">${suggestion.bikes_to_transfer} 辆</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">预计距离</span>
                    <span class="detail-value">${suggestion.estimated_distance} 米</span>
                </div>
            `;
            break;
        case 'SUPPLY':
            detailsHtml += `
                <div class="detail-item">
                    <span class="detail-label">目标站点</span>
                    <span class="detail-value">${suggestion.station.name}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">需补车辆</span>
                    <span class="detail-value">${suggestion.bikes_needed} 辆</span>
                </div>
            `;
            break;
        case 'REMOVE':
            detailsHtml += `
                <div class="detail-item">
                    <span class="detail-label">源站点</span>
                    <span class="detail-value">${suggestion.station.name}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">需移车辆</span>
                    <span class="detail-value">${suggestion.bikes_to_remove} 辆</span>
                </div>
            `;
            break;
        case 'ABANDONED':
            detailsHtml += `
                <div class="detail-item">
                    <span class="detail-label">附近站点</span>
                    <span class="detail-value">${suggestion.station.name}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">遗弃车辆</span>
                    <span class="detail-value">${suggestion.abandoned_bikes.length} 辆</span>
                </div>
            `;
            break;
    }
    
    detailsHtml += '</div>';
    return detailsHtml;
}

function renderTimeChart(timeSeries) {
    const ctx = document.getElementById('timeChart').getContext('2d');
    
    if (timeChart) {
        timeChart.destroy();
    }
    
    if (!timeSeries || timeSeries.length === 0) {
        return;
    }
    
    const labels = timeSeries.map(t => {
        const date = new Date(t.window_start);
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    });
    
    timeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'GPS记录数',
                    data: timeSeries.map(t => t.bike_count),
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: '唯一车辆数',
                    data: timeSeries.map(t => t.unique_bikes),
                    borderColor: '#764ba2',
                    backgroundColor: 'rgba(118, 75, 162, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                },
                title: {
                    display: true,
                    text: '车辆数量时间趋势'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

async function markSuggestionComplete(index) {
    const operator = prompt('请输入操作员姓名:', '调度员');
    if (operator === null) return;
    
    const notes = prompt('备注信息 (可选):');
    
    try {
        const response = await fetch(`${API_BASE}/api/dispatch/mark`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                suggestionIndex: index,
                operator: operator || '调度员',
                notes: notes || ''
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('调度任务已标记完成', 'success');
        } else {
            showToast(data.message, 'error');
        }
    } catch (e) {
        showToast('标记失败: ' + e.message, 'error');
    }
}

function showStationDetail(stationId) {
    if (!analysisData) return;
    
    const station = analysisData.stations.find(s => s.station_id === stationId);
    if (!station) return;
    
    const modalBody = document.getElementById('stationDetailBody');
    
    modalBody.innerHTML = `
        <div class="station-detail-grid">
            <div class="detail-card">
                <h5>站点名称</h5>
                <div class="value">${station.station_name}</div>
            </div>
            <div class="detail-card">
                <h5>风险等级</h5>
                <div class="value">
                    <span class="risk-badge ${station.risk_level.toLowerCase()}">${getRiskText(station.risk_level)}</span>
                </div>
            </div>
            <div class="detail-card">
                <h5>供需状态</h5>
                <div class="value">
                    <span class="gap-badge ${station.gap_type}">${getGapTypeText(station.gap_type)}</span>
                </div>
            </div>
            <div class="detail-card">
                <h5>风险分数</h5>
                <div class="value">${station.risk_score}</div>
            </div>
            <div class="detail-card">
                <h5>当前车辆</h5>
                <div class="value">${station.total_available} 辆</div>
            </div>
            <div class="detail-card">
                <h5>站点容量</h5>
                <div class="value">${station.capacity} 辆</div>
            </div>
            <div class="detail-card">
                <h5>利用率</h5>
                <div class="value">${(station.utilization_rate * 100).toFixed(1)}%</div>
            </div>
            <div class="detail-card">
                <h5>疑似遗弃车辆</h5>
                <div class="value">${station.abandoned_bikes_count} 辆</div>
            </div>
        </div>
        
        ${station.abandoned_bikes && station.abandoned_bikes.length > 0 ? `
            <h4 style="margin-top: 20px;">疑似遗弃车辆列表</h4>
            <div class="abandoned-list">
                ${station.abandoned_bikes.map(bike => `
                    <div class="abandoned-item">
                        <span><strong>${bike.bike_id}</strong></span>
                        <span>闲置 ${bike.idle_hours} 小时</span>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
    
    openModal('stationDetailModal');
}

function switchView(view) {
    currentView = view;
    
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    
    const mapContainer = document.querySelector('.map-container');
    const chartContainer = document.getElementById('chartContainer');
    
    if (view === 'chart') {
        mapContainer.style.display = 'none';
        chartContainer.style.display = 'block';
        if (timeChart) {
            timeChart.resize();
        }
    } else {
        mapContainer.style.display = 'block';
        chartContainer.style.display = 'none';
        
        if (view === 'heatmap') {
            showHeatmap();
        } else {
            hideHeatmap();
        }
    }
}

function showHeatmap() {
    if (!analysisData || !analysisData.stations) return;
    
    if (heatmapLayer) {
        map.removeLayer(heatmapLayer);
    }
    
    const heatData = analysisData.stations.map(station => [
        station.latitude,
        station.longitude,
        station.risk_score / 200
    ]);
    
    heatmapLayer = L.heatLayer(heatData, {
        radius: 50,
        blur: 35,
        maxZoom: 15
    }).addTo(map);
}

function hideHeatmap() {
    if (heatmapLayer) {
        map.removeLayer(heatmapLayer);
        heatmapLayer = null;
    }
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    document.getElementById(`panel-${tab}`).classList.add('active');
    
    if (tab === 'map' && map) {
        setTimeout(() => map.invalidateSize(), 100);
    }
}

function applyFilters() {
    if (!analysisData) return;
    
    const riskLevel = document.getElementById('riskLevelFilter').value;
    const gapType = document.getElementById('gapTypeFilter').value;
    
    let filteredStations = [...analysisData.stations];
    
    if (riskLevel) {
        filteredStations = filteredStations.filter(s => s.risk_level === riskLevel);
    }
    if (gapType) {
        filteredStations = filteredStations.filter(s => s.gap_type === gapType);
    }
    
    renderStationsTable(filteredStations);
    updateMapMarkers(filteredStations);
}

function updateMapMarkers(filteredStations) {
    const filteredIds = new Set(filteredStations.map(s => s.station_id));
    
    stationMarkers.forEach((marker, index) => {
        const station = analysisData.stations[index];
        if (station) {
            const shouldShow = filteredIds.has(station.station_id);
            if (shouldShow) {
                marker.addTo(map);
            } else {
                map.removeLayer(marker);
            }
        }
    });
}

async function exportReport() {
    if (!analysisData) {
        showToast('请先运行分析', 'error');
        return;
    }
    
    const operator = prompt('请输入操作员姓名:', '系统自动生成');
    if (operator === null) return;
    
    showToast('正在生成报告...', 'info');
    
    try {
        const response = await fetch(`${API_BASE}/api/export/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operator: operator || '系统自动生成' })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`报告已生成: ${data.data.filename}`, 'success');
        } else {
            showToast(data.message, 'error');
        }
    } catch (e) {
        showToast('导出失败: ' + e.message, 'error');
    }
}

async function exportDispatch() {
    if (!analysisData) {
        showToast('请先运行分析', 'error');
        return;
    }
    
    showToast('正在生成调拨单...', 'info');
    
    try {
        const response = await fetch(`${API_BASE}/api/export/dispatch`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`调拨单已生成: ${data.data.filename}`, 'success');
        } else {
            showToast(data.message, 'error');
        }
    } catch (e) {
        showToast('导出失败: ' + e.message, 'error');
    }
}

function updateStatus(text, state) {
    document.getElementById('statusText').textContent = text;
    const dot = document.querySelector('.status-dot');
    
    dot.classList.remove('ready', 'analyzing');
    if (state === 'ready') {
        dot.classList.add('ready');
    } else if (state === 'analyzing') {
        dot.classList.add('analyzing');
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    
    toastMessage.textContent = message;
    toast.className = `toast ${type}`;
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showHelp() {
    openModal('helpModal');
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});
