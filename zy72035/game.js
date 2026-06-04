const SCENARIOS = [
    {
        id: 1,
        title: "场景1：气体报警器报警",
        desc: "你正在巡检燃气舱，突然可燃气体报警器发出警报，显示浓度达到15%LEL。此时你应该？",
        options: [
            { id: 'A', text: '立即撤离，到安全区域后上报调度', correct: false, reason: '规则理解错误：15%LEL未达到立即撤离标准，应先排查泄漏点' },
            { id: 'B', text: '携带便携式检测仪排查泄漏点，同时开启通风系统', correct: true, reason: '正确操作：10%-20%LEL属于预警范围，应先排查通风' },
            { id: 'C', text: '直接拨打119报火警', correct: false, reason: '操作过度：未达到火警级别，应先内部处置确认' }
        ],
        timeLimit: 15,
        category: 'rule'
    },
    {
        id: 2,
        title: "场景2：发现电缆接头过热",
        desc: "在电力舱巡检时，用红外测温仪发现一处10kV电缆接头温度达到85℃，周围有轻微焦糊味。此时你应该？",
        options: [
            { id: 'A', text: '立即断开该回路电源', correct: false, reason: '越权操作：巡检员无权直接断开高压电源' },
            { id: 'B', text: '做好标记，继续巡检，结束后上报', correct: false, reason: '优先级判断错误：85℃属于严重过热，需立即上报' },
            { id: 'C', text: '立即上报调度，安排人员带电检测', correct: true, reason: '正确操作：发现严重过热应立即上报，由专业人员处置' }
        ],
        timeLimit: 12,
        category: 'rule'
    },
    {
        id: 3,
        title: "场景3：应急照明故障",
        desc: "进入综合舱后，发现整段应急照明不亮，随身手电电量只剩10%。此时你应该？",
        options: [
            { id: 'A', text: '摸黑继续巡检，尽快完成任务', correct: false, reason: '安全意识淡薄：照明不足继续作业存在安全隐患' },
            { id: 'B', text: '原路返回，更换手电后重新进入', correct: true, reason: '正确操作：安全第一，照明不足应退出并更换装备' },
            { id: 'C', text: '用手机照明继续巡检', correct: false, reason: '违规操作：手机不是防爆设备，部分舱室禁止使用' }
        ],
        timeLimit: 10,
        category: 'safety'
    },
    {
        id: 4,
        title: "场景4：水位异常上升",
        desc: "暴雨天气巡检，发现排水泵启动后水位仍在上升，目前已达15cm。此时你应该？",
        options: [
            { id: 'A', text: '留在现场观察水位变化', correct: false, reason: '风险判断错误：水位持续上升存在被淹风险' },
            { id: 'B', text: '立即撤离并上报，建议增加临时排水', correct: true, reason: '正确操作：持续上涨应先撤离再上报' },
            { id: 'C', text: '尝试手动启动备用泵', correct: false, reason: '操作错误：备用泵操作需专业培训，不可擅动' }
        ],
        timeLimit: 10,
        category: 'emergency'
    },
    {
        id: 5,
        title: "场景5：人员遇险求救",
        desc: "收到对讲机呼叫，同事在前方200米处疑似硫化氢中毒倒地。此时你应该？",
        options: [
            { id: 'A', text: '立即冲过去救人', correct: false, reason: '新手典型错误：未做防护盲目施救可能导致二次伤亡' },
            { id: 'B', text: '佩戴正压呼吸器后前往救援，同时上报', correct: true, reason: '正确操作：有毒环境必须先做好个人防护' },
            { id: 'C', text: '先上报，等救援队伍来', correct: false, reason: '响应不及时：有能力救援时应在防护下先行处置' }
        ],
        timeLimit: 8,
        category: 'safety'
    }
];

