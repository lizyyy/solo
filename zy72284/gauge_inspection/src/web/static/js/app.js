let currentIssues = [];
let currentFilter = 'all';
let samplePointCloud = null;
let sampleSafetyRadius = null;

function statusLabel(status) {
    const labels = {
        'pending': '待执行',
        'in_progress': '进行中',
        'completed': '已完成'
    };
    return labels[status] || status;
}

async function fetchJSON(url, options) {
    const response = await fetch(url, options);
    return await response.json();
}

async function refreshWorkflowStatus() {
    const data = await fetchJSON('/api/workflow/status');
    if (data.success) {
        updateWorkflowUI(data.data);
    }
}

function updateWorkflowUI(steps) {
    const container = document.getElementById('workflowSteps');
    container.innerHTML = '';
    
    steps.forEach((step, index) => {
        const card = document.createElement('div');
        card.className = `step-card ${step.status}`;
        
        const icons = ['📍', '🎨', '🏗️'];
        const statusBadgeClass = step.status === 'completed' ? 'completed' : 
                               step.status === 'in_progress' ? 'in_progress' : 'pending';
        
        card.innerHTML = `
            <div class="step-icon">${icons[index]}</div>
            <div class="step-info">
                <h3>第${step.step_order}步</h3>
                <p>${step.step_name}</p>
                <span class="status-badge">${statusLabel(step.status)}</span>
                ${step.operator ? `<div style="font-size:0.8em;color:#666;margin-top:5px;">操作人: ${step.operator}</div>` : ''}
            </div>
        `;
        
        container.appendChild(card);
        
        if (index < steps.length - 1) {
            const arrow = document.createElement('div');
            arrow.className = 'step-arrow';
            arrow.textContent = '→';
            container.appendChild(arrow);
        }
    });
}

async function loadSampleData() {
    try {
        const [pcData, srData] = await Promise.all([
            fetchJSON('/api/sample/point-cloud'),
            fetchJSON('/api/sample/safety-radius')
        ]);
        
        samplePointCloud = pcData.data;
        sampleSafetyRadius = srData.data;
        
        alert(`✅ 样本数据已加载！\n\n点云数据: ${samplePointCloud.length}条\n安全半径表: ${sampleSafetyRadius.length}条\n\n现在可以执行第一步了。`);
    } catch (error) {
        alert('❌ 加载样本数据失败: ' + error.message);
    }
}

async function runStep1() {
    if (!samplePointCloud) {
        alert('请先点击"加载样本数据"按钮');
        return;
    }
    
    try {
        const data = await fetchJSON('/api/workflow/step1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                log_no: 'LOG-WEB-' + Date.now(),
                items: samplePointCloud,
                imported_by: 'web-user'
            })
        });
        
        if (data.success) {
            alert(`✅ 第一步完成！\n\n导入了 ${data.data.issues.length} 条点云数据\n发现 ${data.data.issues.filter(i => i.issue.is_mixed).length} 条坐标混合问题`);
            await refreshAll();
        } else {
            alert('❌ 执行失败: ' + data.error);
        }
    } catch (error) {
        alert('❌ 执行失败: ' + error.message);
    }
}

async function runStep2() {
    if (!sampleSafetyRadius) {
        alert('请先点击"加载样本数据"按钮');
        return;
    }
    
    try {
        const data = await fetchJSON('/api/workflow/step2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                table_no: 'SR-WEB-' + Date.now(),
                items: sampleSafetyRadius,
                reviewed_by: 'ajing'
            })
        });
        
        if (data.success) {
            alert(`✅ 第二步完成！\n\n阿景已复核 ${data.data.updated.length} 条数据\n现场说明已自动更新版本`);
            await refreshAll();
        } else {
            alert('❌ 执行失败: ' + data.error);
        }
    } catch (error) {
        alert('❌ 执行失败: ' + error.message);
    }
}

