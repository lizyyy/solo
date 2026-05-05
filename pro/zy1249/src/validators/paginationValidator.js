const BaseValidator = require('./base')

class PaginationValidator extends BaseValidator {
  constructor(ruleConfig) {
    super(ruleConfig)
    this.config = ruleConfig?.config || {
      paginationParams: {
        offset: { name: 'offset', type: 'integer', minimum: 0, default: 0 },
        limit: { name: 'limit', type: 'integer', minimum: 1, maximum: 100, default: 20 },
        page: { name: 'page', type: 'integer', minimum: 1, default: 1 },
        size: { name: 'size', type: 'integer', minimum: 1, maximum: 100, default: 20 },
        cursor: { name: 'cursor', type: 'string' },
        after: { name: 'after', type: 'string' },
        before: { name: 'before', type: 'string' }
      },
      sortingParams: {
        sort: { name: 'sort', description: '排序字段，可加 - 前缀表示降序' },
        orderBy: { name: 'orderBy', description: '排序字段' },
        order: { name: 'order', values: ['asc', 'desc'], default: 'asc' }
      },
      filterParams: {
        common: ['filter', 'q', 'search', 'query', 'status', 'type', 'category'],
        dateRanges: ['from', 'to', 'startDate', 'endDate', 'createdAtFrom', 'createdAtTo']
      },
      paginationStyles: {
        offsetLimit: { params: ['offset', 'limit'], description: '偏移量分页' },
        pageNumber: { params: ['page', 'size'], description: '页码分页' },
        cursor: { params: ['cursor', 'limit'], description: '游标分页' }
      },
      requirePaginationForCollections: true,
      requireTotalCount: true,
      requireLinks: false,
      maximumLimit: 100
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
      
      if (pathItem.get) {
        this.validateListOperation(path, pathItem.get)
      }
    }

    return this.getIssues()
  }

  validateListOperation(path, operation) {
    const isCollection = this.isCollectionPath(path, operation)
    
    if (!isCollection) {
      return
    }

    const parameters = this.getAllParameters(path, operation)
    const queryParams = parameters.filter(p => p.in === 'query')

    if (this.config.requirePaginationForCollections) {
      const hasPaginationParams = this.hasPaginationParameters(queryParams)
      if (!hasPaginationParams) {
        this.addIssue({
          title: '列表操作缺少分页参数',
          description: `路径 "${path}" 的 GET 操作看起来是一个集合查询，但没有定义分页参数。`,
          suggestion: '添加分页参数，如 offset/limit、page/size 或 cursor/limit。',
          location: { type: 'operation', path, method: 'get' },
          path: path,
          method: 'GET',
          codeExample: {
            bad: `GET /api/v1/users`,
            good: `GET /api/v1/users?offset=0&limit=20
或
GET /api/v1/users?page=1&size=20
或
GET /api/v1/users?cursor=eyJpZCI6IjEyMyJ9&limit=20`
          },
          severity: 'warning'
        })
      }
    }

    this.validatePaginationConsistency(path, queryParams)
    this.validatePaginationParameterSchemas(path, queryParams)
    this.validateSortingParameters(path, queryParams)
    this.validateFilterParameters(path, queryParams)
    this.validateListResponse(path, operation)
  }

  isCollectionPath(path, operation) {
    const segments = path.split('/').filter(s => s)
    const lastSegment = segments[segments.length - 1]

    if (path.includes('{')) {
      return false
    }

    if (lastSegment && this.isPluralResource(lastSegment)) {
      return true
    }

    const operationId = operation.operationId || ''
    const summary = operation.summary || ''
    const combined = (operationId + ' ' + summary).toLowerCase()

    if (combined.includes('list') || combined.includes('search') || 
        combined.includes('get all') || combined.includes('query')) {
      return true
    }

    return false
  }

  isPluralResource(segment) {
    const pluralIndicators = ['s', 'ies', 'ves']
    const exceptions = ['status', 'process', 'bus', 'glass', 'class', 'address']
    
    if (exceptions.includes(segment.toLowerCase())) {
      return false
    }

    for (const indicator of pluralIndicators) {
      if (segment.endsWith(indicator) && segment.length > indicator.length) {
        return true
      }
    }

    return false
  }

