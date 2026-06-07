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

const evidenceData = {
    normal: {
        initial: [
            { label: '异常发生时间', value: '2026-06-07 10:28:35', type: 'normal' },
            { label: '用户操作系统', value: 'iOS 16.5', type: 'normal' },
            { label: 'APP版本', value: 'v2.8.1', type: 'normal' },
            { label: '操作路径', value: '首页 → 我的 → 账单查询 → 连续点击', type: 'normal' }
        ],
        updated: [
            { label: '异常发生时间', value: '2026-06-07 10:28:35', type: 'normal' },
            { label: '用户操作系统', value: 'iOS 16.5', type: 'normal' },
            { label: 'APP版本', value: 'v2.8.1', type: 'normal' },
            { label: '操作路径', value: '首页 → 我的 → 账单查询 → 连续点击', type: 'normal' },
            { label: '崩溃类型', value: '内存溢出 (OOM)', type: 'error' },
            { label: '内存峰值', value: '456MB（阈值：300MB）', type: 'warning' },
            { label: '列表项数量', value: '2856项', type: 'warning' },
            { label: '标注结论', value: '前端渲染问题，口径正确', type: 'success' }
        ]
    },
    duplicate: {
        initial: [
            { label: '异常发生时间', value: '2026-06-07 11:12:00', type: 'normal' },
            { label: '用户IP地址', value: '114.88.xx.xx（上海电信）', type: 'normal' },
            { label: '登录方式', value: '手机号+密码', type: 'normal' },
            { label: '历史反馈次数', value: '近7天 3 次', type: 'warning' }
        ],
        updated: [
            { label: '异常发生时间', value: '2026-06-07 11:12:00', type: 'normal' },
            { label: '用户IP地址', value: '114.88.xx.xx（上海电信）', type: 'normal' },
            { label: '登录方式', value: '手机号+密码', type: 'normal' },
            { label: '历史反馈次数', value: '近7天 3 次', type: 'warning' },
            { label: '历史工单1', value: 'WO-2026-05621（6月5日，相同问题）', type: 'warning' },
            { label: '历史工单2', value: 'WO-2026-05789（6月6日，相同问题）', type: 'warning' },
            { label: '重复检测', value: '疑似同一用户重复反馈', type: 'error' },
            { label: '当前状态', value: '待标注负责人复核', type: 'warning' }
        ],
        confirmed: [
            { label: '异常发生时间', value: '2026-06-07 11:12:00', type: 'normal' },
            { label: '用户IP地址', value: '114.88.xx.xx（上海电信）', type: 'normal' },
            { label: '历史反馈次数', value: '近7天 3 次', type: 'warning' },
            { label: '复核结论', value: '确认重复计入，已剔除', type: 'success' },
            { label: '处理人', value: '陈主管（标注负责人）', type: 'normal' },
            { label: '复核时间', value: '2026-06-07 11:50:00', type: 'normal' }
        ]
    },
    'old-caliber': {
        initial: [
            { label: '异常发生时间', value: '2026-06-07 09:42:00', type: 'normal' },
            { label: '余额差异', value: '1000元', type: 'warning' },
            { label: '最后同步时间', value: '2026-06-07 08:30:00', type: 'normal' },
            { label: '数据延迟', value: '约72分钟', type: 'warning' }
        ],
        updated: [
            { label: '异常发生时间', value: '2026-06-07 09:42:00', type: 'normal' },
            { label: '余额差异', value: '1000元', type: 'warning' },
            { label: '最后同步时间', value: '2026-06-07 08:30:00', type: 'normal' },
            { label: '数据延迟', value: '约72分钟', type: 'warning' },
            { label: '当前口径(v3.1)', value: '>30分钟视为异常 → 符合异常条件', type: 'error' },
            { label: '旧口径(v2.5)', value: '>2小时视为异常 → 不符合异常条件', type: 'success' },
            { label: '处理状态', value: '旧口径补录中，需确认适用口径', type: 'warning' }
        ]
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
    switch (currentData.status) {
        case 'pending':
            badge.textContent = '待处理';
            break;
        case 'processing':
            badge.textContent = '处理中';
            badge.classList.add('processing');
            break;
        case 'normal':
            badge.textContent = '正常（口径正确）';
            badge.classList.add('success');
            break;
        case 'duplicate':
            badge.textContent = '重复计入（待复核）';
            badge.classList.add('warning');
            break;
        case 'review':
            badge.textContent = '标注负责人复核中';
            badge.classList.add('review');
            break;
        case 'old-caliber':
            badge.textContent = '旧口径补录';
            badge.classList.add('old-caliber');
            break;
        case 'duplicate-confirmed':
            badge.textContent = '重复计入（已确认剔除）';
            badge.classList.add('success');
            break;
        default:
            badge.textContent = '待处理';
    }
}

function resetPanels() {
    document.getElementById('annotatorMessage').innerHTML = '<p class="placeholder">点击「导入标注员留言」开始</p>';
    document.getElementById('modelOutput').innerHTML = '<p class="placeholder">完成步骤1后，点击「查看模型输出片段」</p>';
    document.getElementById('evidencePlayback').innerHTML = '<p class="placeholder">完成前两步后查看证据回放</p>';
    document.getElementById('correctionNote').value = '';
    document.getElementById('reviewArea').classList.add('hidden');
    document.getElementById('actionArea').classList.remove('hidden');

    updateStepBadges();
    updateButtonStates();
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
}

function importAnnotatorMessage() {
    const msg = annotatorMessages[currentScene];
    currentData.annotatorMessage = msg;
    step1Completed = true;
    currentData.status = 'processing';

    document.getElementById('annotatorMessage').innerHTML = `
        <div class="message-item">${msg.content}</div>
        <div class="message-meta">${msg.author} · ${msg.time}</div>
    `;

    addHistory('导入标注员留言', `${msg.author} 导入了标注留言`);
    updateStepBadges();
    updateButtonStates();
    updateStatusBadge();
    showToast('标注员留言导入成功', 'success');
}

function viewModelOutput() {
    const output = hasRerun ? modelOutputs[currentScene].rerun : modelOutputs[currentScene].original;
    currentData.modelOutput = output;
    step2Completed = true;

    document.getElementById('modelOutput').innerHTML = output;

    addHistory('查看模型输出片段', hasRerun ? '查看重跑后的模型输出' : '查看初始模型输出');
    updateStepBadges();
    updateButtonStates();
    showToast('模型输出片段已加载', 'success');
}

function refreshEvidence() {
    let evidence;
    if (currentScene === 'duplicate' && currentData.status === 'duplicate-confirmed') {
        evidence = evidenceData.duplicate.confirmed;
    } else if (step3Completed) {
        evidence = evidenceData[currentScene].updated;
    } else {
        evidence = evidenceData[currentScene].initial;
    }

    currentData.evidence = evidence;
    step3Completed = true;

    let html = '';
    evidence.forEach(item => {
        html += `<div class="evidence-item">
            <span class="evidence-label">${item.label}：</span>
            <span class="evidence-value ${item.type}">${item.value}</span>
        </div>`;
    });
    document.getElementById('evidencePlayback').innerHTML = html;

    addHistory('更新证据回放', step3Completed ? '证据回放已更新，包含完整分析数据' : '加载初始证据数据');
    updateStepBadges();
    updateButtonStates();
    showToast('证据回放已更新', 'success');
}

function markAsNormal() {
    currentData.status = 'normal';
    addHistory('标记为正常', '口径正确，确认无异常');
    updateStatusBadge();
    updateButtonStates();
    showToast('已标记为：正常（口径正确）', 'success');
}

function markAsDuplicate() {
    currentData.status = 'review';
    document.getElementById('actionArea').classList.add('hidden');
    document.getElementById('reviewArea').classList.remove('hidden');
    addHistory('标记为重复计入', '疑似同一用户反馈重复计入，提交标注负责人复核');
    updateStatusBadge();
    updateButtonStates();
    showToast('已提交标注负责人复核', 'warning');
}

function markAsOldCaliber() {
    currentData.status = 'old-caliber';
    addHistory('标记为旧口径补录', '该记录采用旧口径进行补录处理');
    updateStatusBadge();
    updateButtonStates();
    showToast('已标记为：旧口径补录', 'success');
}

function reRunModel() {
    hasRerun = true;
    step2Completed = false;
    step3Completed = false;

    document.getElementById('modelOutput').innerHTML = '<p class="placeholder">点击「查看模型输出片段」查看重跑结果</p>';
    document.getElementById('evidencePlayback').innerHTML = '<p class="placeholder">完成模型输出查看后更新证据回放</p>';

    addHistory('重新运行模型', '人工触发模型重跑，生成新的分析结果');
    updateStepBadges();
    updateButtonStates();
    showToast('模型重跑完成，请查看新的输出结果', 'success');
}

function confirmDuplicate() {
    currentData.status = 'duplicate-confirmed';
    document.getElementById('reviewArea').classList.add('hidden');
    addHistory('复核确认', '标注负责人确认：该记录为重复计入，已剔除', '陈主管（标注负责人）');
    updateStatusBadge();
    updateButtonStates();
    refreshEvidence();
    showToast('复核完成：确认重复计入，已剔除', 'success');
}

function rejectDuplicate() {
    currentData.status = 'normal';
    document.getElementById('reviewArea').classList.add('hidden');
    document.getElementById('actionArea').classList.remove('hidden');
    addHistory('复核驳回', '标注负责人驳回：该记录为有效异常，非重复计入', '陈主管（标注负责人）');
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
    addHistory('人工修正', note);
    document.getElementById('correctionNote').value = '';
    showToast('修正备注已保存', 'success');
}

function addHistory(action, note, user = null) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    currentData.history.unshift({
        time: timeStr,
        action: action,
        note: note,
        user: user || currentRole
    });
    renderHistory();
}

