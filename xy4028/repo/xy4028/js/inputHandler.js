/**
 * 输入防抖和处理模块
 * 处理键盘和鼠标输入，防止连发和重复触发
 */

import coachConfig from './coachConfig.js';

class InputHandler {
  constructor() {
    this.debounceTimeMs = 150;
    this.lastInputTime = 0;
    this.isKeyPressed = false;
    this.listeners = [];
    this.enabled = false;
    this.bindEvents();
  }

  bindEvents() {
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    document.addEventListener('click', (e) => this.handleClick(e));
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
    window.addEventListener('blur', () => this.handleBlur());
    window.addEventListener('focus', () => this.handleFocus());
  }

  handleKeyDown(e) {
    if (!this.enabled) return;
    if (e.code !== 'Space') return;
    
    e.preventDefault();
    
    if (this.isKeyPressed) {
      return;
    }
    
    this.isKeyPressed = true;
    
    const now = performance.now();
    if (now - this.lastInputTime < this.debounceTimeMs) {
      return;
    }
    
    this.lastInputTime = now;
    this.notifyListeners('press', { source: 'keyboard', time: now });
  }

  handleKeyUp(e) {
    if (e.code === 'Space') {
      this.isKeyPressed = false;
    }
  }

  handleClick(e) {
    if (!this.enabled) return;
    if (!coachConfig.get('enableMouseClick')) return;
    
    if (e.target.closest('button') || 
        e.target.closest('input') || 
        e.target.closest('select') ||
        e.target.closest('a')) {
      return;
    }
    
    const now = performance.now();
    if (now - this.lastInputTime < this.debounceTimeMs) {
      return;
    }
    
    this.lastInputTime = now;
    this.notifyListeners('press', { source: 'mouse', time: now });
  }

  handleVisibilityChange() {
    if (document.hidden) {
      this.notifyListeners('blur', {});
    } else {
      this.notifyListeners('focus', {});
    }
  }

  handleBlur() {
    this.notifyListeners('blur', {});
  }

  handleFocus() {
    this.notifyListeners('focus', {});
  }

  enable() {
    this.enabled = true;
    this.isKeyPressed = false;
  }

  disable() {
    this.enabled = false;
    this.isKeyPressed = false;
  }

  setDebounceTime(ms) {
    if (ms < 50 || ms > 500) {
      throw new Error('防抖时间应在50-500毫秒之间');
    }
    this.debounceTimeMs = ms;
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners(type, data) {
    this.listeners.forEach(l => l({ type, ...data }));
  }
}

export default new InputHandler();
