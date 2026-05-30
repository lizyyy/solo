import { 
  SourceMeta, 
  ProspectusData, 
  LedgerData, 
  PaymentVoucher,
  SourceType,
  FundCategory
} from '../types';

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const parseCsv = (content: string): string[][] => {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
};

export const parseProspectusCsv = (
  content: string, 
  sourceId: string
): ProspectusData[] => {
  const rows = parseCsv(content);
  if (rows.length < 2) return [];
  
  const headers = rows[0].map(h => h.toLowerCase());
  const data = rows.slice(1);
  
  return data.map(row => ({
    id: generateId(),
    sourceId,
    projectName: row[headers.indexOf('项目名称')] || row[0] || '',
    bondCode: row[headers.indexOf('债券代码')] || row[1] || '',
    issueAmount: parseFloat(row[headers.indexOf('发行金额')] || row[2] || '0'),
    plannedUse: row[headers.indexOf('计划用途')] || row[3] || '',
    plannedCategory: (row[headers.indexOf('用途分类')] || row[4] || '其他') as FundCategory,
    expectedDate: row[headers.indexOf('预计日期')] || row[5] || '',
    disclosureStandard: row[headers.indexOf('披露标准')] || row[6] || '',
    disclosureVersion: row[headers.indexOf('披露版本')] || row[7] || 'v1.0'
  }));
};

export const parseLedgerCsv = (
  content: string, 
  sourceId: string
): LedgerData[] => {
  const rows = parseCsv(content);
  if (rows.length < 2) return [];
  
  const headers = rows[0].map(h => h.toLowerCase());
  const data = rows.slice(1);
  
  return data.map(row => ({
    id: generateId(),
    sourceId,
    projectName: row[headers.indexOf('项目名称')] || row[0] || '',
    plannedAmount: parseFloat(row[headers.indexOf('计划金额')] || row[1] || '0'),
    actualAmount: parseFloat(row[headers.indexOf('实际金额')] || row[2] || '0'),
    category: (row[headers.indexOf('用途分类')] || row[3] || '其他') as FundCategory,
    progress: parseFloat(row[headers.indexOf('进度')] || row[4] || '0'),
    plannedDate: row[headers.indexOf('计划日期')] || row[5] || '',
    actualDate: row[headers.indexOf('实际日期')] || row[6] || undefined,
    status: row[headers.indexOf('状态')] || row[7] || '进行中'
  }));
};

export const parsePaymentCsv = (
  content: string, 
  sourceId: string
): PaymentVoucher[] => {
  const rows = parseCsv(content);
  if (rows.length < 2) return [];
  
  const headers = rows[0].map(h => h.toLowerCase());
  const data = rows.slice(1);
  
  return data.map(row => ({
    id: generateId(),
    sourceId,
    voucherNumber: row[headers.indexOf('凭证号')] || row[0] || '',
    projectName: row[headers.indexOf('项目名称')] || row[1] || '',
    amount: parseFloat(row[headers.indexOf('金额')] || row[2] || '0'),
    paymentDate: row[headers.indexOf('付款日期')] || row[3] || '',
    payee: row[headers.indexOf('收款方')] || row[4] || '',
    category: (row[headers.indexOf('用途分类')] || row[5] || '其他') as FundCategory,
    description: row[headers.indexOf('摘要')] || row[6] || '',
    hasReceipt: (row[headers.indexOf('有发票')] || row[7] || '否') === '是',
    hasApproval: (row[headers.indexOf('已审批')] || row[8] || '否') === '是'
  }));
};

export const createSourceMeta = (
  type: SourceType,
  name: string,
  version: string,
  uploadUser: string,
  description?: string
): SourceMeta => ({
  id: generateId(),
  type,
  name,
  version,
  uploadDate: new Date().toISOString(),
  uploadUser,
  description
});

