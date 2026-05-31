import type { Level } from '@/types';

export const mockLevels: Level[] = [
  {
    id: 'level-basic-001',
    name: '利率迷宫·入门篇',
    description: '基础关卡：通过调整利率政策，将经济从过热调整到稳定增长状态。目标是保持低通胀、高增长和充分就业。',
    initialResources: {
      reserveRequirement: 15,
      lendingRate: 5,
      depositRate: 2.5,
      inflation: 4.5,
      gdpGrowth: 6.5,
      employment: 5.2,
    },
    nodes: [
      {
        id: 'node-start',
        label: '起点',
        type: 'start',
        position: { x: 50, y: 200 },
        description: '当前经济过热，通胀压力较大。需要通过利率政策将经济引导到稳定区间。',
        effects: [
          { resource: 'inflation', change: 0, type: 'absolute' },
        ],
      },
      {
        id: 'node-1',
        label: '通胀上升',
        type: 'decision',
        position: { x: 200, y: 100 },
        description: '市场预期通胀继续上升，需要做出反应。',
      },
      {
        id: 'node-2',
        label: '消费放缓',
        type: 'decision',
        position: { x: 200, y: 300 },
        description: '有迹象显示消费增长放缓，需要权衡决策。',
      },
      {
        id: 'node-3',
        label: '就业压力',
        type: 'decision',
        position: { x: 350, y: 150 },
        description: '就业市场出现波动，失业率有上升压力。',
      },
      {
        id: 'node-4',
        label: '楼市调整',
        type: 'decision',
        position: { x: 350, y: 250 },
        description: '房地产市场需要政策引导。',
      },
      {
        id: 'node-5',
        label: '汇率波动',
        type: 'decision',
        position: { x: 500, y: 200 },
        description: '汇率出现波动，需要综合考量。',
      },
      {
        id: 'node-end',
        label: '终点',
        type: 'end',
        position: { x: 650, y: 200 },
        description: '经济进入稳定增长区间。',
        effects: [
          { resource: 'gdpGrowth', change: 0.5, type: 'absolute' },
        ],
      },
    ],
    paths: [
      {
        from: 'node-start',
        to: 'node-1',
        decisions: [
          {
            id: 'dec-raise-rr',
            label: '提高准备金率 +1%',
            description: '提高存款准备金率1个百分点，抑制信贷扩张',
            resourceEffects: [
              { resource: 'reserveRequirement', change: 1, type: 'absolute' },
              { resource: 'lendingRate', change: 0.5, type: 'absolute' },
              { resource: 'inflation', change: -0.8, type: 'absolute' },
              { resource: 'gdpGrowth', change: -0.5, type: 'absolute' },
            ],
          },
          {
            id: 'dec-raise-lending',
            label: '提高贷款利率 +0.5%',
            description: '提高贷款利率0.5个百分点',
            resourceEffects: [
              { resource: 'lendingRate', change: 0.5, type: 'absolute' },
              { resource: 'inflation', change: -0.5, type: 'absolute' },
              { resource: 'gdpGrowth', change: -0.3, type: 'absolute' },
              { resource: 'employment', change: -0.2, type: 'absolute' },
            ],
          },
        ],
      },
      {
        from: 'node-start',
        to: 'node-2',
        decisions: [
          {
            id: 'dec-lower-deposit',
            label: '降低存款利率 -0.5%',
            description: '降低存款利率0.5个百分点，刺激消费',
            resourceEffects: [
              { resource: 'depositRate', change: -0.5, type: 'absolute' },
              { resource: 'gdpGrowth', change: 0.3, type: 'absolute' },
              { resource: 'inflation', change: 0.2, type: 'absolute' },
            ],
          },
          {
            id: 'dec-hold',
            label: '维持不变',
            description: '保持利率不变，观察形势',
            resourceEffects: [
              { resource: 'inflation', change: 0.3, type: 'absolute' },
            ],
          },
        ],
      },
      {
        from: 'node-1',
        to: 'node-3',
        decisions: [
          {
            id: 'dec-continue-raise',
            label: '继续加息 +0.25%',
            description: '继续加息0.25个百分点',
            resourceEffects: [
              { resource: 'lendingRate', change: 0.25, type: 'absolute' },
              { resource: 'inflation', change: -0.6, type: 'absolute' },
              { resource: 'gdpGrowth', change: -0.4, type: 'absolute' },
              { resource: 'employment', change: -0.3, type: 'absolute' },
            ],
          },
          {
            id: 'dec-sell-bonds',
            label: '公开市场操作',
            description: '出售债券，回笼货币',
            resourceEffects: [
              { resource: 'inflation', change: -0.4, type: 'absolute' },
              { resource: 'gdpGrowth', change: -0.2, type: 'absolute' },
              { resource: 'employment', change: -0.1, type: 'absolute' },
            ],
          },
        ],
      },
      {
        from: 'node-2',
        to: 'node-4',
        decisions: [
          {
            id: 'dec-stimulate',
            label: '定向降准 -1%',
            description: '降低准备金率1个百分点，刺激经济',
            resourceEffects: [
              { resource: 'reserveRequirement', change: -1, type: 'absolute' },
              { resource: 'lendingRate', change: -0.5, type: 'absolute' },
              { resource: 'gdpGrowth', change: 0.6, type: 'absolute' },
              { resource: 'inflation', change: 0.4, type: 'absolute' },
            ],
          },
          {
            id: 'dec-cut-lending',
            label: '降低贷款利率',
            description: '降低贷款利率0.5个百分点',
            resourceEffects: [
              { resource: 'lendingRate', change: -0.5, type: 'absolute' },
              { resource: 'gdpGrowth', change: 0.4, type: 'absolute' },
              { resource: 'employment', change: 0.2, type: 'absolute' },
            ],
          },
        ],
      },
      {
        from: 'node-3',
        to: 'node-5',
        decisions: [
          {
            id: 'dec-balance',
            label: '结构性调整',
            description: '微调政策，平衡通胀和增长',
            resourceEffects: [
              { resource: 'reserveRequirement', change: -0.5, type: 'absolute' },
              { resource: 'employment', change: 0.3, type: 'absolute' },
              { resource: 'inflation', change: -0.2, type: 'absolute' },
            ],
          },
          {
            id: 'dec-cut-rr-small',
            label: '小幅降准',
            description: '降低准备金率0.5个百分点',
            resourceEffects: [
              { resource: 'reserveRequirement', change: -0.5, type: 'absolute' },
              { resource: 'gdpGrowth', change: 0.3, type: 'absolute' },
              { resource: 'employment', change: 0.2, type: 'absolute' },
            ],
          },
        ],
      },
      {
        from: 'node-4',
        to: 'node-5',
        decisions: [
          {
            id: 'dec-mortgage',
            label: '调整房贷政策',
            description: '针对性调整房地产相关政策',
            resourceEffects: [
              { resource: 'lendingRate', change: -0.3, type: 'absolute' },
              { resource: 'gdpGrowth', change: 0.3, type: 'absolute' },
              { resource: 'employment', change: 0.2, type: 'absolute' },
            ],
          },
          {
            id: 'dec-consumption',
            label: '刺激消费',
            description: '出台消费刺激政策',
            resourceEffects: [
              { resource: 'depositRate', change: -0.3, type: 'absolute' },
              { resource: 'gdpGrowth', change: 0.5, type: 'absolute' },
              { resource: 'inflation', change: 0.3, type: 'absolute' },
            ],
          },
        ],
      },
      {
        from: 'node-5',
        to: 'node-end',
        decisions: [
          {
            id: 'dec-final-stable',
            label: '稳健收尾',
            description: '保持政策稳定，巩固成果',
            resourceEffects: [
              { resource: 'inflation', change: -0.3, type: 'absolute' },
              { resource: 'gdpGrowth', change: 0.2, type: 'absolute' },
              { resource: 'employment', change: 0.1, type: 'absolute' },
            ],
          },
          {
            id: 'dec-final-boost',
            label: '最后冲刺',
            description: '适度刺激，确保达标',
            resourceEffects: [
              { resource: 'lendingRate', change: -0.25, type: 'absolute' },
              { resource: 'gdpGrowth', change: 0.4, type: 'absolute' },
              { resource: 'employment', change: 0.2, type: 'absolute' },
            ],
          },
        ],
      },
    ],
    targetConditions: [
      {
        resource: 'inflation',
        min: 2,
        max: 3.5,
        weight: 35,
      },
      {
        resource: 'gdpGrowth',
        min: 4.5,
        max: 6,
        weight: 35,
      },
      {
        resource: 'employment',
        min: 4.5,
        max: 5.5,
        weight: 30,
      },
    ],
  },
];

