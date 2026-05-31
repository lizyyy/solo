import { getDb } from './database.js';
import fs from 'fs';
import path from 'path';

export function exportClassroomRecord(classroomId, outputPath, runNumber = null) {
  const db = getDb();
  
  const classroom = db.prepare('SELECT * FROM classrooms WHERE classroom_id = ?').get(classroomId);
  if (!classroom) {
    throw new Error('课堂不存在');
  }
  
  let query = 'SELECT * FROM classroom_runs WHERE classroom_id = ?';
  const params = [classroomId];
  
  if (runNumber) {
    query += ' AND run_number = ?';
    params.push(runNumber);
  }
  
  query += ' ORDER BY run_number DESC';
  
  const runs = db.prepare(query).all(...params);
  
  if (runs.length === 0) {
    throw new Error('没有找到运行记录');
  }
  
  const exportData = {
    classroom: {
      id: classroom.classroom_id,
      name: classroom.name,
      teacher: classroom.teacher,
      createdAt: classroom.created_at
    },
    runs: []
  };
  
  for (const run of runs) {
    const operations = db.prepare(`
      SELECT * FROM student_operations 
      WHERE run_id = ? 
      ORDER BY timestamp
    `).all(run.id);
    
    const errorCount = operations.filter(o => o.is_error === 1).length;
    
    const runData = {
      runNumber: run.run_number,
      status: run.status,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      notes: run.notes,
      summary: {
        totalOperations: operations.length,
        errorCount,
        successCount: operations.length - errorCount
      },
      operations: operations.map(op => ({
        student: op.student_name,
        step: op.step_number,
        stepName: op.step_name,
        action: op.action,
        isError: op.is_error === 1,
        errorMessage: op.error_message || '',
        video: op.video_path || '',
        time: op.timestamp
      }))
    };
    
    exportData.runs.push(runData);
  }
  
  const textOutput = generateTextReport(exportData);
  
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, textOutput, 'utf8');
  
  return {
    recordCount: runs.length,
    outputPath,
    latestRun: runs[0].run_number
  };
}

function generateTextReport(data) {
  const lines = [];
  
  lines.push('='.repeat(60));
  lines.push('发动机拆装课堂记录');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`课堂编号：${data.classroom.id}`);
  lines.push(`课堂名称：${data.classroom.name}`);
  lines.push(`授课老师：${data.classroom.teacher}`);
  lines.push(`创建时间：${data.classroom.createdAt}`);
  lines.push(`运行次数：${data.runs.length}`);
  lines.push('');
  
  lines.push('-'.repeat(60));
  lines.push('历史运行记录');
  lines.push('-'.repeat(60));
  lines.push('');
  
  for (let i = 0; i < data.runs.length; i++) {
    const run = data.runs[i];
    
    lines.push(`【第${run.runNumber}次运行】`);
    lines.push(`  状态：${run.status === 'completed' ? '已完成' : run.status}`);
    lines.push(`  开始：${run.startedAt}`);
    if (run.completedAt) {
      lines.push(`  结束：${run.completedAt}`);
    }
    lines.push(`  操作数：${run.summary.totalOperations}`);
    lines.push(`  错误数：${run.summary.errorCount}`);
    lines.push(`  成功率：${run.summary.totalOperations > 0 
      ? Math.round((run.summary.successCount / run.summary.totalOperations) * 100) 
      : 0}%`);
    
    if (run.notes) {
      lines.push(`  备注：${run.notes}`);
    }
    
    lines.push('');
    
    if (run.operations.length > 0) {
      lines.push('  操作明细：');
      lines.push('  ' + '-'.repeat(56));
      
      for (const op of run.operations) {
        const statusIcon = op.isError ? '❌' : '✅';
        const stepInfo = op.step ? `第${op.step}步` : '准备';
        const stepName = op.stepName ? ` - ${op.stepName}` : '';
        
        lines.push(`  ${statusIcon} ${op.student} | ${stepInfo}${stepName}`);
        lines.push(`     ${op.action}`);
        
        if (op.isError && op.errorMessage) {
          lines.push(`     ❗ 问题：${op.errorMessage}`);
        }
        
        if (op.video) {
          lines.push(`     🎬 视频：${op.video}`);
        }
        
        lines.push(`     ⏰ ${op.time}`);
        lines.push('');
      }
    }
    
    if (i < data.runs.length - 1) {
      lines.push('  ' + '='.repeat(56));
      lines.push('');
    }
  }
  
  lines.push('='.repeat(60));
  lines.push('记录结束 - 下一班老师可继续在此基础上更新');
  lines.push('='.repeat(60));
  
  return lines.join('\n');
}

export function exportPartsListHistory(listName, outputPath) {
  const db = getDb();
  
  const lists = db.prepare(`
    SELECT * FROM parts_lists WHERE name = ? ORDER BY version DESC
  `).all(listName);
  
  if (lists.length === 0) {
    throw new Error('零件清单不存在');
  }
  
  const lines = [];
  
  lines.push('='.repeat(60));
  lines.push(`零件清单变更记录 - ${listName}`);
  lines.push('='.repeat(60));
  lines.push('');
  
  for (const list of lists) {
    lines.push(`【版本 ${list.version}】`);
    lines.push(`  创建人：${list.created_by}`);
    lines.push(`  创建时间：${list.created_at}`);
    if (list.modified_by) {
      lines.push(`  最后修改人：${list.modified_by}`);
      lines.push(`  最后修改时间：${list.modified_at}`);
    }
    lines.push('');
    
    const parts = db.prepare('SELECT * FROM parts WHERE parts_list_id = ?').all(list.id);
    lines.push('  零件清单：');
    for (const part of parts) {
      lines.push(`    - ${part.part_number} | ${part.part_name} | 数量: ${part.quantity}`);
    }
    lines.push('');
  }
  
  const changes = db.prepare(`
    SELECT * FROM change_log 
    WHERE entity_type IN ('parts_list', 'part', 'step')
    ORDER BY changed_at DESC
    LIMIT 50
  `).all();
  
  if (changes.length > 0) {
    lines.push('-'.repeat(60));
    lines.push('最近变更日志');
    lines.push('-'.repeat(60));
    lines.push('');
    
    for (const change of changes) {
      const actionName = {
        'create': '创建',
        'add': '添加',
        'update_quantity': '更新数量',
        'delete': '删除'
      }[change.action] || change.action;
      
      lines.push(`  ${change.changed_at}`);
      lines.push(`    ${change.changed_by} - ${actionName}`);
      lines.push('');
    }
  }
  
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
  
  return { outputPath, versionCount: lists.length };
}

export function exportAllRecords(outputDir) {
  const db = getDb();
  
  const classrooms = db.prepare('SELECT classroom_id FROM classrooms').all();
  
  const results = [];
  
  for (const classroom of classrooms) {
    const outputPath = path.join(outputDir, `${classroom.classroom_id}.txt`);
    try {
      const result = exportClassroomRecord(classroom.classroom_id, outputPath);
      results.push({
        classroomId: classroom.classroom_id,
        ...result
      });
    } catch (e) {
      results.push({
        classroomId: classroom.classroom_id,
        error: e.message
      });
    }
  }
  
  return results;
}
