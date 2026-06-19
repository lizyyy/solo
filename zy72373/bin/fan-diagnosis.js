#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(os.homedir(), '.fan-diagnosis');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(TASKS_FILE)) {
    fs.writeFileSync(TASKS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(LOGS_FILE)) {
    fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2));
  }
}

function readTasks() {
  ensureDataDir();
  return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
}

function writeTasks(tasks) {
  ensureDataDir();
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

function readLogs() {
  ensureDataDir();
  return JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
}

function writeLogs(logs) {
  ensureDataDir();
  fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

function addLog(taskId, action, details, operator) {
  const logs = readLogs();
  logs.push({
    id: `log-${generateId()}`,
    diagnosisId: taskId,
    action,
    details,
    operator,
    timestamp: new Date().toISOString(),
  });
  writeLogs(logs);
}

// ============ 复用业务逻辑 ============
class TemperatureUnitDetector {
  static detectMixing(data) {
    const celsiusRows = data.filter(d => d.temperatureUnit === 'C');
    const kelvinRows = data.filter(d => d.temperatureUnit === 'K');
    const hasMixing = celsiusRows.length > 0 && kelvinRows.length > 0;
    return {
      hasMixing,
      celsiusCount: celsiusRows.length,
      kelvinCount: kelvinRows.length,
      affectedRows: hasMixing ? kelvinRows.map(r => r.id) : [],
    };
  }

  static markForReview(data) {
    const mixingInfo = this.detectMixing(data);
    if (!mixingInfo.hasMixing) return data;
    return data.map(row => ({
      ...row,
      needsReview: mixingInfo.affectedRows.includes(row.id),
    }));
  }
}

function buildMissingMaterialTriggers(task) {
  const triggers = [];
  if (!task.photos || task.photos.length === 0) {
    triggers.push({
      material: '工况照片',
      sourceType: 'photo',
      sourceIds: [],
      sourceDescriptions: ['尚未补录任何工况照片'],
    });
  }
  const reviewSensors = (task.sensorData || []).filter(d => d.needsReview);
  if (reviewSensors.length > 0) {
    triggers.push({
      material: '温度单位人工复核确认',
      sourceType: 'sensor',
      sourceIds: reviewSensors.map(s => s.id),
      sourceDescriptions: reviewSensors.map(s => `传感器 ${s.sensorNo} (${s.temperature}${s.temperatureUnit === 'K' ? 'K' : '°C'})待老唐复核`),
    });
  }
  const photos = task.photos || [];
  if (photos.length > 0 && (task.report?.missingMaterials || []).includes('照片内容人工确认')) {
    triggers.push({
      material: '照片内容人工确认',
      sourceType: 'photo',
      sourceIds: photos.map(p => p.id),
      sourceDescriptions: photos.map(p => `照片 ${p.filename}: ${p.description} 待老唐确认与数据对应`),
    });
  }
  return triggers;
}

function buildSnapshot(task, problemStatement, missingMaterials, nextHandler) {
  return {
    problemStatement,
    missingMaterials,
    nextAction: missingMaterials.length > 0 ? 'contact_laotang' : 'contact_coach',
    nextHandler,
    hasUnitMixing: task.hasUnitMixing,
    photoCount: task.photos.length,
    correctionCount: task.corrections.length,
    sensorDataSnapshots: task.sensorData.map(d => ({
      sensorNo: d.sensorNo,
      temperature: d.temperature,
      temperatureUnit: d.temperatureUnit,
      needsReview: !!d.needsReview,
    })),
  };
}

class ReportAutoUpdater {
  static generateInitialReport(task) {
    const problemStatement = task.hasUnitMixing
      ? '传感器数据存在摄氏度(℃)和开尔文(K)混用情况，不能直接照抄传感器编号里的结论。请训练教练老唐复核后统一单位再进行分析。'
      : '初始诊断完成，请检查数据完整性后进行下一步操作。';
    const missingMaterials = [];
    if (task.photos.length === 0) missingMaterials.push('工况照片');
    if (task.hasUnitMixing) missingMaterials.push('温度单位人工复核确认');
    const now = new Date().toISOString();
    const snapshot = buildSnapshot(task, problemStatement, missingMaterials, '训练教练老唐');
    return {
      id: `report-${task.id}`,
      diagnosisId: task.id,
      problemStatement,
      missingMaterials,
      nextAction: 'contact_laotang',
      nextHandler: '训练教练老唐',
      generatedAt: now,
      updatedAt: now,
      version: 1,
      missingMaterialTriggers: buildMissingMaterialTriggers(task),
      versionHistory: [{
        version: 1,
        updatedAt: now,
        changes: ['初始报告生成', task.hasUnitMixing ? '检测到温度单位混用，标记为待老唐复核' : '数据导入完成'],
        snapshot,
        triggeredBy: task.hasUnitMixing ? '系统检测-温度单位混用' : '数据导入完成',
      }],
    };
  }

  static onPhotoAdded(task) {
    if (!task.report) return this.generateInitialReport(task);
    const now = new Date().toISOString();
    const latestPhotos = task.photos.slice(-1);
    const changes = [
      `补录工况照片 ${latestPhotos.map(p => p.filename).join('、')}`,
      `当前共 ${task.photos.length} 张照片`,
    ];
    let missingMaterials = [...task.report.missingMaterials];
    if (task.photos.length > 0 && missingMaterials.includes('工况照片')) {
      missingMaterials = missingMaterials.filter(m => m !== '工况照片');
    }
    if (task.photos.length > 0 && !missingMaterials.includes('照片内容人工确认')) {
      missingMaterials.push('照片内容人工确认');
    }
    const stillHasMixing = task.sensorData.some(d => d.needsReview);
    const problemStatement = stillHasMixing
      ? '工况照片已补录，传感器数据仍存在摄氏度(℃)和开尔文(K)混用情况。请训练教练老唐结合照片复核单位问题。'
      : '工况照片已补录，请训练教练确认照片与数据一致性。';
    const snapshot = buildSnapshot(task, problemStatement, missingMaterials, '训练教练老唐');
    const newVersion = {
      version: task.report.version + 1,
      updatedAt: now,
      changes,
      snapshot,
      triggeredBy: `训练教练老唐补看照片: ${latestPhotos.map(p => p.filename).join(',')}`,
    };
    return {
      ...task.report,
      problemStatement,
      missingMaterials,
      missingMaterialTriggers: buildMissingMaterialTriggers(task),
      updatedAt: now,
      version: newVersion.version,
      versionHistory: [...task.report.versionHistory, newVersion],
    };
  }

  static onCorrectionMade(task, correctedSensorNo) {
    if (!task.report) return this.generateInitialReport(task);
    const now = new Date().toISOString();
    const latestCorrection = task.corrections[task.corrections.length - 1];
    const changes = [
      `人工修正传感器 ${correctedSensorNo}: ${latestCorrection?.oldValue || ''} → ${latestCorrection?.newValue || ''}`,
      `修正原因: ${latestCorrection?.reason || '未注明'}`,
    ];
    const stillHasMixingNeedsReview = task.sensorData.some(d => d.needsReview);
    let missingMaterials = [...task.report.missingMaterials];
    if (!stillHasMixingNeedsReview && missingMaterials.includes('温度单位人工复核确认')) {
      missingMaterials = missingMaterials.filter(m => m !== '温度单位人工复核确认');
    }
    const stillAnyPhotoReviewPending = missingMaterials.includes('照片内容人工确认');
    const allDone = missingMaterials.length === 0;
    const problemStatement = stillHasMixingNeedsReview
      ? `已修正 ${correctedSensorNo}，仍有传感器待老唐复核。请继续处理剩余单位混用数据。`
      : allDone
        ? '温度单位已由训练教练老唐复核确认，照片内容已核对，所有材料齐全，可以继续进行平衡诊断分析。'
        : stillAnyPhotoReviewPending
          ? '温度单位已由训练教练老唐复核确认，数据单位已统一。请进一步确认照片内容与数据的一致性。'
          : '温度单位已由训练教练老唐复核确认，数据单位已统一。';
    const nextHandler = stillHasMixingNeedsReview ? '训练教练老唐' : allDone ? '训练教练' : '训练教练老唐';
    const snapshot = buildSnapshot(task, problemStatement, missingMaterials, nextHandler);
    const newVersion = {
      version: task.report.version + 1,
      updatedAt: now,
      changes,
      snapshot,
      triggeredBy: `训练教练老唐人工修正: ${correctedSensorNo}`,
    };
    return {
      ...task.report,
      problemStatement,
      missingMaterials,
      missingMaterialTriggers: buildMissingMaterialTriggers(task),
      nextAction: snapshot.nextAction,
      nextHandler,
      updatedAt: now,
      version: newVersion.version,
      versionHistory: [...task.report.versionHistory, newVersion],
    };
  }

  static onRerunComplete(task) {
    if (!task.report) return this.generateInitialReport(task);
    const now = new Date().toISOString();
    const allSensorUnitC = task.sensorData.every(d => d.temperatureUnit === 'C');
    const hasPhotoConfirm = !task.report.missingMaterials.includes('照片内容人工确认');
    const stillMissing = [];
    if (task.photos.length === 0) stillMissing.push('工况照片');
    if (!allSensorUnitC) stillMissing.push('温度单位人工复核确认');
    if (task.photos.length > 0 && !hasPhotoConfirm) stillMissing.push('照片内容人工确认');
    let problemStatement = task.report.problemStatement;
    if (stillMissing.length === 0) {
      problemStatement = '诊断重跑完成，所有数据已统一、照片已核对，风扇叶片平衡诊断流程闭环。请训练教练进行最终平衡分析结论判定。';
    }
    const nextHandler = stillMissing.length > 0 ? '训练教练老唐' : '训练教练';
    const snapshot = buildSnapshot(task, problemStatement, stillMissing, nextHandler);
    const changes = [
      '重跑诊断分析完成',
      `当前状态 - 温度统一: ${allSensorUnitC ? '是' : '否'}，照片齐全: ${task.photos.length > 0 ? '是' : '否'}`,
    ];
    const newVersion = {
      version: task.report.version + 1,
      updatedAt: now,
      changes,
      snapshot,
      triggeredBy: '训练教练老唐重跑诊断',
    };
    return {
      ...task.report,
      problemStatement,
      missingMaterials: stillMissing,
      missingMaterialTriggers: buildMissingMaterialTriggers(task),
      nextAction: snapshot.nextAction,
      nextHandler,
      updatedAt: now,
      version: newVersion.version,
      versionHistory: [...task.report.versionHistory, newVersion],
    };
  }
}

// ============ CLI 命令处理 ============

function printHelp() {
  console.log(`fan-diagnosis - 风扇叶片平衡诊断工具

Usage:
  fan-diagnosis <command> [options]

Commands:
  create          创建新的诊断任务
  import          导入传感器数据
  detect-mixing   检测温度单位混用
  add-photo       补录工况照片
  correct         人工修正数据
  rerun           重跑诊断分析
  report          生成交接报告
  replay          复盘历史任务
  trace-version   追溯版本变化
  list            列出所有任务
  show            显示任务详情

Examples:
  fan-diagnosis create --title "风机检测" --created-by "老唐"
  fan-diagnosis import --task-id demo-001 --file sensor_data.csv --detect-unit-mixing
  fan-diagnosis detect-mixing --task-id demo-001 --report
  fan-diagnosis correct --task-id demo-001 --sensor FAN-001-B --field temperature --from "358K" --to "85°C" --operator "老唐" --reason "开尔文转摄氏度"
  fan-diagnosis add-photo --task-id demo-001 --file "photo.jpg" --description "叶片磨损" --upload-by "老唐"
  fan-diagnosis rerun --task-id demo-001 --check-uniformity
  fan-diagnosis report --task-id demo-001 --version 5 --output 交接报告.pdf
  fan-diagnosis replay --task-id demo-001 --full
  fan-diagnosis trace-version --task-id demo-001 --version 2`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].substring(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
      args[key] = value;
      if (value !== true) i++;
    }
  }
  return args;
}

function cmdCreate(args) {
  const tasks = readTasks();
  const taskId = args['task-id'] || `task-${generateId()}`;
  const existing = tasks.find(t => t.id === taskId);
  if (existing) {
    console.log(`✗ 任务ID ${taskId} 已存在`);
    process.exit(1);
  }
  const newTask = {
    id: taskId,
    title: args.title || '未命名诊断任务',
    status: 'importing',
    currentStep: 1,
    sensorData: [],
    photos: [],
    corrections: [],
    report: null,
    hasUnitMixing: false,
    unitMixingInfo: null,
    createdAt: new Date().toISOString(),
    createdBy: args['created-by'] || '未指定',
  };
  tasks.push(newTask);
  writeTasks(tasks);
  addLog(taskId, '创建诊断任务', { title: newTask.title }, newTask.createdBy);
  console.log(`✓ 已创建诊断任务`);
  console.log(`  任务ID: ${taskId}`);
  console.log(`  标题: ${newTask.title}`);
  console.log(`  创建人: ${newTask.createdBy}`);
}

function cmdImport(args) {
  const taskId = args['task-id'];
  if (!taskId) {
    console.log('✗ 请指定 --task-id');
    process.exit(1);
  }
  const tasks = readTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) {
    console.log(`✗ 未找到任务 ${taskId}`);
    process.exit(1);
  }

  let sensorData = [];
  if (args.file && args.file !== true) {
    const filePath = path.resolve(args.file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((h, idx) => { row[h] = values[idx]; });
        if (row.sensorNo) {
          const rawUnit = (row.unit || row['单位'] || 'C').toString().toUpperCase().trim();
          const temperatureUnit = rawUnit === 'K' ? 'K' : 'C';
          sensorData.push({
            id: `imported-${i - 1}`,
            sensorNo: row.sensorNo || row['传感器编号'] || '',
            timestamp: row.timestamp || row['时间'] || new Date().toISOString(),
            temperature: parseFloat(row.temperature || row['温度'] || 0),
            temperatureUnit,
            vibration: parseFloat(row.vibration || row['振动'] || 0),
            position: row.position || row['位置'] || '',
          });
        }
      }
    } else {
      console.log(`✗ 找不到文件 ${filePath}，使用演示数据`);
    }
  }

  if (sensorData.length === 0) {
    sensorData = [
      { id: 's1', sensorNo: 'FAN-REAL-A', timestamp: new Date().toISOString(), temperature: 85, temperatureUnit: 'C', vibration: 2.3, position: '叶片A' },
      { id: 's2', sensorNo: 'FAN-REAL-B', timestamp: new Date().toISOString(), temperature: 358, temperatureUnit: 'K', vibration: 2.1, position: '叶片B' },
      { id: 's3', sensorNo: 'FAN-REAL-C', timestamp: new Date().toISOString(), temperature: 82, temperatureUnit: 'C', vibration: 2.5, position: '叶片C' },
      { id: 's4', sensorNo: 'FAN-REAL-D', timestamp: new Date().toISOString(), temperature: 355, temperatureUnit: 'K', vibration: 2.2, position: '叶片D' },
    ];
  }

  const markedData = TemperatureUnitDetector.markForReview(sensorData);
  const mixingInfo = TemperatureUnitDetector.detectMixing(markedData);
  const updatedTask = {
    ...task,
    sensorData: markedData,
    hasUnitMixing: mixingInfo.hasMixing,
    unitMixingInfo: mixingInfo,
    status: 'pending_review',
    currentStep: 1,
  };
  updatedTask.report = ReportAutoUpdater.generateInitialReport(updatedTask);

  const updatedTasks = tasks.map(t => t.id === taskId ? updatedTask : t);
  writeTasks(updatedTasks);

  addLog(taskId, '导入传感器数据', { count: sensorData.length, hasMixing: mixingInfo.hasMixing }, '新人');
  if (mixingInfo.hasMixing) {
    addLog(taskId, '检测到温度单位混用', { celsiusCount: mixingInfo.celsiusCount, kelvinCount: mixingInfo.kelvinCount }, '系统');
  }

  console.log(`✓ 已导入 ${sensorData.length} 条传感器数据`);
  console.log(`  温度单位混用: ${mixingInfo.hasMixing ? '是' : '否'}`);
  if (mixingInfo.hasMixing) {
    console.log(`    摄氏度: ${mixingInfo.celsiusCount}条, 开尔文: ${mixingInfo.kelvinCount}条`);
    console.log(`    待复核传感器: ${markedData.filter(d => d.needsReview).map(d => d.sensorNo).join(', ')}`);
  }
  console.log(`  报告版本: v${updatedTask.report.version}`);
  console.log(`  缺失材料: ${updatedTask.report.missingMaterials.join(', ')}`);
}

