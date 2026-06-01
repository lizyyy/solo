const STORAGE_KEY = 'classical_records_archive';
let appData = {
    tracks: [],
    contracts: [],
    issues: [],
    conflicts: [],
    metadata: {
        version: '1.0',
        lastUpdated: null,
        createdBy: '古典唱片母带归档系统'
    }
};

function init() {
    loadData();
    bindEvents();
    renderAll();
    loadSampleDataIfEmpty();
}

function loadSampleDataIfEmpty() {
    if (appData.tracks.length === 0 && appData.contracts.length === 0) {
        appData.contracts = [
            {
                id: 'contract_001',
                name: '2023年度交响乐录音授权合同',
                contractNumber: 'SYM-2023-001',
                startDate: '2023-01-01',
                endDate: '2024-12-31',
                source: '合同扫描件_交响乐_第1页',
                notes: '备注：授权期限内可用于商业演出及流媒体发行，过期后需重新申请。特别注意：贝多芬第5交响曲时长与母带标注不一致，以合同为准。',
                authorizedTracks: ['贝多芬第5交响曲', '莫扎特第40交响曲', '巴赫小提琴协奏曲'],
                internalNotes: '林老师批注：2024年底记得提醒续约',
                createdAt: '2024-01-15T10:30:00',
                updatedAt: '2024-01-15T10:30:00'
            },
            {
                id: 'contract_002',
                name: '钢琴独奏作品集授权',
                contractNumber: 'PIO-2022-008',
                startDate: '2022-06-01',
                endDate: '2023-06-01',
                source: '合同扫描件_钢琴集_第3页备注栏',
                notes: '合同手写备注：肖邦夜曲集授权已到期，如需使用请走特殊审批流程。',
                authorizedTracks: ['肖邦夜曲Op.9 No.1', '肖邦夜曲Op.9 No.2'],
                internalNotes: '微信群2023-05-20：已确认不续约',
                createdAt: '2023-01-10T14:20:00',
                updatedAt: '2023-05-20T09:15:00'
            }
        ];
        
        appData.tracks = [
            {
                id: 'track_001',
                name: '贝多芬第5交响曲',
                composer: '路德维希·凡·贝多芬',
                performer: '柏林爱乐乐团',
                duration: '00:30:45',
                isrc: 'GB-ABCD-12-00001',
                relatedContractId: 'contract_001',
                audioFile: 'beethoven_symphony_5.wav',
                status: 'approved',
                source: '母带清单第2页',
                notes: '林老师：时长与合同有差异，合同写的是32分钟，母带实际30:45',
                createdAt: '2024-01-15T10:35:00',
                updatedAt: '2024-01-16T15:20:00'
            },
            {
                id: 'track_002',
                name: '莫扎特第40交响曲',
                composer: '沃尔夫冈·阿马德乌斯·莫扎特',
                performer: '维也纳爱乐乐团',
                duration: '00:25:30',
                isrc: 'GB-ABCD-12-00002',
                relatedContractId: 'contract_001',
                audioFile: 'mozart_symphony_40.wav',
                status: 'approved',
                source: '母带清单第3页',
                notes: '',
                createdAt: '2024-01-15T10:36:00',
                updatedAt: '2024-01-15T10:36:00'
            },
            {
                id: 'track_003',
                name: '肖邦夜曲Op.9 No.1',
                composer: '弗雷德里克·肖邦',
                performer: '李云迪',
                duration: '00:05:30',
                isrc: 'CN-ABCD-10-00001',
                relatedContractId: 'contract_002',
                audioFile: 'chopin_nocturne_9_1.wav',
                status: 'review',
                source: '母带清单第5页',
                notes: '授权已过期，需确认是否续约',
                createdAt: '2023-01-10T14:25:00',
                updatedAt: '2024-01-05T08:00:00'
            },
            {
                id: 'track_004',
                name: '肖邦夜曲Op.9 No.1',
                composer: '弗雷德里克·肖邦',
                performer: '鲁宾斯坦',
                duration: '00:06:15',
                isrc: 'US-ABCD-70-00001',
                relatedContractId: '',
                audioFile: 'chopin_nocturne_9_1_rubinstein.wav',
                status: 'pending',
                source: '微信群2024-01-10 补充曲目',
                notes: '注意：与已有曲目名称重复但是不同版本',
                createdAt: '2024-01-10T16:45:00',
                updatedAt: '2024-01-10T16:45:00'
            },
            {
                id: 'track_005',
                name: '巴赫小提琴协奏曲',
                composer: '约翰·塞巴斯蒂安·巴赫',
                performer: '海菲兹',
                duration: '00:22:00',
                isrc: 'US-ABCD-55-00001',
                relatedContractId: 'contract_001',
                audioFile: 'bach_violin_concerto.wav',
                status: 'approved',
                source: '母带清单第4页',
                notes: '',
                createdAt: '2024-01-15T10:40:00',
                updatedAt: '2024-01-15T10:40:00'
            }
        ];
        
        saveData();
        renderAll();
    }
}

