const Game = {
    animationFrame: null,
    beatSimulator: null,
    lastFrameTime: 0,

    screens: {
        start: null,
        pause: null,
        result: null,
        editor: null,
        gameUI: null
    },

    currentChart: null,
    highScore: 0,

    init: function() {
        GameState.init();
        Renderer.init('game-canvas');
        this.initScreens();
        this.initEventListeners();
        this.initInputCallbacks();
        this.loadChartList();
        
        console.log('同步节拍工坊已初始化');
        this.gameLoop(performance.now());
    },

    initScreens: function() {
        this.screens.start = document.getElementById('start-screen');
        this.screens.pause = document.getElementById('pause-screen');
        this.screens.result = document.getElementById('result-screen');
        this.screens.editor = document.getElementById('editor-screen');
        this.screens.gameUI = document.getElementById('game-ui');
    },

    initEventListeners: function() {
        const resumeBtn = document.getElementById('resume-btn');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => this.resumeGame());
        }

        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => this.restartGame());
        }

        const quitBtn = document.getElementById('quit-btn');
        if (quitBtn) {
            quitBtn.addEventListener('click', () => this.goToMenu());
        }

        const retryBtn = document.getElementById('retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.restartGame());
        }

        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.goToMenu());
        }

        const editorBtn = document.getElementById('editor-btn');
        if (editorBtn) {
            editorBtn.addEventListener('click', () => this.openEditor());
        }

        const editorBackBtn = document.getElementById('editor-back');
        if (editorBackBtn) {
            editorBackBtn.addEventListener('click', () => this.closeEditor());
        }
    },

    initInputCallbacks: function() {
        const directionKeys = Input.getDirectionKeys();

        for (const key of directionKeys) {
            Input.registerCallback(key, 'down', (keyName, time) => {
                if (GameState.isInState(GameState.STATES.PLAYING)) {
                    this.handleInput(keyName, time);
                }
            });
        }

        Input.registerCallback('esc', 'down', () => {
            if (GameState.isInState(GameState.STATES.PLAYING)) {
                this.pauseGame();
            } else if (GameState.isInState(GameState.STATES.PAUSED)) {
                this.resumeGame();
            }
        });
    },

    loadChartList: function() {
        const chartListContainer = document.getElementById('chart-list');
        if (!chartListContainer) return;

        chartListContainer.innerHTML = '';

        const allCharts = Storage.getAllCharts();

        for (const chart of allCharts.all) {
            const chartItem = document.createElement('div');
            chartItem.className = 'chart-item';
            chartItem.innerHTML = `
                <h3>${chart.name}</h3>
                <p>${chart.description}</p>
                <p style="font-size: 0.8em; color: #888;">
                    BPM: ${chart.bpm} | 音符数: ${chart.notes.length}
                    ${Storage.getHighScore(chart.id) > 0 ? ` | 最高分: ${Storage.getHighScore(chart.id)}` : ''}
                </p>
            `;

            chartItem.addEventListener('click', () => {
                this.startGame(chart);
            });

            chartListContainer.appendChild(chartItem);
        }
    },

    startGame: function(chart) {
        if (!chart || !chart.notes || chart.notes.length === 0) {
            console.error('Invalid chart');
            return;
        }

        this.currentChart = chart;
        this.highScore = Storage.getHighScore(chart.id);

        GameState.startGame(chart);
        Scoring.init(chart.notes.length);

        this.beatSimulator = Chart.createBeatSimulator(chart);

        this.hideAllScreens();
        this.showScreen('gameUI');

        Input.reset();
    },

    pauseGame: function() {
        if (GameState.pauseGame()) {
            this.showScreen('pause');
        }
    },

    resumeGame: function() {
        if (GameState.resumeGame()) {
            this.hideScreen('pause');
        }
    },

    restartGame: function() {
        if (this.currentChart) {
            this.startGame(this.currentChart);
        }
    },

    goToMenu: function() {
        GameState.goToMenu();
        this.hideAllScreens();
        this.showScreen('start');
        this.loadChartList();
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    },

    finishGame: function() {
        GameState.finishGame();

        const stats = Scoring.getStats();
        const result = Storage.saveGameResult(this.currentChart.id, stats);

        this.showResultScreen(stats, result);
    },

    showResultScreen: function(stats, result) {
        this.hideAllScreens();
        this.showScreen('result');

        const finalScoreEl = document.getElementById('final-score');
        const finalMaxComboEl = document.getElementById('final-max-combo');
        const perfectCountEl = document.getElementById('perfect-count');
        const goodCountEl = document.getElementById('good-count');
        const missCountEl = document.getElementById('miss-count');
        const highScoreEl = document.getElementById('high-score');

        if (finalScoreEl) {
            finalScoreEl.textContent = stats.score.toLocaleString();
            if (result.isNewHighScore) {
                finalScoreEl.style.color = '#ffd700';
            }
        }

        if (finalMaxComboEl) {
            finalMaxComboEl.textContent = stats.maxCombo;
        }

        if (perfectCountEl) {
            perfectCountEl.textContent = stats.perfectCount;
        }

        if (goodCountEl) {
            goodCountEl.textContent = stats.goodCount;
        }

        if (missCountEl) {
            missCountEl.textContent = stats.missCount;
        }

        if (highScoreEl) {
            const currentHighScore = Math.max(this.highScore, stats.score);
            highScoreEl.textContent = currentHighScore.toLocaleString();
        }
    },

    openEditor: function() {
        GameState.goToEditor();
        this.hideAllScreens();
        this.showScreen('editor');
        Editor.init();
        Editor.render();
    },

    closeEditor: function() {
        GameState.goToMenu();
        this.hideAllScreens();
        this.showScreen('start');
        this.loadChartList();
    },

    handleInput: function(keyName, time) {
        const currentTime = GameState.getCurrentTime();
        
        const matchingNote = Scoring.findMatchingNote(keyName, currentTime);
        
        if (matchingNote) {
            const judgement = Scoring.handleHit(matchingNote, currentTime, keyName);
            if (judgement) {
                Renderer.showJudgement(judgement);
            }
        }
    },

    gameLoop: function(timestamp) {
        const deltaTime = timestamp - this.lastFrameTime;
        this.lastFrameTime = timestamp;

        switch (GameState.getState()) {
            case GameState.STATES.PLAYING:
                this.updatePlayingState(deltaTime);
                break;

            case GameState.STATES.PAUSED:
                this.updatePausedState();
                break;

            case GameState.STATES.EDITOR:
                this.updateEditorState();
                break;

            case GameState.STATES.MENU:
            case GameState.STATES.RESULT:
            default:
                break;
        }

        this.animationFrame = requestAnimationFrame(this.gameLoop.bind(this));
    },

    updatePlayingState: function(deltaTime) {
        const currentTime = GameState.getCurrentTime();
        const chart = GameState.gameData.currentChart;

        if (!chart) return;

        if (this.beatSimulator) {
            this.beatSimulator.update(currentTime);
        }

        const visibleNotes = this.getVisibleNotes(chart, currentTime);
        Scoring.setActiveNotes(visibleNotes);

        const missedNotes = Scoring.checkMissedNotes(currentTime);
        for (const note of missedNotes) {
            Renderer.showJudgement('miss');
        }

        const stats = Scoring.getStats();
        const beatCount = this.beatSimulator ? this.beatSimulator.currentBeat : 0;
        Renderer.render(visibleNotes, currentTime, stats, beatCount);

        const chartDuration = GameState.getChartDuration();
        if (currentTime > chartDuration) {
            this.finishGame();
        }
    },

    updatePausedState: function() {
        const currentTime = GameState.getCurrentTime();
        const chart = GameState.gameData.currentChart;

        if (chart) {
            const visibleNotes = this.getVisibleNotes(chart, currentTime);
            const stats = Scoring.getStats();
            Renderer.render(visibleNotes, currentTime, stats, 0);
        }
    },

    updateEditorState: function() {
    },

    getVisibleNotes: function(chart, currentTime) {
        if (!chart || !chart.notes) return [];

        const renderConfig = Renderer.config;
        const timeWindow = (Renderer.height + renderConfig.noteSize * 2) * 1000 / renderConfig.noteSpeed;

        const startTime = currentTime - timeWindow;
        const endTime = currentTime + timeWindow;

        return chart.notes.filter(note => 
            note.time >= startTime && note.time <= endTime
        );
    },

    showScreen: function(screenName) {
        const screenElement = this.screens[screenName];
        if (screenElement) {
            screenElement.classList.remove('hidden');
        }
    },

    hideScreen: function(screenName) {
        const screenElement = this.screens[screenName];
        if (screenElement) {
            screenElement.classList.add('hidden');
        }
    },

    hideAllScreens: function() {
        for (const key in this.screens) {
            this.hideScreen(key);
        }
    }
};

document.addEventListener('DOMContentLoaded', function() {
    Game.init();
});
