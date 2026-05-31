import { getDb } from './database.js';
import { ClassroomError } from './errors.js';
import { getPartsList, getLastModifier, getChangeLog } from './partsList.js';

export function createClassroom(classroomId, name, teacher, partsListName) {
  const db = getDb();
  
  const existing = db.prepare('SELECT * FROM classrooms WHERE classroom_id = ?').get(classroomId);
  
  if (existing) {
    const runCount = db.prepare(
      'SELECT COUNT(*) as count FROM classroom_runs WHERE classroom_id = ?'
    ).get(classroomId).count;
    
    throw new ClassroomError('CLASSROOM_ALREADY_EXISTS', {
      classroomId,
      existingRunCount: runCount
    });
  }
  
  db.prepare(`
    INSERT INTO classrooms (classroom_id, name, teacher)
    VALUES (?, ?, ?)
  `).run(classroomId, name, teacher);
  
  return startNewRun(classroomId, partsListName);
}

export function startNewRun(classroomId, partsListName = null) {
  const db = getDb();
  
  const classroom = db.prepare('SELECT * FROM classrooms WHERE classroom_id = ?').get(classroomId);
  if (!classroom) {
    throw new Error('课堂不存在');
  }
  
  const lastRun = db.prepare(`
    SELECT MAX(run_number) as max_run FROM classroom_runs WHERE classroom_id = ?
  `).get(classroomId);
  
  const runNumber = (lastRun?.max_run || 0) + 1;
  
  const result = db.prepare(`
    INSERT INTO classroom_runs (classroom_id, run_number, status)
    VALUES (?, ?, 'running')
  `).run(classroomId, runNumber);
  
  if (runNumber > 1) {
    console.log(`\n📝 这是课堂"${classroomId}"的第${runNumber}次运行`);
    console.log(`💾 历史记录已保留，可通过 history 命令查看\n`);
  }
  
  if (partsListName) {
    const modifier = getLastModifier(partsListName);
    if (modifier && modifier.modifiedBy) {
      const changes = getChangeLog('parts_list');
      const recentChanges = changes.slice(0, 3).map(c => c.action).join('、');
      
      console.log(`\n⚠️  注意：零件清单"${partsListName}"最近有改动`);
      console.log(`   修改人：${modifier.modifiedBy}`);
      console.log(`   修改时间：${modifier.modifiedAt}`);
      if (recentChanges) {
        console.log(`   最近操作：${recentChanges}`);
      }
      console.log();
    }
  }
  
  return {
    runId: result.lastInsertRowid,
    runNumber,
    classroomId
  };
}

export function getCurrentRun(classroomId) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM classroom_runs 
    WHERE classroom_id = ? AND status = 'running'
    ORDER BY run_number DESC LIMIT 1
  `).get(classroomId);
}

export function recordStudentOperation(runId, operationData) {
  const db = getDb();
  
  const run = db.prepare('SELECT * FROM classroom_runs WHERE id = ?').get(runId);
  if (!run) {
    throw new Error('运行记录不存在');
  }
  
  const errorsInRun = db.prepare(`
    SELECT COUNT(*) as count 
    FROM student_operations 
    WHERE run_id = ? AND student_name = ? AND step_number = ? AND is_error = 1
  `).get(runId, operationData.studentName, operationData.stepNumber || 0).count;
  
  if (operationData.isError && errorsInRun > 0) {
    console.log(`\n🔄 学生${operationData.studentName}在第${operationData.stepNumber}步重复出错（第${errorsInRun + 1}次）`);
  }
  
  const result = db.prepare(`
    INSERT INTO student_operations (run_id, student_name, step_number, step_name, action, is_error, error_message, video_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    runId,
    operationData.studentName,
    operationData.stepNumber,
    operationData.stepName || '',
    operationData.action,
    operationData.isError ? 1 : 0,
    operationData.errorMessage || '',
    operationData.videoPath || ''
  );
  
  if (operationData.isError) {
    throw new ClassroomError('STUDENT_MISOPERATION', {
      studentName: operationData.studentName,
      stepNumber: operationData.stepNumber,
      errorDetail: operationData.errorMessage || operationData.action,
      errorCount: errorsInRun + 1
    });
  }
  
  return result.lastInsertRowid;
}

