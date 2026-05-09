const Storage = {
    STORAGE_KEY: 'choir_allocator_data',
    VERSION: 1,
    
    getData: function() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                if (data.version !== this.VERSION) {
                    return this.migrateData(data);
                }
                return data;
            }
            return null;
        } catch (e) {
            console.error('读取存储数据失败:', e);
            return null;
        }
    },
    
    saveData: function(data) {
        try {
            const saveData = {
                ...data,
                version: this.VERSION,
                savedAt: Date.now()
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(saveData));
            return true;
        } catch (e) {
            console.error('保存数据失败:', e);
            return false;
        }
    },
    
    clearData: function() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            return true;
        } catch (e) {
            console.error('清除数据失败:', e);
            return false;
        }
    },
    
    migrateData: function(oldData) {
        if (oldData.version < 1) {
            return {
                members: oldData.members || [],
                sections: oldData.sections || [],
                attendance: oldData.attendance || {},
                lastAllocation: oldData.lastAllocation || null,
                rehearsalDate: oldData.rehearsalDate || new Date().toISOString().split('T')[0]
            };
        }
        return oldData;
    },
    
    exportData: function() {
        const data = this.getData();
        if (!data) return null;
        return JSON.stringify(data, null, 2);
    },
    
    importData: function(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (!data.members || !data.sections) {
                return { success: false, error: '数据格式不正确' };
            }
            this.saveData(data);
            return { success: true, data: data };
        } catch (e) {
            return { success: false, error: 'JSON解析失败: ' + e.message };
        }
    }
};