export const mockLevelsChallenging: Level[] = [
  {
    id: 'level-challenge-001',
    name: '利率迷宫·挑战篇',
    description: '挑战关卡：经济面临多重压力，需要在通胀、增长和就业之间找到完美平衡。路线更多风险更高。',
    initialResources: {
      reserveRequirement: 18,
      lendingRate: 6,
      depositRate: 3,
      inflation: 5.8,
      gdpGrowth: 4.2,
      employment: 6.1,
    },
    nodes: [
      { id: 'c-node-start', label: '起点', type: 'start', position: { x: 50, y: 200 }, description: '经济滞胀风险：高通胀、低增长、高失业。三重困境。' },
      { id: 'c-node-1', label: '供给冲击', type: 'decision', position: { x: 180, y: 100 } , description: '大宗商品价格上涨，供给侧压力增大。' },
      { id: 'c-node-2', label: '信心下降', type: 'decision', position: { x: 180, y: 300 }, description: '市场信心下降，投资意愿低迷。' },
      { id: 'c-node-3', label: '汇率压力', type: 'decision', position: { x: 320, y: 150 }, description: '汇率贬值压力，资本外流风险。' },
      { id: 'c-node-4', label: '银行风险', type: 'decision', position: { x: 320, y: 250 }, description: '部分银行出现流动性压力。' },
      { id: 'c-node-5', label: '贸易摩擦', type: 'decision', position: { x: 460, y: 200 }, description: '外部贸易环境恶化。' },
      { id: 'c-node-end', label: '终点', type: 'end', position: { x: 600, y: 200 }, description: '成功走出滞胀，实现稳定增长。' },
    ],
    paths: [
      {
        from: 'c-node-start',
        to: 'c-node-1',
        decisions: [
          {
            id: 'c-dec-tight',
            label: '强力收紧',
            description: '大幅加息抑制通胀',
            resourceEffects: [
              { resource: 'lendingRate', change: 1, type: 'absolute' },
              { resource: 'inflation', change: -1.2, type: 'absolute' },
              { resource: 'gdpGrowth', change: -1, type: 'absolute' },
              { resource: 'employment', change: -0.8, type: 'absolute' },
            ],
          },
          {
            id: 'c-dec-cautious',
            label: '谨慎加息',
            description: '小幅加息，观察效果',
            resourceEffects: [
              { resource: 'lendingRate', change: 0.5, type: 'absolute' },
              { resource: 'inflation', change: -0.6, type: 'absolute' },
              { resource: 'gdpGrowth', change: -0.4, type: 'absolute' },
            ],
          },
        ],
      },
      {
        from: 'c-node-start',
        to: 'c-node-2',
        decisions: [
          {
            id: 'c-dec-stimulate',
            label: '刺激经济',
            description: '降准降息刺激增长',
            resourceEffects: [
              { resource: 'reserveRequirement', change: -2, type: 'absolute' },
              { resource: 'lendingRate', change: -0.5, type: 'absolute' },
              { resource: 'gdpGrowth', change: 0.8, type: 'absolute' },
              { resource: 'inflation', change: 0.6, type: 'absolute' },
              { resource: 'employment', change: 0.3, type: 'absolute' },
            ],
          },
          {
            id: 'c-dec-neutral',
            label: '中性观望',
            description: '保持中性，观察数据',
            resourceEffects: [
              { resource: 'gdpGrowth', change: 0.2, type: 'absolute' },
              { resource: 'inflation', change: 0.4, type: 'absolute' },
            ],
          },
        ],
      },
      {
        from: 'c-node-1',
        to: 'c-node-3',
        decisions: [
          {
            id: 'c-dec-capital',
            label: '资本管制',
            description: '加强资本流动管理',
            resourceEffects: [
              { resource: 'reserveRequirement', change: 1, type: 'absolute' },
              { resource: 'inflation', change: -0.3, type: 'absolute' },
              { resource: 'gdpGrowth', change: -0.2, type: 'absolute' },
            ],
          },
          {
            id: 'c-dec-rate-defend',
            label: '加息稳汇率',
            description: '提高利率防御汇率',
            resourceEffects: [
              { resource: 'lendingRate', change: 0.5, type: 'absolute' },
              { resource: 'inflation', change: -0.5, type: 'absolute' },
              { resource: 'gdpGrowth', change: -0.5, type: 'absolute' },
              { resource: 'employment', change: -0.3, type: 'absolute' },
            ],
          },
        ],
      },
      {
        from: 'c-node-2',
        to: 'c-node-4',
        decisions: [
          {
            id: 'c-dec-liquidity',
            label: '注入流动性',
            description: '向银行体系注入流动性',
            resourceEffects: [
              { resource: 'reserveRequirement', change: -1, type: 'absolute' },
              { resource: 'lendingRate', change: -0.3, type: 'absolute' },
              { resource: 'gdpGrowth', change: 0.5, type: 'absolute' },
              { resource: 'employment', change: 0.2, type: 'absolute' },
            ],
          },
          {
            id: 'c-dec-targeted',
            label: '定向支持',
            description: '定向支持中小企业',
            resourceEffects: [
              { resource: 'lendingRate', change: -0.4, type: 'absolute' },
              { resource: 'gdpGrowth', change: 0.4, type: 'absolute' },
              { resource: 'employment', change: 0.3, type: 'absolute' },
            ],
          },
        ],
      },
      {
        from: 'c-node-3',
        to: 'c-node-5',
        decisions: [
          {
            id: 'c-dec-trade',
            label: '稳定预期管理',
            description: '稳定市场预期',
            resourceEffects: [
              { resource: 'gdpGrowth', change: 0.4, type: 'absolute' },
              { resource: 'employment', change: 0.2, type: 'absolute' },
              { resource: 'inflation', change: -0.2, type: 'absolute' },
            ],
          },
          {
            id: 'c-dec-diversify',
            label: '多元策略',
            description: '多元化政策组合',
            resourceEffects: [
              { resource: 'reserveRequirement', change: -0.5, type: 'absolute' },
              { resource: 'gdpGrowth', change: 0.3, type: 'absolute' },
              { resource: 'employment', change: 0.2, type: 'absolute' },
            ],
          },
        ],
      },
      {
        from: 'c-node-4',
        to: 'c-node-5',
        decisions: [
          {
            id: 'c-dec-prudent',
            label: '审慎监管',
            description: '加强金融监管',
            resourceEffects: [
              { resource: 'inflation', change: -0.3, type: 'absolute' },
              { resource: 'gdpGrowth', change: 0.2, type: 'absolute' },
            ],
          },
          {
            id: 'c-dec-reform',
            label: '结构性改革',
            description: '推进结构性改革',
            resourceEffects: [
              { resource: 'gdpGrowth', change: 0.5, type: 'absolute' },
              { resource: 'employment', change: 0.3, type: 'absolute' },
            ],
          },
        ],
      },
      {
        from: 'c-node-5',
        to: 'c-node-end',
        decisions: [
          {
            id: 'c-dec-final-balance',
            label: '综合平衡',
            description: '综合平衡各项指标',
            resourceEffects: [
              { resource: 'inflation', change: -0.5, type: 'absolute' },
              { resource: 'gdpGrowth', change: 0.3, type: 'absolute' },
              { resource: 'employment', change: 0.2, type: 'absolute' },
            ],
          },
          {
            id: 'c-dec-final-optimize',
            label: '优化结构',
            description: '优化经济结构',
            resourceEffects: [
              { resource: 'inflation', change: -0.3, type: 'absolute' },
              { resource: 'gdpGrowth', change: 0.5, type: 'absolute' },
              { resource: 'employment', change: 0.3, type: 'absolute' },
            ],
          },
        ],
      },
    ],
    targetConditions: [
      { resource: 'inflation', min: 2.5, max: 3.5, weight: 35 },
      { resource: 'gdpGrowth', min: 5, max: 6.5, weight: 35 },
      { resource: 'employment', min: 4, max: 5, weight: 30 },
    ],
  },
];

export const allMockLevels = [...mockLevels, ...mockLevelsChallenging];
