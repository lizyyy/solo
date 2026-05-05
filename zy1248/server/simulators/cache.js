class CacheProxy {
  constructor(originServer) {
    this.originServer = originServer;
    this.cache = new Map(); // 存储缓存项，key 为请求标识符
    this.requests = [];
  }

  // 生成缓存键，考虑 Vary 头
  getCacheKey(request) {
    const varyHeaders = [];
    const existingEntry = this.getCacheEntry(request.path);
    
    if (existingEntry && existingEntry.vary) {
      const varyFields = existingEntry.vary.split(',').map(v => v.trim().toLowerCase());
      for (const field of varyFields) {
        if (request.headers[field]) {
          varyHeaders.push(`${field}:${request.headers[field]}`);
        }
      }
    }
    
    return `${request.method}:${request.path}:${varyHeaders.join(';')}`;
  }

  getCacheEntry(path) {
    // 简单实现：根据路径查找最近的缓存项
    for (const [key, entry] of this.cache) {
      if (key.includes(`:${path}:`) || key.endsWith(`:${path}`)) {
        return entry;
      }
    }
    return null;
  }

  handleRequest(request) {
    const trace = {
      timestamp: new Date().toISOString(),
      component: 'cache',
      action: 'receive_request',
      details: {
        method: request.method,
        path: request.path,
        headers: request.headers
      }
    };
    this.requests.push(trace);

    // 只有 GET 和 HEAD 请求可以被缓存
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return this.forwardToOrigin(request, 'method_not_cacheable');
    }

    // 检查缓存控制头
    const cacheControl = request.headers['cache-control'] || '';
    const noCache = cacheControl.includes('no-cache');
    const maxStale = this.parseMaxStale(cacheControl);
    const minFresh = this.parseMinFresh(cacheControl);
    const maxAge = this.parseMaxAge(cacheControl);
    const onlyIfCached = cacheControl.includes('only-if-cached');

    if (noCache) {
      // 强制重新验证
      return this.forwardToOrigin(request, 'client_no_cache');
    }

    const cacheKey = this.getCacheKey(request);
    const cacheEntry = this.cache.get(cacheKey);

    if (!cacheEntry) {
      if (onlyIfCached) {
        return this.createGatewayTimeoutResponse();
      }
      return this.forwardToOrigin(request, 'cache_miss');
    }

    // 检查缓存是否过期
    const freshnessInfo = this.calculateFreshness(cacheEntry);
    const isFresh = freshnessInfo.isFresh;

    // 应用 max-stale 和 min-fresh
    let canUseStale = false;
    if (maxStale !== null && freshnessInfo.staleSeconds <= maxStale) {
      canUseStale = true;
    }

    let meetsMinFresh = true;
    if (minFresh !== null && freshnessInfo.freshLifetime - freshnessInfo.currentAge < minFresh) {
      meetsMinFresh = false;
    }

    if (maxAge !== null && freshnessInfo.currentAge > maxAge) {
      meetsMinFresh = false;
    }

    // 决策是否使用缓存
    if ((isFresh || canUseStale) && meetsMinFresh) {
      // 缓存命中且新鲜，可以使用
      return this.serveFromCache(request, cacheEntry, freshnessInfo);
    }

    // 缓存过期，需要重新验证
    if (onlyIfCached) {
      return this.createGatewayTimeoutResponse();
    }

    return this.revalidate(request, cacheEntry);
  }

  parseMaxStale(cacheControl) {
    const match = cacheControl.match(/max-stale(?:=(\d+))?/);
    if (!match) return null;
    if (match[1] === undefined) return Infinity; // 允许任意过期时间
    return parseInt(match[1]);
  }

  parseMinFresh(cacheControl) {
    const match = cacheControl.match(/min-fresh=(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  parseMaxAge(cacheControl) {
    const match = cacheControl.match(/max-age=(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  calculateFreshness(cacheEntry) {
    const now = Date.now();
    const responseTime = cacheEntry.responseTime;
    const ageValue = this.parseCacheControl(cacheEntry.response.headers['Cache-Control'] || '', 'max-age');
    const expiresHeader = cacheEntry.response.headers['Expires'];
    
    let freshLifetime = 0;
    
    if (ageValue !== null) {
      freshLifetime = ageValue * 1000; // 转换为毫秒
    } else if (expiresHeader) {
      const expiresDate = new Date(expiresHeader);
      const dateHeader = new Date(cacheEntry.response.headers['Date'] || now);
      freshLifetime = expiresDate - dateHeader;
    } else {
      // 启发式过期
      const lastModified = cacheEntry.response.headers['Last-Modified'];
      const dateHeader = new Date(cacheEntry.response.headers['Date'] || now);
      if (lastModified) {
        const lastModifiedDate = new Date(lastModified);
        const timeSinceLastModified = dateHeader - lastModifiedDate;
        freshLifetime = timeSinceLastModified * 0.1; // 10% 的启发式
      }
    }

    const currentAge = now - responseTime;
    const isFresh = currentAge < freshLifetime;
    const staleSeconds = Math.max(0, (currentAge - freshLifetime) / 1000);

    return {
      isFresh,
      currentAge: currentAge / 1000,
      freshLifetime: freshLifetime / 1000,
      staleSeconds,
      isHeuristic: ageValue === null && !expiresHeader
    };
  }

  parseCacheControl(header, directive) {
    const match = header.match(new RegExp(`${direction}=(\\d+)`));
    return match ? parseInt(match[1]) : null;
  }

  forwardToOrigin(request, reason) {
    const trace = {
      timestamp: new Date().toISOString(),
      component: 'cache',
      action: 'forward_to_origin',
      details: {
        reason,
        request: {
          method: request.method,
          path: request.path,
          headers: request.headers
        }
      }
    };
    this.requests.push(trace);

    const response = this.originServer.handleRequest(request);
    
    // 缓存可缓存的响应
    if (this.isCacheable(request, response)) {
      this.storeInCache(request, response);
    }

    return response;
  }

  isCacheable(request, response) {
    // 只有 GET 和 HEAD 请求可以被缓存
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return false;
    }

    // 检查响应状态码
    const cacheableStatuses = [200, 203, 204, 206, 300, 301, 404, 405, 410, 414, 501];
    if (!cacheableStatuses.includes(response.statusCode)) {
      return false;
    }

    // 检查 Cache-Control 头
    const cacheControl = response.headers['Cache-Control'] || '';
    if (cacheControl.includes('no-store') || cacheControl.includes('private')) {
      return false;
    }

    return true;
  }

  storeInCache(request, response) {
    const cacheKey = this.getCacheKey(request);
    const cacheEntry = {
      request: {
        method: request.method,
        path: request.path,
        headers: { ...request.headers }
      },
      response: {
        ...response,
        headers: { ...response.headers }
      },
      responseTime: Date.now(),
      vary: response.headers['Vary']
    };

    this.cache.set(cacheKey, cacheEntry);

    const trace = {
      timestamp: new Date().toISOString(),
      component: 'cache',
      action: 'store_in_cache',
      details: {
        cacheKey,
        entry: {
          request: cacheEntry.request,
          response: {
            statusCode: cacheEntry.response.statusCode,
            headers: cacheEntry.response.headers
          }
        }
      }
    };
    this.requests.push(trace);
  }

  serveFromCache(request, cacheEntry, freshnessInfo) {
    // 复制响应并添加 Age 头
    const response = {
      ...cacheEntry.response,
      headers: { ...cacheEntry.response.headers }
    };

    response.headers['Age'] = Math.floor(freshnessInfo.currentAge).toString();
    response.headers['X-Cache-Hit'] = 'true';

    const trace = {
      timestamp: new Date().toISOString(),
      component: 'cache',
      action: 'serve_from_cache',
      details: {
        request: {
          method: request.method,
          path: request.path
        },
        response: {
          statusCode: response.statusCode,
          headers: response.headers
        },
        freshnessInfo
      }
    };
    this.requests.push(trace);

    return response;
  }

  revalidate(request, cacheEntry) {
    // 添加条件请求头
    const conditionalRequest = {
      ...request,
      headers: { ...request.headers }
    };

    // 添加 If-None-Match 和 If-Modified-Since
    if (cacheEntry.response.headers['ETag']) {
      conditionalRequest.headers['If-None-Match'] = cacheEntry.response.headers['ETag'];
    }
    if (cacheEntry.response.headers['Last-Modified']) {
      conditionalRequest.headers['If-Modified-Since'] = cacheEntry.response.headers['Last-Modified'];
    }

    const trace = {
      timestamp: new Date().toISOString(),
      component: 'cache',
      action: 'revalidate',
      details: {
        originalRequest: {
          method: request.method,
          path: request.path
        },
        conditionalRequest: {
          headers: {
            'If-None-Match': conditionalRequest.headers['If-None-Match'],
            'If-Modified-Since': conditionalRequest.headers['If-Modified-Since']
          }
        }
      }
    };
    this.requests.push(trace);

    const response = this.originServer.handleRequest(conditionalRequest);

    if (response.statusCode === 304) {
      // 资源未修改，使用缓存
      const updatedEntry = {
        ...cacheEntry,
        responseTime: Date.now(),
        response: {
          ...cacheEntry.response,
          headers: {
            ...cacheEntry.response.headers,
            ...response.headers
          }
        }
      };

      const cacheKey = this.getCacheKey(request);
      this.cache.set(cacheKey, updatedEntry);

      const result = {
        ...updatedEntry.response,
        headers: { ...updatedEntry.response.headers }
      };

      const freshnessInfo = this.calculateFreshness(updatedEntry);
      result.headers['Age'] = Math.floor(freshnessInfo.currentAge).toString();
      result.headers['X-Cache-Revalidated'] = 'true';

      const revalidateTrace = {
        timestamp: new Date().toISOString(),
        component: 'cache',
        action: 'revalidate_success',
        details: {
          reason: '304 Not Modified',
          usingCached: true
        }
      };
      this.requests.push(revalidateTrace);

      return result;
    }

    // 资源已修改，使用新响应
    if (this.isCacheable(request, response)) {
      this.storeInCache(request, response);
    }

    const revalidateTrace = {
      timestamp: new Date().toISOString(),
      component: 'cache',
      action: 'revalidate_success',
      details: {
        reason: `Resource modified (${response.statusCode})`,
        usingCached: false
      }
    };
    this.requests.push(revalidateTrace);

    return response;
  }

  createGatewayTimeoutResponse() {
    const response = {
      statusCode: 504,
      statusText: 'Gateway Timeout',
      headers: {
        'Date': new Date().toUTCString(),
        'Server': 'HTTP Sandbox Cache Proxy'
      },
      body: 'Gateway Timeout - only-if-cached request but no cached response available'
    };

    const trace = {
      timestamp: new Date().toISOString(),
      component: 'cache',
      action: 'gateway_timeout',
      details: response
    };
    this.requests.push(trace);

    return response;
  }

  getRequests() {
    return [...this.requests];
  }

  clearRequests() {
    this.requests = [];
  }

  clearCache() {
    this.cache.clear();
    const trace = {
      timestamp: new Date().toISOString(),
      component: 'cache',
      action: 'clear_cache',
      details: {}
    };
    this.requests.push(trace);
  }

  getCacheStatus() {
    const cacheEntries = [];
    for (const [key, entry] of this.cache) {
      const freshnessInfo = this.calculateFreshness(entry);
      cacheEntries.push({
        key,
        request: entry.request,
        response: {
          statusCode: entry.response.statusCode,
          headers: entry.response.headers
        },
        responseTime: new Date(entry.responseTime).toISOString(),
        freshnessInfo
      });
    }
    return cacheEntries;
  }
}

module.exports = CacheProxy;
