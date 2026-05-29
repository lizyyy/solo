const Storage = {
    KEYS: {
        MATERIALS: 'buoyancy_materials',
        RECORDS: 'buoyancy_records',
        HISTORY: 'buoyancy_history',
        UNDO_STACK: 'buoyancy_undo_stack',
        CURRENT_SESSION: 'buoyancy_current_session'
    },

    get(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error('Storage get error:', e);
            return defaultValue;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    },

    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Storage remove error:', e);
            return false;
        }
    },

    getDefaultMaterials() {
        return [
            { id: 'mat_1', name: '铁块', icon: '🪨', volume: 10, mass: 78, density: 7.8, color: '#8B4513' },
            { id: 'mat_2', name: '铝块', icon: '🔩', volume: 10, mass: 27, density: 2.7, color: '#A0A0A0' },
            { id: 'mat_3', name: '木块', icon: '🪵', volume: 10, mass: 6, density: 0.6, color: '#DEB887' },
            { id: 'mat_4', name: '冰块', icon: '🧊', volume: 10, mass: 9, density: 0.9, color: '#E0FFFF' },
            { id: 'mat_5', name: '塑料块', icon: '🔵', volume: 10, mass: 9.5, density: 0.95, color: '#4169E1' },
            { id: 'mat_6', name: '蜡块', icon: '🕯️', volume: 10, mass: 9, density: 0.9, color: '#FFFACD' },
            { id: 'mat_7', name: '铜块', icon: '🟤', volume: 10, mass: 89, density: 8.9, color: '#B87333' },
            { id: 'mat_8', name: '软木塞', icon: '🟨', volume: 10, mass: 2.5, density: 0.25, color: '#F5DEB3' }
        ];
    },

    getMaterials() {
        const materials = this.get(this.KEYS.MATERIALS);
        if (!materials || materials.length === 0) {
            const defaults = this.getDefaultMaterials();
            this.set(this.KEYS.MATERIALS, defaults);
            return defaults;
        }
        return materials;
    },

    addMaterial(material) {
        const materials = this.getMaterials();
        const newMaterial = {
            id: `mat_${Date.now()}`,
            ...material,
            density: Number((material.mass / material.volume).toFixed(4))
        };
        materials.push(newMaterial);
        this.set(this.KEYS.MATERIALS, materials);
        return newMaterial;
    },

    deleteMaterial(materialId) {
        const materials = this.getMaterials();
        const filtered = materials.filter(m => m.id !== materialId);
        this.set(this.KEYS.MATERIALS, filtered);
        return filtered;
    },

    getRecords() {
        return this.get(this.KEYS.RECORDS, []);
    },

    addRecord(record, validationResult, analysis) {
        const records = this.getRecords();
        
        const isDuplicate = this.checkDuplicate(record, records);
        if (isDuplicate) {
            return { success: false, duplicate: true, existing: isDuplicate };
        }

        const newRecord = {
            id: `rec_${Date.now()}`,
            ...record,
            volume: Number(record.volume),
            mass: Number(record.mass),
            liquidDensity: Number(record.liquidDensity),
            displacement: record.displacement !== '' ? Number(record.displacement) : null,
            validation: validationResult,
            analysis: analysis,
            timestamp: Date.now(),
            status: validationResult.isValid ? 'normal' : 'anomaly',
            sessionId: this.getCurrentSessionId()
        };

        records.unshift(newRecord);
        this.set(this.KEYS.RECORDS, records);
        
        this.pushUndo({ type: 'add_record', recordId: newRecord.id });
        
        return { success: true, record: newRecord };
    },

    checkDuplicate(record, records) {
        const now = Date.now();
        const ONE_MINUTE = 60 * 1000;
        
        for (const existing of records) {
            if (now - existing.timestamp < ONE_MINUTE) {
                const sameData = 
                    existing.name === record.name &&
                    Math.abs(Number(existing.volume) - Number(record.volume)) < 0.001 &&
                    Math.abs(Number(existing.mass) - Number(record.mass)) < 0.001 &&
                    Math.abs(Number(existing.liquidDensity) - Number(record.liquidDensity)) < 0.001;
                
                if (sameData) {
                    return existing;
                }
            }
        }
        return null;
    },

    deleteRecord(recordId) {
        const records = this.getRecords();
        const index = records.findIndex(r => r.id === recordId);
        if (index !== -1) {
            const deleted = records.splice(index, 1)[0];
            this.set(this.KEYS.RECORDS, records);
            return deleted;
        }
        return null;
    },

    getUndoStack() {
        return this.get(this.KEYS.UNDO_STACK, []);
    },

    pushUndo(action) {
        const stack = this.getUndoStack();
        stack.push({
            ...action,
            timestamp: Date.now()
        });
        if (stack.length > 50) {
            stack.shift();
        }
        this.set(this.KEYS.UNDO_STACK, stack);
        return stack;
    },

    popUndo() {
        const stack = this.getUndoStack();
        if (stack.length === 0) return null;
        
        const action = stack.pop();
        this.set(this.KEYS.UNDO_STACK, stack);
        
        if (action.type === 'add_record') {
            const deleted = this.deleteRecord(action.recordId);
            return { type: 'add_record', record: deleted };
        }
        
        return action;
    },

    getCurrentSessionId() {
        let sessionId = this.get(this.KEYS.CURRENT_SESSION);
        if (!sessionId) {
            sessionId = `sess_${Date.now()}`;
            this.set(this.KEYS.CURRENT_SESSION, sessionId);
        }
        return sessionId;
    },

    startNewSession() {
        const sessionId = `sess_${Date.now()}`;
        this.set(this.KEYS.CURRENT_SESSION, sessionId);
        return sessionId;
    },

    getHistory() {
        const records = this.getRecords();
        const sessions = {};
        
        for (const record of records) {
            const sessionId = record.sessionId || 'unknown';
            if (!sessions[sessionId]) {
                sessions[sessionId] = {
                    sessionId,
                    startTime: record.timestamp,
                    endTime: record.timestamp,
                    records: [],
                    normalCount: 0,
                    anomalyCount: 0
                };
            }
            sessions[sessionId].records.push(record);
            sessions[sessionId].endTime = record.timestamp;
            if (record.status === 'normal') {
                sessions[sessionId].normalCount++;
            } else {
                sessions[sessionId].anomalyCount++;
            }
        }
        
        return Object.values(sessions).sort((a, b) => b.startTime - a.startTime);
    },

    getSessionRecords(sessionId) {
        const records = this.getRecords();
        return records.filter(r => r.sessionId === sessionId);
    },

    getRecordStats() {
        const records = this.getRecords();
        return {
            total: records.length,
            normal: records.filter(r => r.status === 'normal').length,
            anomaly: records.filter(r => r.status === 'anomaly').length
        };
    },

    clearAllData() {
        this.remove(this.KEYS.RECORDS);
        this.remove(this.KEYS.UNDO_STACK);
        this.remove(this.KEYS.CURRENT_SESSION);
        this.set(this.KEYS.MATERIALS, this.getDefaultMaterials());
    },

    exportData() {
        return {
            materials: this.getMaterials(),
            records: this.getRecords(),
            history: this.getHistory(),
            exportedAt: Date.now(),
            version: '1.0'
        };
    },

    importData(data) {
        if (data.materials) {
            this.set(this.KEYS.MATERIALS, data.materials);
        }
        if (data.records) {
            this.set(this.KEYS.RECORDS, data.records);
        }
        return true;
    },

    exportSessionAsJSON(sessionId) {
        const records = this.getSessionRecords(sessionId);
        const session = this.getHistory().find(s => s.sessionId === sessionId);
        
        return {
            sessionInfo: session,
            records: records,
            exportedAt: Date.now()
        };
    }
};
