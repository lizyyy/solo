import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getHealth = () => api.get('/health');
export const getStats = () => api.get('/stats');

export const getProducts = () => api.get('/products');
export const getProduct = (id) => api.get(`/products/${id}`);
export const createProduct = (data) => api.post('/products', data);

export const getAccounts = () => api.get('/accounts');
export const getAccount = (id) => api.get(`/accounts/${id}`);

export const getHolders = () => api.get('/holders');
export const getHolder = (id) => api.get(`/holders/${id}`);

export const getSubscriptions = () => api.get('/subscriptions');
export const getSubscription = (id) => api.get(`/subscriptions/${id}`);

export const getExpectedPayouts = (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  return api.get(`/expected-payouts?${params.toString()}`);
};
export const getExpectedPayout = (id) => api.get(`/expected-payouts/${id}`);

export const getTransactions = (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) params.append(key, value);
  });
  return api.get(`/transactions?${params.toString()}`);
};
export const getUnmatchedTransactions = (accountId = null) => {
  const params = accountId ? `?account_id=${accountId}` : '';
  return api.get(`/transactions/unmatched${params}`);
};

export const getReconciliations = (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  return api.get(`/reconciliations?${params.toString()}`);
};
export const getReconciliation = (id) => api.get(`/reconciliations/${id}`);

export const getAllocations = (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  return api.get(`/allocations?${params.toString()}`);
};
export const getHolderAllocations = (holderId, filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  return api.get(`/allocations/holder/${holderId}?${params.toString()}`);
};
export const getReconciliationAllocations = (reconciliationId) => 
  api.get(`/allocations/reconciliation/${reconciliationId}`);

export const importProducts = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/import/products', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const importTransactions = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/import/transactions', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const importSubscriptions = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/import/subscriptions', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const importPayoutRules = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/import/payout-rules', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const calculateExpectedPayouts = (subscriptionId = null) => 
  api.post('/calculate/expected-payouts', { subscription_id: subscriptionId });

export const getPayoutDetails = (id) => 
  api.get(`/calculate/payout-details/${id}`);

export const runAutoMatching = (filters = {}) => 
  api.post('/matching/auto', filters);

export const manualMatch = (expectedPayoutId, transactionId) => 
  api.post('/matching/manual', { 
    expected_payout_id: expectedPayoutId, 
    transaction_id: transactionId 
  });

export const unmatch = (reconciliationId) => 
  api.post(`/matching/unmatch/${reconciliationId}`);

export const addManualAdjustment = (reconciliationId, adjustmentNote) => 
  api.post(`/matching/adjustment/${reconciliationId}`, { 
    adjustment_note: adjustmentNote 
  });

export const getMatchingStats = () => 
  api.get('/matching/stats');

export const generateAllocations = (reconciliationId = null) => 
  api.post('/allocations/generate', { reconciliation_id: reconciliationId });

export const validateShareRatios = (productId) => 
  api.get(`/allocations/validate/${productId}`);

export const exportReconciliations = (format = 'json', filters = {}) => {
  const params = new URLSearchParams();
  params.append('format', format);
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  return `/api/export/reconciliations?${params.toString()}`;
};

export const exportHolderAllocations = (holderId, format = 'json', filters = {}) => {
  const params = new URLSearchParams();
  params.append('format', format);
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  return `/api/export/holder/${holderId}?${params.toString()}`;
};

export default api;
