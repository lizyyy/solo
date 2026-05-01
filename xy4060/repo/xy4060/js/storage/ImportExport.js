var ImportExport = function(storage) {
    this.storage = storage || storageInstance;
};

ImportExport.prototype.exportLevelPack = function(levelIds) {
    var levels = [];
    var records = [];
    
    for (var i = 0; i < levelIds.length; i++) {
        var levelId = levelIds[i];
        var level = this.storage.loadLevel(levelId);
        if (level) {
            levels.push(level.toJSON());
            var record = this.storage.loadRecord(levelId);
            if (record && record.bestRating > 0) {
                records.push(record.toJSON());
            }
        }
    }
    
    var pack = {
        version: '1.0',
        name: '关卡包',
        description: '导出的关卡包',
        exportedAt: new Date().toISOString(),
        levels: levels,
        records: records
    };
    
    return pack;
};

ImportExport.prototype.exportAllLevels = function() {
    var allLevels = this.storage.loadAllLevels();
    var levelIds = allLevels.map(function(levelData) {
        return levelData.id;
    });
    return this.exportLevelPack(levelIds);
};

ImportExport.prototype.importLevelPack = function(packData) {
    var result = {
        success: false,
        importedCount: 0,
        errors: [],
        warnings: []
    };
    
    if (!packData || !packData.levels || !Array.isArray(packData.levels)) {
        result.errors.push('关卡包格式不正确');
        return result;
    }
    
    for (var i = 0; i < packData.levels.length; i++) {
        var levelData = packData.levels[i];
        try {
            var originalId = levelData.id;
            levelData.id = 'imported_' + Date.now() + '_' + i;
            levelData.createdAt = new Date().toISOString();
            levelData.updatedAt = levelData.createdAt;
            
            var level = Level.fromJSON(levelData);
            var validation = level.validate();
            
            if (!validation.valid) {
                result.warnings.push({
                    levelName: level.name,
                    messages: validation.errors
                });
            }
            
            this.storage.saveLevel(level);
            result.importedCount++;
            
            if (packData.records && Array.isArray(packData.records)) {
                for (var j = 0; j < packData.records.length; j++) {
                    var recordData = packData.records[j];
                    if (recordData.levelId === originalId) {
                        var newRecord = BestRecord.fromJSON(recordData);
                        newRecord.levelId = level.id;
                        this.storage.saveRecord(newRecord);
                    }
                }
            }
            
        } catch (e) {
            result.errors.push({
                levelIndex: i,
                message: '导入关卡失败: ' + e.message
            });
        }
    }
    
    result.success = result.importedCount > 0;
    return result;
};

ImportExport.prototype.downloadJSON = function(data, filename) {
    var jsonStr = JSON.stringify(data, null, 2);
    var blob = new Blob([jsonStr], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || 'robot_trainer_export.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return true;
};

ImportExport.prototype.parseJSONFile = function(file, callback) {
    var thisIE = this;
    var reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            var data = JSON.parse(e.target.result);
            callback(null, data);
        } catch (err) {
            callback(err, null);
        }
    };
    
    reader.onerror = function(e) {
        callback(new Error('读取文件失败'), null);
    };
    
    reader.readAsText(file);
};

ImportExport.prototype.exportSingleLevel = function(levelId) {
    return this.exportLevelPack([levelId]);
};

ImportExport.prototype.exportReplay = function(replayId) {
    var replay = this.storage.loadReplay(replayId);
    if (!replay) {
        return null;
    }
    
    return {
        version: '1.0',
        type: 'replay',
        exportedAt: new Date().toISOString(),
        replay: replay.toJSON()
    };
};

ImportExport.prototype.importReplay = function(replayData) {
    if (!replayData || !replayData.replay) {
        return { success: false, error: '回放数据格式不正确' };
    }
    
    try {
        var replay = Replay.fromJSON(replayData.replay);
        this.storage.saveReplay(replay);
        return { success: true, replayId: replay.id };
    } catch (e) {
        return { success: false, error: '导入回放失败: ' + e.message };
    }
};

ImportExport.prototype.validateLevelPack = function(packData) {
    var issues = [];
    
    if (!packData) {
        issues.push({ type: 'error', message: '数据为空' });
        return { valid: false, issues: issues };
    }
    
    if (!packData.version) {
        issues.push({ type: 'warning', message: '缺少版本信息' });
    }
    
    if (!packData.levels || !Array.isArray(packData.levels)) {
        issues.push({ type: 'error', message: '缺少关卡数据' });
        return { valid: false, issues: issues };
    }
    
    if (packData.levels.length === 0) {
        issues.push({ type: 'warning', message: '关卡包中没有关卡' });
    }
    
    for (var i = 0; i < packData.levels.length; i++) {
        var levelData = packData.levels[i];
        var levelErrors = this._validateLevelData(levelData, i + 1);
        issues = issues.concat(levelErrors);
    }
    
    var hasErrors = issues.some(function(issue) {
        return issue.type === 'error';
    });
    
    return {
        valid: !hasErrors,
        issues: issues,
        levelCount: packData.levels.length
    };
};

ImportExport.prototype._validateLevelData = function(levelData, levelNumber) {
    var issues = [];
    var prefix = '第' + levelNumber + '关: ';
    
    if (!levelData.id) {
        issues.push({ type: 'warning', message: prefix + '缺少关卡ID' });
    }
    
    if (!levelData.name) {
        issues.push({ type: 'warning', message: prefix + '缺少关卡名称' });
    }
    
    if (!levelData.mapWidth || !levelData.mapHeight) {
        issues.push({ type: 'error', message: prefix + '缺少地图尺寸' });
        return issues;
    }
    
    if (!levelData.map || !Array.isArray(levelData.map)) {
        issues.push({ type: 'error', message: prefix + '缺少地图数据' });
        return issues;
    }
    
    if (levelData.map.length !== levelData.mapHeight) {
        issues.push({ type: 'error', message: prefix + '地图高度不匹配' });
    }
    
    var hasStart = false;
    var hasCheckpoint = false;
    
    for (var y = 0; y < levelData.map.length; y++) {
        var row = levelData.map[y];
        if (!Array.isArray(row)) continue;
        
        for (var x = 0; x < row.length; x++) {
            var cell = row[x];
            if (cell === Constants.CELL_TYPE.START) hasStart = true;
            if (cell === Constants.CELL_TYPE.CHECKPOINT) hasCheckpoint = true;
        }
    }
    
    if (!hasStart) {
        issues.push({ type: 'warning', message: prefix + '没有起点' });
    }
    
    if (!hasCheckpoint) {
        issues.push({ type: 'warning', message: prefix + '没有检查点' });
    }
    
    return issues;
};

var importExportInstance = new ImportExport(storageInstance);

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ImportExport: ImportExport,
        importExportInstance: importExportInstance
    };
}
