class App {
    constructor() {
        this.children = [];
        this.courses = [];
        this.packages = [];
        this.currentPackageId = null;
        this.init();
    }

    async init() {
        this.bindNavigation();
        this.bindEvents();
        this.setDefaultDates();
        await this.loadInitialData();
    }

    bindNavigation() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
                
                e.target.classList.add('active');
                const viewId = e.target.dataset.view + '-view';
                document.getElementById(viewId).classList.add('active');
                
                await this.onViewChange(e.target.dataset.view);
            });
        });
    }

    async onViewChange(view) {
        switch(view) {
            case 'dashboard':
                await this.loadDashboard();
                break;
            case 'packages':
                await this.loadPackages();
                break;
            case 'attendance':
                await this.loadAttendanceData();
                break;
            case 'leave':
                await this.loadLeaveData();
                break;
        }
    }

    bindEvents() {
        document.getElementById('attendance-form').addEventListener('submit', (e) => this.handleAttendance(e));
        document.getElementById('leave-form').addEventListener('submit', (e) => this.handleLeave(e));
        document.getElementById('freeze-form').addEventListener('submit', (e) => this.handleFreeze(e));
        document.getElementById('add-package-btn').addEventListener('click', () => this.showPackageModal());
        document.getElementById('export-packages-btn').addEventListener('click', () => this.exportPackages());
        document.getElementById('load-reconciliation-btn').addEventListener('click', () => this.loadReconciliation());
        document.getElementById('export-reconciliation-btn').addEventListener('click', () => this.exportReconciliation());
        
        document.getElementById('attendance-package').addEventListener('change', (e) => this.onPackageSelect(e, 'attendance'));
        document.getElementById('reconciliation-package').addEventListener('change', (e) => {
            this.currentPackageId = e.target.value ? parseInt(e.target.value) : null;
            document.getElementById('export-reconciliation-btn').style.display = e.target.value ? 'inline-block' : 'none';
            document.getElementById('reconciliation-content').style.display = 'none';
        });

        document.querySelector('.modal-close').addEventListener('click', () => this.hideModal());
        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target.id === 'modal') this.hideModal();
        });
    }

    setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('attendance-date').value = today;
        document.getElementById('leave-date').value = today;
        document.getElementById('freeze-start').value = today;
    }

    async loadInitialData() {
        await Promise.all([
            this.loadChildren(),
            this.loadCourses(),
            this.loadPackages()
        ]);
        await this.loadDashboard();
        this.populateSelects();
    }

    async loadChildren() {
        try {
            const res = await fetch('/api/children');
            this.children = await res.json();
        } catch (err) {
            console.error('加载孩子数据失败:', err);
        }
    }

    async loadCourses() {
        try {
            const res = await fetch('/api/courses');
            this.courses = await res.json();
        } catch (err) {
            console.error('加载课程数据失败:', err);
        }
    }

    async loadPackages() {
        try {
            const res = await fetch('/api/packages');
            this.packages = await res.json();
            this.renderPackagesTable();
        } catch (err) {
            console.error('加载课包数据失败:', err);
        }
    }

    async loadDashboard() {
        try {
            const res = await fetch('/api/dashboard');
            const data = await res.json();
            
            document.getElementById('stat-total-packages').textContent = data.total_packages;
            document.getElementById('stat-active-packages').textContent = data.active_packages;
            document.getElementById('stat-frozen-packages').textContent = data.frozen_packages;
            document.getElementById('stat-total-attendances').textContent = data.total_attendances;
            
            this.renderActivities(data.recent_activities);
        } catch (err) {
            console.error('加载仪表盘失败:', err);
        }
    }

    renderActivities(activities) {
        const container = document.getElementById('activity-list');
        
        if (activities.length === 0) {
            container.innerHTML = '<p class="empty-state">暂无活动记录</p>';
            return;
        }
        
        container.innerHTML = activities.map(a => `
            <div class="activity-item">
                <div class="activity-info">
                    <span class="activity-type activity-type-${a.record_type}">${a.type_name}</span>
                    <strong>${a.action_name}</strong>
                    ${a.details ? `<div class="activity-details">${this.formatDetails(a.details)}</div>` : ''}
                </div>
                <div class="activity-time">${this.formatTime(a.timestamp)}</div>
            </div>
        `).join('');
    }

    formatDetails(details) {
        try {
            const obj = JSON.parse(details);
            return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join(' | ');
        } catch {
            return details;
        }
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN');
    }

    renderPackagesTable() {
        const tbody = document.getElementById('packages-table-body');
        
        if (this.packages.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="empty-state">暂无课包数据</td></tr>';
            return;
        }
        
        tbody.innerHTML = this.packages.map(pkg => `
            <tr>
                <td>${pkg.child_name}</td>
                <td>${pkg.course_name}</td>
                <td>${pkg.total_classes}</td>
                <td>${pkg.used_classes}</td>
                <td>${pkg.frozen_classes}</td>
                <td><strong>${pkg.remaining_classes}</strong></td>
                <td>${this.getStatusBadge(pkg.computed_status)}</td>
                <td>${pkg.purchase_date}</td>
                <td>${pkg.expire_date || '-'}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="app.viewPackageHistory(${pkg.id})">历史</button>
                </td>
            </tr>
        `).join('');
    }

    getStatusBadge(status) {
        const statusMap = {
            'active': { text: '正常', class: 'status-active' },
            'frozen': { text: '冻结', class: 'status-frozen' },
            'completed': { text: '已完成', class: 'status-completed' },
            'expired': { text: '已过期', class: 'status-expired' },
            'expiring_soon': { text: '即将到期', class: 'status-expiring-soon' },
            'low_remaining': { text: '余量不足', class: 'status-low-remaining' }
        };
        
        const s = statusMap[status] || { text: status, class: 'status-active' };
        return `<span class="status-badge ${s.class}">${s.text}</span>`;
    }

    populateSelects() {
        const activePackages = this.packages.filter(p => p.computed_status !== 'completed' && p.computed_status !== 'expired');
        
        const selectOptions = activePackages.map(p => 
            `<option value="${p.id}">${p.child_name} - ${p.course_name} (剩${p.remaining_classes}节)</option>`
        ).join('');
        
        document.getElementById('attendance-package').innerHTML = '<option value="">请选择...</option>' + selectOptions;
        document.getElementById('leave-package').innerHTML = '<option value="">请选择...</option>' + selectOptions;
        document.getElementById('freeze-package').innerHTML = '<option value="">请选择...</option>' + selectOptions;
        document.getElementById('reconciliation-package').innerHTML = '<option value="">请选择...</option>' + 
            this.packages.map(p => `<option value="${p.id}">${p.child_name} - ${p.course_name}</option>`).join('');
    }

    async loadAttendanceData() {
        await this.loadPackages();
        this.populateSelects();
    }

    async loadLeaveData() {
        await this.loadPackages();
        this.populateSelects();
        await this.loadFreezes();
    }

    async loadFreezes() {
        try {
            const allFreezes = [];
            for (const pkg of this.packages) {
                const res = await fetch(`/api/packages/${pkg.id}/freezes`);
                const freezes = await res.json();
                freezes.forEach(f => {
                    f.child_name = pkg.child_name;
                    f.course_name = pkg.course_name;
                    allFreezes.push(f);
                });
            }
            
            const activeFreezes = allFreezes.filter(f => f.status === 'active');
            const tbody = document.getElementById('freezes-table-body');
            
            if (activeFreezes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="empty-state">暂无冻结记录</td></tr>';
                return;
            }
            
            tbody.innerHTML = activeFreezes.map(f => `
                <tr>
                    <td>${f.child_name}</td>
                    <td>${f.course_name}</td>
                    <td>${f.start_date}</td>
                    <td>${f.end_date || '-'}</td>
                    <td>${f.classes_frozen}</td>
                    <td>${this.getStatusBadge(f.status === 'active' ? 'frozen' : 'completed')}</td>
                    <td>
                        <button class="btn btn-success btn-sm" onclick="app.unfreeze(${f.id})">解冻</button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('加载冻结记录失败:', err);
        }
    }

    async onPackageSelect(e, type) {
        const packageId = e.target.value;
        if (!packageId) {
            document.getElementById('attendance-package-info').style.display = 'none';
            return;
        }
        
        const pkg = this.packages.find(p => p.id === parseInt(packageId));
        if (!pkg) return;
        
        if (type === 'attendance') {
            this.showPackageInfo(pkg);
        }
    }

    showPackageInfo(pkg) {
        const info = document.getElementById('attendance-package-info');
        info.style.display = 'block';
        
        document.getElementById('info-child').textContent = pkg.child_name;
        document.getElementById('info-course').textContent = pkg.course_name;
        document.getElementById('info-total').textContent = pkg.total_classes;
        document.getElementById('info-used').textContent = pkg.used_classes;
        document.getElementById('info-frozen').textContent = pkg.frozen_classes;
        document.getElementById('info-remaining').textContent = pkg.remaining_classes;
        document.getElementById('info-status').innerHTML = this.getStatusBadge(pkg.computed_status);
        
        if (pkg.computed_status === 'frozen') {
            alert('该课包已冻结，无法签到');
        }
    }

    async handleAttendance(e) {
        e.preventDefault();
        
        const packageId = document.getElementById('attendance-package').value;
        const classDate = document.getElementById('attendance-date').value;
        const classTime = document.getElementById('attendance-time').value;
        const note = document.getElementById('attendance-note').value;
        
        if (!packageId || !classDate) {
            alert('请选择课包和上课日期');
            return;
        }
        
        try {
            const res = await fetch('/api/attendances', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ package_id: parseInt(packageId), class_date: classDate, class_time: classTime, note })
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            
            alert('签到成功！');
            document.getElementById('attendance-form').reset();
            this.setDefaultDates();
            document.getElementById('attendance-package-info').style.display = 'none';
            
            await this.loadInitialData();
        } catch (err) {
            alert('签到失败: ' + err.message);
        }
    }

    async handleLeave(e) {
        e.preventDefault();
        
        const packageId = document.getElementById('leave-package').value;
        const leaveDate = document.getElementById('leave-date').value;
        const classesCount = document.getElementById('leave-count').value;
        const reason = document.getElementById('leave-reason').value;
        
        if (!packageId || !leaveDate) {
            alert('请选择课包和请假日期');
            return;
        }
        
        try {
            const res = await fetch('/api/leaves', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    package_id: parseInt(packageId), 
                    leave_date: leaveDate, 
                    classes_count: parseInt(classesCount), 
                    reason 
                })
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            
            alert('请假提交成功！');
            document.getElementById('leave-form').reset();
            this.setDefaultDates();
            document.getElementById('leave-count').value = 1;
            
            await this.loadInitialData();
        } catch (err) {
            alert('请假失败: ' + err.message);
        }
    }

    async handleFreeze(e) {
        e.preventDefault();
        
        const packageId = document.getElementById('freeze-package').value;
        const startDate = document.getElementById('freeze-start').value;
        const endDate = document.getElementById('freeze-end').value;
        const reason = document.getElementById('freeze-reason').value;
        
        if (!packageId || !startDate) {
            alert('请选择课包和冻结开始日期');
            return;
        }
        
        if (!confirm('确定要冻结此课包吗？冻结后所有剩余课时将被冻结，无法签到。')) {
            return;
        }
        
        try {
            const res = await fetch('/api/freezes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    package_id: parseInt(packageId), 
                    start_date: startDate, 
                    end_date: endDate, 
                    reason 
                })
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            
            alert('冻结成功！');
            document.getElementById('freeze-form').reset();
            this.setDefaultDates();
            
            await this.loadInitialData();
        } catch (err) {
            alert('冻结失败: ' + err.message);
        }
    }

    async unfreeze(freezeId) {
        if (!confirm('确定要解冻此课包吗？')) return;
        
        try {
            const res = await fetch(`/api/freezes/${freezeId}/unfreeze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            
            alert('解冻成功！');
            await this.loadInitialData();
        } catch (err) {
            alert('解冻失败: ' + err.message);
        }
    }

    showPackageModal() {
        if (this.children.length === 0 || this.courses.length === 0) {
            alert('请先添加孩子和课程数据');
            return;
        }
        
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modal-body');
        
        const today = new Date().toISOString().split('T')[0];
        const sixMonthsLater = new Date();
        sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
        const expireDefault = sixMonthsLater.toISOString().split('T')[0];
        
        modalBody.innerHTML = `
            <h2>购买新课包</h2>
            <form id="package-form">
                <div class="form-group">
                    <label>孩子 *</label>
                    <select id="modal-child" required>
                        <option value="">请选择...</option>
                        ${this.children.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>课程 *</label>
                    <select id="modal-course" required>
                        <option value="">请选择...</option>
                        ${this.courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>总课时 *</label>
                    <input type="number" id="modal-classes" value="12" min="1" required>
                </div>
                <div class="form-group">
                    <label>购买日期 *</label>
                    <input type="date" id="modal-purchase-date" value="${today}" required>
                </div>
                <div class="form-group">
                    <label>到期日期</label>
                    <input type="date" id="modal-expire-date" value="${expireDefault}">
                </div>
                <div class="form-group full-width">
                    <button type="submit" class="btn btn-primary btn-large">确认购买</button>
                </div>
            </form>
        `;
        
        document.getElementById('package-form').addEventListener('submit', (e) => this.handlePackageCreate(e));
        modal.classList.add('active');
    }

    async handlePackageCreate(e) {
        e.preventDefault();
        
        const childId = document.getElementById('modal-child').value;
        const courseId = document.getElementById('modal-course').value;
        const classes = document.getElementById('modal-classes').value;
        const purchaseDate = document.getElementById('modal-purchase-date').value;
        const expireDate = document.getElementById('modal-expire-date').value;
        
        if (!childId || !courseId || !classes || !purchaseDate) {
            alert('请填写所有必填项');
            return;
        }
        
        try {
            const res = await fetch('/api/packages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    child_id: parseInt(childId),
                    course_id: parseInt(courseId),
                    total_classes: parseInt(classes),
                    purchase_date: purchaseDate,
                    expire_date: expireDate || null
                })
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            
            alert('课包购买成功！');
            this.hideModal();
            await this.loadInitialData();
        } catch (err) {
            alert('购买失败: ' + err.message);
        }
    }

    async viewPackageHistory(packageId) {
        try {
            const [pkgRes, attRes, leaveRes, freezeRes, histRes] = await Promise.all([
                fetch(`/api/packages/${packageId}`),
                fetch(`/api/packages/${packageId}/attendances`),
                fetch(`/api/packages/${packageId}/leaves`),
                fetch(`/api/packages/${packageId}/freezes`),
                fetch(`/api/packages/${packageId}/history`)
            ]);
            
            const pkg = await pkgRes.json();
            const attendances = await attRes.json();
            const leaves = await leaveRes.json();
            const freezes = await freezeRes.json();
            const history = await histRes.json();
            
            const modal = document.getElementById('modal');
            const modalBody = document.getElementById('modal-body');
            
            modalBody.innerHTML = `
                <h2>课包详情 - ${pkg.child_name} / ${pkg.course_name}</h2>
                
                <div class="reconciliation-summary" style="margin-bottom: 20px;">
                    <div class="summary-item"><span class="summary-label">总课时</span><span class="summary-value">${pkg.total_classes}</span></div>
                    <div class="summary-item"><span class="summary-label">已消课</span><span class="summary-value">${pkg.used_classes}</span></div>
                    <div class="summary-item"><span class="summary-label">冻结中</span><span class="summary-value">${pkg.frozen_classes}</span></div>
                    <div class="summary-item"><span class="summary-label">剩余</span><span class="summary-value">${pkg.remaining_classes}</span></div>
                </div>
                
                <h3>签到记录 (${attendances.length})</h3>
                <div class="table-container" style="margin-bottom: 20px;">
                    <table class="data-table">
                        <thead><tr><th>日期</th><th>时间</th><th>备注</th></tr></thead>
                        <tbody>
                            ${attendances.length ? attendances.map(a => `<tr><td>${a.class_date}</td><td>${a.class_time || '-'}</td><td>${a.note || '-'}</td></tr>`).join('') : '<tr><td colspan="3" class="empty-state">暂无</td></tr>'}
                        </tbody>
                    </table>
                </div>
                
                <h3>请假记录 (${leaves.length})</h3>
                <div class="table-container" style="margin-bottom: 20px;">
                    <table class="data-table">
                        <thead><tr><th>日期</th><th>课时</th><th>原因</th></tr></thead>
                        <tbody>
                            ${leaves.length ? leaves.map(l => `<tr><td>${l.leave_date}</td><td>${l.classes_count}</td><td>${l.reason || '-'}</td></tr>`).join('') : '<tr><td colspan="3" class="empty-state">暂无</td></tr>'}
                        </tbody>
                    </table>
                </div>
                
                <h3>操作历史 (${history.length})</h3>
                <div class="table-container">
                    <table class="data-table">
                        <thead><tr><th>时间</th><th>操作</th><th>详情</th></tr></thead>
                        <tbody>
                            ${history.length ? history.map(h => `<tr><td>${this.formatTime(h.timestamp)}</td><td>${h.action}</td><td>${h.details ? this.formatDetails(h.details) : '-'}</td></tr>`).join('') : '<tr><td colspan="3" class="empty-state">暂无</td></tr>'}
                        </tbody>
                    </table>
                </div>
            `;
            
            modal.classList.add('active');
        } catch (err) {
            console.error('加载课包详情失败:', err);
            alert('加载失败');
        }
    }

    hideModal() {
        document.getElementById('modal').classList.remove('active');
    }

    async loadReconciliation() {
        const packageId = document.getElementById('reconciliation-package').value;
        if (!packageId) {
            alert('请选择课包');
            return;
        }
        
        try {
            const [pkgRes, attRes, leaveRes, histRes] = await Promise.all([
                fetch(`/api/packages/${packageId}`),
                fetch(`/api/packages/${packageId}/attendances`),
                fetch(`/api/packages/${packageId}/leaves`),
                fetch(`/api/packages/${packageId}/history`)
            ]);
            
            const pkg = await pkgRes.json();
            const attendances = await attRes.json();
            const leaves = await leaveRes.json();
            const history = await histRes.json();
            
            this.currentPackageId = parseInt(packageId);
            
            document.getElementById('reconciliation-summary').innerHTML = `
                <div class="summary-item"><span class="summary-label">孩子</span><span class="summary-value">${pkg.child_name}</span></div>
                <div class="summary-item"><span class="summary-label">课程</span><span class="summary-value">${pkg.course_name}</span></div>
                <div class="summary-item"><span class="summary-label">总课时</span><span class="summary-value">${pkg.total_classes}</span></div>
                <div class="summary-item"><span class="summary-label">已消课</span><span class="summary-value">${pkg.used_classes}</span></div>
                <div class="summary-item"><span class="summary-label">冻结中</span><span class="summary-value">${pkg.frozen_classes}</span></div>
                <div class="summary-item"><span class="summary-label">剩余课时</span><span class="summary-value">${pkg.remaining_classes}</span></div>
                <div class="summary-item"><span class="summary-label">购买日期</span><span class="summary-value">${pkg.purchase_date}</span></div>
                <div class="summary-item"><span class="summary-label">到期日期</span><span class="summary-value">${pkg.expire_date || '无'}</span></div>
                <div class="summary-item"><span class="summary-label">当前状态</span><span class="summary-value">${this.getStatusText(pkg.computed_status)}</span></div>
            `;
            
            document.getElementById('attendances-body').innerHTML = attendances.length ? 
                attendances.map(a => `<tr><td>${a.class_date}</td><td>${a.class_time || '-'}</td><td>${a.status}</td><td>${a.note || '-'}</td></tr>`).join('') :
                '<tr><td colspan="4" class="empty-state">暂无签到记录</td></tr>';
            
            document.getElementById('leaves-body').innerHTML = leaves.length ? 
                leaves.map(l => `<tr><td>${l.leave_date}</td><td>${l.classes_count}</td><td>${l.reason || '-'}</td></tr>`).join('') :
                '<tr><td colspan="3" class="empty-state">暂无请假记录</td></tr>';
            
            document.getElementById('history-body').innerHTML = history.length ? 
                history.map(h => `<tr><td>${this.formatTime(h.timestamp)}</td><td>${this.getActionText(h.action)}</td><td>${h.details ? this.formatDetails(h.details) : '-'}</td></tr>`).join('') :
                '<tr><td colspan="3" class="empty-state">暂无操作历史</td></tr>';
            
            document.getElementById('reconciliation-content').style.display = 'block';
            document.getElementById('export-reconciliation-btn').style.display = 'inline-block';
        } catch (err) {
            console.error('加载对账信息失败:', err);
            alert('加载失败');
        }
    }

    getStatusText(status) {
        const map = {
            'active': '正常',
            'frozen': '冻结',
            'completed': '已完成',
            'expired': '已过期',
            'expiring_soon': '即将到期',
            'low_remaining': '余量不足'
        };
        return map[status] || status;
    }

    getActionText(action) {
        const map = {
            'create': '创建',
            'consume': '消课',
            'freeze': '冻结',
            'unfreeze': '解冻',
            'freeze_leave': '请假冻结'
        };
        return map[action] || action;
    }

    exportPackages() {
        window.location.href = '/api/export/packages';
    }

    exportReconciliation() {
        if (this.currentPackageId) {
            window.location.href = `/api/export/reconciliation/${this.currentPackageId}`;
        }
    }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new App();
});