function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            appData = JSON.parse(saved);
        } catch (e) {
            console.error('加载数据失败:', e);
        }
    }
}

function saveData() {
    appData.metadata.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function bindEvents() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
    });

    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });
    
    document.getElementById('fileInput').addEventListener('change', handleImport);
    
    document.getElementById('exportBtn').addEventListener('click', () => {
        openModal('exportModal');
        updateExportPreview();
    });
    
    document.getElementById('addTrackBtn').addEventListener('click', () => openTrackModal());
    document.getElementById('addContractBtn').addEventListener('click', () => openContractModal());
    
    document.getElementById('trackForm').addEventListener('submit', handleTrackSubmit);
    document.getElementById('contractForm').addEventListener('submit', handleContractSubmit);
    
    ['filterExpired', 'filterIssues', 'filterDuplicates', 'filterConflicts'].forEach(id => {
        document.getElementById(id).addEventListener('change', renderAll);
    });
    
    ['exportScope', 'exportFormat', 'includeIssues'].forEach(id => {
        document.getElementById(id).addEventListener('change', updateExportPreview);
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabName + 'Tab');
    });
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function openTrackModal(track = null) {
    const form = document.getElementById('trackForm');
    form.reset();
    
    if (track) {
        document.getElementById('trackModalTitle').textContent = '编辑曲目';
        document.getElementById('trackId').value = track.id;
        document.getElementById('trackName').value = track.name || '';
        document.getElementById('composer').value = track.composer || '';
        document.getElementById('performer').value = track.performer || '';
        document.getElementById('duration').value = track.duration || '';
        document.getElementById('isrc').value = track.isrc || '';
        document.getElementById('relatedContractId').value = track.relatedContractId || '';
        document.getElementById('audioFile').value = track.audioFile || '';
        document.getElementById('trackStatus').value = track.status || 'pending';
        document.getElementById('source').value = track.source || '';
        document.getElementById('notes').value = track.notes || '';
    } else {
        document.getElementById('trackModalTitle').textContent = '添加曲目';
        document.getElementById('trackId').value = '';
    }
    
    openModal('trackModal');
}

function openContractModal(contract = null) {
    const form = document.getElementById('contractForm');
    form.reset();
    
    if (contract) {
        document.getElementById('contractModalTitle').textContent = '编辑合同';
        document.getElementById('contractId').value = contract.id;
        document.getElementById('contractName').value = contract.name || '';
        document.getElementById('contractNumber').value = contract.contractNumber || '';
        document.getElementById('startDate').value = contract.startDate || '';
        document.getElementById('endDate').value = contract.endDate || '';
        document.getElementById('contractSource').value = contract.source || '';
        document.getElementById('contractNotes').value = contract.notes || '';
        document.getElementById('authorizedTracks').value = (contract.authorizedTracks || []).join(', ');
        document.getElementById('internalNotes').value = contract.internalNotes || '';
    } else {
        document.getElementById('contractModalTitle').textContent = '添加合同备注';
        document.getElementById('contractId').value = '';
    }
    
    openModal('contractModal');
}

function handleTrackSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('trackId').value || 'track_' + Date.now();
    const now = new Date().toISOString();
    
    const track = {
        id,
        name: document.getElementById('trackName').value,
        composer: document.getElementById('composer').value,
        performer: document.getElementById('performer').value,
        duration: document.getElementById('duration').value,
        isrc: document.getElementById('isrc').value,
        relatedContractId: document.getElementById('relatedContractId').value,
        audioFile: document.getElementById('audioFile').value,
        status: document.getElementById('trackStatus').value,
        source: document.getElementById('source').value,
        notes: document.getElementById('notes').value,
        updatedAt: now
    };
    
    const existingIndex = appData.tracks.findIndex(t => t.id === id);
    if (existingIndex >= 0) {
        track.createdAt = appData.tracks[existingIndex].createdAt;
        appData.tracks[existingIndex] = track;
    } else {
        track.createdAt = now;
        appData.tracks.push(track);
    }
    
    saveData();
    closeModal('trackModal');
    renderAll();
}

function handleContractSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('contractId').value || 'contract_' + Date.now();
    const now = new Date().toISOString();
    
    const contract = {
        id,
        name: document.getElementById('contractName').value,
        contractNumber: document.getElementById('contractNumber').value,
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        source: document.getElementById('contractSource').value,
        notes: document.getElementById('contractNotes').value,
        authorizedTracks: document.getElementById('authorizedTracks').value.split(/[,，]/).map(s => s.trim()).filter(s => s),
        internalNotes: document.getElementById('internalNotes').value,
        updatedAt: now
    };
    
    const existingIndex = appData.contracts.findIndex(c => c.id === id);
    if (existingIndex >= 0) {
        contract.createdAt = appData.contracts[existingIndex].createdAt;
        appData.contracts[existingIndex] = contract;
    } else {
        contract.createdAt = now;
        appData.contracts.push(contract);
    }
    
    saveData();
    closeModal('contractModal');
    renderAll();
}

function deleteTrack(id) {
    if (confirm('确定要删除这首曲目吗？')) {
        appData.tracks = appData.tracks.filter(t => t.id !== id);
        saveData();
        renderAll();
    }
}

function deleteContract(id) {
    if (confirm('确定要删除这份合同吗？')) {
        appData.contracts = appData.contracts.filter(c => c.id !== id);
        saveData();
        renderAll();
    }
}

function detectIssues() {
    const issues = [];
    const today = new Date();
    
    appData.tracks.forEach(track => {
        if (track.relatedContractId) {
            const contract = appData.contracts.find(c => c.id === track.relatedContractId);
            if (contract && contract.endDate) {
                const endDate = new Date(contract.endDate);
                if (endDate < today) {
                    issues.push({
                        id: 'expired_' + track.id,
                        type: 'expired',
                        severity: 'error',
                        title: '授权已过期',
                        trackId: track.id,
                        trackName: track.name,
                        contractId: contract.id,
                        contractName: contract.name,
                        endDate: contract.endDate,
                        description: `曲目《${track.name}》的授权已于${contract.endDate}过期`
                    });
                } else if ((endDate - today) / (1000 * 60 * 60 * 24) <= 30) {
                    issues.push({
                        id: 'expiring_' + track.id,
                        type: 'expiring',
                        severity: 'warning',
                        title: '授权即将到期',
                        trackId: track.id,
                        trackName: track.name,
                        contractId: contract.id,
                        contractName: contract.name,
                        endDate: contract.endDate,
                        description: `曲目《${track.name}》的授权将于${contract.endDate}到期（不足30天）`
                    });
                }
            }
        }
    });
    
    const trackNames = {};
    appData.tracks.forEach(track => {
        const key = track.name;
        if (!trackNames[key]) trackNames[key] = [];
        trackNames[key].push(track);
    });
    
    Object.entries(trackNames).forEach(([name, tracks]) => {
        if (tracks.length > 1) {
            issues.push({
                id: 'duplicate_' + name,
                type: 'duplicate',
                severity: 'warning',
                title: '重复曲目名称',
                trackNames: tracks.map(t => t.name),
                trackIds: tracks.map(t => t.id),
                description: `发现${tracks.length}首同名曲目《${name}》，请确认是不同版本还是数据重复`
            });
        }
    });
    
    return issues;
}

