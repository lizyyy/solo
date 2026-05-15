let currentSessionId = localStorage.getItem('currentSessionId') || null;
let apiLogHistory = [];

const API_BASE = '/api';

async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (data) options.body = JSON.stringify(data);
    
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const result = await response.json();
    
    apiLogHistory.unshift({
        time: new Date().toLocaleTimeString(),
        endpoint,
        method,
        request: data,
        response: result
    });
    if (apiLogHistory.length > 50) apiLogHistory.pop();
    
    updateApiLogPanel();
    return result;
}

function formatTime(timestamp) {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString();
}

function truncate(str, len = 15) {
    if (!str) return '-';
    return str.length > len ? str.substring(0, len) + '...' : str;
}

async function refreshAll() {
    await Promise.all([
        loadSessions(),
        loadAnomalies(),
        loadOnlineStats(),
        loadAuditLogs()
    ]);
}

async function loadOnlineStats() {
    const roomId = document.getElementById('roomId').value;
    
    const sessionsRes = await apiCall('/sessions');
    const anomaliesRes = await apiCall('/anomalies?status=pending');
    const onlineRes = await apiCall(`/rooms/${roomId}/online`);
    
    if (sessionsRes.success) {
        document.getElementById('sessionCount').textContent = sessionsRes.data.length;
    }
    if (anomaliesRes.success) {
        document.getElementById('anomalyCount').textContent = anomaliesRes.data.length;
    }
    if (onlineRes.success) {
        document.getElementById('onlineCount').textContent = onlineRes.data.onlineCount;
    }
}

async function connect() {
    const userId = document.getElementById('userId').value;
    const roomId = document.getElementById('roomId').value;
    const deviceType = document.getElementById('deviceType').value;
    const deviceId = `device_${Date.now()}`;
    
    const result = await apiCall('/session/connect', 'POST', {
        userId,
        roomId,
        deviceId,
        deviceType,
        deviceInfo: { userAgent: navigator.userAgent },
        ipAddress: '127.0.0.1'
    });
    
    if (result.success) {
        currentSessionId = result.data.sessionId;
        localStorage.setItem('currentSessionId', currentSessionId);
        document.getElementById('heartbeatCount').textContent = 
            parseInt(document.getElementById('heartbeatCount').textContent) + 1;
    }
    await refreshAll();
}

async function sendHeartbeat() {
    if (!currentSessionId) {
        alert('请先建立连接');
        return;
    }
    
    const userId = document.getElementById('userId').value;
    const roomId = document.getElementById('roomId').value;
    
    const result = await apiCall('/session/heartbeat', 'POST', {
        sessionId: currentSessionId,
        userId,
        roomId,
        payload: { 
            timestamp: Date.now(),
            page: 'document-editor'
        }
    });
    
    if (result.success) {
        document.getElementById('heartbeatCount').textContent = 
            parseInt(document.getElementById('heartbeatCount').textContent) + 1;
    }
    await refreshAll();
}

async function disconnect() {
    if (!currentSessionId) {
        alert('没有活动连接');
        return;
    }
    
    const result = await apiCall('/session/disconnect', 'POST', {
        sessionId: currentSessionId,
        reason: 'USER_INITIATED'
    });
    
    if (result.success) {
        currentSessionId = null;
        localStorage.removeItem('currentSessionId');
    }
    await refreshAll();
}

async function checkDisconnections() {
    const result = await apiCall('/rules/check-disconnections', 'POST');
    if (result.success && result.data.detected > 0) {
        alert(`检测到 ${result.data.detected} 个超时断线连接！`);
    } else if (result.success) {
        alert('没有检测到超时连接');
    }
    await refreshAll();
}

