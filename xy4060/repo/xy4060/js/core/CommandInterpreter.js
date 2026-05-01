var CommandInterpreter = function(robotState) {
    this.robotState = robotState;
    this.currentCommand = null;
    this.isRunning = false;
    this.isPaused = false;
    this.currentIndex = -1;
    this.onStepComplete = null;
    this.onRunComplete = null;
    this.onError = null;
    this.replay = null;
};

CommandInterpreter.prototype.setRobotState = function(robotState) {
    this.robotState = robotState;
};

CommandInterpreter.prototype.startReplay = function(replay) {
    this.replay = replay;
    this.currentIndex = 0;
    return this.getReplayStep(0);
};

CommandInterpreter.prototype.getReplayStep = function(index) {
    if (!this.replay || index < 0 || index >= this.replay.length()) {
        return null;
    }
    return this.replay.getStateAt(index);
};

CommandInterpreter.prototype.step = function(command) {
    if (!this.robotState || this.robotState.isDead) {
        return {
            success: false,
            error: '机器人已停止',
            canContinue: false
        };
    }
    
    this.currentCommand = command;
    var result = this._executeCommand(command);
    
    if (this.onStepComplete) {
        this.onStepComplete(command, result, this.robotState);
    }
    
    return result;
};

CommandInterpreter.prototype._executeCommand = function(command) {
    var result;
    var cmdType = command.type;
    
    switch (cmdType) {
        case Constants.COMMAND_TYPE.FORWARD:
            result = this.robotState.moveForward();
            break;
            
        case Constants.COMMAND_TYPE.TURN_LEFT:
            result = this.robotState.turnLeft();
            break;
            
        case Constants.COMMAND_TYPE.TURN_RIGHT:
            result = this.robotState.turnRight();
            break;
            
        case Constants.COMMAND_TYPE.SAMPLE:
            result = this.robotState.sample();
            break;
            
        case Constants.COMMAND_TYPE.CHARGE:
            result = this.robotState.charge();
            break;
            
        default:
            result = {
                success: false,
                error: 'unknownCommand',
                message: '未知指令: ' + cmdType
            };
    }
    
    command.executed = true;
    command.executionResult = result;
    
    return result;
};

CommandInterpreter.prototype.run = function(commandQueue, options) {
    options = options || {};
    var stepDelay = options.stepDelay || 500;
    var thisInterpreter = this;
    
    this.isRunning = true;
    this.isPaused = false;
    this.currentIndex = commandQueue.currentIndex;
    
    var runStep = function() {
        if (!thisInterpreter.isRunning) {
            return;
        }
        
        if (thisInterpreter.isPaused) {
            setTimeout(runStep, 100);
            return;
        }
        
        var command = commandQueue.getNext();
        if (!command) {
            thisInterpreter.isRunning = false;
            if (thisInterpreter.onRunComplete) {
                thisInterpreter.onRunComplete(thisInterpreter.robotState, commandQueue);
            }
            return;
        }
        
        var result = thisInterpreter.step(command);
        commandQueue.advance();
        
        if (!result.success && result.error) {
            thisInterpreter.isRunning = false;
            if (thisInterpreter.onError) {
                thisInterpreter.onError(result, thisInterpreter.robotState, command);
            }
            if (thisInterpreter.onRunComplete) {
                thisInterpreter.onRunComplete(thisInterpreter.robotState, commandQueue);
            }
            return;
        }
        
        if (thisInterpreter.robotState.isDead) {
            thisInterpreter.isRunning = false;
            if (thisInterpreter.onRunComplete) {
                thisInterpreter.onRunComplete(thisInterpreter.robotState, commandQueue);
            }
            return;
        }
        
        setTimeout(runStep, stepDelay);
    };
    
    setTimeout(runStep, 0);
};

CommandInterpreter.prototype.pause = function() {
    this.isPaused = true;
};

CommandInterpreter.prototype.resume = function() {
    this.isPaused = false;
};

CommandInterpreter.prototype.stop = function() {
    this.isRunning = false;
    this.isPaused = false;
};

CommandInterpreter.prototype.getStatus = function() {
    return {
        isRunning: this.isRunning,
        isPaused: this.isPaused,
        isDead: this.robotState ? this.robotState.isDead : true,
        currentCommand: this.currentCommand
    };
};

var ExecutionResult = function() {
    this.success = false;
    this.errors = [];
    this.warnings = [];
    this.messages = [];
    this.rating = 0;
    this.stats = {
        commandsExecuted: 0,
        commandsTotal: 0,
        initialEnergy: 0,
        finalEnergy: 0,
        energyUsed: 0,
        pathLength: 0,
        checkpointsVisited: 0,
        checkpointsTotal: 0,
        samplesCollected: 0,
        samplesTotal: 0
    };
};

ExecutionResult.prototype.addError = function(type, message, step) {
    this.errors.push({
        type: type,
        message: message,
        step: step
    });
};

ExecutionResult.prototype.addWarning = function(type, message, step) {
    this.warnings.push({
        type: type,
        message: message,
        step: step
    });
};

ExecutionResult.prototype.addMessage = function(message) {
    this.messages.push(message);
};

ExecutionResult.prototype.setStats = function(robotState, commandQueue) {
    var stats = robotState.getStats();
    this.stats.commandsExecuted = commandQueue.currentIndex + 1;
    this.stats.commandsTotal = commandQueue.length();
    this.stats.initialEnergy = robotState.maxEnergy;
    this.stats.finalEnergy = robotState.energy;
    this.stats.energyUsed = robotState.maxEnergy - robotState.energy;
    this.stats.pathLength = stats.pathLength;
    this.stats.checkpointsVisited = stats.visitedCheckpoints;
    this.stats.checkpointsTotal = stats.totalCheckpoints;
    this.stats.samplesCollected = stats.sampledPoints;
    this.stats.samplesTotal = stats.totalSamples;
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CommandInterpreter: CommandInterpreter,
        ExecutionResult: ExecutionResult
    };
}
