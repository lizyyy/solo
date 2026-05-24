export const sampleData = {
  duration: 60,
  
  gates: [
    { id: 'G101', x: -40, z: 20, flight: 'CA1234', status: '停靠中' },
    { id: 'G102', x: -20, z: 20, flight: 'MU5678', status: '停靠中' },
    { id: 'G103', x: 0, z: 20, flight: 'CZ9012', status: '准备中' },
    { id: 'G104', x: 20, z: 20, flight: 'HU3456', status: '空闲' },
    { id: 'G105', x: 40, z: 20, flight: 'ZH7890', status: '停靠中' }
  ],
  
  restrictedZones: [
    {
      id: 'R001',
      type: '跑道安全区',
      points: [
        { x: -80, z: -45 },
        { x: 80, z: -45 },
        { x: 80, z: -60 },
        { x: -80, z: -60 }
      ]
    },
    {
      id: 'R002',
      type: '危险品区',
      points: [
        { x: 60, z: 30 },
        { x: 80, z: 30 },
        { x: 80, z: 55 },
        { x: 60, z: 55 }
      ]
    },
    {
      id: 'R003',
      type: '维修禁区',
      points: [
        { x: -70, z: -10 },
        { x: -55, z: -10 },
        { x: -55, z: 10 },
        { x: -70, z: 10 }
      ]
    }
  ],
  
  operationNodes: [
    { id: 'N001', name: '油库', x: -50, z: 50, type: 'fuel', capacity: 2 },
    { id: 'N002', name: '行李中心', x: 50, z: 50, type: 'baggage', capacity: 3 },
    { id: 'N003', name: '摆渡车站', x: 0, z: 45, type: 'ferry', capacity: 2 },
    { id: 'N004', name: '维修站', x: -60, z: 30, type: 'maintenance', capacity: 1 }
  ],
  
  flights: [
    { id: 'CA1234', airline: '中国国航', schedule: { arrival: 5, departure: 35 }, delayed: false },
    { id: 'MU5678', airline: '东方航空', schedule: { arrival: 10, departure: 40 }, delayed: true },
    { id: 'CZ9012', airline: '南方航空', schedule: { arrival: 15, departure: 45 }, delayed: false },
    { id: 'ZH7890', airline: '深圳航空', schedule: { arrival: 8, departure: 38 }, delayed: false }
  ],
  
  vehicles: [
    {
      id: 'V001',
      name: '摆渡车-01',
      type: 'ferry',
      flight: 'CA1234',
      schedule: { start: 8, end: 25 },
      path: [
        { x: 0, z: 45 },
        { x: 0, z: 30 },
        { x: -40, z: 30 },
        { x: -40, z: 20 },
        { x: -40, z: 30 },
        { x: 0, z: 30 },
        { x: 0, z: 45 }
      ]
    },
    {
      id: 'V002',
      name: '油车-01',
      type: 'fuel',
      flight: 'MU5678',
      schedule: { start: 12, end: 30 },
      path: [
        { x: -50, z: 50 },
        { x: -50, z: 30 },
        { x: -20, z: 30 },
        { x: -20, z: 20 },
        { x: -20, z: 30 },
        { x: -50, z: 30 },
        { x: -50, z: 50 }
      ]
    },
    {
      id: 'V003',
      name: '行李车-01',
      type: 'baggage',
      flight: 'CZ9012',
      schedule: { start: 18, end: 38 },
      path: [
        { x: 50, z: 50 },
        { x: 50, z: 30 },
        { x: 0, z: 30 },
        { x: 0, z: 20 },
        { x: 0, z: 30 },
        { x: 50, z: 30 },
        { x: 50, z: 50 }
      ]
    },
    {
      id: 'V004',
      name: '摆渡车-02',
      type: 'ferry',
      flight: 'ZH7890',
      schedule: { start: 10, end: 28 },
      path: [
        { x: 0, z: 45 },
        { x: 0, z: 30 },
        { x: 40, z: 30 },
        { x: 40, z: 20 },
        { x: 40, z: 30 },
        { x: 0, z: 30 },
        { x: 0, z: 45 }
      ]
    },
    {
      id: 'V005',
      name: '油车-02',
      type: 'fuel',
      flight: 'CA1234',
      schedule: { start: 20, end: 40 },
      path: [
        { x: -50, z: 50 },
        { x: -50, z: 30 },
        { x: -40, z: 30 },
        { x: -40, z: 20 },
        { x: -40, z: 30 },
        { x: -50, z: 30 },
        { x: -50, z: 50 }
      ]
    },
    {
      id: 'V006',
      name: '行李车-02',
      type: 'baggage',
      flight: 'ZH7890',
      schedule: { start: 25, end: 45 },
      path: [
        { x: 50, z: 50 },
        { x: 50, z: 30 },
        { x: 40, z: 30 },
        { x: 40, z: 20 },
        { x: 40, z: 30 },
        { x: 50, z: 30 },
        { x: 50, z: 50 }
      ]
    }
  ]
}
