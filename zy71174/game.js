const CraneGame = (function() {
    const CONFIG = {
        CRANE_MAX_LOAD: 10000,
        CRANE_SAFE_LOAD_RATIO: 0.9,
        MAX_WIND_SPEED: 12,
        WARNING_WIND_SPEED: 8,
        ROUNDS_PER_LEVEL: 10,
        TICK_INTERVAL: 50,
        CANVAS_WIDTH: 900,
        CANVAS_HEIGHT: 500
    };

    const COMMANDS = {
        lift_up: { name: '起吊', icon: '⬆️' },
        swing_left: { name: '左回转', icon: '↺' },
        swing_right: { name: '右回转', icon: '↻' },
        trolley_in: { name: '小车收', icon: '📥' },
        trolley_out: { name: '小车放', icon: '📤' },
        lower: { name: '下落', icon: '⬇️' },
        stop: { name: '停止', icon: '⏹️' },
        emergency_stop: { name: '紧急停止', icon: '🚨' }
    };

    let gameState = {
        status: 'idle',
        level: 1,
        round: 1,
        score: 0,
        crane: {
            x: 450,
            y: 350,
            armAngle: 0,
            trolleyPosition: 0.5,
            hookHeight: 0.8,
            rotationSpeed: 0,
            trolleySpeed: 0,
            liftSpeed: 0,
            isMoving: false
        },
        load: {
            weight: 0,
            x: 0,
            y: 0,
            isLifted: false,
            targetX: 0,
            targetY: 0
        },
        wind: {
            speed: 0,
            direction: 0,
            gusting: false
        },
        personnel: {
            workers: [],
            inDangerZone: false
        },
        dangerZone: {
            active: false,
            centerX: 0,
            centerY: 0,
            radius: 80
        },
        logs: [],
        history: [],
        replayIndex: 0,
        replayTimer: null,
        roundStartTime: 0,
        violations: [],
        safeOperations: 0
    };

    let canvas, ctx, replayCanvas, replayCtx;
    let gameTimer = null;
    let elements = {};

    function init() {
        canvas = document.getElementById('gameCanvas');
        ctx = canvas.getContext('2d');
        replayCanvas = document.getElementById('replayCanvas');
        replayCtx = replayCanvas.getContext('2d');

        cacheElements();
        bindEvents();
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        addLog('系统初始化完成', 'info');
    }

    function cacheElements() {
        elements = {
            level: document.getElementById('level'),
            round: document.getElementById('round'),
            score: document.getElementById('score'),
            gameStatus: document.getElementById('game-status'),
            loadWeight: document.getElementById('loadWeight'),
            windSpeed: document.getElementById('windSpeed'),
            personnelStatus: document.getElementById('personnelStatus'),
            craneLoad: document.getElementById('craneLoad'),
            loadBar: document.getElementById('loadBar'),
            windBar: document.getElementById('windBar'),
            logContainer: document.getElementById('logContainer'),
            gameOverlay: document.getElementById('gameOverlay'),
            overlayTitle: document.getElementById('overlayTitle'),
            overlayMessage: document.getElementById('overlayMessage'),
            startBtn: document.getElementById('startBtn'),
            tutorialBtn: document.getElementById('tutorialBtn'),
            pauseBtn: document.getElementById('pauseBtn'),
            restartBtn: document.getElementById('restartBtn'),
            replayBtn: document.getElementById('replayBtn'),
            exportBtn: document.getElementById('exportBtn'),
            tutorialModal: document.getElementById('tutorialModal'),
            replayModal: document.getElementById('replayModal'),
            reportModal: document.getElementById('reportModal'),
            playReplayBtn: document.getElementById('playReplayBtn'),
            pauseReplayBtn: document.getElementById('pauseReplayBtn'),
            resetReplayBtn: document.getElementById('resetReplayBtn'),
            replayProgress: document.getElementById('replayProgress'),
            replayLog: document.getElementById('replayLog'),
            reportContent: document.getElementById('reportContent'),
            downloadReportBtn: document.getElementById('downloadReportBtn'),
            printReportBtn: document.getElementById('printReportBtn')
        };
    }

    function bindEvents() {
        elements.startBtn.addEventListener('click', startGame);
        elements.tutorialBtn.addEventListener('click', () => showModal('tutorial'));
        elements.pauseBtn.addEventListener('click', togglePause);
        elements.restartBtn.addEventListener('click', restartGame);
        elements.replayBtn.addEventListener('click', showReplay);
        elements.exportBtn.addEventListener('click', showReport);

        document.querySelectorAll('.close').forEach(btn => {
            btn.addEventListener('click', () => {
                hideAllModals();
                stopReplay();
            });
        });

        document.querySelectorAll('.cmd-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cmd = btn.dataset.cmd;
                executeCommand(cmd);
            });
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const cmd = btn.dataset.cmd;
                executeCommand(cmd);
            }, { passive: false });
        });

        elements.playReplayBtn.addEventListener('click', playReplay);
        elements.pauseReplayBtn.addEventListener('click', pauseReplay);
        elements.resetReplayBtn.addEventListener('click', resetReplay);
        elements.downloadReportBtn.addEventListener('click', downloadReport);
        elements.printReportBtn.addEventListener('click', printReport);

        document.addEventListener('keydown', handleKeyboard);

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    hideAllModals();
                    stopReplay();
                }
            });
        });
    }

    function resizeCanvas() {
        const container = canvas.parentElement;
        const rect = container.getBoundingClientRect();
        const ratio = CONFIG.CANVAS_WIDTH / CONFIG.CANVAS_HEIGHT;
        let width = rect.width;
        let height = width / ratio;
        if (height > rect.height) {
            height = rect.height;
            width = height * ratio;
        }
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
    }

    function startGame() {
        resetGameState();
        gameState.status = 'playing';
        gameState.roundStartTime = Date.now();
        elements.gameOverlay.classList.add('hidden');
        updateUI();
        startRound();
        gameTimer = setInterval(gameTick, CONFIG.TICK_INTERVAL);
        addLog('游戏开始！第1关第1回合', 'success');
    }

    function resetGameState() {
        gameState = {
            status: 'idle',
            level: 1,
            round: 1,
            score: 0,
            crane: {
                x: 450,
                y: 350,
                armAngle: 0,
                trolleyPosition: 0.5,
                hookHeight: 0.8,
                rotationSpeed: 0,
                trolleySpeed: 0,
                liftSpeed: 0,
                isMoving: false
            },
            load: {
                weight: 0,
                x: 0,
                y: 0,
                isLifted: false,
                targetX: 0,
                targetY: 0
            },
            wind: {
                speed: 0,
                direction: 0,
                gusting: false
            },
            personnel: {
                workers: [],
                inDangerZone: false
            },
            dangerZone: {
                active: false,
                centerX: 0,
                centerY: 0,
                radius: 80
            },
            logs: [],
            history: [],
            replayIndex: 0,
            replayTimer: null,
            roundStartTime: 0,
            violations: [],
            safeOperations: 0
        };
        elements.logContainer.innerHTML = '';
    }

    function startRound() {
        const levelFactor = gameState.level;
        
        gameState.load.weight = Math.floor(3000 + Math.random() * 6000 * levelFactor);
        gameState.load.x = 280 + Math.random() * 120;
        gameState.load.y = 420;
        gameState.load.isLifted = false;
        gameState.load.targetX = 600 + Math.random() * 150;
        gameState.load.targetY = 420;

        gameState.wind.speed = Math.random() * 8 + gameState.level * 1.5;
        gameState.wind.direction = Math.random() * 360;
        gameState.wind.gusting = Math.random() > 0.7;

        gameState.personnel.workers = [];
        const workerCount = Math.floor(Math.random() * 3) + gameState.level - 1;
        for (let i = 0; i < workerCount; i++) {
            gameState.personnel.workers.push({
                x: Math.random() * CONFIG.CANVAS_WIDTH,
                y: 400 + Math.random() * 50,
                vx: (Math.random() - 0.5) * 2,
                dangerous: Math.random() > 0.5
            });
        }

        gameState.dangerZone.active = true;
        gameState.dangerZone.centerX = gameState.load.x;
        gameState.dangerZone.centerY = 400;

        gameState.crane.armAngle = -45;
        gameState.crane.trolleyPosition = 0.5;
        gameState.crane.hookHeight = 0.95;
        gameState.crane.rotationSpeed = 0;
        gameState.crane.trolleySpeed = 0;
        gameState.crane.liftSpeed = 0;
        gameState.crane.isMoving = false;

        gameState.roundStartTime = Date.now();
        saveHistory();
        addLog(`第${gameState.level}关第${gameState.round}回合开始 - 吊重: ${gameState.load.weight}kg, 风速: ${gameState.wind.speed.toFixed(1)}m/s`, 'info');
    }

    function gameTick() {
        if (gameState.status !== 'playing') return;

        updateCrane();
        updateLoad();
        updatePersonnel();
        updateWind();
        checkRisks();
        checkRoundComplete();
        updateUI();
        render();
        saveHistory();
    }

    function updateCrane() {
        const crane = gameState.crane;
        
        if (crane.rotationSpeed !== 0) {
            crane.armAngle += crane.rotationSpeed;
            crane.armAngle = Math.max(-90, Math.min(90, crane.armAngle));
        }

        if (crane.trolleySpeed !== 0) {
            crane.trolleyPosition += crane.trolleySpeed;
            crane.trolleyPosition = Math.max(0.1, Math.min(1, crane.trolleyPosition));
        }

        if (crane.liftSpeed !== 0) {
            crane.hookHeight += crane.liftSpeed;
            crane.hookHeight = Math.max(0.1, Math.min(1, crane.hookHeight));
        }

        crane.isMoving = crane.rotationSpeed !== 0 || crane.trolleySpeed !== 0 || crane.liftSpeed !== 0;
    }

    function updateLoad() {
        const crane = gameState.crane;
        const load = gameState.load;

        const armRad = (crane.armAngle * Math.PI) / 180;
        const trolleyDist = 250 * crane.trolleyPosition;
        const trolleyX = crane.x + Math.sin(armRad) * trolleyDist;
        const trolleyY = (crane.y - 100) + Math.cos(armRad) * trolleyDist;
        const cableLength = (1 - crane.hookHeight) * 200;
        const hookX = trolleyX;
        const hookY = trolleyY + cableLength;

        if (load.isLifted) {
            load.x = hookX;
            load.y = hookY + 30;

            if (gameState.wind.speed > CONFIG.WARNING_WIND_SPEED) {
                const windEffect = (gameState.wind.speed - CONFIG.WARNING_WIND_SPEED) * 0.5;
                const windRad = (gameState.wind.direction * Math.PI) / 180;
                load.x += Math.cos(windRad) * windEffect * Math.sin(Date.now() / 500);
            }
        } else if (crane.liftSpeed < 0) {
            const dist = Math.sqrt((hookX - load.x) ** 2 + (hookY - load.y) ** 2);
            if (dist < 60) {
                load.isLifted = true;
                gameState.dangerZone.centerX = load.x;
                addLog('吊物已挂接，开始起吊', 'info');
            }
        }
    }

    function updatePersonnel() {
        gameState.personnel.inDangerZone = false;

        gameState.personnel.workers.forEach(worker => {
            worker.x += worker.vx;
            
            if (worker.x < 50 || worker.x > CONFIG.CANVAS_WIDTH - 50) {
                worker.vx = -worker.vx;
            }

            if (worker.dangerous && Math.random() < 0.005) {
                worker.vx = (Math.random() - 0.5) * 3;
            }

            if (gameState.dangerZone.active) {
                const dist = Math.sqrt(
                    (worker.x - gameState.dangerZone.centerX) ** 2 +
                    (worker.y - gameState.dangerZone.centerY) ** 2
                );
                if (dist < gameState.dangerZone.radius) {
                    gameState.personnel.inDangerZone = true;
                }
            }
        });
    }

    function updateWind() {
        if (gameState.wind.gusting && Math.random() < 0.02) {
            gameState.wind.speed += (Math.random() - 0.3) * 2;
            gameState.wind.speed = Math.max(0, Math.min(CONFIG.MAX_WIND_SPEED + 5, gameState.wind.speed));
        }
    }

    function checkRisks() {
        const loadRatio = gameState.load.weight / CONFIG.CRANE_MAX_LOAD;
        const isOverloaded = loadRatio > CONFIG.CRANE_SAFE_LOAD_RATIO;
        const isWindOverLimit = gameState.wind.speed > CONFIG.MAX_WIND_SPEED;
        const isPersonInDanger = gameState.personnel.inDangerZone && gameState.load.isLifted;
        const isCraneMoving = gameState.crane.isMoving;

        if (isOverloaded && isCraneMoving && !hasViolation('overload')) {
            addViolation('overload', '超重吊装作业');
            addLog('⚠️ 警告：吊物重量超过安全负载！', 'warning');
            if (loadRatio > 1) {
                gameOver('塔吊超载倒塌事故');
            }
        }

        if (isWindOverLimit && isCraneMoving && !hasViolation('wind')) {
            addViolation('wind', '风速超限作业');
            addLog('🚨 危险：风速超过安全限值！', 'danger');
            if (gameState.wind.speed > CONFIG.MAX_WIND_SPEED + 3) {
                gameOver('强风导致吊物失控坠落');
            }
        }

        if (isPersonInDanger && !hasViolation('personnel')) {
            addViolation('personnel', '人员进入危险区域');
            addLog('🚨 紧急：人员进入吊装警戒区域！', 'danger');
            setTimeout(() => {
                if (gameState.personnel.inDangerZone && gameState.crane.isMoving) {
                    gameOver('人员被坠落物体击中');
                }
            }, 3000);
        }

        if (isPersonInDanger && gameState.crane.liftSpeed === 0) {
            gameState.safeOperations++;
            gameState.score += 50;
            addLog('✓ 正确：人员进入危险区域时停止作业', 'success');
        }
    }

    function hasViolation(type) {
        return gameState.violations.some(v => v.type === type && Date.now() - v.time < 5000);
    }

    function addViolation(type, desc) {
        gameState.violations.push({ type, desc, time: Date.now(), round: gameState.round });
        gameState.score = Math.max(0, gameState.score - 50);
    }

    function checkRoundComplete() {
        const load = gameState.load;
        if (!load.isLifted) return;

        const distToTarget = Math.sqrt(
            (load.x - load.targetX) ** 2 +
            (load.y - load.targetY) ** 2
        );

        if (distToTarget < 30 && load.y > 400 && gameState.crane.liftSpeed <= 0) {
            load.isLifted = false;
            const roundTime = (Date.now() - gameState.roundStartTime) / 1000;
            const timeBonus = Math.max(0, Math.floor(50 - roundTime * 2));
            const violationPenalty = gameState.violations.filter(v => v.round === gameState.round).length * 50;
            const roundScore = 100 + timeBonus - violationPenalty;

            gameState.score += Math.max(50, roundScore);
            gameState.safeOperations++;
            addLog(`✓ 回合完成！得分 +${Math.max(50, roundScore)}`, 'success');

            if (gameState.round >= CONFIG.ROUNDS_PER_LEVEL) {
                if (gameState.level >= 5) {
                    victory();
                } else {
                    gameState.level++;
                    gameState.round = 1;
                    addLog(`🎉 恭喜通过第${gameState.level - 1}关！进入第${gameState.level}关`, 'success');
                    startRound();
                }
            } else {
                gameState.round++;
                startRound();
            }
        }
    }

    function executeCommand(cmd) {
        if (gameState.status !== 'playing') return;

        const crane = gameState.crane;
        
        crane.rotationSpeed = 0;
        crane.trolleySpeed = 0;
        crane.liftSpeed = 0;

        switch (cmd) {
            case 'lift_up':
                crane.liftSpeed = 0.015;
                addLog('指挥：起升', 'info');
                break;
            case 'lower':
                crane.liftSpeed = -0.015;
                addLog('指挥：下落', 'info');
                break;
            case 'swing_left':
                crane.rotationSpeed = -1;
                addLog('指挥：左回转', 'info');
                break;
            case 'swing_right':
                crane.rotationSpeed = 1;
                addLog('指挥：右回转', 'info');
                break;
            case 'trolley_in':
                crane.trolleySpeed = -0.008;
                addLog('指挥：小车收', 'info');
                break;
            case 'trolley_out':
                crane.trolleySpeed = 0.008;
                addLog('指挥：小车放', 'info');
                break;
            case 'stop':
                addLog('指挥：停止', 'info');
                break;
            case 'emergency_stop':
                addLog('🚨 紧急停止！', 'danger');
                if (gameState.personnel.inDangerZone || gameState.wind.speed > CONFIG.MAX_WIND_SPEED) {
                    gameState.score += 50;
                    addLog('✓ 正确处置紧急情况 +50分', 'success');
                }
                break;
        }
    }

    function handleKeyboard(e) {
        if (gameState.status !== 'playing') return;

        const keyMap = {
            'w': 'lift_up', 'W': 'lift_up', 'ArrowUp': 'lift_up',
            's': 'lower', 'S': 'lower', 'ArrowDown': 'lower',
            'a': 'swing_left', 'A': 'swing_left', 'ArrowLeft': 'swing_left',
            'd': 'swing_right', 'D': 'swing_right', 'ArrowRight': 'swing_right',
            'q': 'trolley_in', 'Q': 'trolley_in',
            'e': 'trolley_out', 'E': 'trolley_out',
            ' ': 'stop',
            'Escape': 'emergency_stop'
        };

        if (keyMap[e.key]) {
            e.preventDefault();
            executeCommand(keyMap[e.key]);
        }

        if (e.key === 'p' || e.key === 'P') {
            togglePause();
        }
    }

    function togglePause() {
        if (gameState.status === 'playing') {
            gameState.status = 'paused';
            clearInterval(gameTimer);
            elements.gameStatus.textContent = '暂停';
            elements.pauseBtn.textContent = '继续';
            addLog('游戏暂停', 'info');
        } else if (gameState.status === 'paused') {
            gameState.status = 'playing';
            gameTimer = setInterval(gameTick, CONFIG.TICK_INTERVAL);
            elements.gameStatus.textContent = '运行中';
            elements.pauseBtn.textContent = '暂停';
            addLog('游戏继续', 'info');
        }
    }

    function restartGame() {
        if (gameTimer) clearInterval(gameTimer);
        resetGameState();
        elements.gameOverlay.classList.remove('hidden');
        elements.overlayTitle.textContent = '工地塔吊指挥模拟器';
        elements.overlayMessage.textContent = '作为塔吊信号司索工，你需要根据吊物重量、风速和现场人员情况，做出正确的吊装指挥决策。';
        elements.startBtn.textContent = '开始游戏';
        elements.gameStatus.textContent = '准备中';
        elements.pauseBtn.textContent = '暂停';
        render();
    }

    function gameOver(reason) {
        gameState.status = 'gameover';
        clearInterval(gameTimer);
        
        elements.gameOverlay.classList.remove('hidden');
        elements.overlayTitle.textContent = '💥 事故发生！';
        elements.overlayMessage.innerHTML = `
            <strong>事故原因：</strong>${reason}<br><br>
            <strong>最终得分：</strong>${gameState.score}<br>
            <strong>完成关卡：</strong>第${gameState.level}关第${gameState.round}回合<br>
            <strong>安全作业：</strong>${gameState.safeOperations}次<br>
            <strong>违规记录：</strong>${gameState.violations.length}次
        `;
        elements.startBtn.textContent = '重新开始';
        elements.gameStatus.textContent = '结束';
        
        addLog(`游戏结束 - ${reason}`, 'danger');
    }

    function victory() {
        gameState.status = 'victory';
        clearInterval(gameTimer);

        elements.gameOverlay.classList.remove('hidden');
        elements.overlayTitle.textContent = '🎉 恭喜通关！';
        elements.overlayMessage.innerHTML = `
            <strong>你已完成所有关卡！</strong><br><br>
            <strong>最终得分：</strong>${gameState.score}<br>
            <strong>安全作业：</strong>${gameState.safeOperations}次<br>
            <strong>违规记录：</strong>${gameState.violations.length}次<br>
            <strong>评级：</strong>${getRating()}
        `;
        elements.startBtn.textContent = '再玩一次';
        elements.gameStatus.textContent = '胜利';
        
        addLog('🎉 恭喜通关！', 'success');
    }

    function getRating() {
        const totalRounds = (gameState.level - 1) * CONFIG.ROUNDS_PER_LEVEL + gameState.round;
        const violationRate = gameState.violations.length / totalRounds;
        if (violationRate === 0) return 'S - 完美指挥';
        if (violationRate < 0.1) return 'A - 优秀指挥';
        if (violationRate < 0.2) return 'B - 良好指挥';
        if (violationRate < 0.3) return 'C - 合格指挥';
        return 'D - 需要培训';
    }

    function addLog(message, type = 'info') {
        const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        gameState.logs.push({ message, type, time });
        
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.innerHTML = `<span class="log-time">[${time}]</span>${message}`;
        elements.logContainer.appendChild(entry);
        elements.logContainer.scrollTop = elements.logContainer.scrollHeight;
    }

    function saveHistory() {
        gameState.history.push(JSON.parse(JSON.stringify({
            crane: gameState.crane,
            load: gameState.load,
            wind: gameState.wind,
            personnel: gameState.personnel,
            dangerZone: gameState.dangerZone,
            score: gameState.score,
            round: gameState.round,
            level: gameState.level
        })));
    }

    function updateUI() {
        elements.level.textContent = gameState.level;
        elements.round.textContent = `${gameState.round}/${CONFIG.ROUNDS_PER_LEVEL}`;
        elements.score.textContent = gameState.score;

        const loadRatio = gameState.load.weight / CONFIG.CRANE_MAX_LOAD;
        elements.loadWeight.textContent = `${gameState.load.weight}kg`;
        elements.loadBar.style.width = `${loadRatio * 100}%`;
        elements.loadBar.className = 'bar-fill' + (loadRatio > 0.9 ? ' danger' : loadRatio > 0.7 ? ' warning' : '');

        elements.windSpeed.textContent = `${gameState.wind.speed.toFixed(1)}m/s`;
        const windRatio = gameState.wind.speed / CONFIG.MAX_WIND_SPEED;
        elements.windBar.style.width = `${Math.min(100, windRatio * 100)}%`;
        elements.windBar.className = 'bar-fill' + (windRatio > 1 ? ' danger' : windRatio > 0.7 ? ' warning' : '');

        elements.personnelStatus.textContent = gameState.personnel.inDangerZone ? '⚠️ 危险区域有人' : '安全';
        elements.personnelStatus.className = 'status-value' + (gameState.personnel.inDangerZone ? ' danger' : ' safe');

        const craneLoadPercent = Math.round(loadRatio * 100);
        elements.craneLoad.textContent = `${craneLoadPercent}%`;
        elements.craneLoad.className = 'status-value' + (craneLoadPercent > 90 ? ' danger' : craneLoadPercent > 70 ? ' warning' : ' safe');

        if (gameState.status === 'playing') {
            elements.gameStatus.textContent = '运行中';
        }
    }

    function render() {
        ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
        drawBackground();
        drawDangerZone();
        drawCrane();
        drawLoad();
        drawTarget();
        drawPersonnel();
        drawWindIndicator();
    }

    function drawBackground() {
        const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.CANVAS_HEIGHT);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.6, '#B0E0E6');
        gradient.addColorStop(0.6, '#8B7355');
        gradient.addColorStop(1, '#6B5344');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        ctx.fillStyle = '#7CB342';
        ctx.fillRect(0, 420, CONFIG.CANVAS_WIDTH, 80);

        ctx.fillStyle = '#558B2F';
        for (let i = 0; i < CONFIG.CANVAS_WIDTH; i += 20) {
            ctx.fillRect(i, 420, 10, 5);
        }

        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(150 + i * 300, 60, 30, 0, Math.PI * 2);
            ctx.arc(180 + i * 300, 50, 25, 0, Math.PI * 2);
            ctx.arc(200 + i * 300, 65, 20, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawDangerZone() {
        if (!gameState.dangerZone.active) return;
        
        const zone = gameState.dangerZone;
        ctx.beginPath();
        ctx.arc(zone.centerX, zone.centerY, zone.radius, 0, Math.PI * 2);
        ctx.fillStyle = gameState.personnel.inDangerZone ? 'rgba(231, 76, 60, 0.3)' : 'rgba(243, 156, 18, 0.2)';
        ctx.fill();
        ctx.strokeStyle = gameState.personnel.inDangerZone ? '#e74c3c' : '#f39c12';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = gameState.personnel.inDangerZone ? '#e74c3c' : '#f39c12';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('⚠', zone.centerX, zone.centerY - zone.radius - 10);
    }

    function drawCrane() {
        const crane = gameState.crane;
        const x = crane.x;
        const y = crane.y;
        const armAngle = crane.armAngle;
        const trolleyPos = crane.trolleyPosition;

        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(x - 40, y, 80, 60);
        
        ctx.fillStyle = '#2C3E50';
        ctx.fillRect(x - 15, y - 120, 30, 120);

        const armLength = 250;
        const armRad = (armAngle * Math.PI) / 180;

        ctx.fillStyle = '#F39C12';
        ctx.save();
        ctx.translate(x, y - 100);
        ctx.rotate(armRad);
        ctx.fillRect(-10, 0, 20, armLength);
        
        const trolleyLocalX = armLength * trolleyPos;
        ctx.fillStyle = '#E74C3C';
        ctx.fillRect(trolleyLocalX - 15, -8, 30, 16);
        ctx.restore();

        const trolleyDist = armLength * trolleyPos;
        const trolleyWorldX = x + Math.sin(armRad) * trolleyDist;
        const trolleyWorldY = (y - 100) + Math.cos(armRad) * trolleyDist;
        const cableLength = (1 - crane.hookHeight) * 200;
        
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(trolleyWorldX, trolleyWorldY);
        ctx.lineTo(trolleyWorldX, trolleyWorldY + cableLength);
        ctx.stroke();

        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(trolleyWorldX, trolleyWorldY + cableLength + 10, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#3498DB';
        ctx.beginPath();
        ctx.arc(x, y - 100, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2980B9';
        ctx.beginPath();
        ctx.arc(x, y - 100, 18, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawLoad() {
        const load = gameState.load;
        
        ctx.fillStyle = load.isLifted ? '#E74C3C' : '#95A5A6';
        ctx.fillRect(load.x - 25, load.y - 20, 50, 40);
        
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(load.x - 20, load.y - 20);
        ctx.lineTo(load.x, load.y - 35);
        ctx.lineTo(load.x + 20, load.y - 20);
        ctx.stroke();

        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${load.weight}kg`, load.x, load.y + 5);
    }

    function drawTarget() {
        const load = gameState.load;
        
        ctx.strokeStyle = '#27AE60';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(load.targetX - 30, load.targetY - 25, 60, 50);
        ctx.setLineDash([]);

        ctx.fillStyle = '#27AE60';
        ctx.beginPath();
        ctx.moveTo(load.targetX, load.targetY - 45);
        ctx.lineTo(load.targetX - 10, load.targetY - 35);
        ctx.lineTo(load.targetX + 10, load.targetY - 35);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#27AE60';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('目标位置', load.targetX, load.targetY + 40);
    }

    function drawPersonnel() {
        gameState.personnel.workers.forEach(worker => {
            const inDanger = gameState.dangerZone.active && 
                Math.sqrt(
                    (worker.x - gameState.dangerZone.centerX) ** 2 +
                    (worker.y - gameState.dangerZone.centerY) ** 2
                ) < gameState.dangerZone.radius;

            ctx.fillStyle = inDanger ? '#E74C3C' : '#3498DB';
            ctx.beginPath();
            ctx.arc(worker.x, worker.y - 15, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = inDanger ? '#C0392B' : '#2980B9';
            ctx.fillRect(worker.x - 6, worker.y - 7, 12, 15);

            ctx.fillStyle = '#F39C12';
            ctx.beginPath();
            ctx.ellipse(worker.x, worker.y - 18, 10, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(worker.x - 5, worker.y - 22, 10, 5);

            if (inDanger) {
                ctx.fillStyle = '#E74C3C';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('⚠', worker.x, worker.y - 30);
            }
        });
    }

    function drawWindIndicator() {
        const wind = gameState.wind;
        const x = 70;
        const y = 80;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x - 35, y - 35, 70, 70);
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 35, y - 35, 70, 70);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((wind.direction * Math.PI) / 180);
        
        ctx.fillStyle = wind.speed > CONFIG.MAX_WIND_SPEED ? '#E74C3C' : 
                        wind.speed > CONFIG.WARNING_WIND_SPEED ? '#F39C12' : '#27AE60';
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(-10, 10);
        ctx.lineTo(10, 10);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();

        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('风速', x, y + 50);
        ctx.fillText(`${wind.speed.toFixed(1)}m/s`, x, y + 63);
    }

    function showModal(type) {
        hideAllModals();
        elements[`${type}Modal`].classList.add('show');
    }

    function hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('show');
        });
    }

    function showReplay() {
        if (gameState.history.length === 0) {
            alert('暂无历史记录可回放');
            return;
        }
        showModal('replay');
        gameState.replayIndex = 0;
        updateReplayProgress();
        renderReplayFrame();
    }

    function playReplay() {
        if (gameState.replayTimer) return;
        
        gameState.replayTimer = setInterval(() => {
            if (gameState.replayIndex < gameState.history.length - 1) {
                gameState.replayIndex++;
                renderReplayFrame();
                updateReplayProgress();
            } else {
                pauseReplay();
            }
        }, CONFIG.TICK_INTERVAL);
    }

    function pauseReplay() {
        if (gameState.replayTimer) {
            clearInterval(gameState.replayTimer);
            gameState.replayTimer = null;
        }
    }

    function resetReplay() {
        pauseReplay();
        gameState.replayIndex = 0;
        renderReplayFrame();
        updateReplayProgress();
    }

    function stopReplay() {
        pauseReplay();
        gameState.replayIndex = 0;
    }

    function updateReplayProgress() {
        elements.replayProgress.textContent = `${gameState.replayIndex}/${gameState.history.length - 1}`;
    }

    function renderReplayFrame() {
        const frame = gameState.history[gameState.replayIndex];
        if (!frame) return;

        replayCtx.clearRect(0, 0, replayCanvas.width, replayCanvas.height);
        
        const gradient = replayCtx.createLinearGradient(0, 0, 0, replayCanvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.6, '#B0E0E6');
        gradient.addColorStop(0.6, '#8B7355');
        gradient.addColorStop(1, '#6B5344');
        replayCtx.fillStyle = gradient;
        replayCtx.fillRect(0, 0, replayCanvas.width, replayCanvas.height);

        replayCtx.fillStyle = '#7CB342';
        replayCtx.fillRect(0, 340, replayCanvas.width, 60);

        const scaleX = replayCanvas.width / CONFIG.CANVAS_WIDTH;
        const scaleY = replayCanvas.height / CONFIG.CANVAS_HEIGHT;
        const scale = Math.min(scaleX, scaleY);

        replayCtx.save();
        replayCtx.scale(scale * 0.9, scale * 0.9);
        replayCtx.translate(40, 0);

        const crane = frame.crane;
        const x = crane.x;
        const y = crane.y * 0.8;

        replayCtx.fillStyle = '#4A4A4A';
        replayCtx.fillRect(x - 30, y, 60, 40);
        replayCtx.fillStyle = '#2C3E50';
        replayCtx.fillRect(x - 12, y - 80, 24, 80);

        const armRad = (crane.armAngle * Math.PI) / 180;
        const armLength = 200;

        replayCtx.fillStyle = '#F39C12';
        replayCtx.save();
        replayCtx.translate(x, y - 70);
        replayCtx.rotate(armRad);
        replayCtx.fillRect(-8, 0, 16, armLength);

        const trolleyLocalX = armLength * crane.trolleyPosition;
        replayCtx.fillStyle = '#E74C3C';
        replayCtx.fillRect(trolleyLocalX - 12, -6, 24, 12);
        replayCtx.restore();

        const trolleyDist = armLength * crane.trolleyPosition;
        const trolleyWorldX = x + Math.sin(armRad) * trolleyDist;
        const trolleyWorldY = (y - 70) + Math.cos(armRad) * trolleyDist;
        const cableLength = (1 - crane.hookHeight) * 160;
        
        replayCtx.strokeStyle = '#333';
        replayCtx.lineWidth = 2;
        replayCtx.beginPath();
        replayCtx.moveTo(trolleyWorldX, trolleyWorldY);
        replayCtx.lineTo(trolleyWorldX, trolleyWorldY + cableLength);
        replayCtx.stroke();

        const load = frame.load;
        replayCtx.fillStyle = load.isLifted ? '#E74C3C' : '#95A5A6';
        replayCtx.fillRect(load.x - 20, load.y * 0.8 - 15, 40, 30);

        frame.personnel.workers.forEach(worker => {
            replayCtx.fillStyle = '#3498DB';
            replayCtx.beginPath();
            replayCtx.arc(worker.x, worker.y * 0.8 - 12, 6, 0, Math.PI * 2);
            replayCtx.fill();
            replayCtx.fillRect(worker.x - 4, worker.y * 0.8 - 6, 8, 10);
        });

        replayCtx.restore();

        elements.replayLog.innerHTML = `
            <div class="log-entry info">
                <span class="log-time">[回放]</span>
                第${frame.level}关第${frame.round}回合 | 得分: ${frame.score} | 
                吊重: ${frame.load.weight}kg | 风速: ${frame.wind.speed.toFixed(1)}m/s
            </div>
        `;
    }

    function showReport() {
        generateReport();
        showModal('report');
    }

    function generateReport() {
        const now = new Date();
        const reportDate = now.toLocaleDateString('zh-CN');
        const reportTime = now.toLocaleTimeString('zh-CN');

        const totalRounds = (gameState.level - 1) * CONFIG.ROUNDS_PER_LEVEL + gameState.round;
        const violationRate = totalRounds > 0 ? (gameState.violations.length / totalRounds * 100).toFixed(1) : 0;

        let violationsHtml = '';
        if (gameState.violations.length > 0) {
            violationsHtml = gameState.violations.map(v => 
                `<div class="report-item">
                    <span class="label">第${v.round}回合</span>
                    <span class="value" style="color: #e74c3c;">${v.desc}</span>
                </div>`
            ).join('');
        } else {
            violationsHtml = '<div style="color: #27ae60;">无违规记录 - 完美作业！</div>';
        }

        let logsHtml = '';
        gameState.logs.slice(-20).forEach(log => {
            const colorClass = log.type === 'danger' ? '#e74c3c' : 
                              log.type === 'warning' ? '#f39c12' : 
                              log.type === 'success' ? '#27ae60' : '#3498db';
            logsHtml += `<div style="padding: 3px 0; border-left: 3px solid ${colorClass}; padding-left: 8px; margin: 2px 0;">
                <span style="color: #888;">[${log.time}]</span> ${log.message}
            </div>`;
        });

        elements.reportContent.innerHTML = `
            <div class="report-section">
                <h4>📋 报告基本信息</h4>
                <div class="report-item"><span class="label">报告编号</span><span class="value">CRANE-${now.getTime()}</span></div>
                <div class="report-item"><span class="label">生成日期</span><span class="value">${reportDate}</span></div>
                <div class="report-item"><span class="label">生成时间</span><span class="value">${reportTime}</span></div>
                <div class="report-item"><span class="label">操作员</span><span class="value">模拟训练学员</span></div>
            </div>
            <div class="report-section">
                <h4>🎯 训练成绩</h4>
                <div class="report-item"><span class="label">最终得分</span><span class="value" style="color: #f39c12;">${gameState.score} 分</span></div>
                <div class="report-item"><span class="label">完成关卡</span><span class="value">第 ${gameState.level} 关</span></div>
                <div class="report-item"><span class="label">完成回合</span><span class="value">${totalRounds} 回合</span></div>
                <div class="report-item"><span class="label">安全作业次数</span><span class="value" style="color: #27ae60;">${gameState.safeOperations} 次</span></div>
                <div class="report-item"><span class="label">综合评级</span><span class="value">${getRating()}</span></div>
            </div>
            <div class="report-section">
                <h4>⚠️ 安全评估</h4>
                <div class="report-item"><span class="label">违规次数</span><span class="value" style="color: ${gameState.violations.length > 0 ? '#e74c3c' : '#27ae60'};">${gameState.violations.length} 次</span></div>
                <div class="report-item"><span class="label">违规率</span><span class="value">${violationRate}%</span></div>
                <div class="report-item"><span class="label">最大吊重</span><span class="value">${CONFIG.CRANE_MAX_LOAD} kg</span></div>
                <div class="report-item"><span class="label">风速限值</span><span class="value">${CONFIG.MAX_WIND_SPEED} m/s</span></div>
            </div>
            <div class="report-section">
                <h4>📝 违规记录</h4>
                ${violationsHtml}
            </div>
            <div class="report-section">
                <h4>📜 操作日志（最近20条）</h4>
                ${logsHtml}
            </div>
        `;
    }

    function downloadReport() {
        const reportContent = elements.reportContent.innerHTML;
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>塔吊指挥训练报告</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 30px; background: #f5f5f5; }
        .report { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 2px solid #f39c12; padding-bottom: 15px; }
        .section { margin: 20px 0; }
        .section h4 { color: #f39c12; border-bottom: 1px solid #eee; padding-bottom: 8px; }
        .item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #eee; }
        .item .label { color: #666; }
        .item .value { font-weight: bold; }
    </style>
</head>
<body>
    <div class="report">
        <h1>🏗️ 塔吊指挥训练报告</h1>
        ${reportContent.replace(/class="report-section"/g, 'class="section"').replace(/class="report-item"/g, 'class="item"')}
    </div>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `塔吊训练报告_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.html`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function printReport() {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>塔吊指挥训练报告</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #2c3e50; }
        .section { margin: 15px 0; }
        .section h4 { color: #f39c12; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        .item { display: flex; justify-content: space-between; padding: 5px 0; }
        .item .label { color: #666; }
        .item .value { font-weight: bold; }
        @media print { body { padding: 0; } }
    </style>
</head>
<body>
    <h1>🏗️ 塔吊指挥训练报告</h1>
    ${elements.reportContent.innerHTML}
</body>
</html>`);
        printWindow.document.close();
        printWindow.print();
    }

    return {
        init
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    CraneGame.init();
});
