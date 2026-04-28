const FavorsPage = {
    init() {
        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('addFavorBtn').addEventListener('click', () => {
            this.showAddModal();
        });
    },

    render() {
        this.renderStats();
        this.renderList();
    },

    renderStats() {
        const stats = Storage.getFavorsStats();
        
        document.getElementById('totalGiven').textContent = Utils.formatAmount(stats.totalGiven);
        document.getElementById('totalReceived').textContent = Utils.formatAmount(stats.totalReceived);
        
        const netBalanceEl = document.getElementById('netBalance');
        netBalanceEl.textContent = Utils.formatAmount(Math.abs(stats.netBalance));
        netBalanceEl.className = `stat-value ${stats.netBalance >= 0 ? 'positive' : 'negative'}`;
    },

    renderList() {
        const favors = Storage.getFavors().sort((a, b) => new Date(b.date) - new Date(a.date));
        const container = document.getElementById('favorsList');

        if (favors.length === 0) {
            container.innerHTML = '<p class="empty-state">暂无人情记录，点击上方按钮添加</p>';
            return;
        }

        let html = '';
        favors.forEach(favor => {
            html += this.renderFavorCard(favor);
        });

        container.innerHTML = html;
        this.bindCardEvents();
    },

    renderFavorCard(favor) {
        const typeClass = favor.type === 'given' ? 'given' : 'received';
        const typeLabel = favor.type === 'given' ? '送出' : '收到';
        const amountPrefix = favor.type === 'given' ? '-' : '+';

        return `
            <div class="favor-card ${typeClass}" data-id="${favor.id}">
                <div class="favor-header">
                    <span class="favor-person">${favor.personName} - ${favor.event}</span>
                    <span class="favor-amount">${amountPrefix}${Utils.formatAmount(favor.amount)}</span>
                </div>
                <div class="favor-meta">
                    <span>${typeLabel}</span>
                    <span> | </span>
                    <span>${favor.date}</span>
                </div>
                ${favor.notes ? `<div class="favor-note">${favor.notes}</div>` : ''}
                <div class="relationship-actions">
                    <button class="btn-edit" data-action="edit" data-id="${favor.id}">编辑</button>
                    <button class="btn-delete" data-action="delete" data-id="${favor.id}">删除</button>
                </div>
            </div>
        `;
    },

    bindCardEvents() {
        document.querySelectorAll('.favor-card button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const id = e.target.dataset.id;

                switch (action) {
                    case 'edit':
                        this.showEditModal(id);
                        break;
                    case 'delete':
                        this.deleteFavor(id);
                        break;
                }
            });
        });
    },

    showAddModal() {
        const content = this.getFormHtml();
        Modal.show({
            title: '记录人情',
            content,
            confirmText: '添加',
            onConfirm: () => {
                return this.saveFavor();
            }
        });
    },

    showEditModal(id) {
        const favors = Storage.getFavors();
        const favor = favors.find(f => f.id === id);
        
        if (!favor) return;

        const content = this.getFormHtml(favor);
        Modal.show({
            title: '编辑人情记录',
            content,
            confirmText: '保存',
            onConfirm: () => {
                return this.saveFavor(id);
            }
        });
    },

    getFormHtml(data = {}) {
        return `
            <div class="form-group">
                <label>对方姓名 *</label>
                <input type="text" class="text-input" id="favorPersonName" value="${data.personName || ''}" placeholder="请输入姓名">
            </div>
            <div class="form-group">
                <label>类型 *</label>
                <select class="select-input" id="favorType">
                    <option value="received" ${data.type === 'received' ? 'selected' : ''}>收到</option>
                    <option value="given" ${data.type === 'given' ? 'selected' : ''}>送出</option>
                </select>
            </div>
            <div class="form-group">
                <label>事由 *</label>
                <input type="text" class="text-input" id="favorEvent" value="${data.event || ''}" placeholder="如：结婚红包、生日礼物">
            </div>
            <div class="form-group">
                <label>金额/价值 *</label>
                <input type="number" class="text-input" id="favorAmount" value="${data.amount || ''}" placeholder="请输入金额">
            </div>
            <div class="form-group">
                <label>日期 *</label>
                <input type="date" class="text-input" id="favorDate" value="${data.date || Utils.formatDate(new Date())}">
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea class="textarea-input" id="favorNotes" placeholder="其他备注信息...">${data.notes || ''}</textarea>
            </div>
        `;
    },

    saveFavor(id = null) {
        const personName = document.getElementById('favorPersonName').value.trim();
        const type = document.getElementById('favorType').value;
        const event = document.getElementById('favorEvent').value.trim();
        const amount = parseFloat(document.getElementById('favorAmount').value);
        const date = document.getElementById('favorDate').value;
        const notes = document.getElementById('favorNotes').value.trim();

        if (!personName || !event || isNaN(amount) || !date) {
            Toast.error('请填写必填项');
            return false;
        }

        const favor = {
            personName,
            type,
            event,
            amount,
            date,
            notes
        };

        if (id) {
            Storage.updateFavor(id, favor);
            Toast.success('更新成功');
        } else {
            Storage.addFavor(favor);
            Toast.success('添加成功');
        }

        this.render();
        return true;
    },

    deleteFavor(id) {
        Modal.confirm('确定要删除这条人情记录吗？', () => {
            Storage.deleteFavor(id);
            Toast.success('删除成功');
            this.render();
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    FavorsPage.init();
});