const SAMPLE_DATA = {
    groupClaims: [
        { scenario: 1, claim: "都撤了，安全第一", score: 20 },
        { scenario: 2, claim: "断电了才安全", score: 25 },
        { scenario: 3, claim: "手机也能用", score: 15 },
        { scenario: 4, claim: "等等再说", score: 20 },
        { scenario: 5, claim: "先救人要紧", score: 15 }
    ],
    records: [
        { id: 1, name: "张三", score: 60, choices: [1,2,3,4,5], time: 55, isNewbie: true },
        { id: 2, name: "李四", score: 80, choices: [1,3,2,1,2], time: 42, isNewbie: false },
        { id: 3, name: "", score: null, choices: [], time: 0, isNewbie: false },
        { id: 4, name: "王五", score: 40, choices: [1,1,1,1,1], time: 60, isNewbie: true },
        { id: 5, name: "李四", score: 80, choices: [1,3,2,1,2], time: 42, isNewbie: false },
        { id: 6, name: "赵六", score: 59, choices: [2,3,1,2,1], time: 59, isNewbie: false, isBoundary: true }
    ]
};

let gameState = {
    score: 100,
    currentScenario: 0,
    timeLeft: 60,
    scenarioTimeLeft: 15,
    isPaused: false,
    isRunning: false,
    isTransitioning: false,
    choices: [],
    startTime: null,
    pauseTime: 0,
    pauseStart: null,
    pauseCount: 0,
    pauseEvents: [],
    isNewbie: Math.random() > 0.5
};

let gameTimer = null;
let scenarioTimer = null;
let lastHandledTimeoutScenario = -1;

const DOM = {
    score: document.getElementById('score'),
    timer: document.getElementById('timer'),
    progress: document.getElementById('progress'),
    startScreen: document.getElementById('startScreen'),
    scenarioScreen: document.getElementById('scenarioScreen'),
    pauseScreen: document.getElementById('pauseScreen'),
    resultScreen: document.getElementById('resultScreen'),
    pauseBtn: document.getElementById('pauseBtn'),
    scenarioTitle: document.getElementById('scenarioTitle'),
    scenarioDesc: document.getElementById('scenarioDesc'),
    options: document.getElementById('options'),
    choicesLog: document.getElementById('choicesLog'),
    failureReasons: document.getElementById('failureReasons'),
    resultTitle: document.getElementById('resultTitle'),
    resultScore: document.getElementById('resultScore'),
    resultStatus: document.getElementById('resultStatus'),
    importData: document.getElementById('importData'),
    importResult: document.getElementById('importResult'),
    validationReport: document.getElementById('validationReport'),
    conflictAlert: document.getElementById('conflictAlert'),
    conflictDetails: document.getElementById('conflictDetails'),
    conflictSuggestions: document.getElementById('conflictSuggestions'),
    historyList: document.getElementById('historyList'),
    toast: document.getElementById('toast')
};

function init() {
    bindEvents();
    loadHistory();
    setupTabs();
}

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });
}

function bindEvents() {
    document.getElementById('startBtn').addEventListener('click', startGame);
    document.getElementById('pauseBtn').addEventListener('click', togglePause);
    document.getElementById('resumeBtn').addEventListener('click', togglePause);
    document.getElementById('replayBtn').addEventListener('click', resetGame);
    document.getElementById('exportBtn').addEventListener('click', exportResult);
    document.getElementById('importBtn').addEventListener('click', importData);
    document.getElementById('loadSampleBtn').addEventListener('click', loadSampleData);
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);
}

function startGame() {
    gameState = {
        score: 100,
        currentScenario: 0,
        timeLeft: 60,
        scenarioTimeLeft: SCENARIOS[0].timeLimit,
        isPaused: false,
        isRunning: true,
        isTransitioning: false,
        choices: [],
        startTime: Date.now(),
        pauseTime: 0,
        pauseStart: null,
        pauseCount: 0,
        pauseEvents: [],
        isNewbie: Math.random() > 0.5
    };
    lastHandledTimeoutScenario = -1;
    
    DOM.startScreen.classList.add('hidden');
    DOM.scenarioScreen.classList.remove('hidden');
    DOM.resultScreen.classList.add('hidden');
    DOM.pauseBtn.style.display = '';
    
    showScenario();
    startTimers();
    updateUI();
}

function startTimers() {
    gameTimer = setInterval(() => {
        if (!gameState.isPaused && gameState.isRunning && !gameState.isTransitioning) {
            gameState.timeLeft--;
            gameState.scenarioTimeLeft--;
            
            if (gameState.scenarioTimeLeft <= 0 && lastHandledTimeoutScenario !== gameState.currentScenario) {
                lastHandledTimeoutScenario = gameState.currentScenario;
                handleTimeout();
            }
            
            if (gameState.timeLeft <= 0 && gameState.isRunning) {
                endGame('timeout');
            }
            
            updateUI();
        }
    }, 1000);
}