function detectConflicts() {
    const conflicts = [];
    
    appData.tracks.forEach(track => {
        if (track.relatedContractId) {
            const contract = appData.contracts.find(c => c.id === track.relatedContractId);
            if (contract && contract.authorizedTracks && contract.authorizedTracks.length > 0) {
                const isInAuthorized = contract.authorizedTracks.some(t => 
                    t.includes(track.name) || track.name.includes(t)
                );
                if (!isInAuthorized) {
                    conflicts.push({
                        id: 'conflict_auth_' + track.id,
                        type: 'authorization',
                        title: '曲目不在合同授权列表中',
                        trackId: track.id,
                        trackName: track.name,
                        contractId: contract.id,
                        contractName: contract.name,
                        contractData: contract.authorizedTracks.join('、'),
                        trackData: `关联合同ID: ${track.relatedContractId}`,
                        sources: {
                            contract: contract.source || '合同数据',
                            track: track.source || '曲目数据'
                        },
                        suggestion: '建议：1) 确认该曲目是否确实属于此合同；2) 更新合同授权曲目列表；3) 修改曲目关联的合同ID'
                    });
                }
            }
        }
        
        if (track.duration && track.notes) {
            const timeMismatch = track.notes.includes('时长') && (track.notes.includes('差异') || track.notes.includes('不一致'));
            if (timeMismatch) {
                conflicts.push({
                    id: 'conflict_time_' + track.id,
                    type: 'timecode',
                    title: '时长标注存在差异',
                    trackId: track.id,
                    trackName: track.name,
                    contractData: '合同/批注：' + track.notes.match(/合同写的是(\d+分钟|:|\d+)/)?.[0] || '见批注',
                    trackData: '母带时长：' + track.duration,
                    sources: {
                        contract: '合同扫描件备注',
                        track: track.source || '母带清单'
                    },
                    suggestion: '建议：核实正确时长，以权威来源为准并更新数据'
                });
            }
        }
    });
    
    return conflicts;
}

function getFilteredTracks() {
    let tracks = [...appData.tracks];
    const issues = detectIssues();
    const conflicts = detectConflicts();
    
    if (document.getElementById('filterExpired').checked) {
        const expiredTrackIds = issues.filter(i => i.type === 'expired').map(i => i.trackId);
        tracks = tracks.filter(t => expiredTrackIds.includes(t.id));
    }
    
    if (document.getElementById('filterIssues').checked) {
        const issueTrackIds = issues.map(i => i.trackId).filter(Boolean);
        tracks = tracks.filter(t => issueTrackIds.includes(t.id));
    }
    
    if (document.getElementById('filterDuplicates').checked) {
        const dupTrackIds = issues.filter(i => i.type === 'duplicate').flatMap(i => i.trackIds || []);
        tracks = tracks.filter(t => dupTrackIds.includes(t.id));
    }
    
    if (document.getElementById('filterConflicts').checked) {
        const conflictTrackIds = conflicts.map(c => c.trackId).filter(Boolean);
        tracks = tracks.filter(t => conflictTrackIds.includes(t.id));
    }
    
    return tracks;
}

function renderAll() {
    const issues = detectIssues();
    const conflicts = detectConflicts();
    const filteredTracks = getFilteredTracks();
    
    renderStats(issues);
    renderIssueList(issues);
    renderTrackList(filteredTracks, issues, conflicts);
    renderContractList();
    renderConflictList(conflicts);
}

function renderStats(issues) {
    document.getElementById('totalTracks').textContent = appData.tracks.length;
    document.getElementById('totalContracts').textContent = appData.contracts.length;
    document.getElementById('expiredCount').textContent = issues.filter(i => i.type === 'expired').length;
    document.getElementById('issueCount').textContent = issues.length;
}

function renderIssueList(issues) {
    const container = document.getElementById('issueList');
    
    if (issues.length === 0) {
        container.innerHTML = '<p class="empty-text">暂无问题</p>';
        return;
    }
    
    container.innerHTML = issues.map(issue => `
        <div class="issue-item ${issue.severity === 'warning' ? 'warning' : ''}">
            <div class="issue-type">${issue.title}</div>
            <div class="issue-desc">${issue.description}</div>
        </div>
    `).join('');
}

