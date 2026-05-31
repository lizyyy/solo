const path = require('path');

module.exports = {
  dataDir: path.join(process.cwd(), 'data'),
  outputDir: path.join(process.cwd(), 'output'),
  noFlyZones: [
    {
      id: 'NFZ-001',
      name: '市政府办公区',
      center: { lat: 30.657, lng: 104.065 },
      radius: 500,
      level: 'critical'
    },
    {
      id: 'NFZ-002',
      name: '火车站周边',
      center: { lat: 30.672, lng: 104.082 },
      radius: 800,
      level: 'warning'
    },
    {
      id: 'NFZ-003',
      name: '医院急救区',
      center: { lat: 30.648, lng: 104.058 },
      radius: 300,
      level: 'critical'
    }
  ],
  safetyDistance: 100,
  battery: {
    warningVoltage: 22.5,
    criticalVoltage: 21.0,
    minReturnCapacity: 30
  }
};
