const fs = require('fs')
const path = require('path')

class PythonDependencyParser {
  constructor(projectDir) {
    this.projectDir = projectDir
    this.requirementsFiles = []
  }

  parse() {
    const results = {
      source: 'python',
      dependencies: [],
      errors: [],
      warnings: []
    }

    const requirementPaths = this.findRequirementsFiles()

    for (const reqPath of requirementPaths) {
      try {
        const deps = this.parseRequirementsFile(reqPath)
        results.dependencies.push(...deps)
      } catch (error) {
        results.errors.push({
          message: `解析 ${path.basename(reqPath)} 失败`,
          file: reqPath,
          error: error.message,
          line: error.line || null
        })
      }
    }

    const duplicateCheck = this.checkDuplicates(results.dependencies)
    if (duplicateCheck.warnings.length > 0) {
      results.warnings.push(...duplicateCheck.warnings)
    }

    return results
  }

  findRequirementsFiles() {
    const files = []
    
    const commonPaths = [
      'requirements.txt',
      'requirements/prod.txt',
      'requirements/production.txt',
      'requirements/dev.txt',
      'requirements/development.txt',
      'requirements/test.txt',
      'requirements/base.txt',
      'setup.py',
      'pyproject.toml'
    ]

    for (const relPath of commonPaths) {
      const fullPath = path.join(this.projectDir, relPath)
      if (fs.existsSync(fullPath)) {
        files.push(fullPath)
      }
    }

    try {
      const entries = fs.readdirSync(this.projectDir)
      for (const entry of entries) {
        if (entry.startsWith('requirements') && entry.endsWith('.txt')) {
          const fullPath = path.join(this.projectDir, entry)
          if (!files.includes(fullPath)) {
            files.push(fullPath)
          }
        }
      }
    } catch (error) {
      // 忽略目录读取错误
    }

    return files
  }

  parseRequirementsFile(filePath) {
    const dependencies = []
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const fileName = path.basename(filePath)

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim()
      const lineNumber = i + 1

      if (!line || line.startsWith('#')) continue

      if (line.includes('#')) {
        const commentIndex = line.indexOf('#')
        line = line.substring(0, commentIndex).trim()
      }

      if (!line) continue

      if (line.startsWith('-r ')) {
        const includePath = line.substring(3).trim()
        const includeFullPath = path.join(path.dirname(filePath), includePath)
        if (fs.existsSync(includeFullPath)) {
          try {
            const includedDeps = this.parseRequirementsFile(includeFullPath)
            dependencies.push(...includedDeps.map(d => ({
              ...d,
              includedFrom: fileName
            })))
          } catch (error) {
            // 忽略包含文件的错误
          }
        }
        continue
      }

      try {
        const dep = this.parseRequirementLine(line, fileName, lineNumber)
        if (dep) {
          dependencies.push(dep)
        }
      } catch (error) {
        error.line = lineNumber
        throw error
      }
    }

