const API_BASE = '/api';
let currentClusterId = null;
let eventTypes = {};

async function api(endpoint, options = {}) {
    try {
        const response = await fetch(API_BASE + endpoint, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, error: error.message };
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

function formatTime(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function formatTimeShort(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function openModal(title, content) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = content;
    document.getElementById('modal').classList.add('active');
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const section = tab.dataset.section;
        
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(`${section}-section`).classList.add('active');
        
        if (section === 'logs') {
            loadEventTypes();
        }
    });
});

document.getElementById('create-cluster-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const data = {
        name: formData.get('name'),
        description: formData.get('description'),
        loadBalancerStrategy: formData.get('loadBalancerStrategy'),
        healthCheckInterval: parseInt(formData.get('healthCheckInterval'))
    };
    
    const result = await api('/clusters', {
        method: 'POST',
        body: JSON.stringify(data)
    });
    
    if (result.success) {
        showToast('集群创建成功！');
        e.target.reset();
        await loadDashboard();
        await loadClusterSelects();
    } else {
        showToast(result.error || '创建失败', 'error');
    }
});

document.getElementById('register-instance-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const data = {
        clusterId: document.getElementById('instances-cluster-select').value,
        name: formData.get('name'),
        host: formData.get('host'),
        port: parseInt(formData.get('port')),
        role: formData.get('role'),
        weight: parseInt(formData.get('weight'))
    };
    
    const result = await api('/instances', {
        method: 'POST',
        body: JSON.stringify(data)
    });
    
    if (result.success) {
        showToast('实例注册成功！');
        e.target.reset();
        await loadInstances();
        await loadDashboard();
    } else {
        showToast(result.error || '注册失败', 'error');
    }
});

