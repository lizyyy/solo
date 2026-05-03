/**
 * 事件发射器
 * 实现发布-订阅模式
 */

class EventEmitter {
    constructor() {
        this.events = {};
    }
    
    /**
     * 订阅事件
     * @param {string} event - 事件名称
     * @param {Function} listener - 监听函数
     */
    on(event, listener) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
        
        return () => this.off(event, listener);
    }
    
    /**
     * 取消订阅
     * @param {string} event - 事件名称
     * @param {Function} listener - 监听函数
     */
    off(event, listener) {
        if (!this.events[event]) return;
        
        this.events[event] = this.events[event].filter(
            existingListener => existingListener !== listener
        );
    }
    
    /**
     * 单次订阅
     * @param {string} event - 事件名称
     * @param {Function} listener - 监听函数
     */
    once(event, listener) {
        const wrapper = (...args) => {
            listener(...args);
            this.off(event, wrapper);
        };
        return this.on(event, wrapper);
    }
    
    /**
     * 触发事件
     * @param {string} event - 事件名称
     * @param {*} args - 传递给监听函数的参数
     */
    emit(event, ...args) {
        if (!this.events[event]) return;
        
        this.events[event].forEach(listener => {
            try {
                listener(...args);
            } catch (error) {
                console.error(`Event listener error for "${event}":`, error);
            }
        });
    }
    
    /**
     * 移除所有事件监听器
     * @param {string} [event] - 可选，指定事件名称则只移除该事件的监听器
     */
    removeAllListeners(event) {
        if (event) {
            delete this.events[event];
        } else {
            this.events = {};
        }
    }
    
    /**
     * 获取指定事件的监听器数量
     * @param {string} event - 事件名称
     */
    listenerCount(event) {
        return this.events[event] ? this.events[event].length : 0;
    }
}

// 全局事件总线
const eventBus = new EventEmitter();
