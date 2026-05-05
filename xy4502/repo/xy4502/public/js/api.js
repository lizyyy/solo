const API = {
    async getMuseums() {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/museums`);
        return response.json();
    },

    async getSaves() {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/saves`);
        return response.json();
    },

    async initGame(museumFile = 'sample-museum.json') {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/game/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ museumFile })
        });
        return response.json();
    },

    async getGameState(gameId) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/game/${gameId}`);
        return response.json();
    },

    async movePlayer(gameId, patrolPointId) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/game/${gameId}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patrolPointId })
        });
        return response.json();
    },

    async dispatchGuard(gameId, eventId) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/game/${gameId}/dispatch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId })
        });
        return response.json();
    },

    async lockZone(gameId, eventId) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/game/${gameId}/lock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId })
        });
        return response.json();
    },

    async tickGame(gameId, deltaTime = 1) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/game/${gameId}/tick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deltaTime })
        });
        return response.json();
    },

    async saveGame(gameId, saveName) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/game/${gameId}/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ saveName })
        });
        return response.json();
    },

    async loadGame(saveId) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/game/load`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ saveId })
        });
        return response.json();
    },

    async exportReport(gameId) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/game/${gameId}/export`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        return response.json();
    },

    async uploadMuseum(museumData, name) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/museum/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ museumData, name })
        });
        return response.json();
    }
};
