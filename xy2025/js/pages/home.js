const HomePage = {
    render() {
        this.renderTodayOverview();
        this.updateHeaderBattery();
    },

    renderTodayOverview() {
        const container = document.getElementById('todayOverview');
        const todayReminders = Storage.getTodayReminders();

        if (todayReminders.length === 0) {
            container.innerHTML = '<p class="empty-state">暂无今日提醒</p>';
            return;
        }

        let html = '';
        todayReminders.forEach(reminder => {
            html += `
                <div class="reminder-card">
                    <div class="reminder-info">
                        <div class="reminder-title">${reminder.title}</div>
                        <div class="reminder-person">${reminder.personName}</div>
                        <div class="reminder-date">${reminder.notes || '今天'}</div>
                    </div>
                    <span class="reminder-countdown">今天</span>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    updateHeaderBattery() {
        const battery = Storage.getBattery();
        const batteryValue = document.getElementById('batteryValue');
        if (batteryValue) {
            batteryValue.textContent = `${battery}%`;
        }
    }
};
