const AvoidPage = {
    currentFilter: 'all',

    init() {
        this.bindEvents();
    },

    bindEvents() {
        const filterSelect = document.getElementById('avoidPersonFilter');
        filterSelect.addEventListener('change', (e) => {
            this.currentFilter = e.target.value;
            this.render();
        });
    },

    updatePersonFilter() {
        const relationships = Storage.getRelationships();
        const filterSelect = document.getElementById('avoidPersonFilter');
        
        let optionsHtml = '<option value="all">全部人员</option>';
        relationships.forEach(rel => {
            optionsHtml += `<option value="${rel.id}" ${this.currentFilter === rel.id ? 'selected' : ''}>${rel.name}</option>`;
        });
        
        filterSelect.innerHTML = optionsHtml;
    },

    render() {
        this.updatePersonFilter();
        
        let avoidList = Storage.getAvoidList();
        
        if (this.currentFilter !== 'all') {
            avoidList = avoidList.filter(item => item.personId === this.currentFilter);
        }

        const container = document.getElementById('avoidList');

        if (avoidList.length === 0) {
            container.innerHTML = '<p class="empty-state">暂无避雷记录，可在关系管理中添加</p>';
            return;
        }

        let html = '';
        avoidList.forEach(item => {
            html += this.renderAvoidCard(item);
        });

        container.innerHTML = html;
        this.bindCardEvents();
    },

    renderAvoidCard(item) {
        const typeLabel = Utils.getAvoidTypeLabel(item.type);
        
        return `
            <div class="avoid-card" data-id="${item.id}">
                <div class="avoid-person">
                    ${item.personName}
                    <span class="avoid-type">${typeLabel}</span>
                </div>
                <div class="avoid-content">${item.content}</div>
                <div class="relationship-actions" style="margin-top: 12px;">
                    <button class="btn-edit" data-action="edit" data-id="${item.id}">编辑</button>
                    <button class="btn-delete" data-action="delete" data-id="${item.id}">删除</button>
                </div>
            </div>
        `;
    },

    bindCardEvents() {
        document.querySelectorAll('.avoid-card button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const id = e.target.dataset.id;

                switch (action) {
                    case 'edit':
                        this.showEditModal(id);
                        break;
                    case 'delete':
                        this.deleteAvoidItem(id);
                        break;
                }
            });
        });
    },

    showEditModal(id) {
        const avoidList = Storage.getAvoidList();
        const item = avoidList.find(item => item.id === id);
        
        if (!item) return;

        const relationships = Storage.getRelationships();
        let personOptions = '';
        relationships.forEach(rel => {
            personOptions += `<option value="${rel.id}" ${item.personId === rel.id ? 'selected' : ''}>${rel.name}</option>`;
        });

        const content = `
            <div class="form-group">
                <label>人员</label>
                <select class="select-input" id="editAvoidPerson">
                    ${personOptions}
                </select>
            </div>
            <div class="form-group">
                <label>避雷类型</label>
                <select class="select-input" id="editAvoidType">
                    <option value="dislike" ${item.type === 'dislike' ? 'selected' : ''}>讨厌的事物</option>
                    <option value="forbidden" ${item.type === 'forbidden' ? 'selected' : ''}>禁忌话题</option>
                    <option value="joke" ${item.type === 'joke' ? 'selected' : ''}>不能开的玩笑</option>
                    <option value="sensitive" ${item.type === 'sensitive' ? 'selected' : ''}>敏感点</option>
                    <option value="conflict" ${item.type === 'conflict' ? 'selected' : ''}>过往矛盾</option>
                </select>
            </div>
            <div class="form-group">
                <label>避雷内容</label>
                <textarea class="textarea-input" id="editAvoidContent">${item.content}</textarea>
            </div>
        `;

        Modal.show({
            title: '编辑避雷记录',
            content,
            confirmText: '保存',
            onConfirm: () => {
                const personId = document.getElementById('editAvoidPerson').value;
                const person = relationships.find(r => r.id === personId);
                const type = document.getElementById('editAvoidType').value;
                const content = document.getElementById('editAvoidContent').value.trim();

                if (!content) {
                    Toast.error('请输入避雷内容');
                    return false;
                }

                Storage.updateAvoidItem(id, {
                    personId,
                    personName: person ? person.name : item.personName,
                    type,
                    content
                });

                Toast.success('更新成功');
                this.render();
                return true;
            }
        });
    },

    deleteAvoidItem(id) {
        Modal.confirm('确定要删除这条避雷记录吗？', () => {
            Storage.deleteAvoidItem(id);
            Toast.success('删除成功');
            this.render();
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AvoidPage.init();
});
