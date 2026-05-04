const API_BASE = '';

async function apiRequest(endpoint, options = {}) {
    const url = API_BASE + endpoint;
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || 'API请求失败');
    }
    
    return data;
}

const API = {
    async getLevels() {
        return apiRequest('/api/levels');
    },
    
    async getLevel(levelId) {
        return apiRequest(`/api/levels/${levelId}`);
    },
    
    async createGame(levelId, playerName) {
        return apiRequest('/api/games', {
            method: 'POST',
            body: JSON.stringify({ levelId, playerName })
        });
    },
    
    async getGame(gameId) {
        return apiRequest(`/api/games/${gameId}`);
    },
    
    async startGame(gameId) {
        return apiRequest(`/api/games/${gameId}/start`, {
            method: 'POST'
        });
    },
    
    async submitSample(gameId, lat, lng, accuracy, isSimulated = false) {
        return apiRequest(`/api/games/${gameId}/sample`, {
            method: 'POST',
            body: JSON.stringify({ lat, lng, accuracy, isSimulated })
        });
    },
    
    async useItem(gameId, itemType) {
        return apiRequest(`/api/games/${gameId}/items`, {
            method: 'POST',
            body: JSON.stringify({ itemType })
        });
    },
    
    async endGame(gameId, status = 'lost') {
        return apiRequest(`/api/games/${gameId}/end`, {
            method: 'POST',
            body: JSON.stringify({ status })
        });
    },
    
    async getReplay(gameId) {
        return apiRequest(`/api/games/${gameId}/replay`);
    },
    
    async getReport(gameId, format = 'json') {
        const url = API_BASE + `/api/games/${gameId}/report?format=${format}`;
        const response = await fetch(url);
        
        if (format === 'json') {
            return response.json();
        }
        
        return response.text();
    },
    
    async health() {
        return apiRequest('/api/health');
    }
};
