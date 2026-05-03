
class UIComponents {
    constructor(appState) {
        this.appState = appState;
        this.storage = appState.storage;
        this.rulesEngine = appState.rulesEngine;
        this.timer = appState.timer;
        this.importExport = appState.importExport;
        this.markdownExporter = appState.markdownExporter;
        
        this.selectedGroupId = null;
        this.selectedAthleteId = null;
        this.currentEvent = null;
        
        this.competitionState = {
            rawCount: 0,
            errorCount: 0,
            foulCount: 0,
            history: [],
            maxHistory: 50
        };

        this.init();
    }

    init() {
        this.setupTabNavigation();
        this.setupEventSelector();
        this.setupCheckinTab();
        this.setupCompetitionTab();
        this.setupReviewTab();
        this.setupResultsTab();
        this.setupKeyboardShortcuts();
        this.setupHeaderButtons();
        this.loadInitialData();
    }

    loadInitialData() {
        const savedEvent = this.storage.getCurrentEvent();
        if (savedEvent) {
            this.currentEvent = savedEvent;
            document.getElementById('event-selector').value = savedEvent;
        }
        this.refreshGroupsList();
        this.refreshResultsDropdowns();
    }

    setupTabNavigation() {
        const tabs = document.querySelectorAll('.nav-tab');
        const tabContents = document.querySelectorAll('.tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const tabId = tab.dataset.tab;
                tabContents.forEach(content => {
                    content.classList.remove('active');
                    if (content.id === `${tabId}-tab`) {
                        content.classList.add('active');
                    }
                });

                this.onTabChange(tabId);
            });
        });
    }

    onTabChange(tabId) {
        switch (tabId) {
            case 'checkin':
                this.refreshGroupsList();
                break;
            case 'competition':
                this.refreshCompetitionDropdowns();
                break;
            case 'review':
                this.refreshReviewDropdowns();
                break;
            case 'results':
                this.refreshResultsDropdowns();
                break;
        }
    }

    setupEventSelector() {
        const selector = document.getElementById('event-selector');
        selector.addEventListener('change', (e) => {
            this.currentEvent = e.target.value || null;
            this.storage.setCurrentEvent(this.currentEvent);
            this.refreshAll();
        });
    }

    setupHeaderButtons() {
        document.getElementById('export-markdown-btn').addEventListener('click', () => {
            this.exportMarkdownReport();
        });

        document.getElementById('clear-data-btn').addEventListener('click', () => {
            if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
                this.storage.clearAll();
                this.refreshAll();
                alert('数据已清空');
            }
        });
    }

    setupCheckinTab() {
        document.getElementById('create-group-btn').addEventListener('click', () => {
            this.createGroup();
        });

        document.getElementById('add-athlete-btn').addEventListener('click', () => {
            this.addAthlete();
        });

        document.getElementById('import-csv').addEventListener('change', (e) => {
            this.importCSV(e.target.files[0]);
        });

        document.getElementById('import-json').addEventListener('change', (e) => {
            this.importJSON(e.target.files[0]);
        });

        document.getElementById('export-json-btn').addEventListener('click', () => {
            this.exportAllData('json');
        });

        document.getElementById('export-csv-btn').addEventListener('click', () => {
            this.exportAthletesCSV();
        });
    }

    setupCompetitionTab() {
        document.getElementById('competition-group-selector').addEventListener('change', (e) => {
            this.selectedGroupId = e.target.value || null;
            this.refreshCompetitionAthletes();
        });

        document.getElementById('competition-athlete-selector').addEventListener('change', (e) => {
            this.selectedAthleteId = e.target.value || null;
            this.refreshAthleteInfo();
        });

        document.getElementById('timer-start-btn').addEventListener('click', () => {
            this.startTimer();
        });

        document.getElementById('timer-pause-btn').addEventListener('click', () => {
            this.pauseTimer();
        });

        document.getElementById('timer-reset-btn').addEventListener('click', () => {
            this.resetTimer();
        });

        document.getElementById('timer-restart-btn').addEventListener('click', () => {
            this.restartCompetition();
        });

        document.getElementById('add-count-btn').addEventListener('click', () => {
            this.addCount();
        });

        document.getElementById('add-error-btn').addEventListener('click', () => {
            this.addError();
        });

        document.getElementById('add-foul-btn').addEventListener('click', () => {
            this.addFoul();
        });

        document.getElementById('undo-btn').addEventListener('click', () => {
            this.undoAction();
        });

        document.getElementById('save-exception-btn').addEventListener('click', () => {
            this.saveExceptionNotes();
        });

        this.setupTimerCallbacks();
    }

    setupTimerCallbacks() {
        this.timer.onTick((state) => {
            document.getElementById('timer-value').textContent = state.formattedTime;
        });

        this.timer.onStateChange((prevState, newState, timerState) => {
            const statusEl = document.getElementById('timer-status');
            const statusMap = {
                'idle': '准备',
                'running': '比赛中',
                'paused': '已暂停',
                'completed': '已完成'
            };
            statusEl.textContent = statusMap[newState] || '准备';

            this.updateTimerButtons(newState);
        });

        this.timer.onComplete(() => {
            this.onTimerComplete();
        });
    }

    updateTimerButtons(state) {
        const startBtn = document.getElementById('timer-start-btn');
        const pauseBtn = document.getElementById('timer-pause-btn');
        const resetBtn = document.getElementById('timer-reset-btn');
        const restartBtn = document.getElementById('timer-restart-btn');

        startBtn.disabled = state === 'running' || state === 'completed';
        pauseBtn.disabled = state !== 'running';
        resetBtn.disabled = state === 'idle';
        restartBtn.disabled = state === 'running';

        if (state === 'paused') {
            startBtn.disabled = false;
            startBtn.textContent = '继续';
        } else {
            startBtn.textContent = '开始';
        }
    }

    setupReviewTab() {
        document.getElementById('review-group-selector').addEventListener('change', (e) => {
            this.selectedGroupId = e.target.value || null;
            this.refreshReviewAthletes();
            this.refreshGroupResultsTable();
        });

        document.getElementById('review-athlete-selector').addEventListener('change', (e) => {
            this.selectedAthleteId = e.target.value || null;
        });

        document.getElementById('load-result-btn').addEventListener('click', () => {
            this.loadResultForReview();
        });

        document.getElementById('confirm-result-btn').addEventListener('click', () => {
            this.confirmResult();
        });

        document.getElementById('modify-result-btn').addEventListener('click', () => {
            this.showModifyResultDialog();
        });

        document.getElementById('delete-result-btn').addEventListener('click', () => {
            this.deleteResult();
        });
    }

    setupResultsTab() {
        document.getElementById('results-event-selector').addEventListener('change', () => {
            this.refreshResultsDropdowns();
        });

        document.getElementById('results-group-selector').addEventListener('change', () => {
            // 选择分组时刷新
        });

        document.getElementById('calculate-rankings-btn').addEventListener('click', () => {
            this.calculateAndDisplayRankings();
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (document.activeElement.tagName === 'INPUT' || 
                document.activeElement.tagName === 'TEXTAREA' ||
                document.activeElement.tagName === 'SELECT') {
                return;
            }

            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    this.addCount();
                    break;
                case 'KeyE':
                    e.preventDefault();
                    this.addError();
                    break;
                case 'KeyF':
                    e.preventDefault();
                    this.addFoul();
                    break;
                case 'KeyZ':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.undoAction();
                    }
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (this.timer.isRunning()) {
                        this.pauseTimer();
                    } else if (this.timer.isPaused() || this.timer.isIdle()) {
                        this.startTimer();
                    }
                    break;
            }
        });
    }

    createGroup() {
        const nameInput = document.getElementById('group-name');
        const name = nameInput.value.trim();
        
        if (!name) {
            alert('请输入分组名称');
            return;
        }

        this.storage.addGroup({ name });
        nameInput.value = '';
        this.refreshGroupsList();
    }

    refreshGroupsList() {
        const groups = this.storage.getGroups();
        const container = document.getElementById('groups-container');
        
        if (groups.length === 0) {
            container.innerHTML = '<p class="empty-message">暂无分组，请创建</p>';
            return;
        }

        container.innerHTML = groups.map(group => `
            <div class="group-item ${this.selectedGroupId === group.id ? 'selected' : ''}" 
                 data-group-id="${group.id}">
                <span class="group-name">${group.name}</span>
                <div class="group-actions">
                    <button class="btn-small edit-group" data-group-id="${group.id}">编辑</button>
                    <button class="btn-small delete-group" data-group-id="${group.id}">删除</button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('.group-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('edit-group') && 
                    !e.target.classList.contains('delete-group')) {
                    this.selectGroup(item.dataset.groupId);
                }
            });
        });

        container.querySelectorAll('.edit-group').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editGroup(btn.dataset.groupId);
            });
        });

        container.querySelectorAll('.delete-group').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteGroup(btn.dataset.groupId);
            });
        });

        this.refreshCompetitionDropdowns();
        this.refreshReviewDropdowns();
        this.refreshResultsDropdowns();
    }

    selectGroup(groupId) {
        this.selectedGroupId = groupId;
        this.refreshGroupsList();
        this.refreshAthletesTable();

        const group = this.storage.getGroups().find(g => g.id === groupId);
        document.getElementById('selected-group-name').textContent = group ? `- ${group.name}` : '';
    }

    editGroup(groupId) {
        const group = this.storage.getGroups().find(g => g.id === groupId);
        if (!group) return;

        const newName = prompt('输入新的分组名称:', group.name);
        if (newName && newName.trim()) {
            this.storage.updateGroup(groupId, { name: newName.trim() });
            this.refreshGroupsList();
        }
    }

    deleteGroup(groupId) {
        const group = this.storage.getGroups().find(g => g.id === groupId);
        const athletes = this.storage.getAthletesByGroup(groupId);
        
        let message = `确定要删除分组"${group.name}"吗？`;
        if (athletes.length > 0) {
            message += `\n该分组下有 ${athletes.length} 名选手，也将被删除。`;
        }

        if (confirm(message)) {
            this.storage.deleteGroup(groupId);
            if (this.selectedGroupId === groupId) {
                this.selectedGroupId = null;
            }
            this.refreshGroupsList();
            this.refreshAthletesTable();
        }
    }

    addAthlete() {
        if (!this.selectedGroupId) {
            alert('请先选择一个分组');
            return;
        }

        const number = document.getElementById('athlete-number').value.trim();
        const name = document.getElementById('athlete-name').value.trim();
        const team = document.getElementById('athlete-team').value.trim();

        if (!number || !name) {
            alert('请填写号码和姓名');
            return;
        }

        this.storage.addAthlete({
            number,
            name,
            team,
            groupId: this.selectedGroupId
        });

        document.getElementById('athlete-number').value = '';
        document.getElementById('athlete-name').value = '';
        document.getElementById('athlete-team').value = '';

        this.refreshAthletesTable();
    }

    refreshAthletesTable() {
        const athletes = this.selectedGroupId 
            ? this.storage.getAthletesByGroup(this.selectedGroupId)
            : [];
        const tbody = document.getElementById('athletes-tbody');

        if (athletes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-message">暂无选手</td></tr>';
            return;
        }

        const statusMap = {
            'checked_in': '已检录',
            'competing': '比赛中',
            'completed': '已完成',
            'disqualified': '已取消资格'
        };

        tbody.innerHTML = athletes.map(athlete => `
            <tr>
                <td>${athlete.number}</td>
                <td>${athlete.name}</td>
                <td>${athlete.team || '-'}</td>
                <td>${statusMap[athlete.status] || athlete.status}</td>
                <td>
                    <button class="btn-small edit-athlete" data-athlete-id="${athlete.id}">编辑</button>
                    <button class="btn-small delete-athlete" data-athlete-id="${athlete.id}">删除</button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.edit-athlete').forEach(btn => {
            btn.addEventListener('click', () => this.editAthlete(btn.dataset.athleteId));
        });

        tbody.querySelectorAll('.delete-athlete').forEach(btn => {
            btn.addEventListener('click', () => this.deleteAthlete(btn.dataset.athleteId));
        });
    }

    editAthlete(athleteId) {
        const athlete = this.storage.getAthleteById(athleteId);
        if (!athlete) return;

        const newNumber = prompt('号码:', athlete.number);
        if (newNumber === null) return;

        const newName = prompt('姓名:', athlete.name);
        if (newName === null) return;

        const newTeam = prompt('队伍:', athlete.team || '');
        if (newTeam === null) return;

        this.storage.updateAthlete(athleteId, {
            number: newNumber.trim(),
            name: newName.trim(),
            team: newTeam.trim()
        });

        this.refreshAthletesTable();
    }

    deleteAthlete(athleteId) {
        const athlete = this.storage.getAthleteById(athleteId);
        if (confirm(`确定要删除选手 ${athlete.name} (${athlete.number}) 吗？`)) {
            this.storage.deleteAthlete(athleteId);
            this.refreshAthletesTable();
        }
    }

    async importCSV(file) {
        if (!file) return;
        if (!this.selectedGroupId) {
            alert('请先选择一个分组');
            return;
        }

        try {
            const result = await this.importExport.importFromFile(file);
            if (result.error) {
                alert('导入失败: ' + result.error);
                return;
            }

            const parseResult = this.importExport.parseAthletesFromCSV(result.content, this.selectedGroupId);
            
            if (!parseResult.success) {
                alert('解析失败: ' + (parseResult.error || parseResult.errors?.join('\n')));
                return;
            }

            parseResult.athletes.forEach(athlete => {
                this.storage.addAthlete(athlete);
            });

            alert(`成功导入 ${parseResult.count} 名选手`);
            this.refreshAthletesTable();
        } catch (e) {
            alert('导入失败: ' + e.message);
        }
    }

    async importJSON(file) {
        if (!file) return;

        try {
            const result = await this.importExport.importFromFile(file);
            if (result.error) {
                alert('导入失败: ' + result.error);
                return;
            }

            const importResult = this.storage.importAllData(result.data);
            if (importResult.success) {
                alert(`成功导入数据`);
                this.refreshAll();
            } else {
                alert('导入失败: ' + importResult.error);
            }
        } catch (e) {
            alert('导入失败: ' + e.message);
        }
    }

    exportAllData(format = 'json') {
        this.importExport.exportAllData(this.storage, format);
    }

    exportAthletesCSV() {
        const athletes = this.storage.getAthletes();
        this.importExport.exportAthletes(athletes, 'csv');
    }

    refreshCompetitionDropdowns() {
        const groups = this.storage.getGroups();
        const groupSelector = document.getElementById('competition-group-selector');
        
        groupSelector.innerHTML = '<option value="">选择分组</option>' + 
            groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
        
        this.refreshCompetitionAthletes();
    }

    refreshCompetitionAthletes() {
        const athletes = this.selectedGroupId 
            ? this.storage.getAthletesByGroup(this.selectedGroupId)
            : [];
        const athleteSelector = document.getElementById('competition-athlete-selector');
        
        athleteSelector.innerHTML = '<option value="">选择选手</option>' + 
            athletes.map(a => `<option value="${a.id}">${a.number} - ${a.name}</option>`).join('');
    }

    refreshAthleteInfo() {
        const athlete = this.selectedAthleteId 
            ? this.storage.getAthleteById(this.selectedAthleteId)
            : null;

        document.getElementById('detail-number').textContent = athlete?.number || '-';
        document.getElementById('detail-name').textContent = athlete?.name || '-';
        document.getElementById('detail-team').textContent = athlete?.team || '-';
        document.getElementById('detail-event').textContent = 
            this.currentEvent ? this.rulesEngine.getEventName(this.currentEvent) : '-';
    }

    startTimer() {
        if (!this.currentEvent) {
            alert('请先选择比赛项目');
            return;
        }
        if (!this.selectedAthleteId) {
            alert('请先选择选手');
            return;
        }

        const config = this.rulesEngine.getEventConfig(this.currentEvent);
        if (config) {
            this.timer.setDuration(config.duration);
        }

        this.resetCompetitionState();
        this.timer.start();
        this.updateScoringButtons(true);
    }

    pauseTimer() {
        this.timer.pause();
        this.updateScoringButtons(false);
    }

    resetTimer() {
        this.timer.reset();
        this.resetCompetitionState();
        this.updateScoringButtons(false);
    }

    restartCompetition() {
        if (confirm('确定要重赛吗？当前成绩将被清除。')) {
            this.resetTimer();
            this.resetCompetitionState();
        }
    }

    resetCompetitionState() {
        this.competitionState = {
            rawCount: 0,
            errorCount: 0,
            foulCount: 0,
            history: [],
            maxHistory: 50
        };
        this.updateScoreDisplay();
    }

    updateScoringButtons(enabled) {
        const buttons = [
            'add-count-btn',
            'add-error-btn',
            'add-foul-btn',
            'undo-btn'
        ];

        buttons.forEach(id => {
            document.getElementById(id).disabled = !enabled;
        });
    }

    addCount() {
        if (!this.timer.isRunning()) return;
        
        this.competitionState.history.push({
            type: 'count',
            rawCount: this.competitionState.rawCount,
            errorCount: this.competitionState.errorCount,
            foulCount: this.competitionState.foulCount
        });
        
        this.competitionState.rawCount++;
        this.updateScoreDisplay();
    }

    addError() {
        if (!this.timer.isRunning()) return;
        
        this.competitionState.history.push({
            type: 'error',
            rawCount: this.competitionState.rawCount,
            errorCount: this.competitionState.errorCount,
            foulCount: this.competitionState.foulCount
        });
        
        this.competitionState.errorCount++;
        this.updateScoreDisplay();
    }

    addFoul() {
        if (!this.timer.isRunning()) return;
        
        this.competitionState.history.push({
            type: 'foul',
            rawCount: this.competitionState.rawCount,
            errorCount: this.competitionState.errorCount,
            foulCount: this.competitionState.foulCount
        });
        
        this.competitionState.foulCount++;
        this.updateScoreDisplay();
    }

    undoAction() {
        if (this.competitionState.history.length === 0) return;
        
        const prevState = this.competitionState.history.pop();
        this.competitionState.rawCount = prevState.rawCount;
        this.competitionState.errorCount = prevState.errorCount;
        this.competitionState.foulCount = prevState.foulCount;
        
        this.updateScoreDisplay();
    }

    updateScoreDisplay() {
        document.getElementById('valid-count').textContent = this.competitionState.rawCount;
        document.getElementById('error-count').textContent = this.competitionState.errorCount;
        document.getElementById('foul-count').textContent = this.competitionState.foulCount;
    }

    onTimerComplete() {
        this.updateScoringButtons(false);
        
        const athlete = this.storage.getAthleteById(this.selectedAthleteId);
        const timerState = this.timer.getCurrentState();
        
        const result = this.storage.addResult({
            athleteId: this.selectedAthleteId,
            athleteNumber: athlete?.number,
            athleteName: athlete?.name,
            team: athlete?.team,
            groupId: this.selectedGroupId,
            eventType: this.currentEvent,
            rawCount: this.competitionState.rawCount,
            errorCount: this.competitionState.errorCount,
            foulCount: this.competitionState.foulCount,
            duration: timerState.duration / 1000,
            timeUsed: timerState.elapsedTime / 1000,
            status: 'pending',
            confirmed: false
        });

        alert(`比赛完成！\n成绩已保存。\n有效次数: ${this.competitionState.rawCount}\n失误: ${this.competitionState.errorCount}\n犯规: ${this.competitionState.foulCount}`);
        
        this.storage.updateAthlete(this.selectedAthleteId, { status: 'completed' });
    }

    saveExceptionNotes() {
        if (!this.selectedAthleteId) {
            alert('请先选择选手');
            return;
        }

        const notes = document.getElementById('exception-notes').value.trim();
        
        let result = this.storage.getResultByAthlete(this.selectedAthleteId, this.currentEvent);
        
        if (result) {
            this.storage.updateResult(result.id, { exceptionNotes: notes });
            alert('异常记录已保存');
        } else {
            alert('该选手暂无成绩记录');
        }
    }

    refreshReviewDropdowns() {
        const groups = this.storage.getGroups();
        const groupSelector = document.getElementById('review-group-selector');
        
        groupSelector.innerHTML = '<option value="">选择分组</option>' + 
            groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
        
        this.refreshReviewAthletes();
    }

    refreshReviewAthletes() {
        const athletes = this.selectedGroupId 
            ? this.storage.getAthletesByGroup(this.selectedGroupId)
            : [];
        const athleteSelector = document.getElementById('review-athlete-selector');
        
        athleteSelector.innerHTML = '<option value="">选择选手</option>' + 
            athletes.map(a => `<option value="${a.id}">${a.number} - ${a.name}</option>`).join('');
    }

    loadResultForReview() {
        if (!this.selectedAthleteId || !this.currentEvent) {
            alert('请选择选手和项目');
            return;
        }

        const result = this.storage.getResultByAthlete(this.selectedAthleteId, this.currentEvent);
        const athlete = this.storage.getAthleteById(this.selectedAthleteId);

        if (!result) {
            document.getElementById('result-detail').innerHTML = '<p>该选手暂无成绩记录</p>';
            return;
        }

        const scored = this.rulesEngine.calculateEffectiveScore(result, this.currentEvent);
        const validation = this.rulesEngine.validateResult(result, this.currentEvent);

        let html = `
            <div class="result-info">
                <p><strong>选手:</strong> ${athlete?.name || '-'} (${athlete?.number || '-'})</p>
                <p><strong>队伍:</strong> ${athlete?.team || '-'}</p>
                <p><strong>项目:</strong> ${this.rulesEngine.getEventName(result.eventType)}</p>
                <hr>
                <p><strong>有效次数:</strong> ${result.rawCount || 0}</p>
                <p><strong>失误:</strong> ${result.errorCount || 0}</p>
                <p><strong>犯规:</strong> ${result.foulCount || 0}</p>
                <hr>
                <p><strong>最终成绩:</strong> <span class="score-highlight">${scored.score}</span></p>
                <p><strong>状态:</strong> ${result.confirmed ? '已确认' : '待确认'}</p>
                <p><strong>计算说明:</strong> ${scored.message}</p>
        `;

        if (scored.disqualified) {
            html += `<p class="disqualified"><strong>⚠️ 已取消资格</strong></p>`;
        }

        if (validation.warnings.length > 0) {
            html += `<div class="warnings"><strong>⚠️ 警告:</strong><ul>`;
            validation.warnings.forEach(w => {
                html += `<li>${w}</li>`;
            });
            html += `</ul></div>`;
        }

        if (result.exceptionNotes) {
            html += `<hr><p><strong>异常记录:</strong></p><p class="exception-notes">${result.exceptionNotes}</p>`;
        }

        html += `</div>`;

        document.getElementById('result-detail').innerHTML = html;
    }

    confirmResult() {
        if (!this.selectedAthleteId || !this.currentEvent) {
            alert('请选择选手和项目');
            return;
        }

        const result = this.storage.getResultByAthlete(this.selectedAthleteId, this.currentEvent);
        if (!result) {
            alert('该选手暂无成绩记录');
            return;
        }

        const validation = this.rulesEngine.validateResult(result, this.currentEvent);
        
        if (!validation.valid) {
            alert('成绩验证失败:\n' + validation.errors.join('\n'));
            return;
        }

        if (validation.warnings.length > 0) {
            const message = '成绩存在以下警告，是否继续确认？\n\n' + validation.warnings.join('\n');
            if (!confirm(message)) {
                return;
            }
        }

        this.storage.confirmResult(result.id);
        alert('成绩已确认');
        this.loadResultForReview();
        this.refreshGroupResultsTable();
    }

    showModifyResultDialog() {
        if (!this.selectedAthleteId || !this.currentEvent) {
            alert('请选择选手和项目');
            return;
        }

        const result = this.storage.getResultByAthlete(this.selectedAthleteId, this.currentEvent);
        if (!result) {
            alert('该选手暂无成绩记录');
            return;
        }

        const newCount = prompt('有效次数:', result.rawCount || 0);
        if (newCount === null) return;

        const newErrors = prompt('失误次数:', result.errorCount || 0);
        if (newErrors === null) return;

        const newFouls = prompt('犯规次数:', result.foulCount || 0);
        if (newFouls === null) return;

        this.storage.updateResult(result.id, {
            rawCount: parseInt(newCount) || 0,
            errorCount: parseInt(newErrors) || 0,
            foulCount: parseInt(newFouls) || 0,
            confirmed: false,
            status: 'pending'
        });

        alert('成绩已修改，请重新确认');
        this.loadResultForReview();
        this.refreshGroupResultsTable();
    }

    deleteResult() {
        if (!this.selectedAthleteId || !this.currentEvent) {
            alert('请选择选手和项目');
            return;
        }

        const result = this.storage.getResultByAthlete(this.selectedAthleteId, this.currentEvent);
        if (!result) {
            alert('该选手暂无成绩记录');
            return;
        }

        if (confirm('确定要删除该成绩吗？此操作不可恢复。')) {
            this.storage.deleteResult(result.id);
            alert('成绩已删除');
            document.getElementById('result-detail').innerHTML = '<p>成绩已删除</p>';
            this.refreshGroupResultsTable();
        }
    }

    refreshGroupResultsTable() {
        const results = this.selectedGroupId 
            ? this.storage.getResultsByGroup(this.selectedGroupId)
            : [];
        const tbody = document.getElementById('group-results-tbody');

        if (results.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-message">暂无成绩</td></tr>';
            return;
        }

        const statusMap = {
            'pending': '待确认',
            'confirmed': '已确认',
            'disqualified': '已取消资格'
        };

        tbody.innerHTML = results.map(result => {
            const scored = this.rulesEngine.calculateEffectiveScore(result, result.eventType);
            return `
                <tr>
                    <td>${result.athleteNumber || '-'}</td>
                    <td>${result.athleteName || '-'}</td>
                    <td>${result.team || '-'}</td>
                    <td>${result.rawCount || 0}</td>
                    <td>${result.errorCount || 0}</td>
                    <td>${result.foulCount || 0}</td>
                    <td>${scored.score}</td>
                    <td>${statusMap[result.status] || result.status}</td>
                </tr>
            `;
        }).join('');
    }

    refreshResultsDropdowns() {
        const groups = this.storage.getGroups();
        const groupSelector = document.getElementById('results-group-selector');
        
        groupSelector.innerHTML = '<option value="">全部分组</option>' + 
            groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    }

    calculateAndDisplayRankings() {
        const eventSelector = document.getElementById('results-event-selector');
        const groupSelector = document.getElementById('results-group-selector');
        
        const selectedEvent = eventSelector.value;
        const selectedGroup = groupSelector.value;

        let results = this.storage.getResults();

        if (selectedEvent) {
            results = results.filter(r => r.eventType === selectedEvent);
        }

        if (selectedGroup) {
            results = results.filter(r => r.groupId === selectedGroup);
        }

        results = results.filter(r => r.confirmed);

        if (results.length === 0) {
            alert('暂无已确认的成绩数据');
            return;
        }

        let rankings;
        if (selectedEvent) {
            rankings = this.rulesEngine.calculateRankings(results, selectedEvent);
        } else {
            const allRankings = [];
            const events = [...new Set(results.map(r => r.eventType))];
            events.forEach(event => {
                const eventResults = results.filter(r => r.eventType === event);
                const eventRankings = this.rulesEngine.calculateRankings(eventResults, event);
                allRankings.push(...eventRankings);
            });
            rankings = allRankings;
        }

        this.displayIndividualRankings(rankings);

        let teamRankings;
        if (selectedEvent) {
            teamRankings = this.rulesEngine.calculateTeamRankings(results, selectedEvent);
        } else {
            const allTeamRankings = [];
            const events = [...new Set(results.map(r => r.eventType))];
            events.forEach(event => {
                const eventResults = results.filter(r => r.eventType === event);
                const eventTeamRankings = this.rulesEngine.calculateTeamRankings(eventResults, event);
                allTeamRankings.push(...eventTeamRankings);
            });
            teamRankings = allTeamRankings;
        }

        this.displayTeamRankings(teamRankings);
    }

    displayIndividualRankings(rankings) {
        const tbody = document.getElementById('individual-rankings-tbody');

        if (rankings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-message">暂无排名数据</td></tr>';
            return;
        }

        tbody.innerHTML = rankings.map(result => {
            const rank = result.rank === -1 ? 'DQ' : (result.isTie ? `${result.rank}(并列)` : result.rank);
            const eventName = this.rulesEngine.getEventName(result.eventType);
            const remarks = [];
            
            if (result.disqualified) {
                remarks.push('取消资格');
            }
            if (result.isTie) {
                remarks.push('并列');
            }

            return `
                <tr>
                    <td>${rank}</td>
                    <td>${result.athleteNumber || '-'}</td>
                    <td>${result.athleteName || '-'}</td>
                    <td>${result.team || '-'}</td>
                    <td>${eventName}</td>
                    <td>${result.rawCount || 0}</td>
                    <td>${result.score || 0}</td>
                    <td>${remarks.join('; ') || '-'}</td>
                </tr>
            `;
        }).join('');
    }

    displayTeamRankings(teamRankings) {
        const tbody = document.getElementById('team-rankings-tbody');

        if (teamRankings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-message">暂无团队排名数据</td></tr>';
            return;
        }

        tbody.innerHTML = teamRankings.map(team => {
            const rank = team.isTie ? `${team.rank}(并列)` : team.rank;
            const eventName = this.rulesEngine.getEventName(team.event);
            
            return `
                <tr>
                    <td>${rank}</td>
                    <td>${team.team}</td>
                    <td>${eventName}</td>
                    <td>${team.count}</td>
                    <td>${team.totalScore}</td>
                    <td>${team.isTie ? '并列' : '-'}</td>
                </tr>
            `;
        }).join('');
    }

    exportMarkdownReport() {
        const eventSelector = document.getElementById('results-event-selector');
        const selectedEvent = eventSelector.value;

        let results = this.storage.getResults().filter(r => r.confirmed);
        
        if (selectedEvent) {
            results = results.filter(r => r.eventType === selectedEvent);
        }

        if (results.length === 0) {
            alert('暂无已确认的成绩数据');
            return;
        }

        let rankings;
        if (selectedEvent) {
            rankings = this.rulesEngine.calculateRankings(results, selectedEvent);
        } else {
            const allRankings = [];
            const events = [...new Set(results.map(r => r.eventType))];
            events.forEach(event => {
                const eventResults = results.filter(r => r.eventType === event);
                const eventRankings = this.rulesEngine.calculateRankings(eventResults, event);
                allRankings.push(...eventRankings);
            });
            rankings = allRankings;
        }

        let teamRankings;
        if (selectedEvent) {
            teamRankings = this.rulesEngine.calculateTeamRankings(results, selectedEvent);
        } else {
            const allTeamRankings = [];
            const events = [...new Set(results.map(r => r.eventType))];
            events.forEach(event => {
                const eventResults = results.filter(r => r.eventType === event);
                const eventTeamRankings = this.rulesEngine.calculateTeamRankings(eventResults, event);
                allTeamRankings.push(...eventTeamRankings);
            });
            teamRankings = allTeamRankings;
        }

        const report = this.markdownExporter.generateFullReport({
            title: '跳绳比赛成绩单',
            eventType: selectedEvent || null,
            individualRankings: rankings,
            teamRankings: teamRankings,
            groups: this.storage.getGroups(),
            athletes: this.storage.getAthletes(),
            results: results
        });

        this.markdownExporter.exportReport(report);
    }

    refreshAll() {
        this.refreshGroupsList();
        this.refreshAthletesTable();
        this.refreshCompetitionDropdowns();
        this.refreshReviewDropdowns();
        this.refreshResultsDropdowns();
    }
}

export default UIComponents;