export function validateStep(runId, stepData, partsListName) {
  const db = getDb();
  const partsList = getPartsList(partsListName);
  
  if (!partsList) {
    throw new ClassroomError('PART_NOT_FOUND', { partName: partsListName });
  }
  
  const step = partsList.steps.find(s => s.stepNumber === stepData.stepNumber);
  
  if (step && step.videoRequired && !stepData.videoPath) {
    throw new ClassroomError('MISSING_VIDEO', {
      stepNumber: step.stepNumber,
      stepName: step.stepName
    });
  }
  
  const operations = db.prepare(`
    SELECT DISTINCT step_number 
    FROM student_operations 
    WHERE run_id = ? AND is_error = 0
    ORDER BY step_number
  `).all(runId);
  
  const completedSteps = operations.map(o => o.step_number).filter(n => n > 0);
  const expectedStep = completedSteps.length > 0 ? Math.max(...completedSteps) + 1 : 1;
  
  if (stepData.stepNumber > expectedStep && stepData.stepNumber > 1) {
    throw new ClassroomError('STEP_OUT_OF_ORDER', {
      expectedStep,
      actualStep: stepData.stepNumber
    });
  }
  
  if (step && step.requiredParts) {
    for (const requiredPart of step.requiredParts) {
      const partExists = partsList.parts.find(p => p.partNumber === requiredPart);
      if (!partExists) {
        throw new ClassroomError('REQUIRED_PART_MISSING', {
          partName: requiredPart
        });
      }
    }
  }
  
  return true;
}

export function completeRun(runId, notes = '') {
  const db = getDb();
  
  db.prepare(`
    UPDATE classroom_runs 
    SET status = 'completed', completed_at = CURRENT_TIMESTAMP, notes = ?
    WHERE id = ?
  `).run(notes, runId);
  
  const run = db.prepare('SELECT * FROM classroom_runs WHERE id = ?').get(runId);
  const errorCount = db.prepare(
    'SELECT COUNT(*) as count FROM student_operations WHERE run_id = ? AND is_error = 1'
  ).get(runId).count;
  const totalOps = db.prepare(
    'SELECT COUNT(*) as count FROM student_operations WHERE run_id = ?'
  ).get(runId).count;
  
  return {
    runId,
    runNumber: run.run_number,
    totalOperations: totalOps,
    errorCount,
    status: 'completed'
  };
}

export function getClassroomHistory(classroomId) {
  const db = getDb();
  
  const runs = db.prepare(`
    SELECT * FROM classroom_runs 
    WHERE classroom_id = ? 
    ORDER BY run_number DESC
  `).all(classroomId);
  
  return runs.map(run => {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_ops,
        SUM(CASE WHEN is_error = 1 THEN 1 ELSE 0 END) as error_count
      FROM student_operations 
      WHERE run_id = ?
    `).get(run.id);
    
    return {
      runNumber: run.run_number,
      status: run.status,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      totalOperations: stats.total_ops,
      errorCount: stats.error_count
    };
  });
}

export function getRunOperations(runId) {
  const db = getDb();
  
  return db.prepare(`
    SELECT * FROM student_operations WHERE run_id = ? ORDER BY timestamp
  `).all(runId).map(op => ({
    studentName: op.student_name,
    stepNumber: op.step_number,
    stepName: op.step_name,
    action: op.action,
    isError: op.is_error === 1,
    errorMessage: op.error_message,
    videoPath: op.video_path,
    timestamp: op.timestamp
  }));
}

export function getAllClassrooms() {
  const db = getDb();
  
  return db.prepare(`
    SELECT c.*, 
           (SELECT MAX(run_number) FROM classroom_runs WHERE classroom_id = c.classroom_id) as latest_run,
           (SELECT COUNT(*) FROM classroom_runs WHERE classroom_id = c.classroom_id) as total_runs
    FROM classrooms 
    ORDER BY created_at DESC
  `).all();
}
