import type { MaterialPackage } from '../types';

export const sampleMaterials: MaterialPackage[] = [
  {
    id: 'sample-basic',
    name: '🚌 基础调度训练',
    description: '适合新手的基础公交调度训练，包含3个常见调度场景。顺利完成即可掌握核心规则。',
    source: '城市公交调度棋官方样例',
    createdAt: '2026-06-01T10:00:00.000Z',
    createdBy: '课程助教小何',
    isSample: true,
    gameDuration: 90,
    initialResources: {
      buses: 5,
      drivers: 8,
      budget: 5000,
      reputation: 80
    },
    events: [
      {
        id: 'event-1',
        title: '早高峰1号线拥堵',
        description: '早高峰期间，1号线出现严重拥堵，乘客排队等候。你需要决定如何调度。',
        type: 'normal',
        ruleHint: '高峰时段应优先增加运力，从备用线路调派车辆。',
        options: [
          {
            id: 'opt-1-1',
            text: '从备用线路调派2辆公交增援',
            resourceCost: { buses: 2, drivers: 2 },
            isCorrect: true,
            scoreChange: 10,
            feedback: '正确！及时增援缓解了拥堵，乘客满意度上升。',
            ruleReference: '规则第3条：高峰时段应优先调配备用运力'
          },
          {
            id: 'opt-1-2',
            text: '让乘客耐心等待，不做调整',
            resourceCost: { reputation: 10 },
            isCorrect: false,
            scoreChange: -15,
            feedback: '错误！乘客长时间等待引发不满，声誉受损。',
            ruleReference: '规则第3条：高峰时段应优先调配备用运力'
          },
          {
            id: 'opt-1-3',
            text: '临时提高票价分流乘客',
            resourceCost: { reputation: 15, budget: 200 },
            isCorrect: false,
            scoreChange: -20,
            feedback: '错误！临时涨价引发乘客强烈不满。',
            ruleReference: '规则第5条：不得随意调整票价'
          }
        ]
      },
      {
        id: 'event-2',
        title: '司机突发病假',
        description: '一名主力司机突发感冒需要请假，今天的排班出现空缺。',
        type: 'normal',
        ruleHint: '应优先安排备用司机加班，其次考虑调整班次。',
        options: [
          {
            id: 'opt-2-1',
            text: '安排备用司机加班（支付加班费）',
            resourceCost: { budget: 500, drivers: 1 },
            isCorrect: true,
            scoreChange: 10,
            feedback: '正确！备用司机及时补位，班次正常运行。',
            ruleReference: '规则第7条：优先使用备用人力资源'
          },
          {
            id: 'opt-2-2',
            text: '让其他司机超负荷工作',
            resourceCost: { reputation: 20 },
            isCorrect: false,
            scoreChange: -15,
            feedback: '错误！司机疲劳驾驶存在安全隐患。',
            ruleReference: '规则第7条：不得安排司机超时工作'
          },
          {
            id: 'opt-2-3',
            text: '取消该司机今天所有班次',
            resourceCost: { reputation: 15, buses: 1 },
            isCorrect: false,
            scoreChange: -10,
            feedback: '错误！班次取消导致乘客出行受影响。',
            ruleReference: '规则第7条：应尽力保证运力'
          }
        ]
      },
      {
        id: 'event-3',
        title: '新增社区接驳需求',
        description: '一个新建小区请求开通接驳线路，居民出行需求迫切。',
        type: 'normal',
        ruleHint: '评估资源情况，在能力范围内满足民生需求。',
        options: [
          {
            id: 'opt-3-1',
            text: '开通定时接驳班车（每天4班）',
            resourceCost: { buses: 1, drivers: 1, budget: 300 },
            isCorrect: true,
            scoreChange: 15,
            feedback: '正确！新线路获得社区居民好评，公司声誉提升。',
            ruleReference: '规则第2条：积极响应民生需求'
          },
          {
            id: 'opt-3-2',
            text: '暂时不安排，等其他线路有空再说',
            resourceCost: { reputation: 5 },
            isCorrect: false,
            scoreChange: -5,
            feedback: '社区居民有些失望，但可以理解。',
            ruleReference: '规则第2条：应积极响应民生需求'
          },
          {
            id: 'opt-3-3',
            text: '立即开通全天高频接驳线路',
            resourceCost: { buses: 3, drivers: 3, budget: 1000 },
            isCorrect: false,
            scoreChange: -10,
            feedback: '运力投入过大，造成资源浪费。',
            ruleReference: '规则第4条：合理评估投入产出比'
          }
        ]
      }
    ]
  },
  {
    id: 'sample-rework',
    name: '🔄 高峰期返工训练',
    description: '包含返工事件的进阶训练，学习如何修正错误决策。适合有一定基础的学员。',
    source: '城市公交调度棋官方样例',
    createdAt: '2026-06-01T11:00:00.000Z',
    createdBy: '课程助教小何',
    isSample: true,
    gameDuration: 120,
    initialResources: {
      buses: 6,
      drivers: 10,
      budget: 6000,
      reputation: 75
    },
    events: [
      {
        id: 'event-r1',
        title: '突发暴雨预警',
        description: '气象部门发布暴雨红色预警，预计下午将有特大暴雨。',
        type: 'emergency',
        ruleHint: '恶劣天气应提前准备应急方案，确保乘客安全。',
        options: [
          {
            id: 'opt-r1-1',
            text: '启动应急预案：准备应急车辆，通知各线路注意安全',
            resourceCost: { budget: 500 },
            isCorrect: true,
            scoreChange: 15,
            feedback: '正确！提前准备让公司从容应对暴雨。',
            ruleReference: '规则第10条：恶劣天气需启动应急预案'
          },
          {
            id: 'opt-r1-2',
            text: '等雨下起来再说，现在先正常运营',
            resourceCost: {},
            isCorrect: false,
            scoreChange: -20,
            feedback: '错误！暴雨来临时措手不及，多处线路受影响。',
            ruleReference: '规则第10条：恶劣天气需提前启动应急预案'
          },
          {
            id: 'opt-r1-3',
            text: '直接暂停所有线路运营',
            resourceCost: { reputation: 25 },
            isCorrect: false,
            scoreChange: -15,
            feedback: '反应过度，乘客出行完全受阻。',
            ruleReference: '规则第10条：应急预案应分级响应'
          }
        ]
      },
      {
        id: 'event-r2',
        title: '返工：暴雨引发路面积水',
        description: '暴雨导致多条线路积水，部分车辆被困。之前的决策需要调整。',
        type: 'rework',
        ruleHint: '返工事件需要根据当前情况重新评估，修正之前可能的错误决策。',
        options: [
          {
            id: 'opt-r2-1',
            text: '调整线路绕行积水区域，调度备用车辆接驳受困乘客',
            resourceCost: { buses: 2, drivers: 2, budget: 800 },
            isCorrect: true,
            scoreChange: 20,
            feedback: '出色！及时调整将影响降到最低，乘客纷纷点赞。',
            ruleReference: '规则第11条：突发情况需灵活调整线路'
          },
          {
            id: 'opt-r2-2',
            text: '让车辆原地等待积水退去',
            resourceCost: { reputation: 20 },
            isCorrect: false,
            scoreChange: -25,
            feedback: '错误！乘客长时间被困，引发严重投诉。',
            ruleReference: '规则第11条：应积极解决突发状况'
          },
          {
            id: 'opt-r2-3',
            text: '通知乘客自行想办法回家',
            resourceCost: { reputation: 35 },
            isCorrect: false,
            scoreChange: -30,
            feedback: '严重错误！完全不顾乘客安危，声誉严重受损。',
            ruleReference: '规则第1条：乘客安全是首要原则'
          }
        ]
      },
      {
        id: 'event-r3',
        title: '暴雨后恢复运营',
        description: '暴雨结束，需要评估损失并安排恢复运营。',
        type: 'normal',
        ruleHint: '灾后需要清点损失，逐步恢复运力，做好沟通工作。',
        options: [
          {
            id: 'opt-r3-1',
            text: '先检查车辆和道路安全，分阶段恢复线路，发布公告说明情况',
            resourceCost: { budget: 600 },
            isCorrect: true,
            scoreChange: 15,
            feedback: '正确！安全第一，透明沟通获得乘客理解。',
            ruleReference: '规则第12条：恢复运营需确保安全并做好沟通'
          },
          {
            id: 'opt-r3-2',
            text: '立即全面恢复，不用太在意细节',
            resourceCost: {},
            isCorrect: false,
            scoreChange: -10,
            feedback: '操之过急，部分线路仍有安全隐患。',
            ruleReference: '规则第12条：恢复运营前需安全检查'
          },
          {
            id: 'opt-r3-3',
            text: '休息一天再说，反正今天也没多少人',
            resourceCost: { reputation: 15 },
            isCorrect: false,
            scoreChange: -10,
            feedback: '消极应对，影响城市运转恢复。',
            ruleReference: '规则第12条：应尽快恢复服务'
          }
        ]
      }
    ]
  }
];

