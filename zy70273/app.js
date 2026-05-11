const STATUS = {
    PLANNED: 'planned',
    CHECKING: 'checking',
    OPEN: 'open',
    CLOSED: 'closed',
    COMPLETED: 'completed'
};

const STATUS_TEXT = {
    [STATUS.PLANNED]: '计划中',
    [STATUS.CHECKING]: '核对中',
    [STATUS.OPEN]: '已开放',
    [STATUS.CLOSED]: '临时闭馆',
    [STATUS.COMPLETED]: '已结束'
};

const CLOSED_REASONS = [
    '天气原因（暴雨/雷电）',
    '水质问题',
    '设备故障',
    '救生员不足',
    '临时活动占用',
    '疫情防控',
    '其他原因'
];

const TIME_SLOTS = [
    { start: '08:00', end: '10:00', name: '早场' },
    { start: '10:00', end: '12:00', name: '上午场' },
    { start: '14:00', end: '16:00', name: '下午场' },
    { start: '16:00', end: '18:00', name: '傍晚场' },
    { start: '18:00', end: '21:00', name: '晚场' }
];

const STORAGE_KEYS = {
    OPEN_DAYS: 'pool_open_days',
    LIFEGUARDS: 'pool_lifeguards',
    SCHEDULES: 'pool_schedules',
    DISINFECTIONS: 'pool_disinfections',
    ABNORMAL_RECORDS: 'pool_abnormal_records'
};

class PoolManagementSystem {
    constructor() {
        this.init();
    }

    init() {
        this.initStorage();
        this.bindEvents();
        this.renderAll();
        this.initHelpContent();
    }

