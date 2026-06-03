const { HistoryRecord } = require('./models');

class ViewSynchronizer {
  constructor() {
    this.viewState = {
      annotations: [],
      obstacles: {},
      lastUpdated: null
    };
    this.history = [];
    this.subscribers = [];
  }

  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  notifySubscribers(changeType, data) {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(changeType, data, this.getViewSnapshot());
      } catch (e) {
        console.error('视图订阅者出错:', e);
      }
    }
  }

  addAnnotation(annotation, operator) {
    const existing = this.viewState.annotations.find(
      a => a.obstacleId === annotation.obstacleId && a.name === annotation.name
    );
    
    if (!existing) {
      this.viewState.annotations.push(annotation);
      this.viewState.lastUpdated = new Date();
      
      this.addHistory('add_annotation', {
        annotationId: annotation.annotationId,
        obstacleId: annotation.obstacleId,
        name: annotation.name,
        source: annotation.source
      }, operator);
      
      this.notifySubscribers('annotation_added', annotation);
      return true;
    }
    return false;
  }

  updateAnnotationStatus(annotationId, status, operator, reviewedBy = null) {
    const annotation = this.viewState.annotations.find(
      a => a.annotationId === annotationId
    );
    
    if (annotation) {
      const oldStatus = annotation.status;
      annotation.status = status;
      annotation.reviewedBy = reviewedBy;
      annotation.reviewedAt = new Date();
      this.viewState.lastUpdated = new Date();
      
      this.addHistory('update_annotation_status', {
        annotationId,
        oldStatus,
        newStatus: status,
        reviewedBy
      }, operator);
      
      this.notifySubscribers('annotation_updated', annotation);
      return annotation;
    }
    return null;
  }

  updateObstacle(obstacle, operator) {
    const oldData = this.viewState.obstacles[obstacle.id] 
      ? JSON.parse(JSON.stringify(this.viewState.obstacles[obstacle.id]))
      : null;
    
    this.viewState.obstacles[obstacle.id] = obstacle;
    this.viewState.lastUpdated = new Date();
    
    this.addHistory('update_obstacle', {
      obstacleId: obstacle.id,
      oldData,
      newData: {
        names: obstacle.names,
        position: obstacle.position
      }
    }, operator);
    
    this.notifySubscribers('obstacle_updated', obstacle);
  }

  addHistory(action, details, operator) {
    const record = new HistoryRecord(action, details, operator);
    this.history.push(record);
    return record;
  }

  getViewSnapshot() {
    return {
      annotations: JSON.parse(JSON.stringify(this.viewState.annotations)),
      obstacles: JSON.parse(JSON.stringify(this.viewState.obstacles)),
      lastUpdated: this.viewState.lastUpdated,
      annotationCount: this.viewState.annotations.length,
      obstacleCount: Object.keys(this.viewState.obstacles).length
    };
  }

  getHistory(filter = {}) {
    let results = [...this.history];
    
    if (filter.action) {
      results = results.filter(r => r.action === filter.action);
    }
    if (filter.operator) {
      results = results.filter(r => r.operator === filter.operator);
    }
    if (filter.startTime) {
      results = results.filter(r => r.timestamp >= filter.startTime);
    }
    if (filter.endTime) {
      results = results.filter(r => r.timestamp <= filter.endTime);
    }
    
    return results;
  }

  verifyConsistency() {
    const issues = [];
    const annotationActions = this.history.filter(h => 
      h.action === 'add_annotation'
    );
    
    if (this.viewState.annotations.length !== annotationActions.length) {
      issues.push({
        type: 'annotation_count_mismatch',
        message: `视图中有 ${this.viewState.annotations.length} 个标注，但历史记录里有 ${annotationActions.length} 条添加记录`,
        viewCount: this.viewState.annotations.length,
        historyCount: annotationActions.length
      });
    }
    
    const obstacleUpdates = this.history.filter(h => h.action === 'update_obstacle');
    const obstacleIdsFromHistory = new Set(
      obstacleUpdates.map(h => h.details.obstacleId)
    );
    const obstacleIdsFromView = new Set(
      Object.keys(this.viewState.obstacles)
    );
    
    for (const id of obstacleIdsFromView) {
      if (!obstacleIdsFromHistory.has(id)) {
        issues.push({
          type: 'obstacle_no_history',
          message: `障碍物 ${id} 在视图中存在，但没有任何更新历史`,
          obstacleId: id
        });
      }
    }
    
    return {
      consistent: issues.length === 0,
      issues,
      summary: issues.length === 0 
        ? '视图与历史记录完全一致' 
        : `发现 ${issues.length} 个不一致问题`
    };
  }

  exportViewData() {
    const snapshot = this.getViewSnapshot();
    const consistency = this.verifyConsistency();
    
    return {
      ...snapshot,
      exportedAt: new Date(),
      consistencyCheck: consistency,
      historyCount: this.history.length
    };
  }
}

module.exports = ViewSynchronizer;
