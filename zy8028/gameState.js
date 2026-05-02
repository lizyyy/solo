const GameState = (function() {
    const States = {
        MENU: 'MENU',
        PLAYING: 'PLAYING',
        PAUSED: 'PAUSED',
        LEVEL_COMPLETE: 'LEVEL_COMPLETE',
        GAME_OVER: 'GAME_OVER'
    };

    const COMBO_THRESHOLDS = [0, 3, 5, 8, 12];
    const COMBO_MULTIPLIERS = [1.0, 1.5, 2.0, 2.5, 3.0];

    let currentState = States.MENU;
    let currentLevel = null;
    let currentLevelIndex = 0;
    let score = 0;
    let combo = 0;
    let comboMultiplier = 1.0;
    let timeRemaining = 0;
    let timerInterval = null;
    let patientQueue = [];
    let triageHistory = [];
    let queueCounts = { red: 0, yellow: 0, green: 0, observe: 0 };
    let totalPatients = 0;
    let triagedPatients = 0;
    let correctTriages = 0;
    let wrongTriages = 0;
    let maxCombo = 0;
    let stateListeners = [];

    function addStateListener(listener) {
        stateListeners.push(listener);
    }

    function notifyStateChange(oldState, newState, data = {}) {
        stateListeners.forEach(listener => {
            listener(oldState, newState, data);
        });
    }

    function setState(newState, data = {}) {
        const oldState = currentState;
        currentState = newState;
        notifyStateChange(oldState, newState, data);
        return { oldState, newState };
    }

    function getState() {
        return currentState;
    }

    function isPlaying() {
        return currentState === States.PLAYING;
    }

    function initLevel(levelData, levelIndex = 0) {
        currentLevel = levelData;
        currentLevelIndex = levelIndex;
        score = 0;
        combo = 0;
        comboMultiplier = 1.0;
        timeRemaining = levelData.timeLimit;
        patientQueue = levelData.patients.map(p => ({ ...p }));
        triageHistory = [];
        queueCounts = { red: 0, yellow: 0, green: 0, observe: 0 };
        totalPatients = levelData.patients.length;
        triagedPatients = 0;
        correctTriages = 0;
        wrongTriages = 0;
        maxCombo = 0;

        return getStateSnapshot();
    }

    function startGame() {
        if (!currentLevel) return false;
        startTimer();
        return setState(States.PLAYING);
    }

    function pauseGame() {
        if (currentState !== States.PLAYING) return false;
        stopTimer();
        return setState(States.PAUSED);
    }

    function resumeGame() {
        if (currentState !== States.PAUSED) return false;
        startTimer();
        return setState(States.PLAYING);
    }

    function startTimer() {
        stopTimer();
        timerInterval = setInterval(() => {
            timeRemaining--;
            if (timeRemaining <= 0) {
                timeRemaining = 0;
                stopTimer();
                handleTimeout();
            }
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function handleTimeout() {
        setState(States.GAME_OVER, { reason: 'timeout' });
    }

    function triagePatient(selectedQueue) {
        if (currentState !== States.PLAYING || patientQueue.length === 0) {
            return null;
        }

        const patient = patientQueue.shift();
        const evaluation = TriageRules.evaluateTriage(patient, selectedQueue);

        updateCombo(evaluation.isCorrect);
        const points = calculatePointsWithCombo(evaluation.totalPoints);
        score += points;

        const historyEntry = {
            patient: { ...patient },
            selectedQueue: selectedQueue,
            correctQueue: evaluation.correctQueue,
            isCorrect: evaluation.isCorrect,
            points: points,
            comboAtTime: combo,
            timestamp: Date.now(),
            evaluation: evaluation
        };
        triageHistory.push(historyEntry);

        queueCounts[selectedQueue]++;
        triagedPatients++;

        if (evaluation.isCorrect) {
            correctTriages++;
        } else {
            wrongTriages++;
        }

        if (combo > maxCombo) {
            maxCombo = combo;
        }

        const result = {
            success: true,
            patient: patient,
            evaluation: evaluation,
            points: points,
            newScore: score,
            newCombo: combo,
            comboMultiplier: comboMultiplier,
            queueCounts: { ...queueCounts },
            remainingPatients: patientQueue.length,
            triagedPatients: triagedPatients,
            totalPatients: totalPatients
        };

        if (patientQueue.length === 0 || timeRemaining <= 0) {
            stopTimer();
            setState(States.LEVEL_COMPLETE, { result: result });
        }

        return result;
    }

    function undoLastTriage() {
        if (triageHistory.length === 0 || currentState !== States.PLAYING) {
            return null;
        }

        const lastEntry = triageHistory.pop();
        patientQueue.unshift(lastEntry.patient);
        queueCounts[lastEntry.selectedQueue]--;

        score -= lastEntry.points;
        if (score < 0) score = 0;

        if (!lastEntry.isCorrect) {
            wrongTriages--;
        } else {
            correctTriages--;
        }

        triagedPatients--;
        combo = Math.max(0, combo - 1);
        comboMultiplier = calculateComboMultiplier();

        return {
            restoredPatient: lastEntry.patient,
            restoredPoints: -lastEntry.points,
            newScore: score,
            newCombo: combo,
            queueCounts: { ...queueCounts },
            remainingPatients: patientQueue.length
        };
    }

    function updateCombo(isCorrect) {
        if (isCorrect) {
            combo++;
        } else {
            combo = 0;
        }
        comboMultiplier = calculateComboMultiplier();
    }

    function calculateComboMultiplier() {
        for (let i = COMBO_THRESHOLDS.length - 1; i >= 0; i--) {
            if (combo >= COMBO_THRESHOLDS[i]) {
                return COMBO_MULTIPLIERS[i];
            }
        }
        return 1.0;
    }

    function calculatePointsWithCombo(basePoints) {
        return Math.round(basePoints * comboMultiplier);
    }

    function getStateSnapshot() {
        return {
            state: currentState,
            level: currentLevel ? { id: currentLevel.id, name: currentLevel.name } : null,
            levelIndex: currentLevelIndex,
            score: score,
            combo: combo,
            comboMultiplier: comboMultiplier,
            timeRemaining: timeRemaining,
            patientQueue: patientQueue.map(p => ({ id: p.id, name: p.name })),
            queueCounts: { ...queueCounts },
            totalPatients: totalPatients,
            triagedPatients: triagedPatients,
            correctTriages: correctTriages,
            wrongTriages: wrongTriages,
            maxCombo: maxCombo,
            historyLength: triageHistory.length
        };
    }

    function getResults() {
        const accuracy = totalPatients > 0 ? Math.round((correctTriages / totalPatients) * 100) : 0;
        return {
            levelId: currentLevel ? currentLevel.id : null,
            levelName: currentLevel ? currentLevel.name : null,
            score: score,
            totalPatients: totalPatients,
            correctTriages: correctTriages,
            wrongTriages: wrongTriages,
            accuracy: accuracy,
            maxCombo: maxCombo,
            timeUsed: currentLevel ? currentLevel.timeLimit - timeRemaining : 0,
            timeRemaining: timeRemaining,
            avgTimePerPatient: triagedPatients > 0 ? Math.round((currentLevel.timeLimit - timeRemaining) / triagedPatients) : 0
        };
    }

    function getNextLevel() {
        return LevelLoader.loadLevelByIndex(currentLevelIndex + 1);
    }

    function hasNextLevel() {
        return currentLevelIndex + 1 < LevelLoader.getLevelCount();
    }

    function getCurrentPatient() {
        return patientQueue.length > 0 ? patientQueue[0] : null;
    }

    function getPatientQueue() {
        return [...patientQueue];
    }

    function getTriageHistory() {
        return [...triageHistory];
    }

    function returnToMenu() {
        stopTimer();
        setState(States.MENU);
    }

    function reset() {
        stopTimer();
        currentState = States.MENU;
        currentLevel = null;
        currentLevelIndex = 0;
        score = 0;
        combo = 0;
        comboMultiplier = 1.0;
        timeRemaining = 0;
        patientQueue = [];
        triageHistory = [];
        queueCounts = { red: 0, yellow: 0, green: 0, observe: 0 };
        totalPatients = 0;
        triagedPatients = 0;
        correctTriages = 0;
        wrongTriages = 0;
        maxCombo = 0;
    }

    return {
        States,
        getState,
        isPlaying,
        initLevel,
        startGame,
        pauseGame,
        resumeGame,
        triagePatient,
        undoLastTriage,
        getStateSnapshot,
        getResults,
        getNextLevel,
        hasNextLevel,
        getCurrentPatient,
        getPatientQueue,
        getTriageHistory,
        addStateListener,
        returnToMenu,
        reset
    };
})();
