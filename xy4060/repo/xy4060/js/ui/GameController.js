var GameController = function(options) {
    options = options || {};
    
    this.canvas = options.canvas;
    this.storage = options.storage || storageInstance;
    this.importExport = options.importExport || importExportInstance;
    
    this.currentLevel = null;
    this.robotState = null;
    this.mode = Constants.MODE.TRAIN;
    
    this.renderer = new GameRenderer(this.canvas);
    this.levelEditor = new LevelEditor(this.renderer, this.storage);
    this.commandEditor = new CommandEditor();
    this.interpreter = new CommandInterpreter(null);
    this.validator = new Validator();
    this.scorer = new Scorer();
    
    this.isRunning = false;
    this.isPaused = false;
    this.speed = 5;
    
    this._init();
};

GameController.prototype._init = function() {
    var thisController = this;
    
    SampleLevels.initSampleLevels(this.storage);
    
    this._refreshLevelSelector();
    
    document.getElementById('btn-mode-switch').addEventListener('click', function() {
        thisController.toggleMode();
    });
    
    document.getElementById('btn-new-level').addEventListener('click', function() {
        thisController.createNewLevel();
    });
    
    document.getElementById('btn-delete-level').addEventListener('click', function() {
        thisController.deleteCurrentLevel();
    });
    
    document.getElementById('level-selector').addEventListener('change', function() {
        var levelId = this.value;
        if (levelId) {
            thisController.loadLevel(levelId);
        }
    });
    
    document.getElementById('btn-run').addEventListener('click', function() {
        thisController.run();
    });
    
    document.getElementById('btn-step').addEventListener('click', function() {
        thisController.step();
    });
    
    document.getElementById('btn-pause').addEventListener('click', function() {
        thisController.pause();
    });
    
    document.getElementById('btn-reset').addEventListener('click', function() {
        thisController.reset();
    });
    
    document.getElementById('speed-slider').addEventListener('input', function() {
        thisController.speed = parseInt(this.value);
    });
    
    document.getElementById('btn-import').addEventListener('click', function() {
        document.getElementById('file-input').click();
    });
    
    document.getElementById('btn-export').addEventListener('click', function() {
        thisController.exportAll();
    });
    
    document.getElementById('file-input').addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            thisController.importFile(e.target.files[0]);
            e.target.value = '';
        }
    });
    
    document.getElementById('btn-help').addEventListener('click', function() {
        thisController.showHelp();
    });
    
    document.getElementById('btn-close-help').addEventListener('click', function() {
        thisController.hideHelp();
    });
    
    document.getElementById('help-modal').addEventListener('click', function(e) {
        if (e.target === this) {
            thisController.hideHelp();
        }
    });
    
    var firstLevel = this._getFirstLevel();
    if (firstLevel) {
        this.loadLevel(firstLevel.id);
    }
};

GameController.prototype._getFirstLevel = function() {
    var levels = this.storage.loadAllLevels();
    if (levels.length > 0) {
        return levels[0];
    }
    return null;
};

GameController.prototype._refreshLevelSelector = function() {
    var selector = document.getElementById('level-selector');
    var levels = this.storage.loadAllLevels();
    
    selector.innerHTML = '<option value="">-- 选择关卡 --</option>';
    
    for (var i = 0; i < levels.length; i++) {
        var level = levels[i];
        var option = document.createElement('option');
        option.value = level.id;
        option.textContent = level.name;
        selector.appendChild(option);
    }
    
    if (this.currentLevel) {
        selector.value = this.currentLevel.id;
    }
};

GameController.prototype.loadLevel = function(levelId) {
    var level = this.storage.loadLevel(levelId);
    if (!level) return;
    
    this.currentLevel = level;
    this.robotState = new RobotState(level);
    
    this.renderer.setLevel(level);
    this.renderer.setRobotState(this.robotState);
    this.renderer.render();
    
    this.interpreter.setRobotState(this.robotState);
    
    document.getElementById('current-level-name').textContent = level.name;
    
    this._updateRobotInfo();
    this._loadBestRecord(levelId);
    
    this._clearResult();
    this.commandEditor.resetDisplay();
    
    if (this.mode === Constants.MODE.EDIT) {
        this.levelEditor.startEditing(level);
    }
};

