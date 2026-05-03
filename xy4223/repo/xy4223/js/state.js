// 状态管理模块
var State = (function() {
    'use strict';
    
    // 游戏状态枚举
    var STATES = {
        MENU: 'menu',
        PLAYING: 'playing',
        PAUSED: 'paused',
        LEVEL_SELECT: 'level_select',
        RESULT: 'result'
    };
    
    var currentState = STATES.MENU;
    var previousState = null;
    
    // 状态监听器
    var listeners = {};
    
    function notifyStateChange(oldState, newState) {
        // 通知全局监听器
        if (listeners['*']) {
            listeners['*'].forEach(function(callback) {
                callback(oldState, newState);
            });
        }
        
        // 通知特定状态的监听器
        if (listeners[newState]) {
            listeners[newState].forEach(function(callback) {
                callback(oldState, newState);
            });
        }
    }
    
    return {
        // 获取所有状态
        STATES: STATES,
        
        // 获取当前状态
        getCurrentState: function() {
            return currentState;
        },
        
        // 获取前一个状态
        getPreviousState: function() {
            return previousState;
        },
        
        // 设置新状态
        setState: function(newState) {
            if (currentState === newState) return false;
            
            previousState = currentState;
            var oldState = currentState;
            currentState = newState;
            
            // 通知状态变化
            notifyStateChange(oldState, newState);
            
            return true;
        },
        
        // 检查当前状态
        is: function(state) {
            return currentState === state;
        },
        
        // 添加状态变化监听器
        addListener: function(state, callback) {
            if (!listeners[state]) {
                listeners[state] = [];
            }
            listeners[state].push(callback);
        },
        
        // 移除状态变化监听器
        removeListener: function(state, callback) {
            if (!listeners[state]) return;
            
            var index = listeners[state].indexOf(callback);
            if (index !== -1) {
                listeners[state].splice(index, 1);
            }
        },
        
        // 移除所有监听器
        removeAllListeners: function() {
            listeners = {};
        },
        
        // 切换到菜单状态
        goToMenu: function() {
            return this.setState(STATES.MENU);
        },
        
        // 切换到游戏中状态
        startPlaying: function() {
            return this.setState(STATES.PLAYING);
        },
        
        // 切换到暂停状态
        pause: function() {
            if (currentState === STATES.PLAYING) {
                return this.setState(STATES.PAUSED);
            }
            return false;
        },
        
        // 从暂停状态恢复
        resume: function() {
            if (currentState === STATES.PAUSED) {
                return this.setState(STATES.PLAYING);
            }
            return false;
        },
        
        // 切换到关卡选择状态
        goToLevelSelect: function() {
            return this.setState(STATES.LEVEL_SELECT);
        },
        
        // 切换到结算状态
        goToResult: function() {
            return this.setState(STATES.RESULT);
        },
        
        // 检查是否在游戏中
        isPlaying: function() {
            return currentState === STATES.PLAYING;
        },
        
        // 检查是否暂停
        isPaused: function() {
            return currentState === STATES.PAUSED;
        },
        
        // 检查是否在菜单
        isInMenu: function() {
            return currentState === STATES.MENU;
        },
        
        // 重置状态
        reset: function() {
            currentState = STATES.MENU;
            previousState = null;
        }
    };
})();