  getAllParameters(path, operation) {
    const parameters = []
    
    if (operation.parameters) {
      parameters.push(...operation.parameters)
    }

    return parameters
  }

  hasPaginationParameters(queryParams) {
    const paginationParamNames = Object.values(this.config.paginationParams).map(p => p.name)
    
    return queryParams.some(param => {
      const paramName = param.name?.toLowerCase()
      return paginationParamNames.includes(paramName)
    })
  }

  validatePaginationConsistency(path, queryParams) {
    const paramNames = queryParams.map(p => p.name?.toLowerCase())
    
    const hasOffset = paramNames.includes('offset')
    const hasLimit = paramNames.includes('limit')
    const hasPage = paramNames.includes('page')
    const hasSize = paramNames.includes('size')
    const hasCursor = paramNames.includes('cursor')
    const hasAfter = paramNames.includes('after')
    const hasBefore = paramNames.includes('before')

    if (hasPage && hasOffset) {
      this.addIssue({
        title: '分页参数风格不一致',
        description: `路径 "${path}" 的 GET 操作同时定义了 page 和 offset，这两种分页风格不应该混用。`,
        suggestion: '选择一种分页风格：page/size（页码）或 offset/limit（偏移量）。',
        location: { type: 'parameters', path },
        path: path,
        method: 'GET',
        severity: 'error'
      })
    }

    if (hasOffset && !hasLimit) {
      this.addIssue({
        title: 'offset 分页缺少 limit 参数',
        description: `路径 "${path}" 的 GET 操作定义了 offset 但缺少 limit。`,
        suggestion: '添加 limit 参数来控制每页数量。',
        location: { type: 'parameters', path },
        path: path,
        method: 'GET',
        severity: 'warning'
      })
    }

    if (hasPage && !hasSize) {
      this.addIssue({
        title: 'page 分页缺少 size 参数',
        description: `路径 "${path}" 的 GET 操作定义了 page 但缺少 size。`,
        suggestion: '添加 size 参数来控制每页数量。',
        location: { type: 'parameters', path },
        path: path,
        method: 'GET',
        severity: 'warning'
      })
    }

    if (hasCursor && !hasLimit) {
      this.addIssue({
        title: 'cursor 分页缺少 limit 参数',
        description: `路径 "${path}" 的 GET 操作定义了 cursor 但缺少 limit。`,
        suggestion: '添加 limit 参数来控制每页数量。',
        location: { type: 'parameters', path },
        path: path,
        method: 'GET',
        severity: 'warning'
      })
    }

    if ((hasAfter || hasBefore) && !hasLimit) {
      this.addIssue({
        title: '游标分页缺少 limit 参数',
        description: `路径 "${path}" 的 GET 操作定义了 after/before 但缺少 limit。`,
        suggestion: '添加 limit 参数来控制每页数量。',
        location: { type: 'parameters', path },
        path: path,
        method: 'GET',
        severity: 'warning'
      })
    }
  }

  validatePaginationParameterSchemas(path, queryParams) {
    for (const param of queryParams) {
      const paramName = param.name?.toLowerCase()
      
      if (paramName === 'offset' || paramName === 'limit' || paramName === 'page' || paramName === 'size') {
        this.validateNumericPaginationParam(path, param)
      }
      
      if (paramName === 'cursor' || paramName === 'after' || paramName === 'before') {
        this.validateCursorParam(path, param)
      }
    }
  }

