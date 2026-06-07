const fs = require('fs');
const path = require('path');
const { createPoint, createVersion } = require('./models');
const { applyBoundaryRules } = require('../rules/boundaryRules');

const DATA_DIR = path.join(__dirname, '../../data');
const POINTS_FILE = path.join(DATA_DIR, 'points.json');
const PHOTO_HASH_INDEX_FILE = path.join(DATA_DIR, 'photo_hash_index.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(POINTS_FILE)) {
    fs.writeFileSync(POINTS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(PHOTO_HASH_INDEX_FILE)) {
    fs.writeFileSync(PHOTO_HASH_INDEX_FILE, JSON.stringify({}, null, 2));
  }
}

function readPoints() {
  ensureDataDir();
  return JSON.parse(fs.readFileSync(POINTS_FILE, 'utf8'));
}

function writePoints(points) {
  ensureDataDir();
  fs.writeFileSync(POINTS_FILE, JSON.stringify(points, null, 2));
}

function readPhotoHashIndex() {
  ensureDataDir();
  return JSON.parse(fs.readFileSync(PHOTO_HASH_INDEX_FILE, 'utf8'));
}

function writePhotoHashIndex(index) {
  ensureDataDir();
  fs.writeFileSync(PHOTO_HASH_INDEX_FILE, JSON.stringify(index, null, 2));
}

function isPhotoDuplicated(fileHash) {
  const index = readPhotoHashIndex();
  return !!index[fileHash];
}

function recordPhotoHash(fileHash, pointId, photoId) {
  const index = readPhotoHashIndex();
  index[fileHash] = { pointId, photoId, importedAt: new Date().toISOString() };
  writePhotoHashIndex(index);
}

function addPoint(data) {
  const points = readPoints();
  const point = createPoint(data);
  const ruleResult = applyBoundaryRules(point);
  points.push(ruleResult.point);
  writePoints(points);
  return { point: ruleResult.point, ruleResults: ruleResult.results, needsReview: ruleResult.needsReview };
}

function getPoint(pointId) {
  const points = readPoints();
  return points.find(p => p.id === pointId && !p.isDeleted);
}

function updatePoint(pointId, updates, context = {}) {
  const points = readPoints();
  const idx = points.findIndex(p => p.id === pointId && !p.isDeleted);
  if (idx === -1) return null;
  
  const previous = JSON.parse(JSON.stringify(points[idx]));
  const point = points[idx];
  
  Object.keys(updates).forEach(key => {
    if (key !== 'id' && key !== 'createdAt' && key !== 'versions' && key !== 'rawMaterials') {
      point[key] = updates[key];
    }
  });
  
  point.updatedAt = new Date().toISOString();
  point.updatedBy = context.modifiedBy || 'system';
  
  const ruleResult = applyBoundaryRules(point, context);
  const finalPoint = ruleResult.point;
  
  const version = createVersion(finalPoint, previous, context.action || 'update', context.reason || '更新信息');
  finalPoint.versions.push(version);
  
  points[idx] = finalPoint;
  writePoints(points);
  
  return { point: finalPoint, version, ruleResults: ruleResult.results, needsReview: ruleResult.needsReview };
}

function addPhotoToPoint(pointId, photoRecord) {
  const points = readPoints();
  const idx = points.findIndex(p => p.id === pointId && !p.isDeleted);
  if (idx === -1) return null;
  
  const previous = JSON.parse(JSON.stringify(points[idx]));
  const point = points[idx];
  
  if (isPhotoDuplicated(photoRecord.fileHash)) {
    const hashInfo = readPhotoHashIndex()[photoRecord.fileHash];
    return { 
      duplicated: true, 
      existingPhotoId: hashInfo.photoId,
      existingPointId: hashInfo.pointId,
      point
    };
  }
  
  point.photos.push(photoRecord);
  point.rawMaterials.originalPhotos.push({
    photoId: photoRecord.id,
    filename: photoRecord.originalFilename,
    importedAt: photoRecord.uploadedAt
  });
  
  recordPhotoHash(photoRecord.fileHash, pointId, photoRecord.id);
  
  point.updatedAt = new Date().toISOString();
  
  const version = createVersion(point, previous, 'add_photo', `添加照片: ${photoRecord.originalFilename}`);
  point.versions.push(version);
  
  points[idx] = point;
  writePoints(points);
  
  return { duplicated: false, point, photoRecord, version };
}

