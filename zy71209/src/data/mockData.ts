import type {
  Customer,
  Pledge,
  MarketData,
  SupplementRecord,
  ExtensionRecord,
  DisposalReport,
  MarginCall,
  HistoryRecord,
} from '../types';
import { generateId } from '../utils/calculator';
import { detectSpecialFlags } from '../utils/flagDetector';

const now = new Date();
const today = now.toISOString().split('T')[0];
const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString().split('T')[0];

export const mockCustomers: Customer[] = [
  {
    id: generateId(),
    accountNo: '000001',
    customerName: '张三',
    riskLevel: 'high',
    phone: '13800138001',
  },
  {
    id: generateId(),
    accountNo: '000002',
    customerName: '李四',
    riskLevel: 'medium',
    phone: '13800138002',
  },
  {
    id: generateId(),
    accountNo: '000003',
    customerName: '王五',
    riskLevel: 'low',
    phone: '13800138003',
  },
  {
    id: generateId(),
    accountNo: '000004',
    customerName: '赵六',
    riskLevel: 'high',
    phone: '13800138004',
  },
  {
    id: generateId(),
    accountNo: '000005',
    customerName: '钱七',
    riskLevel: 'medium',
    phone: '13800138005',
  },
];

export const mockPledges: Pledge[] = [
  {
    id: generateId(),
    customerId: mockCustomers[0].id,
    stockCode: '600519',
    stockName: '贵州茅台',
    pledgeShares: 10000,
    principal: 10000000,
    warningLine: 66.67,
    closeLine: 76.92,
    startDate: '2024-01-15',
    endDate: '2025-01-15',
    status: 'warning',
    specialFlags: [],
    createdAt: twoDaysAgo,
    updatedAt: today,
  },
  {
    id: generateId(),
    customerId: mockCustomers[1].id,
    stockCode: '000001',
    stockName: '平安银行',
    pledgeShares: 500000,
    principal: 5000000,
    warningLine: 66.67,
    closeLine: 76.92,
    startDate: '2024-03-20',
    endDate: '2025-03-20',
    status: 'warning',
    specialFlags: ['supplement_pending'],
    createdAt: twoDaysAgo,
    updatedAt: today,
  },
  {
    id: generateId(),
    customerId: mockCustomers[2].id,
    stockCode: '600036',
    stockName: '招商银行',
    pledgeShares: 200000,
    principal: 8000000,
    warningLine: 66.67,
    closeLine: 76.92,
    startDate: '2024-02-10',
    endDate: '2025-02-10',
    status: 'close',
    specialFlags: [],
    createdAt: twoDaysAgo,
    updatedAt: today,
  },
  {
    id: generateId(),
    customerId: mockCustomers[3].id,
    stockCode: '000858',
    stockName: '五粮液',
    pledgeShares: 50000,
    principal: 3000000,
    warningLine: 66.67,
    closeLine: 76.92,
    startDate: '2024-01-05',
    endDate: '2025-01-05',
    status: 'warning',
    specialFlags: ['suspended'],
    createdAt: twoDaysAgo,
    updatedAt: today,
  },
  {
    id: generateId(),
    customerId: mockCustomers[4].id,
    stockCode: '601318',
    stockName: '中国平安',
    pledgeShares: 300000,
    principal: 12000000,
    warningLine: 66.67,
    closeLine: 76.92,
    startDate: '2024-04-01',
    endDate: '2025-04-01',
    status: 'warning',
    specialFlags: ['extension_old'],
    createdAt: twoDaysAgo,
    updatedAt: today,
  },
  {
    id: generateId(),
    customerId: mockCustomers[0].id,
    stockCode: '000333',
    stockName: '美的集团',
    pledgeShares: 80000,
    principal: 4000000,
    warningLine: 66.67,
    closeLine: 76.92,
    startDate: '2024-05-10',
    endDate: '2025-05-10',
    status: 'normal',
    specialFlags: [],
    createdAt: twoDaysAgo,
    updatedAt: today,
  },
];

export const mockMarketData: Record<string, MarketData> = {
  '600519': {
    id: generateId(),
    stockCode: '600519',
    latestPrice: 1500.00,
    previousClose: 1680.00,
    tradingStatus: 'normal',
    valuationDiscount: 0.8,
    updateTime: today,
  },
  '000001': {
    id: generateId(),
    stockCode: '000001',
    latestPrice: 14.50,
    previousClose: 15.20,
    tradingStatus: 'normal',
    valuationDiscount: 0.8,
    updateTime: today,
  },
  '600036': {
    id: generateId(),
    stockCode: '600036',
    latestPrice: 48.00,
    previousClose: 50.50,
    tradingStatus: 'normal',
    valuationDiscount: 0.8,
    updateTime: today,
  },
  '000858': {
    id: generateId(),
    stockCode: '000858',
    latestPrice: 120.00,
    previousClose: 125.00,
    tradingStatus: 'suspended',
    valuationDiscount: 0.7,
    updateTime: yesterday,
  },
  '601318': {
    id: generateId(),
    stockCode: '601318',
    latestPrice: 55.00,
    previousClose: 57.50,
    tradingStatus: 'normal',
    valuationDiscount: 0.8,
    updateTime: today,
  },
  '000333': {
    id: generateId(),
    stockCode: '000333',
    latestPrice: 80.00,
    previousClose: 82.00,
    tradingStatus: 'normal',
    valuationDiscount: 0.8,
    updateTime: today,
  },
};

