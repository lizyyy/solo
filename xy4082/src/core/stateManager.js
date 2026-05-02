/**
 * 状态管理模块
 * 负责多方案管理、撤销重做、历史记录
 */

import { Session } from './dataModels.js';

// 操作类型
export const ActionType = {
  ADD_HOLD: 'add_hold',
  REMOVE_HOLD: 'remove_hold',
  UPDATE_HOLD: 'update_hold',
  
  ADD_ROUTE: 'add_route',
  REMOVE_ROUTE: 'remove_route',
  UPDATE_ROUTE: 'update_route',
  
  UPDATE_WALL: 'update_wall',
  UPDATE_SESSION: 'update_session'
};

/**
 * 历史记录项
 */
class HistoryEntry {
  constructor(actionType, data, label = '') {
    this.actionType = actionType;
    this.data = data;  // { before, after }
    this.label = label;
    this.timestamp = Date.now();
  }
}

/**
 * 状态管理器
 * 支持撤销/重做，多方案切换
 */
export class StateManager {
  constructor(options = {}) {
    this.maxHistorySize = options.maxHistorySize || 50;
    
    // 当前状态
    this._session = null;
    this._selectedRouteId = null;
    this._selectedHoldId = null;
    
    // 历史记录
    this._undoStack = [];
    this._redoStack = [];
    
    // 多方案
    this._savedSessions = new Map();  // id -> { session, name, savedAt }
    
    // 事件回调
    this._listeners = new Map();
    
    // 批量操作模式
    this._batchMode = false;
    this._batchActions = [];
  }

