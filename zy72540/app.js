const statusTextMap = {
    'pending': '待处理',
    'processing': '处理中',
    'normal': '正常（口径正确）',
    'duplicate': '重复计入（待复核）',
    'review': '标注负责人复核中',
    'old-caliber': '旧口径补录',
    'duplicate-confirmed': '重复计入（已确认剔除）'
};

const sceneAnalysisData = {
    normal: {
        baseInfo: [
            { label: '记录编号', value: 'ABN-2026-0001' },
            { label: '异常类型', value: 'APP崩溃闪退' },
            { label: '用户账号', value: 'user_88291' },
            { label: '创建时间', value: '2026-06-07 10:30:00' },
            { label: '异常发生时间', value: '2026-06-07 10:28:35' },
            { label: '操作系统', value: 'iOS 16.5' },
            { label: 'APP版本', value: 'v2.8.1' }
        ],
        annotatorAnalysis: {
            keyPoints: [
                { label: '复现情况', value: '已成功复现该问题' },
                { label: '崩溃现象', value: '账单查询页连续点击3次后闪退' },
                { label: '初步定位', value: '与前端列表渲染逻辑相关' },
                { label: '日志分析', value: '崩溃日志显示内存溢出(OOM)' }
            ],
            conclusion: '标注员判断：该异常属于真实有效异常，符合当前口径定义，建议标记为正常异常记录。',
            summary: '标注员张工通过复现和日志分析，定位为前端列表渲染导致的内存溢出问题。'
        },
        modelAnalysis: {
            original: {
                keyPoints: [
                    { label: '模型版本', value: 'v2.3.1' },
                    { label: '置信度', value: '0.92（高置信度）' },
                    { label: '异常类型识别', value: 'APP崩溃闪退（匹配）' },
                    { label: 'Top1原因', value: '列表渲染内存未释放（置信度0.78）' },
                    { label: 'Top2原因', value: 'iOS 16.5兼容性问题（置信度0.65）' }
                ],
                conclusion: '模型分析结果与标注员判断一致，异常口径匹配正确。',
                summary: '模型输出识别为APP崩溃闪退，高置信度定位内存溢出问题，与人工分析一致。'
            },
            rerun: {
                keyPoints: [
                    { label: '模型版本', value: 'v2.3.1（重跑）' },
                    { label: '置信度', value: '0.95（更高）' },
                    { label: '异常类型识别', value: 'APP崩溃闪退（确认）' },
                    { label: '已确认原因', value: '列表渲染内存溢出（置信度0.88）' },
                    { label: '处理建议', value: '增加虚拟滚动+点击节流' }
                ],
                conclusion: '重跑后模型结论更明确，与标注员分析完全吻合。',
                summary: '模型重跑后置信度提升至0.95，明确确认内存溢出为根因。'
            }
        },
        finalConclusion: {
            statusJudgement: '口径正确，确认为有效异常记录',
            evidenceChain: '用户反馈 → 标注员复现定位 → 模型分析确认 → 结论一致',
            riskLevel: '中风险（影响用户体验，需前端修复）',
            suggestion: '建议前端团队优化列表渲染，增加虚拟滚动和点击节流机制。',
            resultNote: '该记录处理流程顺畅，人工判断与模型输出高度一致，无口径争议，无返工需求。'
        }
    },
    duplicate: {
        baseInfo: [
            { label: '记录编号', value: 'ABN-2026-0002' },
            { label: '异常类型', value: '用户登录失败' },
            { label: '用户账号', value: 'user_33456' },
            { label: '创建时间', value: '2026-06-07 11:15:00' },
            { label: '异常发生时间', value: '2026-06-07 11:12:00' },
            { label: '用户IP', value: '114.88.xx.xx（上海电信）' },
            { label: '历史反馈', value: '近7天 3 次同类反馈' }
        ],
        annotatorAnalysis: {
            keyPoints: [
                { label: '历史工单1', value: 'WO-2026-05621（6月5日，相同问题）' },
                { label: '历史工单2', value: 'WO-2026-05789（6月6日，相同问题）' },
                { label: '历史结论', value: '前两次均判定为网络波动导致的临时失败' },
                { label: '本次疑点', value: '第三次反馈，是否属于有效异常存疑' }
            ],
            conclusion: '标注员判断：该用户反馈疑似重复计入，建议提交标注负责人复核，暂不直接归为正常。',
            summary: '标注员李工发现该用户近7天已有2次相同反馈，本次可能属于重复计入，不急于归正常。'
        },
        modelAnalysis: {
            original: {
                keyPoints: [
                    { label: '模型版本', value: 'v2.3.1' },
                    { label: '置信度', value: '0.88' },
                    { label: '异常类型识别', value: '用户登录失败' },
                    { label: '关联检测', value: '检测到近7天 2 条历史反馈记录' },
                    { label: '模型建议', value: '核实用户网络环境，检查账号状态' }
                ],
                conclusion: '模型识别为登录失败异常，但检测到历史关联记录，需人工判断是否重复。',
                summary: '模型初始输出聚焦于异常本身，检测到历史关联但未明确提示重复。'
            },
            rerun: {
                keyPoints: [
                    { label: '模型版本', value: 'v2.3.1（重跑）' },
                    { label: '置信度', value: '0.90' },
                    { label: '异常类型识别', value: '用户登录失败' },
                    { label: '重复检测', value: '⚠️ 近7天累计 3 条同类反馈，疑似重复' },
                    { label: '关联工单', value: 'WO-2026-05621、05789、05902' }
                ],
                conclusion: '重跑后模型明确提示疑似重复计入，强烈建议人工复核。',
                summary: '模型重跑后明确输出重复检测警告，与标注员的怀疑一致，支持提交复核。'
            }
        },
        finalConclusion: {
            statusJudgement: '疑似重复计入，已提交标注负责人复核（不急于归正常）',
            evidenceChain: '用户反馈 → 标注员发现历史重复 → 模型重跑确认重复风险 → 提交复核',
            riskLevel: '低风险（若为重复计入则剔除，避免无效异常统计）',
            suggestion: '请标注负责人陈主管复核：确认是否为同一用户重复反馈，若确认则剔除该记录。',
            resultNote: '该记录的关键在于"别急着归正常"——重复计入问题需由标注负责人做最终判断，留痕明面上展示返工过程。'
        }
    },
    'old-caliber': {
        baseInfo: [
            { label: '记录编号', value: 'ABN-2026-0003' },
            { label: '异常类型', value: '账户余额显示异常' },
            { label: '用户账号', value: 'user_77812' },
            { label: '创建时间', value: '2026-06-07 09:45:00' },
            { label: '异常发生时间', value: '2026-06-07 09:42:00' },
            { label: '余额差异', value: '1000元' },
            { label: '数据延迟', value: '约72分钟' }
        ],
        annotatorAnalysis: {
            keyPoints: [
                { label: '问题现象', value: '余额显示与实际不符，相差1000元' },
                { label: '问题相似度', value: '与上月修复的"余额更新延迟"现象一致' },
                { label: '当前口径v3.1', value: '数据同步延迟>30分钟视为异常' },
                { label: '历史口径v2.5', value: '数据同步延迟>2小时视为异常' },
                { label: '实际延迟', value: '约72分钟，介于两个口径之间' }
            ],
            conclusion: '标注员判断：该异常涉及新旧口径差异，需明确采用哪个口径进行判定，属于旧口径补录场景。',
            summary: '标注员王工发现72分钟的延迟在新旧口径下判定结果相反，需要补录处理。'
        },
        modelAnalysis: {
            original: {
                keyPoints: [
                    { label: '模型版本', value: 'v2.3.1' },
                    { label: '置信度', value: '0.85' },
                    { label: '异常类型识别', value: '账户余额显示异常' },
                    { label: '根因分析', value: '数据同步延迟（置信度0.90）' },
                    { label: '口径引用', value: '按当前v3.1口径，>30分钟即视为异常' }
                ],
                conclusion: '模型按当前口径判定为异常，但未提示历史口径差异。',
                summary: '模型初始输出按新口径判定异常，但未识别出这是旧口径场景。'
            },
            rerun: {
                keyPoints: [
                    { label: '模型版本', value: 'v2.3.1（重跑-补录触发）' },
                    { label: '置信度', value: '0.87' },
                    { label: '异常类型识别', value: '账户余额显示异常' },
                    { label: '口径变更提示', value: '⚠️ 检测到曾使用v2.5旧口径（>2小时算异常）' },
                    { label: '双口径对比', value: 'v3.1: 72分钟>30分钟→异常 | v2.5: 72分钟<120分钟→正常' }
                ],
                conclusion: '重跑后模型明确提示口径变更，需根据实际业务场景选择口径。',
                summary: '模型重跑后补全了旧口径信息，展示双口径判定差异，支持补录处理。'
            }
        },
        finalConclusion: {
            statusJudgement: '旧口径补录场景：按v3.1新口径算异常，按v2.5旧口径算正常',
            evidenceChain: '用户反馈 → 标注员发现口径差异 → 模型重跑补充旧口径信息 → 双口径对比展示',
            riskLevel: '中风险（口径变更导致判定差异，需保留双口径记录便于追溯）',
            suggestion: '按旧口径补录处理：保留新口径判定结果的同时，注明历史口径下的判定差异，便于后续统计口径调整。',
            resultNote: '该记录的返工价值在于"补"——从模型输出片段补充了旧口径信息，使得判定依据更完整，返工过程明面上可见。'
        }
    }
};