export const mockSupplements: SupplementRecord[] = [
  {
    id: generateId(),
    pledgeId: mockPledges[1].id,
    amount: 500000,
    expectedDate: today,
    status: 'pending',
    afterPledgeRatio: 64.52,
  },
  {
    id: generateId(),
    pledgeId: mockPledges[0].id,
    amount: 1000000,
    expectedDate: yesterday,
    actualDate: yesterday,
    status: 'received',
    afterPledgeRatio: 60.00,
  },
];

export const mockExtensions: ExtensionRecord[] = [
  {
    id: generateId(),
    pledgeId: mockPledges[4].id,
    applyDate: twoDaysAgo,
    approveDate: yesterday,
    newEndDate: '2026-04-01',
    newWarningLine: 70,
    status: 'approved',
  },
];

export const mockDisposals: DisposalReport[] = [
  {
    id: generateId(),
    pledgeId: mockPledges[2].id,
    reportDate: yesterday,
    reportContent: '客户质押率已触发平仓线，已电话通知客户补仓，客户表示将于今日下午补仓500万元。如未按时补仓，将按合约约定启动强制平仓程序。',
    operator: '风控员A',
    status: 'submitted',
  },
];

export const mockMarginCalls: MarginCall[] = [
  {
    id: generateId(),
    pledgeId: mockPledges[0].id,
    sendTime: `${yesterday}T10:30:00`,
    content: '【风险预警】尊敬的张三客户，您质押的贵州茅台(600519)当前质押率为66.67%，已超过警戒线66.67%。请您及时关注并准备补仓。',
    receiver: '张三',
    method: 'sms',
    isDuplicate: false,
  },
  {
    id: generateId(),
    pledgeId: mockPledges[2].id,
    sendTime: `${yesterday}T14:00:00`,
    content: '【平仓预警】尊敬的王五客户，您质押的招商银行(600036)当前质押率为83.33%，已超过平仓线76.92%。请您立即补仓，否则将启动强制平仓程序。',
    receiver: '王五',
    method: 'phone',
    isDuplicate: false,
  },
];

export const mockHistory: HistoryRecord[] = [
  {
    id: generateId(),
    pledgeId: mockPledges[0].id,
    operationType: 'status_update',
    fieldName: 'status',
    beforeValue: 'normal',
    afterValue: 'warning',
    operator: '系统',
    operateTime: `${yesterday}T09:00:00`,
  },
  {
    id: generateId(),
    pledgeId: mockPledges[0].id,
    operationType: 'supplement',
    fieldName: 'supplement',
    beforeValue: '无',
    afterValue: '补仓100万元，已到账',
    operator: '风控员A',
    operateTime: `${yesterday}T15:30:00`,
  },
  {
    id: generateId(),
    pledgeId: mockPledges[4].id,
    operationType: 'extension',
    fieldName: 'extension',
    beforeValue: '无',
    afterValue: '展期至2026-04-01，警戒线调整为170%',
    operator: '风控员B',
    operateTime: `${yesterday}T11:00:00`,
  },
  {
    id: generateId(),
    pledgeId: mockPledges[2].id,
    operationType: 'disposal',
    fieldName: 'disposal',
    beforeValue: '无',
    afterValue: '提交处置报告，客户承诺今日补仓',
    operator: '风控员A',
    operateTime: `${yesterday}T16:00:00`,
  },
];

export function initializeMockData(): {
  customers: Customer[];
  pledges: Pledge[];
  marketData: Record<string, MarketData>;
  supplements: SupplementRecord[];
  extensions: ExtensionRecord[];
  disposals: DisposalReport[];
  marginCalls: MarginCall[];
  history: HistoryRecord[];
} {
  const pledgesWithFlags = mockPledges.map((pledge) => {
    const { flags } = detectSpecialFlags(
      pledge,
      mockMarketData[pledge.stockCode],
      mockSupplements,
      mockExtensions
    );
    return {
      ...pledge,
      specialFlags: flags,
    };
  });

  return {
    customers: mockCustomers,
    pledges: pledgesWithFlags,
    marketData: mockMarketData,
    supplements: mockSupplements,
    extensions: mockExtensions,
    disposals: mockDisposals,
    marginCalls: mockMarginCalls,
    history: mockHistory,
  };
}
