class WebRTCReplayApp {
    constructor() {
        this.apiBase = window.location.origin;
        this.currentSessionId = null;
        this.sessionData = null;
        this.validationResults = null;
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.checkHealth();
        this.loadSavedReplays();
    }
    
    bindEvents() {
        document.getElementById('health-check-btn').addEventListener('click', () => this.checkHealth());
        
        document.getElementById('new-session-btn').addEventListener('click', () => this.createNewSession());
        document.getElementById('start-quick-btn').addEventListener('click', () => this.createQuickSession());
        document.getElementById('load-replays-btn').addEventListener('click', () => this.loadSavedReplays());
        
        document.getElementById('import-file').addEventListener('change', (e) => this.handleFileImport(e));
        document.getElementById('manual-import-btn').addEventListener('click', () => this.showModal('manual-import-modal'));
        document.getElementById('confirm-import-btn').addEventListener('click', () => this.handleManualImport());
        
        document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', () => this.hideModal());
        });
        document.getElementById('modal-overlay').addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') this.hideModal();
        });
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        document.getElementById('validate-btn').addEventListener('click', () => this.runValidation());
        document.getElementById('save-btn').addEventListener('click', () => this.saveSession());
        document.getElementById('export-btn').addEventListener('click', () => this.showModal('export-modal'));
        
        document.getElementById('export-md-btn').addEventListener('click', () => this.exportMarkdown());
        document.getElementById('export-audit-btn').addEventListener('click', () => this.exportAudit());
        document.getElementById('export-jsonl-btn').addEventListener('click', () => this.exportJSONL());
        
        document.getElementById('inject-latency-btn').addEventListener('click', () => this.injectLatency());
        document.getElementById('inject-loss-btn').addEventListener('click', () => this.injectPacketLoss());
        document.getElementById('inject-disconnect-btn').addEventListener('click', () => this.injectDisconnect());
        
        document.getElementById('raw-data-type').addEventListener('change', () => this.updateRawDataDisplay());
        document.getElementById('copy-raw-btn').addEventListener('click', () => this.copyRawData());
        
        document.getElementById('event-filter').addEventListener('input', () => this.filterEvents());
        document.getElementById('event-type-filter').addEventListener('change', () => this.filterEvents());
    }
    
    async apiRequest(endpoint, options = {}) {
        const url = `${this.apiBase}${endpoint}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }
        
        return response.json();
    }
    
    async checkHealth() {
        const statusEl = document.getElementById('health-status');
        try {
            const result = await this.apiRequest('/api/health');
            statusEl.style.color = '#22c55e';
            statusEl.title = '服务正常';
            this.showToast('服务连接正常', 'success');
        } catch (error) {
            statusEl.style.color = '#ef4444';
            statusEl.title = '服务异常';
            this.showToast('无法连接到服务器', 'error');
        }
    }
    
    async createNewSession() {
        try {
            const result = await this.apiRequest('/api/sessions', {
                method: 'POST',
                body: JSON.stringify({
                    name: `Session-${Date.now().toString(36).toUpperCase()}`,
                    description: '新建会话',
                }),
            });
            
            this.currentSessionId = result.sessionId;
            this.showToast(`会话创建成功: ${result.name}`, 'success');
            await this.loadSession(this.currentSessionId);
            await this.refreshSessionList();
        } catch (error) {
            this.showToast(`创建会话失败: ${error.message}`, 'error');
        }
    }
    
    async createQuickSession() {
        try {
            const result = await this.apiRequest('/api/sessions', {
                method: 'POST',
                body: JSON.stringify({
                    name: '示例会话 - 包含演示数据',
                    description: '快速创建的示例会话，包含预设演示数据',
                }),
            });
            
            this.currentSessionId = result.sessionId;
            
            const demoEvents = this.getDemoEvents();
            await this.apiRequest(`/api/sessions/${this.currentSessionId}/import`, {
                method: 'POST',
                body: JSON.stringify({
                    data: demoEvents,
                    type: 'events',
                }),
            });
            
            this.showToast('示例会话创建成功，已注入演示数据', 'success');
            await this.loadSession(this.currentSessionId);
            await this.refreshSessionList();
        } catch (error) {
            this.showToast(`创建会话失败: ${error.message}`, 'error');
        }
    }
    
    async loadSession(sessionId) {
        this.currentSessionId = sessionId;
        
        try {
            const result = await this.apiRequest(`/api/sessions/${sessionId}`);
            this.sessionData = result;
            
            this.showSessionView();
            this.updateSessionUI();
            await this.refreshSessionList();
        } catch (error) {
            this.showToast(`加载会话失败: ${error.message}`, 'error');
        }
    }
    
    async refreshSessionList() {
        try {
            const result = await this.apiRequest('/api/sessions');
            this.renderSessionList(result.sessions);
        } catch (error) {
            console.error('Failed to refresh session list:', error);
        }
    }
    
    renderSessionList(sessions) {
        const container = document.getElementById('session-list');
        
        if (sessions.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无活动会话</div>';
            return;
        }
        
        container.innerHTML = sessions.map(session => `
            <div class="session-item ${session.sessionId === this.currentSessionId ? 'active' : ''}" 
                 data-id="${session.sessionId}">
                <div class="session-name">${session.name}</div>
                <div class="session-meta">
                    状态: ${session.currentState} | 事件: ${session.eventCount}
                </div>
            </div>
        `).join('');
        
        container.querySelectorAll('.session-item').forEach(item => {
            item.addEventListener('click', () => this.loadSession(item.dataset.id));
        });
    }
    
    async loadSavedReplays() {
        try {
            const result = await this.apiRequest('/api/replays');
            this.renderReplayList(result.replays);
        } catch (error) {
            this.showToast(`加载复盘列表失败: ${error.message}`, 'error');
        }
    }
    
    renderReplayList(replays) {
        const container = document.getElementById('replay-list');
        
        if (replays.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无保存的复盘</div>';
            return;
        }
        
        container.innerHTML = replays.map(replay => `
            <div class="replay-item" data-id="${replay.id}">
                <div class="replay-name">${replay.name}</div>
                <div class="replay-meta">
                    ${new Date(replay.savedAt).toLocaleString()} | ${replay.eventCount} 个事件
                </div>
            </div>
        `).join('');
        
        container.querySelectorAll('.replay-item').forEach(item => {
            item.addEventListener('click', () => this.loadReplay(item.dataset.id));
        });
    }
    
    async loadReplay(replayId) {
        try {
            const result = await this.apiRequest(`/api/replays/${replayId}`);
            this.currentSessionId = result.sessionId;
            
            this.showToast('复盘加载成功', 'success');
            await this.loadSession(this.currentSessionId);
        } catch (error) {
            this.showToast(`加载复盘失败: ${error.message}`, 'error');
        }
    }
    
    async handleFileImport(event) {
        if (!this.currentSessionId) {
            this.showToast('请先创建或选择一个会话', 'warning');
            return;
        }
        
        const files = event.target.files;
        const importType = document.getElementById('import-type').value;
        
        for (const file of files) {
            try {
                const content = await this.readFileAsText(file);
                
                const result = await this.apiRequest(`/api/sessions/${this.currentSessionId}/import`, {
                    method: 'POST',
                    body: JSON.stringify({
                        data: content,
                        type: importType,
                    }),
                });
                
                this.showToast(`文件 ${file.name} 导入成功: ${result.imported} 条记录`, 'success');
                await this.loadSession(this.currentSessionId);
            } catch (error) {
                this.showToast(`文件 ${file.name} 导入失败: ${error.message}`, 'error');
            }
        }
        
        event.target.value = '';
    }
    
    async handleManualImport() {
        if (!this.currentSessionId) {
            this.showToast('请先创建或选择一个会话', 'warning');
            return;
        }
        
        const importType = document.getElementById('manual-import-type').value;
        const data = document.getElementById('manual-import-data').value.trim();
        
        if (!data) {
            this.showToast('请输入数据内容', 'warning');
            return;
        }
        
        try {
            const result = await this.apiRequest(`/api/sessions/${this.currentSessionId}/import`, {
                method: 'POST',
                body: JSON.stringify({
                    data: data,
                    type: importType,
                }),
            });
            
            this.showToast(`导入成功: ${result.imported} 条记录`, 'success');
            this.hideModal();
            document.getElementById('manual-import-data').value = '';
            await this.loadSession(this.currentSessionId);
        } catch (error) {
            this.showToast(`导入失败: ${error.message}`, 'error');
        }
    }
    
    async runValidation() {
        if (!this.currentSessionId) return;
        
        try {
            const result = await this.apiRequest(`/api/sessions/${this.currentSessionId}/validate`, {
                method: 'POST',
            });
            
            this.validationResults = result.validation;
            this.updateValidationUI();
            this.showToast('校验完成', 'success');
        } catch (error) {
            this.showToast(`校验失败: ${error.message}`, 'error');
        }
    }
    
    async saveSession() {
        if (!this.currentSessionId) return;
        
        try {
            const result = await this.apiRequest(`/api/sessions/${this.currentSessionId}/save`, {
                method: 'POST',
            });
            
            this.showToast('复盘已保存', 'success');
            await this.loadSavedReplays();
        } catch (error) {
            this.showToast(`保存失败: ${error.message}`, 'error');
        }
    }
    
    async exportMarkdown() {
        if (!this.currentSessionId) return;
        
        try {
            const result = await this.apiRequest(`/api/sessions/${this.currentSessionId}/export?format=markdown`);
            this.downloadFile(result.data, `${result.sessionName || 'report'}.md`, 'text/markdown');
            this.hideModal();
            this.showToast('Markdown 报告已导出', 'success');
        } catch (error) {
            this.showToast(`导出失败: ${error.message}`, 'error');
        }
    }
    
    async exportAudit() {
        if (!this.currentSessionId) return;
        
        try {
            const result = await this.apiRequest(`/api/sessions/${this.currentSessionId}/export?format=audit`);
            this.downloadFile(JSON.stringify(result.data, null, 2), `audit_${Date.now()}.json`, 'application/json');
            this.hideModal();
            this.showToast('审计包已导出', 'success');
        } catch (error) {
            this.showToast(`导出失败: ${error.message}`, 'error');
        }
    }
    
    async exportJSONL() {
        if (!this.currentSessionId) return;
        
        try {
            const result = await this.apiRequest(`/api/sessions/${this.currentSessionId}/export?format=jsonl`);
            this.downloadFile(result.data, `events_${Date.now()}.jsonl`, 'application/jsonl');
            this.hideModal();
            this.showToast('JSONL 事件流已导出', 'success');
        } catch (error) {
            this.showToast(`导出失败: ${error.message}`, 'error');
        }
    }
    
    async injectLatency() {
        if (!this.currentSessionId) return;
        
        const latency = parseInt(document.getElementById('inject-latency').value) || 500;
        const duration = parseInt(document.getElementById('inject-latency-duration').value) || 10000;
        
        try {
            await this.apiRequest(`/api/sessions/${this.currentSessionId}/network-inject`, {
                method: 'POST',
                body: JSON.stringify({
                    type: 'latency',
                    latency,
                    duration,
                }),
            });
            
            this.showToast(`延迟注入成功: ${latency}ms`, 'success');
            await this.loadSession(this.currentSessionId);
        } catch (error) {
            this.showToast(`注入失败: ${error.message}`, 'error');
        }
    }
    
    async injectPacketLoss() {
        if (!this.currentSessionId) return;
        
        const lossPercent = parseInt(document.getElementById('inject-loss').value) || 10;
        const duration = parseInt(document.getElementById('inject-loss-duration').value) || 10000;
        
        try {
            await this.apiRequest(`/api/sessions/${this.currentSessionId}/network-inject`, {
                method: 'POST',
                body: JSON.stringify({
                    type: 'packet_loss',
                    packetLoss: lossPercent / 100,
                    duration,
                }),
            });
            
            this.showToast(`丢包注入成功: ${lossPercent}%`, 'success');
            await this.loadSession(this.currentSessionId);
        } catch (error) {
            this.showToast(`注入失败: ${error.message}`, 'error');
        }
    }
    
    async injectDisconnect() {
        if (!this.currentSessionId) return;
        
        const duration = parseInt(document.getElementById('inject-disconnect-duration').value) || 5000;
        
        try {
            await this.apiRequest(`/api/sessions/${this.currentSessionId}/network-inject`, {
                method: 'POST',
                body: JSON.stringify({
                    type: 'disconnect',
                    duration,
                }),
            });
            
            this.showToast(`断网模拟成功: ${duration}ms`, 'success');
            await this.loadSession(this.currentSessionId);
        } catch (error) {
            this.showToast(`注入失败: ${error.message}`, 'error');
        }
    }
    
    showSessionView() {
        document.getElementById('no-session-view').classList.add('hidden');
        document.getElementById('session-view').classList.remove('hidden');
    }
    
    updateSessionUI() {
        if (!this.sessionData) return;
        
        const { sessionInfo, connectionState, events } = this.sessionData;
        
        document.getElementById('session-title').textContent = sessionInfo.name;
        document.getElementById('session-id').textContent = `ID: ${sessionInfo.sessionId}`;
        
        this.updateStats();
        this.updateNegotiationSequence();
        this.updateTracks();
        this.updateTimeline();
        this.updateInjectionHistory();
        this.updateRawDataDisplay();
    }
    
    updateStats() {
        const stats = this.sessionData.events?.length > 0 ? 
            this.getStatsFromEvents() : 
            { connectionState: 'new', eventCount: 0, reconnects: 0, duration: 0 };
        
        const stateEl = document.getElementById('stat-connection-state');
        stateEl.textContent = this.sessionData.connectionState || 'new';
        stateEl.className = `stat-value state-${this.sessionData.connectionState || 'new'}`;
        
        document.getElementById('stat-event-count').textContent = this.sessionData.events?.length || 0;
        
        const reconnectEvents = this.sessionData.events?.filter(e => e.type === 'reconnect_start') || [];
        document.getElementById('stat-reconnects').textContent = reconnectEvents.length;
        
        const duration = this.calculateDuration();
        document.getElementById('stat-duration').textContent = this.formatDuration(duration);
        
        const detailedStats = document.getElementById('detailed-stats');
        detailedStats.innerHTML = `
            <tr><td>当前连接状态</td><td class="state-${this.sessionData.connectionState || 'new'}">${this.sessionData.connectionState || 'new'}</td></tr>
            <tr><td>Offer 数量</td><td>${this.countEventsByType('offer')}</td></tr>
            <tr><td>Answer 数量</td><td>${this.countEventsByType('answer')}</td></tr>
            <tr><td>ICE Candidate 数量</td><td>${this.countEventsByType('ice_candidate')}</td></tr>
            <tr><td>Track 数量</td><td>${this.countEventsByType('track')}</td></tr>
            <tr><td>录制相关事件</td><td>${this.countRecordingEvents()}</td></tr>
            <tr><td>网络注入事件</td><td>${this.countEventsByType('network_injection')}</td></tr>
        `;
    }
    
    updateNegotiationSequence() {
        const sequence = [];
        const events = this.sessionData.events || [];
        
        for (const event of events) {
            if (event.type === 'offer' || event.type === 'answer') {
                sequence.push(event);
            }
        }
        
        const container = document.getElementById('negotiation-sequence');
        
        if (sequence.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无协商数据</div>';
            return;
        }
        
        container.innerHTML = sequence.map((event, index) => `
            <div class="sequence-item">
                <span class="sequence-type ${event.type}">${event.type.toUpperCase()}</span>
                <span class="sequence-time">#${index + 1} - ${new Date(event.timestamp).toLocaleTimeString()}</span>
            </div>
        `).join('');
    }
    
    updateTracks() {
        const trackEvents = this.sessionData.events?.filter(e => e.type === 'track') || [];
        const container = document.getElementById('tracks-list');
        
        if (trackEvents.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无媒体轨道</div>';
            return;
        }
        
        container.innerHTML = trackEvents.map((event, index) => `
            <div class="track-item">
                <span class="track-icon">${event.kind === 'audio' ? '🔊' : '🎥'}</span>
                <div class="track-info">
                    <div class="track-kind">${event.kind === 'audio' ? '音频' : '视频'} 轨道</div>
                    <div class="track-label">ID: ${event.trackId || event.id || `track-${index}`}</div>
                </div>
            </div>
        `).join('');
    }
    
    updateTimeline() {
        const events = this.sessionData.events || [];
        const container = document.getElementById('event-timeline');
        
        if (events.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无事件数据</div>';
            return;
        }
        
        this.allEvents = events;
        this.renderTimeline(events);
    }
    
    renderTimeline(events) {
        const container = document.getElementById('event-timeline');
        
        container.innerHTML = events.map((event, index) => {
            const relativeTime = event.relativeTimestamp || (index === 0 ? 0 : null);
            const timeDisplay = relativeTime !== null ? 
                `+${this.formatDuration(relativeTime)}` : 
                new Date(event.timestamp).toLocaleTimeString();
            
            let content = event.type;
            let details = null;
            
            if (event.state) {
                content += ` → ${event.state}`;
            }
            if (event.kind) {
                content += ` (${event.kind})`;
            }
            
            if (event.sdp) {
                details = event.sdp.substring(0, 200) + (event.sdp.length > 200 ? '...' : '');
            }
            if (event.candidate) {
                details = event.candidate;
            }
            
            return `
                <div class="timeline-item" data-index="${index}">
                    <div class="timeline-time">${timeDisplay}</div>
                    <span class="timeline-type">${event.type}</span>
                    <div class="timeline-content">${content}</div>
                    ${details ? `<div class="timeline-details">${this.escapeHtml(details)}</div>` : ''}
                </div>
            `;
        }).join('');
    }
    
    filterEvents() {
        if (!this.allEvents) return;
        
        const searchText = document.getElementById('event-filter').value.toLowerCase();
        const typeFilter = document.getElementById('event-type-filter').value;
        
        let filtered = this.allEvents;
        
        if (typeFilter) {
            filtered = filtered.filter(e => e.type === typeFilter);
        }
        
        if (searchText) {
            filtered = filtered.filter(e => 
                e.type.toLowerCase().includes(searchText) ||
                (e.state && e.state.toLowerCase().includes(searchText)) ||
                (e.kind && e.kind.toLowerCase().includes(searchText))
            );
        }
        
        this.renderTimeline(filtered);
    }
    
    updateInjectionHistory() {
        const injections = this.sessionData.events?.filter(e => e.type === 'network_injection') || [];
        const container = document.getElementById('injection-history');
        
        if (injections.length === 0) {
            container.innerHTML = '<div class="empty-state">暂无注入事件</div>';
            return;
        }
        
        const typeLabels = {
            'latency': '延迟',
            'packet_loss': '丢包',
            'disconnect': '断网',
        };
        
        container.innerHTML = injections.map((injection, index) => `
            <div class="injection-item">
                <div>
                    <span class="type">${typeLabels[injection.injectionType] || injection.injectionType}</span>
                    <span class="meta">
                        ${injection.latency ? `${injection.latency}ms` : ''}
                        ${injection.packetLoss ? `${(injection.packetLoss * 100).toFixed(0)}%` : ''}
                    </span>
                </div>
                <span class="meta">${new Date(injection.timestamp).toLocaleTimeString()}</span>
            </div>
        `).join('');
    }
    
    updateValidationUI() {
        if (!this.validationResults) return;
        
        const { summary, rules } = this.validationResults;
        
        document.getElementById('val-errors').textContent = summary.errors;
        document.getElementById('val-warnings').textContent = summary.warnings;
        document.getElementById('val-infos').textContent = summary.infos;
        
        const container = document.getElementById('validation-results');
        
        container.innerHTML = rules.map(rule => {
            const severityClass = rule.severity;
            const passedClass = rule.passed ? 'success' : 'failed';
            
            let detailsContent = '';
            if (rule.details && typeof rule.details === 'object' && Object.keys(rule.details).length > 0) {
                detailsContent = `<div class="validation-details">${JSON.stringify(rule.details, null, 2)}</div>`;
            }
            
            return `
                <div class="validation-item ${severityClass}">
                    <div class="validation-header">
                        <span class="validation-rule">${rule.rule}</span>
                        <span class="validation-status ${passedClass}">${rule.passed ? '通过' : '失败'}</span>
                    </div>
                    <div class="validation-message">${rule.message}</div>
                    ${detailsContent}
                </div>
            `;
        }).join('');
    }
    
    updateRawDataDisplay() {
        const dataType = document.getElementById('raw-data-type').value;
        const container = document.getElementById('raw-data-display').querySelector('code');
        
        let data = {};
        
        switch (dataType) {
            case 'all':
                data = this.sessionData || {};
                break;
            case 'events':
                data = this.sessionData?.events || [];
                break;
            case 'offers':
                data = this.sessionData?.events?.filter(e => e.type === 'offer') || [];
                break;
            case 'answers':
                data = this.sessionData?.events?.filter(e => e.type === 'answer') || [];
                break;
            case 'ice_candidates':
                data = this.sessionData?.events?.filter(e => e.type === 'ice_candidate') || [];
                break;
            case 'validation':
                data = this.validationResults || '请先运行校验';
                break;
        }
        
        container.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    }
    
    copyRawData() {
        const codeEl = document.getElementById('raw-data-display').querySelector('code');
        navigator.clipboard.writeText(codeEl.textContent).then(() => {
            this.showToast('已复制到剪贴板', 'success');
        }).catch(() => {
            this.showToast('复制失败', 'error');
        });
    }
    
    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `tab-${tabName}`);
        });
        
        if (tabName === 'raw') {
            this.updateRawDataDisplay();
        }
    }
    
    showModal(modalId) {
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
        document.getElementById(modalId).classList.remove('hidden');
    }
    
    hideModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    }
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
        };
        
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icons[type]}</span>
            <span class="toast-message">${message}</span>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    downloadFile(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }
    
    countEventsByType(type) {
        return this.sessionData.events?.filter(e => e.type === type).length || 0;
    }
    
    countRecordingEvents() {
        const recordingTypes = ['recording_start', 'recording_stop', 'recording_gap'];
        return this.sessionData.events?.filter(e => recordingTypes.includes(e.type)).length || 0;
    }
    
    calculateDuration() {
        const events = this.sessionData.events || [];
        if (events.length < 2) return 0;
        return events[events.length - 1].timestamp - events[0].timestamp;
    }
    
    formatDuration(ms) {
        if (!ms || ms < 0) return '--';
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        const minutes = Math.floor(ms / 60000);
        const seconds = ((ms % 60000) / 1000).toFixed(0);
        return `${minutes}m ${seconds}s`;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    getDemoEvents() {
        const baseTime = Date.now() - 120000;
        
        return [
            { type: 'offer', sdp: 'v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0 1\r\na=msid-semantic: WMS\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nc=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\na=ice-ufrag:demo\r\na=ice-pwd:demodemodemodemo\r\na=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00\r\na=setup:actpass\r\na=mid:0\r\na=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r\na=sendrecv\r\na=rtpmap:111 opus/48000/2\r\n', timestamp: baseTime },
            { type: 'ice_connection_state_change', state: 'connecting', timestamp: baseTime + 100 },
            { type: 'ice_candidate', candidate: 'candidate:0 1 UDP 2122252543 192.168.1.100 12345 typ host', sdpMid: '0', sdpMLineIndex: 0, timestamp: baseTime + 200 },
            { type: 'ice_candidate', candidate: 'candidate:1 1 UDP 1686052607 203.0.113.45 54321 typ srflx raddr 192.168.1.100 rport 12345', sdpMid: '0', sdpMLineIndex: 0, timestamp: baseTime + 500 },
            { type: 'ice_connection_state_change', state: 'checking', timestamp: baseTime + 600 },
            { type: 'answer', sdp: 'v=0\r\no=- 654321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\na=msid-semantic: WMS\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nc=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\na=ice-ufrag:demo2\r\na=ice-pwd:demo2demo2demo2\r\na=fingerprint:sha-256 11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11:11\r\na=setup:active\r\na=mid:0\r\na=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r\na=sendrecv\r\na=rtpmap:111 opus/48000/2\r\n', timestamp: baseTime + 1000 },
            { type: 'ice_connection_state_change', state: 'connected', timestamp: baseTime + 2000 },
            { type: 'track', kind: 'audio', trackId: 'audio-0', label: 'microphone', timestamp: baseTime + 2500 },
            { type: 'recording_start', recordingId: 'rec-001', timestamp: baseTime + 3000 },
            { type: 'audio_level', level: 0.5, timestamp: baseTime + 5000 },
            { type: 'audio_level', level: 0.3, timestamp: baseTime + 10000 },
            { type: 'network_injection', injectionType: 'latency', latency: 500, duration: 10000, timestamp: baseTime + 15000 },
            { type: 'audio_level', level: 0.6, timestamp: baseTime + 20000 },
            { type: 'ice_connection_state_change', state: 'disconnected', timestamp: baseTime + 30000 },
            { type: 'reconnect_start', attempt: 1, timestamp: baseTime + 31000 },
            { type: 'recording_gap', recordingId: 'rec-001', gapDuration: 8000, timestamp: baseTime + 32000 },
            { type: 'offer', sdp: 'v=0\r\no=- 123457 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n...\r\n', timestamp: baseTime + 33000 },
            { type: 'ice_candidate', candidate: 'candidate:2 1 UDP 2122252543 10.0.0.5 12346 typ host', sdpMid: '0', sdpMLineIndex: 0, timestamp: baseTime + 33500 },
            { type: 'answer', sdp: 'v=0\r\no=- 654322 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n...\r\n', timestamp: baseTime + 34000 },
            { type: 'reconnect_success', timestamp: baseTime + 36000 },
            { type: 'ice_connection_state_change', state: 'connected', timestamp: baseTime + 36500 },
            { type: 'audio_level', level: 0.0, timestamp: baseTime + 60000 },
            { type: 'audio_level', level: 0.0, timestamp: baseTime + 70000 },
            { type: 'recording_stop', recordingId: 'rec-001', timestamp: baseTime + 80000 },
            { type: 'ice_connection_state_change', state: 'completed', timestamp: baseTime + 85000 },
        ];
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new WebRTCReplayApp();
});
