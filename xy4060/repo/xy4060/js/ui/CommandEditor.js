var CommandEditor = function() {
    this.commandQueue = new CommandQueue();
    this.draggedCommand = null;
    this._init();
};

CommandEditor.prototype._init = function() {
    var thisEditor = this;
    
    var dragSources = document.querySelectorAll('[draggable="true"][data-command]');
    for (var i = 0; i < dragSources.length; i++) {
        dragSources[i].addEventListener('dragstart', function(e) {
            thisEditor.draggedCommand = this.getAttribute('data-command');
            e.dataTransfer.effectAllowed = 'copy';
        });
        
        dragSources[i].addEventListener('dragend', function() {
            thisEditor.draggedCommand = null;
        });
    }
    
    var queueEl = document.getElementById('command-queue');
    
    queueEl.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        this.classList.add('drag-over');
    });
    
    queueEl.addEventListener('dragleave', function() {
        this.classList.remove('drag-over');
    });
    
    queueEl.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        
        if (thisEditor.draggedCommand) {
            thisEditor.addCommand(thisEditor.draggedCommand);
        }
    });
    
    document.getElementById('btn-clear-commands').addEventListener('click', function() {
        thisEditor.clearCommands();
    });
    
    document.getElementById('btn-text-edit').addEventListener('click', function() {
        thisEditor.toggleTextEditor();
    });
    
    document.getElementById('btn-apply-text').addEventListener('click', function() {
        thisEditor.applyTextCommands();
    });
};

CommandEditor.prototype.addCommand = function(commandType) {
    var command = new Command(commandType);
    this.commandQueue.add(command);
    this.render();
};

CommandEditor.prototype.removeCommand = function(index) {
    this.commandQueue.remove(index);
    this.render();
};

CommandEditor.prototype.clearCommands = function() {
    this.commandQueue.clear();
    this.render();
};

CommandEditor.prototype.render = function() {
    var queueEl = document.getElementById('command-queue');
    
    if (this.commandQueue.isEmpty()) {
        queueEl.innerHTML = '<div class="empty-hint">拖拽指令到此处，或使用文本编辑</div>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < this.commandQueue.length(); i++) {
        var cmd = this.commandQueue.get(i);
        var classes = 'command-item';
        if (cmd.executed) {
            classes += ' executed';
        }
        if (i === this.commandQueue.currentIndex) {
            classes += ' current';
        }
        
        html += '<div class="' + classes + '" data-index="' + i + '">';
        html += '  <div class="cmd-info">';
        html += '    <span class="cmd-index">' + (i + 1) + '</span>';
        html += '    <span class="cmd-icon">' + cmd.getIcon() + '</span>';
        html += '    <span class="cmd-name">' + cmd.getName() + '</span>';
        html += '  </div>';
        html += '  <button class="cmd-remove" data-index="' + i + '">×</button>';
        html += '</div>';
    }
    
    queueEl.innerHTML = html;
    
    var removeButtons = queueEl.querySelectorAll('.cmd-remove');
    var thisEditor = this;
    for (var i = 0; i < removeButtons.length; i++) {
        removeButtons[i].addEventListener('click', function(e) {
            e.stopPropagation();
            var index = parseInt(this.getAttribute('data-index'));
            thisEditor.removeCommand(index);
        });
    }
};

CommandEditor.prototype.toggleTextEditor = function() {
    var section = document.getElementById('text-editor-section');
    var isVisible = section.style.display !== 'none';
    
    if (isVisible) {
        section.style.display = 'none';
    } else {
        section.style.display = 'block';
        this._syncToTextEditor();
    }
};

CommandEditor.prototype._syncToTextEditor = function() {
    var textArea = document.getElementById('text-commands');
    textArea.value = this.commandQueue.toText();
};

CommandEditor.prototype.applyTextCommands = function() {
    var textArea = document.getElementById('text-commands');
    var text = textArea.value.trim();
    
    if (!text) {
        this.clearCommands();
        return;
    }
    
    var newQueue = CommandQueue.fromText(text);
    this.commandQueue = newQueue;
    this.render();
    
    this._showMessage('已应用 ' + newQueue.length() + ' 条指令', 'success');
};

CommandEditor.prototype.getCommandQueue = function() {
    return this.commandQueue.clone();
};

CommandEditor.prototype.setCommandQueue = function(queue) {
    this.commandQueue = queue.clone();
    this.render();
};

CommandEditor.prototype.highlightCurrentCommand = function(index) {
    if (index === this.commandQueue.currentIndex) return;
    
    this.commandQueue.currentIndex = index;
    this.render();
};

CommandEditor.prototype.markCommandExecuted = function(index, success) {
    var cmd = this.commandQueue.get(index);
    if (cmd) {
        cmd.executed = true;
    }
    this.render();
};

CommandEditor.prototype.resetDisplay = function() {
    this.commandQueue.reset();
    this.render();
};

CommandEditor.prototype._showMessage = function(message, type) {
    var statusEl = document.getElementById('game-status');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.style.color = type === 'success' ? '#48bb78' : '#f56565';
        
        setTimeout(function() {
            statusEl.style.color = '#4a5568';
        }, 3000);
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CommandEditor;
}
