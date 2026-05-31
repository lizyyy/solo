const { v4: uuidv4 } = require('uuid');

class TrainingLog {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.timestamp = data.timestamp || data.time || new Date().toISOString();
    this.epoch = data.epoch !== undefined ? data.epoch : null;
    this.step = data.step !== undefined ? data.step : null;
    
    this.loss = data.loss !== undefined ? data.loss : null;
    this.accuracy = data.accuracy !== undefined ? data.accuracy : null;
    this.mAP = data.mAP !== undefined ? data.mAP : data.map || null;
    this.precision = data.precision !== undefined ? data.precision : null;
    this.recall = data.recall !== undefined ? data.recall : null;
    this.f1Score = data.f1Score !== undefined ? data.f1Score : data.f1 || null;
    
    this.learningRate = data.learningRate !== undefined ? data.learningRate : data.lr || null;
    this.batchSize = data.batchSize !== undefined ? data.batchSize : null;
    
    this.imageId = data.imageId || data.image_id || null;
    this.imagePath = data.imagePath || data.image_path || null;
    this.prediction = data.prediction || null;
    this.groundTruth = data.groundTruth || data.ground_truth || null;
    this.iou = data.iou !== undefined ? data.iou : null;
    this.confidence = data.confidence !== undefined ? data.confidence : null;
    
    this.anomalyDetected = data.anomalyDetected || data.is_anomaly || false;
    this.anomalyScore = data.anomalyScore !== undefined ? data.anomalyScore : null;
    this.anomalyType = data.anomalyType || null;
    
    this.level = data.level || 'INFO';
    this.message = data.message || data.msg || '';
    this.source = data.source || 'training';
    
    this.extra = data.extra || {};
    this.ingestedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      epoch: this.epoch,
      step: this.step,
      loss: this.loss,
      accuracy: this.accuracy,
      mAP: this.mAP,
      precision: this.precision,
      recall: this.recall,
      f1Score: this.f1Score,
      learningRate: this.learningRate,
      batchSize: this.batchSize,
      imageId: this.imageId,
      imagePath: this.imagePath,
      prediction: this.prediction,
      groundTruth: this.groundTruth,
      iou: this.iou,
      confidence: this.confidence,
      anomalyDetected: this.anomalyDetected,
      anomalyScore: this.anomalyScore,
      anomalyType: this.anomalyType,
      level: this.level,
      message: this.message,
      source: this.source,
      extra: this.extra,
      ingestedAt: this.ingestedAt
    };
  }
}

module.exports = { TrainingLog };
