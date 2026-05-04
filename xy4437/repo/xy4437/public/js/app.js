const API_BASE = '';
let currentData = {
    points: [],
    stats: {},
    conflicts: [],
    schedules: []
};

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
}

async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        return await response.json();
    } catch (error) {
        console.error('API请求失败:', error);
        showToast('网络请求失败，请检查服务器是否运行', 'error');
        throw error;
    }
}

async function uploadFile(endpoint, fileElementId) {
    const fileInput = document.getElementById(fileElementId);
    const file = fileInput.files[0];
    
    if (!file) {
        showToast('请选择文件', 'warning');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(`成功导入 ${result.count} 条记录`, 'success');
            await refreshData();
            return true;
        } else {
            showToast(result.error || '导入失败', 'error');
            return false;
        }
    } catch (error) {
        console.error('上传失败:', error);
        showToast('上传失败', 'error');
        return false;
    }
}

async function refreshData() {
    try {
        const [pointsRes, statsRes, conflictsRes] = await Promise.all([
            fetchAPI('/api/points'),
            fetchAPI('/api/stats'),
            fetchAPI('/api/volunteer-conflicts')
        ]);
        
        if (pointsRes.success) {
            currentData.points = pointsRes.data;
            currentData.stats = pointsRes.stats;
            renderPoints();
            renderStats();
            renderAlerts();
        }
        
        if (statsRes.success && statsRes.data) {
            currentData.schedules = statsRes.data;
        }
        
        if (conflictsRes.success) {
            currentData.conflicts = conflictsRes.data;
            renderConflicts();
            document.getElementById('stat-conflicts').textContent = conflictsRes.count;
        }
        
        updateImportStatus();
        
    } catch (error) {
        console.error('刷新数据失败:', error);
    }
}

function updateImportStatus() {
    const stats = {
        waterPoints: currentData.points.length,
        inspections: currentData.schedules?.totalInspections || 0,
        deliveries: currentData.schedules?.totalDeliveries || 0,
        volunteers: currentData.schedules?.totalVolunteers || 0
    };
    
    const updateStatus = (elementId, count) => {
        const el = document.getElementById(elementId);
        if (count > 0) {
            el.textContent = `已导入 ${count} 条`;
            el.className = 'import-status success';
        } else {
            el.textContent = '未导入';
            el.className = 'import-status';
        }
    };
    
    updateStatus('water-points-status', stats.waterPoints);
    updateStatus('inspections-status', stats.inspections);
    updateStatus('deliveries-status', stats.deliveries);
    updateStatus('volunteers-status', stats.volunteers);
}

function renderStats() {
    document.getElementById('stat-green').textContent = currentData.stats.green || 0;
    document.getElementById('stat-yellow').textContent = currentData.stats.yellow || 0;
    document.getElementById('stat-red').textContent = currentData.stats.red || 0;
}

function renderAlerts() {
    const alertsList = document.getElementById('alerts-list');
    const redPoints = currentData.points.filter(p => p.riskAssessment.status === 'red');
    const yellowPoints = currentData.points.filter(p => p.riskAssessment.status === 'yellow');
    
    if (redPoints.length === 0 && yellowPoints.length === 0) {
        alertsList.innerHTML = '<p class="empty-state">暂无警告</p>';
        return;
    }
    
    let html = '';
    
    redPoints.slice(0, 5).forEach(point => {
        const mainRisk = point.riskAssessment.risks.find(r => r.severity === 'red') || 
                         point.riskAssessment.risks[0];
        html += `
            <div class="alert-item red" onclick="showPointDetail('${point.id}')">
                <div class="alert-icon">🔴</div>
                <div class="alert-content">
                    <div class="alert-point">${point.name}${point.isPriority ? ' (重点人群)' : ''}</div>
                    <div class="alert-message">${mainRisk ? mainRisk.message : '存在风险'}</div>
                </div>
            </div>
        `;
    });
    
    yellowPoints.slice(0, 3).forEach(point => {
        const mainRisk = point.riskAssessment.risks.find(r => r.severity === 'yellow') || 
                         point.riskAssessment.risks[0];
        html += `
            <div class="alert-item yellow" onclick="showPointDetail('${point.id}')">
                <div class="alert-icon">🟡</div>
                <div class="alert-content">
                    <div class="alert-point">${point.name}</div>
                    <div class="alert-message">${mainRisk ? mainRisk.message : '需要关注'}</div>
                </div>
            </div>
        `;
    });
    
    alertsList.innerHTML = html;
}

