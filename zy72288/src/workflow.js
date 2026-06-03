const { 
  Obstacle, 
  CADLayer, 
  RangefinderRecord, 
  Annotation 
} = require('./models');
const ConflictDetector = require('./conflictDetector');
const ViewSynchronizer = require('./viewSync');
const SelfChecker = require('./selfCheck');
const { getErrorMessage, formatError } = require('./errorMessages');

class SortingLineWorkflow {
  constructor() {
    this.obstacles = {};
    this.cadLayers = [];
    this.rangefinderRecords = [];
    this.conflictDetector = new ConflictDetector();
    this.viewSync = new ViewSynchronizer();
    this.selfChecker = new SelfChecker(this);
    
    this.workflowSteps = [];
    this.traineeReviews = [];
    this.currentStep = 'idle';
  }

  async step1_importCADLayer(layerData, operator) {
    this.currentStep = 'import_cad';
    const { layerName, obstacleId, position } = layerData;
    
    const existingLayer = this.cadLayers.find(
      l => l.layerName === layerName
    );
    
    if (existingLayer) {
      const error = getErrorMessage('DUPLICATE_IMPORT', {
        layerName,
        lastImportTime: existingLayer.importedAt.toLocaleString(),
        lastImportBy: existingLayer.importedBy || '未知用户'
      });
      return {
        success: false,
        error,
        message: formatError(error)
      };
    }
    
    const layer = new CADLayer(layerName, obstacleId, position);
    layer.importedBy = operator;
    this.cadLayers.push(layer);
    
    if (!this.obstacles[obstacleId]) {
      this.obstacles[obstacleId] = new Obstacle(obstacleId, position, { x: 1, y: 1, z: 1 });
    }
    
    const obstacle = this.obstacles[obstacleId];
    obstacle.addName(layerName, 'CAD图层导入', operator);
    this.viewSync.updateObstacle(obstacle, operator);
    
    const annotation = new Annotation(obstacleId, layerName, operator, 'cad_import');
    this.viewSync.addAnnotation(annotation, operator);
    
    this.workflowSteps.push({
      step: 1,
      action: 'import_cad',
      layerName,
      obstacleId,
      operator,
      timestamp: new Date()
    });
    
    return {
      success: true,
      step: 1,
      message: `CAD图层「${layerName}」导入成功`,
      layer,
      obstacle,
      nextStep: '请培训教官老梁补看测距仪记录'
    };
  }

  async step2_laoliangReviewRangefinder(rangefinderData, operator) {
    if (operator !== '老梁') {
      return {
        success: false,
        message: '只有培训教官老梁可以补看测距仪记录'
      };
    }
    
    this.currentStep = 'laoliang_review';
    const { obstacleId, distance, position, remark } = rangefinderData;
    
    const record = new RangefinderRecord(
      obstacleId, distance, position, '老梁', remark
    );
    record.status = 'reviewed';
    this.rangefinderRecords.push(record);
    
    this.viewSync.addHistory('supplement_data', {
      obstacleId,
      distance,
      remark
    }, '老梁');
    
    this.recalculateObstacle(obstacleId, '老梁');
    
    const conflicts = this.conflictDetector.detectAll(
      this.obstacles,
      this.cadLayers,
      this.rangefinderRecords
    );
    
    const pendingConflicts = conflicts.filter(c => c.status === 'pending');
    
    this.workflowSteps.push({
      step: 2,
      action: 'laoliang_review',
      obstacleId,
      operator: '老梁',
      timestamp: new Date(),
      conflictsFound: pendingConflicts.length
    });
    
    return {
      success: true,
      step: 2,
      message: `老梁已补看障碍物 ${obstacleId} 的测距仪记录`,
      record,
      pendingConflicts,
      conflictAction: pendingConflicts.length > 0 
        ? '检测到冲突！请列出冲突证据，让老梁选择确认或驳回，不要自动处理'
        : '无冲突，可进入下一步',
      nextStep: pendingConflicts.length > 0 
        ? '老梁需先处理冲突确认/驳回' 
        : '等待培训学员复核后更新三维标注视图'
    };
  }

  presentConflictToLaoliang(conflictId) {
    const conflict = this.conflictDetector.conflicts.find(
      c => c.conflictId === conflictId
    );
    
    if (!conflict) {
      return { success: false, message: '冲突不存在' };
    }
    
    return {
      success: true,
      conflictId: conflict.conflictId,
      type: conflict.type,
      obstacleId: conflict.obstacleId,
      description: conflict.description,
      evidence: conflict.evidence,
      options: [
        { action: 'confirm', label: '确认 - 以测距仪数据为准' },
        { action: 'reject', label: '驳回 - 保持CAD图层数据' },
        { action: 'defer', label: '暂缓 - 留给培训学员复核练习' }
      ],
      note: '不要替业务同事自动拍板！必须老梁亲自选择'
    };
  }

