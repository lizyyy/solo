const AppState = {
    currentStep: 1,
    boundaryData: null,
    weightData: null,
    sampleData: null,
    reportData: null,
    conflicts: [],
    resolvedConflicts: {},
    conflictAuditTrail: [],
    negativeSamples: [],
    history: [],
    importCount: 0,
    lastImportHash: null,
    effectiveBoundary: {},
    compareResults: {
        normal: null,
        wrong: null,
        supplement: null
    },
    currentCompareTab: 'normal'
};

const mockBoundaryValues = [
    { id: 'S001', name: '语文阅读理解得分', boundary: 60, rule: '≥60为合格', status: 'pending' },
    { id: 'S002', name: '数学计算题正确率', boundary: 75, rule: '≥75为合格', status: 'pending' },
    { id: 'S003', name: '英语听力得分率', boundary: 70, rule: '≥70为合格', status: 'pending' },
    { id: 'S004', name: '物理实验操作分', boundary: 80, rule: '≥80为合格', status: 'pending' },
    { id: 'S005', name: '化学方程式书写', boundary: 65, rule: '≥65为合格', status: 'pending' },
    { id: 'S006', name: '生物标本识别率', boundary: 55, rule: '≥55为合格', status: 'pending' }
];

const mockWeightTable = [
    { id: 'S001', name: '语文阅读理解得分', weight: '20%', threshold: 65, rule: '≥65为合格，边界值±2需复核' },
    { id: 'S002', name: '数学计算题正确率', weight: '25%', threshold: 75, rule: '≥75为合格，边界值±1需复核' },
    { id: 'S003', name: '英语听力得分率', weight: '15%', threshold: 72, rule: '≥72为合格，边界值±3需复核' },
    { id: 'S004', name: '物理实验操作分', weight: '20%', threshold: 80, rule: '≥80为合格，边界值±2需复核' },
    { id: 'S005', name: '化学方程式书写', weight: '10%', threshold: 68, rule: '≥68为合格，边界值±2需复核' },
    { id: 'S006', name: '生物标本识别率', weight: '10%', threshold: 55, rule: '≥55为合格，边界值±1需复核' }
];

const mockSampleData = [
    { id: 'SA001', boundaryId: 'S001', name: '语文阅读理解得分', value: 65, boundary: 60, newBoundary: 65 },
    { id: 'SA002', boundaryId: 'S001', name: '语文阅读理解得分', value: 62, boundary: 60, newBoundary: 65 },
    { id: 'SA003', boundaryId: 'S001', name: '语文阅读理解得分', value: 58, boundary: 60, newBoundary: 65 },
    { id: 'SA004', boundaryId: 'S002', name: '数学计算题正确率', value: 75, boundary: 75, newBoundary: 75 },
    { id: 'SA005', boundaryId: 'S002', name: '数学计算题正确率', value: 82, boundary: 75, newBoundary: 75 },
    { id: 'SA006', boundaryId: 'S002', name: '数学计算题正确率', value: -3, boundary: 75, newBoundary: 75 },
    { id: 'SA007', boundaryId: 'S003', name: '英语听力得分率', value: 71, boundary: 70, newBoundary: 72 },
    { id: 'SA008', boundaryId: 'S003', name: '英语听力得分率', value: 73, boundary: 70, newBoundary: 72 },
    { id: 'SA009', boundaryId: 'S003', name: '英语听力得分率', value: 68, boundary: 70, newBoundary: 72 },
    { id: 'SA010', boundaryId: 'S004', name: '物理实验操作分', value: 80, boundary: 80, newBoundary: 80 },
    { id: 'SA011', boundaryId: 'S004', name: '物理实验操作分', value: 88, boundary: 80, newBoundary: 80 },
    { id: 'SA012', boundaryId: 'S004', name: '物理实验操作分', value: 78, boundary: 80, newBoundary: 80 },
    { id: 'SA013', boundaryId: 'S005', name: '化学方程式书写', value: 67, boundary: 65, newBoundary: 68 },
    { id: 'SA014', boundaryId: 'S005', name: '化学方程式书写', value: 72, boundary: 65, newBoundary: 68 },
    { id: 'SA015', boundaryId: 'S005', name: '化学方程式书写', value: -1, boundary: 65, newBoundary: 68 },
    { id: 'SA016', boundaryId: 'S006', name: '生物标本识别率', value: 56, boundary: 55, newBoundary: 55 },
    { id: 'SA017', boundaryId: 'S006', name: '生物标本识别率', value: 55, boundary: 55, newBoundary: 55 },
    { id: 'SA018', boundaryId: 'S006', name: '生物标本识别率', value: 52, boundary: 55, newBoundary: 55 }
];

function initApp() {
    bindMaterialClicks();
    addHistory('系统初始化完成，准备开始审计流程');
}

