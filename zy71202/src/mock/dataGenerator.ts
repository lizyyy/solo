import dayjs from 'dayjs';
import type {
  ConvertibleBond,
  StockQuote,
  RedemptionAnnouncement,
  CustomerPosition,
  ReminderLog,
  DisposalTask,
  DataSourceTrace,
  TriggerWindowResult,
} from '@/types';

const BOND_TEMPLATES = [
  { code: '113050', name: '南银转债', stockCode: '601009', stockName: '南京银行', industry: '银行', rating: 'AAA' },
  { code: '127056', name: '中银转债', stockCode: '601988', stockName: '中国银行', industry: '银行', rating: 'AAA' },
  { code: '118020', name: '科创转债', stockCode: '688981', stockName: '中芯国际', industry: '半导体', rating: 'AAA' },
  { code: '127058', name: '蒙电转债', stockCode: '600863', stockName: '内蒙华电', industry: '电力', rating: 'AA+' },
  { code: '113548', name: '石英转债', stockCode: '603688', stockName: '石英股份', industry: '新材料', rating: 'AA' },
  { code: '123013', name: '横河转债', stockCode: '300539', stockName: '横河精密', industry: '机械设备', rating: 'AA-' },
  { code: '123027', name: '蓝晓转债', stockCode: '300487', stockName: '蓝晓科技', industry: '化工', rating: 'AA' },
  { code: '113058', name: '福能转债', stockCode: '600483', stockName: '福能股份', industry: '电力', rating: 'AAA' },
  { code: '127061', name: '美锦转债', stockCode: '000723', stockName: '美锦能源', industry: '煤炭', rating: 'AA' },
  { code: '118015', name: '金博转债', stockCode: '688598', stockName: '金博股份', industry: '新材料', rating: 'AA' },
  { code: '123054', name: '思特转债', stockCode: '300608', stockName: '思特奇', industry: '计算机', rating: 'A+' },
  { code: '113595', name: '花王转债', stockCode: '603007', stockName: '花王股份', industry: '建筑装饰', rating: 'AA-' },
];

const INSTITUTION_CUSTOMERS = [
  { id: 'C0001', name: '中国人寿保险股份有限公司', type: 'INSTITUTION' as const, tier: 'PLATINUM' as const, risk: 'R2' as const, manager: '张伟' },
  { id: 'C0002', name: '中国平安人寿保险股份有限公司', type: 'INSTITUTION' as const, tier: 'PLATINUM' as const, risk: 'R2' as const, manager: '李娜' },
  { id: 'C0003', name: '中信证券股份有限公司', type: 'INSTITUTION' as const, tier: 'GOLD' as const, risk: 'R3' as const, manager: '王强' },
  { id: 'C0004', name: '国泰君安证券股份有限公司', type: 'INSTITUTION' as const, tier: 'GOLD' as const, risk: 'R3' as const, manager: '刘芳' },
  { id: 'C0005', name: '南方基金管理股份有限公司', type: 'INSTITUTION' as const, tier: 'PLATINUM' as const, risk: 'R2' as const, manager: '陈明' },
];

const RETAIL_CUSTOMERS = [
  { id: 'C1001', name: '张三', type: 'RETAIL' as const, tier: 'GOLD' as const, risk: 'R3' as const, manager: '赵雪' },
  { id: 'C1002', name: '李四', type: 'RETAIL' as const, tier: 'SILVER' as const, risk: 'R2' as const, manager: '赵雪' },
  { id: 'C1003', name: '王五', type: 'RETAIL' as const, tier: 'GOLD' as const, risk: 'R4' as const, manager: '孙磊' },
  { id: 'C1004', name: '赵六', type: 'RETAIL' as const, tier: 'BRONZE' as const, risk: 'R1' as const, manager: '孙磊' },
  { id: 'C1005', name: '钱七', type: 'RETAIL' as const, tier: 'SILVER' as const, risk: 'R3' as const, manager: '周婷' },
  { id: 'C1006', name: '吴八', type: 'RETAIL' as const, tier: 'GOLD' as const, risk: 'R3' as const, manager: '周婷' },
  { id: 'C1007', name: '郑九', type: 'RETAIL' as const, tier: 'SILVER' as const, risk: 'R2' as const, manager: '赵雪' },
  { id: 'C1008', name: '冯十', type: 'RETAIL' as const, tier: 'BRONZE' as const, risk: 'R2' as const, manager: '孙磊' },
];

const generateId = () => Math.random().toString(36).substring(2, 11);

const generateHash = (data: string) => {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};