  async laoliangResolveConflict(conflictId, resolution, operator) {
    if (operator !== '老梁') {
      return {
        success: false,
        message: '只有培训教官老梁可以处理冲突'
      };
    }
    
    const conflict = this.conflictDetector.resolveConflict(
      conflictId, resolution, '老梁'
    );
    
    if (!conflict) {
      return { success: false, message: '冲突不存在' };
    }
    
    this.viewSync.addHistory('resolve_conflict', {
      conflictId,
      resolution,
      conflictType: conflict.type
    }, '老梁');
    
    return {
      success: true,
      message: `老梁已${resolution === 'confirm' ? '确认' : resolution === 'reject' ? '驳回' : '暂缓'}该冲突`,
      conflict,
      resolution
    };
  }

  async traineeReview(obstacleId, selectedName, traineeName) {
    const obstacle = this.obstacles[obstacleId];
    if (!obstacle) {
      return { success: false, message: '障碍物不存在' };
    }
    
    if (!obstacle.hasMultipleNames()) {
      return {
        success: false,
        message: '该障碍物没有名称冲突，无需学员复核'
      };
    }
    
    const nameEntry = obstacle.names.find(n => n.name === selectedName);
    if (!nameEntry) {
      return {
        success: false,
        message: `选择的名称「${selectedName}」不在候选列表中`
      };
    }
    
    const review = {
      reviewId: `REV_${Date.now()}`,
      obstacleId,
      selectedName,
      traineeName,
      allNames: obstacle.names.map(n => n.name),
      reviewedAt: new Date(),
      status: 'trainee_confirmed'
    };
    
    this.traineeReviews.push(review);
    
    for (const name of obstacle.names) {
      if (name.name === selectedName) {
        name.status = 'trainee_confirmed';
      } else {
        name.status = 'trainee_rejected';
      }
    }
    
    this.viewSync.updateObstacle(obstacle, traineeName);
    this.viewSync.addHistory('trainee_review', {
      obstacleId,
      selectedName,
      traineeName
    }, traineeName);
    
    return {
      success: true,
      message: `培训学员「${traineeName}」已完成复核，选择名称：${selectedName}`,
      review,
      note: '学员复核完成，等待老梁最终确认后更新三维视图'
    };
  }

  async step3_update3DView(obstacleId, operator) {
    const obstacle = this.obstacles[obstacleId];
    if (!obstacle) {
      return { success: false, message: '障碍物不存在' };
    }
    
    if (obstacle.hasMultipleNames()) {
      const pendingNames = obstacle.names.filter(n => n.status === 'pending');
      if (pendingNames.length > 0) {
        const error = getErrorMessage('MISSING_TRAINEE_REVIEW', { obstacleId });
        return {
          success: false,
          error,
          message: formatError(error),
          hint: '碰到同一障碍物被标了两个名字时，别急着归正常，留给培训学员复核'
        };
      }
    }
    
    this.currentStep = 'update_view';
    
    const confirmedName = obstacle.getConfirmedName() || 
                          obstacle.names.find(n => n.status === 'trainee_confirmed')?.name ||
                          obstacle.names[0]?.name;
    
    const annotations = this.viewSync.viewState.annotations.filter(
      a => a.obstacleId === obstacleId
    );
    
    for (const ann of annotations) {
      this.viewSync.updateAnnotationStatus(
        ann.annotationId,
        'confirmed',
        operator,
        operator
      );
    }
    
    this.viewSync.addHistory('update_3d_view', {
      obstacleId,
      confirmedName,
      annotationCount: annotations.length
    }, operator);
    
    this.workflowSteps.push({
      step: 3,
      action: 'update_view',
      obstacleId,
      confirmedName,
      operator,
      timestamp: new Date()
    });
    
    return {
      success: true,
      step: 3,
      message: `三维标注视图已更新，障碍物 ${obstacleId} 最终名称：${confirmedName}`,
      confirmedName,
      viewSnapshot: this.viewSync.getViewSnapshot(),
      workflowComplete: true
    };
  }

  recalculateObstacle(obstacleId, operator) {
    const obstacle = this.obstacles[obstacleId];
    if (obstacle) {
      this.viewSync.addHistory('recalculate', {
        obstacleId,
        position: obstacle.position
      }, operator);
    }
  }

  async runSelfCheck() {
    const report = await this.selfChecker.runAllChecks();
    return {
      report,
      formattedReport: this.selfChecker.formatReport(report)
    };
  }

  getWorkflowStatus() {
    return {
      currentStep: this.currentStep,
      stepsCompleted: this.workflowSteps.length,
      steps: this.workflowSteps,
      obstacleCount: Object.keys(this.obstacles).length,
      cadLayerCount: this.cadLayers.length,
      rangefinderRecordCount: this.rangefinderRecords.length,
      pendingConflicts: this.conflictDetector.getPendingConflicts().length,
      pendingTraineeReviews: Object.values(this.obstacles).filter(
        o => o.hasMultipleNames() && o.names.some(n => n.status === 'pending')
      ).length
    };
  }
}

module.exports = SortingLineWorkflow;
