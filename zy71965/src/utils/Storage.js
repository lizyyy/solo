const fs = require('fs');
const path = require('path');
const { Defect } = require('../models/Defect');
const { TrainingLog } = require('../models/TrainingLog');
const { Annotation } = require('../models/Annotation');
const { ReviewHistory } = require('../models/ReviewHistory');

class Storage {
  constructor(baseDir = null) {
    this.baseDir = baseDir || path.join(process.cwd(), 'data');
    this.defectsPath = path.join(this.baseDir, 'defects', 'defects.json');
    this.logsPath = path.join(this.baseDir, 'logs', 'training_logs.json');
    this.annotationsPath = path.join(this.baseDir, 'defects', 'annotations.json');
    this.reviewsPath = path.join(this.baseDir, 'reviews', 'review_history.json');
    this.metaPath = path.join(this.baseDir, 'metadata.json');
    
    this._ensureDirectories();
    this._initFiles();
  }

  _ensureDirectories() {
    const dirs = [
      this.baseDir,
      path.join(this.baseDir, 'defects'),
      path.join(this.baseDir, 'logs'),
      path.join(this.baseDir, 'reviews'),
      path.join(this.baseDir, 'exports')
    ];
    
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  _initFiles() {
    const metaData = {
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      version: '1.0.0',
      stats: {
        totalDefects: 0,
        totalLogs: 0,
        totalAnnotations: 0,
        totalReviews: 0
      }
    };

    const initFiles = [
      { path: this.defectsPath, default: [] },
      { path: this.logsPath, default: [] },
      { path: this.annotationsPath, default: [] },
      { path: this.reviewsPath, default: [] },
      { path: this.metaPath, default: metaData }
    ];
    
    initFiles.forEach(file => {
      if (!fs.existsSync(file.path)) {
        fs.writeFileSync(file.path, JSON.stringify(file.default, null, 2), 'utf8');
      }
    });
  }

  _readJSON(filePath) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      if (e instanceof SyntaxError) {
        console.error(`JSON解析错误: ${filePath}`);
        return [];
      }
      throw e;
    }
  }

  _writeJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    this._updateMeta();
  }

  _updateMeta() {
    const meta = this._readJSON(this.metaPath);
    meta.lastModified = new Date().toISOString();
    meta.stats = {
      totalDefects: this.getDefects().length,
      totalLogs: this.getLogs().length,
      totalAnnotations: this.getAnnotations().length,
      totalReviews: this.getReviewHistory().length
    };
    fs.writeFileSync(this.metaPath, JSON.stringify(meta, null, 2), 'utf8');
  }

  getDefects(filter = null) {
    const data = this._readJSON(this.defectsPath);
    const defects = data.map(d => new Defect(d));
    if (filter) {
      return defects.filter(filter);
    }
    return defects;
  }

  getDefectById(id) {
    const defects = this.getDefects();
    return defects.find(d => d.id === id) || null;
  }

  saveDefect(defect) {
    const defects = this.getDefects();
    const index = defects.findIndex(d => d.id === defect.id);
    if (index >= 0) {
      defects[index] = defect;
    } else {
      defects.push(defect);
    }
    this._writeJSON(this.defectsPath, defects.map(d => d.toJSON()));
    return defect;
  }

  saveDefects(defectsList) {
    const existing = this.getDefects();
    const existingIds = new Set(existing.map(d => d.id));
    
    defectsList.forEach(defect => {
      if (existingIds.has(defect.id)) {
        const index = existing.findIndex(d => d.id === defect.id);
        existing[index] = defect;
      } else {
        existing.push(defect);
      }
    });
    
    this._writeJSON(this.defectsPath, existing.map(d => d.toJSON()));
    return existing;
  }

  deleteDefect(id) {
    const defects = this.getDefects().filter(d => d.id !== id);
    this._writeJSON(this.defectsPath, defects.map(d => d.toJSON()));
  }

  getLogs(filter = null) {
    const data = this._readJSON(this.logsPath);
    const logs = data.map(l => new TrainingLog(l));
    if (filter) {
      return logs.filter(filter);
    }
    return logs;
  }

  getLogById(id) {
    const logs = this.getLogs();
    return logs.find(l => l.id === id) || null;
  }

  saveLog(log) {
    const logs = this.getLogs();
    const index = logs.findIndex(l => l.id === log.id);
    if (index >= 0) {
      logs[index] = log;
    } else {
      logs.push(log);
    }
    this._writeJSON(this.logsPath, logs.map(l => l.toJSON()));
    return log;
  }

  saveLogs(logsList) {
    this._writeJSON(this.logsPath, logsList.map(l => l.toJSON()));
    return logsList;
  }

  getAnnotations(filter = null) {
    const data = this._readJSON(this.annotationsPath);
    const annotations = data.map(a => new Annotation(a));
    if (filter) {
      return annotations.filter(filter);
    }
    return annotations;
  }

  getAnnotationById(id) {
    const annotations = this.getAnnotations();
    return annotations.find(a => a.id === id) || null;
  }

  saveAnnotation(annotation) {
    const annotations = this.getAnnotations();
    const index = annotations.findIndex(a => a.id === annotation.id);
    if (index >= 0) {
      annotations[index] = annotation;
    } else {
      annotations.push(annotation);
    }
    this._writeJSON(this.annotationsPath, annotations.map(a => a.toJSON()));
    return annotation;
  }

  saveAnnotations(annotationsList) {
    this._writeJSON(this.annotationsPath, annotationsList.map(a => a.toJSON()));
    return annotationsList;
  }

  getReviewHistory(filter = null) {
    const data = this._readJSON(this.reviewsPath);
    const reviews = data.map(r => new ReviewHistory(r));
    if (filter) {
      return reviews.filter(filter);
    }
    return reviews;
  }

  getReviewsByDefectId(defectId) {
    return this.getReviewHistory().filter(r => r.defectId === defectId);
  }

  saveReview(review) {
    const reviews = this.getReviewHistory();
    reviews.push(review);
    this._writeJSON(this.reviewsPath, reviews.map(r => r.toJSON()));
    return review;
  }

  saveReviews(reviewsList) {
    const existing = this.getReviewHistory();
    const combined = [...existing, ...reviewsList];
    this._writeJSON(this.reviewsPath, combined.map(r => r.toJSON()));
    return combined;
  }

  getStats() {
    const defects = this.getDefects();
    const annotations = this.getAnnotations();
    const logs = this.getLogs();
    
    const statusCounts = {};
    const typeCounts = {};
    const severityCounts = {};
    
    defects.forEach(d => {
      statusCounts[d.status] = (statusCounts[d.status] || 0) + 1;
      typeCounts[d.defectType] = (typeCounts[d.defectType] || 0) + 1;
      severityCounts[d.severity] = (severityCounts[d.severity] || 0) + 1;
    });
    
    return {
      total: {
        defects: defects.length,
        annotations: annotations.length,
        logs: logs.length,
        reviews: this.getReviewHistory().length
      },
      byStatus: statusCounts,
      byType: typeCounts,
      bySeverity: severityCounts,
      pendingReview: defects.filter(d => d.status === 'pending' || d.status === 'needs_review').length,
      withIssues: annotations.filter(a => a.issues && a.issues.length > 0).length,
      anomalies: logs.filter(l => l.anomalyDetected).length
    };
  }

  exportData(type, format = 'json') {
    const exportPath = path.join(this.baseDir, 'exports');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    let data, filename;
    
    switch (type) {
      case 'defects':
        data = this.getDefects().map(d => d.toJSON());
        filename = `defects_${timestamp}`;
        break;
      case 'annotations':
        data = this.getAnnotations().map(a => a.toJSON());
        filename = `annotations_${timestamp}`;
        break;
      case 'logs':
        data = this.getLogs().map(l => l.toJSON());
        filename = `logs_${timestamp}`;
        break;
      case 'reviews':
        data = this.getReviewHistory().map(r => r.toJSON());
        filename = `reviews_${timestamp}`;
        break;
      case 'all':
        data = {
          defects: this.getDefects().map(d => d.toJSON()),
          annotations: this.getAnnotations().map(a => a.toJSON()),
          logs: this.getLogs().map(l => l.toJSON()),
          reviews: this.getReviewHistory().map(r => r.toJSON()),
          exportedAt: new Date().toISOString()
        };
        filename = `full_export_${timestamp}`;
        break;
      default:
        throw new Error(`Unknown export type: ${type}`);
    }
    
    if (format === 'json') {
      const fullPath = path.join(exportPath, `${filename}.json`);
      fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf8');
      return fullPath;
    }
    
    throw new Error(`Unsupported format: ${format}`);
  }

  getMetadata() {
    return this._readJSON(this.metaPath);
  }
}

module.exports = { Storage };
