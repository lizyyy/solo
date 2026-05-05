const yaml = require('yaml')
const crypto = require('crypto')

class OpenApiParser {
  constructor() {
    this.supportedVersions = ['2.0', '3.0', '3.1']
  }

  parse(content) {
    let spec
    
    try {
      if (typeof content === 'string') {
        if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
          spec = JSON.parse(content)
        } else {
          spec = yaml.parse(content)
        }
      } else if (typeof content === 'object') {
        spec = content
      } else {
        throw new Error('Invalid content type. Expected string or object.')
      }
    } catch (error) {
      throw new Error(`Failed to parse OpenAPI specification: ${error.message}`)
    }

    if (!spec) {
      throw new Error('Empty specification')
    }

    return this.normalizeSpec(spec)
  }

  normalizeSpec(spec) {
    const version = this.detectVersion(spec)
    
    if (!version) {
      throw new Error('Unable to detect OpenAPI/Swagger version')
    }

    const normalized = {
      ...spec,
      _meta: {
        version: version,
        parsedAt: new Date().toISOString(),
        hash: this.generateHash(spec)
      }
    }

    return normalized
  }

  detectVersion(spec) {
    if (spec.openapi) {
      const match = spec.openapi.match(/^(\d+\.\d+)/)
      return match ? `3.${match[1].split('.')[1]}` : '3.0'
    }
    
    if (spec.swagger) {
      return spec.swagger
    }

    return null
  }

  generateHash(spec) {
    const content = typeof spec === 'string' ? spec : JSON.stringify(spec)
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex')
  }

  validate(spec) {
    const errors = []
    const warnings = []

    if (!spec.openapi && !spec.swagger) {
      errors.push('Missing openapi or swagger version field')
    }

    if (!spec.info) {
      errors.push('Missing info section')
    } else {
      if (!spec.info.title) {
        warnings.push('Missing info.title')
      }
      if (!spec.info.version) {
        warnings.push('Missing info.version')
      }
    }

    if (!spec.paths || Object.keys(spec.paths).length === 0) {
      errors.push('Missing or empty paths section')
    } else {
      for (const [path, pathItem] of Object.entries(spec.paths)) {
        const pathErrors = this.validatePathItem(path, pathItem)
        errors.push(...pathErrors)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  validatePathItem(path, pathItem) {
    const errors = []
    const validMethods = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head']

    if (!pathItem || typeof pathItem !== 'object') {
      errors.push(`Invalid path item for path: ${path}`)
      return errors
    }

    const methods = Object.keys(pathItem).filter(key => validMethods.includes(key.toLowerCase()))

    if (methods.length === 0) {
      errors.push(`No HTTP methods defined for path: ${path}`)
    }

    for (const method of methods) {
      const operation = pathItem[method]
      if (!operation || typeof operation !== 'object') {
        errors.push(`Invalid operation for ${method.toUpperCase()} ${path}`)
        continue
      }

      if (!operation.responses || Object.keys(operation.responses).length === 0) {
        errors.push(`No responses defined for ${method.toUpperCase()} ${path}`)
      }
    }

    return errors
  }

  extractInfo(spec) {
    const info = spec.info || {}
    
    return {
      title: info.title || 'Untitled API',
      description: info.description || '',
      version: info.version || 'unknown',
      contact: info.contact,
      license: info.license,
      termsOfService: info.termsOfService
    }
  }

  extractPaths(spec) {
    if (!spec.paths) {
      return []
    }

    const paths = []

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      const validMethods = ['get', 'put', 'post', 'delete', 'patch', 'options', 'head']
      const methods = []

      for (const method of validMethods) {
        if (pathItem[method]) {
          const operation = pathItem[method]
          methods.push({
            method: method.toUpperCase(),
            operationId: operation.operationId,
            summary: operation.summary,
            description: operation.description,
            tags: operation.tags || [],
            deprecated: operation.deprecated === true,
            parameters: operation.parameters || [],
            hasRequestBody: !!operation.requestBody,
            responses: Object.keys(operation.responses || {})
          })
        }
      }

      paths.push({
        path,
        methods,
        summary: pathItem.summary,
        description: pathItem.description,
        parameters: pathItem.parameters || []
      })
    }

    return paths
  }

  extractComponents(spec) {
    if (!spec.components) {
      return {
        schemas: [],
        responses: [],
        parameters: [],
        requestBodies: [],
        headers: [],
        securitySchemes: [],
        links: [],
        callbacks: []
      }
    }

    const components = spec.components

    return {
      schemas: Object.keys(components.schemas || {}).map(name => ({
        name,
        type: components.schemas[name]?.type,
        description: components.schemas[name]?.description
      })),
      responses: Object.keys(components.responses || {}),
      parameters: Object.keys(components.parameters || {}),
      requestBodies: Object.keys(components.requestBodies || {}),
      headers: Object.keys(components.headers || {}),
      securitySchemes: Object.keys(components.securitySchemes || {}),
      links: Object.keys(components.links || {}),
      callbacks: Object.keys(components.callbacks || {})
    }
  }

  extractServers(spec) {
    if (!spec.servers) {
      return []
    }

    return spec.servers.map(server => ({
      url: server.url,
      description: server.description,
      variables: server.variables
    }))
  }

  extractTags(spec) {
    if (!spec.tags) {
      return []
    }

    return spec.tags.map(tag => ({
      name: tag.name,
      description: tag.description,
      externalDocs: tag.externalDocs
    }))
  }

  getStatistics(spec) {
    const paths = this.extractPaths(spec)
    const components = this.extractComponents(spec)

    let totalOperations = 0
    let getCount = 0
    let postCount = 0
    let putCount = 0
    let patchCount = 0
    let deleteCount = 0
    let deprecatedCount = 0
    const tagsUsed = new Set()

    for (const path of paths) {
      totalOperations += path.methods.length
      
      for (const method of path.methods) {
        switch (method.method) {
          case 'GET': getCount++; break
          case 'POST': postCount++; break
          case 'PUT': putCount++; break
          case 'PATCH': patchCount++; break
          case 'DELETE': deleteCount++; break
        }
        
        if (method.deprecated) {
          deprecatedCount++
        }

        if (method.tags) {
          for (const tag of method.tags) {
            tagsUsed.add(tag)
          }
        }
      }
    }

    return {
      version: spec._meta?.version || this.detectVersion(spec),
      info: this.extractInfo(spec),
      paths: {
        total: paths.length,
        operations: totalOperations,
        byMethod: {
          get: getCount,
          post: postCount,
          put: putCount,
          patch: patchCount,
          delete: deleteCount
        }
      },
      components: {
        schemas: components.schemas.length,
        responses: components.responses.length,
        parameters: components.parameters.length,
        requestBodies: components.requestBodies.length,
        securitySchemes: components.securitySchemes.length
      },
      tags: {
        defined: this.extractTags(spec).length,
        used: tagsUsed.size
      },
      deprecated: deprecatedCount
    }
  }
}

const openapiParser = new OpenApiParser()

module.exports = {
  OpenApiParser,
  openapiParser
}