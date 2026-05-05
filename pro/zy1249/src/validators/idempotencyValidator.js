const BaseValidator = require('./base')

class IdempotencyValidator extends BaseValidator {
  constructor(ruleConfig) {
    super(ruleConfig)
    this.config = ruleConfig?.config || {
      idempotentMethods: ['get', 'head', 'put', 'delete', 'options'],
      nonIdempotentMethods: ['post', 'patch'],
      idempotencyKeyHeader: 'Idempotency-Key',
      requireIdempotencyKeyFor: ['post'],
      idempotencyKeyDescription: '幂等键，用于确保请求的幂等性。相同的幂等键多次请求应产生相同的效果。',
      validateIdempotencyKeyFormat: true,
      idempotencyKeyMinLength: 8,
      idempotencyKeyMaxLength: 64
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
          this.validateIdempotency(path, method, operation)
        }
      }
    }

    return this.getIssues()
  }

  validateIdempotency(path, method, operation) {
    const methodLower = method.toLowerCase()
    
    if (this.config.idempotentMethods.includes(methodLower)) {
      this.validateIdempotentMethodSemantics(path, method, operation)
    }

    if (this.config.nonIdempotentMethods.includes(methodLower)) {
      this.validateNonIdempotentMethod(path, method, operation)
    }
  }

  validateIdempotentMethodSemantics(path, method, operation) {
    const methodLower = method.toLowerCase()
    const operationId = operation.operationId || ''
    const summary = operation.summary || ''
    const description = operation.description || ''
    const combinedText = (operationId + ' ' + summary + ' ' + description).toLowerCase()

    if (methodLower === 'put') {
      if (combinedText.includes('partial') || combinedText.includes('部分')) {
        this.addIssue({
          title: 'PUT 方法语义与描述不一致',
          description: `路径 "${path}" 的 PUT 方法描述中包含"partial"或"部分"字样。PUT 应该是完整替换，部分更新应使用 PATCH。`,
          suggestion: '如果是部分更新，使用 PATCH 方法；如果是完整替换，修改描述。',
          location: { type: 'method', path, method },
          path: path,
          method: 'PUT',
          codeExample: {
            bad: `PUT /api/v1/users/{id}
description: 部分更新用户信息`,
            good: `PATCH /api/v1/users/{id}
description: 部分更新用户信息`
          },
          severity: 'warning'
        })
      }
    }

    if (methodLower === 'delete') {
      if (combinedText.includes('create') || combinedText.includes('add') || 
          combinedText.includes('创建') || combinedText.includes('添加')) {
        this.addIssue({
          title: 'DELETE 方法语义与描述不一致',
          description: `路径 "${path}" 的 DELETE 方法描述中包含创建或添加操作的语义。`,
          suggestion: 'DELETE 只应用于删除资源。如果是创建操作，使用 POST。',
          location: { type: 'method', path, method },
          path: path,
          method: 'DELETE',
          severity: 'warning'
        })
      }
    }

    if (methodLower === 'get') {
      if (combinedText.includes('create') || combinedText.includes('update') || 
          combinedText.includes('delete') || combinedText.includes('modify') ||
          combinedText.includes('创建') || combinedText.includes('更新') || 
          combinedText.includes('删除') || combinedText.includes('修改')) {
        this.addIssue({
          title: 'GET 方法语义与描述不一致',
          description: `路径 "${path}" 的 GET 方法描述中包含修改操作的语义。GET 应该是安全且幂等的。`,
          suggestion: 'GET 只应用于获取资源。如果是修改操作，使用 POST、PUT、PATCH 或 DELETE。',
          location: { type: 'method', path, method },
          path: path,
          method: 'GET',
          severity: 'error'
        })
      }

      if (operation.requestBody) {
        this.addIssue({
          title: 'GET 方法不应包含请求体',
          description: `路径 "${path}" 的 GET 操作定义了 requestBody。GET 通常不应该有请求体。`,
          suggestion: '如果需要传递数据，使用查询参数或考虑使用 POST 方法。',
          location: { type: 'requestBody', path, method },
          path: path,
          method: 'GET',
          severity: 'warning'
        })
      }
    }
  }

  validateNonIdempotentMethod(path, method, operation) {
    const methodLower = method.toLowerCase()

    if (this.config.requireIdempotencyKeyFor.includes(methodLower)) {
      this.validateIdempotencyKeyPresence(path, method, operation)
    }

    if (methodLower === 'post') {
      this.validatePostIdempotencyConsideration(path, operation)
    }
  }

  validateIdempotencyKeyPresence(path, method, operation) {
    const parameters = operation.parameters || []
    const idempotencyHeader = this.config.idempotencyKeyHeader.toLowerCase()

    const hasIdempotencyKey = parameters.some(param => 
      param.in === 'header' && 
      param.name?.toLowerCase() === idempotencyHeader
    )

    if (!hasIdempotencyKey) {
      const operationId = operation.operationId || ''
      const summary = operation.summary || ''
      const combinedText = (operationId + ' ' + summary).toLowerCase()

      if (combinedText.includes('create') || combinedText.includes('创建') ||
          combinedText.includes('submit') || combinedText.includes('提交') ||
          combinedText.includes('order') || combinedText.includes('订单') ||
          combinedText.includes('payment') || combinedText.includes('支付') ||
          combinedText.includes('transfer') || combinedText.includes('转账')) {
        this.addIssue({
          title: '关键操作缺少幂等键',
          description: `路径 "${path}" 的 ${method.toUpperCase()} 操作看起来是一个关键操作（创建、订单、支付等），但缺少 ${this.config.idempotencyKeyHeader} 头。`,
          suggestion: `添加 ${this.config.idempotencyKeyHeader} 请求头来确保幂等性，防止重复创建或重复扣款。`,
          location: { type: 'parameters', path },
          path: path,
          method: method.toUpperCase(),
          codeExample: {
            bad: `POST /api/v1/orders`,
            good: `POST /api/v1/orders
headers:
  Idempotency-Key: uuid-string`
          },
          severity: 'warning'
        })
      } else {
        this.addIssue({
          title: `POST 操作考虑添加幂等键`,
          description: `路径 "${path}" 的 POST 操作没有定义 ${this.config.idempotencyKeyHeader} 头。`,
          suggestion: `考虑添加 ${this.config.idempotencyKeyHeader} 头来支持客户端重试，确保幂等性。`,
          location: { type: 'parameters', path },
          path: path,
          method: method.toUpperCase(),
          severity: 'info'
        })
      }
    } else {
      this.validateIdempotencyKeyDefinition(path, method, parameters, idempotencyHeader)
    }
  }

  validateIdempotencyKeyDefinition(path, method, parameters, idempotencyHeader) {
    const idempotencyParam = parameters.find(param => 
      param.in === 'header' && 
      param.name?.toLowerCase() === idempotencyHeader
    )

    if (!idempotencyParam) {
      return
    }

    if (!idempotencyParam.description) {
      this.addIssue({
        title: '幂等键参数缺少描述',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作的 ${this.config.idempotencyKeyHeader} 头缺少 description。`,
        suggestion: `添加描述说明幂等键的用途、格式要求（如 UUID）、有效期等。`,
        location: { type: 'parameter', path, param: this.config.idempotencyKeyHeader },
        path: path,
        method: method.toUpperCase(),
        codeExample: {
          good: `- name: Idempotency-Key
  in: header
  description: |
    幂等键，用于确保请求的幂等性。
    - 格式：必须是有效的 UUID v4
    - 有效期：24 小时内有效
    - 重试：使用相同的幂等键重试请求，将返回第一次请求的结果
  schema:
    type: string
    format: uuid
  required: true`
        },
        severity: 'info'
      })
    }

    const schema = idempotencyParam.schema || {}
    
    if (schema.type && schema.type !== 'string') {
      this.addIssue({
        title: '幂等键类型不正确',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作的幂等键类型不是 string。`,
        suggestion: '幂等键应该是字符串类型，通常使用 UUID。',
        location: { type: 'parameter', path, param: this.config.idempotencyKeyHeader },
        path: path,
        method: method.toUpperCase(),
        severity: 'error'
      })
    }

    if (this.config.validateIdempotencyKeyFormat) {
      if (!schema.format || (schema.format !== 'uuid' && schema.format !== 'uuid4')) {
        this.addIssue({
          title: '幂等键没有指定格式',
          description: `路径 "${path}" 的 ${method.toUpperCase()} 操作的幂等键没有指定 format（如 uuid）。`,
          suggestion: '建议指定 format: uuid 来明确幂等键的格式要求。',
          location: { type: 'parameter', path, param: this.config.idempotencyKeyHeader },
          path: path,
          method: method.toUpperCase(),
          severity: 'info'
        })
      }
    }

    if (idempotencyParam.required === undefined || idempotencyParam.required === false) {
      this.addIssue({
        title: '幂等键应该设置为必填',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作的幂等键不是必需的。`,
        suggestion: '对于重要的幂等操作，建议将幂等键设置为 required: true。',
        location: { type: 'parameter', path, param: this.config.idempotencyKeyHeader },
        path: path,
        method: method.toUpperCase(),
        severity: 'warning'
      })
    }

    if (idempotencyParam.example === undefined && schema.example === undefined) {
      this.addIssue({
        title: '幂等键缺少示例',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作的幂等键没有 example。`,
        suggestion: '添加幂等键的示例值，如："a1b2c3d4-e5f6-7890-abcd-ef1234567890"。',
        location: { type: 'parameter', path, param: this.config.idempotencyKeyHeader },
        path: path,
        method: method.toUpperCase(),
        severity: 'info'
      })
    }
  }

  validatePostIdempotencyConsideration(path, operation) {
    const operationId = operation.operationId || ''
    const summary = operation.summary || ''
    const combinedText = (operationId + ' ' + summary).toLowerCase()

    if (combinedText.includes('list') || combinedText.includes('search') || 
        combinedText.includes('query') || combinedText.includes('get') ||
        combinedText.includes('列表') || combinedText.includes('搜索') ||
        combinedText.includes('查询') || combinedText.includes('获取')) {
      this.addIssue({
        title: 'POST 用于查询操作',
        description: `路径 "${path}" 的 POST 操作看起来是一个查询操作。POST 用于复杂查询是可接受的，但需要考虑幂等性。`,
        suggestion: '如果可以使用 GET（查询参数不过于复杂），优先使用 GET。如果必须使用 POST，请确保接口设计支持幂等性。',
        location: { type: 'method', path, method: 'post' },
        path: path,
        method: 'POST',
        codeExample: {
          good: `POST /api/v1/users/search
Content-Type: application/json

{
  "filters": {"status": "active"},
  "sort": "-createdAt",
  "limit": 20
}`
        },
        severity: 'info'
      })
    }
  }
}

module.exports = IdempotencyValidator