async function loadSessions() {
    const statusFilter = document.getElementById('sessionFilter').value;
    let endpoint = '/sessions';
    if (statusFilter) endpoint += `?status=${statusFilter}`;
    
    const result = await apiCall(endpoint);
    if (!result.success) return;
    
    const tbody = document.getElementById('sessionTable');
    const historySelect = document.getElementById('historySessionId');
    
    historySelect.innerHTML = '<option value="">请选择会话</option>';
    
    tbody.innerHTML = result.data.map(session => {
        historySelect.innerHTML += `<option value="${session.id}">${truncate(session.id, 12)} - ${session.user_id}</option>`;
        
        const statusBadge = session.status === 'connected' 
            ? '<span class="badge badge-connected">已连接</span>'
            : session.status === 'merged'
            ? '<span class="badge badge-medium">已合并</span>'
            : '<span class="badge badge-disconnected">已断开</span>';
        
        return `
            <tr>
                <td title="${session.id}">${truncate(session.id, 12)}</td>
                <td>${session.user_id}</td>
                <td>${session.room_id}</td>
                <td>${statusBadge}</td>
                <td>${formatTime(session.connected_at)}</td>
                <td>${session.disconnect_reason || '-'}</td>
                <td>
                    <button class="btn btn-primary" style="padding: 5px 10px; font-size: 12px;" onclick="advanceStatus('${session.id}')">推进状态</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function advanceStatus(sessionId) {
    const statuses = ['connecting', 'connected', 'idle', 'disconnecting'];
    const newStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    await apiCall('/status/advance', 'POST', {
        sessionId,
        newStatus,
        metadata: { manually: true }
    });
    
    await loadSessions();
}

async function loadAnomalies() {
    const result = await apiCall('/anomalies');
    if (!result.success) return;
    
    const tbody = document.getElementById('anomalyTable');
    tbody.innerHTML = result.data.map(anomaly => {
        const severityBadge = anomaly.severity === 'high' 
            ? '<span class="badge badge-high">高</span>'
            : '<span class="badge badge-medium">中</span>';
        
        const statusBadge = anomaly.status === 'pending'
            ? '<span class="badge badge-pending">待处理</span>'
            : '<span class="badge badge-resolved">已解决</span>';
        
        return `
            <tr>
                <td>${formatTime(anomaly.created_at)}</td>
                <td>${anomaly.type}</td>
                <td>${severityBadge}</td>
                <td>${anomaly.user_id || '-'}<br>${anomaly.room_id || '-'}</td>
                <td>${anomaly.description}</td>
                <td>${statusBadge}</td>
                <td>
                    ${anomaly.status === 'pending' 
                        ? `<button class="btn btn-success" style="padding: 5px 10px; font-size: 12px;" onclick="resolveAnomaly('${anomaly.id}')">解决</button>`
                        : '-'
                    }
                </td>
            </tr>
        `;
    }).join('');
}

async function resolveAnomaly(anomalyId) {
    await apiCall(`/anomalies/${anomalyId}/resolve`, 'POST');
    await refreshAll();
}

async function loadHistory() {
    const sessionId = document.getElementById('historySessionId').value;
    const timeline = document.getElementById('historyTimeline');
    
    if (!sessionId) {
        timeline.innerHTML = '<p style="color: #888;">选择会话查看详细历史轨迹</p>';
        return;
    }
    
    const result = await apiCall(`/history/${sessionId}`);
    if (!result.success) return;
    
    const { session, heartbeats, disconnectReason } = result.data;
    
    let events = [];
    
    if (session) {
        events.push({
            time: session.connected_at,
            action: '连接建立',
            detail: `状态: ${session.status}`
        });
    }
    
    heartbeats.forEach(hb => {
        events.push({
            time: hb.timestamp,
            action: '心跳',
            detail: `心跳ID: ${truncate(hb.id, 8)}`
        });
    });
    
    if (disconnectReason) {
        events.push({
            time: disconnectReason.detected_at,
            action: '连接断开',
            detail: disconnectReason.reason_message
        });
    }
    
    events.sort((a, b) => a.time - b.time);
    
    timeline.innerHTML = events.map(e => `
        <div class="timeline-item">
            <div class="timeline-action">${e.action}</div>
            <div class="timeline-time">${formatTime(e.time)}</div>
            <div style="font-size: 12px; color: #888; margin-top: 5px;">${e.detail}</div>
        </div>
    `).join('');
    
    if (events.length === 0) {
        timeline.innerHTML = '<p style="color: #888;">暂无历史记录</p>';
    }
}

async function loadSnapshots() {
    const roomId = document.getElementById('snapshotRoomId').value;
    const result = await apiCall(`/snapshots/${roomId}`);
    
    if (!result.success) return;
    
    const tbody = document.getElementById('snapshotTable');
    tbody.innerHTML = result.data.map(snap => `
        <tr>
            <td>${formatTime(snap.snapshot_at)}</td>
            <td><strong>${snap.online_count}</strong> 人在线</td>
        </tr>
    `).join('');
    
    if (result.data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="color: #888;">暂无快照记录</td></tr>';
    }
}

async function exportAudit() {
    const roomId = document.getElementById('exportRoomId').value || undefined;
    const userId = document.getElementById('exportUserId').value || undefined;
    
    const filters = {};
    if (roomId) filters.roomId = roomId;
    if (userId) filters.userId = userId;
    
    const result = await apiCall('/export', 'POST', filters);
    
    if (result.success) {
        const dataStr = JSON.stringify(result.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-export-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

async function loadAuditLogs() {
    const result = await apiCall('/audit-logs');
    if (!result.success) return;
    
    const panel = document.getElementById('auditLogPanel');
    panel.innerHTML = result.data.map(log => {
        const statusClass = log.status === 'success' ? 'log-success' : 'log-error';
        return `
            <div class="log-item ${statusClass}">
                [${formatTime(log.timestamp)}] ${log.action} | ${log.responsible_node} | Request: ${truncate(log.request_id, 10)}
            </div>
        `;
    }).join('');
}

function updateApiLogPanel() {
    const panel = document.getElementById('apiLogPanel');
    panel.innerHTML = apiLogHistory.map(log => `
        <div class="log-item log-success">
            [${log.time}] ${log.method} ${log.endpoint}
            <br><small style="color: #888;">Request: ${JSON.stringify(log.request || {})}</small>
        </div>
    `).join('');
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
}

window.onload = async () => {
    if (currentSessionId) {
        console.log('恢复会话:', currentSessionId);
    }
    await refreshAll();
    setInterval(refreshAll, 30000);
};
