const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const dataStore = {
  inspectionPhotos: [],
  coordinateTables: [],
  cadLayers: [],
  shadowPoints: [],
  historyRecords: []
};

const RECORD_STATUS = {
  NORMAL: 'normal',
  MISSING_COORDINATE: 'missing_coordinate',
  OLD_CALIBER: 'old_caliber',
  PENDING_REVIEW: 'pending_review',
  CONFLICT: 'conflict'
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function addHistory(recordId, action, operator, details, beforeState = null, afterState = null) {
  dataStore.historyRecords.push({
    id: generateId(),
    recordId,
    action,
    operator,
    details,
    beforeState,
    afterState,
    timestamp: new Date().toISOString()
  });
}

app.post('/api/photos/import', (req, res) => {
  const { photos } = req.body;
  const importedPhotos = photos.map(photo => ({
    ...photo,
    id: generateId(),
    importedAt: new Date().toISOString(),
    status: 'imported'
  }));
  
  dataStore.inspectionPhotos.push(...importedPhotos);
  
  importedPhotos.forEach(photo => {
    addHistory(photo.id, '导入照片', '系统', `导入巡检照片 ${photo.photoNo}`, null, photo);
  });
  
  res.json({ success: true, data: importedPhotos });
});

app.get('/api/photos', (req, res) => {
  res.json({ success: true, data: dataStore.inspectionPhotos });
});

app.post('/api/cad/import', (req, res) => {
  const { layers } = req.body;
  const importedLayers = layers.map(layer => ({
    ...layer,
    id: generateId(),
    importedAt: new Date().toISOString()
  }));
  
  dataStore.cadLayers.push(...importedLayers);
  res.json({ success: true, data: importedLayers });
});

app.get('/api/cad', (req, res) => {
  res.json({ success: true, data: dataStore.cadLayers });
});

app.post('/api/coordinates/import', (req, res) => {
  const { coordinates } = req.body;
  const importedCoords = coordinates.map(coord => ({
    ...coord,
    id: generateId(),
    importedAt: new Date().toISOString()
  }));
  
  dataStore.coordinateTables.push(...importedCoords);
  res.json({ success: true, data: importedCoords });
});

app.get('/api/coordinates', (req, res) => {
  res.json({ success: true, data: dataStore.coordinateTables });
});

function detectConflicts(photo, cadLayer) {
  const conflicts = [];
  
  if (photo.photoNo && cadLayer.layerName) {
    const photoPanelId = extractPanelId(photo.photoNo);
    const cadPanelId = extractPanelId(cadLayer.layerName);
    
    if (photoPanelId && cadPanelId && photoPanelId !== cadPanelId) {
      conflicts.push({
        type: 'panel_id_mismatch',
        description: '光伏板编号不一致',
        photoValue: photoPanelId,
        cadValue: cadPanelId,
        evidence: `照片编号 ${photo.photoNo} 识别出光伏板 ${photoPanelId}，CAD图层 ${cadLayer.layerName} 识别出光伏板 ${cadPanelId}`
      });
    }
  }
  
  if (photo.position && cadLayer.coordinates) {
    const dist = calculateDistance(photo.position, cadLayer.coordinates);
    if (dist > 5) {
      conflicts.push({
        type: 'position_mismatch',
        description: '位置坐标偏差过大',
        photoValue: `(${photo.position.x}, ${photo.position.y})`,
        cadValue: `(${cadLayer.coordinates.x}, ${cadLayer.coordinates.y})`,
        evidence: `照片标记位置与CAD图层坐标相差 ${dist.toFixed(2)} 米，超过容许误差`,
        distance: dist
      });
    }
  }
  
  return conflicts;
}

function extractPanelId(str) {
  const match = str.match(/PV-(\d+)/i) || str.match(/光伏[板]?[编号]?[:：]?\s*(\d+)/i);
  return match ? match[1] : null;
}

function calculateDistance(pos1, pos2) {
  const dx = (pos1.x || 0) - (pos2.x || 0);
  const dy = (pos1.y || 0) - (pos2.y || 0);
  return Math.sqrt(dx * dx + dy * dy);
}

function checkMissingCoordinate(photo) {
  const hasPhotoPoint = photo.hasMarkedPoint !== false;
  const hasCoordEntry = dataStore.coordinateTables.some(
    coord => coord.photoNo === photo.photoNo || coord.panelId === photo.panelId
  );
  return hasPhotoPoint && !hasCoordEntry;
}

function isOldCaliber(cadLayer) {
  return cadLayer.layerName && (
    cadLayer.layerName.includes('旧版') ||
    cadLayer.layerName.includes('V1') ||
    cadLayer.layerName.includes('2023') ||
    cadLayer.layerName.includes('old')
  );
}

app.post('/api/shadow-points/process', (req, res) => {
  const { photoId, cadLayerId, operator } = req.body;
  const photo = dataStore.inspectionPhotos.find(p => p.id === photoId);
  const cadLayer = dataStore.cadLayers.find(l => l.id === cadLayerId);
  
  if (!photo) {
    return res.status(404).json({ success: false, error: '照片记录不存在' });
  }
  
  const conflicts = cadLayer ? detectConflicts(photo, cadLayer) : [];
  const isMissingCoord = checkMissingCoordinate(photo);
  const isOld = cadLayer ? isOldCaliber(cadLayer) : false;
  
  let status = RECORD_STATUS.NORMAL;
  let statusDetails = [];
  
  if (conflicts.length > 0) {
    status = RECORD_STATUS.CONFLICT;
    statusDetails.push('存在数据冲突，需设计师确认');
  }
  
  if (isMissingCoord) {
    status = RECORD_STATUS.PENDING_REVIEW;
    statusDetails.push('照片有点位但坐标表缺行，需安全员复核');
  }
  
  if (isOld) {
    statusDetails.push('CAD图层为旧口径数据');
  }
  
  const shadowPoint = {
    id: generateId(),
    photoId,
    cadLayerId,
    photoNo: photo.photoNo,
    panelId: photo.panelId || extractPanelId(photo.photoNo),
    position: photo.position || (cadLayer && cadLayer.coordinates),
    shadowArea: photo.shadowArea,
    confidence: photo.confidence,
    status,
    statusDetails,
    conflicts,
    isMissingCoordinate: isMissingCoord,
    isOldCaliber: isOld,
    processedBy: operator,
    processedAt: new Date().toISOString(),
    reviewStatus: conflicts.length > 0 || isMissingCoord ? 'pending' : 'approved'
  };
  
  dataStore.shadowPoints.push(shadowPoint);
  addHistory(shadowPoint.id, '处理遮挡点', operator, 
    `处理遮挡点 ${shadowPoint.photoNo}，状态: ${status}`, null, shadowPoint);
  
  res.json({ success: true, data: shadowPoint });
});

app.post('/api/shadow-points/:id/resolve-conflict', (req, res) => {
  const { id } = req.params;
  const { resolution, operator } = req.body;
  
  const shadowPoint = dataStore.shadowPoints.find(sp => sp.id === id);
  if (!shadowPoint) {
    return res.status(404).json({ success: false, error: '遮挡点记录不存在' });
  }
  
  const beforeState = JSON.parse(JSON.stringify(shadowPoint));
  
  if (resolution === 'confirm') {
    shadowPoint.reviewStatus = 'approved';
    shadowPoint.status = shadowPoint.isMissingCoordinate ? RECORD_STATUS.MISSING_COORDINATE : 
                          shadowPoint.isOldCaliber ? RECORD_STATUS.OLD_CALIBER : RECORD_STATUS.NORMAL;
    shadowPoint.confirmedBy = operator;
    shadowPoint.confirmedAt = new Date().toISOString();
  } else if (resolution === 'reject') {
    shadowPoint.reviewStatus = 'rejected';
    shadowPoint.rejectedBy = operator;
    shadowPoint.rejectedAt = new Date().toISOString();
  }
  
  addHistory(id, '冲突处理', operator, 
    `${resolution === 'confirm' ? '确认' : '驳回'}遮挡点 ${shadowPoint.photoNo}`, 
    beforeState, shadowPoint);
  
  res.json({ success: true, data: shadowPoint });
});

app.get('/api/shadow-points', (req, res) => {
  res.json({ success: true, data: dataStore.shadowPoints });
});

app.get('/api/history', (req, res) => {
  const { recordId } = req.query;
  let records = dataStore.historyRecords;
  if (recordId) {
    records = records.filter(h => h.recordId === recordId);
  }
  res.json({ success: true, data: records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) });
});