function cmdDetectMixing(args) {
  const taskId = args['task-id'];
  if (!taskId) { console.log('✗ 请指定 --task-id'); process.exit(1); }
  const tasks = readTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) { console.log(`✗ 未找到任务 ${taskId}`); process.exit(1); }

  const mixingInfo = TemperatureUnitDetector.detectMixing(task.sensorData);
  console.log(`温度单位混用检测结果:`);
  console.log(`  有混用: ${mixingInfo.hasMixing ? '是' : '否'}`);
  console.log(`  摄氏度: ${mixingInfo.celsiusCount}条`);
  console.log(`  开尔文: ${mixingInfo.kelvinCount}条`);
  if (mixingInfo.hasMixing) {
    const affected = task.sensorData.filter(d => mixingInfo.affectedRows.includes(d.id));
    console.log(`  受影响传感器:`);
    affected.forEach(d => console.log(`    ${d.sensorNo}: ${d.temperature}K`));
  }
}

function cmdAddPhoto(args) {
  const taskId = args['task-id'];
  if (!taskId) { console.log('✗ 请指定 --task-id'); process.exit(1); }
  const tasks = readTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) { console.log(`✗ 未找到任务 ${taskId}`); process.exit(1); }

  const newPhoto = {
    id: `photo-${generateId()}`,
    diagnosisId: taskId,
    url: args.file || '',
    thumbnail: args.file || '',
    filename: args.file || '未命名照片.jpg',
    uploadTime: new Date().toISOString(),
    uploadBy: args['upload-by'] || '未指定',
    description: args.description || '',
    nodeIndex: task.photos.length + 1,
  };

  const updatedTask = {
    ...task,
    photos: [...task.photos, newPhoto],
    status: 'photo_added',
    currentStep: 2,
  };
  updatedTask.report = ReportAutoUpdater.onPhotoAdded(updatedTask);

  const updatedTasks = tasks.map(t => t.id === taskId ? updatedTask : t);
  writeTasks(updatedTasks);
  addLog(taskId, '补录工况照片', { filename: newPhoto.filename, description: newPhoto.description }, newPhoto.uploadBy);

  console.log(`✓ 已补录工况照片`);
  console.log(`  文件名: ${newPhoto.filename}`);
  console.log(`  上传人: ${newPhoto.uploadBy}`);
  console.log(`  描述: ${newPhoto.description}`);
  console.log(`  报告版本: v${updatedTask.report.version}`);
  console.log(`  缺失材料: ${updatedTask.report.missingMaterials.join(', ')}`);
}

