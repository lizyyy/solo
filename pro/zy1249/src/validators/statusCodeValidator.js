const BaseValidator = require('./base')

class StatusCodeValidator extends BaseValidator {
  constructor(ruleConfig) {
    super(ruleConfig)
    this.config = ruleConfig?.config || {
      allowNonStandardStatusCodes: false,
      requireDescription: true,
      requiredResponses: {
        'get': ['200'],
        'post': ['200', '201'],
        'put': ['200', '204'],
        'patch': ['200', '204'],
        'delete': ['200', '204'],
        'options': ['200', '204']
      },
      commonErrorCodes: ['400', '401', '403', '404', '422', '429', '500'],
      statusCodePurposes: {
        '1xx': '信息性响应',
        '2xx': '成功',
        '3xx': '重定向',
        '4xx': '客户端错误',
        '5xx': '服务器错误'
      }
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
      const methods = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head']

      for (const method of methods) {
        if (pathItem[method]) {
          const operation = pathItem[method]
          this.validateOperationResponses(path, method, operation)
        }
      }
    }

    return this.getIssues()
  }

  validateOperationResponses(path, method, operation) {
    if (!operation.responses) {
      this.addIssue({
        title: '操作缺少响应定义',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作缺少 responses 定义。`,
        suggestion: '定义响应，至少包含成功响应和常见错误响应。',
        location: { type: 'responses', path, method },
        path: path,
        method: method.toUpperCase(),
        severity: 'error'
      })
      return
    }

    const responseCodes = Object.keys(operation.responses)

    for (const code of responseCodes) {
      if (code === 'default') {
        continue
      }

      this.validateStatusCodeFormat(path, method, code)
      this.validateResponseDefinition(path, method, code, operation.responses[code])
      this.validateStatusCodeCategory(path, method, code)
    }

    this.validateRequiredSuccessCodes(path, method, responseCodes)
    this.validateErrorCodes(path, method, responseCodes)
    this.validateDefaultResponse(path, method, operation.responses)
  }

  validateStatusCodeFormat(path, method, code) {
    if (!/^\d{3}$/.test(code)) {
      this.addIssue({
        title: '状态码格式无效',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作使用了无效的状态码 "${code}"。状态码应该是三位数字。`,
        suggestion: '使用标准的三位 HTTP 状态码，如 200, 404, 500 等。',
        location: { type: 'statusCode', path, method, code },
        path: path,
        method: method.toUpperCase(),
        severity: 'error'
      })
    }
  }

  validateResponseDefinition(path, method, code, response) {
    if (!response) {
      this.addIssue({
        title: '响应定义为空',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作状态码 ${code} 的响应定义为空。`,
        suggestion: '提供响应定义，包括 description。',
        location: { type: 'response', path, method, code },
        path: path,
        method: method.toUpperCase(),
        severity: 'warning'
      })
      return
    }

    if (this.config.requireDescription && !response.description) {
      this.addIssue({
        title: '响应缺少描述',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作状态码 ${code} 的响应缺少 description。`,
        suggestion: '为每个响应添加有意义的描述，说明该状态码在什么情况下返回。',
        location: { type: 'response', path, method, code },
        path: path,
        method: method.toUpperCase(),
        severity: 'warning'
      })
    }

    const firstDigit = code.charAt(0)
    if (firstDigit === '2' && code !== '204' && code !== '304') {
      if (!response.content || Object.keys(response.content).length === 0) {
        if (code === '200' && method !== 'head') {
          this.addIssue({
            title: '成功响应缺少响应体定义',
            description: `路径 "${path}" 的 ${method.toUpperCase()} 操作状态码 ${code} 的响应缺少 content 定义。`,
            suggestion: '定义响应体结构，或使用 204 No Content 如果确实没有响应体。',
            location: { type: 'response', path, method, code },
            path: path,
            method: method.toUpperCase(),
            severity: 'info'
          })
        }
      }
    }
  }