const demoData = {
    normal: {
        id: 'ABN-2026-0001',
        createTime: '2026-06-07 10:30:00',
        userAccount: 'user_88291',
        title: '用户反馈APP闪退问题',
        abnormalDesc: '用户在使用账单查询功能时，连续点击3次后出现APP闪退现象。该问题在iOS 16.5系统上复现，Android设备暂未发现。',
        status: 'pending',
        annotatorMessage: null,
        modelOutput: null,
        evidence: null,
        history: []
    },
    duplicate: {
        id: 'ABN-2026-0002',
        createTime: '2026-06-07 11:15:00',
        userAccount: 'user_33456',
        title: '用户反馈登录失败',
        abnormalDesc: '用户反馈输入正确账号密码后无法登录，提示"网络异常请重试"。该用户近7天已有3次类似反馈。',
        status: 'pending',
        annotatorMessage: null,
        modelOutput: null,
        evidence: null,
        history: []
    },
    'old-caliber': {
        id: 'ABN-2026-0003',
        createTime: '2026-06-07 09:45:00',
        userAccount: 'user_77812',
        title: '用户反馈余额显示异常',
        abnormalDesc: '用户反馈账户余额显示与实际不符，相差1000元。经初步核查，该问题与上月已修复的"余额更新延迟"问题类似。',
        status: 'pending',
        annotatorMessage: null,
        modelOutput: null,
        evidence: null,
        history: []
    }
};

