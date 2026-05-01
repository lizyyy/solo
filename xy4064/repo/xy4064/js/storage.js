const Storage = {
    STORAGE_KEYS: {
        HIGH_SCORES: 'syncBeat_highScores',
        CUSTOM_CHARTS: 'syncBeat_customCharts',
        SETTINGS: 'syncBeat_settings'
    },

    isAvailable: function() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    },

    save: function(key, data) {
        if (!this.isAvailable()) {
            console.warn('localStorage is not available');
            return false;
        }

        try {
            const jsonString = JSON.stringify(data);
            localStorage.setItem(key, jsonString);
            return true;
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
            return false;
        }
    },

    load: function(key, defaultValue = null) {
        if (!this.isAvailable()) {
            console.warn('localStorage is not available');
            return defaultValue;
        }

        try {
            const jsonString = localStorage.getItem(key);
            if (jsonString === null) {
                return defaultValue;
            }
            return JSON.parse(jsonString);
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
            return defaultValue;
        }
    },

    remove: function(key) {
        if (!this.isAvailable()) {
            return false;
        }

        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Failed to remove from localStorage:', e);
            return false;
        }
    },

    clearAll: function() {
        if (!this.isAvailable()) {
            return false;
        }

        try {
            for (const key of Object.values(this.STORAGE_KEYS)) {
                localStorage.removeItem(key);
            }
            return true;
        } catch (e) {
            console.error('Failed to clear localStorage:', e);
            return false;
        }
    },

    getHighScores: function() {
        return this.load(this.STORAGE_KEYS.HIGH_SCORES, {});
    },

    getHighScore: function(chartId) {
        const highScores = this.getHighScores();
        return highScores[chartId] || 0;
    },

    saveHighScore: function(chartId, score) {
        const highScores = this.getHighScores();
        const currentHighScore = highScores[chartId] || 0;

        if (score > currentHighScore) {
            highScores[chartId] = score;
            this.save(this.STORAGE_KEYS.HIGH_SCORES, highScores);
            return true;
        }
        return false;
    },

    saveGameResult: function(chartId, stats) {
        const highScores = this.getHighScores();
        const currentHighScore = highScores[chartId] || 0;

        if (stats.score > currentHighScore) {
            highScores[chartId] = stats.score;
            this.save(this.STORAGE_KEYS.HIGH_SCORES, highScores);
            return { isNewHighScore: true, previousHighScore: currentHighScore };
        }

        return { isNewHighScore: false, previousHighScore: currentHighScore };
    },

    getCustomCharts: function() {
        return this.load(this.STORAGE_KEYS.CUSTOM_CHARTS, []);
    },

    saveCustomChart: function(chart) {
        if (!chart || !chart.id) {
            return false;
        }

        const customCharts = this.getCustomCharts();
        const existingIndex = customCharts.findIndex(c => c.id === chart.id);

        if (existingIndex >= 0) {
            customCharts[existingIndex] = chart;
        } else {
            customCharts.push(chart);
        }

        return this.save(this.STORAGE_KEYS.CUSTOM_CHARTS, customCharts);
    },

    deleteCustomChart: function(chartId) {
        const customCharts = this.getCustomCharts();
        const index = customCharts.findIndex(c => c.id === chartId);

        if (index >= 0) {
            customCharts.splice(index, 1);
            return this.save(this.STORAGE_KEYS.CUSTOM_CHARTS, customCharts);
        }
        return false;
    },

    getCustomChartById: function(chartId) {
        const customCharts = this.getCustomCharts();
        return customCharts.find(c => c.id === chartId);
    },

    getAllCharts: function() {
        const builtInCharts = Chart.getBuiltInCharts();
        const customCharts = this.getCustomCharts();
        
        return {
            builtIn: builtInCharts,
            custom: customCharts,
            all: [...builtInCharts, ...customCharts]
        };
    },

    getSettings: function() {
        return this.load(this.STORAGE_KEYS.SETTINGS, {
            noteSpeed: 400,
            soundEnabled: true,
            backgroundOpacity: 0.8
        });
    },

    saveSettings: function(settings) {
        const currentSettings = this.getSettings();
        const updatedSettings = { ...currentSettings, ...settings };
        return this.save(this.STORAGE_KEYS.SETTINGS, updatedSettings);
    },

    exportData: function() {
        const data = {
            highScores: this.getHighScores(),
            customCharts: this.getCustomCharts(),
            settings: this.getSettings(),
            exportDate: new Date().toISOString()
        };

        return JSON.stringify(data, null, 2);
    },

    importData: function(jsonString) {
        try {
            const data = JSON.parse(jsonString);

            if (data.highScores) {
                this.save(this.STORAGE_KEYS.HIGH_SCORES, data.highScores);
            }

            if (data.customCharts && Array.isArray(data.customCharts)) {
                this.save(this.STORAGE_KEYS.CUSTOM_CHARTS, data.customCharts);
            }

            if (data.settings) {
                this.save(this.STORAGE_KEYS.SETTINGS, data.settings);
            }

            return true;
        } catch (e) {
            console.error('Failed to import data:', e);
            return false;
        }
    }
};
