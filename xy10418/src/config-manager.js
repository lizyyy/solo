const fs = require('fs')
const path = require('path')

const DEFAULT_CONFIG = {
  license: {
    allowed: [
      'MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0',
      'Unlicense', 'WTFPL', 'CC0-1.0'
    ],
    needsConfirmation: [
      'GPL-2.0', 'GPL-3.0', 'LGPL-2.0', 'LGPL-2.1', 'LGPL-3.0',
      'AGPL-3.0', 'SSPL', 'MPL-2.0', 'EPL-1.0', 'EPL-2.0'
    ],
    forbidden: [
      'SSPL', 'BUSL-1.1', 'PolyForm-Strict', 'UNLICENSED'
    ]
  },
  scanners: {
    npm: { enabled: true, includeDev: false },
    yarn: { enabled: true, includeDev: false },
    pip: { enabled: true }
  },
  output: {
    format: 'json',
    historyDir: '.license-audit',
    reportDir: 'license-reports'
  }
}

class ConfigManager {
  constructor(configPath = null) {
    this.configPath = configPath || path.join(process.cwd(), '.license-auditr.json')
    this.config = this.loadConfig()
    this.ensureDirectories()
  }

  loadConfig() {
    if (fs.existsSync(this.configPath)) {
      try {
        const content = fs.readFileSync(this.configPath, 'utf-8')
        const userConfig = JSON.parse(content)
        return this.mergeConfigs(DEFAULT_CONFIG, userConfig)
      } catch (error) {
        throw new Error(`配置文件格式错误: ${error.message}`)
      }
    }
    return { ...DEFAULT_CONFIG }
  }

  mergeConfigs(defaults, user) {
    const merged = { ...defaults }
    for (const key of Object.keys(user)) {
      if (user[key] && typeof user[key] === 'object' && !Array.isArray(user[key])) {
        merged[key] = this.mergeConfigs(defaults[key] || {}, user[key])
      } else {
        merged[key] = user[key]
      }
    }
    return merged
  }

  ensureDirectories() {
    const historyDir = this.getHistoryDir()
    const reportDir = this.getReportDir()
    
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true })
    }
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true })
    }
  }

  getHistoryDir() {
    return path.join(process.cwd(), this.config.output.historyDir)
  }

  getReportDir() {
    return path.join(process.cwd(), this.config.output.reportDir)
  }

  getAllowedLicenses() {
    return this.config.license.allowed
  }

  getNeedsConfirmationLicenses() {
    return this.config.license.needsConfirmation
  }

  getForbiddenLicenses() {
    return this.config.license.forbidden
  }

  getAllScans() {
    const historyDir = this.getHistoryDir()
    if (!fs.existsSync(historyDir)) {
      return []
    }
    
    const files = fs.readdirSync(historyDir)
      .filter(f => f.endsWith('.scan.json'))
      .map(f => ({
        filename: f,
        path: path.join(historyDir, f),
        timestamp: f.replace('.scan.json', '')
      }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    
    return files
  }

  getLatestScan() {
    const scans = this.getAllScans()
    return scans.length > 0 ? scans[0] : null
  }

  saveScan(scanData) {
    const historyDir = this.getHistoryDir()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${timestamp}.scan.json`
    const filepath = path.join(historyDir, filename)
    
    fs.writeFileSync(filepath, JSON.stringify(scanData, null, 2))
    return filepath
  }

  loadScan(filepath) {
    if (!fs.existsSync(filepath)) {
      throw new Error(`扫描文件不存在: ${filepath}`)
    }
    try {
      return JSON.parse(fs.readFileSync(filepath, 'utf-8'))
    } catch (error) {
      throw new Error(`扫描文件格式错误: ${error.message}`)
    }
  }

  saveConfig() {
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2))
  }
}

module.exports = ConfigManager