const annotatorMessages = {
    normal: {
        content: '用户反馈在账单查询页连续点击闪退，已复现。iOS 16.5系统，APP版本2.8.1。崩溃日志显示内存溢出，与列表渲染逻辑有关。建议前端优化列表渲染，增加节流处理。',
        author: '张工（标注员）',
        time: '2026-06-07 10:45:00'
    },
    duplicate: {
        content: '用户反馈登录失败，经查该用户6月5日、6月6日各有一条相同反馈记录，工单编号分别为WO-2026-05621和WO-2026-05789，均已记录为"网络波动导致的临时登录失败"。本次是否属于重复计入需要进一步确认。',
        author: '李工（标注员）',
        time: '2026-06-07 11:30:00'
    },
    'old-caliber': {
        content: '用户反馈余额显示异常，与上月修复的"余额更新延迟"问题现象一致。查看历史记录，该口径之前定义为"数据同步延迟不超过2小时视为正常"，但本月新口径调整为"超过30分钟即为异常"。需要确认采用哪个口径。',
        author: '王工（标注员）',
        time: '2026-06-07 10:00:00'
    }
};

const modelOutputs = {
    normal: {
        original: `【模型版本：v2.3.1】
【分析时间：2026-06-07 10:35:00】
异常类型：APP崩溃闪退
置信度：0.92
可能原因：
1. 列表渲染时未正确释放内存（置信度0.78）
2. iOS 16.5系统兼容性问题（置信度0.65）
3. 数据量过大导致UI阻塞（置信度0.52）
建议处理：前端优化列表渲染逻辑，增加虚拟滚动`,
        rerun: `【模型版本：v2.3.1】
【分析时间：2026-06-07 10:50:00】
【重跑触发：人工修正后】
异常类型：APP崩溃闪退
置信度：0.95
可能原因：
1. 列表渲染内存溢出 - 已确认（置信度0.88）
2. iOS 16.5特定版本问题（置信度0.71）
处理建议：
- 前端增加列表项复用机制
- 添加点击事件节流（throttle）
- 限制单页加载数量`
    },
    duplicate: {
        original: `【模型版本：v2.3.1】
【分析时间：2026-06-07 11:20:00】
异常类型：用户登录失败
置信度：0.88
可能原因：
1. 网络连接异常（置信度0.82）
2. 账号状态异常（置信度0.45）
3. 服务端认证服务临时故障（置信度0.38）
关联记录：检测到该用户近7天有2条历史反馈记录
建议处理：核实用户网络环境，检查账号状态`,
        rerun: `【模型版本：v2.3.1】
【分析时间：2026-06-07 11:40:00】
【重跑触发：标记为重复计入待复核】
异常类型：用户登录失败
置信度：0.90
可能原因：
1. 网络连接异常（置信度0.85）
<span class="output-highlight">⚠️ 重复检测：该用户近7天累计3条同类反馈，建议人工复核是否为有效异常</span>
关联工单：WO-2026-05621、WO-2026-05789、WO-2026-05902
建议处理：请标注负责人确认是否重复计入`
    },
    'old-caliber': {
        original: `【模型版本：v2.3.1】
【分析时间：2026-06-07 09:50:00】
异常类型：账户余额显示异常
置信度：0.85
可能原因：
1. 数据同步延迟（置信度0.90）
2. 缓存未及时更新（置信度0.75）
3. 账务系统计算错误（置信度0.20）
口径说明：根据当前v3.1口径，数据同步延迟>30分钟视为异常
建议处理：核查数据同步时间，确认是否符合异常口径`,
        rerun: `【模型版本：v2.3.1】
【分析时间：2026-06-07 10:10:00】
【重跑触发：旧口径补录】
异常类型：账户余额显示异常
置信度：0.87
可能原因：
1. 数据同步延迟（置信度0.92）
2. 缓存未及时更新（置信度0.78）
<span class="output-highlight">⚠️ 口径变更提示：检测到该场景曾使用v2.5旧口径（延迟>2小时视为异常）</span>
当前口径：v3.1（延迟>30分钟视为异常）
历史口径：v2.5（延迟>2小时视为异常）
建议处理：根据实际业务场景选择对应口径进行标注`
    }
};

