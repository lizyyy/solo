// 渲染系统模块
var Render = (function() {
    'use strict';
    
    var canvas = null;
    var ctx = null;
    var eventLogEntries = [];
    
    return {
        // 初始化渲染系统
        init: function(canvasElement) {
            canvas = canvasElement;
            ctx = canvas.getContext('2d');
            eventLogEntries = [];
            
            // 设置字体
            ctx.font = '16px ' + Config.UI.FONT_FAMILY;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
        },
        
        // 清空画布
        clear: function() {
            if (!ctx) return;
            
            ctx.fillStyle = '#2a2a4a';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        },
        
        // 渲染游戏场景
        renderGame: function() {
            this.clear();
            
            // 渲染地图
            GameMap.render(ctx);
            
            // 渲染事件
            EventSystem.render(ctx);
            
            // 渲染玩家
            Player.render(ctx);
            
            // 渲染UI提示
            this.renderInteractionHint();
        },
        
        // 渲染互动提示
        renderInteractionHint: function() {
            var playerPos = Player.getPosition();
            var activeEvents = EventSystem.getActiveEvents();
            var nearestEvent = Player.getNearestEventInRange(activeEvents);
            
            if (nearestEvent) {
                // 绘制提示文字
                ctx.fillStyle = '#ffffff';
                ctx.font = '14px ' + Config.UI.FONT_FAMILY;
                ctx.textAlign = 'center';
                
                var hintX = nearestEvent.x;
                var hintY = nearestEvent.y - 45;
                
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                var text = '按空格键处理: ' + nearestEvent.type.name;
                var textWidth = ctx.measureText(text).width;
                
                ctx.fillRect(hintX - textWidth/2 - 10, hintY - 12, textWidth + 20, 24);
                
                ctx.fillStyle = '#ffffff';
                ctx.fillText(text, hintX, hintY);
            }
        },
        
        // 更新HUD显示
        updateHUD: function(timeRemaining, score, levelId) {
            var timerEl = document.getElementById('timer');
            var scoreEl = document.getElementById('score');
            var levelEl = document.getElementById('level-info');
            
            if (timerEl) {
                var timeText = '时间: ' + Utils.formatTime(timeRemaining);
                timerEl.textContent = timeText;
                
                // 时间低于1分钟时变红
                if (timeRemaining < 60) {
                    timerEl.style.color = '#ff6b6b';
                } else {
                    timerEl.style.color = '#ff6b6b';
                }
            }
            
            if (scoreEl) {
                scoreEl.textContent = '分数: ' + score;
            }
            
            if (levelEl) {
                var level = Level.getLevelById(levelId);
                levelEl.textContent = '关卡: ' + (level ? level.name : levelId);
            }
        },
        
        // 添加事件日志
        addEventLog: function(message, type) {
            type = type || 'info';
            
            var entry = {
                message: message,
                type: type,
                timestamp: Date.now()
            };
            
            eventLogEntries.unshift(entry);
            
            // 限制日志条目数量
            if (eventLogEntries.length > Config.UI.EVENT_LOG_MAX_ENTRIES) {
                eventLogEntries.pop();
            }
            
            this.updateEventLogUI();
        },
        
        // 更新事件日志UI
        updateEventLogUI: function() {
            var logContainer = document.getElementById('event-log');
            if (!logContainer) return;
            
            logContainer.innerHTML = '';
            
            eventLogEntries.forEach(function(entry) {
                var div = document.createElement('div');
                div.className = 'log-entry';
                
                // 根据类型设置颜色
                var color = '#ffffff';
                if (entry.type === 'success') color = '#00b894';
                else if (entry.type === 'error') color = '#ff6b6b';
                else if (entry.type === 'warning') color = '#fdcb6e';
                
                div.style.color = color;
                div.textContent = entry.message;
                logContainer.appendChild(div);
            });
        },
        
        // 显示/隐藏特定屏幕
        showScreen: function(screenId) {
            // 隐藏所有屏幕
            var screens = document.querySelectorAll('.screen');
            screens.forEach(function(screen) {
                screen.classList.remove('active');
            });
            
            // 显示指定屏幕
            var targetScreen = document.getElementById(screenId);
            if (targetScreen) {
                targetScreen.classList.add('active');
            }
        },
        
        // 更新关卡选择界面
        updateLevelSelect: function() {
            var container = document.getElementById('level-buttons');
            if (!container) return;
            
            container.innerHTML = '';
            
            var levels = Level.getAllLevels();
            var unlockedLevels = Storage.getUnlockedLevels();
            
            levels.forEach(function(level) {
                var isUnlocked = unlockedLevels.indexOf(level.id) !== -1;
                
                var button = document.createElement('button');
                button.className = 'btn ui-element';
                button.style.display = 'block';
                button.style.margin = '10px auto';
                button.style.minWidth = '250px';
                
                if (isUnlocked) {
                    button.textContent = level.id + '. ' + level.name + ' (' + level.difficulty + ')';
                    button.onclick = function() {
                        Game.startLevel(level.id);
                    };
                } else {
                    button.textContent = '🔒 ' + level.name + ' (未解锁)';
                    button.disabled = true;
                    button.style.opacity = '0.5';
                    button.style.cursor = 'not-allowed';
                }
                
                container.appendChild(button);
            });
        },
        
        // 更新结算界面
        updateResultScreen: function(result, scoringStats, eventStats) {
            var messageEl = document.getElementById('result-message');
            var finalScoreEl = document.getElementById('final-score');
            var levelCompletedEl = document.getElementById('level-completed');
            var timeRemainingEl = document.getElementById('time-remaining');
            var eventsHandledEl = document.getElementById('events-handled');
            var falseAlarmsEl = document.getElementById('false-alarms');
            var scoresListEl = document.getElementById('scores-list');
            
            // 更新结果消息
            if (messageEl) {
                messageEl.textContent = result.message;
                messageEl.className = result.pass ? 'success' : 'error';
            }
            
            // 更新统计数据
            if (finalScoreEl) {
                finalScoreEl.textContent = scoringStats.score;
            }
            
            if (levelCompletedEl) {
                levelCompletedEl.textContent = Game.currentLevelId || 1;
            }
            
            if (timeRemainingEl) {
                timeRemainingEl.textContent = Utils.formatTime(result.remainingTime || 0);
            }
            
            if (eventsHandledEl) {
                eventsHandledEl.textContent = scoringStats.eventsHandled;
            }
            
            if (falseAlarmsEl) {
                falseAlarmsEl.textContent = scoringStats.falseAlarms;
            }
            
            // 更新高分榜
            if (scoresListEl) {
                scoresListEl.innerHTML = '';
                var highScores = Storage.getHighScores();
                
                if (highScores.length === 0) {
                    scoresListEl.innerHTML = '<p style="color: #888;">暂无记录</p>';
                } else {
                    highScores.forEach(function(score, index) {
                        var item = document.createElement('div');
                        item.className = 'score-item';
                        
                        var rankText = (index + 1) + '. ';
                        var scoreText = score.score + '分';
                        var levelText = '关卡' + score.level;
                        
                        item.innerHTML = '<span>' + rankText + levelText + '</span><span>' + scoreText + '</span>';
                        scoresListEl.appendChild(item);
                    });
                }
            }
        },
        
        // 重置渲染系统
        reset: function() {
            eventLogEntries = [];
            if (ctx && canvas) {
                this.clear();
            }
        }
    };
})();