function cmdCorrect(args) {
  const taskId = args['task-id'];
  if (!taskId) { console.log('✗ 请指定 --task-id'); process.exit(1); }
  const sensorNo = args.sensor;
  if (!sensorNo) { console.log('✗ 请指定 --sensor'); process.exit(1); }

  const tasks = readTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) { console.log(`✗ 未找到任务 ${taskId}`); process.exit(1); }

  const targetSensor = task.sensorData.find(s => s.sensorNo === sensorNo);
  if (!targetSensor) { console.log(`✗ 未找到传感器 ${sensorNo}`); process.exit(1); }

  let parsedNewTemp = targetSensor.temperature;
  let parsedNewUnit = targetSensor.temperatureUnit;
  if (args.field === 'temperature') {
    const match = args.to && args.to.match(/^([\d.]+)(°C|K)$/);
    if (match) {
      parsedNewTemp = parseFloat(match[1]);
      parsedNewUnit = match[2] === '°C' ? 'C' : 'K';
    }
  }

  const updatedSensorData = task.sensorData.map(data => {
    if (data.id === targetSensor.id) {
      return { ...data, needsReview: false, temperature: parsedNewTemp, temperatureUnit: parsedNewUnit };
    }
    return data;
  });

  const stillHasMixing = updatedSensorData.some(d => d.needsReview);
  const stillAnyKelvinAndCelsius =
    updatedSensorData.some(d => d.temperatureUnit === 'C') &&
    updatedSensorData.some(d => d.temperatureUnit === 'K');

  const newCorrection = {
    id: `correction-${generateId()}`,
    diagnosisId: taskId,
    sensorNo: targetSensor.sensorNo,
    sensorId: targetSensor.id,
    field: args.field || 'temperature',
    oldValue: args.from || '',
    newValue: args.to || '',
    oldUnit: targetSensor.temperatureUnit,
    newUnit: parsedNewUnit,
    reason: args.reason || '未注明',
    correctedBy: args.operator || '未指定',
    correctedAt: new Date().toISOString(),
  };

  const updatedTask = {
    ...task,
    sensorData: updatedSensorData,
    corrections: [...task.corrections, newCorrection],
    status: 'reviewing',
    hasUnitMixing: stillAnyKelvinAndCelsius || stillHasMixing,
    unitMixingInfo: stillAnyKelvinAndCelsius ? TemperatureUnitDetector.detectMixing(updatedSensorData) : null,
  };
  updatedTask.report = ReportAutoUpdater.onCorrectionMade(updatedTask, sensorNo);

  const updatedTasks = tasks.map(t => t.id === taskId ? updatedTask : t);
  writeTasks(updatedTasks);

  addLog(taskId, '人工修正数据', {
    sensorNo: targetSensor.sensorNo,
    sensorId: targetSensor.id,
    field: newCorrection.field,
    oldValue: newCorrection.oldValue,
    newValue: newCorrection.newValue,
    reason: newCorrection.reason,
  }, newCorrection.correctedBy);

  console.log(`✓ 已人工修正传感器 ${sensorNo}`);
  console.log(`  ${args.from || ''} → ${args.to || ''}`);
  console.log(`  修正人: ${newCorrection.correctedBy}`);
  console.log(`  原因: ${newCorrection.reason}`);
  console.log(`  报告版本: v${updatedTask.report.version}`);
  console.log(`  缺失材料: ${updatedTask.report.missingMaterials.join(', ')}`);
  console.log(`  剩余待复核: ${updatedSensorData.filter(d => d.needsReview).map(d => d.sensorNo).join(', ') || '无'}`);
}

