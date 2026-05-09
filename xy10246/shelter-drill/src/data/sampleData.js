export const sampleLayouts = [
  {
    id: 'community-park',
    name: '社区公园避难点',
    description: '标准社区避难点配置，适合中小型社区演练',
    layout: {
      entrances: [
        { id: 'e1', name: '东门入口', maxCapacity: 200, currentFlow: 0, position: { x: 0, y: 50 } },
        { id: 'e2', name: '西门入口', maxCapacity: 150, currentFlow: 0, position: { x: 100, y: 50 } }
      ],
      tentZones: [
        { id: 't1', name: 'A区帐篷', capacity: 500, currentOccupancy: 0, position: { x: 30, y: 30 }, connectedEntrances: ['e1', 'e2'] },
        { id: 't2', name: 'B区帐篷', capacity: 400, currentOccupancy: 0, position: { x: 70, y: 30 }, connectedEntrances: ['e2'] },
        { id: 't3', name: 'C区帐篷', capacity: 300, currentOccupancy: 0, position: { x: 50, y: 60 }, connectedEntrances: ['e1'] }
      ],
      supplyPoints: [
        { id: 's1', name: '物资点1-主供应', supplies: ['water', 'food', 'medicine'], position: { x: 50, y: 80 } },
        { id: 's2', name: '物资点2-应急医疗', supplies: ['medicine', 'first-aid'], position: { x: 30, y: 80 } }
      ],
      paths: [
        { from: 'e1', to: 't1', distance: 50 },
        { from: 'e1', to: 't3', distance: 40 },
        { from: 'e2', to: 't1', distance: 60 },
        { from: 'e2', to: 't2', distance: 30 },
        { from: 't1', to: 's1', distance: 40 },
        { from: 't2', to: 's1', distance: 50 },
        { from: 't3', to: 's1', distance: 30 },
        { from: 't3', to: 's2', distance: 25 }
      ]
    }
  },
  {
    id: 'large-stadium',
    name: '大型体育馆避难点',
    description: '大型避难场所配置，适合城市级大规模演练',
    layout: {
      entrances: [
        { id: 'e1', name: '主入口', maxCapacity: 500, currentFlow: 0, position: { x: 0, y: 50 } },
        { id: 'e2', name: '北入口', maxCapacity: 300, currentFlow: 0, position: { x: 50, y: 0 } },
        { id: 'e3', name: '南入口', maxCapacity: 300, currentFlow: 0, position: { x: 50, y: 100 } }
      ],
      tentZones: [
        { id: 't1', name: '主场区', capacity: 2000, currentOccupancy: 0, position: { x: 50, y: 50 }, connectedEntrances: ['e1', 'e2', 'e3'] },
        { id: 't2', name: '训练区A', capacity: 800, currentOccupancy: 0, position: { x: 20, y: 50 }, connectedEntrances: ['e1'] },
        { id: 't3', name: '训练区B', capacity: 800, currentOccupancy: 0, position: { x: 80, y: 50 }, connectedEntrances: ['e1'] },
        { id: 't4', name: '附属楼区', capacity: 600, currentOccupancy: 0, position: { x: 50, y: 25 }, connectedEntrances: ['e2'] }
      ],
      supplyPoints: [
        { id: 's1', name: '中心物资库', supplies: ['water', 'food', 'medicine', 'first-aid', 'blanket'], position: { x: 50, y: 50 } },
        { id: 's2', name: '北侧医疗点', supplies: ['medicine', 'first-aid'], position: { x: 50, y: 10 } },
        { id: 's3', name: '南侧饮水点', supplies: ['water', 'food'], position: { x: 50, y: 90 } }
      ],
      paths: [
        { from: 'e1', to: 't1', distance: 30 },
        { from: 'e1', to: 't2', distance: 40 },
        { from: 'e1', to: 't3', distance: 40 },
        { from: 'e2', to: 't1', distance: 40 },
        { from: 'e2', to: 't4', distance: 20 },
        { from: 'e3', to: 't1', distance: 40 },
        { from: 't1', to: 's1', distance: 10 },
        { from: 't2', to: 's1', distance: 35 },
        { from: 't3', to: 's1', distance: 35 },
        { from: 't4', to: 's2', distance: 20 },
        { from: 't1', to: 's3', distance: 45 }
      ]
    }
  }
]

