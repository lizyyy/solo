const Storage = {
    STORAGE_KEY: 'railway_puzzle',

    load() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Failed to load data:', e);
            return null;
        }
    },

    save(data) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Failed to save data:', e);
            return false;
        }
    },

    getBestMoves(levelId) {
        const data = this.load();
        if (data && data.bestMoves && data.bestMoves[levelId]) {
            return data.bestMoves[levelId];
        }
        return null;
    },

    setBestMoves(levelId, moves) {
        const data = this.load() || { bestMoves: {} };
        if (!data.bestMoves) {
            data.bestMoves = {};
        }
        const currentBest = data.bestMoves[levelId];
        if (currentBest === null || moves < currentBest) {
            data.bestMoves[levelId] = moves;
            this.save(data);
            return true;
        }
        return false;
    },

    getAllBestMoves() {
        const data = this.load();
        return data && data.bestMoves ? data.bestMoves : {};
    }
};
