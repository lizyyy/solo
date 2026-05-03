// 游戏主模块
var Game = (function() {
    'use strict';
    
    // 游戏状态变量
    var isRunning = false;
    var animationFrameId = null;
    var lastTime = 0;
    var deltaTime = 0;
    
    // 游戏数据
    var currentLevelId = 1;
    var timeRemaining = 0;
    var startTime = 0;
    var lastUpdateTime = 0;
    
    // 暴露给外部的变量
    var publicVars = {
        currentLevelId: 1,
        timeRemaining: 0
    };
    
    // 游戏循环
    function gameLoop(timestamp) {
        if (!isRunning) return;
        
        // 计算时间差
        deltaTime = timestamp - lastTime;
        lastTime = timestamp;
        
        // 更新游戏状态
        update(deltaTime);
        
        // 渲染游戏
        render();
        
        // 请求下一帧
        animationFrameId = requestAnimationFrame(gameLoop);
    }
    
    // 更新游戏逻辑
    function update(deltaTime) {
        if (!State.isPlaying()) return;
        
        var currentTime = Date.now();
        var inputState = Input.getState();
        
        // 更新时间
        if (lastUpdateTime > 0) {
            var timeDiff = (currentTime - lastUpdateTime) / 1000;
            timeRemaining -= timeDiff;
            
            // 检查时间是否结束
            if (timeRemaining <= 0) {
                timeRemaining = 0;
                endGame();
                return;
            }
        }
        lastUpdateTime = currentTime;
        
        // 更新玩家
        Player.update(inputState, deltaTime);
        
        // 更新事件系统
        EventSystem.update(currentTime, deltaTime);
        
        // 处理互动按键
        if (Input.isJustPressed('interact')) {
            handleInteraction();
        }
        
        // 处理暂停
        if (Input.isJustPressed('pause')) {
            togglePause();
        }
        
        // 更新HUD
        Render.updateHUD(timeRemaining, Scoring.getScore(), currentLevelId);
    }
    
    // 渲染
    function render() {
        if (!State.isPlaying() && !State.isPaused()) return;
        
        Render.renderGame();
    }
    
    // 处理玩家互动
    function handleInteraction() {
        var playerPos = Player.getPosition();
        var activeEvents = EventSystem.getActiveEvents();
        var nearestEvent = Player.getNearestEventInRange(activeEvents);
        
        if (nearestEvent) {
            // 处理事件
            var result = EventSystem.handleEvent(nearestEvent.id);
            if (result) {
                Scoring.handleEvent(result.event);
                Render.addEventLog('已处理: ' + result.event.type.name + ' (+' + result.score + '分)', 'success');
            }
        } else {
            // 检查是否有可互动的物体但没有事件（误报）
            var interactables = Player.getInteractableEntities();
            var hasInteractable = interactables.exhibits.length > 0 || interactables.lights.length > 0;
            
            if (hasInteractable) {
                // 触发误报
                var penalty = Scoring.recordFalseAlarm();
                Render.addEventLog('误报! 扣分: ' + penalty, 'error');
            } else {
                // 没有互动对象
                Render.addEventLog('附近没有可互动的物体', 'warning');
            }
        }
    }
    
    // 切换暂停状态
    function togglePause() {
        if (State.isPlaying()) {
            State.pause();
            Render.showScreen('pause-screen');
        } else if (State.isPaused()) {
            State.resume();
            Render.showScreen(''); // 隐藏所有覆盖屏幕
        }
    }
    
    // 结束游戏
    function endGame() {
        isRunning = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        
        // 计算时间奖励
        if (timeRemaining > 0) {
            var timeBonus = Scoring.calculateTimeBonus(timeRemaining);
            Render.addEventLog('时间奖励: +' + timeBonus + '分', 'success');
        }
        
        // 评估表现
        var result = Scoring.evaluatePerformance(currentLevelId, timeRemaining);
        var scoringStats = Scoring.getStats();
        var eventStats = EventSystem.getStats();
        
        // 保存高分
        if (result.pass && scoringStats.score > 0) {
            Storage.saveHighScore(scoringStats.score, currentLevelId, timeRemaining);
            
            // 解锁下一关
            var nextLevel = Level.getNextLevel(currentLevelId);
            if (nextLevel) {
                Storage.saveUnlockedLevel(nextLevel.id);
            }
        }
        
        // 显示结算界面
        State.goToResult();
        Render.updateResultScreen(result, scoringStats, eventStats);
        Render.showScreen('result-screen');
    }
    
    // 绑定UI事件
    function bindUIEvents() {
        // 开始按钮
        var startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', function() {
                // 显示关卡选择
                State.goToLevelSelect();
                Render.updateLevelSelect();
                Render.showScreen('level-select-screen');
            });
        }
        
        // 帮助/最高分按钮
        var helpBtn = document.getElementById('help-btn');
        if (helpBtn) {
            helpBtn.addEventListener('click', function() {
                // 显示结算界面的高分榜
                var highScores = Storage.getHighScores();
                var mockResult = { pass: true, message: '最高分记录', remainingTime: 0 };
                var mockStats = { score: 0, eventsHandled: 0, falseAlarms: 0 };
                
                State.goToResult();
                Render.updateResultScreen(mockResult, mockStats, {});
                Render.showScreen('result-screen');
            });
        }
        
        // 继续游戏按钮
        var resumeBtn = document.getElementById('resume-btn');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', function() {
                if (State.isPaused()) {
                    State.resume();
                    Render.showScreen('');
                }
            });
        }
        
        // 退出游戏按钮
        var quitBtn = document.getElementById('quit-btn');
        if (quitBtn) {
            quitBtn.addEventListener('click', function() {
                Game.stop();
                State.goToMenu();
                Render.showScreen('start-screen');
            });
        }
        
        // 返回按钮
        var backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', function() {
                State.goToMenu();
                Render.showScreen('start-screen');
            });
        }
        
        // 重新开始按钮
        var restartBtn = document.getElementById('restart-btn');
        if (restartBtn) {
            restartBtn.addEventListener('click', function() {
                Game.startLevel(currentLevelId);
            });
        }
        
        // 返回主菜单按钮
        var mainMenuBtn = document.getElementById('main-menu-btn');
        if (mainMenuBtn) {
            mainMenuBtn.addEventListener('click', function() {
                Game.stop();
                State.goToMenu();
                Render.showScreen('start-screen');
            });
        }
    }
    
    // 公开API
    return {
        // 初始化游戏
        init: function() {
            // 获取Canvas
            var canvas = document.getElementById('game-canvas');
            if (!canvas) {
                console.error('找不到游戏Canvas元素');
                return false;
            }
            
            // 初始化各模块
            Render.init(canvas);
            Input.init();
            
            // 绑定UI事件
            bindUIEvents();
            
            // 重置状态
            this.reset();
            
            console.log('游戏初始化完成');
            return true;
        },
        
        // 开始指定关卡
        startLevel: function(levelId) {
            levelId = levelId || 1;
            currentLevelId = levelId;
            publicVars.currentLevelId = levelId;
            
            // 停止当前游戏
            this.stop();
            
            // 设置关卡
            if (!Level.setCurrentLevel(levelId)) {
                console.error('无法加载关卡: ' + levelId);
                return false;
            }
            
            var currentLevel = Level.getCurrentLevel();
            var mapData = currentLevel.mapData;
            
            // 初始化地图
            GameMap.init(mapData);
            
            // 初始化玩家位置（地图中心）
            var mapSize = GameMap.getSize();
            Player.init(mapSize.width / 2, mapSize.height / 2);
            
            // 初始化事件系统
            EventSystem.init(levelId);
            
            // 初始化评分系统
            Scoring.init();
            
            // 设置时间
            timeRemaining = Level.getActualTime(levelId);
            publicVars.timeRemaining = timeRemaining;
            startTime = Date.now();
            lastUpdateTime = 0;
            
            // 重置渲染日志
            Render.addEventLog('关卡 ' + levelId + ' 开始！', 'info');
            Render.addEventLog('时间限制: ' + Utils.formatTime(timeRemaining), 'info');
            
            // 开始游戏循环
            State.startPlaying();
            Render.showScreen(''); // 隐藏所有菜单屏幕
            isRunning = true;
            lastTime = performance.now();
            animationFrameId = requestAnimationFrame(gameLoop);
            
            console.log('关卡 ' + levelId + ' 开始');
            return true;
        },
        
        // 停止游戏
        stop: function() {
            isRunning = false;
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            lastUpdateTime = 0;
        },
        
        // 暂停游戏
        pause: function() {
            if (State.isPlaying()) {
                State.pause();
                Render.showScreen('pause-screen');
            }
        },
        
        // 恢复游戏
        resume: function() {
            if (State.isPaused()) {
                State.resume();
                Render.showScreen('');
            }
        },
        
        // 重置游戏
        reset: function() {
            this.stop();
            
            // 重置所有模块
            State.reset();
            Level.reset();
            GameMap.reset();
            Player.reset();
            EventSystem.reset();
            Scoring.reset();
            Render.reset();
            
            currentLevelId = 1;
            timeRemaining = 0;
            publicVars.currentLevelId = 1;
            publicVars.timeRemaining = 0;
            
            // 显示开始屏幕
            Render.showScreen('start-screen');
        },
        
        // 获取游戏状态
        getState: function() {
            return {
                isRunning: isRunning,
                currentState: State.getCurrentState(),
                currentLevelId: currentLevelId,
                timeRemaining: timeRemaining,
                score: Scoring.getScore()
            };
        },
        
        // 暴露的公共变量
        currentLevelId: currentLevelId,
        timeRemaining: timeRemaining
    };
})();

// 页面加载完成后初始化游戏
window.addEventListener('load', function() {
    console.log('页面加载完成，正在初始化游戏...');
    
    // 检查所有必要的模块是否已加载
    var requiredModules = ['Utils', 'Config', 'Storage', 'Level', 'GameMap', 'Player', 'Input', 'EventSystem', 'Scoring', 'Render', 'State'];
    var allLoaded = true;
    
    requiredModules.forEach(function(moduleName) {
        if (typeof window[moduleName] === 'undefined') {
            console.error('模块未加载: ' + moduleName);
            allLoaded = false;
        }
    });
    
    if (allLoaded) {
        // 初始化游戏
        Game.init();
    } else {
        console.error('部分模块未能加载，游戏无法启动');
    }
});
