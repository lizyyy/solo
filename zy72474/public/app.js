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
    const reversedVersions = point.versions.slice().reverse();
    
    return `
        <div style="margin-bottom: 16px;">
            <p class="hint">每次修改都保留完整历史，可对比、可回滚。阿宁修改一条备注也能看出改前改后的差别。</p>
        </div>
        ${reversedVersions.map((version, displayIdx) => {
            const realIdx = point.versions.length - 1 - displayIdx;
            const prevVersion = realIdx > 0 ? point.versions[realIdx - 1] : null;
            
            let changeSummary = '';
            if (prevVersion) {
                const changes = [];
                const fields = ['name', 'streets', 'boundaryStatus', 'assignedStreet', 'notes', 'matchCount'];
                fields.forEach(f => {
                    const before = JSON.stringify(prevVersion.current[f]);
                    const after = JSON.stringify(version.current[f]);
                    if (before !== after) {
                        changes.push({
                            field: f,
                            before: prevVersion.current[f],
                            after: version.current[f]
                        });
                    }
                });
                if (prevVersion.current.busCardPeriods?.length !== version.current.busCardPeriods?.length) {
                    changes.push({
                        field: 'busCardPeriods',
                        before: `${prevVersion.current.busCardPeriods?.length || 0}条`,
                        after: `${version.current.busCardPeriods?.length || 0}条`
                    });
                }
                
                if (changes.length > 0) {
                    changeSummary = changes.map(c => `
                        <div style="padding: 8px; background: white; border-radius: 4px; margin-top: 6px;">
                            <div style="font-size: 12px; font-weight: 600; color: #1e40af; margin-bottom: 4px;">
                                📌 ${getFieldLabel(c.field)}
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                                <div style="padding: 4px; background: #fef2f2; border-radius: 3px; font-size: 11px;">
                                    <span style="color: #dc2626; font-weight: 500;">✖ 改前：</span>
                                    <span style="color: #991b1b; word-break: break-all;">${formatDiffValue(c.before)}</span>
                                </div>
                                <div style="padding: 4px; background: #f0fdf4; border-radius: 3px; font-size: 11px;">
                                    <span style="color: #16a34a; font-weight: 500;">✔ 改后：</span>
                                    <span style="color: #166534; word-break: break-all;">${formatDiffValue(c.after)}</span>
                                </div>
                            </div>
                        </div>
                    `).join('');
                }
            }
            
            return `
                <div class="version-item">
                    <div class="version-header">
                        <span class="version-action">${getVersionActionText(version.action)}</span>
                        <span class="version-time">${formatTime(version.timestamp)}</span>
                    </div>
                    <div class="version-reason">
                        <strong>为什么改：</strong>${escapeHtml(version.reason)}
                    </div>
                    <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
                        操作人: <strong>${escapeHtml(version.modifiedBy || 'system')}</strong>
                    </div>
                    ${changeSummary ? `
                        <div style="margin-bottom: 10px;">
                            <div style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">改前改后对比：</div>
                            ${changeSummary}
                        </div>
                    ` : ''}
                    <div class="version-actions">
                        ${displayIdx < reversedVersions.length - 1 ? `
                            <button class="btn-danger" onclick="rollbackToVersion('${point.id}', '${version.versionId}')">
                                ↩ 回滚到此版本
                            </button>
                        ` : ''}
                        ${displayIdx < reversedVersions.length - 1 ? `
                            <button class="btn-primary" onclick="compareWithPrevious('${point.id}', '${version.versionId}', '${prevVersion.versionId}')">
                                📊 详细对比
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('')}
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
        <div style="padding: 16px; background: #f8fafc; border-radius: 8px; margin-bottom: 20px;">
            <h4 style="margin-bottom: 12px; color: #1e40af;">📋 版本对比详情</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                <div style="padding: 12px; background: white; border-radius: 6px; border-left: 4px solid #dc2626;">
                    <p style="font-size: 13px; color: #64748b; margin-bottom: 4px;">改前版本（版本1）</p>
                    <p style="font-weight: 600; color: #991b1b;">${getVersionActionText(result.version1.action)}</p>
                    <p style="font-size: 12px; color: #64748b; margin-top: 4px;">${formatTime(result.version1.timestamp)}</p>
                    ${result.version1.reason ? `<p style="font-size: 12px; color: #475569; margin-top: 6px;">原因：${escapeHtml(result.version1.reason)}</p>` : ''}
                </div>
                <div style="padding: 12px; background: white; border-radius: 6px; border-left: 4px solid #16a34a;">
                    <p style="font-size: 13px; color: #64748b; margin-bottom: 4px;">改后版本（版本2）</p>
                    <p style="font-weight: 600; color: #166534;">${getVersionActionText(result.version2.action)}</p>
                    <p style="font-size: 12px; color: #64748b; margin-top: 4px;">${formatTime(result.version2.timestamp)}</p>
                    ${result.version2.reason ? `<p style="font-size: 12px; color: #475569; margin-top: 6px;">原因：${escapeHtml(result.version2.reason)}</p>` : ''}
                </div>
            </div>
        </div>
        
        <h4 style="margin-bottom: 16px;">🔍 字段差异详情：</h4>
    `;
    
    for (const field of Object.keys(result.diff)) {
        const diff = result.diff[field];
        const fieldLabel = getFieldLabel(field);
        
        html += `
            <div style="margin-bottom: 24px; padding: 16px; background: white; border-radius: 8px; border: 1px solid #e2e8f0;">
                <h5 style="margin-bottom: 12px; color: #1e40af; font-size: 15px;">
                    📌 ${fieldLabel}
                </h5>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div class="diff-item before" style="margin: 0;">
                        <div class="diff-label">✖ 改前文本</div>
                        <div class="diff-value" style="white-space: pre-wrap; word-break: break-all;">${formatDiffValue(diff.before)}</div>
                    </div>
                    <div class="diff-item after" style="margin: 0;">
                        <div class="diff-label">✔ 改后文本</div>
                        <div class="diff-value" style="white-space: pre-wrap; word-break: break-all;">${formatDiffValue(diff.after)}</div>
                    </div>
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

let workflowPhotoFiles = [];
let workflowBusCardData = null;
let workflowStepResults = { step1: null, step2: null, step3: null };

function renderWorkflowStep(step) {
    const container = document.getElementById('workflowContent');
    
    if (step === 1) {
        container.innerHTML = `
            <div class="workflow-step-detail">
                <h3>步骤1：路口照片导入</h3>
                <p style="margin-bottom: 16px; color: #64748b;">选择点位和照片文件。系统通过SHA256文件哈希自动检测重复照片，同一批照片重复导入不会让匹配数量翻倍。</p>
                
                <div id="workflowStep1Points"></div>
                
                <div id="photoUploadSection" style="margin-top: 20px; padding: 16px; background: #f8fafc; border-radius: 8px; display: ${selectedWorkflowPoints.length > 0 ? 'block' : 'none'};">
                    <h4 style="margin-bottom: 12px;">📷 选择要导入的路口照片</h4>
                    <input type="file" id="workflowPhotoInput" multiple accept="image/*" style="margin-bottom: 12px;">
                    <div id="selectedPhotoList" style="margin-bottom: 12px;"></div>
                    <div style="margin-top: 20px;">
                        <button class="btn-primary" onclick="executeWorkflowStep(1)" style="width: 100%;">
                            📷 开始导入照片
                        </button>
                    </div>
                </div>
                
                <div id="step1Result" style="margin-top: 20px;"></div>
            </div>
        `;
        loadWorkflowPoints(1);
        initWorkflowPhotoUpload();
    } else if (step === 2) {
        container.innerHTML = `
            <div class="workflow-step-detail">
                <h3>步骤2：补看公交刷卡时段</h3>
                <p style="margin-bottom: 16px; color: #64748b;">选择点位补充公交刷卡数据。原始备注会完整保留在rawText字段，不会被清洗成一行干净数据。修改备注时历史版本会记录改前文本、改后文本和修改原因。</p>
                
                <div id="workflowStep2Points"></div>
                
                <div id="busCardSection" style="margin-top: 20px; padding: 16px; background: #f8fafc; border-radius: 8px; display: ${selectedWorkflowPoints.length > 0 ? 'block' : 'none'};">
                    <h4 style="margin-bottom: 12px;">🚌 录入公交刷卡时段</h4>
                    <div class="form-group">
                        <label>时段</label>
                        <input type="text" id="bcPeriod" placeholder="如：早高峰 7:00-9:00">
                    </div>
                    <div class="form-group">
                        <label>客流量</label>
                        <input type="text" id="bcVolume" placeholder="如：1200人次">
                    </div>
                    <div class="form-group">
                        <label>原始备注（完整保留，不会被清洗）</label>
                        <textarea id="bcNotes" rows="3" placeholder="阿宁备注：原始文本完整保留，包括换行、特殊字符等"></textarea>
                    </div>
                    <div class="form-group">
                        <label>修改原因（将记录到版本历史）</label>
                        <input type="text" id="bcReason" placeholder="如：初次录入/补充备注/修正数据">
                    </div>
                    <div style="margin-top: 20px;">
                        <button class="btn-primary" onclick="executeWorkflowStep(2)" style="width: 100%;">
                            🚌 补充公交刷卡数据
                        </button>
                    </div>
                </div>
                
                <div id="step2Result" style="margin-top: 20px;"></div>
            </div>
        `;
        loadWorkflowPoints(2);
    } else if (step === 3) {
        container.innerHTML = `
            <div class="workflow-step-detail">
                <h3>步骤3：地图导出更新</h3>
                <p style="margin-bottom: 16px; color: #64748b;">选择点位导出地图数据。边界待复核的点位会被拦截，需项目经理先确认归属。导出报告会包含重复导入来源、处理状态和结论。</p>
                <div id="workflowStep3Points"></div>
                <div style="margin-top: 20px;">
                    <button class="btn-primary" onclick="executeWorkflowStep(3)" style="width: 100%;">
                        🗺️ 导出地图数据
                    </button>
                </div>
                <div id="step3Result" style="margin-top: 20px;"></div>
                <div id="workflowFinalReport" style="margin-top: 30px;"></div>
            </div>
        `;
        loadWorkflowPoints(3);
    }
}

function initWorkflowPhotoUpload() {
    const input = document.getElementById('workflowPhotoInput');
    if (!input) return;
    
    input.addEventListener('change', (e) => {
        workflowPhotoFiles = Array.from(e.target.files);
        renderSelectedPhotos();
    });
}

function renderSelectedPhotos() {
    const list = document.getElementById('selectedPhotoList');
    if (!list) return;
    
    if (workflowPhotoFiles.length === 0) {
        list.innerHTML = '<p style="color: #94a3b8; font-size: 13px;">未选择照片</p>';
        return;
    }
    
    list.innerHTML = `
        <p style="font-size: 13px; color: #475569; margin-bottom: 8px;">已选择 ${workflowPhotoFiles.length} 张照片：</p>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;">
            ${workflowPhotoFiles.map((f, i) => `
                <div style="padding: 8px; background: white; border-radius: 6px; font-size: 12px;">
                    🖼️ ${escapeHtml(f.name)}<br>
                    <span style="color: #94a3b8;">${(f.size / 1024).toFixed(1)} KB</span>
                </div>
            `).join('')}
        </div>
    `;
}

async function loadWorkflowPoints(step) {
    try {
        const res = await fetch(`${API_BASE}/points`);
        const data = await res.json();
        let points = data.points;
        
        const container = document.getElementById(`workflowStep${step}Points`);
        
        if (points.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📍</div>
                    <p>暂无点位，请先在「点位列表」创建点位</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = points.map(point => `
            <div class="point-select-item ${selectedWorkflowPoints.includes(point.id) ? 'selected' : ''}"
                 onclick="toggleWorkflowPoint('${point.id}', ${step})">
                <div>
                    <strong>${escapeHtml(point.name)}</strong>
                    <span class="status-tag status-${point.boundaryStatus}" style="margin-left: 10px;">
                        ${getBoundaryText(point.boundaryStatus)}
                    </span>
                </div>
                <div style="text-align: right;">
                    <span class="stage-tag">${getStageText(point.workflowStage)}</span>
                    <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">
                        📷 ${point.photos.length}张 | 🚌 ${point.busCardPeriods.length}条
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error(err);
    }
}

