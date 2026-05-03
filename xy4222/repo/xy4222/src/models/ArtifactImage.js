import { v4 as uuidv4 } from 'uuid'
import ShootingStage, { ShootingStageLabels } from './ShootingStage'
import Annotation from './Annotation'

class ArtifactImage {
  constructor(options = {}) {
    this.id = options.id || uuidv4()
    this.projectId = options.projectId || ''
    this.filePath = options.filePath || ''
    this.fileName = options.fileName || ''
    this.artifactCode = options.artifactCode || ''
    this.part = options.part || ''
    this.stage = options.stage || ShootingStage.BEFORE
    this.description = options.description || ''
    this.annotations = (options.annotations || []).map(a => 
      a instanceof Annotation ? a : Annotation.fromJSON(a)
    )
    this.createdAt = options.createdAt || new Date().toISOString()
    this.updatedAt = options.updatedAt || new Date().toISOString()
  }

  get stageLabel() {
    return ShootingStageLabels[this.stage] || this.stage
  }

  get hasAnnotations() {
    return this.annotations.length > 0
  }

  addAnnotation(annotation) {
    if (!(annotation instanceof Annotation)) {
      annotation = new Annotation(annotation)
    }
    annotation.imageId = this.id
    this.annotations.push(annotation)
    this.updatedAt = new Date().toISOString()
    return annotation
  }

  updateAnnotation(annotationId, data) {
    const index = this.annotations.findIndex(a => a.id === annotationId)
    if (index !== -1) {
      this.annotations[index].update(data)
      this.updatedAt = new Date().toISOString()
      return this.annotations[index]
    }
    return null
  }

  removeAnnotation(annotationId) {
    const index = this.annotations.findIndex(a => a.id === annotationId)
    if (index !== -1) {
      this.annotations.splice(index, 1)
      this.updatedAt = new Date().toISOString()
      return true
    }
    return false
  }

  getAnnotation(annotationId) {
    return this.annotations.find(a => a.id === annotationId)
  }

  update(data) {
    Object.assign(this, data)
    this.updatedAt = new Date().toISOString()
  }

  toJSON() {
    return {
      id: this.id,
      projectId: this.projectId,
      filePath: this.filePath,
      fileName: this.fileName,
      artifactCode: this.artifactCode,
      part: this.part,
      stage: this.stage,
      description: this.description,
      annotations: this.annotations.map(a => a.toJSON()),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  static fromJSON(json) {
    return new ArtifactImage(json)
  }
}

export default ArtifactImage