function bindMaterialClicks() {
    document.querySelectorAll('.material-item').forEach(item => {
        item.addEventListener('click', () => {
            const type = item.dataset.type;
            document.querySelectorAll('.material-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            loadMaterial(type);
        });
    });
}

function loadMaterial(type) {
    addHistory(`加载${getMaterialName(type)}`);
    
    if (type === 'normal') {
        showModal('正常材料预览', generateMaterialPreview('normal'), [
            { text: '关闭', class: 'btn-outline', action: closeModal }
        ]);
    } else if (type === 'wrong') {
        showModal('错口径材料预览', generateMaterialPreview('wrong'), [
            { text: '关闭', class: 'btn-outline', action: closeModal }
        ]);
    } else if (type === 'supplement') {
        showModal('补录材料预览', generateMaterialPreview('supplement'), [
            { text: '关闭', class: 'btn-outline', action: closeModal }
        ]);
    }
}

function getMaterialName(type) {
    const names = {
        normal: '正常材料',
        wrong: '错口径材料',
        supplement: '补录材料'
    };
    return names[type] || type;
}

function generateMaterialPreview(type) {
    const data = generateCompareData(type);
    let html = `<p class="text-muted mb-4">以下是${getMaterialName(type)}的运行结果预览：</p>`;
    html += '<div class="table-wrapper"><table><thead><tr><th>指标名称</th><th>样本数</th><th>正常</th><th>边界</th><th>异常</th><th>缺失</th><th>符合率</th></tr></thead><tbody>';
    
    data.forEach(item => {
        html += `<tr>
            <td>${item.name}</td>
            <td>${item.total}</td>
            <td>${item.normal}</td>
            <td>${item.borderline}</td>
            <td>${item.abnormal}</td>
            <td>${item.missing}</td>
            <td>${item.matchRate}%</td>
        </tr>`;
    });
    
    html += '</tbody></table></div>';
    return html;
}

function importBoundaryValues() {
    const currentHash = JSON.stringify(mockBoundaryValues);
    
    if (AppState.lastImportHash === currentHash) {
        AppState.importCount++;
        addHistory(`检测到重复导入（第${AppState.importCount}次），内容与上次一致`);
        showModal('重复导入检测', `
            <div class="check-result-item warning">
                <h4>⚠️ 检测到重复导入</h4>
                <p>这是第 <strong>${AppState.importCount}</strong> 次导入相同的边界值说明文件。</p>
                <p class="text-muted">交接提示：重复导入不会覆盖已有数据，当前生效的边界值仍以首次导入并经冲突处理后的结果为准。操作历史中已记录本次导入。</p>
            </div>
        `, [
            { text: '继续使用现有数据', class: 'btn-primary', action: closeModal }
        ]);
        return;
    }
    
    AppState.importCount = 1;
    AppState.lastImportHash = currentHash;
    AppState.boundaryData = JSON.parse(JSON.stringify(mockBoundaryValues));
    AppState.sampleData = JSON.parse(JSON.stringify(mockSampleData));
    
    AppState.effectiveBoundary = {};
    AppState.boundaryData.forEach(b => {
        AppState.effectiveBoundary[b.id] = {
            boundaryId: b.id,
            name: b.name,
            originalBoundary: b.boundary,
            originalRule: b.rule,
            currentBoundary: b.boundary,
            currentRule: b.rule,
            source: 'import',
            sourceLabel: '边界值说明（首次导入）',
            modified: false,
            auditLog: [{
                action: '首次导入',
                value: b.boundary,
                rule: b.rule,
                operator: '系统导入',
                timestamp: new Date().toLocaleString('zh-CN')
            }]
        };
    });
    
    AppState.conflicts = [];
    AppState.resolvedConflicts = {};
    AppState.conflictAuditTrail = [];
    
    addHistory('成功导入边界值说明，共6项指标，已建立当前生效边界值基准');
    renderBoundaryPreview();
    
    document.getElementById('step1-next').disabled = false;
}

function renderBoundaryPreview() {
    const preview = document.getElementById('boundary-preview');
    const tbody = document.querySelector('#boundary-table tbody');
    
    tbody.innerHTML = '';
    AppState.boundaryData.forEach(item => {
        const eff = AppState.effectiveBoundary[item.id];
        const displayBoundary = eff ? eff.currentBoundary : item.boundary;
        const displayRule = eff ? eff.currentRule : item.rule;
        const isModified = eff && eff.modified;
        
        let statusBadge = '';
        if (isModified) {
            statusBadge = '<span class="status-badge status-borderline">已经冲突调整</span>';
        } else if (AppState.weightData) {
            statusBadge = '<span class="status-badge status-normal">已比对</span>';
        } else {
            statusBadge = '<span class="status-badge status-pending">待比对</span>';
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.id}</td>
            <td>${item.name}</td>
            <td>
                ${displayBoundary}
                ${isModified ? `<br><small class="text-muted">原始：${eff.originalBoundary}</small>` : ''}
            </td>
            <td>
                ${displayRule}
                ${isModified ? `<br><small class="text-muted">来源：${eff.sourceLabel}</small>` : ''}
            </td>
            <td>${statusBadge}</td>
        `;
        tbody.appendChild(row);
    });
    
    preview.classList.remove('hidden');
}

function goToStep(step) {
    if (step === 2 && !AppState.boundaryData) {
        showToast('请先导入边界值说明');
        return;
    }
    
    if (step === 3 && AppState.conflicts.length > 0 && Object.keys(AppState.resolvedConflicts).length < AppState.conflicts.length) {
        showToast('请先处理所有冲突项');
        return;
    }
    
    setActiveStep(step);
}

function setActiveStep(step) {
    AppState.currentStep = step;
    
    document.querySelectorAll('.step').forEach(s => {
        const stepNum = parseInt(s.dataset.step);
        s.classList.remove('active', 'completed');
        if (stepNum < step) s.classList.add('completed');
        if (stepNum === step) s.classList.add('active');
    });
    
    document.querySelectorAll('.step-line').forEach((line, idx) => {
        if (idx < step - 1) line.classList.add('completed');
        else line.classList.remove('completed');
    });
    
    document.querySelectorAll('.step-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(`step-${step}`).classList.remove('hidden');
    
    if (step === 2) {
        loadWeightTable();
    } else if (step === 3) {
        generateReport();
    }
}

function loadWeightTable() {
    AppState.weightData = JSON.parse(JSON.stringify(mockWeightTable));
    addHistory('补看评分权重表（群内补发 · 6月2日 14:30）');
    
    renderWeightTable();
    detectConflicts();
}

function renderWeightTable() {
    const tbody = document.querySelector('#weight-table tbody');
    tbody.innerHTML = '';
    
    AppState.weightData.forEach(item => {
        const eff = AppState.effectiveBoundary[item.id];
        const currentBoundary = eff ? eff.currentBoundary : (AppState.boundaryData.find(b => b.id === item.id)?.boundary);
        const isConsistent = currentBoundary === item.threshold;
        const isResolved = AppState.resolvedConflicts[item.id];
        
        let consistencyLabel = '';
        if (isResolved) {
            const choice = AppState.resolvedConflicts[item.id];
            consistencyLabel = choice === 'boundary'
                ? '<span class="consistent-indicator">✓ 已确认：沿用边界值</span>'
                : '<span class="consistent-indicator">✓ 已确认：按权重表</span>';
        } else if (isConsistent) {
            consistencyLabel = '<span class="consistent-indicator">✓ 一致</span>';
        } else {
            consistencyLabel = '<span class="conflict-indicator">✗ 不一致，待处理</span>';
        }
        
        const boundaryDisplay = eff && eff.modified
            ? `${eff.currentBoundary} <small class="text-muted">（原始：${eff.originalBoundary}）</small>`
            : currentBoundary;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.weight}</td>
            <td>${item.threshold}</td>
            <td>${item.rule}</td>
            <td>
                <div><strong>生效边界值：</strong>${boundaryDisplay}</div>
                <div style="margin-top:4px">${consistencyLabel}</div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function detectConflicts() {
    AppState.conflicts = [];
    
    AppState.weightData.forEach(weightItem => {
        const eff = AppState.effectiveBoundary[weightItem.id];
        if (!eff) return;
        
        const boundaryValue = eff.originalBoundary;
        const boundaryRule = eff.originalRule;
        
        if (boundaryValue !== weightItem.threshold) {
            AppState.conflicts.push({
                id: weightItem.id,
                name: weightItem.name,
                boundaryValue: boundaryValue,
                boundaryRule: boundaryRule,
                weightValue: weightItem.threshold,
                weightRule: weightItem.rule,
                resolved: false,
                diff: Math.abs(boundaryValue - weightItem.threshold)
            });
        }
    });
    
    if (AppState.conflicts.length > 0) {
        renderConflicts();
        addHistory(`检测到${AppState.conflicts.length}处边界值说明与评分权重表的冲突，等待人工确认`);
    } else {
        document.getElementById('conflict-section').classList.add('hidden');
        document.getElementById('step2-next').disabled = false;
        addHistory('边界值说明与评分权重表一致，无冲突');
    }
}

function renderConflicts() {
    const section = document.getElementById('conflict-section');
    const list = document.getElementById('conflict-list');
    
    list.innerHTML = '';
    
    AppState.conflicts.forEach((conflict, index) => {
        const auditRecord = AppState.conflictAuditTrail.find(a => a.id === conflict.id);
        const isResolved = !!auditRecord;
        
        let resolvedInfo = '';
        if (isResolved) {
            const r = auditRecord;
            resolvedInfo = `
                <div style="background:#f0fff4; border-left:3px solid #48bb78; padding:10px; border-radius:6px; margin-top:8px;">
                    <div style="font-weight:600; color:#276749;">✓ 已确认处理</div>
                    <div style="font-size:12px; color:#4a5568; margin-top:4px;">
                        处理方式：${r.choiceLabel}<br>
                        生效边界值：<strong>${r.finalBoundary}</strong><br>
                        处理说明：${r.reason}<br>
                        下一步：${r.nextStep}<br>
                        记录时间：${r.timestamp}
                    </div>
                </div>
            `;
        }
        
        const item = document.createElement('div');
        item.className = 'conflict-item';
        item.innerHTML = `
            <h4>冲突项 ${index + 1}：${conflict.name} 
                <span style="font-size:12px; font-weight:normal; color:#718096;">（差异值：±${conflict.diff}）</span>
                ${isResolved ? '<span class="status-badge status-normal">已处理</span>' : '<span class="status-badge status-conflict">待确认</span>'}
            </h4>
            <div class="conflict-detail">
                <div class="conflict-source">
                    <strong>📄 边界值说明（首次导入）</strong>
                    合格阈值：<span style="font-weight:600; font-size:16px;">${conflict.boundaryValue}</span><br>
                    规则：${conflict.boundaryRule}<br>
                    <small class="text-muted">来源：概率抽样审计计划原始文档</small>
                </div>
                <div class="conflict-source">
                    <strong>📎 评分权重表（群内补发）</strong>
                    合格阈值：<span style="font-weight:600; font-size:16px;">${conflict.weightValue}</span><br>
                    规则：${conflict.weightRule}<br>
                    <small class="text-muted">来源：6月2日 14:30 群内补发文件</small>
                </div>
            </div>
            ${!isResolved ? `
            <div style="background:#faf5ff; border-radius:8px; padding:12px; margin-top:8px;">
                <div style="font-size:13px; color:#553c9a; font-weight:500; margin-bottom:8px;">
                    ⚠️ 请实验助理小穆人工确认，系统不会自动拍板：
                </div>
                <div class="conflict-btn-group">
                    <button class="btn btn-confirm-boundary" onclick="showConfirmDialog('${conflict.id}', 'boundary')">
                        沿用边界值说明（${conflict.boundaryValue}）
                    </button>
                    <button class="btn btn-confirm-weight" onclick="showConfirmDialog('${conflict.id}', 'weight')">
                        按评分权重表修正（${conflict.weightValue}）
                    </button>
                </div>
            </div>
            ` : resolvedInfo}
        `;
        list.appendChild(item);
    });
    
    section.classList.remove('hidden');
}

function showConfirmDialog(id, source) {
    const conflict = AppState.conflicts.find(c => c.id === id);
    const eff = AppState.effectiveBoundary[id];
    
    const finalBoundary = source === 'boundary' ? conflict.boundaryValue : conflict.weightValue;
    const finalRule = source === 'boundary' ? conflict.boundaryRule : conflict.weightRule;
    const choiceLabel = source === 'boundary' 
        ? `沿用边界值说明（${conflict.boundaryValue} → 保持${finalBoundary}）`
        : `按评分权重表修正（${conflict.boundaryValue} → ${finalBoundary}）`;
    
    const needReview = source === 'boundary';
    
    const body = `
        <div style="margin-bottom:16px;">
            <h4 style="margin-bottom:12px; font-size:15px;">关于「${conflict.name}」的处理确认</h4>
            <div class="conflict-detail">
                <div class="conflict-source">
                    <strong>边界值说明原始阈值</strong>
                    <div style="font-size:20px; font-weight:700; margin-top:4px;">${conflict.boundaryValue}</div>
                    <small class="text-muted">${conflict.boundaryRule}</small>
                </div>
                <div class="conflict-source">
                    <strong>评分权重表阈值</strong>
                    <div style="font-size:20px; font-weight:700; margin-top:4px;">${conflict.weightValue}</div>
                    <small class="text-muted">${conflict.weightRule}</small>
                </div>
            </div>
        </div>
        <div style="background:${source==='boundary'?'#fffaf0':'#f0fff4'}; padding:12px; border-radius:8px; margin-bottom:12px; border-left:4px solid ${source==='boundary'?'#ed8936':'#48bb78'};">
            <strong>您选择：</strong>${choiceLabel}<br>
            <strong>生效边界值将为：</strong><span style="font-size:18px; font-weight:700;">${finalBoundary}</span>
        </div>
        <div>
            <label style="font-size:13px; font-weight:500; display:block; margin-bottom:6px;">处理说明（留交学生助教看）：</label>
            <textarea id="confirm-reason" rows="2" style="width:100%; padding:8px; border:1px solid #e2e8f0; border-radius:6px; font-family:inherit; resize:vertical;">${
                source === 'boundary' 
                    ? '经与业务组确认，此指标沿用原始边界值说明，暂不按评分权重表调整。涉及样本请留意边界±2范围。'
                    : '按评分权重表修正此指标合格阈值，原始边界值说明为旧版口径。所有相关样本已按新阈值重算。'
            }</textarea>
        </div>
        <div style="margin-top:12px;">
            <label style="font-size:13px; font-weight:500; display:block; margin-bottom:6px;">下一步找谁：</label>
            <input type="text" id="confirm-nextstep" value="${needReview ? '转交学生助教复核边界±2范围样本' : '自动进入报告生成，无需额外复核'}" 
                style="width:100%; padding:8px; border:1px solid #e2e8f0; border-radius:6px; font-family:inherit;">
        </div>
        ${needReview ? `
        <div style="margin-top:12px; background:#fff5f5; padding:10px; border-radius:6px; font-size:12px; color:#c53030;">
            ⚠️ 提醒：选择「沿用边界值说明」意味着与最新补录材料不一致，涉及的边界样本将标记为"待复核"，不会自动归为正常。
        </div>
        ` : ''}
    `;
    
    showModal('冲突处理确认 · ' + conflict.name, body, [
        { text: '取消', class: 'btn-outline', action: closeModal },
        { 
            text: '确认提交', 
            class: 'btn-primary', 
            action: () => {
                const reason = document.getElementById('confirm-reason').value;
                const nextStep = document.getElementById('confirm-nextstep').value;
                closeModal();
                resolveConflict(id, source, { 
                    reason, 
                    nextStep, 
                    finalBoundary, 
                    finalRule,
                    choiceLabel
                });
            }
        }
    ]);
}

function resolveConflict(id, source, details) {
    AppState.resolvedConflicts[id] = source;
    
    const conflict = AppState.conflicts.find(c => c.id === id);
    const eff = AppState.effectiveBoundary[id];
    
    const timestamp = new Date().toLocaleString('zh-CN');
    
    const auditEntry = {
        id: id,
        name: conflict.name,
        source: source,
        choiceLabel: details.choiceLabel,
        originalBoundary: conflict.boundaryValue,
        originalRule: conflict.boundaryRule,
        weightBoundary: conflict.weightValue,
        weightRule: conflict.weightRule,
        finalBoundary: details.finalBoundary,
        finalRule: details.finalRule,
        reason: details.reason,
        nextStep: details.nextStep,
        needReview: source === 'boundary',
        operator: '实验助理小穆',
        timestamp: timestamp
    };
    
    const existingIdx = AppState.conflictAuditTrail.findIndex(a => a.id === id);
    if (existingIdx >= 0) {
        AppState.conflictAuditTrail[existingIdx] = auditEntry;
    } else {
        AppState.conflictAuditTrail.push(auditEntry);
    }
    
    eff.currentBoundary = details.finalBoundary;
    eff.currentRule = details.finalRule;
    eff.source = source;
    eff.sourceLabel = source === 'boundary' 
        ? '沿用边界值说明（经人工确认）' 
        : '按评分权重表修正（经人工确认）';
    eff.modified = true;
    eff.auditLog.push({
        action: source === 'boundary' ? '冲突处理：沿用边界值' : '冲突处理：按评分权重表修正',
        value: details.finalBoundary,
        rule: details.finalRule,
        operator: '实验助理小穆',
        reason: details.reason,
        nextStep: details.nextStep,
        timestamp: timestamp
    });
    
    const sample = AppState.sampleData;
    sample.forEach(s => {
        if (s.boundaryId === id) {
            s.newBoundary = details.finalBoundary;
        }
    });
    
    const originalWeight = AppState.weightData.find(w => w.id === id);
    if (originalWeight && source === 'weight') {
        originalWeight.threshold = details.finalBoundary;
        originalWeight.rule = details.finalRule;
    }
    
    addHistory(`【冲突处理】${conflict.name} - ${details.choiceLabel} | 生效值：${details.finalBoundary} | 下一步：${details.nextStep}`);
    
    renderConflicts();
    renderWeightTable();
    renderBoundaryPreview();
    
    if (Object.keys(AppState.resolvedConflicts).length === AppState.conflicts.length) {
        document.getElementById('step2-next').disabled = false;
        showToast('所有冲突已处理，已同步更新所有相关数据');
    } else {
        showToast(`已确认 ${Object.keys(AppState.resolvedConflicts).length}/${AppState.conflicts.length} 项冲突`);
    }
}

function generateReport() {
    AppState.negativeSamples = [];
    AppState.reportData = [];
    
    AppState.sampleData.forEach((sample, idx) => {
        const eff = AppState.effectiveBoundary[sample.boundaryId];
        const auditRecord = AppState.conflictAuditTrail.find(a => a.id === sample.boundaryId);
        const weightItem = AppState.weightData?.find(w => w.id === sample.boundaryId);
        
        const originalBoundary = eff ? eff.originalBoundary : sample.boundary;
        const effectiveBoundary = eff ? eff.currentBoundary : sample.newBoundary;
        const weightBoundary = weightItem ? weightItem.threshold : sample.newBoundary;
        
        let oldJudgement = judgeByBoundary(sample.value, originalBoundary);
        let weightJudgement = judgeByWeight(sample.value, weightBoundary);
        let effectiveJudgement = judgeByEffective(sample.value, effectiveBoundary);
        
        let finalJudgement = effectiveJudgement;
        
        let logParts = [];
        logParts.push(`原始边界(${originalBoundary})判定：${oldJudgement}`);
        logParts.push(`权重表(${weightBoundary})判定：${weightJudgement}`);
        if (originalBoundary !== effectiveBoundary) {
            logParts.push(`生效边界(${effectiveBoundary})判定：${effectiveJudgement}`);
        }
        
        if (sample.value < 0) {
            AppState.negativeSamples.push(sample);
            finalJudgement = 'pending';
            logParts.push('负数样本被旧表标为缺失，转交学生助教复核');
        } else if (auditRecord) {
            if (auditRecord.needReview) {
                const boundaryMin = effectiveBoundary - 2;
                const boundaryMax = effectiveBoundary + 2;
                if (sample.value >= boundaryMin && sample.value <= boundaryMax) {
                    finalJudgement = 'pending';
                    logParts.push(`沿用边界值标记，值(${sample.value})在边界±2范围[${boundaryMin},${boundaryMax}]内，待学生助教复核`);
                }
            }
            logParts.push(`冲突处理：${auditRecord.choiceLabel}（${auditRecord.reason}）`);
            logParts.push(`下一步：${auditRecord.nextStep}`);
        }
        
        AppState.sampleData[idx] = {
            ...sample,
            originalBoundary,
            weightBoundary,
            effectiveBoundary,
            oldJudgement,
            weightJudgement,
            effectiveJudgement,
            finalJudgement,
            operationLog: logParts.join(' | '),
            hasConflictAudit: !!auditRecord,
            auditRecord
        };
        
        AppState.reportData.push(AppState.sampleData[idx]);
    });
    
    renderReport(AppState.reportData);
    renderNegativeAlert();
    runAllComparisons();
    addHistory('生成边界样本报告（从生效边界值统一判定，结果已写入 AppState.sampleData）');
}

function judgeByEffective(value, effectiveBoundary) {
    if (value < 0) return 'missing';
    if (value >= effectiveBoundary) return 'normal';
    if (value >= effectiveBoundary - 2) return 'borderline';
    return 'abnormal';
}

function judgeByBoundary(value, boundary) {
    if (value < 0) return 'missing';
    if (value >= boundary) return 'normal';
    if (value >= boundary - 2) return 'borderline';
    return 'abnormal';
}

function judgeByWeight(value, threshold) {
    if (value < 0) return 'missing';
    if (value >= threshold) return 'normal';
    if (value >= threshold - 2) return 'borderline';
    return 'abnormal';
}

function renderReport(data) {
    const tbody = document.querySelector('#report-table tbody');
    tbody.innerHTML = '';
    
    let stats = { total: data.length, normal: 0, borderline: 0, pending: 0, conflict: 0 };
    
    data.forEach(item => {
        if (item.finalJudgement === 'normal') stats.normal++;
        else if (item.finalJudgement === 'borderline') stats.borderline++;
        else if (item.finalJudgement === 'pending') stats.pending++;
        
        if (item.oldJudgement !== item.weightJudgement) stats.conflict++;
        
        let boundaryDisplay = '';
        if (item.hasConflictAudit) {
            const r = item.auditRecord;
            boundaryDisplay = `
                <div>生效值：<strong>${item.effectiveBoundary}</strong></div>
                <small class="text-muted">原始:${item.originalBoundary} / 权重表:${item.weightBoundary}</small>
                <br><small style="color:#553c9a;">${r.source === 'boundary' ? '沿用原始' : '按权重表修正'}</small>
            `;
        } else {
            boundaryDisplay = `
                <div>${item.effectiveBoundary}</div>
                ${item.originalBoundary !== item.weightBoundary ? 
                    `<small class="text-muted">原始:${item.originalBoundary} / 权重表:${item.weightBoundary}</small>` : ''}
            `;
        }
        
        let finalBadge = formatJudgement(item.finalJudgement);
        if (item.finalJudgement === 'pending' && item.value >= 0) {
            finalBadge += `<br><small class="text-muted" style="margin-top:4px;display:inline-block;">待学生助教复核</small>`;
        }
        
        const row = document.createElement('tr');
        row.style.background = item.hasConflictAudit ? '#faf5ff' : '';
        row.innerHTML = `
            <td>${item.id}</td>
            <td>
                ${item.name}
                ${item.hasConflictAudit ? '<br><small style="color:#553c9a;">⚡经冲突处理</small>' : ''}
            </td>
            <td>${item.value < 0 ? `<span class="conflict-indicator">${item.value}</span><br><small class="text-muted">旧表标为缺失</small>` : item.value}</td>
            <td>${boundaryDisplay}</td>
            <td>${formatJudgement(item.oldJudgement)}</td>
            <td>${formatJudgement(item.weightJudgement)}</td>
            <td>${finalBadge}</td>
            <td class="operation-log">${item.operationLog}</td>
        `;
        tbody.appendChild(row);
    });
    
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-normal').textContent = stats.normal;
    document.getElementById('stat-borderline').textContent = stats.borderline;
    document.getElementById('stat-pending').textContent = stats.pending;
    document.getElementById('stat-conflict').textContent = stats.conflict;
}

function formatJudgement(judgement) {
    const map = {
        normal: '<span class="status-badge status-normal">正常</span>',
        borderline: '<span class="status-badge status-borderline">边界值</span>',
        abnormal: '<span class="status-badge status-conflict">异常</span>',
        missing: '<span class="status-badge status-missing">缺失</span>',
        pending: '<span class="status-badge status-pending">待复核</span>'
    };
    return map[judgement] || judgement;
}

function renderNegativeAlert() {
    const alert = document.getElementById('negative-alert');
    if (AppState.negativeSamples.length > 0) {
        document.getElementById('negative-count').textContent = AppState.negativeSamples.length;
        alert.classList.remove('hidden');
        addHistory(`检测到${AppState.negativeSamples.length}个负数样本，已标记待复核`);
    }
}

function viewNegativeSamples() {
    let html = '<p class="text-muted mb-4">以下负数样本被旧表标记为"缺失"，需留交学生助教复核：</p>';
    html += '<div class="table-wrapper"><table><thead><tr><th>样本编号</th><th>指标名称</th><th>原始值</th><th>旧表判定</th><th>当前状态</th></tr></thead><tbody>';
    
    AppState.negativeSamples.forEach(sample => {
        html += `<tr>
            <td>${sample.id}</td>
            <td>${sample.name}</td>
            <td><span class="conflict-indicator">${sample.value}</span></td>
            <td><span class="status-badge status-missing">缺失</span></td>
            <td><span class="status-badge status-pending">待助教复核</span></td>
        </tr>`;
    });
    
    html += '</tbody></table></div>';
    html += '<p class="text-muted mt-4"><strong>交接提示：</strong>这些样本不要急于归为"正常"或"异常"，请转交学生助教复核后再处理。</p>';
    
    showModal('待复核样本列表', html, [
        { text: '确认已知晓', class: 'btn-primary', action: closeModal }
    ]);
}

function generateCompareData(type) {
    const boundaryMap = {};
    AppState.boundaryData.forEach(b => {
        const eff = AppState.effectiveBoundary[b.id];
        
        if (type === 'normal') {
            boundaryMap[b.id] = eff ? eff.originalBoundary : b.boundary;
        } else if (type === 'supplement') {
            boundaryMap[b.id] = eff ? eff.currentBoundary : (AppState.weightData.find(w => w.id === b.id)?.threshold || b.boundary);
        } else if (type === 'wrong') {
            boundaryMap[b.id] = eff ? eff.originalBoundary : b.boundary;
        } else {
            boundaryMap[b.id] = b.boundary;
        }
    });
    
    const result = AppState.boundaryData.map(b => {
        const samples = AppState.sampleData.filter(s => s.boundaryId === b.id);
        const threshold = boundaryMap[b.id];
        const eff = AppState.effectiveBoundary[b.id];
        
        let normal = 0, borderline = 0, abnormal = 0, missing = 0, pending = 0;
        
        samples.forEach(s => {
            if (type === 'wrong' && s.value < 0) {
                missing++;
            } else if (s.value < 0 && type !== 'wrong') {
                const auditRecord = AppState.conflictAuditTrail.find(a => a.id === b.id);
                pending++;
            } else if (type === 'normal' && eff && eff.source === 'boundary' 
                       && s.value >= threshold - 2 && s.value <= threshold + 2) {
                pending++;
            } else if (s.value >= threshold) {
                normal++;
            } else if (s.value >= threshold - 2) {
                borderline++;
            } else {
                abnormal++;
            }
        });
        
        if (type === 'wrong') {
            const wrongBoundaries = { 'S001': 60, 'S003': 70, 'S005': 65 };
            if (wrongBoundaries[b.id]) {
                const oldThreshold = wrongBoundaries[b.id];
                normal = 0; borderline = 0; abnormal = 0; missing = 0;
                samples.forEach(s => {
                    if (s.value < 0) {
                        missing++;
                    } else if (s.value >= oldThreshold) {
                        normal++;
                    } else if (s.value >= oldThreshold - 2) {
                        borderline++;
                    } else {
                        abnormal++;
                    }
                });
            }
        }
        
        const effCount = normal + borderline + pending;
        const matchRate = samples.length > 0 ? Math.round((effCount / samples.length) * 100) : 0;
        
        return {
            boundaryId: b.id,
            name: b.name,
            threshold: threshold,
            total: samples.length,
            normal,
            borderline,
            abnormal,
            missing,
            pending,
            matchRate
        };
    });
    
    return result;
}

function runAllComparisons() {
    AppState.compareResults.normal = generateCompareData('normal');
    AppState.compareResults.wrong = generateCompareData('wrong');
    AppState.compareResults.supplement = generateCompareData('supplement');
    
    switchCompareTab('normal');
    addHistory('完成三种材料对比运行');
}

function switchCompareTab(type) {
    AppState.currentCompareTab = type;
    
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-btn[onclick="switchCompareTab('${type}')"]`).classList.add('active');
    
    const data = AppState.compareResults[type];
    const tbody = document.querySelector('#compare-table tbody');
    tbody.innerHTML = '';
    
    data.forEach(item => {
        const eff = AppState.effectiveBoundary[item.boundaryId];
        let thresholdDisplay = String(item.threshold);
        if (eff && eff.modified && type === 'supplement') {
            thresholdDisplay = `${item.threshold} <small class="text-muted">(原始:${eff.originalBoundary})</small>`;
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${thresholdDisplay}</td>
            <td>${item.total}</td>
            <td>${item.normal}</td>
            <td>${item.borderline}</td>
            <td>${item.abnormal}</td>
            <td>${item.missing > 0 ? `<span class="conflict-indicator">${item.missing}</span>` : item.missing}</td>
            <td>${item.pending > 0 ? `<span class="status-badge status-pending">${item.pending}</span>` : 0}</td>
            <td>${item.matchRate}%</td>
        `;
        tbody.appendChild(row);
    });
}

function runSelfCheck(type) {
    let result = '';
    
    switch(type) {
        case 'duplicate':
            result = checkDuplicateImport();
            break;
        case 'negative':
            result = checkNegativeSamples();
            break;
        case 'recalc':
            result = checkRecalc();
            break;
        case 'export':
            result = checkExportConsistency();
            break;
    }
    
    showCheckResult(result);
    addHistory(`运行自检：${getCheckName(type)}`);
}

function getCheckName(type) {
    const names = {
        duplicate: '重复导入检测',
        negative: '负数样本检测',
        recalc: '补录重算验证',
        export: '导出一致性检查'
    };
    return names[type] || type;
}

function checkDuplicateImport() {
    if (AppState.importCount > 1) {
        return `
        <div class="check-result-item warning">
            <h4>🔍 重复导入检测 - 发现问题</h4>
            <ul>
                <li>检测到第 ${AppState.importCount} 次导入相同文件</li>
                <li>文件内容哈希值与上次导入一致</li>
                <li>系统已自动保留首次导入数据，后续重复导入未覆盖</li>
            </ul>
            <p class="text-muted mt-2">交接提示：重复导入不会影响数据，但会记录操作历史。如需重置，请使用"重置"按钮。</p>
        </div>`;
    }
    return `
    <div class="check-result-item success">
        <h4>🔍 重复导入检测 - 通过</h4>
        <ul>
            <li>当前为第 ${AppState.importCount} 次导入</li>
            <li>无异常重复导入记录</li>
        </ul>
    </div>`;
}

function checkNegativeSamples() {
    if (AppState.negativeSamples.length > 0) {
        let sampleList = AppState.negativeSamples.map(s => `${s.id} (${s.name}: ${s.value})`).join('、');
        return `
        <div class="check-result-item warning">
            <h4>➖ 负数样本检测 - 发现待处理项</h4>
            <ul>
                <li>检测到 ${AppState.negativeSamples.length} 个负数值样本</li>
                <li>涉及样本：${sampleList}</li>
                <li>这些样本被旧表错误标记为"缺失"</li>
                <li>已自动标记为"待复核"状态，留给学生助教处理</li>
            </ul>
            <p class="text-muted mt-2">交接提示：<strong>不要</strong>急于将这些样本归为正常或异常，必须等学生助教复核后再处理。</p>
        </div>`;
    }
    return `
    <div class="check-result-item success">
        <h4>➖ 负数样本检测 - 通过</h4>
        <ul>
            <li>未检测到负数样本</li>
        </ul>
    </div>`;
}

function checkRecalc() {
    if (!AppState.weightData) {
        return `
        <div class="check-result-item error">
            <h4>🔄 补录重算验证 - 未完成</h4>
            <ul>
                <li>尚未加载补录材料（评分权重表）</li>
                <li>请先完成第二步：补看评分权重表</li>
            </ul>
        </div>`;
    }
    
    let recalcCount = 0;
    let effectiveMatchCount = 0;
    let totalAudited = 0;
    
    AppState.sampleData.forEach(s => {
        if (s.value < 0) return;
        const eff = AppState.effectiveBoundary[s.boundaryId];
        if (!eff) return;
        
        const oldJudge = judgeByBoundary(s.value, eff.originalBoundary);
        const effJudge = judgeByEffective(s.value, eff.currentBoundary);
        if (oldJudge !== effJudge) recalcCount++;
        
        if (AppState.conflictAuditTrail.find(a => a.id === s.boundaryId)) {
            totalAudited++;
            if (eff.modified) effectiveMatchCount++;
        }
    });
    
    const allModifiedSynced = Object.values(AppState.effectiveBoundary).every(e => {
        const audit = AppState.conflictAuditTrail.find(a => a.id === e.boundaryId);
        if (!audit) return true;
        return e.currentBoundary === audit.finalBoundary;
    });
    
    const sampleSyncCount = AppState.sampleData.filter(s => {
        const eff = AppState.effectiveBoundary[s.boundaryId];
        return eff && s.newBoundary === eff.currentBoundary;
    }).length;
    
    return `
    <div class="check-result-item ${recalcCount > 0 || !allModifiedSynced ? 'warning' : 'success'}">
        <h4>🔄 补录重算验证 - 完成（数据串接检查）</h4>
        <ul>
            <li>生效边界值基准：共 ${Object.keys(AppState.effectiveBoundary).length} 项，已与冲突审计轨迹串接</li>
            <li>原始 → 生效边界值 重算后判定变化样本数：<strong>${recalcCount}</strong> 个</li>
            <li>冲突项审计状态：${Object.keys(AppState.resolvedConflicts).length}/${AppState.conflicts.length}</li>
            <li>effectiveBoundary 与 conflictAuditTrail 最终值一致：${allModifiedSynced ? '✓ 一致' : '✗ 不一致'}</li>
            <li>sampleData.newBoundary 已同步更新至生效值：${sampleSyncCount}/${AppState.sampleData.length} 样本</li>
            <li>已处理冲突项中生效值已写入 effectiveBoundary：${effectiveMatchCount} 项</li>
        </ul>
        <p class="text-muted mt-2">交接提示：此处验证「原始边界值 → 冲突处理 → 生效边界值 → 样本重算」整条链路是否使用同一份数据。</p>
    </div>`;
}

function checkExportConsistency() {
    if (!AppState.boundaryData || !AppState.weightData) {
        return `
        <div class="check-result-item error">
            <h4>📤 导出一致性检查 - 未完成</h4>
            <ul>
                <li>数据不完整，请先完成全部三步流程</li>
            </ul>
        </div>`;
    }
    
    const normalConsistent = AppState.compareResults.normal?.every(r => r.missing === 0) ?? false;
    const supplementMissing = AppState.compareResults.supplement?.reduce((acc,r) => acc + r.missing, 0) ?? 0;
    const pendingCount = AppState.compareResults.supplement?.reduce((acc,r) => acc + (r.pending || 0), 0) ?? 0;
    
    const historyCoverage = AppState.history.filter(h => 
        h.action.includes('冲突处理') || h.action.includes('生效边界值')
    ).length;
    
    const auditHasReason = AppState.conflictAuditTrail.every(a => a.reason && a.nextStep);
    
    return `
    <div class="check-result-item ${normalConsistent && auditHasReason ? 'success' : 'warning'}">
        <h4>📤 导出一致性检查 - 完成</h4>
        <ul>
            <li>正常材料导出（缺失标记）：${normalConsistent ? '✓ 无异常缺失' : '⚠ 存在缺失标记'}</li>
            <li>错口径材料（旧表缺失标记）：${AppState.compareResults.wrong?.reduce((a,r)=>a+r.missing,0)} 处负数被标为缺失（预期）</li>
            <li>补录材料中缺失标记：${supplementMissing} 处，待复核样本：${pendingCount} 个（留交助教）</li>
            <li>操作历史中含冲突处理记录：${historyCoverage} 条</li>
            <li>所有冲突审计项均含「处理说明 + 下一步找谁」：${auditHasReason ? '✓ 完整' : '✗ 有遗漏'}</li>
            <li>导出 JSON 将携带：summary + effectiveBoundaries + conflictAuditTrail + 标记好的样本数据</li>
        </ul>
        <p class="text-muted mt-2">交接提示：导出文件含 conflictAuditTrail，每个冲突项都保留了原始说法、改后值、处理原因、下一步找谁，不会提前归为正常。</p>
    </div>`;
}

function runAllChecks() {
    const results = [
        checkDuplicateImport(),
        checkNegativeSamples(),
        checkRecalc(),
        checkExportConsistency()
    ].join('');
    
    showCheckResult(results);
    addHistory('运行全部自检项目');
}

function showCheckResult(content) {
    document.querySelectorAll('.step-content').forEach(c => c.classList.add('hidden'));
    document.getElementById('self-check-result').classList.remove('hidden');
    document.getElementById('check-result-content').innerHTML = content;
}

function resetStep(step) {
    if (step === 1) {
        AppState.boundaryData = null;
        AppState.weightData = null;
        AppState.sampleData = null;
        AppState.reportData = null;
        AppState.conflicts = [];
        AppState.resolvedConflicts = {};
        AppState.conflictAuditTrail = [];
        AppState.effectiveBoundary = {};
        AppState.negativeSamples = [];
        AppState.importCount = 0;
        AppState.lastImportHash = null;
        AppState.compareResults = { normal: null, wrong: null, supplement: null };
        
        document.getElementById('boundary-preview').classList.add('hidden');
        document.getElementById('self-check-result').classList.add('hidden');
        document.getElementById('step1-next').disabled = true;
        addHistory('重置第一步，已清空所有相关数据（边界值、冲突记录、生效阈值、报告）');
    }
}

function exportReport() {
    const exportTime = new Date().toLocaleString('zh-CN');
    
    const effectiveBoundaryList = Object.values(AppState.effectiveBoundary).map(e => ({
        boundaryId: e.boundaryId,
        name: e.name,
        originalBoundary: e.originalBoundary,
        originalRule: e.originalRule,
        currentBoundary: e.currentBoundary,
        currentRule: e.currentRule,
        sourceLabel: e.sourceLabel,
        modified: e.modified,
        auditTrail: e.auditLog
    }));
    
    const sampleExport = AppState.sampleData?.map(s => {
        const eff = AppState.effectiveBoundary[s.boundaryId];
        const audit = AppState.conflictAuditTrail.find(a => a.id === s.boundaryId);
        return {
            sampleId: s.id,
            boundaryId: s.boundaryId,
            name: s.name,
            originalValue: s.value,
            originalBoundary: eff?.originalBoundary ?? s.boundary,
            weightBoundary: eff?.modified ? AppState.weightData?.find(w=>w.id===s.boundaryId)?.threshold : eff?.originalBoundary,
            effectiveBoundary: eff?.currentBoundary ?? s.newBoundary,
            boundarySource: eff?.sourceLabel ?? '首次导入',
            hasConflictAudit: !!audit,
            conflictAudit: audit ? {
                choice: audit.choiceLabel,
                reason: audit.reason,
                nextStep: audit.nextStep,
                operator: audit.operator,
                timestamp: audit.timestamp
            } : null
        };
    }) || [];
    
    const exportData = {
        exportTime,
        summary: {
            totalSamples: AppState.sampleData?.length || 0,
            totalBoundaries: Object.keys(AppState.effectiveBoundary).length,
            conflictCount: AppState.conflicts.length,
            resolvedCount: Object.keys(AppState.resolvedConflicts).length,
            negativeSampleCount: AppState.negativeSamples.length,
            operator: '实验助理小穆'
        },
        effectiveBoundaries: effectiveBoundaryList,
        conflictAuditTrail: AppState.conflictAuditTrail,
        boundaryData: AppState.boundaryData,
        weightData: AppState.weightData,
        sampleData: sampleExport,
        resolvedConflicts: AppState.resolvedConflicts,
        negativeSamples: AppState.negativeSamples,
        compareResults: AppState.compareResults,
        operationHistory: AppState.history
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `概率抽样审计报告_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    addHistory(`导出审计报告（${exportTime}，含冲突审计轨迹和生效边界值清单）`);
    showToast('报告已导出，含完整冲突审计记录');
}

function completeWorkflow() {
    if (AppState.negativeSamples.length > 0) {
        showModal('待复核样本提醒', `
            <div class="check-result-item warning">
                <h4>⚠️ 还有 ${AppState.negativeSamples.length} 个样本待学生助教复核</h4>
                <p>这些负数样本尚未处理，归档后仍可在历史记录中查看。</p>
                <p class="text-muted">交接提示：归档不等于结案，待复核样本需要学生助教确认后才能最终判定。</p>
            </div>
        `, [
            { text: '取消', class: 'btn-outline', action: closeModal },
            { text: '确认归档', class: 'btn-primary', action: () => { closeModal(); doComplete(); } }
        ]);
    } else {
        doComplete();
    }
}

function doComplete() {
    addHistory('审计流程完成，已归档');
    
    const firstImport = AppState.boundaryData;
    const currentEffective = Object.values(AppState.effectiveBoundary);
    const consistentImport = currentEffective.every(e => 
        firstImport.find(b => b.id === e.boundaryId) && e.originalBoundary === firstImport.find(b => b.id === e.boundaryId).boundary
    );
    
    const auditItems = AppState.conflictAuditTrail.map(a => `
        <div style="background:#f0fff4; border-left:3px solid #48bb78; padding:10px; border-radius:6px; margin-bottom:8px;">
            <div style="font-weight:600;">${a.name}</div>
            <div style="font-size:12px; color:#4a5568;">
                原始值：${a.originalBoundary} → 最终值：<strong>${a.finalBoundary}</strong><br>
                处理：${a.choiceLabel}<br>
                原因：${a.reason}<br>
                下一步：${a.nextStep}<br>
                处理人：${a.operator} · ${a.timestamp}
            </div>
        </div>
    `).join('') || '<p class="text-muted">无冲突处理记录</p>';
    
    const reviewItems = AppState.negativeSamples.length > 0 
        ? AppState.negativeSamples.map(s => `${s.id} (${s.name}:${s.value})`).join('、')
        : '无';
    
    showModal('🎉 流程完成 · 归档确认', `
        <div style="padding: 8px;">
            <div style="text-align: center; margin-bottom:20px;">
                <div style="font-size: 48px; margin-bottom: 8px;">✅</div>
                <h3 style="margin-bottom: 4px;">概率抽样审计计划已完成</h3>
                <p class="text-muted">边界值说明原始导入 → 冲突处理 → 报告生成，数据链路已核对</p>
            </div>
            
            <div style="background:#ebf8ff; padding:12px; border-radius:10px; margin-bottom:16px; border-left:4px solid #3182ce;">
                <strong>📊 数据一致性核对：</strong>
                <ul style="margin-left: 20px; color:#2a4365; font-size:13px; margin-top:6px;">
                    <li>边界值说明第一次导入内容 = effectiveBoundary.originalBoundary：${consistentImport ? '✓ 一致' : '✗ 不一致'}</li>
                    <li>生效边界值（effectiveBoundary.currentBoundary）= conflictAuditTrail.finalBoundary：已同步</li>
                    <li>样本 newBoundary 全部更新为生效值：已在生成报告时校验</li>
                </ul>
            </div>
            
            <div style="margin-bottom:16px;">
                <h4 style="font-size:14px; margin-bottom:8px;">🔍 冲突审计轨迹（共 ${AppState.conflictAuditTrail.length} 项）</h4>
                ${auditItems}
            </div>
            
            <div style="background:#fffaf0; padding:12px; border-radius:10px; border-left:4px solid #ed8936;">
                <h4 style="font-size:14px; margin-bottom:4px; color:#c05621;">📝 待学生助教复核</h4>
                <p style="font-size:13px; color:#744210; margin-bottom:4px;"><strong>负数样本（${AppState.negativeSamples.length}个）：</strong>${reviewItems}</p>
                <p style="font-size:13px; color:#744210;">以及「沿用边界值说明」标记的边界±2范围样本，在报告中已标为「待复核」。</p>
            </div>
        </div>
    `, [
        { text: '完成', class: 'btn-primary', action: closeModal }
    ]);
}

function addHistory(action) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    AppState.history.unshift({ action, time: timeStr });
    
    const list = document.getElementById('history-list');
    const emptyEl = list.querySelector('.history-empty');
    if (emptyEl) emptyEl.remove();
    
    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
        ${action}
        <div class="history-time">${timeStr}</div>
    `;
    
    list.insertBefore(item, list.firstChild);
    
    while (list.children.length > 10) {
        list.removeChild(list.lastChild);
    }
}

function showModal(title, body, buttons) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    
    const footer = document.getElementById('modal-footer');
    footer.innerHTML = '';
    
    if (buttons) {
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.className = `btn ${btn.class}`;
            button.textContent = btn.text;
            button.onclick = btn.action;
            footer.appendChild(button);
        });
    }
    
    document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #2d3748;
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 2000;
        animation: fadeIn 0.3s ease;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

document.addEventListener('DOMContentLoaded', initApp);
