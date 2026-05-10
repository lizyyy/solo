const App = {
    currentSchedule: {
        date: '',
        slot: 'morning',
        programs: []
    },
    durationResult: null,
    sensitiveResult: null,
    publishResult: null,
    publishStatus: PUBLISH_STATUS.DRAFT,
    programIdCounter: 0,

    init: function() {
        UI.log('系统初始化中...', LOG_TYPE.INFO);
        
        UI.loadSamples();
        UI.loadRules();
        
        this.bindEvents();
        this.loadSample('clean');
        
        UI.log('校园广播节目单发布门禁系统已就绪', LOG_TYPE.SUCCESS);
    },

    bindEvents: function() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                UI.switchTab(tabName);
                if (tabName === 'issues') {
                    UI.renderIssues(IssueManager.getAll());
                }
            });
        });

        document.getElementById('btnLoadSample').addEventListener('click', () => {
            const samples = Object.keys(SAMPLES);
            const randomSample = samples[Math.floor(Math.random() * samples.length)];
            this.loadSample(randomSample);
        });

        document.getElementById('btnAddProgram').addEventListener('click', () => {
            this.addProgram();
        });

        document.getElementById('btnValidateDuration').addEventListener('click', () => {
            this.runDurationCheck();
            UI.switchTab('duration');
        });

        document.getElementById('btnBackToEditor').addEventListener('click', () => {
            UI.switchTab('editor');
        });

        document.getElementById('btnRunDurationCheck').addEventListener('click', () => {
            this.runDurationCheck();
        });

        document.getElementById('btnNextSensitive').addEventListener('click', () => {
            if (!this.durationResult) {
                UI.log('请先运行时长校验', LOG_TYPE.WARNING);
                return;
            }
            UI.switchTab('sensitive');
        });

        document.getElementById('btnBackToDuration').addEventListener('click', () => {
            UI.switchTab('duration');
        });

        document.getElementById('btnRunSensitiveCheck').addEventListener('click', () => {
            this.runSensitiveCheck();
        });

        document.getElementById('btnNextPublish').addEventListener('click', () => {
            if (!this.sensitiveResult) {
                UI.log('请先运行敏感词扫描', LOG_TYPE.WARNING);
                return;
            }
            this.updatePublishGate();
            UI.switchTab('publish');
        });

        document.getElementById('btnBackToSensitive').addEventListener('click', () => {
            UI.switchTab('sensitive');
        });

        document.getElementById('btnPublish').addEventListener('click', () => {
            this.publish();
        });

        document.getElementById('btnWithdraw').addEventListener('click', () => {
            this.withdraw();
        });

        document.getElementById('btnClearIssues').addEventListener('click', () => {
            IssueManager.clear();
            UI.renderIssues([]);
            UI.log('问题列表已清空', LOG_TYPE.INFO);
        });

        document.getElementById('scheduleDate').addEventListener('change', (e) => {
            this.currentSchedule.date = e.target.value;
            this.resetChecks();
        });

        document.getElementById('scheduleSlot').addEventListener('change', (e) => {
            this.currentSchedule.slot = e.target.value;
            this.resetChecks();
        });
    },

    loadSample: function(sampleId) {
        const sample = SAMPLES[sampleId];
        if (!sample) {
            UI.log('样例不存在', LOG_TYPE.ERROR);
            return;
        }

        this.currentSchedule = JSON.parse(JSON.stringify(sample.data));
        this.currentSchedule.programs.forEach(p => {
            this.programIdCounter = Math.max(this.programIdCounter, parseInt(p.id.replace('p', '')));
        });
        
        this.resetChecks();
        
        UI.updateScheduleInfo(this.currentSchedule.date, this.currentSchedule.slot);
        UI.renderProgramList(this.currentSchedule.programs);
        UI.updateSampleSelection(sampleId);
        
        UI.log(`已加载样例: ${sample.name}`, LOG_TYPE.INFO);
    },

    addProgram: function() {
        this.programIdCounter++;
        const newProgram = {
            id: 'p' + this.programIdCounter,
            title: '新节目',
            duration: 5,
            content: '请输入节目内容...'
        };
        this.currentSchedule.programs.push(newProgram);
        UI.renderProgramList(this.currentSchedule.programs);
        this.resetChecks();
        UI.log('已添加新节目', LOG_TYPE.INFO);
    },

    removeProgram: function(programId) {
        const index = this.currentSchedule.programs.findIndex(p => p.id === programId);
        if (index !== -1) {
            const program = this.currentSchedule.programs[index];
            this.currentSchedule.programs.splice(index, 1);
            UI.renderProgramList(this.currentSchedule.programs);
            this.resetChecks();
            UI.log(`已删除节目: ${program.title}`, LOG_TYPE.INFO);
        }
    },

    updateProgram: function(programId, field, value) {
        const program = this.currentSchedule.programs.find(p => p.id === programId);
        if (program) {
            program[field] = value;
            this.resetChecks();
        }
    },

    moveUp: function(programId) {
        const index = this.currentSchedule.programs.findIndex(p => p.id === programId);
        if (index > 0) {
            const temp = this.currentSchedule.programs[index];
            this.currentSchedule.programs[index] = this.currentSchedule.programs[index - 1];
            this.currentSchedule.programs[index - 1] = temp;
            UI.renderProgramList(this.currentSchedule.programs);
            this.resetChecks();
        }
    },

    moveDown: function(programId) {
        const index = this.currentSchedule.programs.findIndex(p => p.id === programId);
        if (index < this.currentSchedule.programs.length - 1) {
            const temp = this.currentSchedule.programs[index];
            this.currentSchedule.programs[index] = this.currentSchedule.programs[index + 1];
            this.currentSchedule.programs[index + 1] = temp;
            UI.renderProgramList(this.currentSchedule.programs);
            this.resetChecks();
        }
    },

    resetChecks: function() {
        this.durationResult = null;
        this.sensitiveResult = null;
        this.publishResult = null;
        this.publishStatus = PUBLISH_STATUS.DRAFT;
        
        UI.renderDurationResult(null);
        UI.renderSensitiveResult(null);
        UI.renderPublishResult(null, this.publishStatus, this.currentSchedule);
    },

    runDurationCheck: function() {
        const scheduleData = UI.getScheduleData();
        
        UI.log('开始时长校验...', LOG_TYPE.INFO);
        
        this.durationResult = DurationValidator.validate(scheduleData);
        
        const issues = IssueManager.addDurationIssues(this.durationResult, scheduleData);
        if (issues.length > 0) {
            UI.log(`发现 ${issues.length} 个时长相关问题`, LOG_TYPE.WARNING);
        }
        
        UI.renderDurationResult(this.durationResult);
        UI.renderIssues(IssueManager.getAll());
        
        const formatted = DurationValidator.formatResult(this.durationResult);
        UI.log(formatted, this.durationResult.status === CHECK_STATUS.PASS ? LOG_TYPE.SUCCESS : 
                     this.durationResult.status === CHECK_STATUS.WARNING ? LOG_TYPE.WARNING : LOG_TYPE.ERROR);
        
        return this.durationResult;
    },

    runSensitiveCheck: function() {
        const scheduleData = UI.getScheduleData();
        
        UI.log('开始敏感词扫描...', LOG_TYPE.INFO);
        
        this.sensitiveResult = SensitiveScanner.scan(scheduleData);
        
        const issues = IssueManager.addSensitiveIssues(this.sensitiveResult, scheduleData);
        if (issues.length > 0) {
            UI.log(`发现 ${issues.length} 个敏感词问题`, LOG_TYPE.ERROR);
        }
        
        UI.renderSensitiveResult(this.sensitiveResult);
        UI.renderIssues(IssueManager.getAll());
        
        const formatted = SensitiveScanner.formatResult(this.sensitiveResult);
        UI.log(formatted, this.sensitiveResult.status === CHECK_STATUS.PASS ? LOG_TYPE.SUCCESS : LOG_TYPE.ERROR);
        
        return this.sensitiveResult;
    },

    updatePublishGate: function() {
        const scheduleData = UI.getScheduleData();
        
        this.publishResult = PublishGate.check(this.durationResult, this.sensitiveResult);
        
        if (this.publishResult.failures.length > 0) {
            IssueManager.addPublishIssue(this.publishResult, scheduleData);
            UI.renderIssues(IssueManager.getAll());
        }
        
        UI.renderPublishResult(this.publishResult, this.publishStatus, scheduleData);
        
        const formatted = PublishGate.formatResult(this.publishResult);
        UI.log(formatted, this.publishResult.canPublish ? LOG_TYPE.SUCCESS : LOG_TYPE.WARNING);
        
        return this.publishResult;
    },

    publish: function() {
        const scheduleData = UI.getScheduleData();
        
        if (!this.publishResult) {
            this.updatePublishGate();
        }
        
        if (!this.publishResult.canPublish) {
            UI.log('发布被阻止：未通过所有检查', LOG_TYPE.ERROR);
            return;
        }
        
        const result = PublishGate.publish(scheduleData);
        this.publishStatus = PUBLISH_STATUS.PUBLISHED;
        
        UI.renderPublishResult(this.publishResult, this.publishStatus, scheduleData);
        UI.log(result.message, LOG_TYPE.SUCCESS);
    },

    withdraw: function() {
        const scheduleData = UI.getScheduleData();
        
        if (this.publishStatus !== PUBLISH_STATUS.PUBLISHED) {
            UI.log('当前没有已发布的节目单可撤回', LOG_TYPE.WARNING);
            return;
        }
        
        const result = PublishGate.withdraw(scheduleData);
        this.publishStatus = PUBLISH_STATUS.WITHDRAWN;
        
        IssueManager.addWithdrawInfo(result, scheduleData);
        
        UI.renderPublishResult(this.publishResult, this.publishStatus, scheduleData);
        UI.renderIssues(IssueManager.getAll());
        UI.log(result.message, LOG_TYPE.SUCCESS);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
