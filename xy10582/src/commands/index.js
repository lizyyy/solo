'use strict';

const path = require('path');
const fs = require('fs-extra');
const inquirer = require('inquirer');
const chalk = require('chalk');
const moment = require('moment');
const { DIRS, PHOTO_STATUS } = require('../utils/constants');
const logger = require('../utils/logger');
const store = require('../data/store');
const processor = require('../engine/photo-processor');

async function init(workspacePath, force = false) {
  const workspace = path.resolve(workspacePath);
  
  const exists = await store.isWorkspace(workspace);
  if (exists && !force) {
    throw new Error(`工作区已存在: ${workspace}\n使用 --force 强制重新初始化`);
  }
  
  if (force) {
    logger.warn(`强制重新初始化工作区: ${workspace}`);
  }
  
  logger.info(`初始化工作区: ${workspace}`);
  
  const dirs = Object.values(DIRS).map(d => path.join(workspace, d));
  for (const dir of dirs) {
    await fs.ensureDir(dir);
    logger.success(`创建目录: ${path.relative(workspace, dir)}`);
  }
  
  await store.writeConfig(workspace, {
    project: '示例项目',
    initializedAt: new Date().toISOString()
  });
  
  await store.addHistory(workspace, 'INIT', {
    path: workspace,
    force,
    timestamp: new Date().toISOString()
  });
  
  logger.success(`工作区初始化完成！\n  ${chalk.gray('下一步:')} inspection import --type points --source <点位文件>`);
}

async function importData(workspacePath, type, source, force = false) {
  const workspace = path.resolve(workspacePath);
  
  if (!await store.isWorkspace(workspace)) {
    throw new Error(`不是有效的工作区: ${workspace}\n先执行: inspection init`);
  }
  
  const validTypes = ['points', 'records', 'photos'];
  if (!validTypes.includes(type)) {
    throw new Error(`无效的数据类型: ${type}\n可选值: ${validTypes.join(', ')}`);
  }
  
  logger.info(`导入 ${type}: ${source || '(内置样例)'}`);
  
  if (type === 'points') {
    await importPoints(workspace, source, force);
  } else if (type === 'records') {
    await importRecords(workspace, source, force);
  } else if (type === 'photos') {
    await importPhotos(workspace, source, force);
  }
  
  await store.rebuildIndex(workspace);
  logger.success('导入完成');
}

async function importPoints(workspace, source, force) {
  let points;
  
  if (source) {
    const srcPath = path.resolve(source);
    if (!await fs.pathExists(srcPath)) {
      throw new Error(`文件不存在: ${srcPath}`);
    }
    points = await fs.readJson(srcPath);
  } else {
    throw new Error('请指定点位清单文件路径: --source <path>');
  }
  
  if (!Array.isArray(points)) {
    throw new Error('点位清单格式错误，应为数组');
  }
  
  const existing = await store.readPoints(workspace);
  const existingMap = {};
  for (const p of existing) {
    existingMap[p.id] = p;
    existingMap[p.name] = p;
  }
  
  let added = 0, updated = 0, skipped = 0;
  
  for (const item of points) {
    const point = {
      id: item.id || processor.generatePointId(),
      name: item.name,
      floor: item.floor,
      description: item.description || '',
      type: item.type || '巡检点'
    };
    
    if (!point.name || !point.floor) {
      logger.warn(`跳过无效点位: ${JSON.stringify(item)}`);
      skipped++;
      continue;
    }
    
    if (existingMap[point.id] || existingMap[point.name]) {
      if (force) {
        updated++;
        const idx = existing.findIndex(p => p.id === point.id || p.name === point.name);
        if (idx >= 0) {
          existing[idx] = { ...existing[idx], ...point, updatedAt: new Date().toISOString() };
        }
      } else {
        skipped++;
      }
    } else {
      added++;
      existing.push({ ...point, createdAt: new Date().toISOString() });
    }
  }
  
  await store.writePoints(workspace, existing);
  await store.addHistory(workspace, 'IMPORT_POINTS', {
    source,
    force,
    added,
    updated,
    skipped,
    total: existing.length
  });
  
  logger.section('点位导入结果');
  logger.info(`新增: ${added}`);
  logger.info(`更新: ${updated}`);
  logger.warn(`跳过: ${skipped}`);
  logger.success(`总计: ${existing.length}`);
}

