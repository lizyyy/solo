#!/usr/bin/env node

import { initDatabase } from './database.js';
import { handleError, ClassroomError } from './errors.js';
import { createPartsList, getPartsList, getPartsListHistory, getChangeLog, updatePartQuantity } from './partsList.js';
import { 
  createClassroom, 
  startNewRun, 
  recordStudentOperation, 
  validateStep, 
  completeRun, 
  getClassroomHistory,
  getRunOperations,
  getCurrentRun,
  getAllClassrooms
} from './classroom.js';
import { exportClassroomRecord, exportAllRecords, exportPartsListHistory } from './exporter.js';
import fs from 'fs';
import path from 'path';

initDatabase();

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`
发动机拆装课堂管理系统

用法:
  classroom <command> [options]

命令:
  create-parts <name> <creator> [json-file]   创建零件清单
  list-parts <name>                          查看零件清单
  parts-history <name>                       查看零件清单历史版本
  who-changed <name>                         查看谁改过零件清单
  
  create-classroom <id> <name> <teacher> <partsList>  创建课堂
  list-classrooms                                      列出所有课堂
  start-run <classroomId> [partsList]                  开始新一轮运行
  record-op <runId> <json-file>                        记录学生操作
  complete-run <runId> [notes]                         完成本次运行
  history <classroomId>                                查看课堂历史
  
  export <classroomId> <output-file>    导出课堂记录
  export-all <output-dir>               导出所有课堂记录
  export-parts-log <name> <output-file> 导出零件清单变更记录
  
  run <json-file>                       批量运行课堂脚本
  
示例:
  classroom create-parts 潍柴WP10 张师傅 examples/parts-list.json
  classroom create-classroom CLASS-001 "发动机拆装实操" 李老师 潍柴WP10
  classroom record-op 1 examples/operation.json
  classroom export CLASS-001 exports/class-001.txt
`);
}

async function runScript(jsonFile) {
  const script = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  
  console.log(`\n🚀 开始执行课堂脚本: ${jsonFile}`);
  console.log('='.repeat(60) + '\n');
  
  let runId = null;
  
  try {
    if (script.partsList) {
      console.log(`📦 准备零件清单: ${script.partsList.name}`);
      try {
        createPartsList(
          script.partsList.name,
          script.partsList.creator,
          script.partsList.parts,
          script.partsList.steps
        );
        console.log(`✅ 零件清单创建完成\n`);
      } catch (e) {
        if (e instanceof ClassroomError && e.errorCode === 'DUPLICATE_PART') {
          console.log(`ℹ️  零件清单已存在，跳过创建\n`);
        } else {
          throw e;
        }
      }
    }
    
    if (script.classroom) {
      console.log(`🏫 准备课堂: ${script.classroom.name} (${script.classroom.id})`);
      try {
        const result = createClassroom(
          script.classroom.id,
          script.classroom.name,
          script.classroom.teacher,
          script.partsList?.name
        );
        runId = result.runId;
        console.log(`✅ 课堂创建完成，当前运行ID: ${runId}\n`);
      } catch (e) {
        if (e instanceof ClassroomError && e.errorCode === 'CLASSROOM_ALREADY_EXISTS') {
          const result = startNewRun(script.classroom.id, script.partsList?.name);
          runId = result.runId;
          console.log(`✅ 开始新一轮运行，运行ID: ${runId}\n`);
        } else {
          throw e;
        }
      }
    }
    
    if (script.operations && runId) {
      console.log(`📝 开始处理 ${script.operations.length} 条操作记录...\n`);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < script.operations.length; i++) {
        const op = script.operations[i];
        
        process.stdout.write(`  处理操作 ${i + 1}/${script.operations.length}: ${op.studentName} - `);
        
        try {
          if (op.validate && script.partsList) {
            validateStep(runId, op, script.partsList.name);
          }
          
          recordStudentOperation(runId, op);
          console.log(`✅ ${op.action}`);
          successCount++;
        } catch (e) {
          if (e instanceof ClassroomError && e.errorCode === 'STUDENT_MISOPERATION') {
            console.log(`❌ ${op.action}`);
            console.log(`     ${e.message.split('\n')[0]}`);
            errorCount++;
          } else if (e instanceof ClassroomError) {
            console.log(`⚠️  ${e.message.split('\n')[0]}`);
            errorCount++;
          } else {
            console.log(`❌ 失败: ${e.message}`);
            errorCount++;
          }
        }
      }
      
      console.log(`\n📊 操作统计: ${successCount} 成功, ${errorCount} 有问题`);
    }
    
    if (runId && script.complete !== false) {
      console.log(`\n🏁 完成本次运行...`);
      const result = completeRun(runId, script.notes || '');
      console.log(`✅ 运行 ${result.runNumber} 已完成`);
      console.log(`   总操作数: ${result.totalOperations}`);
      console.log(`   错误数: ${result.errorCount}\n`);
    }
    
    if (script.exportTo) {
      console.log(`📤 导出记录到: ${script.exportTo}`);
      const exportResult = exportClassroomRecord(script.classroom.id, script.exportTo);
      console.log(`✅ 已导出 ${exportResult.recordCount} 条运行记录\n`);
    }
    
    console.log('='.repeat(60));
    console.log('🎉 脚本执行完成！');
    
  } catch (e) {
    handleError(e);
    process.exit(1);
  }
}