function toggleWorkflowPoint(pointId, step) {
    const idx = selectedWorkflowPoints.indexOf(pointId);
    if (idx === -1) {
        selectedWorkflowPoints.push(pointId);
    } else {
        selectedWorkflowPoints.splice(idx, 1);
    }
    
    loadWorkflowPoints(step);
    
    if (step === 1) {
        const section = document.getElementById('photoUploadSection');
        if (section) section.style.display = selectedWorkflowPoints.length > 0 ? 'block' : 'none';
    } else if (step === 2) {
        const section = document.getElementById('busCardSection');
        if (section) section.style.display = selectedWorkflowPoints.length > 0 ? 'block' : 'none';
    }
}

async function executeWorkflowStep(step) {
    if (selectedWorkflowPoints.length === 0) {
        alert('请先选择点位');
        return;
    }
    
    if (step === 1) {
        if (workflowPhotoFiles.length === 0) {
            alert('请先选择要上传的照片文件');
            return;
        }
        
        const step1Results = [];
        
        for (const pointId of selectedWorkflowPoints) {
            const formData = new FormData();
            formData.append('importedBy', '阿宁');
            workflowPhotoFiles.forEach(f => formData.append('photos', f));
            
            try {
                const res = await fetch(`${API_BASE}/points/${pointId}/photos`, {
                    method: 'POST',
                    body: formData
                });
                const result = await res.json();
                step1Results.push({ pointId, result });
            } catch (err) {
                step1Results.push({ pointId, error: err.message });
            }
        }
        
        const totalImported = step1Results.reduce((s, r) => s + (r.result?.importedCount || 0), 0);
        const totalDuplicated = step1Results.reduce((s, r) => s + (r.result?.duplicatedCount || 0), 0);
        
        workflowStepResults.step1 = {
            timestamp: new Date().toISOString(),
            pointsProcessed: selectedWorkflowPoints.length,
            photosSubmitted: workflowPhotoFiles.length,
            photosImported: totalImported,
            photosDuplicated: totalDuplicated,
            details: step1Results
        };
        
        const resultDiv = document.getElementById('step1Result');
        resultDiv.innerHTML = `
            <div style="padding: 16px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px;">
                <h4 style="color: #166534; margin-bottom: 12px;">✅ 步骤1完成：路口照片导入</h4>
                <p><strong>处理位点数：</strong>${selectedWorkflowPoints.length} 个</p>
                <p><strong>提交照片数：</strong>${workflowPhotoFiles.length} 张</p>
                <p><strong>新导入：</strong><span style="color: #166534; font-weight: 600;">${totalImported} 张</span></p>
                <p><strong>重复（已去重）：</strong><span style="color: #f59e0b; font-weight: 600;">${totalDuplicated} 张</span></p>
                <p style="margin-top: 10px; font-size: 13px; color: #64748b;">
                    💡 同一批照片重复导入不会让匹配数量翻倍，系统通过SHA256文件哈希自动去重
                </p>
            </div>
        `;
        
        workflowPhotoFiles = [];
        
    } else if (step === 2) {
        const period = document.getElementById('bcPeriod').value.trim();
        const volume = document.getElementById('bcVolume').value.trim();
        const notes = document.getElementById('bcNotes').value;
        const reason = document.getElementById('bcReason').value.trim() || '补充公交刷卡时段';
        
        if (!period) {
            alert('请填写时段');
            return;
        }
        
        const step2Results = [];
        
        for (const pointId of selectedWorkflowPoints) {
            try {
                const res = await fetch(`${API_BASE}/points/${pointId}/bus-cards`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        busCardData: {
                            period,
                            passengerVolume: volume,
                            rawText: notes,
                            notes
                        },
                        supplementedBy: '阿宁',
                        reason: reason
                    })
                });
                const result = await res.json();
                step2Results.push({ pointId, success: true, result });
            } catch (err) {
                step2Results.push({ pointId, success: false, error: err.message });
            }
        }
        
        const successCount = step2Results.filter(r => r.success).length;
        
        workflowStepResults.step2 = {
            timestamp: new Date().toISOString(),
            pointsProcessed: selectedWorkflowPoints.length,
            successCount,
            period,
            volume,
            rawNotes: notes,
            reason,
            details: step2Results
        };
        
        const resultDiv = document.getElementById('step2Result');
        resultDiv.innerHTML = `
            <div style="padding: 16px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px;">
                <h4 style="color: #166534; margin-bottom: 12px;">✅ 步骤2完成：补看公交刷卡时段</h4>
                <p><strong>处理位点数：</strong>${successCount}/${selectedWorkflowPoints.length} 个</p>
                <p><strong>时段：</strong>${escapeHtml(period)}</p>
                ${volume ? `<p><strong>客流量：</strong>${escapeHtml(volume)}</p>` : ''}
                ${notes ? `
                    <div style="margin-top: 10px; padding: 10px; background: #fef3c7; border-radius: 6px;">
                        <p style="font-weight: 600; color: #92400e; font-size: 13px;">📝 原始备注（完整保留，不会被清洗）：</p>
                        <p style="color: #78350f; white-space: pre-wrap;">${escapeHtml(notes)}</p>
                    </div>
                ` : ''}
                <p style="margin-top: 10px; font-size: 13px; color: #64748b;">
                    修改原因：${escapeHtml(reason)} | 修改人：阿宁
                </p>
                <p style="margin-top: 8px; font-size: 13px; color: #64748b;">
                    💡 版本历史已记录：改前文本、改后文本、修改原因、修改人、修改时间
                </p>
            </div>
        `;
        
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
            
            workflowStepResults.step3 = {
                timestamp: new Date().toISOString(),
                exportedBy: '阿宁',
                successCount,
                errorCount,
                details: result.exports
            };
            
            const resultDiv = document.getElementById('step3Result');
            resultDiv.innerHTML = `
                <div style="padding: 16px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px;">
                    <h4 style="color: #166534; margin-bottom: 12px;">✅ 步骤3完成：地图导出更新</h4>
                    <p><strong>导成功：</strong>${successCount} 个</p>
                    <p><strong>导出失败：</strong>${errorCount} 个</p>
                    ${errorCount > 0 ? `
                        <div style="margin-top: 10px; padding: 10px; background: #fee2e2; border-radius: 6px;">
                            <p style="font-weight: 600; color: #991b1b; font-size: 13px;">失败原因：</p>
                            ${result.exports.filter(e => e.error).map(e => `
                                <p style="color: #7f1d1d; font-size: 13px;">- ${escapeHtml(e.pointName)}: ${escapeHtml(e.error)}</p>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
            
            renderWorkflowFinalReport();
            
        } catch (err) {
            alert('导出失败: ' + err.message);
            return;
        }
    }
    
    loadPoints();
    loadStats();
    loadBoundaryPoints();
    
    if (step < 3) {
        setTimeout(() => initWorkflowStep(step + 1), 1500);
    }
}

function renderWorkflowFinalReport() {
    const s1 = workflowStepResults.step1;
    const s2 = workflowStepResults.step2;
    const s3 = workflowStepResults.step3;
    
    const container = document.getElementById('workflowFinalReport');
    if (!container) return;
    
    let photoDuplicates = [];
    if (s1 && s1.details) {
        for (const d of s1.details) {
            if (d.result && d.result.results) {
                for (const r of d.result.results) {
                    if (r.duplicated) {
                        photoDuplicates.push({
                            pointId: d.pointId,
                            pointName: d.pointName || '',
                            submittedFilename: r.submittedFilename || r.photoRecord?.originalFilename || '未知文件',
                            existingFilename: r.existingFilename || '未知文件',
                            existingPhotoId: r.existingPhotoId,
                            existingPointId: r.existingPointId,
                            existingPointName: r.existingPointName || '',
                            existingUploadedAt: r.existingUploadedAt
                        });
                    }
                }
            }
        }
    }
    
    container.innerHTML = `
        <div style="padding: 24px; background: linear-gradient(135deg, #eff6ff, #dbeafe); border-radius: 12px; border: 2px solid #2563eb;">
            <h3 style="color: #1e40af; margin-bottom: 16px; text-align: center;">📋 停车错峰共享匹配 - 三步工作流完成报告</h3>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
                <div style="padding: 12px; background: white; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; color: #2563eb;">1</div>
                    <div style="font-size: 13px; color: #475569;">路口照片导入</div>
                    <div style="font-size: 12px; color: #16a34a; font-weight: 600;">${s1 ? '✓ 已完成' : '○ 未执行'}</div>
                </div>
                <div style="padding: 12px; background: white; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; color: #2563eb;">2</div>
                    <div style="font-size: 13px; color: #475569;">补看公交刷卡时段</div>
                    <div style="font-size: 12px; color: #16a34a; font-weight: 600;">${s2 ? '✓ 已完成' : '○ 未执行'}</div>
                </div>
                <div style="padding: 12px; background: white; border-radius: 8px; text-align: center;">
                    <div style="font-size: 24px; font-weight: 700; color: #2563eb;">3</div>
                    <div style="font-size: 13px; color: #475569;">地图导出更新</div>
                    <div style="font-size: 12px; color: #16a34a; font-weight: 600;">${s3 ? '✓ 已完成' : '○ 未执行'}</div>
                </div>
            </div>
            
            ${s1 ? `
                <div style="padding: 16px; background: white; border-radius: 8px; margin-bottom: 12px;">
                    <h4 style="color: #1e40af; margin-bottom: 10px;">📷 步骤1：路口照片导入</h4>
                    <p style="font-size: 14px;"><strong>提交照片：</strong>${s1.photosSubmitted} 张</p>
                    <p style="font-size: 14px;"><strong>新导入：</strong><span style="color: #16a34a;">${s1.photosImported} 张</span></p>
                    <p style="font-size: 14px;"><strong>重复去重：</strong><span style="color: #f59e0b;">${s1.photosDuplicated} 张</span>（数量不翻倍）</p>
                    <p style="font-size: 14px;"><strong>处理时间：</strong>${formatTime(s1.timestamp)}</p>
                    <p style="font-size: 14px;"><strong>去重口径：</strong>SHA256文件哈希，同一文件重复上传自动识别</p>
                    ${photoDuplicates.length > 0 ? `
                        <div style="margin-top: 10px; padding: 10px; background: #fef3c7; border-radius: 6px;">
                            <p style="font-size: 13px; font-weight: 600; color: #92400e;">重复导入明细（来源 + 处理状态 + 结论）：</p>
                            ${photoDuplicates.map(d => `
                                <div style="font-size: 12px; color: #78350f; padding: 6px 0; border-bottom: 1px solid #fde68a;">
                                    <p><strong>本次提交文件：</strong>${escapeHtml(d.submittedFilename)}</p>
                                    <p><strong>处理状态：</strong><span style="color: #d97706;">重复，已去重，数量不翻倍</span></p>
                                    <p><strong>已有来源：</strong>${escapeHtml(d.existingPointName)} 点位的 ${escapeHtml(d.existingFilename)}（${formatTime(d.existingUploadedAt)}上传）</p>
                                    <p><strong>结论：</strong>通过SHA256文件哈希比对判定为同一文件，跳过导入</p>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            
            ${s2 ? `
                <div style="padding: 16px; background: white; border-radius: 8px; margin-bottom: 12px;">
                    <h4 style="color: #1e40af; margin-bottom: 10px;">🚌 步骤2：补看公交刷卡时段</h4>
                    <p style="font-size: 14px;"><strong>时段：</strong>${escapeHtml(s2.period)}</p>
                    <p style="font-size: 14px;"><strong>客流量：</strong>${escapeHtml(s2.volume || '未填写')}</p>
                    <p style="font-size: 14px;"><strong>修改原因：</strong>${escapeHtml(s2.reason)}</p>
                    <p style="font-size: 14px;"><strong>处理时间：</strong>${formatTime(s2.timestamp)}</p>
                    ${s2.rawNotes ? `
                        <div style="margin-top: 10px; padding: 10px; background: #fef3c7; border-radius: 6px;">
                            <p style="font-size: 13px; font-weight: 600; color: #92400e;">📝 原始备注（完整保留，未清洗）：</p>
                            <p style="font-size: 13px; color: #78350f; white-space: pre-wrap;">${escapeHtml(s2.rawNotes)}</p>
                        </div>
                    ` : ''}
                    <p style="margin-top: 8px; font-size: 12px; color: #64748b;">
                        💡 版本历史可查：改前文本 → 改后文本 → 修改原因 → 修改人 → 修改时间
                    </p>
                </div>
            ` : ''}
            
            ${s3 ? `
                <div style="padding: 16px; background: white; border-radius: 8px; margin-bottom: 12px;">
                    <h4 style="color: #1e40af; margin-bottom: 10px;">🗺️ 步骤3：地图导出更新</h4>
                    <p style="font-size: 14px;"><strong>导出成功：</strong>${s3.successCount} 个点位</p>
                    <p style="font-size: 14px;"><strong>导出失败：</strong>${s3.errorCount} 个点位</p>
                    <p style="font-size: 14px;"><strong>导出人：</strong>${escapeHtml(s3.exportedBy)}</p>
                    <p style="font-size: 14px;"><strong>导出时间：</strong>${formatTime(s3.timestamp)}</p>
                </div>
            ` : ''}
            
            <div style="padding: 16px; background: white; border-radius: 8px; border-left: 4px solid #2563eb;">
                <h4 style="color: #1e40af; margin-bottom: 10px;">📌 结论</h4>
                <p style="font-size: 14px; line-height: 1.8;">
                    三步工作流${s1 && s2 && s3 ? '<strong style="color: #16a34a;">全部完成</strong>' : '<strong style="color: #f59e0b;">部分完成</strong>'}。
                    ${s1 && s1.photosDuplicated > 0 ? `路口照片导入中检测到重复照片 <strong>${s1.photosDuplicated}</strong> 张，已通过SHA256哈希自动去重，匹配数量未翻倍。` : ''}
                    ${s2 ? `公交刷卡时段原始备注已完整保留在 <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">rawText</code> 字段，版本历史记录了改前改后差异。` : ''}
                    ${s3 && s3.errorCount > 0 ? `地图导出中有 <strong>${s3.errorCount}</strong> 个点位失败（通常为边界待复核状态），需项目经理确认归属后重新导出。` : ''}
                </p>
            </div>
        </div>
    `;
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
