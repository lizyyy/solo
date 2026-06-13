import type { BatchImportInput, Label } from '../../shared/types';

function labelOf(conf: number): Label {
  if (conf >= 0.75) return 'pass';
  if (conf <= 0.4) return 'reject';
  return 'uncertain';
}

export const NORMAL_BATCH: BatchImportInput = {
  batchId: 'gray-normal-20260613',
  batchName: '广告文案审核-正常批次',
  modelVersionA: 'ad-model-v2.3.1',
  modelVersionB: 'ad-model-v2.4.0',
  samples: [
    {
      id: 'normal-001',
      content: '【限时秒杀】正宗阳澄湖大闸蟹，买8只送4只，今日下单立减200元！',
      confidenceA: 0.88,
      confidenceB: 0.91,
      labelA: 'pass',
      labelB: 'pass',
      grayLabel: 'pass',
    },
    {
      id: 'normal-002',
      content: '本产品采用纯天然草本配方，无副作用，三天见效。',
      confidenceA: 0.42,
      confidenceB: 0.38,
      labelA: 'reject',
      labelB: 'reject',
      grayLabel: 'reject',
      annotatorNote: '含绝对化用语"三天见效"，应拒绝',
    },
    {
      id: 'normal-003',
      content: '全新一代智能手机，搭载旗舰芯片，性能提升50%，续航更持久。',
      confidenceA: 0.82,
      confidenceB: 0.79,
      labelA: 'pass',
      labelB: 'pass',
      grayLabel: 'pass',
    },
    {
      id: 'normal-004',
      content: '专业教师一对一辅导，孩子成绩快速提高，家长零负担。',
      confidenceA: 0.52,
      confidenceB: 0.48,
      labelA: 'uncertain',
      labelB: 'reject',
      grayLabel: 'uncertain',
      annotatorNote: '"快速提高"涉嫌夸大宣传，应拒绝',
    },
    {
      id: 'normal-005',
      content: '春季新款女装上市，面料舒适，版型修身，多色可选。',
      confidenceA: 0.93,
      confidenceB: 0.95,
      labelA: 'pass',
      labelB: 'pass',
      grayLabel: 'pass',
    },
  ],
};

export const WRONG_BATCH: BatchImportInput = {
  batchId: 'gray-wrong-20260613',
  batchName: '广告文案审核-错口径批次',
  modelVersionA: 'ad-model-v2.3.1',
  modelVersionB: 'ad-model-v2.4.0',
  samples: [
    {
      id: 'wrong-001',
      content: '百年老字号药膏，根治腰椎间盘突出，永不复发！',
      confidenceA: 0.35,
      confidenceB: 0.58,
      labelA: 'reject',
      labelB: 'uncertain',
      grayLabel: 'pass',
      annotatorNote: '"根治""永不复发"绝对化用语+医疗宣称，应拒绝',
    },
    {
      id: 'wrong-002',
      content: '本店减肥茶，一月瘦30斤，不反弹，无效退款。',
      confidenceA: 0.3,
      confidenceB: 0.45,
      labelA: 'reject',
      labelB: 'reject',
      grayLabel: 'pass',
      annotatorNote: '承诺疗效+绝对化，应拒绝',
    },
    {
      id: 'wrong-003',
      content: 'AI智能炒股系统，年化收益200%，稳赚不赔。',
      confidenceA: 0.28,
      confidenceB: 0.33,
      labelA: 'reject',
      labelB: 'reject',
      grayLabel: 'uncertain',
      annotatorNote: '金融承诺收益，应拒绝',
    },
    {
      id: 'wrong-004',
      content: '进口婴幼儿配方奶粉，全球最好，妈妈最放心的选择。',
      confidenceA: 0.55,
      confidenceB: 0.62,
      labelA: 'uncertain',
      labelB: 'pass',
      grayLabel: 'pass',
      annotatorNote: '"全球最好"绝对化，应拒绝',
    },
    {
      id: 'wrong-005',
      content: '有机蔬菜直供，无农药无化肥，国家认证，健康首选。',
      confidenceA: 0.57,
      confidenceB: 0.59,
      labelA: 'uncertain',
      labelB: 'uncertain',
      grayLabel: 'pass',
      annotatorNote: '"首选"绝对化，需复核，应通过',
    },
  ],
};

export const SUPPLEMENT_BATCH: BatchImportInput = {
  batchId: 'gray-supplement-20260613',
  batchName: '广告文案审核-补录批次',
  modelVersionA: 'ad-model-v2.3.1',
  modelVersionB: 'ad-model-v2.4.0',
  samples: [
    {
      id: 'suppl-001',
      content: '高端全屋定制家具，环保E0级板材，安装后即可入住。',
      confidenceA: 0.54,
      confidenceB: 0.49,
      labelA: 'uncertain',
      labelB: 'reject',
      grayLabel: 'uncertain',
      annotatorNote: '"即可入住"可能误导，应拒绝',
    },
    {
      id: 'suppl-002',
      content: '正宗土特产，产地直发，纯天然，零添加。',
      confidenceA: 0.58,
      confidenceB: 0.61,
      labelA: 'uncertain',
      labelB: 'pass',
      grayLabel: 'pass',
      annotatorNote: '"零添加"需资质，应拒绝',
    },
    {
      id: 'suppl-003',
      content: '新款蓝牙耳机，音质出众，续航48小时，IPX7防水。',
      confidenceA: 0.85,
      confidenceB: 0.87,
      labelA: 'pass',
      labelB: 'pass',
      grayLabel: 'pass',
    },
  ],
};

export const SEED_BATCHES = [NORMAL_BATCH, WRONG_BATCH, SUPPLEMENT_BATCH];
