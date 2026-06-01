import type { Level } from '@/types';

export const levels: Level[] = [
  {
    id: 'level-001',
    title: '早高峰客流调度',
    description: '早高峰期间，1号线国贸站出现突发大客流，你需要根据课堂计分表中的数据做出正确的调度决策。',
    difficulty: 'easy',
    totalRounds: 3,
    totalScore: 100,
    createdAt: '2026-05-15T09:00:00Z',
    teacherNote: '本次活动重点考察学生对客流数据的分析能力和应急决策能力。请特别关注第2回合的空值处理和第3回合的边界情况。',
    rounds: [
      {
        id: 1,
        title: '客流峰值分析',
        description: '根据课堂计分表数据，判断当前客流峰值并预测持续时间。',
        scene: '时间：周一早8:00-9:00，地点：1号线国贸站。站台已出现拥挤现象，乘客排队长度超过安全警戒线。',
        evidence: [
          {
            id: 'ev-1-1',
            source: '课堂计分表-客流统计',
            content: '当前进站客流量',
            value: 2850,
            highlight: true,
          },
          {
            id: 'ev-1-2',
            source: '课堂计分表-历史数据',
            content: '历史同期平均客流量',
            value: 2100,
            highlight: false,
          },
          {
            id: 'ev-1-3',
            source: '课堂计分表-运力配置',
            content: '当前上线列车数',
            value: 18,
            highlight: false,
          },
          {
            id: 'ev-1-4',
            source: '课堂计分表-安全阈值',
            content: '站台最大承载量（人/次）',
            value: 3000,
            highlight: true,
          },
        ],
        choices: [
          {
            id: 'ch-1-a',
            text: '客流量已接近阈值，建议增加2列备车，预计高峰将持续45分钟',
            isCorrect: true,
            score: 35,
            feedback: '正确！根据数据分析，当前客流量2850已接近3000的安全阈值，比历史均值高出35.7%，增加备车是合理决策。',
            reasonReference: '课堂计分表-客流统计第3页第2节：客流超过阈值90%时应启动应急预案',
          },
          {
            id: 'ch-1-b',
            text: '客流量正常，无需额外调度，高峰将在30分钟后结束',
            isCorrect: false,
            score: 0,
            feedback: '错误。当前客流量2850已接近安全阈值3000，比历史均值2100高出很多，需要立即采取措施。',
            reasonReference: '扣分原因：未正确识别客流峰值，忽略了安全阈值数据',
          },
          {
            id: 'ch-1-c',
            text: '立即关闭车站入口，等待客流疏散',
            isCorrect: false,
            score: 10,
            feedback: '不完全正确。虽然需要采取措施，但直接关闭入口过于激进，应先尝试增加运力。',
            reasonReference: '扣分原因：应急处置过度，未遵循分级响应原则',
          },
        ],
        correctChoiceId: 'ch-1-a',
        deductionReasons: [
          {
            id: 'ded-1-1',
            reason: '未正确识别客流峰值',
            evidence: '课堂计分表显示当前客流2850，已达阈值95%，但选择认为正常',
            deduction: 35,
          },
          {
            id: 'ded-1-2',
            reason: '应急处置过度',
            evidence: '未达到关闭车站的条件（阈值100%），但选择直接关闭入口',
            deduction: 25,
          },
        ],
      },
      {
        id: 2,
        title: '换乘站运力调配',
        description: '国贸站作为换乘站，需要协调多条线路的运力。请根据不完整的数据做出判断。',
        scene: '8:30，10号线换乘通道出现拥堵。请注意：10号线的部分数据在课堂计分表中缺失。',
        evidence: [
          {
            id: 'ev-2-1',
            source: '课堂计分表-1号线',
            content: '1号线发车间隔',
            value: '2分钟',
            highlight: true,
          },
          {
            id: 'ev-2-2',
            source: '课堂计分表-10号线',
            content: '10号线发车间隔',
            value: null,
            highlight: true,
          },
          {
            id: 'ev-2-3',
            source: '课堂计分表-换乘数据',
            content: '换乘通道人流量（人/小时）',
            value: 8500,
            highlight: true,
          },
          {
            id: 'ev-2-4',
            source: '课堂计分表-运营规范',
            content: '换乘通道设计容量',
            value: 10000,
            highlight: false,
          },
        ],
        choices: [
          {
            id: 'ch-2-a',
            text: '10号线数据缺失，无法判断，暂不采取行动',
            isCorrect: false,
            score: 5,
            feedback: '错误。虽然10号线数据缺失，但可以根据换乘人流量和1号线数据进行推断。8500的换乘量已接近设计容量的85%，应采取措施。',
            reasonReference: '扣分原因：未处理空值数据，未能利用已有信息进行合理推断',
          },
          {
            id: 'ch-2-b',
            text: '根据换乘量推断10号线运力紧张，请求10号线缩短发车间隔至2.5分钟，同时在换乘通道增加引导人员',
            isCorrect: true,
            score: 35,
            feedback: '正确！虽然10号线数据缺失，但通过换乘量8500（已达容量85%）和1号线2分钟间隔，可以合理推断10号线需要增加运力。',
            reasonReference: '课堂计分表-运营规范第5章：数据不完整时的决策原则',
          },
          {
            id: 'ch-2-c',
            text: '关闭换乘通道，引导乘客选择其他换乘站',
            isCorrect: false,
            score: 10,
            feedback: '不完全正确。关闭换乘通道会造成更大混乱，应先协调运力和增加引导。',
            reasonReference: '扣分原因：未考虑乘客体验，处置措施过于激进',
          },
        ],
        correctChoiceId: 'ch-2-b',
        deductionReasons: [
          {
            id: 'ded-2-1',
            reason: '未处理空值数据',
            evidence: '10号线发车间隔数据为空，但未利用已有数据进行合理推断',
            deduction: 30,
          },
          {
            id: 'ded-2-2',
            reason: '处置措施影响乘客体验',
            evidence: '关闭换乘通道会导致大量乘客绕行，不符合服务规范',
            deduction: 25,
          },
        ],
      },
      {
        id: 3,
        title: '高峰结束预判',
        description: '判断早高峰何时结束，以便及时调整运力，这是一个边界情况。',
        scene: '时间：9:00。课堂计分表显示客流量刚好处于阈值边界。你需要判断是否可以开始减少运力。',
        evidence: [
          {
            id: 'ev-3-1',
            source: '课堂计分表-实时客流',
            content: '当前客流量',
            value: 3000,
            highlight: true,
          },
          {
            id: 'ev-3-2',
            source: '课堂计分表-安全阈值',
            content: '安全阈值',
            value: 3000,
            highlight: true,
          },
          {
            id: 'ev-3-3',
            source: '课堂计分表-历史趋势',
            content: '过去15分钟客流变化率',
            value: '-2%',
            highlight: false,
          },
          {
            id: 'ev-3-4',
            source: '课堂计分表-重复记录',
            content: '客流量（重复记录1）',
            value: 3000,
            highlight: false,
          },
          {
            id: 'ev-3-5',
            source: '课堂计分表-重复记录',
            content: '客流量（重复记录2）',
            value: 3000,
            highlight: false,
          },
        ],
        choices: [
          {
            id: 'ch-3-a',
            text: '客流量正好等于阈值，且呈下降趋势，观察10分钟后如继续下降则减少1列备车',
            isCorrect: true,
            score: 30,
            feedback: '正确！这是边界情况（客流正好等于阈值），虽然有下降趋势，但应谨慎观察，确认趋势后再调整运力。',
            reasonReference: '课堂计分表-边界处理规则：等于阈值时按"观察确认"原则处理',
          },
          {
            id: 'ch-3-b',
            text: '客流已达阈值上限，立即增加更多列车',
            isCorrect: false,
            score: 5,
            feedback: '错误。客流虽然等于阈值，但已呈下降趋势（-2%），不需要增加更多列车。',
            reasonReference: '扣分原因：未正确处理边界情况，忽略了客流变化趋势数据',
          },
          {
            id: 'ch-3-c',
            text: '立即减少3列备车，高峰已经结束',
            isCorrect: false,
            score: 0,
            feedback: '错误。客流仍在阈值水平，虽然有下降趋势，但立即大幅减少运力可能导致再次拥堵。',
            reasonReference: '扣分原因：对边界情况判断失误，未遵循谨慎原则',
          },
        ],
        correctChoiceId: 'ch-3-a',
        deductionReasons: [
          {
            id: 'ded-3-1',
            reason: '未正确处理边界情况',
            evidence: '客流正好等于阈值，属于边界情况，应按观察确认原则处理',
            deduction: 25,
          },
          {
            id: 'ded-3-2',
            reason: '未考虑客流变化趋势',
            evidence: '忽略了-2%的变化率数据，做出了过于激进的决策',
            deduction: 30,
          },
        ],
      },
    ],
  },
];

export const getLevelById = (id: string): Level | undefined => {
  return levels.find(level => level.id === id);
};

export const getDefaultLevel = (): Level => {
  return levels[0];
};
