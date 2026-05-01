var LevelEditor = function(renderer, storage) {
    this.renderer = renderer;
    this.storage = storage;
    this.currentLevel = null;
    this.selectedTool = null;
    this.isEditing = false;
    
    this.toolMap = {
        'tool-start': Constants.CELL_TYPE.START,
        'tool-obstacle': Constants.CELL_TYPE.OBSTACLE,
        'tool-charge': Constants.CELL_TYPE.CHARGE,
        'tool-checkpoint': Constants.CELL_TYPE.CHECKPOINT,
        'tool-danger': Constants.CELL_TYPE.DANGER,
        'tool-sample': Constants.CELL_TYPE.SAMPLE,
        'tool-erase': Constants.CELL_TYPE.EMPTY
    };
    
    this._init();
};

LevelEditor.prototype._init = function() {
    var thisEditor = this;
    
    this.renderer.onCellClick = function(x, y) {
        if (thisEditor.isEditing && thisEditor.selectedTool !== null) {
            thisEditor._handleCellClick(x, y);
        }
    };
    
    var toolBoxes = document.querySelectorAll('.tool-box');
    for (var i = 0; i < toolBoxes.length; i++) {
        toolBoxes[i].addEventListener('click', function() {
            thisEditor.selectTool(this.id);
        });
    }
    
    document.getElementById('btn-save-level').addEventListener('click', function() {
        thisEditor.saveCurrentLevel();
    });
};

LevelEditor.prototype.selectTool = function(toolId) {
    this.selectedTool = this.toolMap[toolId];
    
    var toolBoxes = document.querySelectorAll('.tool-box');
    for (var i = 0; i < toolBoxes.length; i++) {
        toolBoxes[i].classList.remove('selected');
    }
    
    var selectedTool = document.getElementById(toolId);
    if (selectedTool) {
        selectedTool.classList.add('selected');
    }
    
    this.renderer.setSelectedTool(toolId);
};

LevelEditor.prototype._handleCellClick = function(x, y) {
    if (!this.currentLevel) return;
    
    if (this.selectedTool === null) return;
    
    this.currentLevel.setCell(x, y, this.selectedTool);
    this.renderer.render();
};

LevelEditor.prototype.startEditing = function(level) {
    this.currentLevel = level.clone();
    this.isEditing = true;
    this._updateLevelSettings(this.currentLevel);
    
    document.getElementById('editor-tools').style.display = 'block';
    document.getElementById('level-settings').style.display = 'block';
    
    this.renderer.setLevel(this.currentLevel);
    this.renderer.render();
};

LevelEditor.prototype._updateLevelSettings = function(level) {
    document.getElementById('level-name').value = level.name || '';
    document.getElementById('map-width').value = level.mapWidth;
    document.getElementById('map-height').value = level.mapHeight;
    document.getElementById('initial-energy').value = level.initialEnergy;
    document.getElementById('level-description').value = level.description || '';
};

LevelEditor.prototype.applySettings = function() {
    if (!this.currentLevel) return;
    
    var name = document.getElementById('level-name').value.trim();
    var width = parseInt(document.getElementById('map-width').value) || 10;
    var height = parseInt(document.getElementById('map-height').value) || 10;
    var energy = parseInt(document.getElementById('initial-energy').value) || 50;
    var description = document.getElementById('level-description').value.trim();
    
    width = Math.max(5, Math.min(20, width));
    height = Math.max(5, Math.min(20, height));
    energy = Math.max(1, Math.min(200, energy));
    
    if (width !== this.currentLevel.mapWidth || height !== this.currentLevel.mapHeight) {
        var newLevel = new Level(this.currentLevel.id, name);
        newLevel.description = description;
        newLevel.mapWidth = width;
        newLevel.mapHeight = height;
        newLevel.initialEnergy = energy;
        newLevel._initMap();
        
        for (var y = 0; y < Math.min(height, this.currentLevel.mapHeight); y++) {
            for (var x = 0; x < Math.min(width, this.currentLevel.mapWidth); x++) {
                var cellType = this.currentLevel.getCell(x, y);
                newLevel.setCell(x, y, cellType);
            }
        }
        
        this.currentLevel = newLevel;
    } else {
        this.currentLevel.name = name;
        this.currentLevel.description = description;
        this.currentLevel.initialEnergy = energy;
    }
    
    this.renderer.setLevel(this.currentLevel);
    this.renderer.render();
};

LevelEditor.prototype.saveCurrentLevel = function() {
    if (!this.currentLevel) {
        this._showMessage('没有可保存的关卡', 'error');
        return false;
    }
    
    this.applySettings();
    
    var validation = this.currentLevel.validate();
    if (!validation.valid) {
        this._showMessage('关卡验证失败: ' + validation.errors.join(', '), 'error');
        return false;
    }
    
    this.currentLevel.updatedAt = new Date().toISOString();
    this.storage.saveLevel(this.currentLevel);
    
    this._showMessage('关卡保存成功！', 'success');
    return true;
};

LevelEditor.prototype.stopEditing = function() {
    this.isEditing = false;
    this.selectedTool = null;
    this.currentLevel = null;
    
    document.getElementById('editor-tools').style.display = 'none';
    document.getElementById('level-settings').style.display = 'none';
    
    var toolBoxes = document.querySelectorAll('.tool-box');
    for (var i = 0; i < toolBoxes.length; i++) {
        toolBoxes[i].classList.remove('selected');
    }
};

LevelEditor.prototype._showMessage = function(message, type) {
    var statusEl = document.getElementById('game-status');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.style.color = type === 'success' ? '#48bb78' : '#f56565';
        
        setTimeout(function() {
            statusEl.style.color = '#4a5568';
        }, 3000);
    }
};

LevelEditor.prototype.createNewLevel = function() {
    var level = new Level();
    level.name = '新关卡 ' + (Date.now() % 10000);
    level.description = '新建的关卡';
    level.mapWidth = 10;
    level.mapHeight = 10;
    level.initialEnergy = 50;
    level._initMap();
    
    level.setCell(1, 1, Constants.CELL_TYPE.START);
    level.startDirection = Constants.DIRECTION.RIGHT;
    level.setCell(8, 8, Constants.CELL_TYPE.CHECKPOINT);
    
    this.startEditing(level);
    
    return level;
};

LevelEditor.prototype.getCurrentLevel = function() {
    return this.currentLevel;
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LevelEditor;
}