GameController.prototype._updateRobotInfo = function() {
    if (!this.robotState) return;
    
    var stats = this.robotState.getStats();
    
    document.getElementById('robot-position').textContent = 
        '(' + stats.position.x + ', ' + stats.position.y + ')';
    document.getElementById('robot-direction').textContent = stats.directionName;
    document.getElementById('energy-value').textContent = 
        Math.floor(stats.energy) + '/' + stats.maxEnergy;
    document.getElementById('checked-count').textContent = 
        stats.visitedCheckpoints + '/' + stats.totalCheckpoints;
    document.getElementById('sampled-count').textContent = 
        stats.sampledPoints + '/' + stats.totalSamples;
    
    var energyFill = document.getElementById('energy-fill');
    var energyPercent = stats.energyPercent;
    energyFill.style.width = energyPercent + '%';
    
    if (energyPercent < 20) {
        energyFill.classList.add('low');
    } else {
        energyFill.classList.remove('low');
    }
};

GameController.prototype._loadBestRecord = function(levelId) {
    var record = this.storage.loadRecord(levelId);
    var recordsEl = document.getElementById('best-records');
    
    if (!record || record.bestRating === 0) {
        recordsEl.innerHTML = '<div class="empty-hint">暂无记录</div>';
        return;
    }
    
    var html = '<div class="record-item">';
    html += '  <div class="record-stars">' + this._getStarDisplay(record.bestRating) + '</div>';
    html += '  <div class="record-stats">';
    html += '    指令数: ' + (record.minCommands === Infinity ? 0 : record.minCommands);
    html += '    | 尝试: ' + record.attempts + ' 次';
    html += '  </div>';
    html += '</div>';
    
    recordsEl.innerHTML = html;
};

GameController.prototype._getStarDisplay = function(rating) {
    var stars = '';
    for (var i = 0; i < 3; i++) {
        stars += i < rating ? '⭐' : '☆';
    }
    return stars;
};

GameController.prototype.toggleMode = function() {
    if (this.mode === Constants.MODE.TRAIN) {
        this.mode = Constants.MODE.EDIT;
        document.getElementById('current-mode').textContent = '编辑模式';
        
        if (this.currentLevel) {
            this.levelEditor.startEditing(this.currentLevel);
        }
    } else {
        this.mode = Constants.MODE.TRAIN;
        document.getElementById('current-mode').textContent = '训练模式';
        this.levelEditor.stopEditing();
        
        var editedLevel = this.levelEditor.getCurrentLevel();
        if (editedLevel) {
            this.currentLevel = editedLevel;
            this.robotState = new RobotState(this.currentLevel);
            this.renderer.setLevel(this.currentLevel);
            this.renderer.setRobotState(this.robotState);
            this.renderer.render();
            this.interpreter.setRobotState(this.robotState);
        }
    }
};

GameController.prototype.createNewLevel = function() {
    if (this.mode !== Constants.MODE.EDIT) {
        this.mode = Constants.MODE.EDIT;
        document.getElementById('current-mode').textContent = '编辑模式';
    }
    
    var newLevel = this.levelEditor.createNewLevel();
    this.currentLevel = newLevel;
    this.robotState = new RobotState(newLevel);
    
    this._updateRobotInfo();
    this._refreshLevelSelector();
};

GameController.prototype.deleteCurrentLevel = function() {
    if (!this.currentLevel) return;
    
    if (!confirm('确定要删除关卡 "' + this.currentLevel.name + '" 吗？')) {
        return;
    }
    
    this.storage.deleteLevel(this.currentLevel.id);
    this.currentLevel = null;
    this.robotState = null;
    
    this._refreshLevelSelector();
    document.getElementById('level-selector').value = '';
    document.getElementById('current-level-name').textContent = '未选择';
    
    this.levelEditor.stopEditing();
    this.renderer.setLevel(null);
    this.renderer.render();
};

GameController.prototype.run = function() {
    if (!this.currentLevel || !this.robotState) {
        this._showStatus('请先选择关卡', 'error');
        return;
    }
    
    var commandQueue = this.commandEditor.getCommandQueue();
    if (commandQueue.isEmpty()) {
        this._showStatus('请先添加指令', 'error');
        return;
    }
    
    if (this.isRunning) {
        if (this.isPaused) {
            this.resume();
        }
        return;
    }
    
    this.reset();
    
    this.isRunning = true;
    this.isPaused = false;
    this._updateButtonStates();
    
    var thisController = this;
    var stepDelay = this._getStepDelay();
    
    this.interpreter.onStepComplete = function(command, result, robotState) {
        thisController._onStepComplete(command, result);
    };
    
    this.interpreter.onRunComplete = function(robotState, commandQueue) {
        thisController._onRunComplete(robotState, commandQueue);
    };
    
    this.interpreter.onError = function(result, robotState, command) {
        thisController._onError(result, robotState, command);
    };
    
    this.interpreter.run(commandQueue, { stepDelay: stepDelay });
};

