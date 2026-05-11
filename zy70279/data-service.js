const DataService = {
    state: {
        classrooms: [],
        inputHash: null,
        intensityProcessed: false,
        cleaningPlans: [],
        damageRecords: [],
        statistics: null,
        history: [],
        lastExportData: null,
        lastExportHash: null
    },

    listeners: [],

    subscribe(listener) {
        this.listeners.push(listener);
    },

    notify() {
        this.listeners.forEach(listener => listener(this.state));
    },

    setState(updates) {
        this.state = { ...this.state, ...updates };
        this.notify();
    },

    loadClassrooms(classrooms) {
        Utils.validateClassroomData(classrooms);
        
        const inputHash = Utils.calculateHash(classrooms);
        
        const newHistoryEntry = {
            id: Utils.generateId(),
            timestamp: new Date(),
            action: '加载教室档案',
            details: `加载了 ${classrooms.length} 个教室数据`,
            changes: { classrooms: Utils.deepClone(classrooms) }
        };

        const newHistory = [...this.state.history, newHistoryEntry];

        this.setState({
            classrooms: Utils.deepClone(classrooms),
            inputHash: inputHash,
            intensityProcessed: false,
            cleaningPlans: [],
            damageRecords: [],
            statistics: null,
            history: newHistory,
            lastExportData: null,
            lastExportHash: null
        });

        return {
            classroomCount: classrooms.length,
            isReRun: inputHash === this.state.inputHash
        };
    },

    setIntensityProcessed(processedClassrooms) {
        const newHistoryEntry = {
            id: Utils.generateId(),
            timestamp: new Date(),
            action: '处理课程强度',
            details: `为 ${processedClassrooms.length} 个教室计算了使用强度`,
            changes: { intensityData: Utils.deepClone(processedClassrooms) }
        };

        const newHistory = [...this.state.history, newHistoryEntry];

        this.setState({
            classrooms: Utils.deepClone(processedClassrooms),
            intensityProcessed: true,
            history: newHistory
        });

        return processedClassrooms;
    },

    setCleaningPlans(plans) {
        const newHistoryEntry = {
            id: Utils.generateId(),
            timestamp: new Date(),
            action: '生成清洁计划',
            details: `为 ${plans.length} 个教室生成了清洁计划`,
            changes: { cleaningPlans: Utils.deepClone(plans) }
        };

        const newHistory = [...this.state.history, newHistoryEntry];

        this.setState({
            cleaningPlans: Utils.deepClone(plans),
            history: newHistory
        });

        return plans;
    },

    setDamageRecords(records) {
        const newHistoryEntry = {
            id: Utils.generateId(),
            timestamp: new Date(),
            action: '追踪损伤区域',
            details: `记录了 ${records.length} 个损伤区域`,
            changes: { damageRecords: Utils.deepClone(records) }
        };

        const newHistory = [...this.state.history, newHistoryEntry];

        this.setState({
            damageRecords: Utils.deepClone(records),
            history: newHistory
        });

        return records;
    },

    setStatistics(stats) {
        const newHistoryEntry = {
            id: Utils.generateId(),
            timestamp: new Date(),
            action: '计算统计数据',
            details: '完成统计数据计算',
            changes: { statistics: Utils.deepClone(stats) }
        };

        const newHistory = [...this.state.history, newHistoryEntry];

        this.setState({
            statistics: Utils.deepClone(stats),
            history: newHistory
        });

        return stats;
    },

    resetState() {
        const newHistoryEntry = {
            id: Utils.generateId(),
            timestamp: new Date(),
            action: '重置状态',
            details: '清除所有处理结果，保留输入数据',
            changes: { reset: true }
        };

        const newHistory = [...this.state.history, newHistoryEntry];

        this.setState({
            intensityProcessed: false,
            cleaningPlans: [],
            damageRecords: [],
            statistics: null,
            history: newHistory,
            lastExportData: null,
            lastExportHash: null
        });

        return true;
    },

    fullReset() {
        this.state = {
            classrooms: [],
            inputHash: null,
            intensityProcessed: false,
            cleaningPlans: [],
            damageRecords: [],
            statistics: null,
            history: [],
            lastExportData: null,
            lastExportHash: null
        };
        this.notify();
    },

    canExport() {
        return this.state.statistics !== null && 
               this.state.cleaningPlans.length > 0;
    },

    getExportData() {
        if (!this.canExport()) {
            return null;
        }

        const exportData = {
            exportTime: new Date().toISOString(),
            version: '1.0.0',
            inputHash: this.state.inputHash,
            classrooms: this.state.classrooms.map(c => ({
                id: c.id,
                name: c.name,
                area: c.area,
                intensity: c.intensity,
                lastCleaningDate: c.lastCleaningDate
            })),
            cleaningPlans: this.state.cleaningPlans,
            damageRecords: this.state.damageRecords,
            statistics: this.state.statistics
        };

        const exportHash = Utils.calculateHash(exportData);

        if (exportHash === this.state.lastExportHash) {
            return {
                data: exportData,
                hash: exportHash,
                isDuplicate: true
            };
        }

        this.state.lastExportData = exportData;
        this.state.lastExportHash = exportHash;

        return {
            data: exportData,
            hash: exportHash,
            isDuplicate: false
        };
    },

    getState() {
        return Utils.deepClone(this.state);
    }
};
