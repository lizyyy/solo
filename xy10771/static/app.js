const API_BASE = '/api';
let statusChart = null;
let processingIds = new Set();

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function openAddModal() {
    openModal('addModal');
}

function getStatusLabel(status) {
    const labels = {
        'pending': '待处理',
        'sourcemap_checked': 'SourceMap已检查',
        'sourcemap_failed': 'SourceMap检查失败',
        'cache_checked': '缓存已检查',
        'cache_failed': '缓存检查失败',
        'rolled_back': '已回滚',
        'corrected': '已修正',
        'inspected': '已巡检'
    };
    return labels[status] || status;
}

async function fetchStats() {
    try {
        const res = await fetch(`${API_BASE}/stats`);
        const stats = await res.json();
        
        document.getElementById('totalBuilds').textContent = stats.totalBuilds;
        document.getElementById('totalInspections').textContent = stats.totalInspections;
        document.getElementById('pendingCount').textContent = stats.statusCounts.pending || 0;
        document.getElementById('rolledBackCount').textContent = stats.statusCounts.rolled_back || 0;
        
        updateChart(stats.statusCounts);
    } catch (err) {
        console.error('获取统计数据失败:', err);
    }
}

function updateChart(statusCounts) {
    const ctx = document.getElementById('statusChart').getContext('2d');
    const labels = [];
    const data = [];
    const colors = [];
    
    const colorMap = {
        'pending': '#f59e0b',
        'sourcemap_checked': '#10b981',
        'sourcemap_failed': '#ef4444',
        'cache_checked': '#10b981',
        'cache_failed': '#ef4444',
        'rolled_back': '#ef4444',
        'corrected': '#3b82f6',
        'inspected': '#10b981'
    };
    
    for (const [status, count] of Object.entries(statusCounts)) {
        if (count > 0) {
            labels.push(getStatusLabel(status));
            data.push(count);
            colors.push(colorMap[status] || '#667eea');
        }
    }
    
    if (statusChart) {
        statusChart.destroy();
    }
    
    statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

async function fetchBuildVersions() {
    try {
        const res = await fetch(`${API_BASE}/build-versions`);
        const versions = await res.json();
        renderBuildVersions(versions);
    } catch (err) {
        console.error('获取构建版本失败:', err);
        document.getElementById('buildVersionsTable').innerHTML = '<p style="color:red;">加载失败</p>';
    }
}

function renderBuildVersions(versions) {
    const container = document.getElementById('buildVersionsTable');
    
    if (versions.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:40px;color:#999;">暂无数据</p>';
        return;
    }
    
    let html = `
        <table class="table">
            <thead>
                <tr>
                    <th>版本号</th>
                    <th>项目</th>
                    <th>JS大小</th>
                    <th>SourceMap</th>
                    <th>状态</th>
                    <th>创建时间</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    for (const v of versions) {
        const isProcessing = processingIds.has(v.id);
        html += `
            <tr>
                <td><strong>${v.version}</strong></td>
                <td>${v.project}</td>
                <td>${v.jsSize} KB</td>
                <td>${v.hasSourceMap ? '✅' : '❌'}</td>
                <td><span class="status-badge status-${v.status}">${getStatusLabel(v.status)}</span></td>
                <td>${v.createdAt}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-primary" onclick="viewDetail('${v.id}')" ${isProcessing ? 'disabled' : ''}>详情</button>
                        ${renderActionButtons(v)}
                    </div>
                </td>
            </tr>
        `;
    }
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderActionButtons(v) {
    const isProcessing = processingIds.has(v.id);
    let buttons = '';
    
    if (v.status === 'pending') {
        buttons += `<button class="btn btn-warning" onclick="checkSourceMap('${v.id}')" ${isProcessing ? 'disabled' : ''}>检查SourceMap</button>`;
    }
    
    if (v.status === 'sourcemap_checked') {
        buttons += `<button class="btn btn-warning" onclick="checkCache('${v.id}')" ${isProcessing ? 'disabled' : ''}>检查缓存策略</button>`;
    }
    
    if (v.status === 'cache_failed') {
        buttons += `<button class="btn btn-danger" onclick="openRollbackModal('${v.id}')" ${isProcessing ? 'disabled' : ''}>回滚</button>`;
        buttons += `<button class="btn btn-success" onclick="openCorrectModal('${v.id}')" ${isProcessing ? 'disabled' : ''}>修正</button>`;
    }
    
    if (v.status === 'cache_checked' || v.status === 'corrected') {
        buttons += `<button class="btn btn-success" onclick="openInspectionModal('${v.id}')" ${isProcessing ? 'disabled' : ''}>生成巡检</button>`;
    }
    
    return buttons;
}

async function checkSourceMap(buildId) {
    if (processingIds.has(buildId)) {
        showToast('正在处理中，请稍候...', 'warning');
        return;
    }
    
    processingIds.add(buildId);
    renderBuildVersions(await fetchBuildVersionsRaw());
    
    try {
        const res = await fetch(`${API_BASE}/build-versions/${buildId}/check-sourcemap`, {
            method: 'POST'
        });
        
        if (res.ok) {
            const result = await res.json();
            if (result.passed) {
                showToast('SourceMap 检查通过！');
            } else {
                showToast('SourceMap 检查失败：JS资源较大但缺少SourceMap', 'warning');
            }
            await refreshData();
        } else {
            showToast('操作失败', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('操作失败', 'error');
    } finally {
        processingIds.delete(buildId);
        await refreshData();
    }
}

async function checkCache(buildId) {
    if (processingIds.has(buildId)) {
        showToast('正在处理中，请稍候...', 'warning');
        return;
    }
    
    processingIds.add(buildId);
    renderBuildVersions(await fetchBuildVersionsRaw());
    
    try {
        const res = await fetch(`${API_BASE}/build-versions/${buildId}/check-cache`, {
            method: 'POST'
        });
        
        if (res.ok) {
            const result = await res.json();
            if (!result.cacheFailed) {
                showToast('缓存策略检查通过！');
            } else {
                showToast('缓存策略检查失败，需要修正或回滚', 'warning');
            }
            await refreshData();
        } else {
            showToast('操作失败', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('操作失败', 'error');
    } finally {
        processingIds.delete(buildId);
        await refreshData();
    }
}

function openRollbackModal(buildId) {
    document.querySelector('#rollbackForm input[name="buildId"]').value = buildId;
    document.querySelector('#rollbackForm textarea[name="reason"]').value = '';
    openModal('rollbackModal');
}

function openCorrectModal(buildId) {
    document.querySelector('#correctForm input[name="buildId"]').value = buildId;
    document.querySelector('#correctForm select[name="action"]').value = '';
    document.querySelector('#correctForm textarea[name="description"]').value = '';
    openModal('correctModal');
}

function openInspectionModal(buildId) {
    document.querySelector('#inspectionForm input[name="buildId"]').value = buildId;
    document.querySelector('#inspectionForm input[name="inspector"]').value = '';
    document.querySelector('#inspectionForm select[name="result"]').value = '';
    document.querySelector('#inspectionForm input[name="issues"]').value = '';
    document.querySelector('#inspectionForm textarea[name="comments"]').value = '';
    openModal('inspectionModal');
}

async function viewDetail(buildId) {
    openModal('detailModal');
    const content = document.getElementById('detailContent');
    content.innerHTML = '<div class="loading">加载中...</div>';
    
    try {
        const [versionsRes, timelineRes] = await Promise.all([
            fetch(`${API_BASE}/build-versions`),
            fetch(`${API_BASE}/timeline/${buildId}`)
        ]);
        
        const versions = await versionsRes.json();
        const timeline = await timelineRes.json();
        const version = versions.find(v => v.id === buildId);
        
        if (!version) {
            content.innerHTML = '<p>版本不存在</p>';
            return;
        }
        
        content.innerHTML = renderDetailContent(version, timeline);
    } catch (err) {
        console.error(err);
        content.innerHTML = '<p style="color:red;">加载失败</p>';
    }
}

function renderDetailContent(version, timeline) {
    return `
        <div class="detail-grid">
            <div>
                <h4 style="margin-bottom:20px;">基本信息</h4>
                <table class="table">
                    <tr><td><strong>版本号</strong></td><td>${version.version}</td></tr>
                    <tr><td><strong>项目</strong></td><td>${version.project}</td></tr>
                    <tr><td><strong>JS大小</strong></td><td>${version.jsSize} KB</td></tr>
                    <tr><td><strong>CSS大小</strong></td><td>${version.cssSize} KB</td></tr>
                    <tr><td><strong>总大小</strong></td><td>${version.assetSize} KB</td></tr>
                    <tr><td><strong>SourceMap</strong></td><td>${version.hasSourceMap ? '✅ 有' : '❌ 无'}</td></tr>
                    <tr><td><strong>状态</strong></td><td><span class="status-badge status-${version.status}">${getStatusLabel(version.status)}</span></td></tr>
                    <tr><td><strong>创建时间</strong></td><td>${version.createdAt}</td></tr>
                </table>
                
                ${version.cacheStrategy ? `
                <h4 style="margin:20px 0 10px;">缓存策略</h4>
                <table class="table">
                    <tr><td><strong>文件哈希</strong></td><td>${version.cacheStrategy.hasHash ? '✅' : '❌'}</td></tr>
                    <tr><td><strong>Cache-Control</strong></td><td>${version.cacheStrategy.cacheControl || '-'}</td></tr>
                </table>
                ` : ''}
                
                ${version.rollbackReason ? `
                <h4 style="margin:20px 0 10px;">回滚信息</h4>
                <table class="table">
                    <tr><td><strong>回滚原因</strong></td><td>${version.rollbackReason}</td></tr>
                    <tr><td><strong>回滚时间</strong></td><td>${version.rollbackTime || '-'}</td></tr>
                </table>
                ` : ''}
                
                ${version.correctionPath ? `
                <h4 style="margin:20px 0 10px;">修正路径</h4>
                <table class="table">
                    <tr><td><strong>修正方案</strong></td><td>${version.correctionPath.action}</td></tr>
                    <tr><td><strong>详细说明</strong></td><td>${version.correctionPath.description}</td></tr>
                    <tr><td><strong>应用时间</strong></td><td>${version.correctionPath.appliedAt || '-'}</td></tr>
                </table>
                ` : ''}
            </div>
            <div>
                <h4 style="margin-bottom:20px;">📝 时间线</h4>
                <div class="timeline">
                    ${timeline.map(item => `
                        <div class="timeline-item">
                            <div class="timeline-time">${item.time}</div>
                            <div class="timeline-type">${item.type}</div>
                            <div class="timeline-desc">${item.description}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

async function fetchBuildVersionsRaw() {
    const res = await fetch(`${API_BASE}/build-versions`);
    return await res.json();
}

async function refreshData() {
    await Promise.all([fetchStats(), fetchBuildVersions()]);
}

document.getElementById('addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const data = {
        version: formData.get('version'),
        project: formData.get('project'),
        jsSize: parseFloat(formData.get('jsSize')),
        cssSize: parseFloat(formData.get('cssSize')),
        assetSize: parseFloat(formData.get('assetSize')),
        hasSourceMap: formData.get('hasSourceMap') === 'on',
        cacheStrategy: {
            hasHash: formData.get('hasHash') === 'true',
            cacheControl: formData.get('cacheControl')
        }
    };
    
    try {
        const res = await fetch(`${API_BASE}/build-versions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (res.ok) {
            showToast('版本录入成功！');
            closeModal('addModal');
            e.target.reset();
            await refreshData();
        } else {
            showToast('录入失败', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('录入失败', 'error');
    }
});

document.getElementById('rollbackForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const buildId = formData.get('buildId');
    
    if (processingIds.has(buildId)) {
        showToast('正在处理中，请稍候...', 'warning');
        return;
    }
    
    processingIds.add(buildId);
    
    try {
        const res = await fetch(`${API_BASE}/build-versions/${buildId}/rollback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: formData.get('reason') })
        });
        
        if (res.ok) {
            showToast('回滚成功！');
            closeModal('rollbackModal');
            await refreshData();
        } else {
            showToast('操作失败', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('操作失败', 'error');
    } finally {
        processingIds.delete(buildId);
        await refreshData();
    }
});

document.getElementById('correctForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const buildId = formData.get('buildId');
    
    if (processingIds.has(buildId)) {
        showToast('正在处理中，请稍候...', 'warning');
        return;
    }
    
    processingIds.add(buildId);
    
    try {
        const res = await fetch(`${API_BASE}/build-versions/${buildId}/correct`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: formData.get('action'),
                description: formData.get('description')
            })
        });
        
        if (res.ok) {
            showToast('修正方案已应用！');
            closeModal('correctModal');
            await refreshData();
        } else {
            showToast('操作失败', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('操作失败', 'error');
    } finally {
        processingIds.delete(buildId);
        await refreshData();
    }
});

document.getElementById('inspectionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const buildId = formData.get('buildId');
    
    if (processingIds.has(buildId)) {
        showToast('正在处理中，请稍候...', 'warning');
        return;
    }
    
    processingIds.add(buildId);
    
    const issuesStr = formData.get('issues');
    const issues = issuesStr ? issuesStr.split(/[,，]/).map(s => s.trim()).filter(Boolean) : [];
    
    try {
        const res = await fetch(`${API_BASE}/inspection-records`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                buildId: buildId,
                inspector: formData.get('inspector'),
                result: formData.get('result'),
                issues: issues,
                comments: formData.get('comments')
            })
        });
        
        if (res.ok) {
            showToast('巡检记录已生成！');
            closeModal('inspectionModal');
            await refreshData();
        } else {
            showToast('操作失败', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('操作失败', 'error');
    } finally {
        processingIds.delete(buildId);
        await refreshData();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    refreshData();
});
