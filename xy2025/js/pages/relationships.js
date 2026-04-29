const RelationshipsPage = {
    currentCategory: 'all',

    init() {
        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('addRelationshipBtn').addEventListener('click', () => {
            this.showAddModal();
        });

        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchCategory(e.target.dataset.category);
            });
        });
    },

    switchCategory(category) {
        this.currentCategory = category;
        
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.category === category) {
                tab.classList.add('active');
            }
        });

        this.render();
    },

    render() {
        const relationships = Storage.getRelationships();
        const filtered = this.currentCategory === 'all' 
            ? relationships 
            : relationships.filter(r => r.category === this.currentCategory);

        const container = document.getElementById('relationshipsList');

        if (filtered.length === 0) {
            container.innerHTML = '<p class="empty-state">暂无关系记录，点击上方按钮添加</p>';
            return;
        }

        let html = '';
        filtered.forEach(relationship => {
            html += this.renderRelationshipCard(relationship);
        });

        container.innerHTML = html;
        this.bindCardEvents();
    },

    renderRelationshipCard(relationship) {
        const categoryLabel = Utils.getCategoryLabel(relationship.category);
        const avoidList = Storage.getAvoidList().filter(item => item.personId === relationship.id);
        
        let metaHtml = '';
        if (relationship.personality) {
            metaHtml += `<div class="meta-item">😊 ${relationship.personality}</div>`;
        }
        if (relationship.birthday) {
            metaHtml += `<div class="meta-item">🎂 ${relationship.birthday}</div>`;
        }
        if (relationship.taboo) {
            metaHtml += `<div class="meta-item">⚠️ ${relationship.taboo}</div>`;
        }

        let avoidHtml = '';
        if (avoidList.length > 0) {
            avoidHtml = '<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color);">';
            avoidHtml += '<p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px;">📋 避雷记录：</p>';
            avoidList.forEach(item => {
                const typeLabel = Utils.getAvoidTypeLabel(item.type);
                avoidHtml += `<div style="font-size: 13px; color: var(--text-primary); padding: 4px 0; border-left: 3px solid var(--warning-color); padding-left: 8px; margin-bottom: 4px;">
                    <span style="background: var(--warning-color); color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 6px;">${typeLabel}</span>
                    ${item.content}
                </div>`;
            });
            avoidHtml += '</div>';
        }

        return `
            <div class="relationship-card" data-id="${relationship.id}">
                <div class="relationship-header">
                    <span class="relationship-name">${relationship.name}</span>
                    <span class="relationship-category">${categoryLabel}</span>
                </div>
                ${metaHtml ? `<div class="relationship-meta">${metaHtml}</div>` : ''}
                ${relationship.notes ? `<div class="relationship-meta"><div class="meta-item">📝 ${relationship.notes}</div></div>` : ''}
                ${avoidHtml}
                <div class="relationship-actions">
                    <button class="btn-edit" data-action="edit" data-id="${relationship.id}">编辑</button>
                    <button class="btn-edit" data-action="add-avoid" data-id="${relationship.id}" data-name="${relationship.name}">添加避雷</button>
                    <button class="btn-delete" data-action="delete" data-id="${relationship.id}">删除</button>
                </div>
            </div>
        `;
    },

    bindCardEvents() {
        document.querySelectorAll('.relationship-card button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                const id = e.target.dataset.id;
                const name = e.target.dataset.name;

                switch (action) {
                    case 'edit':
                        this.showEditModal(id);
                        break;
                    case 'add-avoid':
                        this.showAddAvoidModal(id, name);
                        break;
                    case 'delete':
                        this.deleteRelationship(id);
                        break;
                }
            });
        });
    },

    showAddModal() {
        const content = this.getFormHtml();
        Modal.show({
            title: '添加关系',
            content,
            confirmText: '添加',
            onConfirm: () => {
                return this.saveRelationship();
            }
        });
    },

    showEditModal(id) {
        const relationships = Storage.getRelationships();
        const relationship = relationships.find(r => r.id === id);
        
        if (!relationship) return;

        const content = this.getFormHtml(relationship);
        Modal.show({
            title: '编辑关系',
            content,
            confirmText: '保存',
            onConfirm: () => {
                return this.saveRelationship(id);
            }
        });
    },

    getFormHtml(data = {}) {
        return `
            <div class="form-group">
                <label>姓名 *</label>
                <input type="text" class="text-input" id="formName" value="${data.name || ''}" placeholder="请输入姓名">
            </div>
            <div class="form-group">
                <label>关系分类 *</label>
                <select class="select-input" id="formCategory">
                    <option value="friend" ${data.category === 'friend' ? 'selected' : ''}>朋友</option>
                    <option value="colleague" ${data.category === 'colleague' ? 'selected' : ''}>同事</option>
                    <option value="family" ${data.category === 'family' ? 'selected' : ''}>家人</option>
                    <option value="romance" ${data.category === 'romance' ? 'selected' : ''}>暧昧</option>
                    <option value="elder" ${data.category === 'elder' ? 'selected' : ''}>长辈</option>
                    <option value="enemy" ${data.category === 'enemy' ? 'selected' : ''}>讨厌的人</option>
                </select>
            </div>
            <div class="form-group">
                <label>性格特点</label>
                <input type="text" class="text-input" id="formPersonality" value="${data.personality || ''}" placeholder="如：开朗、幽默、固执">
            </div>
            <div class="form-group">
                <label>雷点/禁忌</label>
                <textarea class="textarea-input" id="formTaboo" placeholder="不要拿他的XX开玩笑...">${data.taboo || ''}</textarea>
            </div>
            <div class="form-group">
                <label>生日</label>
                <input type="date" class="text-input" id="formBirthday" value="${data.birthday || ''}">
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea class="textarea-input" id="formNotes" placeholder="其他相处注意事项...">${data.notes || ''}</textarea>
            </div>
        `;
    },

    saveRelationship(id = null) {
        const name = document.getElementById('formName').value.trim();
        const category = document.getElementById('formCategory').value;
        const personality = document.getElementById('formPersonality').value.trim();
        const taboo = document.getElementById('formTaboo').value.trim();
        const birthday = document.getElementById('formBirthday').value;
        const notes = document.getElementById('formNotes').value.trim();

        if (!name) {
            Toast.error('请输入姓名');
            return false;
        }

        const relationship = {
            name,
            category,
            personality,
            taboo,
            birthday,
            notes
        };

        if (id) {
            Storage.updateRelationship(id, relationship);
            Toast.success('更新成功');
        } else {
            Storage.addRelationship(relationship);
            Toast.success('添加成功');
        }

        this.render();
        HomePage.render();
        return true;
    },

    deleteRelationship(id) {
        Modal.confirm('确定要删除这条关系记录吗？', () => {
            Storage.deleteRelationship(id);
            Toast.success('删除成功');
            this.render();
        });
    },

    showAddAvoidModal(personId, personName) {
        const content = `
            <div class="form-group">
                <label>人员</label>
                <input type="text" class="text-input" value="${personName}" disabled>
            </div>
            <div class="form-group">
                <label>避雷类型 *</label>
                <select class="select-input" id="avoidType">
                    <option value="dislike">讨厌的事物</option>
                    <option value="forbidden">禁忌话题</option>
                    <option value="joke">不能开的玩笑</option>
                    <option value="sensitive">敏感点</option>
                    <option value="conflict">过往矛盾</option>
                </select>
            </div>
            <div class="form-group">
                <label>避雷内容 *</label>
                <textarea class="textarea-input" id="avoidContent" placeholder="描述具体的避雷内容..."></textarea>
            </div>
        `;

        Modal.show({
            title: '添加避雷记录',
            content,
            confirmText: '添加',
            onConfirm: () => {
                const type = document.getElementById('avoidType').value;
                const content = document.getElementById('avoidContent').value.trim();

                if (!content) {
                    Toast.error('请输入避雷内容');
                    return false;
                }

                Storage.addAvoidItem({
                    personId,
                    personName,
                    type,
                    content
                });

                Toast.success('添加成功');
                this.render();
                return true;
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    RelationshipsPage.init();
});