function stopTimers() {
    if (gameTimer) clearInterval(gameTimer);
    if (scenarioTimer) clearInterval(scenarioTimer);
}

function togglePause() {
    if (!gameState.isRunning || gameState.isTransitioning) return;
    
    gameState.isPaused = !gameState.isPaused;
    
    if (gameState.isPaused) {
        DOM.scenarioScreen.classList.add('hidden');
        DOM.pauseScreen.classList.remove('hidden');
        gameState.pauseStart = Date.now();
        gameState.pauseCount++;
    } else {
        DOM.pauseScreen.classList.add('hidden');
        DOM.scenarioScreen.classList.remove('hidden');
        const pauseDuration = Date.now() - gameState.pauseStart;
        gameState.pauseTime += pauseDuration;
        gameState.pauseEvents.push({
            index: gameState.pauseCount,
            resumedAt: new Date().toISOString(),
            durationSec: Math.round(pauseDuration / 1000),
            scenarioIndex: gameState.currentScenario,
            scenarioTitle: SCENARIOS[gameState.currentScenario]?.title || '未知',
            scoreAtPause: gameState.score
        });
    }
}

function showScenario() {
    const scenario = SCENARIOS[gameState.currentScenario];
    gameState.scenarioTimeLeft = scenario.timeLimit;
    
    DOM.scenarioTitle.textContent = scenario.title;
    DOM.scenarioDesc.textContent = scenario.desc;
    
    DOM.options.innerHTML = '';
    scenario.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.dataset.optionId = opt.id;
        btn.innerHTML = `<strong>${opt.id}.</strong> ${opt.text}`;
        btn.addEventListener('click', () => handleChoice(opt));
        DOM.options.appendChild(btn);
    });
}

function handleChoice(option) {
    if (gameState.isTransitioning) return;
    gameState.isTransitioning = true;
    
    const scenario = SCENARIOS[gameState.currentScenario];
    const timeTaken = scenario.timeLimit - gameState.scenarioTimeLeft;
    
    const choiceRecord = {
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        choice: option.id,
        choiceText: option.text,
        isCorrect: option.correct,
        reason: option.reason,
        timeTaken: timeTaken,
        category: scenario.category
    };
    
    if (!option.correct) {
        const deduction = gameState.isNewbie ? 15 : 20;
        gameState.score -= deduction;
        choiceRecord.penalty = deduction;
        choiceRecord.penaltyType = timeTaken > (scenario.timeLimit * 0.8) ? 'speed' : 'rule';
    }
    
    gameState.choices.push(choiceRecord);
    highlightChoice(option.id, option.correct);
    
    setTimeout(() => {
        lastHandledTimeoutScenario = -1;
        gameState.currentScenario++;
        if (gameState.currentScenario >= SCENARIOS.length) {
            endGame('complete');
        } else {
            showScenario();
        }
        gameState.isTransitioning = false;
        updateUI();
    }, 1000);
}

function handleTimeout() {
    if (gameState.isTransitioning) return;
    gameState.isTransitioning = true;
    
    const scenario = SCENARIOS[gameState.currentScenario];
    
    const choiceRecord = {
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        choice: null,
        choiceText: '超时未作答',
        isCorrect: false,
        reason: '操作超时，未能在规定时间内做出判断',
        timeTaken: scenario.timeLimit,
        penalty: 15,
        penaltyType: 'speed',
        isTimeout: true,
        category: scenario.category
    };
    
    gameState.score -= 15;
    gameState.choices.push(choiceRecord);
    
    showToast('作答超时！', 'warning');
    
    setTimeout(() => {
        lastHandledTimeoutScenario = -1;
        gameState.currentScenario++;
        if (gameState.currentScenario >= SCENARIOS.length) {
            endGame('complete');
        } else {
            showScenario();
        }
        gameState.isTransitioning = false;
        updateUI();
    }, 1000);
}

function highlightChoice(optionId, isCorrect) {
    const buttons = DOM.options.querySelectorAll('.option-btn');
    buttons.forEach(btn => {
        if (btn.dataset.optionId === optionId) {
            btn.classList.add(isCorrect ? 'correct' : 'incorrect');
        }
        btn.disabled = true;
    });
}

