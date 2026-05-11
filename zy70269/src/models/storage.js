const { v4: uuidv4 } = require('uuid');

const storage = {
  stops: new Map(),
  routes: new Map(),
  reports: new Map(),
  dispatches: new Map(),
  reportClusters: new Map()
};

function initSampleData() {
  const stop1 = {
    id: 'STOP-001',
    name: '人民广场站',
    address: '上海市黄浦区人民大道100号',
    coordinates: { lat: 31.2304, lng: 121.4737 },
    status: 'ACTIVE',
    routeIds: ['ROUTE-01', 'ROUTE-02'],
    hasAdSlots: true,
    lastVerifiedAt: new Date().toISOString()
  };
  const stop2 = {
    id: 'STOP-002',
    name: '南京路站',
    address: '上海市黄浦区南京东路1号',
    coordinates: { lat: 31.2350, lng: 121.4760 },
    status: 'ACTIVE',
    routeIds: ['ROUTE-01', 'ROUTE-03'],
    hasAdSlots: false,
    lastVerifiedAt: new Date().toISOString()
  };
  
  storage.stops.set(stop1.id, stop1);
  storage.stops.set(stop2.id, stop2);
  
  const route1 = {
    id: 'ROUTE-01',
    name: '1路',
    direction: '上行',
    stopIds: ['STOP-001', 'STOP-002', 'STOP-003'],
    frequency: '5-8分钟',
    firstBus: '05:30',
    lastBus: '23:00',
    version: 3
  };
  const route2 = {
    id: 'ROUTE-02',
    name: '2路',
    direction: '下行',
    stopIds: ['STOP-001', 'STOP-004'],
    frequency: '10-15分钟',
    firstBus: '06:00',
    lastBus: '22:00',
    version: 1
  };
  const route3 = {
    id: 'ROUTE-03',
    name: '3路',
    direction: '上行',
    stopIds: ['STOP-002', 'STOP-005'],
    frequency: '8-12分钟',
    firstBus: '05:45',
    lastBus: '22:30',
    version: 2
  };
  
  storage.routes.set(route1.id, route1);
  storage.routes.set(route2.id, route2);
  storage.routes.set(route3.id, route3);
}

function generateId(prefix) {
  return `${prefix}-${uuidv4().split('-')[0].toUpperCase()}`;
}

module.exports = {
  storage,
  initSampleData,
  generateId
};
