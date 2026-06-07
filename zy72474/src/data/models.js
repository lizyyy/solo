const { v4: uuidv4 } = require('uuid');

const BOUNDARY_STATUS = {
  NORMAL: 'normal',
  BOUNDARY_PENDING: 'boundary_pending',
  BOUNDARY_CONFIRMED: 'boundary_confirmed'
};

const WORKFLOW_STAGE = {
  PHOTO_IMPORTED: 'photo_imported',
  BUS_CARD_SUPPLEMENTED: 'bus_card_supplemented',
  MAP_EXPORTED: 'map_exported'
};

function createPoint(data) {
  const now = new Date().toISOString();
  const pointId = data.id || uuidv4();
  
  const point = {
    id: pointId,
    name: data.name,
    lat: data.lat,
    lng: data.lng,
    streets: data.streets || [],
    boundaryStatus: data.boundaryStatus || (data.streets && data.streets.length > 1 ? BOUNDARY_STATUS.BOUNDARY_PENDING : BOUNDARY_STATUS.NORMAL),
    assignedStreet: data.assignedStreet || null,
    photos: [],
    busCardPeriods: [],
    notes: data.notes || '',
    rawMaterials: {
      originalPhotos: [],
      originalBusCardData: []
    },
    workflowStage: WORKFLOW_STAGE.PHOTO_IMPORTED,
    versions: [],
    createdAt: now,
    updatedAt: now,
    createdBy: data.createdBy || 'system',
    matchCount: 0,
    isDeleted: false
  };

  point.versions.push(createVersion(point, null, 'create', '初始创建'));
  
  return point;
}

function createVersion(current, previous, action, reason) {
  return {
    versionId: uuidv4(),
    timestamp: new Date().toISOString(),
    action,
    reason,
    previous: previous ? JSON.parse(JSON.stringify(previous)) : null,
    current: JSON.parse(JSON.stringify({
      name: current.name,
      streets: current.streets,
      boundaryStatus: current.boundaryStatus,
      assignedStreet: current.assignedStreet,
      notes: current.notes,
      busCardPeriods: current.busCardPeriods,
      matchCount: current.matchCount
    })),
    modifiedBy: current.updatedBy || 'system'
  };
}

function createPhotoRecord(fileInfo, pointId, importedBy) {
  return {
    id: uuidv4(),
    pointId,
    originalFilename: fileInfo.originalname,
    storedFilename: fileInfo.filename,
    fileHash: fileInfo.hash || uuidv4(),
    uploadedAt: new Date().toISOString(),
    uploadedBy: importedBy || 'system',
    raw: fileInfo
  };
}

function createBusCardPeriod(data, pointId, supplementedBy) {
  return {
    id: uuidv4(),
    pointId,
    period: data.period,
    passengerVolume: data.passengerVolume,
    notes: data.notes || '',
    rawText: data.rawText || '',
    supplementedAt: new Date().toISOString(),
    supplementedBy: supplementedBy || 'system'
  };
}

module.exports = {
  BOUNDARY_STATUS,
  WORKFLOW_STAGE,
  createPoint,
  createVersion,
  createPhotoRecord,
  createBusCardPeriod
};
