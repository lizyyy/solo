class FitnessScoreApp {
    constructor() {
        this.records = [];
        this.currentEditId = null;
        this.filterAgeGroup = '';
        this.filterStatus = '';
        
        this.initStorage();
        this.bindEvents();
        this.render();
    }

    initStorage() {
        const stored = localStorage.getItem('fitnessRecords');
        if (stored) {
            this.records = JSON.parse(stored);
        }
    }

    saveToStorage() {
        localStorage.setItem('fitnessRecords', JSON.stringify(this.records));
    }

    static getAgeGroupRules() {
        return [
            { key: 'toddler', name: '幼儿组', min: 3, max: 5, description: '学龄前儿童' },
            { key: 'lower', name: '低年级组', min: 6, max: 8, description: '小学1-2年级' },
            { key: 'upper', name: '中高年级组', min: 9, max: 12, description: '小学3-6年级' },
            { key: 'teen', name: '青少年组', min: 13, max: 16, description: '中学生' }
        ];
    }

    static getAgeGroup(age) {
        const rules = FitnessScoreApp.getAgeGroupRules();
        for (const rule of rules) {
            if (age >= rule.min && age <= rule.max) {
                return rule;
            }
        }
        return null;
    }

    static getScoreStandards() {
        return {
            shuttle: {
                name: '10米折返跑',
                unit: '秒',
                lowerIsBetter: true,
                standards: {
                    toddler: { excellent: 8, good: 10, average: 12 },
                    lower: { excellent: 7, good: 9, average: 11 },
                    upper: { excellent: 6, good: 8, average: 10 },
                    teen: { excellent: 5.5, good: 7.5, average: 9.5 }
                },
                validRange: { min: 2, max: 30 }
            },
            jump: {
                name: '立定跳远',
                unit: '厘米',
                lowerIsBetter: false,
                standards: {
                    toddler: { excellent: 100, good: 80, average: 60 },
                    lower: { excellent: 140, good: 120, average: 100 },
                    upper: { excellent: 180, good: 160, average: 140 },
                    teen: { excellent: 220, good: 200, average: 180 }
                },
                validRange: { min: 0, max: 300 }
            },
            flex: {
                name: '坐位体前屈',
                unit: '厘米',
                lowerIsBetter: false,
                standards: {
                    toddler: { excellent: 15, good: 10, average: 5 },
                    lower: { excellent: 18, good: 13, average: 8 },
                    upper: { excellent: 22, good: 17, average: 12 },
                    teen: { excellent: 25, good: 20, average: 15 }
                },
                validRange: { min: -30, max: 40 }
            },
            rope: {
                name: '一分钟跳绳',
                unit: '个',
                lowerIsBetter: false,
                standards: {
                    toddler: { excellent: 80, good: 50, average: 30 },
                    lower: { excellent: 150, good: 120, average: 90 },
                    upper: { excellent: 200, good: 170, average: 140 },
                    teen: { excellent: 250, good: 220, average: 190 }
                },
                validRange: { min: 0, max: 500 }
            }
        };
    }

    static scoreItem(itemKey, value, ageGroup) {
        const standards = FitnessScoreApp.getScoreStandards();
        const item = standards[itemKey];
        
        if (!item || value === null || value === undefined || value === '') {
            return { score: null, level: null, valid: true };
        }

        const numValue = Number(value);
        
        if (numValue < item.validRange.min || numValue > item.validRange.max) {
            return { score: 0, level: 'invalid', valid: false };
        }

        const groupStandard = item.standards[ageGroup];
        if (!groupStandard) {
            return { score: null, level: null, valid: true };
        }

        let level, score;
        
        if (item.lowerIsBetter) {
            if (numValue <= groupStandard.excellent) {
                level = 'excellent';
                score = 100;
            } else if (numValue <= groupStandard.good) {
                level = 'good';
                score = 80;
            } else if (numValue <= groupStandard.average) {
                level = 'average';
                score = 60;
            } else {
                level = 'poor';
                score = 40;
            }
        } else {
            if (numValue >= groupStandard.excellent) {
                level = 'excellent';
                score = 100;
            } else if (numValue >= groupStandard.good) {
                level = 'good';
                score = 80;
            } else if (numValue >= groupStandard.average) {
                level = 'average';
                score = 60;
            } else {
                level = 'poor';
                score = 40;
            }
        }

        return { score, level, valid: true };
    }

    static calculateOverallScore(record) {
        const items = ['shuttle', 'jump', 'flex', 'rope'];
        const scores = [];
        
        items.forEach(itemKey => {
            const value = record.items[itemKey];
            if (value !== null && value !== undefined && value !== '') {
                const result = FitnessScoreApp.scoreItem(itemKey, value, record.ageGroup);
                if (result.score !== null) {
                    scores.push(result.score);
                }
            }
        });

        if (scores.length === 0) {
            return { score: 0, level: 'none', safetyImpact: 0 };
        }

        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        
        let safetyImpact = 0;
        const safety = record.safety || {};
        
        if (safety.danger) safetyImpact -= 20;
        if (safety.discomfort) safetyImpact -= 10;
        if (safety.help) safetyImpact -= 5;
        if (safety.followRules) safetyImpact += 5;

        const finalScore = Math.max(0, Math.min(100, Math.round(avgScore + safetyImpact)));
        
        let level;
        if (finalScore >= 90) level = 'excellent';
        else if (finalScore >= 75) level = 'good';
        else if (finalScore >= 60) level = 'average';
        else level = 'poor';

        return {
            score: finalScore,
            level,
            safetyImpact,
            itemScores: scores.length,
            avgItemScore: Math.round(avgScore)
        };
    }

    static validateRecord(record) {
        const issues = [];
        const warnings = [];
        
        if (!record.childName || record.childName.trim() === '') {
            issues.push({ field: 'childName', message: '必填字段缺失：姓名' });
        }

        if (record.age === null || record.age === undefined || record.age === '') {
            issues.push({ field: 'childAge', message: '必填字段缺失：年龄' });
        } else if (record.age < 3 || record.age > 16) {
            issues.push({ field: 'childAge', message: `年龄超出有效范围：${record.age}岁（有效范围3-16岁）` });
        }

        if (!record.ageGroup) {
            issues.push({ field: 'ageGroup', message: '无法确定年龄组' });
        }

        const standards = FitnessScoreApp.getScoreStandards();
        for (const [itemKey, value] of Object.entries(record.items || {})) {
            if (value !== null && value !== undefined && value !== '') {
                const numValue = Number(value);
                const item = standards[itemKey];
                if (item) {
                    if (numValue < item.validRange.min || numValue > item.validRange.max) {
                        issues.push({
                            field: `item${itemKey.charAt(0).toUpperCase() + itemKey.slice(1)}`,
                            message: `${item.name}成绩超出合理范围：${numValue}${item.unit}（有效范围：${item.validRange.min}-${item.validRange.max}${item.unit}）`
                        });
                    }
                }
            }
        }

        if (record.safety?.danger) {
            warnings.push({
                field: 'safetyDanger',
                message: '安全观察标记：存在危险动作，需要重点关注'
            });
        }
        if (record.safety?.discomfort) {
            warnings.push({
                field: 'safetyDiscomfort',
                message: '安全观察标记：出现身体不适，建议咨询医生'
            });
        }

        const hasAnyScore = Object.values(record.items || {}).some(
            v => v !== null && v !== undefined && v !== ''
        );
        if (!hasAnyScore) {
            warnings.push({
                field: 'items',
                message: '未录入任何体适能项目成绩'
            });
        }

        const hasErrors = issues.length > 0;
        const hasWarnings = warnings.length > 0;

        let status;
        if (hasErrors) {
            status = 'error';
        } else if (hasWarnings) {
            status = 'warning';
        } else {
            status = 'pass';
        }

        return {
            status,
            issues,
            warnings,
            pass: !hasErrors
        };
    }

    addRecord(recordData) {
        const ageGroup = FitnessScoreApp.getAgeGroup(recordData.age);
        
        const record = {
            id: this.generateId(),
            childName: recordData.childName,
            age: recordData.age,
            gender: recordData.gender,
            testDate: recordData.testDate || new Date().toISOString().split('T')[0],
            ageGroup: ageGroup ? ageGroup.key : null,
            ageGroupName: ageGroup ? ageGroup.name : null,
            items: {
                shuttle: recordData.items?.shuttle || null,
                jump: recordData.items?.jump || null,
                flex: recordData.items?.flex || null,
                rope: recordData.items?.rope || null
            },
            safety: {
                danger: recordData.safety?.danger || false,
                help: recordData.safety?.help || false,
                discomfort: recordData.safety?.discomfort || false,
                followRules: recordData.safety?.followRules || false,
                notes: recordData.safety?.notes || ''
            },
            status: 'pending',
            adminNotes: recordData.adminNotes || '',
            validationResult: null,
            overallScore: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        record.overallScore = FitnessScoreApp.calculateOverallScore(record);
        
        this.records.unshift(record);
        this.saveToStorage();
        this.render();
        
        return record;
    }

    updateRecord(id, recordData) {
        const index = this.records.findIndex(r => r.id === id);
        if (index === -1) return null;

        const ageGroup = FitnessScoreApp.getAgeGroup(recordData.age);
        const oldRecord = this.records[index];

        const updatedRecord = {
            ...oldRecord,
            childName: recordData.childName,
            age: recordData.age,
            gender: recordData.gender,
            testDate: recordData.testDate || oldRecord.testDate,
            ageGroup: ageGroup ? ageGroup.key : null,
            ageGroupName: ageGroup ? ageGroup.name : null,
            items: {
                shuttle: recordData.items?.shuttle ?? oldRecord.items.shuttle,
                jump: recordData.items?.jump ?? oldRecord.items.jump,
                flex: recordData.items?.flex ?? oldRecord.items.flex,
                rope: recordData.items?.rope ?? oldRecord.items.rope
            },
            safety: {
                danger: recordData.safety?.danger ?? oldRecord.safety?.danger,
                help: recordData.safety?.help ?? oldRecord.safety?.help,
                discomfort: recordData.safety?.discomfort ?? oldRecord.safety.discomfort,
                followRules: recordData.safety?.followRules ?? oldRecord.safety.followRules,
                notes: recordData.safety?.notes ?? oldRecord.safety.notes
            },
            adminNotes: recordData.adminNotes ?? oldRecord.adminNotes,
            status: 'pending',
            validationResult: null,
            updatedAt: new Date().toISOString()
        };

        updatedRecord.overallScore = FitnessScoreApp.calculateOverallScore(updatedRecord);

        this.records[index] = updatedRecord;
        this.saveToStorage();
        this.render();

        return updatedRecord;
    }

    confirmRecord(id) {
        const record = this.records.find(r => r.id === id);
        if (!record) return false;

        const validation = FitnessScoreApp.validateRecord(record);
        record.validationResult = validation;

        if (validation.pass) {
            record.status = 'confirmed';
        } else {
            record.status = 'error';
        }

        record.updatedAt = new Date().toISOString();
        this.saveToStorage();
        this.render();

        return record;
    }

    rejectRecord(id, reason = '') {
        const record = this.records.find(r => r.id === id);
        if (!record) return false;

        record.status = 'rejected';
        record.adminNotes = reason ? 
            (record.adminNotes ? record.adminNotes + '\n\n拒绝原因：' + reason : '拒绝原因：' + reason) : 
            record.adminNotes;
        record.validationResult = FitnessScoreApp.validateRecord(record);
        record.updatedAt = new Date().toISOString();

        this.saveToStorage();
        this.render();

        return record;
    }

    deleteRecord(id) {
        const index = this.records.findIndex(r => r.id === id);
        if (index === -1) return false;

        this.records.splice(index, 1);
        this.saveToStorage();
        this.render();

        return true;
    }

    exportToCSV() {
        if (this.records.length === 0) {
            alert('没有数据可导出');
            return;
        }

        const headers = [
            'ID', '姓名', '年龄', '性别', '年龄组', '测试日期',
            '10米折返跑(秒)', '立定跳远(cm)', '坐位体前屈(cm)', '一分钟跳绳(个)',
            '危险动作', '需要帮助', '身体不适', '遵守规则',
            '综合评分', '状态', '创建时间'
        ];

        const rows = this.records.map(r => [
            r.id,
            r.childName,
            r.age,
            r.gender === 'male' ? '男' : '女',
            r.ageGroupName || '',
            r.testDate,
            r.items.shuttle ?? '',
            r.items.jump ?? '',
            r.items.flex ?? '',
            r.items.rope ?? '',
            r.safety?.danger ? '是' : '否',
            r.safety?.help ? '是' : '否',
            r.safety?.discomfort ? '是' : '否',
            r.safety?.followRules ? '是' : '否',
            r.overallScore?.score ?? '',
            this.getStatusName(r.status),
            new Date(r.createdAt).toLocaleString('zh-CN')
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `儿童体适能评分记录_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }

    getStatusName(status) {
        const statusMap = {
            pending: '待审核',
            confirmed: '已确认',
            rejected: '已拒绝',
            error: '异常'
        };
        return statusMap[status] || status;
    }

    getLevelName(level) {
        const levelMap = {
            excellent: '优秀',
            good: '良好',
            average: '及格',
            poor: '不及格',
            none: '无成绩'
        };
        return levelMap[level] || level;
    }

    generateId() {
        return 'REC_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getSampleData() {
        const today = new Date();
        const getRandomDate = (daysAgo = 0) => {
            const d = new Date(today);
            d.setDate(d.getDate() - daysAgo);
            return d.toISOString().split('T')[0];
        };

        return [
            {
                childName: '张小明',
                age: 7,
                gender: 'male',
                testDate: getRandomDate(0),
                items: { shuttle: 8.5, jump: 130, flex: 14, rope: 135 },
                safety: { danger: false, help: false, discomfort: false, followRules: true, notes: '表现优秀，动作规范' },
                adminNotes: ''
            },
            {
                childName: '李小红',
                age: 4,
                gender: 'female',
                testDate: getRandomDate(1),
                items: { shuttle: 9.2, jump: 75, flex: 12, rope: 45 },
                safety: { danger: false, help: true, discomfort: false, followRules: true, notes: '需要老师少量帮助' },
                adminNotes: ''
            },
            {
                childName: '王小强',
                age: 10,
                gender: 'male',
                testDate: getRandomDate(2),
                items: { shuttle: 7.8, jump: 175, flex: 18, rope: 185 },
                safety: { danger: true, help: false, discomfort: false, followRules: false, notes: '跳的时候有危险动作' },
                adminNotes: ''
            },
            {
                childName: '刘小芳',
                age: 14,
                gender: 'female',
                testDate: getRandomDate(3),
                items: { shuttle: 6.2, jump: 195, flex: 22, rope: 220 },
                safety: { danger: false, help: false, discomfort: false, followRules: true, notes: '非常优秀' },
                adminNotes: ''
            },
            {
                childName: '测试异常数据',
                age: 25,
                gender: 'male',
                testDate: getRandomDate(4),
                items: { shuttle: 100, jump: 500, flex: 50, rope: 1000 },
                safety: { danger: true, help: true, discomfort: true, followRules: false, notes: '这是一条异常数据，用于测试验证功能' },
                adminNotes: ''
            },
            {
                childName: '赵小龙',
                age: 5,
                gender: 'male',
                testDate: getRandomDate(5),
                items: { shuttle: 11.5, jump: 65, flex: 3, rope: 25 },
                safety: { danger: false, help: false, discomfort: true, followRules: true, notes: '测试中说肚子疼' },
                adminNotes: ''
            }
        ];
    }

    loadSampleData() {
        const samples = this.getSampleData();
        samples.forEach(data => this.addRecord(data));
        alert(`已加载 ${samples.length} 条示例数据\n\n包含：\n- 正常数据（可确认）\n- 异常数据（用于测试验证）\n- 安全观察标记的数据`);
    }

    clearAllData() {
        if (confirm('确定要清空所有数据吗？此操作不可撤销。')) {
            this.records = [];
            this.saveToStorage();
            this.render();
        }
    }

    verifyAllRecords() {
        let passCount = 0;
        let failCount = 0;
        let warningCount = 0;

        this.records.forEach(record => {
            const validation = FitnessScoreApp.validateRecord(record);
            record.validationResult = validation;
            
            if (validation.pass) {
                if (validation.warnings.length > 0) {
                    warningCount++;
                } else {
                    passCount++;
                }
            } else {
                failCount++;
            }
        });

        this.saveToStorage();
        this.render();

        alert(`批量验证完成！\n\n✅ 通过：${passCount} 条\n⚠️ 有警告：${warningCount} 条\n❌ 失败：${failCount} 条\n\n请查看各记录的状态变化`);
    }

    getFilteredRecords() {
        return this.records.filter(record => {
            if (this.filterAgeGroup && record.ageGroup !== this.filterAgeGroup) {
                return false;
            }
            if (this.filterStatus && record.status !== this.filterStatus) {
                return false;
            }
            return true;
        });
    }

    render() {
        this.renderStats();
        this.renderRecords();
    }

    renderStats() {
        const stats = {
            total: this.records.length,
            pending: this.records.filter(r => r.status === 'pending').length,
            confirmed: this.records.filter(r => r.status === 'confirmed').length,
            rejected: this.records.filter(r => r.status === 'rejected').length,
            error: this.records.filter(r => r.status === 'error').length
        };

        document.getElementById('statTotal').textContent = stats.total;
        document.getElementById('statPending').textContent = stats.pending;
        document.getElementById('statConfirmed').textContent = stats.confirmed;
        document.getElementById('statRejected').textContent = stats.rejected;
        document.getElementById('statError').textContent = stats.error;
    }

    renderRecords() {
        const container = document.getElementById('recordsList');
        const records = this.getFilteredRecords();

        if (records.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>暂无数据</p>
                    <p class="hint">点击"📦 加载示例数据"或"➕ 新增记录"开始</p>
                </div>
            `;
            return;
        }

        container.innerHTML = records.map(record => this.renderRecordCard(record)).join('');

        container.querySelectorAll('.record-card').forEach(card => {
            const id = card.dataset.id;
            
            card.addEventListener('click', (e) => {
                if (e.target.closest('.record-actions')) return;
                this.showDetailModal(id);
            });
        });

        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const action = btn.dataset.action;
                this.handleRecordAction(id, action);
            });
        });
    }

    renderRecordCard(record) {
        const score = record.overallScore;
        const scoreClass = score?.level ? `score-${score.level}` : 'score-poor';
        const statusClass = `status-${record.status}`;
        const ageGroupBadge = record.ageGroupName ? 
            `<span class="age-group-badge">${record.ageGroupName} (${record.age}岁)</span>` : 
            `<span class="age-group-badge" style="background:#f8d7da;color:#721c24;">年龄异常</span>`;

        const safetyTags = this.renderSafetyTags(record.safety);

        return `
            <div class="record-card" data-id="${record.id}">
                <div class="record-header">
                    <div class="record-basic">
                        <div class="record-name">${record.childName}</div>
                        <div class="record-meta">
                            ${ageGroupBadge}
                            <span class="status-badge ${statusClass}">${this.getStatusName(record.status)}</span>
                            <span>${record.testDate}</span>
                        </div>
                    </div>
                    <div class="record-score">
                        <div class="score-circle ${scoreClass}">
                            <span class="score-value">${score?.score ?? '-'}</span>
                            <span class="score-label">${score ? this.getLevelName(score.level) : '无评分'}</span>
                        </div>
                    </div>
                </div>
                <div class="record-body">
                    <div class="items-grid">
                        ${this.renderItemDisplay('shuttle', record.items.shuttle, record.ageGroup)}
                        ${this.renderItemDisplay('jump', record.items.jump, record.ageGroup)}
                        ${this.renderItemDisplay('flex', record.items.flex, record.ageGroup)}
                        ${this.renderItemDisplay('rope', record.items.rope, record.ageGroup)}
                    </div>
                    <div class="safety-summary">
                        <div class="safety-title">🛡️ 安全观察</div>
                        <div class="safety-tags">
                            ${safetyTags || '<span class="safety-tag safety-tag-safe">无特殊标记</span>'}
                        </div>
                    </div>
                </div>
                <div class="record-actions">
                    <button class="btn btn-sm btn-success" data-id="${record.id}" data-action="confirm">✅ 确认</button>
                    <button class="btn btn-sm btn-danger" data-id="${record.id}" data-action="reject">❌ 拒绝</button>
                    <button class="btn btn-sm btn-primary" data-id="${record.id}" data-action="edit">✏️ 修改</button>
                    <button class="btn btn-sm btn-info" data-id="${record.id}" data-action="validate">🔍 验证</button>
                    <button class="btn btn-sm btn-secondary" data-id="${record.id}" data-action="delete">🗑️ 删除</button>
                </div>
            </div>
        `;
    }

    renderItemDisplay(itemKey, value, ageGroup) {
        const standards = FitnessScoreApp.getScoreStandards();
        const item = standards[itemKey];
        
        if (value === null || value === undefined || value === '') {
            return `
                <div class="item-card">
                    <div class="item-name">${item.name}</div>
                    <div class="item-value" style="color:#999;">-</div>
                    <div class="item-unit">${item.unit}</div>
                </div>
            `;
        }

        const result = FitnessScoreApp.scoreItem(itemKey, value, ageGroup);
        const levelColors = {
            excellent: '#28a745',
            good: '#17a2b8',
            average: '#ffc107',
            poor: '#dc3545',
            invalid: '#6f42c1'
        };
        const color = levelColors[result.level] || '#333';

        return `
            <div class="item-card">
                <div class="item-name">${item.name}</div>
                <div class="item-value" style="color:${color};">${value}</div>
                <div class="item-unit">${item.unit}</div>
            </div>
        `;
    }

    renderSafetyTags(safety) {
        if (!safety) return '';
        
        const tags = [];
        
        if (safety.danger) {
            tags.push('<span class="safety-tag safety-tag-danger">⚠️ 危险动作</span>');
        }
        if (safety.help) {
            tags.push('<span class="safety-tag safety-tag-warning">🆘 需要帮助</span>');
        }
        if (safety.discomfort) {
            tags.push('<span class="safety-tag safety-tag-warning">🤕 身体不适</span>');
        }
        if (safety.followRules) {
            tags.push('<span class="safety-tag safety-tag-safe">✅ 遵守规则</span>');
        }

        return tags.join('');
    }

    handleRecordAction(id, action) {
        const record = this.records.find(r => r.id === id);
        if (!record) return;

        switch (action) {
            case 'confirm':
                this.confirmRecord(id);
                break;
            case 'reject':
                const reason = prompt('请输入拒绝原因（可选）：');
                if (reason !== null) {
                    this.rejectRecord(id, reason);
                }
                break;
            case 'edit':
                this.openEditModal(id);
                break;
            case 'validate':
                this.showValidationModal(record);
                break;
            case 'delete':
                if (confirm('确定要删除这条记录吗？')) {
                    this.deleteRecord(id);
                }
                break;
        }
    }

    bindEvents() {
        document.getElementById('btnAdd').addEventListener('click', () => this.openAddModal());
        document.getElementById('btnLoadSamples').addEventListener('click', () => this.loadSampleData());
        document.getElementById('btnExport').addEventListener('click', () => this.exportToCSV());
        document.getElementById('btnClearAll').addEventListener('click', () => this.clearAllData());
        document.getElementById('btnVerifyAll').addEventListener('click', () => this.verifyAllRecords());

        document.getElementById('filterAgeGroup').addEventListener('change', (e) => {
            this.filterAgeGroup = e.target.value;
            this.render();
        });
        document.getElementById('filterStatus').addEventListener('change', (e) => {
            this.filterStatus = e.target.value;
            this.render();
        });

        document.getElementById('modalClose').addEventListener('click', () => this.closeRecordModal());
        document.getElementById('btnCancel').addEventListener('click', () => this.closeRecordModal());
        document.getElementById('recordForm').addEventListener('submit', (e) => this.handleFormSubmit(e));
        document.getElementById('btnValidate').addEventListener('click', () => this.validateFormData());

        document.getElementById('validateModalClose').addEventListener('click', () => this.closeValidateModal());
        document.getElementById('btnValidateClose').addEventListener('click', () => this.closeValidateModal());

        document.getElementById('detailModalClose').addEventListener('click', () => this.closeDetailModal());
        document.getElementById('btnDetailClose').addEventListener('click', () => this.closeDetailModal());

        document.getElementById('childAge').addEventListener('input', (e) => {
            this.updateAgeGroupDisplay(Number(e.target.value));
        });

        ['#recordModal', '#validateModal', '#detailModal'].forEach(selector => {
            document.querySelector(selector).addEventListener('click', (e) => {
                if (e.target === e.currentTarget) {
                    this.closeRecordModal();
                    this.closeValidateModal();
                    this.closeDetailModal();
                }
            });
        });
    }

    openAddModal() {
        this.currentEditId = null;
        document.getElementById('modalTitle').textContent = '新增记录';
        this.resetForm();
        document.getElementById('recordModal').classList.remove('hidden');
    }

    openEditModal(id) {
        const record = this.records.find(r => r.id === id);
        if (!record) return;

        this.currentEditId = id;
        document.getElementById('modalTitle').textContent = '修改记录';
        this.fillForm(record);
        document.getElementById('recordModal').classList.remove('hidden');
    }

    closeRecordModal() {
        document.getElementById('recordModal').classList.add('hidden');
        this.currentEditId = null;
        this.resetForm();
    }

    resetForm() {
        document.getElementById('recordForm').reset();
        document.getElementById('recordId').value = '';
        document.getElementById('testDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('ageGroupResult').textContent = '-';
        document.getElementById('ageGroupResult').className = 'age-group-badge';
    }

    fillForm(record) {
        document.getElementById('recordId').value = record.id;
        document.getElementById('childName').value = record.childName;
        document.getElementById('childAge').value = record.age;
        document.getElementById('childGender').value = record.gender;
        document.getElementById('testDate').value = record.testDate;

        document.getElementById('itemShuttle').value = record.items.shuttle ?? '';
        document.getElementById('itemJump').value = record.items.jump ?? '';
        document.getElementById('itemFlex').value = record.items.flex ?? '';
        document.getElementById('itemRope').value = record.items.rope ?? '';

        document.getElementById('safetyDanger').checked = record.safety?.danger || false;
        document.getElementById('safetyHelp').checked = record.safety?.help || false;
        document.getElementById('safetyDiscomfort').checked = record.safety?.discomfort || false;
        document.getElementById('safetyFollowRules').checked = record.safety?.followRules || false;
        document.getElementById('safetyNotes').value = record.safety?.notes || '';

        document.getElementById('adminNotes').value = record.adminNotes || '';

        this.updateAgeGroupDisplay(record.age);
    }

    updateAgeGroupDisplay(age) {
        const resultEl = document.getElementById('ageGroupResult');
        
        if (!age || isNaN(age)) {
            resultEl.textContent = '-';
            resultEl.className = 'age-group-badge';
            return;
        }

        const ageGroup = FitnessScoreApp.getAgeGroup(age);
        
        if (ageGroup) {
            resultEl.textContent = `${ageGroup.name} (${ageGroup.description})`;
            resultEl.className = 'age-group-badge';
            resultEl.style.background = '#d4edda';
            resultEl.style.color = '#155724';
        } else if (age < 3 || age > 16) {
            resultEl.textContent = '超出有效范围 (3-16岁)';
            resultEl.className = 'age-group-badge';
            resultEl.style.background = '#f8d7da';
            resultEl.style.color = '#721c24';
        } else {
            resultEl.textContent = '-';
            resultEl.className = 'age-group-badge';
        }
    }

    getFormData() {
        return {
            childName: document.getElementById('childName').value.trim(),
            age: document.getElementById('childAge').value ? Number(document.getElementById('childAge').value) : null,
            gender: document.getElementById('childGender').value,
            testDate: document.getElementById('testDate').value,
            items: {
                shuttle: document.getElementById('itemShuttle').value ? Number(document.getElementById('itemShuttle').value) : null,
                jump: document.getElementById('itemJump').value ? Number(document.getElementById('itemJump').value) : null,
                flex: document.getElementById('itemFlex').value ? Number(document.getElementById('itemFlex').value) : null,
                rope: document.getElementById('itemRope').value ? Number(document.getElementById('itemRope').value) : null
            },
            safety: {
                danger: document.getElementById('safetyDanger').checked,
                help: document.getElementById('safetyHelp').checked,
                discomfort: document.getElementById('safetyDiscomfort').checked,
                followRules: document.getElementById('safetyFollowRules').checked,
                notes: document.getElementById('safetyNotes').value.trim()
            },
            adminNotes: document.getElementById('adminNotes').value.trim()
        };
    }

    handleFormSubmit(e) {
        e.preventDefault();
        
        const data = this.getFormData();
        
        if (this.currentEditId) {
            this.updateRecord(this.currentEditId, data);
            alert('记录已更新！请重新验证或确认。');
        } else {
            this.addRecord(data);
            alert('记录已添加！状态为"待审核"，请进行验证或确认。');
        }
        
        this.closeRecordModal();
    }

    validateFormData() {
        const data = this.getFormData();
        
        const tempRecord = {
            ...data,
            ageGroup: data.age ? (FitnessScoreApp.getAgeGroup(data.age)?.key || null) : null
        };

        const validation = FitnessScoreApp.validateRecord(tempRecord);
        this.showValidationResult(validation, '表单数据验证');
    }

    showValidationModal(record) {
        const validation = record.validationResult || FitnessScoreApp.validateRecord(record);
        this.showValidationResult(validation, `记录验证：${record.childName}`);
    }

    showValidationResult(validation, title) {
        document.getElementById('validateTitle').textContent = title;
        
        let summaryClass, summaryText;
        if (validation.pass) {
            if (validation.warnings.length > 0) {
                summaryClass = 'validation-summary-warning';
                summaryText = '⚠️ 验证通过，但存在警告信息';
            } else {
                summaryClass = 'validation-summary-pass';
                summaryText = '✅ 验证通过，数据正常';
            }
        } else {
            summaryClass = 'validation-summary-fail';
            summaryText = '❌ 验证失败，存在问题';
        }

        let html = `<div class="validation-summary ${summaryClass}">${summaryText}</div>`;

        if (validation.issues.length > 0) {
            html += '<h4 style="margin:20px 0 10px;color:#dc3545;">❌ 错误项：</h4>';
            validation.issues.forEach(issue => {
                html += `
                    <div class="validation-item validation-fail">
                        <div class="validation-title">${issue.message}</div>
                        <div class="validation-detail">字段：${issue.field}</div>
                    </div>
                `;
            });
        }

        if (validation.warnings.length > 0) {
            html += '<h4 style="margin:20px 0 10px;color:#856404;">⚠️ 警告项：</h4>';
            validation.warnings.forEach(warning => {
                html += `
                    <div class="validation-item validation-warning">
                        <div class="validation-title">${warning.message}</div>
                        <div class="validation-detail">字段：${warning.field}</div>
                    </div>
                `;
            });
        }

        if (validation.issues.length === 0 && validation.warnings.length === 0) {
            html += `
                <div class="validation-item validation-pass">
                    <div class="validation-title">所有检查项通过</div>
                    <div class="validation-detail">年龄分组有效、项目成绩在合理范围内、安全观察无异常</div>
                </div>
            `;
        }

        document.getElementById('validateContent').innerHTML = html;
        document.getElementById('validateModal').classList.remove('hidden');
    }

    closeValidateModal() {
        document.getElementById('validateModal').classList.add('hidden');
    }

    showDetailModal(id) {
        const record = this.records.find(r => r.id === id);
        if (!record) return;

        document.getElementById('detailTitle').textContent = `详细信息：${record.childName}`;
        
        const score = record.overallScore;
        const validation = record.validationResult;
        const standards = FitnessScoreApp.getScoreStandards();

        let itemsHtml = '';
        for (const [key, item] of Object.entries(standards)) {
            const value = record.items[key];
            const result = value !== null && value !== undefined && value !== '' && record.ageGroup
                ? FitnessScoreApp.scoreItem(key, value, record.ageGroup)
                : null;
            
            const levelText = result ? this.getLevelName(result.level) : '-';
            const levelColor = result ? {
                excellent: '#28a745',
                good: '#17a2b8',
                average: '#ffc107',
                poor: '#dc3545',
                invalid: '#6f42c1'
            }[result.level] || '#333' : '#999';

            itemsHtml += `
                <div class="detail-item">
                    <div class="detail-label">${item.name}</div>
                    <div class="detail-value">
                        ${value !== null && value !== undefined && value !== '' ? value : '-'} ${item.unit}
                        ${result ? `<span style="color:${levelColor};margin-left:10px;">[${levelText}]</span>` : ''}
                    </div>
                </div>
            `;
        }

        let validationHtml = '';
        if (validation) {
            const statusText = validation.pass ? 
                (validation.warnings.length > 0 ? '⚠️ 有警告' : '✅ 通过') : 
                '❌ 失败';
            validationHtml = `
                <div class="detail-section">
                    <h3>🔬 验证结果</h3>
                    <div class="detail-item">
                        <div class="detail-label">验证状态</div>
                        <div class="detail-value">${statusText}</div>
                    </div>
                    ${validation.issues.length > 0 ? `
                        <div class="detail-item">
                            <div class="detail-label">错误项</div>
                            <div class="detail-value" style="color:#dc3545;">
                                ${validation.issues.map(i => i.message).join('<br>')}
                            </div>
                        </div>
                    ` : ''}
                    ${validation.warnings.length > 0 ? `
                        <div class="detail-item">
                            <div class="detail-label">警告项</div>
                            <div class="detail-value" style="color:#856404;">
                                ${validation.warnings.map(w => w.message).join('<br>')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        let scoreImpactHtml = '';
        if (score) {
            scoreImpactHtml = `
                <div class="detail-item">
                    <div class="detail-label">项目平均得分</div>
                    <div class="detail-value">${score.avgItemScore} 分</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">安全影响调整</div>
                    <div class="detail-value" style="color:${score.safetyImpact >= 0 ? '#28a745' : '#dc3545'};">
                        ${score.safetyImpact >= 0 ? '+' : ''}${score.safetyImpact} 分
                    </div>
                </div>
            `;
        }

        document.getElementById('detailContent').innerHTML = `
            <div class="detail-section">
                <h3>👶 基本信息</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">姓名</div>
                        <div class="detail-value">${record.childName}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">年龄</div>
                        <div class="detail-value">${record.age} 岁</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">性别</div>
                        <div class="detail-value">${record.gender === 'male' ? '男' : '女'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">年龄组</div>
                        <div class="detail-value">${record.ageGroupName || '未知'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">测试日期</div>
                        <div class="detail-value">${record.testDate}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">当前状态</div>
                        <div class="detail-value">
                            <span class="status-badge status-${record.status}">${this.getStatusName(record.status)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h3>🏃 体适能项目成绩</h3>
                <div class="detail-grid">
                    ${itemsHtml}
                </div>
            </div>

            <div class="detail-section">
                <h3>🛡️ 安全观察</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">危险动作</div>
                        <div class="detail-value" style="color:${record.safety?.danger ? '#dc3545' : '#28a745'};">
                            ${record.safety?.danger ? '⚠️ 是' : '✅ 否'}
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">需要帮助</div>
                        <div class="detail-value" style="color:${record.safety?.help ? '#856404' : '#28a745'};">
                            ${record.safety?.help ? '🆘 是' : '✅ 否'}
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">身体不适</div>
                        <div class="detail-value" style="color:${record.safety?.discomfort ? '#856404' : '#28a745'};">
                            ${record.safety?.discomfort ? '🤕 是' : '✅ 否'}
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">遵守规则</div>
                        <div class="detail-value" style="color:${record.safety?.followRules ? '#28a745' : '#856404'};">
                            ${record.safety?.followRules ? '✅ 是' : '⚠️ 否'}
                        </div>
                    </div>
                </div>
                ${record.safety?.notes ? `
                    <div class="detail-item" style="margin-top:15px;">
                        <div class="detail-label">安全观察备注</div>
                        <div class="detail-value">${record.safety.notes}</div>
                    </div>
                ` : ''}
            </div>

            <div class="detail-section">
                <h3>📊 综合评分</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">综合得分</div>
                        <div class="detail-value" style="font-size:1.5rem;font-weight:bold;">
                            ${score?.score ?? '-'} 分
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">评级</div>
                        <div class="detail-value">${score ? this.getLevelName(score.level) : '-'}</div>
                    </div>
                    ${scoreImpactHtml}
                </div>
            </div>

            ${validationHtml}

            ${record.adminNotes ? `
                <div class="detail-section">
                    <h3>📝 审核备注</h3>
                    <div class="detail-item">
                        <div class="detail-value">${record.adminNotes.replace(/\n/g, '<br>')}</div>
                    </div>
                </div>
            ` : ''}

            <div class="detail-section">
                <h3>📅 时间记录</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">创建时间</div>
                        <div class="detail-value">${new Date(record.createdAt).toLocaleString('zh-CN')}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">更新时间</div>
                        <div class="detail-value">${new Date(record.updatedAt).toLocaleString('zh-CN')}</div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('detailModal').classList.remove('hidden');
    }

    closeDetailModal() {
        document.getElementById('detailModal').classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new FitnessScoreApp();
});