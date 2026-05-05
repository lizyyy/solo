const API = {
    baseUrl: window.location.origin,

    async getLocations() {
        const response = await fetch(`${this.baseUrl}/api/locations`);
        return response.json();
    },

    async getCustomers() {
        const response = await fetch(`${this.baseUrl}/api/customers`);
        return response.json();
    },

    async getCustomer(id) {
        const response = await fetch(`${this.baseUrl}/api/customers/${id}`);
        return response.json();
    },

    async createCustomer(data) {
        const response = await fetch(`${this.baseUrl}/api/customers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    },

    async updateCustomer(id, data) {
        const response = await fetch(`${this.baseUrl}/api/customers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    },

    async getTireSets(params = {}) {
        const query = new URLSearchParams(params).toString();
        const url = query ? `${this.baseUrl}/api/tire-sets?${query}` : `${this.baseUrl}/api/tire-sets`;
        const response = await fetch(url);
        return response.json();
    },

    async getTireSet(id) {
        const response = await fetch(`${this.baseUrl}/api/tire-sets/${id}`);
        return response.json();
    },

    async createTireSet(data) {
        const response = await fetch(`${this.baseUrl}/api/tire-sets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    },

    async updateTireSet(id, data) {
        const response = await fetch(`${this.baseUrl}/api/tire-sets/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    },

    async getInspections(tireSetId) {
        const response = await fetch(`${this.baseUrl}/api/inspections?tireSetId=${tireSetId}`);
        return response.json();
    },

    async createInspection(data) {
        const response = await fetch(`${this.baseUrl}/api/inspections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    },

    async getAppointments(params = {}) {
        const query = new URLSearchParams(params).toString();
        const url = query ? `${this.baseUrl}/api/appointments?${query}` : `${this.baseUrl}/api/appointments`;
        const response = await fetch(url);
        return response.json();
    },

    async getAppointment(id) {
        const response = await fetch(`${this.baseUrl}/api/appointments/${id}`);
        return response.json();
    },

    async createAppointment(data) {
        const response = await fetch(`${this.baseUrl}/api/appointments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    },

    async updateAppointment(id, data) {
        const response = await fetch(`${this.baseUrl}/api/appointments/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    },

    async checkAppointmentRisks(appointmentId) {
        const response = await fetch(`${this.baseUrl}/api/appointments/${appointmentId}/check-risks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        return response.json();
    },

    async getReviews(appointmentId) {
        const response = await fetch(`${this.baseUrl}/api/reviews/${appointmentId}`);
        return response.json();
    },

    async saveReview(data) {
        const response = await fetch(`${this.baseUrl}/api/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    },

    exportMarkdown(appointmentId) {
        window.open(`${this.baseUrl}/api/export/markdown/${appointmentId}`, '_blank');
    },

    exportJson(appointmentId) {
        window.open(`${this.baseUrl}/api/export/json/${appointmentId}`, '_blank');
    }
};

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}
