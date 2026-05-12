'use strict';

const path = require('path');
const fs = require('fs-extra');
const moment = require('moment');
const { DIRS, PHOTO_STATUS, NAMING_PATTERN } = require('../utils/constants');
const { readExif, getFileTimestamp, getFileHash } = require('../utils/exif-reader');
const store = require('../data/store');

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.heic', '.heif'];

function isImageFile(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

function generatePhotoId() {
  return `PHOTO-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function generatePointId() {
  return `POINT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function parsePhotoFromFileName(fileName) {
  const name = path.basename(fileName, path.extname(fileName));
  const parts = name.split('_');
  
  if (parts.length >= 5) {
    return {
      project: parts[0],
      floor: parts[1],
      point: parts[2],
      time: parts[3],
      type: parts[4],
      suffix: parts[5] || ''
    };
  }
  
  return null;
}

async function scanPhotos(workspace) {
  const rawDir = path.join(workspace, DIRS.RAW_PHOTOS);
  const photos = [];
  
  if (!await fs.pathExists(rawDir)) {
    return photos;
  }
  
  const files = await fs.readdir(rawDir);
  
  for (const file of files) {
    const fullPath = path.join(rawDir, file);
    const stat = await fs.stat(fullPath);
    
    if (stat.isDirectory()) continue;
    if (!isImageFile(file)) continue;
    
    photos.push({
      originalName: file,
      originalPath: fullPath,
      size: stat.size
    });
  }
  
  return photos;
}

async function processPhoto(workspace, photoInfo, existingPhotos = []) {
  const id = generatePhotoId();
  const exif = readExif(photoInfo.originalPath);
  const fileHash = getFileHash(photoInfo.originalPath);
  
  const existingByHash = existingPhotos.find(p => p.hash === fileHash && p.hash);
  if (existingByHash) {
    return {
      id,
      originalName: photoInfo.originalName,
      originalPath: photoInfo.originalPath,
      size: photoInfo.size,
      hash: fileHash,
      status: PHOTO_STATUS.DUPLICATE,
      duplicateOf: existingByHash.id,
      timestamp: null,
      hasExif: false,
      pointId: null,
      problemType: null,
      archivedName: null,
      archivedPath: null,
      errors: [`与 ${existingByHash.originalName} (${existingByHash.id}) 内容完全相同`]
    };
  }
  
  let timestamp = exif.dateTime;
  let hasExif = exif.hasExif;
  const errors = [];
  
  if (!timestamp) {
    timestamp = getFileTimestamp(photoInfo.originalPath);
    errors.push('无 EXIF 时间信息，使用文件创建时间');
  }
  
  const parsedFromName = parsePhotoFromFileName(photoInfo.originalName);
  let pointId = parsedFromName ? parsedFromName.point : null;
  let problemType = parsedFromName ? parsedFromName.type : null;
  
  return {
    id,
    originalName: photoInfo.originalName,
    originalPath: photoInfo.originalPath,
    size: photoInfo.size,
    hash: fileHash,
    status: hasExif ? (pointId ? PHOTO_STATUS.MATCHED : PHOTO_STATUS.PENDING) : PHOTO_STATUS.NO_EXIF,
    duplicateOf: null,
    timestamp,
    hasExif,
    exifData: exif,
    pointId,
    problemType,
    parsedFromName,
    archivedName: null,
    archivedPath: null,
    errors,
    createdAt: new Date().toISOString()
  };
}

async function matchPhotosToPoints(workspace, photos, points, records) {
  const pointMap = {};
  for (const point of points) {
    pointMap[point.id] = point;
    pointMap[point.name] = point;
  }
  
  const recordMap = {};
  for (const record of records) {
    if (record.photoOriginalName) {
      recordMap[record.photoOriginalName] = record;
    }
  }
  
  const timeGrouped = {};
  for (const photo of photos) {
    if (!photo.timestamp) continue;
    if (!timeGrouped[photo.timestamp]) {
      timeGrouped[photo.timestamp] = [];
    }
    timeGrouped[photo.timestamp].push(photo);
  }
  
  const results = photos.map(photo => {
    const result = { ...photo };
    const errors = [...(photo.errors || [])];
    
    if (result.status === PHOTO_STATUS.DUPLICATE) {
      return result;
    }
    
    const record = recordMap[photo.originalName];
    if (record) {
      if (record.pointId && pointMap[record.pointId]) {
        result.pointId = record.pointId;
        if (record.problemType) {
          result.problemType = record.problemType;
        }
        result.status = PHOTO_STATUS.MATCHED;
        return result;
      }
    }
    
    if (result.pointId) {
      const point = pointMap[result.pointId];
      if (point) {
        result.pointId = point.id;
        result.status = result.status === PHOTO_STATUS.NO_EXIF ? PHOTO_STATUS.NO_EXIF : PHOTO_STATUS.MATCHED;
        return result;
      } else {
        errors.push(`点位不存在: ${result.pointId}`);
        result.pointId = null;
      }
    }
    
    if (timeGrouped[photo.timestamp] && timeGrouped[photo.timestamp].length > 1) {
      const sameTimePhotos = timeGrouped[photo.timestamp];
      result.sameTimeCount = sameTimePhotos.length;
      errors.push(`同一时间 ${photo.timestamp} 有 ${sameTimePhotos.length} 张照片`);
    }
    
    if (!result.pointId) {
      result.status = result.hasExif ? PHOTO_STATUS.NO_POINT : PHOTO_STATUS.NEEDS_MANUAL;
    }
    
    result.errors = errors;
    return result;
  });
  
  const namesUsed = {};
  for (const photo of results) {
    if (photo.status === PHOTO_STATUS.DUPLICATE) continue;
    
    const name = await generateArchiveName(workspace, photo, points);
    photo.previewName = name;
    
    if (!namesUsed[name]) {
      namesUsed[name] = [];
    }
    namesUsed[name].push(photo);
  }
  
  for (const [name, photoList] of Object.entries(namesUsed)) {
    if (photoList.length > 1) {
      for (let i = 0; i < photoList.length; i++) {
        const photo = photoList[i];
        if (photo.status === PHOTO_STATUS.DUPLICATE) continue;
        
        const suffix = `_${String(i + 1).padStart(2, '0')}`;
        photo.previewName = await generateArchiveName(workspace, photo, points, suffix);
        photo.status = PHOTO_STATUS.CONFLICT;
        if (!photo.errors) photo.errors = [];
        photo.errors.push(`命名冲突: 与其他 ${photoList.length - 1} 张照片同名`);
      }
    }
  }
  
  return results;
}

async function generateArchiveName(workspace, photo, points, suffix = '') {
  const config = await store.readConfig(workspace);
  const point = points.find(p => p.id === photo.pointId);
  
  const project = (config.project || 'UNKNOWN').replace(/[\\/:*?"<>|]/g, '_');
  const floor = point ? point.floor.replace(/[\\/:*?"<>|]/g, '_') : 'UNKNOWN';
  const pointName = point ? point.name.replace(/[\\/:*?"<>|]/g, '_') : 'UNKNOWN';
  const time = photo.timestamp || 'UNKNOWN';
  const type = (photo.problemType || 'UNKNOWN').replace(/[\\/:*?"<>|]/g, '_');
  const ext = path.extname(photo.originalName).toLowerCase();
  
  return `${project}_${floor}_${pointName}_${time}_${type}${suffix}${ext}`;
}

async function performArchive(workspace, photo, points, dryRun = false) {
  const archivedDir = path.join(workspace, DIRS.ARCHIVED);
  const config = await store.readConfig(workspace);
  
  const point = points.find(p => p.id === photo.pointId);
  if (!point) {
    return { success: false, error: '未匹配点位' };
  }
  
  const floorDir = path.join(archivedDir, config.project || 'UNKNOWN', point.floor);
  
  if (!dryRun) {
    await fs.ensureDir(floorDir);
  }
  
  let finalName = photo.previewName;
  let finalPath = path.join(floorDir, finalName);
  let counter = 1;
  
  while (await fs.pathExists(finalPath)) {
    const ext = path.extname(finalName);
    const base = path.basename(finalName, ext);
    finalName = `${base}_${String(counter).padStart(2, '0')}${ext}`;
    finalPath = path.join(floorDir, finalName);
    counter++;
  }
  
  if (!dryRun) {
    await fs.copy(photo.originalPath, finalPath);
  }
  
  return {
    success: true,
    archivedName: finalName,
    archivedPath: finalPath,
    dryRun
  };
}

module.exports = {
  scanPhotos,
  processPhoto,
  matchPhotosToPoints,
  generateArchiveName,
  performArchive,
  isImageFile,
  generatePhotoId,
  generatePointId
};
