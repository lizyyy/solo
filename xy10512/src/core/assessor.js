const dataStore = require('../utils/dataStore');
const ruleEngine = require('./rules');
const { v4: uuidv4 } = require('uuid');

class Assessor {
  checkAlert(alertId, force = false) {
    const alert = dataStore.get('alerts', alertId);
    if (!alert) {
      throw new Error(`告警 ${alertId} 不存在`);
    }
    
    const existingAssessment = dataStore.findOneBy('assessments', a => a.alertId === alertId);
    if (existingAssessment && existingAssessment.status !== 'ERROR' && !force) {
      return {
        isDuplicate: true,
        assessmentId: existingAssessment.id,
        message: '该告警已评估，使用 --force 强制重新评估'
      };
    }
    
    const analysis = ruleEngine.analyzeAlert(alert);
    
    const assessmentData = {
      alertId,
      temperatureId: alert.temperatureId,
      ...analysis,
      checkedAt: new Date().toISOString(),
      checkCount: existingAssessment ? (existingAssessment.checkCount || 0) + 1 : 1
    };
    
    if (existingAssessment) {
      const result = dataStore.update('assessments', existingAssessment.id, assessmentData, 'system');
      return {
        isDuplicate: false,
        assessmentId: existingAssessment.id,
        reassessed: true,
        assessment: result.record,
        diff: result.diff
      };
    } else {
      const created = dataStore.create('assessments', assessmentData, null, 'system');
      return {
        isDuplicate: false,
        assessmentId: created.id,
        reassessed: false,
        assessment: created
      };
    }
  }
  
  checkAll(force = false) {
    const alerts = dataStore.list('alerts');
    const results = [];
    
    alerts.forEach(alert => {
      try {
        const result = this.checkAlert(alert.id, force);
        results.push({
          alertId: alert.id,
          success: true,
          ...result
        });
      } catch (err) {
        results.push({
          alertId: alert.id,
          success: false,
          error: err.message
        });
      }
    });
    
    return results;
  }
  
  manualCorrect(alertId, corrections, operator) {
    if (!operator) {
      throw new Error('人工修正必须指定操作者');
    }
    
    const assessment = dataStore.findOneBy('assessments', a => a.alertId === alertId);
    if (!assessment) {
      throw new Error(`告警 ${alertId} 未进行过评估`);
    }
    
    const result = dataStore.update('assessments', assessment.id, {
      ...corrections,
      manuallyCorrected: true,
      correctedBy: operator,
      correctedAt: new Date().toISOString()
    }, operator);
    
    return {
      assessmentId: assessment.id,
      corrected: true,
      diff: result.diff,
      operator
    };
  }
  
  getAssessment(alertId) {
    return dataStore.findOneBy('assessments', a => a.alertId === alertId);
  }
  
  getContinuousAlerts(warehouseId, timeWindowHours = 24) {
    const now = Date.now();
    const windowMs = timeWindowHours * 60 * 60 * 1000;
    
    const assessments = dataStore.list('assessments').filter(a => {
      if (warehouseId && a.assessment?.warehouseId && a.assessment.warehouseId !== warehouseId) {
        return false;
      }
      const checkedAt = new Date(a.checkedAt).getTime();
      return now - checkedAt <= windowMs && 
             (a.status === 'CRITICAL' || a.status === 'PENDING');
    });
    
    return assessments.sort((a, b) => 
      new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
    );
  }
}

module.exports = new Assessor();
