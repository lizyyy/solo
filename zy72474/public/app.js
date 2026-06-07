const API_BASE = '/api';
let currentPoint = null;
let currentDetailTab = 'basic';
let selectedStreetForBoundary = {};
let selectedWorkflowPoints = [];

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initDetailTabs();
    initAddPointForm();
    loadPoints();
    loadBoundaryPoints();
    loadStats();
    loadRules();
    initWorkflowStep(1);
});

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
            
            if (btn.dataset.tab === 'boundary') loadBoundaryPoints();
            if (btn.dataset.tab === 'stats') loadStats();
            if (btn.dataset.tab === 'rules') loadRules();
        });
    });
}

function initDetailTabs() {
    document.querySelectorAll('.detail-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.detail-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDetailTab = btn.dataset.detail;
            renderDetailContent();
        });
    });
}

function initAddPointForm() {
    document.getElementById('addPointForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        if (data.streets) {
            data.streets = data.streets.split(',').map(s => s.trim()).filter(s => s);
        } else {
            data.streets = [];
        }
        
        try {
            const res = await fetch(`${API_BASE}/points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            
            if (result.needsReview) {
                alert('点位已创建，但需要边界复核！');
            } else {
                alert('点位创建成功！');
            }
            
            closeModal('addPointModal');
            e.target.reset();
            loadPoints();
            loadBoundaryPoints();
            loadStats();
        } catch (err) {
            alert('创建失败: ' + err.message);
        }
    });
}

async function loadPoints() {
    const boundaryFilter = document.getElementById('filterBoundary').value;
    const stageFilter = document.getElementById('filterStage').value;
    
    let url = `${API_BASE}/points`;
    const params = new URLSearchParams();
    if (boundaryFilter) params.append('boundaryStatus', boundaryFilter);
    if (stageFilter) params.append('workflowStage', stageFilter);
    if (params.toString()) url += '?' + params.toString();
    
    try {
        const res = await fetch(url);
        const data = await res.json();
        renderPoints(data.points);
    } catch (err) {
        console.error(err);
    }
}

function renderPoints(points) {
    const container = document.getElementById('pointsList');
    
    if (points.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📍</div>
                <p>暂无点位数据，点击右上角新增点位</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = points.map(point => `
        <div class="point-card ${getBoundaryClass(point.boundaryStatus)}" onclick="openPointDetail('${point.id}')">
            <h3>${escapeHtml(point.name)}</h3>
            <div class="point-meta">
                经纬度: ${point.lat}, ${point.lng}
            </div>
            <div>
                <span class="status-tag status-${point.boundaryStatus}">${getBoundaryText(point.boundaryStatus)}</span>
                <span class="stage-tag">${getStageText(point.workflowStage)}</span>
            </div>
            <div class="point-meta" style="margin-top: 8px;">
                街道: ${point.streets.length > 0 ? point.streets.join('、') : '未设置'}
            </div>
            <div class="point-meta">
                照片: ${point.photos.length} | 公交刷卡: ${point.busCardPeriods.length} | 版本: ${point.versions.length}
            </div>
            ${point.notes ? `
                <div class="raw-material">
                    <div class="raw-material-label">📝 原始备注</div>
                    <div>${escapeHtml(point.notes)}</div>
                </div>
            ` : ''}
        </div>
    `).join('');
}

async function loadBoundaryPoints() {
    try {
        const res = await fetch(`${API_BASE}/points?boundaryStatus=boundary_pending`);
        const data = await res.json();
        
        document.getElementById('pendingCount').textContent = data.count;
        renderBoundaryPoints(data.points);
    } catch (err) {
        console.error(err);
    }
}

function renderBoundaryPoints(points) {
    const container = document.getElementById('boundaryList');
    
    if (points.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">✅</div>
                <p>暂无待复核的边界点位</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = points.map(point => `
        <div class="boundary-item">
            <h4>${escapeHtml(point.name)}</h4>
            <p class="hint">经纬度: ${point.lat}, ${point.lng}</p>
            <div class="streets">
                <p style="margin-bottom: 8px; font-weight: 500;">请选择归属街道：</p>
                ${point.streets.map(street => `
                    <span class="street-option ${selectedStreetForBoundary[point.id] === street ? 'selected' : ''}" 
                          onclick="selectStreetForBoundary('${point.id}', '${escapeHtml(street)}')">
                        ${escapeHtml(street)}
                    </span>
                `).join('')}
            </div>
            ${point.notes ? `
                <div class="raw-material">
                    <div class="raw-material-label">📝 原始备注（不会被清洗）</div>
                    <div>${escapeHtml(point.notes)}</div>
                </div>
            ` : ''}
            <div class="boundary-actions">
                <button class="btn-success" onclick="confirmBoundary('${point.id}')" 
                        ${!selectedStreetForBoundary[point.id] ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                    ✓ 确认归属
                </button>
                <button class="btn-primary" onclick="openPointDetail('${point.id}')">
                    查看详情
                </button>
            </div>
        </div>
    `).join('');
}

function selectStreetForBoundary(pointId, street) {
    selectedStreetForBoundary[pointId] = street;
    loadBoundaryPoints();
}

async function confirmBoundary(pointId) {
    const assignedStreet = selectedStreetForBoundary[pointId];
    if (!assignedStreet) {
        alert('请先选择归属街道');
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE}/points/${pointId}/review-boundary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reviewAction: 'confirm',
                assignedStreet,
                reviewedBy: '阿宁'
            })
        });
        const result = await res.json();
        
        alert('边界点位已确认！');
        delete selectedStreetForBoundary[pointId];
        loadPoints();
        loadBoundaryPoints();
        loadStats();
    } catch (err) {
        alert('操作失败: ' + err.message);
    }
}

async function openPointDetail(pointId) {
    try {
        const res = await fetch(`${API_BASE}/points/${pointId}`);
        const data = await res.json();
        currentPoint = data.point;
        document.getElementById('detailTitle').textContent = currentPoint.name;
        document.getElementById('pointDetailModal').classList.add('show');
        renderDetailContent();
    } catch (err) {
        alert('加载失败: ' + err.message);
    }
}

function renderDetailContent() {
    if (!currentPoint) return;
    
    const container = document.getElementById('detailContent');
    
    switch(currentDetailTab) {
        case 'basic':
            container.innerHTML = renderBasicInfo();
            break;
        case 'photos':
            container.innerHTML = renderPhotos();
            break;
        case 'busCards':
            container.innerHTML = renderBusCards();
            break;
        case 'versions':
            container.innerHTML = renderVersions();
            break;
        case 'chart':
            container.innerHTML = renderChartView();
            break;
    }
}

function renderBasicInfo() {
    const point = currentPoint;
    return `
        <div class="info-row">
            <div class="info-label">点位名称</div>
            <div class="info-value">${escapeHtml(point.name)}</div>
        </div>
        <div class="info-row">
            <div class="info-label">经纬度</div>
            <div class="info-value">${point.lat}, ${point.lng}</div>
        </div>
        <div class="info-row">
            <div class="info-label">边界状态</div>
            <div class="info-value">
                <span class="status-tag status-${point.boundaryStatus}">${getBoundaryText(point.boundaryStatus)}</span>
            </div>
        </div>
        <div class="info-row">
            <div class="info-label">关联街道</div>
            <div class="info-value">${point.streets.length > 0 ? point.streets.join('、') : '无'}</div>
        </div>
        <div class="info-row">
            <div class="info-label">确认归属街道</div>
            <div class="info-value">${point.assignedStreet || '未确认'}</div>
        </div>
        <div class="info-row">
            <div class="info-label">工作流阶段</div>
            <div class="info-value"><span class="stage-tag">${getStageText(point.workflowStage)}</span></div>
        </div>
        <div class="info-row">
            <div class="info-label">匹配次数</div>
            <div class="info-value">${point.matchCount || 0}</div>
        </div>
        <div class="info-row">
            <div class="info-label">创建时间</div>
            <div class="info-value">${formatTime(point.createdAt)}</div>
        </div>
        <div class="info-row">
            <div class="info-label">更新时间</div>
            <div class="info-value">${formatTime(point.updatedAt)}</div>
        </div>
        ${point.notes ? `
            <div class="raw-material">
                <div class="raw-material-label">📝 原始备注（未清洗）</div>
                <div>${escapeHtml(point.notes)}</div>
            </div>
        ` : ''}
        ${point.boundaryStatus === 'boundary_pending' ? `
            <div style="margin-top: 20px; padding: 16px; background: #fef3c7; border-radius: 8px;">
                <p style="font-weight: 600; color: #92400e; margin-bottom: 10px;">⚠️ 此点位在街道边界上，需要复核</p>
                <button class="btn-warning" onclick="rollbackBoundary('${point.id}')">回滚到待复核</button>
            </div>
        ` : ''}
    `;
}

function renderPhotos() {
    const point = currentPoint;
    return `
        <div style="margin-bottom: 16px;">
            <p class="hint">原始照片材料完整保留，可追溯。重复导入同一张照片不会重复计数。</p>
        </div>
        ${point.photos.length === 0 ? `
            <div class="empty-state">
                <div class="empty-state-icon">📷</div>
                <p>暂无照片</p>
            </div>
        ` : `
            <div class="photo-grid">
                ${point.photos.map(photo => `
                    <div class="photo-item">
                        <div class="photo-placeholder">🖼️</div>
                        <div class="photo-name">${escapeHtml(photo.originalFilename)}</div>
                        <div class="photo-name" style="color: #94a3b8; font-size: 11px; margin-top: 4px;">
                            ${formatTime(photo.uploadedAt)}
                        </div>
                    </div>
                `).join('')}
            </div>
        `}
    `;
}

function renderBusCards() {
    const point = currentPoint;
    return `
        <div style="margin-bottom: 16px;">
            <p class="hint">公交刷卡时段的原始备注完整保留，不会被清洗成一行干净数据。</p>
        </div>
        ${point.busCardPeriods.length === 0 ? `
            <div class="empty-state">
                <div class="empty-state-icon">🚌</div>
                <p>暂无公交刷卡数据</p>
            </div>
        ` : point.busCardPeriods.map(card => `
            <div class="bus-card-item">
                <div class="period">⏰ ${escapeHtml(card.period)}</div>
                <div class="volume">👥 客流量: ${card.passengerVolume || '未记录'}</div>
                ${card.rawText || card.notes ? `
                    <div class="raw-notes">
                        <strong>原始备注：</strong>
                        ${escapeHtml(card.rawText || card.notes)}
                    </div>
                ` : ''}
                <div style="margin-top: 8px; font-size: 12px; color: #94a3b8;">
                    补充人: ${escapeHtml(card.supplementedBy || '未知')} | ${formatTime(card.supplementedAt)}
                </div>
            </div>
        `).join('')}
    `;
}

function renderVersions() {
    const point = currentPoint;
    return `
        <div style="margin-bottom: 16px;">
            <p class="hint">每次修改都保留完整历史，可对比、可回滚。阿宁修改一条备注也能看出改前改后的差别。</p>
        </div>
        ${point.versions.slice().reverse().map((version, idx) => `
            <div class="version-item">
                <div class="version-header">
                    <span class="version-action">${getVersionActionText(version.action)}</span>
                    <span class="version-time">${formatTime(version.timestamp)}</span>
                </div>
                <div class="version-reason">${escapeHtml(version.reason)}</div>
                <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
                    操作人: ${escapeHtml(version.modifiedBy || 'system')}
                </div>
                <div class="version-actions">
                    ${idx < point.versions.length - 1 ? `
                        <button class="btn-danger" onclick="rollbackToVersion('${point.id}', '${version.versionId}')">
                            ↩ 回滚到此版本
                        </button>
                    ` : ''}
                    ${idx < point.versions.length - 1 ? `
                        <button class="btn-primary" onclick="compareWithPrevious('${point.id}', '${version.versionId}', '${point.versions[point.versions.length - 2 - idx].versionId}')">
                            📊 与前一版本对比
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('')}
    `;
}

function renderChartView() {
    const point = currentPoint;
    return `
        <div class="chart-notice">
            ⚠️ 图表展示仅用于辅助分析。点击下方按钮可直接追溯到原始证据材料。
            <br>怕的是结论看着很满，追证据时断在半路。
        </div>
        <div class="chart-container">
            <div style="font-size: 48px; margin-bottom: 16px;">📊</div>
            <h3>${escapeHtml(point.name)} - 停车错峰共享匹配分析</h3>
            <p style="color: #64748b; margin: 16px 0;">
                匹配次数: <strong>${point.matchCount || 0}</strong> | 
                公交刷卡时段: <strong>${point.busCardPeriods.length}</strong> 条 | 
                照片: <strong>${point.photos.length}</strong> 张
            </p>
            <div style="height: 200px; background: linear-gradient(180deg, #eff6ff 0%, white 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #94a3b8;">
                [ 3D / 图表展示区域 ]
            </div>
        </div>
        <div class="evidence-links">
            <button class="evidence-link" onclick="switchDetailTab('photos')">📷 查看路口照片</button>
            <button class="evidence-link" onclick="switchDetailTab('busCards')">🚌 查看公交刷卡时段</button>
            <button class="evidence-link" onclick="switchDetailTab('versions')">📜 查看版本历史</button>
        </div>
    `;
}

function switchDetailTab(tab) {
    document.querySelectorAll('.detail-tab').forEach(b => b.classList.remove('active'));
    document.querySelector(`.detail-tab[data-detail="${tab}"]`).classList.add('active');
    currentDetailTab = tab;
    renderDetailContent();
}

async function rollbackToVersion(pointId, versionId) {
    if (!confirm('确定要回滚到此版本吗？当前状态将被记录为新版本。')) return;
    
    try {
        const res = await fetch(`${API_BASE}/points/${pointId}/rollback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ versionId, rolledBackBy: '阿宁' })
        });
        const result = await res.json();
        
        if (result.error) {
            alert(result.error);
            return;
        }
        
        alert('回滚成功！');
        await openPointDetail(pointId);
        loadPoints();
        loadStats();
    } catch (err) {
        alert('回滚失败: ' + err.message);
    }
}

