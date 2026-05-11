const SEAT_STATUS = {
    AVAILABLE: 'available',
    OCCUPIED: 'occupied',
    NOISE: 'noise',
    LOCKED: 'locked',
    PENDING: 'pending'
};

const ROOM_CONFIG = {
    room1: {
        name: '自习室 A',
        totalSeats: 30,
        rows: 5,
        cols: 6
    },
    room2: {
        name: '自习室 B',
        totalSeats: 20,
        rows: 4,
        cols: 5
    }
};

const STORAGE_KEY = 'study_room_patrol_data';

class StudyRoomPatrolSystem {
    constructor() {
        this.currentRoom = 'room1';
        this.currentMode = 'view';
        this.lockDuration = 30;
        this.selectedSeat = null;
        this.seats = {};
        this.history = [];
        this.pendingItems = [];
        this.timerInterval = null;
        
        this.init();
    }

    init() {
        this.loadFromStorage();
        this.initSeats();
        this.bindEvents();
        this.render();
        this.startTimer();
    }

    initSeats() {
        const config = ROOM_CONFIG[this.currentRoom];
        for (let i = 1; i <= config.totalSeats; i++) {
            const seatId = `${this.currentRoom}-${i}`;
            if (!this.seats[seatId]) {
                this.seats[seatId] = {
                    id: seatId,
                    room: this.currentRoom,
                    number: i,
                    status: SEAT_STATUS.AVAILABLE,
                    hasNoise: false,
                    noiseNote: '',
                    isLocked: false,
                    lockEndTime: null,
                    lastUpdated: new Date().toISOString(),
                    pendingReview: false
                };
            }
        }
    }

    loadFromStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                this.seats = data.seats || {};
                this.history = data.history || [];
                this.pendingItems = data.pendingItems || [];
                this.currentRoom = data.currentRoom || 'room1';
                this.showMessage('已恢复上次的巡检工作区', 'info');
            }
        } catch (e) {
            console.error('加载本地数据失败:', e);
        }
    }

    saveToStorage() {
        try {
            const data = {
                seats: this.seats,
                history: this.history,
                pendingItems: this.pendingItems,
                currentRoom: this.currentRoom
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('保存数据失败:', e);
        }
    }

    bindEvents() {
        document.getElementById('loadSampleSmooth').addEventListener('click', () => this.loadSampleData('smooth'));
        document.getElementById('loadSampleWarning').addEventListener('click', () => this.loadSampleData('warning'));
        document.getElementById('resetAll').addEventListener('click', () => this.showResetConfirm());

        document.getElementById('roomSelector').addEventListener('change', (e) => this.switchRoom(e.target.value));
        document.getElementById('roomSelector').value = this.currentRoom;

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.setMode(e.target.dataset.mode));
        });

        document.querySelectorAll('.duration-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.setLockDuration(parseInt(e.target.dataset.minutes)));
        });

        document.getElementById('exportCSV').addEventListener('click', () => this.exportCSV());
        document.getElementById('exportSummary').addEventListener('click', () => this.exportSummary());

        document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
        document.getElementById('modalCancel').addEventListener('click', () => this.closeModal());
        document.getElementById('modalConfirm').addEventListener('click', () => this.handleModalConfirm());
    }

    switchRoom(room) {
        this.currentRoom = room;
        this.initSeats();
        this.selectedSeat = null;
        this.render();
        this.saveToStorage();
    }

    setMode(mode) {
        this.currentMode = mode;
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
        document.getElementById('lockPanel').classList.toggle('hidden', mode !== 'lock');
        document.getElementById('noisePanel').classList.toggle('hidden', mode !== 'noise');
    }

    setLockDuration(minutes) {
        this.lockDuration = minutes;
        document.querySelectorAll('.duration-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.minutes) === minutes);
        });
    }

    render() {
        this.renderSeatMap();
        this.renderStats();
        this.renderSeatDetails();
        this.renderPendingList();
        this.renderLockTimers();
        this.renderHistory();
    }

    renderSeatMap() {
        const config = ROOM_CONFIG[this.currentRoom];
        const seatMap = document.getElementById('seatMap');
        seatMap.innerHTML = '';

        const grid = document.createElement('div');
        grid.className = 'seat-grid';

        let seatNum = 1;
        for (let row = 0; row < config.rows; row++) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'seat-row';

            for (let col = 0; col < config.cols; col++) {
                const seatId = `${this.currentRoom}-${seatNum}`;
                const seat = this.seats[seatId];

                if (seat) {
                    const seatDiv = this.createSeatElement(seat);
                    rowDiv.appendChild(seatDiv);
                }
                seatNum++;
            }

            grid.appendChild(rowDiv);
        }

        seatMap.appendChild(grid);
    }

    createSeatElement(seat) {
        const div = document.createElement('div');
        div.className = 'seat';
        div.dataset.seatId = seat.id;

        let statusClass = `status-${seat.status}`;
        if (seat.pendingReview) {
            statusClass = 'status-pending';
        }
        div.classList.add(statusClass);

        if (seat.hasNoise) div.classList.add('has-noise');
        if (seat.isLocked) div.classList.add('is-locked');
        if (this.selectedSeat === seat.id) div.classList.add('selected');

        div.innerHTML = `<span>${seat.number}</span>`;

        if (seat.isLocked && seat.lockEndTime) {
            const remaining = this.getRemainingTime(seat.lockEndTime);
            if (remaining > 0) {
                const countdown = document.createElement('span');
                countdown.className = 'seat-countdown';
                countdown.textContent = this.formatTime(remaining);
                div.appendChild(countdown);
            }
        }

        div.addEventListener('click', () => this.handleSeatClick(seat.id));
        return div;
    }

    handleSeatClick(seatId) {
        const seat = this.seats[seatId];
        if (!seat) return;

        this.selectedSeat = seatId;

        if (this.currentMode === 'view') {
            this.render();
            return;
        }

        this.executeModeAction(seatId);
    }

    executeModeAction(seatId) {
        const seat = this.seats[seatId];

        switch (this.currentMode) {
            case 'occupy':
                this.markOccupied(seatId);
                break;
            case 'free':
                this.markFree(seatId);
                break;
            case 'noise':
                this.reportNoise(seatId);
                break;
            case 'lock':
                this.lockSeat(seatId);
                break;
        }
    }

    markOccupied(seatId) {
        const seat = this.seats[seatId];

        if (seat.isLocked) {
            this.showMessage(`座位 ${seat.number} 已被临时锁座，无法标记为占用`, 'error');
            this.addHistory(seatId, '尝试标记占用被拦截：座位已锁座', 'error');
            return;
        }

        if (seat.status === SEAT_STATUS.OCCUPIED && !seat.pendingReview) {
            this.showMessage(`座位 ${seat.number} 已处于占用状态`, 'warning');
            return;
        }

        const previousStatus = seat.status;
        seat.status = SEAT_STATUS.OCCUPIED;
        seat.lastUpdated = new Date().toISOString();

        this.showMessage(`座位 ${seat.number} 已标记为占用`, 'success');
        this.addHistory(seatId, `标记为占用（原状态：${this.getStatusText(previousStatus)}）`, 'success');

        this.render();
        this.saveToStorage();
    }

    markFree(seatId) {
        const seat = this.seats[seatId];

        if (seat.isLocked) {
            this.showMessage(`座位 ${seat.number} 已被临时锁座，请先解锁`, 'warning');
            this.showUnlockConfirm(seatId, 'markFree');
            return;
        }

        if (seat.status === SEAT_STATUS.AVAILABLE && !seat.hasNoise && !seat.pendingReview) {
            this.showMessage(`座位 ${seat.number} 已处于空闲状态`, 'warning');
            return;
        }

        const previousStatus = seat.status;
        const hadNoise = seat.hasNoise;
        const wasPending = seat.pendingReview;

        seat.status = SEAT_STATUS.AVAILABLE;
        seat.hasNoise = false;
        seat.noiseNote = '';
        seat.pendingReview = false;
        seat.lastUpdated = new Date().toISOString();

        this.removePendingItem(seatId);

        let msg = `座位 ${seat.number} 已标记为空闲`;
        if (hadNoise) msg += '（噪音投诉已清除）';
        if (wasPending) msg += '（待复核已解除）';

        this.showMessage(msg, 'success');
        this.addHistory(seatId, `标记为空闲（原状态：${this.getStatusText(previousStatus)}）`, 'success');

        this.render();
        this.saveToStorage();
    }

    reportNoise(seatId) {
        const seat = this.seats[seatId];
        const noiseNote = document.getElementById('noiseNote').value.trim();

        if (!noiseNote) {
            this.showMessage('请输入噪音投诉详情', 'warning');
            document.getElementById('noiseNote').focus();
            return;
        }

        if (seat.isLocked) {
            this.showMessage(`座位 ${seat.number} 已被临时锁座`, 'info');
        }

        if (seat.hasNoise && seat.noiseNote === noiseNote && !seat.pendingReview) {
            this.showMessage(`座位 ${seat.number} 已有相同的噪音投诉记录`, 'warning');
            return;
        }

        if (seat.status === SEAT_STATUS.AVAILABLE) {
            this.showMessage(`警告：座位 ${seat.number} 为空位，但记录了噪音投诉，已标记为待复核`, 'warning');
            this.addHistory(seatId, '空位噪音投诉，已标记待复核', 'warning');
            seat.pendingReview = true;
            this.addPendingItem(seatId, 'noise', `空位噪音投诉：${noiseNote}`);
        }

        seat.hasNoise = true;
        seat.noiseNote = noiseNote;
        seat.status = SEAT_STATUS.NOISE;
        seat.lastUpdated = new Date().toISOString();

        document.getElementById('noiseNote').value = '';

        this.showMessage(`座位 ${seat.number} 噪音投诉已记录`, 'success');
        if (!seat.pendingReview) {
            this.addHistory(seatId, `噪音投诉：${noiseNote}`, 'success');
        }

        this.render();
        this.saveToStorage();
    }

    lockSeat(seatId) {
        const seat = this.seats[seatId];

        if (seat.status === SEAT_STATUS.OCCUPIED) {
            this.showMessage(`座位 ${seat.number} 已被占用，无法锁座`, 'error');
            this.addHistory(seatId, '尝试锁座被拦截：座位已占用', 'error');
            return;
        }

        if (seat.isLocked) {
            this.showMessage(`座位 ${seat.number} 已被临时锁座，时长：${this.lockDuration}分钟`, 'info');
            this.extendLockConfirm(seatId);
            return;
        }

        seat.isLocked = true;
        seat.lockEndTime = Date.now() + this.lockDuration * 60 * 1000;
        seat.status = SEAT_STATUS.LOCKED;
        seat.lastUpdated = new Date().toISOString();

        this.showMessage(`座位 ${seat.number} 已临时锁座 ${this.lockDuration} 分钟`, 'success');
        this.addHistory(seatId, `临时锁座 ${this.lockDuration} 分钟`, 'success');

        this.render();
        this.saveToStorage();
    }

    unlockSeat(seatId) {
        const seat = this.seats[seatId];
        seat.isLocked = false;
        seat.lockEndTime = null;
        seat.status = SEAT_STATUS.AVAILABLE;
        seat.lastUpdated = new Date().toISOString();

        this.showMessage(`座位 ${seat.number} 已解锁`, 'success');
        this.addHistory(seatId, '解锁座位', 'success');

        this.render();
        this.saveToStorage();
    }

    resolvePending(seatId, action) {
        const seat = this.seats[seatId];

        if (action === 'resolve') {
            seat.pendingReview = false;
            if (seat.hasNoise) {
                seat.status = SEAT_STATUS.NOISE;
            }
            this.removePendingItem(seatId);
            this.showMessage(`座位 ${seat.number} 待复核已解除`, 'success');
            this.addHistory(seatId, '待复核已解除', 'success');
        } else if (action === 'dismiss') {
            seat.pendingReview = false;
            seat.hasNoise = false;
            seat.noiseNote = '';
            seat.status = SEAT_STATUS.AVAILABLE;
            this.removePendingItem(seatId);
            this.showMessage(`座位 ${seat.number} 投诉已驳回`, 'info');
            this.addHistory(seatId, '投诉驳回，恢复空闲', 'info');
        }

        this.render();
        this.saveToStorage();
    }

    getStatusText(status) {
        const texts = {
            [SEAT_STATUS.AVAILABLE]: '空闲',
            [SEAT_STATUS.OCCUPIED]: '占用',
            [SEAT_STATUS.NOISE]: '噪音',
            [SEAT_STATUS.LOCKED]: '锁座',
            [SEAT_STATUS.PENDING]: '待复核'
        };
        return texts[status] || status;
    }

    addHistory(seatId, action, type = 'info') {
        const seat = this.seats[seatId];
        this.history.unshift({
            id: Date.now(),
            seatId: seatId,
            seatNumber: seat ? seat.number : '未知',
            room: this.currentRoom,
            action: action,
            type: type,
            time: new Date().toISOString()
        });

        if (this.history.length > 50) {
            this.history = this.history.slice(0, 50);
        }
    }

    addPendingItem(seatId, type, description) {
        this.removePendingItem(seatId);
        this.pendingItems.push({
            id: Date.now(),
            seatId: seatId,
            type: type,
            description: description,
            time: new Date().toISOString()
        });
    }

    removePendingItem(seatId) {
        this.pendingItems = this.pendingItems.filter(item => item.seatId !== seatId);
    }

    renderStats() {
        const config = ROOM_CONFIG[this.currentRoom];
        const roomSeats = Object.values(this.seats).filter(s => s.room === this.currentRoom);

        const stats = {
            total: config.totalSeats,
            occupied: roomSeats.filter(s => s.status === SEAT_STATUS.OCCUPIED).length,
            available: roomSeats.filter(s => s.status === SEAT_STATUS.AVAILABLE).length,
            noise: roomSeats.filter(s => s.hasNoise).length,
            locked: roomSeats.filter(s => s.isLocked).length,
            pending: roomSeats.filter(s => s.pendingReview).length
        };

        document.getElementById('statTotal').textContent = stats.total;
        document.getElementById('statOccupied').textContent = stats.occupied;
        document.getElementById('statAvailable').textContent = stats.available;
        document.getElementById('statNoise').textContent = stats.noise;
        document.getElementById('statLocked').textContent = stats.locked;
        document.getElementById('statPending').textContent = stats.pending;
    }

    renderSeatDetails() {
        const detailsDiv = document.getElementById('seatDetails');
        
        if (!this.selectedSeat) {
            detailsDiv.innerHTML = '<p class="placeholder">点击座位查看详情</p>';
            return;
        }

        const seat = this.seats[this.selectedSeat];
        if (!seat) {
            detailsDiv.innerHTML = '<p class="placeholder">座位信息不存在</p>';
            return;
        }

        let statusText = this.getStatusText(seat.status);
        if (seat.pendingReview) statusText = '待复核';

        let html = `
            <div class="seat-detail-item">
                <span class="label">座位编号</span>
                <span class="value">${ROOM_CONFIG[seat.room].name} - ${seat.number}</span>
            </div>
            <div class="seat-detail-item">
                <span class="label">当前状态</span>
                <span class="value">${statusText}</span>
            </div>
            <div class="seat-detail-item">
                <span class="label">噪音投诉</span>
                <span class="value">${seat.hasNoise ? '有' : '无'}</span>
            </div>
        `;

        if (seat.hasNoise && seat.noiseNote) {
            html += `
                <div class="seat-detail-item">
                    <span class="label">投诉详情</span>
                    <span class="value" style="max-width: 150px; word-break: break-all;">${seat.noiseNote}</span>
                </div>
            `;
        }

        html += `
            <div class="seat-detail-item">
                <span class="label">临时锁座</span>
                <span class="value">${seat.isLocked ? '是' : '否'}</span>
            </div>
        `;

        if (seat.isLocked && seat.lockEndTime) {
            const remaining = this.getRemainingTime(seat.lockEndTime);
            html += `
                <div class="seat-detail-item">
                    <span class="label">剩余时间</span>
                    <span class="value">${this.formatTime(remaining)}</span>
                </div>
            `;
        }

        html += `
            <div class="seat-detail-item">
                <span class="label">最后更新</span>
                <span class="value">${this.formatDateTime(seat.lastUpdated)}</span>
            </div>
        `;

        html += '<div class="detail-actions">';
        if (seat.status !== SEAT_STATUS.OCCUPIED && !seat.isLocked) {
            html += `<button class="btn btn-primary" onclick="app.quickAction('${seat.id}', 'occupy')">标记占用</button>`;
        }
        if (seat.status !== SEAT_STATUS.AVAILABLE) {
            html += `<button class="btn btn-success" onclick="app.quickAction('${seat.id}', 'free')">标记空闲</button>`;
        }
        if (!seat.isLocked && seat.status !== SEAT_STATUS.OCCUPIED) {
            html += `<button class="btn btn-secondary" onclick="app.quickAction('${seat.id}', 'lock')">临时锁座</button>`;
        }
        if (seat.isLocked) {
            html += `<button class="btn btn-danger" onclick="app.quickAction('${seat.id}', 'unlock')">解锁</button>`;
        }
        if (seat.pendingReview) {
            html += `<button class="btn btn-warning" onclick="app.quickAction('${seat.id}', 'resolve')">解除复核</button>`;
        }
        html += '</div>';

        detailsDiv.innerHTML = html;
    }

    quickAction(seatId, action) {
        this.selectedSeat = seatId;
        switch (action) {
            case 'occupy':
                this.markOccupied(seatId);
                break;
            case 'free':
                this.markFree(seatId);
                break;
            case 'lock':
                this.lockSeat(seatId);
                break;
            case 'unlock':
                this.unlockSeat(seatId);
                break;
            case 'resolve':
                this.resolvePending(seatId, 'resolve');
                break;
        }
    }

    renderPendingList() {
        const listDiv = document.getElementById('pendingList');
        const roomPending = this.pendingItems.filter(item => {
            const seat = this.seats[item.seatId];
            return seat && seat.room === this.currentRoom;
        });

        if (roomPending.length === 0) {
            listDiv.innerHTML = '<p class="placeholder">暂无待复核事项</p>';
            return;
        }

        let html = '';
        roomPending.forEach(item => {
            const seat = this.seats[item.seatId];
            const typeText = item.type === 'noise' ? '噪音投诉' : item.type;
            html += `
                <div class="pending-item">
                    <div class="seat-id">座位 ${seat.number}</div>
                    <div class="type">${typeText}</div>
                    <div>${item.description}</div>
                    <div class="actions">
                        <button class="btn btn-success" onclick="app.resolvePending('${item.seatId}', 'resolve')">确认</button>
                        <button class="btn btn-secondary" onclick="app.resolvePending('${item.seatId}', 'dismiss')">驳回</button>
                    </div>
                </div>
            `;
        });

        listDiv.innerHTML = html;
    }

    renderLockTimers() {
        const listDiv = document.getElementById('lockTimers');
        const roomLocks = Object.values(this.seats).filter(s => 
            s.room === this.currentRoom && s.isLocked && s.lockEndTime
        );

        if (roomLocks.length === 0) {
            listDiv.innerHTML = '<p class="placeholder">暂无临时锁座</p>';
            return;
        }

        let html = '';
        roomLocks.forEach(seat => {
            const remaining = this.getRemainingTime(seat.lockEndTime);
            html += `
                <div class="lock-item">
                    <div class="seat-id">座位 ${seat.number}</div>
                    <div class="countdown">${this.formatTime(remaining)}</div>
                    <div class="actions">
                        <button class="btn btn-danger" onclick="app.unlockSeat('${seat.id}')">提前解锁</button>
                    </div>
                </div>
            `;
        });

        listDiv.innerHTML = html;
    }

    renderHistory() {
        const listDiv = document.getElementById('historyList');
        const roomHistory = this.history.filter(h => h.room === this.currentRoom).slice(0, 10);

        if (roomHistory.length === 0) {
            listDiv.innerHTML = '<p class="placeholder">暂无操作记录</p>';
            return;
        }

        let html = '';
        roomHistory.forEach(item => {
            html += `
                <div class="history-item">
                    <div class="time">${this.formatDateTime(item.time)}</div>
                    <div class="action ${item.type}">座位 ${item.seatNumber}: ${item.action}</div>
                </div>
            `;
        });

        listDiv.innerHTML = html;
    }

    getRemainingTime(endTime) {
        return Math.max(0, endTime - Date.now());
    }

    formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    formatDateTime(isoString) {
        if (!isoString) return '-';
        const date = new Date(isoString);
        return date.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            this.checkExpiredLocks();
            this.renderLockTimers();
            this.renderSeatMap();
            if (this.selectedSeat) {
                this.renderSeatDetails();
            }
        }, 1000);
    }

    checkExpiredLocks() {
        Object.values(this.seats).forEach(seat => {
            if (seat.isLocked && seat.lockEndTime) {
                const remaining = this.getRemainingTime(seat.lockEndTime);
                if (remaining <= 0) {
                    this.unlockSeat(seat.id);
                    this.showMessage(`座位 ${seat.number} 锁座时间已到，自动解锁`, 'info');
                }
            }
        });
    }

    showMessage(text, type = 'info') {
        const messageArea = document.getElementById('messageArea');
        messageArea.textContent = text;
        messageArea.className = `message-area ${type}`;
        messageArea.classList.remove('hidden');

        setTimeout(() => {
            messageArea.classList.add('hidden');
        }, 4000);
    }

    showModal(title, body, confirmText = '确认', cancelText = '取消') {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = body;
        document.getElementById('modalConfirm').textContent = confirmText;
        document.getElementById('modalCancel').textContent = cancelText;
        document.getElementById('modal').classList.remove('hidden');
        this.pendingModalAction = null;
    }

    closeModal() {
        document.getElementById('modal').classList.add('hidden');
        this.pendingModalAction = null;
    }

    handleModalConfirm() {
        if (this.pendingModalAction) {
            this.pendingModalAction();
        }
        this.closeModal();
    }

    showResetConfirm() {
        this.showModal(
            '确认重置',
            '<p>此操作将清除所有巡检数据，包括座位状态、噪音投诉和锁座记录。</p><p class="error-highlight">此操作不可撤销！</p>',
            '确认重置',
            '取消'
        );
        this.pendingModalAction = () => this.resetAll();
    }

    showUnlockConfirm(seatId, nextAction) {
        const seat = this.seats[seatId];
        this.showModal(
            '解锁座位',
            `<p>座位 <span class="highlight">${seat.number}</span> 已被临时锁座。</p><p>是否先解锁再执行操作？</p>`,
            '解锁并继续',
            '取消'
        );
        this.pendingModalAction = () => {
            this.unlockSeat(seatId);
            if (nextAction === 'markFree') {
                this.markFree(seatId);
            }
        };
    }

    extendLockConfirm(seatId) {
        const seat = this.seats[seatId];
        const remaining = this.getRemainingTime(seat.lockEndTime);
        this.showModal(
            '延长锁座时间',
            `<p>座位 <span class="highlight">${seat.number}</span> 剩余锁座时间：<span class="highlight">${this.formatTime(remaining)}</span></p><p>是否延长 <span class="highlight">${this.lockDuration}</span> 分钟？</p>`,
            '延长锁座',
            '取消'
        );
        this.pendingModalAction = () => this.extendLock(seatId);
    }

    extendLock(seatId) {
        const seat = this.seats[seatId];
        seat.lockEndTime = Date.now() + this.lockDuration * 60 * 1000;
        seat.lastUpdated = new Date().toISOString();
        this.showMessage(`座位 ${seat.number} 锁座时间已延长 ${this.lockDuration} 分钟`, 'success');
        this.addHistory(seatId, `延长锁座 ${this.lockDuration} 分钟`, 'success');
        this.render();
        this.saveToStorage();
    }

    resetAll() {
        this.seats = {};
        this.history = [];
        this.pendingItems = [];
        this.selectedSeat = null;
        this.initSeats();
        this.render();
        this.saveToStorage();
        this.showMessage('所有数据已重置', 'success');
    }

    loadSampleData(type) {
        this.resetAll();

        const config = ROOM_CONFIG[this.currentRoom];
        const totalSeats = config.totalSeats;

        if (type === 'smooth') {
            this.loadSmoothSample(totalSeats);
        } else {
            this.loadWarningSample(totalSeats);
        }

        this.render();
        this.saveToStorage();
        this.showMessage(type === 'smooth' ? '顺利样例数据已加载' : '待复核样例数据已加载', 'success');
    }

    loadSmoothSample(totalSeats) {
        const occupiedSeats = [1, 3, 5, 7, 10, 12, 15, 18, 20, 22];
        const noiseSeats = [{ seat: 12, note: '大声讨论问题' }, { seat: 20, note: '频繁打电话' }];
        const lockedSeats = [{ seat: 8, minutes: 30 }, { seat: 25, minutes: 60 }];

        occupiedSeats.forEach(num => {
            if (num <= totalSeats) {
                const seatId = `${this.currentRoom}-${num}`;
                this.seats[seatId].status = SEAT_STATUS.OCCUPIED;
                this.seats[seatId].lastUpdated = new Date(Date.now() - Math.random() * 3600000).toISOString();
                this.addHistory(seatId, '标记为占用', 'success');
            }
        });

        noiseSeats.forEach(({ seat: num, note }) => {
            if (num <= totalSeats) {
                const seatId = `${this.currentRoom}-${num}`;
                this.seats[seatId].hasNoise = true;
                this.seats[seatId].noiseNote = note;
                this.seats[seatId].status = SEAT_STATUS.NOISE;
                this.addHistory(seatId, `噪音投诉：${note}`, 'success');
            }
        });

        lockedSeats.forEach(({ seat: num, minutes }) => {
            if (num <= totalSeats) {
                const seatId = `${this.currentRoom}-${num}`;
                this.seats[seatId].isLocked = true;
                this.seats[seatId].lockEndTime = Date.now() + minutes * 60 * 1000;
                this.seats[seatId].status = SEAT_STATUS.LOCKED;
                this.addHistory(seatId, `临时锁座 ${minutes} 分钟`, 'success');
            }
        });
    }

    loadWarningSample(totalSeats) {
        const occupiedSeats = [2, 4, 6, 9, 11, 14, 17, 19, 21, 23, 26];
        const noiseSeats = [
            { seat: 5, note: '空位噪音投诉（误报检测）', isEmpty: true },
            { seat: 9, note: '持续敲击键盘声' },
            { seat: 17, note: '吃东西声音过大' }
        ];
        const lockedSeats = [{ seat: 3, minutes: 15 }];
        const conflicts = [
            { type: 'occupied_locked', seat: 28, note: '尝试标记已锁座为占用' },
            { type: 'empty_noise', seat: 5, note: '空位噪音投诉待复核' }
        ];

        occupiedSeats.forEach(num => {
            if (num <= totalSeats) {
                const seatId = `${this.currentRoom}-${num}`;
                this.seats[seatId].status = SEAT_STATUS.OCCUPIED;
                this.seats[seatId].lastUpdated = new Date(Date.now() - Math.random() * 3600000).toISOString();
                this.addHistory(seatId, '标记为占用', 'success');
            }
        });

        noiseSeats.forEach(({ seat: num, note, isEmpty }) => {
            if (num <= totalSeats) {
                const seatId = `${this.currentRoom}-${num}`;
                this.seats[seatId].hasNoise = true;
                this.seats[seatId].noiseNote = note;
                this.seats[seatId].status = SEAT_STATUS.NOISE;
                if (isEmpty) {
                    this.seats[seatId].pendingReview = true;
                    this.seats[seatId].status = SEAT_STATUS.AVAILABLE;
                    this.addPendingItem(seatId, 'noise', note);
                    this.addHistory(seatId, '空位噪音投诉，已标记待复核', 'warning');
                } else {
                    this.addHistory(seatId, `噪音投诉：${note}`, 'success');
                }
            }
        });

        lockedSeats.forEach(({ seat: num, minutes }) => {
            if (num <= totalSeats) {
                const seatId = `${this.currentRoom}-${num}`;
                this.seats[seatId].isLocked = true;
                this.seats[seatId].lockEndTime = Date.now() + minutes * 60 * 1000;
                this.seats[seatId].status = SEAT_STATUS.LOCKED;
                this.addHistory(seatId, `临时锁座 ${minutes} 分钟`, 'success');
            }
        });

        conflicts.forEach(c => {
            if (c.seat <= totalSeats) {
                const seatId = `${this.currentRoom}-${c.seat}`;
                if (c.type === 'occupied_locked') {
                    this.seats[seatId].isLocked = true;
                    this.seats[seatId].lockEndTime = Date.now() + 45 * 60 * 1000;
                    this.seats[seatId].status = SEAT_STATUS.LOCKED;
                    this.addHistory(seatId, '尝试标记占用被拦截：座位已锁座', 'error');
                }
            }
        });
    }

    exportCSV() {
        const config = ROOM_CONFIG[this.currentRoom];
        const roomSeats = Object.values(this.seats).filter(s => s.room === this.currentRoom);

        let csv = '\uFEFF';
        csv += '座位号,状态,噪音投诉,锁座状态,锁座剩余时间,待复核,最后更新时间,投诉详情\n';

        roomSeats.sort((a, b) => a.number - b.number).forEach(seat => {
            let status = this.getStatusText(seat.status);
            if (seat.pendingReview) status = '待复核';

            const lockRemaining = seat.isLocked && seat.lockEndTime 
                ? this.formatTime(this.getRemainingTime(seat.lockEndTime)) 
                : '-';

            const line = [
                seat.number,
                status,
                seat.hasNoise ? '是' : '否',
                seat.isLocked ? '是' : '否',
                lockRemaining,
                seat.pendingReview ? '是' : '否',
                this.formatDateTime(seat.lastUpdated),
                `"${(seat.noiseNote || '').replace(/"/g, '""')}"`
            ].join(',');

            csv += line + '\n';
        });

        this.downloadFile(csv, `巡检记录_${config.name}_${this.getDateStr()}.csv`, 'text/csv;charset=utf-8');
        this.showMessage('巡检记录已导出', 'success');
        this.addHistory('export', '导出巡检记录CSV', 'success');
    }

    exportSummary() {
        const config = ROOM_CONFIG[this.currentRoom];
        const roomSeats = Object.values(this.seats).filter(s => s.room === this.currentRoom);

        const stats = {
            total: config.totalSeats,
            occupied: roomSeats.filter(s => s.status === SEAT_STATUS.OCCUPIED).length,
            available: roomSeats.filter(s => s.status === SEAT_STATUS.AVAILABLE).length,
            noise: roomSeats.filter(s => s.hasNoise).length,
            locked: roomSeats.filter(s => s.isLocked).length,
            pending: roomSeats.filter(s => s.pendingReview).length
        };

        let summary = `自习室座位静音巡检统计摘要\n`;
        summary += `================================\n\n`;
        summary += `自习室：${config.name}\n`;
        summary += `导出时间：${new Date().toLocaleString('zh-CN')}\n\n`;
        summary += `【座位状态统计】\n`;
        summary += `  总座位数：${stats.total}\n`;
        summary += `  已占用：${stats.occupied} (${((stats.occupied/stats.total)*100).toFixed(1)}%)\n`;
        summary += `  空闲：${stats.available} (${((stats.available/stats.total)*100).toFixed(1)}%)\n\n`;
        summary += `【巡检事件统计】\n`;
        summary += `  噪音投诉：${stats.noise}\n`;
        summary += `  临时锁座：${stats.locked}\n`;
        summary += `  待复核事项：${stats.pending}\n\n`;

        if (this.pendingItems.length > 0) {
            summary += `【待复核事项列表】\n`;
            this.pendingItems.forEach(item => {
                const seat = this.seats[item.seatId];
                if (seat && seat.room === this.currentRoom) {
                    summary += `  - 座位 ${seat.number}: ${item.description}\n`;
                }
            });
            summary += `\n`;
        }

        if (this.history.length > 0) {
            summary += `【最近操作记录】\n`;
            this.history.filter(h => h.room === this.currentRoom).slice(0, 10).forEach(item => {
                summary += `  [${this.formatDateTime(item.time)}] 座位 ${item.seatNumber}: ${item.action}\n`;
            });
        }

        this.downloadFile(summary, `巡检摘要_${config.name}_${this.getDateStr()}.txt`, 'text/plain;charset=utf-8');
        this.showMessage('统计摘要已导出', 'success');
        this.addHistory('export', '导出统计摘要', 'success');
    }

    getDateStr() {
        const now = new Date();
        return `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`;
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
}

const app = new StudyRoomPatrolSystem();