function endGame(reason) {
    gameState.isRunning = false;
    stopTimers();
    
    const totalTime = Math.floor((Date.now() - gameState.startTime - gameState.pauseTime) / 1000);
    const passed = gameState.score >= 60;
    
    const result = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        score: gameState.score,
        passed: passed,
        endReason: reason,
        totalTime: totalTime,
        isNewbie: gameState.isNewbie,
        choices: gameState.choices,
        pauseCount: gameState.pauseCount,
        pauseEvents: gameState.pauseEvents,
        totalPauseSec: Math.round(gameState.pauseTime / 1000),
        analysis: analyzeResult()
    };
    
    saveToHistory(result);
    showResult(result);
}

function analyzeResult() {
    const analysis = {
        ruleErrors: 0,
        speedErrors: 0,
        correctCount: 0,
        timeoutCount: 0,
        newbieMistakes: []
    };
    
    gameState.choices.forEach(choice => {
        if (choice.isCorrect) {
            analysis.correctCount++;
        } else if (choice.isTimeout) {
            analysis.timeoutCount++;
            analysis.speedErrors++;
        } else {
            if (choice.penaltyType === 'rule') {
                analysis.ruleErrors++;
            } else {
                analysis.speedErrors++;
            }
            if (gameState.isNewbie && choice.category === 'safety') {
                analysis.newbieMistakes.push(choice);
            }
        }
    });
    
    return analysis;
}

function showResult(result) {
    DOM.scenarioScreen.classList.add('hidden');
    DOM.pauseScreen.classList.add('hidden');
    DOM.resultScreen.classList.remove('hidden');
    DOM.pauseBtn.style.display = 'none';
    
    const passed = result.score >= 60;
    DOM.resultTitle.textContent = passed ? '🎉 巡检通过！' : '❌ 巡检未通过';
    DOM.resultScore.textContent = `最终得分：${result.score}分`;
    DOM.resultStatus.textContent = passed ? '通过' : '未通过';
    DOM.resultStatus.className = `status-badge ${passed ? 'pass' : 'fail'}`;
    
    renderChoicesLog(result.choices);
    renderFailureReasons(result);
    renderPauseLog(result);
}

function renderChoicesLog(choices) {
    DOM.choicesLog.innerHTML = '';
    
    choices.forEach((choice, index) => {
        const item = document.createElement('div');
        item.className = `choice-item ${choice.isCorrect ? 'correct' : choice.isTimeout ? 'timeout' : 'incorrect'}`;
        
        const status = choice.isCorrect ? '✓ 正确' : choice.isTimeout ? '⏱️ 超时' : '✗ 错误';
        const penaltyText = choice.penalty ? `（-${choice.penalty}分）` : '';
        
        item.innerHTML = `
            <div class="choice-title">${index + 1}. ${choice.scenarioTitle} - ${status} ${penaltyText}</div>
            <div class="choice-detail">选择：${choice.choiceText}</div>
            <div class="choice-detail">用时：${choice.timeTaken}秒</div>
            <div class="choice-reason">📝 ${choice.reason}</div>
        `;
        
        DOM.choicesLog.appendChild(item);
    });
}

function renderFailureReasons(result) {
    DOM.failureReasons.innerHTML = '';
    
    const analysis = result.analysis;
    const reasons = [];
    
    if (analysis.ruleErrors > 0) {
        reasons.push({
            type: 'rule',
            title: '🔴 规则理解问题',
            desc: `有${analysis.ruleErrors}处错误是由于对巡检规则理解不准确导致的。建议重点复习《管廊巡检作业指导书》中关于处置权限和分级响应的内容。`
        });
    }
    
    if (analysis.speedErrors > 0) {
        reasons.push({
            type: 'speed',
            title: '🟡 反应速度问题',
            desc: `有${analysis.speedErrors}处超时或犹豫导致的扣分。实战中突发情况需要快速判断，建议多加模拟练习。`
        });
    }
    
    if (analysis.newbieMistakes.length > 0) {
        reasons.push({
            type: 'rule',
            title: '🆕 新手常见误区',
            desc: `检测到${analysis.newbieMistakes.length}处新手典型错误。特别注意：有毒环境下必须先防护再施救，这是生命安全的底线！`
        });
    }
    
    if (result.score === 59 || result.score === 60) {
        reasons.push({
            type: 'speed',
            title: '⚖️ 边界分数提醒',
            desc: '你的分数处于及格线边缘，建议再巩固一下薄弱环节，确保万无一失。'
        });
    }
    
    if (reasons.length === 0) {
        DOM.failureReasons.innerHTML = '<div class="reason-card"><div class="reason-title">🎉 表现优秀！</div><div class="reason-desc">所有判断都准确及时，继续保持！</div></div>';
        return;
    }
    
    reasons.forEach(reason => {
        const card = document.createElement('div');
        card.className = `reason-card ${reason.type}`;
        card.innerHTML = `
            <div class="reason-title">${reason.title}</div>
            <div class="reason-desc">${reason.desc}</div>
        `;
        DOM.failureReasons.appendChild(card);
    });
}

