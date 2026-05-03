import Papa from 'papaparse'

export class CSVParser {
  static parse(content, options = {}) {
    return new Promise((resolve, reject) => {
      Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        transform: (value, header) => {
          const trimmed = value.trim()
          if (trimmed === '') return null
          if (!isNaN(trimmed) && trimmed !== '') {
            return Number(trimmed)
          }
          if (trimmed === 'true' || trimmed === 'false') {
            return trimmed === 'true'
          }
          return trimmed
        },
        ...options,
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(new Error(`CSV解析错误: ${results.errors[0].message}`))
          } else {
            resolve(this.transformContexts(results.data))
          }
        },
        error: (error) => {
          reject(error)
        }
      })
    })
  }

  static transformContexts(data) {
    return data.map((row, index) => {
      const context = {
        id: String(row.id || row.地层编号 || `L${index + 1}`),
        name: row.name || row.地层名称 || `地层 ${index + 1}`,
        age: row.age || row.年代 || '未知',
        description: row.description || row.描述 || '',
        inclusions: this.parseInclusions(row.inclusions || row.包含物 || ''),
        elevation: {
          top: this.parseNumber(row.top_elevation || row.顶部高程),
          bottom: this.parseNumber(row.bottom_elevation || row.底部高程)
        },
        geometry: this.parseGeometry(row),
        relationships: this.parseRelationships(row),
        color: row.color || this.getLayerColor(row.id || row.地层编号),
        originalData: { ...row }
      }
      return context
    })
  }

  static parseNumber(value) {
    if (value === null || value === undefined || value === '') return null
    const num = Number(value)
    return isNaN(num) ? null : num
  }

  static parseInclusions(inclusionsStr) {
    if (!inclusionsStr) return []
    if (Array.isArray(inclusionsStr)) return inclusionsStr
    return inclusionsStr.split(/[,，;；]/).map(s => s.trim()).filter(s => s)
  }

  static parseGeometry(row) {
    const geometry = {
      type: row.geometry_type || row.几何类型 || 'box',
      x_min: this.parseNumber(row.x_min || row.x_min),
      x_max: this.parseNumber(row.x_max || row.x_max),
      y_min: this.parseNumber(row.y_min || row.y_min),
      y_max: this.parseNumber(row.y_max || row.y_max),
      z_min: this.parseNumber(row.z_min || row.z_min || row.bottom_elevation || row.底部高程),
      z_max: this.parseNumber(row.z_max || row.z_max || row.top_elevation || row.顶部高程)
    }

    if (row.points || row.点) {
      try {
        geometry.points = typeof row.points === 'string' ? JSON.parse(row.points) : row.points
      } catch {
        geometry.points = null
      }
    }

    return geometry
  }

  static parseRelationships(row) {
    return {
      overlies: this.parseIdList(row.overlies || row.叠压于),
      underlies: this.parseIdList(row.underlies || row.被叠压),
      cuts: this.parseIdList(row.cuts || row.打破),
      cutBy: this.parseIdList(row.cut_by || row.被打破),
      equalTo: this.parseIdList(row.equal_to || row.等同于)
    }
  }

  static parseIdList(value) {
    if (!value) return []
    if (Array.isArray(value)) return value
    return String(value).split(/[,，;；]/).map(s => s.trim()).filter(s => s)
  }

  static getLayerColor(layerId) {
    const id = String(layerId)
    const num = parseInt(id.replace(/\D/g, '')) || 0
    
    const colors = [
      '#8B4513',
      '#A0522D',
      '#CD853F',
      '#DEB887',
      '#D2B48C',
      '#BC8F8F',
      '#F4A460',
      '#E9967A',
      '#FFA07A',
      '#CD5C5C'
    ]
    
    return colors[num % colors.length] || '#8B4513'
  }

  static validateContexts(contexts) {
    const errors = []
    const warnings = []

    contexts.forEach((ctx, index) => {
      if (!ctx.id) {
        errors.push(`第 ${index + 1} 行: 缺少地层编号`)
      }

      if (ctx.elevation.top === null) {
        warnings.push(`地层 ${ctx.id}: 缺少顶部高程数据`)
      }
      if (ctx.elevation.bottom === null) {
        warnings.push(`地层 ${ctx.id}: 缺少底部高程数据`)
      }

      if (ctx.geometry.x_min === null || ctx.geometry.x_max === null) {
        warnings.push(`地层 ${ctx.id}: 缺少X轴范围数据`)
      }
      if (ctx.geometry.y_min === null || ctx.geometry.y_max === null) {
        warnings.push(`地层 ${ctx.id}: 缺少Y轴范围数据`)
      }
    })

    return { errors, warnings }
  }
}

export default CSVParser
