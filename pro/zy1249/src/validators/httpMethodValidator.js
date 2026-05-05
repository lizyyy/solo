const BaseValidator = require('./base')

class HttpMethodValidator extends BaseValidator {
  constructor(ruleConfig) {
    super(ruleConfig)
    this.config = ruleConfig?.config || {
      standardMethods: ['get', 'put', 'post', 'delete', 'patch', 'options', 'head'],
      methodPurpose: {
        get: '获取资源',
        put: '替换资源',
        post: '创建资源或复杂查询',
        delete: '删除资源',
        patch: '部分更新资源',
        options: 'CORS 预检',
        head: '获取响应头'
      },
      allowMethodsWithBody: ['post', 'put', 'patch'],
      allowMethodsWithoutBody: ['get', 'delete', 'head', 'options'],
      requireRequestBody: ['post', 'put', 'patch'],
      requireResponseBody: ['get', 'post', 'put', 'patch'],
      forbiddenMethods: ['trace', 'connect']
    }
  }

  async validate(spec, context = {}) {
    this.clearIssues()

    if (!spec || !spec.paths) {
      return this.getIssues()
    }

    const paths = Object.keys(spec.paths)

    for (const path of paths) {
      const pathItem = spec.paths[path]
      const methods = Object.keys(pathItem).filter(key => 
        this.config.standardMethods.includes(key.toLowerCase())
      )

      for (const method of methods) {
        const operation = pathItem[method]
        
        this.validateMethodPurpose(path, method, operation)
        this.validateRequestBodyPresence(path, method, operation)
        this.validateResponseStatusCodes(path, method, operation)
        this.validateMethodSemantics(path, method, operation)
      }

      const allMethods = Object.keys(pathItem).filter(key => 
        typeof pathItem[key] && typeof pathItem[key] === 'object')
      
      for (const method of allMethods) {
        if (this.config.forbiddenMethods.includes(method.toLowerCase())) {
          this.addIssue({
            title: '使用了不安全的 HTTP 方法',
            description: `路径 "${path}" 使用了 ${method.toUpperCase()} 方法，该方法存在安全风险。`,
            suggestion: '检查安全策略，移除或禁用 TRACE、CONNECT 等方法。',
            location: { type: 'method', path, method },
            path: path,
            method: method.toUpperCase(),
            severity: 'critical'
          })
        }
      }
    }

    return this.getIssues()
  }

  validateMethodPurpose(path, method, operation) {
    const hasPathParam = path.includes('{')

    if (method === 'get' && hasPathParam) {
      if (!operation.operationId?.toLowerCase().includes('list')) {
        const summary = operation.summary || ''
        if (summary.toLowerCase().includes('list') || summary.toLowerCase().includes('get all')) {
          this.addIssue({
            title: 'GET 方法语义可能使用不当',
            description: `路径 "${path}" 使用 GET 但可能用于列表操作，但路径包含 ID 参数。列表操作应使用不带 ID 路径的 GET。`,
            suggestion: '列表操作使用 GET /resources，单个资源获取使用 GET /resources/{id}。',
            location: { type: 'method', path, method },
            path: path,
            method: 'GET',
            severity: 'warning'
          })
        }
      }
    }

    if (method === 'post' && hasPathParam) {
      this.addIssue({
        title: 'POST 方法路径包含 ID 参数',
        description: `路径 "${path}" 使用 POST 方法但路径包含 ID 参数。POST 通常用于创建新资源，不应该在路径中包含 ID。`,
        suggestion: '如果是创建操作，使用 POST /resources；如果是更新操作，使用 PUT /resources/{id}。',
        location: { type: 'method', path, method },
        path: path,
        method: 'POST',
        codeExample: {
          bad: `POST /api/v1/users/{userId}`,
          good: `POST /api/v1/users 或 PUT /api/v1/users/{userId}`
        },
        severity: 'warning'
      })
    }
  }

