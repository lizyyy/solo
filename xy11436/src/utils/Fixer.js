const { TASK_STATUS, CONFLICT_TYPES } = require('../models/Task');

class Fixer {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }

  autoFix(operator = 'system') {
    const data = this.dataStore.load();
    const failedTasks = data.tasks.filter(t => t.status === TASK_STATUS.FAILED && !t.isFrozen);
    const results = {
      attempted: failedTasks.length,
      fixed: 0,
      skipped: 0,
      details: []
    };

    failedTasks.forEach(task => {
      const taskResult = {
        taskId: task.id,
        roomNumber: task.roomNumber,
        date: task.date,
        conflicts: []
      };

      task.conflicts.forEach(conflict => {
        if (conflict.resolved) {
          return;
        }

        const fixResult = this.applyAutoFix(task, conflict, operator);
        taskResult.conflicts.push({
          conflictId: conflict.id,
          type: conflict.type,
          fixed: fixResult.fixed,
          method: fixResult.method
        });

        if (fixResult.fixed) {
          results.fixed++;
        }
      });

      results.details.push(taskResult);
    });

    this.dataStore.save(data);
    this.dataStore.saveSnapshot(operator, 'auto_fix');

    return results;
  }

  applyAutoFix(task, conflict, operator) {
    switch (conflict.type) {
      case CONFLICT_TYPES.DUPLICATE:
        return this.fixDuplicate(task, conflict, operator);
      case CONFLICT_TYPES.OVERLAP:
        return this.fixOverlap(task, conflict, operator);
      case CONFLICT_TYPES.LINEN_CHANGE:
        return this.fixLinenChange(task, conflict, operator);
      case CONFLICT_TYPES.EARLY_CHECKOUT:
        return this.fixEarlyCheckout(task, conflict, operator);
      default:
        return { fixed: false, method: 'unsupported_type' };
    }
  }

  fixDuplicate(task, conflict, operator) {
    const data = this.dataStore.load();
    const affectedTasks = conflict.affectedTasks
      .map(id => data.tasks.find(t => t.id === id))
      .filter(t => t);

    if (affectedTasks.length <= 1) {
      return { fixed: false, method: 'not_enough_duplicates' };
    }

    const sortedBySources = affectedTasks.sort((a, b) => 
      b.sourceEvidences.length - a.sourceEvidences.length
    );

    const keepTask = sortedBySources[0];
    const removeTasks = sortedBySources.slice(1);

    removeTasks.forEach(removeTask => {
      removeTask.sourceEvidences.forEach(evidence => {
        try {
          keepTask.addSourceEvidence(evidence, operator);
        } catch (e) {
        }
      });

      const taskIndex = data.tasks.findIndex(t => t.id === removeTask.id);
      if (taskIndex > -1) {
        data.tasks.splice(taskIndex, 1);
      }
    });

    conflict.resolve('merged_into_' + keepTask.id, operator);
    keepTask.status = TASK_STATUS.FIXED;
    keepTask.auditTrail.push({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      operator,
      reason: 'merged_duplicate_sources'
    });

    this.dataStore.save(data);
    return { fixed: true, method: 'merge_sources' };
  }

  fixOverlap(task, conflict, operator) {
    const data = this.dataStore.load();
    const affectedTasks = conflict.affectedTasks
      .map(id => data.tasks.find(t => t.id === id))
      .filter(t => t);

    const orderTask = affectedTasks.find(t => 
      t.sourceEvidences.some(e => e.sourceType === 'order_calendar')
    );
    const groupTask = affectedTasks.find(t => 
      t.sourceEvidences.some(e => e.sourceType === 'cleaning_group')
    );

    if (orderTask && groupTask) {
      groupTask.sourceEvidences.forEach(evidence => {
        try {
          orderTask.addSourceEvidence(evidence, operator);
        } catch (e) {
        }
      });

      const groupIndex = data.tasks.findIndex(t => t.id === groupTask.id);
      if (groupIndex > -1) {
        data.tasks.splice(groupIndex, 1);
      }

      conflict.resolve('merged_order_with_group', operator);
      orderTask.status = TASK_STATUS.FIXED;
      orderTask.auditTrail.push({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        operator,
        reason: 'merged_multisource_overlap'
      });

      this.dataStore.save(data);
      return { fixed: true, method: 'merge_order_preferred' };
    }

    return { fixed: false, method: 'cannot_determine_primary' };
  }

  fixLinenChange(task, conflict, operator) {
    const data = this.dataStore.load();
    const affectedTasks = conflict.affectedTasks
      .map(id => data.tasks.find(t => t.id === id))
      .filter(t => t);

    affectedTasks.forEach(t => {
      t.needLinenChange = true;
      t.auditTrail.push({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        operator,
        reason: 'auto_enabled_linen_change_for_stay'
      });
    });

    conflict.resolve('auto_enabled_linen', operator);
    task.status = TASK_STATUS.FIXED;

    this.dataStore.save(data);
    return { fixed: true, method: 'enable_linen_change' };
  }

  fixEarlyCheckout(task, conflict, operator) {
    task.notes.push({
      type: 'warning',
      message: '临时退房需人工确认',
      timestamp: new Date().toISOString(),
      operator
    });

    return { fixed: false, method: 'needs_manual_verification' };
  }

  manualOverride(taskId, overrideData, operator, reason) {
    return this.dataStore.updateTask(taskId, (task) => {
      task.manualOverride(overrideData, operator, reason);
      task.status = TASK_STATUS.FIXED;
      
      task.conflicts.forEach(conflict => {
        if (!conflict.resolved) {
          conflict.resolve('manual_override', operator);
        }
      });
    }, operator);
  }

  resolveConflict(taskId, conflictId, resolution, operator) {
    return this.dataStore.updateTask(taskId, (task) => {
      const conflict = task.conflicts.find(c => c.id === conflictId);
      if (!conflict) {
        throw new Error(`Conflict ${conflictId} not found in task ${taskId}`);
      }
      task.resolveConflict(conflictId, resolution, operator);
    }, operator);
  }

  cancelTask(taskId, operator, reason) {
    return this.dataStore.updateTask(taskId, (task) => {
      task.updateStatus(TASK_STATUS.CANCELLED, operator, reason);
      
      task.conflicts.forEach(conflict => {
        if (!conflict.resolved) {
          conflict.resolve('task_cancelled', operator);
        }
      });
    }, operator);
  }

  reimportTask(taskId, newSourceEvidence, operator) {
    return this.dataStore.updateTask(taskId, (task) => {
      task.addSourceEvidence(newSourceEvidence, operator);
      task.status = TASK_STATUS.PENDING;
      task.auditTrail.push({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        operator,
        reason: 'reimported_with_new_source'
      });
    }, operator);
  }

  getFixSuggestions(taskId) {
    const data = this.dataStore.load();
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const suggestions = [];

    task.conflicts.forEach(conflict => {
      if (conflict.resolved) return;

      switch (conflict.type) {
        case CONFLICT_TYPES.DUPLICATE:
          suggestions.push({
            conflictId: conflict.id,
            type: conflict.type,
            description: conflict.description,
            options: [
              { id: 'merge', label: '合并为一条任务（保留所有来源证据）' },
              { id: 'keep_first', label: '保留第一条，删除其他' },
              { id: 'keep_all', label: '全部保留（标记为并行任务）' },
              { id: 'manual', label: '人工改判' }
            ]
          });
          break;
        case CONFLICT_TYPES.OVERLAP:
          suggestions.push({
            conflictId: conflict.id,
            type: conflict.type,
            description: conflict.description,
            options: [
              { id: 'merge_order', label: '以订单日历为准，合并群消息证据' },
              { id: 'merge_group', label: '以群消息为准，合并订单证据' },
              { id: 'manual', label: '人工改判' }
            ]
          });
          break;
        case CONFLICT_TYPES.LINEN_CHANGE:
          suggestions.push({
            conflictId: conflict.id,
            type: conflict.type,
            description: conflict.description,
            options: [
              { id: 'enable', label: '自动开启换布草' },
              { id: 'keep_disabled', label: '确认不换布草（客人要求）' },
              { id: 'manual', label: '人工改判' }
            ]
          });
          break;
        case CONFLICT_TYPES.EARLY_CHECKOUT:
          suggestions.push({
            conflictId: conflict.id,
            type: conflict.type,
            description: conflict.description,
            options: [
              { id: 'confirm', label: '确认为临时退房，保留任务' },
              { id: 'cancel', label: '取消任务（订单取消）' },
              { id: 'manual', label: '人工改判' }
            ]
          });
          break;
        default:
          suggestions.push({
            conflictId: conflict.id,
            type: conflict.type,
            description: conflict.description,
            options: [
              { id: 'manual', label: '人工改判' }
            ]
          });
      }
    });

    return suggestions;
  }
}

module.exports = { Fixer };
