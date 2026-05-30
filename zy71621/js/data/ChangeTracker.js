export class ChangeTracker {
    constructor() {
        this.changeRecords = [];
        this.currentBatchId = null;
        this.batchNotes = '';
        this.author = 'anonymous';
        this.listeners = {};
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    startBatch(notes = '') {
        this.currentBatchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.batchNotes = notes;
        return this.currentBatchId;
    }

    endBatch() {
        const batchChanges = this.changeRecords.filter(
            c => c.batchId === this.currentBatchId
        );
        
        const batchRecord = {
            batchId: this.currentBatchId,
            timestamp: Date.now(),
            author: this.author,
            notes: this.batchNotes,
            changeCount: batchChanges.length,
            changes: batchChanges
        };
        
        this.currentBatchId = null;
        this.batchNotes = '';
        
        this.emit('batchCompleted', batchRecord);
        return batchRecord;
    }

    cancelBatch() {
        this.changeRecords = this.changeRecords.filter(
            c => c.batchId !== this.currentBatchId
        );
        this.currentBatchId = null;
        this.batchNotes = '';
        this.emit('batchCancelled');
    }

    recordChange(entityType, entityId, action, before, after, notes = '') {
        const change = {
            id: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            batchId: this.currentBatchId || 'manual',
            timestamp: Date.now(),
            author: this.author,
            entityType: entityType,
            entityId: entityId,
            action: action,
            before: before,
            after: after,
            notes: notes,
            applied: true
        };

        this.changeRecords.push(change);
        this.emit('changeRecorded', change);
        return change;
    }

    recordCreate(entityType, entity, notes = '') {
        return this.recordChange(
            entityType,
            entity.id,
            'create',
            null,
            typeof entity.toJSON === 'function' ? entity.toJSON() : entity,
            notes
        );
    }

    recordUpdate(entityType, oldEntity, newEntity, notes = '') {
        const before = typeof oldEntity.toJSON === 'function' ? oldEntity.toJSON() : oldEntity;
        const after = typeof newEntity.toJSON === 'function' ? newEntity.toJSON() : newEntity;
        
        return this.recordChange(
            entityType,
            newEntity.id || oldEntity.id,
            'update',
            before,
            after,
            notes
        );
    }

    recordDelete(entityType, entity, notes = '') {
        return this.recordChange(
            entityType,
            entity.id,
            'delete',
            typeof entity.toJSON === 'function' ? entity.toJSON() : entity,
            null,
            notes
        );
    }

    getChangesByBatch(batchId) {
        return this.changeRecords.filter(c => c.batchId === batchId);
    }

    getChangesByEntity(entityId) {
        return this.changeRecords.filter(c => c.entityId === entityId);
    }

    getChangesByEntityType(entityType) {
        return this.changeRecords.filter(c => c.entityType === entityType);
    }

    getChangesByAction(action) {
        return this.changeRecords.filter(c => c.action === action);
    }

    getChangesByDateRange(startDate, endDate) {
        return this.changeRecords.filter(c => 
            c.timestamp >= startDate && c.timestamp <= endDate
        );
    }

    getRecentChanges(limit = 10) {
        return [...this.changeRecords]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    getBatches() {
        const batchMap = new Map();
        this.changeRecords.forEach(change => {
            if (!batchMap.has(change.batchId)) {
                batchMap.set(change.batchId, {
                    batchId: change.batchId,
                    timestamp: change.timestamp,
                    author: change.author,
                    changes: []
                });
            }
            batchMap.get(change.batchId).changes.push(change);
        });
        return Array.from(batchMap.values())
            .sort((a, b) => b.timestamp - a.timestamp);
    }

    getChangeSummary() {
        const summary = {
            totalChanges: this.changeRecords.length,
            byEntityType: {},
            byAction: {
                create: 0,
                update: 0,
                delete: 0
            },
            batches: this.getBatches().length,
            lastChange: this.changeRecords.length > 0 
                ? this.changeRecords[this.changeRecords.length - 1] 
                : null
        };

        for (const change of this.changeRecords) {
            summary.byEntityType[change.entityType] = 
                (summary.byEntityType[change.entityType] || 0) + 1;
            summary.byAction[change.action]++;
        }

        return summary;
    }

    formatChangeForDisplay(change) {
        const actionLabels = {
            create: '新增',
            update: '更新',
            delete: '删除'
        };

        const entityLabels = {
            wall: '墙体',
            character: '角色',
            soundSource: '声源',
            maze: '迷宫',
            gameState: '游戏状态'
        };

        return {
            id: change.id,
            action: actionLabels[change.action] || change.action,
            entityType: entityLabels[change.entityType] || change.entityType,
            entityId: change.entityId,
            timestamp: new Date(change.timestamp).toLocaleString('zh-CN'),
            author: change.author,
            batchId: change.batchId,
            notes: change.notes,
            summary: this.generateChangeSummary(change)
        };
    }

    generateChangeSummary(change) {
        const entityLabels = {
            wall: '墙体',
            character: '角色',
            soundSource: '声源'
        };
        const entity = entityLabels[change.entityType] || change.entityType;

        switch (change.action) {
            case 'create':
                return `新增${entity}: ${change.entityId}`;
            case 'update':
                const diff = this.getDifference(change.before, change.after);
                if (diff.length > 0) {
                    return `更新${entity}: ${diff.join(', ')}`;
                }
                return `更新${entity}: ${change.entityId}`;
            case 'delete':
                return `删除${entity}: ${change.entityId}`;
            default:
                return `${change.action}: ${change.entityId}`;
        }
    }

    getDifference(before, after) {
        if (!before || !after) return [];
        
        const differences = [];
        const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
        
        const ignoredKeys = ['updatedAt', 'createdAt', 'id'];
        
        for (const key of allKeys) {
            if (ignoredKeys.includes(key)) continue;
            
            const beforeVal = before[key];
            const afterVal = after[key];
            
            if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
                differences.push(`${key}: ${JSON.stringify(beforeVal)} → ${JSON.stringify(afterVal)}`);
            }
        }
        
        return differences;
    }

    undoChange(changeId) {
        const change = this.changeRecords.find(c => c.id === changeId);
        if (!change) return null;
        
        change.applied = false;
        this.emit('changeUndone', change);
        return change;
    }

    redoChange(changeId) {
        const change = this.changeRecords.find(c => c.id === changeId);
        if (!change) return null;
        
        change.applied = true;
        this.emit('changeRedone', change);
        return change;
    }

    exportChanges(format = 'json') {
        const data = {
            exportedAt: Date.now(),
            author: this.author,
            changeRecords: [...this.changeRecords],
            summary: this.getChangeSummary()
        };

        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        }
        return data;
    }

    importChanges(data) {
        if (typeof data === 'string') {
            data = JSON.parse(data);
        }

        if (data.changeRecords && Array.isArray(data.changeRecords)) {
            this.changeRecords.push(...data.changeRecords);
            this.emit('changesImported', data.changeRecords);
            return data.changeRecords.length;
        }
        return 0;
    }

    clearAll() {
        this.changeRecords = [];
        this.currentBatchId = null;
        this.batchNotes = '';
        this.emit('changesCleared');
    }

    setAuthor(author) {
        this.author = author;
    }

    toJSON() {
        return {
            changeRecords: [...this.changeRecords],
            currentBatchId: this.currentBatchId,
            batchNotes: this.batchNotes,
            author: this.author
        };
    }

    loadJSON(data) {
        if (data.changeRecords) {
            this.changeRecords = [...data.changeRecords];
        }
        if (data.author) {
            this.author = data.author;
        }
    }
}
