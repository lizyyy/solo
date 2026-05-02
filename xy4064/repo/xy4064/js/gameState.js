const GameState = {
    STATES: {
        MENU: 'menu',
        PLAYING: 'playing',
        PAUSED: 'paused',
        RESULT: 'result',
        EDITOR: 'editor'
    },

    state: 'menu',
    previousState: null,

    gameData: {
        currentChart: null,
        startTime: 0,
        pauseTime: 0,
        totalPausedTime: 0,
        currentTime: 0,
        isPaused: false,
        isFinished: false
    },

    init: function() {
        this.state = this.STATES.MENU;
        this.previousState = null;
        this.resetGameData();
    },

    resetGameData: function() {
        this.gameData = {
            currentChart: null,
            startTime: 0,
            pauseTime: 0,
            totalPausedTime: 0,
            currentTime: 0,
            isPaused: false,
            isFinished: false
        };
    },

    getState: function() {
        return this.state;
    },

    setState: function(newState) {
        if (Object.values(this.STATES).includes(newState)) {
            this.previousState = this.state;
            this.state = newState;
            return true;
        }
        return false;
    },

    isInState: function(state) {
        return this.state === state;
    },

    startGame: function(chart) {
        this.resetGameData();
        this.gameData.currentChart = chart;
        this.gameData.startTime = performance.now();
        this.gameData.currentTime = 0;
        this.gameData.isPaused = false;
        this.gameData.isFinished = false;
        this.setState(this.STATES.PLAYING);
    },

    pauseGame: function() {
        if (this.isInState(this.STATES.PLAYING)) {
            this.gameData.pauseTime = performance.now();
            this.gameData.isPaused = true;
            this.setState(this.STATES.PAUSED);
            return true;
        }
        return false;
    },

    resumeGame: function() {
        if (this.isInState(this.STATES.PAUSED)) {
            const resumeTime = performance.now();
            this.gameData.totalPausedTime += resumeTime - this.gameData.pauseTime;
            this.gameData.isPaused = false;
            this.setState(this.STATES.PLAYING);
            return true;
        }
        return false;
    },

    restartGame: function() {
        if (this.gameData.currentChart) {
            this.startGame(this.gameData.currentChart);
            return true;
        }
        return false;
    },

    finishGame: function() {
        this.gameData.isFinished = true;
        this.setState(this.STATES.RESULT);
    },

    goToMenu: function() {
        this.resetGameData();
        this.setState(this.STATES.MENU);
    },

    goToEditor: function() {
        this.setState(this.STATES.EDITOR);
    },

    getCurrentTime: function() {
        if (this.gameData.isPaused) {
            return this.gameData.currentTime;
        }
        const now = performance.now();
        this.gameData.currentTime = now - this.gameData.startTime - this.gameData.totalPausedTime;
        return this.gameData.currentTime;
    },

    getChartDuration: function() {
        if (this.gameData.currentChart && this.gameData.currentChart.notes.length > 0) {
            const lastNote = this.gameData.currentChart.notes[this.gameData.currentChart.notes.length - 1];
            return lastNote.time + 2000; 
        }
        return 10000;
    }
};
