const Storage = {
    STORAGE_KEY: APP_CONFIG.STORAGE_KEY,
    
    getAllRehearsals() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('读取预演数据失败:', e);
            return {};
        }
    },
    
    getRehearsal(id) {
        const rehearsals = this.getAllRehearsals();
        return rehearsals[id] ? Utils.deepClone(rehearsals[id]) : null;
    },
    
    saveRehearsal(id, data) {
        const rehearsals = this.getAllRehearsals();
        const now = new Date().toISOString();
        
        const existingData = rehearsals[id] || {};
        rehearsals[id] = {
            ...Utils.deepClone(data),
            id,
            createdAt: existingData.createdAt || now,
            updatedAt: now,
        };
        
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(rehearsals));
            return true;
        } catch (e) {
            console.error('保存预演数据失败:', e);
            return false;
        }
    },
    
    deleteRehearsal(id) {
        const rehearsals = this.getAllRehearsals();
        if (rehearsals[id]) {
            delete rehearsals[id];
            try {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(rehearsals));
                return true;
            } catch (e) {
                console.error('删除预演数据失败:', e);
                return false;
            }
        }
        return false;
    },
    
    getRehearsalList() {
        const rehearsals = this.getAllRehearsals();
        return Object.entries(rehearsals)
            .map(([id, data]) => ({
                id,
                name: data.rehearsalName || '未命名预演',
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
            }))
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    },
    
    createNewRehearsal(name = '新预演') {
        const id = Utils.generateId('rehearsal');
        const data = {
            ...Utils.deepClone(DEFAULT_DATA),
            rehearsalName: name,
        };
        this.saveRehearsal(id, data);
        return { id, data };
    },
    
    duplicateRehearsal(sourceId, newName) {
        const sourceData = this.getRehearsal(sourceId);
        if (!sourceData) return null;
        
        const id = Utils.generateId('rehearsal');
        const data = {
            ...Utils.deepClone(sourceData),
            rehearsalName: newName || `${sourceData.rehearsalName} (副本)`,
        };
        this.saveRehearsal(id, data);
        return { id, data };
    },
    
    getLastUsedRehearsal() {
        try {
            const lastId = localStorage.getItem(`${this.STORAGE_KEY}_last`);
            if (lastId) {
                const data = this.getRehearsal(lastId);
                if (data) {
                    return { id: lastId, data };
                }
            }
        } catch (e) {
            console.error('获取最后使用的预演失败:', e);
        }
        return null;
    },
    
    setLastUsedRehearsal(id) {
        try {
            localStorage.setItem(`${this.STORAGE_KEY}_last`, id);
        } catch (e) {
            console.error('保存最后使用的预演失败:', e);
        }
    },
    
    exportRehearsal(id) {
        const data = this.getRehearsal(id);
        if (!data) return null;
        
        return {
            version: APP_CONFIG.VERSION,
            exportedAt: new Date().toISOString(),
            rehearsal: data,
        };
    },
    
    importRehearsal(exportedData) {
        if (!exportedData || !exportedData.rehearsal) {
            return { success: false, error: '无效的导入数据格式' };
        }
        
        const id = Utils.generateId('rehearsal');
        const data = {
            ...Utils.deepClone(exportedData.rehearsal),
            id,
            importedFrom: exportedData.rehearsal.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        
        this.saveRehearsal(id, data);
        return { success: true, id, data };
    },
    
    clearAll() {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
            localStorage.removeItem(`${this.STORAGE_KEY}_last`);
            return true;
        } catch (e) {
            console.error('清除所有数据失败:', e);
            return false;
        }
    },
    
    estimateStorageSize() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? new Blob([data]).size : 0;
        } catch (e) {
            return 0;
        }
    },
};