function cmdRerun(args) {
  const taskId = args['task-id'];
  if (!taskId) { console.log('✗ 请指定 --task-id'); process.exit(1); }
  const tasks = readTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) { console.log(`✗ 未找到任务 ${taskId}`); process.exit(1); }

  const updatedTask = { ...task, status: 'completed', currentStep: 3 };
  updatedTask.report = ReportAutoUpdater.onRerunComplete(updatedTask);

  const updatedTasks = tasks.map(t => t.id === taskId ? updatedTask : t);
  writeTasks(updatedTasks);

  addLog(taskId, '重跑诊断', { status: 'success' }, '训练教练老唐');
  addLog(taskId, '更新交接报告', { version: updatedTask.report.version }, '系统');

  console.log(`✓ 重跑诊断完成`);
  console.log(`  报告版本: v${updatedTask.report.version}`);
  console.log(`  缺失材料: ${updatedTask.report.missingMaterials.join(', ') || '全部齐全！'}`);
  console.log(`  对接人: ${updatedTask.report.nextHandler}`);
  console.log(`  问题说明: ${updatedTask.report.problemStatement}`);
}

function cmdReport(args) {
  const taskId = args['task-id'];
  if (!taskId) { console.log('✗ 请指定 --task-id'); process.exit(1); }
  const tasks = readTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) { console.log(`✗ 未找到任务 ${taskId}`); process.exit(1); }
  if (!task.report) {
    console.log('✗ 该任务尚未生成报告，请先导入数据');
    process.exit(1);
  }

  const version = args.version ? parseInt(args.version) : task.report.version;
  const reportVersion = task.report.versionHistory.find(v => v.version === version);
  if (!reportVersion) {
    console.log(`✗ 找不到版本 v${version}`);
    process.exit(1);
  }

  console.log(`\n=== 交接报告 v${version} ===`);
  console.log(`任务: ${task.title}`);
  console.log(`生成时间: ${reportVersion.updatedAt}`);
  console.log(`触发: ${reportVersion.triggeredBy}`);
  console.log(`\n问题说明:`);
  console.log(`  ${reportVersion.snapshot.problemStatement}`);
  console.log(`\n缺失材料: ${reportVersion.snapshot.missingMaterials.join(', ') || '无'}`);
  console.log(`下一步对接人: ${reportVersion.snapshot.nextHandler}`);
  console.log(`\n变更记录:`);
  reportVersion.changes.forEach(c => console.log(`  - ${c}`));
  console.log(`\n传感器数据快照:`);
  reportVersion.snapshot.sensorDataSnapshots.forEach(s => {
    const unit = s.temperatureUnit === 'K' ? 'K' : '°C';
    const tag = s.needsReview ? ' ⚠️待复核' : '';
    console.log(`  ${s.sensorNo}: ${s.temperature}${unit}${tag}`);
  });

  const versionTriggers = buildMissingMaterialTriggers({
    ...task,
    sensorData: reportVersion.snapshot.sensorDataSnapshots.map(s => ({
      ...s,
      temperatureUnit: s.temperatureUnit,
    })),
    photos: task.photos.slice(0, reportVersion.snapshot.photoCount),
    corrections: task.corrections.slice(0, reportVersion.snapshot.correctionCount),
    report: {
      ...task.report,
      missingMaterials: reportVersion.snapshot.missingMaterials,
    },
  });
  if (versionTriggers && versionTriggers.length > 0) {
    console.log(`\n缺失材料触发源追溯:`);
    versionTriggers.forEach(t => {
      console.log(`  ${t.material} (${t.sourceType}):`);
      t.sourceDescriptions.forEach(d => console.log(`    - ${d}`));
    });
  }

  console.log(`\n历史版本: ${task.report.versionHistory.map(v => 'v' + v.version).join(', ')}`);

  if (args.output && args.output !== true) {
    const outputPath = path.resolve(args.output);
    
    const correctionsForVersion = task.corrections.slice(0, reportVersion.snapshot.correctionCount);
    const photosForVersion = task.photos.slice(0, reportVersion.snapshot.photoCount);
    
    const reportContent = `
风扇叶片平衡诊断 - 交接报告 v${version}
=====================================
任务: ${task.title}
任务ID: ${task.id}
创建人: ${task.createdBy}
生成时间: ${new Date(reportVersion.updatedAt).toLocaleString('zh-CN')}
触发: ${reportVersion.triggeredBy}

【问题说明】
${reportVersion.snapshot.problemStatement}

【缺失材料】
${reportVersion.snapshot.missingMaterials.length > 0 ? reportVersion.snapshot.missingMaterials.join('、') : '无（全部齐全）'}

【缺失材料触发源追溯】
${versionTriggers && versionTriggers.length > 0 
  ? versionTriggers.map(t => `- ${t.material} (${t.sourceType}):\n${t.sourceDescriptions.map(d => `  * ${d}`).join('\n')}`).join('\n')
  : '无'}

【下一步对接人】
${reportVersion.snapshot.nextHandler}

【温度单位人工复核确认记录】
${correctionsForVersion.length > 0
  ? correctionsForVersion.map(c => `- ${c.sensorNo}: ${c.oldValue} → ${c.newValue}\n  修正人: ${c.correctedBy}\n  时间: ${new Date(c.correctedAt).toLocaleString('zh-CN')}\n  原因: ${c.reason}`).join('\n\n')
  : '无修正记录'}

【变更记录】
${reportVersion.changes.map(c => '- ' + c).join('\n')}

【当前传感器数据】
${reportVersion.snapshot.sensorDataSnapshots.map(s => {
  const unit = s.temperatureUnit === 'K' ? 'K' : '°C';
  return `- ${s.sensorNo} (${task.sensorData.find(d => d.sensorNo === s.sensorNo)?.position || ''}): ${s.temperature}${unit}${s.needsReview ? ' (待复核)' : ''}`;
}).join('\n')}

【工况照片】
${photosForVersion.length > 0
  ? photosForVersion.map(p => `- ${p.filename}\n  上传人: ${p.uploadBy}\n  描述: ${p.description}\n  时间: ${new Date(p.uploadTime).toLocaleString('zh-CN')}`).join('\n\n')
  : '无照片'}

【版本历史追溯】
${task.report.versionHistory.map(v => `v${v.version} (${new Date(v.updatedAt).toLocaleString('zh-CN')})\n  触发: ${v.triggeredBy}\n  变更: ${v.changes.join('; ')}\n  缺失材料: ${v.snapshot.missingMaterials.join(', ') || '无'}\n  对接人: ${v.snapshot.nextHandler}`).join('\n\n')}

---
报告由 fan-diagnosis 系统自动生成
CLI 复现命令: fan-diagnosis report --task-id ${task.id} --version ${version} --output 交接报告_v${version}.txt
`.trim();
    fs.writeFileSync(outputPath, reportContent, 'utf-8');
    console.log(`\n✓ 报告已导出到 ${outputPath}`);
  }
}

