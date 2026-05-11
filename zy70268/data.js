const DataManager = {
    STORAGE_KEY: 'property_deposit_data',
    
    state: {
        registrations: [],
        deposits: [],
        inspections: [],
        history: [],
        nextId: {
            registration: 1,
            deposit: 1,
            inspection: 1
        }
    },

    statusMap: {
        registration: {
            pending: '待审核',
            approved: '已通过',
            rejected: '已拒绝',
            modified: '已修改'
        },
        deposit: {
            frozen: '已冻结',
            partial_refund: '部分退还',
            refunded: '已退还'
        },
        inspection: {
            open: '待整改',
            in_progress: '整改中',
            completed: '已整改待验',
            closed: '已关闭'
        }
    },

    init() {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
            this.state = JSON.parse(saved);
        }
        return this.state;
    },

    save() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
    },

    reset() {
        localStorage.removeItem(this.STORAGE_KEY);
        this.state = {
            registrations: [],
            deposits: [],
            inspections: [],
            history: [],
            nextId: {
                registration: 1,
                deposit: 1,
                inspection: 1
            }
        };
    },

    generateId(type) {
        return this.state.nextId[type]++;
    },

    formatDate(date) {
        return new Date(date).toLocaleDateString('zh-CN');
    },

    formatDateTime(date) {
        return new Date(date).toLocaleString('zh-CN');
    },

    formatCurrency(amount) {
        return '¥' + Number(amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 });
    },

    addHistory(type, action, entityId, title, beforeData = null, afterData = null) {
        const history = {
            id: Date.now(),
            type,
            action,
            entityId,
            title,
            timestamp: new Date().toISOString(),
            beforeData,
            afterData
        };
        this.state.history.unshift(history);
        this.save();
        return history;
    },

    createRegistration(data) {
        const id = this.generateId('registration');
        const registration = {
            id,
            ...data,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.state.registrations.push(registration);
        this.addHistory('registration', 'create', id, `新增装修报备：${data.roomNumber} - ${data.ownerName}`, null, registration);
        this.save();
        return registration;
    },

    updateRegistration(id, data) {
        const index = this.state.registrations.findIndex(r => r.id === id);
        if (index === -1) return null;
        
        const beforeData = JSON.parse(JSON.stringify(this.state.registrations[index]));
        const oldStatus = beforeData.status;
        
        this.state.registrations[index] = {
            ...beforeData,
            ...data,
            status: oldStatus === 'pending' ? 'pending' : 'modified',
            updatedAt: new Date().toISOString()
        };
        
        const afterData = this.state.registrations[index];
        this.addHistory('registration', 'update', id, `修改报备：${afterData.roomNumber} - ${afterData.ownerName}`, beforeData, afterData);
        this.save();
        return afterData;
    },

    approveRegistration(id) {
        const index = this.state.registrations.findIndex(r => r.id === id);
        if (index === -1) return null;
        
        const beforeData = JSON.parse(JSON.stringify(this.state.registrations[index]));
        this.state.registrations[index].status = 'approved';
        this.state.registrations[index].approvedAt = new Date().toISOString();
        const afterData = this.state.registrations[index];
        
        this.addHistory('registration', 'approve', id, `审核通过：${afterData.roomNumber} - ${afterData.ownerName}`, beforeData, afterData);
        this.save();
        return afterData;
    },

    rejectRegistration(id, reason) {
        const index = this.state.registrations.findIndex(r => r.id === id);
        if (index === -1) return null;
        
        const beforeData = JSON.parse(JSON.stringify(this.state.registrations[index]));
        this.state.registrations[index].status = 'rejected';
        this.state.registrations[index].rejectReason = reason;
        this.state.registrations[index].rejectedAt = new Date().toISOString();
        const afterData = this.state.registrations[index];
        
        this.addHistory('registration', 'reject', id, `审核拒绝：${afterData.roomNumber} - ${afterData.ownerName}`, beforeData, afterData);
        this.save();
        return afterData;
    },

    withdrawRegistration(id) {
        const index = this.state.registrations.findIndex(r => r.id === id);
        if (index === -1) return null;
        
        const beforeData = JSON.parse(JSON.stringify(this.state.registrations[index]));
        this.state.registrations[index].status = 'pending';
        const afterData = this.state.registrations[index];
        
        this.addHistory('registration', 'withdraw', id, `撤回并重新提交：${afterData.roomNumber} - ${afterData.ownerName}`, beforeData, afterData);
        this.save();
        return afterData;
    },

    getRegistrations(filter = 'all') {
        if (filter === 'all') return this.state.registrations;
        return this.state.registrations.filter(r => r.status === filter);
    },

    getRegistration(id) {
        return this.state.registrations.find(r => r.id === id);
    },

    createDeposit(data) {
        const id = this.generateId('deposit');
        const deposit = {
            id,
            ...data,
            status: 'frozen',
            frozenAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.state.deposits.push(deposit);
        this.addHistory('deposit', 'create', id, `冻结押金：${data.roomNumber} - ${this.formatCurrency(data.amount)}`, null, deposit);
        this.save();
        return deposit;
    },

    refundDeposit(id, refundAmount, reason = '') {
        const index = this.state.deposits.findIndex(d => d.id === id);
        if (index === -1) return null;
        
        const beforeData = JSON.parse(JSON.stringify(this.state.deposits[index]));
        const originalAmount = Number(beforeData.amount);
        const remainingAmount = originalAmount - Number(refundAmount);
        
        if (remainingAmount <= 0) {
            this.state.deposits[index].status = 'refunded';
            this.state.deposits[index].refundedAmount = originalAmount;
            this.state.deposits[index].remainingAmount = 0;
        } else {
            this.state.deposits[index].status = 'partial_refund';
            this.state.deposits[index].refundedAmount = (beforeData.refundedAmount || 0) + Number(refundAmount);
            this.state.deposits[index].remainingAmount = remainingAmount;
        }
        
        this.state.deposits[index].refundReason = reason;
        this.state.deposits[index].refundedAt = new Date().toISOString();
        this.state.deposits[index].updatedAt = new Date().toISOString();
        
        const afterData = this.state.deposits[index];
        this.addHistory('deposit', 'refund', id, `退还押金：${beforeData.roomNumber} - ${this.formatCurrency(refundAmount)}`, beforeData, afterData);
        this.save();
        return afterData;
    },

    getDeposits(filter = 'all') {
        if (filter === 'all') return this.state.deposits;
        return this.state.deposits.filter(d => d.status === filter);
    },

    getDeposit(id) {
        return this.state.deposits.find(d => d.id === id);
    },

    getDepositByRegistration(registrationId) {
        return this.state.deposits.find(d => d.registrationId === registrationId);
    },

    createInspection(data) {
        const id = this.generateId('inspection');
        const inspection = {
            id,
            ...data,
            status: 'open',
            discoveredAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.state.inspections.push(inspection);
        this.addHistory('inspection', 'create', id, `新增巡检问题：${data.roomNumber} - ${data.issueType}`, null, inspection);
        this.save();
        return inspection;
    },

    updateInspection(id, data) {
        const index = this.state.inspections.findIndex(i => i.id === id);
        if (index === -1) return null;
        
        const beforeData = JSON.parse(JSON.stringify(this.state.inspections[index]));
        this.state.inspections[index] = {
            ...beforeData,
            ...data,
            updatedAt: new Date().toISOString()
        };
        const afterData = this.state.inspections[index];
        
        this.addHistory('inspection', 'update', id, `修改巡检问题：${afterData.roomNumber} - ${afterData.issueType}`, beforeData, afterData);
        this.save();
        return afterData;
    },

    startRectification(id, rectifyPlan) {
        const index = this.state.inspections.findIndex(i => i.id === id);
        if (index === -1) return null;
        
        const beforeData = JSON.parse(JSON.stringify(this.state.inspections[index]));
        this.state.inspections[index].status = 'in_progress';
        this.state.inspections[index].rectifyPlan = rectifyPlan;
        this.state.inspections[index].rectifyStartedAt = new Date().toISOString();
        const afterData = this.state.inspections[index];
        
        this.addHistory('inspection', 'update', id, `开始整改：${afterData.roomNumber} - ${afterData.issueType}`, beforeData, afterData);
        this.save();
        return afterData;
    },

    submitRectification(id, rectifyDesc, rectifyPhotos) {
        const index = this.state.inspections.findIndex(i => i.id === id);
        if (index === -1) return null;
        
        const beforeData = JSON.parse(JSON.stringify(this.state.inspections[index]));
        this.state.inspections[index].status = 'completed';
        this.state.inspections[index].rectifyDesc = rectifyDesc;
        this.state.inspections[index].rectifyPhotos = rectifyPhotos;
        this.state.inspections[index].rectifyCompletedAt = new Date().toISOString();
        const afterData = this.state.inspections[index];
        
        this.addHistory('inspection', 'update', id, `提交整改：${afterData.roomNumber} - ${afterData.issueType}`, beforeData, afterData);
        this.save();
        return afterData;
    },

    closeInspection(id) {
        const index = this.state.inspections.findIndex(i => i.id === id);
        if (index === -1) return null;
        
        const beforeData = JSON.parse(JSON.stringify(this.state.inspections[index]));
        this.state.inspections[index].status = 'closed';
        this.state.inspections[index].closedAt = new Date().toISOString();
        const afterData = this.state.inspections[index];
        
        this.addHistory('inspection', 'approve', id, `验收通过：${afterData.roomNumber} - ${afterData.issueType}`, beforeData, afterData);
        this.save();
        return afterData;
    },

    reopenInspection(id, reason) {
        const index = this.state.inspections.findIndex(i => i.id === id);
        if (index === -1) return null;
        
        const beforeData = JSON.parse(JSON.stringify(this.state.inspections[index]));
        this.state.inspections[index].status = 'open';
        this.state.inspections[index].reopenReason = reason;
        const afterData = this.state.inspections[index];
        
        this.addHistory('inspection', 'reject', id, `整改不合格，重新整改：${afterData.roomNumber} - ${afterData.issueType}`, beforeData, afterData);
        this.save();
        return afterData;
    },

    getInspections(filter = 'all') {
        if (filter === 'all') return this.state.inspections;
        return this.state.inspections.filter(i => i.status === filter);
    },

    getInspectionsByRegistration(registrationId) {
        return this.state.inspections.filter(i => i.registrationId === registrationId);
    },

    getInspection(id) {
        return this.state.inspections.find(i => i.id === id);
    },

    canRefund(registrationId) {
        const registration = this.getRegistration(registrationId);
        if (!registration) return { can: false, reason: '报备记录不存在' };
        if (registration.status !== 'approved') return { can: false, reason: '报备未审核通过' };
        
        const deposit = this.getDepositByRegistration(registrationId);
        if (!deposit) return { can: false, reason: '押金未冻结' };
        if (deposit.status === 'refunded') return { can: false, reason: '押金已退还' };
        
        const inspections = this.getInspectionsByRegistration(registrationId);
        const openInspections = inspections.filter(i => i.status !== 'closed');
        if (openInspections.length > 0) {
            return { can: false, reason: `仍有 ${openInspections.length} 个巡检问题未关闭` };
        }
        
        return { can: true, reason: '' };
    },

    getRefundChecklist(registrationId) {
        const registration = this.getRegistration(registrationId);
        if (!registration) return [];
        
        const checklist = [];
        
        checklist.push({
            title: '装修报备审核',
            status: registration.status === 'approved' ? 'check' : 'cross',
            description: registration.status === 'approved' ? '报备已审核通过' : `当前状态：${this.statusMap.registration[registration.status]}`,
            detail: `报备编号：R${String(registration.id).padStart(4, '0')}，审核时间：${registration.approvedAt ? this.formatDateTime(registration.approvedAt) : '未审核'}`
        });
        
        const deposit = this.getDepositByRegistration(registrationId);
        checklist.push({
            title: '装修押金冻结',
            status: deposit ? 'check' : 'cross',
            description: deposit ? `押金已冻结：${this.formatCurrency(deposit.amount)}` : '押金未冻结',
            detail: deposit ? `冻结时间：${this.formatDateTime(deposit.frozenAt)}，当前状态：${this.statusMap.deposit[deposit.status]}` : '请先到押金管理页面冻结押金'
        });
        
        const inspections = this.getInspectionsByRegistration(registrationId);
        const openCount = inspections.filter(i => i.status !== 'closed').length;
        const totalCount = inspections.length;
        
        checklist.push({
            title: '巡检问题整改',
            status: totalCount === 0 ? 'warn' : (openCount === 0 ? 'check' : 'cross'),
            description: totalCount === 0 ? '暂无巡检记录' : `${openCount === 0 ? '全部' : openCount} 个问题${openCount === 0 ? '已关闭' : '待关闭'}`,
            detail: `共 ${totalCount} 条巡检记录，其中 ${openCount} 条待整改/验收中`
        });
        
        return checklist;
    },

    getTodoList() {
        const todos = [];
        
        this.state.registrations
            .filter(r => r.status === 'pending')
            .forEach(r => {
                todos.push({
                    id: `reg-${r.id}`,
                    type: 'registration',
                    entityId: r.id,
                    title: `${r.roomNumber} 装修报备待审核`,
                    description: `业主：${r.ownerName}，装修类型：${r.decorationType}`,
                    priority: 'high',
                    tab: 'registration'
                });
            });
        
        this.state.inspections
            .filter(i => i.status === 'completed')
            .forEach(i => {
                todos.push({
                    id: `ins-${i.id}`,
                    type: 'inspection',
                    entityId: i.id,
                    title: `${i.roomNumber} 巡检整改待验收`,
                    description: `问题类型：${i.issueType}`,
                    priority: 'medium',
                    tab: 'inspection'
                });
            });
        
        this.state.registrations
            .filter(r => r.status === 'approved')
            .forEach(r => {
                const deposit = this.getDepositByRegistration(r.id);
                if (deposit && deposit.status !== 'refunded') {
                    const inspections = this.getInspectionsByRegistration(r.id);
                    const allClosed = inspections.every(i => i.status === 'closed');
                    if (allClosed || inspections.length === 0) {
                        todos.push({
                            id: `refund-${r.id}`,
                            type: 'refund',
                            entityId: r.id,
                            title: `${r.roomNumber} 押金可退还`,
                            description: `押金金额：${this.formatCurrency(deposit.amount)}`,
                            priority: 'low',
                            tab: 'refund'
                        });
                    }
                }
            });
        
        this.state.registrations
            .filter(r => r.status === 'approved')
            .forEach(r => {
                const deposit = this.getDepositByRegistration(r.id);
                if (!deposit) {
                    todos.push({
                        id: `deposit-${r.id}`,
                        type: 'deposit',
                        entityId: r.id,
                        title: `${r.roomNumber} 押金待冻结`,
                        description: `业主：${r.ownerName}`,
                        priority: 'medium',
                        tab: 'deposit'
                    });
                }
            });
        
        return todos;
    },

    getStats() {
        return {
            registration: this.state.registrations.length,
            deposit: this.state.deposits.filter(d => d.status === 'frozen').length,
            inspection: this.state.inspections.filter(i => i.status !== 'closed').length,
            refund: this.state.deposits.filter(d => d.status === 'refunded').length
        };
    },

    getDepositStats() {
        const frozenTotal = this.state.deposits
            .filter(d => d.status === 'frozen')
            .reduce((sum, d) => sum + Number(d.amount), 0);
        
        const refundedTotal = this.state.deposits
            .filter(d => d.refundedAmount)
            .reduce((sum, d) => sum + Number(d.refundedAmount), 0);
        
        const pendingRefund = this.state.deposits
            .filter(d => d.status === 'frozen')
            .reduce((sum, d) => sum + Number(d.amount), 0);
        
        return { frozenTotal, refundedTotal, pendingRefund };
    },

    getHistory(typeFilter = 'all', actionFilter = 'all') {
        let history = this.state.history;
        
        if (typeFilter !== 'all') {
            history = history.filter(h => h.type === typeFilter);
        }
        
        if (actionFilter !== 'all') {
            history = history.filter(h => h.action === actionFilter);
        }
        
        return history;
    },

    exportData() {
        return {
            exportedAt: new Date().toISOString(),
            registrations: this.state.registrations,
            deposits: this.state.deposits,
            inspections: this.state.inspections,
            statistics: {
                ...this.getStats(),
                ...this.getDepositStats()
            }
        };
    }
};

const DemoData = {
    createNormalDemo() {
        const registration = DataManager.createRegistration({
            roomNumber: '1栋1单元101室',
            ownerName: '张三',
            ownerPhone: '13800138001',
            decorationType: '全屋装修',
            decorationCompany: '诚信装饰公司',
            startDate: '2026-05-15',
            endDate: '2026-08-15',
            amount: '5000',
            description: '三室两厅，全屋装修，预计工期3个月'
        });

        DataManager.approveRegistration(registration.id);

        DataManager.createDeposit({
            registrationId: registration.id,
            roomNumber: registration.roomNumber,
            ownerName: registration.ownerName,
            amount: '5000',
            paymentMethod: '银行转账',
            remark: '业主已全额缴纳装修押金'
        });

        const inspection1 = DataManager.createInspection({
            registrationId: registration.id,
            roomNumber: registration.roomNumber,
            issueType: '安全隐患',
            severity: 'high',
            description: '施工现场未配备灭火器，存在消防安全隐患',
            inspector: '李巡检',
            location: '客厅'
        });

        const inspection2 = DataManager.createInspection({
            registrationId: registration.id,
            roomNumber: registration.roomNumber,
            issueType: '施工规范',
            severity: 'medium',
            description: '电线乱拉乱接，未穿管保护',
            inspector: '李巡检',
            location: '主卧'
        });

        DataManager.startRectification(inspection1.id, '购买合格灭火器，放置在醒目位置');
        DataManager.startRectification(inspection2.id, '更换电线并穿管保护');

        DataManager.submitRectification(inspection1.id, '已购置2具4kg干粉灭火器，放置在入户门旁', ['photo1.jpg', 'photo2.jpg']);
        DataManager.submitRectification(inspection2.id, '已重新布线并穿PVC管保护', ['photo3.jpg', 'photo4.jpg']);

        DataManager.closeInspection(inspection1.id);
        DataManager.closeInspection(inspection2.id);

        return registration;
    },

    createAbnormalDemo() {
        const registration = DataManager.createRegistration({
            roomNumber: '2栋3单元202室',
            ownerName: '李四',
            ownerPhone: '13800138002',
            decorationType: '局部装修',
            decorationCompany: '快捷装修队',
            startDate: '2026-05-10',
            endDate: '2026-06-10',
            amount: '3000',
            description: '厨房和卫生间改造'
        });

        DataManager.rejectRegistration(registration.id, '装修公司资质不齐全，请补充提交');

        DataManager.updateRegistration(registration.id, {
            decorationCompany: '正规装修工程有限公司',
            description: '厨房和卫生间改造，已补充装修公司资质文件'
        });

        DataManager.approveRegistration(registration.id);

        DataManager.createDeposit({
            registrationId: registration.id,
            roomNumber: registration.roomNumber,
            ownerName: registration.ownerName,
            amount: '3000',
            paymentMethod: '现金',
            remark: '业主现金缴纳押金'
        });

        const inspection = DataManager.createInspection({
            registrationId: registration.id,
            roomNumber: registration.roomNumber,
            issueType: '违规施工',
            severity: 'high',
            description: '擅自拆除承重墙，严重违反装修管理规定',
            inspector: '王巡检',
            location: '厨房'
        });

        DataManager.startRectification(inspection.id, '立即停止施工，请专业机构进行结构安全鉴定');
        DataManager.submitRectification(inspection.id, '已联系鉴定机构，正在等待检测报告', ['report_preview.jpg']);

        DataManager.reopenInspection(inspection.id, '整改不彻底，需提供正式检测报告并由物业复核');

        return registration;
    },

    createMixedDemo() {
        this.createNormalDemo();
        
        const reg2 = DataManager.createRegistration({
            roomNumber: '3栋2单元501室',
            ownerName: '王五',
            ownerPhone: '13800138003',
            decorationType: '精装修',
            decorationCompany: '豪华装饰集团',
            startDate: '2026-04-01',
            endDate: '2026-07-01',
            amount: '8000',
            description: '四室两厅精装修，包含定制家具'
        });

        DataManager.approveRegistration(reg2.id);

        DataManager.createDeposit({
            registrationId: reg2.id,
            roomNumber: reg2.roomNumber,
            ownerName: reg2.ownerName,
            amount: '8000',
            paymentMethod: '微信支付',
            remark: '押金已到账'
        });

        const ins = DataManager.createInspection({
            registrationId: reg2.id,
            roomNumber: reg2.roomNumber,
            issueType: '噪音投诉',
            severity: 'medium',
            description: '周末超时施工，遭到邻居投诉',
            inspector: '张巡检',
            location: '全房'
        });

        DataManager.startRectification(ins.id, '调整施工时间，严格遵守小区装修时间规定');
        DataManager.submitRectification(ins.id, '已严格按照规定时间施工，并向邻居致歉', ['schedule.jpg']);
        DataManager.closeInspection(ins.id);

        const deposit = DataManager.getDepositByRegistration(reg2.id);
        DataManager.refundDeposit(deposit.id, deposit.amount, '装修验收合格，押金全额退还');
    }
};
