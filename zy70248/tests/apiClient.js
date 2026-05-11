const http = require('http');

class APIClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + path);
      
      const options = {
        hostname: url.hostname,
        port: url.port || 80,
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
              reject({
                statusCode: res.statusCode,
                response: response
              });
            }
          } catch (e) {
            reject({
              statusCode: res.statusCode,
              response: data,
              error: e
            });
          }
        });
      });

      req.on('error', (e) => {
        reject(e);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  get(path) {
    return this.request('GET', path);
  }

  post(path, body = null) {
    return this.request('POST', path, body);
  }

  put(path, body = null) {
    return this.request('PUT', path, body);
  }

  delete(path) {
    return this.request('DELETE', path);
  }
}

module.exports = APIClient;