let currentScene = 'normal';
let currentData = null;
let currentRole = '标注员';
let step1Completed = false;
let step2Completed = false;
let step3Completed = false;
let hasRerun = false;

function init() {
    loadScene('normal');
    bindEvents();
}

function loadScene(scene) {
    currentScene = scene;
    currentData = JSON.parse(JSON.stringify(demoData[scene]));
    step1Completed = false;
    step2Completed = false;
    step3Completed = false;
    hasRerun = false;

    document.querySelectorAll('.scene-item').forEach(item => {
        item.classList.toggle('active', item.dataset.scene === scene);
    });

    renderRecordInfo();
    resetPanels();
    renderBaseEvidence();
    renderHistory();
}

function renderRecordInfo() {
    document.getElementById('recordId').textContent = currentData.id;
    document.getElementById('createTime').textContent = currentData.createTime;
    document.getElementById('userAccount').textContent = currentData.userAccount;
    document.getElementById('recordTitle').textContent = currentData.title;
    document.getElementById('abnormalDesc').textContent = currentData.abnormalDesc;
    updateStatusBadge();
}

function updateStatusBadge() {
    const badge = document.getElementById('recordStatus');
    badge.className = 'status-badge';
    badge.textContent = statusTextMap[currentData.status] || '待处理';
    if (currentData.status !== 'pending') {
        badge.classList.add(currentData.status);
    }
}

function resetPanels() {
    document.getElementById('annotatorMessage').innerHTML = '<p class="placeholder">点击「导入标注员留言」开始</p>';
    document.getElementById('modelOutput').innerHTML = '<p class="placeholder">完成步骤1后，点击「查看模型输出片段」</p>';
    document.getElementById('correctionNote').value = '';
    document.getElementById('reviewArea').classList.add('hidden');
    document.getElementById('actionArea').classList.remove('hidden');
    resetEvidenceStages();
    updateStepBadges();
    updateButtonStates();
}

function resetEvidenceStages() {
    setStageStatus('base', '已加载', 'completed');
    setStageStatus('annotator', '待导入', '');
    setStageStatus('model', '待查看', '');
    setStageStatus('conclusion', '待更新', '');

    document.getElementById('stageAnnotatorContent').innerHTML = '<p class="placeholder">完成「导入标注员留言」后，展示标注员的关键分析结论</p>';
    document.getElementById('stageModelContent').innerHTML = '<p class="placeholder">完成「查看模型输出片段」后，展示模型的关键分析结论</p>';
    document.getElementById('stageConclusionContent').innerHTML = '<p class="placeholder">完成「更新证据回放」后，展示综合分析结论、状态变化和结果说明</p>';
}

function renderBaseEvidence() {
    const data = sceneAnalysisData[currentScene].baseInfo;
    let html = '';
    data.forEach(item => {
        html += `<div class="kv-row">
            <span class="kv-label">${item.label}</span>
            <span class="kv-value">${item.value}</span>
        </div>`;
    });
    html += `<div class="analysis-box primary">
        <strong>📌 初始状态说明：</strong>该记录刚进入处理流程，当前状态为「<strong>${statusTextMap[currentData.status]}</strong>」，等待标注员导入留言开始分析。
    </div>`;
    document.getElementById('stageBaseContent').innerHTML = html;
}

