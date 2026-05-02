var Validator = function() {
    this.errors = [];
    this.warnings = [];
};

Validator.prototype.clear = function() {
    this.errors = [];
    this.warnings = [];
};

Validator.prototype.validateExecution = function(robotState, commandQueue, level) {
    this.clear();
    var result = new ExecutionResult();
    
    if (robotState.isDead && robotState.deathReason) {
        var errorMsg = Constants.ERROR_MESSAGES[robotState.deathReason] || '执行出错';
        result.addError(robotState.deathReason, errorMsg, commandQueue.currentIndex);
    }
    
    if (!robotState.hasVisitedAllCheckpoints()) {
        var missedCheckpoints = this._getMissedCheckpoints(robotState, level);
        if (missedCheckpoints.length > 0) {
            result.addError(
                Constants.ERROR_TYPE.MISSED_CHECKPOINT,
                '漏检了 ' + missedCheckpoints.length + ' 个检查点',
                -1
            );
        }
    }
    
    if (robotState.sampledPoints.length > 0) {
        var duplicateCheck = this._checkDuplicateSamples(robotState, level);
        if (duplicateCheck.hasDuplicates) {
            result.addWarning(
                Constants.ERROR_TYPE.DUPLICATE_SAMPLE,
                '存在重复取样操作',
                -1
            );
        }
    }
    
    result.success = (
        result.errors.length === 0 &&
        robotState.hasVisitedAllCheckpoints() &&
        !robotState.isDead
    );
    
    result.setStats(robotState, commandQueue);
    
    if (result.success) {
        result.addMessage('任务完成！');
    }
    
    return result;
};

Validator.prototype._getMissedCheckpoints = function(robotState, level) {
    var allCheckpoints = level.getCheckpoints();
    var missed = [];
    
    for (var i = 0; i < allCheckpoints.length; i++) {
        var cp = allCheckpoints[i];
        var key = cp.x + ',' + cp.y;
        if (robotState.visitedCheckpoints.indexOf(key) === -1) {
            missed.push(cp);
        }
    }
    
    return missed;
};

Validator.prototype._checkDuplicateSamples = function(robotState, level) {
    var hasDuplicates = false;
    var sampleCounts = {};
    
    for (var i = 0; i < robotState.sampledPoints.length; i++) {
        var key = robotState.sampledPoints[i];
        sampleCounts[key] = (sampleCounts[key] || 0) + 1;
        if (sampleCounts[key] > 1) {
            hasDuplicates = true;
        }
    }
    
    return {
        hasDuplicates: hasDuplicates,
        sampleCounts: sampleCounts
    };
};

Validator.prototype.validateLevel = function(level) {
    this.clear();
    var validation = level.validate();
    
    var result = {
        valid: validation.valid,
        errors: [],
        warnings: []
    };
    
    for (var i = 0; i < validation.errors.length; i++) {
        result.errors.push({
            type: 'levelError',
            message: validation.errors[i]
        });
    }
    
    var checkpoints = level.getCheckpoints();
    if (checkpoints.length > 5) {
        result.warnings.push({
            type: 'tooManyCheckpoints',
            message: '检查点数量较多（' + checkpoints.length + '个），可能难度过大'
        });
    }
    
    var samples = level.getSamplePoints();
    var charges = level.getChargePoints();
    var totalEnergyCost = (checkpoints.length * 2) + (samples.length * 2);
    
    if (totalEnergyCost > level.initialEnergy && charges.length === 0) {
        result.warnings.push({
            type: 'insufficientEnergy',
            message: '初始能量可能不足以完成任务，建议添加充电点'
        });
    }
    
    return result;
};

Validator.prototype.validateCommands = function(commandQueue, level) {
    var issues = [];
    
    if (commandQueue.isEmpty()) {
        issues.push({
            type: 'emptyCommands',
            message: '指令队列为空',
            severity: 'error'
        });
        return issues;
    }
    
    var forwardCount = 0;
    var sampleCount = 0;
    var chargeCount = 0;
    
    for (var i = 0; i < commandQueue.length(); i++) {
        var cmd = commandQueue.get(i);
        if (cmd.type === Constants.COMMAND_TYPE.FORWARD) {
            forwardCount++;
        } else if (cmd.type === Constants.COMMAND_TYPE.SAMPLE) {
            sampleCount++;
        } else if (cmd.type === Constants.COMMAND_TYPE.CHARGE) {
            chargeCount++;
        }
    }
    
    var samplePoints = level.getSamplePoints();
    if (sampleCount > samplePoints.length) {
        issues.push({
            type: 'excessSamples',
            message: '取样指令数量（' + sampleCount + '）多于取样点数量（' + samplePoints.length + '）',
            severity: 'warning'
        });
    }
    
    var chargePoints = level.getChargePoints();
    if (chargeCount > 0 && chargePoints.length === 0) {
        issues.push({
            type: 'unnecessaryCharge',
            message: '关卡中没有充电点，但指令中包含充电指令',
            severity: 'warning'
        });
    }
    
    if (forwardCount === 0) {
        issues.push({
            type: 'noMovement',
            message: '没有前进指令，机器人无法移动',
            severity: 'warning'
        });
    }
    
    return issues;
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Validator;
}
