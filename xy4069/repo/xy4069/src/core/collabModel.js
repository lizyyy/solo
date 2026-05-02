export class CRDTTextModel {
  constructor() {
    this.document = '';
    this.cursors = new Map();
    this.operations = [];
    this.undoStack = new Map();
    this.conflicts = [];
    this.versionVector = new Map();
    this.userStates = new Map();
  }

  getDocument() {
    return this.document;
  }

  getCursors() {
    return Object.fromEntries(this.cursors);
  }

  getConflicts() {
    return [...this.conflicts];
  }

  getOperations() {
    return [...this.operations];
  }

  getUserStates() {
    return Object.fromEntries(this.userStates);
  }

  applyOperation(operation) {
    const result = {
      success: false,
      operation,
      documentBefore: this.document,
      documentAfter: this.document,
      conflicts: [],
      stateChanges: {}
    };

    const userId = operation.userId;
    this._ensureUserState(userId);

    try {
      switch (operation.type) {
        case 'INSERT':
          this._handleInsert(operation, result);
          break;
        case 'DELETE':
          this._handleDelete(operation, result);
          break;
        case 'CURSOR_MOVE':
          this._handleCursorMove(operation, result);
          break;
        case 'UNDO':
          this._handleUndo(operation, result);
          break;
        case 'REDO':
          this._handleRedo(operation, result);
          break;
        case 'RECONNECT':
          this._handleReconnect(operation, result);
          break;
        case 'MERGE':
          this._handleMerge(operation, result);
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      this._updateVersionVector(operation);
      this.operations.push({
        ...operation,
        appliedAt: new Date().toISOString(),
        documentAfter: this.document
      });

      result.success = true;
      result.documentAfter = this.document;
    } catch (error) {
      this.conflicts.push({
        type: 'APPLY_ERROR',
        operation,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      result.conflicts.push({
        type: 'APPLY_ERROR',
        message: error.message
      });
    }

    return result;
  }

  _ensureUserState(userId) {
    if (!this.userStates.has(userId)) {
      this.userStates.set(userId, {
        cursor: 0,
        isOnline: true,
        lastVersion: 0,
        undoStack: [],
        redoStack: []
      });
    }
    if (!this.undoStack.has(userId)) {
      this.undoStack.set(userId, []);
    }
    if (!this.cursors.has(userId)) {
      this.cursors.set(userId, 0);
    }
  }

  _handleInsert(operation, result) {
    const { position, text } = operation.payload;
    const userId = operation.userId;
    const userState = this.userStates.get(userId);

    if (position < 0 || position > this.document.length) {
      const conflict = {
        type: 'INSERT_POSITION_OUT_OF_BOUNDS',
        message: `插入位置 ${position} 超出文档范围 (长度: ${this.document.length})`,
        operation,
        timestamp: new Date().toISOString()
      };
      this.conflicts.push(conflict);
      result.conflicts.push({
        type: conflict.type,
        message: conflict.message
      });
      return;
    }

    this._saveForUndo(userId, 'INSERT', {
      position,
      length: text.length,
      cursorBefore: userState.cursor
    });

    this.document = this.document.slice(0, position) + text + this.document.slice(position);

    userState.cursor = position + text.length;
    this.cursors.set(userId, userState.cursor);

    result.stateChanges = {
      cursor: userState.cursor,
      textInserted: text
    };
  }

  _handleDelete(operation, result) {
    const { position, length, direction } = operation.payload;
    const userId = operation.userId;
    const userState = this.userStates.get(userId);

    let deletePos = position;
    let deleteLen = length;

    if (direction === 'backward') {
      deletePos = position - length;
    }

    if (deletePos < 0 || deletePos + deleteLen > this.document.length) {
      const conflict = {
        type: 'DELETE_POSITION_OUT_OF_BOUNDS',
        message: `删除位置 ${deletePos} 长度 ${deleteLen} 超出文档范围 (长度: ${this.document.length})`,
        operation,
        timestamp: new Date().toISOString()
      };
      this.conflicts.push(conflict);
      result.conflicts.push({
        type: conflict.type,
        message: conflict.message
      });
      return;
    }

    const deletedText = this.document.slice(deletePos, deletePos + deleteLen);

    this._saveForUndo(userId, 'DELETE', {
      position: deletePos,
      deletedText,
      cursorBefore: userState.cursor
    });

    this.document = this.document.slice(0, deletePos) + this.document.slice(deletePos + deleteLen);

    userState.cursor = deletePos;
    this.cursors.set(userId, userState.cursor);

    result.stateChanges = {
      cursor: userState.cursor,
      deletedText
    };
  }

  _handleCursorMove(operation, result) {
    const { position, selectionStart, selectionEnd } = operation.payload;
    const userId = operation.userId;
    const userState = this.userStates.get(userId);

    if (position < 0 || position > this.document.length) {
      const conflict = {
        type: 'CURSOR_POSITION_OUT_OF_BOUNDS',
        message: `光标位置 ${position} 超出文档范围 (长度: ${this.document.length})`,
        operation,
        timestamp: new Date().toISOString()
      };
      this.conflicts.push(conflict);
      result.conflicts.push({
        type: conflict.type,
        message: conflict.message
      });
      return;
    }

    const oldPosition = userState.cursor;
    userState.cursor = position;
    userState.selectionStart = selectionStart;
    userState.selectionEnd = selectionEnd;
    this.cursors.set(userId, position);

    result.stateChanges = {
      oldCursor: oldPosition,
      newCursor: position
    };
  }

  _handleUndo(operation, result) {
    const userId = operation.userId;
    const userState = this.userStates.get(userId);
    const userUndoStack = this.undoStack.get(userId) || [];

    if (userUndoStack.length === 0) {
      result.conflicts.push({
        type: 'UNDO_STACK_EMPTY',
        message: '撤销栈为空'
      });
      return;
    }

    const undoItem = userUndoStack.pop();
    userState.redoStack = userState.redoStack || [];
    userState.redoStack.push(undoItem);

    if (undoItem.type === 'INSERT') {
      const { position, length, cursorBefore } = undoItem.data;
      const deletedText = this.document.slice(position, position + length);
      this.document = this.document.slice(0, position) + this.document.slice(position + length);
      userState.cursor = cursorBefore;
      this.cursors.set(userId, cursorBefore);
      
      result.stateChanges = {
        action: 'undo_insert',
        deletedText,
        cursor: cursorBefore
      };
    } else if (undoItem.type === 'DELETE') {
      const { position, deletedText, cursorBefore } = undoItem.data;
      this.document = this.document.slice(0, position) + deletedText + this.document.slice(position);
      userState.cursor = cursorBefore;
      this.cursors.set(userId, cursorBefore);
      
      result.stateChanges = {
        action: 'undo_delete',
        restoredText: deletedText,
        cursor: cursorBefore
      };
    }
  }

  _handleRedo(operation, result) {
    const userId = operation.userId;
    const userState = this.userStates.get(userId);
    const redoStack = userState.redoStack || [];

    if (redoStack.length === 0) {
      result.conflicts.push({
        type: 'REDO_STACK_EMPTY',
        message: '重做栈为空'
      });
      return;
    }

    const redoItem = redoStack.pop();
    const userUndoStack = this.undoStack.get(userId) || [];
    userUndoStack.push(redoItem);

    if (redoItem.type === 'INSERT') {
      const { position, length } = redoItem.data;
      const text = redoItem.data.deletedText || '';
      this.document = this.document.slice(0, position) + text + this.document.slice(position);
      userState.cursor = position + text.length;
      this.cursors.set(userId, userState.cursor);
      
      result.stateChanges = {
        action: 'redo_insert',
        cursor: userState.cursor
      };
    } else if (redoItem.type === 'DELETE') {
      const { position, deletedText } = redoItem.data;
      const length = deletedText.length;
      this.document = this.document.slice(0, position) + this.document.slice(position + length);
      userState.cursor = position;
      this.cursors.set(userId, position);
      
      result.stateChanges = {
        action: 'redo_delete',
        cursor: position
      };
    }
  }

  _handleReconnect(operation, result) {
    const userId = operation.userId;
    const userState = this.userStates.get(userId);
    const { lastKnownVersion, pendingOperations } = operation.payload;

    userState.isOnline = true;
    userState.lastKnownVersion = lastKnownVersion;

    const currentVersion = this.versionVector.get(userId) || 0;
    if (lastKnownVersion < currentVersion) {
      const conflict = {
        type: 'VERSION_DIVERGENCE_ON_RECONNECT',
        message: `用户 ${userId} 重连时版本滞后: 本地 ${lastKnownVersion} < 服务器 ${currentVersion}`,
        operation,
        pendingOperationsCount: pendingOperations?.length || 0,
        timestamp: new Date().toISOString()
      };
      this.conflicts.push(conflict);
      result.conflicts.push({
        type: conflict.type,
        message: conflict.message
      });
    }

    result.stateChanges = {
      isOnline: true,
      lastKnownVersion
    };
  }

  _handleMerge(operation, result) {
    const { remoteOperations, baseVersion } = operation.payload;
    const userId = operation.userId;

    if (!Array.isArray(remoteOperations)) {
      result.conflicts.push({
        type: 'INVALID_MERGE_PAYLOAD',
        message: '合并操作的远程操作必须是数组'
      });
      return;
    }

    for (const remoteOp of remoteOperations) {
      const applyResult = this.applyOperation({
        ...remoteOp,
        userId: userId,
        isMerge: true
      });
      
      if (!applyResult.success || applyResult.conflicts.length > 0) {
        this.conflicts.push({
          type: 'MERGE_CONFLICT',
          message: `合并操作产生冲突: ${remoteOp.operationId}`,
          operation: remoteOp,
          applyResult,
          timestamp: new Date().toISOString()
        });
        result.conflicts.push({
          type: 'MERGE_CONFLICT',
          operationId: remoteOp.operationId
        });
      }
    }

    result.stateChanges = {
      mergedOperationsCount: remoteOperations.length,
      baseVersion
    };
  }

  _saveForUndo(userId, type, data) {
    const userUndoStack = this.undoStack.get(userId) || [];
    userUndoStack.push({
      type,
      data,
      timestamp: new Date().toISOString()
    });
    this.undoStack.set(userId, userUndoStack);
  }

  _updateVersionVector(operation) {
    const userId = operation.userId;
    const version = operation.version;
    const current = this.versionVector.get(userId) || 0;
    this.versionVector.set(userId, Math.max(current, version));
  }

  reset() {
    this.document = '';
    this.cursors.clear();
    this.operations = [];
    this.undoStack.clear();
    this.conflicts = [];
    this.versionVector.clear();
    this.userStates.clear();
  }

  getState() {
    return {
      document: this.document,
      cursors: Object.fromEntries(this.cursors),
      operations: [...this.operations],
      conflicts: [...this.conflicts],
      versionVector: Object.fromEntries(this.versionVector),
      userStates: Object.fromEntries(this.userStates)
    };
  }
}
