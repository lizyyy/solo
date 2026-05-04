export const sampleData = {
  cueTable: [
    {
      id: 'cue-1',
      number: '1',
      name: '开场幕布升起',
      time: '19:30:00',
      description: '演出开始，主幕布升起',
      transitionTime: 8,
      equipmentIds: ['eq-1'],
      load: 80,
      action: '升起'
    },
    {
      id: 'cue-2',
      number: '2',
      name: '场景1 背景下降',
      time: '19:30:15',
      description: '第一场景背景吊杆下降',
      transitionTime: 5,
      equipmentIds: ['eq-2'],
      load: 120,
      action: '下降'
    },
    {
      id: 'cue-3',
      number: '3',
      name: '升降台1升起',
      time: '19:32:00',
      description: '主升降台升起，演员A出场',
      transitionTime: 15,
      equipmentIds: ['eq-5'],
      load: 0,
      action: '升起'
    },
    {
      id: 'cue-4',
      number: '4',
      name: '场景2 换景',
      time: '19:35:10',
      description: '快速换景，吊杆2上升，吊杆3下降',
      transitionTime: 10,
      equipmentIds: ['eq-2', 'eq-3'],
      load: 0,
      action: '换景'
    },
    {
      id: 'cue-5',
      number: '5',
      name: '烟火效果1',
      time: '19:40:00',
      description: '第一场烟火效果',
      transitionTime: 3,
      equipmentIds: [],
      load: 0,
      action: '触发'
    },
    {
      id: 'cue-6',
      number: '6',
      name: '升降台2降下',
      time: '19:45:30',
      description: '副升降台降下',
      transitionTime: 12,
      equipmentIds: ['eq-6'],
      load: 0,
      action: '降下'
    },
    {
      id: 'cue-7',
      number: '7',
      name: '终场 幕布落下',
      time: '20:00:00',
      description: '演出结束，幕布落下',
      transitionTime: 8,
      equipmentIds: ['eq-1'],
      load: 80,
      action: '落下'
    }
  ],
  
  equipment: [
    {
      id: 'eq-1',
      type: '吊杆',
      number: '1',
      name: '主幕布吊杆',
      maxLoad: 100,
      status: '正常',
      area: '舞台前部'
    },
    {
      id: 'eq-2',
      type: '吊杆',
      number: '2',
      name: '场景1背景吊杆',
      maxLoad: 100,
      status: '正常',
      area: '舞台中部'
    },
    {
      id: 'eq-3',
      type: '吊杆',
      number: '3',
      name: '场景2背景吊杆',
      maxLoad: 100,
      status: '正常',
      area: '舞台中部'
    },
    {
      id: 'eq-4',
      type: '吊杆',
      number: '4',
      name: '重型道具吊杆',
      maxLoad: 500,
      status: '正常',
      area: '舞台后部'
    },
    {
      id: 'eq-5',
      type: '升降台',
      number: '1',
      name: '主升降台',
      maxLoad: 800,
      status: '正常',
      area: '舞台中央区域'
    },
    {
      id: 'eq-6',
      type: '升降台',
      number: '2',
      name: '副升降台',
      maxLoad: 500,
      status: '正常',
      area: '舞台左侧区域'
    },
    {
      id: 'eq-7',
      type: '吊杆',
      number: '5',
      name: '灯光吊杆',
      maxLoad: 200,
      status: '维护中',
      area: '舞台前部'
    }
  ],
  
  movements: [
    {
      id: 'mov-1',
      actor: '演员A',
      action: '上场',
      startTime: '19:31:50',
      endTime: '19:32:10',
      fromPosition: '侧幕1',
      toPosition: '舞台中央区域',
      notes: '从升降台1上场'
    },
    {
      id: 'mov-2',
      actor: '演员B',
      action: '上场',
      startTime: '19:33:00',
      endTime: '19:33:15',
      fromPosition: '侧幕2',
      toPosition: '舞台右侧'
    },
    {
      id: 'mov-3',
      actor: '演员C',
      action: '下场',
      startTime: '19:35:05',
      endTime: '19:35:20',
      fromPosition: '舞台中央区域',
      toPosition: '侧幕1'
    },
    {
      id: 'mov-4',
      actor: '演员D',
      action: '上场',
      startTime: '19:45:20',
      endTime: '19:45:40',
      fromPosition: '舞台左侧区域',
      toPosition: '舞台中央',
      notes: '从升降台2上场'
    },
    {
      id: 'mov-5',
      actor: '演员E',
      action: '上场',
      startTime: '19:45:25',
      endTime: '19:45:45',
      fromPosition: '舞台左侧区域',
      toPosition: '舞台中央',
      notes: '与演员D同上'
    }
  ],
  
  pyroPermits: [
    {
      id: 'permit-1',
      name: '开场火焰效果',
      permitNumber: 'PYRO-2026-001',
      issueDate: '2026-04-01',
      expiryDate: '2026-04-28',
      useTime: '19:40:00',
      location: '舞台中央',
      operator: '张三',
      notes: '冷火焰效果，需提前测试'
    },
    {
      id: 'permit-2',
      name: '高潮烟花效果',
      permitNumber: 'PYRO-2026-002',
      issueDate: '2026-03-15',
      expiryDate: '2026-04-15',
      useTime: '19:55:00',
      location: '舞台后方',
      operator: '李四',
      notes: '高空烟花，注意风向'
    },
    {
      id: 'permit-3',
      name: '烟雾效果',
      permitNumber: 'PYRO-2026-003',
      issueDate: '2026-04-20',
      expiryDate: '2026-05-20',
      useTime: '19:35:00',
      location: '全舞台',
      operator: '王五',
      notes: '干冰烟雾'
    }
  ]
}
