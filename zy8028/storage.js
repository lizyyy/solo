const Storage = (function() {
    const STORAGE_KEYS = {
        GAME_STATE: 'emergency_triage_game_state',
        LEADERBOARD: 'emergency_triage_leaderboard',
        SETTINGS: 'emergency_triage_settings',
        PLAYER_NAME: 'emergency_triage_player_name'
    };

    const LEADERBOARD_SIZE = 10;

    function saveGameState(state) {
        try {
            const snapshot = GameState.getStateSnapshot();
            const saveData = {
                ...snapshot,
                savedAt: Date.now()
            };
            localStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify(saveData));
            return true;
        } catch (e) {
            console.error('Failed to save game state:', e);
            return false;
        }
    }

    function loadGameState() {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
            if (!saved) return null;

            const data = JSON.parse(saved);
            const age = Date.now() - data.savedAt;
            const maxAge = 24 * 60 * 60 * 1000;

            if (age > maxAge) {
                clearGameState();
                return null;
            }

            return data;
        } catch (e) {
            console.error('Failed to load game state:', e);
            return null;
        }
    }

    function clearGameState() {
        try {
            localStorage.removeItem(STORAGE_KEYS.GAME_STATE);
            return true;
        } catch (e) {
            console.error('Failed to clear game state:', e);
            return false;
        }
    }

    function hasSavedGame() {
        return loadGameState() !== null;
    }

    function saveScore(results) {
        try {
            const leaderboard = getLeaderboard();
            const playerName = getPlayerName();

            const entry = {
                name: playerName || '匿名玩家',
                score: results.score,
                levelName: results.levelName || '未知关卡',
                accuracy: results.accuracy,
                maxCombo: results.maxCombo,
                date: Date.now()
            };

            leaderboard.push(entry);
            leaderboard.sort((a, b) => b.score - a.score);

            if (leaderboard.length > LEADERBOARD_SIZE * 3) {
                const trimmed = [];
                for (let i = 0; i < LEADERBOARD_SIZE; i++) {
                    const levelEntries = leaderboard.filter(e => e.levelName === leaderboard[i].levelName);
                    if (levelEntries.length <= 3) {
                        if (!trimmed.includes(leaderboard[i])) {
                            trimmed.push(leaderboard[i]);
                        }
                    }
                }
                localStorage.setItem(STORAGE_KEYS.LEADERBOARD, JSON.stringify(trimmed.slice(0, LEADERBOARD_SIZE)));
            } else {
                localStorage.setItem(STORAGE_KEYS.LEADERBOARD, JSON.stringify(leaderboard.slice(0, LEADERBOARD_SIZE * 3)));
            }

            return true;
        } catch (e) {
            console.error('Failed to save score:', e);
            return false;
        }
    }

    function getLeaderboard(levelName = null) {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.LEADERBOARD);
            if (!saved) return [];

            let leaderboard = JSON.parse(saved);

            if (levelName) {
                leaderboard = leaderboard.filter(entry => entry.levelName === levelName);
            }

            leaderboard.sort((a, b) => b.score - a.score);

            return leaderboard.slice(0, LEADERBOARD_SIZE);
        } catch (e) {
            console.error('Failed to get leaderboard:', e);
            return [];
        }
    }

    function getAllLeaderboardEntries() {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.LEADERBOARD);
            if (!saved) return {};

            const all = JSON.parse(saved);
            const grouped = {};

            all.forEach(entry => {
                if (!grouped[entry.levelName]) {
                    grouped[entry.levelName] = [];
                }
                grouped[entry.levelName].push(entry);
            });

            Object.keys(grouped).forEach(levelName => {
                grouped[levelName].sort((a, b) => b.score - a.score);
                grouped[levelName] = grouped[levelName].slice(0, LEADERBOARD_SIZE);
            });

            return grouped;
        } catch (e) {
            console.error('Failed to get all leaderboard entries:', e);
            return {};
        }
    }

    function clearLeaderboard() {
        try {
            localStorage.removeItem(STORAGE_KEYS.LEADERBOARD);
            return true;
        } catch (e) {
            console.error('Failed to clear leaderboard:', e);
            return false;
        }
    }

    function setPlayerName(name) {
        try {
            localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, name);
            return true;
        } catch (e) {
            console.error('Failed to set player name:', e);
            return false;
        }
    }

    function getPlayerName() {
        try {
            return localStorage.getItem(STORAGE_KEYS.PLAYER_NAME);
        } catch (e) {
            return null;
        }
    }

    function saveSettings(settings) {
        try {
            localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
            return true;
        } catch (e) {
            console.error('Failed to save settings:', e);
            return false;
        }
    }

    function loadSettings() {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
            if (!saved) return getDefaultSettings();
            return { ...getDefaultSettings(), ...JSON.parse(saved) };
        } catch (e) {
            console.error('Failed to load settings:', e);
            return getDefaultSettings();
        }
    }

    function getDefaultSettings() {
        return {
            soundEnabled: true,
            vibrationEnabled: true,
            showHints: true
        };
    }

    function getHighScore(levelName = null) {
        const leaderboard = getLeaderboard(levelName);
        if (leaderboard.length === 0) return 0;
        return leaderboard[0].score;
    }

    function isTopScore(score, levelName = null) {
        const leaderboard = getLeaderboard(levelName);
        if (leaderboard.length < LEADERBOARD_SIZE) return true;
        return score > leaderboard[leaderboard.length - 1].score;
    }

    return {
        saveGameState,
        loadGameState,
        clearGameState,
        hasSavedGame,
        saveScore,
        getLeaderboard,
        getAllLeaderboardEntries,
        clearLeaderboard,
        setPlayerName,
        getPlayerName,
        saveSettings,
        loadSettings,
        getHighScore,
        isTopScore,
        STORAGE_KEYS
    };
})();
