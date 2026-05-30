import { OrderBookSnapshot, PriceLevel, TradeRecord, DataProcessingConfig } from '../types/data';
import { Anomaly, AnomalyType, AnomalySeverity } from '../types/anomaly';

const DEFAULT_CONFIG: DataProcessingConfig = {
  tickSize: 0.2,
  expectedInterval: 100,
  priceLevels: 5,
  handleNullValues: 'interpolate',
  handleDuplicates: 'keep_latest',
  outlierSigma: 3,
};

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

interface MockDataOptions {
  snapshotCount?: number;
  startPrice?: number;
  volatility?: number;
  tickSize?: number;
  expectedInterval?: number;
  includeNullValues?: boolean;
  includeDuplicates?: boolean;
  includeOutliers?: boolean;
  includeMisalignment?: boolean;
  includeTimeGrainChaos?: boolean;
  includeDuplicateCancellation?: boolean;
  nullValueRate?: number;
  duplicateRate?: number;
  outlierRate?: number;
}

const DEFAULT_OPTIONS: Required<MockDataOptions> = {
  snapshotCount: 100,
  startPrice: 3000,
  volatility: 0.002,
  tickSize: 0.2,
  expectedInterval: 100,
  includeNullValues: true,
  includeDuplicates: true,
  includeOutliers: true,
  includeMisalignment: true,
  includeTimeGrainChaos: true,
  includeDuplicateCancellation: true,
  nullValueRate: 0.05,
  duplicateRate: 0.03,
  outlierRate: 0.02,
};

