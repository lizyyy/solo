const BaseValidator = require('./base')
const ResourceNamingValidator = require('./resourceNamingValidator')
const HttpMethodValidator = require('./httpMethodValidator')
const StatusCodeValidator = require('./statusCodeValidator')
const PaginationValidator = require('./paginationValidator')
const IdempotencyValidator = require('./idempotencyValidator')
const ErrorCodeValidator = require('./errorCodeValidator')
const VersioningValidator = require('./versioningValidator')

const validators = {
  ResourceNamingValidator,
  HttpMethodValidator,
  StatusCodeValidator,
  PaginationValidator,
  IdempotencyValidator,
  ErrorCodeValidator,
  VersioningValidator
}

const validatorMap = {
  'resource-naming': ResourceNamingValidator,
  'http-method': HttpMethodValidator,
  'status-code': StatusCodeValidator,
  'pagination': PaginationValidator,
  'idempotency': IdempotencyValidator,
  'error-code': ErrorCodeValidator,
  'versioning': VersioningValidator
}

const defaultRules = [
  {
    ruleId: 'resource-naming',
    name: '资源命名规范',
    category: 'naming',
    description: '验证资源路径命名规范，包括 kebab-case、复数形式、动词检查等',
    severity: 'warning',
    isEnabled: true,
    config: {
      allowPluralResource: true,
      allowKebeCase: true,
      allowCamelCase: false,
      allowSnakeCase: false,
      allowVerbsInPath: false,
      allowTrailingSlash: false
    }
  },
  {
    ruleId: 'http-method',
    name: 'HTTP 方法规范',
    category: 'http',
    description: '验证 HTTP 方法使用是否正确，包括语义一致性、请求体检查等',
    severity: 'warning',
    isEnabled: true,
    config: {
      standardMethods: ['get', 'put', 'post', 'delete', 'patch', 'options', 'head'],
      allowMethodsWithBody: ['post', 'put', 'patch'],
      requireRequestBody: ['post', 'put', 'patch']
    }
  },
  {
    ruleId: 'status-code',
    name: '状态码规范',
    category: 'http',
    description: '验证 HTTP 状态码使用是否正确，包括成功响应、错误响应等',
    severity: 'warning',
    isEnabled: true,
    config: {
      requireDescription: true,
      requiredResponses: {
        'get': ['200'],
        'post': ['200', '201'],
        'put': ['200', '204'],
        'patch': ['200', '204'],
        'delete': ['200', '204']
      },
      commonErrorCodes: ['400', '401', '403', '404', '422', '429', '500']
    }
  },
  {
    ruleId: 'pagination',
    name: '分页过滤规范',
    category: 'pattern',
    description: '验证分页参数、排序参数、过滤参数的设计规范',
    severity: 'warning',
    isEnabled: true,
    config: {
      requirePaginationForCollections: true,
      requireTotalCount: true,
      maximumLimit: 100
    }
  },
  {
    ruleId: 'idempotency',
    name: '幂等键规范',
    category: 'reliability',
    description: '验证幂等性设计，包括幂等键头、幂等方法语义等',
    severity: 'warning',
    isEnabled: true,
    config: {
      idempotencyKeyHeader: 'Idempotency-Key',
      requireIdempotencyKeyFor: ['post'],
      validateIdempotencyKeyFormat: true
    }
  },
  {
    ruleId: 'error-code',
    name: '错误码规范',
    category: 'error-handling',
    description: '验证错误响应格式、错误码一致性、错误信息规范',
    severity: 'warning',
    isEnabled: true,
    config: {
      requireConsistentErrorCodeFormat: true,
      errorCodeFields: ['code', 'errorCode', 'error_code'],
      errorMessageFields: ['message', 'errorMessage'],
      requireErrorSchemaConsistency: true,
      standardErrorCodes: [
        'VALIDATION_ERROR',
        'AUTHENTICATION_FAILED',
        'AUTHORIZATION_FAILED',
        'RESOURCE_NOT_FOUND',
        'CONFLICT',
        'RATE_LIMIT_EXCEEDED',
        'INTERNAL_ERROR'
      ]
    }
  },
  {
    ruleId: 'versioning',
    name: '版本兼容与废弃策略',
    category: 'compatibility',
    description: '验证 API 版本控制、废弃策略、向后兼容性',
    severity: 'info',
    isEnabled: true,
    config: {
      versioningStyles: {
        urlPath: { enabled: true, pattern: '^/v(\\d+(?:\\.\\d+)?)/' }
      },
      requireVersioning: true,
      requireVersionFormat: 'semver',
      deprecation: {
        requireDeprecationHeader: true,
        requireSunsetHeader: true,
        requireDocumentation: true
      }
    }
  }
]

function getValidator(ruleId, ruleConfig) {
  const ValidatorClass = validatorMap[ruleId]
  if (!ValidatorClass) {
    return null
  }
  return new ValidatorClass(ruleConfig)
}

function getAllValidators() {
  return Object.keys(validatorMap)
}

function getDefaultRules() {
  return [...defaultRules]
}

module.exports = {
  BaseValidator,
  ResourceNamingValidator,
  HttpMethodValidator,
  StatusCodeValidator,
  PaginationValidator,
  IdempotencyValidator,
  ErrorCodeValidator,
  VersioningValidator,
  validators,
  validatorMap,
  defaultRules,
  getValidator,
  getAllValidators,
  getDefaultRules
}