function addBusCardPeriod(pointId, busCardPeriod) {
  const points = readPoints();
  const idx = points.findIndex(p => p.id === pointId && !p.isDeleted);
  if (idx === -1) return null;
  
  const previous = JSON.parse(JSON.stringify(points[idx]));
  const point = points[idx];
  
  point.busCardPeriods.push(busCardPeriod);
  point.rawMaterials.originalBusCardData.push({
    periodId: busCardPeriod.id,
    rawText: busCardPeriod.rawText,
    notes: busCardPeriod.notes,
    supplementedAt: busCardPeriod.supplementedAt
  });
  
  point.updatedAt = new Date().toISOString();
  
  const version = createVersion(point, previous, 'add_bus_card', `补充公交刷卡时段: ${busCardPeriod.period}`);
  point.versions.push(version);
  
  points[idx] = point;
  writePoints(points);
  
  return { point, busCardPeriod, version };
}

function rollbackToVersion(pointId, versionId, context = {}) {
  const points = readPoints();
  const idx = points.findIndex(p => p.id === pointId && !p.isDeleted);
  if (idx === -1) return { error: '点位不存在' };
  
  const point = points[idx];
  const versionIndex = point.versions.findIndex(v => v.versionId === versionId);
  if (versionIndex === -1) return { error: '版本不存在' };
  
  const targetVersion = point.versions[versionIndex];
  const targetState = targetVersion.previous;
  
  if (!targetState) {
    return { error: '无法回滚到初始版本之前' };
  }
  
  const previous = JSON.parse(JSON.stringify(point));
  
  point.name = targetState.name;
  point.streets = targetState.streets;
  point.boundaryStatus = targetState.boundaryStatus;
  point.assignedStreet = targetState.assignedStreet;
  point.notes = targetState.notes;
  point.matchCount = targetState.matchCount;
  point.updatedAt = new Date().toISOString();
  
  const rollbackVersion = createVersion(
    point, 
    previous, 
    'rollback', 
    `回滚到版本 ${versionId} (${targetVersion.timestamp})`
  );
  point.versions.push(rollbackVersion);
  
  points[idx] = point;
  writePoints(points);
  
  return { point, rollbackVersion, rolledBackTo: targetVersion };
}

function listPoints(filters = {}) {
  let points = readPoints().filter(p => !p.isDeleted);
  
  if (filters.boundaryStatus) {
    points = points.filter(p => p.boundaryStatus === filters.boundaryStatus);
  }
  if (filters.street) {
    points = points.filter(p => p.streets.includes(filters.street));
  }
  if (filters.workflowStage) {
    points = points.filter(p => p.workflowStage === filters.workflowStage);
  }
  
  return points;
}

function getPointVersions(pointId) {
  const point = getPoint(pointId);
  return point ? point.versions : null;
}

function compareVersions(pointId, versionId1, versionId2) {
  const point = getPoint(pointId);
  if (!point) return { error: '点位不存在' };
  
  const v1 = point.versions.find(v => v.versionId === versionId1);
  const v2 = point.versions.find(v => v.versionId === versionId2);
  
  if (!v1 || !v2) return { error: '版本不存在' };
  
  const state1 = v1.current;
  const state2 = v2.current;
  
  const diff = {};
  ['name', 'streets', 'boundaryStatus', 'assignedStreet', 'notes', 'matchCount'].forEach(field => {
    if (JSON.stringify(state1[field]) !== JSON.stringify(state2[field])) {
      diff[field] = { before: state1[field], after: state2[field] };
    }
  });
  
  if (JSON.stringify(state1.busCardPeriods) !== JSON.stringify(state2.busCardPeriods)) {
    diff.busCardPeriods = { before: state1.busCardPeriods, after: state2.busCardPeriods };
  }
  
  return {
    pointId,
    version1: { id: versionId1, timestamp: v1.timestamp, action: v1.action, reason: v1.reason },
    version2: { id: versionId2, timestamp: v2.timestamp, action: v2.action, reason: v2.reason },
    diff,
    hasChanges: Object.keys(diff).length > 0
  };
}

module.exports = {
  addPoint,
  getPoint,
  updatePoint,
  addPhotoToPoint,
  addBusCardPeriod,
  rollbackToVersion,
  listPoints,
  getPointVersions,
  compareVersions,
  isPhotoDuplicated,
  readPhotoHashIndex
};
