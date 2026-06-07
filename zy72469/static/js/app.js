let currentStep = 1;
let currentUser = 'grid_inspector';
let currentConflictId = null;

const roleNames = {
    'grid_inspector': '网格员',
    'project_manager': '城更项目经理（阿宁）',
    'street_planner': '街道规划员'
};

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('roleSelector').addEventListener('change', function(e) {
        currentUser = e.target.value;
        document.getElementById('currentUser').textContent = roleNames[currentUser];
    });
    
    refreshAll();
});

function goToStep(step) {
    currentStep = step;
    
    document.querySelectorAll('.workflow-steps .step').forEach(s => {
        s.classList.remove('active');
        if (parseInt(s.dataset.step) <= step) {
            s.classList.add('active');
        }
    });
    
    document.querySelectorAll('.step-panel').forEach(p => {
        p.classList.remove('active');
    });
    document.getElementById(`step${step}`).classList.add('active');
    
    if (step === 1) refreshInspections();
    if (step === 2) refreshNotices();
    if (step === 3) refreshHeatmap();
}

async function apiCall(url, method = 'GET', data = null) {
    const options = { method, headers: {} };
    if (data) {
        if (data instanceof FormData) {
            options.body = data;
        } else {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(data);
        }
    }
    const res = await fetch(url, options);
    return res.json();
}

async function loadSample(dataType, sampleType) {
    const result = await apiCall('/api/import/load_sample', 'POST', {
        sample_type: sampleType,
        data_type: dataType,
        operator: roleNames[currentUser]
    });
    
    if (result.error) {
        alert('加载失败: ' + result.error);
    } else {
        alert(`加载成功！成功导入 ${result.success_count} 条，重复 ${result.duplicate_count} 条\n${result.message || ''}`);
        refreshAll();
    }
}

