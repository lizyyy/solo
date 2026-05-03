import { v4 as uuidv4 } from 'uuid'
import AnnotationType, { AnnotationTypeLabels } from './AnnotationType'
import RiskLevel, { RiskLevelLabels } from './RiskLevel'

class Annotation {
  constructor(options = {}) {
    this.id = options.id || uuidv4()
    this.imageId = options.imageId || ''
    this.type = options.type || AnnotationType.CRACK
    this.riskLevel = options.riskLevel || RiskLevel.MEDIUM
    this.position = {
      x: options.position?.x || 0,
      y: options.position?.y || 0,
      width: options.position?.width || 100,
      height: options.position?.height || 100
    }
    this.comment = options.comment || ''
    this.suggestion = options.suggestion || ''
    this.createdAt = options.createdAt || new Date().toISOString()
    this.updatedAt = options.updatedAt || new Date().toISOString()
  }

  get typeLabel() {
    return AnnotationTypeLabels[this.type] || this.type
  }

  get riskLevelLabel() {
    return RiskLevelLabels[this.riskLevel] || this.riskLevel
  }

  update(data) {
    Object.assign(this, data)
    this.updatedAt = new Date().toISOString()
  }

  toJSON() {
    return {
      id: this.id,
      imageId: this.imageId,
      type: this.type,
      riskLevel: this.riskLevel,
      position: { ...this.position },
      comment: this.comment,
      suggestion: this.suggestion,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  static fromJSON(json) {
    return new Annotation(json)
  }
}

export default Annotation