function renderPauseLog(result) {
    let existing = document.getElementById('pauseLogSection');
    if (existing) existing.remove();
    
    if (!result.pauseCount || result.pauseCount === 0) return;
    
    const section = document.createElement('div');
    section.id = 'pauseLogSection';
    section.className = 'result-analysis';
    section.innerHTML = '<h3>⏸️ 暂停记录</h3>';
    
    const log = document.createElement('div');
    log.className = 'choices-log';
    
    result.pauseEvents.forEach(evt => {
        const item = document.createElement('div');
        item.className = 'choice-item timeout';
        item.innerHTML = `
            <div class="choice-title">第${evt.index}次暂停 - ${evt.scenarioTitle}</div>
            <div class="choice-detail">暂停时得分：${evt.scoreAtPause}分</div>
            <div class="choice-detail">暂停时长：${evt.durationSec}秒</div>
            <div class="choice-detail">恢复时间：${new Date(evt.resumedAt).toLocaleString('zh-CN')}</div>
        `;
        log.appendChild(item);
    });
    
    section.appendChild(log);
    DOM.failureReasons.parentElement.appendChild(section);
}

function resetGame() {
    stopTimers();
    DOM.startScreen.classList.remove('hidden');
    DOM.resultScreen.classList.add('hidden');
    DOM.scenarioScreen.classList.add('hidden');
    DOM.pauseScreen.classList.add('hidden');
    DOM.pauseBtn.style.display = 'none';
    updateUI();
}

function updateUI() {
    DOM.score.textContent = gameState.score;
    DOM.timer.textContent = gameState.timeLeft;
    DOM.progress.textContent = `${gameState.currentScenario}/${SCENARIOS.length}`;
}

