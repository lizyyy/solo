export const sampleObstacleData = [
  {
    wallPanelCode: 'WP-001',
    coordinate: '116.403874,39.914885',
    obstacleNote: '墙面存在管线预埋标记',
    floorSectionId: 'SEC-001'
  },
  {
    wallPanelCode: 'WP-002',
    coordinate: '116.403875,39.914886,X:150.5',
    obstacleNote: '角落有突出结构，需避让',
    floorSectionId: 'SEC-001'
  },
  {
    wallPanelCode: 'WP-003',
    coordinate: 'X:200.5,Y:300.2,Z:100.0',
    obstacleNote: '',
    floorSectionId: 'SEC-002'
  },
  {
    wallPanelCode: 'WP-004',
    coordinate: '116.403876,39.914887',
    obstacleNote: '窗户位置需预留',
    floorSectionId: 'SEC-002'
  },
  {
    wallPanelCode: 'WP-001',
    coordinate: '116.403874,39.914885',
    obstacleNote: '墙面存在管线预埋标记',
    floorSectionId: 'SEC-001'
  },
  {
    wallPanelCode: 'WP-005',
    coordinate: '116.403877,39.914888,Y:250.0',
    obstacleNote: '顶部有横梁阻挡',
    floorSectionId: 'SEC-003'
  },
  {
    wallPanelCode: 'WP-006',
    coordinate: 'X:180.0',
    obstacleNote: '门框位置，尺寸需复核',
    floorSectionId: 'SEC-003'
  }
]

export const sampleFloorSectionData = [
  {
    sectionId: 'SEC-001',
    floor: '3F',
    sectionNote: '3层东侧剖面，包含A-B轴线墙板',
    relatedPanels: ['WP-001', 'WP-002']
  },
  {
    sectionId: 'SEC-002',
    floor: '3F',
    sectionNote: '3层南侧剖面，包含C-D轴线墙板',
    relatedPanels: ['WP-003', 'WP-004']
  },
  {
    sectionId: 'SEC-003',
    floor: '3F',
    sectionNote: '3层西侧剖面，包含E-F轴线墙板',
    relatedPanels: ['WP-005', 'WP-006']
  }
]

export const sampleSelfCheckResults = {
  duplicateCheck: {
    passed: false,
    count: 1,
    details: [
      {
        type: 'duplicate',
        severity: 'warning',
        message: '墙板编号 WP-001 存在重复导入'
      }
    ]
  },
  coordinateCheck: {
    passed: false,
    count: 2,
    details: [
      {
        type: 'mixed_coordinate',
        severity: 'error',
        message: 'WP-002 检测到经纬度和米制坐标混合'
      },
      {
        type: 'mixed_coordinate',
        severity: 'error',
        message: 'WP-005 检测到经纬度和米制坐标混合'
      }
    ],
    message: '发现 2 条坐标混合记录，已标记待复核'
  },
  recalculateCheck: {
    passed: true,
    count: 0,
    message: '暂无补录重算记录'
  },
  exportConsistencyCheck: {
    passed: true,
    count: 0,
    message: '导出一致性检查通过'
  }
}