  validateNumericPaginationParam(path, param) {
    const paramName = param.name
    const schema = param.schema || {}
    
    if (schema.type !== 'integer' && schema.type !== 'number') {
      this.addIssue({
        title: `分页参数 ${paramName} 类型不正确`,
        description: `路径 "${path}" 的分页参数 ${paramName} 类型不是 integer。`,
        suggestion: '将类型设置为 integer。',
        location: { type: 'parameter', path, param: paramName },
        path: path,
        method: 'GET',
        severity: 'error'
      })
    }

    if (paramName === 'offset' || paramName === 'page') {
      const minimum = schema.minimum
      const expectedMinimum = paramName === 'offset' ? 0 : 1
      
      if (minimum === undefined || minimum < expectedMinimum) {
        this.addIssue({
          title: `分页参数 ${paramName} 缺少最小限制`,
          description: `路径 "${path}" 的分页参数 ${paramName} 没有定义合适的 minimum。`,
          suggestion: `设置 minimum: ${expectedMinimum}。`,
          location: { type: 'parameter', path, param: paramName },
          path: path,
          method: 'GET',
          severity: 'warning'
        })
      }
    }

    if (paramName === 'limit' || paramName === 'size') {
      const maximum = schema.maximum
      
      if (maximum === undefined || maximum > this.config.maximumLimit) {
        this.addIssue({
          title: `分页参数 ${paramName} 缺少最大限制`,
          description: `路径 "${path}" 的分页参数 ${paramName} 没有定义合适的 maximum。`,
          suggestion: `设置 maximum <= ${this.config.maximumLimit} 以防止性能问题。`,
          location: { type: 'parameter', path, param: paramName },
          path: path,
          method: 'GET',
          codeExample: {
            good: `parameters:
  - name: limit
    in: query
    schema:
      type: integer
      minimum: 1
      maximum: 100
      default: 20`
          },
          severity: 'warning'
        })
      }
    }

    if (schema.default === undefined && param.example === undefined) {
      this.addIssue({
        title: `分页参数 ${paramName} 缺少默认值或示例`,
        description: `路径 "${path}" 的分页参数 ${paramName} 没有定义 default 或 example。`,
        suggestion: '添加 default 值或 example 帮助开发者理解用法。',
        location: { type: 'parameter', path, param: paramName },
        path: path,
        method: 'GET',
        severity: 'info'
      })
    }
  }

  validateCursorParam(path, param) {
    const paramName = param.name
    const schema = param.schema || {}
    
    if (schema.type && schema.type !== 'string') {
      this.addIssue({
        title: `游标参数 ${paramName} 类型不正确`,
        description: `路径 "${path}" 的游标参数 ${paramName} 类型不是 string。`,
        suggestion: '将类型设置为 string。游标通常是 base64 编码的字符串。',
        location: { type: 'parameter', path, param: paramName },
        path: path,
        method: 'GET',
        severity: 'error'
      })
    }

    if (!param.description) {
      this.addIssue({
        title: `游标参数 ${paramName} 缺少描述`,
        description: `路径 "${path}" 的游标参数 ${paramName} 没有 description。`,
        suggestion: '描述游标如何获取（从上一页响应的 nextCursor 字段）。',
        location: { type: 'parameter', path, param: paramName },
        path: path,
        method: 'GET',
        severity: 'info'
      })
    }
  }

  validateSortingParameters(path, queryParams) {
    const sortParamNames = Object.values(this.config.sortingParams).map(p => p.name?.toLowerCase())
    const hasSortParam = queryParams.some(param => 
      sortParamNames.includes(param.name?.toLowerCase())
    )

    if (hasSortParam) {
      for (const param of queryParams) {
        const paramName = param.name?.toLowerCase()
        if (sortParamNames.includes(paramName)) {
          this.validateSortingParam(path, param)
        }
      }
    }
  }

  validateSortingParam(path, param) {
    const paramName = param.name
    
    if (!param.description) {
      this.addIssue({
        title: `排序参数 ${paramName} 缺少描述`,
        description: `路径 "${path}" 的排序参数 ${paramName} 没有 description。`,
        suggestion: '描述排序用法，如：支持多字段排序，用逗号分隔；- 前缀表示降序。',
        location: { type: 'parameter', path, param: paramName },
        path: path,
        method: 'GET',
        codeExample: {
          good: `- name: sort
  in: query
  description: |
    排序字段，支持多字段用逗号分隔。
    前缀 - 表示降序，+ 或无前缀表示升序。
    示例：sort=-createdAt,name
  schema:
    type: string`
        },
        severity: 'info'
      })
    }
  }

