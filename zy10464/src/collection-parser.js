const fs = require('fs');
const path = require('path');

class CollectionParser {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.quiet = options.quiet || false;
    this.collection = null;
    this.collectionPath = null;
    this.requests = [];
  }

  parse(filePath) {
    this.collectionPath = filePath;
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      this.collection = JSON.parse(content);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Collection 文件 JSON 格式错误: ${error.message}`);
      }
      throw new Error(`无法读取 Collection 文件: ${error.message}`);
    }

    if (!this.collection.info) {
      throw new Error('无效的 Postman Collection 文件: 缺少 info 字段');
    }

    if (!this.collection.item) {
      throw new Error('无效的 Postman Collection 文件: 缺少 item 字段');
    }

    this.requests = [];
    this.traverseItems(this.collection.item, []);
    
    return this.collection;
  }

  traverseItems(items, pathStack) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const currentPath = [...pathStack, { name: item.name, index: i }];

      if (item.item) {
        this.traverseItems(item.item, currentPath);
      } else {
        this.processRequest(item, currentPath);
      }
    }
  }

  processRequest(item, pathStack) {
    const requestPath = pathStack.map(p => p.name).join(' > ');
    
    if (!item.request) {
      if (this.verbose && !this.quiet) {
        console.log(`[WARN] 跳过无效请求: ${requestPath || item.name} (缺少 request 字段)`);
      }
      return;
    }

    const request = {
      id: item.id || this.generateId(),
      name: item.name,
      path: requestPath,
      pathIndices: pathStack.map(p => p.index),
      method: item.request.method || 'UNKNOWN',
      url: this.formatUrl(item.request.url),
      description: item.request.description?.content || item.request.description || '',
      eventScripts: this.extractEventScripts(item),
      responses: item.response || [],
      hasTests: false,
      hasPreRequestScript: false,
      sourceFile: this.collectionPath,
      sourceLocation: {
        itemPath: pathStack.map(p => p.name),
        itemIndices: pathStack.map(p => p.index)
      }
    };

    if (item.event) {
      request.hasTests = item.event.some(e => e.listen === 'test');
      request.hasPreRequestScript = item.event.some(e => e.listen === 'prerequest');
    }

    this.requests.push(request);
  }

  formatUrl(urlObj) {
    if (typeof urlObj === 'string') {
      return urlObj;
    }
    
    if (!urlObj) {
      return '';
    }

    let url = '';
    
    if (urlObj.protocol) {
      url += `${urlObj.protocol}://`;
    }
    
    if (urlObj.host) {
      url += Array.isArray(urlObj.host) ? urlObj.host.join('.') : urlObj.host;
    }
    
    if (urlObj.port) {
      url += `:${urlObj.port}`;
    }
    
    if (urlObj.path) {
      const pathParts = Array.isArray(urlObj.path) ? urlObj.path : [urlObj.path];
      url += '/' + pathParts.join('/');
    }
    
    if (urlObj.query && urlObj.query.length > 0) {
      const queryParams = urlObj.query
        .filter(q => !q.disabled)
        .map(q => `${q.key}=${q.value || ''}`)
        .join('&');
      if (queryParams) {
        url += `?${queryParams}`;
      }
    }

    return url;
  }

  extractEventScripts(item) {
    const scripts = {
      test: [],
      prerequest: []
    };

    if (!item.event) {
      return scripts;
    }

    for (const event of item.event) {
      if (event.script?.exec) {
        const scriptContent = Array.isArray(event.script.exec) 
          ? event.script.exec.join('\n') 
          : event.script.exec;
        
        if (event.listen === 'test') {
          scripts.test.push({
            type: event.listen,
            content: scriptContent,
            scriptType: event.script.type
          });
        } else if (event.listen === 'prerequest') {
          scripts.prerequest.push({
            type: event.listen,
            content: scriptContent,
            scriptType: event.script.type
          });
        }
      }
    }

    return scripts;
  }

  generateId() {
    return 'req_' + Math.random().toString(36).substr(2, 9);
  }

  getAllRequests() {
    return [...this.requests];
  }

  getCollectionInfo() {
    if (!this.collection) return null;
    return {
      name: this.collection.info.name,
      description: this.collection.info.description,
      schema: this.collection.info.schema,
      version: this.collection.info.version
    };
  }
}

module.exports = CollectionParser;
