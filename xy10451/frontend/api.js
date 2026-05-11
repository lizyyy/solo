const API_BASE = 'http://localhost:8001/api';

async function apiRequest(url, options = {}) {
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };

    const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/plain')) {
        return await response.text();
    }

    return await response.json();
}

const api = {
    health: () => apiRequest('/health'),

    getMerchants: () => apiRequest('/merchants'),
    getMerchant: (id) => apiRequest(`/merchants/${id}`),
    createMerchant: (data) => apiRequest('/merchants', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    updateMerchant: (id, data) => apiRequest(`/merchants/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),

    getResources: () => apiRequest('/resources'),
    getResource: (id) => apiRequest(`/resources/${id}`),
    createResource: (data) => apiRequest('/resources', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    updateResource: (id, data) => apiRequest(`/resources/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),

    getFaults: (isResolved = null) => {
        const url = isResolved !== null
            ? `/faults?is_resolved=${isResolved}`
            : '/faults';
        return apiRequest(url);
    },
    createFault: (data) => apiRequest('/faults', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    updateFault: (id, data) => apiRequest(`/faults/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),

    getReservations: (params = {}) => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                searchParams.set(key, value);
            }
        });
        const queryString = searchParams.toString();
        const url = queryString ? `/reservations?${queryString}` : '/reservations';
        return apiRequest(url);
    },
    getReservation: (id) => apiRequest(`/reservations/${id}`),
    validateReservation: (data) => apiRequest('/reservations/validate', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    createReservation: (data) => apiRequest('/reservations', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    updateReservation: (id, data) => apiRequest(`/reservations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    reassignReservation: (id, newResourceId) => apiRequest(`/reservations/${id}/reassign?new_resource_id=${newResourceId}`, {
        method: 'POST',
    }),

    getCleaningWindows: (date = null, resourceId = null) => {
        const params = new URLSearchParams();
        if (date) params.set('target_date', date);
        if (resourceId) params.set('resource_id', resourceId);
        const queryString = params.toString();
        const url = queryString ? `/cleaning-windows?${queryString}` : '/cleaning-windows';
        return apiRequest(url);
    },
    createCleaningWindow: (data) => apiRequest('/cleaning-windows', {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    getOvertimeRecords: (reservationId = null) => {
        const url = reservationId
            ? `/overtime?reservation_id=${reservationId}`
            : '/overtime';
        return apiRequest(url);
    },
    recordOvertime: (data) => apiRequest('/overtime/record', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    updateOvertime: (id, data) => apiRequest(`/overtime/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),

    getMerchantFees: (date = null, merchantId = null) => {
        const params = new URLSearchParams();
        if (date) params.set('target_date', date);
        if (merchantId) params.set('merchant_id', merchantId);
        const queryString = params.toString();
        const url = queryString ? `/merchant-fees?${queryString}` : '/merchant-fees';
        return apiRequest(url);
    },
    createMerchantFee: (data) => apiRequest('/merchant-fees', {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    getKanban: (date = null) => {
        const url = date ? `/kanban?target_date=${date}` : '/kanban';
        return apiRequest(url);
    },

    exportSchedule: (date = null) => {
        const url = date ? `/export/schedule?target_date=${date}` : '/export/schedule';
        return apiRequest(url);
    },

    loadSampleData: () => apiRequest('/seed/sample-data', {
        method: 'POST',
    }),
};