async function runStep3() {
    try {
        const data = await fetchJSON('/api/workflow/step3', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ inspector: '巡检组-Web' })
        });
        
        if (data.success) {
            const actionCount = data.data.filter(i => i.action_required).length;
            const readyCount = data.data.filter(i => !i.action_required).length;
            alert(`✅ 第三步完成！\n\n需巡检组复核: ${actionCount}条\n可直接施工: ${readyCount}条`);
            await refreshAll();
        } else {
            alert('❌ 执行失败: ' + data.error);
        }
    } catch (error) {
        alert('❌ 执行失败: ' + error.message);
    }
}

async function refreshAll() {
    await refreshWorkflowStatus();
    await refreshIssues();
    renderChart();
    render3DPoints();
}

async function refreshIssues() {
    const data = await fetchJSON('/api/issues');
    if (data.success) {
        currentIssues = data.data;
        renderIssues();
    }
}

function filterIssues(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderIssues();
}

function getIssueClass(issue) {
    if (issue.is_mixed) return 'mixed';
    if (issue.status === 'pending_inspection' || issue.status === 'pending_final_inspection') return 'pending';
    return 'normal';
}

function getIssueStatusText(issue) {
    const statusMap = {
        'pending_inspection': '待巡检',
        'ajing_reviewed': '阿景已复核',
        'pending_final_inspection': '待最终巡检',
        'ready_for_construction': '可施工'
    };
    return statusMap[issue.status] || issue.status;
}