function setStageStatus(stage, statusText, state) {
    const stageEl = document.querySelector(`.evidence-stage[data-stage="${stage}"]`);
    const statusEl = document.getElementById(`stage${stage.charAt(0).toUpperCase() + stage.slice(1)}Status`);
    stageEl.classList.remove('active', 'completed');
    if (state) stageEl.classList.add(state);
    statusEl.textContent = statusText;
}

function updateStepBadges() {
    const badge1 = document.getElementById('annotatorStepBadge');
    const badge2 = document.getElementById('modelStepBadge');
    const badge3 = document.getElementById('evidenceStepBadge');

    badge1.className = 'step-badge' + (step1Completed ? ' completed' : '');
    badge2.className = 'step-badge' + (step2Completed ? ' completed' : ' disabled');
    badge3.className = 'step-badge' + (step3Completed ? ' completed' : ' disabled');
}

function updateButtonStates() {
    document.getElementById('importMessageBtn').disabled = step1Completed;
    document.getElementById('viewModelBtn').disabled = !step1Completed || step2Completed;
    document.getElementById('refreshEvidenceBtn').disabled = !step2Completed;

    const canProcess = step3Completed && currentRole === '标注员';
    document.getElementById('markNormalBtn').disabled = !canProcess;
    document.getElementById('markDuplicateBtn').disabled = !canProcess;
    document.getElementById('markOldCaliberBtn').disabled = !canProcess;
    document.getElementById('reRunBtn').disabled = !step2Completed;

    document.getElementById('confirmDuplicateBtn').disabled = currentRole !== '标注负责人';
    document.getElementById('rejectDuplicateBtn').disabled = currentRole !== '标注负责人';

    const linksEnabled = step3Completed;
    document.getElementById('oldNewCompareBtn').disabled = !linksEnabled;
    document.getElementById('reportBtn').disabled = !linksEnabled;
}

function importAnnotatorMessage() {
    const prevStatus = currentData.status;
    const msg = annotatorMessages[currentScene];
    const analysis = sceneAnalysisData[currentScene].annotatorAnalysis;

    currentData.annotatorMessage = msg;
    step1Completed = true;
    currentData.status = 'processing';

    document.getElementById('annotatorMessage').innerHTML = `
        <div class="message-item">${msg.content}</div>
        <div class="message-meta">${msg.author} · ${msg.time}</div>
    `;

    let html = '';
    analysis.keyPoints.forEach(item => {
        const cls = item.value.includes('？') || item.value.includes('存疑') ? 'warn' : (item.value.includes('复现') || item.value.includes('定位') ? '' : '');
        html += `<div class="kv-row">
            <span class="kv-label">${item.label}</span>
            <span class="kv-value ${cls}">${item.value}</span>
        </div>`;
    });
    html += `<div class="analysis-box success">
        <strong>🔍 标注员关键分析结论：</strong>${analysis.conclusion}
    </div>`;
    document.getElementById('stageAnnotatorContent').innerHTML = html;

    setStageStatus('annotator', '已完成', 'completed');
    setStageStatus('model', '进行中', 'active');

    addHistory({
        action: '导入标注员留言',
        user: msg.author,
        prevStatus: prevStatus,
        newStatus: currentData.status,
        summary: analysis.summary,
        resultNote: '标注员完成了现场复现和日志分析，将记录从待处理推进到处理中状态。',
        stage: '步骤1/3'
    });

    updateStepBadges();
    updateButtonStates();
    updateStatusBadge();
    showToast('标注员留言导入成功，证据回放已同步更新分析结论', 'success');
}

