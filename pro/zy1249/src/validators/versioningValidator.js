const BaseValidator = require('./base')

class VersioningValidator extends BaseValidator {
  constructor(ruleConfig) {
    super(ruleConfig)
    this.config = ruleConfig?.config || {
      versioningStyles: {
        urlPath: { enabled: true, pattern: '^/v(\\d+(?:\\.\\d+)?)/' },
        header: { enabled: false, headerName: 'X-API-Version' },
        acceptHeader: { enabled: false, pattern: 'application/vnd\\.\\w+\\.v(\\d+(?:\\.\\d+)?)\\+json' }
      },
      requireVersioning: true,
      requireVersionFormat: 'semver',
      minVersion: '1.0.0',
      allowUnversionedPaths: ['/health', '/ping', '/ready', '/docs', '/openapi'],
      deprecation: {
        requireDeprecationHeader: true,
        requireSunsetHeader: true,
        minDeprecationNoticeDays: 90,
        requireDocumentation: true
      }
    }
  }

  async validate(spec, context = {}) {
    this.clearIssues()

    if (!spec || !spec.paths) {
      return this.getIssues()
    }

    this.validateSpecVersionInfo(spec)

    const paths = Object.keys(spec.paths)
    const versionedPaths = []
    const unversionedPaths = []

    for (const path of paths) {
      if (this.isAllowUnversionedPath(path)) {
        continue
      }

      const versionInfo = this.extractVersionFromPath(path)
      if (versionInfo) {
        versionedPaths.push({ path, version: versionInfo })
      } else {
        unversionedPaths.push(path)
      }
    }

    if (this.config.requireVersioning) {
      if (versionedPaths.length === 0 && unversionedPaths.length > 0) {
        this.addIssue({
          title: 'API 没有使用版本控制',
          description: `所有 API 路径都没有包含版本信息。`,
          suggestion: '考虑使用 URL 路径版本控制，如 /api/v1/users。',
          location: { type: 'spec' },
          severity: 'warning'
        })
      }

      for (const path of unversionedPaths) {
        this.addIssue({
          title: '路径缺少版本信息',
          description: `路径 "${path}" 没有包含版本信息。`,
          suggestion: '在路径中添加版本信息，如 /v1/users。',
          location: { type: 'path', path },
          path: path,
          severity: 'warning'
        })
      }
    }

    if (versionedPaths.length > 0) {
      this.validateVersionConsistency(versionedPaths)
    }

    for (const path of paths) {
      const pathItem = spec.paths[path]
      const methods = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head']

      for (const method of methods) {
        if (pathItem[method]) {
          const operation = pathItem[method]
          this.validateOperationVersioning(path, method, operation)
        }
      }
    }

    this.validateDeprecation(spec)

    return this.getIssues()
  }

  validateSpecVersionInfo(spec) {
    if (!spec.info) {
      this.addIssue({
        title: '缺少 info 部分',
        description: 'OpenAPI 规范缺少 info 部分。',
        suggestion: '添加 info 部分，包含 title、description 和 version。',
        location: { type: 'spec' },
        severity: 'error'
      })
      return
    }

    if (!spec.info.version) {
      this.addIssue({
        title: '缺少 API 版本信息',
        description: 'OpenAPI 规范的 info.version 未定义。',
        suggestion: '在 info.version 中定义 API 版本，如 "1.0.0"。',
        location: { type: 'spec', info: 'version' },
        severity: 'warning'
      })
    } else {
      this.validateVersionFormat(spec.info.version, 'info.version')
    }

    if (!spec.info.title) {
      this.addIssue({
        title: '缺少 API 标题',
        description: 'OpenAPI 规范的 info.title 未定义。',
        suggestion: '在 info.title 中定义 API 标题。',
        location: { type: 'spec', info: 'title' },
        severity: 'info'
      })
    }
  }

  isAllowUnversionedPath(path) {
    return this.config.allowUnversionedPaths.some(allowedPath => 
      path === allowedPath || path.startsWith(allowedPath + '/')
    )
  }

  extractVersionFromPath(path) {
    if (this.config.versioningStyles.urlPath.enabled) {
      const match = path.match(this.config.versioningStyles.urlPath.pattern)
      if (match) {
        return {
          version: match[1],
          style: 'urlPath',
          prefix: match[0]
        }
      }
    }
    return null
  }