export const allMaterials: MaterialPackage[] = [
  ...sampleMaterials,
  {
    id: 'bad-empty',
    name: '⚠️ 空关卡示例',
    description: '事件列表为空，用于验证系统如何检测空关卡配置。选择后可查看配置验证提示。',
    source: '配置验证测试',
    createdAt: '2026-06-01T12:00:00.000Z',
    createdBy: '系统测试',
    isSample: true,
    isBadConfig: true,
    badConfigType: 'empty_level',
    gameDuration: 60,
    initialResources: { buses: 5, drivers: 5, budget: 1000, reputation: 50 },
    events: []
  },
  {
    id: 'bad-duplicate',
    name: '⚠️ 重复事件ID示例',
    description: '两个事件使用了相同的ID，用于验证重复事件检测。选择后可查看配置验证提示。',
    source: '配置验证测试',
    createdAt: '2026-06-01T12:00:00.000Z',
    createdBy: '系统测试',
    isSample: true,
    isBadConfig: true,
    badConfigType: 'duplicate_event',
    gameDuration: 60,
    initialResources: { buses: 5, drivers: 5, budget: 1000, reputation: 50 },
    events: [
      {
        id: 'same-id',
        title: '事件1',
        description: '第一个事件',
        type: 'normal' as const,
        options: [{ id: 'o1', text: '选项', resourceCost: {}, isCorrect: true, scoreChange: 10, feedback: '', ruleReference: '' }]
      },
      {
        id: 'same-id',
        title: '事件2',
        description: '第二个事件（ID重复）',
        type: 'normal' as const,
        options: [{ id: 'o2', text: '选项', resourceCost: {}, isCorrect: true, scoreChange: 10, feedback: '', ruleReference: '' }]
      }
    ]
  },
  {
    id: 'bad-bounds',
    name: '⚠️ 资源越界示例',
    description: '公交100辆、司机-5人、预算99999，用于验证资源边界检测。选择后可查看配置验证提示。',
    source: '配置验证测试',
    createdAt: '2026-06-01T12:00:00.000Z',
    createdBy: '系统测试',
    isSample: true,
    isBadConfig: true,
    badConfigType: 'resource_out_of_bounds',
    gameDuration: 60,
    initialResources: { buses: 100, drivers: -5, budget: 99999, reputation: 50 },
    events: [
      {
        id: 'e1',
        title: '测试事件',
        description: '测试',
        type: 'normal' as const,
        options: [{ id: 'o1', text: '选项', resourceCost: {}, isCorrect: true, scoreChange: 10, feedback: '', ruleReference: '' }]
      }
    ]
  }
];