export function generateMockOrderBookData(
  options: MockDataOptions = {}
): { snapshots: OrderBookSnapshot[]; anomalies: Anomaly[] } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const config = { ...DEFAULT_CONFIG, tickSize: opts.tickSize, expectedInterval: opts.expectedInterval };
  
  const snapshots: OrderBookSnapshot[] = [];
  const anomalies: Anomaly[] = [];
  
  let currentPrice = opts.startPrice;
  let baseTime = Date.now() - opts.snapshotCount * opts.expectedInterval;
  
  const priceHistory: number[] = [];
  const quantityHistory: Map<string, number[]> = new Map();
  
  for (let i = 0; i < opts.snapshotCount; i++) {
    const shouldInsertDuplicate = opts.includeDuplicates && Math.random() < opts.duplicateRate && i > 0;
    const shouldInsertTimeGap = opts.includeTimeGrainChaos && Math.random() < 0.03;
    const shouldInsertTimeReversal = opts.includeTimeGrainChaos && Math.random() < 0.01;
    
    if (shouldInsertDuplicate && snapshots.length > 0) {
      const prevSnapshot = snapshots[snapshots.length - 1];
      const duplicateSnapshot: OrderBookSnapshot = {
        ...prevSnapshot,
        id: `snapshot-dup-${generateId()}`,
        rawData: { isDuplicate: true, originalId: prevSnapshot.id },
      };
      snapshots.push(duplicateSnapshot);
      
      anomalies.push({
        id: `anomaly-dup-${generateId()}`,
        type: 'duplicate_entry',
        severity: 2,
        description: `第${snapshots.length}条记录为重复快照`,
        impact: '导致统计指标失真，成交量、挂单量等被重复计算',
        recommendation: '保留最新记录并删除重复项，检查数据入库逻辑',
        dataPoint: { timestamp: prevSnapshot.timestamp },
        detectedAt: Date.now(),
        snapshotIndex: snapshots.length - 1,
        timestamp: prevSnapshot.timestamp,
        level: 0,
        side: 'both',
        suggestions: ['保留最新记录，删除重复项', '检查数据源是否有重复上报', '添加去重逻辑'],
        rawData: { originalId: prevSnapshot.id, duplicateId: duplicateSnapshot.id, timestamp: prevSnapshot.timestamp },
      });
      
      baseTime += opts.expectedInterval;
      continue;
    }
    
    let interval = opts.expectedInterval;
    if (shouldInsertTimeGap) {
      interval = opts.expectedInterval * (3 + Math.random() * 5);
      anomalies.push({
        id: `anomaly-missing-${generateId()}`,
        type: 'missing_snapshot',
        severity: 3,
        description: `时间间隔异常扩大至${interval}ms，可能存在数据丢失`,
        impact: '导致盘口演化连续性中断，可能遗漏关键行情变化',
        recommendation: '检查数据采集系统稳定性，考虑插值补全缺失时段',
        dataPoint: { timestamp: baseTime, value: interval, expected: opts.expectedInterval },
        detectedAt: Date.now(),
        snapshotIndex: snapshots.length - 1,
        timestamp: baseTime,
        level: 0,
        side: 'both',
        suggestions: ['使用插值法补全缺失快照', '检查数据采集系统稳定性', '对缺失时间段单独标记'],
        rawData: { interval, expectedInterval: opts.expectedInterval, baseTime, snapshotIndex: snapshots.length - 1 },
      });
    } else if (opts.includeTimeGrainChaos && Math.random() < 0.1) {
      interval = opts.expectedInterval * (0.5 + Math.random());
    }
    
    baseTime += interval;
    
    let timestamp = baseTime;
    if (shouldInsertTimeReversal && snapshots.length > 0) {
      timestamp = snapshots[snapshots.length - 1].timestamp - 50;
      anomalies.push({
        id: `anomaly-reversal-${generateId()}`,
        type: 'time_reversal',
        severity: 5,
        description: `时间戳倒流，当前时间早于前一记录`,
        impact: '破坏时间序列因果关系，导致回放和分析逻辑混乱',
        recommendation: '按时间戳重新排序，检查数据采集和传输时序',
        dataPoint: { timestamp, value: timestamp, expected: baseTime },
        detectedAt: Date.now(),
        snapshotIndex: snapshots.length,
        timestamp,
        level: 0,
        side: 'both',
        suggestions: ['按时间戳重新排序', '检查数据源时钟同步', '标记异常时间段'],
        rawData: { currentTimestamp: timestamp, expectedTimestamp: baseTime, prevTimestamp: snapshots[snapshots.length - 1]?.timestamp },
      });
    }
    
    const priceChange = (Math.random() - 0.5) * 2 * opts.volatility * currentPrice;
    currentPrice = Math.max(opts.tickSize, currentPrice + priceChange);
    currentPrice = Math.round(currentPrice / opts.tickSize) * opts.tickSize;
    
    priceHistory.push(currentPrice);
    
    const bids: PriceLevel[] = [];
    const asks: PriceLevel[] = [];
    
    const shouldCreateMisalignment = opts.includeMisalignment && Math.random() < 0.05;
    const misalignmentLevel = Math.floor(Math.random() * (opts.includeMisalignment ? 5 : 0));
    
    for (let level = 1; level <= (opts.includeMisalignment ? 5 : 10); level++) {
      let bidPrice = currentPrice - level * opts.tickSize;
      let askPrice = currentPrice + level * opts.tickSize;
      
      if (shouldCreateMisalignment && level === misalignmentLevel + 1) {
        bidPrice -= opts.tickSize;
        askPrice += opts.tickSize;
        
        anomalies.push({
          id: `anomaly-misalign-${generateId()}`,
          type: 'price_misalignment',
          severity: 3,
          description: `买${level}档/卖${level}档价格错位，价差偏离理论值`,
          impact: '导致深度计算偏差，影响策略下单精度，可能产生滑点损失',
          recommendation: '检查数据源是否有档位遗漏，考虑对错位档位进行插值补全',
          dataPoint: { timestamp, level, value: bidPrice, expected: currentPrice - level * opts.tickSize },
          detectedAt: Date.now(),
          snapshotIndex: i,
          timestamp,
          level,
          side: 'both',
          suggestions: ['检查数据源档位完整性', '使用插值法补全错位档位', '验证tickSize配置'],
          rawData: { bidPrice, askPrice, expectedBid: currentPrice - level * opts.tickSize, expectedAsk: currentPrice + level * opts.tickSize },
        });
      }
      
      const baseQuantity = 50 + Math.floor(Math.random() * 200);
      const levelFactor = Math.max(0.3, 1 - level * 0.08);
      
      let bidQuantity = Math.floor(baseQuantity * levelFactor * (0.8 + Math.random() * 0.4));
      let askQuantity = Math.floor(baseQuantity * levelFactor * (0.8 + Math.random() * 0.4));
      
      const shouldCreateOutlier = opts.includeOutliers && Math.random() < opts.outlierRate;
      if (shouldCreateOutlier) {
        const outlierMultiplier = 5 + Math.random() * 15;
        if (Math.random() > 0.5) {
          bidQuantity = Math.floor(bidQuantity * outlierMultiplier);
        } else {
          askQuantity = Math.floor(askQuantity * outlierMultiplier);
        }
        
        anomalies.push({
          id: `anomaly-outlier-${generateId()}`,
          type: 'boundary_extreme',
          severity: 4,
          description: `${Math.random() > 0.5 ? '买' : '卖'}${level}档挂单量为极端异常值`,
          impact: '可能扭曲统计分析结果，导致模型训练偏差',
          recommendation: '验证数据真实性，如为真实极值则保留并标记，否则修正',
          dataPoint: { timestamp, level, value: Math.max(bidQuantity, askQuantity) },
          detectedAt: Date.now(),
          snapshotIndex: i,
          timestamp,
          level,
          side: Math.random() > 0.5 ? 'bid' : 'ask',
          suggestions: ['使用3σ原则验证异常值', '检查数据源是否正确', '如为真实数据则单独标记分析'],
          rawData: { bidQuantity, askQuantity, level },
        });
      }
      
      const levelKey = `${level}-${bidPrice.toFixed(2)}`;
      if (!quantityHistory.has(levelKey)) {
        quantityHistory.set(levelKey, []);
      }
      const history = quantityHistory.get(levelKey)!;
      
      const shouldCreateDuplicateCancel = opts.includeDuplicateCancellation && 
        Math.random() < 0.03 && history.length > 3;
      
      if (shouldCreateDuplicateCancel) {
        const prevQuantity = history[history.length - 1];
        if (prevQuantity > 50) {
          bidQuantity = 0;
          
          anomalies.push({
            id: `anomaly-cancel-${generateId()}`,
            type: 'duplicate_cancellation',
            severity: 4,
            description: `买${level}档出现大额撤单，可能存在幌骗行为`,
            impact: '制造虚假流动性假象，误导盘口深度判断，属于异常交易行为',
            recommendation: '标记该时段为高风险期，建议风控部门介入调查',
            dataPoint: { timestamp, level, value: 0, expected: prevQuantity },
            detectedAt: Date.now(),
            snapshotIndex: i,
            timestamp,
            level,
            side: 'bid',
            suggestions: ['追踪挂单量变化模式', '检查是否存在短时间频繁撤单重挂', '结合成交数据分析意图'],
            rawData: { currentQuantity: 0, previousQuantity: prevQuantity, level },
          });
        }
      }
      
      history.push(bidQuantity);
      if (history.length > 20) history.shift();
      
      let bidPriceValue: number | null = bidPrice;
      let bidQtyValue: number | null = bidQuantity;
      let askPriceValue: number | null = askPrice;
      let askQtyValue: number | null = askQuantity;
      
      if (opts.includeNullValues) {
        if (Math.random() < opts.nullValueRate) {
          if (Math.random() > 0.5) {
            bidPriceValue = null;
          } else {
            bidQtyValue = null;
          }
          anomalies.push({
            id: `anomaly-null-${generateId()}`,
            type: 'null_value',
            severity: 1,
            description: `买${level}档存在空值数据`,
            impact: '可能导致计算错误或程序崩溃，影响分析结果可靠性',
            recommendation: '使用插值法填充或标记后跳过，检查数据采集逻辑',
            dataPoint: { timestamp, level },
            detectedAt: Date.now(),
            snapshotIndex: i,
            timestamp,
            level,
            side: 'bid',
            suggestions: ['使用线性插值填充空值', '检查数据采集程序是否正常', '标记空值位置便于追溯'],
            rawData: { bidPriceValue, bidQtyValue, level },
          });
        }
        if (Math.random() < opts.nullValueRate) {
          if (Math.random() > 0.5) {
            askPriceValue = null;
          } else {
            askQtyValue = null;
          }
          anomalies.push({
            id: `anomaly-null-${generateId()}`,
            type: 'null_value',
            severity: 1,
            description: `卖${level}档存在空值数据`,
            impact: '可能导致计算错误或程序崩溃，影响分析结果可靠性',
            recommendation: '使用插值法填充或标记后跳过，检查数据采集逻辑',
            dataPoint: { timestamp, level },
            detectedAt: Date.now(),
            snapshotIndex: i,
            timestamp,
            level,
            side: 'ask',
            suggestions: ['使用线性插值填充空值', '检查数据采集程序是否正常', '标记空值位置便于追溯'],
            rawData: { askPriceValue, askQtyValue, level },
          });
        }
      }
      
      if (bidPriceValue !== null && bidQtyValue !== null) {
        bids.push({
          id: `bid-${timestamp}-${level}`,
          side: 'bid',
          level,
          price: bidPriceValue,
          quantity: bidQtyValue,
          orderCount: Math.floor(1 + Math.random() * 10),
          rawData: { generated: true },
        });
      }
      
      if (askPriceValue !== null && askQtyValue !== null) {
        asks.push({
          id: `ask-${timestamp}-${level}`,
          side: 'ask',
          level,
          price: askPriceValue,
          quantity: askQtyValue,
          orderCount: Math.floor(1 + Math.random() * 10),
          rawData: { generated: true },
        });
      }
    }
    
    const trades: TradeRecord[] = [];
    if (Math.random() > 0.3) {
      const tradeCount = 1 + Math.floor(Math.random() * 5);
      for (let t = 0; t < tradeCount; t++) {
        const isBuy = Math.random() > 0.5;
        const tradePrice = isBuy 
          ? asks[0]?.price ?? currentPrice + opts.tickSize
          : bids[0]?.price ?? currentPrice - opts.tickSize;
        
        trades.push({
          id: `trade-${timestamp}-${t}`,
          tradeTime: timestamp + t * 10,
          price: tradePrice,
          quantity: Math.floor(1 + Math.random() * 50),
          direction: isBuy ? 'buy' : 'sell',
          isLiquidation: Math.random() < 0.05,
        });
      }
    }
    
    let lastPrice = currentPrice;
    let volume = Math.floor(Math.random() * 5000);
    let openInterest = 100000 + Math.floor(Math.random() * 50000);
    
    if (opts.includeNullValues && Math.random() < opts.nullValueRate * 0.5) {
      lastPrice = 0 as unknown as number;
      anomalies.push({
        id: `anomaly-null-${generateId()}`,
        type: 'null_value',
        severity: 2,
        description: `最新价字段为空`,
        impact: '可能导致计算错误或程序崩溃，影响分析结果可靠性',
        recommendation: '使用插值法填充或标记后跳过，检查数据采集逻辑',
        dataPoint: { timestamp },
        detectedAt: Date.now(),
        snapshotIndex: i,
        timestamp,
        level: 0,
        side: 'both',
        suggestions: ['使用前后快照插值填充', '检查数据采集API是否正常', '验证价格字段映射配置'],
        rawData: { lastPrice, timestamp },
      });
    }
    
    snapshots.push({
      id: `snapshot-${timestamp}-${generateId()}`,
      timestamp,
      symbol: 'BTCUSDT',
      lastPrice,
      volume,
      openInterest,
      bids,
      asks,
      trades,
      rawData: { generated: true, snapshotIndex: i },
    });
  }
  
  if (opts.includeTimeGrainChaos) {
    const intervals: number[] = [];
    for (let i = 1; i < snapshots.length; i++) {
      intervals.push(snapshots[i].timestamp - snapshots[i - 1].timestamp);
    }
    
    if (intervals.length > 0) {
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const std = Math.sqrt(intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length);
      
      if (std > mean * 0.5) {
        anomalies.push({
          id: `anomaly-grain-${generateId()}`,
          type: 'time_grain_chaos',
          severity: 3,
          description: `时间粒度混乱，间隔标准差${std.toFixed(0)}ms超过均值${mean.toFixed(0)}ms的50%`,
          impact: '破坏时间序列连续性，影响时序分析和回测结果的准确性',
          recommendation: '检查数据采集系统，考虑对时间序列进行重采样',
          dataPoint: { value: std, expected: mean * 0.5 },
          detectedAt: Date.now(),
          snapshotIndex: 0,
          timestamp: snapshots[0]?.timestamp || Date.now(),
          level: 0,
          side: 'both',
          suggestions: ['计算时间间隔标准差检测异常', '对时间序列进行重采样规整', '检查数据采集系统时钟同步'],
          rawData: { intervals, mean, std, threshold: mean * 0.5 },
        });
      }
    }
  }
  
  return { snapshots, anomalies };
}

