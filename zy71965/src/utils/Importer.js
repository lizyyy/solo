const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Defect } = require('../models/Defect');
const { TrainingLog } = require('../models/TrainingLog');
const { Annotation } = require('../models/Annotation');
const { Storage } = require('./Storage');

class Importer {
  constructor(storage = null) {
    this.storage = storage || new Storage();
    this.warnings = [];
    this.errors = [];
    this.stats = {
      imported: 0,
      skipped: 0,
      warnings: 0,
      errors: 0
    };
  }

  _resetStats() {
    this.warnings = [];
    this.errors = [];
    this.stats = {
      imported: 0,
      skipped: 0,
      warnings: 0,
      errors: 0
    };
  }

  _addWarning(message, context = null) {
    this.warnings.push({ message, context, timestamp: new Date().toISOString() });
    this.stats.warnings++;
  }

  _addError(message, context = null) {
    this.errors.push({ message, context, timestamp: new Date().toISOString() });
    this.stats.errors++;
  }

  async importFile(filePath, type = 'auto') {
    this._resetStats();
    
    if (!fs.existsSync(filePath)) {
      this._addError(`文件不存在: ${filePath}`);
      return { success: false, stats: this.stats, errors: this.errors, warnings: this.warnings };
    }

    const resolvedType = type === 'auto' ? this._detectType(filePath) : type;
    
    switch (resolvedType) {
      case 'training_log':
        return await this.importTrainingLog(filePath);
      case 'annotations':
        return await this.importAnnotations(filePath);
      case 'evaluation':
        return await this.importEvaluation(filePath);
      case 'defects':
        return await this.importDefects(filePath);
      default:
        this._addError(`无法识别的文件类型: ${filePath}`);
        return { success: false, stats: this.stats, errors: this.errors, warnings: this.warnings };
    }
  }