  validateStatusCodeCategory(path, method, code) {
    const firstDigit = code.charAt(0)
    const categories = {
      '1': '信息性',
      '2': '成功',
      '3': '重定向',
      '4': '客户端错误',
      '5': '服务器错误'
    }

    if (!categories[firstDigit]) {
      this.addIssue({
        title: '状态码类别不规范',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作使用了状态码 ${code}，该状态码属于不常见的类别。`,
        suggestion: '考虑使用更常见的状态码类别。',
        location: { type: 'statusCode', path, method, code },
        path: path,
        method: method.toUpperCase(),
        severity: 'info'
      })
    }

    if (firstDigit === '3' && method !== 'get' && method !== 'head') {
      if (code !== '303' && code !== '304') {
        this.addIssue({
          title: '重定向状态码使用不当',
          description: `路径 "${path}" 的 ${method.toUpperCase()} 操作使用了重定向状态码 ${code}。${method.toUpperCase()} 方法的重定向行为可能不如预期。`,
          suggestion: '对于非 GET/HEAD 请求，考虑使用 303 See Other。',
          location: { type: 'statusCode', path, method, code },
          path: path,
          method: method.toUpperCase(),
          severity: 'warning'
        })
      }
    }

    if (code === '304') {
      if (method !== 'get' && method !== 'head') {
        this.addIssue({
          title: '304 Not Modified 只能用于 GET/HEAD',
          description: `路径 "${path}" 的 ${method.toUpperCase()} 操作使用了 304 状态码，但 304 只能用于 GET 或 HEAD 请求。`,
          suggestion: '对于非 GET/HEAD 请求，使用其他适当的状态码。',
          location: { type: 'statusCode', path, method, code },
          path: path,
          method: method.toUpperCase(),
          severity: 'error'
        })
      }
    }
  }

  validateRequiredSuccessCodes(path, method, responseCodes) {
    const methodLower = method.toLowerCase()
    const requiredCodes = this.config.requiredResponses[methodLower] || ['200']

    const hasSuccessCode = responseCodes.some(code => {
      const firstDigit = code.charAt(0)
      return firstDigit === '2'
    })

    if (!hasSuccessCode) {
      this.addIssue({
        title: '缺少成功响应状态码',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作缺少任何 2xx 成功状态码。`,
        suggestion: `添加预期的成功状态码，推荐：${requiredCodes.join(', ')}。`,
        location: { type: 'responses', path, method },
        path: path,
        method: method.toUpperCase(),
        severity: 'error'
      })
    }

    if (methodLower === 'post') {
      const isCreateOperation = this.guessOperationPurpose(method, path) === 'create'
      if (isCreateOperation && !responseCodes.includes('201')) {
        this.addIssue({
          title: '创建操作应返回 201 Created',
          description: `路径 "${path}" 的 POST 操作看起来是一个创建操作，但没有定义 201 Created 状态码。`,
          suggestion: '添加 201 Created 响应，并在响应头中包含 Location 指向新创建的资源。',
          location: { type: 'responses', path, method },
          path: path,
          method: 'POST',
          codeExample: {
            bad: `HTTP/1.1 200 OK
Content-Type: application/json

{"id": "123", "name": "用户"}`,
            good: `HTTP/1.1 201 Created
Location: /api/v1/users/123
Content-Type: application/json

{"id": "123", "name": "用户"}`
          },
          severity: 'warning'
        })
      }
    }
  }

