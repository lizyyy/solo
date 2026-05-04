const fs = require('fs')
const path = require('path')

class LicenseNoticeParser {
  constructor(projectDir) {
    this.projectDir = projectDir
  }

  parse() {
    const results = {
      source: 'license-notice',
      projectLicense: null,
      noticeFile: null,
      licenseFiles: [],
      errors: [],
      warnings: []
    }

    try {
      const projectLicense = this.parseProjectLicense()
      if (projectLicense) {
        results.projectLicense = projectLicense
      }

      const noticeFile = this.parseNoticeFile()
      if (noticeFile) {
        results.noticeFile = noticeFile
      }

      const licenseFiles = this.findAllLicenseFiles()
      results.licenseFiles = licenseFiles

    } catch (error) {
      results.errors.push({
        message: '解析许可证和 NOTICE 文件失败',
        error: error.message
      })
    }

    return results
  }

  parseProjectLicense() {
    const licensePaths = [
      'LICENSE',
      'LICENSE.txt',
      'LICENSE.md',
      'LICENCE',
      'LICENCE.txt',
      'COPYING',
      'COPYING.txt'
    ]

    for (const fileName of licensePaths) {
      const fullPath = path.join(this.projectDir, fileName)
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8')
        const detectedLicense = this.detectLicenseType(content)
        
        return {
          file: fileName,
          fullPath: fullPath,
          content: content,
          detectedLicense: detectedLicense,
          confidence: this.calculateConfidence(content, detectedLicense)
        }
      }
    }

