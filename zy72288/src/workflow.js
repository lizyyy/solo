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

  _snapshot() {
    return {
      currentStep: this.currentStep,
      obstacleCount: Object.keys(this.obstacles).length,
      cadLayerCount: this.cadLayers.length,
      rangefinderRecordCount: this.rangefinderRecords.length,
      pendingConflicts: this.conflictDetector.getPendingConflicts().length,
      pendingTraineeReviews: Object.values(this.obstacles).filter(
        o => o.hasMultipleNames() && o.names.some(n => n.status === 'pending')
      ).length,
      viewVersion: this.viewSync.version
    };
  }

  _buildResult(action, success, message, extras = {}) {
    return {
      success,
      action,
      message,
      state: this._snapshot(),
      output: {
        viewSnapshot: this.viewSync.getViewSnapshot(),
        pendingConflicts: this.conflictDetector.getPendingConflicts().map(c => ({
          conflictId: c.conflictId,
          type: c.type,
          obstacleId: c.obstacleId,
          description: c.description,
          status: c.status,
          resolution: c.resolution
        }))
      },
      ...extras
    };
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
      return this._buildResult('import_cad', false, formatError(error), { error });
    }
    
    const layer = new CADLayer(layerName, obstacleId, position);
    layer.importedBy = operator;
    this.cadLayers.push(layer);
    
    const isNewObstacle = !this.obstacles[obstacleId];
    if (isNewObstacle) {
      this.obstacles[obstacleId] = new Obstacle(obstacleId, position, { x: 1, y: 1, z: 1 });
    }
    
    const obstacle = this.obstacles[obstacleId];
    obstacle.addName(layerName, 'CAD图层导入', operator);
    this.viewSync.updateObstacle(obstacle, operator);
    
    const annotation = new Annotation(obstacleId, layerName, operator, 'cad_import');
    this.viewSync.addAnnotation(annotation, operator);

    const nowHasMultipleNames = obstacle.hasMultipleNames();

    let newConflicts = [];
    if (nowHasMultipleNames) {
      newConflicts = this.conflictDetector.detectDuplicateNames(this.obstacles);
    }

    const workflowStep = {
      step: 1,
      action: 'import_cad',
      layerName,
      obstacleId,
      operator,
      timestamp: new Date(),
      triggeredDuplicateNames: nowHasMultipleNames
    };
    this.workflowSteps.push(workflowStep);

    let message;
    let nextStep;
    let extras = {};

    if (nowHasMultipleNames) {
      message = `CAD图层「${layerName}」已导入，但障碍物【${obstacleId}】现在有 ${obstacle.names.length} 个名称：${obstacle.names.map(n => n.name).join('、')}。以前总被当成小备注跳过，现在需要处理！`;
      nextStep = '请培训教官老梁补看测距仪记录，同时安排培训学员复核名称';
      extras.triggeredDuplicateNames = true;
      extras.duplicateNameConflict = newConflicts.length > 0
        ? {
            conflictId: newConflicts[0].conflictId,
            names: obstacle.names.map(n => ({ name: n.name, source: n.source, status: n.status }))
          }
        : null;
    } else {
      message = `CAD图层「${layerName}」导入成功`;
      nextStep = '请培训教官老梁补看测距仪记录';
    }

    return this._buildResult('import_cad', true, message, {
      step: 1,
      layer: JSON.parse(JSON.stringify(layer)),
      nextStep,
      ...extras
    });
  }

  async step2_laoliangReviewRangefinder(rangefinderData, operator) {
    if (operator !== '老梁') {
      return this._buildResult('laoliang_review', false, '只有培训教官老梁可以补看测距仪记录');
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
    
    this.conflictDetector.detectAll(
      this.obstacles,
      this.cadLayers,
      this.rangefinderRecords
    );
    
    const pendingConflicts = this.conflictDetector.getPendingConflicts();

    this.workflowSteps.push({
      step: 2,
      action: 'laoliang_review',
      obstacleId,
      operator: '老梁',
      timestamp: new Date(),
      conflictsFound: pendingConflicts.length
    });

    let message = `老梁已补看障碍物 ${obstacleId} 的测距仪记录`;
    let nextStep;

    if (pendingConflicts.length > 0) {
      message += `，检测到 ${pendingConflicts.length} 个冲突！请列出冲突证据，让老梁选择确认或驳回，不要自动处理`;
      nextStep = '老梁需先处理冲突确认/驳回';
    } else {
      nextStep = '等待培训学员复核后更新三维标注视图';
    }

    return this._buildResult('laoliang_review', true, message, {
      step: 2,
      record: JSON.parse(JSON.stringify(record)),
      nextStep
    });
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
      evidence: JSON.parse(JSON.stringify(conflict.evidence)),
      options: [
        { action: 'confirm', label: '确认 - 以测距仪数据为准' },
        { action: 'reject', label: '驳回 - 保持CAD图层数据' },
        { action: 'defer', label: '暂缓 - 留给培训学员复核练习' }
      ],
      note: '不要替业务同事自动拍板！必须老梁亲自选择',
      state: this._snapshot(),
      output: {
        viewSnapshot: this.viewSync.getViewSnapshot()
      }
    };
  }

  async laoliangResolveConflict(conflictId, resolution, operator) {
    if (operator !== '老梁') {
      return this._buildResult('resolve_conflict', false, '只有培训教官老梁可以处理冲突');
    }
    
    const conflict = this.conflictDetector.resolveConflict(
      conflictId, resolution, '老梁'
    );
    
    if (!conflict) {
      return this._buildResult('resolve_conflict', false, '冲突不存在');
    }
    
    this.viewSync.addHistory('resolve_conflict', {
      conflictId,
      resolution,
      conflictType: conflict.type
    }, '老梁');

    const resolutionLabel = resolution === 'confirm' ? '确认' : resolution === 'reject' ? '驳回' : '暂缓';
    const message = `老梁已${resolutionLabel}该冲突`;

    return this._buildResult('resolve_conflict', true, message, {
      conflict: JSON.parse(JSON.stringify(conflict)),
      resolution
    });
  }

  async traineeReview(obstacleId, selectedName, traineeName) {
    const obstacle = this.obstacles[obstacleId];
    if (!obstacle) {
      return this._buildResult('trainee_review', false, '障碍物不存在');
    }
    
    if (!obstacle.hasMultipleNames()) {
      return this._buildResult('trainee_review', false, '该障碍物没有名称冲突，无需学员复核');
    }
    
    const nameEntry = obstacle.names.find(n => n.name === selectedName);
    if (!nameEntry) {
      return this._buildResult('trainee_review', false, `选择的名称「${selectedName}」不在候选列表中`);
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

    const dupConflicts = this.conflictDetector.getConflictsByType('duplicate_names')
      .filter(c => c.obstacleId === obstacleId && c.status === 'pending');
    for (const conflict of dupConflicts) {
      this.conflictDetector.resolveConflict(conflict.conflictId, 'trainee_reviewed', traineeName);
    }

    const pendingForThis = this.conflictDetector.getPendingConflictsForObstacle(obstacleId);

    let message = `培训学员「${traineeName}」已完成复核，选择名称：${selectedName}`;
    let note = '';
    if (pendingForThis.length > 0) {
      note = `名称复核完成，但障碍物 ${obstacleId} 还有 ${pendingForThis.length} 条待处理的测距冲突，不能更新三维视图`;
    } else {
      note = '学员复核完成，等待老梁最终确认后更新三维视图';
    }

    return this._buildResult('trainee_review', true, message, {
      review: JSON.parse(JSON.stringify(review)),
      note,
      remainingConflictsForObstacle: pendingForThis.length
    });
  }

  async step3_update3DView(obstacleId, operator) {
    const obstacle = this.obstacles[obstacleId];
    if (!obstacle) {
      return this._buildResult('update_3d_view', false, '障碍物不存在');
    }
    
    if (obstacle.hasMultipleNames()) {
      const pendingNames = obstacle.names.filter(n => n.status === 'pending');
      if (pendingNames.length > 0) {
        const error = getErrorMessage('MISSING_TRAINEE_REVIEW', { obstacleId });
        return this._buildResult('update_3d_view', false, formatError(error), {
          error,
          hint: '碰到同一障碍物被标了两个名字时，别急着归正常，留给培训学员复核'
        });
      }
    }

    const pendingForThis = this.conflictDetector.getPendingConflictsForObstacle(obstacleId);
    if (pendingForThis.length > 0) {
      const error = getErrorMessage('PENDING_CAD_RANGE_CONFLICT', {
        obstacleId,
        count: pendingForThis.length
      });
      return this._buildResult('update_3d_view', false, formatError(error), {
        error,
        blockedConflicts: pendingForThis.map(c => ({
          conflictId: c.conflictId,
          type: c.type,
          description: c.description
        })),
        hint: '有未处理的CAD与测距仪冲突，不能进入三维视图更新，更不能把分拣口_A01_侧挡写成已确认'
      });
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

    const message = `三维标注视图已更新，障碍物 ${obstacleId} 最终名称：${confirmedName}`;

    return this._buildResult('update_3d_view', true, message, {
      step: 3,
      confirmedName,
      workflowComplete: true
    });
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
      formattedReport: this.selfChecker.formatReport(report),
      state: this._snapshot()
    };
  }

  getWorkflowStatus() {
    return this._snapshot();
  }
}

module.exports = SortingLineWorkflow;
