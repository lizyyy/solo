import type { ValuationRecord } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 11);

const counterparties = ['中信证券', '华泰证券', '国泰君安', '海通证券', '广发证券', '招商证券', '申万宏源', '银河证券'];
const productTypes = ['欧式看涨', '欧式看跌', '美式看涨', '美式看跌', '鲨鱼鳍', '凤凰', '雪球', '二元期权'];
const statuses: Array<'pending' | 'normal' | 'abnormal' | 'false_positive'> = ['pending', 'normal', 'abnormal', 'false_positive'];

const generateVersions = (recordId: string, count: number) => {
  const versions = [];
  for (let i = 1; i <= count; i++) {
    versions.push({
      id: generateId(),
      recordId,
      version: `V${i}`,
      valuation: Math.round((Math.random() * 5000 + 1000) * 100) / 100,
      description: i === 1 ? '初步估值，模型参数待确认' :
                   i === 2 ? '调整波动率参数，与市场数据对齐' :
                   i === 3 ? '复核确认，交易对手方提供补充材料' :
                   '最终估值确认',
      createdAt: new Date(Date.now() - (count - i) * 86400000).toISOString(),
      operator: ['张三', '李四', '王五', '赵六'][Math.floor(Math.random() * 4)]
    });
  }
  return versions;
};

const generateJudgments = (recordId: string, hasJudgment: boolean) => {
  if (!hasJudgment) return [];
  return [{
    id: generateId(),
    recordId,
    oldStatus: 'abnormal' as const,
    newStatus: 'normal' as const,
    oldRemark: '敞口超限，触发预警阈值',
    newRemark: '经核实，对冲交易已完成，敞口在合规范围内',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    operator: '清算专员A'
  }];
};

export const mockRecords: ValuationRecord[] = Array.from({ length: 35 }, (_, i) => {
  const id = generateId();
  const versionCount = Math.floor(Math.random() * 3) + 2;
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  
  return {
    id,
    tradeId: `OTC${String(20240001 + i).padStart(8, '0')}`,
    counterparty: counterparties[Math.floor(Math.random() * counterparties.length)],
    productType: productTypes[Math.floor(Math.random() * productTypes.length)],
    notionalAmount: Math.round((Math.random() * 50000000 + 5000000) * 100) / 100,
    currentStatus: status,
    currentRemark: status === 'abnormal' ? '敞口超限，触发预警阈值' :
                   status === 'false_positive' ? '名单误命中，实际无异常' :
                   status === 'normal' ? '正常，无异常' :
                   '待处理',
    isFalsePositive: status === 'false_positive',
    createdAt: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
    versions: generateVersions(id, versionCount),
    judgments: generateJudgments(id, status !== 'pending' && Math.random() > 0.5)
  };
});

export const templateColumns = [
  { key: 'tradeId', label: '交易编号', required: true },
  { key: 'counterparty', label: '交易对手', required: true },
  { key: 'productType', label: '产品类型', required: true },
  { key: 'notionalAmount', label: '名义本金', required: true },
  { key: 'valuation', label: '估值金额', required: false },
  { key: 'version', label: '估值版本', required: false },
  { key: 'description', label: '说明', required: false }
];

export const sampleImportData = [
  ['交易编号', '交易对手', '产品类型', '名义本金', '估值金额', '估值版本', '说明'],
  ['OTC20240001', '中信证券', '欧式看涨', 10000000, 1250000, 'V1', '初步估值'],
  ['OTC20240002', '华泰证券', '雪球', 50000000, 8500000, 'V2', '调整后估值'],
  ['OTC20240003', '国泰君安', '凤凰', 20000000, 3200000, 'V1', '待复核']
];