export const generateBonds = (): ConvertibleBond[] => {
  return BOND_TEMPLATES.map(template => {
    const conversionPrice = 5 + Math.random() * 20;
    const redemptionPrice = Number((conversionPrice * 1.3).toFixed(2));
    const stockPrice = Number((redemptionPrice * (0.9 + Math.random() * 0.5)).toFixed(2));
    const currentPrice = Number((100 + Math.random() * 50).toFixed(2));
    const conversionPremiumRate = Number(((currentPrice / (stockPrice / conversionPrice * 100) - 1) * 100).toFixed(2));
    
    return {
      bondCode: template.code,
      bondName: template.name,
      stockCode: template.stockCode,
      stockName: template.stockName,
      conversionPrice: Number(conversionPrice.toFixed(2)),
      redemptionPrice,
      currentPrice,
      stockPrice,
      conversionPremiumRate,
      industry: template.industry,
      rating: template.rating,
      maturityDate: dayjs().add(2 + Math.floor(Math.random() * 4), 'year').format('YYYY-MM-DD'),
    };
  });
};

export const generateStockQuotes = (stockCode: string, redemptionPrice: number, days: number = 45): StockQuote[] => {
  const quotes: StockQuote[] = [];
  let currentPrice = redemptionPrice * 0.95;
  const today = dayjs();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = today.subtract(i, 'day');
    if (date.day() === 0 || date.day() === 6) continue;
    
    const volatility = 0.02 + Math.random() * 0.03;
    const change = (Math.random() - 0.45) * volatility * currentPrice;
    currentPrice = Math.max(redemptionPrice * 0.8, currentPrice + change);
    
    const openPrice = Number(currentPrice.toFixed(2));
    const highPrice = Number((openPrice * (1 + Math.random() * 0.03)).toFixed(2));
    const lowPrice = Number((openPrice * (1 - Math.random() * 0.03)).toFixed(2));
    const closePrice = Number((openPrice * (0.97 + Math.random() * 0.06)).toFixed(2));
    
    quotes.push({
      stockCode,
      tradeDate: date.format('YYYY-MM-DD'),
      openPrice,
      highPrice,
      lowPrice,
      closePrice,
      volume: Math.floor(100000 + Math.random() * 500000),
      turnover: Math.floor(closePrice * (100000 + Math.random() * 500000)),
      meetRedemptionCondition: closePrice >= redemptionPrice,
    });
    
    currentPrice = closePrice;
  }
  
  return quotes;
};

export const generateAnnouncements = (bondCode: string, bondName: string): RedemptionAnnouncement[] => {
  const announcements: RedemptionAnnouncement[] = [];
  const now = dayjs();
  
  const scenarios = [
    { type: 'NORMAL', versions: 1 },
    { type: 'UPDATED', versions: 2 },
    { type: 'WITHDRAWN', versions: 2 },
    { type: 'MULTI_UPDATE', versions: 3 },
  ];
  
  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  let baseDate = now.subtract(15 + Math.floor(Math.random() * 20), 'day');
  
  for (let v = 1; v <= scenario.versions; v++) {
    let type: RedemptionAnnouncement['announcementType'] = 'PRE_ANNOUNCE';
    let title = `关于提前赎回${bondName}的提示性公告`;
    let isWithdrawn = false;
    let previousVersionId: string | null = null;
    
    if (scenario.type === 'UPDATED' && v === 2) {
      type = 'UPDATE_ANNOUNCE';
      title = `关于更新提前赎回${bondName}实施日期的公告`;
    }
    
    if (scenario.type === 'WITHDRAWN' && v === 2) {
      type = 'WITHDRAW_ANNOUNCE';
      title = `关于撤回提前赎回${bondName}的公告`;
      isWithdrawn = true;
    }
    
    if (scenario.type === 'MULTI_UPDATE') {
      if (v === 2) {
        type = 'UPDATE_ANNOUNCE';
        title = `关于调整${bondName}强赎价格的公告`;
      } else if (v === 3) {
        type = 'FORMAL_ANNOUNCE';
        title = `关于正式实施提前赎回${bondName}的公告`;
      }
    }
    
    if (v > 1) {
      previousVersionId = announcements[v - 2].id;
    }
    
    const announcementDate = baseDate.add(v * 2, 'day').format('YYYY-MM-DD');
    const redemptionDate = baseDate.add(v * 2 + 20, 'day').format('YYYY-MM-DD');
    const content = `根据《${bondName}可转换公司债券募集说明书》约定，${bondCode}${bondName}已满足提前赎回条件...`;
    
    announcements.push({
      id: generateId(),
      bondCode,
      announcementDate,
      announcementType: type,
      title,
      content,
      redemptionDate,
      redemptionCode: `R${bondCode}`,
      version: v,
      isWithdrawn,
      previousVersionId,
      source: '上海证券交易所',
      sourceUrl: `http://www.sse.com.cn/disclosure/listedinfo/announcement/c/${announcementDate}/${bondCode}_${v}.pdf`,
      fetchedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    });
  }
  
  return announcements;
};

