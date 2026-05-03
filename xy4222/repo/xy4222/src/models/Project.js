import { v4 as uuidv4 } from 'uuid'
import ArtifactImage from './ArtifactImage'

class Project {
  constructor(options = {}) {
    this.id = options.id || uuidv4()
    this.name = options.name || ''
    this.description = options.description || ''
    this.artifactCode = options.artifactCode || ''
    this.images = (options.images || []).map(img => 
      img instanceof ArtifactImage ? img : ArtifactImage.fromJSON(img)
    )
    this.createdAt = options.createdAt || new Date().toISOString()
    this.updatedAt = options.updatedAt || new Date().toISOString()
  }

  get imageCount() {
    return this.images.length
  }

  get annotationCount() {
    return this.images.reduce((count, img) => count + img.annotations.length, 0)
  }

  get hasImages() {
    return this.images.length > 0
  }

  get uniqueParts() {
    const parts = new Set()
    this.images.forEach(img => {
      if (img.part) {
        parts.add(img.part)
      }
    })
    return Array.from(parts)
  }

  get uniqueArtifactCodes() {
    const codes = new Set()
    this.images.forEach(img => {
      if (img.artifactCode) {
        codes.add(img.artifactCode)
      }
    })
    return Array.from(codes)
  }

  addImage(image) {
    if (!(image instanceof ArtifactImage)) {
      image = new ArtifactImage(image)
    }
    image.projectId = this.id
    this.images.push(image)
    this.updatedAt = new Date().toISOString()
    return image
  }

  updateImage(imageId, data) {
    const index = this.images.findIndex(img => img.id === imageId)
    if (index !== -1) {
      this.images[index].update(data)
      this.updatedAt = new Date().toISOString()
      return this.images[index]
    }
    return null
  }

  removeImage(imageId) {
    const index = this.images.findIndex(img => img.id === imageId)
    if (index !== -1) {
      this.images.splice(index, 1)
      this.updatedAt = new Date().toISOString()
      return true
    }
    return false
  }

  getImage(imageId) {
    return this.images.find(img => img.id === imageId)
  }

  getImagesByStage(stage) {
    return this.images.filter(img => img.stage === stage)
  }

  getImagesByPart(part) {
    return this.images.filter(img => img.part === part)
  }

  getImagesByArtifactCode(artifactCode) {
    return this.images.filter(img => img.artifactCode === artifactCode)
  }

  getImagesByPartAndStage(part, stage) {
    return this.images.filter(img => img.part === part && img.stage === stage)
  }

  update(data) {
    Object.assign(this, data)
    this.updatedAt = new Date().toISOString()
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      artifactCode: this.artifactCode,
      images: this.images.map(img => img.toJSON()),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  static fromJSON(json) {
    return new Project(json)
  }
}

export default Project
