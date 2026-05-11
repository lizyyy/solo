const Logger = {
    log(type, status, input, output = '', failureReason = '') {
        const logEntry = {
            type,
            status,
            input: typeof input === 'string' ? input : JSON.stringify(input, null, 2),
            output: typeof output === 'string' ? output : JSON.stringify(output, null, 2),
            failureReason
        };
        return DataStore.addLog(logEntry);
    },

    success(type, input, output) {
        return this.log(type, 'success', input, output, '');
    },

    failed(type, input, failureReason) {
        return this.log(type, 'failed', input, '', failureReason);
    },

    searchLogs(store, filters = {}) {
        let logs = DataStore.getLogsByStore(store);
        
        if (filters.type && filters.type !== 'all') {
            logs = logs.filter(l => l.status === filters.type);
        }
        
        if (filters.search) {
            const search = filters.search.toLowerCase();
            logs = logs.filter(l => 
                l.input.toLowerCase().includes(search) ||
                l.output.toLowerCase().includes(search) ||
                l.failureReason.toLowerCase().includes(search)
            );
        }
        
        return logs;
    },

    formatLogEntry(log) {
        const typeNames = {
            add_batch: '新增批次',
            update_batch: '更新批次',
            confirm_batch: '确认批次',
            reject_batch: '拒绝批次',
            add_opening: '新增开封',
            update_opening: '更新开封',
            confirm_opening: '确认开封',
            reject_opening: '拒绝开封',
            add_consumption: '新增消耗',
            update_consumption: '更新消耗',
            calculate_rotation: '计算轮换',
            export_data: '导出数据',
            load_samples: '加载示例数据'
        };
        
        return {
            ...log,
            typeName: typeNames[log.type] || log.type,
            timestampFormatted: new Date(log.timestamp).toLocaleString()
        };
    }
};
