const fs = require('fs')
const path = require('path')

class ThirdPartyCsvParser {
  constructor(projectDir) {
    this.projectDir = projectDir
    this.csvPath = path.join(projectDir, 'third_party.csv')
  }

  parse() {
    const results = {
      source: 'third_party.csv',
      dependencies: [],
      errors: [],
      warnings: []
    }

    if (!fs.existsSync(this.csvPath)) {
      results.warnings.push({
        message: '未找到 third_party.csv 文件',
        file: this.csvPath
      })
      return results
    }

    try {
      const content = fs.readFileSync(this.csvPath, 'utf-8')
      const lines = content.split('\n')
      
      if (lines.length === 0) {
        results.warnings.push({
          message: 'third_party.csv 文件为空',
          file: this.csvPath
        })
        return results
      }

      const headerLine = lines[0].trim()
      if (!headerLine) {
        results.errors.push({
          message: 'third_party.csv 缺少表头行',
          file: this.csvPath,
          line: 1
        })
        return results
      }

      const headers = this.parseCsvLine(headerLine)
      const headerValidation = this.validateHeaders(headers)
      
      if (!headerValidation.valid) {
        results.errors.push({
          message: headerValidation.message,
          file: this.csvPath,
          line: 1,
          missingColumns: headerValidation.missingColumns
        })
        return results
      }

      const columnIndices = this.getColumnIndices(headers)

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        const lineNumber = i + 1

        if (!line || line.startsWith('#')) continue

        try {
          const values = this.parseCsvLine(line)
          const dependency = this.createDependency(values, columnIndices, lineNumber)
          
          if (dependency) {
            results.dependencies.push(dependency)
          }
        } catch (error) {
          results.errors.push({
            message: error.message,
            file: this.csvPath,
            line: lineNumber,
            error: error
          })
        }
      }

      const duplicateCheck = this.checkDuplicates(results.dependencies)
      if (duplicateCheck.warnings.length > 0) {
        results.warnings.push(...duplicateCheck.warnings)
      }

    } catch (error) {
      results.errors.push({
        message: '读取 third_party.csv 失败',
        file: this.csvPath,
        error: error.message
      })
    }

    return results
  }

  validateHeaders(headers) {
    const requiredColumns = ['name', 'license']
    const recommendedColumns = ['version', 'source', 'notes']
    
    const headerMap = {}
    for (const header of headers) {
      headerMap[header.toLowerCase().trim()] = true
    }

    const missingColumns = []
    for (const col of requiredColumns) {
      if (!headerMap[col]) {
        missingColumns.push(col)
      }
    }

    if (missingColumns.length > 0) {
      return {
        valid: false,
        message: `缺少必需的列: ${missingColumns.join(', ')}`,
        missingColumns
      }
    }

    return { valid: true }
  }

  getColumnIndices(headers) {
    const indices = {}
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim())
    
    indices.name = normalizedHeaders.indexOf('name')
    indices.version = normalizedHeaders.indexOf('version')
    indices.license = normalizedHeaders.indexOf('license')
    indices.source = normalizedHeaders.indexOf('source')
    indices.url = normalizedHeaders.indexOf('url')
    indices.notes = normalizedHeaders.indexOf('notes')
    indices.notice = normalizedHeaders.indexOf('notice')
    indices.copyright = normalizedHeaders.indexOf('copyright')
    
    return indices
  }

  parseCsvLine(line) {
    const values = []
    let currentValue = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          currentValue += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim())
        currentValue = ''
      } else {
        currentValue += char
      }
    }
    
    values.push(currentValue.trim())
    return values
  }

  createDependency(values, columnIndices, lineNumber) {
    const name = this.getValue(values, columnIndices.name)
    const license = this.getValue(values, columnIndices.license)
    const version = this.getValue(values, columnIndices.version)
    const source = this.getValue(values, columnIndices.source)
    const url = this.getValue(values, columnIndices.url)
    const notes = this.getValue(values, columnIndices.notes)
    const notice = this.getValue(values, columnIndices.notice)
    const copyright = this.getValue(values, columnIndices.copyright)

    if (!name) {
      throw new Error('依赖名称不能为空')
    }

    if (!license) {
      throw new Error('许可证不能为空')
    }

    const dependency = {
      name: name.toLowerCase().replace(/[-_.]+/g, '-'),
      originalName: name,
      version: version || '*',
      resolvedVersion: version,
      license: license,
      source: source || 'third_party.csv',
      sourceFile: 'third_party.csv',
      line: lineNumber,
      type: 'third-party',
      specType: 'manual',
      url: url || null,
      notes: notes || null,
      notice: notice || null,
      copyright: copyright || null
    }

    this.validateDependency(dependency, lineNumber)

    return dependency
  }

  getValue(values, index) {
    if (index === -1 || index >= values.length) {
      return null
    }
    const value = values[index]
    return value === '' ? null : value
  }

  validateDependency(dependency, lineNumber) {
    const knownLicenses = [
      'MIT', 'Apache-2.0', 'Apache-1.0', 'Apache-1.1',
      'BSD-2-Clause', 'BSD-3-Clause', 'BSD-4-Clause',
      'GPL-2.0', 'GPL-3.0', 'GPL-2.0-only', 'GPL-3.0-only',
      'GPL-2.0-or-later', 'GPL-3.0-or-later',
      'LGPL-2.1', 'LGPL-3.0', 'LGPL-2.1-only', 'LGPL-3.0-only',
      'AGPL-3.0', 'AGPL-3.0-only', 'AGPL-3.0-or-later',
      'MPL-1.1', 'MPL-2.0',
      'CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0',
      'Unlicense', 'Public Domain', 'UNKNOWN'
    ]

    const licenseUpper = dependency.license.toUpperCase().trim()
    const isKnown = knownLicenses.some(known => 
      licenseUpper === known.toUpperCase() || 
      licenseUpper.startsWith(known.toUpperCase() + '-') ||
      licenseUpper.startsWith(known.toUpperCase() + ' ')
    )

    if (!isKnown && licenseUpper !== 'UNKNOWN') {
      throw new Error(`未知的许可证类型: ${dependency.license}。请使用标准的 SPDX 标识符或 'UNKNOWN'`)
    }
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
        const occurrences = deps.map(d => ({
          version: d.version,
          license: d.license,
          source: d.sourceFile,
          line: d.line
        }))

        warnings.push({
          message: `发现重复的第三方依赖: ${name}`,
          package: name,
          occurrences: occurrences,
          severity: 'warning'
        })
      }
    }

    return { warnings }
  }

  static isValidCsv(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return false
      }
      const content = fs.readFileSync(filePath, 'utf-8')
      return content.trim().length > 0
    } catch {
      return false
    }
  }
}

module.exports = ThirdPartyCsvParser
