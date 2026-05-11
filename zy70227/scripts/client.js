const http = require('http');

class APIClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}${path}`);
      
      const options = {
        hostname: url.hostname,
        port: url.port || 3000,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const response = data ? JSON.parse(data) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(response);
            } else {
              reject({ status: res.statusCode, response });
            }
          } catch (e) {
            reject({ status: res.statusCode, error: e.message, raw: data });
          }
        });
      });

      req.on('error', (e) => {
        reject({ error: e.message });
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  get(path) { return this.request('GET', path); }
  post(path, body) { return this.request('POST', path, body); }
  put(path, body) { return this.request('PUT', path, body); }
  delete(path) { return this.request('DELETE', path); }

  async createRoom(data) { return this.post('/api/rooms', data); }
  async getRooms() { return this.get('/api/rooms'); }
  async getRoom(id) { return this.get(`/api/rooms/${id}`); }

  async createDevice(data) { return this.post('/api/devices', data); }
  async getDevices() { return this.get('/api/devices'); }

  async createInterpreter(data) { return this.post('/api/interpreters', data); }
  async getInterpreters() { return this.get('/api/interpreters'); }

  async createConference(data) { return this.post('/api/conferences', data); }
  async getConference(id) { return this.get(`/api/conferences/${id}`); }
  async startConference(id) { return this.post(`/api/conferences/${id}/start`); }

  async createChannel(data) { return this.post('/api/channels', data); }
  async getConferenceChannels(conferenceId) { return this.get(`/api/channels/conference/${conferenceId}`); }

  async createSchedule(data) { return this.post('/api/schedules', data); }
  async getConferenceSchedules(conferenceId) { return this.get(`/api/schedules/conference/${conferenceId}`); }
  async confirmSchedule(id) { return this.post(`/api/schedules/${id}/confirm`); }
  async startSchedule(id) { return this.post(`/api/schedules/${id}/start`); }
  async completeSchedule(id) { return this.post(`/api/schedules/${id}/complete`); }

  async getDashboard() { return this.get('/api/reports/dashboard'); }
  async getConferenceDashboard(conferenceId) { return this.get(`/api/reports/conference/${conferenceId}`); }
  async checkConflicts(startTime, endTime) {
    return this.get(`/api/reports/conflicts?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`);
  }
}

module.exports = APIClient;