async function importRecords(workspace, source, force) {
  let records;
  
  if (source) {
    const srcPath = path.resolve(source);
    if (!await fs.pathExists(srcPath)) {
      throw new Error(`文件不存在: ${srcPath}`);
    }
    records = await fs.readJson(srcPath);
  } else {
    throw new Error('请指定巡检记录文件路径: --source <path>');
  }
  
  if (!Array.isArray(records)) {
    throw new Error('巡检记录格式错误，应为数组');
  }
  
  const existing = await store.readRecords(workspace);
  let added = 0, skipped = 0;
  
  for (const record of records) {
    existing.push({
      ...record,
      id: record.id || `REC-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      importedAt: new Date().toISOString()
    });
    added++;
  }
  
  await store.writeRecords(workspace, existing);
  await store.addHistory(workspace, 'IMPORT_RECORDS', {
    source,
    force,
    added,
    skipped,
    total: existing.length
  });
  
  logger.success(`导入巡检记录 ${added} 条`);
}

async function importPhotos(workspace, source, force) {
  const rawDir = path.join(workspace, DIRS.RAW_PHOTOS);
  
  if (source) {
    const srcPath = path.resolve(source);
    const stat = await fs.stat(srcPath);
    
    if (stat.isDirectory()) {
      const files = await fs.readdir(srcPath);
      let copied = 0, skipped = 0;
      
      for (const file of files) {
        const src = path.join(srcPath, file);
        const dest = path.join(rawDir, file);
        const srcStat = await fs.stat(src);
        
        if (srcStat.isDirectory()) continue;
        if (!processor.isImageFile(file)) continue;
        
        if (await fs.pathExists(dest)) {
          if (force) {
            await fs.copy(src, dest, { overwrite: true });
            copied++;
          } else {
            skipped++;
          }
        } else {
          await fs.copy(src, dest);
          copied++;
        }
      }
      
      logger.success(`复制照片 ${copied} 张，跳过 ${skipped} 张`);
    } else {
      const dest = path.join(rawDir, path.basename(srcPath));
      await fs.copy(srcPath, dest, { overwrite: force });
      logger.success(`复制照片: ${path.basename(srcPath)}`);
    }
  }
  
  const existingPhotos = await store.readPhotos(workspace);
  const scannedPhotos = await processor.scanPhotos(workspace);
  const existingMap = {};
  for (const p of existingPhotos) {
    existingMap[p.originalName] = p;
  }
  
  let added = 0, skipped = 0;
  
  for (const scanInfo of scannedPhotos) {
    if (existingMap[scanInfo.originalName] && !force) {
      skipped++;
      continue;
    }
    
    const processed = await processor.processPhoto(workspace, scanInfo, existingPhotos);
    
    if (existingMap[scanInfo.originalName]) {
      const idx = existingPhotos.findIndex(p => p.originalName === scanInfo.originalName);
      existingPhotos[idx] = { ...existingPhotos[idx], ...processed, reimportedAt: new Date().toISOString() };
    } else {
      existingPhotos.push(processed);
    }
    added++;
  }
  
  await store.writePhotos(workspace, existingPhotos);
  await store.addHistory(workspace, 'IMPORT_PHOTOS', {
    source,
    force,
    added,
    skipped,
    total: existingPhotos.length
  });
  
  logger.section('照片扫描结果');
  logger.info(`新增/更新: ${added}`);
  logger.warn(`跳过(已存在): ${skipped}`);
  logger.success(`总计: ${existingPhotos.length}`);
}

async function check(workspacePath, summaryOnly = false) {
  const workspace = path.resolve(workspacePath);
  
  if (!await store.isWorkspace(workspace)) {
    throw new Error(`不是有效的工作区: ${workspace}`);
  }
  
  logger.title('数据完整性检查');
  
  const config = await store.readConfig(workspace);
  const points = await store.readPoints(workspace);
  const records = await store.readRecords(workspace);
  const photos = await store.readPhotos(workspace);
  
  logger.section('基础数据');
  logger.info(`项目: ${config.project || '(未设置)'}`);
  logger.info(`点位数量: ${points.length}`);
  logger.info(`巡检记录: ${records.length}`);
  logger.info(`照片数量: ${photos.length}`);
  
  const processed = await processor.matchPhotosToPoints(workspace, photos, points, records);
  
  const stats = {
    total: processed.length,
    matched: processed.filter(p => p.status === PHOTO_STATUS.MATCHED).length,
    pending: processed.filter(p => p.status === PHOTO_STATUS.PENDING).length,
    noExif: processed.filter(p => p.status === PHOTO_STATUS.NO_EXIF).length,
    noPoint: processed.filter(p => p.status === PHOTO_STATUS.NO_POINT).length,
    duplicate: processed.filter(p => p.status === PHOTO_STATUS.DUPLICATE).length,
    conflict: processed.filter(p => p.status === PHOTO_STATUS.CONFLICT).length,
    archived: processed.filter(p => p.status === PHOTO_STATUS.ARCHIVED).length,
    needsManual: processed.filter(p => p.status === PHOTO_STATUS.NEEDS_MANUAL).length
  };
  
  logger.section('照片状态统计');
  logger.success(`已匹配可归档: ${stats.matched}`);
  logger.info(`待匹配: ${stats.pending}`);
  logger.warn(`无 EXIF: ${stats.noExif}`);
  logger.warn(`未找到点位: ${stats.noPoint}`);
  logger.warn(`命名冲突: ${stats.conflict}`);
  logger.warn(`需人工确认: ${stats.needsManual}`);
  logger.error(`重复照片: ${stats.duplicate}`);
  logger.success(`已归档: ${stats.archived}`);
  
  if (!summaryOnly) {
    const needAttention = processed.filter(p => 
      p.status !== PHOTO_STATUS.MATCHED && 
      p.status !== PHOTO_STATUS.ARCHIVED &&
      p.status !== PHOTO_STATUS.DUPLICATE
    );
    
    if (needAttention.length > 0) {
      logger.section('需要关注的照片');
      for (const photo of needAttention.slice(0, 20)) {
        console.log('');
        logger.info(`${chalk.bold(photo.originalName)}`);
        logger.info(`  状态: ${getStatusText(photo.status)}`);
        if (photo.errors && photo.errors.length > 0) {
          for (const err of photo.errors) {
            logger.warn(`  原因: ${err}`);
          }
        }
        if (photo.previewName) {
          logger.info(`  预览名: ${photo.previewName}`);
        }
      }
      if (needAttention.length > 20) {
        logger.warn(`... 还有 ${needAttention.length - 20} 张，请使用 detail 命令查看详细信息`);
      }
    }
  }
  
  const readyToArchive = processed.filter(p => 
    p.status === PHOTO_STATUS.MATCHED || 
    p.status === PHOTO_STATUS.CONFLICT
  );
  
  if (readyToArchive.length > 0) {
    logger.section('可归档预览');
    for (const photo of readyToArchive.slice(0, 10)) {
      logger.info(`${chalk.gray('→')} ${photo.originalName}`);
      logger.info(`   ${chalk.green(photo.previewName)}`);
    }
  }
  
  await store.writePhotos(workspace, processed);
  await store.rebuildIndex(workspace);
  
  const canArchive = stats.matched > 0 || stats.conflict > 0;
  const hasProblems = stats.noExif > 0 || stats.noPoint > 0 || stats.needsManual > 0 || stats.duplicate > 0;
  
  logger.section('结论');
  if (canArchive) {
    logger.success(`可归档 ${stats.matched + stats.conflict} 张照片`);
    logger.info(`执行: ${chalk.bold('inspection archive')}`);
  }
  if (hasProblems) {
    logger.warn(`有 ${stats.noExif + stats.noPoint + stats.needsManual + stats.duplicate} 张需要人工处理`);
    logger.info(`使用: ${chalk.bold('inspection fix')} 或查看: ${chalk.bold('inspection detail')}`);
  }
}

function getStatusText(status) {
  const map = {
    [PHOTO_STATUS.PENDING]: chalk.yellow('待匹配'),
    [PHOTO_STATUS.MATCHED]: chalk.green('已匹配'),
    [PHOTO_STATUS.NO_EXIF]: chalk.yellow('无 EXIF'),
    [PHOTO_STATUS.NO_POINT]: chalk.red('无点位'),
    [PHOTO_STATUS.DUPLICATE]: chalk.red('重复'),
    [PHOTO_STATUS.CONFLICT]: chalk.yellow('命名冲突'),
    [PHOTO_STATUS.ARCHIVED]: chalk.green('已归档'),
    [PHOTO_STATUS.NEEDS_MANUAL]: chalk.red('需人工')
  };
  return map[status] || status;
}

async function detail(workspacePath, type, id) {
  const workspace = path.resolve(workspacePath);
  
  if (!await store.isWorkspace(workspace)) {
    throw new Error(`不是有效的工作区: ${workspace}`);
  }
  
  if (type === 'photo') {
    const photos = await store.readPhotos(workspace);
    const index = await store.readIndex(workspace);
    
    if (id) {
      const photo = photos.find(p => p.id === id || p.originalName === id || p.archivedName === id);
      if (!photo) {
        throw new Error(`未找到照片: ${id}`);
      }
      showPhotoDetail(photo);
    } else {
      logger.title('所有照片列表');
      for (const photo of photos) {
        console.log(`${getStatusText(photo.status)} ${chalk.bold(photo.originalName)}`);
        if (photo.previewName && photo.status !== PHOTO_STATUS.ARCHIVED) {
          console.log(`  → ${photo.previewName}`);
        }
        if (photo.archivedName) {
          console.log(`  → ${chalk.green(photo.archivedName)}`);
        }
      }
    }
  } else if (type === 'point') {
    const points = await store.readPoints(workspace);
    const index = await store.readIndex(workspace);
    
    if (id) {
      const point = points.find(p => p.id === id || p.name === id);
      if (!point) {
        throw new Error(`未找到点位: ${id}`);
      }
      showPointDetail(point, index);
    } else {
      logger.title('所有点位列表');
      const byFloor = {};
      for (const point of points) {
        if (!byFloor[point.floor]) byFloor[point.floor] = [];
        byFloor[point.floor].push(point);
      }
      
      for (const [floor, floorPoints] of Object.entries(byFloor)) {
        console.log(`\n${chalk.bold.underline(floor)}`);
        for (const point of floorPoints) {
          const photoCount = (index.byPoint[point.id] || []).length;
          console.log(`  ${point.name}${chalk.gray(` (${point.id})`)} - ${photoCount} 张照片`);
        }
      }
    }
  } else if (type === 'history') {
    const history = await store.readHistory(workspace);
    logger.title('操作历史记录');
    
    for (const entry of history.slice(-20)) {
      const time = moment(entry.timestamp).format('YYYY-MM-DD HH:mm:ss');
      console.log(`\n${chalk.gray(time)} ${chalk.bold(entry.action)}`);
      console.log(`  ${JSON.stringify(entry.details)}`);
    }
  }
}

function showPhotoDetail(photo) {
  logger.title(`照片详情: ${photo.originalName}`);
  console.log(`ID: ${photo.id}`);
  console.log(`状态: ${getStatusText(photo.status)}`);
  console.log(`大小: ${(photo.size / 1024).toFixed(1)} KB`);
  console.log(`时间戳: ${photo.timestamp || '(未知)'}`);
  console.log(`有 EXIF: ${photo.hasExif ? '是' : '否'}`);
  console.log(`点位 ID: ${photo.pointId || '(未匹配)'}`);
  console.log(`问题类型: ${photo.problemType || '(未设置)'}`);
  
  if (photo.errors && photo.errors.length > 0) {
    console.log(`\n${chalk.bold('问题:')}`);
    for (const err of photo.errors) {
      console.log(`  ${chalk.yellow('-')} ${err}`);
    }
  }
  
  if (photo.previewName) {
    console.log(`\n${chalk.bold('预览归档名:')}`);
    console.log(`  ${photo.previewName}`);
  }
  
  if (photo.archivedName) {
    console.log(`\n${chalk.bold.green('已归档:')}`);
    console.log(`  ${photo.archivedName}`);
    console.log(`  ${photo.archivedPath}`);
  }
  
  if (photo.duplicateOf) {
    console.log(`\n${chalk.bold.red('重复照片:')}`);
    console.log(`  与 ${photo.duplicateOf} 内容相同`);
  }
}

function showPointDetail(point, index) {
  logger.title(`点位详情: ${point.name}`);
  console.log(`ID: ${point.id}`);
  console.log(`楼层: ${point.floor}`);
  console.log(`类型: ${point.type || '巡检点'}`);
  if (point.description) {
    console.log(`描述: ${point.description}`);
  }
  
  const photoIds = index.byPoint[point.id] || [];
  console.log(`\n关联照片: ${photoIds.length} 张`);
  for (const pid of photoIds) {
    const photo = index.photos[pid];
    if (photo) {
      console.log(`  ${getStatusText(photo.status)} ${photo.originalName}`);
    }
  }
}

async function report(workspacePath, format = 'text', output) {
  const workspace = path.resolve(workspacePath);
  
  if (!await store.isWorkspace(workspace)) {
    throw new Error(`不是有效的工作区: ${workspace}`);
  }
  
  const config = await store.readConfig(workspace);
  const points = await store.readPoints(workspace);
  const photos = await store.readPhotos(workspace);
  const index = await store.readIndex(workspace);
  const history = await store.readHistory(workspace);
  
  const stats = {
    total: photos.length,
    matched: photos.filter(p => p.status === PHOTO_STATUS.MATCHED).length,
    pending: photos.filter(p => p.status === PHOTO_STATUS.PENDING).length,
    noExif: photos.filter(p => p.status === PHOTO_STATUS.NO_EXIF).length,
    noPoint: photos.filter(p => p.status === PHOTO_STATUS.NO_POINT).length,
    duplicate: photos.filter(p => p.status === PHOTO_STATUS.DUPLICATE).length,
    conflict: photos.filter(p => p.status === PHOTO_STATUS.CONFLICT).length,
    archived: photos.filter(p => p.status === PHOTO_STATUS.ARCHIVED).length,
    needsManual: photos.filter(p => p.status === PHOTO_STATUS.NEEDS_MANUAL).length
  };
  
  const floorStats = {};
  for (const point of points) {
    if (!floorStats[point.floor]) {
      floorStats[point.floor] = { points: 0, photos: 0, archived: 0 };
    }
    floorStats[point.floor].points++;
    const photoIds = index.byPoint[point.id] || [];
    floorStats[point.floor].photos += photoIds.length;
    floorStats[point.floor].archived += photoIds.filter(id => {
      const p = index.photos[id];
      return p && p.status === PHOTO_STATUS.ARCHIVED;
    }).length;
  }
  
  const reportData = {
    project: config.project,
    generatedAt: new Date().toISOString(),
    summary: {
      totalPoints: points.length,
      totalPhotos: photos.length,
      ...stats,
      needsAttention: stats.noExif + stats.noPoint + stats.duplicate + stats.needsManual,
      completionRate: photos.length > 0 ? ((stats.archived / photos.length) * 100).toFixed(1) + '%' : '0%'
    },
    byFloor: floorStats,
    needsManualList: photos.filter(p => 
      p.status === PHOTO_STATUS.NO_EXIF ||
      p.status === PHOTO_STATUS.NO_POINT ||
      p.status === PHOTO_STATUS.NEEDS_MANUAL
    ).map(p => ({
      id: p.id,
      originalName: p.originalName,
      status: p.status,
      errors: p.errors || []
    })),
    possibleDuplicates: photos.filter(p => p.status === PHOTO_STATUS.DUPLICATE).map(p => ({
      id: p.id,
      originalName: p.originalName,
      duplicateOf: p.duplicateOf
    })),
    archivedList: photos.filter(p => p.status === PHOTO_STATUS.ARCHIVED).map(p => ({
      id: p.id,
      originalName: p.originalName,
      archivedName: p.archivedName
    })),
    lastOperations: history.slice(-10)
  };
  
  if (format === 'json') {
    const jsonOutput = JSON.stringify(reportData, null, 2);
    if (output) {
      const outputPath = path.resolve(output);
      await fs.writeFile(outputPath, jsonOutput);
      logger.success(`报告已保存: ${outputPath}`);
    } else {
      console.log(jsonOutput);
    }
  } else {
    const textReport = generateTextReport(reportData, points);
    if (output) {
      const outputPath = path.resolve(output);
      await fs.writeFile(outputPath, textReport);
      logger.success(`报告已保存: ${outputPath}`);
    } else {
      console.log(textReport);
    }
  }
}

function generateTextReport(data, points) {
  let report = '';
  
  report += '='.repeat(60) + '\n';
  report += '        巡检照片归档报告\n';
  report += '='.repeat(60) + '\n';
  report += `项目: ${data.project}\n`;
  report += `生成时间: ${data.generatedAt}\n\n`;
  
  report += '【汇总】\n';
  report += `  点位总数: ${data.summary.totalPoints}\n`;
  report += `  照片总数: ${data.summary.totalPhotos}\n`;
  report += `  已归档: ${data.summary.archived}\n`;
  report += `  待处理: ${data.summary.matched + data.summary.pending + data.summary.conflict}\n`;
  report += `  需人工确认: ${data.summary.needsAttention}\n`;
  report += `  可能重复: ${data.summary.duplicate}\n`;
  report += `  完成率: ${data.summary.completionRate}\n\n`;
  
  report += '【按楼层统计】\n';
  for (const [floor, stat] of Object.entries(data.byFloor)) {
    const rate = stat.photos > 0 ? ((stat.archived / stat.photos) * 100).toFixed(0) + '%' : '0%';
    report += `  ${floor}: ${stat.points} 点位, ${stat.photos} 照片, ${stat.archived} 已归档 (${rate})\n`;
  }
  report += '\n';
  
  if (data.needsManualList.length > 0) {
    report += '【需人工确认的照片】\n';
    for (const p of data.needsManualList) {
      report += `  [${p.status}] ${p.originalName}\n`;
      for (const err of p.errors) {
        report += `    → ${err}\n`;
      }
    }
    report += '\n';
  }
  
  if (data.possibleDuplicates.length > 0) {
    report += '【可能重复的照片】\n';
    for (const p of data.possibleDuplicates) {
      report += `  ${p.originalName} → 与 ${p.duplicateOf} 重复\n`;
    }
    report += '\n';
  }
  
  if (data.archivedList.length > 0) {
    report += '【已归档的照片】\n';
    for (const p of data.archivedList) {
      report += `  ${p.originalName} → ${p.archivedName}\n`;
    }
    report += '\n';
  }
  
  report += '【最近操作记录】\n';
  for (const op of data.lastOperations) {
    report += `  ${op.timestamp} ${op.action}: ${JSON.stringify(op.details)}\n`;
  }
  
  report += '\n' + '='.repeat(60) + '\n';
  report += data.summary.needsAttention > 0 
    ? '⚠  存在需要人工处理的照片，请使用 inspection fix 处理\n'
    : '✓  所有照片处理完成，业务闭环\n';
  report += '='.repeat(60) + '\n';
  
  return report;
}

async function archive(workspacePath, autoConfirm = false, dryRun = false) {
  const workspace = path.resolve(workspacePath);
  
  if (!await store.isWorkspace(workspace)) {
    throw new Error(`不是有效的工作区: ${workspace}`);
  }
  
  const photos = await store.readPhotos(workspace);
  const points = await store.readPoints(workspace);
  
  const toArchive = photos.filter(p => 
    p.status === PHOTO_STATUS.MATCHED || 
    p.status === PHOTO_STATUS.CONFLICT
  );
  
  if (toArchive.length === 0) {
    logger.warn('没有可归档的照片');
    return;
  }
  
  logger.title(`准备归档 ${toArchive.length} 张照片`);
  
  if (dryRun) {
    logger.info('=== 试运行模式 ===');
  }
  
  if (!autoConfirm && !dryRun) {
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `确认归档 ${toArchive.length} 张照片？`,
        default: false
      }
    ]);
    
    if (!answers.confirm) {
      logger.info('已取消');
      return;
    }
  }
  
  let success = 0, failed = 0;
  const results = [];
  
  for (let i = 0; i < toArchive.length; i++) {
    const photo = toArchive[i];
    logger.step(i + 1, toArchive.length, `处理: ${photo.originalName}`);
    
    try {
      const result = await processor.performArchive(workspace, photo, points, dryRun);
      
      if (result.success) {
        photo.status = PHOTO_STATUS.ARCHIVED;
        photo.archivedName = result.archivedName;
        photo.archivedPath = result.archivedPath;
        photo.archivedAt = new Date().toISOString();
        success++;
        logger.success(`  → ${result.archivedName}`);
        results.push({ id: photo.id, success: true, archivedName: result.archivedName });
      } else {
        failed++;
        logger.error(`  失败: ${result.error}`);
        results.push({ id: photo.id, success: false, error: result.error });
      }
    } catch (error) {
      failed++;
      logger.error(`  异常: ${error.message}`);
      results.push({ id: photo.id, success: false, error: error.message });
    }
  }
  
  if (!dryRun) {
    await store.writePhotos(workspace, photos);
    await store.rebuildIndex(workspace);
    await store.addHistory(workspace, 'ARCHIVE', {
      dryRun,
      total: toArchive.length,
      success,
      failed,
      results
    });
  }
  
  logger.section('归档结果');
  logger.success(`成功: ${success}`);
  if (failed > 0) {
    logger.error(`失败: ${failed}`);
  }
  
  if (dryRun) {
    logger.info('试运行完成，未实际执行归档');
  }
}

async function fix(workspacePath, photoId, newPointId, problemType, operator, reason) {
  const workspace = path.resolve(workspacePath);
  
  if (!await store.isWorkspace(workspace)) {
    throw new Error(`不是有效的工作区: ${workspace}`);
  }
  
  const photos = await store.readPhotos(workspace);
  const points = await store.readPoints(workspace);
  
  const photo = photos.find(p => p.id === photoId || p.originalName === photoId);
  if (!photo) {
    throw new Error(`未找到照片: ${photoId}`);
  }
  
  const oldData = {
    pointId: photo.pointId,
    problemType: photo.problemType,
    status: photo.status
  };
  
  let changes = [];
  
  if (newPointId) {
    const point = points.find(p => p.id === newPointId || p.name === newPointId);
    if (!point) {
      throw new Error(`未找到点位: ${newPointId}`);
    }
    photo.pointId = point.id;
    changes.push(`点位: ${oldData.pointId || '(无)'} → ${point.name}`);
  }
  
  if (problemType) {
    photo.problemType = problemType;
    changes.push(`问题类型: ${oldData.problemType || '(无)'} → ${problemType}`);
  }
  
  if (changes.length === 0) {
    throw new Error('没有指定任何修改');
  }
  
  if (photo.status === PHOTO_STATUS.NO_EXIF || 
      photo.status === PHOTO_STATUS.NO_POINT ||
      photo.status === PHOTO_STATUS.NEEDS_MANUAL ||
      photo.status === PHOTO_STATUS.CONFLICT) {
    photo.status = PHOTO_STATUS.MATCHED;
    changes.push(`状态: ${oldData.status} → matched`);
  }
  
  photo.errors = (photo.errors || []).filter(e => 
    !e.includes('点位不存在') && 
    !e.includes('未匹配点位')
  );
  
  if (!photo.fixHistory) {
    photo.fixHistory = [];
  }
  
  photo.fixHistory.push({
    timestamp: new Date().toISOString(),
    operator: operator || '未知操作者',
    reason: reason || '人工修正',
    oldData,
    newData: {
      pointId: photo.pointId,
      problemType: photo.problemType,
      status: photo.status
    },
    changes
  });
  
  const previewName = await processor.generateArchiveName(workspace, photo, points);
  photo.previewName = previewName;
  
  await store.writePhotos(workspace, photos);
  await store.rebuildIndex(workspace);
  await store.addHistory(workspace, 'FIX', {
    photoId: photo.id,
    operator,
    reason,
    changes
  });
  
  logger.success(`照片已修正`);
  logger.info(`照片: ${photo.originalName}`);
  for (const change of changes) {
    logger.info(`  ${change}`);
  }
  logger.info(`操作者: ${operator || '未知操作者'}`);
  logger.info(`原因: ${reason || '人工修正'}`);
  logger.info(`新预览名: ${previewName}`);
}

module.exports = {
  init,
  import: importData,
  check,
  detail,
  report,
  archive,
  fix
};
