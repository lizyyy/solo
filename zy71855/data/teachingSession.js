const { readJsonFile, writeJsonFile } = require('./models');
const { getFriendlyError } = require('./errorMessages');

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getTeachingSessions() {
  return readJsonFile('sessions.json', []);
}

function saveTeachingSessions(sessions) {
  writeJsonFile('sessions.json', sessions);
}

function getMaterialBatches() {
  return readJsonFile('materials.json', []);
}

function saveMaterialBatches(materials) {
  writeJsonFile('materials.json', materials);
}

function getSteps() {
  return readJsonFile('steps.json', []);
}

function saveSteps(steps) {
  writeJsonFile('steps.json', steps);
}

function createOrGetMaterialBatch(batchNumber, materialName) {
  const materials = getMaterialBatches();
  let batch = materials.find(m => m.batchNumber === batchNumber);
  
  if (batch) {
    return {
      batch,
      isNew: false,
      message: `使用已有材料批次：${batchNumber}，历史记录已保留`
    };
  }
  
  batch = {
    id: generateId(),
    batchNumber,
    materialName,
    createdAt: new Date().toISOString(),
    status: 'pending',
    sessionIds: []
  };
  
  materials.push(batch);
  saveMaterialBatches(materials);
  
  return {
    batch,
    isNew: true,
    message: `已创建新材料批次：${batchNumber}`
  };
}

function createSession(batchNumber, teacherName, className) {
  const materials = getMaterialBatches();
  const batch = materials.find(m => m.batchNumber === batchNumber);
  
  if (!batch) {
    return {
      success: false,
      error: getFriendlyError('INVALID_MATERIAL_ID')
    };
  }
  
  const sessions = getTeachingSessions();
  const session = {
    id: generateId(),
    batchNumber,
    teacherName,
    className,
    startTime: new Date().toISOString(),
    endTime: null,
    status: 'in_progress',
    completedSteps: [],
    errors: [],
    notes: [],
    screenshots: []
  };
  
  sessions.push(session);
  saveTeachingSessions(sessions);
  
  batch.sessionIds.push(session.id);
  saveMaterialBatches(materials);
  
  return {
    success: true,
    session
  };
}

function completeStep(sessionId, stepId, notes = '') {
  const sessions = getTeachingSessions();
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);
  
  if (sessionIndex === -1) {
    return {
      success: false,
      error: getFriendlyError('INVALID_MATERIAL_ID')
    };
  }
  
  const session = sessions[sessionIndex];
  const steps = getSteps();
  const step = steps.find(s => s.id === stepId);
  
  if (!step) {
    return {
      success: false,
      error: getFriendlyError('STEP_SKIPPED', {
        skippedStep: stepId,
        stepDescription: '该步骤'
      })
    };
  }
  
  const lastCompletedStep = session.completedSteps[session.completedSteps.length - 1];
  const expectedOrder = lastCompletedStep 
    ? steps.findIndex(s => s.id === lastCompletedStep.stepId) + 2 
    : 1;
  const actualOrder = steps.findIndex(s => s.id === stepId) + 1;
  
  if (actualOrder > expectedOrder) {
    const skippedStep = steps[expectedOrder - 1];
    return {
      success: false,
      error: getFriendlyError('STEP_SKIPPED', {
        skippedStep: expectedOrder,
        stepDescription: skippedStep ? skippedStep.description : '上一个'
      })
    };
  }
  
  if (actualOrder < expectedOrder && actualOrder !== 1) {
    return {
      success: false,
      error: getFriendlyError('WRONG_ORDER', {
        expectedStep: expectedOrder,
        actualStep: actualOrder
      })
    };
  }
  
  const existingStep = session.completedSteps.find(cs => cs.stepId === stepId);
  if (existingStep) {
    existingStep.revisited = true;
    existingStep.revisitedAt = new Date().toISOString();
    existingStep.notes = notes || existingStep.notes;
  } else {
    session.completedSteps.push({
      stepId,
      stepOrder: actualOrder,
      stepName: step.name,
      completedAt: new Date().toISOString(),
      notes,
      revisited: false
    });
  }
  
  sessions[sessionIndex] = session;
  saveTeachingSessions(sessions);
  
  return {
    success: true,
    session,
    message: existingStep 
      ? `已更新第 ${actualOrder} 步记录` 
      : `第 ${actualOrder} 步完成！`
  };
}

function recordError(sessionId, errorCode, params = {}) {
  const sessions = getTeachingSessions();
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);
  
  if (sessionIndex === -1) {
    return { success: false };
  }
  
  const error = getFriendlyError(errorCode, params);
  sessions[sessionIndex].errors.push(error);
  saveTeachingSessions(sessions);
  
  return { success: true, error };
}

function addNote(sessionId, content) {
  const sessions = getTeachingSessions();
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);
  
  if (sessionIndex === -1) {
    return { success: false };
  }
  
  sessions[sessionIndex].notes.push({
    id: generateId(),
    content,
    createdAt: new Date().toISOString()
  });
  
  saveTeachingSessions(sessions);
  
  return { success: true };
}

function endSession(sessionId) {
  const sessions = getTeachingSessions();
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);
  
  if (sessionIndex === -1) {
    return { success: false };
  }
  
  sessions[sessionIndex].endTime = new Date().toISOString();
  sessions[sessionIndex].status = 'completed';
  saveTeachingSessions(sessions);
  
  return { success: true, session: sessions[sessionIndex] };
}

function getSessionHistory(batchNumber) {
  const sessions = getTeachingSessions();
  return sessions
    .filter(s => s.batchNumber === batchNumber)
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
}

module.exports = {
  createOrGetMaterialBatch,
  createSession,
  completeStep,
  recordError,
  addNote,
  endSession,
  getSessionHistory,
  getSteps,
  saveSteps,
  getMaterialBatches,
  getTeachingSessions
};