  validateRequestBodyPresence(path, method, operation) {
    const methodLower = method.toLowerCase()
    const hasBody = operation.requestBody !== undefined

    if (this.config.requireRequestBody.includes(methodLower) && !hasBody) {
      if (methodLower !== 'delete') {
        this.addIssue({
          title: `${method.toUpperCase()} 操作缺少请求体`,
          description: `路径 "${path}" 的 ${method.toUpperCase()} 操作缺少 requestBody。${method.toUpperCase()} 操作通常需要请求体。`,
          suggestion: '添加 requestBody 定义。如果不需要请求体，考虑使用其他 HTTP 方法。',
          location: { type: 'requestBody', path, method },
          path: path,
          method: method.toUpperCase(),
          severity: 'warning'
        })
      }
    }

    if (this.config.allowMethodsWithoutBody.includes(methodLower) && hasBody) {
      this.addIssue({
        title: `${method.toUpperCase()} 操作不应包含请求体`,
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作包含 requestBody。${method.toUpperCase()} 操作通常不应包含请求体。`,
        suggestion: `如果需要传递数据，使用查询参数或考虑使用 POST 方法。`,
        location: { type: 'requestBody', path, method },
        path: path,
        method: method.toUpperCase(),
        codeExample: {
          bad: `GET /api/v1/users\nContent-Type: application/json\n\n{"filter": "active"}`,
          good: `GET /api/v1/users?filter=active`
        },
        severity: 'warning'
      })
    }
  }

  validateResponseStatusCodes(path, method, operation) {
    if (!operation.responses) {
      this.addIssue({
        title: '操作缺少响应定义',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作缺少 responses 定义。`,
        suggestion: '添加至少一个成功响应和错误响应定义。',
        location: { type: 'responses', path, method },
        path: path,
        method: method.toUpperCase(),
        severity: 'error'
      })
      return
    }

    const responses = Object.keys(operation.responses)
    const methodLower = method.toLowerCase()

    const expectedSuccessCodes = {
      get: ['200'],
      post: ['200', '201', '202'],
      put: ['200', '204'],
      patch: ['200', '204'],
      delete: ['200', '204'],
      options: ['200', '204']
    }

    const expectedCodes = expectedSuccessCodes[methodLower] || ['200']
    const hasSuccessCode = responses.some(code => expectedCodes.includes(code))

    if (!hasSuccessCode) {
      this.addIssue({
        title: `缺少预期的成功响应状态码`,
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作缺少预期的成功响应状态码。预期：${expectedCodes.join(', ')}。`,
        suggestion: `添加预期的成功响应状态码。`,
        location: { type: 'responses', path, method },
        path: path,
        method: method.toUpperCase(),
        severity: 'warning'
      })
    }

    if (methodLower === 'post' && !responses.includes('201')) {
      const has201 = responses.includes('201')
      if (!has201 && operation.operationId?.toLowerCase().includes('create')) {
        this.addIssue({
          title: 'POST 创建操作应返回 201',
          description: `路径 "${path}" 的 POST 操作用于创建资源，但没有定义 201 (Created) 响应。`,
          suggestion: '添加 201 响应，并在响应头中包含 Location 指向新创建的资源。',
          location: { type: 'responses', path, method },
          path: path,
          method: 'POST',
          codeExample: {
            bad: `HTTP/1.1 200 OK`,
            good: `HTTP/1.1 201 Created\nLocation: /api/v1/users/123`
          },
          severity: 'info'
        })
      }
    }

    const commonErrorCodes = ['400', '401', '403', '404', '429', '500', '502', '503']
    const hasErrorCode = responses.some(code => commonErrorCodes.includes(code))

    if (!hasErrorCode) {
      this.addIssue({
        title: '缺少错误响应定义',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作缺少错误响应定义。`,
        suggestion: '定义常见的错误响应，如 400、401、403、404、500 等。',
        location: { type: 'responses', path, method },
        path: path,
        method: method.toUpperCase(),
        severity: 'info'
      })
    }

    const defaultResponse = operation.responses.default
    if (!defaultResponse) {
      this.addIssue({
        title: '缺少默认响应',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作缺少 default 响应定义。`,
        suggestion: '添加 default 响应作为兜底响应，用于处理未预期的响应状态码。',
        location: { type: 'responses', path, method },
        path: path,
        method: method.toUpperCase(),
        severity: 'info'
      })
    }
  }

  validateMethodSemantics(path, method, operation) {
    const operationId = operation.operationId || ''
    const summary = operation.summary || ''
    const description = operation.description || ''
    const combinedText = (operationId + ' ' + summary + ' ' + description).toLowerCase()

    if (method === 'get') {
      if (combinedText.includes('create') || combinedText.includes('update') || 
          combinedText.includes('delete') || combinedText.includes('modify')) {
        this.addIssue({
          title: 'GET 方法语义与描述不一致',
          description: `路径 "${path}" 的 GET 方法描述中包含修改操作的语义。GET 应该是安全且幂等的，不应用于修改数据。`,
          suggestion: '如果是修改操作，使用 POST、PUT、PATCH 或 DELETE 方法。',
          location: { type: 'method', path, method },
          path: path,
          method: 'GET',
          codeExample: {
            bad: `GET /api/v1/users/{id}/activate`,
            good: `POST /api/v1/users/{id}/activate`
          },
          severity: 'error'
        })
      }
    }

    if (method === 'delete') {
      if (combinedText.includes('create') || combinedText.includes('add') ||
          combinedText.includes('update') || combinedText.includes('modify')) {
        this.addIssue({
          title: 'DELETE 方法语义与描述不一致',
          description: `路径 "${path}" 的 DELETE 方法描述中包含创建或更新操作的语义。`,
          suggestion: 'DELETE 只应用于删除资源。如果是其他操作，使用正确的 HTTP 方法。',
          location: { type: 'method', path, method },
          path: path,
          method: 'DELETE',
          severity: 'warning'
        })
      }
    }
  }
}

module.exports = HttpMethodValidator