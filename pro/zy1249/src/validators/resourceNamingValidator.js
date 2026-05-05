const BaseValidator = require('./base')

class ResourceNamingValidator extends BaseValidator {
  constructor(ruleConfig) {
    super(ruleConfig)
    this.config = ruleConfig?.config || {
      allowPluralResource: true,
      allowKebeCase: true,
      allowCamelCase: false,
      allowSnakeCase: false,
      allowVerbsInPath: false,
      allowTrailingSlash: false,
      reservedWords: ['create', 'update', 'delete', 'add', 'remove', 'get', 'list', 'search', 'find']
    }
  }

  async validate(spec, context = {}) {
    this.clearIssues()

    if (!spec || !spec.paths) {
      return this.getIssues()
    }

    const paths = Object.keys(spec.paths)

    for (const path of paths) {
      this.validatePathFormat(path)
      
      const pathItem = spec.paths[path]
      const methods = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head']
      
      for (const method of methods) {
        if (pathItem[method]) {
          this.validateOperationNaming(path, method, pathItem[method])
        }
      }
    }

    return this.getIssues()
  }

  validatePathFormat(path) {
    const segments = path.split('/').filter(s => s)

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      
      if (segment.startsWith('{') && segment.endsWith('}')) {
        const paramName = segment.slice(1, -1)
        this.validateParameterNaming(paramName, 'path', path)
        continue
      }

      if (this.config.allowVerbsInPath === false) {
        if (this.config.reservedWords.includes(segment.toLowerCase())) {
          this.addIssue({
            title: '路径中不应包含动作动词',
            description: `路径段 "${segment}" 是一个动作动词，RESTful API 应使用 HTTP 方法来表达动作，而非在路径中使用动词。`,
            suggestion: '将动词移除，使用正确的 HTTP 方法。例如：POST /users 而非 POST /createUser',
            location: { type: 'path', path, segment: segment },
            path: path,
            codeExample: {
              bad: `POST /api/v1/createUser`,
              good: `POST /api/v1/users`
            },
            severity: 'error'
          })
        }
      }

      if (this.config.allowKebeCase === false) {
        if (segment.includes('-')) {
          this.addIssue({
            title: '路径命名风格不符合规范',
            description: `路径段 "${segment}" 使用了 kebab-case 命名风格，当前配置不允许。`,
            suggestion: '检查命名规范配置，使用允许的命名风格。',
            location: { type: 'path', path, segment: segment },
            path: path
          })
        }
      }

      if (this.config.allowCamelCase === false) {
        if (/[a-z][A-Z]/.test(segment)) {
          this.addIssue({
            title: '路径不应使用 camelCase',
            description: `路径段 "${segment}" 使用了 camelCase 命名风格。RESTful API 路径通常使用 kebab-case。`,
            suggestion: '使用 kebab-case 代替 camelCase。例如：user-accounts 而非 userAccounts。',
            location: { type: 'path', path, segment: segment },
            path: path,
            codeExample: {
              bad: `/api/v1/userAccounts`,
              good: `/api/v1/user-accounts`
            },
            severity: 'warning'
          })
        }
      }

      if (this.config.allowSnakeCase === false) {
        if (segment.includes('_')) {
          this.addIssue({
            title: '路径不应使用 snake_case',
            description: `路径段 "${segment}" 使用了 snake_case 命名风格。RESTful API 路径通常使用 kebab-case。`,
            suggestion: '使用 kebab-case 代替 snake_case。例如：user-accounts 而非 user_accounts。',
            location: { type: 'path', path, segment: segment },
            path: path,
            codeExample: {
              bad: `/api/v1/user_accounts`,
              good: `/api/v1/user-accounts`
            },
            severity: 'warning'
          })
        }
      }

      if (this.config.allowPluralResource === false) {
        if (this.isPlural(segment) && i < segments.length - 1) {
          this.addIssue({
            title: '资源命名不符合单数规范',
            description: `路径段 "${segment}" 使用了复数形式，但当前配置要求使用单数。`,
            suggestion: '使用单数形式。例如：/user 而非 /users。',
            location: { type: 'path', path, segment: segment },
            path: path,
            severity: 'warning'
          })
        }
      }
    }