function renderIssues() {
    const container = document.getElementById('issuesList');
    
    let filtered = currentIssues;
    if (currentFilter === 'mixed') {
        filtered = currentIssues.filter(i => i.issue.is_mixed);
    } else if (currentFilter === 'normal') {
        filtered = currentIssues.filter(i => !i.issue.is_mixed);
    } else if (currentFilter === 'pending') {
        filtered = currentIssues.filter(i => 
            i.issue.status === 'pending_inspection' || i.issue.status === 'pending_final_inspection'
        );
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>${currentFilter === 'all' ? '暂无数据，请先加载样本或执行第一步' : '没有符合筛选条件的数据'}</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filtered.map(item => {
        const issue = item.issue;
        const note = item.site_note;
        const issueClass = getIssueClass(issue);
        const coordTypeClass = issue.is_mixed ? 'mixed' : 
                             issue.coord_type_detected === 'lonlat' ? 'lonlat' :
                             issue.coord_type_detected === 'meter' ? 'meter' : 'ambiguous';
        
        return `
            <div class="issue-card ${issueClass}" onclick="showDetail(${issue.id})">
                <div class="issue-header">
                    <div class="issue-title">
                        ${issue.is_mixed ? '⚠️' : '✅'}
                        ${issue.item_identifier}
                    </div>
                    <span class="issue-status ${issueClass}">${getIssueStatusText(issue)}</span>
                </div>
                
                <div class="issue-coords">
                    <div class="issue-coord">
                        <strong>X:</strong> ${issue.original_coord_x}
                        <span class="coord-type-badge ${coordTypeClass}">${issue.coord_type_detected}</span>
                    </div>
                    <div class="issue-coord">
                        <strong>Y:</strong> ${issue.original_coord_y}
                    </div>
                    ${issue.original_coord_z ? `<div class="issue-coord"><strong>Z:</strong> ${issue.original_coord_z}</div>` : ''}
                </div>
                
                ${note ? `
                <div class="issue-note">
                    <div class="note-row">
                        <span class="note-label">📝 为什么留下:</span>
                        <span class="note-content">${note.why_kept}</span>
                    </div>
                    ${note.missing_materials ? `
                    <div class="note-row">
                        <span class="note-label">🔍 还缺材料:</span>
                        <span class="note-content">${note.missing_materials}</span>
                    </div>
                    ` : ''}
                    <div class="note-row">
                        <span class="note-label">➡️ 下一步:</span>
                        <span class="note-content">${note.next_action}</span>
                    </div>
                    <div class="note-row">
                        <span class="note-label">👤 联系人:</span>
                        <span class="note-content">${note.contact_person}</span>
                    </div>
                    <div class="note-version">
                        📄 说明版本: v${note.version} | 更新于 ${new Date(note.last_updated_time).toLocaleString('zh-CN')}
                    </div>
                </div>
                ` : ''}
                
                <div class="data-links">
                    <a href="#" class="data-link" onclick="event.stopPropagation(); showSourceData('point_cloud', ${issue.id})">
                        📋 查看点云抽稀日志
                    </a>
                    ${issue.safety_radius_table_id ? `
                    <a href="#" class="data-link" onclick="event.stopPropagation(); showSourceData('safety_radius', ${issue.id})">
                        📏 查看安全半径表
                    </a>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function switchView(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(view + 'View').classList.add('active');
    event.target.classList.add('active');
    
    if (view === 'chart') {
        renderChart();
    } else {
        render3DPoints();
    }
}

function normalizeCoord(value, type, axis) {
    const num = parseFloat(value);
    if (isNaN(num)) return 0;
    
    if (type === 'lonlat') {
        if (axis === 'x') return (num + 180) / 360;
        if (axis === 'y') return (num + 90) / 180;
        return Math.min(1, Math.max(0, (num + 100) / 200));
    } else if (type === 'meter') {
        const abs = Math.abs(num);
        if (abs > 1000000) return (abs % 100000) / 100000;
        if (abs > 10000) return (abs % 10000) / 10000;
        return (abs % 1000) / 1000;
    }
    return 0.5;
}

function renderChart() {
    const canvas = document.getElementById('coordChart');
    const ctx = canvas.getContext('2d');
    
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const padding = 60;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = padding + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(canvas.width - padding, y);
        ctx.stroke();
        
        const x = padding + (chartWidth / 5) * i;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, canvas.height - padding);
        ctx.stroke();
    }
    
    ctx.fillStyle = '#666';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('X轴 (归一化)', canvas.width / 2, canvas.height - 20);
    
    ctx.save();
    ctx.translate(20, canvas.height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Y轴 (归一化)', 0, 0);
    ctx.restore();
    
    currentIssues.forEach(item => {
        const issue = item.issue;
        
        let pointType = issue.is_mixed ? 'mixed' : issue.coord_type_detected;
        const colors = {
            'lonlat': '#4e79a7',
            'meter': '#59a14f',
            'mixed': '#e15759',
            'ambiguous': '#f59e0b'
        };
        
        const x = padding + normalizeCoord(issue.original_coord_x, pointType, 'x') * chartWidth;
        const y = padding + (1 - normalizeCoord(issue.original_coord_y, pointType, 'y')) * chartHeight;
        
        ctx.beginPath();
        ctx.arc(x, y, issue.is_mixed ? 12 : 8, 0, Math.PI * 2);
        ctx.fillStyle = colors[pointType] || '#999';
        ctx.fill();
        
        if (issue.is_mixed) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(x, y, 18, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(225, 87, 89, 0.3)';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        
        ctx.fillStyle = '#333';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(issue.item_identifier, x, y - 15);
    });
    
    canvas.onclick = function(e) {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        for (let item of currentIssues) {
            const issue = item.issue;
            let pointType = issue.is_mixed ? 'mixed' : issue.coord_type_detected;
            const x = padding + normalizeCoord(issue.original_coord_x, pointType, 'x') * chartWidth;
            const y = padding + (1 - normalizeCoord(issue.original_coord_y, pointType, 'y')) * chartHeight;
            
            const dist = Math.sqrt((clickX - x) ** 2 + (clickY - y) ** 2);
            if (dist < 20) {
                showDetail(issue.id);
                break;
            }
        }
    };
}

function render3DPoints() {
    const container = document.getElementById('points3d');
    container.innerHTML = '';
    
    const sceneWidth = container.offsetWidth || 800;
    const sceneHeight = container.offsetHeight || 400;
    
    currentIssues.forEach((item, index) => {
        const issue = item.issue;
        
        let pointType = issue.is_mixed ? 'mixed' : issue.coord_type_detected;
        
        const x = normalizeCoord(issue.original_coord_x, pointType, 'x') * sceneWidth * 0.7 + sceneWidth * 0.15;
        const y = normalizeCoord(issue.original_coord_y, pointType, 'y') * sceneHeight * 0.7 + sceneHeight * 0.15;
        const z = issue.original_coord_z ? 
            normalizeCoord(issue.original_coord_z, pointType, 'z') * 100 : 
            50;
        
        const point = document.createElement('div');
        point.className = `point-3d ${pointType}`;
        point.style.left = `${x}px`;
        point.style.top = `${y}px`;
        point.style.transform = `translateZ(${z}px)`;
        point.style.animationDelay = `${index * 0.1}s`;
        
        point.innerHTML = `<span class="point-label">${issue.item_identifier}</span>`;
        
        point.onclick = () => showDetail(issue.id);
        
        container.appendChild(point);
    });
}

async function showDetail(issueId) {
    const data = await fetchJSON(`/api/issues?id=${issueId}`);
    if (!data.success || data.data.length === 0) {
        alert('找不到该记录');
        return;
    }
    
    const item = data.data[0];
    const issue = item.issue;
    const note = item.site_note;
    
    let pointCloudData = null;
    let safetyRadiusData = null;
    
    const [pcData, srData] = await Promise.all([
        fetchJSON('/api/point-cloud-logs'),
        fetchJSON('/api/safety-radius-tables')
    ]);
    
    if (pcData.success && pcData.data && pcData.data.items) {
        pointCloudData = pcData.data.items.find(i => i.identifier === issue.item_identifier);
    }
    if (srData.success && srData.data && srData.data.items) {
        safetyRadiusData = srData.data.items.find(i => i.identifier === issue.item_identifier);
    }
    
    const coordTypeClass = issue.is_mixed ? 'mixed' : 
                         issue.coord_type_detected === 'lonlat' ? 'lonlat' :
                         issue.coord_type_detected === 'meter' ? 'meter' : 'ambiguous';
    
    let html = `
        <div class="detail-section">
            <h4>📍 基本信息</h4>
            <table class="data-table">
                <tr><th>项目标识</th><td>${issue.item_identifier}</td></tr>
                <tr><th>检测状态</th><td>${getIssueStatusText(issue)}</td></tr>
                <tr>
                    <th>坐标类型</th>
                    <td><span class="coord-type-badge ${coordTypeClass}">${issue.coord_type_detected}</span></td>
                </tr>
                <tr><th>是否混合</th><td>${issue.is_mixed ? '⚠️ 是（经纬度+米制）' : '✅ 否'}</td></tr>
                <tr><th>留给巡检组复核</th><td>${issue.reserved_for_inspection ? '✅ 是' : '否'}</td></tr>
                <tr><th>检测时间</th><td>${new Date(issue.detected_time).toLocaleString('zh-CN')}</td></tr>
            </table>
        </div>
        
        <div class="detail-section">
            <h4>📐 坐标详情</h4>
            <table class="data-table">
                <tr><th>X坐标</th><td>${issue.original_coord_x}</td></tr>
                <tr><th>Y坐标</th><td>${issue.original_coord_y}</td></tr>
                <tr><th>Z坐标</th><td>${issue.original_coord_z || '-'}</td></tr>
            </table>
        </div>
    `;
    
    if (note) {
        html += `
            <div class="detail-section">
                <h4>📋 给现场班组的说明（v${note.version}）</h4>
                <table class="data-table">
                    <tr><th style="width:120px;">📝 为什么留下</th><td>${note.why_kept}</td></tr>
                    <tr><th>🔍 还缺材料</th><td>${note.missing_materials || '无'}</td></tr>
                    <tr><th>➡️ 下一步</th><td>${note.next_action}</td></tr>
                    <tr><th>👤 联系人</th><td>${note.contact_person}</td></tr>
                    <tr><th>生成时间</th><td>${new Date(note.generated_time).toLocaleString('zh-CN')}</td></tr>
                    <tr><th>更新时间</th><td>${new Date(note.last_updated_time).toLocaleString('zh-CN')}</td></tr>
                </table>
            </div>
        `;
    }
    
    if (pointCloudData) {
        html += `
            <div class="detail-section">
                <h4>📋 点云抽稀日志原始数据</h4>
                <table class="data-table">
                    <tr><th>标识</th><td>${pointCloudData.identifier || '-'}</td></tr>
                    <tr><th>X</th><td>${pointCloudData.x || '-'}</td></tr>
                    <tr><th>Y</th><td>${pointCloudData.y || '-'}</td></tr>
                    <tr><th>Z</th><td>${pointCloudData.z || '-'}</td></tr>
                    <tr><th>半径</th><td>${pointCloudData.radius || '-'}</td></tr>
                    <tr><th>备注</th><td>${pointCloudData.remark || '-'}</td></tr>
                </table>
            </div>
        `;
    }
    
    if (safetyRadiusData) {
        html += `
            <div class="detail-section">
                <h4>📏 安全半径表原始数据</h4>
                <table class="data-table">
                    <tr><th>标识</th><td>${safetyRadiusData.identifier || '-'}</td></tr>
                    <tr><th>X</th><td>${safetyRadiusData.x || '-'}</td></tr>
                    <tr><th>Y</th><td>${safetyRadiusData.y || '-'}</td></tr>
                    <tr><th>Z</th><td>${safetyRadiusData.z || '-'}</td></tr>
                    <tr><th>安全半径</th><td>${safetyRadiusData.safety_radius || '-'} 米</td></tr>
                    <tr><th>备注</th><td>${safetyRadiusData.remark || '-'}</td></tr>
                </table>
            </div>
        `;
    }
    
    document.getElementById('modalTitle').textContent = `详情 - ${issue.item_identifier}`;
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modal').classList.remove('hidden');
}

async function showSourceData(type, issueId) {
    const issueData = await fetchJSON(`/api/issues?id=${issueId}`);
    if (!issueData.success || issueData.data.length === 0) return;
    
    const issue = issueData.data[0].issue;
    const apiEndpoint = type === 'point_cloud' ? '/api/point-cloud-logs' : '/api/safety-radius-tables';
    const data = await fetchJSON(apiEndpoint);
    
    let sourceItem = null;
    if (data.success && data.data && data.data.items) {
        sourceItem = data.data.items.find(i => i.identifier === issue.item_identifier);
    }
    
    if (sourceItem) {
        const title = type === 'point_cloud' ? '点云抽稀日志' : '安全半径表';
        let html = `
            <div class="detail-section">
                <h4>📋 ${title} - ${issue.item_identifier}</h4>
                <table class="data-table">
        `;
        
        for (let key in sourceItem) {
            const labels = {
                'identifier': '标识',
                'x': 'X坐标',
                'y': 'Y坐标',
                'z': 'Z坐标',
                'radius': '点云半径',
                'safety_radius': '安全半径(米)',
                'remark': '备注'
            };
            html += `<tr><th>${labels[key] || key}</th><td>${sourceItem[key] || '-'}</td></tr>`;
        }
        
        html += `
                </table>
            </div>
            <p style="color:#666;font-style:italic;margin-top:15px;">
                💡 这是从 ${title} 中调出的原始数据，不是系统生成的漂亮画面
            </p>
        `;
        
        document.getElementById('modalTitle').textContent = `${title}原始数据`;
        document.getElementById('modalBody').innerHTML = html;
        document.getElementById('modal').classList.remove('hidden');
    } else {
        alert('找不到对应的原始数据');
    }
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

document.addEventListener('click', function(e) {
    if (e.target.id === 'modal') {
        closeModal();
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModal();
    }
});

window.addEventListener('resize', function() {
    if (document.getElementById('chartView').classList.contains('active')) {
        renderChart();
    } else {
        render3DPoints();
    }
});

document.addEventListener('DOMContentLoaded', function() {
    refreshAll();
});
