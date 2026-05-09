const AttendanceUI = {
    app: null,
    
    init: function(app) {
        this.app = app;
        this.bindEvents();
        this.initDate();
    },
    
    bindEvents: function() {
        document.getElementById('rehearsal-date').addEventListener('change', (e) => {
            this.app.setRehearsalDate(e.target.value);
        });
        
        document.getElementById('mark-all-present').addEventListener('click', () => this.markAllPresent());
        document.getElementById('mark-all-absent').addEventListener('click', () => this.markAllAbsent());
    },
    
    initDate: function() {
        const dateInput = document.getElementById('rehearsal-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = this.app.state.rehearsalDate;
        }
    },
    
    markAllPresent: function() {
        const members = this.app.state.members;
        members.forEach(member => {
            this.app.setAttendance(member.id, true);
        });
        this.render();
        this.showToast('已标记所有成员为出勤', 'success');
    },
    
    markAllAbsent: function() {
        const members = this.app.state.members;
        members.forEach(member => {
            this.app.setAttendance(member.id, false);
        });
        this.render();
        this.showToast('已标记所有成员为缺勤', 'success');
    },
    
    toggleAttendance: function(memberId) {
        const currentStatus = this.app.state.attendance[memberId];
        const isPresent = currentStatus === undefined || currentStatus === true;
        this.app.setAttendance(memberId, !isPresent);
        this.render();
    },
    
    render: function() {
        const members = this.app.state.members;
        const attendance = this.app.state.attendance;
        const container = document.getElementById('attendance-list');
        const summaryContainer = document.getElementById('attendance-summary');
        
        if (members.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>暂无成员，请先在成员管理中添加成员</p>
                </div>
            `;
            summaryContainer.innerHTML = '';
            return;
        }
        
        let presentCount = 0;
        let absentCount = 0;
        let unknownCount = 0;
        
        members.forEach(member => {
            const status = attendance[member.id];
            if (status === true || status === undefined) {
                presentCount++;
            } else {
                absentCount++;
            }
            if (status === undefined) {
                unknownCount++;
            }
        });
        
        summaryContainer.innerHTML = `
            <div class="summary-item">
                <div class="summary-number">${members.length}</div>
                <div class="summary-label">总人数</div>
            </div>
            <div class="summary-item">
                <div class="summary-number" style="color: var(--success-color)">${presentCount}</div>
                <div class="summary-label">出勤</div>
            </div>
            <div class="summary-item">
                <div class="summary-number" style="color: var(--error-color)">${absentCount}</div>
                <div class="summary-label">缺勤</div>
            </div>
            ${unknownCount > 0 ? `
            <div class="summary-item">
                <div class="summary-number" style="color: var(--warning-color)">${unknownCount}</div>
                <div class="summary-label">未确认</div>
            </div>
            ` : ''}
        `;
        
        container.innerHTML = members.map(member => {
            const status = attendance[member.id];
            const isPresent = status === undefined || status === true;
            const statusLabel = isPresent ? '出勤' : '缺勤';
            const statusClass = isPresent ? 'present' : 'absent';
            
            return `
                <div class="attendance-item ${statusClass}">
                    <div class="attendance-member">
                        <div>
                            <strong>${member.name}</strong>
                            ${member.isCoreMember ? '<span class="core-badge" style="margin-left: 8px;">核心</span>' : ''}
                        </div>
                        <div class="attendance-voice">
                            ${Validation.formatVoiceRange(member.voiceLow, member.voiceHigh)}
                        </div>
                    </div>
                    <div class="attendance-status">
                        <button class="status-toggle ${statusClass}" 
                                onclick="AttendanceUI.toggleAttendance('${member.id}')">
                            ${statusLabel}
                        </button>
                        ${status === undefined ? '<span style="color: var(--warning-color); font-size: 12px;">(未确认)</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');
    },
    
    showToast: function(message, type = 'info') {
        if (typeof window.app !== 'undefined' && window.app.showToast) {
            window.app.showToast(message, type);
        }
    }
};