async function uploadFile() {
    const fileInput = document.getElementById('fileInput');
    const importType = document.getElementById('importType').value;
    
    if (!fileInput.files[0]) {
        alert('请选择文件');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('data_type', 'inspection');
    formData.append('import_type', importType);
    formData.append('operator', roleNames[currentUser]);
    
    const result = await apiCall('/api/upload', 'POST', formData);
    
    if (result.error) {
        alert('上传失败: ' + result.error);
    } else {
        alert(`导入成功！成功 ${result.success_count} 条，重复 ${result.duplicate_count} 条`);
        refreshInspections();
    }
}

async function uploadNotice() {
    const fileInput = document.getElementById('noticeFileInput');
    
    if (!fileInput.files[0]) {
        alert('请选择文件');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('data_type', 'notice');
    formData.append('import_type', 'normal');
    formData.append('operator', roleNames[currentUser]);
    
    const result = await apiCall('/api/upload', 'POST', formData);
    
    if (result.error) {
        alert('上传失败: ' + result.error);
    } else {
        alert(`导入成功！成功 ${result.success_count} 条，重复 ${result.duplicate_count} 条`);
        refreshNotices();
    }
}

async function refreshInspections() {
    const [inspections, history] = await Promise.all([
        apiCall('/api/inspections'),
        apiCall('/api/import/history')
    ]);
    
    document.getElementById('inspectionCount').textContent = inspections.length;
    
    const tbody = document.querySelector('#inspectionTable tbody');
    tbody.innerHTML = inspections.slice(0, 20).map(i => `
        <tr>
            <td>${i.inspector_name}</td>
            <td>${i.inspection_date}</td>
            <td>${i.location}</td>
            <td>${i.passable ? '是' : '否'}</td>
            <td title="${i.remarks}">${i.remarks ? (i.remarks.length > 20 ? i.remarks.substring(0, 20) + '...' : i.remarks : '-'}</td>
            <td>${i.data_type}</td>
        </tr>
    `).join('');
    
    const historyBody = document.querySelector('#importHistoryTable tbody');
    historyBody.innerHTML = history.slice(0, 10).map(h => `
        <tr>
            <td>${h.file_name}</td>
            <td>${h.data_type}</td>
            <td>${h.record_count}</td>
            <td>${h.success_count}</td>
            <td>${h.duplicate_count}</td>
            <td>${h.status}</td>
        </tr>
    `).join('');
}

async function refreshNotices() {
    const [notices, stats] = await Promise.all([
        apiCall('/api/notices'),
        apiCall('/api/conflicts/stats')
    ]);
    
    document.getElementById('noticeCount').textContent = notices.length;
    
    const tbody = document.querySelector('#noticeTable tbody');
    tbody.innerHTML = notices.slice(0, 20).map(n => `
        <tr>
            <td>${n.project_name}</td>
            <td>${n.location}</td>
            <td>${n.start_date} ~ ${n.end_date}</td>
            <td>${n.road_closure ? '是' : '否'}</td>
            <td title="${n.remarks}">${n.remarks ? (n.remarks.length > 20 ? n.remarks.substring(0, 20) + '...' : n.remarks : '-'}</td>
        </tr>
    `).join('');
    
    updateConflictStats(stats);
    refreshConflicts();
}

function updateConflictStats(stats) {
    document.getElementById('totalConflicts').textContent = stats.total;
    document.getElementById('pendingConflicts').textContent = stats.pending;
    document.getElementById('resolvedConflicts').textContent = stats.resolved;
    document.getElementById('rejectedConflicts').textContent = stats.rejected;
}

async function refreshConflicts() {
    const conflicts = await apiCall('/api/conflicts');
    const container = document.getElementById('conflictContainer');
    
    if (conflicts.length === 0) {
        container.innerHTML = '<p class="empty-hint">暂无冲突记录，点击"检测冲突"按钮开始检测</p>';
        return;
    }
    
    container.innerHTML = conflicts.map(c => `
        <div class="conflict-item ${c.status}">
            <div class="conflict-header">
                <span class="conflict-type">${c.conflict_type === 'passable' ? '通行状态冲突' : '路况描述冲突'}</span>
                <span class="conflict-status ${c.status}">${
                    c.status === 'pending' ? '待处理' : c.status === 'resolved' ? '已确认' : '已驳回'
                }</span>
            </div>
            <div class="conflict-desc">${c.description}</div>
            <div class="conflict-evidence">
                <strong>📍 地点：</strong>${c.location}<br>
                <strong>📋 巡查记录：</strong>${c.inspection_data.inspector_name || ''} - ${c.inspection_data.road_condition || ''}<br>
                <strong>🏗️ 施工告示：</strong>${c.notice_data.project_name || ''} - ${c.notice_data.construction_type || ''}
                ${c.notice_data.remarks ? `<br><strong>📝 告示备注：</strong>${c.notice_data.remarks}` : ''}
            </div>
            ${c.status === 'pending' ? `
            <div class="conflict-actions">
                <button class="btn btn-success" onclick="showResolveModal('${c.id}')">✓ 确认冲突</button>
                <button class="btn btn-danger" onclick="rejectConflict('${c.id}')">✗ 驳回</button>
            </div>
            ` : `
            <div style="font-size: 13px; color: #718096;">
                处理人：${c.resolved_by || '-'} | ${c.resolution || ''}
            </div>
            `}
        </div>
    `).join('');
}

async function detectConflicts() {
    const result = await apiCall('/api/conflicts/detect', 'POST', {});
    alert(`检测完成！新发现 ${result.new_count} 个冲突`);
    const stats = await apiCall('/api/conflicts/stats');
    updateConflictStats(stats);
    refreshConflicts();
}

function showResolveModal(conflictId) {
    currentConflictId = conflictId;
    document.getElementById('modalBody').innerHTML = `
        <h3>确认冲突处理</h3>
        <p>请输入确认说明（将作为历史记录留存）：</p>
        <textarea class="resolution-input" id="resolutionInput" placeholder="例如：已现场核实，确实施工封路，以施工告示为准..."></textarea>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            <button class="btn btn-success" onclick="confirmResolve()">确认提交</button>
        </div>
    `;
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    currentConflictId = null;
}

async function confirmResolve() {
    const resolution = document.getElementById('resolutionInput').value;
    const result = await apiCall(`/api/conflicts/${currentConflictId}/resolve`, 'POST', {
        resolution: resolution,
        resolved_by: roleNames[currentUser]
    });
    
    if (result.error) {
        alert('操作失败: ' + result.error);
    } else {
        alert('已确认冲突');
        closeModal();
        refreshConflicts();
        const stats = await apiCall('/api/conflicts/stats');
        updateConflictStats(stats);
    }
}

async function rejectConflict(conflictId) {
    if (!confirm('确定要驳回此冲突吗？')) return;
    
    const result = await apiCall(`/api/conflicts/${conflictId}/reject`, 'POST', {
        resolved_by: roleNames[currentUser]
    });
    
    if (result.error) {
        alert('操作失败: ' + result.error);
    } else {
        alert('已驳回冲突');
        refreshConflicts();
        const stats = await apiCall('/api/conflicts/stats');
        updateConflictStats(stats);
    }
}

async function generateHeatmap() {
    const result = await apiCall('/api/heatmap/generate', 'POST', {});
    renderHeatmap(result);
    const stats = await apiCall('/api/heatmap/stats');
    updateHeatmapStats(stats);
}

function updateHeatmapStats(stats) {
    document.getElementById('totalGrids').textContent = stats.total_grids;
    document.getElementById('needsReview').textContent = stats.needs_review;
    document.getElementById('eveningGap').textContent = stats.has_evening_gap;
    document.getElementById('reviewed').textContent = stats.reviewed;
}

function renderHeatmap(result) {
    const container = document.getElementById('heatmapContainer');
    const gridData = result.grid_data;
    
    if (!gridData || gridData.length === 0) {
        container.innerHTML = '<p class="empty-hint">暂无热力图数据</p>';
        return;
    }
    
    const maxX = Math.max(...gridData.map(d => d.grid_x)) + 1;
    const maxY = Math.max(...gridData.map(d => d.grid_y)) + 1;
    const maxWeight = Math.max(...gridData.map(d => d.weight), 1);
    
    const gridMap = {};
    gridData.forEach(d => {
        gridMap[`${d.grid_x},${d.grid_y}`] = d;
    });
    
    let html = `<div class="heatmap-grid" style="grid-template-columns: repeat(${maxX}, 1fr); grid-template-rows: repeat(${maxY}, 1fr);">`;
    
    for (let y = 0; y < maxY; y++) {
        for (let x = 0; x < maxX; x++) {
            const cell = gridMap[`${x},${y}`];
            if (cell) {
                const intensity = cell.weight / maxWeight;
                const r = Math.round(76 + (252 - 76) * intensity);
                const g = Math.round(246 + (129 - 246) * intensity);
                const b = Math.round(213 + (129 - 213) * intensity);
                const needsReviewClass = cell.needs_review ? 'needs-review' : '';
                const title = `权重: ${cell.weight.toFixed(2)}\n样本: ${cell.sample_count}\n晚间缺口: ${cell.has_evening_gap ? '是' : '否'}\n需复核: ${cell.needs_review ? '是' : '否'}`;
                html += `<div class="heatmap-cell ${needsReviewClass}" style="background: rgb(${r},${g},${b});" title="${title}" onclick="reviewGrid('${cell.id}')"></div>`;
            } else {
                html += `<div class="heatmap-cell" style="background: #edf2f7;"></div>`;
            }
        }
    }
    
    html += '</div>';
    container.innerHTML = html;
}

async function reviewGrid(gridId) {
    if (currentUser !== 'street_planner') {
        alert('只有街道规划员可以复核热力图网格');
        return;
    }
    
    const status = prompt('请输入复核状态（normal/abnormal）：', 'normal');
    if (status === null) return;
    
    const result = await apiCall(`/api/heatmap/${gridId}/review`, 'POST', {
        review_status: status,
        reviewed_by: roleNames[currentUser]
    });
    
    if (result.error) {
        alert('操作失败: ' + result.error);
    } else {
        alert('复核完成');
        refreshHeatmap();
    }
}

async function refreshHeatmap() {
    const [data, stats] = await Promise.all([
        apiCall('/api/heatmap'),
        apiCall('/api/heatmap/stats')
    ]);
    
    if (data && data.length > 0) {
        renderHeatmap({ grid_data: data });
    }
    updateHeatmapStats(stats);
}

async function runSelfCheck() {
    const results = await apiCall('/api/selfcheck/run', 'POST', {});
    const container = document.getElementById('selfCheckResults');
    
    container.innerHTML = results.map(r => `
        <div class="check-result ${r.status}">
            <div class="check-result-header">
                <span class="check-name">${r.check_name}</span>
                <span class="check-status ${r.status}">${
                    r.status === 'pass' ? '通过' : r.status === 'warning' ? '警告' : '失败'
                }</span>
            </div>
            <div class="check-message">${r.message}</div>
            ${r.details && Object.keys(r.details).length > 0 ? `
            <div style="margin-top: 8px; font-size: 12px; color: #718096;">
                ${JSON.stringify(r.details, null, 2)}
            </div>
            ` : ''}
        </div>
    `).join('');
}

async function exportData(dataType) {
    if (dataType === 'report') {
        const result = await apiCall('/api/export/report');
        if (result.error) {
            alert('导出失败: ' + result.error);
        } else {
            alert(`报告已生成！\n目录: ${result.report_dir}\n包含文件数: ${Object.keys(result.files).length} 个`);
        }
    } else {
        window.open(`/api/export/${dataType}`);
    }
}

function refreshAll() {
    refreshInspections();
    refreshNotices();
    refreshHeatmap();
}