GameController.prototype.step = function() {
    if (!this.currentLevel || !this.robotState) {
        this._showStatus('请先选择关卡', 'error');
        return;
    }
    
    var commandQueue = this.commandEditor.getCommandQueue();
    var nextCommand = commandQueue.getNext();
    
    if (!nextCommand) {
        this._showStatus('没有更多指令了', 'warning');
        return;
    }
    
    if (this.robotState.isDead) {
        this._showStatus('机器人已停止，请重置', 'error');
        return;
    }
    
    var result = this.interpreter.step(nextCommand);
    commandQueue.advance();
    
    this._onStepComplete(nextCommand, result);
    
    if (!result.success || this.robotState.isDead) {
        this._onError(result, this.robotState, nextCommand);
    } else if (commandQueue.isAtEnd()) {
        this._onRunComplete(this.robotState, commandQueue);
    }
};

GameController.prototype.pause = function() {
    if (this.isRunning) {
        this.isPaused = true;
        this.interpreter.pause();
        this._updateButtonStates();
    }
};

GameController.prototype.resume = function() {
    if (this.isPaused) {
        this.isPaused = false;
        this.interpreter.resume();
        this._updateButtonStates();
    }
};

GameController.prototype.reset = function() {
    this.interpreter.stop();
    this.isRunning = false;
    this.isPaused = false;
    
    if (this.currentLevel) {
        this.robotState = new RobotState(this.currentLevel);
        this.interpreter.setRobotState(this.robotState);
        this.renderer.setRobotState(this.robotState);
        this.renderer.render();
        this._updateRobotInfo();
    }
    
    this.commandEditor.resetDisplay();
    this._clearResult();
    this._updateButtonStates();
};

GameController.prototype._getStepDelay = function() {
    var minDelay = 100;
    var maxDelay = 1000;
    var range = maxDelay - minDelay;
    var normalizedSpeed = (10 - this.speed) / 9;
    return minDelay + Math.floor(range * normalizedSpeed);
};

GameController.prototype._updateButtonStates = function() {
    var btnRun = document.getElementById('btn-run');
    var btnStep = document.getElementById('btn-step');
    var btnPause = document.getElementById('btn-pause');
    var btnReset = document.getElementById('btn-reset');
    
    if (this.isRunning) {
        btnRun.disabled = true;
        btnStep.disabled = true;
        btnPause.disabled = this.isPaused;
        btnReset.disabled = false;
    } else {
        btnRun.disabled = false;
        btnStep.disabled = false;
        btnPause.disabled = true;
        btnReset.disabled = false;
    }
    
    if (this.isPaused) {
        btnRun.disabled = false;
        btnRun.textContent = '▶ 继续';
    } else {
        btnRun.textContent = '▶ 运行';
    }
};

GameController.prototype._onStepComplete = function(command, result) {
    this.commandEditor.highlightCurrentCommand(command.index);
    this.commandEditor.markCommandExecuted(command.index, result.success);
    this.renderer.render();
    this._updateRobotInfo();
};

GameController.prototype._onRunComplete = function(robotState, commandQueue) {
    this.isRunning = false;
    this.isPaused = false;
    this._updateButtonStates();
    
    var executionResult = this.validator.validateExecution(robotState, commandQueue, this.currentLevel);
    var optimalCommands = this.scorer.estimateOptimalCommands(this.currentLevel);
    var ratingResult = this.scorer.calculateRating(executionResult, this.currentLevel, optimalCommands);
    
    executionResult.rating = ratingResult.rating;
    
    this._showResult(executionResult, ratingResult);
    this._saveRecord(executionResult, commandQueue, robotState);
};

GameController.prototype._onError = function(result, robotState, command) {
    this.isRunning = false;
    this.isPaused = false;
    this._updateButtonStates();
    
    var executionResult = this.validator.validateExecution(robotState, this.commandEditor.getCommandQueue(), this.currentLevel);
    executionResult.rating = Constants.RATING.ZERO_STARS;
    
    this._showResult(executionResult, null);
};