  validateVersionFormat(version, location) {
    if (this.config.requireVersionFormat === 'semver') {
      const semverPattern = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9-]+)?(?:\+[a-zA-Z0-9-]+)?$/
      if (!semverPattern.test(version)) {
        this.addIssue({
          title: '版本格式不符合语义化版本规范',
          description: `版本 "${version}" 格式不符合语义化版本规范 (SemVer)。`,
          suggestion: '使用语义化版本格式：主版本号.次版本号.修订号，如 "1.0.0"、"2.1.0-beta"。',
          location: { type: 'version', location },
          severity: 'warning'
        })
      }
    }

    if (this.config.minVersion) {
      const minParts = this.config.minVersion.split('.').map(Number)
      const versionParts = version.split('.').map(v => Number(v.replace(/[^\d].*/, '')))
      
      if (versionParts[0] < minParts[0]) {
        this.addIssue({
          title: `版本号低于最低要求`,
          description: `版本 "${version}" 低于最低要求版本 "${this.config.minVersion}"。`,
          suggestion: `考虑升级到至少 ${this.config.minVersion} 或更新最低版本要求。`,
          location: { type: 'version', location },
          severity: 'info'
        })
      }
    }
  }

  validateVersionConsistency(versionedPaths) {
    const versions = new Set(versionedPaths.map(p => p.version))
    
    if (versions.size > 1) {
      this.addIssue({
        title: 'API 包含多个版本',
        description: `API 规范中包含多个版本：${Array.from(versions).join(', ')}。`,
        suggestion: '如果这是有意的多版本 API，请确保每个版本的文档是独立的。否则，保持版本一致性。',
        location: { type: 'spec' },
        severity: 'info'
      })
    }

    const prefixes = new Set(versionedPaths.map(p => p.prefix))
    if (prefixes.size > 1) {
      this.addIssue({
        title: '版本路径前缀不一致',
        description: `API 路径使用了不同的版本前缀：${Array.from(prefixes).join(', ')}。`,
        suggestion: '保持版本路径前缀一致，如都使用 /v1/。',
        location: { type: 'spec' },
        severity: 'warning'
      })
    }
  }

  validateOperationVersioning(path, method, operation) {
    if (this.config.versioningStyles.header.enabled) {
      const parameters = operation.parameters || []
      const hasVersionHeader = parameters.some(param => 
        param.in === 'header' && 
        param.name?.toLowerCase() === this.config.versioningStyles.header.headerName.toLowerCase()
      )

      if (!hasVersionHeader && !this.isAllowUnversionedPath(path)) {
        this.addIssue({
          title: `缺少版本头 ${this.config.versioningStyles.header.headerName}`,
          description: `路径 "${path}" 的 ${method.toUpperCase()} 操作缺少版本头。`,
          suggestion: `添加 ${this.config.versioningStyles.header.headerName} 请求头来指定 API 版本。`,
          location: { type: 'parameters', path },
          path: path,
          method: method.toUpperCase(),
          severity: 'warning'
        })
      }
    }

    if (this.config.versioningStyles.acceptHeader.enabled) {
      this.addIssue({
        title: 'Accept 头版本控制提示',
        description: `API 使用 Accept 头进行版本控制。`,
        suggestion: `确保在请求头中使用 Accept: application/vnd.api.v1+json 格式。`,
        location: { type: 'spec' },
        severity: 'info'
      })
    }
  }

  validateDeprecation(spec) {
    if (!spec.paths) {
      return
    }

    const paths = Object.keys(spec.paths)

    for (const path of paths) {
      const pathItem = spec.paths[path]
      const methods = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head']

      for (const method of methods) {
        if (pathItem[method]) {
          const operation = pathItem[method]
          this.validateOperationDeprecation(path, method, operation)
        }
      }
    }
  }

  validateOperationDeprecation(path, method, operation) {
    if (operation.deprecated !== true) {
      return
    }

    this.addIssue({
      title: '操作已废弃',
      description: `路径 "${path}" 的 ${method.toUpperCase()} 操作标记为废弃。`,
      suggestion: '检查废弃策略，确保有足够的通知期和迁移路径。',
      location: { type: 'operation', path, method },
      path: path,
      method: method.toUpperCase(),
      severity: 'info'
    })

    if (this.config.deprecation.requireDocumentation) {
      if (!operation.description || 
          (!operation.description.toLowerCase().includes('deprecated') && 
           !operation.description.toLowerCase().includes('废弃'))) {
        this.addIssue({
          title: '废弃操作缺少详细说明',
          description: `路径 "${path}" 的 ${method.toUpperCase()} 操作标记为废弃，但描述中没有详细说明。`,
          suggestion: '在 description 中添加废弃说明，包括：废弃原因、替代方案、迁移指南、预计移除日期。',
          location: { type: 'operation', path, method },
          path: path,
          method: method.toUpperCase(),
          codeExample: {
            good: `description: |
  **已废弃**: 此端点将于 2024-12-31 移除。
  
  **替代方案**: 请使用 GET /api/v2/users/{id}
  
  **变更说明**:
  - v2 版本返回的数据结构更规范
  - 请更新您的代码以使用新端点`
          },
          severity: 'warning'
        })
      }
    }

    if (operation.externalDocs) {
      if (!operation.externalDocs.url) {
        this.addIssue({
          title: '外部文档缺少 URL',
          description: `路径 "${path}" 的 ${method.toUpperCase()} 废弃操作的 externalDocs 缺少 url。`,
          suggestion: '在 externalDocs 中添加迁移文档的链接。',
          location: { type: 'operation', path, method },
          path: path,
          method: method.toUpperCase(),
          severity: 'info'
        })
      }
    }

    if (!operation.externalDocs && this.config.deprecation.requireDocumentation) {
      this.addIssue({
        title: '废弃操作缺少外部文档',
        description: `路径 "${path}" 的 ${method.toUpperCase()} 废弃操作没有 externalDocs。`,
        suggestion: '添加 externalDocs 指向详细的迁移指南。',
        location: { type: 'operation', path, method },
        path: path,
        method: method.toUpperCase(),
        codeExample: {
          good: `externalDocs:
  description: 迁移到 v2 版本的指南
  url: https://docs.example.com/api/migration/v1-to-v2`
        },
        severity: 'info'
      })
    }

    this.validateDeprecationResponse(path, method, operation)
  }

  validateDeprecationResponse(path, method, operation) {
    if (!operation.responses) {
      return
    }

    const successCodes = Object.keys(operation.responses).filter(code => code.charAt(0) === '2')
    
    for (const code of successCodes) {
      const response = operation.responses[code]
      if (response && response.headers) {
        const hasDeprecationHeader = Object.keys(response.headers).some(h => 
          h.toLowerCase() === 'deprecation' || h.toLowerCase() === 'x-deprecation'
        )
        
        const hasSunsetHeader = Object.keys(response.headers).some(h => 
          h.toLowerCase() === 'sunset' || h.toLowerCase() === 'x-sunset'
        )

        if (this.config.deprecation.requireDeprecationHeader && !hasDeprecationHeader) {
          this.addIssue({
            title: '废弃操作缺少 Deprecation 响应头',
            description: `路径 "${path}" 的 ${method.toUpperCase()} 废弃操作的响应缺少 Deprecation 头。`,
            suggestion: '添加 Deprecation 头指示资源已废弃。',
            location: { type: 'response', path, method, code },
            path: path,
            method: method.toUpperCase(),
            codeExample: {
              good: `responses:
  200:
    headers:
      Deprecation:
        description: 指示此端点已废弃
        schema:
          type: string
          example: 'true'
      Sunset:
        description: 指示此端点预计移除的日期
        schema:
          type: string
          format: date-time
          example: '2024-12-31T23:59:59Z'`
            },
            severity: 'info'
          })
        }

        if (this.config.deprecation.requireSunsetHeader && !hasSunsetHeader) {
          this.addIssue({
            title: '废弃操作缺少 Sunset 响应头',
            description: `路径 "${path}" 的 ${method.toUpperCase()} 废弃操作的响应缺少 Sunset 头。`,
            suggestion: '添加 Sunset 头指示资源预计移除的日期。',
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

module.exports = VersioningValidator