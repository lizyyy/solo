class LicenseRiskAssessor {
  constructor() {
    this.licenseCategories = {
      permissive: {
        names: ['MIT', 'MIT-0', 'MIT/X11', 'MIT OR Apache-2.0'],
        pattern: /^MIT($|[\s\-\/])/i
      },
      apache: {
        names: ['Apache-2.0', 'Apache-1.0', 'Apache-1.1'],
        pattern: /^Apache($|[\s\-])/i
      },
      bsd: {
        names: ['BSD-2-Clause', 'BSD-3-Clause', 'BSD-4-Clause', 'BSD-2-Clause-FreeBSD', 'BSD-3-Clause-Attribution'],
        pattern: /^BSD($|[\s\-])/i
      },
      lgpl: {
        names: ['LGPL-2.1', 'LGPL-3.0', 'LGPL-2.1-only', 'LGPL-3.0-only', 'LGPL-2.1-or-later', 'LGPL-3.0-or-later'],
        pattern: /^LGPL($|[\s\-])/i
      },
      gpl: {
        names: ['GPL-2.0', 'GPL-3.0', 'GPL-2.0-only', 'GPL-3.0-only', 'GPL-2.0-or-later', 'GPL-3.0-or-later'],
        pattern: /^GPL($|[\s\-])/i
      },
      agpl: {
        names: ['AGPL-3.0', 'AGPL-3.0-only', 'AGPL-3.0-or-later'],
        pattern: /^AGPL($|[\s\-])/i
      },
      mpl: {
        names: ['MPL-1.1', 'MPL-2.0'],
        pattern: /^MPL($|[\s\-])/i
      },
      cc: {
        names: ['CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0'],
        pattern: /^CC($|[\s\-])/i
      },
      unlicense: {
        names: ['Unlicense'],
        pattern: /^Unlicense($|[\s\-])/i
      },
      publicDomain: {
        names: ['Public Domain'],
        pattern: /^Public\s+Domain($|[\s\-])/i
      }
    }

    this.riskLevels = {
      SAFE: {
        level: 'SAFE',
        color: 'green',
        displayName: '安全',
        description: '可以安全商用，几乎没有约束或约束很宽松'
      },
      LOW: {
        level: 'LOW',
        color: 'yellow',
        displayName: '低风险',
        description: '需要保留许可证声明或归因信息'
      },
      MEDIUM: {
        level: 'MEDIUM',
        color: 'orange',
        displayName: '中风险',
        description: '有 copyleft 影响，可能需要公开修改后的源代码'
      },
      HIGH: {
        level: 'HIGH',
        color: 'red',
        displayName: '高风险',
        description: '强 copyleft 或网络服务感染，可能导致整个项目开源'
      },
      UNKNOWN: {
        level: 'UNKNOWN',
        color: 'gray',
        displayName: '未知',
        description: '许可证未知，需要手动核实'
      }
    }

    this.licenseRiskMapping = {
      permissive: this.riskLevels.SAFE,
      apache: this.riskLevels.LOW,
      bsd: this.riskLevels.SAFE,
      lgpl: this.riskLevels.MEDIUM,
      gpl: this.riskLevels.HIGH,
      agpl: this.riskLevels.HIGH,
      mpl: this.riskLevels.MEDIUM,
      cc: this.riskLevels.SAFE,
      unlicense: this.riskLevels.SAFE,
      publicDomain: this.riskLevels.SAFE
    }

    this.licenseExplanations = {
      MIT: {
        summary: '最宽松的许可证之一',
        requirements: ['保留原许可证声明'],
        risks: [],
        commercialUse: true,
        modification: true,
        distribution: true,
        privateUse: true,
        patentGrant: false
      },
      'Apache-2.0': {
        summary: '商业友好，包含专利授权',
        requirements: ['保留原许可证声明', '说明修改内容', '包含 NOTICE 文件'],
        risks: [],
        commercialUse: true,
        modification: true,
        distribution: true,
        privateUse: true,
        patentGrant: true
      },
      'BSD-2-Clause': {
        summary: '简化版 BSD，非常宽松',
        requirements: ['保留原许可证声明'],
        risks: [],
        commercialUse: true,
        modification: true,
        distribution: true,
        privateUse: true,
        patentGrant: false
      },
      'BSD-3-Clause': {
        summary: '新版 BSD，禁止使用作者名称背书',
        requirements: ['保留原许可证声明', '不得使用作者名称背书'],
        risks: [],
        commercialUse: true,
        modification: true,
        distribution: true,
        privateUse: true,
        patentGrant: false
      },
      'LGPL-2.1': {
        summary: '弱 copyleft，动态链接不感染',
        requirements: ['保留原许可证声明', '提供库的修改源码', '允许用户替换库'],
        risks: ['静态链接时会感染整个项目'],
        commercialUse: true,
        modification: true,
        distribution: true,
        privateUse: true,
        patentGrant: false
      },
      'LGPL-3.0': {
        summary: '弱 copyleft，版本 3',
        requirements: ['保留原许可证声明', '提供库的修改源码', '允许用户替换库'],
        risks: ['静态链接时会感染整个项目'],
        commercialUse: true,
        modification: true,
        distribution: true,
        privateUse: true,
        patentGrant: true
      },
      'GPL-2.0': {
        summary: '强 copyleft，传染整个项目',
        requirements: ['保留原许可证声明', '公开全部源码', '相同许可证分发'],
        risks: ['整个项目必须以 GPL 开源', '无法闭源商用分发'],
        commercialUse: true,
        modification: true,
        distribution: true,
        privateUse: true,
        patentGrant: false
      },
      'GPL-3.0': {
        summary: '强 copyleft，版本 3，增加反 tivoization',
        requirements: ['保留原许可证声明', '公开全部源码', '相同许可证分发', '安装信息提供'],
        risks: ['整个项目必须以 GPL 开源', '无法闭源商用分发'],
        commercialUse: true,
        modification: true,
        distribution: true,
        privateUse: true,
        patentGrant: true
      },
      'AGPL-3.0': {
        summary: '网络服务感染，即使不分发也可能触发',
        requirements: ['保留原许可证声明', '公开全部源码', '相同许可证分发', '网络访问用户可获取源码'],
        risks: ['网络服务场景也需开源', '即使不分发也可能触发 copyleft'],
        commercialUse: true,
        modification: true,
        distribution: true,
        privateUse: true,
        patentGrant: true
      },
      'MPL-2.0': {
        summary: '文件级 copyleft，比 GPL 更灵活',
        requirements: ['保留原许可证声明', '修改的文件需开源'],
        risks: ['修改的文件需以 MPL 开源'],
        commercialUse: true,
        modification: true,
        distribution: true,
        privateUse: true,
        patentGrant: true
      },
      UNKNOWN: {
        summary: '许可证未知',
        requirements: ['需要手动核实'],
        risks: ['无法确认是否可商用', '可能存在法律风险'],
        commercialUse: null,
        modification: null,
        distribution: null,
        privateUse: null,
        patentGrant: null
      }
    }
  }

  normalizeLicense(license) {
    if (!license) {
      return 'UNKNOWN'
    }

    const cleaned = license.trim().toUpperCase()

    const orSplit = cleaned.split(/\s*OR\s*/)
    if (orSplit.length > 1) {
      const risks = orSplit.map(l => this.assessRisk(l))
      const safest = risks.reduce((min, r) =>
        this.compareRisk(r.level, min.level) < 0 ? r : min
      )
      return this.getCanonicalName(orSplit[0]) || 'UNKNOWN'
    }

    for (const [category, data] of Object.entries(this.licenseCategories)) {
      if (data.pattern.test(cleaned)) {
        return this.getCanonicalName(cleaned) || data.names[0]
      }
    }

    return 'UNKNOWN'
  }

  getCanonicalName(license) {
    const upper = license.toUpperCase().trim()
    
    const exactMatches = {
      'MIT': 'MIT',
      'MIT-0': 'MIT-0',
      'APACHE-2.0': 'Apache-2.0',
      'APACHE': 'Apache-2.0',
      'BSD': 'BSD-3-Clause',
      'BSD-2-CLAUSE': 'BSD-2-Clause',
      'BSD-3-CLAUSE': 'BSD-3-Clause',
      'LGPL': 'LGPL-3.0',
      'LGPL-2.1': 'LGPL-2.1',
      'LGPL-3.0': 'LGPL-3.0',
      'GPL': 'GPL-3.0',
      'GPL-2.0': 'GPL-2.0',
      'GPL-3.0': 'GPL-3.0',
      'AGPL': 'AGPL-3.0',
      'AGPL-3.0': 'AGPL-3.0',
      'MPL': 'MPL-2.0',
      'MPL-2.0': 'MPL-2.0',
      'CC0': 'CC0-1.0',
      'CC0-1.0': 'CC0-1.0',
      'UNLICENSE': 'Unlicense',
      'PUBLIC DOMAIN': 'Public Domain'
    }

    for (const [key, value] of Object.entries(exactMatches)) {
      if (upper === key || upper.startsWith(key + '-') || upper.startsWith(key + ' ')) {
        return value
      }
    }

    return null
  }

  assessRisk(license) {
    const normalized = this.normalizeLicense(license)
    
    if (normalized === 'UNKNOWN') {
      return this.riskLevels.UNKNOWN
    }

    for (const [category, data] of Object.entries(this.licenseCategories)) {
      const upperNorm = normalized.toUpperCase()
      for (const name of data.names) {
        if (upperNorm === name.toUpperCase() || data.pattern.test(upperNorm)) {
          return this.licenseRiskMapping[category]
        }
      }
    }

    return this.riskLevels.UNKNOWN
  }

  getLicenseExplanation(license) {
    const normalized = this.normalizeLicense(license)
    return this.licenseExplanations[normalized] || this.licenseExplanations.UNKNOWN
  }

  compareRisk(levelA, levelB) {
    const order = ['SAFE', 'LOW', 'MEDIUM', 'HIGH', 'UNKNOWN']
    return order.indexOf(levelA) - order.indexOf(levelB)
  }

  isCopyleft(license) {
    const risk = this.assessRisk(license)
    return risk.level === 'MEDIUM' || risk.level === 'HIGH'
  }

  isNetworkServiceRisk(license) {
    const normalized = this.normalizeLicense(license)
    return normalized.startsWith('AGPL')
  }

  requiresNotice(license) {
    const normalized = this.normalizeLicense(license)
    return normalized === 'Apache-2.0'
  }

  requiresAttribution(license) {
    const normalized = this.normalizeLicense(license)
    return [
      'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause',
      'LGPL-2.1', 'LGPL-3.0', 'GPL-2.0', 'GPL-3.0',
      'AGPL-3.0', 'MPL-2.0'
    ].includes(normalized)
  }
}

module.exports = LicenseRiskAssessor
