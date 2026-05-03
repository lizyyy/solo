import YAML from 'yaml'

export class YAMLParser {
  static parse(content) {
    try {
      const data = typeof content === 'string' ? YAML.parse(content) : content
      return this.transformRules(data)
    } catch (error) {
      throw new Error(`YAML解析错误: ${error.message}`)
    }
  }

  static transformRules(data) {
    return {
      validation: {
        elevation: this.parseElevationRules(data?.validation?.elevation || data?.高程校验),
        relationships: this.parseRelationshipRules(data?.validation?.relationships || data?.关系校验),
        coordinates: this.parseCoordinateRules(data?.validation?.coordinates || data?.坐标校验)
      },
      trench: {
        id: data?.trench?.id || data?.探方?.编号 || 'T1',
        name: data?.trench?.name || data?.探方?.名称 || '探方 1',
        dimensions: {
          x_min: this.parseNumber(data?.trench?.dimensions?.x_min || data?.探方?.尺寸?.x_min || 0),
          x_max: this.parseNumber(data?.trench?.dimensions?.x_max || data?.探方?.尺寸?.x_max || 10),
          y_min: this.parseNumber(data?.trench?.dimensions?.y_min || data?.探方?.尺寸?.y_min || 0),
          y_max: this.parseNumber(data?.trench?.dimensions?.y_max || data?.探方?.尺寸?.y_max || 10),
          z_min: this.parseNumber(data?.trench?.dimensions?.z_min || data?.探方?.尺寸?.z_min || 0),
          z_max: this.parseNumber(data?.trench?.dimensions?.z_max || data?.探方?.尺寸?.z_max || 5)
        }
      },
      display: {
        colors: data?.display?.colors || data?.显示?.颜色 || {},
        sections: this.parseSections(data?.display?.sections || data?.显示?.剖面)
      },
      originalData: { ...data }
    }
  }

  static parseNumber(value) {
    if (value === null || value === undefined || value === '') return null
    const num = Number(value)
    return isNaN(num) ? null : num
  }

  static parseElevationRules(rules) {
    if (!rules) {
      return {
        enabled: true,
        allowInversion: false,
        tolerance: 0.01,
        checkLayerOrder: true
      }
    }

    return {
      enabled: rules.enabled !== false,
      allowInversion: rules.allow_inversion === true || rules.允许倒挂 === true,
      tolerance: this.parseNumber(rules.tolerance || rules.容差) || 0.01,
      checkLayerOrder: rules.check_layer_order !== false,
      expectedOrder: rules.expected_order || rules.期望顺序 || []
    }
  }

  static parseRelationshipRules(rules) {
    if (!rules) {
      return {
        enabled: true,
        checkMutual: true,
        checkCyclic: true,
        validateCutLogic: true
      }
    }

    return {
      enabled: rules.enabled !== false,
      checkMutual: rules.check_mutual !== false,
      checkCyclic: rules.check_cyclic !== false,
      validateCutLogic: rules.validate_cut_logic !== false,
      allowedRelationships: rules.allowed_relationships || rules.允许关系 || [
        'overlies',
        'underlies',
        'cuts',
        'cut_by',
        'equal_to'
      ]
    }
  }

  static parseCoordinateRules(rules) {
    if (!rules) {
      return {
        enabled: true,
        checkBounds: true,
        checkElevationMatch: true,
        tolerance: 0.01
      }
    }

    return {
      enabled: rules.enabled !== false,
      checkBounds: rules.check_bounds !== false,
      checkElevationMatch: rules.check_elevation_match !== false,
      tolerance: this.parseNumber(rules.tolerance || rules.容差) || 0.01,
      allowOrphanFinds: rules.allow_orphan_finds === true || rules.允许孤立出土物 === true
    }
  }

  static parseSections(sections) {
    if (!sections || !Array.isArray(sections)) {
      return [
        { id: 'S1', name: '南剖面', axis: 'x', position: 0 },
        { id: 'S2', name: '北剖面', axis: 'x', position: 10 },
        { id: 'S3', name: '东剖面', axis: 'y', position: 10 },
        { id: 'S4', name: '西剖面', axis: 'y', position: 0 }
      ]
    }

    return sections.map((section, index) => ({
      id: section.id || `S${index + 1}`,
      name: section.name || `剖面 ${index + 1}`,
      axis: section.axis || 'x',
      position: this.parseNumber(section.position) || 0
    }))
  }

  static validateRules(rules) {
    const errors = []
    const warnings = []

    const dim = rules.trench.dimensions
    if (dim.x_min >= dim.x_max) {
      errors.push('探方X轴范围无效: x_min 必须小于 x_max')
    }
    if (dim.y_min >= dim.y_max) {
      errors.push('探方Y轴范围无效: y_min 必须小于 y_max')
    }
    if (dim.z_min >= dim.z_max) {
      warnings.push('探方Z轴范围可能无效: z_min 应小于 z_max')
    }

    return { errors, warnings }
  }
}

export default YAMLParser
