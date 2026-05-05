const OriginServer = require('../origin');

describe('OriginServer', () => {
  let server;

  beforeEach(() => {
    server = new OriginServer();
  });

  describe('资源管理', () => {
    test('应该能够添加和获取资源', () => {
      const resource = {
        path: '/test',
        body: 'test content',
        contentType: 'text/plain',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      };

      server.addResource(resource);
      const retrieved = server.getResource('/test');
      
      expect(retrieved).toEqual(resource);
    });

    test('获取不存在的资源应该返回 undefined', () => {
      const resource = server.getResource('/nonexistent');
      expect(resource).toBeUndefined();
    });
  });

  describe('正常请求', () => {
    test('应该返回 200 OK 和资源内容', () => {
      server.addResource({
        path: '/test',
        body: 'Hello World',
        contentType: 'text/plain',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      });

      const request = {
        method: 'GET',
        path: '/test',
        headers: {},
        body: ''
      };

      const response = server.handleRequest(request);

      expect(response.statusCode).toBe(200);
      expect(response.statusText).toBe('OK');
      expect(response.body).toBe('Hello World');
      expect(response.headers['ETag']).toBe('"abc123"');
      expect(response.headers['Cache-Control']).toBe('public, max-age=3600');
    });

    test('不存在的资源应该返回 404', () => {
      const request = {
        method: 'GET',
        path: '/nonexistent',
        headers: {},
        body: ''
      };

      const response = server.handleRequest(request);

      expect(response.statusCode).toBe(404);
      expect(response.statusText).toBe('Not Found');
    });
  });

  describe('条件请求 - If-None-Match', () => {
    test('ETag 匹配时应该返回 304 Not Modified', () => {
      server.addResource({
        path: '/test',
        body: 'content',
        contentType: 'text/plain',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      });

      const request = {
        method: 'GET',
        path: '/test',
        headers: {
          'If-None-Match': '"abc123"'
        },
        body: ''
      };

      const response = server.handleRequest(request);

      expect(response.statusCode).toBe(304);
      expect(response.statusText).toBe('Not Modified');
      expect(response.body).toBe('');
    });

    test('ETag 不匹配时应该返回 200', () => {
      server.addResource({
        path: '/test',
        body: 'content',
        contentType: 'text/plain',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      });

      const request = {
        method: 'GET',
        path: '/test',
        headers: {
          'If-None-Match': '"different"'
        },
        body: ''
      };

      const response = server.handleRequest(request);

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe('content');
    });
  });

  describe('条件请求 - If-Modified-Since', () => {
    test('资源未修改时应该返回 304', () => {
      server.addResource({
        path: '/test',
        body: 'content',
        contentType: 'text/plain',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      });

      const request = {
        method: 'GET',
        path: '/test',
        headers: {
          'If-Modified-Since': 'Wed, 21 Oct 2020 08:28:00 GMT'
        },
        body: ''
      };

      const response = server.handleRequest(request);

      expect(response.statusCode).toBe(304);
    });

    test('资源已修改时应该返回 200', () => {
      server.addResource({
        path: '/test',
        body: 'content',
        contentType: 'text/plain',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      });

      const request = {
        method: 'GET',
        path: '/test',
        headers: {
          'If-Modified-Since': 'Wed, 21 Oct 2020 06:28:00 GMT'
        },
        body: ''
      };

      const response = server.handleRequest(request);

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe('content');
    });
  });

  describe('条件请求 - If-Match', () => {
    test('ETag 匹配时应该返回 200', () => {
      server.addResource({
        path: '/test',
        body: 'content',
        contentType: 'text/plain',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      });

      const request = {
        method: 'PUT',
        path: '/test',
        headers: {
          'If-Match': '"abc123"'
        },
        body: 'updated'
      };

      const response = server.handleRequest(request);

      expect(response.statusCode).toBe(200);
    });

    test('ETag 不匹配时应该返回 412 Precondition Failed', () => {
      server.addResource({
        path: '/test',
        body: 'content',
        contentType: 'text/plain',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      });

      const request = {
        method: 'PUT',
        path: '/test',
        headers: {
          'If-Match': '"different"'
        },
        body: 'updated'
      };

      const response = server.handleRequest(request);

      expect(response.statusCode).toBe(412);
      expect(response.statusText).toBe('Precondition Failed');
    });
  });

  describe('Range 请求', () => {
    test('应该返回 206 Partial Content', () => {
      server.addResource({
        path: '/test',
        body: 'ABCDEFGHIJ',
        contentType: 'text/plain',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      });

      const request = {
        method: 'GET',
        path: '/test',
        headers: {
          'Range': 'bytes=0-4'
        },
        body: ''
      };

      const response = server.handleRequest(request);

      expect(response.statusCode).toBe(206);
      expect(response.statusText).toBe('Partial Content');
      expect(response.body).toBe('ABCDE');
      expect(response.headers['Content-Range']).toBe('bytes 0-4/10');
    });

    test('无效的 Range 应该返回 416', () => {
      server.addResource({
        path: '/test',
        body: 'ABCDEFGHIJ',
        contentType: 'text/plain',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      });

      const request = {
        method: 'GET',
        path: '/test',
        headers: {
          'Range': 'bytes=20-30'
        },
        body: ''
      };

      const response = server.handleRequest(request);

      expect(response.statusCode).toBe(416);
      expect(response.statusText).toBe('Range Not Satisfiable');
    });
  });

  describe('重定向', () => {
    test('应该返回 301 重定向', () => {
      server.addResource({
        path: '/old',
        body: '',
        contentType: 'text/html',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'no-cache',
        vary: '',
        redirect: {
          statusCode: 301,
          statusText: 'Moved Permanently',
          location: '/new'
        }
      });

      const request = {
        method: 'GET',
        path: '/old',
        headers: {},
        body: ''
      };

      const response = server.handleRequest(request);

      expect(response.statusCode).toBe(301);
      expect(response.statusText).toBe('Moved Permanently');
      expect(response.headers['Location']).toBe('/new');
    });
  });

  describe('请求追踪', () => {
    test('应该记录所有请求和响应', () => {
      server.addResource({
        path: '/test',
        body: 'content',
        contentType: 'text/plain',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      });

      expect(server.getRequests().length).toBe(0);

      server.handleRequest({
        method: 'GET',
        path: '/test',
        headers: {},
        body: ''
      });

      const requests = server.getRequests();
      expect(requests.length).toBeGreaterThan(0);
      expect(requests[0].component).toBe('origin');
    });

    test('应该能够清除请求记录', () => {
      server.addResource({
        path: '/test',
        body: 'content',
        contentType: 'text/plain',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      });

      server.handleRequest({
        method: 'GET',
        path: '/test',
        headers: {},
        body: ''
      });

      expect(server.getRequests().length).toBeGreaterThan(0);

      server.clearRequests();

      expect(server.getRequests().length).toBe(0);
    });
  });
});
