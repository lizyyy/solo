const { v4: uuidv4 } = require('uuid');

const ANNOTATION_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  DISPUTED: 'disputed',
  INVALID: 'invalid'
};

class Annotation {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.imageId = data.imageId || data.image_id || null;
    this.imagePath = data.imagePath || data.image_path || null;
    
    this.category = data.category || data.label || data.defect_type || 'unknown';
    this.bbox = data.bbox || data.coordinates || [];
    this.segmentation = data.segmentation || null;
    this.area = data.area !== undefined ? data.area : null;
    
    this.confidence = data.confidence !== undefined ? data.confidence : 1.0;
    this.isGroundTruth = data.isGroundTruth !== undefined ? data.isGroundTruth : true;
    
    this.annotator = data.annotator || null;
    this.annotationTime = data.annotationTime || data.created_at || null;
    this.status = data.status || ANNOTATION_STATUS.PENDING;
    
    this.reviewCount = data.reviewCount || 0;
    this.lastReviewer = data.lastReviewer || null;
    this.lastReviewedAt = data.lastReviewedAt || null;
    
    this.comments = data.comments || [];
    this.tags = data.tags || [];
    
    this.issues = data.issues || [];
    this.isMissing = data.isMissing || false;
    this.isDuplicate = data.isDuplicate || false;
    
    this.source = data.source || 'manual';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  addComment(content, author = null) {
    const comment = {
      id: uuidv4(),
      content,
      author,
      createdAt: new Date().toISOString()
    };
    this.comments.push(comment);
    this.updatedAt = comment.createdAt;
    return comment;
  }

  markIssue(issueType, description, reporter = null) {
    const issue = {
      id: uuidv4(),
      type: issueType,
      description,
      reporter,
      createdAt: new Date().toISOString(),
      resolved: false
    };
    this.issues.push(issue);
    this.status = ANNOTATION_STATUS.DISPUTED;
    this.updatedAt = issue.createdAt;
    return issue;
  }

  toJSON() {
    return {
      id: this.id,
      imageId: this.imageId,
      imagePath: this.imagePath,
      category: this.category,
      bbox: this.bbox,
      segmentation: this.segmentation,
      area: this.area,
      confidence: this.confidence,
      isGroundTruth: this.isGroundTruth,
      annotator: this.annotator,
      annotationTime: this.annotationTime,
      status: this.status,
      reviewCount: this.reviewCount,
      lastReviewer: this.lastReviewer,
      lastReviewedAt: this.lastReviewedAt,
      comments: this.comments,
      tags: this.tags,
      issues: this.issues,
      isMissing: this.isMissing,
      isDuplicate: this.isDuplicate,
      source: this.source,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = { Annotation, ANNOTATION_STATUS };