  validateFilterParameters(path, queryParams) {
    const filterParamNames = [...this.config.filterParams.common, ...this.config.filterParams.dateRanges]
    
    for (const param of queryParams) {
      const paramName = param.name?.toLowerCase()
      
      if (filterParamNames.some(f => paramName.includes(f))) {
        this.validateFilterParam(path, param)
      }
    }
  }

  validateFilterParam(path, param) {
    const paramName = param.name
    
    if (!param.description) {
      this.addIssue({
        title: `过滤参数 ${paramName} 缺少描述`,
        description: `路径 "${path}" 的过滤参数 ${paramName} 没有 description。`,
        suggestion: '描述过滤条件的用法。',
        location: { type: 'parameter', path, param: paramName },
        path: path,
        method: 'GET',
        severity: 'info'
      })
    }
  }

  validateListResponse(path, operation) {
    if (!operation.responses) {
      return
    }

    const successResponse = operation.responses['200'] || operation.responses['201'] || operation.responses['204']
    if (!successResponse || !successResponse.content) {
      return
    }

    const jsonContent = successResponse.content['application/json']
    if (!jsonContent || !jsonContent.schema) {
      return
    }

    const schema = jsonContent.schema
    
    if (this.config.requireTotalCount) {
      const hasTotalCount = this.hasPropertyInSchema(schema, ['total', 'totalCount', 'totalElements', 'count'])
      if (!hasTotalCount) {
        this.addIssue({
          title: '列表响应缺少总数',
          description: `路径 "${path}" 的 GET 列表操作响应中没有 total 或类似字段。`,
          suggestion: '在响应中添加总数信息，如 total、totalCount 等。',
          location: { type: 'response', path, method: 'get' },
          path: path,
          method: 'GET',
          codeExample: {
            good: `{
  "total": 150,
  "offset": 0,
  "limit": 20,
  "items": [...]
}`
          },
          severity: 'warning'
        })
      }
    }

    const hasItems = this.hasPropertyInSchema(schema, ['items', 'data', 'results', 'list', 'content'])
    if (!hasItems) {
      this.addIssue({
        title: '列表响应缺少数据数组',
        description: `路径 "${path}" 的 GET 列表操作响应中没有明显的数据数组字段。`,
        suggestion: '使用标准的数组字段名，如 items、data、results 等。',
        location: { type: 'response', path, method: 'get' },
        path: path,
        method: 'GET',
        severity: 'warning'
      })
    }

    const hasPaginationInfo = this.hasPropertyInSchema(schema, ['page', 'pages', 'totalPages', 'offset', 'limit', 'size', 'cursor', 'nextCursor', 'prevCursor'])
    if (!hasPaginationInfo) {
      this.addIssue({
        title: '列表响应缺少分页信息',
        description: `路径 "${path}" 的 GET 列表操作响应中没有分页信息。`,
        suggestion: '在响应中返回分页元数据，如 offset、limit、totalPages 或 cursor 信息。',
        location: { type: 'response', path, method: 'get' },
        path: path,
        method: 'GET',
        severity: 'info'
      })
    }
  }

  hasPropertyInSchema(schema, propertyNames) {
    if (!schema) {
      return false
    }

    if (schema.properties) {
      for (const propName of propertyNames) {
        if (schema.properties[propName]) {
          return true
        }
      }
    }

    if (schema.allOf) {
      for (const subSchema of schema.allOf) {
        if (this.hasPropertyInSchema(subSchema, propertyNames)) {
          return true
        }
      }
    }

    if (schema.anyOf) {
      for (const subSchema of schema.anyOf) {
        if (this.hasPropertyInSchema(subSchema, propertyNames)) {
          return true
        }
      }
    }

    if (schema.oneOf) {
      for (const subSchema of schema.oneOf) {
        if (this.hasPropertyInSchema(subSchema, propertyNames)) {
          return true
        }
      }
    }

    return false
  }
}

module.exports = PaginationValidator