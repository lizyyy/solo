class LicenseClassifier {
  constructor(configManager) {
    this.config = configManager
    this.licenseAliases = this.buildAliasMap()
  }

  buildAliasMap() {
    return {
      'mit': 'MIT',
      'mit license': 'MIT',
      'the mit license': 'MIT',
      'isc': 'ISC',
      'apache-2': 'Apache-2.0',
      'apache 2.0': 'Apache-2.0',
      'apache license 2.0': 'Apache-2.0',
      'apache': 'Apache-2.0',
      'bsd': 'BSD-3-Clause',
      'bsd-2': 'BSD-2-Clause',
      'bsd-3': 'BSD-3-Clause',
      'gpl': 'GPL-3.0',
      'gpl-2': 'GPL-2.0',
      'gpl-3': 'GPL-3.0',
      'gplv2': 'GPL-2.0',
      'gplv3': 'GPL-3.0',
      'lgpl': 'LGPL-3.0',
      'lgpl-2': 'LGPL-2.0',
      'lgpl-2.1': 'LGPL-2.1',
      'lgpl-3': 'LGPL-3.0',
      'agpl': 'AGPL-3.0',
      'agpl-3': 'AGPL-3.0',
      'agplv3': 'AGPL-3.0',
      'mpl': 'MPL-2.0',
      'mpl-2': 'MPL-2.0',
      'epl': 'EPL-2.0',
      'epl-1': 'EPL-1.0',
      'epl-2': 'EPL-2.0',
      'unlicense': 'Unlicense',
      'public domain': 'Unlicense',
      'cc0': 'CC0-1.0',
      'cc0-1': 'CC0-1.0',
      'wtfpl': 'WTFPL',
      'sspl': 'SSPL',
      'server side public license': 'SSPL',
      'busl': 'BUSL-1.1',
      'polyform strict': 'PolyForm-Strict',
      'unlicensed': 'UNLICENSED',
      'no license': 'UNKNOWN',
      'none': 'UNKNOWN',
      'n/a': 'UNKNOWN',
      '': 'UNKNOWN',
    }
  }

  normalize(license) {
    if (!license) return 'UNKNOWN'
    if (typeof license === 'string') {
      const lower = license.toLowerCase().trim()
      if (this.licenseAliases[lower]) {
        return this.licenseAliases[lower]
      }
      return license.trim()
    }
    if (Array.isArray(license)) {
      const normalized = license.map(l => this.normalize(l))
      return normalized.join(' OR ')
    }
    if (typeof license === 'object' && license.type) {
      return this.normalize(license.type)
    }
    return 'UNKNOWN'
  }

  classify(license) {
    const normalized = this.normalize(license)
    
    if (normalized === 'UNKNOWN') {
      return {
        category: 'unknown',
        license: normalized,
        risk: 'high',
        reason: '无法识别的许可证'
      }
    }

    const licenses = normalized.split(/\s+OR\s+|\s+AND\s+/)
    
    for (const l of licenses) {
      const trimmed = l.trim().replace(/[()]/g, '')
      
      if (this.config.getForbiddenLicenses().includes(trimmed)) {
        return {
          category: 'forbidden',
          license: normalized,
          risk: 'critical',
          reason: `许可证 ${trimmed} 在禁止列表中`
        }
      }
    }

    for (const l of licenses) {
      const trimmed = l.trim().replace(/[()]/g, '')
      
      if (this.config.getNeedsConfirmationLicenses().includes(trimmed)) {
        return {
          category: 'needs_confirmation',
          license: normalized,
          risk: 'medium',
          reason: `许可证 ${trimmed} 需要审批确认`
        }
      }
    }

    for (const l of licenses) {
      const trimmed = l.trim().replace(/[()]/g, '')
      
      if (this.config.getAllowedLicenses().includes(trimmed)) {
        return {
          category: 'allowed',
          license: normalized,
          risk: 'low',
          reason: '许可证在允许列表中'
        }
      }
    }

    return {
      category: 'unknown',
      license: normalized,
      risk: 'high',
      reason: '未知许可证，需人工确认'
    }
  }

  isKnownLicense(license) {
    const normalized = this.normalize(license)
    return normalized !== 'UNKNOWN'
  }

  getRiskLevel(license) {
    const classification = this.classify(license)
    return classification.risk
  }
}

module.exports = LicenseClassifier