  // ========== 事件系统 ==========
  
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this._listeners.has(event)) return;
    const callbacks = this._listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index >= 0) {
      callbacks.splice(index, 1);
    }
  }

  _emit(event, data) {
    if (!this._listeners.has(event)) return;
    this._listeners.get(event).forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error('StateManager event error:', e);
      }
    });
  }

  // ========== 批量操作 ==========
  
  startBatch(label = '批量操作') {
    this._batchMode = true;
    this._batchActions = [];
    this._batchLabel = label;
  }

  commitBatch() {
    if (!this._batchMode) return;
    
    if (this._batchActions.length > 0) {
      const compositeEntry = new HistoryEntry(
        'composite',
        { actions: [...this._batchActions] },
        this._batchLabel
      );
      this._addToUndoStack(compositeEntry);
    }
    
    this._batchMode = false;
    this._batchActions = [];
    this._batchLabel = '';
  }

  cancelBatch() {
    this._batchMode = false;
    this._batchActions = [];
    this._batchLabel = '';
  }

  _recordAction(actionType, data, label) {
    if (this._batchMode) {
      this._batchActions.push({ actionType, data, label });
    } else {
      const entry = new HistoryEntry(actionType, data, label);
      this._addToUndoStack(entry);
    }
  }

  _addToUndoStack(entry) {
    this._undoStack.push(entry);
    
    // 限制历史记录大小
    if (this._undoStack.length > this.maxHistorySize) {
      this._undoStack.shift();
    }
    
    // 清空 redo 栈
    this._redoStack = [];
    
    this._emit('historyChanged', {
      canUndo: this.canUndo,
      canRedo: this.canRedo
    });
  }

  // ========== 撤销/重做 ==========
  
  get canUndo() {
    return this._undoStack.length > 0;
  }

  get canRedo() {
    return this._redoStack.length > 0;
  }

  undo() {
    if (!this.canUndo) return false;
    
    const entry = this._undoStack.pop();
    this._redoStack.push(entry);
    
    this._applyUndo(entry);
    
    this._emit('historyChanged', {
      canUndo: this.canUndo,
      canRedo: this.canRedo
    });
    this._emit('sessionChanged', this._session);
    
    return true;
  }

  redo() {
    if (!this.canRedo) return false;
    
    const entry = this._redoStack.pop();
    this._undoStack.push(entry);
    
    this._applyRedo(entry);
    
    this._emit('historyChanged', {
      canUndo: this.canUndo,
      canRedo: this.canRedo
    });
    this._emit('sessionChanged', this._session);
    
    return true;
  }

  _applyUndo(entry) {
    if (entry.actionType === 'composite') {
      // 反向执行批量操作的撤销
      const actions = entry.data.actions;
      for (let i = actions.length - 1; i >= 0; i--) {
        this._applySingleUndo(actions[i]);
      }
    } else {
      this._applySingleUndo(entry);
    }
  }

  _applyRedo(entry) {
    if (entry.actionType === 'composite') {
      entry.data.actions.forEach(action => {
        this._applySingleRedo(action);
      });
    } else {
      this._applySingleRedo(entry);
    }
  }

  _applySingleUndo({ actionType, data }) {
    const wall = this._session?.wall;
    if (!wall) return;
    
    switch (actionType) {
      case ActionType.ADD_HOLD:
        // 撤销添加 = 删除
        if (data.after) {
          wall.removeHold(data.after.id);
        }
        break;
        
      case ActionType.REMOVE_HOLD:
        // 撤销删除 = 重新添加
        if (data.before) {
          wall.addHold(data.before);
        }
        break;
        
      case ActionType.UPDATE_HOLD:
        // 恢复之前的状态
        if (data.before) {
          const index = wall.holds.findIndex(h => h.id === data.before.id);
          if (index >= 0) {
            wall.holds[index] = data.before;
          }
        }
        break;
        
      case ActionType.ADD_ROUTE:
        if (data.after) {
          this._session.removeRoute(data.after.id);
        }
        break;
        
      case ActionType.REMOVE_ROUTE:
        if (data.before) {
          this._session.addRoute(data.before);
        }
        break;
        
      case ActionType.UPDATE_ROUTE:
        if (data.before) {
          const index = this._session.routes.findIndex(r => r.id === data.before.id);
          if (index >= 0) {
            this._session.routes[index] = data.before;
          }
        }
        break;
        
      case ActionType.UPDATE_WALL:
        if (data.before) {
          this._session.wall = data.before;
        }
        break;
        
      case ActionType.UPDATE_SESSION:
        if (data.before) {
          this._session = data.before;
        }
        break;
    }
  }

  _applySingleRedo({ actionType, data }) {
    const wall = this._session?.wall;
    if (!wall) return;
    
    switch (actionType) {
      case ActionType.ADD_HOLD:
        if (data.after) {
          wall.addHold(data.after);
        }
        break;
        
      case ActionType.REMOVE_HOLD:
        if (data.before) {
          wall.removeHold(data.before.id);
        }
        break;
        
      case ActionType.UPDATE_HOLD:
        if (data.after) {
          const index = wall.holds.findIndex(h => h.id === data.after.id);
          if (index >= 0) {
            wall.holds[index] = data.after;
          }
        }
        break;
        
      case ActionType.ADD_ROUTE:
        if (data.after) {
          this._session.addRoute(data.after);
        }
        break;
        
      case ActionType.REMOVE_ROUTE:
        if (data.before) {
          this._session.removeRoute(data.before.id);
        }
        break;
        
      case ActionType.UPDATE_ROUTE:
        if (data.after) {
          const index = this._session.routes.findIndex(r => r.id === data.after.id);
          if (index >= 0) {
            this._session.routes[index] = data.after;
          }
        }
        break;
        
      case ActionType.UPDATE_WALL:
        if (data.after) {
          this._session.wall = data.after;
        }
        break;
        
      case ActionType.UPDATE_SESSION:
        if (data.after) {
          this._session = data.after;
        }
        break;
    }
  }

  // ========== Session 管理 ==========
  
  get session() {
    return this._session;
  }

  setSession(session, recordHistory = true) {
    const before = this._session ? this._session.clone() : null;
    this._session = session;
    
    if (recordHistory && before) {
      this._recordAction(
        ActionType.UPDATE_SESSION,
        { before, after: session.clone() },
        '加载会话'
      );
    }
    
    // 清空历史（加载新会话后不应该撤销回之前的会话）
    if (!recordHistory) {
      this._undoStack = [];
      this._redoStack = [];
    }
    
    this._emit('sessionChanged', this._session);
    this._emit('historyChanged', {
      canUndo: this.canUndo,
      canRedo: this.canRedo
    });
  }

  createNewSession(name = '新方案') {
    const session = new Session({ name });
    this.setSession(session, false);
    return session;
  }

  // ========== 岩点操作 ==========
  
  addHold(hold) {
    if (!this._session?.wall) return null;
    
    const wall = this._session.wall;
    const holdClone = hold.clone();
    
    wall.addHold(holdClone);
    this._session.updateTimestamp();
    
    this._recordAction(
      ActionType.ADD_HOLD,
      { before: null, after: holdClone.clone() },
      `添加岩点`
    );
    
    this._emit('sessionChanged', this._session);
    return holdClone;
  }

  removeHold(holdId) {
    if (!this._session?.wall) return false;
    
    const wall = this._session.wall;
    const hold = wall.holds.find(h => h.id === holdId);
    
    if (!hold) return false;
    
    const holdClone = hold.clone();
    wall.removeHold(holdId);
    
    // 同时从所有线路中移除该岩点
    this._session.routes.forEach(route => {
      route.removeHold(holdId);
    });
    
    this._session.updateTimestamp();
    
    this._recordAction(
      ActionType.REMOVE_HOLD,
      { before: holdClone, after: null },
      `删除岩点`
    );
    
    this._emit('sessionChanged', this._session);
    return true;
  }

  updateHold(holdId, updates) {
    if (!this._session?.wall) return null;
    
    const wall = this._session.wall;
    const hold = wall.holds.find(h => h.id === holdId);
    
    if (!hold) return null;
    
    const before = hold.clone();
    
    // 应用更新
    Object.keys(updates).forEach(key => {
      if (key === 'x' || key === 'y' || key === 'z') {
        hold.position[key] = updates[key];
      } else if (hold.hasOwnProperty(key)) {
        hold[key] = updates[key];
      }
    });
    
    const after = hold.clone();
    this._session.updateTimestamp();
    
    this._recordAction(
      ActionType.UPDATE_HOLD,
      { before, after },
      `更新岩点`
    );
    
    this._emit('sessionChanged', this._session);
    return hold;
  }

  // ========== 线路操作 ==========
  
  addRoute(route) {
    if (!this._session) return null;
    
    const routeClone = route.clone();
    this._session.addRoute(routeClone);
    
    this._recordAction(
      ActionType.ADD_ROUTE,
      { before: null, after: routeClone.clone() },
      `添加线路: ${route.name}`
    );
    
    this._emit('sessionChanged', this._session);
    return routeClone;
  }

  removeRoute(routeId) {
    if (!this._session) return false;
    
    const route = this._session.routes.find(r => r.id === routeId);
    if (!route) return false;
    
    const routeClone = route.clone();
    this._session.removeRoute(routeId);
    
    // 如果删除的是当前选中的线路，清除选择
    if (this._selectedRouteId === routeId) {
      this._selectedRouteId = null;
    }
    
    this._recordAction(
      ActionType.REMOVE_ROUTE,
      { before: routeClone, after: null },
      `删除线路: ${route.name}`
    );
    
    this._emit('sessionChanged', this._session);
    return true;
  }

  updateRoute(routeId, updates) {
    if (!this._session) return null;
    
    const route = this._session.routes.find(r => r.id === routeId);
    if (!route) return null;
    
    const before = route.clone();
    
    // 应用更新
    Object.keys(updates).forEach(key => {
      if (route.hasOwnProperty(key)) {
        route[key] = updates[key];
      }
    });
    
    const after = route.clone();
    this._session.updateTimestamp();
    
    this._recordAction(
      ActionType.UPDATE_ROUTE,
      { before, after },
      `更新线路: ${route.name}`
    );
    
    this._emit('sessionChanged', this._session);
    return route;
  }

  // 快捷操作：给线路添加岩点
  addHoldToRoute(routeId, holdId) {
    const route = this._session?.routes.find(r => r.id === routeId);
    if (!route) return false;
    
    if (route.holdIds.includes(holdId)) return false;
    
    const before = route.clone();
    route.addHold(holdId);
    const after = route.clone();
    
    this._session.updateTimestamp();
    
    this._recordAction(
      ActionType.UPDATE_ROUTE,
      { before, after },
      `给线路添加岩点`
    );
    
    this._emit('sessionChanged', this._session);
    return true;
  }

  // 快捷操作：从线路移除岩点
  removeHoldFromRoute(routeId, holdId) {
    const route = this._session?.routes.find(r => r.id === routeId);
    if (!route) return false;
    
    if (!route.holdIds.includes(holdId)) return false;
    
    const before = route.clone();
    route.removeHold(holdId);
    const after = route.clone();
    
    this._session.updateTimestamp();
    
    this._recordAction(
      ActionType.UPDATE_ROUTE,
      { before, after },
      `从线路移除岩点`
    );
    
    this._emit('sessionChanged', this._session);
    return true;
  }

  // ========== 选择状态 ==========
  
  get selectedRouteId() {
    return this._selectedRouteId;
  }

  set selectedRouteId(id) {
    this._selectedRouteId = id;
    this._emit('selectionChanged', {
      routeId: id,
      holdId: this._selectedHoldId
    });
  }

  get selectedHoldId() {
    return this._selectedHoldId;
  }

  set selectedHoldId(id) {
    this._selectedHoldId = id;
    this._emit('selectionChanged', {
      routeId: this._selectedRouteId,
      holdId: id
    });
  }

  // ========== 多方案管理 ==========
  
  saveCurrentSession(name) {
    if (!this._session) return null;
    
    const saved = {
      id: this._session.id,
      session: this._session.clone(),
      name: name || this._session.name,
      savedAt: new Date().toISOString()
    };
    
    this._savedSessions.set(saved.id, saved);
    this._emit('sessionsChanged', this.getSavedSessions());
    
    return saved;
  }

  loadSession(sessionId) {
    const saved = this._savedSessions.get(sessionId);
    if (!saved) return false;
    
    this.setSession(saved.session.clone(), false);
    return true;
  }

  deleteSavedSession(sessionId) {
    if (!this._savedSessions.has(sessionId)) return false;
    
    this._savedSessions.delete(sessionId);
    this._emit('sessionsChanged', this.getSavedSessions());
    return true;
  }

  getSavedSessions() {
    return Array.from(this._savedSessions.values()).sort((a, b) => 
      new Date(b.savedAt) - new Date(a.savedAt)
    );
  }

  // ========== 历史记录快照 ==========
  
  getHistoryInfo() {
    return {
      undoCount: this._undoStack.length,
      redoCount: this._redoStack.length,
      canUndo: this.canUndo,
      canRedo: this.canRedo,
      lastAction: this._undoStack.length > 0 
        ? this._undoStack[this._undoStack.length - 1].label 
        : null
    };
  }

  // ========== 本地存储 ==========
  
  saveToLocalStorage(key = 'bouldering_planner') {
    try {
      const data = {
        session: this._session ? this._session.toJSON() : null,
        selectedRouteId: this._selectedRouteId,
        selectedHoldId: this._selectedHoldId,
        savedSessions: this.getSavedSessions().map(s => ({
          id: s.id,
          session: s.session.toJSON(),
          name: s.name,
          savedAt: s.savedAt
        }))
      };
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('保存到本地存储失败:', e);
      return false;
    }
  }

  loadFromLocalStorage(key = 'bouldering_planner') {
    try {
      const dataStr = localStorage.getItem(key);
      if (!dataStr) return false;
      
      const data = JSON.parse(dataStr);
      
      // 恢复已保存的方案
      if (data.savedSessions) {
        data.savedSessions.forEach(s => {
          this._savedSessions.set(s.id, {
            id: s.id,
            session: Session.fromJSON(s.session),
            name: s.name,
            savedAt: s.savedAt
          });
        });
      }
      
      // 恢复当前会话
      if (data.session) {
        const session = Session.fromJSON(data.session);
        this.setSession(session, false);
      }
      
      // 恢复选择
      this._selectedRouteId = data.selectedRouteId || null;
      this._selectedHoldId = data.selectedHoldId || null;
      
      return true;
    } catch (e) {
      console.error('从本地存储加载失败:', e);
      return false;
    }
  }
}

// 导出单例
export const stateManager = new StateManager();
