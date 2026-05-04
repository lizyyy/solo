/**
 * 工具函数模块
 */

// 随机数生成
function random(min, max) {
    return Math.random() * (max - min) + min;
}

// 随机整数生成
function randomInt(min, max) {
    return Math.floor(random(min, max + 1));
}

// 距离计算
function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// 角度计算
function angle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}

// 角度转弧度
function degToRad(degrees) {
    return degrees * Math.PI / 180;
}

// 弧度转角度
function radToDeg(radians) {
    return radians * 180 / Math.PI;
}

// 格式化时间
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 深拷贝
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// 数组去重
function unique(arr) {
    return [...new Set(arr)];
}

// 简单的事件发射器
class EventEmitter {
    constructor() {
        this.events = {};
    }
    
    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
    }
    
    off(event, listener) {
        if (!this.events[event]) return;
        const index = this.events[event].indexOf(listener);
        if (index > -1) {
            this.events[event].splice(index, 1);
        }
    }
    
    emit(event, ...args) {
        if (!this.events[event]) return;
        this.events[event].forEach(listener => {
            listener(...args);
        });
    }
}

// 简单的状态机
class StateMachine {
    constructor(initialState) {
        this.currentState = initialState;
        this.transitions = {};
    }
    
    addTransition(fromState, toState, action) {
        if (!this.transitions[fromState]) {
            this.transitions[fromState] = [];
        }
        this.transitions[fromState].push({ toState, action });
    }
    
    transition(action) {
        const transitions = this.transitions[this.currentState];
        if (!transitions) return false;
        
        const transition = transitions.find(t => t.action === action);
        if (!transition) return false;
        
        this.currentState = transition.toState;
        return true;
    }
    
    getState() {
        return this.currentState;
    }
}

// 导出模块
window.utils = {
    random,
    randomInt,
    distance,
    angle,
    degToRad,
    radToDeg,
    formatTime,
    deepClone,
    unique,
    EventEmitter,
    StateMachine
};