function viewModelOutput() {
    const prevStatus = currentData.status;
    const output = hasRerun ? modelOutputs[currentScene].rerun : modelOutputs[currentScene].original;
    const analysisKey = hasRerun ? 'rerun' : 'original';
    const analysis = sceneAnalysisData[currentScene].modelAnalysis[analysisKey];

    currentData.modelOutput = output;
    step2Completed = true;

    document.getElementById('modelOutput').innerHTML = output;

    let html = '';
    analysis.keyPoints.forEach(item => {
        let cls = '';
        if (item.value.includes('⚠️') || item.value.includes('重复') || item.value.includes('差异')) cls = 'danger';
        else if (item.value.includes('高置信度') || item.value.includes('确认') || item.value.includes('匹配')) cls = 'ok';
        else if (item.value.includes('存疑')) cls = 'warn';
        html += `<div class="kv-row">
            <span class="kv-label">${item.label}</span>
            <span class="kv-value ${cls}">${item.value}</span>
        </div>`;
    });
    const boxClass = hasRerun ? (currentScene === 'duplicate' || currentScene === 'old-caliber' ? '' : 'success') : 'primary';
    html += `<div class="analysis-box ${boxClass}">
        <strong>🤖 模型${hasRerun ? '重跑后' : '初始'}关键分析结论：</strong>${analysis.conclusion}
    </div>`;
    document.getElementById('stageModelContent').innerHTML = html;

    setStageStatus('model', '已完成', 'completed');
    if (!step3Completed) {
        setStageStatus('conclusion', '可更新', 'active');
    }

    addHistory({
        action: hasRerun ? '查看模型重跑输出' : '查看模型输出片段',
        user: '小孟（模型评测）',
        prevStatus: prevStatus,
        newStatus: currentData.status,
        summary: analysis.summary,
        resultNote: hasRerun
            ? '模型重跑后补充了更详细的分析信息，特别是针对该场景的特殊提示（重复检测/口径变更）。'
            : '模型评测同事小孟补看了模型输出片段，完成了机器分析与人工分析的初步对齐。',
        stage: '步骤2/3'
    });

    updateStepBadges();
    updateButtonStates();
    showToast(hasRerun ? '模型重跑输出已加载，证据回放已更新' : '模型输出片段已加载，证据回放已同步', 'success');
}

function refreshEvidence() {
    const prevStatus = currentData.status;
    const analysis = sceneAnalysisData[currentScene].finalConclusion;
    const annotator = sceneAnalysisData[currentScene].annotatorAnalysis;
    const model = sceneAnalysisData[currentScene].modelAnalysis[hasRerun ? 'rerun' : 'original'];

    step3Completed = true;

    let statusCls = '';
    if (currentScene === 'normal') statusCls = 'ok';
    else if (currentScene === 'duplicate') statusCls = 'warn';
    else statusCls = '';

    let html = `<div class="conclusion-box">
        <div class="conclusion-title">📊 综合分析结论（证据回放汇总）</div>
        <div class="conclusion-row">
            <span class="conclusion-label">判定结果</span>
            <span class="conclusion-content kv-value ${statusCls}"><strong>${analysis.statusJudgement}</strong></span>
        </div>
        <div class="conclusion-row">
            <span class="conclusion-label">证据链</span>
            <span class="conclusion-content">${analysis.evidenceChain}</span>
        </div>
        <div class="conclusion-row">
            <span class="conclusion-label">风险等级</span>
            <span class="conclusion-content">${analysis.riskLevel}</span>
        </div>
        <div class="conclusion-row">
            <span class="conclusion-label">处理建议</span>
            <span class="conclusion-content">${analysis.suggestion}</span>
        </div>
    </div>`;

    html += `<div class="analysis-box success">
        <strong>✅ 标注员分析摘要：</strong>${annotator.summary}
    </div>`;

    const modelBoxClass = hasRerun ? (currentScene === 'duplicate' ? '' : 'primary') : 'primary';
    html += `<div class="analysis-box ${modelBoxClass}">
        <strong>🤖 模型${hasRerun ? '重跑' : ''}分析摘要：</strong>${model.summary}
    </div>`;

    const resultBoxClass = currentScene === 'normal' ? 'success' : (currentScene === 'duplicate' ? '' : 'primary');
    html += `<div class="analysis-box ${resultBoxClass}">
        <strong>📝 结果说明：</strong>${analysis.resultNote}
    </div>`;

    document.getElementById('stageConclusionContent').innerHTML = html;

    setStageStatus('conclusion', '已完成', 'completed');

    addHistory({
        action: '更新证据回放（汇总分析）',
        user: currentRole,
        prevStatus: prevStatus,
        newStatus: currentData.status,
        summary: `已完成三步证据链构建：标注员分析 → 模型分析 → 综合结论。判定：${analysis.statusJudgement}`,
        resultNote: analysis.resultNote,
        stage: '步骤3/3（完成）',
        isStep3: true
    });

    updateStepBadges();
    updateButtonStates();
    showToast('证据回放已更新完成，可查看综合分析结论和历史记录留痕', 'success');
}

function markAsNormal() {
    const prevStatus = currentData.status;
    currentData.status = 'normal';
    addHistory({
        action: '标记为正常（口径正确）',
        user: currentRole,
        prevStatus: prevStatus,
        newStatus: currentData.status,
        summary: '确认口径正确，该异常为有效异常记录，无返工需求。',
        resultNote: '顺利记录：人工判断与模型输出一致，处理完成。',
        stage: '最终判定'
    });
    updateStatusBadge();
    updateButtonStates();
    showToast('已标记为：正常（口径正确）', 'success');
}