function renderPoints() {
    const pointsList = document.getElementById('points-list');
    const statusFilter = document.getElementById('status-filter').value;
    const priorityFilter = document.getElementById('priority-filter').value;
    const searchQuery = document.getElementById('search-input').value.toLowerCase();
    
    let filteredPoints = currentData.points.filter(point => {
        if (statusFilter !== 'all' && point.riskAssessment.status !== statusFilter) {
            return false;
        }
        if (priorityFilter !== 'all') {
            const isPriority = point.isPriority === true || point.isPriority === 'true';
            if (priorityFilter === 'true' && !isPriority) return false;
            if (priorityFilter === 'false' && isPriority) return false;
        }
        if (searchQuery && !point.name.toLowerCase().includes(searchQuery) && 
            !point.address?.toLowerCase().includes(searchQuery)) {
            return false;
        }
        return true;
    });
    
    if (filteredPoints.length === 0) {
        if (currentData.points.length === 0) {
            pointsList.innerHTML = '<p class="empty-state">暂无点位数据，请先导入临时饮水点台账</p>';
        } else {
            pointsList.innerHTML = '<p class="empty-state">没有符合筛选条件的点位</p>';
        }
        return;
    }
    
    filteredPoints.sort((a, b) => {
        const priority = { red: 0, yellow: 1, green: 2 };
        return priority[a.riskAssessment.status] - priority[b.riskAssessment.status];
    });
    
    let html = '';
    filteredPoints.forEach(point => {
        const status = point.riskAssessment.status;
        const statusLabel = { green: '正常', yellow: '警告', red: '风险' }[status];
        const statusIcon = { green: '🟢', yellow: '🟡', red: '🔴' }[status];
        
        html += `
            <div class="point-card ${status}">
                <div class="point-header">
                    <div class="point-name">
                        ${statusIcon} ${point.name}
                        ${point.isPriority ? '<span class="priority-badge">重点人群</span>' : ''}
                    </div>
                    <span class="status-badge ${status}">${statusLabel}</span>
                </div>
                ${point.address ? `<div class="point-address">📍 ${point.address}</div>` : ''}
                
                ${point.riskAssessment.risks.length > 0 ? `
                    <div class="risks-list">
                        ${point.riskAssessment.risks.map(risk => `
                            <div class="risk-item ${risk.severity}">
                                ${risk.severity === 'red' ? '⚠️' : 'ℹ️'} ${risk.message}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                <div class="point-actions">
                    <button onclick="showPointDetail('${point.id}')" class="btn btn-secondary btn-sm">
                        📋 详情
                    </button>
                    <button onclick="openOverrideModal('${point.id}', '${status}')" class="btn btn-warning btn-sm">
                        ✏️ 改判
                    </button>
                    <button onclick="openNoteModal('${point.id}')" class="btn btn-info btn-sm">
                        💬 备注
                    </button>
                </div>
            </div>
        `;
    });
    
    pointsList.innerHTML = html;
}

function renderConflicts() {
    const conflictsList = document.getElementById('conflicts-list');
    const schedulesList = document.getElementById('schedules-list');
    
    if (currentData.conflicts.length === 0) {
        conflictsList.innerHTML = '<p class="empty-state">暂无排班冲突</p>';
    } else {
        let html = '';
        currentData.conflicts.forEach((conflict, index) => {
            html += `
                <div class="conflict-item">
                    <div class="conflict-header">
                        ⚠️ 冲突 ${index + 1}: ${conflict.volunteerName}
                    </div>
                    <div class="conflict-times">
                        <div class="conflict-time">
                            <strong>${conflict.conflict1.pointName}</strong><br>
                            ${conflict.conflict1.startTime} - ${conflict.conflict1.endTime}
                        </div>
                        <div class="conflict-time">
                            <strong>${conflict.conflict2.pointName}</strong><br>
                            ${conflict.conflict2.startTime} - ${conflict.conflict2.endTime}
                        </div>
                    </div>
                </div>
            `;
        });
        conflictsList.innerHTML = html;
    }
    
    const schedules = [];
    const scheduleMap = new Map();
    
    currentData.points.forEach(point => {
        const pointSchedules = [];
        if (Array.isArray(appState?.volunteerSchedules)) {
            appState.volunteerSchedules.forEach(s => {
                if (s.pointId === point.id || s.pointName === point.name) {
                    pointSchedules.push(s);
                }
            });
        }
        if (pointSchedules.length > 0) {
            scheduleMap.set(point.id, { point, schedules: pointSchedules });
        }
    });
    
    if (scheduleMap.size === 0) {
        schedulesList.innerHTML = '<p class="empty-state">暂无排班数据</p>';
    } else {
        let html = '';
        scheduleMap.forEach(({ point, schedules }) => {
            schedules.forEach(schedule => {
                html += `
                    <div class="schedule-item">
                        <div class="schedule-header">
                            <span class="schedule-name">${schedule.volunteerName || '未命名'}</span>
                            <span class="schedule-time">${schedule.startTime || ''} - ${schedule.endTime || ''}</span>
                        </div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary);">
                            📍 ${point.name} ${schedule.role ? `| 角色: ${schedule.role}` : ''}
                        </div>
                    </div>
                `;
            });
        });
        schedulesList.innerHTML = html;
    }
}

async function showPointDetail(pointId) {
    try {
        const result = await fetchAPI(`/api/points/${pointId}`);
        
        if (!result.success) {
            showToast('获取点位详情失败', 'error');
            return;
        }
        
        const point = result.data;
        const modal = document.getElementById('point-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        const status = point.riskAssessment.status;
        const statusLabel = { green: '正常', yellow: '警告', red: '风险' }[status];
        const statusIcon = { green: '🟢', yellow: '🟡', red: '🔴' }[status];
        
        modalTitle.textContent = `${statusIcon} ${point.name} - 详情`;
        
        let html = `
            <div class="detail-section">
                <h4>📋 基本信息</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">状态</div>
                        <div class="detail-value"><span class="status-badge ${status}">${statusLabel}</span></div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">地址</div>
                        <div class="detail-value">${point.address || '未填写'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">重点人群点位</div>
                        <div class="detail-value">${point.isPriority ? '是' : '否'}</div>
                    </div>
                    ${point.capacity ? `
                    <div class="detail-item">
                        <div class="detail-label">容量</div>
                        <div class="detail-value">${point.capacity} L</div>
                    </div>
                    ` : ''}
                    ${point.contactPerson ? `
                    <div class="detail-item">
                        <div class="detail-label">联系人</div>
                        <div class="detail-value">${point.contactPerson}</div>
                    </div>
                    ` : ''}
                    ${point.contactPhone ? `
                    <div class="detail-item">
                        <div class="detail-label">联系电话</div>
                        <div class="detail-value">${point.contactPhone}</div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        html += `
            <div class="detail-section">
                <h4>⚠️ 风险评估</h4>
                ${point.riskAssessment.risks.length > 0 ? `
                    <div class="risks-list">
                        ${point.riskAssessment.risks.map(risk => `
                            <div class="risk-item ${risk.severity}">
                                ${risk.severity === 'red' ? '🔴' : '🟡'} ${risk.message}
                            </div>
                        `).join('')}
                    </div>
                ` : '<p style="color: var(--text-secondary);">暂无风险</p>'}
            </div>
        `;
        
        if (point.inspections && point.inspections.length > 0) {
            html += `
                <div class="detail-section">
                    <h4>🧪 检测记录</h4>
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>检测时间</th>
                                    <th>余氯 (mg/L)</th>
                                    <th>浊度 (NTU)</th>
                                    <th>检测员</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${point.inspections.slice(-5).reverse().map(inspection => `
                                    <tr>
                                        <td>${inspection.inspectionTime || '-'}</td>
                                        <td>${inspection.residualChlorine || '-'}</td>
                                        <td>${inspection.turbidity || '-'}</td>
                                        <td>${inspection.inspector || '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }
        
        if (point.deliveries && point.deliveries.length > 0) {
            html += `
                <div class="detail-section">
                    <h4>🚛 送水记录</h4>
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>配送时间</th>
                                    <th>车牌号</th>
                                    <th>水量 (L)</th>
                                    <th>司机</th>
                                    <th>优先级</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${point.deliveries.slice(-5).reverse().map(delivery => `
                                    <tr>
                                        <td>${delivery.deliveryTime || '-'}</td>
                                        <td>${delivery.vehicleNumber || '-'}</td>
                                        <td>${delivery.volume || '-'}</td>
                                        <td>${delivery.driver || '-'}</td>
                                        <td>${delivery.isPriority ? '重点' : '普通'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }
        
        if (point.notes && point.notes.length > 0) {
            html += `
                <div class="detail-section">
                    <h4>💬 值班备注</h4>
                    ${point.notes.map(note => `
                        <div class="note-item">
                            <div class="note-header">
                                <span>${note.createdBy || '值班员'}</span>
                                <span>${new Date(note.createdAt).toLocaleString('zh-CN')}</span>
                            </div>
                            <div class="note-content">${note.content}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        if (point.overrides && point.overrides.length > 0) {
            html += `
                <div class="detail-section">
                    <h4>📝 改判历史</h4>
                    <div class="override-history">
                        ${point.overrides.map(override => `
                            <div class="override-item">
                                <div class="status-change">
                                    ${getStatusLabel(override.originalStatus)} → ${getStatusLabel(override.overrideStatus)}
                                    ${override.isActive ? '(当前生效)' : ''}
                                </div>
                                <div class="reason">原因: ${override.reason}</div>
                                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">
                                    ${override.createdBy || '值班员'} | ${new Date(override.createdAt).toLocaleString('zh-CN')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        modalBody.innerHTML = html;
        modal.classList.add('active');
        
    } catch (error) {
        console.error('获取点位详情失败:', error);
    }
}

function getStatusLabel(status) {
    const labels = { green: '🟢 正常', yellow: '🟡 警告', red: '🔴 风险' };
    return labels[status] || status;
}

function closeModal() {
    document.getElementById('point-modal').classList.remove('active');
}

function openOverrideModal(pointId, originalStatus) {
    document.getElementById('override-point-id').value = pointId;
    document.getElementById('override-original-status').value = originalStatus;
    document.getElementById('override-original-display').innerHTML = 
        `<span class="status-badge ${originalStatus}">${getStatusLabel(originalStatus)}</span>`;
    document.getElementById('override-new-status').value = originalStatus;
    document.getElementById('override-reason').value = '';
    document.getElementById('override-operator').value = '';
    
    document.getElementById('override-modal').classList.add('active');
}

function closeOverrideModal() {
    document.getElementById('override-modal').classList.remove('active');
}

async function submitOverride() {
    const pointId = document.getElementById('override-point-id').value;
    const originalStatus = document.getElementById('override-original-status').value;
    const overrideStatus = document.getElementById('override-new-status').value;
    const reason = document.getElementById('override-reason').value;
    const operator = document.getElementById('override-operator').value;
    
    if (!reason.trim()) {
        showToast('请输入改判原因', 'warning');
        return;
    }
    
    try {
        const result = await fetchAPI('/api/overrides', {
            method: 'POST',
            body: JSON.stringify({
                pointId,
                originalStatus,
                overrideStatus,
                reason,
                createdBy: operator || '值班员'
            })
        });
        
        if (result.success) {
            showToast('改判成功', 'success');
            closeOverrideModal();
            await refreshData();
        } else {
            showToast(result.error || '改判失败', 'error');
        }
    } catch (error) {
        console.error('提交改判失败:', error);
        showToast('提交失败', 'error');
    }
}

function openNoteModal(pointId) {
    document.getElementById('note-point-id').value = pointId;
    document.getElementById('note-content').value = '';
    document.getElementById('note-operator').value = '';
    
    document.getElementById('note-modal').classList.add('active');
}

function closeNoteModal() {
    document.getElementById('note-modal').classList.remove('active');
}

async function submitNote() {
    const pointId = document.getElementById('note-point-id').value;
    const content = document.getElementById('note-content').value;
    const operator = document.getElementById('note-operator').value;
    
    if (!content.trim()) {
        showToast('请输入备注内容', 'warning');
        return;
    }
    
    try {
        const result = await fetchAPI('/api/notes', {
            method: 'POST',
            body: JSON.stringify({
                pointId,
                content,
                createdBy: operator || '值班员'
            })
        });
        
        if (result.success) {
            showToast('备注保存成功', 'success');
            closeNoteModal();
            await refreshData();
        } else {
            showToast(result.error || '保存失败', 'error');
        }
    } catch (error) {
        console.error('提交备注失败:', error);
        showToast('提交失败', 'error');
    }
}

async function clearAllData() {
    if (!confirm('确定要清除所有数据吗？此操作不可恢复！')) {
        return;
    }
    
    try {
        const result = await fetchAPI('/api/data', {
            method: 'DELETE'
        });
        
        if (result.success) {
            showToast('数据已清除', 'success');
            await refreshData();
        } else {
            showToast('清除失败', 'error');
        }
    } catch (error) {
        console.error('清除数据失败:', error);
        showToast('清除失败', 'error');
    }
}

function exportMarkdown() {
    window.location.href = `${API_BASE}/api/export/markdown`;
    showToast('正在导出交接单...', 'info');
}

function exportJSON() {
    window.location.href = `${API_BASE}/api/export/json`;
    showToast('正在导出审计包...', 'info');
}

async function previewExport() {
    try {
        const response = await fetch(`${API_BASE}/api/export/markdown`);
        const content = await response.text();
        
        const previewContainer = document.getElementById('preview-container');
        const previewContent = document.getElementById('preview-content');
        
        previewContent.textContent = content;
        previewContainer.style.display = 'block';
        
    } catch (error) {
        console.error('预览失败:', error);
        showToast('预览失败', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showTab(btn.dataset.tab);
        });
    });
    
    document.getElementById('water-points-file').addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            await uploadFile('/api/upload/water-points', 'water-points-file');
            e.target.value = '';
        }
    });
    
    document.getElementById('inspections-file').addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            await uploadFile('/api/upload/inspections', 'inspections-file');
            e.target.value = '';
        }
    });
    
    document.getElementById('deliveries-file').addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            await uploadFile('/api/upload/water-deliveries', 'deliveries-file');
            e.target.value = '';
        }
    });
    
    document.getElementById('volunteers-file').addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            await uploadFile('/api/upload/volunteer-schedules', 'volunteers-file');
            e.target.value = '';
        }
    });
    
    document.getElementById('status-filter').addEventListener('change', renderPoints);
    document.getElementById('priority-filter').addEventListener('change', renderPoints);
    document.getElementById('search-input').addEventListener('input', renderPoints);
    
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });
    
    refreshData();
});