    return dependencies
  }

  parseRequirementLine(line, sourceFile, lineNumber) {
    const originalLine = line

    if (line.startsWith('-e ')) {
      line = line.substring(3).trim()
    }

    if (line.startsWith('git+')) {
      return this.parseGitDependency(line, sourceFile, lineNumber)
    }

    if (line.startsWith('http://') || line.startsWith('https://')) {
      return this.parseUrlDependency(line, sourceFile, lineNumber)
    }

    const nameVersionMatch = line.match(/^([a-zA-Z0-9][-a-zA-Z0-9._]*)(\[[^\]]+\])?\s*([<>=!~].*)?$/)
    
    if (!nameVersionMatch) {
      throw new Error(`无法解析依赖行: ${originalLine}`)
    }

    const name = nameVersionMatch[1].toLowerCase().replace(/[-_.]+/g, '-')
    const extras = nameVersionMatch[2] ? nameVersionMatch[2].slice(1, -1) : null
    const versionSpec = nameVersionMatch[3] || null

    const version = this.extractVersion(versionSpec)

    return {
      name,
      originalName: nameVersionMatch[1],
      version: version || versionSpec || '*',
      resolvedVersion: null,
      versionSpec: versionSpec,
      extras: extras ? extras.split(',').map(e => e.trim()) : null,
      license: null,
      source: sourceFile,
      line: lineNumber,
      type: this.determineDependencyType(sourceFile),
      specType: 'pypi'
    }
  }

  parseGitDependency(line, sourceFile, lineNumber) {
    const urlMatch = line.match(/^git\+([^#]+)(#.*)?$/)
    
    if (!urlMatch) {
      return {
        name: `git-dep-${lineNumber}`,
        version: 'git',
        resolvedVersion: null,
        license: null,
        source: sourceFile,
        line: lineNumber,
        type: this.determineDependencyType(sourceFile),
        specType: 'git',
        originalLine: line
      }
    }

    const url = urlMatch[1]
    const fragment = urlMatch[2] || ''
    
    let name = this.extractNameFromUrl(url)
    let version = null

    if (fragment.includes('@')) {
      const refMatch = fragment.match(/@([^&]+)/)
      if (refMatch) {
        version = refMatch[1]
      }
    }

    if (fragment.includes('egg=')) {
      const eggMatch = fragment.match(/egg=([^&]+)/)
      if (eggMatch) {
        name = eggMatch[1]
      }
    }

    return {
      name: name || `git-dep-${lineNumber}`,
      version: version || 'git',
      resolvedVersion: null,
      license: null,
      source: sourceFile,
      line: lineNumber,
      type: this.determineDependencyType(sourceFile),
      specType: 'git',
      url: url,
      originalLine: line
    }
  }

  parseUrlDependency(line, sourceFile, lineNumber) {
    let name = this.extractNameFromUrl(line)
    let version = null

    const wheelMatch = line.match(/([a-zA-Z0-9][-a-zA-Z0-9._]*)-([^-]+)-/)
    if (wheelMatch) {
      name = wheelMatch[1].toLowerCase().replace(/[-_.]+/g, '-')
      version = wheelMatch[2]
    }

    return {
      name: name || `url-dep-${lineNumber}`,
      version: version || 'url',
      resolvedVersion: null,
      license: null,
      source: sourceFile,
      line: lineNumber,
      type: this.determineDependencyType(sourceFile),
      specType: 'url',
      url: line,
      originalLine: line
    }
  }

  extractNameFromUrl(url) {
    try {
      const pathParts = url.split('/')
      let lastPart = pathParts[pathParts.length - 1]
      
      if (lastPart.endsWith('.git')) {
        lastPart = lastPart.slice(0, -4)
      }
      
      if (lastPart.endsWith('.tar.gz') || lastPart.endsWith('.whl') || 
          lastPart.endsWith('.zip') || lastPart.endsWith('.egg')) {
        const dashIndex = lastPart.lastIndexOf('-')
        if (dashIndex > 0) {
          lastPart = lastPart.substring(0, dashIndex)
        }
      }

      return lastPart.toLowerCase().replace(/[-_.]+/g, '-')
    } catch {
      return null
    }
  }

  extractVersion(versionSpec) {
    if (!versionSpec) return null

    const exactMatch = versionSpec.match(/==\s*([^,\s]+)/)
    if (exactMatch) {
      return exactMatch[1]
    }

    const gteMatch = versionSpec.match(/>=\s*([^,\s]+)/)
    if (gteMatch) {
      return `>=${gteMatch[1]}`
    }

    return null
  }

  determineDependencyType(sourceFile) {
    const fileName = sourceFile.toLowerCase()
    if (fileName.includes('dev') || fileName.includes('development') || 
        fileName.includes('test')) {
      return 'development'
    }
    if (fileName.includes('prod') || fileName.includes('production')) {
      return 'production'
    }
    return 'unknown'
  }

  checkDuplicates(dependencies) {
    const warnings = []
    const nameMap = new Map()

    for (const dep of dependencies) {
      if (!nameMap.has(dep.name)) {
        nameMap.set(dep.name, [])
      }
      nameMap.get(dep.name).push(dep)
    }

    for (const [name, deps] of nameMap.entries()) {
      if (deps.length > 1) {
        const versions = deps.map(d => ({
          version: d.version,
          source: d.source,
          line: d.line
        }))

        warnings.push({
          message: `发现重复依赖: ${name}`,
          package: name,
          occurrences: versions,
          severity: 'warning'
        })
      }
    }

    return { warnings }
  }

  parseSetupPy() {
    const setupPyPath = path.join(this.projectDir, 'setup.py')
    if (!fs.existsSync(setupPyPath)) return []

    const dependencies = []
    
    try {
      const content = fs.readFileSync(setupPyPath, 'utf-8')
      
      const installRequiresMatch = content.match(/install_requires\s*=\s*\[([^\]]*)\]/s)
      if (installRequiresMatch) {
        const depsStr = installRequiresMatch[1]
        const deps = this.extractListFromString(depsStr)
        
        for (let i = 0; i < deps.length; i++) {
          try {
            const dep = this.parseRequirementLine(deps[i], 'setup.py', i + 1)
            if (dep) {
              dep.type = 'production'
              dependencies.push(dep)
            }
          } catch (error) {
            // 忽略解析错误
          }
        }
      }

      const testsRequireMatch = content.match(/tests_require\s*=\s*\[([^\]]*)\]/s)
      if (testsRequireMatch) {
        const depsStr = testsRequireMatch[1]
        const deps = this.extractListFromString(depsStr)
        
        for (let i = 0; i < deps.length; i++) {
          try {
            const dep = this.parseRequirementLine(deps[i], 'setup.py', i + 1)
            if (dep) {
              dep.type = 'development'
              dependencies.push(dep)
            }
          } catch (error) {
            // 忽略解析错误
          }
        }
      }
    } catch (error) {
      // 忽略 setup.py 解析错误
    }

    return dependencies
  }

  parsePyprojectToml() {
    const pyprojectPath = path.join(this.projectDir, 'pyproject.toml')
    if (!fs.existsSync(pyprojectPath)) return []

    const dependencies = []

    try {
      const content = fs.readFileSync(pyprojectPath, 'utf-8')
      
      const depsMatch = content.match(/dependencies\s*=\s*\[([^\]]*)\]/s)
      if (depsMatch) {
        const depsStr = depsMatch[1]
        const deps = this.extractListFromString(depsStr)
        
        for (let i = 0; i < deps.length; i++) {
          try {
            const dep = this.parseRequirementLine(deps[i], 'pyproject.toml', i + 1)
            if (dep) {
              dep.type = 'production'
              dependencies.push(dep)
            }
          } catch (error) {
            // 忽略解析错误
          }
        }
      }

      const optionalDepsMatch = content.match(/\[tool\.poetry\.dev-dependencies\]([^[]*)/s) ||
                                content.match(/\[project\.optional-dependencies\]([^[]*)/s)
      if (optionalDepsMatch) {
        const lines = optionalDepsMatch[1].split('\n')
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim()
          if (line && !line.startsWith('[') && line.includes('=')) {
            const eqIndex = line.indexOf('=')
            const name = line.substring(0, eqIndex).trim().replace(/['"]/g, '')
            const value = line.substring(eqIndex + 1).trim()
            
            try {
              const versionMatch = value.match(/['"]([^'"]+)['"]/)
              const version = versionMatch ? versionMatch[1] : '*'
              
              const dep = this.parseRequirementLine(`${name}${version === '*' ? '' : '==' + version}`, 
                                                     'pyproject.toml', i + 1)
              if (dep) {
                dep.type = 'development'
                dependencies.push(dep)
              }
            } catch (error) {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (error) {
      // 忽略 pyproject.toml 解析错误
    }

    return dependencies
  }

  extractListFromString(str) {
    const items = []
    const lines = str.split('\n')
    
    for (const line of lines) {
      let trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      
      trimmed = trimmed.replace(/,\s*$/, '')
      trimmed = trimmed.replace(/^['"]/, '').replace(/['"]$/, '')
      
      if (trimmed) {
        items.push(trimmed)
      }
    }
    
    return items
  }
}

module.exports = PythonDependencyParser
