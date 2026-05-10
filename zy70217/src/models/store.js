const { v4: uuidv4 } = require('uuid');

const store = {
  vaccines: [],
  coldBoxes: [],
  inventory: [],
  appointments: [],
  appointmentLocks: [],
  exceptions: [],
  reports: []
};

function initSampleData() {
  const vaccines = [
    { id: 'v1', name: 'HPV九价疫苗', manufacturer: '默沙东', dosesRequired: 3 },
    { id: 'v2', name: '新冠疫苗', manufacturer: '国药', dosesRequired: 2 },
    { id: 'v3', name: '流感疫苗', manufacturer: '赛诺菲', dosesRequired: 1 }
  ];

  const coldBoxes = [
    {
      id: 'box1',
      name: '主冷库-01',
      minTemp: 2,
      maxTemp: 8,
      currentTemp: 5,
      status: 'normal',
      location: '一号冷库'
    },
    {
      id: 'box2',
      name: '备用冷库-02',
      minTemp: 2,
      maxTemp: 8,
      currentTemp: 6,
      status: 'normal',
      location: '二号冷库'
    }
  ];

  const inventory = [
    {
      id: 'inv1',
      vaccineId: 'v1',
      batchNo: 'HPV-2024-001',
      coldBoxId: 'box1',
      totalDoses: 50,
      lockedDoses: 0,
      frozenDoses: 0,
      availableDoses: 50,
      expiryDate: '2025-12-31',
      status: 'available'
    },
    {
      id: 'inv2',
      vaccineId: 'v1',
      batchNo: 'HPV-2024-002',
      coldBoxId: 'box2',
      totalDoses: 30,
      lockedDoses: 0,
      frozenDoses: 0,
      availableDoses: 30,
      expiryDate: '2025-10-31',
      status: 'available'
    },
    {
      id: 'inv3',
      vaccineId: 'v2',
      batchNo: 'COVID-2024-001',
      coldBoxId: 'box1',
      totalDoses: 100,
      lockedDoses: 0,
      frozenDoses: 0,
      availableDoses: 100,
      expiryDate: '2025-06-30',
      status: 'available'
    }
  ];

  store.vaccines = vaccines;
  store.coldBoxes = coldBoxes;
  store.inventory = inventory;
}

function generateId() {
  return uuidv4();
}

function getVaccineById(id) {
  return store.vaccines.find(v => v.id === id);
}

function getColdBoxById(id) {
  return store.coldBoxes.find(b => b.id === id);
}

function getColdBoxByInventoryId(inventoryId) {
  const inv = getInventoryById(inventoryId);
  if (!inv) return null;
  return getColdBoxById(inv.coldBoxId);
}

function getAllColdBoxes() {
  return [...store.coldBoxes];
}

function updateColdBox(boxId, updates) {
  const index = store.coldBoxes.findIndex(b => b.id === boxId);
  if (index === -1) return null;
  store.coldBoxes[index] = { ...store.coldBoxes[index], ...updates };
  return store.coldBoxes[index];
}

function getInventoryById(id) {
  return store.inventory.find(i => i.id === id);
}

function getInventoryByVaccineId(vaccineId) {
  return store.inventory.filter(i => i.vaccineId === vaccineId);
}

function getAvailableInventoryForVaccine(vaccineId) {
  return store.inventory.filter(
    i => i.vaccineId === vaccineId && i.status === 'available' && i.availableDoses > 0
  );
}

function getAllInventory() {
  return [...store.inventory];
}

function updateInventory(inventoryId, updates) {
  const index = store.inventory.findIndex(i => i.id === inventoryId);
  if (index === -1) return null;
  store.inventory[index] = { ...store.inventory[index], ...updates };
  return store.inventory[index];
}

function createAppointment(appointment) {
  const newAppointment = {
    id: generateId(),
    ...appointment,
    status: 'scheduled',
    createdAt: new Date().toISOString()
  };
  store.appointments.push(newAppointment);
  return newAppointment;
}

function getAppointmentById(id) {
  return store.appointments.find(a => a.id === id);
}

function updateAppointment(appointmentId, updates) {
  const index = store.appointments.findIndex(a => a.id === appointmentId);
  if (index === -1) return null;
  store.appointments[index] = { ...store.appointments[index], ...updates };
  return store.appointments[index];
}

function getAppointmentsByInventoryId(inventoryId) {
  return store.appointments.filter(a => a.inventoryId === inventoryId);
}

function createAppointmentLock(lock) {
  const newLock = {
    id: generateId(),
    ...lock,
    status: 'active',
    createdAt: new Date().toISOString()
  };
  store.appointmentLocks.push(newLock);
  return newLock;
}

function getAppointmentLockByAppointmentId(appointmentId) {
  return store.appointmentLocks.find(l => l.appointmentId === appointmentId && l.status === 'active');
}

function releaseLock(lockId) {
  const index = store.appointmentLocks.findIndex(l => l.id === lockId);
  if (index === -1) return null;
  store.appointmentLocks[index].status = 'released';
  store.appointmentLocks[index].releasedAt = new Date().toISOString();
  return store.appointmentLocks[index];
}

function getLocksByInventoryId(inventoryId) {
  return store.appointmentLocks.filter(l => l.inventoryId === inventoryId && l.status === 'active');
}

function createExceptionRecord(exception) {
  const newException = {
    id: generateId(),
    ...exception,
    createdAt: new Date().toISOString()
  };
  store.exceptions.push(newException);
  return newException;
}

function getExceptionById(id) {
  return store.exceptions.find(e => e.id === id);
}

function updateException(exceptionId, updates) {
  const index = store.exceptions.findIndex(e => e.id === exceptionId);
  if (index === -1) return null;
  store.exceptions[index] = { ...store.exceptions[index], ...updates, updatedAt: new Date().toISOString() };
  return store.exceptions[index];
}

function getExceptionsByColdBoxId(coldBoxId) {
  return store.exceptions.filter(e => e.coldBoxId === coldBoxId);
}

function getExceptionsByInventoryId(inventoryId) {
  return store.exceptions.filter(e => e.inventoryId === inventoryId);
}

function getAllExceptions() {
  return [...store.exceptions];
}

module.exports = {
  store,
  initSampleData,
  generateId,
  getVaccineById,
  getColdBoxById,
  getColdBoxByInventoryId,
  getAllColdBoxes,
  updateColdBox,
  getInventoryById,
  getInventoryByVaccineId,
  getAvailableInventoryForVaccine,
  getAllInventory,
  updateInventory,
  createAppointment,
  getAppointmentById,
  updateAppointment,
  getAppointmentsByInventoryId,
  createAppointmentLock,
  getAppointmentLockByAppointmentId,
  releaseLock,
  getLocksByInventoryId,
  createExceptionRecord,
  getExceptionById,
  updateException,
  getExceptionsByColdBoxId,
  getExceptionsByInventoryId,
  getAllExceptions
};
