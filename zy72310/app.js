const AppState = {
    currentStep: 1,
    boundaryData: null,
    weightData: null,
    sampleData: null,
    conflicts: [],
    resolvedConflicts: {},
    negativeSamples: [],
    history: [],
    importCount: 0,
    lastImportHash: null,
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
                <p class="text-muted">交接提示：重复导入不会覆盖已有数据，但会记录在操作历史中。如需重新导入，请先重置。</p>
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
    
    addHistory('成功导入边界值说明，共6项指标');
    renderBoundaryPreview();
    
    document.getElementById('step1-next').disabled = false;
}

function renderBoundaryPreview() {
    const preview = document.getElementById('boundary-preview');
    const tbody = document.querySelector('#boundary-table tbody');
    
    tbody.innerHTML = '';
    AppState.boundaryData.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.id}</td>
            <td>${item.name}</td>
            <td>${item.boundary}</td>
            <td>${item.rule}</td>
            <td><span class="status-badge status-pending">待比对</span></td>
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
        const boundaryItem = AppState.boundaryData.find(b => b.id === item.id);
        const isConsistent = boundaryItem && boundaryItem.boundary === item.threshold;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.weight}</td>
            <td>${item.threshold}</td>
            <td>${item.rule}</td>
            <td>
                ${isConsistent 
                    ? '<span class="consistent-indicator">✓ 一致</span>' 
                    : '<span class="conflict-indicator">✗ 不一致</span>'}
            </td>
        `;
        tbody.appendChild(row);
    });
}

function detectConflicts() {
    AppState.conflicts = [];
    
    AppState.weightData.forEach(weightItem => {
        const boundaryItem = AppState.boundaryData.find(b => b.id === weightItem.id);
        if (boundaryItem && boundaryItem.boundary !== weightItem.threshold) {
            AppState.conflicts.push({
                id: weightItem.id,
                name: weightItem.name,
                boundaryValue: boundaryItem.boundary,
                boundaryRule: boundaryItem.rule,
                weightValue: weightItem.threshold,
                weightRule: weightItem.rule,
                resolved: false
            });
        }
    });
    
    if (AppState.conflicts.length > 0) {
        renderConflicts();
        addHistory(`检测到${AppState.conflicts.length}处边界值说明与评分权重表的冲突`);
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
        const isResolved = AppState.resolvedConflicts[conflict.id];
        
        const item = document.createElement('div');
        item.className = 'conflict-item';
        item.innerHTML = `
            <h4>冲突项 ${index + 1}：${conflict.name} ${isResolved ? '<span class="status-badge status-normal">已处理</span>' : ''}</h4>
            <div class="conflict-detail">
                <div class="conflict-source">
                    <strong>边界值说明</strong>
                    合格阈值：${conflict.boundary}<br>
                    规则：${conflict.boundaryRule}
                </div>
                <div class="conflict-source">
                    <strong>评分权重表</strong>
                    合格阈值：${conflict.weightValue}<br>
                    规则：${conflict.weightRule}
                </div>
            </div>
            ${!isResolved ? `
            <div class="conflict-btn-group">
                <button class="btn btn-confirm-boundary" onclick="resolveConflict('${conflict.id}', 'boundary')">
                    沿用边界值说明（${conflict.boundary}）
                </button>
                <button class="btn btn-confirm-weight" onclick="resolveConflict('${conflict.id}', 'weight')">
                    按评分权重表修正（${conflict.weightValue}）
                </button>
            </div>
            ` : `
            <p class="text-muted">已选择：${AppState.resolvedConflicts[conflict.id] === 'boundary' 
                ? `沿用边界值说明（${conflict.boundary}）` 
                : `按评分权重表修正（${conflict.weightValue}）`}</p>
            `}
        `;
        list.appendChild(item);
    });
    
    section.classList.remove('hidden');
}

function resolveConflict(id, source) {
    AppState.resolvedConflicts[id] = source;
    
    const conflict = AppState.conflicts.find(c => c.id === id);
    const choice = source === 'boundary' 
        ? `沿用边界值说明（${conflict.boundary}）` 
        : `按评分权重表修正（${conflict.weightValue}）`;
    
    addHistory(`冲突处理：${conflict.name} - ${choice}`);
    
    renderConflicts();
    
    if (Object.keys(AppState.resolvedConflicts).length === AppState.conflicts.length) {
        document.getElementById('step2-next').disabled = false;
        showToast('所有冲突已处理，可以进入下一步');
    }
}

function generateReport() {
    AppState.negativeSamples = [];
    
    const reportData = AppState.sampleData.map(sample => {
        const boundaryItem = AppState.boundaryData.find(b => b.id === sample.boundaryId);
        const weightItem = AppState.weightData.find(w => w.id === sample.boundaryId);
        
        let oldJudgement = judgeByBoundary(sample.value, sample.boundary);
        let newJudgement = judgeByWeight(sample.value, sample.newBoundary);
        
        let finalJudgement = newJudgement;
        let operationLog = `边界值判定：${oldJudgement} → 权重表判定：${newJudgement}`;
        
        if (sample.value < 0) {
            AppState.negativeSamples.push(sample);
            finalJudgement = 'pending';
            operationLog += ' → 负数样本，标记待复核（留交学生助教）';
        } else if (AppState.resolvedConflicts[sample.boundaryId]) {
            const source = AppState.resolvedConflicts[sample.boundaryId];
            finalJudgement = source === 'boundary' ? oldJudgement : newJudgement;
            operationLog += ` → 冲突处理：${source === 'boundary' ? '沿用边界值' : '按权重表修正'}`;
        }
        
        return {
            ...sample,
            oldJudgement,
            newJudgement,
            finalJudgement,
            operationLog
        };
    });
    
    renderReport(reportData);
    renderNegativeAlert();
    runAllComparisons();
    addHistory('生成边界样本报告');
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
        
        if (item.oldJudgement !== item.newJudgement) stats.conflict++;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.id}</td>
            <td>${item.name}</td>
            <td>${item.value < 0 ? `<span class="conflict-indicator">${item.value}</span>` : item.value}</td>
            <td>${formatJudgement(item.oldJudgement)}</td>
            <td>${formatJudgement(item.newJudgement)}</td>
            <td>${formatJudgement(item.finalJudgement)}</td>
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
        boundaryMap[b.id] = type === 'weight' || type === 'supplement' 
            ? AppState.weightData.find(w => w.id === b.id)?.threshold || b.boundary
            : b.boundary;
    });
    
    if (type === 'wrong') {
        const wrongBoundaries = { 'S001': 60, 'S003': 70, 'S005': 65 };
        Object.keys(wrongBoundaries).forEach(id => {
            boundaryMap[id] = wrongBoundaries[id];
        });
    }
    
    const result = AppState.boundaryData.map(b => {
        const samples = AppState.sampleData.filter(s => s.boundaryId === b.id);
        const threshold = boundaryMap[b.id];
        
        let normal = 0, borderline = 0, abnormal = 0, missing = 0;
        
        samples.forEach(s => {
            if (type === 'wrong' && s.value < 0) {
                missing++;
            } else if (s.value >= threshold) {
                normal++;
            } else if (s.value >= threshold - 2) {
                borderline++;
            } else {
                abnormal++;
            }
        });
        
        const matchRate = Math.round((normal / samples.length) * 100);
        
        return {
            name: b.name,
            total: samples.length,
            normal,
            borderline,
            abnormal,
            missing,
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
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.total}</td>
            <td>${item.normal}</td>
            <td>${item.borderline}</td>
            <td>${item.abnormal}</td>
            <td>${item.missing > 0 ? `<span class="conflict-indicator">${item.missing}</span>` : item.missing}</td>
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
    
    const recalcCount = AppState.sampleData.filter(s => {
        const oldJudge = judgeByBoundary(s.value, s.boundary);
        const newJudge = judgeByWeight(s.value, s.newBoundary);
        return oldJudge !== newJudge && s.value >= 0;
    }).length;
    
    return `
    <div class="check-result-item ${recalcCount > 0 ? 'warning' : 'success'}">
        <h4>🔄 补录重算验证 - 完成</h4>
        <ul>
            <li>已使用评分权重表对所有样本重新计算</li>
            <li>补录后判定结果变化的样本数：${recalcCount} 个</li>
            <li>所有冲突项处理状态：${Object.keys(AppState.resolvedConflicts).length}/${AppState.conflicts.length}</li>
        </ul>
        ${recalcCount > 0 ? '<p class="text-muted mt-2">交接提示：判定结果变化的样本已在报告中标记，请关注边界样本报告中的"操作记录"列。</p>' : ''}
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
    const supplementConsistent = AppState.compareResults.supplement?.every(r => r.missing === 0) ?? false;
    
    return `
    <div class="check-result-item ${normalConsistent && supplementConsistent ? 'success' : 'warning'}">
        <h4>📤 导出一致性检查 - 完成</h4>
        <ul>
            <li>正常材料导出一致性：${normalConsistent ? '✓ 一致' : '⚠ 存在缺失标记'}</li>
            <li>错口径材料导出一致性：⚠ 存在旧口径缺失标记（预期）</li>
            <li>补录材料导出一致性：${supplementConsistent ? '✓ 一致' : '⚠ 存在缺失标记'}</li>
            <li>操作历史记录完整：${AppState.history.length} 条</li>
        </ul>
        <p class="text-muted mt-2">交接提示：导出时建议同时导出三种材料的对比结果，便于追溯口径变化。</p>
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
        AppState.importCount = 0;
        AppState.lastImportHash = null;
        document.getElementById('boundary-preview').classList.add('hidden');
        document.getElementById('step1-next').disabled = true;
        addHistory('重置第一步：导入边界值说明');
    }
}

function exportReport() {
    const exportData = {
        exportTime: new Date().toLocaleString('zh-CN'),
        boundaryData: AppState.boundaryData,
        weightData: AppState.weightData,
        sampleData: AppState.sampleData,
        resolvedConflicts: AppState.resolvedConflicts,
        negativeSamples: AppState.negativeSamples,
        compareResults: AppState.compareResults,
        history: AppState.history
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `概率抽样审计报告_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    addHistory('导出审计报告');
    showToast('报告已导出');
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
    
    showModal('🎉 流程完成', `
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 64px; margin-bottom: 16px;">✅</div>
            <h3 style="margin-bottom: 12px;">概率抽样审计计划已完成</h3>
            <p class="text-muted">所有步骤已执行，报告已生成。</p>
            <div style="margin-top: 20px; text-align: left; background: #f7fafc; padding: 16px; border-radius: 10px;">
                <p><strong>完成情况：</strong></p>
                <ul style="margin-left: 20px; color: #4a5568;">
                    <li>边界值说明导入：✓</li>
                    <li>评分权重表比对：✓</li>
                    <li>冲突处理：${Object.keys(AppState.resolvedConflicts).length}/${AppState.conflicts.length}</li>
                    <li>边界样本报告：✓</li>
                    <li>三种材料对比：✓</li>
                    <li>待复核样本：${AppState.negativeSamples.length} 个（留交助教）</li>
                </ul>
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
