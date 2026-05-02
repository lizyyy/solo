var Command = function(type) {
    this.type = type;
    this.id = 'cmd_' + Math.random().toString(36).substr(2, 9);
    this.index = -1;
    this.executed = false;
    this.executionResult = null;
};

Command.prototype.getName = function() {
    return Constants.COMMAND_NAMES[this.type] || this.type;
};

Command.prototype.getIcon = function() {
    return Constants.COMMAND_ICONS[this.type] || '❓';
};

Command.prototype.getEnergyCost = function() {
    return Constants.ENERGY_COST[this.type] || 0;
};

Command.prototype.clone = function() {
    var newCmd = new Command(this.type);
    newCmd.id = this.id;
    newCmd.index = this.index;
    newCmd.executed = this.executed;
    newCmd.executionResult = this.executionResult;
    return newCmd;
};

Command.prototype.toJSON = function() {
    return {
        type: this.type,
        id: this.id,
        index: this.index,
        executed: this.executed,
        executionResult: this.executionResult
    };
};

Command.fromJSON = function(json) {
    var cmd = new Command(json.type);
    cmd.id = json.id;
    cmd.index = json.index;
    cmd.executed = json.executed;
    cmd.executionResult = json.executionResult;
    return cmd;
};

var CommandQueue = function() {
    this.commands = [];
    this.currentIndex = -1;
};

CommandQueue.prototype.add = function(command) {
    command.index = this.commands.length;
    this.commands.push(command);
};

CommandQueue.prototype.addAt = function(index, command) {
    if (index < 0 || index > this.commands.length) {
        return false;
    }
    this.commands.splice(index, 0, command);
    this._updateIndices();
    return true;
};

CommandQueue.prototype.remove = function(index) {
    if (index < 0 || index >= this.commands.length) {
        return null;
    }
    var removed = this.commands.splice(index, 1)[0];
    this._updateIndices();
    if (this.currentIndex >= this.commands.length) {
        this.currentIndex = this.commands.length - 1;
    }
    return removed;
};

CommandQueue.prototype.get = function(index) {
    if (index < 0 || index >= this.commands.length) {
        return null;
    }
    return this.commands[index];
};

CommandQueue.prototype.getCurrent = function() {
    if (this.currentIndex < 0 || this.currentIndex >= this.commands.length) {
        return null;
    }
    return this.commands[this.currentIndex];
};

CommandQueue.prototype.getNext = function() {
    var nextIndex = this.currentIndex + 1;
    if (nextIndex >= this.commands.length) {
        return null;
    }
    return this.commands[nextIndex];
};

CommandQueue.prototype.advance = function() {
    this.currentIndex++;
    return this.getCurrent();
};

CommandQueue.prototype.reset = function() {
    this.currentIndex = -1;
    for (var i = 0; i < this.commands.length; i++) {
        this.commands[i].executed = false;
        this.commands[i].executionResult = null;
    }
};

CommandQueue.prototype.clear = function() {
    this.commands = [];
    this.currentIndex = -1;
};

CommandQueue.prototype._updateIndices = function() {
    for (var i = 0; i < this.commands.length; i++) {
        this.commands[i].index = i;
    }
};

CommandQueue.prototype.length = function() {
    return this.commands.length;
};

CommandQueue.prototype.isEmpty = function() {
    return this.commands.length === 0;
};

CommandQueue.prototype.isAtEnd = function() {
    return this.currentIndex >= this.commands.length - 1;
};

CommandQueue.prototype.clone = function() {
    var newQueue = new CommandQueue();
    for (var i = 0; i < this.commands.length; i++) {
        newQueue.add(this.commands[i].clone());
    }
    newQueue.currentIndex = this.currentIndex;
    return newQueue;
};

CommandQueue.prototype.toJSON = function() {
    return {
        commands: this.commands.map(function(cmd) { return cmd.toJSON(); }),
        currentIndex: this.currentIndex
    };
};

CommandQueue.fromJSON = function(json) {
    var queue = new CommandQueue();
    queue.commands = json.commands.map(function(cmdJson) {
        return Command.fromJSON(cmdJson);
    });
    queue.currentIndex = json.currentIndex;
    return queue;
};

CommandQueue.fromText = function(text) {
    var queue = new CommandQueue();
    var lines = text.trim().split('\n');
    
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim().toLowerCase();
        if (!line) continue;
        
        var cmdType = null;
        if (line === 'forward' || line === '前进' || line === 'f') {
            cmdType = Constants.COMMAND_TYPE.FORWARD;
        } else if (line === 'turnleft' || line === '左转' || line === 'l') {
            cmdType = Constants.COMMAND_TYPE.TURN_LEFT;
        } else if (line === 'turnright' || line === '右转' || line === 'r') {
            cmdType = Constants.COMMAND_TYPE.TURN_RIGHT;
        } else if (line === 'sample' || line === '取样' || line === 's') {
            cmdType = Constants.COMMAND_TYPE.SAMPLE;
        } else if (line === 'charge' || line === '充电' || line === 'c') {
            cmdType = Constants.COMMAND_TYPE.CHARGE;
        }
        
        if (cmdType) {
            queue.add(new Command(cmdType));
        }
    }
    
    return queue;
};

CommandQueue.prototype.toText = function() {
    return this.commands.map(function(cmd) {
        return cmd.type;
    }).join('\n');
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Command: Command,
        CommandQueue: CommandQueue
    };
}
