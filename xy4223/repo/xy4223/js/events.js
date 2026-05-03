// 事件系统模块
var EventSystem = (function() {
    'use strict';
    
    var activeEvents = [];
    var eventHistory = [];
    var lastSpawnTime = 0;
    var currentLevelId = 1;
    
    // 获取所有事件类型
    function getAllEventTypes() {
        return Config.EVENT_TYPES;
    }
    
    // 获取随机事件类型
    function getRandomEventType() {
        var types = getAllEventTypes();
        var typeKeys = Object.keys(types);
        var randomKey = Utils.randomChoice(typeKeys);
        return types[randomKey];
    }
    
    // 创建新事件
    function createEvent(eventType, x, y) {
        return {
            id: Utils.generateId(),
            type: eventType,
            x: x,
            y: y,
            startTime: Date.now(),
            duration: eventType.duration * 1000,
            isActive: true,
            isHandled: false
        };
    }
    
    // 检查是否可以生成新事件
    function canSpawnEvent() {
        var maxEvents = Level.getMaxEvents(currentLevelId);
        return activeEvents.length < maxEvents;
    }
    
    // 获取当前事件位置，用于避免重复生成
    function getActiveEventPositions() {
        return activeEvents.map(function(event) {
            return { x: event.x, y: event.y };
        });
    }
    
    return {
        // 初始化事件系统
        init: function(levelId) {
            activeEvents = [];
            eventHistory = [];
            lastSpawnTime = 0;
            currentLevelId = levelId || 1;
        },
        
        // 更新事件系统
        update: function(currentTime, deltaTime) {
            // 检查超时事件
            for (var i = activeEvents.length - 1; i >= 0; i--) {
                var event = activeEvents[i];
                var elapsed = currentTime - event.startTime;
                
                if (elapsed >= event.duration && event.isActive) {
                    // 事件超时，移到历史记录
                    event.isActive = false;
                    event.timeout = true;
                    eventHistory.push(event);
                    activeEvents.splice(i, 1);
                    
                    // 触发超时惩罚
                    this.onEventTimeout(event);
                }
            }
            
            // 尝试生成新事件
            var spawnInterval = Level.getSpawnInterval(currentLevelId) * 1000;
            if (currentTime - lastSpawnTime >= spawnInterval && canSpawnEvent()) {
                this.spawnEvent();
                lastSpawnTime = currentTime;
            }
        },
        
        // 生成新事件
        spawnEvent: function() {
            if (!canSpawnEvent()) return null;
            
            var eventType = getRandomEventType();
            var excludePoints = getActiveEventPositions();
            var spawnPoint = GameMap.getRandomSpawnPoint(excludePoints);
            
            if (!spawnPoint) return null;
            
            var newEvent = createEvent(eventType, spawnPoint.x, spawnPoint.y);
            activeEvents.push(newEvent);
            
            // 记录到日志
            this.addEventLog('新事件: ' + eventType.name + ' 已出现');
            
            return newEvent;
        },
        
        // 处理事件
        handleEvent: function(eventId) {
            for (var i = 0; i < activeEvents.length; i++) {
                var event = activeEvents[i];
                if (event.id === eventId && event.isActive) {
                    event.isHandled = true;
                    event.isActive = false;
                    event.handleTime = Date.now();
                    
                    // 移到历史记录
                    eventHistory.push(event);
                    activeEvents.splice(i, 1);
                    
                    // 计算得分
                    var score = this.calculateEventScore(event);
                    
                    // 记录到日志
                    this.addEventLog('已处理: ' + event.type.name + ' (+' + score + '分)');
                    
                    return {
                        event: event,
                        score: score
                    };
                }
            }
            return null;
        },
        
        // 触发误报
        triggerFalseAlarm: function() {
            var penalty = Config.SCORING.FALSE_ALARM_PENALTY;
            this.addEventLog('误报! 扣分: ' + penalty);
            return penalty;
        },
        
        // 事件超时处理
        onEventTimeout: function(event) {
            var penalty = Config.SCORING.MISSED_EVENT_PENALTY;
            this.addEventLog('事件超时: ' + event.type.name + ' (' + penalty + '分)');
            return penalty;
        },
        
        // 计算事件得分
        calculateEventScore: function(event) {
            var baseScore = event.type.score;
            
            // 检查是否快速处理（在事件持续时间的前一半时间内处理）
            var elapsed = event.handleTime - event.startTime;
            var halfDuration = event.duration / 2;
            
            if (elapsed < halfDuration) {
                baseScore += Config.SCORING.PERFECT_HANDLING_BONUS;
            }
            
            return baseScore;
        },
        
        // 获取活动事件
        getActiveEvents: function() {
            return Utils.deepClone(activeEvents);
        },
        
        // 获取历史事件
        getEventHistory: function() {
            return Utils.deepClone(eventHistory);
        },
        
        // 获取指定位置附近的事件
        getEventsNear: function(x, y, range) {
            range = range || Player.getInteractionRange();
            
            return activeEvents.filter(function(event) {
                var dist = Utils.distance(x, y, event.x, event.y);
                return dist <= range;
            });
        },
        
        // 获取最近的事件
        getNearestEvent: function(x, y) {
            if (activeEvents.length === 0) return null;
            
            var nearest = null;
            var minDist = Infinity;
            
            for (var i = 0; i < activeEvents.length; i++) {
                var event = activeEvents[i];
                var dist = Utils.distance(x, y, event.x, event.y);
                
                if (dist < minDist) {
                    minDist = dist;
                    nearest = event;
                }
            }
            
            return nearest;
        },
        
        // 添加事件日志
        addEventLog: function(message) {
            // 这里可以触发UI更新事件
            // 实际的日志显示由渲染模块处理
            console.log('[事件系统] ' + message);
        },
        
        // 获取处理的事件统计
        getStats: function() {
            var handledEvents = eventHistory.filter(function(e) {
                return e.isHandled;
            });
            
            var timeoutEvents = eventHistory.filter(function(e) {
                return e.timeout;
            });
            
            var stats = {
                totalEvents: eventHistory.length + activeEvents.length,
                activeEvents: activeEvents.length,
                handledEvents: handledEvents.length,
                timeoutEvents: timeoutEvents.length,
                eventsByType: {}
            };
            
            // 按类型统计
            var allEvents = eventHistory.concat(activeEvents);
            allEvents.forEach(function(event) {
                var typeId = event.type.id;
                if (!stats.eventsByType[typeId]) {
                    stats.eventsByType[typeId] = {
                        total: 0,
                        handled: 0,
                        timeout: 0
                    };
                }
                stats.eventsByType[typeId].total++;
                if (event.isHandled) stats.eventsByType[typeId].handled++;
                if (event.timeout) stats.eventsByType[typeId].timeout++;
            });
            
            return stats;
        },
        
        // 渲染事件
        render: function(ctx) {
            var currentTime = Date.now();
            
            activeEvents.forEach(function(event) {
                var elapsed = currentTime - event.startTime;
                var remaining = event.duration - elapsed;
                var progress = elapsed / event.duration;
                
                // 绘制事件背景圆
                ctx.fillStyle = event.type.color + '40';
                ctx.beginPath();
                ctx.arc(event.x, event.y, 25, 0, Math.PI * 2);
                ctx.fill();
                
                // 绘制事件进度环
                ctx.strokeStyle = event.type.color;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(event.x, event.y, 25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - progress));
                ctx.stroke();
                
                // 绘制事件图标
                ctx.fillStyle = event.type.color;
                ctx.beginPath();
                ctx.arc(event.x, event.y, 15, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                // 绘制事件类型文字缩写
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px ' + Config.UI.FONT_FAMILY;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                var iconText = event.type.icon || event.type.name.charAt(0);
                ctx.fillText(iconText, event.x, event.y);
                
                // 如果时间少于5秒，添加闪烁效果
                if (remaining < 5000) {
                    var flash = Math.sin(currentTime / 100) > 0;
                    if (flash) {
                        ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                        ctx.beginPath();
                        ctx.arc(event.x, event.y, 28, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            });
        },
        
        // 重置事件系统
        reset: function() {
            activeEvents = [];
            eventHistory = [];
            lastSpawnTime = 0;
        }
    };
})();
