class Client {
  constructor(cacheProxy) {
    this.cacheProxy = cacheProxy;
    this.requests = [];
    this.maxRedirects = 5;
  }

  handleRequest(request) {
    const trace = {
      timestamp: new Date().toISOString(),
      component: 'client',
      action: 'receive_request',
      details: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body
      }
    };
    this.requests.push(trace);

    // 解析 URL 获取路径
    const path = this.parsePath(request.url);
    const modifiedRequest = { ...request, path };

    // 处理 CORS 预检
    if (this.needsCorsPreflight(modifiedRequest)) {
      const preflightResult = this.handleCorsPreflight(modifiedRequest);
      if (preflightResult.blocked) {
        return preflightResult.response;
      }
    }

    // 处理重定向链
    return this.handleRedirects(modifiedRequest, 0);
  }

  parsePath(url) {
    try {
      const urlObj = new URL(url, 'http://localhost');
      return urlObj.pathname + urlObj.search;
    } catch (e) {
      return url;
    }
  }

  needsCorsPreflight(request) {
    // 检查是否需要 CORS 预检
    const method = request.method.toUpperCase();
    const simpleMethods = ['GET', 'HEAD', 'POST'];
    
    if (!simpleMethods.includes(method)) {
      return true;
    }

    // 检查是否有非简单头
    const simpleHeaders = ['accept', 'accept-language', 'content-language', 'content-type'];
    const contentType = request.headers['content-type'];
    
    if (contentType) {
      const simpleContentTypes = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'];
      if (!simpleContentTypes.some(ct => contentType.toLowerCase().startsWith(ct))) {
        return true;
      }
    }

    // 检查是否有自定义头
    for (const header in request.headers) {
      if (!simpleHeaders.includes(header.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  handleCorsPreflight(request) {
    const trace = {
      timestamp: new Date().toISOString(),
      component: 'client',
      action: 'cors_preflight',
      details: {
        request: {
          method: 'OPTIONS',
          path: request.path,
          headers: {
            'Access-Control-Request-Method': request.method,
            'Access-Control-Request-Headers': Object.keys(request.headers).join(', ')
          }
        }
      }
    };
    this.requests.push(trace);

    // 模拟预检请求
    const preflightRequest = {
      method: 'OPTIONS',
      path: request.path,
      headers: {
        'Access-Control-Request-Method': request.method,
        'Access-Control-Request-Headers': Object.keys(request.headers).join(', ')
      },
      body: ''
    };

    // 检查是否配置了 CORS 响应
    const corsConfig = request.corsConfig || {};
    
    if (corsConfig.enabled === false) {
      // CORS 被禁用，阻止请求
      const response = {
        statusCode: 0,
        statusText: 'CORS Blocked',
        headers: {},
        body: 'CORS preflight request failed: Access-Control-Allow-Origin header is missing',
        blocked: true
      };

      const blockedTrace = {
        timestamp: new Date().toISOString(),
        component: 'client',
        action: 'cors_blocked',
        details: {
          reason: 'CORS preflight request did not return required headers',
          response
        }
      };
      this.requests.push(blockedTrace);

      return { blocked: true, response };
    }

    // 模拟成功的预检响应
    const preflightResponse = {
      statusCode: 204,
      statusText: 'No Content',
      headers: {
        'Access-Control-Allow-Origin': corsConfig.allowOrigin || '*',
        'Access-Control-Allow-Methods': corsConfig.allowMethods || 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': corsConfig.allowHeaders || '*',
        'Access-Control-Allow-Credentials': corsConfig.allowCredentials ? 'true' : 'false',
        'Access-Control-Max-Age': (corsConfig.maxAge || 86400).toString()
      },
      body: ''
    };

    const successTrace = {
      timestamp: new Date().toISOString(),
      component: 'client',
      action: 'cors_preflight_success',
      details: {
        response: preflightResponse
      }
    };
    this.requests.push(successTrace);

    return { blocked: false };
  }

  handleRedirects(request, redirectCount) {
    if (redirectCount >= this.maxRedirects) {
      const response = {
        statusCode: 508,
        statusText: 'Loop Detected',
        headers: {},
        body: `Too many redirects (max ${this.maxRedirects})`
      };

      const trace = {
        timestamp: new Date().toISOString(),
        component: 'client',
        action: 'too_many_redirects',
        details: {
          redirectCount,
          response
        }
      };
      this.requests.push(trace);

      return response;
    }

    // 发送请求到缓存代理
    const response = this.cacheProxy.handleRequest(request);

    // 检查是否需要重定向
    if (this.isRedirectResponse(response)) {
      const location = response.headers['Location'];
      
      if (!location) {
        return response;
      }

      const redirectTrace = {
        timestamp: new Date().toISOString(),
        component: 'client',
        action: 'redirect',
        details: {
          from: request.path,
          to: location,
          statusCode: response.statusCode,
          redirectCount: redirectCount + 1
        }
      };
      this.requests.push(redirectTrace);

      // 处理不同状态码的重定向行为
      const redirectRequest = this.prepareRedirectRequest(request, response, location);
      
      return this.handleRedirects(redirectRequest, redirectCount + 1);
    }

    // 最终响应
    const finalTrace = {
      timestamp: new Date().toISOString(),
      component: 'client',
      action: 'final_response',
      details: {
        request: {
          method: request.method,
          path: request.path
        },
        response: {
          statusCode: response.statusCode,
          statusText: response.statusText,
          headers: response.headers,
          body: response.body
        }
      }
    };
    this.requests.push(finalTrace);

    return response;
  }

  isRedirectResponse(response) {
    const redirectStatusCodes = [301, 302, 303, 307, 308];
    return redirectStatusCodes.includes(response.statusCode);
  }

  prepareRedirectRequest(originalRequest, response, location) {
    const statusCode = response.statusCode;
    let method = originalRequest.method;
    let body = originalRequest.body;
    let headers = { ...originalRequest.headers };

    // 处理不同重定向状态码的方法变更
    if (statusCode === 303) {
      // 303 See Other: 总是使用 GET
      method = 'GET';
      body = '';
      // 移除可能不适合 GET 的头
      delete headers['content-type'];
      delete headers['content-length'];
    } else if (statusCode === 301 || statusCode === 302) {
      // 301/302: 历史上许多客户端会将 POST 改为 GET
      // 这里模拟常见的浏览器行为
      if (method === 'POST') {
        method = 'GET';
        body = '';
        delete headers['content-type'];
        delete headers['content-length'];
      }
    }
    // 307/308: 保持原方法和 body

    // 解析新的路径
    const newPath = this.parsePath(location);

    return {
      ...originalRequest,
      method,
      path: newPath,
      url: location,
      headers,
      body
    };
  }

  getRequests() {
    return [...this.requests];
  }

  clearRequests() {
    this.requests = [];
  }

  getFullTrace() {
    return [
      ...this.getRequests(),
      ...this.cacheProxy.getRequests(),
      ...this.cacheProxy.originServer.getRequests()
    ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }
}

module.exports = Client;