    if (this.config.allowTrailingSlash === false && path.endsWith('/') && path.length > 1) {
      this.addIssue({
        title: '路径不应包含尾部斜杠',
        description: `路径 "${path}" 包含尾部斜杠，这可能导致路由匹配问题。`,
        suggestion: '移除尾部斜杠。例如：/api/v1/users 而非 /api/v1/users/。',
        location: { type: 'path', path },
        path: path,
        codeExample: {
          bad: `/api/v1/users/`,
          good: `/api/v1/users`
        },
        severity: 'warning'
      })
    }
  }

  validateParameterNaming(paramName, paramType, path) {
    if (paramType === 'path') {
      if (paramName.includes('-')) {
        this.addIssue({
          title: '路径参数不应使用 kebab-case',
          description: `路径参数 "${paramName}" 使用了 kebab-case。路径参数通常使用 camelCase。`,
          suggestion: '使用 camelCase。例如：{userId} 而非 {user-id}。',
          location: { type: 'path-param', path, param: paramName },
          path: path,
          codeExample: {
            bad: `/api/v1/users/{user-id}`,
            good: `/api/v1/users/{userId}`
          },
          severity: 'warning'
        })
      }
    }
  }

  validateOperationNaming(path, method, operation) {
    const operationId = operation.operationId
    
    if (!operationId) {
      this.addIssue({
        title: '操作缺少 operationId',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 操作缺少 operationId。operationId 对于生成客户端 SDK 和文档很重要。`,
        suggestion: '添加有意义的 operationId。例如：getUser, createOrder。',
        location: { type: 'operation', path, method },
        path: path,
        method: method.toUpperCase(),
        severity: 'info'
      })
      return
    }

    if (operationId.includes('-')) {
      this.addIssue({
        title: 'operationId 不应使用 kebab-case',
        description: `operationId "${operationId}" 使用了 kebab-case。应该使用 camelCase。`,
        suggestion: '使用 camelCase。例如：getUser 而非 get-user。',
        location: { type: 'operationId', path, method, operationId },
        path: path,
        method: method.toUpperCase(),
        codeExample: {
          bad: 'operationId: get-user',
          good: 'operationId: getUser'
        },
        severity: 'warning'
      })
    }

    const expectedPrefixes = {
      get: ['get', 'list', 'search', 'retrieve'],
      post: ['create', 'add', 'post', 'submit'],
      put: ['update', 'replace', 'put'],
      patch: ['patch', 'partial', 'modify'],
      delete: ['delete', 'remove', 'destroy']
    }

    const prefixes = expectedPrefixes[method] || []
    const matchesPrefix = prefixes.some(prefix => 
      operationId.toLowerCase().startsWith(prefix.toLowerCase())
    )

    if (!matchesPrefix && prefixes.length > 0) {
      this.addIssue({
        title: 'operationId 命名不够语义化',
        description: `operationId "${operationId}" 对于 ${method.toUpperCase()} 方法来说，命名不够语义化。`,
        suggestion: `对于 ${method.toUpperCase()} 方法，建议使用以下前缀之一：${prefixes.join(', ')}。`,
        location: { type: 'operationId', path, method, operationId },
        path: path,
        method: method.toUpperCase(),
        severity: 'info'
      })
    }
  }

  isPlural(word) {
    const irregular = {
      'people': 'person',
      'children': 'child',
      'men': 'man',
      'women': 'woman',
      'feet': 'foot',
      'teeth': 'tooth',
      'geese': 'goose',
      'mice': 'mouse',
      'lice': 'louse',
      'oxen': 'ox',
      'cacti': 'cactus',
      'foci': 'focus',
      'fungi': 'fungus',
      'nuclei': 'nucleus',
      'syllabi': 'syllabus',
      'analyses': 'analysis',
      'diagnoses': 'diagnosis',
      'oases': 'oasis',
      'theses': 'thesis',
      'crises': 'crisis',
      'phenomena': 'phenomenon',
      'criteria': 'criterion',
      'data': 'datum'
    }

    if (irregular[word.toLowerCase()]) {
      return true
    }

    if (word.endsWith('ies') && word.length > 3) {
      return true
    }

    if (word.endsWith('ves') && word.length > 3) {
      return true
    }

    if (word.endsWith('s')) {
      if (!word.endsWith('ss') && !word.endsWith('us') && !word.endsWith('is')) {
        return true
      }
    }

    return false
  }
}

module.exports = ResourceNamingValidator