function cmdReplay(args) {
  const taskId = args['task-id'];
  if (!taskId) { console.log('✗ 请指定 --task-id'); process.exit(1); }
  const tasks = readTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) { console.log(`✗ 未找到任务 ${taskId}`); process.exit(1); }

  const logs = readLogs().filter(l => l.diagnosisId === taskId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  console.log(`\n=== 复盘: ${task.title} ===\n`);
  console.log(`任务ID: ${task.id}`);
  console.log(`创建人: ${task.createdBy}\n`);

  logs.forEach((log, idx) => {
    const time = new Date(log.timestamp).toLocaleString('zh-CN');
    console.log(`[${idx + 1}] ${time} | ${log.operator} | ${log.action}`);
    if (Object.keys(log.details).length > 0) {
      console.log(`    ${JSON.stringify(log.details)}`);
    }
  });

  if (args.full) {
    console.log(`\n=== 完整状态复盘 ===`);
    console.log(`最终状态: ${task.status}`);
    console.log(`传感器: ${task.sensorData.map(d => d.sensorNo).join(', ')}`);
    console.log(`照片: ${task.photos.length}张`);
    console.log(`修正: ${task.corrections.length}次`);
    if (task.report) {
      console.log(`报告版本: v${task.report.version}`);
      console.log(`最终缺失材料: ${task.report.missingMaterials.join(', ') || '无'}`);
      console.log(`最终对接人: ${task.report.nextHandler}`);
    }
  }
}