document.getElementById('send-requests-btn').addEventListener('click', async () => {
    const clusterId = document.getElementById('simulation-cluster-select').value;
    const count = parseInt(document.getElementById('request-count').value);
    
    if (!clusterId) {
        showToast('请先选择集群', 'warning');
        return;
    }
    
    const btn = document.getElementById('send-requests-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> 发送中...';
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < count; i++) {
        const result = await api(`/clusters/${clusterId}/route-request`, {
            method: 'POST',
            body: JSON.stringify({ requestId: `req-${Date.now()}-${i}` })
        });
        
        if (result.success) {
            successCount++;
        } else {
            failCount++;
        }
        
        if (i < count - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    btn.disabled = false;
    btn.textContent = '发送请求';
    
    showToast(`发送完成：成功 ${successCount} 次，失败 ${failCount} 次`, failCount > 0 ? 'warning' : 'success');
    
    await loadSimulationStats();
    await loadDashboard();
});

document.getElementById('kill-master-btn').addEventListener('click', async () => {
    const clusterId = document.getElementById('simulation-cluster-select').value;
    if (!clusterId) {
        showToast('请先选择集群', 'warning');
        return;
    }
    
    const result = await api(`/clusters/${clusterId}`, { method: 'GET' });
    if (!result.success) {
        showToast('获取集群信息失败', 'error');
        return;
    }
    
    const master = result.data.instances.find(i => i.role === 'MASTER' && i.status === 'HEALTHY');
    if (!master) {
        showToast('没有找到健康的主节点', 'warning');
        return;
    }
    
    if (!confirm(`确定要让主节点 ${master.name} 宕机吗？这将触发故障转移。`)) {
        return;
    }
    
    const killResult = await api(`/instances/${master.id}/set-down`, {
        method: 'POST',
        body: JSON.stringify({ reason: '手动模拟故障' })
    });
    
    if (killResult.success) {
        showToast(`主节点 ${master.name} 已宕机，故障转移已触发`);
        await loadSimulationStats();
        await loadDashboard();
    } else {
        showToast(killResult.error || '操作失败', 'error');
    }
});

document.getElementById('elect-master-btn').addEventListener('click', async () => {
    const clusterId = document.getElementById('simulation-cluster-select').value;
    if (!clusterId) {
        showToast('请先选择集群', 'warning');
        return;
    }
    
    if (!confirm('确定要手动选举新的主节点吗？')) {
        return;
    }
    
    const result = await api(`/clusters/${clusterId}/elect-master`, {
        method: 'POST',
        body: JSON.stringify({})
    });
    
    if (result.success) {
        showToast(`新主节点已选举：${result.data.newMaster.name}`);
        await loadSimulationStats();
        await loadDashboard();
    } else {
        showToast(result.error || '选举失败', 'error');
    }
});

document.getElementById('reset-connections-btn').addEventListener('click', async () => {
    const clusterId = document.getElementById('simulation-cluster-select').value;
    if (!clusterId) {
        showToast('请先选择集群', 'warning');
        return;
    }
    
    if (!confirm('确定要重置所有实例的连接数吗？')) {
        return;
    }
    
    const result = await api(`/clusters/${clusterId}`, { method: 'GET' });
    if (result.success) {
        for (const instance of result.data.instances) {
            await api(`/instances/${instance.id}/release-connection`, {
                method: 'POST',
                body: JSON.stringify({})
            });
        }
        showToast('连接数已重置');
        await loadSimulationStats();
    }
});

document.getElementById('refresh-logs-btn').addEventListener('click', loadLogs);
document.getElementById('clear-logs-btn').addEventListener('click', async () => {
    if (!confirm('确定要清空所有事件日志吗？')) {
        return;
    }
    
    const clusterId = document.getElementById('logs-cluster-select').value;
    const url = clusterId ? `/events?clusterId=${encodeURIComponent(clusterId)}` : '/events';
    
    const result = await api(url, { method: 'DELETE' });
    if (result.success) {
        showToast('日志已清空');
        await loadLogs();
    } else {
        showToast(result.error || '操作失败', 'error');
    }
});

document.getElementById('analyze-btn').addEventListener('click', async () => {
    const clusterId = document.getElementById('analysis-cluster-select').value;
    const url = clusterId ? `/events/analysis?clusterId=${encodeURIComponent(clusterId)}` : '/events/analysis';
    
    const result = await api(url, { method: 'GET' });
    
    if (result.success) {
        document.getElementById('analysis-result').style.display = 'block';
        document.getElementById('analysis-total').textContent = result.data.totalEvents;
        document.getElementById('analysis-requests').textContent = result.data.byType['REQUEST_ROUTED'] || 0;
        document.getElementById('analysis-failovers').textContent = result.data.byType['MASTER_FAILOVER'] || 0;
        document.getElementById('analysis-warnings').textContent = result.data.byType['CONFIG_WARNING'] || 0;
        
        let html = '<table style="width:100%;border-collapse:collapse;">';
        html += '<tr><th style="text-align:left;padding:8px;border-bottom:1px solid #444;">事件类型</th><th style="text-align:left;padding:8px;border-bottom:1px solid #444;">数量</th></tr>';
        
        for (const [type, count] of Object.entries(result.data.byType).sort((a, b) => b[1] - a[1])) {
            html += `<tr><td style="padding:8px;border-bottom:1px solid #333;">${type}</td><td style="padding:8px;border-bottom:1px solid #333;">${count}</td></tr>`;
        }
        html += '</table>';
        document.getElementById('analysis-events-distribution').innerHTML = html;
    } else {
        showToast(result.error || '分析失败', 'error');
    }
});

document.getElementById('export-json-btn').addEventListener('click', () => {
    const clusterId = document.getElementById('export-cluster-select').value;
    const url = clusterId ? `/api/clusters/${clusterId}/export/json` : '/api/export/json';
    window.open(url, '_blank');
});

document.getElementById('export-markdown-btn').addEventListener('click', () => {
    const clusterId = document.getElementById('export-cluster-select').value;
    const url = clusterId ? `/api/clusters/${clusterId}/export/markdown` : '/api/export/markdown';
    window.open(url, '_blank');
});

document.getElementById('load-seed-btn').addEventListener('click', async () => {
    if (!confirm('确定要加载示例数据吗？这不会删除现有数据。')) {
        return;
    }
    
    const result = await api('/seed', { method: 'POST' });
    
    if (result.success) {
        showToast('示例数据加载成功！');
        await loadDashboard();
        await loadClusterSelects();
    } else {
        showToast(result.error || '加载失败', 'error');
    }
});

['instances-cluster-select', 'simulation-cluster-select', 'logs-cluster-select', 'analysis-cluster-select', 'export-cluster-select'].forEach(id => {
    const select = document.getElementById(id);
    if (select) {
        select.addEventListener('change', async (e) => {
            const clusterId = e.target.value;
            
            if (id === 'instances-cluster-select') {
                document.getElementById('instances-content').style.display = clusterId ? 'block' : 'none';
                if (clusterId) await loadInstances();
            }
            
            if (id === 'simulation-cluster-select') {
                document.getElementById('simulation-content').style.display = clusterId ? 'block' : 'none';
                if (clusterId) await loadSimulationStats();
            }
        });
    }
});

async function loadDashboard() {
    const result = await api('/clusters', { method: 'GET' });
    
    if (!result.success) return;
    
    const clusters = result.data;
    let totalInstances = 0;
    let healthyInstances = 0;
    let unhealthyInstances = 0;
    const warnings = [];
    
    for (const cluster of clusters) {
        const clusterResult = await api(`/clusters/${cluster.id}`, { method: 'GET' });
        if (clusterResult.success) {
            totalInstances += clusterResult.data.instances.length;
            
            for (const instance of clusterResult.data.instances) {
                if (instance.status === 'HEALTHY') healthyInstances++;
                else unhealthyInstances++;
            }
            
            if (!cluster.hasMaster) {
                warnings.push({
                    type: 'warning',
                    text: `集群 "${cluster.name}" 没有主节点！`,
                    clusterId: cluster.id
                });
            } else if (cluster.instanceCount === 1) {
                warnings.push({
                    type: 'info',
                    text: `集群 "${cluster.name}" 只有一个实例，存在单点故障风险`,
                    clusterId: cluster.id
                });
            }
        }
    }
    
    document.getElementById('stat-clusters').textContent = clusters.length;
    document.getElementById('stat-instances').textContent = totalInstances;
    document.getElementById('stat-healthy').textContent = healthyInstances;
    document.getElementById('stat-unhealthy').textContent = unhealthyInstances;
    
    renderWarnings(warnings);
    renderClusters(clusters);
}

function renderWarnings(warnings) {
    const container = document.getElementById('warnings-container');
    
    if (warnings.length === 0) {
        container.innerHTML = '<div class="alert alert-success">✅ 所有集群配置正常</div>';
        return;
    }
    
    let html = '';
    for (const warning of warnings) {
        const alertClass = warning.type === 'warning' ? 'alert-warning' : 'alert-info';
        html += `<div class="alert ${alertClass}">${warning.text}</div>`;
    }
    container.innerHTML = html;
}

function renderClusters(clusters) {
    const container = document.getElementById('clusters-container');
    
    if (clusters.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">🏗️</div>
                <p>暂无集群，创建一个开始演练</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    for (const cluster of clusters) {
        const strategyIcon = {
            'ROUND_ROBIN': '🔄',
            'WEIGHTED_ROUND_ROBIN': '⚖️',
            'LEAST_CONNECTIONS': '📊',
            'RANDOM': '🎲'
        }[cluster.loadBalancerStrategy] || '📦';
        
        const healthPercent = cluster.instanceCount > 0 
            ? Math.round((cluster.healthyInstanceCount / cluster.instanceCount) * 100) 
            : 0;
        
        html += `
            <div class="cluster-item" data-id="${cluster.id}">
                <h4>${cluster.name}</h4>
                <div class="meta">
                    <span>📦 ${cluster.instanceCount} 个实例</span>
                    <span>✅ ${cluster.healthyInstanceCount} 健康</span>
                    <span>${strategyIcon} ${cluster.loadBalancerStrategy}</span>
                    ${cluster.hasMaster ? `<span>👑 ${cluster.masterName || '主节点'}</span>` : '<span style="color:#f59e0b;">⚠️ 无主节点</span>'}
                </div>
                <div style="margin-top:10px;">
                    <div class="connection-bar">
                        <div class="connection-bar-fill" style="width:${healthPercent}%;background:${healthPercent >= 80 ? '#10b981' : healthPercent >= 50 ? '#f59e0b' : '#ef4444'};"></div>
                    </div>
                    <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:0.8rem;color:#888;">
                        <span>健康率: ${healthPercent}%</span>
                        <span>创建: ${formatTimeShort(cluster.createdAt)}</span>
                    </div>
                </div>
                <div style="margin-top:12px;">
                    <button class="btn btn-sm btn-danger" onclick="deleteCluster('${cluster.id}')">删除</button>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

async function deleteCluster(clusterId) {
    if (!confirm('确定要删除此集群吗？所有实例和日志都将被删除。')) {
        return;
    }
    
    const result = await api(`/clusters/${clusterId}`, { method: 'DELETE' });
    if (result.success) {
        showToast('集群已删除');
        await loadDashboard();
        await loadClusterSelects();
    } else {
        showToast(result.error || '删除失败', 'error');
    }
}

async function loadClusterSelects() {
    const result = await api('/clusters', { method: 'GET' });
    if (!result.success) return;
    
    const clusters = result.data;
    
    ['instances-cluster-select', 'simulation-cluster-select', 'logs-cluster-select', 'analysis-cluster-select', 'export-cluster-select'].forEach(id => {
        const select = document.getElementById(id);
        if (select) {
            const currentValue = select.value;
            const firstOption = select.querySelector('option');
            let html = firstOption ? `<option value="${firstOption.value}">${firstOption.textContent}</option>` : '';
            
            for (const cluster of clusters) {
                html += `<option value="${cluster.id}">${cluster.name}</option>`;
            }
            select.innerHTML = html;
            if (clusters.find(c => c.id === currentValue)) {
                select.value = currentValue;
            }
        }
    });
}

async function loadEventTypes() {
    const result = await api('/events/types', { method: 'GET' });
    if (result.success) {
        eventTypes = result.data.eventTypes;
        const select = document.getElementById('logs-event-type');
        let html = '<option value="">全部类型</option>';
        for (const [key, _] of Object.entries(eventTypes)) {
            html += `<option value="${key}">${key}</option>`;
        }
        select.innerHTML = html;
    }
}

async function loadInstances() {
    const clusterId = document.getElementById('instances-cluster-select').value;
    if (!clusterId) return;
    
    const result = await api(`/instances?clusterId=${encodeURIComponent(clusterId)}`, { method: 'GET' });
    if (!result.success) return;
    
    renderInstances(result.data, 'instances-container');
}

function renderInstances(instances, containerId) {
    const container = document.getElementById(containerId);
    
    if (instances.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">⚙️</div>
                <p>暂无实例，注册一个开始演练</p>
            </div>
        `;
        return;
    }
    
    const sortedInstances = [...instances].sort((a, b) => {
        if (a.role === 'MASTER' && b.role !== 'MASTER') return -1;
        if (a.role !== 'MASTER' && b.role === 'MASTER') return 1;
        return a.name.localeCompare(b.name);
    });
    
    let html = '';
    for (const instance of sortedInstances) {
        const isMaster = instance.role === 'MASTER';
        const statusClass = instance.status.toLowerCase();
        const roleBadgeClass = isMaster ? 'master' : 'slave';
        const cardClasses = ['instance-card'];
        if (isMaster) cardClasses.push('master');
        if (statusClass === 'unhealthy') cardClasses.push('unhealthy');
        if (statusClass === 'down') cardClasses.push('down');
        
        html += `
            <div class="${cardClasses.join(' ')}">
                <div class="instance-header">
                    <div class="instance-name">
                        ${isMaster ? '👑' : '🔷'} ${instance.name}
                        <span class="role-badge ${roleBadgeClass}">${instance.role}</span>
                        <span class="status-badge ${statusClass}">${instance.status}</span>
                    </div>
                </div>
                <div class="instance-meta">
                    <span>📍 ${instance.host}:${instance.port}</span>
                    <span>⚖️ 权重: ${instance.weight}</span>
                    <span>🔗 连接: ${instance.connections}</span>
                    <span>📅 注册: ${formatTimeShort(instance.registeredAt)}</span>
                </div>
                <div class="instance-actions">
                    ${instance.status !== 'DOWN' && instance.status !== 'MAINTENANCE' ? 
                        `<button class="btn btn-sm btn-danger" onclick="setInstanceDown('${instance.id}')">💀 宕机</button>` : ''}
                    ${instance.status !== 'HEALTHY' ? 
                        `<button class="btn btn-sm btn-success" onclick="recoverInstance('${instance.id}')">🔧 恢复</button>` : ''}
                    <button class="btn btn-sm btn-warning" onclick="changeWeight('${instance.id}', ${instance.weight})">⚖️ 调整权重</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteInstance('${instance.id}')">🗑️ 删除</button>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

async function setInstanceDown(instanceId) {
    if (!confirm('确定要将此实例标记为宕机吗？')) {
        return;
    }
    
    const result = await api(`/instances/${instanceId}/set-down`, {
        method: 'POST',
        body: JSON.stringify({ reason: '手动操作' })
    });
    
    if (result.success) {
        showToast('实例已标记为宕机');
        await refreshCurrentView();
    } else {
        showToast(result.error || '操作失败', 'error');
    }
}

async function recoverInstance(instanceId) {
    if (!confirm('确定要恢复此实例吗？')) {
        return;
    }
    
    const result = await api(`/instances/${instanceId}/recover`, {
        method: 'POST',
        body: JSON.stringify({})
    });
    
    if (result.success) {
        showToast('实例已恢复');
        await refreshCurrentView();
    } else {
        showToast(result.error || '操作失败', 'error');
    }
}

async function changeWeight(instanceId, currentWeight) {
    const newWeight = prompt('请输入新的权重 (1-100):', currentWeight);
    if (newWeight === null) return;
    
    const weight = parseInt(newWeight);
    if (isNaN(weight) || weight < 1 || weight > 100) {
        showToast('权重必须在1-100之间', 'warning');
        return;
    }
    
    const result = await api(`/instances/${instanceId}/weight`, {
        method: 'PUT',
        body: JSON.stringify({ weight })
    });
    
    if (result.success) {
        showToast('权重已更新');
        await refreshCurrentView();
    } else {
        showToast(result.error || '操作失败', 'error');
    }
}

async function deleteInstance(instanceId) {
    if (!confirm('确定要删除此实例吗？')) {
        return;
    }
    
    const result = await api(`/instances/${instanceId}`, { method: 'DELETE' });
    if (result.success) {
        showToast('实例已删除');
        await refreshCurrentView();
    } else {
        showToast(result.error || '删除失败', 'error');
    }
}

async function refreshCurrentView() {
    await loadDashboard();
    await loadInstances();
    
    const simulationClusterId = document.getElementById('simulation-cluster-select').value;
    if (simulationClusterId) {
        await loadSimulationStats();
    }
}

async function loadSimulationStats() {
    const clusterId = document.getElementById('simulation-cluster-select').value;
    if (!clusterId) return;
    
    const [clusterResult, lbResult] = await Promise.all([
        api(`/clusters/${clusterId}`, { method: 'GET' }),
        api(`/clusters/${clusterId}/load-balancer-stats`, { method: 'GET' })
    ]);
    
    if (clusterResult.success) {
        const master = clusterResult.data.instances.find(i => i.role === 'MASTER');
        const masterHtml = master ? `
            <div style="padding:15px;background:rgba(245,158,11,0.1);border-radius:8px;border-left:4px solid #f59e0b;">
                <div style="font-weight:bold;margin-bottom:8px;">👑 当前主节点</div>
                <div style="color:#888;">名称: ${master.name}</div>
                <div style="color:#888;">地址: ${master.host}:${master.port}</div>
                <div style="color:#888;">状态: <span class="status-badge ${master.status.toLowerCase()}">${master.status}</span></div>
            </div>
        ` : '<div style="color:#f59e0b;">⚠️ 集群没有主节点</div>';
        
        document.getElementById('current-master-info').innerHTML = masterHtml;
        renderInstances(clusterResult.data.instances, 'simulation-instances-container');
    }
    
    if (lbResult.success) {
        const stats = lbResult.data;
        let html = `<div style="margin-bottom:15px;">
            <span style="font-weight:bold;">负载均衡策略:</span> ${stats.strategy}
            ${stats.roundRobinCounter !== undefined ? ` (轮询计数: ${stats.roundRobinCounter})` : ''}
        </div>`;
        
        html += '<table style="width:100%;border-collapse:collapse;">';
        html += '<tr><th style="text-align:left;padding:8px;border-bottom:1px solid #444;">实例</th><th style="text-align:left;padding:8px;border-bottom:1px solid #444;">角色</th><th style="text-align:left;padding:8px;border-bottom:1px solid #444;">状态</th><th style="text-align:left;padding:8px;border-bottom:1px solid #444;">权重</th><th style="text-align:left;padding:8px;border-bottom:1px solid #444;">权重占比</th><th style="text-align:left;padding:8px;border-bottom:1px solid #444;">连接数</th></tr>';
        
        for (const instance of stats.instances) {
            const isMaster = instance.role === 'MASTER';
            html += `<tr>`;
            html += `<td style="padding:8px;border-bottom:1px solid #333;">${isMaster ? '👑 ' : '🔷 '}${instance.name}</td>`;
            html += `<td style="padding:8px;border-bottom:1px solid #333;"><span class="role-badge ${isMaster ? 'master' : 'slave'}">${instance.role}</span></td>`;
            html += `<td style="padding:8px;border-bottom:1px solid #333;"><span class="status-badge ${instance.status.toLowerCase()}">${instance.status}</span></td>`;
            html += `<td style="padding:8px;border-bottom:1px solid #333;">${instance.weight}</td>`;
            html += `<td style="padding:8px;border-bottom:1px solid #333;">${instance.weightPercentage}%</td>`;
            html += `<td style="padding:8px;border-bottom:1px solid #333;">${instance.connections}</td>`;
            html += `</tr>`;
        }
        html += '</table>';
        
        document.getElementById('lb-stats-container').innerHTML = html;
    }
}

async function loadLogs() {
    const clusterId = document.getElementById('logs-cluster-select').value;
    const eventType = document.getElementById('logs-event-type').value;
    const severity = document.getElementById('logs-severity').value;
    const limit = parseInt(document.getElementById('logs-limit').value);
    
    let url = `/events?limit=${limit}`;
    if (clusterId) url += `&clusterId=${encodeURIComponent(clusterId)}`;
    if (eventType) url += `&eventType=${encodeURIComponent(eventType)}`;
    if (severity) url += `&severity=${encodeURIComponent(severity)}`;
    
    const result = await api(url, { method: 'GET' });
    if (!result.success) return;
    
    const logs = result.data;
    const container = document.getElementById('logs-container');
    
    if (logs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="icon">📋</div>
                <p>暂无事件日志</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    for (const log of logs) {
        const severityClass = log.severity.toLowerCase();
        html += `
            <div class="event-log ${severityClass}">
                <div class="event-time">${formatTime(log.timestamp)}</div>
                <div class="event-message"><strong>[${log.eventType}]</strong> ${log.message}</div>
                ${log.details && Object.keys(log.details).length > 0 ? `
                    <details style="margin-top:8px;">
                        <summary style="cursor:pointer;color:#888;">查看详情</summary>
                        <div class="event-details">${JSON.stringify(log.details, null, 2)}</div>
                    </details>
                ` : ''}
            </div>
        `;
    }
    container.innerHTML = html;
}

window.deleteCluster = deleteCluster;
window.setInstanceDown = setInstanceDown;
window.recoverInstance = recoverInstance;
window.changeWeight = changeWeight;
window.deleteInstance = deleteInstance;
window.closeModal = closeModal;

async function init() {
    await loadDashboard();
    await loadClusterSelects();
    await loadEventTypes();
}

init();