GameController.prototype._showResult = function(executionResult, ratingResult) {
    var resultArea = document.getElementById('result-area');
    var html = '';
    
    if (ratingResult) {
        var starHtml = '<div class="star-rating">';
        for (var i = 0; i < 3; i++) {
            var starClass = i < executionResult.rating ? 'star filled' : 'star';
            starHtml += '<span class="' + starClass + '">★</span>';
        }
        starHtml += '</div>';
        html += starHtml;
        
        html += '<div class="result-item info">';
        html += ratingResult.details;
        html += '</div>';
    }
    
    for (var i = 0; i < executionResult.errors.length; i++) {
        var error = executionResult.errors[i];
        html += '<div class="result-item error">';
        html += '❌ ' + error.message;
        if (error.step >= 0) {
            html += ' (第' + (error.step + 1) + '步)';
        }
        html += '</div>';
    }
    
    for (var j = 0; j < executionResult.warnings.length; j++) {
        var warning = executionResult.warnings[j];
        html += '<div class="result-item warning">';
        html += '⚠️ ' + warning.message;
        if (warning.step >= 0) {
            html += ' (第' + (warning.step + 1) + '步)';
        }
        html += '</div>';
    }
    
    for (var k = 0; k < executionResult.messages.length; k++) {
        html += '<div class="result-item success">';
        html += '✅ ' + executionResult.messages[k];
        html += '</div>';
    }
    
    var stats = executionResult.stats;
    html += '<div class="result-item info">';
    html += '执行指令: ' + stats.commandsExecuted + '/' + stats.commandsTotal;
    html += ' | 能量消耗: ' + Math.floor(stats.energyUsed);
    html += '</div>';
    
    resultArea.innerHTML = html;
};

GameController.prototype._clearResult = function() {
    var resultArea = document.getElementById('result-area');
    resultArea.innerHTML = '<div class="empty-hint">运行后查看结果</div>';
};

GameController.prototype._saveRecord = function(executionResult, commandQueue, robotState) {
    if (!this.currentLevel) return;
    
    var record = this.storage.loadRecord(this.currentLevel.id);
    record.levelName = this.currentLevel.name;
    
    var replay = new Replay(this.currentLevel.id);
    replay.levelName = this.currentLevel.name;
    replay.setCommands(commandQueue);
    replay.setResult(executionResult);
    
    record.update(replay);
    
    this.storage.saveRecord(record);
    this.storage.saveReplay(replay);
    
    this._loadBestRecord(this.currentLevel.id);
};

GameController.prototype._showStatus = function(message, type) {
    var statusEl = document.getElementById('game-status');
    statusEl.textContent = message;
    statusEl.style.color = type === 'success' ? '#48bb78' : (type === 'error' ? '#f56565' : '#ed8936');
    
    setTimeout(function() {
        statusEl.style.color = '#4a5568';
    }, 3000);
};

GameController.prototype.exportAll = function() {
    var pack = this.importExport.exportAllLevels();
    var filename = 'robot_trainer_levels_' + new Date().toISOString().slice(0, 10) + '.json';
    this.importExport.downloadJSON(pack, filename);
    this._showStatus('关卡包已导出', 'success');
};

GameController.prototype.importFile = function(file) {
    var thisController = this;
    
    this.importExport.parseJSONFile(file, function(err, data) {
        if (err) {
            thisController._showStatus('解析文件失败: ' + err.message, 'error');
            return;
        }
        
        var validation = thisController.importExport.validateLevelPack(data);
        if (!validation.valid) {
            var errorMsgs = validation.issues.filter(function(i) { return i.type === 'error'; })
                .map(function(i) { return i.message; });
            thisController._showStatus('格式错误: ' + errorMsgs.join(', '), 'error');
            return;
        }
        
        var result = thisController.importExport.importLevelPack(data);
        
        if (result.success) {
            thisController._showStatus('成功导入 ' + result.importedCount + ' 个关卡', 'success');
            thisController._refreshLevelSelector();
            
            if (result.importedCount > 0) {
                var levels = thisController.storage.loadAllLevels();
                if (levels.length > 0) {
                    thisController.loadLevel(levels[levels.length - 1].id);
                }
            }
        } else {
            thisController._showStatus('导入失败: ' + result.errors.join(', '), 'error');
        }
    });
};

GameController.prototype.showHelp = function() {
    document.getElementById('help-modal').style.display = 'flex';
};

GameController.prototype.hideHelp = function() {
    document.getElementById('help-modal').style.display = 'none';
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameController;
}
