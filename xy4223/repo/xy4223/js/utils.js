// 工具函数模块
var Utils = (function() {
    'use strict';
    
    return {
        // 随机整数 [min, max]
        randomInt: function(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        },
        
        // 随机浮点数 [min, max)
        randomFloat: function(min, max) {
            return Math.random() * (max - min) + min;
        },
        
        // 从数组中随机选择一个元素
        randomChoice: function(arr) {
            return arr[Math.floor(Math.random() * arr.length)];
        },
        
        // 限制值在 [min, max] 范围内
        clamp: function(value, min, max) {
            return Math.max(min, Math.min(max, value));
        },
        
        // 计算两点之间的距离
        distance: function(x1, y1, x2, y2) {
            return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
        },
        
        // 检查两个矩形是否碰撞
        rectCollision: function(x1, y1, w1, h1, x2, y2, w2, h2) {
            return x1 < x2 + w2 &&
                   x1 + w1 > x2 &&
                   y1 < y2 + h2 &&
                   y1 + h1 > y2;
        },
        
        // 格式化时间 (秒 -> 分:秒)
        formatTime: function(seconds) {
            var mins = Math.floor(seconds / 60);
            var secs = Math.floor(seconds % 60);
            return (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
        },
        
        // 生成唯一ID
        generateId: function() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        },
        
        // 数组去重
        unique: function(arr) {
            return arr.filter(function(item, index, self) {
                return self.indexOf(item) === index;
            });
        },
        
        // 深拷贝 (简单对象)
        deepClone: function(obj) {
            if (obj === null || typeof obj !== 'object') return obj;
            var clone = Array.isArray(obj) ? [] : {};
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clone[key] = this.deepClone(obj[key]);
                }
            }
            return clone;
        },
        
        // 防抖函数
        debounce: function(func, wait) {
            var timeout;
            return function() {
                var context = this;
                var args = arguments;
                clearTimeout(timeout);
                timeout = setTimeout(function() {
                    func.apply(context, args);
                }, wait);
            };
        },
        
        // 节流函数
        throttle: function(func, limit) {
            var inThrottle;
            return function() {
                var context = this;
                var args = arguments;
                if (!inThrottle) {
                    func.apply(context, args);
                    inThrottle = true;
                    setTimeout(function() {
                        inThrottle = false;
                    }, limit);
                }
            };
        },
        
        // 检查值是否在范围内
        inRange: function(value, min, max) {
            return value >= min && value <= max;
        },
        
        // 线性插值
        lerp: function(start, end, t) {
            return start + (end - start) * t;
        }
    };
})();