  _detectType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath).toLowerCase();
    
    if (ext === '.json') {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (Array.isArray(data)) {
          if (data.length > 0) {
            const sample = data[0];
            if (sample.epoch !== undefined || sample.loss !== undefined || sample.training !== undefined) {
              return 'training_log';
            }
            if (sample.bbox !== undefined || sample.category !== undefined || sample.label !== undefined) {
              return 'annotations';
            }
            if (sample.defectType !== undefined || sample.status !== undefined) {
              return 'defects';
            }
            if (sample.prediction !== undefined || sample.groundTruth !== undefined || sample.iou !== undefined) {
              return 'evaluation';
            }
          }
        }
        if (data.logs || data.training) return 'training_log';
        if (data.annotations || data.labels) return 'annotations';
        if (data.evaluation || data.metrics) return 'evaluation';
      } catch (e) {}
    }
    
    if (ext === '.log' || ext === '.txt' || basename.includes('log') || basename.includes('train')) {
      return 'training_log';
    }
    if (basename.includes('annotat') || basename.includes('label')) {
      return 'annotations';
    }
    if (basename.includes('eval') || basename.includes('metric') || basename.includes('result')) {
      return 'evaluation';
    }
    
    return 'unknown';
  }

  async importTrainingLog(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.json') {
      return this._importTrainingLogJSON(filePath);
    } else {
      return this._importTrainingLogText(filePath);
    }
  }

  async _importTrainingLogJSON(filePath) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const logs = [];
      
      const entries = Array.isArray(data) ? data : (data.logs || data.training || []);
      
      entries.forEach((entry, index) => {
        try {
          const log = new TrainingLog(entry);
          logs.push(log);
          this.stats.imported++;
        } catch (e) {
          this._addWarning(`解析第 ${index} 条日志失败: ${e.message}`, entry);
          this.stats.skipped++;
        }
      });
      
      if (logs.length > 0) {
        this.storage.saveLogs(logs);
        this._convertLogsToDefects(logs);
      }
      
      return { success: true, stats: this.stats, errors: this.errors, warnings: this.warnings };
    } catch (e) {
      this._addError(`解析JSON日志失败: ${e.message}`);
      return { success: false, stats: this.stats, errors: this.errors, warnings: this.warnings };
    }
  }

  async _importTrainingLogText(filePath) {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    
    const logs = [];
    let lineNumber = 0;
    
    for await (const line of rl) {
      lineNumber++;
      if (!line.trim()) continue;
      
      try {
        let parsed = null;
        
        try {
          parsed = JSON.parse(line);
        } catch {
          parsed = this._parseTextLogLine(line);
        }
        
        if (parsed) {
          const log = new TrainingLog(parsed);
          logs.push(log);
          this.stats.imported++;
        } else {
          this._addWarning(`无法解析第 ${lineNumber} 行`, line.substring(0, 100));
          this.stats.skipped++;
        }
      } catch (e) {
        this._addWarning(`解析第 ${lineNumber} 行失败: ${e.message}`, line.substring(0, 100));
        this.stats.skipped++;
      }
    }
    
    if (logs.length > 0) {
      this.storage.saveLogs(logs);
      this._convertLogsToDefects(logs);
    }
    
    return { success: true, stats: this.stats, errors: this.errors, warnings: this.warnings };
  }

  _parseTextLogLine(line) {
    const result = {};
    
    const epochMatch = line.match(/epoch\D*(\d+)/i);
    if (epochMatch) result.epoch = parseInt(epochMatch[1]);
    
    const stepMatch = line.match(/(?:step|iter)\D*(\d+)/i);
    if (stepMatch) result.step = parseInt(stepMatch[1]);
    
    const lossMatch = line.match(/loss\D*([\d.]+)/i);
    if (lossMatch) result.loss = parseFloat(lossMatch[1]);
    
    const accMatch = line.match(/(?:acc|accuracy)\D*([\d.]+)/i);
    if (accMatch) result.accuracy = parseFloat(accMatch[1]);
    
    const mAPMatch = line.match(/mAP\D*([\d.]+)/i);
    if (mAPMatch) result.mAP = parseFloat(mAPMatch[1]);
    
    const lrMatch = line.match(/(?:lr|learning[_ ]?rate)\D*([\d.eE-]+)/i);
    if (lrMatch) result.learningRate = parseFloat(lrMatch[1]);
    
    const timeMatch = line.match(/(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/);
    if (timeMatch) result.timestamp = timeMatch[1];
    
    if (line.match(/anomal|abnormal|warn/i)) {
      result.anomalyDetected = true;
      result.level = 'WARNING';
    }
    if (line.match(/error|fail/i)) {
      result.level = 'ERROR';
    }
    
    result.message = line.trim();
    
    return Object.keys(result).length > 1 ? result : null;
  }

  _convertLogsToDefects(logs) {
    const anomalyLogs = logs.filter(l => l.anomalyDetected || (l.iou !== null && l.iou < 0.5));
    
    anomalyLogs.forEach(log => {
      if (log.imageId || log.imagePath) {
        const defect = new Defect({
          imageId: log.imageId,
          imagePath: log.imagePath,
          defectType: log.anomalyType || 'detection_failure',
          confidence: log.confidence,
          source: 'training_log',
          sourceLogId: log.id,
          severity: log.anomalyScore > 0.8 ? 'high' : log.anomalyScore > 0.5 ? 'medium' : 'low'
        });
        
        if (log.prediction) defect.prediction = log.prediction;
        if (log.groundTruth) defect.groundTruth = log.groundTruth;
        if (log.iou !== null) defect.iou = log.iou;
        
        this.storage.saveDefect(defect);
      }
    });
  }

  async importAnnotations(filePath) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const annotations = [];
      
      let entries = [];
      if (Array.isArray(data)) {
        entries = data;
      } else if (data.annotations) {
        entries = data.annotations;
      } else if (data.images && Array.isArray(data.images)) {
        if (data.annotations) {
          entries = data.annotations;
        } else {
          data.images.forEach(img => {
            if (img.annotations) {
              entries.push(...img.annotations.map(a => ({ ...a, imageId: img.id, imagePath: img.file_name })));
            }
          });
        }
      }
      
      entries.forEach((entry, index) => {
        try {
          const annotation = new Annotation(entry);
          annotations.push(annotation);
          this.stats.imported++;
        } catch (e) {
          this._addWarning(`解析第 ${index} 条标注失败: ${e.message}`, entry);
          this.stats.skipped++;
        }
      });
      
      if (annotations.length > 0) {
        this.storage.saveAnnotations(annotations);
        this._convertAnnotationsToDefects(annotations);
      }
      
      return { success: true, stats: this.stats, errors: this.errors, warnings: this.warnings };
    } catch (e) {
      this._addError(`解析标注文件失败: ${e.message}`);
      return { success: false, stats: this.stats, errors: this.errors, warnings: this.warnings };
    }
  }

  _convertAnnotationsToDefects(annotations) {
    annotations.forEach(annotation => {
      const existing = this.storage.getDefects().find(d => 
        d.sourceAnnotationId === annotation.id || 
        (d.imageId === annotation.imageId && d.defectType === annotation.category)
      );
      
      if (!existing) {
        const defect = new Defect({
          imageId: annotation.imageId,
          imagePath: annotation.imagePath,
          defectType: annotation.category,
          coordinates: annotation.bbox,
          confidence: annotation.confidence,
          source: 'annotation',
          sourceAnnotationId: annotation.id,
          status: annotation.status === 'verified' ? 'confirmed' : 'pending',
          groundTruth: annotation.isGroundTruth ? annotation.toJSON() : null
        });
        this.storage.saveDefect(defect);
      }
    });
  }

  async importEvaluation(filePath) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const defects = [];
      
      let entries = [];
      if (Array.isArray(data)) {
        entries = data;
      } else if (data.results || data.evaluations) {
        entries = data.results || data.evaluations;
      }
      
      entries.forEach((entry, index) => {
        try {
          const defect = new Defect({
            imageId: entry.imageId || entry.image_id,
            imagePath: entry.imagePath || entry.image_path,
            defectType: entry.defectType || entry.category || entry.predicted_class,
            coordinates: entry.coordinates || entry.bbox,
            confidence: entry.confidence,
            source: 'evaluation',
            evaluationResult: entry,
            iou: entry.iou,
            groundTruth: entry.groundTruth || entry.ground_truth,
            prediction: entry.prediction || entry.predicted,
            status: this._getStatusFromEvaluation(entry)
          });
          
          defects.push(defect);
          this.stats.imported++;
        } catch (e) {
          this._addWarning(`解析第 ${index} 条评估结果失败: ${e.message}`, entry);
          this.stats.skipped++;
        }
      });
      
      if (defects.length > 0) {
        this.storage.saveDefects(defects);
      }
      
      return { success: true, stats: this.stats, errors: this.errors, warnings: this.warnings };
    } catch (e) {
      this._addError(`解析评估文件失败: ${e.message}`);
      return { success: false, stats: this.stats, errors: this.errors, warnings: this.warnings };
    }
  }

  _getStatusFromEvaluation(evaluation) {
    if (evaluation.iou !== undefined) {
      if (evaluation.iou >= 0.7) return 'confirmed';
      if (evaluation.iou < 0.3) return 'rejected';
      return 'needs_review';
    }
    if (evaluation.isCorrect === true) return 'confirmed';
    if (evaluation.isCorrect === false) return 'rejected';
    return 'needs_review';
  }

  async importDefects(filePath) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const defects = [];
      
      const entries = Array.isArray(data) ? data : (data.defects || []);
      
      entries.forEach((entry, index) => {
        try {
          const defect = new Defect(entry);
          defects.push(defect);
          this.stats.imported++;
        } catch (e) {
          this._addWarning(`解析第 ${index} 条缺陷失败: ${e.message}`, entry);
          this.stats.skipped++;
        }
      });
      
      if (defects.length > 0) {
        this.storage.saveDefects(defects);
      }
      
      return { success: true, stats: this.stats, errors: this.errors, warnings: this.warnings };
    } catch (e) {
      this._addError(`解析缺陷文件失败: ${e.message}`);
      return { success: false, stats: this.stats, errors: this.errors, warnings: this.warnings };
    }
  }
}

module.exports = { Importer };
