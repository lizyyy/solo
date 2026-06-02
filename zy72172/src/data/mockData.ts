import { AppData } from '../types';

export const mockData: AppData = {
  points: [
    {
      id: 'point-001',
      name: '中山路与人民路交叉口',
      location: '中山路东段',
      lat: 31.2304,
      lng: 121.4737,
      status: 'approved',
      street: '中山路',
      capacity: 80,
      designCapacity: 100,
      timeSlot: '7:00-9:00, 17:00-19:00',
      hasConflict: false,
      conflictType: null,
      sourceType: 'current',
      createdAt: '2024-01-15T09:00:00Z',
      updatedAt: '2024-01-15T10:30:00Z'
    },
    {
      id: 'point-002',
      name: '解放路与建设路交叉口',
      location: '解放路南段',
      lat: 31.2354,
      lng: 121.4787,
      status: 'pending',
      street: '解放路',
      capacity: 115,
      designCapacity: 100,
      timeSlot: '7:30-9:30, 17:30-19:30',
      hasConflict: true,
      conflictType: 'capacity',
      conflictNote: '高峰小时容量超出设计值15%',
      sourceType: 'current',
      createdAt: '2024-01-16T09:00:00Z',
      updatedAt: '2024-01-16T11:00:00Z'
    },
    {
      id: 'point-003',
      name: '和平大道与长江路交叉口',
      location: '和平大道中段',
      lat: 31.2254,
      lng: 121.4687,
      status: 'legacy',
      street: '和平大道',
      capacity: 70,
      designCapacity: 90,
      timeSlot: '6:30-8:30, 16:30-18:30',
      hasConflict: false,
      conflictType: null,
      sourceType: 'legacy',
      createdAt: '2023-11-20T09:00:00Z',
      updatedAt: '2023-12-01T10:00:00Z'
    },
    {
      id: 'point-004',
      name: '青年路与文化路交叉口',
      location: '青年路北段',
      lat: 31.2404,
      lng: 121.4837,
      status: 'pending',
      street: '青年路',
      timeSlot: '7:00-9:00, 17:00-19:00',
      hasConflict: true,
      conflictType: 'empty',
      conflictNote: '缺少容量数据',
      sourceType: 'current',
      createdAt: '2024-01-17T09:00:00Z',
      updatedAt: '2024-01-17T09:00:00Z'
    },
    {
      id: 'point-005',
      name: '胜利路与健康路交叉口',
      location: '胜利路东段',
      lat: 31.2204,
      lng: 121.4637,
      status: 'approved',
      street: '胜利路',
      capacity: 99,
      designCapacity: 100,
      timeSlot: '7:00-9:00, 17:00-19:00',
      hasConflict: false,
      conflictType: null,
      sourceType: 'current',
      createdAt: '2024-01-18T09:00:00Z',
      updatedAt: '2024-01-18T10:00:00Z'
    },
    {
      id: 'point-006',
      name: '解放路与建设路交叉口',
      location: '解放路南段-副点',
      lat: 31.2356,
      lng: 121.4789,
      status: 'pending',
      street: '解放路',
      capacity: 90,
      designCapacity: 100,
      timeSlot: '7:30-9:30, 17:30-19:30',
      hasConflict: true,
      conflictType: 'duplicate',
      conflictNote: '与现有点位名称重复',
      sourceType: 'manual',
      createdAt: '2024-01-16T14:00:00Z',
      updatedAt: '2024-01-16T14:00:00Z'
    },
    {
      id: 'point-007',
      name: '滨江路与海港路交叉口',
      location: '滨江路西段',
      lat: 31.2154,
      lng: 121.4587,
      status: 'conflict',
      street: '滨江路',
      capacity: 85,
      designCapacity: 100,
      timeSlot: '7:00-9:00',
      hasConflict: true,
      conflictType: 'timeSlot',
      conflictNote: '晚高峰时段缺失',
      sourceType: 'current',
      createdAt: '2024-01-19T09:00:00Z',
      updatedAt: '2024-01-19T11:00:00Z'
    }
  ],
  feedbacks: [
    {
      id: 'fb-001',
      pointId: 'point-001',
      residentName: '张师傅',
      content: '这个路口早高峰公交通过顺畅，比以前快了约3分钟',
      type: 'info',
      createdAt: '2024-01-15T12:00:00Z'
    },
    {
      id: 'fb-002',
      pointId: 'point-002',
      residentName: '李女士',
      content: '早高峰等红灯时间太长，公交车常常堵在路口',
      type: 'complaint',
      createdAt: '2024-01-16T13:00:00Z'
    },
    {
      id: 'fb-003',
      pointId: 'point-002',
      residentName: '王司机',
      content: '建议增加南向北方向的绿灯时长10秒',
      type: 'suggestion',
      createdAt: '2024-01-16T14:30:00Z'
    },
    {
      id: 'fb-004',
      pointId: 'point-003',
      residentName: '陈先生',
      content: '老方案虽然可行，但新的公交线路需要调整配时',
      type: 'suggestion',
      createdAt: '2023-12-05T10:00:00Z'
    }
  ],
  planVersions: [
    {
      id: 'ver-001',
      pointId: 'point-001',
      version: 'v1.0',
      content: '公交优先相位：早高峰7:00-9:00，晚高峰17:00-19:00，绿灯延长5秒',
      author: '设计部-小王',
      changeLog: '初始方案',
      isLegacy: false,
      createdAt: '2024-01-10T09:00:00Z'
    },
    {
      id: 'ver-002',
      pointId: 'point-002',
      version: 'v1.0',
      content: '公交优先相位：早高峰7:30-9:30，晚高峰17:30-19:30',
      author: '设计部-小李',
      changeLog: '初始方案',
      isLegacy: false,
      createdAt: '2024-01-12T09:00:00Z'
    },
    {
      id: 'ver-003',
      pointId: 'point-002',
      version: 'v1.1',
      content: '调整相位时长，增加南向北绿灯时间',
      author: '设计部-小李',
      changeLog: '响应居民反馈',
      isLegacy: false,
      createdAt: '2024-01-16T15:00:00Z'
    },
    {
      id: 'ver-004',
      pointId: 'point-003',
      version: 'v0.9',
      content: '旧口径方案：全时段绿灯延长3秒',
      author: '设计部-老张',
      changeLog: '2023年审批台账导入',
      isLegacy: true,
      createdAt: '2023-11-15T09:00:00Z'
    }
  ],
  photos: [
    {
      id: 'photo-001',
      pointId: 'point-001',
      url: 'https://picsum.photos/400/300?random=1',
      description: '路口实拍 - 早高峰',
      createdAt: '2024-01-15T08:30:00Z'
    },
    {
      id: 'photo-002',
      pointId: 'point-002',
      url: 'https://picsum.photos/400/300?random=2',
      description: '巡检照片 - 信号机柜',
      createdAt: '2024-01-16T10:00:00Z'
    },
    {
      id: 'photo-003',
      pointId: 'point-003',
      url: 'https://picsum.photos/400/300?random=3',
      description: '历史存档照片',
      createdAt: '2023-11-20T09:00:00Z'
    }
  ],
  reports: [
    {
      id: 'report-001',
      pointId: 'point-001',
      summary: '中山路与人民路交叉口公交优先信号复核通过。各项指标符合设计要求，居民反馈良好。',
      exceptionNote: '无例外情况',
      status: 'approved',
      createdAt: '2024-01-15T10:30:00Z'
    }
  ]
};
