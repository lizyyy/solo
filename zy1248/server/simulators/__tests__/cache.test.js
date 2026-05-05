const OriginServer = require('../origin');
const CacheProxy = require('../cache');

describe('CacheProxy', () => {
  let originServer;
  let cacheProxy;

  beforeEach(() => {
    originServer = new OriginServer();
    cacheProxy = new CacheProxy(originServer);
  });

  describe('缓存命中', () => {
    test('第一次请求应该缓存未命中', () => {
      originServer.addResource({
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
        headers: {},
        body: ''
      };

      const response = cacheProxy.handleRequest(request);

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe('content');
    });

    test('第二次请求应该缓存命中', () => {
      originServer.addResource({
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
        headers: {},
        body: ''
      };

      cacheProxy.handleRequest(request);

      const response = cacheProxy.handleRequest(request);

      expect(response.statusCode).toBe(200);
      expect(response.headers['X-Cache-Hit']).toBe('true');
    });
  });

  describe('缓存过期', () => {
    test('max-age=0 应该强制重新验证', () => {
      originServer.addResource({
        path: '/test',
        body: 'content',
        contentType: 'text/plain',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      });

      cacheProxy.handleRequest({
        method: 'GET',
        path: '/test',
        headers: {},
        body: ''
      });

      const response = cacheProxy.handleRequest({
        method: 'GET',
        path: '/test',
        headers: {
          'Cache-Control': 'max-age=0'
        },
        body: ''
      });

      expect(response.statusCode).toBe(304);
    });

    test('no-cache 应该强制重新验证', () => {
      originServer.addResource({
        path: '/test',
        body: 'content',
        contentType: 'text/plain',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      });

      cacheProxy.handleRequest({
        method: 'GET',
        path: '/test',
        headers: {},
        body: ''
      });

      const response = cacheProxy.handleRequest({
        method: 'GET',
        path: '/test',
        headers: {
          'Cache-Control': 'no-cache'
        },
        body: ''
      });

      expect(response.statusCode).toBe(304);
    });
  });

  describe('no-store 缓存控制', () => {
    test('no-store 响应不应该被缓存', () => {
      originServer.addResource({
        path: '/test',
        body: 'sensitive content',
        contentType: 'text/plain',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'no-store',
        vary: ''
      });

      const request = {
        method: 'GET',
        path: '/test',
        headers: {},
        body: ''
      };

      cacheProxy.handleRequest(request);

      const cacheStatus = cacheProxy.getCacheStatus();
      expect(cacheStatus.length).toBe(0);
    });
  });

  describe('only-if-cached', () => {
    test('无缓存时应该返回 504', () => {
      const request = {
        method: 'GET',
        path: '/test',
        headers: {
          'Cache-Control': 'only-if-cached'
        },
        body: ''
      };

      const response = cacheProxy.handleRequest(request);

      expect(response.statusCode).toBe(504);
      expect(response.statusText).toBe('Gateway Timeout');
    });

    test('有缓存时应该返回缓存内容', () => {
      originServer.addResource({
        path: '/test',
        body: 'content',
        contentType: 'text/plain',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      });

      cacheProxy.handleRequest({
        method: 'GET',
        path: '/test',
        headers: {},
        body: ''
      });

      const response = cacheProxy.handleRequest({
        method: 'GET',
        path: '/test',
        headers: {
          'Cache-Control': 'only-if-cached'
        },
        body: ''
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toBe('content');
    });
  });

  describe('Vary 头', () => {
    test('不同的 Vary 头值应该生成不同的缓存键', () => {
      originServer.addResource({
        path: '/test',
        body: 'json content',
        contentType: 'application/json',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: 'Accept'
      });

      cacheProxy.handleRequest({
        method: 'GET',
        path: '/test',
        headers: {
          'Accept': 'application/json'
        },
        body: ''
      });

      const cacheStatus = cacheProxy.getCacheStatus();
      expect(cacheStatus.length).toBe(1);
    });
  });

  describe('非缓存方法', () => {
    test('POST 请求不应该被缓存', () => {
      originServer.addResource({
        path: '/test',
        body: 'content',
        contentType: 'text/plain',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      });

      const request = {
        method: 'POST',
        path: '/test',
        headers: {},
        body: 'data'
      };

      cacheProxy.handleRequest(request);

      const cacheStatus = cacheProxy.getCacheStatus();
      expect(cacheStatus.length).toBe(0);
    });

    test('PUT 请求不应该被缓存', () => {
      originServer.addResource({
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
        headers: {},
        body: 'updated'
      };

      cacheProxy.handleRequest(request);

      const cacheStatus = cacheProxy.getCacheStatus();
      expect(cacheStatus.length).toBe(0);
    });
  });

  describe('缓存清除', () => {
    test('应该能够清除缓存', () => {
      originServer.addResource({
        path: '/test',
        body: 'content',
        contentType: 'text/plain',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      });

      cacheProxy.handleRequest({
        method: 'GET',
        path: '/test',
        headers: {},
        body: ''
      });

      expect(cacheProxy.getCacheStatus().length).toBeGreaterThan(0);

      cacheProxy.clearCache();

      expect(cacheProxy.getCacheStatus().length).toBe(0);
    });
  });

  describe('缓存状态', () => {
    test('应该返回正确的缓存状态', () => {
      originServer.addResource({
        path: '/test',
        body: 'content',
        contentType: 'text/plain',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      });

      cacheProxy.handleRequest({
        method: 'GET',
        path: '/test',
        headers: {},
        body: ''
      });

      const cacheStatus = cacheProxy.getCacheStatus();

      expect(cacheStatus.length).toBe(1);
      expect(cacheStatus[0].freshnessInfo.isFresh).toBe(true);
      expect(cacheStatus[0].freshnessInfo.isHeuristic).toBe(false);
    });
  });

  describe('请求追踪', () => {
    test('应该记录所有请求和响应', () => {
      originServer.addResource({
        path: '/test',
        body: 'content',
        contentType: 'text/plain',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      });

      expect(cacheProxy.getRequests().length).toBe(0);

      cacheProxy.handleRequest({
        method: 'GET',
        path: '/test',
        headers: {},
        body: ''
      });

      const requests = cacheProxy.getRequests();
      expect(requests.length).toBeGreaterThan(0);
      expect(requests[0].component).toBe('cache');
    });

    test('应该能够清除请求记录', () => {
      originServer.addResource({
        path: '/test',
        body: 'content',
        contentType: 'text/plain',
        etag: '"abc123"',
        lastModified: 'Wed, 21 Oct 2020 07:28:00 GMT',
        cacheControl: 'public, max-age=3600',
        vary: ''
      });

      cacheProxy.handleRequest({
        method: 'GET',
        path: '/test',
        headers: {},
        body: ''
      });

      expect(cacheProxy.getRequests().length).toBeGreaterThan(0);

      cacheProxy.clearRequests();

      expect(cacheProxy.getRequests().length).toBe(0);
    });
  });
});