function markAsDuplicate() {
    const prevStatus = currentData.status;
    currentData.status = 'review';
    document.getElementById('actionArea').classList.add('hidden');
    document.getElementById('reviewArea').classList.remove('hidden');
    addHistory({
        action: '标记为重复计入（待复核）',
        user: currentRole,
        prevStatus: prevStatus,
        newStatus: currentData.status,
        summary: '疑似同一用户反馈被重复计入，不急着归正常，提交标注负责人复核。',
        resultNote: '按照规范，重复计入问题需由标注负责人做最终判断，返工过程明面上留痕。',
        stage: '最终判定（待复核）'
    });
    updateStatusBadge();
    updateButtonStates();
    showToast('已提交标注负责人复核（未急于归正常）', 'warning');
}

function markAsOldCaliber() {
    const prevStatus = currentData.status;
    currentData.status = 'old-caliber';
    addHistory({
        action: '标记为旧口径补录',
        user: currentRole,
        prevStatus: prevStatus,
        newStatus: currentData.status,
        summary: '该记录从模型输出片段补充了旧口径信息，属于补录返工场景。',
        resultNote: '旧口径补录：保留双口径判定结果，便于后续追溯和统计口径调整。',
        stage: '最终判定'
    });
    updateStatusBadge();
    updateButtonStates();
    showToast('已标记为：旧口径补录', 'success');
}

function reRunModel() {
    const prevStatus = currentData.status;
    hasRerun = true;
    step2Completed = false;
    step3Completed = false;

    document.getElementById('modelOutput').innerHTML = '<p class="placeholder">点击「查看模型输出片段」查看重跑结果</p>';

    setStageStatus('model', '待重看', 'active');
    setStageStatus('conclusion', '待更新', '');
    document.getElementById('stageConclusionContent').innerHTML = '<p class="placeholder">模型已重跑，需重新查看输出并更新证据回放</p>';

    addHistory({
        action: '重新运行模型',
        user: currentRole,
        prevStatus: prevStatus,
        newStatus: currentData.status,
        summary: '人工触发模型重跑，期望获得更精准的分析结果（特别是场景特异性提示）。',
        resultNote: '重跑是返工过程的重要环节——模型输出片段一更新，原来的判断就可能变化，需要重新走步骤2和步骤3。',
        stage: '返工触发'
    });

    updateStepBadges();
    updateButtonStates();
    showToast('模型重跑完成，请重新查看输出并更新证据回放', 'success');
}

function confirmDuplicate() {
    const prevStatus = currentData.status;
    currentData.status = 'duplicate-confirmed';
    document.getElementById('reviewArea').classList.add('hidden');
    addHistory({
        action: '复核确认：重复计入（剔除）',
        user: '陈主管（标注负责人）',
        prevStatus: prevStatus,
        newStatus: currentData.status,
        summary: '标注负责人确认：该记录为同一用户重复反馈，予以剔除，不计入有效异常统计。',
        resultNote: '返工闭环：从标注员发现疑似重复 → 模型重跑验证 → 负责人复核确认，整个流程明面上留痕。',
        stage: '复核完成'
    });
    updateStatusBadge();
    updateButtonStates();
    showToast('复核完成：确认重复计入，已剔除', 'success');
}

function rejectDuplicate() {
    const prevStatus = currentData.status;
    currentData.status = 'normal';
    document.getElementById('reviewArea').classList.add('hidden');
    document.getElementById('actionArea').classList.remove('hidden');
    addHistory({
        action: '复核驳回：确认为有效记录',
        user: '陈主管（标注负责人）',
        prevStatus: prevStatus,
        newStatus: currentData.status,
        summary: '标注负责人复核后认为：虽然该用户有历史反馈，但本次场景存在差异，属于有效异常记录。',
        resultNote: '复核驳回也是正常流程的一部分——留痕展示了判断过程，而不是只有最终结果。',
        stage: '复核完成'
    });
    updateStatusBadge();
    updateButtonStates();
    showToast('复核完成：确认为有效记录', 'success');
}

function saveCorrection() {
    const note = document.getElementById('correctionNote').value.trim();
    if (!note) {
        showToast('请输入修正备注', 'warning');
        return;
    }
    addHistory({
        action: '人工修正备注',
        user: currentRole,
        prevStatus: currentData.status,
        newStatus: currentData.status,
        summary: note,
        resultNote: '修正备注已留痕，可追溯该记录的人工干预过程。',
        stage: '补充说明'
    });
    document.getElementById('correctionNote').value = '';
    showToast('修正备注已保存到历史记录', 'success');
}

function addHistory(record) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const fullRecord = Object.assign({ time: timeStr }, record);
    currentData.history.unshift(fullRecord);
    renderHistory();
}

