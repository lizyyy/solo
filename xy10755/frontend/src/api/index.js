import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
})

export const orderApi = {
  create: (data) => api.post('/orders/', data),
  list: (params) => api.get('/orders/', { params }),
  detail: (id) => api.get(`/orders/${id}`),
  split: (data) => api.post('/orders/split/', data)
}

export const fulfillmentApi = {
  list: (params) => api.get('/fulfillment-records/', { params }),
  changeWarehouse: (data) => api.post('/fulfillment/change-warehouse/', data),
  correctShipping: (data) => api.post('/fulfillment/correct-shipping/', data),
  finalize: (id) => api.post(`/fulfillment/${id}/finalize/`)
}

export const warehouseApi = {
  list: () => api.get('/warehouses/'),
  inventories: (params) => api.get('/inventories/', { params })
}

export const changeLogApi = {
  list: (params) => api.get('/warehouse-change-logs/', { params })
}

export const initApi = {
  initSample: () => api.post('/init-sample-data/')
}

export default api
