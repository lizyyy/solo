const API_BASE = '/api';

class ApiClient {
    constructor() {
        this.baseUrl = API_BASE;
    }
    
    async request(endpoint, options = {}) {
        const url = this.baseUrl + endpoint;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };
        
        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }
    
    async getHealth() {
        return this.request('/health');
    }
    
    async getBatches(page = 1, perPage = 20, search = '') {
        const params = new URLSearchParams({
            page: page.toString(),
            per_page: perPage.toString()
        });
        if (search) {
            params.append('search', search);
        }
        return this.request(`/batches?${params.toString()}`);
    }
    
    async getBatch(batchId) {
        return this.request(`/batches/${batchId}`);
    }
    
    async getBatchParticles(batchId, options = {}) {
        const params = new URLSearchParams({
            page: (options.page || 1).toString(),
            per_page: (options.perPage || 50).toString()
        });
        
        if (options.classification) {
            params.append('classification', options.classification);
        }
        if (options.riskLevel) {
            params.append('risk_level', options.riskLevel);
        }
        if (options.isReviewed !== undefined) {
            params.append('is_reviewed', options.isReviewed.toString());
        }
        if (options.search) {
            params.append('search', options.search);
        }
        
        return this.request(`/batches/${batchId}/particles?${params.toString()}`);
    }
    
    async getParticle(particleId) {
        return this.request(`/particles/${particleId}`);
    }
    
    async reviewParticle(particleId, data) {
        return this.request(`/particles/${particleId}/review`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    async flagParticle(particleId, isFlagged) {
        return this.request(`/particles/${particleId}/flag`, {
            method: 'POST',
            body: JSON.stringify({ is_flagged: isFlagged })
        });
    }
    
    async importData(formData) {
        const response = await fetch(`${this.baseUrl}/batches/import`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        
        return data;
    }
    
    async importExamples() {
        const formData = new FormData();
        formData.append('user', 'system');
        
        const response = await fetch(`${this.baseUrl}/batches/import-examples`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }
        
        return data;
    }
    
    async deleteBatch(batchId) {
        return this.request(`/batches/${batchId}`, {
            method: 'DELETE'
        });
    }
    
    async previewReport(batchId, format) {
        return this.request(`/exports/${batchId}/preview?format=${format}`);
    }
    
    getExportUrl(batchId, type) {
        const endpoints = {
            markdown: '/exports/{batchId}/quality-report',
            csv: '/exports/{batchId}/risk-list',
            json: '/exports/{batchId}/audit-package'
        };
        return this.baseUrl + endpoints[type].replace('{batchId}', batchId);
    }
}

const api = new ApiClient();