    return null
  }

  parseNoticeFile() {
    const noticePaths = [
      'NOTICE',
      'NOTICE.txt',
      'NOTICE.md',
      'NOTICE.txt'
    ]

    for (const fileName of noticePaths) {
      const fullPath = path.join(this.projectDir, fileName)
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8')
        const thirdPartyMentions = this.extractThirdPartyMentions(content)
        
        return {
          file: fileName,
          fullPath: fullPath,
          content: content,
          thirdPartyMentions: thirdPartyMentions,
          mentionsCount: thirdPartyMentions.length
        }
      }
    }

    return null
  }

  findAllLicenseFiles() {
    const licenseFiles = []
    
    try {
      const entries = fs.readdirSync(this.projectDir)
      
      for (const entry of entries) {
        if (entry.toLowerCase().includes('license') || 
            entry.toLowerCase().includes('licence') ||
            entry.toLowerCase() === 'copying') {
          const fullPath = path.join(this.projectDir, entry)
          const stat = fs.statSync(fullPath)
          
          if (stat.isFile()) {
            const content = fs.readFileSync(fullPath, 'utf-8')
            const detectedLicense = this.detectLicenseType(content)
            
            licenseFiles.push({
              file: entry,
              fullPath: fullPath,
              detectedLicense: detectedLicense,
              contentLength: content.length
            })
          }
        }
      }

      const nodeModulesPath = path.join(this.projectDir, 'node_modules')
      if (fs.existsSync(nodeModulesPath)) {
        const packages = fs.readdirSync(nodeModulesPath)
        for (const pkg of packages) {
          const pkgPath = path.join(nodeModulesPath, pkg)
          const stat = fs.statSync(pkgPath)
          
          if (stat.isDirectory()) {
            const pkgLicenseFile = this.findPackageLicenseFile(pkgPath)
            if (pkgLicenseFile) {
              licenseFiles.push({
                file: path.relative(this.projectDir, pkgLicenseFile),
                fullPath: pkgLicenseFile,
                package: pkg,
                fromNodeModules: true
              })
            }
          }
        }
      }

    } catch (error) {
      // 忽略目录遍历错误
    }

    return licenseFiles
  }

  findPackageLicenseFile(pkgPath) {
    const licenseFiles = [
      'LICENSE', 'LICENSE.txt', 'LICENSE.md',
      'LICENCE', 'LICENCE.txt', 'LICENCE.md',
      'COPYING', 'COPYING.txt', 'copying.txt'
    ]

    for (const file of licenseFiles) {
      const fullPath = path.join(pkgPath, file)
      if (fs.existsSync(fullPath)) {
        return fullPath
      }
    }

    const packageJsonPath = path.join(pkgPath, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkgJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        if (pkgJson.license) {
          return packageJsonPath
        }
      } catch {
        // 忽略解析错误
      }
    }

    return null
  }

  detectLicenseType(content) {
    const licensePatterns = [
      { name: 'MIT', patterns: [/MIT License/i, /Permission is hereby granted/i, /MIT\s*$/i, /"MIT"/i] },
      { name: 'Apache-2.0', patterns: [/Apache License/i, /apache.org\/licenses/i, /Apache-2\.0/i] },
      { name: 'GPL-3.0', patterns: [/GNU GENERAL PUBLIC LICENSE/i, /Version 3/i, /GPL-3\.0/i] },
      { name: 'GPL-2.0', patterns: [/GNU GENERAL PUBLIC LICENSE/i, /Version 2/i, /GPL-2\.0/i] },
      { name: 'LGPL-3.0', patterns: [/GNU LESSER GENERAL PUBLIC LICENSE/i, /LGPL-3\.0/i, /Lesser General Public License.*Version 3/i] },
      { name: 'LGPL-2.1', patterns: [/GNU LESSER GENERAL PUBLIC LICENSE/i, /LGPL-2\.1/i, /Version 2\.1/i] },
      { name: 'AGPL-3.0', patterns: [/GNU AFFERO GENERAL PUBLIC LICENSE/i, /AGPL-3\.0/i, /Affero General Public License/i] },
      { name: 'BSD-2-Clause', patterns: [/BSD 2-Clause License/i, /Redistributions of source code must retain/i] },
      { name: 'BSD-3-Clause', patterns: [/BSD 3-Clause License/i, /Neither the name of/i, /BSD-3-Clause/i] },
      { name: 'MPL-2.0', patterns: [/Mozilla Public License/i, /MPL-2\.0/i] },
      { name: 'Unlicense', patterns: [/This is free and unencumbered software/i, /UNLICENSE/i, /Unlicense/i] },
      { name: 'CC0-1.0', patterns: [/Creative Commons Zero/i, /CC0/i, /public domain/i] }
    ]

    let bestMatch = null
    let bestScore = 0

    for (const license of licensePatterns) {
      let score = 0
      for (const pattern of license.patterns) {
        const matches = content.match(pattern)
        if (matches) {
          score += matches.length
        }
      }
      
      if (score > bestScore) {
        bestScore = score
        bestMatch = license.name
      }
    }

    if (bestMatch && bestScore > 0) {
      return bestMatch
    }

    return 'UNKNOWN'
  }

  calculateConfidence(content, detectedLicense) {
    if (detectedLicense === 'UNKNOWN') {
      return 0
    }

    const patterns = {
      'MIT': [/MIT License/i, /Permission is hereby granted/i, /THE SOFTWARE IS PROVIDED/i],
      'Apache-2.0': [/Apache License/i, /apache.org\/licenses/i, /limitations under the License/i],
      'GPL-3.0': [/GNU GENERAL PUBLIC LICENSE/i, /Version 3/i, /MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE/i],
      'GPL-2.0': [/GNU GENERAL PUBLIC LICENSE/i, /Version 2/i, /GNU General Public License.*2/i],
      'LGPL-3.0': [/GNU LESSER GENERAL PUBLIC LICENSE/i, /LGPL-3\.0/i, /Lesser General Public License/i],
      'LGPL-2.1': [/GNU LESSER GENERAL PUBLIC LICENSE/i, /Version 2\.1/i, /Library General Public License/i],
      'AGPL-3.0': [/GNU AFFERO GENERAL PUBLIC LICENSE/i, /Affero/i, /network use/i],
      'BSD-2-Clause': [/Redistributions of source code/i, /Redistributions in binary form/i],
      'BSD-3-Clause': [/Neither the name of/i, /nor the names of/i],
      'MPL-2.0': [/Mozilla Public License/i, /MPL-2\.0/i],
      'Unlicense': [/unencumbered software/i, /public domain/i],
      'CC0-1.0': [/Creative Commons/i, /CC0/i]
    }

    const licensePatterns = patterns[detectedLicense] || []
    let matched = 0

    for (const pattern of licensePatterns) {
      if (pattern.test(content)) {
        matched++
      }
    }

    if (licensePatterns.length === 0) {
      return 0.5
    }

    return matched / licensePatterns.length
  }

  extractThirdPartyMentions(content) {
    const mentions = []
    const lines = content.split('\n')
    
    const thirdPartyPatterns = [
      /Third[-\s]?Party/i,
      /third[-\s]?party/i,
      /Copyright\s+(?:\(c\)\s+)?\d{4}/i,
      /Copyright\s+©\s*\d{4}/i,
      /Portions copyright/i,
      /Based on/i,
      /Derived from/i,
      /Includes code from/i,
      /Uses library/i
    ]

    let currentMention = null
    let mentionStartLine = null

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      const isNewMention = thirdPartyPatterns.some(pattern => pattern.test(line))
      
      if (isNewMention && !line.trim().startsWith('#')) {
        if (currentMention) {
          mentions.push({
            content: currentMention.trim(),
            startLine: mentionStartLine + 1,
            endLine: i
          })
        }
        
        currentMention = line
        mentionStartLine = i
      } else if (currentMention && line.trim() && !line.trim().startsWith('=')) {
        currentMention += '\n' + line
      } else if (currentMention && (line.trim() === '' || line.trim().startsWith('='))) {
        mentions.push({
          content: currentMention.trim(),
          startLine: mentionStartLine + 1,
          endLine: i
        })
        currentMention = null
      }
    }

    if (currentMention) {
      mentions.push({
        content: currentMention.trim(),
        startLine: mentionStartLine + 1,
        endLine: lines.length
      })
    }

    return mentions
  }

  static hasProjectLicense(projectDir) {
    const licensePaths = [
      'LICENSE', 'LICENSE.txt', 'LICENSE.md',
      'LICENCE', 'LICENCE.txt', 'COPYING'
    ]

    for (const fileName of licensePaths) {
      const fullPath = path.join(projectDir, fileName)
      if (fs.existsSync(fullPath)) {
        return true
      }
    }
    return false
  }

  static hasNoticeFile(projectDir) {
    const noticePaths = ['NOTICE', 'NOTICE.txt', 'NOTICE.md']
    for (const fileName of noticePaths) {
      const fullPath = path.join(projectDir, fileName)
      if (fs.existsSync(fullPath)) {
        return true
      }
    }
    return false
  }
}

module.exports = LicenseNoticeParser