export function generateDirtyDataForTesting(): {
  snapshots: OrderBookSnapshot[];
  anomalies: Anomaly[];
  testCases: Array<{ name: string; description: string; anomalyType: AnomalyType }>;
} {
  const testCases = [
    { name: '空值测试', description: '包含大量null/NaN/空字符串字段', anomalyType: 'null_value' as AnomalyType },
    { name: '重复项测试', description: '完全相同的重复快照记录', anomalyType: 'duplicate_entry' as AnomalyType },
    { name: '边界极值测试', description: '超出3σ范围的极端挂单量', anomalyType: 'boundary_extreme' as AnomalyType },
    { name: '档位错位测试', description: '价格档位不连续，存在跳空', anomalyType: 'price_misalignment' as AnomalyType },
    { name: '时间粒度混乱', description: '快照间隔不规则，标准差过大', anomalyType: 'time_grain_chaos' as AnomalyType },
    { name: '撤单重复测试', description: '短时间内频繁撤单重挂', anomalyType: 'duplicate_cancellation' as AnomalyType },
    { name: '时间倒流测试', description: '时间戳不递增，出现倒流', anomalyType: 'time_reversal' as AnomalyType },
    { name: '数据缺失测试', description: '快照间隔异常扩大', anomalyType: 'missing_snapshot' as AnomalyType },
  ];
  
  const result = generateMockOrderBookData({
    snapshotCount: 120,
    includeNullValues: true,
    includeDuplicates: true,
    includeOutliers: true,
    includeMisalignment: true,
    includeTimeGrainChaos: true,
    includeDuplicateCancellation: true,
    nullValueRate: 0.08,
    duplicateRate: 0.05,
    outlierRate: 0.04,
  });
  
  return { ...result, testCases };
}
