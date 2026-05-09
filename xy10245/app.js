class CalligraphyReviewSystem {
    constructor() {
        this.works = [];
        this.tags = [];
        this.originalState = null;
        this.currentTab = 'works';
        
        this.DIMENSIONS = ['strokes', 'structure', 'composition'];
        this.DIMENSION_NAMES = {
            strokes: '笔画',
            structure: '结构',
            composition: '章法'
        };
        
        this.TAG_CATEGORIES = {
            strength: '优点',
            weakness: '不足',
            suggestion: '建议'
        };
        
        this.init();
    }
    
    init() {
        this.loadFromStorage();
        this.initDefaultTags();
        this.render();
        this.setupEventListeners();
        this.checkForIssues();
    }
    
    loadFromStorage() {
        const worksData = localStorage.getItem('calligraphy_works');
        const tagsData = localStorage.getItem('calligraphy_tags');
        const originalData = localStorage.getItem('calligraphy_original');
        
        if (worksData) {
            this.works = JSON.parse(worksData);
        }
        if (tagsData) {
            this.tags = JSON.parse(tagsData);
        }
        if (originalData) {
            this.originalState = JSON.parse(originalData);
        }
    }
    
    saveToStorage() {
        localStorage.setItem('calligraphy_works', JSON.stringify(this.works));
        localStorage.setItem('calligraphy_tags', JSON.stringify(this.tags));
        if (this.originalState) {
            localStorage.setItem('calligraphy_original', JSON.stringify(this.originalState));
        }
    }
    
    initDefaultTags() {
        if (this.tags.length === 0) {
            this.tags = [
                { id: 't1', name: '起笔有力', dimension: 'strokes', category: 'strength' },
                { id: 't2', name: '收笔干净', dimension: 'strokes', category: 'strength' },
                { id: 't3', name: '转折流畅', dimension: 'strokes', category: 'strength' },
                { id: 't4', name: '起笔迟疑', dimension: 'strokes', category: 'weakness' },
                { id: 't5', name: '线条无力', dimension: 'strokes', category: 'weakness' },
                { id: 't6', name: '加强起笔练习', dimension: 'strokes', category: 'suggestion' },
                { id: 't7', name: '比例协调', dimension: 'structure', category: 'strength' },
                { id: 't8', name: '重心稳定', dimension: 'structure', category: 'strength' },
                { id: 't9', name: '疏密得当', dimension: 'structure', category: 'strength' },
                { id: 't10', name: '左右失衡', dimension: 'structure', category: 'weakness' },
                { id: 't11', name: '重心偏移', dimension: 'structure', category: 'weakness' },
                { id: 't12', name: '注意间架结构', dimension: 'structure', category: 'suggestion' },
                { id: 't13', name: '布局合理', dimension: 'composition', category: 'strength' },
                { id: 't14', name: '行气连贯', dimension: 'composition', category: 'strength' },
                { id: 't15', name: '落款得当', dimension: 'composition', category: 'strength' },
                { id: 't16', name: '字距不均', dimension: 'composition', category: 'weakness' },
                { id: 't17', name: '行气不畅', dimension: 'composition', category: 'weakness' },
                { id: 't18', name: '加强整体布局意识', dimension: 'composition', category: 'suggestion' }
            ];
            this.saveToStorage();
        }
    }
    
    setupEventListeners() {
        window.addEventListener('beforeunload', () => this.saveToStorage());
    }
    
    render() {
        this.renderStats();
        this.renderStudentFilter();
        this.renderWorks();
        this.renderTags();
        this.renderCompareWorkSelect();
    }
    
    renderStats() {
        const statsGrid = document.getElementById('stats-grid');
        const totalWorks = this.works.length;
        const pendingWorks = this.works.filter(w => w.status === 'pending').length;
        const inProgressWorks = this.works.filter(w => w.status === 'in_progress').length;
        const completedWorks = this.works.filter(w => w.status === 'completed').length;
        const totalRounds = this.works.reduce((sum, w) => sum + w.rounds.length, 0);
        
        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">${totalWorks}</div>
                <div class="stat-label">作品总数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${totalRounds}</div>
                <div class="stat-label">点评轮次</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${pendingWorks}</div>
                <div class="stat-label">待点评</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${inProgressWorks}</div>
                <div class="stat-label">点评中</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${completedWorks}</div>
                <div class="stat-label">已完成</div>
            </div>
        `;
    }
    
    renderStudentFilter() {
        const filterStudent = document.getElementById('filter-student');
        const students = [...new Set(this.works.map(w => w.student))];
        
        filterStudent.innerHTML = '<option value="">全部学生</option>' + 
            students.map(s => `<option value="${s}">${s}</option>`).join('');
    }
    
    renderWorks() {
        const worksList = document.getElementById('works-list');
        const searchInput = document.getElementById('search-input').value.toLowerCase();
        const filterStudent = document.getElementById('filter-student').value;
        const filterStatus = document.getElementById('filter-status').value;
        
        let filteredWorks = this.works;
        
        if (searchInput) {
            filteredWorks = filteredWorks.filter(w => 
                w.student.toLowerCase().includes(searchInput) ||
                w.name.toLowerCase().includes(searchInput)
            );
        }
        
        if (filterStudent) {
            filteredWorks = filteredWorks.filter(w => w.student === filterStudent);
        }
        
        if (filterStatus) {
            filteredWorks = filteredWorks.filter(w => w.status === filterStatus);
        }
        
        if (filteredWorks.length === 0) {
            worksList.innerHTML = '<p class="text-muted center">暂无作品，请点击左侧「新增作品」按钮添加</p>';
            return;
        }
        
        worksList.innerHTML = filteredWorks.map(work => this.renderWorkCard(work)).join('');
    }
    
    renderWorkCard(work) {
        const statusText = {
            pending: '待点评',
            in_progress: '点评中',
            completed: '已完成'
        };
        
        const roundsHtml = work.rounds.map(round => `
            <div class="round-item">
                <div class="round-header">
                    <span class="round-number">第${round.round}轮</span>
                    <span class="round-date">${round.date}</span>
                </div>
                <div class="dimensions">
                    ${this.DIMENSIONS.map(dim => {
                        const dimension = round.dimensions[dim];
                        return `
                            <div class="dimension">
                                <span class="dimension-name">${this.DIMENSION_NAMES[dim]}</span>
                                <span class="dimension-score">
                                    ${[1,2,3,4,5].map(i => 
                                        `<span class="star ${i <= dimension.score ? 'filled' : ''}">★</span>`
                                    ).join('')}
                                </span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `).join('');
        
        return `
            <div class="work-card" data-id="${work.id}">
                <div class="work-header">
                    <div class="work-info">
                        <h4>${work.name}</h4>
                        <p class="work-student">学生：${work.student}</p>
                    </div>
                    <div class="work-status">
                        <span class="status-badge status-${work.status}">${statusText[work.status]}</span>
                    </div>
                </div>
                
                <div class="work-rounds">
                    ${work.rounds.length > 0 ? roundsHtml : '<p class="text-muted" style="padding: 20px;">暂无点评轮次</p>'}
                </div>
                
                <div class="work-actions">
                    <button class="btn btn-primary btn-sm" onclick="app.showAddRoundModal('${work.id}')">
                        + 新增轮次
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="app.showEditWorkModal('${work.id}')">
                        编辑作品
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="app.showWorkDetails('${work.id}')">
                        查看详情
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="app.deleteWork('${work.id}')">
                        删除
                    </button>
                </div>
            </div>
        `;
    }
    
    renderTags() {
        const tagsContainer = document.getElementById('tags-container');
        
        if (this.tags.length === 0) {
            tagsContainer.innerHTML = '<p class="text-muted center">暂无标签，请点击上方「新增标签」按钮添加</p>';
            return;
        }
        
        tagsContainer.innerHTML = this.tags.map(tag => {
            const usageCount = this.getTagUsageCount(tag.id);
            return `
                <div class="tag-card" data-id="${tag.id}">
                    <div class="tag-header">
                        <span class="tag-name">${tag.name}</span>
                        <span class="tag-category">${this.TAG_CATEGORIES[tag.category]}</span>
                    </div>
                    <div class="tag-dimension">维度：${this.DIMENSION_NAMES[tag.dimension]}</div>
                    <div class="tag-usage">使用次数：${usageCount}</div>
                    <div class="work-actions" style="padding-top: 12px; margin-top: 12px; border-top: 1px solid var(--border-color);">
                        <button class="btn btn-secondary btn-sm" onclick="app.showEditTagModal('${tag.id}')">编辑</button>
                        <button class="btn btn-danger btn-sm" onclick="app.deleteTag('${tag.id}')">删除</button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    getTagUsageCount(tagId) {
        let count = 0;
        this.works.forEach(work => {
            work.rounds.forEach(round => {
                this.DIMENSIONS.forEach(dim => {
                    if (round.dimensions[dim] && round.dimensions[dim].tags) {
                        if (round.dimensions[dim].tags.includes(tagId)) {
                            count++;
                        }
                    }
                });
            });
        });
        return count;
    }
    
    renderCompareWorkSelect() {
        const select = document.getElementById('compare-work');
        select.innerHTML = '<option value="">选择作品</option>' + 
            this.works.map(w => `<option value="${w.id}">${w.name} - ${w.student}</option>`).join('');
    }
    
    loadCompareRounds() {
        const workId = document.getElementById('compare-work').value;
        const compareContainer = document.getElementById('compare-container');
        
        if (!workId) {
            compareContainer.innerHTML = '<p class="text-muted center">请选择作品进行轮次对比</p>';
            return;
        }
        
        const work = this.works.find(w => w.id === workId);
        if (!work || work.rounds.length === 0) {
            compareContainer.innerHTML = '<p class="text-muted center">该作品暂无点评轮次</p>';
            return;
        }
        
        compareContainer.innerHTML = `
            <div class="compare-rounds">
                ${work.rounds.map((round, index) => this.renderCompareRound(round, index)).join('')}
            </div>
        `;
    }
    
    renderCompareRound(round, index) {
        return `
            <div class="compare-round">
                <div class="compare-round-header">
                    <h3>第${round.round}轮点评</h3>
                    <span class="round-date">${round.date}</span>
                </div>
                ${this.DIMENSIONS.map(dim => {
                    const dimension = round.dimensions[dim];
                    const tagsHtml = dimension.tags.map(tagId => {
                        const tag = this.tags.find(t => t.id === tagId);
                        const categoryClass = tag ? `tag-${tag.category === 'strength' ? 'success' : tag.category === 'weakness' ? 'warning' : 'info'}` : 'tag-danger';
                        return `<span class="tag-info ${categoryClass}">${tag ? tag.name : `未知标签(${tagId})`}</span>`;
                    }).join('');
                    
                    return `
                        <div class="compare-dimension">
                            <h4>${this.DIMENSION_NAMES[dim]} 
                                <span style="float: right; font-weight: normal;">
                                    ${[1,2,3,4,5].map(i => 
                                        `<span class="star ${i <= dimension.score ? 'filled' : ''}">★</span>`
                                    ).join('')}
                                </span>
                            </h4>
                            <div class="comments">${dimension.comments || '暂无点评内容'}</div>
                            <div class="compare-tags" style="margin-top: 8px;">
                                ${tagsHtml || '<span class="text-muted">暂无标签</span>'}
                            </div>
                        </div>
                    `;
                }).join('')}
                
                ${index > 0 ? `
                    <div style="margin-top: 16px; padding-top: 16px; border-top: 2px dashed var(--border-color);">
                        <h4 style="margin-bottom: 8px;">📈 与上一轮对比</h4>
                        ${this.renderRoundComparison(round, index)}
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    renderRoundComparison(round, index) {
        const workId = document.getElementById('compare-work').value;
        const work = this.works.find(w => w.id === workId);
        const prevRound = work.rounds[index - 1];
        
        const comparisons = this.DIMENSIONS.map(dim => {
            const prevScore = prevRound.dimensions[dim].score;
            const currScore = round.dimensions[dim].score;
            const diff = currScore - prevScore;
            let diffText = '';
            let diffClass = '';
            
            if (diff > 0) {
                diffText = `+${diff} 分（进步）`;
                diffClass = 'tag-success';
            } else if (diff < 0) {
                diffText = `${diff} 分（退步）`;
                diffClass = 'tag-danger';
            } else {
                diffText = '持平';
                diffClass = 'tag-info';
            }
            
            return `
                <div style="display: flex; justify-content: space-between; padding: 8px 0;">
                    <span>${this.DIMENSION_NAMES[dim]}: ${prevScore}分 → ${currScore}分</span>
                    <span class="tag-info ${diffClass}">${diffText}</span>
                </div>
            `;
        }).join('');
        
        return comparisons;
    }
    
    switchTab(tabName) {
        this.currentTab = tabName;
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === `tab-${tabName}`);
        });
        
        if (tabName === 'tags') {
            this.validateTags();
        }
    }
    
    showModal(title, content) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = content;
        document.getElementById('modal').classList.add('active');
    }
    
    closeModal() {
        document.getElementById('modal').classList.remove('active');
    }
    
    showAddWorkModal() {
        const today = new Date().toISOString().split('T')[0];
        const content = `
            <form onsubmit="event.preventDefault(); app.addWork();">
                <div class="form-group">
                    <label>学生姓名 *</label>
                    <input type="text" id="new-work-student" required placeholder="请输入学生姓名">
                </div>
                <div class="form-group">
                    <label>作品名称 *</label>
                    <input type="text" id="new-work-name" required placeholder="如：颜真卿多宝塔碑临摹">
                </div>
                <div class="form-group">
                    <label>提交日期</label>
                    <input type="date" id="new-work-date" value="${today}">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="app.closeModal()">取消</button>
                    <button type="submit" class="btn btn-primary">添加作品</button>
                </div>
            </form>
        `;
        this.showModal('新增作品', content);
    }
    
    addWork() {
        const student = document.getElementById('new-work-student').value.trim();
        const name = document.getElementById('new-work-name').value.trim();
        const date = document.getElementById('new-work-date').value;
        
        if (!student || !name) {
            alert('请填写必填项');
            return;
        }
        
        const work = {
            id: 'w' + Date.now(),
            student,
            name,
            submitDate: date,
            status: 'pending',
            rounds: [],
            createdAt: new Date().toISOString()
        };
        
        this.works.push(work);
        
        if (!this.originalState) {
            this.originalState = JSON.parse(JSON.stringify(this.works));
        }
        
        this.saveToStorage();
        this.closeModal();
        this.render();
        this.checkForIssues();
    }
    
    showEditWorkModal(workId) {
        const work = this.works.find(w => w.id === workId);
        if (!work) return;
        
        const content = `
            <form onsubmit="event.preventDefault(); app.updateWork('${workId}');">
                <div class="form-group">
                    <label>学生姓名 *</label>
                    <input type="text" id="edit-work-student" required value="${work.student}">
                </div>
                <div class="form-group">
                    <label>作品名称 *</label>
                    <input type="text" id="edit-work-name" required value="${work.name}">
                </div>
                <div class="form-group">
                    <label>提交日期</label>
                    <input type="date" id="edit-work-date" value="${work.submitDate}">
                </div>
                <div class="form-group">
                    <label>状态</label>
                    <select id="edit-work-status">
                        <option value="pending" ${work.status === 'pending' ? 'selected' : ''}>待点评</option>
                        <option value="in_progress" ${work.status === 'in_progress' ? 'selected' : ''}>点评中</option>
                        <option value="completed" ${work.status === 'completed' ? 'selected' : ''}>已完成</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="app.closeModal()">取消</button>
                    <button type="submit" class="btn btn-primary">保存修改</button>
                </div>
            </form>
        `;
        this.showModal('编辑作品', content);
    }
    
    updateWork(workId) {
        const work = this.works.find(w => w.id === workId);
        if (!work) return;
        
        work.student = document.getElementById('edit-work-student').value.trim();
        work.name = document.getElementById('edit-work-name').value.trim();
        work.submitDate = document.getElementById('edit-work-date').value;
        work.status = document.getElementById('edit-work-status').value;
        
        this.saveToStorage();
        this.closeModal();
        this.render();
        this.checkForIssues();
    }
    
    deleteWork(workId) {
        if (!confirm('确定要删除这个作品吗？所有点评轮次将一起删除。')) return;
        
        this.works = this.works.filter(w => w.id !== workId);
        this.saveToStorage();
        this.render();
        this.checkForIssues();
    }
    
    showWorkDetails(workId) {
        const work = this.works.find(w => w.id === workId);
        if (!work) return;
        
        const statusText = {
            pending: '待点评',
            in_progress: '点评中',
            completed: '已完成'
        };
        
        let content = `
            <div style="margin-bottom: 20px;">
                <h3 style="margin-bottom: 8px;">${work.name}</h3>
                <p style="color: var(--text-secondary);">学生：${work.student} | 提交日期：${work.submitDate} | 状态：${statusText[work.status]}</p>
            </div>
        `;
        
        if (work.rounds.length === 0) {
            content += '<p class="text-muted">暂无点评轮次</p>';
        } else {
            content += work.rounds.map((round, index) => `
                <div style="margin-bottom: 24px; padding: 16px; background: var(--bg-color); border-radius: var(--radius);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);">
                        <strong>第${round.round}轮点评</strong>
                        <span class="text-muted">${round.date}</span>
                    </div>
                    ${this.DIMENSIONS.map(dim => {
                        const dimension = round.dimensions[dim];
                        const tagsHtml = dimension.tags.map(tagId => {
                            const tag = this.tags.find(t => t.id === tagId);
                            return tag ? tag.name : `未知标签(${tagId})`;
                        }).join('、');
                        
                        return `
                            <div style="margin-bottom: 12px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                    <strong>${this.DIMENSION_NAMES[dim]}</strong>
                                    <span>${[1,2,3,4,5].map(i => i <= dimension.score ? '★' : '☆').join('')} (${dimension.score}分)</span>
                                </div>
                                <p style="margin: 8px 0; color: var(--text-secondary);">${dimension.comments || '暂无点评'}</p>
                                <p style="font-size: 0.85rem; color: var(--text-secondary);">标签：${tagsHtml || '无'}</p>
                            </div>
                        `;
                    }).join('')}
                    <div style="margin-top: 16px;">
                        <button class="btn btn-secondary btn-sm" onclick="app.showEditRoundModal('${workId}', ${index})">编辑此轮</button>
                        <button class="btn btn-danger btn-sm" onclick="app.deleteRound('${workId}', ${index})">删除此轮</button>
                    </div>
                </div>
            `).join('');
        }
        
        content += `
            <div class="form-actions">
                <button class="btn btn-primary" onclick="app.showAddRoundModal('${workId}')">+ 新增轮次</button>
                <button class="btn btn-secondary" onclick="app.closeModal()">关闭</button>
            </div>
        `;
        
        this.showModal('作品详情', content);
    }
    
    showAddRoundModal(workId) {
        const work = this.works.find(w => w.id === workId);
        if (!work) return;
        
        const nextRound = work.rounds.length + 1;
        const today = new Date().toISOString().split('T')[0];
        
        const content = `
            <form onsubmit="event.preventDefault(); app.addRound('${workId}');">
                <div class="form-group">
                    <label>轮次</label>
                    <input type="number" id="round-number" value="${nextRound}" min="1">
                </div>
                <div class="form-group">
                    <label>点评日期</label>
                    <input type="date" id="round-date" value="${today}">
                </div>
                
                ${this.DIMENSIONS.map(dim => `
                    <div style="margin-bottom: 24px; padding: 16px; background: var(--bg-color); border-radius: var(--radius);">
                        <h4 style="margin-bottom: 12px; color: var(--primary-color);">${this.DIMENSION_NAMES[dim]}</h4>
                        
                        <div class="form-group">
                            <label>评分 (1-5)</label>
                            <div class="score-input" data-dimension="${dim}">
                                ${[1,2,3,4,5].map(i => `
                                    <button type="button" data-score="${i}" onclick="app.setScore('${dim}', ${i})">★</button>
                                `).join('')}
                            </div>
                            <input type="hidden" id="score-${dim}" value="3">
                        </div>
                        
                        <div class="form-group">
                            <label>点评内容</label>
                            <textarea id="comments-${dim}" rows="3" placeholder="请输入${this.DIMENSION_NAMES[dim]}方面的点评..."></textarea>
                        </div>
                        
                        <div class="form-group">
                            <label>标签</label>
                            <div class="tag-selector">
                                ${this.tags.filter(t => t.dimension === dim).map(tag => `
                                    <span class="tag-option" data-tag="${tag.id}" onclick="app.toggleTag('${dim}', '${tag.id}')">${tag.name}</span>
                                `).join('')}
                            </div>
                            <input type="hidden" id="tags-${dim}" value="">
                        </div>
                    </div>
                `).join('')}
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="app.closeModal()">取消</button>
                    <button type="submit" class="btn btn-primary">保存点评</button>
                </div>
            </form>
        `;
        this.showModal('新增点评轮次', content);
        
        this.DIMENSIONS.forEach(dim => this.setScore(dim, 3));
    }
    
    setScore(dimension, score) {
        document.getElementById(`score-${dimension}`).value = score;
        const container = document.querySelector(`.score-input[data-dimension="${dimension}"]`);
        container.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.score) <= score);
        });
    }
    
    toggleTag(dimension, tagId) {
        const hiddenInput = document.getElementById(`tags-${dimension}`);
        let tags = hiddenInput.value ? hiddenInput.value.split(',') : [];
        
        const index = tags.indexOf(tagId);
        if (index > -1) {
            tags.splice(index, 1);
        } else {
            tags.push(tagId);
        }
        
        hiddenInput.value = tags.join(',');
        
        const tagOption = document.querySelector(`.tag-option[data-tag="${tagId}"]`);
        if (tagOption) {
            tagOption.classList.toggle('selected');
        }
    }
    
    addRound(workId) {
        const work = this.works.find(w => w.id === workId);
        if (!work) return;
        
        const roundNumber = parseInt(document.getElementById('round-number').value);
        const date = document.getElementById('round-date').value;
        
        const dimensions = {};
        this.DIMENSIONS.forEach(dim => {
            const tagsStr = document.getElementById(`tags-${dim}`).value;
            dimensions[dim] = {
                score: parseInt(document.getElementById(`score-${dim}`).value),
                comments: document.getElementById(`comments-${dim}`).value,
                tags: tagsStr ? tagsStr.split(',').filter(t => t) : []
            };
        });
        
        const round = {
            round: roundNumber,
            date,
            dimensions,
            createdAt: new Date().toISOString()
        };
        
        work.rounds.push(round);
        
        if (work.rounds.length > 0) {
            work.status = work.rounds.length >= 2 ? 'completed' : 'in_progress';
        }
        
        this.saveToStorage();
        this.closeModal();
        this.render();
        this.checkForIssues();
    }
    
    showEditRoundModal(workId, roundIndex) {
        const work = this.works.find(w => w.id === workId);
        if (!work || !work.rounds[roundIndex]) return;
        
        const round = work.rounds[roundIndex];
        
        const content = `
            <form onsubmit="event.preventDefault(); app.updateRound('${workId}', ${roundIndex});">
                <div class="form-group">
                    <label>轮次</label>
                    <input type="number" id="edit-round-number" value="${round.round}" min="1">
                </div>
                <div class="form-group">
                    <label>点评日期</label>
                    <input type="date" id="edit-round-date" value="${round.date}">
                </div>
                
                ${this.DIMENSIONS.map(dim => {
                    const dimension = round.dimensions[dim];
                    const tagsStr = dimension.tags.join(',');
                    return `
                        <div style="margin-bottom: 24px; padding: 16px; background: var(--bg-color); border-radius: var(--radius);">
                            <h4 style="margin-bottom: 12px; color: var(--primary-color);">${this.DIMENSION_NAMES[dim]}</h4>
                            
                            <div class="form-group">
                                <label>评分 (1-5)</label>
                                <div class="score-input" data-dimension="edit-${dim}">
                                    ${[1,2,3,4,5].map(i => `
                                        <button type="button" data-score="${i}" onclick="app.setScore('edit-${dim}', ${i})">★</button>
                                    `).join('')}
                                </div>
                                <input type="hidden" id="score-edit-${dim}" value="${dimension.score}">
                            </div>
                            
                            <div class="form-group">
                                <label>点评内容</label>
                                <textarea id="comments-edit-${dim}" rows="3">${dimension.comments || ''}</textarea>
                            </div>
                            
                            <div class="form-group">
                                <label>标签</label>
                                <div class="tag-selector">
                                    ${this.tags.filter(t => t.dimension === dim).map(tag => {
                                        const selected = dimension.tags.includes(tag.id);
                                        return `<span class="tag-option ${selected ? 'selected' : ''}" data-tag="${tag.id}" onclick="app.toggleTag('edit-${dim}', '${tag.id}')">${tag.name}</span>`;
                                    }).join('')}
                                </div>
                                <input type="hidden" id="tags-edit-${dim}" value="${tagsStr}">
                            </div>
                        </div>
                    `;
                }).join('')}
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="app.closeModal()">取消</button>
                    <button type="submit" class="btn btn-primary">保存修改</button>
                </div>
            </form>
        `;
        this.showModal('编辑点评轮次', content);
        
        this.DIMENSIONS.forEach(dim => {
            this.setScore(`edit-${dim}`, round.dimensions[dim].score);
        });
    }
    
    updateRound(workId, roundIndex) {
        const work = this.works.find(w => w.id === workId);
        if (!work || !work.rounds[roundIndex]) return;
        
        const round = work.rounds[roundIndex];
        round.round = parseInt(document.getElementById('edit-round-number').value);
        round.date = document.getElementById('edit-round-date').value;
        
        this.DIMENSIONS.forEach(dim => {
            const tagsStr = document.getElementById(`tags-edit-${dim}`).value;
            round.dimensions[dim] = {
                score: parseInt(document.getElementById(`score-edit-${dim}`).value),
                comments: document.getElementById(`comments-edit-${dim}`).value,
                tags: tagsStr ? tagsStr.split(',').filter(t => t) : []
            };
        });
        
        this.saveToStorage();
        this.closeModal();
        this.render();
        this.checkForIssues();
    }
    
    deleteRound(workId, roundIndex) {
        if (!confirm('确定要删除这个点评轮次吗？')) return;
        
        const work = this.works.find(w => w.id === workId);
        if (!work) return;
        
        work.rounds.splice(roundIndex, 1);
        
        if (work.rounds.length === 0) {
            work.status = 'pending';
        } else if (work.rounds.length === 1) {
            work.status = 'in_progress';
        }
        
        this.saveToStorage();
        this.closeModal();
        this.render();
        this.checkForIssues();
    }
    
    showAddTagModal() {
        const content = `
            <form onsubmit="event.preventDefault(); app.addTag();">
                <div class="form-group">
                    <label>标签名称 *</label>
                    <input type="text" id="new-tag-name" required placeholder="如：起笔有力">
                </div>
                <div class="form-group">
                    <label>维度 *</label>
                    <select id="new-tag-dimension" required>
                        ${this.DIMENSIONS.map(dim => `<option value="${dim}">${this.DIMENSION_NAMES[dim]}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>类别 *</label>
                    <select id="new-tag-category" required>
                        <option value="strength">优点</option>
                        <option value="weakness">不足</option>
                        <option value="suggestion">建议</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="app.closeModal()">取消</button>
                    <button type="submit" class="btn btn-primary">添加标签</button>
                </div>
            </form>
        `;
        this.showModal('新增标签', content);
    }
    
    addTag() {
        const name = document.getElementById('new-tag-name').value.trim();
        const dimension = document.getElementById('new-tag-dimension').value;
        const category = document.getElementById('new-tag-category').value;
        
        if (!name) {
            alert('请填写标签名称');
            return;
        }
        
        const tag = {
            id: 't' + Date.now(),
            name,
            dimension,
            category
        };
        
        this.tags.push(tag);
        this.saveToStorage();
        this.closeModal();
        this.render();
        this.validateTags();
    }
    
    showEditTagModal(tagId) {
        const tag = this.tags.find(t => t.id === tagId);
        if (!tag) return;
        
        const content = `
            <form onsubmit="event.preventDefault(); app.updateTag('${tagId}');">
                <div class="form-group">
                    <label>标签名称 *</label>
                    <input type="text" id="edit-tag-name" required value="${tag.name}">
                </div>
                <div class="form-group">
                    <label>维度 *</label>
                    <select id="edit-tag-dimension" required>
                        ${this.DIMENSIONS.map(dim => `<option value="${dim}" ${tag.dimension === dim ? 'selected' : ''}>${this.DIMENSION_NAMES[dim]}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>类别 *</label>
                    <select id="edit-tag-category" required>
                        <option value="strength" ${tag.category === 'strength' ? 'selected' : ''}>优点</option>
                        <option value="weakness" ${tag.category === 'weakness' ? 'selected' : ''}>不足</option>
                        <option value="suggestion" ${tag.category === 'suggestion' ? 'selected' : ''}>建议</option>
                    </select>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="app.closeModal()">取消</button>
                    <button type="submit" class="btn btn-primary">保存修改</button>
                </div>
            </form>
        `;
        this.showModal('编辑标签', content);
    }
    
    updateTag(tagId) {
        const tag = this.tags.find(t => t.id === tagId);
        if (!tag) return;
        
        tag.name = document.getElementById('edit-tag-name').value.trim();
        tag.dimension = document.getElementById('edit-tag-dimension').value;
        tag.category = document.getElementById('edit-tag-category').value;
        
        this.saveToStorage();
        this.closeModal();
        this.render();
        this.validateTags();
    }
    
    deleteTag(tagId) {
        const usageCount = this.getTagUsageCount(tagId);
        if (usageCount > 0) {
            if (!confirm(`该标签已被使用 ${usageCount} 次，删除后将影响相关点评。确定要删除吗？`)) {
                return;
            }
        } else {
            if (!confirm('确定要删除这个标签吗？')) {
                return;
            }
        }
        
        this.tags = this.tags.filter(t => t.id !== tagId);
        
        this.works.forEach(work => {
            work.rounds.forEach(round => {
                this.DIMENSIONS.forEach(dim => {
                    if (round.dimensions[dim] && round.dimensions[dim].tags) {
                        round.dimensions[dim].tags = round.dimensions[dim].tags.filter(tid => tid !== tagId);
                    }
                });
            });
        });
        
        this.saveToStorage();
        this.render();
        this.validateTags();
    }
    
    checkForIssues() {
        const alertsContainer = document.getElementById('alerts-container');
        const issues = [];
        
        this.works.forEach(work => {
            if (work.rounds.length === 0) {
                issues.push({
                    type: 'warning',
                    message: `作品「${work.name}」(${work.student}) 尚未添加点评轮次`
                });
            }
            
            const roundNumbers = work.rounds.map(r => r.round).sort((a, b) => a - b);
            for (let i = 0; i < roundNumbers.length; i++) {
                if (roundNumbers[i] !== i + 1) {
                    issues.push({
                        type: 'danger',
                        message: `作品「${work.name}」轮次编号不连续：缺少第${i + 1}轮`
                    });
                    break;
                }
            }
            
            const uniqueRounds = [...new Set(roundNumbers)];
            if (uniqueRounds.length !== roundNumbers.length) {
                issues.push({
                    type: 'danger',
                    message: `作品「${work.name}」存在重复的轮次编号`
                });
            }
            
            work.rounds.forEach(round => {
                this.DIMENSIONS.forEach(dim => {
                    const dimension = round.dimensions[dim];
                    if (!dimension || dimension.score < 1 || dimension.score > 5) {
                        issues.push({
                            type: 'warning',
                            message: `作品「${work.name}」第${round.round}轮 ${this.DIMENSION_NAMES[dim]} 评分异常`
                        });
                    }
                    
                    if (dimension && dimension.tags) {
                        dimension.tags.forEach(tagId => {
                            if (!this.tags.find(t => t.id === tagId)) {
                                issues.push({
                                    type: 'danger',
                                    message: `作品「${work.name}」使用了不存在的标签：${tagId}`
                                });
                            }
                        });
                    }
                });
            });
        });
        
        if (issues.length === 0) {
            alertsContainer.innerHTML = '<div class="alert alert-success">✓ 数据状态良好，无问题发现</div>';
        } else {
            alertsContainer.innerHTML = issues.slice(0, 5).map(issue => 
                `<div class="alert alert-${issue.type}">${issue.message}</div>`
            ).join('');
            
            if (issues.length > 5) {
                alertsContainer.innerHTML += `<div class="alert alert-info">还有 ${issues.length - 5} 个问题，请查看验证报告</div>`;
            }
        }
    }
    
    validateTags() {
        const validationResult = document.getElementById('tag-validation');
        const usedTags = new Set();
        
        this.works.forEach(work => {
            work.rounds.forEach(round => {
                this.DIMENSIONS.forEach(dim => {
                    if (round.dimensions[dim] && round.dimensions[dim].tags) {
                        round.dimensions[dim].tags.forEach(tagId => usedTags.add(tagId));
                    }
                });
            });
        });
        
        const unusedTags = this.tags.filter(t => !usedTags.has(t.id));
        const invalidTags = [];
        
        this.works.forEach(work => {
            work.rounds.forEach(round => {
                this.DIMENSIONS.forEach(dim => {
                    if (round.dimensions[dim] && round.dimensions[dim].tags) {
                        round.dimensions[dim].tags.forEach(tagId => {
                            const tag = this.tags.find(t => t.id === tagId);
                            if (tag && tag.dimension !== dim) {
                                invalidTags.push({
                                    work: work.name,
                                    round: round.round,
                                    dimension: dim,
                                    tag: tag.name,
                                    expected: tag.dimension
                                });
                            }
                        });
                    }
                });
            });
        });
        
        let html = `<h4 style="margin-bottom: 16px;">标签验证结果</h4>`;
        
        if (unusedTags.length === 0 && invalidTags.length === 0) {
            html += `<div class="validation-item">
                <span>所有标签使用正确</span>
                <span class="validation-status"><span class="status-success">✓</span> 通过</span>
            </div>`;
        } else {
            if (unusedTags.length > 0) {
                html += `<div class="validation-item">
                    <span>未使用的标签 (${unusedTags.length}个)</span>
                    <span class="validation-status"><span class="status-warning">!</span> 注意</span>
                </div>`;
                html += `<p style="padding: 0 12px 12px; font-size: 0.85rem; color: var(--text-secondary);">
                    ${unusedTags.map(t => t.name).join('、')}
                </p>`;
            }
            
            if (invalidTags.length > 0) {
                html += `<div class="validation-item">
                    <span>维度不匹配的标签 (${invalidTags.length}处)</span>
                    <span class="validation-status"><span class="status-warning" style="background: #ffebee; color: #c62828;">✗</span> 错误</span>
                </div>`;
                invalidTags.forEach(item => {
                    html += `<p style="padding: 4px 12px; font-size: 0.85rem; color: var(--danger-color);">
                        作品「${item.work}」第${item.round}轮 ${this.DIMENSION_NAMES[item.dimension]} 使用了「${item.tag}」（应属 ${this.DIMENSION_NAMES[item.expected]}）
                    </p>`;
                });
            }
        }
        
        validationResult.innerHTML = html;
    }
    
    showVerification() {
        const results = this.performVerification();
        
        let content = `
            <h3 style="margin-bottom: 20px;">数据验证报告</h3>
            
            <div style="margin-bottom: 24px; padding: 16px; background: var(--bg-color); border-radius: var(--radius);">
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; text-align: center;">
                    <div>
                        <div style="font-size: 2rem; color: var(--success-color); font-weight: bold;">${results.passed}</div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary);">通过检查</div>
                    </div>
                    <div>
                        <div style="font-size: 2rem; color: var(--warning-color); font-weight: bold;">${results.warnings}</div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary);">警告</div>
                    </div>
                    <div>
                        <div style="font-size: 2rem; color: var(--danger-color); font-weight: bold;">${results.errors}</div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary);">错误</div>
                    </div>
                </div>
            </div>
        `;
        
        if (results.passedChecks.length > 0) {
            content += `
                <div class="acceptance-section">
                    <h4>✓ 通过的检查</h4>
                    ${results.passedChecks.map(check => `
                        <div class="result-card result-success">
                            <div class="result-header">
                                <span class="result-status">${check.item}</span>
                                <span style="color: var(--success-color);">通过</span>
                            </div>
                            <div class="result-details">${check.message}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        if (results.warningItems.length > 0) {
            content += `
                <div class="acceptance-section">
                    <h4>⚠️ 警告项</h4>
                    ${results.warningItems.map(item => `
                        <div class="result-card" style="border-left: 4px solid var(--warning-color);">
                            <div class="result-header">
                                <span class="result-status">${item.item}</span>
                                <span style="color: var(--warning-color);">警告</span>
                            </div>
                            <div class="result-details">${item.message}</div>
                            ${item.fixAction ? `
                                <div class="fix-button">
                                    <button class="btn btn-secondary btn-sm" onclick="${item.fixAction}">快速修复</button>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        if (results.errorItems.length > 0) {
            content += `
                <div class="acceptance-section">
                    <h4>✗ 错误项</h4>
                    ${results.errorItems.map(item => `
                        <div class="result-card result-failed">
                            <div class="result-header">
                                <span class="result-status">${item.item}</span>
                                <span style="color: var(--danger-color);">错误</span>
                            </div>
                            <div class="result-details">${item.message}</div>
                            ${item.fixAction ? `
                                <div class="fix-button">
                                    <button class="btn btn-secondary btn-sm" onclick="${item.fixAction}">快速修复</button>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        content += `
            <div class="form-actions">
                <button class="btn btn-primary" onclick="app.reverify()">重新验证</button>
                <button class="btn btn-secondary" onclick="app.closeModal()">关闭</button>
            </div>
        `;
        
        this.showModal('数据验证', content);
    }
    
    performVerification() {
        const passedChecks = [];
        const warningItems = [];
        const errorItems = [];
        
        const worksWithRounds = this.works.filter(w => w.rounds.length > 0);
        if (worksWithRounds.length === this.works.length && this.works.length > 0) {
            passedChecks.push({
                item: '作品完整性',
                message: '所有作品都有至少一轮点评'
            });
        }
        
        let allTagsValid = true;
        this.works.forEach(work => {
            work.rounds.forEach(round => {
                this.DIMENSIONS.forEach(dim => {
                    if (round.dimensions[dim] && round.dimensions[dim].tags) {
                        round.dimensions[dim].tags.forEach(tagId => {
                            if (!this.tags.find(t => t.id === tagId)) {
                                allTagsValid = false;
                                errorItems.push({
                                    item: `${work.name} - 第${round.round}轮`,
                                    message: `使用了不存在的标签 ID: ${tagId}`,
                                    fixAction: `app.fixInvalidTag('${work.id}', ${work.rounds.indexOf(round)}, '${dim}', '${tagId}')`
                                });
                            }
                        });
                    }
                });
            });
        });
        
        if (allTagsValid && this.works.length > 0) {
            passedChecks.push({
                item: '标签有效性',
                message: '所有使用的标签均在标签库中存在'
            });
        }
        
        let allRoundsValid = true;
        this.works.forEach(work => {
            const roundNumbers = work.rounds.map(r => r.round).sort((a, b) => a - b);
            for (let i = 0; i < roundNumbers.length; i++) {
                if (roundNumbers[i] !== i + 1) {
                    allRoundsValid = false;
                    errorItems.push({
                        item: `${work.name} - 轮次编号`,
                        message: `轮次编号不连续，期望第${i + 1}轮但实际是${roundNumbers[i]}轮`,
                        fixAction: `app.fixRoundNumbers('${work.id}')`
                    });
                    break;
                }
            }
            
            const uniqueRounds = [...new Set(roundNumbers)];
            if (uniqueRounds.length !== roundNumbers.length) {
                allRoundsValid = false;
                errorItems.push({
                    item: `${work.name} - 轮次编号`,
                    message: '存在重复的轮次编号',
                    fixAction: `app.fixRoundNumbers('${work.id}')`
                });
            }
        });
        
        if (allRoundsValid && this.works.length > 0) {
            passedChecks.push({
                item: '轮次连续性',
                message: '所有作品的轮次编号连续且不重复'
            });
        }
        
        let allScoresValid = true;
        this.works.forEach(work => {
            work.rounds.forEach(round => {
                this.DIMENSIONS.forEach(dim => {
                    const dimension = round.dimensions[dim];
                    if (!dimension || dimension.score < 1 || dimension.score > 5) {
                        allScoresValid = false;
                        warningItems.push({
                            item: `${work.name} - 第${round.round}轮 ${this.DIMENSION_NAMES[dim]}`,
                            message: '评分不在有效范围内 (1-5)',
                            fixAction: `app.fixScore('${work.id}', ${work.rounds.indexOf(round)}, '${dim}')`
                        });
                    }
                });
            });
        });
        
        if (allScoresValid && this.works.length > 0) {
            passedChecks.push({
                item: '评分有效性',
                message: '所有评分都在 1-5 分范围内'
            });
        }
        
        this.works.forEach(work => {
            if (!work.student || !work.name) {
                warningItems.push({
                    item: `${work.name || '未知作品'}`,
                    message: '缺少必填字段（学生姓名或作品名称）'
                });
            }
        });
        
        const missingDimensions = [];
        this.works.forEach(work => {
            work.rounds.forEach((round, index) => {
                this.DIMENSIONS.forEach(dim => {
                    if (!round.dimensions[dim] || !round.dimensions[dim].comments) {
                        missingDimensions.push({
                            work: work.name,
                            round: round.round,
                            dimension: this.DIMENSION_NAMES[dim]
                        });
                    }
                });
            });
        });
        
        if (missingDimensions.length === 0 && this.works.length > 0) {
            passedChecks.push({
                item: '点评完整性',
                message: '所有维度都有详细点评内容'
            });
        }
        
        return {
            passed: passedChecks.length,
            warnings: warningItems.length,
            errors: errorItems.length,
            passedChecks,
            warningItems,
            errorItems
        };
    }
    
    reverify() {
        this.closeModal();
        setTimeout(() => this.showVerification(), 100);
    }
    
    fixInvalidTag(workId, roundIndex, dimension, tagId) {
        const work = this.works.find(w => w.id === workId);
        if (!work || !work.rounds[roundIndex]) return;
        
        const round = work.rounds[roundIndex];
        if (round.dimensions[dimension] && round.dimensions[dimension].tags) {
            round.dimensions[dimension].tags = round.dimensions[dimension].tags.filter(tid => tid !== tagId);
        }
        
        this.saveToStorage();
        this.reverify();
    }
    
    fixRoundNumbers(workId) {
        const work = this.works.find(w => w.id === workId);
        if (!work) return;
        
        work.rounds.sort((a, b) => new Date(a.date) - new Date(b.date));
        work.rounds.forEach((round, index) => {
            round.round = index + 1;
        });
        
        this.saveToStorage();
        this.reverify();
    }
    
    fixScore(workId, roundIndex, dimension) {
        const work = this.works.find(w => w.id === workId);
        if (!work || !work.rounds[roundIndex]) return;
        
        const round = work.rounds[roundIndex];
        if (!round.dimensions[dimension]) {
            round.dimensions[dimension] = { score: 3, comments: '', tags: [] };
        } else {
            round.dimensions[dimension].score = 3;
        }
        
        this.saveToStorage();
        this.reverify();
    }
    
    showAcceptance() {
        const results = this.performVerification();
        const totalChecks = results.passed + results.warnings + results.errors;
        const passRate = totalChecks > 0 ? Math.round((results.passed / totalChecks) * 100) : 0;
        
        let content = `
            <h3 style="margin-bottom: 20px;">验收报告</h3>
            
            <div style="margin-bottom: 24px; padding: 20px; background: var(--bg-color); border-radius: var(--radius); text-align: center;">
                <div style="font-size: 3rem; font-weight: bold; margin-bottom: 8px; color: ${passRate >= 80 ? 'var(--success-color)' : passRate >= 50 ? 'var(--warning-color)' : 'var(--danger-color)'};">
                    ${passRate}%
                </div>
                <div style="font-size: 1.1rem; color: var(--text-secondary);">
                    ${passRate >= 80 ? '✅ 验收通过' : passRate >= 50 ? '⚠️ 部分通过' : '❌ 验收失败'}
                </div>
                <div style="margin-top: 8px; font-size: 0.9rem; color: var(--text-secondary);">
                    通过 ${results.passed}/${totalChecks} 项检查
                </div>
            </div>
            
            <div class="acceptance-section">
                <h4>📋 验收结果摘要</h4>
        `;
        
        if (results.errors > 0) {
            content += `
                <div class="result-card result-failed">
                    <div class="result-header">
                        <span class="result-status">需要人工处理</span>
                        <span style="color: var(--danger-color);">${results.errors} 个错误</span>
                    </div>
                    <div class="result-details">存在影响验收的错误，请查看详细报告并修复后重跑。</div>
                </div>
            `;
        }
        
        if (results.warnings > 0) {
            content += `
                <div class="result-card" style="border-left: 4px solid var(--warning-color);">
                    <div class="result-header">
                        <span class="result-status">建议检查</span>
                        <span style="color: var(--warning-color);">${results.warnings} 个警告</span>
                    </div>
                    <div class="result-details">存在一些警告项，建议检查但不影响核心功能。</div>
                </div>
            `;
        }
        
        if (results.passed > 0) {
            content += `
                <div class="result-card result-success">
                    <div class="result-header">
                        <span class="result-status">正常处理</span>
                        <span style="color: var(--success-color);">${results.passed} 项通过</span>
                    </div>
                    <div class="result-details">这些检查项已通过，无需处理。</div>
                </div>
            `;
        }
        
        content += `
            </div>
            
            <div class="acceptance-section">
                <h4>📐 通过标准检查</h4>
        `;
        
        const criteriaChecks = [
            {
                name: '所有作品至少有一轮完整点评',
                passed: this.works.every(w => w.rounds.length > 0),
                detail: `${this.works.filter(w => w.rounds.length > 0).length}/${this.works.length} 个作品有轮次`
            },
            {
                name: '所有使用的标签均在标签库中存在',
                passed: !results.errorItems.some(e => e.item.includes('标签')),
                detail: '标签验证'
            },
            {
                name: '轮次编号连续且不重复',
                passed: !results.errorItems.some(e => e.item.includes('轮次编号')),
                detail: '轮次验证'
            },
            {
                name: '评分在 1-5 分范围内',
                passed: !results.warningItems.some(w => w.item.includes('评分')),
                detail: '评分验证'
            }
        ];
        
        content += criteriaChecks.map(check => `
            <div class="result-card ${check.passed ? 'result-success' : 'result-failed'}">
                <div class="result-header">
                    <span class="result-status">${check.passed ? '✓' : '✗'} ${check.name}</span>
                    <span style="color: ${check.passed ? 'var(--success-color)' : 'var(--danger-color)'};">
                        ${check.passed ? '通过' : '未通过'}
                    </span>
                </div>
                <div class="result-details">${check.detail}</div>
            </div>
        `).join('');
        
        content += `
            </div>
            
            <div class="acceptance-section">
                <h4>🔄 后续操作</h4>
                <div class="process-flow" style="margin-top: 16px;">
                    <div class="flow-step">
                        <span class="step-number">1</span>
                        <span>修复报告中的错误项</span>
                    </div>
                    <div class="flow-step">
                        <span class="step-number">2</span>
                        <span>点击「重新验证」</span>
                    </div>
                    <div class="flow-step">
                        <span class="step-number">3</span>
                        <span>确认通过率 ≥ 80%</span>
                    </div>
                </div>
            </div>
        `;
        
        content += `
            <div class="form-actions">
                <button class="btn btn-primary" onclick="app.reverify()">重新验证</button>
                <button class="btn btn-secondary" onclick="app.closeModal()">关闭</button>
            </div>
        `;
        
        this.showModal('验收报告', content);
    }
    
    exportData() {
        const data = {
            works: this.works,
            tags: this.tags,
            originalState: this.originalState,
            exportedAt: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `calligraphy-review-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (data.works) this.works = data.works;
                    if (data.tags) this.tags = data.tags;
                    if (data.originalState) this.originalState = data.originalState;
                    
                    this.saveToStorage();
                    this.render();
                    this.checkForIssues();
                    alert('数据导入成功！');
                } catch (err) {
                    alert('导入失败：文件格式错误');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
    
    clearAll() {
        if (!confirm('确定要清空所有数据吗？此操作不可恢复。')) return;
        if (!confirm('再次确认：将删除所有作品、点评和标签数据。')) return;
        
        this.works = [];
        this.tags = [];
        this.originalState = null;
        localStorage.removeItem('calligraphy_works');
        localStorage.removeItem('calligraphy_tags');
        localStorage.removeItem('calligraphy_original');
        
        this.initDefaultTags();
        this.render();
        this.checkForIssues();
    }
    
    loadSampleData() {
        this.works = [
            {
                id: 'w1',
                student: '张明',
                name: '颜真卿多宝塔碑临摹',
                submitDate: '2024-01-15',
                status: 'completed',
                rounds: [
                    {
                        round: 1,
                        date: '2024-01-15',
                        dimensions: {
                            strokes: { score: 3, comments: '起笔不够果断，需要加强基本笔画练习。收笔处有时过于草率。', tags: ['t4', 't6'] },
                            structure: { score: 3, comments: '部分字的结构比例不够协调，需要多观察字帖。', tags: ['t11', 't12'] },
                            composition: { score: 2, comments: '整体布局需要注意，字距行距不够均匀。', tags: ['t16', 't18'] }
                        }
                    },
                    {
                        round: 2,
                        date: '2024-01-22',
                        dimensions: {
                            strokes: { score: 4, comments: '起笔有明显进步，更加果断有力。继续保持。', tags: ['t1', 't3'] },
                            structure: { score: 4, comments: '结构比例明显改善，重心也更稳定了。', tags: ['t7', 't8'] },
                            composition: { score: 3, comments: '布局有所改善，但落款位置还需要调整。', tags: ['t15'] }
                        }
                    }
                ],
                createdAt: '2024-01-15T10:00:00Z'
            },
            {
                id: 'w2',
                student: '李华',
                name: '柳公权玄秘塔碑临摹',
                submitDate: '2024-01-18',
                status: 'in_progress',
                rounds: [
                    {
                        round: 1,
                        date: '2024-01-18',
                        dimensions: {
                            strokes: { score: 4, comments: '起笔收笔都很干净，线条有力度。', tags: ['t1', 't2'] },
                            structure: { score: 3, comments: '结构大体不错，但左右结构还需要更平衡。', tags: ['t10', 't12'] },
                            composition: { score: 4, comments: '整体布局合理，行气连贯。', tags: ['t13', 't14'] }
                        }
                    }
                ],
                createdAt: '2024-01-18T14:30:00Z'
            },
            {
                id: 'w3',
                student: '王芳',
                name: '欧阳询九成宫临摹',
                submitDate: '2024-01-20',
                status: 'pending',
                rounds: [],
                createdAt: '2024-01-20T09:15:00Z'
            }
        ];
        
        this.originalState = JSON.parse(JSON.stringify(this.works));
        this.saveToStorage();
        this.render();
        this.checkForIssues();
    }
}

const app = new CalligraphyReviewSystem();

document.addEventListener('DOMContentLoaded', () => {
    if (app.works.length === 0) {
        setTimeout(() => {
            if (confirm('是否加载示例数据以便体验系统功能？')) {
                app.loadSampleData();
            }
        }, 500);
    }
});