function renderHistory() {
    const list = document.getElementById('historyList');
    const count = document.getElementById('historyCount');
    count.textContent = `${currentData.history.length} 条记录`;

    if (currentData.history.length === 0) {
        list.innerHTML = '<p class="placeholder">暂无操作记录。完成三步流程后，每一步操作都会在此留痕：包含操作前后状态、关键分析摘要、结果说明。</p>';
        return;
    }

    let html = '';
    currentData.history.forEach(item => {
        html += `<div class="history-item">
            <div class="history-header">
                <span class="history-time">${item.time}</span>
                <span class="history-user">${item.user}</span>
                <span class="history-action-text">${item.action}</span>
                ${item.stage ? `<span class="status-tag processing">${item.stage}</span>` : ''}
            </div>`;

        if (item.prevStatus !== undefined && item.newStatus !== undefined && item.prevStatus !== item.newStatus) {
            html += `<div class="history-status-bar">
                <span class="status-tag ${item.prevStatus}">${statusTextMap[item.prevStatus] || item.prevStatus}</span>
                <span class="arrow-right">→</span>
                <span class="status-tag ${item.newStatus}">${statusTextMap[item.newStatus] || item.newStatus}</span>
                <span style="font-size:11px;color:#8c8c8c;">（状态变化）</span>
            </div>`;
        }

        if (item.summary) {
            html += `<div class="history-summary">
                <span class="summary-label">📌 关键分析摘要：</span>${item.summary}
            </div>`;
        }

        if (item.resultNote) {
            const resultClass = item.isStep3 ? '' : (item.action.includes('复核') || item.action.includes('重复') ? 'warning' : 'info');
            html += `<div class="history-result ${resultClass}">
                <span class="summary-label">📝 结果说明：</span>${item.resultNote}
            </div>`;
        }

        html += `</div>`;
    });
    list.innerHTML = html;
}

function switchRole() {
    currentRole = currentRole === '标注员' ? '标注负责人' : '标注员';
    document.getElementById('currentUser').textContent = currentRole;

    if (currentScene === 'duplicate' && currentData.status === 'review') {
        document.getElementById('reviewArea').classList.toggle('hidden', currentRole !== '标注负责人');
    }

    updateButtonStates();
    showToast(`已切换为：${currentRole}`, 'success');
}

function resetDemo() {
    loadScene(currentScene);
    showToast('演示数据已重置', 'success');
}

function autoRunDemo() {
    showToast('开始自动演示三步流程，将停在证据回放+历史记录查看状态...', 'success');
    let step = 0;
    const steps = [
        () => importAnnotatorMessage(),
        () => viewModelOutput(),
        () => refreshEvidence()
    ];

    const runStep = () => {
        if (step < steps.length) {
            steps[step]();
            step++;
            setTimeout(runStep, 2000);
        } else {
            showToast('✅ 三步流程完成！请重点查看：右侧证据回放的四个阶段分析 + 下方历史记录的状态变化、分析摘要、结果说明', 'success');
        }
    };
    setTimeout(runStep, 500);
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

function bindEvents() {
    document.querySelectorAll('.scene-item').forEach(item => {
        item.addEventListener('click', () => loadScene(item.dataset.scene));
    });

    document.getElementById('importMessageBtn').addEventListener('click', importAnnotatorMessage);
    document.getElementById('viewModelBtn').addEventListener('click', viewModelOutput);
    document.getElementById('refreshEvidenceBtn').addEventListener('click', refreshEvidence);
    document.getElementById('markNormalBtn').addEventListener('click', markAsNormal);
    document.getElementById('markDuplicateBtn').addEventListener('click', markAsDuplicate);
    document.getElementById('markOldCaliberBtn').addEventListener('click', markAsOldCaliber);
    document.getElementById('reRunBtn').addEventListener('click', reRunModel);
    document.getElementById('saveCorrectionBtn').addEventListener('click', saveCorrection);
    document.getElementById('switchRoleBtn').addEventListener('click', switchRole);
    document.getElementById('resetDemoBtn').addEventListener('click', resetDemo);
    document.getElementById('autoRunBtn').addEventListener('click', autoRunDemo);
    document.getElementById('confirmDuplicateBtn').addEventListener('click', confirmDuplicate);
    document.getElementById('rejectDuplicateBtn').addEventListener('click', rejectDuplicate);

    document.getElementById('oldNewCompareBtn').addEventListener('click', () => {
        showToast('新旧记录对比功能待接入', 'warning');
    });
    document.getElementById('reportBtn').addEventListener('click', () => {
        showToast('分析报告功能待接入', 'warning');
    });
}

document.addEventListener('DOMContentLoaded', init);