function cmdTraceVersion(args) {
  const taskId = args['task-id'];
  if (!taskId) { console.log('✗ 请指定 --task-id'); process.exit(1); }
  const tasks = readTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task || !task.report) { console.log(`✗ 未找到任务或报告`); process.exit(1); }

  const version = args.version ? parseInt(args.version) : task.report.version;
  const v = task.report.versionHistory.find(x => x.version === version);
  if (!v) { console.log(`✗ 找不到版本 v${version}`); process.exit(1); }

  const prevV = task.report.versionHistory.find(x => x.version === version - 1);

  console.log(`\n=== 版本追溯 v${version} ===`);
  console.log(`触发: ${v.triggeredBy}`);
  console.log(`时间: ${v.updatedAt}`);
  console.log(`\n变更:`);
  v.changes.forEach(c => console.log(`  - ${c}`));

  if (prevV) {
    console.log(`\n与上一版本(v${version - 1})对比:`);
    const added = v.snapshot.missingMaterials.filter(m => !prevV.snapshot.missingMaterials.includes(m));
    const removed = prevV.snapshot.missingMaterials.filter(m => !v.snapshot.missingMaterials.includes(m));
    if (added.length) console.log(`  新增缺失材料: ${added.join(', ')}`);
    if (removed.length) console.log(`  移除缺失材料: ${removed.join(', ')}`);
    if (prevV.snapshot.nextHandler !== v.snapshot.nextHandler) {
      console.log(`  对接人变更: ${prevV.snapshot.nextHandler} → ${v.snapshot.nextHandler}`);
    }
    console.log(`\n改前状态 (v${version - 1}):`);
    prevV.snapshot.sensorDataSnapshots.forEach(s => {
      const unit = s.temperatureUnit === 'K' ? 'K' : '°C';
      console.log(`  ${s.sensorNo}: ${s.temperature}${unit}${s.needsReview ? ' ⚠️' : ''}`);
    });
  }

  console.log(`\n改后状态 (v${version}):`);
  v.snapshot.sensorDataSnapshots.forEach(s => {
    const unit = s.temperatureUnit === 'K' ? 'K' : '°C';
    console.log(`  ${s.sensorNo}: ${s.temperature}${unit}${s.needsReview ? ' ⚠️' : ''}`);
  });
}