export const generatePositions = (bonds: ConvertibleBond[]): CustomerPosition[] => {
  const positions: CustomerPosition[] = [];
  const allCustomers = [...INSTITUTION_CUSTOMERS, ...RETAIL_CUSTOMERS];
  
  bonds.forEach(bond => {
    const customerCount = 3 + Math.floor(Math.random() * 6);
    const shuffled = [...allCustomers].sort(() => Math.random() - 0.5).slice(0, customerCount);
    
    shuffled.forEach(customer => {
      const position = customer.type === 'INSTITUTION' 
        ? 5000 + Math.floor(Math.random() * 20000)
        : 100 + Math.floor(Math.random() * 2000);
      const costPrice = Number((95 + Math.random() * 15).toFixed(2));
      const positionAmount = Number((position * bond.currentPrice / 100).toFixed(2));
      const profitLoss = Number(((bond.currentPrice - costPrice) * position / 100).toFixed(2));
      
      positions.push({
        id: generateId(),
        customerId: customer.id,
        customerName: customer.name,
        customerType: customer.type,
        tier: customer.tier,
        riskLevel: customer.risk,
        bondCode: bond.bondCode,
        bondName: bond.bondName,
        position,
        positionAmount,
        costPrice,
        profitLoss,
        accountManager: customer.manager,
        source: '核心交易系统',
        fetchedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      });
    });
  });
  
  return positions;
};

export const generateReminderLogs = (
  bonds: ConvertibleBond[],
  positions: CustomerPosition[]
): ReminderLog[] => {
  const logs: ReminderLog[] = [];
  const now = dayjs();
  
  bonds.forEach(bond => {
    const bondPositions = positions.filter(p => p.bondCode === bond.bondCode);
    const reminderCount = Math.floor(bondPositions.length * 0.4);
    
    for (let i = 0; i < reminderCount; i++) {
      const pos = bondPositions[i % bondPositions.length];
      const date = now.subtract(1 + Math.floor(Math.random() * 14), 'day');
      const reminderTypes: ReminderLog['reminderType'][] = ['SMS', 'EMAIL', 'PHONE', 'SYSTEM'];
      const reminderType = reminderTypes[Math.floor(Math.random() * reminderTypes.length)];
      
      const idempotencyKey = `${bond.bondCode}_${pos.customerId}_${reminderType}_${date.format('YYYY-MM-DD')}`;
      
      logs.push({
        id: generateId(),
        bondCode: bond.bondCode,
        customerId: pos.customerId,
        customerName: pos.customerName,
        reminderType,
        reminderContent: `尊敬的${pos.customerName}，您持有的${bond.bondName}（${bond.bondCode}）已触发强赎条件，请及时关注。`,
        operatorId: 'OP001',
        operatorName: '系统管理员',
        remindedAt: date.format('YYYY-MM-DD HH:mm:ss'),
        status: 'SENT',
        idempotencyKey,
        sourceTaskId: generateId(),
      });
    }
  });
  
  return logs;
};

