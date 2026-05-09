const SectionUI = {
    app: null,
    
    init: function(app) {
        this.app = app;
        this.bindEvents();
    },
    
    bindEvents: function() {
        document.getElementById('add-section-btn').addEventListener('click', () => this.showAddForm());
        document.getElementById('cancel-section-btn').addEventListener('click', () => this.hideForm());
        document.getElementById('section-form-element').addEventListener('submit', (e) => this.handleSubmit(e));
    },
    
    showAddForm: function() {
        this.resetForm();
        document.getElementById('section-form').classList.remove('hidden');
    },
    
    showEditForm: function(section) {
        document.getElementById('section-id').value = section.id;
        document.getElementById('section-name').value = section.name;
        document.getElementById('section-short').value = section.shortName || '';
        document.getElementById('section-low').value = section.voiceLow;
        document.getElementById('section-high').value = section.voiceHigh;
        document.getElementById('min-capacity').value = section.minCapacity;
        document.getElementById('max-capacity').value = section.maxCapacity;
        document.getElementById('section-priority').value = section.priority;
        document.getElementById('section-color').value = section.color;
        
        document.getElementById('section-form').classList.remove('hidden');
    },
    
    hideForm: function() {
        document.getElementById('section-form').classList.add('hidden');
        this.resetForm();
    },
    
    resetForm: function() {
        document.getElementById('section-form-element').reset();
        document.getElementById('section-id').value = '';
    },
    
    handleSubmit: function(e) {
        e.preventDefault();
        
        const id = document.getElementById('section-id').value;
        const sectionData = {
            id: id || undefined,
            name: document.getElementById('section-name').value,
            shortName: document.getElementById('section-short').value,
            voiceLow: document.getElementById('section-low').value,
            voiceHigh: document.getElementById('section-high').value,
            minCapacity: parseInt(document.getElementById('min-capacity').value) || 0,
            maxCapacity: parseInt(document.getElementById('max-capacity').value) || 10,
            priority: parseInt(document.getElementById('section-priority').value) || 0,
            color: document.getElementById('section-color').value
        };
        
        const section = new Section(sectionData);
        const validation = Validation.validateSection(section);
        
        if (!validation.isValid) {
            this.showToast(validation.errors.join('；'), 'error');
            return;
        }
        
        if (id) {
            this.app.updateSection(section);
            this.showToast('声部信息已更新', 'success');
        } else {
            this.app.addSection(section);
            this.showToast('声部已添加', 'success');
        }
        
        this.hideForm();
        this.render();
    },
    
    render: function() {
        const sections = this.app.state.sections;
        const container = document.getElementById('section-list');
        
        if (sections.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>暂无声部，点击"添加声部"开始
                </div>
            `;
            return;
        }
        
        container.innerHTML = sections.map(section => `
            <div class="section-card" data-section-id="${section.id}" style="border-left: 4px solid ${section.color}; border-left-width: 4px;">
                <div class="section-header">
                    <div class="section-info">
                    <h3>${section.name}${section.shortName ? ` (${section.shortName})` : ''}</h3>
                </div>
                <div class="section-actions">
                    <button class="btn-edit" onclick="SectionUI.editSection('${section.id}')">编辑</button>
                    <button class="btn-danger" onclick="SectionUI.deleteSection('${section.id}')">删除</button>
                </div>
            </div>
            <div class="section-details">
                <div class="detail-item">
                    <span class="detail-label">声部音域</span>
                    <span class="detail-value voice-range">
                        ${Validation.formatVoiceRange(section.voiceLow, section.voiceHigh)}
                    </span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">容量范围</span>
                    <span class="detail-value">${section.minCapacity} - ${section.maxCapacity} 人</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">优先级</span>
                    <span class="detail-value">${section.priority}</span>
                </div>
            </div>
        </div>
        `).join('');
    },
    
    editSection: function(sectionId) {
        const section = this.app.state.sections.find(s => s.id === sectionId);
        if (section) {
            this.showEditForm(section);
        }
    },
    
    deleteSection: function(sectionId) {
        if (confirm('确定要删除该声部吗？分配给该声部的成员需要重新分配。')) {
            this.app.deleteSection(sectionId);
            this.showToast('声部已删除', 'success');
            this.render();
        }
    },
    
    showToast: function(message, type = 'info') {
        if (typeof window.app !== 'undefined' && window.app.showToast) {
            window.app.showToast(message, type);
        }
    }
};
