const MemberUI = {
    app: null,
    
    init: function(app) {
        this.app = app;
        this.bindEvents();
        this.populateVoiceSelects();
    },
    
    bindEvents: function() {
        document.getElementById('add-member-btn').addEventListener('click', () => this.showAddForm());
        document.getElementById('cancel-member-btn').addEventListener('click', () => this.hideForm());
        document.getElementById('member-form-element').addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('import-sample-btn').addEventListener('click', () => this.importSampleData());
    },
    
    populateVoiceSelects: function() {
        const selects = ['voice-low', 'voice-high', 'section-low', 'section-high'];
        selects.forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                NOTES.list.forEach(note => {
                    const option = document.createElement('option');
                    option.value = note;
                    option.textContent = NOTES.displayNames[note] || note;
                    select.appendChild(option);
                });
            }
        });
    },
    
    updatePreferredSections: function(sections) {
        const select = document.getElementById('preferred-section');
        if (!select) return;
        
        select.innerHTML = '<option value="">无偏好</option>';
        
        sections.forEach(section => {
            const option = document.createElement('option');
            option.value = section.id;
            option.textContent = section.name;
            select.appendChild(option);
        });
    },
    
    showAddForm: function() {
        this.resetForm();
        document.getElementById('member-form').classList.remove('hidden');
    },
    
    showEditForm: function(member) {
        document.getElementById('member-id').value = member.id;
        document.getElementById('member-name').value = member.name;
        document.getElementById('member-gender').value = member.gender;
        document.getElementById('voice-low').value = member.voiceLow;
        document.getElementById('voice-high').value = member.voiceHigh;
        document.getElementById('preferred-section').value = member.preferredSection || '';
        document.getElementById('standing-experience').value = member.standingExperience || '';
        document.getElementById('is-core-member').checked = member.isCoreMember;
        
        document.getElementById('member-form').classList.remove('hidden');
    },
    
    hideForm: function() {
        document.getElementById('member-form').classList.add('hidden');
        this.resetForm();
    },
    
    resetForm: function() {
        document.getElementById('member-form-element').reset();
        document.getElementById('member-id').value = '';
    },
    
    handleSubmit: function(e) {
        e.preventDefault();
        
        const id = document.getElementById('member-id').value;
        const memberData = {
            id: id || undefined,
            name: document.getElementById('member-name').value,
            gender: document.getElementById('member-gender').value,
            voiceLow: document.getElementById('voice-low').value,
            voiceHigh: document.getElementById('voice-high').value,
            preferredSection: document.getElementById('preferred-section').value || null,
            standingExperience: document.getElementById('standing-experience').value,
            isCoreMember: document.getElementById('is-core-member').checked
        };
        
        const member = new Member(memberData);
        const validation = Validation.validateMember(member);
        
        if (!validation.isValid) {
            this.showToast(validation.errors.join('；'), 'error');
            return;
        }
        
        if (id) {
            this.app.updateMember(member);
            this.showToast('成员信息已更新', 'success');
        } else {
            this.app.addMember(member);
            this.showToast('成员已添加', 'success');
        }
        
        this.hideForm();
        this.render();
    },
    
    render: function() {
        const members = this.app.state.members;
        const sections = this.app.state.sections;
        const container = document.getElementById('member-list');
        
        if (members.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>暂无成员，点击"添加成员"开始</p>
                    <p style="font-size: 14px; margin-top: 10px;">
                        或点击"导入示例数据"快速体验
                    </p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = members.map(member => {
            const preferredSection = sections.find(s => s.id === member.preferredSection);
            return `
                <div class="member-card" data-member-id="${member.id}">
                    <div class="member-header">
                        <div class="member-info">
                            <div class="member-name">
                                ${member.name}
                                ${member.isCoreMember ? '<span class="core-badge">核心</span>' : ''}
                            </div>
                            <div class="member-gender">
                                ${member.gender === 'female' ? '女' : '男'}
                            </div>
                        </div>
                        <div class="member-actions">
                            <button class="btn-edit" onclick="MemberUI.editMember('${member.id}')">编辑</button>
                            <button class="btn-danger" onclick="MemberUI.deleteMember('${member.id}')">删除</button>
                        </div>
                    </div>
                    <div class="member-details">
                        <div class="detail-item">
                            <span class="detail-label">音域范围</span>
                            <span class="detail-value voice-range">
                                ${Validation.formatVoiceRange(member.voiceLow, member.voiceHigh)}
                            </span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">偏好声部</span>
                            <span class="detail-value">
                                ${preferredSection ? preferredSection.name : '无'}
                            </span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">站位经验</span>
                            <span class="detail-value">
                                ${member.standingExperience || '无'}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        this.updatePreferredSections(sections);
    },
    
    editMember: function(memberId) {
        const member = this.app.state.members.find(m => m.id === memberId);
        if (member) {
            this.showEditForm(member);
        }
    },
    
    deleteMember: function(memberId) {
        if (confirm('确定要删除该成员吗？')) {
            this.app.deleteMember(memberId);
            this.showToast('成员已删除', 'success');
            this.render();
        }
    },
    
    importSampleData: function() {
        if (this.app.state.members.length > 0 || this.app.state.sections.length > 0) {
            if (!confirm('导入示例数据将覆盖现有数据，确定继续吗？')) {
                return;
            }
        }
        
        this.app.importSampleData();
        this.render();
        this.showToast('示例数据已导入', 'success');
    },
    
    showToast: function(message, type = 'info') {
        if (typeof window.app !== 'undefined' && window.app.showToast) {
            window.app.showToast(message, type);
        }
    }
};