export const generateDisposalTasks = (
  bonds: ConvertibleBond[],
  positions: CustomerPosition[],
  triggerResults: Record<string, TriggerWindowResult>,
  announcements: Record<string, RedemptionAnnouncement[]>
): DisposalTask[] => {
  const tasks: DisposalTask[] = [];
  
  const triggeredBonds = Object.values(triggerResults).filter(r => {
    if (!r.isTriggered) return false;
    if (r.hasGap) return false;
    
    const bondAnns = announcements[r.bondCode] || [];
    const hasWithdrawn = bondAnns.some(a => a.isWithdrawn);
    if (hasWithdrawn) return false;
    
    return true;
  });
  
  triggeredBonds.forEach((result, index) => {
    const bond = bonds.find(b => b.bondCode === result.bondCode);
    if (!bond) return;
    
    const bondPositions = positions.filter(p => p.bondCode === bond.bondCode);
    const totalPosition = bondPositions.reduce((sum, p) => sum + p.positionAmount, 0);
    
    const statuses: DisposalTask['status'][] = ['PENDING_CONFIRM', 'PROCESSING', 'PROCESSED', 'RETURNED'];
    const priorities: DisposalTask['priority'][] = ['HIGH', 'MEDIUM', 'LOW'];
    
    const status = statuses[index % statuses.length];
    const priority = totalPosition > 10000000 ? 'HIGH' : priorities[Math.floor(Math.random() * priorities.length)];
    
    let returnReason: string | null = null;
    let supplementRequirements: string | null = null;
    let returnedAt: string | null = null;
    let confirmedAt: string | null = null;
    let processedAt: string | null = null;
    
    if (status === 'RETURNED') {
      returnReason = '正股行情数据存在断档，需要补全';
      supplementRequirements = '请提供完整的30个交易日行情数据，包括节假日说明';
      returnedAt = dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss');
    }
    
    if (status === 'PROCESSED') {
      confirmedAt = dayjs().subtract(3, 'day').format('YYYY-MM-DD HH:mm:ss');
      processedAt = dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss');
    }
    
    if (status === 'PROCESSING') {
      confirmedAt = dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss');
    }
    
    tasks.push({
      id: generateId(),
      bondCode: bond.bondCode,
      bondName: bond.bondName,
      taskType: 'REMIND_CUSTOMER',
      status,
      priority,
      customerCount: bondPositions.length,
      totalPosition: Number(totalPosition.toFixed(2)),
      assignedTo: ['张伟', '李娜', '王强', '刘芳'][index % 4],
      createdAt: dayjs().subtract(5 + index, 'day').format('YYYY-MM-DD HH:mm:ss'),
      confirmedAt,
      processedAt,
      returnedAt,
      returnReason,
      supplementRequirements,
      remarks: null,
      dataSourceSnapshot: {
        marketData: generateId(),
        announcement: generateId(),
        position: generateId(),
      },
    });
  });
  
  return tasks;
};

export const generateDataTraces = (
  bonds: ConvertibleBond[],
  stockQuotes: Record<string, StockQuote[]>,
  announcements: Record<string, RedemptionAnnouncement[]>,
  positions: CustomerPosition[]
): DataSourceTrace[] => {
  const traces: DataSourceTrace[] = [];
  
  bonds.forEach(bond => {
    const dataHash = generateHash(JSON.stringify(bond));
    traces.push({
      id: generateId(),
      dataType: 'BOND_INFO',
      sourceSystem: 'Wind金融终端',
      sourceUrl: `https://www.wind.com.cn/bond/${bond.bondCode}`,
      fetchedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      dataHash,
      rawDataSnapshot: JSON.stringify(bond, null, 2),
      createdBy: 'system',
    });
  });
  
  Object.entries(stockQuotes).forEach(([code, quotes]) => {
    const dataHash = generateHash(JSON.stringify(quotes));
    traces.push({
      id: generateId(),
      dataType: 'MARKET_DATA',
      sourceSystem: '同花顺行情系统',
      sourceUrl: `https://www.10jqka.com.cn/stock/${code}`,
      fetchedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      dataHash,
      rawDataSnapshot: JSON.stringify(quotes.slice(0, 3), null, 2),
      createdBy: 'system',
    });
  });
  
  Object.entries(announcements).forEach(([code, anns]) => {
    const dataHash = generateHash(JSON.stringify(anns));
    traces.push({
      id: generateId(),
      dataType: 'ANNOUNCEMENT',
      sourceSystem: '上交所公告系统',
      sourceUrl: `http://www.sse.com.cn/disclosure/listedinfo/announcement/?productId=${code}`,
      fetchedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      dataHash,
      rawDataSnapshot: JSON.stringify(anns, null, 2),
      createdBy: 'system',
    });
  });
  
  const posHash = generateHash(JSON.stringify(positions));
  traces.push({
    id: generateId(),
    dataType: 'POSITION',
    sourceSystem: '集中交易系统',
    sourceUrl: 'http://trading.internal/position/convertible',
    fetchedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    dataHash: posHash,
    rawDataSnapshot: JSON.stringify(positions.slice(0, 3), null, 2),
    createdBy: 'system',
  });
  
  return traces;
};

export const generateAllData = () => {
  const bonds = generateBonds();
  
  const stockQuotes: Record<string, StockQuote[]> = {};
  bonds.forEach(bond => {
    stockQuotes[bond.stockCode] = generateStockQuotes(bond.stockCode, bond.redemptionPrice);
  });
  
  const announcements: Record<string, RedemptionAnnouncement[]> = {};
  bonds.forEach(bond => {
    announcements[bond.bondCode] = generateAnnouncements(bond.bondCode, bond.bondName);
  });
  
  const positions = generatePositions(bonds);
  
  return {
    bonds,
    stockQuotes,
    announcements,
    positions,
  };
};
