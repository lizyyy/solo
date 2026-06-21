const GameState = {
    READY: 'ready',
    RUNNING: 'running',
    PAUSED: 'paused',
    ERROR: 'error',
    SETTLED: 'settled'
};

const EventType = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error',
    PENDING: 'pending',
    NOTE: 'note',
    LEGACY: 'legacy'
};

const DebrisTypes = [
    { emoji: '🛸', name: '废弃卫星', value: 10, fuelCost: 5, oxygenCost: 2 },
    { emoji: '🚀', name: '火箭残骸', value: 15, fuelCost: 8, oxygenCost: 3 },
    { emoji: '🛰️', name: '失联探测器', value: 20, fuelCost: 10, oxygenCost: 4 },
    { emoji: '☄️', name: '太空碎片', value: 5, fuelCost: 3, oxygenCost: 1 },
    { emoji: '⚙️', name: '废弃舱段', value: 25, fuelCost: 12, oxygenCost: 5 },
    { emoji: '🔧', name: '遗失工具', value: 8, fuelCost: 4, oxygenCost: 2 }
];

const sampleRecords = {
    smooth: {
        metadata: {
            title: '2026-05-28 第三节课 - 顺利完成',
            operator: '阿蓝',
            className: '五年级2班',
            duration: 185,
            source: 'system'
        },
        resources: { fuel: 100, oxygen: 80, score: 0 },
        finalResources: { fuel: 28, oxygen: 42, score: 143 },
        events: [
            { time: 0, type: 'info', text: '活动开始，五年级2班第三节课', tag: 'smooth' },
            { time: 8, type: 'success', text: '回收「太空碎片」成功 +5分', tag: 'smooth', data: { type: '☄️', fuel: 97, oxygen: 79 } },
            { time: 15, type: 'success', text: '回收「废弃卫星」成功 +10分', tag: 'smooth', data: { type: '🛸', fuel: 92, oxygen: 77 } },
            { time: 25, type: 'success', text: '回收「遗失工具」成功 +8分', tag: 'smooth', data: { type: '🔧', fuel: 88, oxygen: 75 } },
            { time: 42, type: 'info', text: '燃料降到80以下，注意消耗节奏', tag: 'smooth' },
            { time: 48, type: 'success', text: '回收「火箭残骸」成功 +15分', tag: 'smooth', data: { type: '🚀', fuel: 80, oxygen: 72 } },
            { time: 65, type: 'success', text: '回收「太空碎片」成功 +5分', tag: 'smooth', data: { type: '☄️', fuel: 77, oxygen: 71 } },
            { time: 82, type: 'success', text: '回收「失联探测器」成功 +20分', tag: 'smooth', data: { type: '🛰️', fuel: 67, oxygen: 67 } },
            { time: 100, type: 'info', text: '过半了，孩子们状态不错', tag: 'smooth' },
            { time: 110, type: 'success', text: '回收「废弃舱段」成功 +25分', tag: 'smooth', data: { type: '⚙️', fuel: 55, oxygen: 62 } },
            { time: 128, type: 'success', text: '回收「废弃卫星」成功 +10分', tag: 'smooth', data: { type: '🛸', fuel: 50, oxygen: 60 } },
            { time: 145, type: 'success', text: '回收「火箭残骸」成功 +15分', tag: 'smooth', data: { type: '🚀', fuel: 42, oxygen: 57 } },
            { time: 160, type: 'success', text: '回收「太空碎片」成功 +5分', tag: 'smooth', data: { type: '☄️', fuel: 39, oxygen: 56 } },
            { time: 172, type: 'success', text: '回收「遗失工具」成功 +8分', tag: 'smooth', data: { type: '🔧', fuel: 35, oxygen: 54 } },
            { time: 180, type: 'success', text: '回收「太空碎片」成功 +5分', tag: 'smooth', data: { type: '☄️', fuel: 32, oxygen: 53 } },
            { time: 185, type: 'info', text: '时间到，活动结束', tag: 'smooth' }
        ],
        stats: {
            totalCollected: 12,
            successRate: '100%',
            avgResponse: '14.7秒',
            issues: 0
        }
    },
    rework: {
        metadata: {
            title: '2026-05-29 第二节课 - 需要人工确认',
            operator: '阿蓝',
            className: '四年级1班',
            duration: 210,
            source: 'system'
        },
        resources: { fuel: 100, oxygen: 80, score: 0 },
        finalResources: { fuel: -5, oxygen: 12, score: 78 },
        events: [
            { time: 0, type: 'info', text: '活动开始，四年级1班第二节课', tag: 'rework' },
            { time: 12, type: 'success', text: '回收「太空碎片」成功 +5分', tag: 'rework', data: { type: '☄️', fuel: 97, oxygen: 79 } },
            { time: 28, type: 'success', text: '回收「废弃卫星」成功 +10分', tag: 'rework', data: { type: '🛸', fuel: 92, oxygen: 77 } },
            { time: 45, type: 'warning', text: '⚠️ 新手误操作：连点了3次，多扣了燃料', tag: 'rework', data: { fuel: 78, oxygen: 75 } },
            { time: 52, type: 'success', text: '回收「遗失工具」成功 +8分', tag: 'rework', data: { type: '🔧', fuel: 74, oxygen: 73 } },
            { time: 70, type: 'warning', text: '⏸️ 故意暂停测试：老师中途打断讨论', tag: 'rework', pending: true, pendingId: 'pause_001', data: { pendingId: 'pause_001' } },
            { time: 70, type: 'pending', text: '⏳ 暂停记录待确认：是否扣除暂停时间？', tag: 'pending', pendingId: 'pause_001', data: { pendingId: 'pause_001' } },
            { time: 85, type: 'success', text: '回收「火箭残骸」成功 +15分', tag: 'rework', data: { type: '🚀', fuel: 66, oxygen: 70 } },
            { time: 95, type: 'warning', text: '⚠️ 氧气降到60以下，进入警戒区', tag: 'rework' },
            { time: 105, type: 'success', text: '回收「太空碎片」成功 +5分', tag: 'rework', data: { type: '☄️', fuel: 63, oxygen: 69 } },
            { time: 120, type: 'error', text: '❌ 资源越界：燃料消耗后变成负数 (-2)', tag: 'rework', data: { fuel: -2, oxygen: 58 } },
            { time: 120, type: 'pending', text: '⏳ 异常记录待确认：负数燃料怎么算？', tag: 'pending', pendingId: 'fuel_001', data: { pendingId: 'fuel_001' } },
            { time: 135, type: 'info', text: '活动继续，等待后台核实分数', tag: 'rework' },
            { time: 145, type: 'success', text: '回收「失联探测器」成功 +20分', tag: 'rework', data: { type: '🛰️', fuel: -12, oxygen: 54 } },
            { time: 160, type: 'warning', text: '⚠️ 边界分数：刚好78分，卡在达标线上', tag: 'rework', data: { score: 78 } },
            { time: 160, type: 'pending', text: '⏳ 边界情况待确认：78分算达标吗？', tag: 'pending', pendingId: 'score_001', data: { pendingId: 'score_001' } },
            { time: 180, type: 'warning', text: '⚠️ 氧气快用完了 (12)，结束前最后一次', tag: 'rework' },
            { time: 190, type: 'success', text: '回收「太空碎片」成功 +5分', tag: 'rework', data: { type: '☄️', fuel: -5, oxygen: 51 } },
            { time: 210, type: 'info', text: '活动结束，有3条记录需要人工确认', tag: 'rework' }
        ],
        stats: {
            totalCollected: 8,
            successRate: '89%',
            avgResponse: '22.1秒',
            issues: 3
        }
    },
    legacy: {
        metadata: {
            title: '2026-05-20 投影大屏记录 - 旧口径',
            operator: '阿蓝（补录）',
            className: '六年级3班',
            duration: 160,
            source: 'legacy',
            originalSystem: '投影大屏v1.0',
            convertedAt: '2026-05-30 14:30'
        },
        resources: { fuel: 100, oxygen: 80, score: 0 },
        finalResources: { fuel: 35, oxygen: 45, score: 112 },
        events: [
            { time: 0, type: 'legacy', text: '📺 【投影大屏旧记录】从老系统导入，口径不同请注意', tag: 'legacy' },
            { time: 0, type: 'info', text: '活动开始，六年级3班（投影大屏记录）', tag: 'legacy' },
            { time: 10, type: 'success', text: '回收A类垃圾 +10分（旧口径：卫星类）', tag: 'legacy', data: { fuel: 94, oxygen: 77 } },
            { time: 25, type: 'success', text: '回收B类垃圾 +12分（旧口径：火箭类）', tag: 'legacy', data: { fuel: 85, oxygen: 74 } },
            { time: 40, type: 'warning', text: '⚠️ 旧系统备注：学生操作稍慢', tag: 'legacy' },
            { time: 55, type: 'success', text: '回收C类垃圾 +8分（旧口径：碎片类）', tag: 'legacy', data: { fuel: 81, oxygen: 72 } },
            { time: 75, type: 'success', text: '回收A类垃圾 +10分（旧口径：卫星类）', tag: 'legacy', data: { fuel: 75, oxygen: 70 } },
            { time: 90, type: 'info', text: '⏸️ 旧系统记录暂停20秒（已自动扣除）', tag: 'legacy' },
            { time: 110, type: 'success', text: '回收D类垃圾 +22分（旧口径：舱段类）', tag: 'legacy', data: { fuel: 62, oxygen: 65 } },
            { time: 125, type: 'success', text: '回收B类垃圾 +12分（旧口径：火箭类）', tag: 'legacy', data: { fuel: 53, oxygen: 62 } },
            { time: 140, type: 'success', text: '回收C类垃圾 +8分（旧口径：碎片类）', tag: 'legacy', data: { fuel: 49, oxygen: 60 } },
            { time: 150, type: 'success', text: '回收A类垃圾 +10分（旧口径：卫星类）', tag: 'legacy', data: { fuel: 43, oxygen: 58 } },
            { time: 155, type: 'success', text: '回收C类垃圾 +8分（旧口径：碎片类）', tag: 'legacy', data: { fuel: 39, oxygen: 56 } },
            { time: 160, type: 'legacy', text: '📺 【导入完成】旧系统总分100，新系统换算后112', tag: 'legacy' },
            { time: 160, type: 'info', text: '活动结束', tag: 'legacy' }
        ],
        stats: {
            totalCollected: 9,
            successRate: '100%',
            avgResponse: '16.7秒',
            issues: 0
        },
        conversionNotes: [
            '旧系统A类=新系统🛸废弃卫星（+10→+10）',
            '旧系统B类=新系统🚀火箭残骸（+12→+15）',
            '旧系统C类=新系统☄️太空碎片（+8→+5）',
            '旧系统D类=新系统⚙️废弃舱段（+22→+25）',
            '旧系统燃料消耗系数×0.9，已修正',
            '总分差异：旧100 → 新112，口径升级导致'
        ]
    }
};

