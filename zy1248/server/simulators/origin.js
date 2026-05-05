class OriginServer {
  constructor() {
    this.resources = new Map();
    this.requests = [];
  }

  addResource(resource) {
    this.resources.set(resource.path, resource);
  }

  getResource(path) {
    return this.resources.get(path);
  }

  handleRequest(request) {
    const trace = {
      timestamp: new Date().toISOString(),
      component: 'origin',
      action: 'receive_request',
      details: {
        method: request.method,
        path: request.path,
        headers: request.headers,
        body: request.body
      }
    };
    this.requests.push(trace);

    const resource = this.resources.get(request.path);
    
    if (!resource) {
      return this.createResponse(404, 'Not Found', {}, 'Resource not found');
    }

    // 处理条件请求
    const ifMatch = request.headers['if-match'];
    const ifNoneMatch = request.headers['if-none-match'];
    const ifModifiedSince = request.headers['if-modified-since'];
    const ifUnmodifiedSince = request.headers['if-unmodified-since'];
    const ifRange = request.headers['if-range'];
    const range = request.headers['range'];

    // 处理 If-Match
    if (ifMatch && ifMatch !== '*') {
      const etags = ifMatch.split(',').map(e => e.trim());
      if (!etags.includes(resource.etag)) {
        return this.createResponse(412, 'Precondition Failed', {}, 'If-Match condition failed');
      }
    }

    // 处理 If-None-Match (用于 GET/HEAD)
    if (ifNoneMatch && (request.method === 'GET' || request.method === 'HEAD')) {
      const etags = ifNoneMatch.split(',').map(e => e.trim());
      if (etags.includes(resource.etag) || etags.includes('*')) {
        return this.createResponse(304, 'Not Modified', {
          'ETag': resource.etag,
          'Last-Modified': resource.lastModified,
          'Cache-Control': resource.cacheControl,
          'Vary': resource.vary
        }, '');
      }
    }

    // 处理 If-Modified-Since
    if (ifModifiedSince && (request.method === 'GET' || request.method === 'HEAD')) {
      const ifModifiedDate = new Date(ifModifiedSince);
      const lastModifiedDate = new Date(resource.lastModified);
      if (lastModifiedDate <= ifModifiedDate) {
        return this.createResponse(304, 'Not Modified', {
          'ETag': resource.etag,
          'Last-Modified': resource.lastModified,
          'Cache-Control': resource.cacheControl,
          'Vary': resource.vary
        }, '');
      }
    }

    // 处理 If-Unmodified-Since
    if (ifUnmodifiedSince) {
      const ifUnmodifiedDate = new Date(ifUnmodifiedSince);
      const lastModifiedDate = new Date(resource.lastModified);
      if (lastModifiedDate > ifUnmodifiedDate) {
        return this.createResponse(412, 'Precondition Failed', {}, 'If-Unmodified-Since condition failed');
      }
    }

    // 处理 Range 请求
    if (range && request.method === 'GET') {
      return this.handleRangeRequest(request, resource, ifRange);
    }

    // 处理重定向
    if (resource.redirect) {
      return this.createResponse(resource.redirect.statusCode, resource.redirect.statusText, {
        'Location': resource.redirect.location,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }, '');
    }

    // 正常响应
    return this.createResponse(200, 'OK', {
      'ETag': resource.etag,
      'Last-Modified': resource.lastModified,
      'Cache-Control': resource.cacheControl,
      'Vary': resource.vary,
      'Content-Type': resource.contentType,
      'Content-Length': resource.body.length.toString()
    }, resource.body);
  }

  handleRangeRequest(request, resource, ifRange) {
    // 处理 If-Range
    if (ifRange) {
      // If-Range 可以是 ETag 或日期
      const isEtag = ifRange.startsWith('"') || ifRange.startsWith('W/');
      let conditionMet = false;
      
      if (isEtag) {
        conditionMet = (ifRange === resource.etag || ifRange === `W/${resource.etag}`);
      } else {
        const ifRangeDate = new Date(ifRange);
        const lastModifiedDate = new Date(resource.lastModified);
        conditionMet = (lastModifiedDate <= ifRangeDate);
      }
      
      if (!conditionMet) {
        // If-Range 条件不满足，返回完整内容
        return this.createResponse(200, 'OK', {
          'ETag': resource.etag,
          'Last-Modified': resource.lastModified,
          'Cache-Control': resource.cacheControl,
          'Content-Type': resource.contentType,
          'Content-Length': resource.body.length.toString()
        }, resource.body);
      }
    }

    // 解析 Range 头
    const rangeMatch = request.headers['range'].match(/^bytes=(\d*)-(\d*)$/);
    if (!rangeMatch) {
      return this.createResponse(416, 'Range Not Satisfiable', {
        'Content-Range': `bytes */${resource.body.length}`
      }, '');
    }

    const [, startStr, endStr] = rangeMatch;
    let start, end;
    const totalLength = resource.body.length;

    if (startStr === '' && endStr !== '') {
      // 后缀范围: bytes=-500
      start = totalLength - parseInt(endStr);
      end = totalLength - 1;
    } else {
      start = parseInt(startStr);
      end = endStr ? parseInt(endStr) : totalLength - 1;
    }

    // 验证范围
    if (start > end || start >= totalLength || end < 0) {
      return this.createResponse(416, 'Range Not Satisfiable', {
        'Content-Range': `bytes */${totalLength}`
      }, '');
    }

    // 截取内容
    const partialContent = resource.body.slice(start, end + 1);
    
    return this.createResponse(206, 'Partial Content', {
      'ETag': resource.etag,
      'Last-Modified': resource.lastModified,
      'Cache-Control': resource.cacheControl,
      'Content-Type': resource.contentType,
      'Content-Length': partialContent.length.toString(),
      'Content-Range': `bytes ${start}-${end}/${totalLength}`
    }, partialContent);
  }

  createResponse(statusCode, statusText, headers, body) {
    const response = {
      statusCode,
      statusText,
      headers: {
        'Date': new Date().toUTCString(),
        'Server': 'HTTP Sandbox Origin Server',
        ...headers
      },
      body
    };

    const trace = {
      timestamp: new Date().toISOString(),
      component: 'origin',
      action: 'send_response',
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
}

module.exports = OriginServer;
