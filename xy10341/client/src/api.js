import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const getLocations = () => API.get('/locations');
export const getTags = () => API.get('/tags');
export const getResidents = () => API.get('/residents');
export const getBooks = (params) => API.get('/books', { params });
export const getBookDetail = (id) => API.get(`/books/${id}`);
export const createBook = (data) => API.post('/books', data);
export const borrowBook = (data) => API.post('/borrow', data);
export const returnBook = (data) => API.post('/return', data);
export const markLost = (id, data) => API.post(`/books/${id}/mark-lost`, data);
export const compensate = (data) => API.post('/compensate', data);
export const getOverdue = () => API.get('/overdue');

export const exportInventory = () => {
  window.open('/api/export/inventory', '_blank');
};

export const exportFlow = () => {
  window.open('/api/export/flow', '_blank');
};

export default API;