async function main() {
  switch (command) {
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;
      
    case 'create-parts': {
      const [name, creator, jsonFile] = args.slice(1);
      if (!name || !creator) {
        console.log('用法: classroom create-parts <name> <creator> [json-file]');
        process.exit(1);
      }
      
      let parts = [];
      let steps = [];
      if (jsonFile) {
        const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
        parts = data.parts || [];
        steps = data.steps || [];
      }
      
      const result = createPartsList(name, creator, parts, steps);
      console.log(`✅ 零件清单已创建: ${name} v${result.version}`);
      break;
    }
      
    case 'list-parts': {
      const name = args[1];
      if (!name) {
        console.log('用法: classroom list-parts <name>');
        process.exit(1);
      }
      
      const list = getPartsList(name);
      if (!list) {
        console.log(`❌ 找不到零件清单: ${name}`);
        process.exit(1);
      }
      
      console.log(`\n📦 零件清单: ${list.name} v${list.version}`);
      console.log(`   创建人: ${list.created_by}`);
      if (list.modified_by) {
        console.log(`   最后修改: ${list.modified_by} @ ${list.modified_at}`);
      }
      console.log(`\n零件列表:`);
      list.parts.forEach(p => {
        console.log(`  - ${p.partNumber}: ${p.partName} x${p.quantity}`);
      });
      console.log(``);
      break;
    }
      
    case 'parts-history': {
      const name = args[1];
      const history = getPartsListHistory(name);
      console.log(`\n📜 ${name} 的版本历史:`);
      history.forEach(h => {
        console.log(`  v${h.version}: ${h.createdBy} @ ${h.createdAt}`);
      });
      console.log(``);
      break;
    }
      
    case 'who-changed': {
      const name = args[1];
      const changes = getChangeLog('parts_list');
      console.log(`\n🔄 ${name} 的变更记录:`);
      changes.slice(0, 10).forEach(c => {
        console.log(`  ${c.changedAt}: ${c.changedBy} - ${c.action}`);
      });
      console.log(``);
      break;
    }
      
    case 'create-classroom': {
      const [id, name, teacher, partsList] = args.slice(1);
      const result = createClassroom(id, name, teacher, partsList);
      console.log(`✅ 课堂已创建: ${name}`);
      console.log(`   当前运行ID: ${result.runId}`);
      break;
    }
      
    case 'list-classrooms': {
      const classrooms = getAllClassrooms();
      console.log(`\n🏫 所有课堂:`);
      classrooms.forEach(c => {
        console.log(`  ${c.classroom_id}: ${c.name} - ${c.teacher}`);
        console.log(`    运行${c.total_runs}次，最新: #${c.latest_run}`);
      });
      console.log(``);
      break;
    }
      
    case 'start-run': {
      const [classroomId, partsList] = args.slice(1);
      const result = startNewRun(classroomId, partsList);
      console.log(`✅ 新一轮运行已开始: #${result.runNumber}`);
      console.log(`   运行ID: ${result.runId}`);
      break;
    }
      
    case 'record-op': {
      const [runId, jsonFile] = args.slice(1);
      const op = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      recordStudentOperation(parseInt(runId), op);
      console.log(`✅ 操作已记录`);
      break;
    }
      
    case 'complete-run': {
      const [runId, notes] = args.slice(1);
      const result = completeRun(parseInt(runId), notes || '');
      console.log(`✅ 运行 #${result.runNumber} 已完成`);
      break;
    }
      
    case 'history': {
      const classroomId = args[1];
      const history = getClassroomHistory(classroomId);
      console.log(`\n📜 课堂 ${classroomId} 历史记录:`);
      history.forEach(h => {
        console.log(`  运行 #${h.runNumber}: ${h.status}`);
        console.log(`    ${h.startedAt} - ${h.completedAt || '进行中'}`);
        console.log(`    操作: ${h.totalOperations}, 错误: ${h.errorCount}`);
      });
      console.log(``);
      break;
    }
      
    case 'export': {
      const [classroomId, outputFile] = args.slice(1);
      const result = exportClassroomRecord(classroomId, outputFile);
      console.log(`✅ 已导出 ${result.recordCount} 条记录到: ${outputFile}`);
      break;
    }
      
    case 'export-all': {
      const outputDir = args[1];
      const results = exportAllRecords(outputDir);
      console.log(`✅ 已导出 ${results.length} 个课堂记录到: ${outputDir}`);
      break;
    }
      
    case 'export-parts-log': {
      const [name, outputFile] = args.slice(1);
      const result = exportPartsListHistory(name, outputFile);
      console.log(`✅ 已导出 ${result.versionCount} 个版本到: ${outputFile}`);
      break;
    }
      
    case 'run': {
      const jsonFile = args[1];
      await runScript(jsonFile);
      break;
    }
      
    default:
      if (command) {
        console.log(`未知命令: ${command}`);
      }
      printHelp();
      process.exit(1);
  }
}

main().catch(handleError);