async function compareWithPrevious(pointId, v1, v2) {
    try {
        const res = await fetch(`${API_BASE}/points/${pointId}/versions/compare?v1=${v2}&v2=${v1}`);
        const result = await res.json();
        
        showVersionCompare(result);
    } catch (err) {
        alert('对比失败: ' + err.message);
    }
}

function showVersionCompare(result) {
    const container = document.getElementById('versionCompareContent');
    
    if (!result.hasChanges) {
        container.innerHTML = '<p>两个版本之间没有差异</p>';
        document.getElementById('versionCompareModal').classList.add('show');
        return;
    }
    
    let html = `
        <div style="margin-bottom: 20px;">
            <p><strong>版本1:</strong> ${result.version1.action} - ${formatTime(result.version1.timestamp)}</p>
            <p><strong>版本2:</strong> ${result.version2.action} - ${formatTime(result.version2.timestamp)}</p>
        </div>
        <h4 style="margin-bottom: 16px;">差异对比：</h4>
    `;
    
    for (const field of Object.keys(result.diff)) {
        const diff = result.diff[field];
        html += `
            <div style="margin-bottom: 20px;">
                <h5 style="margin-bottom: 8px; color: #475569;">${getFieldLabel(field)}</h5>
                <div class="diff-item before">
                    <div class="diff-label">改前 (版本1)</div>
                    <div class="diff-value">${formatDiffValue(diff.before)}</div>
                </div>
                <div class="diff-item after">
                    <div class="diff-label">改后 (版本2)</div>
                    <div class="diff-value">${formatDiffValue(diff.after)}</div>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
    document.getElementById('versionCompareModal').classList.add('show');
}

function formatDiffValue(val) {
    if (val === null || val === undefined) return '<em>空</em>';
    if (Array.isArray(val)) return val.join('、');
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    return escapeHtml(String(val));
}

function getFieldLabel(field) {
    const labels = {
        name: '点位名称',
        streets: '关联街道',
        boundaryStatus: '边界状态',
        assignedStreet: '归属街道',
        notes: '备注',
        matchCount: '匹配次数',
        busCardPeriods: '公交刷卡时段'
    };
    return labels[field] || field;
}

async function rollbackBoundary(pointId) {
    try {
        const res = await fetch(`${API_BASE}/points/${pointId}/review-boundary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reviewAction: 'rollback',
                reviewedBy: '阿宁'
            })
        });
        const result = await res.json();
        
        alert('已回滚到待复核状态！');
        await openPointDetail(pointId);
        loadPoints();
        loadBoundaryPoints();
    } catch (err) {
        alert('操作失败: ' + err.message);
    }
}

