const Storage = {
    STORAGE_KEY: 'renovation_material_draft',
    STORAGE_HISTORY_KEY: 'renovation_material_history',
    
    saveDraft: function(data) {
        try {
            const toSave = {
                rooms: data.rooms,
                materials: data.materials,
                purchases: data.purchases,
                changes: data.changes,
                savedAt: new Date().toISOString()
            };
            
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(toSave));
            this.addToHistory(toSave);
            
            return true;
        } catch (e) {
            console.error('保存草稿失败:', e);
            return false;
        }
    },
    
    loadDraft: function() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (!saved) return null;
            
            return JSON.parse(saved);
        } catch (e) {
            console.error('加载草稿失败:', e);
            return null;
        }
    },
    
    hasDraft: function() {
        return localStorage.getItem(this.STORAGE_KEY) !== null;
    },
    
    clearDraft: function() {
        localStorage.removeItem(this.STORAGE_KEY);
    },
    
    addToHistory: function(data) {
        try {
            const history = this.getHistory();
            history.unshift({
                ...data,
                savedAt: new Date().toISOString()
            });
            
            if (history.length > 10) {
                history.splice(10);
            }
            
            localStorage.setItem(this.STORAGE_HISTORY_KEY, JSON.stringify(history));
        } catch (e) {
            console.error('保存历史失败:', e);
        }
    },
    
    getHistory: function() {
        try {
            const saved = localStorage.getItem(this.STORAGE_HISTORY_KEY);
            if (!saved) return [];
            return JSON.parse(saved);
        } catch (e) {
            console.error('加载历史失败:', e);
            return [];
        }
    },
    
    clearHistory: function() {
        localStorage.removeItem(this.STORAGE_HISTORY_KEY);
    },
    
    exportToJSON: function(data) {
        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            data: {
                rooms: data.rooms,
                materials: data.materials,
                purchases: data.purchases,
                changes: data.changes
            }
        };
        
        return JSON.stringify(exportData, null, 2);
    },
    
    importFromJSON: function(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            
            if (parsed.data) {
                return {
                    rooms: parsed.data.rooms || [],
                    materials: parsed.data.materials || [],
                    purchases: parsed.data.purchases || [],
                    changes: parsed.data.changes || []
                };
            }
            
            return {
                rooms: parsed.rooms || [],
                materials: parsed.materials || [],
                purchases: parsed.purchases || [],
                changes: parsed.changes || []
            };
        } catch (e) {
            throw new Error('JSON 解析失败: ' + e.message);
        }
    },
    
    getStorageSize: function() {
        let totalSize = 0;
        
        Object.keys(localStorage).forEach(key => {
            if (key.includes('renovation_material')) {
                const value = localStorage.getItem(key);
                totalSize += value ? value.length * 2 : 0;
            }
        });
        
        return this.formatBytes(totalSize);
    },
    
    formatBytes: function(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
};

window.Storage = Storage;