function renderHistory() {
    const list = document.getElementById('historyList');
    const count = document.getElementById('historyCount');
    count.textContent = `${currentData.history.length} 条记录`;

    if (currentData.history.length === 0) {
        list.innerHTML = '<p class="placeholder">暂无操作记录</p>';
        return;
    }

    let html = '';
    currentData.history.forEach(item => {
        html += `<div class="history-item">
            <span class="history-time">${item.time}</span>
            <div class="history-action">
                <span class="user">${item.user}</span> · ${item.action}
                ${item.note ? `<div class="note">${item.note}</div>` : ''}
            </div>
        </div>`;
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
    showToast('开始自动演示流程...', 'success');
    let step = 0;
    const steps = [
        () => importAnnotatorMessage(),
        () => viewModelOutput(),
        () => refreshEvidence(),
        () => {
            if (currentScene === 'normal') {
                markAsNormal();
            } else if (currentScene === 'duplicate') {
                markAsDuplicate();
                setTimeout(() => {
                    currentRole = '标注负责人';
                    document.getElementById('currentUser').textContent = currentRole;
                    confirmDuplicate();
                    currentRole = '标注员';
                    document.getElementById('currentUser').textContent = currentRole;
                }, 1500);
            } else if (currentScene === 'old-caliber') {
                markAsOldCaliber();
            }
        }
    ];

    const runStep = () => {
        if (step < steps.length) {
            steps[step]();
            step++;
            setTimeout(runStep, 1500);
        } else {
            showToast('演示流程完成！', 'success');
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
    }, 2500);
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
}

document.addEventListener('DOMContentLoaded', init);
