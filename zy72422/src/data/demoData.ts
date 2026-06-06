import type { RoyaltyRecord, TrackAlias } from '../types';

export const demoRecords: RoyaltyRecord[] = [
  {
    id: 'rec-001',
    contractNo: 'HT-2024-001',
    recordStore: '城市节拍唱片店',
    importDate: '2024-06-01',
    status: 'completed',
    contractImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=music%20record%20label%20contract%20document%20with%20tracklist%20table%20professional%20paper%20texture&image_size=landscape_4_3',
    tracks: [
      {
        id: 'trk-001-1',
        name: '夏日微风',
        trackNumber: 1,
        remark: '首版母带确认',
        hasReworkReason: false,
        alias: 'Summer Breeze'
      },
      {
        id: 'trk-001-2',
        name: '午夜电台',
        trackNumber: 2,
        remark: '正常交付',
        hasReworkReason: false,
        alias: 'Midnight Radio'
      },
      {
        id: 'trk-001-3',
        name: '城市旅人',
        trackNumber: 3,
        remark: '正常交付',
        hasReworkReason: false,
        alias: 'City Traveler'
      }
    ],
    evidenceChain: [
      {
        id: 'ev-001-1',
        type: 'import',
        title: '合同截图导入',
        description: '录音师小段上传合同页截图 HT-2024-001',
        operator: '小段',
        timestamp: '2024-06-01 10:30:00'
      },
      {
        id: 'ev-001-2',
        type: 'parse',
        title: '自动解析轨道信息',
        description: '成功解析3条轨道信息，未检测到返工原因',
        operator: '系统',
        timestamp: '2024-06-01 10:30:05'
      },
      {
        id: 'ev-001-3',
        type: 'alias_update',
        title: '补录曲目别名',
        description: '录音师小段对照曲目别名表补录了3条轨道的英文名',
        operator: '小段',
        timestamp: '2024-06-01 11:00:00'
      },
      {
        id: 'ev-001-4',
        type: 'rehearsal_update',
        title: '排练记录同步更新',
        description: '曲目别名补录后，关联的3条排练变更记录已同步更新',
        operator: '系统',
        timestamp: '2024-06-01 11:00:02'
      },
      {
        id: 'ev-001-5',
        type: 'complete',
        title: '分账完成',
        description: '所有轨道信息确认无误，分账流程结束',
        operator: '系统',
        timestamp: '2024-06-01 11:05:00'
      }
    ],
    rehearsalChanges: [
      {
        id: 'rh-001-1',
        trackId: 'trk-001-1',
        changeType: 'alias',
        oldValue: '无别名',
        newValue: 'Summer Breeze',
        changedAt: '2024-06-01 11:00:00',
        changedBy: '小段'
      },
      {
        id: 'rh-001-2',
        trackId: 'trk-001-2',
        changeType: 'alias',
        oldValue: '无别名',
        newValue: 'Midnight Radio',
        changedAt: '2024-06-01 11:00:00',
        changedBy: '小段'
      }
    ]
  },
  {
    id: 'rec-002',
    contractNo: 'HT-2024-002',
    recordStore: '黑胶时光唱片行',
    importDate: '2024-06-03',
    status: 'review',
    contractImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=vinyl%20record%20store%20contract%20document%20with%20red%20pen%20markings%20and%20notes&image_size=landscape_4_3',
    tracks: [
      {
        id: 'trk-002-1',
        name: '雨夜漫步',
        trackNumber: 1,
        remark: '正常交付',
        hasReworkReason: false,
        alias: 'Rainy Night Stroll'
      },
      {
        id: 'trk-002-2',
        name: '老唱片店',
        trackNumber: 2,
        remark: '返工原因：人声轨相位偏移，需重新混音',
        hasReworkReason: true,
        reworkReason: '人声轨相位偏移，需重新混音',
        alias: 'Old Record Shop'
      },
      {
        id: 'trk-002-3',
        name: '星期天的下午',
        trackNumber: 3,
        remark: '返工原因：底鼓音量过大，需调整',
        hasReworkReason: true,
        reworkReason: '底鼓音量过大，需调整',
        alias: 'Sunday Afternoon'
      }
    ],
    evidenceChain: [
      {
        id: 'ev-002-1',
        type: 'import',
        title: '合同截图导入',
        description: '录音师小段上传合同页截图 HT-2024-002',
        operator: '小段',
        timestamp: '2024-06-03 14:20:00'
      },
      {
        id: 'ev-002-2',
        type: 'parse',
        title: '自动解析轨道信息',
        description: '成功解析3条轨道信息，检测到2条轨道备注包含返工原因',
        operator: '系统',
        timestamp: '2024-06-03 14:20:06'
      },
      {
        id: 'ev-002-3',
        type: 'alias_update',
        title: '补录曲目别名',
        description: '录音师小段对照曲目别名表补录别名',
        operator: '小段',
        timestamp: '2024-06-03 14:45:00'
      },
      {
        id: 'ev-002-4',
        type: 'rehearsal_update',
        title: '排练记录同步更新',
        description: '曲目别名补录后，关联的排练变更记录已同步更新',
        operator: '系统',
        timestamp: '2024-06-03 14:45:03'
      },
      {
        id: 'ev-002-5',
        type: 'manual_fix',
        title: '人工修正返工标记',
        description: '录音师小段确认返工原因标记准确，提交版权运营复核',
        operator: '小段',
        timestamp: '2024-06-03 15:00:00'
      }
    ],
    rehearsalChanges: [
      {
        id: 'rh-002-1',
        trackId: 'trk-002-2',
        changeType: 'other',
        oldValue: '初版混音',
        newValue: '返工重混：相位修正版',
        changedAt: '2024-06-02 09:30:00',
        changedBy: '系统'
      },
      {
        id: 'rh-002-2',
        trackId: 'trk-002-3',
        changeType: 'other',
        oldValue: '初版混音',
        newValue: '返工重混：底鼓音量调整',
        changedAt: '2024-06-02 10:15:00',
        changedBy: '系统'
      }
    ],
    reviewNote: '请版权运营复核返工原因后确认分账'
  },
  {
    id: 'rec-003',
    contractNo: 'HT-2024-003',
    recordStore: '音乐空间旗舰店',
    importDate: '2024-06-05',
    status: 'completed',
    contractImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=music%20store%20royalty%20contract%20document%20vintage%20style%20with%20stamp&image_size=landscape_4_3',
    tracks: [
      {
        id: 'trk-003-1',
        name: '追梦人',
        trackNumber: 1,
        remark: '旧口径曲目，已从别名表补录原名',
        hasReworkReason: false,
        alias: 'Dream Chaser',
        oldAlias: '追梦者（旧版）'
      },
      {
        id: 'trk-003-2',
        name: '海岸线',
        trackNumber: 2,
        remark: '正常交付',
        hasReworkReason: false,
        alias: 'Coastline'
      },
      {
        id: 'trk-003-3',
        name: '时光胶囊',
        trackNumber: 3,
        remark: '旧口径曲目，原名《时间胶囊》',
        hasReworkReason: false,
        alias: 'Time Capsule',
        oldAlias: '时间胶囊'
      }
    ],
    evidenceChain: [
      {
        id: 'ev-003-1',
        type: 'import',
        title: '合同截图导入',
        description: '录音师小段上传合同页截图 HT-2024-003',
        operator: '小段',
        timestamp: '2024-06-05 09:15:00'
      },
      {
        id: 'ev-003-2',
        type: 'parse',
        title: '自动解析轨道信息',
        description: '成功解析3条轨道信息，未检测到返工原因',
        operator: '系统',
        timestamp: '2024-06-05 09:15:04'
      },
      {
        id: 'ev-003-3',
        type: 'alias_update',
        title: '从曲目别名表补录旧口径',
        description: '录音师小段从曲目别名表中找到2条旧口径记录并补录：《追梦人》原名《追梦者（旧版）》，《时光胶囊》原名《时间胶囊》',
        operator: '小段',
        timestamp: '2024-06-05 10:00:00'
      },
      {
        id: 'ev-003-4',
        type: 'rehearsal_update',
        title: '排练变更记录更新',
        description: '补录旧口径别名后，关联的排练变更记录已同步更新，旧口径名称已关联',
        operator: '系统',
        timestamp: '2024-06-05 10:00:05'
      },
      {
        id: 'ev-003-5',
        type: 'rerun',
        title: '重跑分账流程',
        description: '补录旧口径后重跑，确保所有历史记录关联正确',
        operator: '小段',
        timestamp: '2024-06-05 10:10:00'
      },
      {
        id: 'ev-003-6',
        type: 'complete',
        title: '分账完成',
        description: '旧口径补录完成，关联正确，分账流程结束',
        operator: '系统',
        timestamp: '2024-06-05 10:15:00'
      }
    ],
    rehearsalChanges: [
      {
        id: 'rh-003-1',
        trackId: 'trk-003-1',
        changeType: 'name',
        oldValue: '追梦者（旧版）',
        newValue: '追梦人',
        changedAt: '2024-05-20 14:00:00',
        changedBy: '系统'
      },
      {
        id: 'rh-003-2',
        trackId: 'trk-003-3',
        changeType: 'name',
        oldValue: '时间胶囊',
        newValue: '时光胶囊',
        changedAt: '2024-05-22 11:30:00',
        changedBy: '系统'
      }
    ]
  }
];

