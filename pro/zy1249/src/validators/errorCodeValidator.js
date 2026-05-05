const BaseValidator = require('./base')

class ErrorCodeValidator extends BaseValidator {
  constructor(ruleConfig) {
    super(ruleConfig)
    this.config = ruleConfig?.config || {
      requireConsistentErrorCodeFormat: true,
      errorCodeFields: ['code', 'errorCode', 'error_code', 'errCode', 'err_code'],
      errorMessageFields: ['message', 'errorMessage', 'error_message', 'msg'],
      errorDetailFields: ['details', 'detail', 'errors', 'errorDetails'],
      requireErrorSchemaConsistency: true,
      standardErrorCodes: [
        'VALIDATION_ERROR',
        'AUTHENTICATION_FAILED',
        'AUTHORIZATION_FAILED',
        'RESOURCE_NOT_FOUND',
        'CONFLICT',
        'RATE_LIMIT_EXCEEDED',
        'INTERNAL_ERROR',
        'SERVICE_UNAVAILABLE'
      ],
      errorCodePattern: '^[A-Z_]+$',
      requireErrorResponses: ['400', '401', '403', '404', '500']
    }
  }

  async validate(spec, context = {}) {
    this.clearIssues()

    if (!spec || !spec.paths) {
      return this.getIssues()
    }

    const errorSchemas = this.extractErrorSchemas(spec)

    const paths = Object.keys(spec.paths)

    for (const path of paths) {
      const pathItem = spec.paths[path]
      const methods = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head']

      for (const method of methods) {
        if (pathItem[method]) {
          const operation = pathItem[method]
          this.validateOperationErrorResponses(path, method, operation, errorSchemas)
        }
      }
    }

    return this.getIssues()
  }

  extractErrorSchemas(spec) {
    const errorSchemas = {}
    
    if (!spec.components || !spec.components.schemas) {
      return errorSchemas
    }

    const schemas = spec.components.schemas
    for (const [name, schema] of Object.entries(schemas)) {
      const nameLower = name.toLowerCase()
      if (nameLower.includes('error') || nameLower.includes('problem') || 
          nameLower.includes('fail') || nameLower.includes('exception')) {
        errorSchemas[name] = schema
      }
    }

    return errorSchemas
  }