class SpaceRecyclingGame {
    constructor() {
        this.state = GameState.READY;
        this.resources = { fuel: 100, oxygen: 80, score: 0 };
        this.elapsedTime = 0;
        this.timerInterval = null;
        this.spawnInterval = null;
        this.debrisList = [];
        this.eventLog = [];
        this.pendingConfirmations = [];
        this.currentRecord = null;
        this.replayState = null;
        this.pauseStartTime = null;
        this.currentPausePendingId = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateUI();
    }

    bindEvents() {
        document.getElementById('startBtn').addEventListener('click', () => this.start());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pause());
        document.getElementById('resumeBtn').addEventListener('click', () => this.resume());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        document.getElementById('settleBtn').addEventListener('click', () => this.settle());
        document.getElementById('spawnDebrisBtn').addEventListener('click', () => this.spawnDebris());
        document.getElementById('spawnTroubleBtn').addEventListener('click', () => this.spawnTrouble());
        document.getElementById('addNoteBtn').addEventListener('click', () => this.showAddNoteModal());

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        document.getElementById('replayStartBtn').addEventListener('click', () => this.startReplay());
        document.getElementById('replayPauseBtn').addEventListener('click', () => this.pauseReplay());
        document.getElementById('replayStopBtn').addEventListener('click', () => this.stopReplay());
        document.getElementById('replaySpeed').addEventListener('change', (e) => {
            if (this.replayState) this.replayState.speed = parseFloat(e.target.value);
        });
        document.getElementById('replaySlider').addEventListener('input', (e) => this.seekReplay(e.target.value));

