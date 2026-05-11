const fs = require('fs')
const path = require('path')

class ExceptionManager {
  constructor(configManager) {
    this.config = configManager
    this.exceptionsPath = path.join(this.config.getHistoryDir(), 'exceptions.json')
    this.exceptions = this.loadExceptions()
  }

  loadExceptions() {
    if (!fs.existsSync(this.exceptionsPath)) {
      return []
    }
    try {
      return JSON.parse(fs.readFileSync(this.exceptionsPath, 'utf-8'))
    } catch (error) {
      throw new Error(`例外审批文件格式错误: ${error.message}`)
    }
  }

  saveExceptions() {
    fs.writeFileSync(this.exceptionsPath, JSON.stringify(this.exceptions, null, 2))
  }

  addException({ packageName, version, license, reason, approvedBy, expiresAt }) {
    if (!packageName) {
      throw new Error('必须指定包名')
    }
    if (!reason) {
      throw new Error('必须提供审批理由')
    }
    if (!approvedBy) {
      throw new Error('必须指定审批人')
    }

    const exception = {
      id: `${packageName}${version ? '@' + version : ''}`,
      packageName,
      version: version || '*',
      license,
      reason,
      approvedBy,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt || null
    }

    const existingIndex = this.exceptions.findIndex(e => e.id === exception.id)
    if (existingIndex >= 0) {
      this.exceptions[existingIndex] = exception
    } else {
      this.exceptions.push(exception)
    }

    this.saveExceptions()
    return exception
  }

  removeException(packageName, version = null) {
    const id = `${packageName}${version ? '@' + version : ''}`
    const initialCount = this.exceptions.length
    this.exceptions = this.exceptions.filter(e => e.id !== id)
    
    if (this.exceptions.length === initialCount) {
      throw new Error(`未找到例外审批: ${id}`)
    }
    
    this.saveExceptions()
    return true
  }

  getExceptions() {
    return this.exceptions
  }

  getException(packageName, version = null) {
    if (version) {
      return this.exceptions.find(e => 
        e.packageName === packageName && 
        (e.version === version || e.version === '*')
      )
    }
    return this.exceptions.find(e => e.packageName === packageName)
  }

  isExceptionApproved(packageName, version) {
    const exception = this.getException(packageName, version)
    if (!exception) {
      return { approved: false, reason: '无例外审批' }
    }

    if (exception.expiresAt) {
      const expireDate = new Date(exception.expiresAt)
      const now = new Date()
      if (expireDate < now) {
        return { approved: false, reason: `例外审批已过期 (${exception.expiresAt})`, expired: true }
      }
    }

    return { approved: true, reason: exception.reason, exception }
  }

  listExpiredExceptions() {
    const now = new Date()
    return this.exceptions.filter(e => {
      if (!e.expiresAt) return false
      return new Date(e.expiresAt) < now
    })
  }

  listExpiringExceptions(days = 7) {
    const now = new Date()
    const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
    return this.exceptions.filter(e => {
      if (!e.expiresAt) return false
      const expireDate = new Date(e.expiresAt)
      return expireDate >= now && expireDate < threshold
    })
  }
}

module.exports = ExceptionManager