export const sampleInflowScenarios = [
  {
    id: 'gradual',
    name: '渐进式流入',
    description: '人员逐渐抵达，适合正常演练',
    timeSteps: [
      { time: '0-10min', inflow: 50, entrance: 'e1' },
      { time: '10-20min', inflow: 100, entrance: 'e1' },
      { time: '20-30min', inflow: 80, entrance: 'e2' },
      { time: '30-40min', inflow: 120, entrance: 'e1' },
      { time: '40-50min', inflow: 60, entrance: 'e2' },
      { time: '50-60min', inflow: 40, entrance: 'e1' }
    ]
  },
  {
    id: 'sudden',
    name: '突发式流入',
    description: '大量人员同时抵达，压力测试场景',
    timeSteps: [
      { time: '0-5min', inflow: 300, entrance: 'e1' },
      { time: '5-10min', inflow: 250, entrance: 'e2' },
      { time: '10-15min', inflow: 200, entrance: 'e1' },
      { time: '15-20min', inflow: 150, entrance: 'e2' }
    ]
  },
  {
    id: 'balanced',
    name: '均衡流入',
    description: '多入口均衡分配，理想状态',
    timeSteps: [
      { time: '0-10min', inflow: 80, entrance: 'e1' },
      { time: '0-10min', inflow: 80, entrance: 'e2' },
      { time: '10-20min', inflow: 100, entrance: 'e1' },
      { time: '10-20min', inflow: 100, entrance: 'e2' },
      { time: '20-30min', inflow: 120, entrance: 'e1' },
      { time: '20-30min', inflow: 120, entrance: 'e2' }
    ]
  }
]

export const anomalySamples = {
  duplicateData: {
    description: '重复数据样例：包含重复的入口ID和帐篷区记录',
    layout: {
      entrances: [
        { id: 'e1', name: '入口1', maxCapacity: 200, currentFlow: 0 },
        { id: 'e1', name: '入口1-重复', maxCapacity: 150, currentFlow: 0 }
      ],
      tentZones: [
        { id: 't1', name: '帐篷区A', capacity: 500, currentOccupancy: 0 },
        { id: 't1', name: '帐篷区A-重复', capacity: 400, currentOccupancy: 0 }
      ],
      supplyPoints: [
        { id: 's1', name: '物资点1', supplies: ['water', 'food'] }
      ],
      paths: []
    }
  },
  missingFields: {
    description: '缺字段样例：关键数据字段缺失',
    layout: {
      entrances: [
        { id: 'e1', name: '入口1' }
      ],
      tentZones: [
        { id: 't1', name: '帐篷区A' }
      ],
      supplyPoints: [
        { id: 's1', supplies: ['water'] }
      ],
      paths: []
    }
  },
  manualError: {
    description: '人工改错样例：数据逻辑错误，容量值为负数或不合理',
    layout: {
      entrances: [
        { id: 'e1', name: '入口1', maxCapacity: -50, currentFlow: 0 },
        { id: 'e2', name: '入口2', maxCapacity: 0, currentFlow: 100 }
      ],
      tentZones: [
        { id: 't1', name: '帐篷区A', capacity: -100, currentOccupancy: 50 },
        { id: 't2', name: '帐篷区B', capacity: 300, currentOccupancy: 500 }
      ],
      supplyPoints: [
        { id: 's1', name: '物资点1', supplies: [] }
      ],
      paths: []
    }
  }
}

export const defaultLayout = sampleLayouts[0].layout
export const defaultScenario = sampleInflowScenarios[0]