async function loadStats() {
    try {
        const res = await fetch(`${API_BASE}/stats`);
        const stats = await res.json();
        
        document.getElementById('statsCards').innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${stats.total}</div>
                <div class="stat-label">总位点数</div>
            </div>
            <div class="stat-card warning">
                <div class="stat-value">${stats.boundaryPending}</div>
                <div class="stat-label">边界待复核</div>
            </div>
            <div class="stat-card success">
                <div class="stat-value">${stats.boundaryConfirmed}</div>
                <div class="stat-label">边界已确认</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.normal}</div>
                <div class="stat-label">正常点位</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.stagePhotoImported}</div>
                <div class="stat-label">阶段1: 照片已导入</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.stageBusCardSupplemented}</div>
                <div class="stat-label">阶段2: 刷卡已补充</div>
            </div>
            <div class="stat-card success">
                <div class="stat-value">${stats.stageMapExported}</div>
                <div class="stat-label">阶段3: 地图已导出</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.totalMatchCount}</div>
                <div class="stat-label">总匹配次数</div>
            </div>
        `;
    } catch (err) {
        console.error(err);
    }
}

async function loadRules() {
    try {
        const res = await fetch(`${API_BASE}/rules/boundary`);
        const data = await res.json();
        
        document.getElementById('rulesList').innerHTML = data.rules.map(rule => `
            <div class="rule-item">
                <h4>${escapeHtml(rule.name)}</h4>
                <div class="rule-id">${escapeHtml(rule.id)}</div>
                <p>${escapeHtml(rule.description)}</p>
            </div>
        `).join('');
    } catch (err) {
        console.error(err);
    }
}

function initWorkflowStep(step) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(`step${step}`).classList.add('active');
    renderWorkflowStep(step);
}

function renderWorkflowStep(step) {
    const container = document.getElementById('workflowContent');
    
    if (step === 1) {
        container.innerHTML = `
            <div class="workflow-step-detail">
                <h3>步骤1：路口照片导入</h3>
                <p style="margin-bottom: 16px; color: #64748b;">选择点位导入照片。系统会自动检测重复照片（通过文件哈希），重复导入不会让匹配数量翻倍。</p>
                <div id="workflowStep1Points"></div>
            </div>
        `;
        loadWorkflowPoints(1);
    } else if (step === 2) {
        container.innerHTML = `
            <div class="workflow-step-detail">
                <h3>步骤2：补看公交刷卡时段</h3>
                <p style="margin-bottom: 16px; color: #64748b;">选择点位补充公交刷卡数据。原始备注会完整保留，不会被清洗成一行干净数据。</p>
                <div id="workflowStep2Points"></div>
            </div>
        `;
        loadWorkflowPoints(2);
    } else if (step === 3) {
        container.innerHTML = `
            <div class="workflow-step-detail">
                <h3>步骤3：地图导出更新</h3>
                <p style="margin-bottom: 16px; color: #64748b;">选择点位导出地图数据。边界待复核的点位会被拦截，需项目经理先确认归属。</p>
                <div id="workflowStep3Points"></div>
            </div>
        `;
        loadWorkflowPoints(3);
    }
}

async function loadWorkflowPoints(step) {
    try {
        const res = await fetch(`${API_BASE}/points`);
        const data = await res.json();
        let points = data.points;
        
        if (step === 3) {
        }
        
        const container = document.getElementById(`workflowStep${step}Points`);
        container.innerHTML = points.map(point => `
            <div class="point-select-item ${selectedWorkflowPoints.includes(point.id) ? 'selected' : ''}"
                 onclick="toggleWorkflowPoint('${point.id}')">
                <div>
                    <strong>${escapeHtml(point.name)}</strong>
                    <span class="status-tag status-${point.boundaryStatus}" style="margin-left: 10px;">
                        ${getBoundaryText(point.boundaryStatus)}
                    </span>
                </div>
                <div>
                    <span class="stage-tag">${getStageText(point.workflowStage)}</span>
                </div>
            </div>
        `).join('') + `
            <div style="margin-top: 20px;">
                <button class="btn-primary" onclick="executeWorkflowStep(${step})" style="width: 100%;">
                    ${step === 1 ? '📷 导入选中点位的照片' : step === 2 ? '🚌 补充公交刷卡数据' : '🗺️ 导出地图数据'}
                </button>
            </div>
        `;
    } catch (err) {
        console.error(err);
    }
}

function toggleWorkflowPoint(pointId) {
    const idx = selectedWorkflowPoints.indexOf(pointId);
    if (idx === -1) {
        selectedWorkflowPoints.push(pointId);
    } else {
        selectedWorkflowPoints.splice(idx, 1);
    }
    
    const activeStep = document.querySelector('.step.active');
    const stepNum = parseInt(activeStep.id.replace('step', ''));
    loadWorkflowPoints(stepNum);
}

async function executeWorkflowStep(step) {
    if (selectedWorkflowPoints.length === 0) {
        alert('请先选择点位');
        return;
    }
    
    if (step === 1) {
        alert('照片导入功能演示：在实际场景中，这里会弹出文件选择器。\n\n当前系统已支持：\n- 通过SHA256文件哈希检测重复照片\n- 重复导入不会增加匹配数量\n- 原始照片完整保留在 rawMaterials.originalPhotos 中');
        selectedWorkflowPoints = [];
    } else if (step === 2) {
        const period = prompt('请输入公交刷卡时段（如：早高峰 7:00-9:00）');
        if (!period) return;
        const volume = prompt('请输入客流量');
        const rawNotes = prompt('请输入原始备注（将完整保留，不会被清洗）');
        
        for (const pointId of selectedWorkflowPoints) {
            await fetch(`${API_BASE}/points/${pointId}/bus-cards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    busCardData: {
                        period,
                        passengerVolume: volume,
                        rawText: rawNotes,
                        notes: rawNotes
                    },
                    supplementedBy: '阿宁'
                })
            });
        }
        
        alert('公交刷卡数据已补充！原始备注已完整保留。');
        selectedWorkflowPoints = [];
    } else if (step === 3) {
        try {
            const res = await fetch(`${API_BASE}/map/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pointIds: selectedWorkflowPoints,
                    exportedBy: '阿宁'
                })
            });
            const result = await res.json();
            
            const successCount = result.exports.filter(e => e.success).length;
            const errorCount = result.exports.filter(e => e.error).length;
            
            let msg = `导出完成！\n成功: ${successCount} 个\n失败: ${errorCount} 个\n`;
            
            const errors = result.exports.filter(e => e.error);
            if (errors.length > 0) {
                msg += '\n失败原因：\n';
                errors.forEach(e => {
                    msg += `- ${e.pointName}: ${e.error}\n`;
                });
            }
            
            alert(msg);
            selectedWorkflowPoints = [];
        } catch (err) {
            alert('导出失败: ' + err.message);
        }
    }
    
    loadPoints();
    loadStats();
    
    if (step < 3) {
        setTimeout(() => initWorkflowStep(step + 1), 500);
    }
}

document.querySelectorAll('.step').forEach(step => {
    step.addEventListener('click', () => {
        const stepNum = parseInt(step.id.replace('step', ''));
        initWorkflowStep(stepNum);
    });
});

function showAddPointModal() {
    document.getElementById('addPointModal').classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
    if (modalId === 'pointDetailModal') {
        currentPoint = null;
    }
}

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
            if (modal.id === 'pointDetailModal') {
                currentPoint = null;
            }
        }
    });
});

function getBoundaryClass(status) {
    if (status === 'boundary_pending') return 'boundary-pending';
    if (status === 'boundary_confirmed') return 'boundary-confirmed';
    return '';
}

function getBoundaryText(status) {
    const map = {
        'normal': '正常',
        'boundary_pending': '边界待复核',
        'boundary_confirmed': '边界已确认'
    };
    return map[status] || status;
}

function getStageText(stage) {
    const map = {
        'photo_imported': '照片已导入',
        'bus_card_supplemented': '公交刷卡已补充',
        'map_exported': '地图已导出'
    };
    return map[stage] || stage;
}

function getVersionActionText(action) {
    const map = {
        'create': '创建',
        'update': '更新',
        'add_photo': '添加照片',
        'add_bus_card': '添加公交刷卡',
        'rollback': '回滚',
        'boundary_confirm': '边界确认',
        'boundary_rollback': '边界回滚',
        'workflow_advance': '工作流推进',
        'map_export': '地图导出'
    };
    return map[action] || action;
}

function formatTime(isoString) {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleString('zh-CN');
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
