const { v4: uuidv4 } = require('uuid');

const data = {
  freezers: [],
  zones: [],
  slots: [],
  vendors: [],
  occupancyRecords: [],
  billingRules: []
};

const generateId = () => uuidv4();

const freezerStorage = {
  getAll() {
    return [...data.freezers];
  },
  
  getById(id) {
    return data.freezers.find(f => f.id === id);
  },
  
  create(freezer) {
    const newFreezer = {
      id: generateId(),
      name: freezer.name,
      location: freezer.location,
      totalSlots: freezer.totalSlots || 12,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.freezers.push(newFreezer);
    return newFreezer;
  },
  
  update(id, updates) {
    const index = data.freezers.findIndex(f => f.id === id);
    if (index === -1) return null;
    data.freezers[index] = {
      ...data.freezers[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    return data.freezers[index];
  },
  
  delete(id) {
    const index = data.freezers.findIndex(f => f.id === id);
    if (index === -1) return false;
    data.freezers.splice(index, 1);
    return true;
  }
};

const zoneStorage = {
  getAll() {
    return [...data.zones];
  },
  
  getByFreezerId(freezerId) {
    return data.zones.filter(z => z.freezerId === freezerId);
  },
  
  create(zone) {
    const newZone = {
      id: generateId(),
      freezerId: zone.freezerId,
      name: zone.name,
      zoneType: zone.zoneType,
      pricePerHour: zone.pricePerHour,
      tempRange: zone.tempRange,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.zones.push(newZone);
    return newZone;
  },
  
  update(id, updates) {
    const index = data.zones.findIndex(z => z.id === id);
    if (index === -1) return null;
    data.zones[index] = {
      ...data.zones[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    return data.zones[index];
  },
  
  delete(id) {
    const index = data.zones.findIndex(z => z.id === id);
    if (index === -1) return false;
    data.zones.splice(index, 1);
    return true;
  }
};

const slotStorage = {
  getAll() {
    return [...data.slots];
  },
  
  getByFreezerId(freezerId) {
    return data.slots.filter(s => s.freezerId === freezerId);
  },
  
  getByZoneId(zoneId) {
    return data.slots.filter(s => s.zoneId === zoneId);
  },
  
  create(slot) {
    const newSlot = {
      id: generateId(),
      freezerId: slot.freezerId,
      zoneId: slot.zoneId,
      slotNumber: slot.slotNumber,
      status: 'available',
      currentVendorId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.slots.push(newSlot);
    return newSlot;
  },
  
  update(id, updates) {
    const index = data.slots.findIndex(s => s.id === id);
    if (index === -1) return null;
    data.slots[index] = {
      ...data.slots[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    return data.slots[index];
  },
  
  delete(id) {
    const index = data.slots.findIndex(s => s.id === id);
    if (index === -1) return false;
    data.slots.splice(index, 1);
    return true;
  }
};

const vendorStorage = {
  getAll() {
    return [...data.vendors];
  },
  
  getById(id) {
    return data.vendors.find(v => v.id === id);
  },
  
  create(vendor) {
    const newVendor = {
      id: generateId(),
      name: vendor.name,
      phone: vendor.phone,
      stallNumber: vendor.stallNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.vendors.push(newVendor);
    return newVendor;
  },
  
  update(id, updates) {
    const index = data.vendors.findIndex(v => v.id === id);
    if (index === -1) return null;
    data.vendors[index] = {
      ...data.vendors[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    return data.vendors[index];
  },
  
  delete(id) {
    const index = data.vendors.findIndex(v => v.id === id);
    if (index === -1) return false;
    data.vendors.splice(index, 1);
    return true;
  }
};

const occupancyStorage = {
  getAll() {
    return [...data.occupancyRecords];
  },
  
  getByVendorId(vendorId) {
    return data.occupancyRecords.filter(r => r.vendorId === vendorId);
  },
  
  getBySlotId(slotId) {
    return data.occupancyRecords.filter(r => r.slotId === slotId);
  },
  
  getPending() {
    return data.occupancyRecords.filter(r => r.status === 'pending');
  },
  
  getConfirmed() {
    return data.occupancyRecords.filter(r => r.status === 'confirmed');
  },
  
  create(record) {
    const newRecord = {
      id: generateId(),
      vendorId: record.vendorId,
      slotId: record.slotId,
      freezerId: record.freezerId,
      zoneId: record.zoneId,
      startTime: record.startTime,
      endTime: record.endTime,
      status: 'pending',
      notes: record.notes || '',
      pricePerHour: record.pricePerHour,
      totalCost: record.totalCost,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.occupancyRecords.push(newRecord);
    return newRecord;
  },
  
  update(id, updates) {
    const index = data.occupancyRecords.findIndex(r => r.id === id);
    if (index === -1) return null;
    data.occupancyRecords[index] = {
      ...data.occupancyRecords[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    return data.occupancyRecords[index];
  },
  
  delete(id) {
    const index = data.occupancyRecords.findIndex(r => r.id === id);
    if (index === -1) return false;
    data.occupancyRecords.splice(index, 1);
    return true;
  }
};

const billingRuleStorage = {
  getAll() {
    return [...data.billingRules];
  },
  
  create(rule) {
    const newRule = {
      id: generateId(),
      zoneType: rule.zoneType,
      pricePerHour: rule.pricePerHour,
      minHours: rule.minHours || 1,
      maxHours: rule.maxHours || 24,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    data.billingRules.push(newRule);
    return newRule;
  },
  
  update(id, updates) {
    const index = data.billingRules.findIndex(r => r.id === id);
    if (index === -1) return null;
    data.billingRules[index] = {
      ...data.billingRules[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    return data.billingRules[index];
  },
  
  delete(id) {
    const index = data.billingRules.findIndex(r => r.id === id);
    if (index === -1) return false;
    data.billingRules.splice(index, 1);
    return true;
  }
};

const sampleDataStorage = {
  loadSampleData() {
    data.freezers = [
      {
        id: 'freezer-1',
        name: '市集冷柜A',
        location: '一号入口左侧',
        totalSlots: 12,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    data.zones = [
      {
        id: 'zone-1',
        freezerId: 'freezer-1',
        name: '冷藏区',
        zoneType: 'chilled',
        pricePerHour: 2.5,
        tempRange: '0-4°C',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'zone-2',
        freezerId: 'freezer-1',
        name: '冷冻区',
        zoneType: 'frozen',
        pricePerHour: 3.0,
        tempRange: '-18°C以下',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    data.slots = [
      { id: 'slot-1', freezerId: 'freezer-1', zoneId: 'zone-1', slotNumber: 1, status: 'available', currentVendorId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'slot-2', freezerId: 'freezer-1', zoneId: 'zone-1', slotNumber: 2, status: 'available', currentVendorId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'slot-3', freezerId: 'freezer-1', zoneId: 'zone-1', slotNumber: 3, status: 'available', currentVendorId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'slot-4', freezerId: 'freezer-1', zoneId: 'zone-1', slotNumber: 4, status: 'available', currentVendorId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'slot-5', freezerId: 'freezer-1', zoneId: 'zone-1', slotNumber: 5, status: 'available', currentVendorId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'slot-6', freezerId: 'freezer-1', zoneId: 'zone-1', slotNumber: 6, status: 'available', currentVendorId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'slot-7', freezerId: 'freezer-1', zoneId: 'zone-2', slotNumber: 7, status: 'available', currentVendorId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'slot-8', freezerId: 'freezer-1', zoneId: 'zone-2', slotNumber: 8, status: 'available', currentVendorId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'slot-9', freezerId: 'freezer-1', zoneId: 'zone-2', slotNumber: 9, status: 'available', currentVendorId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'slot-10', freezerId: 'freezer-1', zoneId: 'zone-2', slotNumber: 10, status: 'available', currentVendorId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'slot-11', freezerId: 'freezer-1', zoneId: 'zone-2', slotNumber: 11, status: 'available', currentVendorId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'slot-12', freezerId: 'freezer-1', zoneId: 'zone-2', slotNumber: 12, status: 'available', currentVendorId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];
    
    data.vendors = [
      { id: 'vendor-1', name: '李记生鲜', phone: '13800138001', stallNumber: 'A01', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'vendor-2', name: '王记水饺', phone: '13800138002', stallNumber: 'B03', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'vendor-3', name: '张氏海鲜', phone: '13800138003', stallNumber: 'C05', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'vendor-4', name: '刘家卤味', phone: '13800138004', stallNumber: 'D02', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];
    
    data.billingRules = [
      { id: 'rule-1', zoneType: 'chilled', pricePerHour: 2.5, minHours: 1, maxHours: 24, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'rule-2', zoneType: 'frozen', pricePerHour: 3.0, minHours: 1, maxHours: 24, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];
    
    return { success: true, message: '示例数据已加载' };
  },
  
  clearAllData() {
    data.freezers = [];
    data.zones = [];
    data.slots = [];
    data.vendors = [];
    data.occupancyRecords = [];
    data.billingRules = [];
    return { success: true, message: '所有数据已清空' };
  }
};

module.exports = {
  freezerStorage,
  zoneStorage,
  slotStorage,
  vendorStorage,
  occupancyStorage,
  billingRuleStorage,
  sampleDataStorage,
  generateId
};
