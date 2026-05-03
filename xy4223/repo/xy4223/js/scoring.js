// 评分系统模块
var Scoring = (function() {
    'use strict';
    
    var score = 0;
    var falseAlarms = 0;
    var eventsHandled = 0;
    var eventsMissed = 0;
    var perfectHandles = 0;
    
    return {
        // 初始化评分系统
        init: function() {
            score = 0;
            falseAlarms = 0;
            eventsHandled = 0;
            eventsMissed = 0;
            perfectHandles = 0;
        },
        
        // 增加分数
        addScore: function(points) {
            score += points;
            return score;
        },
        
        // 扣除分数
        deductScore: function(points) {
            score -= Math.abs(points);
            return score;
        },
        
        // 处理事件得分
        handleEvent: function(event) {
            var baseScore = event.type.score;
            
            // 检查是否是完美处理（快速反应）
            var elapsed = event.handleTime - event.startTime;
            var halfDuration = event.duration / 2;
            var isPerfect = elapsed < halfDuration;
            
            if (isPerfect) {
                baseScore += Config.SCORING.PERFECT_HANDLING_BONUS;
                perfectHandles++;
            }
            
            score += baseScore;
            eventsHandled++;
            
            return {
                score: baseScore,
                isPerfect: isPerfect
            };
        },
        
        // 误报扣分
        recordFalseAlarm: function() {
            var penalty = Config.SCORING.FALSE_ALARM_PENALTY;
            score += penalty;
            falseAlarms++;
            
            return penalty;
        },
        
        // 错过事件扣分
        recordMissedEvent: function() {
            var penalty = Config.SCORING.MISSED_EVENT_PENALTY;
            score += penalty;
            eventsMissed++;
            
            return penalty;
        },
        
        // 计算时间奖励
        calculateTimeBonus: function(remainingSeconds) {
            var bonus = Math.floor(remainingSeconds * Config.SCORING.TIME_BONUS);
            score += bonus;
            return bonus;
        },
        
        // 获取当前分数
        getScore: function() {
            return score;
        },
        
        // 获取误报次数
        getFalseAlarms: function() {
            return falseAlarms;
        },
        
        // 获取已处理事件数
        getEventsHandled: function() {
            return eventsHandled;
        },
        
        // 获取错过事件数
        getEventsMissed: function() {
            return eventsMissed;
        },
        
        // 获取完美处理次数
        getPerfectHandles: function() {
            return perfectHandles;
        },
        
        // 获取评分统计
        getStats: function() {
            return {
                score: score,
                falseAlarms: falseAlarms,
                eventsHandled: eventsHandled,
                eventsMissed: eventsMissed,
                perfectHandles: perfectHandles
            };
        },
        
        // 评估游戏表现
        evaluatePerformance: function(levelId, remainingTime) {
            var level = Level.getLevelById(levelId);
            if (!level) {
                return {
                    pass: false,
                    message: '关卡数据错误'
                };
            }
            
            var passScore = score >= level.required_score;
            var passEvents = eventsHandled >= level.required_events;
            var pass = passScore && passEvents;
            
            var message = '';
            if (pass) {
                if (score >= level.required_score * 2) {
                    message = '优秀！你是一位出色的志愿者！';
                } else if (score >= level.required_score * 1.5) {
                    message = '良好！继续保持！';
                } else {
                    message = '合格！你完成了基本任务。';
                }
            } else {
                var issues = [];
                if (!passScore) {
                    issues.push('分数不足（需要 ' + level.required_score + ' 分）');
                }
                if (!passEvents) {
                    issues.push('处理事件数不足（需要 ' + level.required_events + ' 个）');
                }
                if (falseAlarms > 2) {
                    issues.push('误报次数过多');
                }
                message = '未通过: ' + issues.join('；');
            }
            
            return {
                pass: pass,
                message: message,
                score: score,
                requiredScore: level.required_score,
                eventsHandled: eventsHandled,
                requiredEvents: level.required_events,
                remainingTime: remainingTime
            };
        },
        
        // 重置评分系统
        reset: function() {
            this.init();
        }
    };
})();