function exportResult() {
    const history = getHistory();
    const latest = history[0];
    
    if (!latest) {
        showToast('没有可导出的数据', 'error');
        return;
    }
    
    const exportData = {
        tool: '地下管廊巡检战',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        record: {
            ...latest,
            humanReadable: {
                overall: `本次巡检最终得分${latest.score}分，${latest.passed ? '通过' : '未通过'}考核。`,
                summary: generateHumanReadableSummary(latest)
            }
        }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `地下管廊巡检战_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}_${latest.score}分.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('导出成功！', 'success');
}

function generateHumanReadableSummary(record) {
    const summary = [];
    
    summary.push(`【基本情况】
- 参与人员：${record.isNewbie ? '新手学员' : '有经验学员'}
- 总用时：${record.totalTime}秒
- 正确判断：${record.analysis.correctCount}/${SCENARIOS.length}题
- 暂停次数：${record.pauseCount || 0}次
- 暂停总时长：${record.totalPauseSec || 0}秒`);

    const errors = record.choices.filter(c => !c.isCorrect);
    if (errors.length > 0) {
        summary.push(`【错误复盘】`);
        errors.forEach((e, i) => {
            const penaltyLabel = e.penaltyType === 'rule' ? '规则理解' : e.isTimeout ? '操作超时' : '操作速度';
            summary.push(`${i + 1}. ${e.scenarioTitle}
   - 错误选择：${e.choiceText}
   - 扣分原因：${e.reason}
   - 扣分类型：${penaltyLabel}`);
        });
    }
    
    if (record.pauseEvents && record.pauseEvents.length > 0) {
        summary.push(`【暂停记录】`);
        record.pauseEvents.forEach((evt, i) => {
            summary.push(`${i + 1}. 第${evt.index}次暂停 - ${evt.scenarioTitle}
   - 暂停时得分：${evt.scoreAtPause}分
   - 暂停时长：${evt.durationSec}秒
   - 恢复时间：${new Date(evt.resumedAt).toLocaleString('zh-CN')}`);
        });
    }
    
    if (record.analysis.ruleErrors > record.analysis.speedErrors) {
        summary.push(`【改进建议】重点加强规则学习，特别是处置权限和分级响应标准。`);
    } else if (record.analysis.speedErrors > 0) {
        summary.push(`【改进建议】多做模拟练习，提高应急情况下的反应速度。`);
    }
    
    return summary.join('\n\n');
}

function loadSampleData() {
    DOM.importData.value = JSON.stringify(SAMPLE_DATA, null, 2);
    showToast('示例数据已加载', 'success');
}

function importData() {
    const raw = DOM.importData.value.trim();
    
    if (!raw) {
        showToast('请输入数据', 'error');
        return;
    }
    
    try {
        const data = JSON.parse(raw);
        const validation = validateData(data);
        
        renderValidationReport(validation);
        
        if (validation.hasConflicts) {
            renderConflicts(validation.conflicts, data);
        }
        
        DOM.importResult.classList.remove('hidden');
        
    } catch (e) {
        showToast('JSON格式错误: ' + e.message, 'error');
    }
}

function validateData(data) {
    const result = {
        isValid: true,
        issues: [],
        hasConflicts: false,
        conflicts: [],
        stats: {
            total: 0,
            empty: 0,
            duplicates: 0,
            boundary: 0
        }
    };
    
    if (!data.records || !Array.isArray(data.records)) {
        result.isValid = false;
        result.issues.push({ type: 'error', message: '缺少records数组' });
        return result;
    }
    
    result.stats.total = data.records.length;
    const seen = new Map();
    
    data.records.forEach((record, index) => {
        if (!record.name || record.name.trim() === '') {
            result.stats.empty++;
            result.issues.push({ type: 'warning', message: `记录${index + 1}：用户名为空` });
        }
        
        if (record.score === null || record.score === undefined) {
            result.stats.empty++;
            result.issues.push({ type: 'warning', message: `记录${index + 1}：分数为空` });
        }
        
        const key = `${record.name}_${record.score}_${record.choices?.join(',')}`;
        if (seen.has(key)) {
            result.stats.duplicates++;
            result.issues.push({ type: 'warning', message: `记录${index + 1}：与记录${seen.get(key) + 1}重复` });
        } else {
            seen.set(key, index);
        }
        
        if (record.isBoundary || record.score === 59 || record.score === 60) {
            result.stats.boundary++;
            result.issues.push({ type: 'warning', message: `记录${index + 1}：边界分数${record.score}分，需重点关注` });
        }
    });
    
    if (data.groupClaims && data.records) {
        result.hasConflicts = true;
        result.conflicts = detectConflicts(data);
    }
    
    return result;
}

function detectConflicts(data) {
    const conflicts = [];
    
    data.groupClaims.forEach(claim => {
        const scenario = SCENARIOS.find(s => s.id === claim.scenario);
        if (!scenario) return;
        
        const correctOption = scenario.options.find(o => o.correct);
        
        const recordsWithChoice = data.records.filter(r => 
            r.choices && r.choices[claim.scenario - 1] !== undefined
        );
        
        const avgScoreForClaim = recordsWithChoice.reduce((sum, r) => sum + (r.score || 0), 0) / (recordsWithChoice.length || 1);
        
        if (Math.abs(avgScoreForClaim - claim.score) > 20) {
            conflicts.push({
                scenario: claim.scenario,
                scenarioTitle: scenario.title,
                groupClaim: claim.claim,
                groupClaimScore: claim.score,
                actualAvgScore: Math.round(avgScoreForClaim),
                correctAnswer: correctOption?.text,
                suggestion: '建议核对群内说法的来源和依据，实际数据显示该场景的整体表现与预期有较大差异。'
            });
        }
    });
    
    return conflicts;
}

function renderValidationReport(validation) {
    let html = '';
    
    html += `<div class="validation-item success">✓ 共导入 ${validation.stats.total} 条记录</div>`;
    
    if (validation.stats.empty > 0) {
        html += `<div class="validation-item warning">⚠️ 发现 ${validation.stats.empty} 处空值字段</div>`;
    }
    
    if (validation.stats.duplicates > 0) {
        html += `<div class="validation-item warning">⚠️ 发现 ${validation.stats.duplicates} 条重复记录</div>`;
    }
    
    if (validation.stats.boundary > 0) {
        html += `<div class="validation-item warning">⚠️ 发现 ${validation.stats.boundary} 条边界记录</div>`;
    }
    
    validation.issues.forEach(issue => {
        html += `<div class="validation-item ${issue.type}">${issue.message}</div>`;
    });
    
    DOM.validationReport.innerHTML = html;
}

function renderConflicts(conflicts, data) {
    DOM.conflictAlert.classList.remove('hidden');
    
    let detailsHtml = '';
    let suggestionsHtml = '';
    
    conflicts.forEach(conflict => {
        detailsHtml += `
            <div class="conflict-item">
                <h5>${conflict.scenarioTitle}</h5>
                <div class="conflict-evidence">
                    <div class="evidence-side">
                        <h5>📱 群内说法</h5>
                        <p>"${conflict.groupClaim}"</p>
                        <p><strong>预期分数：${conflict.groupClaimScore}分</strong></p>
                    </div>
                    <div class="evidence-side">
                        <h5>📊 实际数据</h5>
                        <p>平均分：${conflict.actualAvgScore}分</p>
                        <p><strong>正确答案：${conflict.correctAnswer}</strong></p>
                    </div>
                </div>
            </div>
        `;
        
        suggestionsHtml += `
            <div class="suggestion-item">
                <strong>建议动作：</strong>${conflict.suggestion}
            </div>
        `;
    });
    
    DOM.conflictDetails.innerHTML = detailsHtml;
    DOM.conflictSuggestions.innerHTML = '<h5>💡 建议</h5>' + suggestionsHtml;
}

function getHistory() {
    try {
        return JSON.parse(localStorage.getItem('tunnelPatrol_history') || '[]');
    } catch {
        return [];
    }
}

function saveToHistory(result) {
    const history = getHistory();
    history.unshift(result);
    localStorage.setItem('tunnelPatrol_history', JSON.stringify(history.slice(0, 50)));
    loadHistory();
}

function loadHistory() {
    const history = getHistory();
    
    if (history.length === 0) {
        DOM.historyList.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">暂无历史记录</p>';
        return;
    }
    
    DOM.historyList.innerHTML = '';
    
    history.forEach(record => {
        const item = document.createElement('div');
        item.className = `history-item ${record.passed ? 'pass' : 'fail'}`;
        
        const pauseInfo = record.pauseCount > 0
            ? `<p>暂停：${record.pauseCount}次，共${record.totalPauseSec || 0}秒</p>`
            : '';
        
        item.innerHTML = `
            <div class="history-header">
                <span class="history-score">${record.score}分</span>
                <span class="history-time">${new Date(record.timestamp).toLocaleString('zh-CN')}</span>
            </div>
            <details class="history-detail">
                <summary>查看详情</summary>
                <p>状态：${record.passed ? '通过' : '未通过'}</p>
                <p>学员类型：${record.isNewbie ? '新手' : '有经验'}</p>
                <p>用时：${record.totalTime}秒</p>
                <p>正确：${record.analysis.correctCount}/${SCENARIOS.length}</p>
                <p>规则错误：${record.analysis.ruleErrors}次</p>
                <p>速度错误：${record.analysis.speedErrors}次</p>
                ${pauseInfo}
            </details>
        `;
        
        DOM.historyList.appendChild(item);
    });
}

function clearHistory() {
    if (confirm('确定要清空所有历史记录吗？')) {
        localStorage.removeItem('tunnelPatrol_history');
        loadHistory();
        showToast('历史记录已清空', 'success');
    }
}

function showToast(message, type = 'success') {
    DOM.toast.textContent = message;
    DOM.toast.className = `toast ${type}`;
    
    setTimeout(() => {
        DOM.toast.classList.add('hidden');
    }, 3000);
}

init();