app.post('/api/samples/init', (req, res) => {
  dataStore.inspectionPhotos = [];
  dataStore.coordinateTables = [];
  dataStore.cadLayers = [];
  dataStore.shadowPoints = [];
  dataStore.historyRecords = [];
  
  const samplePhotos = [
    {
      photoNo: 'PV-001-20240115-0930',
      panelId: '001',
      hasMarkedPoint: true,
      position: { x: 100, y: 200 },
      shadowArea: 2.5,
      confidence: 0.95,
      remark: '正常巡检照片，阴影清晰'
    },
    {
      photoNo: 'PV-002-20240115-0945',
      panelId: '002',
      hasMarkedPoint: true,
      position: { x: 150, y: 250 },
      shadowArea: 1.8,
      confidence: 0.88,
      remark: '照片有点位标记，坐标表待补'
    },
    {
      photoNo: 'PV-003-20240115-1000',
      panelId: '003',
      hasMarkedPoint: true,
      position: { x: 200, y: 300 },
      shadowArea: 3.2,
      confidence: 0.92,
      remark: '旧口径数据，需从CAD补录'
    }
  ];
  
  const sampleCoords = [
    {
      photoNo: 'PV-001-20240115-0930',
      panelId: '001',
      x: 100,
      y: 200,
      source: '坐标表'
    }
  ];
  
  const sampleCadLayers = [
    {
      layerName: 'PV-001-新版-2024',
      panelId: '001',
      coordinates: { x: 100, y: 200 },
      isOldCaliber: false,
      source: 'CAD-2024版'
    },
    {
      layerName: 'PV-002-新版-2024',
      panelId: '002',
      coordinates: { x: 150, y: 250 },
      isOldCaliber: false,
      source: 'CAD-2024版'
    },
    {
      layerName: 'PV-003-旧版-2023',
      panelId: '003',
      coordinates: { x: 200, y: 300 },
      isOldCaliber: true,
      source: 'CAD-2023旧版'
    },
    {
      layerName: 'PV-002-旧版-2023',
      panelId: '999',
      coordinates: { x: 999, y: 999 },
      isOldCaliber: true,
      source: 'CAD-2023旧版'
    }
  ];
  
  samplePhotos.forEach(photo => {
    dataStore.inspectionPhotos.push({
      ...photo,
      id: generateId(),
      importedAt: new Date().toISOString(),
      status: 'imported'
    });
  });
  
  sampleCoords.forEach(coord => {
    dataStore.coordinateTables.push({
      ...coord,
      id: generateId(),
      importedAt: new Date().toISOString()
    });
  });
  
  sampleCadLayers.forEach(layer => {
    dataStore.cadLayers.push({
      ...layer,
      id: generateId(),
      importedAt: new Date().toISOString()
    });
  });
  
  res.json({
    success: true,
    data: {
      photos: dataStore.inspectionPhotos,
      coordinates: dataStore.coordinateTables,
      cadLayers: dataStore.cadLayers
    }
  });
});

app.get('/api/dashboard', (req, res) => {
  const stats = {
    totalPhotos: dataStore.inspectionPhotos.length,
    totalCadLayers: dataStore.cadLayers.length,
    totalShadowPoints: dataStore.shadowPoints.length,
    statusBreakdown: {
      normal: dataStore.shadowPoints.filter(sp => sp.status === 'normal').length,
      missing_coordinate: dataStore.shadowPoints.filter(sp => sp.status === 'missing_coordinate').length,
      old_caliber: dataStore.shadowPoints.filter(sp => sp.status === 'old_caliber').length,
      pending_review: dataStore.shadowPoints.filter(sp => sp.status === 'pending_review').length,
      conflict: dataStore.shadowPoints.filter(sp => sp.status === 'conflict').length
    },
    pendingReview: dataStore.shadowPoints.filter(sp => sp.reviewStatus === 'pending').length
  };
  
  res.json({ success: true, data: stats });
});

app.listen(PORT, () => {
  console.log(`光伏板阴影遮挡试算系统已启动: http://localhost:${PORT}`);
});
