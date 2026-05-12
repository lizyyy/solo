'use strict';

const path = require('path');
const fs = require('fs-extra');
const { DIRS, FILES, PHOTO_STATUS } = require('../utils/constants');

function getDataPath(workspace, fileName) {
  return path.join(workspace, DIRS.DATA, fileName);
}

async function ensureDataDir(workspace) {
  await fs.ensureDir(path.join(workspace, DIRS.DATA));
}

async function readData(workspace, fileName, defaultValue = []) {
  const filePath = getDataPath(workspace, fileName);
  if (!await fs.pathExists(filePath)) {
    return defaultValue;
  }
  return await fs.readJson(filePath);
}

async function writeData(workspace, fileName, data) {
  await ensureDataDir(workspace);
  const filePath = getDataPath(workspace, fileName);
  await fs.writeJson(filePath, data, { spaces: 2 });
}

async function readConfig(workspace) {
  return readData(workspace, FILES.CONFIG, {
    project: '',
    created: new Date().toISOString()
  });
}

async function writeConfig(workspace, config) {
  return writeData(workspace, FILES.CONFIG, config);
}

async function readPoints(workspace) {
  return readData(workspace, FILES.POINTS, []);
}

async function writePoints(workspace, points) {
  return writeData(workspace, FILES.POINTS, points);
}

async function readRecords(workspace) {
  return readData(workspace, FILES.RECORDS, []);
}

async function writeRecords(workspace, records) {
  return writeData(workspace, FILES.RECORDS, records);
}

async function readPhotos(workspace) {
  return readData(workspace, FILES.PHOTOS, []);
}

async function writePhotos(workspace, photos) {
  return writeData(workspace, FILES.PHOTOS, photos);
}

async function readHistory(workspace) {
  return readData(workspace, FILES.HISTORY, []);
}

async function writeHistory(workspace, history) {
  return writeData(workspace, FILES.HISTORY, history);
}

async function readIndex(workspace) {
  return readData(workspace, FILES.INDEX, {
    points: {},
    photos: {},
    byFloor: {},
    byStatus: {}
  });
}

async function writeIndex(workspace, index) {
  return writeData(workspace, FILES.INDEX, index);
}

async function addHistory(workspace, action, details) {
  const history = await readHistory(workspace);
  history.push({
    id: `HIST-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    action,
    timestamp: new Date().toISOString(),
    details
  });
  await writeHistory(workspace, history);
}

async function isWorkspace(workspace) {
  return await fs.pathExists(path.join(workspace, DIRS.DATA));
}

async function rebuildIndex(workspace) {
  const points = await readPoints(workspace);
  const photos = await readPhotos(workspace);
  
  const index = {
    points: {},
    photos: {},
    byFloor: {},
    byStatus: {},
    byPoint: {}
  };
  
  for (const point of points) {
    index.points[point.id] = point;
    if (!index.byFloor[point.floor]) {
      index.byFloor[point.floor] = [];
    }
    index.byFloor[point.floor].push(point.id);
    index.byPoint[point.id] = [];
  }
  
  for (const status of Object.values(PHOTO_STATUS)) {
    index.byStatus[status] = [];
  }
  
  for (const photo of photos) {
    index.photos[photo.id] = photo;
    index.byStatus[photo.status].push(photo.id);
    if (photo.pointId && index.byPoint[photo.pointId]) {
      index.byPoint[photo.pointId].push(photo.id);
    }
  }
  
  await writeIndex(workspace, index);
  return index;
}

module.exports = {
  getDataPath,
  ensureDataDir,
  readData,
  writeData,
  readConfig,
  writeConfig,
  readPoints,
  writePoints,
  readRecords,
  writeRecords,
  readPhotos,
  writePhotos,
  readHistory,
  writeHistory,
  readIndex,
  writeIndex,
  addHistory,
  isWorkspace,
  rebuildIndex
};
