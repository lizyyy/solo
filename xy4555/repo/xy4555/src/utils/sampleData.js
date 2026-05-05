export const sampleData = {
  tunnel_sections: [
    {
      id: 'section_001',
      name: '东段管廊-1段',
      code: 'GL-DD-001',
      startPoint: { x: 0, y: -5, z: 0 },
      endPoint: { x: 30, y: -5, z: 0 },
      width: 3,
      height: 2.5,
      depth: -5,
      description: '东段主干道地下管廊，包含电力、通信、燃气等管线',
      sensors: ['sensor_001', 'sensor_002'],
      manholes: ['manhole_001', 'manhole_002']
    },
    {
      id: 'section_002',
      name: '东段管廊-2段',
      code: 'GL-DD-002',
      startPoint: { x: 30, y: -5, z: 0 },
      endPoint: { x: 60, y: -5, z: 0 },
      width: 3,
      height: 2.5,
      depth: -5,
      description: '东段延伸段，连接交叉口节点',
      sensors: ['sensor_003', 'sensor_004'],
      manholes: ['manhole_003', 'manhole_004']
    },
    {
      id: 'section_003',
      name: '北段管廊-1段',
      code: 'GL-BD-001',
      startPoint: { x: 30, y: -5, z: 0 },
      endPoint: { x: 30, y: -5, z: 40 },
      width: 3,
      height: 2.5,
      depth: -5,
      description: '北段主管道，连接商业区',
      sensors: ['sensor_005', 'sensor_006'],
      manholes: ['manhole_005', 'manhole_006']
    }
  ],
  gas_sensors: [
    {
      id: 'sensor_001',
      code: 'GS-001',
      name: '东段1号气体传感器',
      sectionId: 'section_001',
      position: { x: 10, y: -5, z: 0 },
      type: 'multi_gas',
      oxygenLevel: 18.5,
      flammableGasLevel: 5,
      h2sLevel: 0,
      coLevel: 0,
      temperature: 18,
      humidity: 70,
      lastUpdate: '2026-05-04T22:30:00Z',
      alarmStatus: 'warning'
    },
    {
      id: 'sensor_002',
      code: 'GS-002',
      name: '东段2号气体传感器',
      sectionId: 'section_001',
      position: { x: 25, y: -5, z: 0 },
      type: 'multi_gas',
      oxygenLevel: 20.9,
      flammableGasLevel: 25,
      h2sLevel: 12,
      coLevel: 0,
      temperature: 22,
      humidity: 65,
      lastUpdate: '2026-05-04T22:45:00Z',
      alarmStatus: 'danger'
    },
    {
      id: 'sensor_003',
      code: 'GS-003',
      name: '东段3号气体传感器',
      sectionId: 'section_002',
      position: { x: 40, y: -5, z: 0 },
      type: 'multi_gas',
      oxygenLevel: 20.8,
      flammableGasLevel: 2,
      h2sLevel: 0,
      coLevel: 0,
      temperature: 20,
      humidity: 60,
      lastUpdate: '2026-05-04T23:00:00Z',
      alarmStatus: 'normal'
    },
    {
      id: 'sensor_004',
      code: 'GS-004',
      name: '东段4号气体传感器',
      sectionId: 'section_002',
      position: { x: 55, y: -5, z: 0 },
      type: 'multi_gas',
      oxygenLevel: 19.2,
      flammableGasLevel: 8,
      h2sLevel: 0,
      coLevel: 0,
      temperature: 19,
      humidity: 72,
      lastUpdate: '2026-05-04T23:15:00Z',
      alarmStatus: 'warning'
    },
    {
      id: 'sensor_005',
      code: 'GS-005',
      name: '北段1号气体传感器',
      sectionId: 'section_003',
      position: { x: 30, y: -5, z: 15 },
      type: 'multi_gas',
      oxygenLevel: 20.9,
      flammableGasLevel: 3,
      h2sLevel: 0,
      coLevel: 0,
      temperature: 21,
      humidity: 58,
      lastUpdate: '2026-05-04T22:00:00Z',
      alarmStatus: 'normal'
    },
    {
      id: 'sensor_006',
      code: 'GS-006',
      name: '北段2号气体传感器',
      sectionId: 'section_003',
      position: { x: 30, y: -5, z: 35 },
      type: 'multi_gas',
      oxygenLevel: 20.8,
      flammableGasLevel: 1,
      h2sLevel: 0,
      coLevel: 0,
      temperature: 20,
      humidity: 55,
      lastUpdate: '2026-05-04T22:30:00Z',
      alarmStatus: 'normal'
    }
  ],
  inspection_tickets: [
    {
      id: 'ticket_001',
      ticketNo: 'GD-20260504-001',
      sectionId: 'section_001',
      sectionName: '东段管廊-1段',
      manholeId: 'manhole_001',
      inspectionType: '气体检测',
      status: 'pending',
      createdAt: '2026-05-04T20:00:00Z',
      scheduledTime: '2026-05-04T22:00:00Z',
      inspector: '张三',
      items: ['氧气检测', '可燃气体检测', '硫化氢检测'],
      findings: '',
      photos: [],
      closedAt: '',
      closingRemark: ''
    },
    {
      id: 'ticket_002',
      ticketNo: 'GD-20260504-002',
      sectionId: 'section_002',
      sectionName: '东段管廊-2段',
      manholeId: 'manhole_003',
      inspectionType: '管道巡检',
      status: 'in_progress',
      createdAt: '2026-05-04T21:00:00Z',
      scheduledTime: '2026-05-04T23:00:00Z',
      inspector: '李四',
      items: ['管线外观检查', '积水情况', '通风情况'],
      findings: '发现少量积水',
      photos: [],
      closedAt: '',
      closingRemark: ''
    },
    {
      id: 'ticket_003',
      ticketNo: 'GD-20260504-003',
      sectionId: 'section_003',
      sectionName: '北段管廊-1段',
      manholeId: 'manhole_005',
      inspectionType: '例行检查',
      status: 'completed',
      createdAt: '2026-05-04T19:00:00Z',
      scheduledTime: '2026-05-04T20:00:00Z',
      inspector: '王五',
      items: ['设备状态', '环境参数'],
      findings: '一切正常',
      photos: [],
      closedAt: '2026-05-04T20:30:00Z',
      closingRemark: '巡检完成，无异常'
    }
  ],
  manhole_records: [
    {
      id: 'manhole_001',
      manholeNo: 'MH-001',
      sectionId: 'section_001',
      position: { x: 5, y: -5, z: 0 },
      openTime: '2026-05-04T20:15:00Z',
      closeTime: '2026-05-04T21:45:00Z',
      operator: '张三',
      purpose: '气体检测',
      photos: [],
      status: 'closed',
      notes: ''
    },
    {
      id: 'manhole_002',
      manholeNo: 'MH-002',
      sectionId: 'section_001',
      position: { x: 28, y: -5, z: 0 },
      openTime: '2026-05-04T22:00:00Z',
      closeTime: '',
      operator: '李四',
      purpose: '紧急排查',
      photos: [],
      status: 'open',
      notes: '可燃气体超标，正在排查'
    },
    {
      id: 'manhole_003',
      manholeNo: 'MH-003',
      sectionId: 'section_002',
      position: { x: 35, y: -5, z: 0 },
      openTime: '2026-05-04T21:30:00Z',
      closeTime: '',
      operator: '王五',
      purpose: '管道巡检',
      photos: [],
      status: 'open',
      notes: ''
    },
    {
      id: 'manhole_004',
      manholeNo: 'MH-004',
      sectionId: 'section_002',
      position: { x: 58, y: -5, z: 0 },
      openTime: '',
      closeTime: '',
      operator: '',
      purpose: '',
      photos: [],
      status: 'closed',
      notes: ''
    },
    {
      id: 'manhole_005',
      manholeNo: 'MH-005',
      sectionId: 'section_003',
      position: { x: 30, y: -5, z: 10 },
      openTime: '2026-05-04T19:30:00Z',
      closeTime: '2026-05-04T20:45:00Z',
      operator: '赵六',
      purpose: '例行检查',
      photos: [],
      status: 'closed',
      notes: ''
    },
    {
      id: 'manhole_006',
      manholeNo: 'MH-006',
      sectionId: 'section_003',
      position: { x: 30, y: -5, z: 38 },
      openTime: '',
      closeTime: '',
      operator: '',
      purpose: '',
      photos: [],
      status: 'closed',
      notes: ''
    }
  ]
}

export function downloadSampleData() {
  const dataStr = JSON.stringify(sampleData, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'sample_tunnel_data.json'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