export const getSampleData = () => {
  const source1: SourceMeta = {
    id: 'src_001',
    type: 'prospectus',
    name: '2024年第一期绿色金融债券募集说明书',
    version: 'v1.0',
    uploadDate: '2024-01-15T10:00:00Z',
    uploadUser: '张三',
    description: '50亿元绿色金融债，主要用于清洁能源项目'
  };

  const source2: SourceMeta = {
    id: 'src_002',
    type: 'ledger',
    name: '2024年Q1绿色项目台账',
    version: 'v1.1',
    uploadDate: '2024-04-01T14:30:00Z',
    uploadUser: '李四',
    description: '更新了风电项目的实际进度'
  };

  const source3: SourceMeta = {
    id: 'src_003',
    type: 'payment',
    name: '2024年1-3月付款凭证',
    version: 'v1.0',
    uploadDate: '2024-04-05T09:15:00Z',
    uploadUser: '王五',
    description: '包含32笔付款记录'
  };

  const prospectuses: ProspectusData[] = [
    {
      id: 'pro_001',
      sourceId: 'src_001',
      projectName: '新疆哈密风电基地项目',
      bondCode: 'G24绿债01',
      issueAmount: 1500000000,
      plannedUse: '建设200MW风电场，配套储能设施',
      plannedCategory: '清洁能源',
      expectedDate: '2024-12-31',
      disclosureStandard: '《绿色债券支持项目目录（2021年版）》',
      disclosureVersion: 'v1.0'
    },
    {
      id: 'pro_002',
      sourceId: 'src_001',
      projectName: '深圳地铁14号线项目',
      bondCode: 'G24绿债01',
      issueAmount: 2000000000,
      plannedUse: '轨道交通建设，全长约50公里',
      plannedCategory: '清洁交通',
      expectedDate: '2025-06-30',
      disclosureStandard: '《绿色债券支持项目目录（2021年版）》',
      disclosureVersion: 'v1.0'
    },
    {
      id: 'pro_003',
      sourceId: 'src_001',
      projectName: '太湖流域污水处理厂扩建项目',
      bondCode: 'G24绿债01',
      issueAmount: 1000000000,
      plannedUse: '扩建污水处理能力至50万吨/日',
      plannedCategory: '可持续水资源管理',
      expectedDate: '2024-09-30',
      disclosureStandard: '《绿色债券支持项目目录（2021年版）》',
      disclosureVersion: 'v1.0'
    },
    {
      id: 'pro_004',
      sourceId: 'src_001',
      projectName: '上海临港分布式光伏项目',
      bondCode: 'G24绿债01',
      issueAmount: 500000000,
      plannedUse: '工业园区屋顶光伏，装机容量50MW',
      plannedCategory: '清洁能源',
      expectedDate: '2024-06-30',
      disclosureStandard: '《绿色债券支持项目目录（2020年版）》',
      disclosureVersion: 'v0.9'
    }
  ];

  const ledgers: LedgerData[] = [
    {
      id: 'led_001',
      sourceId: 'src_002',
      projectName: '新疆哈密风电基地项目',
      plannedAmount: 1500000000,
      actualAmount: 800000000,
      category: '清洁能源',
      progress: 53.3,
      plannedDate: '2024-12-31',
      actualDate: undefined,
      status: '进行中'
    },
    {
      id: 'led_002',
      sourceId: 'src_002',
      projectName: '深圳地铁14号线项目',
      plannedAmount: 2000000000,
      actualAmount: 1200000000,
      category: '清洁交通',
      progress: 60.0,
      plannedDate: '2025-06-30',
      actualDate: undefined,
      status: '进行中'
    },
    {
      id: 'led_003',
      sourceId: 'src_002',
      projectName: '太湖流域污水处理厂扩建项目',
      plannedAmount: 1000000000,
      actualAmount: 950000000,
      category: '废物处理',
      progress: 95.0,
      plannedDate: '2024-09-30',
      actualDate: undefined,
      status: '进行中'
    },
    {
      id: 'led_004',
      sourceId: 'src_002',
      projectName: '上海临港分布式光伏项目',
      plannedAmount: 500000000,
      actualAmount: 500000000,
      category: '清洁能源',
      progress: 100.0,
      plannedDate: '2024-06-30',
      actualDate: '2024-06-25',
      status: '已完成'
    }
  ];

  const vouchers: PaymentVoucher[] = [
    {
      id: 'pay_001',
      sourceId: 'src_003',
      voucherNumber: 'PAY202401001',
      projectName: '新疆哈密风电基地项目',
      amount: 200000000,
      paymentDate: '2024-01-15',
      payee: '新疆金风科技股份有限公司',
      category: '清洁能源',
      description: '风力发电机组采购款',
      hasReceipt: true,
      hasApproval: true
    },
    {
      id: 'pay_002',
      sourceId: 'src_003',
      voucherNumber: 'PAY202401002',
      projectName: '深圳地铁14号线项目',
      amount: 300000000,
      paymentDate: '2024-01-20',
      payee: '中国中铁股份有限公司',
      category: '清洁交通',
      description: '隧道工程进度款',
      hasReceipt: true,
      hasApproval: true
    },
    {
      id: 'pay_003',
      sourceId: 'src_003',
      voucherNumber: 'PAY202402001',
      projectName: '太湖流域污水处理厂扩建项目',
      amount: 150000000,
      paymentDate: '2024-02-10',
      payee: '碧水源科技股份有限公司',
      category: '可持续水资源管理',
      description: '水处理设备采购',
      hasReceipt: false,
      hasApproval: true
    },
    {
      id: 'pay_004',
      sourceId: 'src_003',
      voucherNumber: 'PAY202402002',
      projectName: '新疆哈密风电基地项目',
      amount: 300000000,
      paymentDate: '2024-02-25',
      payee: '新疆金风科技股份有限公司',
      category: '清洁能源',
      description: '塔筒及配件采购',
      hasReceipt: true,
      hasApproval: true
    },
    {
      id: 'pay_005',
      sourceId: 'src_003',
      voucherNumber: 'PAY202403001',
      projectName: '上海临港分布式光伏项目',
      amount: 500000000,
      paymentDate: '2024-03-15',
      payee: '隆基绿能科技股份有限公司',
      category: '清洁能源',
      description: '光伏组件采购及安装',
      hasReceipt: true,
      hasApproval: true
    },
    {
      id: 'pay_006',
      sourceId: 'src_003',
      voucherNumber: 'PAY202403002',
      projectName: '深圳地铁14号线项目',
      amount: 400000000,
      paymentDate: '2024-03-20',
      payee: '中国中铁股份有限公司',
      category: '清洁交通',
      description: '轨道铺设工程进度款',
      hasReceipt: true,
      hasApproval: true
    },
    {
      id: 'pay_007',
      sourceId: 'src_003',
      voucherNumber: 'PAY202403003',
      projectName: '太湖流域污水处理厂扩建项目',
      amount: 400000000,
      paymentDate: '2024-03-28',
      payee: '中建三局集团有限公司',
      category: '废物处理',
      description: '土建工程进度款',
      hasReceipt: true,
      hasApproval: false
    }
  ];

  return { sources: [source1, source2, source3], prospectuses, ledgers, vouchers };
};
