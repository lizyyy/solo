import { Wall } from '../models/Wall.js';
import { Character } from '../models/Character.js';
import { SoundSource } from '../models/SoundSource.js';

export class ImportManager {
    constructor(maze, changeTracker, errorDetector) {
        this.maze = maze;
        this.changeTracker = changeTracker;
        this.errorDetector = errorDetector;
        this.importHistory = [];
        this.currentImportResult = null;
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

    importJSON(jsonData, batchNotes = '') {
        let data;
        try {
            data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
        } catch (e) {
            return {
                success: false,
                error: 'JSON解析失败: ' + e.message
            };
        }

        const result = {
            success: true,
            timestamp: Date.now(),
            source: data.source || 'import',
            items: [],
            summary: {
                total: 0,
                new: 0,
                duplicate: 0,
                update: 0,
                conflict: 0,
                error: 0
            },
            batchId: null
        };

        this.changeTracker.startBatch(batchNotes);
        result.batchId = this.changeTracker.currentBatchId;

        if (data.walls && Array.isArray(data.walls)) {
            const wallResults = this.importWalls(data.walls, result.batchId);
            result.items.push(...wallResults);
            this.updateSummary(result.summary, wallResults);
        }

        if (data.characters && Array.isArray(data.characters)) {
            const charResults = this.importCharacters(data.characters, result.batchId);
            result.items.push(...charResults);
            this.updateSummary(result.summary, charResults);
        }

        if (data.soundSources && Array.isArray(data.soundSources)) {
            const sourceResults = this.importSoundSources(data.soundSources, result.batchId);
            result.items.push(...sourceResults);
            this.updateSummary(result.summary, sourceResults);
        }

        if (data.maze && typeof data.maze === 'object') {
            const mazeResult = this.importMazeSettings(data.maze);
            result.items.push(mazeResult);
            this.updateSummary(result.summary, [mazeResult]);
        }

        this.changeTracker.endBatch();

        const importRecord = {
            id: `import_${Date.now()}`,
            timestamp: result.timestamp,
            source: result.source,
            batchId: result.batchId,
            summary: result.summary,
            items: result.items
        };
        this.importHistory.push(importRecord);

        this.currentImportResult = result;
        this.emit('importCompleted', result);

        return result;
    }

    importWalls(wallsData, batchId) {
        const results = [];
        const existingWalls = this.maze.walls;

        for (const wallData of wallsData) {
            const wall = new Wall({ ...wallData, addedInBatch: batchId });
            
            const validationErrors = this.errorDetector.validateWallData(wallData, existingWalls);
            if (validationErrors.length > 0) {
                results.push({
                    type: 'wall',
                    id: wall.id,
                    status: 'error',
                    data: wallData,
                    errors: validationErrors,
                    message: '数据验证失败'
                });
                continue;
            }

            const status = this.determineImportStatus(
                wall,
                existingWalls,
                ['x1', 'y1', 'x2', 'y2', 'material']
            );

            results.push(this.processImportItem(
                'wall',
                wall,
                status,
                existingWalls,
                batchId
            ));
        }

        return results;
    }

    importCharacters(charactersData, batchId) {
        const results = [];
        const existingChars = this.maze.characters;

        for (const charData of charactersData) {
            const char = new Character({ ...charData, addedInBatch: batchId });
            
            const validationErrors = this.errorDetector.validateCharacterData(
                charData, this.maze.width, this.maze.height
            );
            if (validationErrors.length > 0) {
                results.push({
                    type: 'character',
                    id: char.id,
                    status: 'error',
                    data: charData,
                    errors: validationErrors,
                    message: '数据验证失败'
                });
                continue;
            }

            const status = this.determineImportStatus(
                char,
                existingChars,
                ['x', 'y', 'type', 'status']
            );

            results.push(this.processImportItem(
                'character',
                char,
                status,
                existingChars,
                batchId
            ));
        }

        return results;
    }

    importSoundSources(sourcesData, batchId) {
        const results = [];
        const existingSources = this.maze.soundSources;

        for (const sourceData of sourcesData) {
            const source = new SoundSource({ ...sourceData, addedInBatch: batchId });
            
            const validationErrors = [];
            if (sourceData.x === undefined || sourceData.y === undefined) {
                validationErrors.push({
                    type: 'invalid_source',
                    severity: 'critical',
                    description: '声源数据缺少坐标字段'
                });
            }
            if (validationErrors.length > 0) {
                results.push({
                    type: 'soundSource',
                    id: source.id,
                    status: 'error',
                    data: sourceData,
                    errors: validationErrors,
                    message: '数据验证失败'
                });
                continue;
            }

            const status = this.determineImportStatus(
                source,
                existingSources,
                ['x', 'y', 'direction', 'frequency']
            );

            results.push(this.processImportItem(
                'soundSource',
                source,
                status,
                existingSources,
                batchId
            ));
        }

        return results;
    }

    importMazeSettings(mazeData) {
        let status = 'new';
        let existing = null;
        let conflictFields = [];

        if (this.maze.width && this.maze.height) {
            if (mazeData.width !== undefined && mazeData.height !== undefined) {
                if (Math.abs(mazeData.width - this.maze.width) < 0.001 &&
                    Math.abs(mazeData.height - this.maze.height) < 0.001 &&
                    (mazeData.gridSize === undefined || 
                     Math.abs(mazeData.gridSize - this.maze.gridSize) < 0.001)) {
                    status = 'duplicate';
                } else {
                    status = 'conflict';
                    conflictFields = [];
                    if (mazeData.width !== undefined && 
                        Math.abs(mazeData.width - this.maze.width) > 0.001) {
                        conflictFields.push(`width: ${this.maze.width} → ${mazeData.width}`);
                    }
                    if (mazeData.height !== undefined && 
                        Math.abs(mazeData.height - this.maze.height) > 0.001) {
                        conflictFields.push(`height: ${this.maze.height} → ${mazeData.height}`);
                    }
                }
            }
        }

        const result = {
            type: 'maze',
            id: this.maze.id,
            status: status,
            data: mazeData,
            existing: existing ? existing.toJSON() : null,
            conflictFields: conflictFields,
            applied: status === 'new' || status === 'update',
            message: this.getStatusMessage(status, '迷宫设置', conflictFields)
        };

        if (status === 'new' || status === 'update') {
            if (mazeData.width !== undefined) this.maze.width = mazeData.width;
            if (mazeData.height !== undefined) this.maze.height = mazeData.height;
            if (mazeData.gridSize !== undefined) this.maze.gridSize = mazeData.gridSize;
            this.maze.updatedAt = Date.now();
        }

        return result;
    }

    determineImportStatus(newItem, existingItems, compareFields) {
        for (const existing of existingItems) {
            if (newItem.id && existing.id === newItem.id) {
                const isIdentical = compareFields.every(field => {
                    const newVal = newItem[field];
                    const oldVal = existing[field];
                    if (typeof newVal === 'number' && typeof oldVal === 'number') {
                        return Math.abs(newVal - oldVal) < 0.001;
                    }
                    return JSON.stringify(newVal) === JSON.stringify(oldVal);
                });

                if (isIdentical) {
                    return { type: 'duplicate', existing };
                } else {
                    const changedFields = compareFields.filter(field => {
                        const newVal = newItem[field];
                        const oldVal = existing[field];
                        if (typeof newVal === 'number' && typeof oldVal === 'number') {
                            return Math.abs(newVal - oldVal) > 0.001;
                        }
                        return JSON.stringify(newVal) !== JSON.stringify(oldVal);
                    });
                    return { type: 'update', existing, changedFields };
                }
            }
        }

        for (const existing of existingItems) {
            const isSimilar = compareFields.every(field => {
                const newVal = newItem[field];
                const oldVal = existing[field];
                if (typeof newVal === 'number' && typeof oldVal === 'number') {
                    return Math.abs(newVal - oldVal) < 0.001;
                }
                return JSON.stringify(newVal) === JSON.stringify(oldVal);
            });

            if (isSimilar) {
                return { type: 'conflict', existing, conflictFields: compareFields };
            }
        }

        return { type: 'new', existing: null };
    }

    processImportItem(entityType, newItem, status, existingItems, batchId) {
        const conflictFields = status.changedFields || status.conflictFields || [];
        const result = {
            type: entityType,
            id: newItem.id,
            status: status.type,
            data: newItem.toJSON(),
            existing: status.existing ? status.existing.toJSON() : null,
            conflictFields: conflictFields,
            applied: false,
            message: this.getStatusMessage(status.type, entityType, conflictFields)
        };

        switch (status.type) {
            case 'new':
                this.addNewItem(entityType, newItem, batchId);
                result.applied = true;
                break;
            case 'duplicate':
                result.applied = false;
                break;
            case 'update':
                this.updateItem(entityType, status.existing, newItem, batchId);
                result.applied = true;
                break;
            case 'conflict':
                result.applied = false;
                break;
        }

        return result;
    }

    addNewItem(entityType, item, batchId) {
        item.addedInBatch = batchId;
        
        switch (entityType) {
            case 'wall':
                this.maze.addWall(item.toJSON());
                this.changeTracker.recordCreate('wall', item, '导入新增');
                break;
            case 'character':
                this.maze.addCharacter(item.toJSON());
                this.changeTracker.recordCreate('character', item, '导入新增');
                break;
            case 'soundSource':
                this.maze.addSoundSource(item.toJSON());
                this.changeTracker.recordCreate('soundSource', item, '导入新增');
                break;
        }
    }

    updateItem(entityType, existing, newItem, batchId) {
        const oldCopy = existing.clone();
        Object.assign(existing, newItem.toJSON());
        existing.updatedAt = Date.now();
        existing.addedInBatch = batchId;
        
        this.changeTracker.recordUpdate(entityType, oldCopy, existing, '导入更新');
    }

    updateSummary(summary, items) {
        for (const item of items) {
            summary.total++;
            summary[item.status]++;
        }
    }

    getStatusMessage(status, entityType, conflictFields = []) {
        const messages = {
            new: `新增${entityType}`,
            duplicate: `${entityType}已存在，数据完全相同`,
            update: `更新${entityType}: ${conflictFields.join(', ')}`,
            conflict: `检测到冲突: ${entityType}位置相同但ID不同`,
            error: `${entityType}数据错误`
        };
        return messages[status] || status;
    }

    resolveConflict(itemIndex, resolution) {
        if (!this.currentImportResult || !this.currentImportResult.items[itemIndex]) {
            return { success: false, message: '未找到导入项' };
        }

        const item = this.currentImportResult.items[itemIndex];
        if (item.status !== 'conflict') {
            return { success: false, message: '该项没有冲突需要解决' };
        }

        switch (resolution) {
            case 'keep_both':
                const newId = `${item.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                item.data.id = newId;
                item.id = newId;
                this.addNewItem(item.type, item.data, this.currentImportResult.batchId);
                item.status = 'new';
                item.applied = true;
                item.message = `已作为新${item.type}添加`;
                this.currentImportResult.summary.conflict--;
                this.currentImportResult.summary.new++;
                break;
            case 'overwrite':
                if (item.existing) {
                    const oldCopy = { ...item.existing };
                    Object.assign(item.existing, item.data);
                    item.existing.updatedAt = Date.now();
                    this.changeTracker.recordUpdate(item.type, oldCopy, item.existing, '冲突覆盖');
                    item.status = 'update';
                    item.applied = true;
                    item.message = `已覆盖现有${item.type}`;
                    this.currentImportResult.summary.conflict--;
                    this.currentImportResult.summary.update++;
                }
                break;
            case 'skip':
                item.applied = false;
                item.message = '已跳过该项';
                break;
            default:
                return { success: false, message: '未知的冲突解决方案' };
        }

        this.emit('conflictResolved', { item, resolution });
        return { success: true, item };
    }

    applyAllConflicts(resolution) {
        const results = [];
        for (let i = 0; i < this.currentImportResult.items.length; i++) {
            if (this.currentImportResult.items[i].status === 'conflict') {
                results.push(this.resolveConflict(i, resolution));
            }
        }
        return results;
    }

    getImportHistory() {
        return [...this.importHistory];
    }

    getLatestImport() {
        if (this.importHistory.length === 0) return null;
        return this.importHistory[this.importHistory.length - 1];
    }

    checkForDuplicateImport(data) {
        const dataHash = this.generateDataHash(data);
        const duplicate = this.importHistory.find(imp => 
            this.generateDataHash(imp.items) === dataHash
        );
        return duplicate ? { isDuplicate: true, existingImport: duplicate } : { isDuplicate: false };
    }

    generateDataHash(data) {
        return JSON.stringify(data);
    }

    getImportSummary() {
        return {
            totalImports: this.importHistory.length,
            totalItems: this.importHistory.reduce((sum, imp) => sum + imp.summary.total, 0),
            latestImport: this.getLatestImport(),
            byStatus: this.importHistory.reduce((acc, imp) => {
                acc.new += imp.summary.new;
                acc.duplicate += imp.summary.duplicate;
                acc.update += imp.summary.update;
                acc.conflict += imp.summary.conflict;
                acc.error += imp.summary.error;
                return acc;
            }, { new: 0, duplicate: 0, update: 0, conflict: 0, error: 0 })
        };
    }

    exportImportHistory() {
        return JSON.stringify({
            exportedAt: Date.now(),
            importHistory: this.importHistory
        }, null, 2);
    }

    toJSON() {
        return {
            importHistory: [...this.importHistory],
            currentImportResult: this.currentImportResult
        };
    }

    loadJSON(data) {
        if (data.importHistory) {
            this.importHistory = [...data.importHistory];
        }
        if (data.currentImportResult) {
            this.currentImportResult = data.currentImportResult;
        }
    }
}