    initStorage() {
        if (!localStorage.getItem(STORAGE_KEYS.OPEN_DAYS)) {
            localStorage.setItem(STORAGE_KEYS.OPEN_DAYS, JSON.stringify([]));
        }
        if (!localStorage.getItem(STORAGE_KEYS.LIFEGUARDS)) {
            localStorage.setItem(STORAGE_KEYS.LIFEGUARDS, JSON.stringify([]));
        }
        if (!localStorage.getItem(STORAGE_KEYS.SCHEDULES)) {
            localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify([]));
        }
        if (!localStorage.getItem(STORAGE_KEYS.DISINFECTIONS)) {
            localStorage.setItem(STORAGE_KEYS.DISINFECTIONS, JSON.stringify([]));
        }
        if (!localStorage.getItem(STORAGE_KEYS.ABNORMAL_RECORDS)) {
            localStorage.setItem(STORAGE_KEYS.ABNORMAL_RECORDS, JSON.stringify([]));
        }
    }

    getOpenDays() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.OPEN_DAYS) || '[]');
    }

    saveOpenDays(days) {
        localStorage.setItem(STORAGE_KEYS.OPEN_DAYS, JSON.stringify(days));
    }

    getLifeguards() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.LIFEGUARDS) || '[]');
    }

    saveLifeguards(lifeguards) {
        localStorage.setItem(STORAGE_KEYS.LIFEGUARDS, JSON.stringify(lifeguards));
    }

    getSchedules() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULES) || '[]');
    }

    saveSchedules(schedules) {
        localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(schedules));
    }

    getDisinfections() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.DISINFECTIONS) || '[]');
    }

    saveDisinfections(disinfections) {
        localStorage.setItem(STORAGE_KEYS.DISINFECTIONS, JSON.stringify(disinfections));
    }

    getAbnormalRecords() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.ABNORMAL_RECORDS) || '[]');
    }

    saveAbnormalRecords(records) {
        localStorage.setItem(STORAGE_KEYS.ABNORMAL_RECORDS, JSON.stringify(records));
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
    }

    formatDateTime(dateTimeStr) {
        const date = new Date(dateTimeStr);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    bindEvents() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        document.getElementById('btn-create-day').addEventListener('click', () => this.openCreateDayModal());
        document.getElementById('btn-batch-create').addEventListener('click', () => this.openBatchCreateModal());
        document.getElementById('btn-filter').addEventListener('click', () => this.renderOpenDays());
        document.getElementById('btn-reset-filter').addEventListener('click', () => this.resetFilters());

        document.getElementById('btn-create-lifeguard').addEventListener('click', () => this.openCreateLifeguardModal());
        document.getElementById('btn-import-lifeguards').addEventListener('click', () => this.openImportLifeguardsModal());
        document.getElementById('btn-load-schedule').addEventListener('click', () => this.renderSchedule());

        document.getElementById('btn-create-disinfection').addEventListener('click', () => this.openCreateDisinfectionModal());
        document.getElementById('btn-filter-disinfection').addEventListener('click', () => this.renderDisinfections());

        document.getElementById('btn-generate-abnormal').addEventListener('click', () => this.generateAbnormalData());
        document.getElementById('btn-check-abnormal').addEventListener('click', () => this.checkAbnormalData());
        document.querySelectorAll('.abnormal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchAbnormalType(e.target.dataset.type));
        });

        document.getElementById('btn-import').addEventListener('click', () => this.openImportModal());
        document.getElementById('btn-export').addEventListener('click', () => this.exportData());
        document.getElementById('btn-clear').addEventListener('click', () => this.clearAllData());
        document.getElementById('btn-help').addEventListener('click', () => this.openHelpModal());

        document.querySelector('.close-modal').addEventListener('click', () => {
            document.getElementById('help-modal').classList.add('hidden');
        });

        document.getElementById('help-modal').addEventListener('click', (e) => {
            if (e.target.id === 'help-modal') {
                e.currentTarget.classList.add('hidden');
            }
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`tab-${tabName}`).classList.add('active');

        if (tabName === 'statistics') {
            this.renderStatistics();
        } else if (tabName === 'abnormal') {
            this.renderAbnormalList();
        }
    }

    renderAll() {
        this.renderOpenDays();
        this.renderLifeguards();
    }

    resetFilters() {
        document.getElementById('filter-date-from').value = '';
        document.getElementById('filter-date-to').value = '';
        document.getElementById('filter-status').value = '';
        this.renderOpenDays();
    }

    renderOpenDays() {
        const days = this.getOpenDays();
        const dateFrom = document.getElementById('filter-date-from').value;
        const dateTo = document.getElementById('filter-date-to').value;
        const statusFilter = document.getElementById('filter-status').value;

        let filtered = days;

        if (dateFrom) {
            filtered = filtered.filter(d => d.date >= dateFrom);
        }
        if (dateTo) {
            filtered = filtered.filter(d => d.date <= dateTo);
        }
        if (statusFilter) {
            filtered = filtered.filter(d => d.status === statusFilter);
        }

        filtered.sort((a, b) => b.date.localeCompare(a.date));

        const container = document.getElementById('calendar-list');

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📅</div>
                    <div class="empty-state-text">暂无开放日记录</div>
                    <div class="empty-state-subtext">点击上方按钮创建新的开放日</div>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(day => this.renderOpenDayCard(day)).join('');

        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                const id = e.currentTarget.dataset.id;

                if (action === 'view') {
                    this.viewOpenDay(id);
                } else if (action === 'check') {
                    this.checkOpenDay(id);
                } else if (action === 'open') {
                    this.openPool(id);
                } else if (action === 'close') {
                    this.closePool(id);
                } else if (action === 'complete') {
                    this.completeDay(id);
                } else if (action === 'edit') {
                    this.editOpenDay(id);
                } else if (action === 'delete') {
                    this.deleteOpenDay(id);
                }
            });
        });
    }

    renderOpenDayCard(day) {
        const schedules = this.getSchedules().filter(s => s.date === day.date);
        const disinfections = this.getDisinfections().filter(d => d.date === day.date);

        const conditions = this.checkOpenConditions(day);
        const allPass = conditions.every(c => c.pass);

        return `
            <div class="list-item">
                <div class="list-item-header">
                    <div>
                        <div class="list-item-title">${this.formatDate(day.date)}</div>
                        <div class="list-item-meta">
                            <span class="badge badge-${day.status}">${STATUS_TEXT[day.status]}</span>
                            <span class="badge badge-info">预约人数: ${day.maxCapacity || 200}</span>
                        </div>
                    </div>
                    <div class="list-item-meta">
                        ${!allPass ? '<span class="badge badge-warning">条件不满足</span>' : ''}
                        ${day.closeReason ? `<span class="badge badge-danger">原因: ${day.closeReason}</span>` : ''}
                    </div>
                </div>
                <div class="list-item-body">
                    <div class="info-box">
                        <div class="info-label">救生员排班</div>
                        <div class="info-value">${schedules.length} 个时段</div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">消毒记录</div>
                        <div class="info-value">${disinfections.length} 次</div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">开放时段</div>
                        <div class="info-value">${day.timeSlots?.length || 0} 个</div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">水温</div>
                        <div class="info-value">${day.waterTemp || '--'}°C</div>
                    </div>
                </div>
                <div class="list-item-actions">
                    <button class="btn btn-sm btn-primary" data-action="view" data-id="${day.id}">👁️ 详情</button>
                    ${day.status === STATUS.PLANNED ? `
                        <button class="btn btn-sm btn-info" data-action="check" data-id="${day.id}">✅ 核对条件</button>
                    ` : ''}
                    ${day.status === STATUS.CHECKING && allPass ? `
                        <button class="btn btn-sm btn-success" data-action="open" data-id="${day.id}">🏊 确认开放</button>
                    ` : ''}
                    ${day.status === STATUS.CHECKING && !allPass ? `
                        <button class="btn btn-sm btn-warning" data-action="close" data-id="${day.id}">🚫 临时闭馆</button>
                    ` : ''}
                    ${day.status === STATUS.OPEN ? `
                        <button class="btn btn-sm btn-warning" data-action="close" data-id="${day.id}">🚫 临时闭馆</button>
                        <button class="btn btn-sm btn-success" data-action="complete" data-id="${day.id}">🏁 结束开放</button>
                    ` : ''}
                    <button class="btn btn-sm btn-secondary" data-action="edit" data-id="${day.id}">✏️ 编辑</button>
                    <button class="btn btn-sm btn-danger" data-action="delete" data-id="${day.id}">🗑️ 删除</button>
                </div>
            </div>
        `;
    }

    checkOpenConditions(day) {
        const conditions = [];
        const schedules = this.getSchedules().filter(s => s.date === day.date);
        const disinfections = this.getDisinfections().filter(d => d.date === day.date);

        const allSlotsCovered = (day.timeSlots || []).every(slot => {
            return schedules.some(s => s.timeSlot === slot && s.lifeguardIds.length > 0);
        });

        conditions.push({
            name: '救生员排班完整',
            pass: schedules.length > 0 && allSlotsCovered,
            detail: `已排班: ${schedules.length} 个时段`
        });

        conditions.push({
            name: '消毒记录齐全',
            pass: disinfections.length > 0,
            detail: `消毒次数: ${disinfections.length} 次`
        });

        conditions.push({
            name: '容量设置合理',
            pass: (day.maxCapacity || 0) > 0,
            detail: `最大容量: ${day.maxCapacity || '未设置'}`
        });

        conditions.push({
            name: '水温正常',
            pass: day.waterTemp >= 24 && day.waterTemp <= 28,
            detail: `水温: ${day.waterTemp || '未记录'}°C (建议 24-28°C)`
        });

        return conditions;
    }

    openCreateDayModal(existingData = null) {
        const isEdit = existingData !== null;
        const title = isEdit ? '编辑开放日' : '新建开放日';

        const today = new Date().toISOString().split('T')[0];
        const date = isEdit ? existingData.date : today;
        const timeSlots = existingData?.timeSlots || ['08:00-10:00', '10:00-12:00', '14:00-16:00', '16:00-18:00', '18:00-21:00'];

        const modalHtml = `
            <div class="modal" id="create-day-modal">
                <div class="modal-content modal-lg">
                    <div class="modal-header">
                        <h2>${title}</h2>
                        <button class="close-modal-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-row">
                            <div class="form-group required">
                                <label>开放日期</label>
                                <input type="date" id="day-date" value="${date}" ${isEdit ? 'disabled' : ''}>
                            </div>
                            <div class="form-group required">
                                <label>最大容纳人数</label>
                                <input type="number" id="day-capacity" value="${existingData?.maxCapacity || 200}" min="1">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group required">
                                <label>水温 (°C)</label>
                                <input type="number" id="day-temp" value="${existingData?.waterTemp || 26}" step="0.5" min="0" max="40">
                            </div>
                            <div class="form-group">
                                <label>PH 值</label>
                                <input type="number" id="day-ph" value="${existingData?.ph || 7.2}" step="0.1" min="6.5" max="8.5">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>开放时段</label>
                            <div class="checkbox-group">
                                ${TIME_SLOTS.map(slot => `
                                    <label class="checkbox-item ${timeSlots.includes(slot.start + '-' + slot.end) ? 'selected' : ''}">
                                        <input type="checkbox" value="${slot.start}-${slot.end}"
                                            ${timeSlots.includes(slot.start + '-' + slot.end) ? 'checked' : ''}>
                                        ${slot.name} (${slot.start}-${slot.end})
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        <div class="form-group">
                            <label>备注</label>
                            <textarea id="day-notes" rows="2" placeholder="特殊说明...">${existingData?.notes || ''}</textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary close-modal-btn">取消</button>
                        <button class="btn btn-primary" id="save-day">保存</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('modal-container').innerHTML = modalHtml;
        const modal = document.getElementById('create-day-modal');

        modal.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        modal.querySelectorAll('.checkbox-item input').forEach(input => {
            input.addEventListener('change', (e) => {
                e.target.closest('.checkbox-item').classList.toggle('selected', e.target.checked);
            });
        });

        document.getElementById('save-day').addEventListener('click', () => {
            this.saveDay(existingData);
        });
    }

    saveDay(existingData) {
        const date = document.getElementById('day-date').value;
        const capacity = parseInt(document.getElementById('day-capacity').value);
        const waterTemp = parseFloat(document.getElementById('day-temp').value);
        const ph = parseFloat(document.getElementById('day-ph').value);
        const notes = document.getElementById('day-notes').value;

        const timeSlots = Array.from(document.querySelectorAll('.checkbox-item input:checked'))
            .map(input => input.value);

        if (!date) {
            this.showToast('请选择开放日期', 'error');
            return;
        }
        if (!capacity || capacity <= 0) {
            this.showToast('请设置有效的最大容量', 'error');
            return;
        }
        if (timeSlots.length === 0) {
            this.showToast('请至少选择一个开放时段', 'error');
            return;
        }

        const days = this.getOpenDays();

        if (!existingData) {
            if (days.some(d => d.date === date)) {
                this.showToast('该日期已存在开放记录', 'error');
                return;
            }

            days.push({
                id: this.generateId(),
                date,
                maxCapacity: capacity,
                waterTemp,
                ph,
                timeSlots,
                notes,
                status: STATUS.PLANNED,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        } else {
            const index = days.findIndex(d => d.id === existingData.id);
            if (index !== -1) {
                days[index] = {
                    ...days[index],
                    maxCapacity: capacity,
                    waterTemp,
                    ph,
                    timeSlots,
                    notes,
                    updatedAt: new Date().toISOString()
                };
            }
        }

        this.saveOpenDays(days);
        document.getElementById('create-day-modal').remove();
        this.showToast(existingData ? '更新成功' : '创建成功');
        this.renderOpenDays();
    }

    openBatchCreateModal() {
        const modalHtml = `
            <div class="modal" id="batch-create-modal">
                <div class="modal-content modal-lg">
                    <div class="modal-header">
                        <h2>批量创建开放日</h2>
                        <button class="close-modal-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info">
                            选择日期范围和星期，批量创建开放日记录
                        </div>
                        <div class="form-row">
                            <div class="form-group required">
                                <label>开始日期</label>
                                <input type="date" id="batch-start">
                            </div>
                            <div class="form-group required">
                                <label>结束日期</label>
                                <input type="date" id="batch-end">
                            </div>
                        </div>
                        <div class="form-group required">
                            <label>选择星期</label>
                            <div class="checkbox-group">
                                ${['日', '一', '二', '三', '四', '五', '六'].map((day, i) => `
                                    <label class="checkbox-item">
                                        <input type="checkbox" value="${i}" checked>
                                        周${day}
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>最大容纳人数</label>
                                <input type="number" id="batch-capacity" value="200" min="1">
                            </div>
                            <div class="form-group">
                                <label>水温 (°C)</label>
                                <input type="number" id="batch-temp" value="26" step="0.5">
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary close-modal-btn">取消</button>
                        <button class="btn btn-primary" id="batch-create">批量创建</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('modal-container').innerHTML = modalHtml;
        const modal = document.getElementById('batch-create-modal');

        modal.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });

        modal.querySelectorAll('.checkbox-item input').forEach(input => {
            input.addEventListener('change', (e) => {
                e.target.closest('.checkbox-item').classList.toggle('selected', e.target.checked);
            });
        });

        document.getElementById('batch-create').addEventListener('click', () => {
            this.batchCreateDays();
        });
    }

    batchCreateDays() {
        const start = document.getElementById('batch-start').value;
        const end = document.getElementById('batch-end').value;
        const capacity = parseInt(document.getElementById('batch-capacity').value);
        const temp = parseFloat(document.getElementById('batch-temp').value);

        const weekdays = Array.from(document.querySelectorAll('.checkbox-item input:checked'))
            .map(input => parseInt(input.value));

        if (!start || !end) {
            this.showToast('请选择日期范围', 'error');
            return;
        }
        if (start > end) {
            this.showToast('开始日期不能晚于结束日期', 'error');
            return;
        }
        if (weekdays.length === 0) {
            this.showToast('请至少选择一个星期', 'error');
            return;
        }

        const days = this.getOpenDays();
        const existingDates = new Set(days.map(d => d.date));
        let count = 0;

        const startDate = new Date(start);
        const endDate = new Date(end);

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            if (weekdays.includes(d.getDay())) {
                const dateStr = d.toISOString().split('T')[0];
                if (!existingDates.has(dateStr)) {
                    days.push({
                        id: this.generateId(),
                        date: dateStr,
                        maxCapacity: capacity,
                        waterTemp: temp,
                        ph: 7.2,
                        timeSlots: ['08:00-10:00', '10:00-12:00', '14:00-16:00', '16:00-18:00', '18:00-21:00'],
                        notes: '',
                        status: STATUS.PLANNED,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                    count++;
                }
            }
        }

        this.saveOpenDays(days);
        document.getElementById('batch-create-modal').remove();
        this.showToast(`成功创建 ${count} 个开放日`);
        this.renderOpenDays();
    }

    viewOpenDay(id) {
        const days = this.getOpenDays();
        const day = days.find(d => d.id === id);
        if (!day) return;

        const schedules = this.getSchedules().filter(s => s.date === day.date);
        const disinfections = this.getDisinfections().filter(d => d.date === day.date);
        const conditions = this.checkOpenConditions(day);
        const allPass = conditions.every(c => c.pass);

        const lifeguards = this.getLifeguards();

        const modalHtml = `
            <div class="modal" id="view-day-modal">
                <div class="modal-content modal-xl">
                    <div class="modal-header">
                        <h2>开放日详情 - ${this.formatDate(day.date)}</h2>
                        <button class="close-modal-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="list-item-meta" style="margin-bottom: 20px;">
                            <span class="badge badge-${day.status}">${STATUS_TEXT[day.status]}</span>
                            ${day.closeReason ? `<span class="badge badge-danger">闭馆原因: ${day.closeReason}</span>` : ''}
                        </div>

                        <div class="check-conditions">
                            <h3 style="margin-bottom: 16px;">开放条件核对</h3>
                            ${conditions.map(c => `
                                <div class="condition-item">
                                    <div class="condition-icon ${c.pass ? 'pass' : 'fail'}">
                                        ${c.pass ? '✅' : '❌'}
                                    </div>
                                    <div class="condition-text">
                                        <strong>${c.name}</strong>
                                        <div style="font-size: 12px; color: #64748b;">${c.detail}</div>
                                    </div>
                                    <div class="condition-status ${c.pass ? 'pass' : 'fail'}">
                                        ${c.pass ? '通过' : '未通过'}
                                    </div>
                                </div>
                            `).join('')}
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${(conditions.filter(c => c.pass).length / conditions.length * 100)}%"></div>
                            </div>
                            <div style="text-align: center; margin-top: 8px; font-size: 13px;">
                                ${conditions.filter(c => c.pass).length} / ${conditions.length} 条件通过
                                ${allPass ? ' ✅ 可以开放' : ' ⚠️ 暂不满足开放条件'}
                            </div>
                        </div>

                        <div class="two-column">
                            <div class="column">
                                <h3>基本信息</h3>
                                <div class="stats-container">
                                    <div class="stat-item">
                                        <span>最大容量</span>
                                        <strong>${day.maxCapacity} 人</strong>
                                    </div>
                                    <div class="stat-item">
                                        <span>水温</span>
                                        <strong>${day.waterTemp}°C</strong>
                                    </div>
                                    <div class="stat-item">
                                        <span>PH 值</span>
                                        <strong>${day.ph || '--'}</strong>
                                    </div>
                                    <div class="stat-item">
                                        <span>开放时段</span>
                                        <strong>${day.timeSlots?.length || 0} 个</strong>
                                    </div>
                                    ${day.notes ? `
                                        <div class="stat-item">
                                            <span>备注</span>
                                            <strong>${day.notes}</strong>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                            <div class="column">
                                <h3>救生员排班</h3>
                                <div class="stats-container">
                                    ${schedules.length === 0 ? `
                                        <div class="empty-state" style="padding: 20px;">
                                            <div class="empty-state-icon" style="font-size: 24px;">👥</div>
                                            <div class="empty-state-text" style="font-size: 14px;">暂无排班</div>
                                        </div>
                                    ` : schedules.map(s => `
                                        <div class="stat-item">
                                            <span>${s.timeSlot}</span>
                                            <strong>${s.lifeguardIds.map(id => {
                                                const lg = lifeguards.find(l => l.id === id);
                                                return lg ? lg.name : '未知';
                                            }).join(', ') || '未安排'}</strong>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>

                        <div style="margin-top: 24px;">
                            <h3>消毒记录 (${disinfections.length} 次)</h3>
                            <div class="stats-container">
                                ${disinfections.length === 0 ? `
                                    <div class="empty-state" style="padding: 20px;">
                                        <div class="empty-state-icon" style="font-size: 24px;">🧼</div>
                                        <div class="empty-state-text" style="font-size: 14px;">暂无消毒记录</div>
                                    </div>
                                ` : disinfections.map(d => `
                                    <div class="stat-item">
                                        <span>${d.time} - ${d.type}</span>
                                        <strong>${d.operator}</strong>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <div style="margin-top: 24px;">
                            <h3>历史记录</h3>
                            <div class="stats-container">
                                <div class="stat-item">
                                    <span>创建时间</span>
                                    <strong>${this.formatDateTime(day.createdAt)}</strong>
                                </div>
                                <div class="stat-item">
                                    <span>最后更新</span>
                                    <strong>${this.formatDateTime(day.updatedAt)}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary close-modal-btn">关闭</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('modal-container').innerHTML = modalHtml;
        const modal = document.getElementById('view-day-modal');

        modal.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });
    }

    checkOpenDay(id) {
        const days = this.getOpenDays();
        const index = days.findIndex(d => d.id === id);
        if (index === -1) return;

        days[index].status = STATUS.CHECKING;
        days[index].updatedAt = new Date().toISOString();
        this.saveOpenDays(days);
        this.showToast('已进入核对状态');
        this.renderOpenDays();
        this.viewOpenDay(id);
    }

    openPool(id) {
        const days = this.getOpenDays();
        const index = days.findIndex(d => d.id === id);
        if (index === -1) return;

        days[index].status = STATUS.OPEN;
        days[index].openedAt = new Date().toISOString();
        days[index].updatedAt = new Date().toISOString();
        this.saveOpenDays(days);
        this.showToast('泳池已开放');
        this.renderOpenDays();
    }

    closePool(id) {
        const modalHtml = `
            <div class="modal" id="close-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>临时闭馆</h2>
                        <button class="close-modal-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-warning">
                            请选择闭馆原因
                        </div>
                        <div class="form-group required">
                            <label>闭馆原因</label>
                            <select id="close-reason">
                                <option value="">请选择原因</option>
                                ${CLOSED_REASONS.map(r => `<option value="${r}">${r}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>详细说明</label>
                            <textarea id="close-description" rows="3" placeholder="请详细说明..."></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary close-modal-btn">取消</button>
                        <button class="btn btn-danger" id="confirm-close">确认闭馆</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('modal-container').innerHTML = modalHtml;
        const modal = document.getElementById('close-modal');

        modal.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });

        document.getElementById('confirm-close').addEventListener('click', () => {
            const reason = document.getElementById('close-reason').value;
            const description = document.getElementById('close-description').value;

            if (!reason) {
                this.showToast('请选择闭馆原因', 'error');
                return;
            }

            const days = this.getOpenDays();
            const index = days.findIndex(d => d.id === id);
            if (index !== -1) {
                days[index].status = STATUS.CLOSED;
                days[index].closeReason = reason;
                days[index].closeDescription = description;
                days[index].closedAt = new Date().toISOString();
                days[index].updatedAt = new Date().toISOString();
                this.saveOpenDays(days);
            }

            modal.remove();
            this.showToast('已记录闭馆');
            this.renderOpenDays();
        });
    }

    completeDay(id) {
        const days = this.getOpenDays();
        const index = days.findIndex(d => d.id === id);
        if (index === -1) return;

        days[index].status = STATUS.COMPLETED;
        days[index].completedAt = new Date().toISOString();
        days[index].updatedAt = new Date().toISOString();
        this.saveOpenDays(days);
        this.showToast('已结束开放');
        this.renderOpenDays();
    }

    editOpenDay(id) {
        const days = this.getOpenDays();
        const day = days.find(d => d.id === id);
        if (day) {
            this.openCreateDayModal(day);
        }
    }

    deleteOpenDay(id) {
        if (!confirm('确定要删除此开放日吗？相关的排班和消毒记录不会被删除。')) {
            return;
        }

        const days = this.getOpenDays().filter(d => d.id !== id);
        this.saveOpenDays(days);
        this.showToast('已删除');
        this.renderOpenDays();
    }

    renderLifeguards() {
        const lifeguards = this.getLifeguards();
        const container = document.getElementById('lifeguard-list');

        if (lifeguards.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <div class="empty-state-text">暂无救生员</div>
                    <div class="empty-state-subtext">点击上方按钮添加救生员</div>
                </div>
            `;
            return;
        }

        container.innerHTML = lifeguards.map(lg => `
            <div class="list-item">
                <div class="list-item-header">
                    <div class="list-item-title">${lg.name}</div>
                    <span class="badge ${lg.certified ? 'badge-success' : 'badge-warning'}">
                        ${lg.certified ? '持证' : '待考证'}
                    </span>
                </div>
                <div class="list-item-body">
                    <div class="info-box">
                        <div class="info-label">电话</div>
                        <div class="info-value">${lg.phone || '--'}</div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">经验</div>
                        <div class="info-value">${lg.experience || 0} 年</div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">证书编号</div>
                        <div class="info-value">${lg.certNumber || '--'}</div>
                    </div>
                </div>
                <div class="list-item-actions">
                    <button class="btn btn-sm btn-secondary" data-action="edit-lifeguard" data-id="${lg.id}">✏️ 编辑</button>
                    <button class="btn btn-sm btn-danger" data-action="delete-lifeguard" data-id="${lg.id}">🗑️ 删除</button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                const id = e.currentTarget.dataset.id;

                if (action === 'edit-lifeguard') {
                    this.editLifeguard(id);
                } else if (action === 'delete-lifeguard') {
                    this.deleteLifeguard(id);
                }
            });
        });
    }

    openCreateLifeguardModal(existingData = null) {
        const isEdit = existingData !== null;
        const title = isEdit ? '编辑救生员' : '添加救生员';

        const modalHtml = `
            <div class="modal" id="lifeguard-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>${title}</h2>
                        <button class="close-modal-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group required">
                            <label>姓名</label>
                            <input type="text" id="lg-name" value="${existingData?.name || ''}" placeholder="请输入姓名">
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>电话</label>
                                <input type="tel" id="lg-phone" value="${existingData?.phone || ''}" placeholder="联系电话">
                            </div>
                            <div class="form-group">
                                <label>从业年限</label>
                                <input type="number" id="lg-experience" value="${existingData?.experience || 0}" min="0">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label style="display: flex; align-items: center; gap: 8px;">
                                    <input type="checkbox" id="lg-certified" ${existingData?.certified ? 'checked' : ''}>
                                    持有救生员证书
                                </label>
                            </div>
                            <div class="form-group">
                                <label>证书编号</label>
                                <input type="text" id="lg-cert-number" value="${existingData?.certNumber || ''}" placeholder="证书编号">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>备注</label>
                            <textarea id="lg-notes" rows="2">${existingData?.notes || ''}</textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary close-modal-btn">取消</button>
                        <button class="btn btn-primary" id="save-lifeguard">保存</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('modal-container').innerHTML = modalHtml;
        const modal = document.getElementById('lifeguard-modal');

        modal.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });

        document.getElementById('save-lifeguard').addEventListener('click', () => {
            this.saveLifeguard(existingData);
        });
    }

    saveLifeguard(existingData) {
        const name = document.getElementById('lg-name').value.trim();
        const phone = document.getElementById('lg-phone').value.trim();
        const experience = parseInt(document.getElementById('lg-experience').value) || 0;
        const certified = document.getElementById('lg-certified').checked;
        const certNumber = document.getElementById('lg-cert-number').value.trim();
        const notes = document.getElementById('lg-notes').value.trim();

        if (!name) {
            this.showToast('请输入姓名', 'error');
            return;
        }

        const lifeguards = this.getLifeguards();

        if (!existingData) {
            if (lifeguards.some(lg => lg.name === name)) {
                this.showToast('该救生员已存在', 'error');
                return;
            }

            lifeguards.push({
                id: this.generateId(),
                name,
                phone,
                experience,
                certified,
                certNumber,
                notes,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        } else {
            const index = lifeguards.findIndex(lg => lg.id === existingData.id);
            if (index !== -1) {
                lifeguards[index] = {
                    ...lifeguards[index],
                    name,
                    phone,
                    experience,
                    certified,
                    certNumber,
                    notes,
                    updatedAt: new Date().toISOString()
                };
            }
        }

        this.saveLifeguards(lifeguards);
        document.getElementById('lifeguard-modal').remove();
        this.showToast(existingData ? '更新成功' : '添加成功');
        this.renderLifeguards();
    }

    editLifeguard(id) {
        const lifeguards = this.getLifeguards();
        const lg = lifeguards.find(l => l.id === id);
        if (lg) {
            this.openCreateLifeguardModal(lg);
        }
    }

    deleteLifeguard(id) {
        if (!confirm('确定要删除此救生员吗？已有的排班记录不会被删除。')) {
            return;
        }

        const lifeguards = this.getLifeguards().filter(lg => lg.id !== id);
        this.saveLifeguards(lifeguards);
        this.showToast('已删除');
        this.renderLifeguards();
    }

    openImportLifeguardsModal() {
        const modalHtml = `
            <div class="modal" id="import-lg-modal">
                <div class="modal-content modal-lg">
                    <div class="modal-header">
                        <h2>批量导入救生员</h2>
                        <button class="close-modal-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info">
                            请输入 JSON 格式的救生员数据，格式示例：
                            <code>[{"name": "张三", "phone": "13800138000", "certified": true}]</code>
                        </div>
                        <div class="form-group">
                            <label>JSON 数据</label>
                            <textarea id="import-lg-json" rows="8" placeholder='[
  {"name": "张三", "phone": "13800138000", "experience": 3, "certified": true, "certNumber": "CERT001"},
  {"name": "李四", "phone": "13800138001", "experience": 2, "certified": true, "certNumber": "CERT002"},
  {"name": "王五", "phone": "13800138002", "experience": 1, "certified": false}
]'></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary close-modal-btn">取消</button>
                        <button class="btn btn-primary" id="import-lg-btn">导入</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('modal-container').innerHTML = modalHtml;
        const modal = document.getElementById('import-lg-modal');

        modal.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });

        document.getElementById('import-lg-btn').addEventListener('click', () => {
            this.importLifeguards();
        });
    }

    importLifeguards() {
        let data;
        try {
            data = JSON.parse(document.getElementById('import-lg-json').value);
        } catch (e) {
            this.showToast('JSON 格式错误', 'error');
            return;
        }

        if (!Array.isArray(data)) {
            this.showToast('数据必须是数组格式', 'error');
            return;
        }

        const lifeguards = this.getLifeguards();
        const existingNames = new Set(lifeguards.map(lg => lg.name));
        let count = 0;

        data.forEach(item => {
            if (item.name && !existingNames.has(item.name)) {
                lifeguards.push({
                    id: this.generateId(),
                    name: item.name,
                    phone: item.phone || '',
                    experience: item.experience || 0,
                    certified: item.certified || false,
                    certNumber: item.certNumber || '',
                    notes: item.notes || '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                existingNames.add(item.name);
                count++;
            }
        });

        this.saveLifeguards(lifeguards);
        document.getElementById('import-lg-modal').remove();
        this.showToast(`成功导入 ${count} 个救生员`);
        this.renderLifeguards();
    }

    renderSchedule() {
        const date = document.getElementById('schedule-date').value;
        if (!date) {
            this.showToast('请选择日期', 'error');
            return;
        }

        const schedules = this.getSchedules().filter(s => s.date === date);
        const lifeguards = this.getLifeguards();
        const openDays = this.getOpenDays();
        const openDay = openDays.find(d => d.date === date);

        const container = document.getElementById('schedule-container');

        if (!openDay) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📅</div>
                    <div class="empty-state-text">该日期没有开放计划</div>
                    <div class="empty-state-subtext">请先在"开放日历"中创建开放日</div>
                </div>
            `;
            return;
        }

        const timeSlots = openDay.timeSlots || [];

        container.innerHTML = `
            <div class="alert alert-info">
                日期: ${this.formatDate(date)} | 状态: <span class="badge badge-${openDay.status}">${STATUS_TEXT[openDay.status]}</span>
            </div>
            ${timeSlots.map(slot => {
                const schedule = schedules.find(s => s.timeSlot === slot);
                const selectedIds = schedule?.lifeguardIds || [];

                return `
                    <div class="list-item">
                        <div class="time-slot">⏰ ${slot}</div>
                        <div class="form-group">
                            <label>值班救生员 (可多选)</label>
                            <div class="checkbox-group">
                                ${lifeguards.length === 0 ? `
                                    <div class="empty-state" style="padding: 20px;">
                                        <div class="empty-state-text" style="font-size: 13px;">暂无救生员，请先添加</div>
                                    </div>
                                ` : lifeguards.map(lg => `
                                    <label class="checkbox-item ${selectedIds.includes(lg.id) ? 'selected' : ''}">
                                        <input type="checkbox" 
                                            data-date="${date}" 
                                            data-slot="${slot}" 
                                            data-lg="${lg.id}"
                                            ${selectedIds.includes(lg.id) ? 'checked' : ''}
                                            ${!lg.certified ? 'disabled' : ''}>
                                        ${lg.name}
                                        ${lg.certified ? '<span style="color: #059669;">✓</span>' : '<span style="color: #f59e0b;">(无证)</span>'}
                                    </label>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
            ${timeSlots.length === 0 ? `
                <div class="alert alert-warning">
                    该开放日未设置时段，请先编辑开放日
                </div>
            ` : ''}
        `;

        container.querySelectorAll('.checkbox-item input').forEach(input => {
            input.addEventListener('change', (e) => {
                const date = e.target.dataset.date;
                const slot = e.target.dataset.slot;
                const lgId = e.target.dataset.lg;
                this.updateSchedule(date, slot, lgId, e.target.checked);
            });
        });
    }

    updateSchedule(date, slot, lifeguardId, add) {
        const schedules = this.getSchedules();
        let schedule = schedules.find(s => s.date === date && s.timeSlot === slot);

        if (!schedule) {
            schedule = {
                id: this.generateId(),
                date,
                timeSlot: slot,
                lifeguardIds: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            schedules.push(schedule);
        }

        if (add) {
            if (!schedule.lifeguardIds.includes(lifeguardId)) {
                schedule.lifeguardIds.push(lifeguardId);
            }
        } else {
            schedule.lifeguardIds = schedule.lifeguardIds.filter(id => id !== lifeguardId);
        }

        schedule.updatedAt = new Date().toISOString();
        this.saveSchedules(schedules);
        this.showToast('已更新排班');
    }

    renderDisinfections() {
        const dateFilter = document.getElementById('filter-disinfection-date').value;
        let disinfections = this.getDisinfections();

        if (dateFilter) {
            disinfections = disinfections.filter(d => d.date === dateFilter);
        }

        disinfections.sort((a, b) => {
            const comp = b.date.localeCompare(a.date);
            if (comp !== 0) return comp;
            return b.time.localeCompare(a.time);
        });

        const container = document.getElementById('disinfection-list');

        if (disinfections.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🧼</div>
                    <div class="empty-state-text">暂无消毒记录</div>
                    <div class="empty-state-subtext">点击上方按钮记录消毒</div>
                </div>
            `;
            return;
        }

        container.innerHTML = disinfections.map(d => `
            <div class="list-item">
                <div class="list-item-header">
                    <div class="list-item-title">${this.formatDate(d.date)} ${d.time}</div>
                    <span class="badge badge-success">${d.type}</span>
                </div>
                <div class="list-item-body">
                    <div class="info-box">
                        <div class="info-label">操作人员</div>
                        <div class="info-value">${d.operator}</div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">余氯值</div>
                        <div class="info-value">${d.chlorine || '--'} mg/L</div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">PH 值</div>
                        <div class="info-value">${d.ph || '--'}</div>
                    </div>
                    <div class="info-box">
                        <div class="info-label">消毒范围</div>
                        <div class="info-value">${d.area || '全部'}</div>
                    </div>
                </div>
                ${d.notes ? `
                    <div class="info-box">
                        <div class="info-label">备注</div>
                        <div class="info-value">${d.notes}</div>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    openCreateDisinfectionModal() {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        const timeStr = today.toTimeString().slice(0, 5);

        const openDays = this.getOpenDays().filter(d => d.date >= dateStr).sort((a, b) => a.date.localeCompare(b.date));

        const modalHtml = `
            <div class="modal" id="disinfection-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>记录消毒</h2>
                        <button class="close-modal-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-row">
                            <div class="form-group required">
                                <label>日期</label>
                                <select id="dis-date">
                                    ${openDays.length === 0 ? '<option value="' + dateStr + '">' + dateStr + '</option>' : 
                                        openDays.map(d => `<option value="${d.date}">${this.formatDate(d.date)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group required">
                                <label>时间</label>
                                <input type="time" id="dis-time" value="${timeStr}">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group required">
                                <label>消毒类型</label>
                                <select id="dis-type">
                                    <option value="日常消毒">日常消毒</option>
                                    <option value="开放前消毒">开放前消毒</option>
                                    <option value="开放后消毒">开放后消毒</option>
                                    <option value="紧急消毒">紧急消毒</option>
                                    <option value="水质处理">水质处理</option>
                                </select>
                            </div>
                            <div class="form-group required">
                                <label>操作人员</label>
                                <input type="text" id="dis-operator" placeholder="操作员姓名">
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label>余氯值 (mg/L)</label>
                                <input type="number" id="dis-chlorine" step="0.1" placeholder="0.3-0.5">
                            </div>
                            <div class="form-group">
                                <label>PH 值</label>
                                <input type="number" id="dis-ph" step="0.1" placeholder="6.8-8.0">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>消毒范围</label>
                            <input type="text" id="dis-area" value="泳池全部区域" placeholder="消毒范围">
                        </div>
                        <div class="form-group">
                            <label>备注</label>
                            <textarea id="dis-notes" rows="2" placeholder="特殊情况说明..."></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary close-modal-btn">取消</button>
                        <button class="btn btn-primary" id="save-disinfection">保存</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('modal-container').innerHTML = modalHtml;
        const modal = document.getElementById('disinfection-modal');

        modal.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });

        document.getElementById('save-disinfection').addEventListener('click', () => {
            this.saveDisinfection();
        });
    }

    saveDisinfection() {
        const date = document.getElementById('dis-date').value;
        const time = document.getElementById('dis-time').value;
        const type = document.getElementById('dis-type').value;
        const operator = document.getElementById('dis-operator').value.trim();
        const chlorine = document.getElementById('dis-chlorine').value;
        const ph = document.getElementById('dis-ph').value;
        const area = document.getElementById('dis-area').value.trim();
        const notes = document.getElementById('dis-notes').value.trim();

        if (!operator) {
            this.showToast('请输入操作人员姓名', 'error');
            return;
        }

        const disinfections = this.getDisinfections();
        disinfections.push({
            id: this.generateId(),
            date,
            time,
            type,
            operator,
            chlorine: chlorine ? parseFloat(chlorine) : null,
            ph: ph ? parseFloat(ph) : null,
            area: area || '泳池全部区域',
            notes,
            createdAt: new Date().toISOString()
        });

        this.saveDisinfections(disinfections);
        document.getElementById('disinfection-modal').remove();
        this.showToast('消毒记录已保存');
        this.renderDisinfections();
    }

    renderStatistics() {
        const days = this.getOpenDays();
        const lifeguards = this.getLifeguards();
        const schedules = this.getSchedules();
        const disinfections = this.getDisinfections();

        const statsGrid = document.getElementById('stats-grid');
        statsGrid.innerHTML = `
            <div class="stat-card blue">
                <div class="stat-number">${days.length}</div>
                <div class="stat-label">开放日总数</div>
            </div>
            <div class="stat-card green">
                <div class="stat-number">${days.filter(d => d.status === STATUS.OPEN).length}</div>
                <div class="stat-label">当前开放</div>
            </div>
            <div class="stat-card red">
                <div class="stat-number">${days.filter(d => d.status === STATUS.CLOSED).length}</div>
                <div class="stat-label">临时闭馆</div>
            </div>
            <div class="stat-card yellow">
                <div class="stat-number">${days.filter(d => d.status === STATUS.PLANNED).length}</div>
                <div class="stat-label">计划中</div>
            </div>
            <div class="stat-card blue">
                <div class="stat-number">${lifeguards.length}</div>
                <div class="stat-label">救生员总数</div>
            </div>
            <div class="stat-card green">
                <div class="stat-number">${disinfections.length}</div>
                <div class="stat-label">消毒记录</div>
            </div>
        `;

        const monthlyStats = document.getElementById('monthly-stats');
        const months = {};
        days.forEach(d => {
            const month = d.date.substring(0, 7);
            if (!months[month]) {
                months[month] = { total: 0, open: 0, closed: 0, completed: 0 };
            }
            months[month].total++;
            if (d.status === STATUS.OPEN) months[month].open++;
            if (d.status === STATUS.CLOSED) months[month].closed++;
            if (d.status === STATUS.COMPLETED) months[month].completed++;
        });

        const sortedMonths = Object.keys(months).sort().reverse();

        monthlyStats.innerHTML = sortedMonths.length === 0 ? `
            <div class="empty-state" style="padding: 20px;">
                <div class="empty-state-text" style="font-size: 13px;">暂无统计数据</div>
            </div>
        ` : sortedMonths.map(m => `
            <div class="stat-item">
                <span>${m}</span>
                <div>
                    <span class="badge badge-info">${months[m].total} 天</span>
                    <span class="badge badge-success">${months[m].completed} 完成</span>
                    <span class="badge badge-danger">${months[m].closed} 闭馆</span>
                </div>
            </div>
        `).join('');

        const abnormalStats = document.getElementById('abnormal-stats');
        const closedByReason = {};
        days.filter(d => d.closeReason).forEach(d => {
            const reason = d.closeReason;
            if (!closedByReason[reason]) closedByReason[reason] = 0;
            closedByReason[reason]++;
        });

        abnormalStats.innerHTML = Object.keys(closedByReason).length === 0 ? `
            <div class="empty-state" style="padding: 20px;">
                <div class="empty-state-text" style="font-size: 13px;">暂无闭馆记录</div>
            </div>
        ` : Object.entries(closedByReason).map(([reason, count]) => `
            <div class="stat-item">
                <span>${reason}</span>
                <strong>${count} 次</strong>
            </div>
        `).join('');
    }

    switchAbnormalType(type) {
        document.querySelectorAll('.abnormal-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        this.currentAbnormalType = type;
        this.renderAbnormalList();
    }

    renderAbnormalList() {
        const type = this.currentAbnormalType || 'duplicate';
        const records = this.getAbnormalRecords().filter(r => r.type === type);
        const container = document.getElementById('abnormal-list');

        if (records.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">⚠️</div>
                    <div class="empty-state-text">暂无异常记录</div>
                    <div class="empty-state-subtext">点击"自动检测异常"或"生成测试数据"</div>
                </div>
            `;
            return;
        }

        container.innerHTML = records.map(r => `
            <div class="list-item ${r.resolved ? 'opacity-60' : ''}">
                <div class="list-item-header">
                    <div>
                        <div class="list-item-title">${r.title}</div>
                        <div class="list-item-meta">
                            <span class="badge badge-${r.severity === 'high' ? 'danger' : r.severity === 'medium' ? 'warning' : 'info'}">
                                ${r.severity === 'high' ? '严重' : r.severity === 'medium' ? '中等' : '轻微'}
                            </span>
                            ${r.resolved ? '<span class="badge badge-success">已处理</span>' : '<span class="badge badge-warning">待处理</span>'}
                        </div>
                    </div>
                </div>
                <div class="list-item-body">
                    <div class="info-box">
                        <div class="info-label">描述</div>
                        <div class="info-value">${r.description}</div>
                    </div>
                    ${r.affectedData ? `
                        <div class="info-box">
                            <div class="info-label">关联数据</div>
                            <div class="info-value">${r.affectedData}</div>
                        </div>
                    ` : ''}
                    <div class="info-box">
                        <div class="info-label">检测时间</div>
                        <div class="info-value">${this.formatDateTime(r.detectedAt)}</div>
                    </div>
                </div>
                <div class="list-item-actions">
                    ${!r.resolved ? `
                        <button class="btn btn-sm btn-success" data-action="resolve" data-id="${r.id}">✅ 标记已处理</button>
                        ${type === 'manual' ? `
                            <button class="btn btn-sm btn-primary" data-action="correct" data-id="${r.id}">✏️ 编辑修正</button>
                        ` : ''}
                    ` : ''}
                    <button class="btn btn-sm btn-danger" data-action="delete-abnormal" data-id="${r.id}">🗑️ 删除</button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                const id = e.currentTarget.dataset.id;

                if (action === 'resolve') {
                    this.resolveAbnormal(id);
                } else if (action === 'correct') {
                    this.correctAbnormal(id);
                } else if (action === 'delete-abnormal') {
                    this.deleteAbnormal(id);
                }
            });
        });
    }

    generateAbnormalData() {
        if (!confirm('此操作将生成模拟的异常数据用于测试，是否继续？')) {
            return;
        }

        const records = this.getAbnormalRecords();

        records.push({
            id: this.generateId(),
            type: 'duplicate',
            title: '重复开放日检测',
            description: '发现同一天存在多条开放记录，请合并或删除重复项',
            severity: 'high',
            affectedData: '2026-05-15 (2条重复)',
            resolved: false,
            detectedAt: new Date().toISOString()
        });

        records.push({
            id: this.generateId(),
            type: 'duplicate',
            title: '重复救生员排班',
            description: '同一时段同一救生员被多次排班',
            severity: 'medium',
            affectedData: '张三 | 2026-05-16 14:00-16:00',
            resolved: false,
            detectedAt: new Date().toISOString()
        });

        records.push({
            id: this.generateId(),
            type: 'missing',
            title: '开放日缺少容量设置',
            description: '开放日未设置最大容纳人数，可能影响入场管理',
            severity: 'high',
            affectedData: '2026-05-17',
            resolved: false,
            detectedAt: new Date().toISOString()
        });

        records.push({
            id: this.generateId(),
            type: 'missing',
            title: '开放时段无救生员',
            description: '以下时段未安排救生员，存在安全隐患',
            severity: 'high',
            affectedData: '2026-05-18 晚场',
            resolved: false,
            detectedAt: new Date().toISOString()
        });

        records.push({
            id: this.generateId(),
            type: 'missing',
            title: '消毒记录缺失',
            description: '开放日缺少开放前消毒记录',
            severity: 'medium',
            affectedData: '2026-05-19',
            resolved: false,
            detectedAt: new Date().toISOString()
        });

        records.push({
            id: this.generateId(),
            type: 'manual',
            title: '水温记录异常',
            description: '记录的水温超出正常范围 (24-28°C)',
            severity: 'medium',
            affectedData: '2026-05-20 记录: 32°C',
            resolved: false,
            detectedAt: new Date().toISOString()
        });

        records.push({
            id: this.generateId(),
            type: 'manual',
            title: '人数统计异常',
            description: '入场人数超过最大容量',
            severity: 'high',
            affectedData: '2026-05-21 容量200，记录250人',
            resolved: false,
            detectedAt: new Date().toISOString()
        });

        this.saveAbnormalRecords(records);
        this.showToast('已生成测试异常数据');
        this.renderAbnormalList();
    }

    checkAbnormalData() {
        const days = this.getOpenDays();
        const schedules = this.getSchedules();
        const disinfections = this.getDisinfections();
        const records = this.getAbnormalRecords();

        let found = 0;

        const dateCounts = {};
        days.forEach(d => {
            dateCounts[d.date] = (dateCounts[d.date] || 0) + 1;
        });
        Object.entries(dateCounts).forEach(([date, count]) => {
            if (count > 1) {
                records.push({
                    id: this.generateId(),
                    type: 'duplicate',
                    title: '重复开放日',
                    description: `${date} 存在 ${count} 条开放记录`,
                    severity: 'high',
                    affectedData: date,
                    resolved: false,
                    detectedAt: new Date().toISOString()
                });
                found++;
            }
        });

        days.forEach(d => {
            if (!d.maxCapacity || d.maxCapacity <= 0) {
                records.push({
                    id: this.generateId(),
                    type: 'missing',
                    title: '缺少容量设置',
                    description: `${this.formatDate(d.date)} 未设置最大容纳人数`,
                    severity: 'high',
                    affectedData: d.date,
                    resolved: false,
                    detectedAt: new Date().toISOString()
                });
                found++;
            }

            if (d.waterTemp !== undefined && (d.waterTemp < 24 || d.waterTemp > 28)) {
                records.push({
                    id: this.generateId(),
                    type: 'manual',
                    title: '水温异常',
                    description: `水温 ${d.waterTemp}°C 超出正常范围 (24-28°C)`,
                    severity: 'medium',
                    affectedData: `${d.date}: ${d.waterTemp}°C`,
                    resolved: false,
                    detectedAt: new Date().toISOString()
                });
                found++;
            }

            const dayDisinfections = disinfections.filter(di => di.date === d.date);
            if (dayDisinfections.length === 0 && d.status !== STATUS.PLANNED) {
                records.push({
                    id: this.generateId(),
                    type: 'missing',
                    title: '缺少消毒记录',
                    description: `${this.formatDate(d.date)} 无消毒记录`,
                    severity: 'medium',
                    affectedData: d.date,
                    resolved: false,
                    detectedAt: new Date().toISOString()
                });
                found++;
            }

            const daySchedules = schedules.filter(s => s.date === d.date);
            const slots = d.timeSlots || [];
            slots.forEach(slot => {
                const slotSchedule = daySchedules.find(s => s.timeSlot === slot);
                if (!slotSchedule || slotSchedule.lifeguardIds.length === 0) {
                    records.push({
                        id: this.generateId(),
                        type: 'missing',
                        title: '时段缺少救生员',
                        description: `${this.formatDate(d.date)} ${slot} 未安排救生员`,
                        severity: 'high',
                        affectedData: `${d.date} ${slot}`,
                        resolved: false,
                        detectedAt: new Date().toISOString()
                    });
                    found++;
                }
            });
        });

        this.saveAbnormalRecords(records);
        this.showToast(`检测完成，发现 ${found} 个异常`);
        this.renderAbnormalList();
    }

    resolveAbnormal(id) {
        const records = this.getAbnormalRecords();
        const index = records.findIndex(r => r.id === id);
        if (index !== -1) {
            records[index].resolved = true;
            records[index].resolvedAt = new Date().toISOString();
            this.saveAbnormalRecords(records);
            this.showToast('已标记为已处理');
            this.renderAbnormalList();
        }
    }

    correctAbnormal(id) {
        const records = this.getAbnormalRecords();
        const record = records.find(r => r.id === id);
        if (!record) return;

        const modalHtml = `
            <div class="modal" id="correct-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>人工改错</h2>
                        <button class="close-modal-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-warning">
                            <strong>问题：</strong>${record.description}
                        </div>
                        <div class="form-group">
                            <label>修正说明</label>
                            <textarea id="correction-notes" rows="3" placeholder="请说明如何修正此问题..."></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary close-modal-btn">取消</button>
                        <button class="btn btn-success" id="confirm-correct">确认修正</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('modal-container').innerHTML = modalHtml;
        const modal = document.getElementById('correct-modal');

        modal.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });

        document.getElementById('confirm-correct').addEventListener('click', () => {
            const notes = document.getElementById('correction-notes').value.trim();
            if (!notes) {
                this.showToast('请填写修正说明', 'error');
                return;
            }

            const idx = records.findIndex(r => r.id === id);
            if (idx !== -1) {
                records[idx].resolved = true;
                records[idx].correctionNotes = notes;
                records[idx].resolvedAt = new Date().toISOString();
                this.saveAbnormalRecords(records);
            }

            modal.remove();
            this.showToast('已记录修正');
            this.renderAbnormalList();
        });
    }

    deleteAbnormal(id) {
        if (!confirm('确定要删除此异常记录吗？')) {
            return;
        }

        const records = this.getAbnormalRecords().filter(r => r.id !== id);
        this.saveAbnormalRecords(records);
        this.showToast('已删除');
        this.renderAbnormalList();
    }

    openImportModal() {
        const modalHtml = `
            <div class="modal" id="import-modal">
                <div class="modal-content modal-lg">
                    <div class="modal-header">
                        <h2>导入数据</h2>
                        <button class="close-modal-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-info">
                            粘贴之前导出的 JSON 数据，将合并到现有数据中
                        </div>
                        <div class="form-group">
                            <label>JSON 数据</label>
                            <textarea id="import-json" rows="10" placeholder='{"openDays": [], "lifeguards": [], "schedules": [], "disinfections": []}'></textarea>
                        </div>
                        <div class="alert alert-warning">
                            ⚠️ 重复数据（如相同日期的开放日）会被跳过
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary close-modal-btn">取消</button>
                        <button class="btn btn-primary" id="do-import">导入</button>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('modal-container').innerHTML = modalHtml;
        const modal = document.getElementById('import-modal');

        modal.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });

        document.getElementById('do-import').addEventListener('click', () => {
            this.importData();
        });
    }

    importData() {
        let data;
        try {
            data = JSON.parse(document.getElementById('import-json').value);
        } catch (e) {
            this.showToast('JSON 格式错误', 'error');
            return;
        }

        let days = this.getOpenDays();
        let lifeguards = this.getLifeguards();
        let schedules = this.getSchedules();
        let disinfections = this.getDisinfections();

        const existingDates = new Set(days.map(d => d.date));
        const existingLgNames = new Set(lifeguards.map(l => l.name));
        let count = 0;

        if (data.openDays && Array.isArray(data.openDays)) {
            data.openDays.forEach(d => {
                if (!existingDates.has(d.date)) {
                    days.push({ ...d, id: this.generateId() });
                    count++;
                }
            });
        }

        if (data.lifeguards && Array.isArray(data.lifeguards)) {
            data.lifeguards.forEach(lg => {
                if (!existingLgNames.has(lg.name)) {
                    lifeguards.push({ ...lg, id: this.generateId() });
                    count++;
                }
            });
        }

        if (data.schedules && Array.isArray(data.schedules)) {
            schedules = [...schedules, ...data.schedules.map(s => ({ ...s, id: this.generateId() }))];
            count += data.schedules.length;
        }

        if (data.disinfections && Array.isArray(data.disinfections)) {
            disinfections = [...disinfections, ...data.disinfections.map(d => ({ ...d, id: this.generateId() }))];
            count += data.disinfections.length;
        }

        this.saveOpenDays(days);
        this.saveLifeguards(lifeguards);
        this.saveSchedules(schedules);
        this.saveDisinfections(disinfections);

        document.getElementById('import-modal').remove();
        this.showToast(`成功导入 ${count} 条数据`);
        this.renderOpenDays();
        this.renderLifeguards();
    }

    exportData() {
        const data = {
            exportTime: new Date().toISOString(),
            openDays: this.getOpenDays(),
            lifeguards: this.getLifeguards(),
            schedules: this.getSchedules(),
            disinfections: this.getDisinfections(),
            abnormalRecords: this.getAbnormalRecords()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `泳池管理数据_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('数据已导出');
    }

    clearAllData() {
        if (!confirm('⚠️ 此操作将清空所有数据，且无法恢复！确定继续吗？')) {
            return;
        }
        if (!confirm('再次确认：真的要清空所有数据吗？')) {
            return;
        }

        localStorage.removeItem(STORAGE_KEYS.OPEN_DAYS);
        localStorage.removeItem(STORAGE_KEYS.LIFEGUARDS);
        localStorage.removeItem(STORAGE_KEYS.SCHEDULES);
        localStorage.removeItem(STORAGE_KEYS.DISINFECTIONS);
        localStorage.removeItem(STORAGE_KEYS.ABNORMAL_RECORDS);

        this.initStorage();
        this.renderAll();
        this.showToast('所有数据已清空');
    }

    openHelpModal() {
        document.getElementById('help-modal').classList.remove('hidden');
    }

    initHelpContent() {
        document.getElementById('help-content').innerHTML = `
            <div class="help-section">
                <h3>📋 系统概述</h3>
                <p>小区泳池开放值守管理系统用于管理泳池开放前的各项准备工作，确保符合安全开放条件。核心流程：</p>
                <ol>
                    <li><strong>创建开放日</strong> - 在"开放日历"中设置计划开放的日期</li>
                    <li><strong>安排救生员</strong> - 在"救生员排班"中为每个时段安排值班人员</li>
                    <li><strong>记录消毒</strong> - 在"消毒记录"中登记消毒情况</li>
                    <li><strong>核对条件</strong> - 检查救生员、消毒、容量等条件是否满足</li>
                    <li><strong>开放/闭馆</strong> - 根据核对结果决定开放或闭馆</li>
                </ol>
            </div>

            <div class="help-section">
                <h3>🏃 快速上手</h3>
                <h4>1. 造数（准备测试数据）</h4>
                <ul>
                    <li>点击 <code>📅 批量创建</code>，选择日期范围和星期，批量生成开放日</li>
                    <li>在 <code>👥 救生员排班</code> Tab，点击 <code>📥 批量导入</code>，使用示例数据导入</li>
                    <li>选择日期，点击 <code>📋 加载排班</code>，勾选各时段的救生员</li>
                    <li>在 <code>🧼 消毒记录</code> Tab，点击 <code>➕ 记录消毒</code> 添加消毒记录</li>
                </ul>

                <h4>2. 处理（状态推进）</h4>
                <ul>
                    <li>在 <code>📅 开放日历</code> 中，点击 <code>✅ 核对条件</code> 进入核对状态</li>
                    <li>查看详情页的条件核对结果，确保所有条件通过</li>
                    <li>条件通过后点击 <code>🏊 确认开放</code></li>
                    <li>如有问题可点击 <code>🚫 临时闭馆</code> 并选择原因</li>
                    <li>开放结束后点击 <code>🏁 结束开放</code></li>
                </ul>

                <h4>3. 复核（异常处理）</h4>
                <ul>
                    <li>在 <code>⚠️ 异常处理</code> Tab，点击 <code>🔍 自动检测异常</code></li>
                    <li>或点击 <code>⚠️ 生成测试异常数据</code> 查看效果</li>
                    <li>查看三类异常：<code>🔄 重复数据</code>、<code>❌ 缺字段</code>、<code>✏️ 人工改错</code></li>
                    <li>对异常可 <code>✅ 标记已处理</code> 或 <code>✏️ 编辑修正</code></li>
                </ul>

                <h4>4. 导出</h4>
                <ul>
                    <li>点击顶部 <code>📤 导出数据</code> 下载 JSON 格式备份</li>
                    <li>数据保存在浏览器 localStorage，刷新页面不会丢失</li>
                    <li>可通过 <code>📥 导入数据</code> 恢复数据</li>
                </ul>
            </div>

            <div class="help-section">
                <h3>✅ 开放条件说明</h3>
                <p>泳池开放必须同时满足以下条件：</p>
                <ul>
                    <li><strong>救生员排班完整</strong> - 每个开放时段都要有持证救生员</li>
                    <li><strong>消毒记录齐全</strong> - 开放前必须有消毒记录</li>
                    <li><strong>容量设置合理</strong> - 最大容纳人数 > 0</li>
                    <li><strong>水温正常</strong> - 建议 24-28°C</li>
                </ul>
            </div>

            <div class="help-section">
                <h3>📊 状态流转</h3>
                <p><code>计划中</code> → <code>核对中</code> → (<code>已开放</code> / <code>临时闭馆</code>) → <code>已结束</code></p>
                <ul>
                    <li><strong>计划中</strong> - 初始状态，可编辑基本信息</li>
                    <li><strong>核对中</strong> - 开始核对开放条件</li>
                    <li><strong>已开放</strong> - 条件满足，确认开放</li>
                    <li><strong>临时闭馆</strong> - 条件不满足或突发情况</li>
                    <li><strong>已结束</strong> - 当日开放结束</li>
                </ul>
            </div>

            <div class="help-section">
                <h3>💡 使用提示</h3>
                <ul>
                    <li>数据存储在浏览器本地，清除浏览器数据会丢失</li>
                    <li>建议定期导出数据备份</li>
                    <li>救生员必须持证才能被排班</li>
                    <li>闭馆原因会记录在案，可在统计中查看</li>
                </ul>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new PoolManagementSystem();
});