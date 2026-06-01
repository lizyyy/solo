import type { LevelConfig } from '../types';

export const mockLevels: LevelConfig[] = [
  {
    id: 'level-1',
    name: '关卡一：导数入门坡道',
    description: '基础资源管理，适合初学者练习导数概念',
    initialState: {
      resources: 100,
      score: 0,
      risk: 10,
      isNegative: false,
    },
    zones: [
      {
        id: 'zone-1-1',
        name: '匀速坡道',
        x: 50,
        y: 100,
        width: 180,
        height: 120,
        effect: {
          resources: -10,
          score: 15,
          risk: 5,
          formula: 'score += 15, resources -= 10, risk += 5',
          description: '基础得分动作，消耗资源换取分数',
        },
        style: {
          backgroundColor: '#457b9d',
          borderRadius: '8px',
        },
      },
      {
        id: 'zone-1-2',
        name: '加速跳台',
        x: 280,
        y: 80,
        width: 160,
        height: 140,
        effect: {
          resources: -20,
          score: 35,
          risk: 15,
          formula: 'score += 35, resources -= 20, risk += 15',
          description: '高风险高回报，资源消耗加倍',
        },
        style: {
          backgroundColor: '#ff6b35',
          borderRadius: '50% 50% 0 0',
        },
      },
      {
        id: 'zone-1-3',
        name: '休息平台',
        x: 480,
        y: 120,
        width: 150,
        height: 100,
        effect: {
          resources: 15,
          score: 0,
          risk: -10,
          formula: 'resources += 15, risk -= 10',
          description: '恢复资源，降低风险',
        },
        style: {
          backgroundColor: '#2a9d8f',
          borderRadius: '4px',
        },
      },
    ],
    elements: [
      { id: 'elem-1-1', label: '滑板🛹', emoji: '🛹', baseValue: 1 },
      { id: 'elem-1-2', label: '轮滑🛼', emoji: '🛼', baseValue: 1.2 },
    ],
    rawNotes: `老冯的课堂计分表 - 导数入门
这组孩子好像对变化率理解还可以
注意：第三组上次做的时候资源差点负了，这次要盯紧
小明上次在这里卡住了，记得多提醒
哦对了，张老师说这周要检查计分表，别忘记录完整

【临时备注】
2026.5.28 第一组同学表现不错，风险控制得好
2026.5.29 小李把公式搞反了，扣了20分资源
错别字："导书"应该是"导数"，但原始表就这么写的`,
    rules: [
      {
        id: 'rule-1-1',
        name: '基础加减规则',
        condition: 'always',
        formula: '直接应用zone的effect值',
        description: '每个区域直接应用预设的变化值',
      },
      {
        id: 'rule-1-2',
        name: '元素倍率',
        condition: 'always',
        formula: '变化量 *= element.baseValue',
        description: '不同元素有不同的倍率加成',
      },
    ],
    source: '老冯课堂计分表 - 2026春季学期',
    createdAt: Date.now() - 86400000 * 7,
  },
  {
    id: 'level-2',
    name: '关卡二：积分曲面碗池',
    description: '中等复杂度计算，引入积分概念',
    initialState: {
      resources: 100,
      score: 0,
      risk: 10,
      isNegative: false,
    },
    zones: [
      {
        id: 'zone-2-1',
        name: '定积分碗',
        x: 40,
        y: 80,
        width: 200,
        height: 160,
        effect: {
          resources: -15,
          score: 25,
          risk: 10,
          formula: 'score += elementValue * 25, resources -= 15, risk += 10',
          description: '积分计算，得分与元素值成正比',
        },
        style: {
          backgroundColor: '#e76f51',
          borderRadius: '50%',
        },
      },
      {
        id: 'zone-2-2',
        name: '变上限坡道',
        x: 280,
        y: 60,
        width: 180,
        height: 180,
        effect: {
          resources: -25,
          score: 50,
          risk: 20,
          formula: 'score += elementValue * 50, resources -= 25, risk += 20',
          description: '风险更高，但回报也更大',
        },
        style: {
          backgroundColor: '#f4a261',
          borderRadius: '30% 70% 70% 30%',
        },
      },
      {
        id: 'zone-2-3',
        name: '换元补给站',
        x: 500,
        y: 90,
        width: 160,
        height: 150,
        effect: {
          resources: 25,
          score: 10,
          risk: -15,
          formula: 'resources += 25, score += 10, risk -= 15',
          description: '通过换元法恢复资源',
        },
        style: {
          backgroundColor: '#264653',
          borderRadius: '10px 30px',
        },
      },
      {
        id: 'zone-2-4',
        name: '分部积分台',
        x: 150,
        y: 260,
        width: 220,
        height: 120,
        effect: {
          resources: -30,
          score: 70,
          risk: 25,
          formula: 'score += 70, resources -= 30, risk += 25',
          description: '高难度动作，需要掌握分部积分',
        },
        style: {
          backgroundColor: '#283618',
          borderRadius: '4px',
        },
      },
    ],
    elements: [
      { id: 'elem-2-1', label: '滑板🛹', emoji: '🛹', baseValue: 1 },
      { id: 'elem-2-2', label: '轮滑🛼', emoji: '🛼', baseValue: 1.3 },
      { id: 'elem-2-3', label: '小轮车🚲', emoji: '🚲', baseValue: 1.5 },
    ],
    rawNotes: `积分曲面碗池 - 课堂记录
这部分学生普遍反映难，要放慢速度
上次小王在这里连续三次都没算对
注意：风险超过50就要提醒学生停下来
-- 老冯 5.20

【补充】
张同学的创意解法值得表扬，虽然结果错了
李老师说下次要加一个陷阱区域
原始记录："积份"是学生写错的，保留原样`,
    rules: [
      {
        id: 'rule-2-1',
        name: '元素倍率计分',
        condition: 'always',
        formula: 'score += zone.effect.score * element.baseValue',
        description: '分数与元素基础值成正比',
      },
      {
        id: 'rule-2-2',
        name: '风险累加',
        condition: 'risk > 50',
        formula: 'risk += 额外5点惩罚',
        description: '风险过高时会有额外惩罚',
      },
    ],
    source: '老冯微积分课堂 - 积分专题',
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'level-3',
    name: '关卡三：极限微积分U池',
    description: '高风险高回报，综合运用微积分知识',
    initialState: {
      resources: 100,
      score: 0,
      risk: 10,
      isNegative: false,
    },
    zones: [
      {
        id: 'zone-3-1',
        name: '左极限壁',
        x: 30,
        y: 60,
        width: 150,
        height: 200,
        effect: {
          resources: -20,
          score: 40,
          risk: 20,
          formula: 'score += 40, resources -= 20, risk += 20',
          description: '从左侧趋近极限',
        },
        style: {
          backgroundColor: '#9d0208',
          borderRadius: '20px 0 0 20px',
        },
      },
      {
        id: 'zone-3-2',
        name: '右极限壁',
        x: 520,
        y: 60,
        width: 150,
        height: 200,
        effect: {
          resources: -20,
          score: 40,
          risk: 20,
          formula: 'score += 40, resources -= 20, risk += 20',
          description: '从右侧趋近极限',
        },
        style: {
          backgroundColor: '#9d0208',
          borderRadius: '0 20px 20px 0',
        },
      },
      {
        id: 'zone-3-3',
        name: 'U池底部',
        x: 200,
        y: 180,
        width: 300,
        height: 120,
        effect: {
          resources: -40,
          score: 100,
          risk: 35,
          formula: 'score += 100, resources -= 40, risk += 35',
          description: '极限存在的条件：左右极限相等',
        },
        style: {
          backgroundColor: '#6a040f',
          borderRadius: '0 0 50% 50%',
        },
      },
      {
        id: 'zone-3-4',
        name: '无穷大跳台',
        x: 300,
        y: 40,
        width: 120,
        height: 100,
        effect: {
          resources: -60,
          score: 150,
          risk: 50,
          formula: 'score += 150, resources -= 60, risk += 50',
          description: '趋向无穷大的极限，风险极高',
        },
        style: {
          backgroundColor: '#dc2f02',
          clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
        },
      },
      {
        id: 'zone-3-5',
        name: '急救站',
        x: 700,
        y: 120,
        width: 100,
        height: 120,
        effect: {
          resources: 40,
          score: -10,
          risk: -30,
          formula: 'resources += 40, score -= 10, risk -= 30',
          description: '紧急恢复，但要扣分',
        },
        style: {
          backgroundColor: '#ffffff',
          borderRadius: '50%',
          border: '4px solid #e63946',
        },
      },
    ],
    elements: [
      { id: 'elem-3-1', label: '滑板🛹', emoji: '🛹', baseValue: 1 },
      { id: 'elem-3-2', label: '轮滑🛼', emoji: '🛼', baseValue: 1.4 },
      { id: 'elem-3-3', label: '小轮车🚲', emoji: '🚲', baseValue: 1.6 },
      { id: 'elem-3-4', label: '滑雪板🎿', emoji: '🎿', baseValue: 2 },
    ],
    rawNotes: `极限微积分U池 - 期末考试用
警告：这关很容易把资源搞负！
必须严格执行：资源一旦变负立即暂停
上次三班的小组在这里全军覆没
-- 老冯的备课笔记

【考试注意事项】
1. 不允许连续跳无穷大跳台
2. 急救站每局最多用2次
3. 风险超过80必须强制休息
学生写错的："级限"、"无穹大" 保留原始记录
【补注】6月15日调整：无穷大跳台风险从40调到50`,
    rules: [
      {
        id: 'rule-3-1',
        name: '高风险惩罚',
        condition: 'risk > 80',
        formula: 'resources -= 10 额外惩罚',
        description: '风险超过80时每步额外扣10资源',
      },
      {
        id: 'rule-3-2',
        name: '急救站限制',
        condition: '急救站使用超过2次',
        formula: '禁止使用急救站',
        description: '每局急救站最多使用2次',
      },
      {
        id: 'rule-3-3',
        name: '极限连击奖励',
        condition: '连续左右壁各一次',
        formula: 'score += 50 连击奖励',
        description: '左右极限都完成时额外加分',
      },
    ],
    source: '老冯微积分期末考核 - 极限专题',
    createdAt: Date.now() - 86400000,
  },
];

export const defaultOperator = '老冯';
export const defaultSource = '微积分滑板公园课堂计分系统';
