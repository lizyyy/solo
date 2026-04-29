const RemindersPage = {
    init() {
        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('addReminderBtn').addEventListener('click', () => {
            this.showAddModal();
        });
    },

    render() {
        this.renderUpcoming();
        this.renderAll();
    },

    renderUpcoming() {
        const upcoming = Storage.getUpcomingReminders(7);
        const container = document.getElementById('upcomingReminders');

        if (upcoming.length === 0) {
            container.innerHTML = '<p class="empty-state">暂无近期提醒</p>';
            return;
        }

        let html = '';
        upcoming.forEach(reminder => {
            html += this.renderReminderCard(reminder, true);
        });

        container.innerHTML = html;
    },

    renderAll() {
        const reminders = Storage.getReminders().sort((a, b) => new Date(a.date) - new Date(b.date));
        const container = document.getElementById('allReminders');

        if (reminders.length === 0) {
            container.innerHTML = '<p class="empty-state">暂无提醒，点击上方按钮添加</p>';
            return;
        }

        let html = '';
        reminders.forEach(reminder => {
            html += this.renderReminderCard(reminder, false);
        });

        container.innerHTML = html;
        this.bindCardEvents();
    },

    renderReminderCard(reminder, isUpcoming = false) {
        const daysUntil = Utils.getDaysUntil(reminder.date);
        let countdownText = '';
        
        if (daysUntil < 0) {
            countdownText = '已过期';
        } else if (daysUntil === 0) {
            countdownText = '今天';
        } else if (daysUntil === 1) {
            countdownText = '明天';
        } else {
            countdownText = `${daysUntil}天后`;
        }

        let typeIcon = '';
        switch (reminder.type) {
            case 'birthday':
                typeIcon = '🎂';
                break;
            case 'holiday':
                typeIcon = '🎉';
                break;
            case 'favor':
                typeIcon = '🤝';
                break;
            default:
                typeIcon = '🔔';
        }

        return `
            <div class="reminder-card" data-id="${reminder.id}">
                <div class="reminder-info">
                    <div class="reminder-title">${typeIcon} ${reminder.title}</div>
                    <div class="reminder-person">${reminder.personName}</div>
                    <div class="reminder-date">${reminder.date}${reminder.notes ? ` | ${reminder.notes}` : ''}</div>
                </div>
                <span class="reminder-countdown">${countdownText}</span>
                ${!isUpcoming ? `
                    <div class="relationship-actions" style="margin-top: 12px;">
                        <button class="btn-edit" data-action="edit" data-id="${reminder.id}">编辑</button>
                        <button class="btn-delete" data-action="delete" data-id="${reminder.id}">删除</button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    bindCardEvents() {
        document.querySelectorAll('#allReminders button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const id = e.target.dataset.id;

                switch (action) {
                    case 'edit':
                        this.showEditModal(id);
                        break;
                    case 'delete':
                        this.deleteReminder(id);
                        break;
                }
            });
        });
    },

    showAddModal() {
        const content = this.getFormHtml();
        Modal.show({
            title: '添加提醒',
            content,
            confirmText: '添加',
            onConfirm: () => {
                return this.saveReminder();
            }
        });
    },

    showEditModal(id) {
        const reminders = Storage.getReminders();
        const reminder = reminders.find(r => r.id === id);
        
        if (!reminder) return;

        const content = this.getFormHtml(reminder);
        Modal.show({
            title: '编辑提醒',
            content,
            confirmText: '保存',
            onConfirm: () => {
                return this.saveReminder(id);
            }
        });
    },

    getFormHtml(data = {}) {
        return `
            <div class="form-group">
                <label>相关人员 *</label>
                <input type="text" class="text-input" id="reminderPersonName" value="${data.personName || ''}" placeholder="请输入姓名">
            </div>
            <div class="form-group">
                <label>提醒标题 *</label>
                <input type="text" class="text-input" id="reminderTitle" value="${data.title || ''}" placeholder="如：生日、节日问候">
            </div>
            <div class="form-group">
                <label>提醒类型</label>
                <select class="select-input" id="reminderType">
                    <option value="birthday" ${data.type === 'birthday' ? 'selected' : ''}>生日</option>
                    <option value="holiday" ${data.type === 'holiday' ? 'selected' : ''}>节日</option>
                    <option value="favor" ${data.type === 'favor' ? 'selected' : ''}>人情往来</option>
                    <option value="other" ${data.type === 'other' ? 'selected' : ''}>其他</option>
                </select>
            </div>
            <div class="form-group">
                <label>日期 *</label>
                <input type="date" class="text-input" id="reminderDate" value="${data.date || Utils.formatDate(new Date())}">
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea class="textarea-input" id="reminderNotes" placeholder="其他备注信息...">${data.notes || ''}</textarea>
            </div>
        `;
    },

    saveReminder(id = null) {
        const personName = document.getElementById('reminderPersonName').value.trim();
        const title = document.getElementById('reminderTitle').value.trim();
        const type = document.getElementById('reminderType').value;
        const date = document.getElementById('reminderDate').value;
        const notes = document.getElementById('reminderNotes').value.trim();

        if (!personName || !title || !date) {
            Toast.error('请填写必填项');
            return false;
        }

        const reminder = {
            personName,
            title,
            type,
            date,
            notes
        };

        if (id) {
            Storage.updateReminder(id, reminder);
            Toast.success('更新成功');
        } else {
            Storage.addReminder(reminder);
            Toast.success('添加成功');
        }

        this.render();
        HomePage.render();
        return true;
    },

    deleteReminder(id) {
        Modal.confirm('确定要删除这条提醒吗？', () => {
            Storage.deleteReminder(id);
            Toast.success('删除成功');
            this.render();
            HomePage.render();
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    RemindersPage.init();
});