function cmdList() {
  const tasks = readTasks();
  console.log(`\n=== 诊断任务列表 (共${tasks.length}个) ===\n`);
  tasks.forEach((t, idx) => {
    const statusMap = {
      importing: '📥 导入中',
      pending_review: '🔍 待复核',
      photo_added: '📷 已补照片',
      reviewing: '✏️ 复核中',
      completed: '✅ 已完成',
    };
    const v = t.report ? `v${t.report.version}` : '无';
    console.log(`[${idx + 1}] ${t.id} | ${t.title}`);
    console.log(`    状态: ${statusMap[t.status] || t.status} | 报告: ${v} | 创建人: ${t.createdBy}`);
  });
  console.log('');
}

function cmdShow(args) {
  const taskId = args['task-id'];
  if (!taskId) { console.log('✗ 请指定 --task-id'); process.exit(1); }
  const tasks = readTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) { console.log(`✗ 未找到任务 ${taskId}`); process.exit(1); }

  console.log(`\n=== 任务详情: ${task.title} ===`);
  console.log(`ID: ${task.id}`);
  console.log(`状态: ${task.status}`);
  console.log(`创建人: ${task.createdBy}`);
  console.log(`创建时间: ${task.createdAt}`);
  console.log(`\n传感器数据:`);
  task.sensorData.forEach(s => {
    const unit = s.temperatureUnit === 'K' ? 'K' : '°C';
    const tag = s.needsReview ? ' ⚠️待复核' : '';
    console.log(`  ${s.sensorNo}: ${s.temperature}${unit}${tag} (${s.position})`);
  });
  console.log(`\n照片 (${task.photos.length}张):`);
  task.photos.forEach(p => console.log(`  - ${p.filename} (${p.uploadBy}): ${p.description}`));
  console.log(`\n修正记录 (${task.corrections.length}次):`);
  task.corrections.forEach(c => console.log(`  - ${c.sensorNo}: ${c.oldValue} → ${c.newValue} by ${c.correctedBy}`));
  if (task.report) {
    console.log(`\n当前报告 (v${task.report.version}):`);
    console.log(`  缺失材料: ${task.report.missingMaterials.join(', ') || '无'}`);
    console.log(`  对接人: ${task.report.nextHandler}`);
  }
  console.log('');
}

// ============ 主入口 ============
const [command, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);

if (!command || command === 'help' || command === '--help' || command === '-h') {
  printHelp();
  process.exit(0);
}

ensureDataDir();

switch (command) {
  case 'create': cmdCreate(args); break;
  case 'import': cmdImport(args); break;
  case 'detect-mixing': cmdDetectMixing(args); break;
  case 'add-photo': cmdAddPhoto(args); break;
  case 'correct': cmdCorrect(args); break;
  case 'rerun': cmdRerun(args); break;
  case 'report': cmdReport(args); break;
  case 'replay': cmdReplay(args); break;
  case 'trace-version': cmdTraceVersion(args); break;
  case 'list': cmdList(); break;
  case 'show': cmdShow(args); break;
  default:
    console.log(`✗ 未知命令: ${command}`);
    printHelp();
    process.exit(1);
}