  validateOperationErrorResponses(path, method, operation, errorSchemas) {
    if (!operation.responses) {
      return
    }

    const responses = operation.responses
    const responseCodes = Object.keys(responses)

    const errorCodes = responseCodes.filter(code => {
      const firstDigit = code.charAt(0)
      return firstDigit === '4' || firstDigit === '5'
    })

    if (errorCodes.length === 0) {
      this.addIssue({
        title: '操作缺少错误响应定义',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作没有定义任何 4xx 或 5xx 错误响应。`,
        suggestion: `定义常见的错误响应，建议至少包含：${this.config.requireErrorResponses.join(', ')}。`,
        location: { type: 'responses', path, method },
        path: path,
        method: method.toUpperCase(),
        severity: 'warning'
      })
      return
    }

    for (const code of errorCodes) {
      const response = responses[code]
      if (response) {
        this.validateErrorResponse(path, method, code, response, errorSchemas)
      }
    }

    this.validateErrorResponseConsistency(path, method, errorCodes, responses)
  }

  validateErrorResponse(path, method, code, response, errorSchemas) {
    if (!response.content || Object.keys(response.content).length === 0) {
      if (code === '401' || code === '403' || code === '404') {
        this.addIssue({
          title: `错误响应 ${code} 缺少响应体`,
          description: `路径 "${path}" 的 ${method.toUpperCase()} 操作状态码 ${code} 的响应缺少 content 定义。`,
          suggestion: '定义错误响应体结构，包含错误码、错误信息等。',
          location: { type: 'response', path, method, code },
          path: path,
          method: method.toUpperCase(),
          severity: 'info'
        })
      } else {
        this.addIssue({
          title: `错误响应 ${code} 缺少响应体`,
          description: `路径 "${path}" 的 ${method.toUpperCase()} 操作状态码 ${code} 的响应缺少 content 定义。`,
          suggestion: '定义错误响应体结构，帮助客户端理解错误原因。',
          location: { type: 'response', path, method, code },
          path: path,
          method: method.toUpperCase(),
          severity: 'warning'
        })
      }
      return
    }

    const jsonContent = response.content['application/json']
    if (!jsonContent) {
      const contentTypes = Object.keys(response.content)
      this.addIssue({
        title: '错误响应没有使用 JSON 格式',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作状态码 ${code} 的响应使用了 ${contentTypes.join(', ')} 而不是 application/json。`,
        suggestion: '错误响应建议使用 application/json 格式，便于客户端解析。',
        location: { type: 'response', path, method, code },
        path: path,
        method: method.toUpperCase(),
        severity: 'info'
      })
      return
    }

    if (!jsonContent.schema) {
      this.addIssue({
        title: '错误响应缺少 schema 定义',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作状态码 ${code} 的响应缺少 schema 定义。`,
        suggestion: '定义错误响应的 schema 结构。',
        location: { type: 'response', path, method, code },
        path: path,
        method: method.toUpperCase(),
        severity: 'warning'
      })
      return
    }

    this.validateErrorSchemaStructure(path, method, code, jsonContent.schema)
  }

  validateErrorSchemaStructure(path, method, code, schema) {
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop()
      this.addIssue({
        title: `错误响应使用了引用 schema`,
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作状态码 ${code} 的响应使用了引用 schema：${refName}。`,
        suggestion: '确保所有错误响应使用一致的 schema 结构。',
        location: { type: 'response', path, method, code },
        path: path,
        method: method.toUpperCase(),
        severity: 'info'
      })
      return
    }

    if (!schema.properties) {
      this.addIssue({
        title: '错误响应 schema 缺少 properties',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作状态码 ${code} 的响应 schema 缺少 properties 定义。`,
        suggestion: '定义错误响应的属性，如 code、message 等。',
        location: { type: 'response', path, method, code },
        path: path,
        method: method.toUpperCase(),
        severity: 'error'
      })
      return
    }

    const properties = schema.properties
    const propertyNames = Object.keys(properties).map(p => p.toLowerCase())

    const hasErrorCode = this.config.errorCodeFields.some(field => 
      propertyNames.includes(field.toLowerCase())
    )

    if (!hasErrorCode) {
      this.addIssue({
        title: '错误响应缺少错误码字段',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作状态码 ${code} 的响应缺少错误码字段。`,
        suggestion: `添加错误码字段，推荐使用：${this.config.errorCodeFields.join(', ')}。`,
        location: { type: 'response', path, method, code },
        path: path,
        method: method.toUpperCase(),
        codeExample: {
          good: `{
  "code": "VALIDATION_ERROR",
  "message": "请求数据验证失败"
}`
        },
        severity: 'error'
      })
    }

    const hasErrorMessage = this.config.errorMessageFields.some(field => 
      propertyNames.includes(field.toLowerCase())
    )

    if (!hasErrorMessage) {
      this.addIssue({
        title: '错误响应缺少错误信息字段',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作状态码 ${code} 的响应缺少错误信息字段。`,
        suggestion: `添加错误信息字段，推荐使用：${this.config.errorMessageFields.join(', ')}。`,
        location: { type: 'response', path, method, code },
        path: path,
        method: method.toUpperCase(),
        severity: 'warning'
      })
    }

    const requiredFields = schema.required || []
    const requiredNames = requiredFields.map(f => f.toLowerCase())

    const requiredErrorCode = this.config.errorCodeFields.some(field => 
      requiredNames.includes(field.toLowerCase())
    )

    if (hasErrorCode && !requiredErrorCode) {
      this.addIssue({
        title: '错误码字段没有标记为 required',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作状态码 ${code} 的响应中错误码字段没有标记为 required。`,
        suggestion: '将错误码字段添加到 required 列表中。',
        location: { type: 'response', path, method, code },
        path: path,
        method: method.toUpperCase(),
        severity: 'warning'
      })
    }

    const requiredErrorMessage = this.config.errorMessageFields.some(field => 
      requiredNames.includes(field.toLowerCase())
    )

    if (hasErrorMessage && !requiredErrorMessage) {
      this.addIssue({
        title: '错误信息字段没有标记为 required',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作状态码 ${code} 的响应中错误信息字段没有标记为 required。`,
        suggestion: '将错误信息字段添加到 required 列表中。',
        location: { type: 'response', path, method, code },
        path: path,
        method: method.toUpperCase(),
        severity: 'info'
      })
    }

    this.validateErrorCodeExamples(path, method, code, schema)
  }

  validateErrorCodeExamples(path, method, code, schema) {
    const properties = schema.properties
    
    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      const fieldNameLower = fieldName.toLowerCase()
      
      if (this.config.errorCodeFields.some(f => f.toLowerCase() === fieldNameLower)) {
        if (fieldSchema.enum && fieldSchema.enum.length > 0) {
          for (const enumValue of fieldSchema.enum) {
            if (!this.config.standardErrorCodes.includes(enumValue)) {
              this.addIssue({
                title: `错误码 "${enumValue}" 不是标准错误码`,
                description: `路径 "${path}" 的 ${method.toUpperCase()} 操作状态码 ${code} 的响应中定义了非标准错误码 "${enumValue}"。`,
                suggestion: `考虑使用标准错误码：${this.config.standardErrorCodes.join(', ')}。`,
                location: { type: 'response', path, method, code },
                path: path,
                method: method.toUpperCase(),
                severity: 'info'
              })
            }
          }
        }

        if (this.config.errorCodePattern && fieldSchema.pattern) {
          if (fieldSchema.pattern !== this.config.errorCodePattern) {
            this.addIssue({
              title: '错误码格式模式不一致',
              description: `路径 "${path}" 的 ${method.toUpperCase()} 操作状态码 ${code} 的响应中错误码格式模式与标准不一致。`,
              suggestion: `使用标准的错误码模式：${this.config.errorCodePattern}。`,
              location: { type: 'response', path, method, code },
              path: path,
              method: method.toUpperCase(),
              severity: 'info'
            })
          }
        }
      }
    }
  }

  validateErrorResponseConsistency(path, method, errorCodes, responses) {
    const schemasByCode = {}

    for (const code of errorCodes) {
      const response = responses[code]
      if (response && response.content && response.content['application/json']) {
        const schema = response.content['application/json'].schema
        if (schema) {
          schemasByCode[code] = schema
        }
      }
    }

    if (Object.keys(schemasByCode).length < 2) {
      return
    }

    const schemaRefs = new Set()
    const schemaHashes = []

    for (const [code, schema] of Object.entries(schemasByCode)) {
      if (schema.$ref) {
        schemaRefs.add(schema.$ref)
      } else {
        const properties = Object.keys(schema.properties || {}).sort().join(',')
        schemaHashes.push(properties)
      }
    }

    if (schemaRefs.size > 1) {
      this.addIssue({
        title: '错误响应使用了不同的引用 schema',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作的错误响应使用了不同的引用 schema。`,
        suggestion: '考虑使用统一的错误响应 schema。',
        location: { type: 'responses', path, method },
        path: path,
        method: method.toUpperCase(),
        severity: 'info'
      })
    }

    if (schemaHashes.length > 0) {
      const uniqueHashes = [...new Set(schemaHashes)]
      if (uniqueHashes.length > 1) {
        this.addIssue({
          title: '错误响应 schema 结构不一致',
          description: `路径 "${path}" 的 ${method.toUpperCase()} 操作的错误响应 schema 结构不一致。`,
          suggestion: '确保所有错误响应使用一致的结构。',
          location: { type: 'responses', path, method },
          path: path,
          method: method.toUpperCase(),
          severity: 'warning'
        })
      }
    }
  }
}

module.exports = ErrorCodeValidator