const Main = (function() {
    let currentLevelIndex = 0;

    function init() {
        UIRenderer.init();
        bindEvents();
        checkSavedGame();
        showMenu();

        GameState.addStateListener(handleStateChange);
    }

    function bindEvents() {
        document.getElementById('startBtn').addEventListener('click', startNewGame);
        document.getElementById('continueBtn').addEventListener('click', continueGame);
        document.getElementById('pauseBtn').addEventListener('click', pauseGame);
        document.getElementById('resumeBtn').addEventListener('click', resumeGame);
        document.getElementById('restartBtn').addEventListener('click', restartLevel);
        document.getElementById('undoBtn').addEventListener('click', undoLastAction);
        document.getElementById('leaderboardBtn').addEventListener('click', showLeaderboard);
        document.getElementById('closeLeaderboardBtn').addEventListener('click', closeLeaderboard);
        document.getElementById('nextLevelBtn').addEventListener('click', nextLevel);
        document.getElementById('replayBtn').addEventListener('click', replayLevel);

        document.addEventListener('keydown', handleKeyboard);
    }

    function handleKeyboard(e) {
        if (e.key === 'Escape') {
            if (GameState.getState() === GameState.States.PLAYING) {
                pauseGame();
            } else if (GameState.getState() === GameState.States.PAUSED) {
                resumeGame();
            }
        }

        if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            undoLastAction();
        }

        if (e.key === ' ' && GameState.getState() === GameState.States.PLAYING) {
            e.preventDefault();
        }

        if (e.key === '1' && GameState.getState() === GameState.States.PLAYING) {
            triageCurrentPatient('red');
        }
        if (e.key === '2' && GameState.getState() === GameState.States.PLAYING) {
            triageCurrentPatient('yellow');
        }
        if (e.key === '3' && GameState.getState() === GameState.States.PLAYING) {
            triageCurrentPatient('green');
        }
        if (e.key === '4' && GameState.getState() === GameState.States.PLAYING) {
            triageCurrentPatient('observe');
        }
    }

    function triageCurrentPatient(queue) {
        const patient = GameState.getCurrentPatient();
        if (!patient) return;

        UIRenderer.handlePatientDrop(patient, queue);
    }

    function checkSavedGame() {
        const hasSaved = Storage.hasSavedGame();
        if (hasSaved) {
            document.getElementById('continueBtn').style.display = 'inline-block';
        }
    }

    function showMenu() {
        UIRenderer.hideAllModals();
        UIRenderer.showMenu(Storage.hasSavedGame());
    }

    function startNewGame() {
        currentLevelIndex = 0;
        Storage.clearGameState();
        loadLevel(currentLevelIndex);
    }

    function continueGame() {
        const savedState = Storage.loadGameState();
        if (!savedState) {
            startNewGame();
            return;
        }

        currentLevelIndex = savedState.levelIndex || 0;
        const levelData = LevelLoader.loadLevelByIndex(currentLevelIndex);
        if (!levelData) {
            startNewGame();
            return;
        }

        GameState.initLevel(levelData, currentLevelIndex);
        GameState.startGame();
        UIRenderer.hideAllModals();
        UIRenderer.updateAll();
    }

    function loadLevel(index) {
        const levelData = LevelLoader.loadLevelByIndex(index);
        if (!levelData) {
            showMenu();
            return;
        }

        GameState.initLevel(levelData, index);
        GameState.startGame();
        UIRenderer.hideAllModals();
        UIRenderer.updateAll();
    }

    function pauseGame() {
        GameState.pauseGame();
        UIRenderer.showPauseMenu();
        Storage.saveGameState();
    }

    function resumeGame() {
        GameState.resumeGame();
        UIRenderer.hideAllModals();
    }

    function restartLevel() {
        if (confirm('确定要重新开始当前关卡吗？')) {
            loadLevel(currentLevelIndex);
        }
    }

    function undoLastAction() {
        const result = GameState.undoLastTriage();
        if (result) {
            UIRenderer.updateAll();
            UIRenderer.showFeedback(true, ['已撤销上一张分诊'], result.restoredPoints);
        }
    }

    function showLeaderboard() {
        const entries = Storage.getLeaderboard();
        UIRenderer.showLeaderboard(entries);
    }

    function closeLeaderboard() {
        UIRenderer.hideModal('leaderboard');
    }

    function nextLevel() {
        currentLevelIndex++;
        const nextLevelData = LevelLoader.loadLevelByIndex(currentLevelIndex);
        if (nextLevelData) {
            loadLevel(currentLevelIndex);
        } else {
            showMenu();
        }
    }

    function replayLevel() {
        loadLevel(currentLevelIndex);
    }

    function handleStateChange(oldState, newState, data) {
        switch (newState) {
            case GameState.States.PLAYING:
                UIRenderer.enableControls(true);
                break;

            case GameState.States.PAUSED:
                UIRenderer.enableControls(false);
                break;

            case GameState.States.LEVEL_COMPLETE:
                handleLevelComplete(data.result);
                break;

            case GameState.States.GAME_OVER:
                handleGameOver(data);
                break;

            case GameState.States.MENU:
                UIRenderer.showMenu(Storage.hasSavedGame());
                break;
        }
    }

    function handleLevelComplete(result) {
        const results = GameState.getResults();
        Storage.saveScore(results);
        Storage.clearGameState();

        const hasNext = GameState.hasNextLevel();
        UIRenderer.showResultModal(results, hasNext);
    }

    function handleGameOver(data) {
        const results = GameState.getResults();
        Storage.saveScore(results);
        Storage.clearGameState();

        results.timeRemaining = 0;
        const hasNext = GameState.hasNextLevel();
        UIRenderer.showResultModal(results, hasNext);
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        startNewGame,
        continueGame,
        pauseGame,
        resumeGame,
        restartLevel
    };
})();
