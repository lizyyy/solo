const BatteryPage = {
    init() {
        this.bindEvents();
    },

    bindEvents() {
        document.querySelectorAll('.btn-battery').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const amount = parseInt(e.target.dataset.amount);
                this.updateBattery(action, amount);
            });
        });
    },

    render() {
        const battery = Storage.getBattery();
        this.updateDisplay(battery);
        this.renderLogs();
        HomePage.updateHeaderBattery();
    },

    updateDisplay(battery) {
        const percentageEl = document.getElementById('batteryPercentage');
        const statusEl = document.getElementById('batteryStatus');
        const fillEl = document.getElementById('batteryFill');
        const headerValue = document.getElementById('batteryValue');

        percentageEl.textContent = `${battery}%`;
        if (headerValue) {
            headerValue.textContent = `${battery}%`;
        }

        fillEl.style.width = `${battery}%`;

        if (battery <= 20) {
            statusEl.textContent = '电量过低，请减少社交';
            fillEl.classList.add('low');
        } else if (battery <= 50) {
            statusEl.textContent = '电量不足，注意休息';
            fillEl.classList.remove('low');
        } else if (battery <= 80) {
            statusEl.textContent = '电量正常，可正常社交';
            fillEl.classList.remove('low');
        } else {
            statusEl.textContent = '电量充足，状态良好';
            fillEl.classList.remove('low');
        }

        if (battery <= 20) {
            Toast.warning('社交电量过低！建议减少不必要的社交，给自己一些独处时间恢复能量。');
        }
    },

    updateBattery(action, amount) {
        const newValue = Storage.updateBattery(action, amount);
        this.updateDisplay(newValue);
        this.renderLogs();
        Toast.success(`电量${action === 'consume' ? '消耗' : '恢复'}：${action === 'consume' ? '-' : '+'}${amount}%`);
    },

    renderLogs() {
        const logs = Storage.getBatteryLogs();
        const container = document.getElementById('batteryLog');

        if (logs.length === 0) {
            container.innerHTML = '<p class="empty-state">暂无电量记录</p>';
            return;
        }

        let html = '';
        logs.slice(0, 20).forEach(log => {
            const actionText = log.action === 'consume' ? '消耗' : '恢复';
            const amountPrefix = log.action === 'consume' ? '-' : '+';

            html += `
                <div class="log-card">
                    <div class="log-info">
                        <div class="log-action ${log.action}">
                            ${log.action === 'consume' ? '🔋 社交消耗' : '⚡ 电量恢复'}
                        </div>
                        <div class="log-time">${Utils.formatDateTime(log.timestamp)}</div>
                    </div>
                    <div class="log-change ${log.action}">
                        ${amountPrefix}${log.amount}%
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    BatteryPage.init();
});
