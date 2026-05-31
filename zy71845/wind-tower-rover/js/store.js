const DB_NAME = 'WindTowerRoverDB';
const DB_VERSION = 1;
const STORES = {
  points: 'points',
  models: 'models',
  inspections: 'inspections',
  workflow: 'workflow',
  photos: 'photos'
};

let db = null;

function openDB() {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORES.points)) {
        const ps = database.createObjectStore(STORES.points, { keyPath: 'id' });
        ps.createIndex('status', 'status', { unique: false });
        ps.createIndex('name', 'name', { unique: false });
      }
      if (!database.objectStoreNames.contains(STORES.models)) {
        database.createObjectStore(STORES.models, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORES.inspections)) {
        const is = database.createObjectStore(STORES.inspections, { keyPath: 'id' });
        is.createIndex('pointId', 'pointId', { unique: false });
      }
      if (!database.objectStoreNames.contains(STORES.workflow)) {
        const ws = database.createObjectStore(STORES.workflow, { keyPath: 'id' });
        ws.createIndex('pointId', 'pointId', { unique: false });
        ws.createIndex('action', 'action', { unique: false });
        ws.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!database.objectStoreNames.contains(STORES.photos)) {
        database.createObjectStore(STORES.photos, { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return openDB().then(database => {
    const transaction = database.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  });
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putPoint(point) {
  const store = await tx(STORES.points, 'readwrite');
  return promisify(store.put(point));
}

export async function getPoint(id) {
  const store = await tx(STORES.points);
  return promisify(store.get(id));
}

export async function getAllPoints() {
  const store = await tx(STORES.points);
  return promisify(store.getAll());
}

export async function deletePoint(id) {
  const store = await tx(STORES.points, 'readwrite');
  return promisify(store.delete(id));
}

export async function putModel(model) {
  const store = await tx(STORES.models, 'readwrite');
  return promisify(store.put(model));
}

export async function getModel(id) {
  const store = await tx(STORES.models);
  return promisify(store.get(id));
}

export async function getAllModels() {
  const store = await tx(STORES.models);
  return promisify(store.getAll());
}

export async function deleteModel(id) {
  const store = await tx(STORES.models, 'readwrite');
  return promisify(store.delete(id));
}

export async function putInspection(inspection) {
  const store = await tx(STORES.inspections, 'readwrite');
  return promisify(store.put(inspection));
}

export async function getInspection(id) {
  const store = await tx(STORES.inspections);
  return promisify(store.get(id));
}

export async function getInspectionsByPoint(pointId) {
  const store = await tx(STORES.inspections);
  const index = store.index('pointId');
  return promisify(index.getAll(pointId));
}

export async function getAllInspections() {
  const store = await tx(STORES.inspections);
  return promisify(store.getAll());
}

export async function deleteInspection(id) {
  const store = await tx(STORES.inspections, 'readwrite');
  return promisify(store.delete(id));
}

export async function putWorkflow(record) {
  const store = await tx(STORES.workflow, 'readwrite');
  return promisify(store.put(record));
}

export async function getWorkflowByPoint(pointId) {
  const store = await tx(STORES.workflow);
  const index = store.index('pointId');
  return promisify(index.getAll(pointId));
}

export async function getAllWorkflow() {
  const store = await tx(STORES.workflow);
  return promisify(store.getAll());
}

export async function getWorkflowByAction(action) {
  const store = await tx(STORES.workflow);
  const index = store.index('action');
  return promisify(index.getAll(action));
}

export async function putPhoto(photo) {
  const store = await tx(STORES.photos, 'readwrite');
  return promisify(store.put(photo));
}

export async function getPhoto(id) {
  const store = await tx(STORES.photos);
  return promisify(store.get(id));
}

export async function getAllPhotos() {
  const store = await tx(STORES.photos);
  return promisify(store.getAll());
}

export async function clearAll() {
  const database = await openDB();
  const storeNames = [STORES.points, STORES.models, STORES.inspections, STORES.workflow, STORES.photos];
  const transaction = database.transaction(storeNames, 'readwrite');
  storeNames.forEach(name => transaction.objectStore(name).clear());
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function importPoints(points) {
  const database = await openDB();
  const transaction = database.transaction(STORES.points, 'readwrite');
  const store = transaction.objectStore(STORES.points);
  let count = 0;
  for (const point of points) {
    const p = {
      id: point.id || `P${Date.now()}_${count}`,
      name: point.name || point.id || `未命名_${count}`,
      x: Number(point.x) || 0,
      z: Number(point.z) || 0,
      elevation: Number(point.elevation) || 0,
      type: point.type || 'turbine',
      linkedModelId: point.linkedModelId || null,
      linkedInspectionIds: point.linkedInspectionIds || [],
      flags: point.flags || [],
      status: point.status || 'pending',
      confirmStatus: point.confirmStatus || 'pending',
      notes: point.notes || '',
      ...point
    };
    p.id = p.id || `P${Date.now()}_${count}`;
    p.name = p.name || p.id;
    store.put(p);
    count++;
  }
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(count);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function importModels(models) {
  const database = await openDB();
  const transaction = database.transaction(STORES.models, 'readwrite');
  const store = transaction.objectStore(STORES.models);
  let count = 0;
  for (const model of models) {
    const m = {
      id: model.id || `M${Date.now()}_${count}`,
      name: model.name || `模型_${count}`,
      hubHeight: Number(model.hubHeight) || 80,
      rotorDiameter: Number(model.rotorDiameter) || 90,
      ratedPower: Number(model.ratedPower) || 2000,
      ...model
    };
    store.put(m);
    count++;
  }
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(count);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function importInspections(inspections) {
  const database = await openDB();
  const transaction = database.transaction(STORES.inspections, 'readwrite');
  const store = transaction.objectStore(STORES.inspections);
  let count = 0;
  for (const insp of inspections) {
    const i = {
      id: insp.id || `I${Date.now()}_${count}`,
      pointId: insp.pointId || '',
      date: insp.date || new Date().toISOString().slice(0, 10),
      result: insp.result || 'pending',
      findings: insp.findings || '',
      inspector: insp.inspector || '',
      photoIds: insp.photoIds || [],
      photoFiles: insp.photoFiles || [],
      ...insp
    };
    store.put(i);
    count++;
  }
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(count);
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getFullEvidenceChain(pointId) {
  const point = await getPoint(pointId);
  if (!point) return null;
  const inspections = await getInspectionsByPoint(pointId);
  const model = point.linkedModelId ? await getModel(point.linkedModelId) : null;
  const workflowHistory = await getWorkflowByPoint(pointId);
  const allPhotos = [];
  for (const insp of inspections) {
    if (insp.photoIds && insp.photoIds.length) {
      for (const pid of insp.photoIds) {
        const photo = await getPhoto(pid);
        if (photo) allPhotos.push(photo);
      }
    }
  }
  return {
    point,
    model,
    inspections,
    workflowHistory,
    photos: allPhotos
  };
}

export async function exportAllData(options = {}) {
  const points = await getAllPoints();
  const models = await getAllModels();
  const inspections = await getAllInspections();
  const workflow = await getAllWorkflow();
  const photos = options.includePhotos ? await getAllPhotos() : [];

  const result = {
    version: '1.0',
    exportTime: new Date().toISOString(),
    points,
    models,
    inspections,
    workflow: options.includeHistory ? workflow : [],
    photos: photos.map(p => ({
      id: p.id,
      name: p.name,
      inspectionId: p.inspectionId,
      hash: p.hash,
      ...(options.includePhotos ? { data: p.data } : {})
    }))
  };

  return result;
}