  validateErrorCodes(path, method, responseCodes) {
    const errorCodes = responseCodes.filter(code => {
      const firstDigit = code.charAt(0)
      return firstDigit === '4' || firstDigit === '5'
    })

    if (errorCodes.length === 0) {
      this.addIssue({
        title: '缺少错误响应定义',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作没有定义任何错误响应状态码。`,
        suggestion: `定义常见的错误响应，如 400、401、403、404、500 等。推荐至少包含：${this.config.commonErrorCodes.join(', ')}。`,
        location: { type: 'responses', path, method },
        path: path,
        method: method.toUpperCase(),
        severity: 'info'
      })
    }

    for (const code of errorCodes) {
      this.validateSpecificErrorCode(path, method, code)
    }
  }

  validateSpecificErrorCode(path, method, code) {
    const codeInt = parseInt(code)

    if (codeInt >= 500) {
      if (code === '501') {
        this.addIssue({
          title: '501 Not Implemented 使用提示',
          description: `路径 "${path}" 的 ${method.toUpperCase()} 操作使用了 501 状态码。这表示服务器不支持该功能。`,
          suggestion: '如果是临时未实现，考虑使用 501。如果是永远不会实现，可能需要重新考虑 API 设计。',
          location: { type: 'statusCode', path, method, code },
          path: path,
          method: method.toUpperCase(),
          severity: 'info'
        })
      }

      if (code === '503') {
        this.addIssue({
          title: '503 Service Unavailable 使用提示',
          description: `路径 "${path}" 的 ${method.toUpperCase()} 操作使用了 503 状态码。这表示服务器暂时不可用。`,
          suggestion: '考虑在响应头中包含 Retry-After 指示客户端何时重试。',
          location: { type: 'statusCode', path, method, code },
          path: path,
          method: method.toUpperCase(),
          codeExample: {
            good: `HTTP/1.1 503 Service Unavailable
Retry-After: 120`
          },
          severity: 'info'
        })
      }
    }

    if (code === '401') {
      this.addIssue({
        title: '401 Unauthorized 认证提示',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作使用了 401 状态码。`,
        suggestion: '401 表示未认证，应在响应头中包含 WWW-Authenticate。如果是已认证但权限不足，应使用 403 Forbidden。',
        location: { type: 'statusCode', path, method, code },
        path: path,
        method: method.toUpperCase(),
        codeExample: {
          bad: `HTTP/1.1 401 Unauthorized`,
          good: `HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="api"`
        },
        severity: 'info'
      })
    }

    if (code === '422') {
      this.addIssue({
        title: '422 Unprocessable Entity 验证失败',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作使用了 422 状态码，这通常表示请求格式正确但内容验证失败。`,
        suggestion: '在响应体中包含详细的验证错误信息，指明哪些字段验证失败及原因。',
        location: { type: 'statusCode', path, method, code },
        path: path,
        method: method.toUpperCase(),
        codeExample: {
          good: `HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{
  "code": "VALIDATION_ERROR",
  "message": "请求数据验证失败",
  "details": [
    {"field": "email", "message": "邮箱格式无效"},
    {"field": "password", "message": "密码长度至少8位"}
  ]
}`
        },
        severity: 'info'
      })
    }

    if (code === '429') {
      this.addIssue({
        title: '429 Too Many Requests 限流提示',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作使用了 429 状态码，这表示请求频率超限。`,
        suggestion: '在响应头中包含 Retry-After 和/或 X-RateLimit-* 头信息。',
        location: { type: 'statusCode', path, method, code },
        path: path,
        method: method.toUpperCase(),
        codeExample: {
          good: `HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1614593987`
        },
        severity: 'info'
      })
    }
  }

  validateDefaultResponse(path, method, responses) {
    if (!responses.default) {
      this.addIssue({
        title: '缺少 default 响应',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作缺少 default 响应定义。`,
        suggestion: '添加 default 响应作为兜底，定义通用的错误响应格式。',
        location: { type: 'responses', path, method },
        path: path,
        method: method.toUpperCase(),
        codeExample: {
          good: `default:
  description: 通用错误响应
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/ErrorResponse'`
        },
        severity: 'info'
      })
    }
  }

  guessOperationPurpose(method, path) {
    const methodLower = method.toLowerCase()
    
    if (methodLower === 'get') {
      if (path.includes('{')) {
        return 'read-single'
      }
      return 'read-list'
    }
    
    if (methodLower === 'post') {
      if (!path.includes('{')) {
        return 'create'
      }
      return 'action'
    }
    
    if (methodLower === 'put' || methodLower === 'patch') {
      return 'update'
    }
    
    if (methodLower === 'delete') {
      return 'delete'
    }
    
    return 'unknown'
  }
}

module.exports = StatusCodeValidator