        document.getElementById('exportReportBtn').addEventListener('click', () => this.exportReport());
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabName}Tab`);
        });
    }

    start() {
        if (this.state !== GameState.READY) return;
        
        this.state = GameState.RUNNING;
        this.currentRecord = {
            metadata: {
                title: `${new Date().toLocaleDateString('zh-CN')} 太空垃圾回收站`,
                operator: '阿蓝',
                className: '待填写',
                startTime: Date.now(),
                source: 'system'
            },
            events: [],
            stats: { totalCollected: 0, issues: 0 }
        };
        
        this.logEvent(EventType.INFO, '活动开始，小朋友们准备好了吗？');
        
        this.timerInterval = setInterval(() => this.tick(), 1000);
        this.spawnInterval = setInterval(() => this.spawnDebris(), 6000);
        
        this.spawnDebris();
        this.updateUI();
    }

    pause() {
        if (this.state !== GameState.RUNNING) return;
        
        this.state = GameState.PAUSED;
        clearInterval(this.timerInterval);
        clearInterval(this.spawnInterval);
        
        this.pauseStartTime = Date.now();
        
        const resourcesBeforePause = { ...this.resources };
        const debrisCountBeforePause = this.debrisList.filter(d => !d.collected).length;
        
        this.logEvent(EventType.WARNING, '⏸️ 活动暂停', null, {
            fuel: resourcesBeforePause.fuel,
            oxygen: resourcesBeforePause.oxygen,
            score: resourcesBeforePause.score,
            debrisOnField: debrisCountBeforePause
        });
        
        const pendingId = `pause_${Date.now()}`;
        this.currentPausePendingId = pendingId;
        this.pendingConfirmations.push({
            id: pendingId,
            type: 'pause',
            time: this.elapsedTime,
            pauseStartTime: this.pauseStartTime,
            pauseDuration: 0,
            resourcesBeforePause,
            debrisCountBeforePause,
            message: '这次暂停是否要从总时间里扣除？'
        });
        this.logEvent(EventType.PENDING, '⏳ 暂停记录待确认：是否扣除暂停时间？', 'pending', { pendingId });
        
        this.updateUI();
    }

    resume() {
        if (this.state !== GameState.PAUSED) return;
        
        const pauseEndTime = Date.now();
        const pauseDurationMs = pauseEndTime - (this.pauseStartTime || pauseEndTime);
        const pauseDurationSeconds = Math.round(pauseDurationMs / 1000);
        
        const pendingPause = this.pendingConfirmations.find(p => p.id === this.currentPausePendingId);
        if (pendingPause) {
            pendingPause.pauseDuration = pauseDurationSeconds;
            pendingPause.pauseEndTime = pauseEndTime;
            pendingPause.message = `这次暂停了 ${pauseDurationSeconds} 秒，是否要从总时间里扣除？`;
        }
        
        this.state = GameState.RUNNING;
        this.timerInterval = setInterval(() => this.tick(), 1000);
        this.spawnInterval = setInterval(() => this.spawnDebris(), 6000);
        
        const debrisCountNow = this.debrisList.filter(d => !d.collected).length;
        this.logEvent(EventType.INFO, `▶ 活动继续（暂停了 ${pauseDurationSeconds} 秒）`, null, {
            pauseDuration: pauseDurationSeconds,
            fuel: this.resources.fuel,
            oxygen: this.resources.oxygen,
            score: this.resources.score,
            debrisOnField: debrisCountNow
        });
        
        this.pauseStartTime = null;
        this.updateUI();
    }

    reset() {
        clearInterval(this.timerInterval);
        clearInterval(this.spawnInterval);
        
        this.state = GameState.READY;
        this.resources = { fuel: 100, oxygen: 80, score: 0 };
        this.elapsedTime = 0;
        this.debrisList = [];
        this.eventLog = [];
        this.pendingConfirmations = [];
        this.currentRecord = null;
        
        document.getElementById('debrisContainer').innerHTML = '';
        document.getElementById('eventsList').innerHTML = '<p class="empty-hint">活动开始后这里会记录每一步操作</p>';
        
        this.logEvent(EventType.INFO, '系统已重置，准备下一轮');
        this.updateUI();
    }

    settle() {
        if (this.state === GameState.SETTLED) return;
        
        clearInterval(this.timerInterval);
        clearInterval(this.spawnInterval);
        
        this.state = GameState.SETTLED;
        
        if (this.currentRecord) {
            this.currentRecord.metadata.duration = this.elapsedTime;
            this.currentRecord.metadata.endTime = Date.now();
            this.currentRecord.finalResources = { ...this.resources };
            this.currentRecord.stats.totalCollected = this.eventLog.filter(e => e.data && e.data.type).length;
            this.currentRecord.stats.issues = this.pendingConfirmations.length;
        }
        
        this.logEvent(EventType.INFO, '📊 活动结算，开始生成复盘报告');
        this.generateReport();
        this.updateUI();
    }

    tick() {
        this.elapsedTime++;
        this.resources.oxygen = Math.max(0, this.resources.oxygen - 0.2);
        
        if (this.resources.oxygen <= 10 && this.resources.oxygen > 0) {
            this.logEvent(EventType.WARNING, '⚠️ 氧气快用完了，加油！');
        }
        
        if (this.resources.oxygen <= 0) {
            this.logEvent(EventType.ERROR, '❌ 氧气耗尽，活动强制结束');
            this.settle();
            return;
        }
        
        this.updateUI();
    }

    spawnDebris() {
        if (this.state !== GameState.RUNNING) return;
        
        const container = document.getElementById('debrisContainer');
        const debrisType = DebrisTypes[Math.floor(Math.random() * DebrisTypes.length)];
        const id = `debris_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const x = 10 + Math.random() * 80;
        const y = 10 + Math.random() * 80;
        
        const debrisEl = document.createElement('div');
        debrisEl.className = 'debris';
        debrisEl.id = id;
        debrisEl.textContent = debrisType.emoji;
        debrisEl.style.left = `${x}%`;
        debrisEl.style.top = `${y}%`;
        debrisEl.style.animationDelay = `${Math.random() * 2}s`;
        debrisEl.addEventListener('click', () => this.collectDebris(id, debrisType));
        
        container.appendChild(debrisEl);
        
        this.debrisList.push({ id, type: debrisType, element: debrisEl, x, y });
        this.moveCollector(x, y);
    }

    spawnTrouble() {
        if (this.state !== GameState.RUNNING) return;
        
        const troubleType = Math.random();
        
        if (troubleType < 0.4) {
            this.resources.fuel -= 15;
            this.logEvent(EventType.WARNING, '⚠️ 意外！燃料泄漏 -15');
            this.checkResourceException();
        } else if (troubleType < 0.7) {
            this.resources.oxygen -= 12;
            this.logEvent(EventType.WARNING, '⚠️ 意外！氧气泄漏 -12');
            this.checkResourceException();
        } else {
            const pendingId = `oops_${Date.now()}`;
            this.pendingConfirmations.push({
                id: pendingId,
                type: 'manual',
                time: this.elapsedTime,
                message: '刚才的回收操作有点争议，是否计入成绩？'
            });
            this.logEvent(EventType.PENDING, '⏳ 操作有争议，需要人工确认', 'pending', { pendingId });
        }
        
        this.updateUI();
    }

    collectDebris(id, debrisType) {
        if (this.state !== GameState.RUNNING) return;
        
        const debris = this.debrisList.find(d => d.id === id);
        if (!debris || debris.collected) return;
        
        debris.collected = true;
        
        this.resources.fuel -= debrisType.fuelCost;
        this.resources.oxygen -= debrisType.oxygenCost;
        this.resources.score += debrisType.value;
        
        const debrisEl = document.getElementById(id);
        if (debrisEl) {
            debrisEl.classList.add('collected');
            setTimeout(() => debrisEl.remove(), 300);
        }
        
        this.logEvent(
            EventType.SUCCESS,
            `回收「${debrisType.name}」成功 +${debrisType.value}分`,
            'smooth',
            { type: debrisType.emoji, ...this.resources }
        );
        
        if (this.resources.score === 78 || this.resources.score === 60 || this.resources.score === 90) {
            const pendingId = `score_${Date.now()}`;
            this.pendingConfirmations.push({
                id: pendingId,
                type: 'boundary',
                time: this.elapsedTime,
                message: `${this.resources.score}分刚好卡在边界线上，算达标吗？`
            });
            this.logEvent(EventType.WARNING, `⚠️ 边界分数：${this.resources.score}分，卡在达标线上`, 'rework');
            this.logEvent(EventType.PENDING, '⏳ 边界情况待确认', 'pending', { pendingId });
        }
        
        this.checkResourceException();
        this.updateUI();
    }

    moveCollector(x, y) {
        const collector = document.getElementById('collector');
        if (collector) {
            collector.style.left = `${x}%`;
            collector.style.top = `${y}%`;
        }
    }

    checkResourceException() {
        let hasException = false;
        
        if (this.resources.fuel < 0) {
            this.logEvent(
                EventType.ERROR,
                `❌ 资源越界：燃料变成负数 (${this.resources.fuel.toFixed(0)})`,
                'rework',
                { ...this.resources }
            );
            
            const pendingId = `fuel_${Date.now()}`;
            this.pendingConfirmations.push({
                id: pendingId,
                type: 'negative',
                time: this.elapsedTime,
                message: `燃料负数 (${this.resources.fuel.toFixed(0)})，怎么处理？按0算还是实际扣分？`
            });
            this.logEvent(EventType.PENDING, '⏳ 异常记录待确认：负数燃料怎么算？', 'pending', { pendingId });
            hasException = true;
        }
        
        if (this.resources.oxygen < 0) {
            this.logEvent(
                EventType.ERROR,
                `❌ 资源越界：氧气变成负数 (${this.resources.oxygen.toFixed(0)})`,
                'rework',
                { ...this.resources }
            );
            hasException = true;
        }
        
        if (hasException) {
            this.state = GameState.ERROR;
            clearInterval(this.timerInterval);
            clearInterval(this.spawnInterval);
            this.updateUI();
            
            this.showModal(
                '⚠️ 资源异常',
                '<p>检测到资源变成负数了，不能假装没看见。</p><p>先暂停活动，等下人工确认怎么处理。</p>',
                [
                    { text: '知道了', class: 'btn-primary', action: () => closeModal() }
                ]
            );
        }
    }

    logEvent(type, text, tag = null, data = null) {
        const event = {
            id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            time: this.elapsedTime,
            type,
            text,
            tag,
            data,
            timestamp: new Date().toISOString()
        };
        
        this.eventLog.push(event);
        
        if (this.currentRecord) {
            this.currentRecord.events.push(event);
        }
        
        this.renderEventItem(event);
    }

    renderEventItem(event) {
        const eventsList = document.getElementById('eventsList');
        
        const emptyHint = eventsList.querySelector('.empty-hint');
        if (emptyHint) emptyHint.remove();
        
        const item = document.createElement('div');
        item.className = `event-item event-${event.type}`;
        item.dataset.eventId = event.id;
        
        const timeStr = this.formatTime(event.time);
        let tagHtml = event.tag ? `<span class="event-tag tag-${event.tag}">${this.getTagLabel(event.tag)}</span>` : '';
        
        let confirmBtnHtml = '';
        const effectivePendingId = (event.data && event.data.pendingId) || event.pendingId;
        if (event.type === EventType.PENDING && effectivePendingId) {
            const pending = this.pendingConfirmations.find(p => p.id === effectivePendingId);
            if (!pending || !pending.resolved) {
                confirmBtnHtml = `<br><button class="btn btn-small btn-info confirm-btn" onclick="game.confirmEvent('${effectivePendingId}')">确认处理</button>`;
            }
        }
        
        item.innerHTML = `
            <span class="event-time">[${timeStr}]</span>
            <span class="event-text">${event.text}</span>
            ${tagHtml}
            ${confirmBtnHtml}
        `;
        
        eventsList.appendChild(item);
        eventsList.scrollTop = eventsList.scrollHeight;
    }

    getTagLabel(tag) {
        const labels = {
            'smooth': '顺利',
            'rework': '需返工',
            'legacy': '旧口径',
            'pending': '待确认',
            'confirmed': '已确认'
        };
        return labels[tag] || tag;
    }

    confirmEvent(pendingId) {
        const pending = this.pendingConfirmations.find(p => p.id === pendingId);
        if (!pending) return;
        
        let extraInfo = '';
        if (pending.type === 'pause') {
            extraInfo = `
                <p><strong>暂停时长：</strong>${pending.pauseDuration > 0 ? pending.pauseDuration + ' 秒' : '待继续后确定'}</p>
                <p><strong>暂停前状态：</strong></p>
                <ul style="margin:4px 0 8px 20px;font-size:12px;color:#9ca3af;">
                    <li>燃料：${pending.resourcesBeforePause?.fuel?.toFixed(0) || '?'}</li>
                    <li>氧气：${pending.resourcesBeforePause?.oxygen?.toFixed(0) || '?'}</li>
                    <li>得分：${pending.resourcesBeforePause?.score?.toFixed(0) || '?'}</li>
                    <li>场上垃圾：${pending.debrisCountBeforePause || 0} 件</li>
                </ul>
                ${pending.pauseDuration > 0 ? '<p style="color:#f59e0b;">💡 通过后会从总时间里扣除 ' + pending.pauseDuration + ' 秒</p>' : ''}
            `;
        } else if (pending.type === 'negative') {
            extraInfo = `
                <p style="color:#ef4444;">⚠️ 资源变成负数了，不能假装没看见</p>
            `;
        } else if (pending.type === 'boundary') {
            extraInfo = `
                <p style="color:#f59e0b;">⚠️ 刚好卡在边界线上，需要人来拍板</p>
            `;
        }
        
        this.showModal(
            '人工确认',
            `
                <p><strong>类型：</strong>${
                    pending.type === 'pause' ? '暂停记录' :
                    pending.type === 'negative' ? '资源负数异常' :
                    pending.type === 'boundary' ? '边界分数' :
                    pending.type === 'manual' ? '操作争议' : '待确认'
                }</p>
                <p><strong>时间点：</strong>${this.formatTime(pending.time)}</p>
                <p><strong>问题：</strong>${pending.message}</p>
                ${extraInfo}
                <p style="margin-top:12px;"><strong>你的处理意见：</strong></p>
                <textarea id="confirmNote" placeholder="写点什么，比如'算，给孩子们一次机会'或者'不算，按规则来'"></textarea>
            `,
            [
                { text: '取消', class: 'btn-secondary', action: () => closeModal() },
                { 
                    text: '确认通过', 
                    class: 'btn-success', 
                    action: () => this.processConfirmation(pendingId, true)
                },
                { 
                    text: '驳回', 
                    class: 'btn-danger', 
                    action: () => this.processConfirmation(pendingId, false)
                }
            ]
        );
    }

    processConfirmation(pendingId, approved) {
        const note = document.getElementById('confirmNote')?.value || '';
        const pending = this.pendingConfirmations.find(p => p.id === pendingId);
        
        if (!pending) return;
        
        pending.resolved = true;
        pending.approved = approved;
        pending.note = note;
        
        let effectText = '';
        if (pending.type === 'pause' && approved && pending.pauseDuration > 0) {
            const oldTime = this.elapsedTime;
            this.elapsedTime = Math.max(0, this.elapsedTime - pending.pauseDuration);
            effectText = `（已扣除 ${pending.pauseDuration} 秒：${this.formatTime(oldTime)} → ${this.formatTime(this.elapsedTime)}）`;
            
            if (this.currentRecord) {
                this.currentRecord.metadata.totalPauseDeducted = (this.currentRecord.metadata.totalPauseDeducted || 0) + pending.pauseDuration;
            }
        }
        
        this.logEvent(
            EventType.NOTE,
            `📝 人工确认：${approved ? '✅ 通过' : '❌ 驳回'} - ${note || '（无备注）'} ${effectText}`,
            'confirmed'
        );
        
        const pendingEvent = this.eventLog.find(e =>
            e.type === EventType.PENDING &&
            ((e.data && e.data.pendingId === pendingId) || e.pendingId === pendingId)
        );
        if (pendingEvent) {
            const eventId = pendingEvent.id;
            const eventEl = eventId ? document.querySelector(`[data-event-id="${eventId}"]`) : null;
            if (eventEl) {
                eventEl.classList.remove('event-pending');
                eventEl.classList.add(approved ? 'event-success' : 'event-error');
                const tag = eventEl.querySelector('.tag-pending');
                if (tag) {
                    tag.className = 'event-tag tag-confirmed';
                    tag.textContent = approved ? '已通过' : '已驳回';
                }
                const confirmBtn = eventEl.querySelector('.confirm-btn');
                if (confirmBtn) confirmBtn.remove();
            }
        }
        
        if (this.state === GameState.ERROR && this.resources.fuel >= 0) {
            this.state = GameState.PAUSED;
        }
        
        closeModal();
        if (this.currentRecord) this.generateReport();
        this.updateUI();
    }

    showAddNoteModal() {
        this.showModal(
            '补录备注',
            `
                <p>给刚才的活动补一条记录，阿蓝你懂的：</p>
                <textarea id="noteText" placeholder="比如'刚才有个小朋友举手要上厕所，耽误了20秒'"></textarea>
            `,
            [
                { text: '取消', class: 'btn-secondary', action: () => closeModal() },
                { 
                    text: '添加备注', 
                    class: 'btn-primary', 
                    action: () => this.addNote()
                }
            ]
        );
    }

    addNote() {
        const text = document.getElementById('noteText')?.value?.trim();
        if (!text) {
            closeModal();
            return;
        }
        
        const prevEvent = this.eventLog[this.eventLog.length - 1];
        const prevText = prevEvent ? prevEvent.text : '(无记录)';
        
        this.logEvent(EventType.NOTE, `📝 补录：${text}`, 'note');
        this.logEvent(EventType.INFO, `   ↳ 接上条：${prevText}`, 'note');
        
        if (this.currentRecord) {
            this.currentRecord.metadata.hasManualNote = true;
            if (!this.currentRecord.metadata.notes) this.currentRecord.metadata.notes = [];
            this.currentRecord.metadata.notes.push({
                time: this.elapsedTime,
                text,
                context: prevText
            });
        }
        
        closeModal();
    }

    generateReport() {
        if (!this.currentRecord) return;
        
        const report = this.buildHumanReadableReport(this.currentRecord);
        document.getElementById('reportContent').innerHTML = report;
    }

    buildHumanReadableReport(record) {
        const { metadata, stats, finalResources } = record;
        const events = this.eventLog && this.eventLog.length >= record.events.length ? this.eventLog : record.events;
        const duration = this.elapsedTime || metadata.duration;
        const effectiveFinalResources = this.state !== GameState.READY ? this.resources : finalResources;
        
        const successEvents = events.filter(e => e.type === EventType.SUCCESS);
        const warningEvents = events.filter(e => e.type === EventType.WARNING);
        const errorEvents = events.filter(e => e.type === EventType.ERROR);
        const noteEvents = events.filter(e => e.type === EventType.NOTE);
        const pendingEvents = events.filter(e => e.type === EventType.PENDING);
        const legacyEvents = events.filter(e => e.type === EventType.LEGACY);
        
        const hasIssues = warningEvents.length > 0 || errorEvents.length > 0 || pendingEvents.length > 0;
        const hasNotes = noteEvents.length > 0;
        const isLegacy = legacyEvents.length > 0 || metadata.source === 'legacy';
        
        let html = '';
        
        html += `
            <div class="report-section">
                <h4>📋 基本信息</h4>
                <div class="report-stats">
                    <div class="report-stat">
                        <div class="report-stat-label">活动名称</div>
                        <div class="report-stat-value" style="font-size:14px;">太空垃圾回收站</div>
                    </div>
                    <div class="report-stat">
                        <div class="report-stat-label">班级</div>
                        <div class="report-stat-value" style="font-size:14px;">${metadata.className || '待填写'}</div>
                    </div>
                    <div class="report-stat">
                        <div class="report-stat-label">最终得分</div>
                        <div class="report-stat-value" style="color:#a78bfa;">${effectiveFinalResources?.score}</div>
                    </div>
                    <div class="report-stat">
                        <div class="report-stat-label">总时长</div>
                        <div class="report-stat-value" style="color:#00d4ff;">${this.formatTime(duration)}</div>
                    </div>
                </div>
                ${isLegacy ? `
                    <div class="report-issue">
                        📺 <strong>旧口径提醒：</strong>这份是从投影大屏导入的历史记录，评分口径和现在不一样，具体差异在最后。
                    </div>
                ` : ''}
            </div>
        `;
        
        html += `
            <div class="report-section">
                <h4>📊 关键数据</h4>
                <div class="report-stats">
                    <div class="report-stat">
                        <div class="report-stat-label">成功回收</div>
                        <div class="report-stat-value" style="color:#22c55e;">${successEvents.length} 件</div>
                    </div>
                    <div class="report-stat">
                        <div class="report-stat-label">剩余燃料</div>
                        <div class="report-stat-value" style="color:${(finalResources?.fuel || this.resources.fuel) < 20 ? '#ef4444' : '#fbbf24'};">${(finalResources?.fuel || this.resources.fuel).toFixed(0)}</div>
                    </div>
                    <div class="report-stat">
                        <div class="report-stat-label">剩余氧气</div>
                        <div class="report-stat-value" style="color:${(finalResources?.oxygen || this.resources.oxygen) < 20 ? '#ef4444' : '#22d3ee'};">${(finalResources?.oxygen || this.resources.oxygen).toFixed(0)}</div>
                    </div>
                    <div class="report-stat">
                        <div class="report-stat-label">操作</div>
                        <div class="report-stat-value" style="font-size:14px;">${metadata.operator || '阿蓝'}</div>
                    </div>
                </div>
            </div>
        `;
        
        html += `<div class="report-section"><h4>💬 同事说人话总结</h4>`;
        
        if (!hasIssues && !hasNotes && !isLegacy) {
            html += `
                <div class="report-highlight">
                    <strong>✅ 完美一局</strong>
                    <p>这局很顺，${successEvents.length}次回收全部成功，没出任何幺蛾子。孩子们状态在线，操作节奏也稳。得分${finalResources?.score || this.resources.score}，算是不错的成绩。</p>
                    <p>可以直接给孩子们看结果，不用额外解释什么。</p>
                </div>
            `;
        } else {
            if (successEvents.length >= 8) {
                html += `
                    <div class="report-highlight">
                        <strong>👍 整体还行</strong>
                        <p>回收了${successEvents.length}件垃圾，得分${finalResources?.score || this.resources.score}，大部分时间是顺利的。</p>
                    </div>
                `;
            }
            
            if (errorEvents.length > 0) {
                html += `
                    <div class="report-error">
                        <strong>❌ 出过异常</strong>
                        <p>有${errorEvents.length}次资源越界（变成负数了），这种情况我们不能假装没看见。已经标记出来等人工确认。</p>
                    </div>
                `;
            }
            
            if (warningEvents.length > 0) {
                html += `
                    <div class="report-issue">
                        <strong>⚠️ 有${warningEvents.length}个小插曲</strong>
                        <p>包括新手误操作、边界分数、故意暂停测试这些情况，都记下来了。</p>
                    </div>
                `;
            }
            
            if (pendingEvents.length > 0) {
                html += `
                    <div class="report-issue">
                        <strong>⏳ ${pendingEvents.length}条待确认</strong>
                        <p>这些是系统拿不准的地方，需要人来拍板。点左边事件流里的"确认处理"按钮就行。</p>
                    </div>
                `;
            }
            
            if (hasNotes) {
                html += `
                    <div class="report-diff">
                        <strong>📝 有${noteEvents.length}条人工备注</strong>
                        <p>阿蓝后来补的记录，说明这局有特殊情况。</p>
                    </div>
                `;
            }
        }
        
        html += `</div>`;
        
        if (hasNotes && metadata.notes && metadata.notes.length > 0) {
            html += `
                <div class="report-section">
                    <h4>🔍 补录差异说明</h4>
                    <details class="report-diff" open>
                        <summary>点击查看补录前后的差异</summary>
                        ${metadata.notes.map(note => `
                            <div class="diff-item">
                                <span class="diff-old">原记录：${note.context}</span>
                            </div>
                            <div class="diff-item">
                                <span class="diff-new">补录：${note.text}（${this.formatTime(note.time)}）</span>
                            </div>
                            <br>
                        `).join('')}
                    </details>
                </div>
            `;
        }
        
        if (isLegacy && record.conversionNotes) {
            html += `
                <div class="report-section">
                    <h4>📺 旧口径换算说明</h4>
                    <details class="report-diff" open>
                        <summary>投影大屏 → 新系统 口径对照表</summary>
                        ${record.conversionNotes.map(note => `
                            <div class="diff-item">• ${note}</div>
                        `).join('')}
                    </details>
                </div>
            `;
        }
        
        html += `
            <div class="report-section">
                <h4>🕐 时间线复盘</h4>
                <div class="report-timeline">
                    ${events.map(e => {
                        let cls = '';
                        if (e.type === EventType.SUCCESS) cls = 'good';
                        else if (e.type === EventType.WARNING || e.type === EventType.PENDING) cls = 'warn';
                        else if (e.type === EventType.ERROR) cls = 'bad';
                        else if (e.type === EventType.NOTE) cls = 'note';
                        
                        return `
                            <div class="report-timeline-item ${cls}">
                                <strong>[${this.formatTime(e.time)}]</strong> ${e.text}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        
        return html;
    }

    exportReport() {
        if (!this.currentRecord) {
            alert('先结算一局再导出吧');
            return;
        }
        
        const { metadata, stats, finalResources } = this.currentRecord;
        const events = this.eventLog && this.eventLog.length >= this.currentRecord.events.length ? this.eventLog : this.currentRecord.events;
        const duration = this.elapsedTime || metadata.duration;
        const effectiveFinalResources = this.state !== GameState.READY ? this.resources : finalResources;
        const unresolvedPending = events.filter(e => e.type === EventType.PENDING);
        const unresolvedIds = unresolvedPending.map(e => e.pendingId || (e.data && e.data.pendingId));
        const unresolvedCount = this.pendingConfirmations.length ?
            this.pendingConfirmations.filter(p => !p.resolved).length :
            unresolvedPending.length;
        
        let text = `
═══════════════════════════════════════
        太空垃圾回收站 - 复盘报告
═══════════════════════════════════════

📅 时间：${new Date(metadata.startTime || Date.now()).toLocaleString('zh-CN')}
👥 班级：${metadata.className || '待填写'}
👤 操作：${metadata.operator || '阿蓝'}
⏱️ 时长：${this.formatTime(duration)}
⭐ 得分：${effectiveFinalResources?.score}

${metadata.source === 'legacy' ? '📺 【注意】这是从投影大屏导入的旧记录，口径有换算\n' : ''}

┌───────────── 关键数据 ─────────────┐
│  成功回收：${String(events.filter(e => e.type === EventType.SUCCESS).length).padEnd(2)} 件              │
│  剩余燃料：${String((effectiveFinalResources?.fuel).toFixed(0)).padEnd(3)}                │
│  剩余氧气：${String((effectiveFinalResources?.oxygen).toFixed(0)).padEnd(3)}                │
│  待确认项：${String(unresolvedCount).padEnd(2)} 条              │
│  人工备注：${String(events.filter(e => e.type === EventType.NOTE).length).padEnd(2)} 条              │
└────────────────────────────────────┘

💬 同事总结：
${this.getPlainTextSummary({ ...this.currentRecord, events })}

┌───────────── 完整时间线 ─────────────┐
`;
        
        events.forEach(e => {
            const icon = {
                [EventType.INFO]: 'ℹ️',
                [EventType.SUCCESS]: '✅',
                [EventType.WARNING]: '⚠️',
                [EventType.ERROR]: '❌',
                [EventType.PENDING]: '⏳',
                [EventType.NOTE]: '📝',
                [EventType.LEGACY]: '📺'
            }[e.type] || '•';
            
            text += `│ ${icon} [${this.formatTime(e.time)}] ${e.text.substring(0, 28).padEnd(28)} │\n`;
        });
        
        text += `└────────────────────────────────────┘\n`;
        
        if (metadata.notes && metadata.notes.length > 0) {
            text += `
🔍 补录差异说明：
${metadata.notes.map((n, i) => `${i + 1}. ${this.formatTime(n.time)} - ${n.text}`).join('\n')}
`;
        }
        
        if (this.currentRecord.conversionNotes) {
            text += `
📺 旧口径换算：
${this.currentRecord.conversionNotes.map(n => `• ${n}`).join('\n')}
`;
        }
        
        text += `
═══════════════════════════════════════
        生成时间：${new Date().toLocaleString('zh-CN')}
═══════════════════════════════════════
`;
        
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `太空垃圾回收站_${metadata.className || '未命名'}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    getPlainTextSummary(record) {
        const { events, finalResources } = record;
        const successCount = events.filter(e => e.type === EventType.SUCCESS).length;
        const errorCount = events.filter(e => e.type === EventType.ERROR).length;
        const warningCount = events.filter(e => e.type === EventType.WARNING).length;
        const pendingCount = events.filter(e => e.type === EventType.PENDING).length;
        const noteCount = events.filter(e => e.type === EventType.NOTE).length;
        
        let summary = '';
        
        if (errorCount === 0 && warningCount === 0 && pendingCount === 0) {
            summary += `这局很顺，${successCount}次回收全部成功。得分${finalResources?.score || this.resources.score}，`;
            summary += finalResources?.score >= 100 ? '成绩优秀。' : '成绩还可以。';
            summary += '\n直接给孩子们看结果就行，不用额外解释。';
        } else {
            if (successCount >= 5) {
                summary += `整体还行，回收了${successCount}件垃圾，得分${finalResources?.score || this.resources.score}。`;
            } else {
                summary += `这局不太理想，只回收了${successCount}件，得分${finalResources?.score || this.resources.score}。`;
            }
            
            if (errorCount > 0) {
                summary += `\n⚠️ 出了${errorCount}次资源负数异常，需要人工确认怎么算。`;
            }
            if (warningCount > 0) {
                summary += `\n⚠️ 有${warningCount}个小插曲（误操作/暂停/边界分）。`;
            }
            if (pendingCount > 0) {
                summary += `\n⏳ 还有${pendingCount}条记录等着拍板。`;
            }
            if (noteCount > 0) {
                summary += `\n📝 阿蓝补了${noteCount}条备注，记得看。`;
            }
        }
        
        return summary;
    }

    startReplay() {
        const sourceRecord = this.currentRecord || sampleRecords.smooth;
        if (!sourceRecord) return;
        
        this.stopReplay();
        
        this.switchTab('replay');
        
        this.replayState = {
            events: [...sourceRecord.events],
            currentIndex: -1,
            speed: parseFloat(document.getElementById('replaySpeed').value),
            timer: null,
            isPlaying: false
        };
        
        const replayList = document.getElementById('replayList');
        replayList.innerHTML = '';
        
        this.replayState.events.forEach((event, index) => {
            const item = document.createElement('div');
            item.className = 'replay-item';
            item.dataset.index = index;
            item.innerHTML = `
                <span class="event-time">[${this.formatTime(event.time)}]</span>
                <span class="event-text">${event.text}</span>
            `;
            replayList.appendChild(item);
        });
        
        document.getElementById('replaySlider').max = Math.max(1, this.replayState.events.length - 1);
        document.getElementById('replayTime').textContent = `00:00 / ${this.formatTime(sourceRecord.metadata?.duration || 180)}`;
        
        this.replayState.isPlaying = true;
        this.playNextReplayEvent();
        
        document.getElementById('replayStartBtn').disabled = true;
        document.getElementById('replayPauseBtn').disabled = false;
        document.getElementById('replayStopBtn').disabled = false;
    }

    playNextReplayEvent() {
        if (!this.replayState || !this.replayState.isPlaying) return;
        
        this.replayState.currentIndex++;
        
        if (this.replayState.currentIndex >= this.replayState.events.length) {
            this.pauseReplay();
            return;
        }
        
        const event = this.replayState.events[this.replayState.currentIndex];
        
        document.querySelectorAll('.replay-item').forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.index) === this.replayState.currentIndex);
        });
        
        const activeItem = document.querySelector(`.replay-item[data-index="${this.replayState.currentIndex}"]`);
        if (activeItem) {
            activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        
        document.getElementById('replaySlider').value = this.replayState.currentIndex;
        document.getElementById('replayTime').textContent = 
            `${this.formatTime(event.time)} / ${this.formatTime(this.replayState.events[this.replayState.events.length - 1]?.time || 0)}`;
        
        if (event.data && event.data.fuel !== undefined) {
            this.resources.fuel = event.data.fuel;
            this.resources.oxygen = event.data.oxygen;
            if (event.data.score !== undefined) this.resources.score = event.data.score;
            this.updateUI();
        }
        
        if (this.replayState.currentIndex + 1 < this.replayState.events.length) {
            const nextEvent = this.replayState.events[this.replayState.currentIndex + 1];
            const delay = (nextEvent.time - event.time) * 1000 / this.replayState.speed;
            
            this.replayState.timer = setTimeout(() => {
                this.playNextReplayEvent();
            }, Math.max(100, delay));
        } else {
            this.pauseReplay();
        }
    }

    pauseReplay() {
        if (!this.replayState) return;
        
        this.replayState.isPlaying = false;
        clearTimeout(this.replayState.timer);
        
        document.getElementById('replayStartBtn').disabled = false;
        document.getElementById('replayPauseBtn').disabled = true;
    }

    stopReplay() {
        if (this.replayState) {
            clearTimeout(this.replayState.timer);
            this.replayState = null;
        }
        
        document.getElementById('replayStartBtn').disabled = false;
        document.getElementById('replayPauseBtn').disabled = true;
        document.getElementById('replayStopBtn').disabled = true;
        document.getElementById('replaySlider').value = 0;
        document.getElementById('replayTime').textContent = '00:00 / 00:00';
        document.querySelectorAll('.replay-item').forEach(item => item.classList.remove('active'));
    }

    seekReplay(value) {
        if (!this.replayState) return;
        
        this.pauseReplay();
        this.replayState.currentIndex = parseInt(value) - 1;
        
        document.querySelectorAll('.replay-item').forEach((item, index) => {
            item.classList.toggle('active', index <= this.replayState.currentIndex);
        });
        
        const event = this.replayState.events[this.replayState.currentIndex];
        if (event && event.data) {
            if (event.data.fuel !== undefined) this.resources.fuel = event.data.fuel;
            if (event.data.oxygen !== undefined) this.resources.oxygen = event.data.oxygen;
            if (event.data.score !== undefined) this.resources.score = event.data.score;
            this.updateUI();
        }
        
        document.getElementById('replayTime').textContent = 
            `${this.formatTime(event?.time || 0)} / ${this.formatTime(this.replayState.events[this.replayState.events.length - 1]?.time || 0)}`;
    }

    showModal(title, bodyHtml, buttons) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = bodyHtml;
        
        const footer = document.getElementById('modalFooter');
        footer.innerHTML = '';
        
        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.className = `btn ${btn.class}`;
            button.textContent = btn.text;
            button.addEventListener('click', btn.action);
            footer.appendChild(button);
        });
        
        document.getElementById('modalOverlay').classList.remove('hidden');
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    updateUI() {
        const statusEl = document.getElementById('gameStatus');
        const statusMap = {
            [GameState.READY]: { text: '准备就绪', class: 'status-ready' },
            [GameState.RUNNING]: { text: '进行中', class: 'status-running' },
            [GameState.PAUSED]: { text: '已暂停', class: 'status-paused' },
            [GameState.ERROR]: { text: '异常', class: 'status-error' },
            [GameState.SETTLED]: { text: '已结算', class: 'status-settled' }
        };
        const status = statusMap[this.state];
        statusEl.textContent = status.text;
        statusEl.className = `status ${status.class}`;
        
        document.getElementById('timeDisplay').textContent = this.formatTime(this.elapsedTime);
        document.getElementById('fuelValue').textContent = this.resources.fuel.toFixed(0);
        document.getElementById('oxygenValue').textContent = this.resources.oxygen.toFixed(0);
        document.getElementById('scoreValue').textContent = this.resources.score.toFixed(0);
        
        const fuelEl = document.getElementById('fuelResource');
        const oxygenEl = document.getElementById('oxygenResource');
        
        fuelEl.classList.remove('warning', 'danger');
        oxygenEl.classList.remove('warning', 'danger');
        
        if (this.resources.fuel < 0) fuelEl.classList.add('danger');
        else if (this.resources.fuel < 20) fuelEl.classList.add('warning');
        
        if (this.resources.oxygen < 0) oxygenEl.classList.add('danger');
        else if (this.resources.oxygen < 20) oxygenEl.classList.add('warning');
        
        document.getElementById('startBtn').disabled = this.state !== GameState.READY;
        document.getElementById('pauseBtn').disabled = this.state !== GameState.RUNNING;
        document.getElementById('resumeBtn').disabled = this.state !== GameState.PAUSED;
        document.getElementById('settleBtn').disabled = this.state === GameState.READY || this.state === GameState.SETTLED;
        document.getElementById('spawnDebrisBtn').disabled = this.state !== GameState.RUNNING;
        document.getElementById('spawnTroubleBtn').disabled = this.state !== GameState.RUNNING;
    }
}

function loadSample(sampleName) {
    const sample = sampleRecords[sampleName];
    if (!sample) return;
    
    game.stopReplay();
    
    game.currentRecord = JSON.parse(JSON.stringify(sample));
    
    game.eventLog = JSON.parse(JSON.stringify(sample.events));
    game.eventLog.forEach((event, idx) => {
        if (!event.id) {
            event.id = `sample_evt_${idx}_${Date.now()}`;
        }
        if (event.pendingId && (!event.data || !event.data.pendingId)) {
            event.data = event.data || {};
            event.data.pendingId = event.pendingId;
        }
    });
    
    game.resources = { ...sample.finalResources };
    game.elapsedTime = sample.metadata.duration;
    game.state = GameState.SETTLED;
    
    game.pendingConfirmations = [];
    sample.events.forEach(event => {
        if (event.type === 'pending' && event.pendingId) {
            const pType = event.pendingId.startsWith('pause') ? 'pause' :
                          event.pendingId.startsWith('fuel') ? 'negative' :
                          event.pendingId.startsWith('score') ? 'boundary' : 'manual';
            game.pendingConfirmations.push({
                id: event.pendingId,
                type: pType,
                time: event.time,
                message: event.text.replace(/^⏳ /, ''),
                pauseDuration: pType === 'pause' ? 5 : 0,
                resolved: false,
                resourcesBeforePause: { fuel: 78, oxygen: 75, score: 23 },
                debrisCountBeforePause: 2
            });
        }
    });
    
    const eventsList = document.getElementById('eventsList');
    eventsList.innerHTML = '';
    
    game.eventLog.forEach(event => game.renderEventItem(event));
    
    game.generateReport();
    game.updateUI();
    
    game.switchTab('events');
    
    game.showModal(
        '✅ 样例加载完成',
        `
            <p>已加载「${sample.metadata.title}」</p>
            <p style="margin-top:12px;">
                <strong>类型：</strong>${
                    sampleName === 'smooth' ? '顺利完成，没有问题' :
                    sampleName === 'rework' ? '有问题，需要人工确认' :
                    '投影大屏旧记录，口径已换算'
                }
            </p>
            <p>可以去「回放」页看过程，「复盘」页看报告。</p>
        `,
        [
            { text: '知道了', class: 'btn-primary', action: () => closeModal() }
        ]
    );
}

function closeModal() {
    document.getElementById('modalOverlay').classList.add('hidden');
}

let game;
document.addEventListener('DOMContentLoaded', () => {
    game = new SpaceRecyclingGame();
    window.game = game;
    window.loadSample = loadSample;
    window.closeModal = closeModal;
});