function renderTrackList(tracks, issues, conflicts) {
    const container = document.getElementById('trackList');
    
    if (tracks.length === 0) {
        container.innerHTML = '<p class="empty-text">暂无曲目，请导入数据或手动添加</p>';
        return;
    }
    
    const trackIssues = {};
    issues.forEach(issue => {
        if (issue.trackId) {
            if (!trackIssues[issue.trackId]) trackIssues[issue.trackId] = [];
            trackIssues[issue.trackId].push(issue);
        }
        if (issue.trackIds) {
            issue.trackIds.forEach(tid => {
                if (!trackIssues[tid]) trackIssues[tid] = [];
                trackIssues[tid].push(issue);
            });
        }
    });
    
    const trackConflicts = {};
    conflicts.forEach(conflict => {
        if (conflict.trackId) {
            if (!trackConflicts[conflict.trackId]) trackConflicts[conflict.trackId] = [];
            trackConflicts[conflict.trackId].push(conflict);
        }
    });
    
    container.innerHTML = tracks.map(track => {
        const hasErrors = (trackIssues[track.id] || []).some(i => i.severity === 'error') || (trackConflicts[track.id] || []).length > 0;
        const hasWarnings = (trackIssues[track.id] || []).some(i => i.severity === 'warning') && !hasErrors;
        const contract = track.relatedContractId ? appData.contracts.find(c => c.id === track.relatedContractId) : null;
        
        const tags = [];
        (trackIssues[track.id] || []).forEach(issue => {
            if (issue.type === 'expired') tags.push('<span class="tag tag-expired">授权过期</span>');
            if (issue.type === 'expiring') tags.push('<span class="tag tag-expired">即将到期</span>');
            if (issue.type === 'duplicate') tags.push('<span class="tag tag-duplicate">同名重复</span>');
        });
        if ((trackConflicts[track.id] || []).length > 0) {
            tags.push('<span class="tag tag-conflict">数据冲突</span>');
        }
        
        return `
            <div class="track-card ${hasErrors ? 'has-issues' : ''} ${hasWarnings ? 'has-warnings' : ''}">
                <div class="track-header">
                    <div>
                        <div class="track-title">
                            ${track.name}
                            ${tags.join('')}
                        </div>
                        <div class="track-meta">
                            ${track.composer ? track.composer + ' · ' : ''}${track.performer || '未填写表演者'}
                        </div>
                    </div>
                    <span class="status-badge status-${track.status}">${getStatusText(track.status)}</span>
                </div>
                <div class="track-details">
                    <div class="detail-item">
                        <span class="detail-label">时长:</span>
                        <span class="detail-value">${track.duration || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">ISRC:</span>
                        <span class="detail-value">${track.isrc || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">音频文件:</span>
                        <span class="detail-value">${track.audioFile || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">合同:</span>
                        <span class="detail-value">${contract ? contract.name : '未关联'}</span>
                    </div>
                </div>
                ${track.notes ? `
                    <div class="notes-box">
                        <div class="notes-label">人工批注</div>
                        ${track.notes}
                    </div>
                ` : ''}
                ${track.source ? `<div class="source-info">来源: ${track.source} · 最后更新: ${formatDate(track.updatedAt)}</div>` : ''}
                <div class="track-actions">
                    <button class="btn btn-small btn-primary" onclick="openTrackModal(${JSON.stringify(track).replace(/"/g, '&quot;')})">编辑</button>
                    <button class="btn btn-small btn-danger" onclick="deleteTrack('${track.id}')">删除</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderContractList() {
    const container = document.getElementById('contractList');
    
    if (appData.contracts.length === 0) {
        container.innerHTML = '<p class="empty-text">暂无合同备注</p>';
        return;
    }
    
    const today = new Date();
    
    container.innerHTML = appData.contracts.map(contract => {
        const isExpired = contract.endDate && new Date(contract.endDate) < today;
        const isExpiring = contract.endDate && (new Date(contract.endDate) - today) / (1000 * 60 * 60 * 24) <= 30 && !isExpired;
        
        const tags = [];
        if (isExpired) tags.push('<span class="tag tag-expired">已过期</span>');
        if (isExpiring) tags.push('<span class="tag tag-expired">即将到期</span>');
        
        return `
            <div class="contract-card ${isExpired ? 'has-issues' : ''} ${isExpiring ? 'has-warnings' : ''}">
                <div class="contract-header">
                    <div>
                        <div class="track-title">
                            ${contract.name}
                            ${tags.join('')}
                        </div>
                        <div class="contract-meta">
                            合同编号: ${contract.contractNumber || '-'}
                        </div>
                    </div>
                </div>
                <div class="contract-details">
                    <div class="detail-item">
                        <span class="detail-label">授权期:</span>
                        <span class="detail-value">${contract.startDate || '-'} 至 ${contract.endDate || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">授权曲目:</span>
                        <span class="detail-value">${(contract.authorizedTracks || []).length} 首</span>
                    </div>
                </div>
                ${contract.notes ? `
                    <div class="notes-box">
                        <div class="notes-label">合同备注（原始表述）</div>
                        ${contract.notes}
                    </div>
                ` : ''}
                ${contract.internalNotes ? `
                    <div class="notes-box" style="background: #f0f5ff; border-color: #adc6ff;">
                        <div class="notes-label" style="color: #1d39c4;">内部批注</div>
                        ${contract.internalNotes}
                    </div>
                ` : ''}
                ${contract.source ? `<div class="source-info">来源: ${contract.source} · 建立时间: ${formatDate(contract.createdAt)}</div>` : ''}
                <div class="contract-actions">
                    <button class="btn btn-small btn-primary" onclick="openContractModal(${JSON.stringify(contract).replace(/"/g, '&quot;')})">编辑</button>
                    <button class="btn btn-small btn-danger" onclick="deleteContract('${contract.id}')">删除</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderConflictList(conflicts) {
    const container = document.getElementById('conflictList');
    
    if (conflicts.length === 0) {
        container.innerHTML = '<p class="empty-text">暂无数据冲突</p>';
        return;
    }
    
    container.innerHTML = conflicts.map(conflict => `
        <div class="conflict-card">
            <div class="conflict-header">
                <div class="conflict-title">${conflict.title}</div>
            </div>
            <div class="conflict-content">
                <div class="conflict-side">
                    <div class="conflict-side-label">合同扫描件说法</div>
                    <div class="conflict-side-content">${conflict.contractData}</div>
                    <div class="conflict-source">来源: ${conflict.sources?.contract || '合同数据'}</div>
                </div>
                <div class="conflict-side">
                    <div class="conflict-side-label">导入数据说法</div>
                    <div class="conflict-side-content">${conflict.trackData}</div>
                    <div class="conflict-source">来源: ${conflict.sources?.track || '曲目数据'}</div>
                </div>
            </div>
            <div class="conflict-suggestions">
                <div class="suggestion-label">建议动作</div>
                ${conflict.suggestion}
            </div>
        </div>
    `).join('');
}

function getStatusText(status) {
    const map = {
        pending: '待处理',
        approved: '已确认',
        review: '需复核',
        rejected: '已驳回'
    };
    return map[status] || status;
}

function formatDate(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (data.tracks && Array.isArray(data.tracks)) {
                appData = data;
                saveData();
                renderAll();
                alert('导入成功！');
            } else {
                alert('数据格式不正确');
            }
        } catch (err) {
            alert('导入失败：' + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

function updateExportPreview() {
    const scope = document.getElementById('exportScope').value;
    const format = document.getElementById('exportFormat').value;
    const includeIssues = document.getElementById('includeIssues').checked;
    
    let tracks = [];
    if (scope === 'all') tracks = appData.tracks;
    else if (scope === 'approved') tracks = appData.tracks.filter(t => t.status === 'approved');
    else if (scope === 'issues') {
        const issues = detectIssues();
        const issueIds = new Set(issues.map(i => i.trackId).filter(Boolean));
        tracks = appData.tracks.filter(t => issueIds.has(t.id));
    }
    else if (scope === 'filtered') tracks = getFilteredTracks();
    
    const preview = document.getElementById('exportPreview');
    
    if (format === 'csv') {
        let csv = '曲目名称,作曲家,表演者,时长,ISRC,状态,合同,来源,问题说明\n';
        const issues = detectIssues();
        const conflicts = detectConflicts();
        
        tracks.forEach(track => {
            const contract = track.relatedContractId ? appData.contracts.find(c => c.id === track.relatedContractId) : null;
            let issueText = '';
            
            if (includeIssues) {
                const trackIssues = issues.filter(i => i.trackId === track.id || (i.trackIds && i.trackIds.includes(track.id)));
                const trackConflicts = conflicts.filter(c => c.trackId === track.id);
                issueText = [...trackIssues.map(i => i.title), ...trackConflicts.map(c => c.title)].join('; ');
            }
            
            csv += `"${track.name}","${track.composer || ''}","${track.performer || ''}","${track.duration || ''}","${track.isrc || ''}","${getStatusText(track.status)}","${contract ? contract.name : ''}","${track.source || ''}","${issueText}"\n`;
        });
        
        preview.textContent = csv;
    } else {
        const exportData = {
            metadata: {
                ...appData.metadata,
                exportedAt: new Date().toISOString(),
                exportScope: scope
            },
            tracks: tracks,
            contracts: appData.contracts
        };
        if (includeIssues) {
            exportData.issues = detectIssues();
            exportData.conflicts = detectConflicts();
        }
        preview.textContent = JSON.stringify(exportData, null, 2);
    }
}

function doExport() {
    const scope = document.getElementById('exportScope').value;
    const format = document.getElementById('exportFormat').value;
    const includeIssues = document.getElementById('includeIssues').checked;
    
    let tracks = [];
    if (scope === 'all') tracks = appData.tracks;
    else if (scope === 'approved') tracks = appData.tracks.filter(t => t.status === 'approved');
    else if (scope === 'issues') {
        const issues = detectIssues();
        const issueIds = new Set(issues.map(i => i.trackId).filter(Boolean));
        tracks = appData.tracks.filter(t => issueIds.has(t.id));
    }
    else if (scope === 'filtered') tracks = getFilteredTracks();
    
    let content, filename, mimeType;
    
    if (format === 'csv') {
        let csv = '\ufeff';
        csv += '曲目名称,作曲家,表演者,时长,ISRC,状态,合同,授权到期日,音频文件,来源,问题说明,处理建议,人工批注\n';
        const issues = detectIssues();
        const conflicts = detectConflicts();
        
        tracks.forEach(track => {
            const contract = track.relatedContractId ? appData.contracts.find(c => c.id === track.relatedContractId) : null;
            let issueText = '';
            let suggestionText = '';
            
            if (includeIssues) {
                const trackIssues = issues.filter(i => i.trackId === track.id || (i.trackIds && i.trackIds.includes(track.id)));
                const trackConflicts = conflicts.filter(c => c.trackId === track.id);
                issueText = [...trackIssues.map(i => i.title), ...trackConflicts.map(c => c.title)].join('; ');
                suggestionText = [...trackConflicts.map(c => c.suggestion)].join('; ');
            }
            
            csv += `"${track.name}","${track.composer || ''}","${track.performer || ''}","${track.duration || ''}","${track.isrc || ''}","${getStatusText(track.status)}","${contract ? contract.name : ''}","${contract ? contract.endDate : ''}","${track.audioFile || ''}","${track.source || ''}","${issueText}","${suggestionText}","${track.notes || ''}"\n`;
        });
        
        content = csv;
        filename = `古典唱片母带归档清单_${new Date().toISOString().slice(0, 10)}.csv`;
        mimeType = 'text/csv;charset=utf-8';
    } else {
        const exportData = {
            metadata: {
                ...appData.metadata,
                exportedAt: new Date().toISOString(),
                exportScope: scope
            },
            tracks: tracks,
            contracts: appData.contracts
        };
        if (includeIssues) {
            exportData.issues = detectIssues();
            exportData.conflicts = detectConflicts();
        }
        content = JSON.stringify(exportData, null, 2);
        filename = `古典唱片母带归档_完整备份_${new Date().toISOString().slice(0, 10)}.json`;
        mimeType = 'application/json';
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    closeModal('exportModal');
}

init();
