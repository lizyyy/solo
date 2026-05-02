var Replay = function(levelId) {
    this.id = 'replay_' + Date.now();
    this.levelId = levelId;
    this.levelName = '';
    this.commands = [];
    this.robotStates = [];
    this.result = null;
    this.rating = 0;
    this.createdAt = new Date().toISOString();
    this.commandCount = 0;
    this.energyUsed = 0;
    this.pathLength = 0;
};

Replay.prototype.addState = function(robotState, command, result) {
    this.robotStates.push({
        state: robotState.toJSON(),
        command: command ? command.toJSON() : null,
        result: result
    });
};

Replay.prototype.setCommands = function(commandQueue) {
    this.commands = commandQueue.toJSON().commands;
    this.commandCount = this.commands.length;
};

Replay.prototype.setResult = function(result) {
    this.result = result;
    if (result && result.rating !== undefined) {
        this.rating = result.rating;
    }
    if (result && result.stats) {
        this.energyUsed = result.stats.initialEnergy - result.stats.finalEnergy;
        this.pathLength = result.stats.pathLength;
    }
};

Replay.prototype.getStateAt = function(index) {
    if (index < 0 || index >= this.robotStates.length) {
        return null;
    }
    return this.robotStates[index];
};

Replay.prototype.length = function() {
    return this.robotStates.length;
};

Replay.prototype.getSummary = function() {
    return {
        id: this.id,
        levelId: this.levelId,
        levelName: this.levelName,
        rating: this.rating,
        commandCount: this.commandCount,
        energyUsed: this.energyUsed,
        pathLength: this.pathLength,
        createdAt: this.createdAt,
        success: this.result ? this.result.success : false
    };
};

Replay.prototype.toJSON = function() {
    return {
        id: this.id,
        levelId: this.levelId,
        levelName: this.levelName,
        commands: this.commands,
        robotStates: this.robotStates,
        result: this.result,
        rating: this.rating,
        createdAt: this.createdAt,
        commandCount: this.commandCount,
        energyUsed: this.energyUsed,
        pathLength: this.pathLength
    };
};

Replay.fromJSON = function(json) {
    var replay = new Replay(json.levelId);
    replay.id = json.id;
    replay.levelName = json.levelName;
    replay.commands = json.commands;
    replay.robotStates = json.robotStates;
    replay.result = json.result;
    replay.rating = json.rating;
    replay.createdAt = json.createdAt;
    replay.commandCount = json.commandCount;
    replay.energyUsed = json.energyUsed;
    replay.pathLength = json.pathLength;
    return replay;
};

var BestRecord = function(levelId) {
    this.levelId = levelId;
    this.levelName = '';
    this.bestRating = 0;
    this.minCommands = Infinity;
    this.minEnergy = Infinity;
    this.replayId = null;
    this.updatedAt = null;
    this.attempts = 0;
};

BestRecord.prototype.update = function(replay) {
    this.attempts++;
    this.updatedAt = new Date().toISOString();
    
    if (replay.rating > this.bestRating) {
        this.bestRating = replay.rating;
        this.minCommands = replay.commandCount;
        this.minEnergy = replay.energyUsed;
        this.replayId = replay.id;
        return true;
    }
    
    if (replay.rating === this.bestRating) {
        if (replay.commandCount < this.minCommands) {
            this.minCommands = replay.commandCount;
            this.minEnergy = replay.energyUsed;
            this.replayId = replay.id;
            return true;
        }
        if (replay.commandCount === this.minCommands && replay.energyUsed < this.minEnergy) {
            this.minEnergy = replay.energyUsed;
            this.replayId = replay.id;
            return true;
        }
    }
    
    return false;
};

BestRecord.prototype.getSummary = function() {
    return {
        levelId: this.levelId,
        levelName: this.levelName,
        bestRating: this.bestRating,
        minCommands: this.minCommands === Infinity ? 0 : this.minCommands,
        minEnergy: this.minEnergy === Infinity ? 0 : this.minEnergy,
        replayId: this.replayId,
        updatedAt: this.updatedAt,
        attempts: this.attempts
    };
};

BestRecord.prototype.toJSON = function() {
    return {
        levelId: this.levelId,
        levelName: this.levelName,
        bestRating: this.bestRating,
        minCommands: this.minCommands,
        minEnergy: this.minEnergy,
        replayId: this.replayId,
        updatedAt: this.updatedAt,
        attempts: this.attempts
    };
};

BestRecord.fromJSON = function(json) {
    var record = new BestRecord(json.levelId);
    record.levelName = json.levelName;
    record.bestRating = json.bestRating;
    record.minCommands = json.minCommands;
    record.minEnergy = json.minEnergy;
    record.replayId = json.replayId;
    record.updatedAt = json.updatedAt;
    record.attempts = json.attempts;
    return record;
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Replay: Replay,
        BestRecord: BestRecord
    };
}