export const demoAliases: TrackAlias[] = [
  {
    id: 'alias-001',
    officialName: '夏日微风',
    aliases: ['Summer Breeze', '夏风'],
    updatedAt: '2024-05-15'
  },
  {
    id: 'alias-002',
    officialName: '午夜电台',
    aliases: ['Midnight Radio', '深夜电台'],
    updatedAt: '2024-05-15'
  },
  {
    id: 'alias-003',
    officialName: '城市旅人',
    aliases: ['City Traveler', '都市行者'],
    updatedAt: '2024-05-15'
  },
  {
    id: 'alias-004',
    officialName: '雨夜漫步',
    aliases: ['Rainy Night Stroll', '雨中行'],
    updatedAt: '2024-05-20'
  },
  {
    id: 'alias-005',
    officialName: '老唱片店',
    aliases: ['Old Record Shop', '唱片铺子'],
    updatedAt: '2024-05-20'
  },
  {
    id: 'alias-006',
    officialName: '星期天的下午',
    aliases: ['Sunday Afternoon', '周日午后'],
    updatedAt: '2024-05-20'
  },
  {
    id: 'alias-007',
    officialName: '追梦人',
    aliases: ['Dream Chaser', '追梦者'],
    oldCaliber: '追梦者（旧版）',
    updatedAt: '2024-05-25'
  },
  {
    id: 'alias-008',
    officialName: '海岸线',
    aliases: ['Coastline', '海边'],
    updatedAt: '2024-05-25'
  },
  {
    id: 'alias-009',
    officialName: '时光胶囊',
    aliases: ['Time Capsule'],
    oldCaliber: '时间胶囊',
    updatedAt: '2024-05-25'
  }
];
