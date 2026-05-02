var Storage = function() {
    this.useLocalStorage = typeof localStorage !== 'undefined';
    this.memoryStorage = {};
};

Storage.prototype._getItem = function(key) {
    if (this.useLocalStorage) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn('localStorage访问失败:', e);
        }
    }
    return this.memoryStorage[key] || null;
};

Storage.prototype._setItem = function(key, value) {
    if (this.useLocalStorage) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            console.warn('localStorage保存失败:', e);
        }
    }
    this.memoryStorage[key] = value;
    return true;
};

Storage.prototype._removeItem = function(key) {
    if (this.useLocalStorage) {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.warn('localStorage删除失败:', e);
        }
    }
    delete this.memoryStorage[key];
};

Storage.prototype.saveLevel = function(level) {
    var levels = this.loadAllLevels();
    var existingIndex = -1;
    
    for (var i = 0; i < levels.length; i++) {
        if (levels[i].id === level.id) {
            existingIndex = i;
            break;
        }
    }
    
    if (existingIndex >= 0) {
        levels[existingIndex] = level.toJSON();
    } else {
        levels.push(level.toJSON());
    }
    
    return this._setItem(Constants.STORAGE_KEYS.LEVELS, JSON.stringify(levels));
};

Storage.prototype.loadLevel = function(levelId) {
    var levels = this.loadAllLevels();
    for (var i = 0; i < levels.length; i++) {
        if (levels[i].id === levelId) {
            return Level.fromJSON(levels[i]);
        }
    }
    return null;
};

Storage.prototype.loadAllLevels = function() {
    var data = this._getItem(Constants.STORAGE_KEYS.LEVELS);
    if (!data) {
        return [];
    }
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error('解析关卡数据失败:', e);
        return [];
    }
};

Storage.prototype.loadAllLevelObjects = function() {
    var levelsData = this.loadAllLevels();
    return levelsData.map(function(levelData) {
        return Level.fromJSON(levelData);
    });
};

Storage.prototype.deleteLevel = function(levelId) {
    var levels = this.loadAllLevels();
    var newLevels = [];
    
    for (var i = 0; i < levels.length; i++) {
        if (levels[i].id !== levelId) {
            newLevels.push(levels[i]);
        }
    }
    
    this._setItem(Constants.STORAGE_KEYS.LEVELS, JSON.stringify(newLevels));
    
    this.deleteRecord(levelId);
    this.deleteReplaysForLevel(levelId);
    
    return true;
};

Storage.prototype.saveRecord = function(bestRecord) {
    var records = this.loadAllRecords();
    var existingIndex = -1;
    
    for (var i = 0; i < records.length; i++) {
        if (records[i].levelId === bestRecord.levelId) {
            existingIndex = i;
            break;
        }
    }
    
    if (existingIndex >= 0) {
        records[existingIndex] = bestRecord.toJSON();
    } else {
        records.push(bestRecord.toJSON());
    }
    
    return this._setItem(Constants.STORAGE_KEYS.RECORDS, JSON.stringify(records));
};

Storage.prototype.loadRecord = function(levelId) {
    var records = this.loadAllRecords();
    for (var i = 0; i < records.length; i++) {
        if (records[i].levelId === levelId) {
            return BestRecord.fromJSON(records[i]);
        }
    }
    var newRecord = new BestRecord(levelId);
    return newRecord;
};

Storage.prototype.loadAllRecords = function() {
    var data = this._getItem(Constants.STORAGE_KEYS.RECORDS);
    if (!data) {
        return [];
    }
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error('解析记录数据失败:', e);
        return [];
    }
};

Storage.prototype.deleteRecord = function(levelId) {
    var records = this.loadAllRecords();
    var newRecords = [];
    
    for (var i = 0; i < records.length; i++) {
        if (records[i].levelId !== levelId) {
            newRecords.push(records[i]);
        }
    }
    
    this._setItem(Constants.STORAGE_KEYS.RECORDS, JSON.stringify(newRecords));
    return true;
};

Storage.prototype.saveReplay = function(replay) {
    var replays = this.loadAllReplays();
    replays.push(replay.toJSON());
    
    if (replays.length > 50) {
        replays = replays.slice(replays.length - 50);
    }
    
    return this._setItem(Constants.STORAGE_KEYS.REPLAYS, JSON.stringify(replays));
};

Storage.prototype.loadReplay = function(replayId) {
    var replays = this.loadAllReplays();
    for (var i = 0; i < replays.length; i++) {
        if (replays[i].id === replayId) {
            return Replay.fromJSON(replays[i]);
        }
    }
    return null;
};

Storage.prototype.loadAllReplays = function() {
    var data = this._getItem(Constants.STORAGE_KEYS.REPLAYS);
    if (!data) {
        return [];
    }
    try {
        return JSON.parse(data);
    } catch (e) {
        console.error('解析回放数据失败:', e);
        return [];
    }
};

Storage.prototype.loadReplaysForLevel = function(levelId) {
    var replays = this.loadAllReplays();
    var levelReplays = [];
    
    for (var i = 0; i < replays.length; i++) {
        if (replays[i].levelId === levelId) {
            levelReplays.push(replays[i]);
        }
    }
    
    return levelReplays;
};

Storage.prototype.deleteReplaysForLevel = function(levelId) {
    var replays = this.loadAllReplays();
    var newReplays = [];
    
    for (var i = 0; i < replays.length; i++) {
        if (replays[i].levelId !== levelId) {
            newReplays.push(replays[i]);
        }
    }
    
    this._setItem(Constants.STORAGE_KEYS.REPLAYS, JSON.stringify(newReplays));
    return true;
};

Storage.prototype.clearAll = function() {
    this._removeItem(Constants.STORAGE_KEYS.LEVELS);
    this._removeItem(Constants.STORAGE_KEYS.RECORDS);
    this._removeItem(Constants.STORAGE_KEYS.REPLAYS);
    this._removeItem(Constants.STORAGE_KEYS.SETTINGS);
    return true;
};

Storage.prototype.exportAllData = function() {
    return {
        levels: this.loadAllLevels(),
        records: this.loadAllRecords(),
        replays: this.loadAllReplays(),
        exportedAt: new Date().toISOString(),
        version: '1.0'
    };
};

Storage.prototype.importAllData = function(data) {
    var errors = [];
    
    if (data.levels && Array.isArray(data.levels)) {
        for (var i = 0; i < data.levels.length; i++) {
            var levelData = data.levels[i];
            levelData.id = 'imported_' + Date.now() + '_' + i;
            levelData.createdAt = new Date().toISOString();
            levelData.updatedAt = levelData.createdAt;
        }
        this._setItem(Constants.STORAGE_KEYS.LEVELS, JSON.stringify(data.levels));
    } else {
        errors.push('关卡数据格式不正确');
    }
    
    if (data.records && Array.isArray(data.records)) {
        this._setItem(Constants.STORAGE_KEYS.RECORDS, JSON.stringify(data.records));
    }
    
    if (data.replays && Array.isArray(data.replays)) {
        this._setItem(Constants.STORAGE_KEYS.REPLAYS, JSON.stringify(data.replays));
    }
    
    return {
        success: errors.length === 0,
        errors: errors,
        importedLevels: data.levels ? data.levels.length : 0
    };
};

var storageInstance = new Storage();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Storage: Storage,
        storageInstance: storageInstance
    };
}
