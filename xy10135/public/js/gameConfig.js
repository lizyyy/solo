const GameConfig = {
  MAP_WIDTH: 800,
  MAP_HEIGHT: 600,
  GAME_DURATION: 180,
  EMERGENCY_SPAWN_INTERVAL: 8000,
  MIN_SPAWN_INTERVAL: 3000,
  SPAWN_INTERVAL_DECREASE: 500,
  MAX_ACTIVE_EMERGENCIES: 5,
  
  VEHICLE_TYPES: {
    fire_truck: {
      name: '消防车',
      icon: '🚒',
      speed: 60,
      capacity: 4,
      waterCapacity: 2000,
      color: '#e74c3c'
    },
    water_tanker: {
      name: '水罐车',
      icon: '🚛',
      speed: 40,
      capacity: 2,
      waterCapacity: 10000,
      color: '#3498db'
    },
    ambulance: {
      name: '救护车',
      icon: '🚑',
      speed: 70,
      capacity: 3,
      waterCapacity: 0,
      color: '#f39c12'
    }
  },
  
  EMERGENCY_TYPES: {
    building_fire: {
      name: '建筑火灾',
      icon: '🏢',
      severity: 'high',
      baseReward: 500,
      waterNeeded: 3000,
      personnelNeeded: 6,
      maxTime: 120,
      color: '#c0392b'
    },
    residential_fire: {
      name: '住宅火灾',
      icon: '🏠',
      severity: 'medium',
      baseReward: 300,
      waterNeeded: 1500,
      personnelNeeded: 4,
      maxTime: 90,
      color: '#e67e22'
    },
    car_accident: {
      name: '交通事故',
      icon: '🚗',
      severity: 'medium',
      baseReward: 400,
      waterNeeded: 200,
      personnelNeeded: 3,
      maxTime: 60,
      color: '#f39c12'
    },
    small_fire: {
      name: '小型火情',
      icon: '🔥',
      severity: 'low',
      baseReward: 100,
      waterNeeded: 300,
      personnelNeeded: 2,
      maxTime: 45,
      color: '#e74c3c'
    }
  },
  
  INITIAL_RESOURCES: {
    stations: [
      { id: 'station_1', name: '消防一中队', x: 100, y: 100, personnel: 12 },
      { id: 'station_2', name: '消防二中队', x: 700, y: 500, personnel: 10 }
    ],
    vehicles: [
      { id: 'ft1', type: 'fire_truck', stationId: 'station_1', status: 'available', x: 100, y: 100, personnel: 0, water: 2000 },
      { id: 'ft2', type: 'fire_truck', stationId: 'station_1', status: 'available', x: 100, y: 100, personnel: 0, water: 2000 },
      { id: 'ft3', type: 'fire_truck', stationId: 'station_2', status: 'available', x: 700, y: 500, personnel: 0, water: 2000 },
      { id: 'wt1', type: 'water_tanker', stationId: 'station_1', status: 'available', x: 100, y: 100, personnel: 0, water: 10000 },
      { id: 'amb1', type: 'ambulance', stationId: 'station_2', status: 'available', x: 700, y: 500, personnel: 0, water: 0 }
    ],
    hydrants: [
      { id: 'h1', x: 200, y: 200, flowRate: 500 },
      { id: 'h2', x: 400, y: 300, flowRate: 500 },
      { id: 'h3', x: 600, y: 150, flowRate: 600 },
      { id: 'h4', x: 150, y: 450, flowRate: 400 },
      { id: 'h5', x: 550, y: 450, flowRate: 500 }
    ]
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameConfig;
}
