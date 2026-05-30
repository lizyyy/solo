import { produce } from 'immer';
import { OrderBookSnapshot, PriceLevel, DataProcessingConfig } from '../types/data';
import {
  Anomaly,
  AnomalyType,
  AnomalySeverity,
  AnomalyDetectionConfig,
  AnomalyDetectionResult,
  ANOMALY_DESCRIPTIONS,
} from '../types/anomaly';

const DEFAULT_CONFIG: AnomalyDetectionConfig = {
  priceMisalignmentThreshold: 0.5,
  duplicateCancellationWindow: 3,
  duplicateCancellationCount: 5,
  timeGrainStdDevThreshold: 0.5,
  missingSnapshotThreshold: 3,
  outlierSigma: 3,
};

function generateId(): string {
  return `anomaly-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export class AnomalyDetector {
  private config: AnomalyDetectionConfig;
  private dataConfig: DataProcessingConfig;

  constructor(
    config: Partial<AnomalyDetectionConfig> = {},
    dataConfig: Partial<DataProcessingConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dataConfig = {
      tickSize: 0.2,
      expectedInterval: 100,
      priceLevels: 10,
      handleNullValues: 'interpolate',
      handleDuplicates: 'keep_latest',
      outlierSigma: 3,
      ...dataConfig,
    };
  }

  detect(snapshots: OrderBookSnapshot[]): AnomalyDetectionResult {
    const anomalies: Anomaly[] = [];

    anomalies.push(...this.detectTimeGrainChaos(snapshots));
    anomalies.push(...this.detectTimeReversal(snapshots));
    anomalies.push(...this.detectMissingSnapshots(snapshots));
    anomalies.push(...this.detectPriceMisalignment(snapshots));
    anomalies.push(...this.detectDuplicateCancellation(snapshots));
    anomalies.push(...this.detectNullValues(snapshots));
    anomalies.push(...this.detectDuplicateEntries(snapshots));
    anomalies.push(...this.detectBoundaryExtremes(snapshots));

    const stats = this.calculateStats(anomalies);

    return { anomalies, stats };
  }

  private detectTimeGrainChaos(snapshots: OrderBookSnapshot[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    if (snapshots.length < 2) return anomalies;

    const intervals: number[] = [];
    for (let i = 1; i < snapshots.length; i++) {
      intervals.push(snapshots[i].timestamp - snapshots[i - 1].timestamp);
    }

    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const std = Math.sqrt(
      intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length
    );

    if (std > mean * this.config.timeGrainStdDevThreshold) {
      anomalies.push({
        id: generateId(),
        type: 'time_grain_chaos',
        severity: 3,
        description: `时间粒度混乱：间隔标准差${std.toFixed(0)}ms，超过均值${mean.toFixed(0)}ms的${(this.config.timeGrainStdDevThreshold * 100).toFixed(0)}%`,
        impact: ANOMALY_DESCRIPTIONS.time_grain_chaos.impact,
        recommendation: ANOMALY_DESCRIPTIONS.time_grain_chaos.recommendation,
        dataPoint: { value: std, expected: mean * this.config.timeGrainStdDevThreshold },
        detectedAt: Date.now(),
        snapshotIndex: 0,
        timestamp: snapshots[0]?.timestamp || Date.now(),
        level: 0,
        side: 'both',
        suggestions: ['计算时间间隔标准差检测异常', '对时间序列进行重采样规整', '检查数据采集系统时钟同步'],
        rawData: { intervals, mean, std, threshold: mean * this.config.timeGrainStdDevThreshold },
      });
    }

    return anomalies;
  }

  private detectTimeReversal(snapshots: OrderBookSnapshot[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1];
      const curr = snapshots[i];

      if (curr.timestamp < prev.timestamp) {
        anomalies.push({
          id: generateId(),
          type: 'time_reversal',
          severity: 5,
          description: `时间倒流：第${i + 1}条记录时间${new Date(curr.timestamp).toISOString()}早于前一条记录${new Date(prev.timestamp).toISOString()}`,
          impact: ANOMALY_DESCRIPTIONS.time_reversal.impact,
          recommendation: ANOMALY_DESCRIPTIONS.time_reversal.recommendation,
          dataPoint: {
            timestamp: curr.timestamp,
            value: curr.timestamp,
            expected: prev.timestamp,
          },
          detectedAt: Date.now(),
          snapshotIndex: i,
          timestamp: curr.timestamp,
          level: 0,
          side: 'both',
          suggestions: ['按时间戳重新排序', '检查数据源时钟同步', '标记异常时间段'],
          rawData: { prevTimestamp: prev.timestamp, currTimestamp: curr.timestamp, index: i },
        });
      }
    }

    return anomalies;
  }

  private detectMissingSnapshots(snapshots: OrderBookSnapshot[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const { expectedInterval } = this.dataConfig;
    const threshold = expectedInterval * this.config.missingSnapshotThreshold;

    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1];
      const curr = snapshots[i];
      const gap = curr.timestamp - prev.timestamp;

      if (gap > threshold) {
        const missingCount = Math.floor(gap / expectedInterval) - 1;
        anomalies.push({
          id: generateId(),
          type: 'missing_snapshot',
          severity: missingCount > 10 ? 4 : 3,
          description: `数据缺失：第${i}和${i + 1}条记录间隔${gap}ms，缺失约${missingCount}条快照`,
          impact: ANOMALY_DESCRIPTIONS.missing_snapshot.impact,
          recommendation: ANOMALY_DESCRIPTIONS.missing_snapshot.recommendation,
          dataPoint: {
            timestamp: prev.timestamp,
            value: gap,
            expected: threshold,
          },
          detectedAt: Date.now(),
          snapshotIndex: i,
          timestamp: prev.timestamp,
          level: 0,
          side: 'both',
          suggestions: ['使用插值法补全缺失快照', '检查数据采集系统稳定性', '对缺失时间段单独标记'],
          rawData: { gap, missingCount, threshold, prevTimestamp: prev.timestamp, currTimestamp: curr.timestamp },
        });
      }
    }

    return anomalies;
  }

  private detectPriceMisalignment(snapshots: OrderBookSnapshot[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const { tickSize } = this.dataConfig;
    const threshold = tickSize * this.config.priceMisalignmentThreshold;

    snapshots.forEach((snapshot, snapshotIndex) => {
      const checkLevels = (levels: PriceLevel[], isBid: boolean) => {
        if (levels.length < 2) return;

        for (let i = 1; i < levels.length; i++) {
          const prevLevel = levels[i - 1];
          const currLevel = levels[i];

          const expectedGap = tickSize;
          const actualGap = isBid
            ? prevLevel.price - currLevel.price
            : currLevel.price - prevLevel.price;

          const deviation = Math.abs(actualGap - expectedGap);

          if (deviation > threshold) {
            const severity: AnomalySeverity = 
              deviation > tickSize * 2 ? 4 : 
              deviation > tickSize * 1 ? 3 : 2;

            anomalies.push({
              id: generateId(),
              type: 'price_misalignment',
              severity,
              description: `档位错位：快照${snapshotIndex + 1} ${isBid ? '买' : '卖'}${i + 1}档与${i}档价差${actualGap.toFixed(2)}，理论值${expectedGap.toFixed(2)}，偏差${deviation.toFixed(2)}`,
              impact: ANOMALY_DESCRIPTIONS.price_misalignment.impact,
              recommendation: ANOMALY_DESCRIPTIONS.price_misalignment.recommendation,
              dataPoint: {
                timestamp: snapshot.timestamp,
                level: i + 1,
                value: actualGap,
                expected: expectedGap,
              },
              detectedAt: Date.now(),
              snapshotIndex,
              timestamp: snapshot.timestamp,
              level: i + 1,
              side: isBid ? 'bid' : 'ask',
              suggestions: ['检查数据源档位完整性', '使用插值法补全错位档位', '验证tickSize配置'],
              rawData: { actualGap, expectedGap, deviation, prevPrice: prevLevel.price, currPrice: currLevel.price },
            });
          }
        }

        const uniquePrices = new Set(levels.map(l => l.price));
        if (uniquePrices.size < levels.length) {
          anomalies.push({
            id: generateId(),
            type: 'price_misalignment',
            severity: 2,
            description: `档位重复：快照${snapshotIndex + 1} ${isBid ? '买' : '卖'}盘存在重复价格档位`,
            impact: ANOMALY_DESCRIPTIONS.price_misalignment.impact,
            recommendation: ANOMALY_DESCRIPTIONS.price_misalignment.recommendation,
            dataPoint: {
              timestamp: snapshot.timestamp,
            },
            detectedAt: Date.now(),
            snapshotIndex,
            timestamp: snapshot.timestamp,
            level: 0,
            side: isBid ? 'bid' : 'ask',
            suggestions: ['去重保留最新档位', '检查数据源是否有重复上报', '验证档位编号逻辑'],
            rawData: { levels: levels.map(l => l.price), uniqueCount: uniquePrices.size, totalCount: levels.length },
          });
        }
      };

      checkLevels(snapshot.bids, true);
      checkLevels(snapshot.asks, false);
    });

    return anomalies;
  }

  private detectDuplicateCancellation(snapshots: OrderBookSnapshot[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const { expectedInterval } = this.dataConfig;
    const windowSize = this.config.duplicateCancellationWindow;
    const threshold = this.config.duplicateCancellationCount;

    const levelHistory = new Map<string, number[]>();

    snapshots.forEach((snapshot, snapshotIndex) => {
      const processLevel = (level: PriceLevel, isBid: boolean) => {
        const key = `${isBid ? 'bid' : 'ask'}-${level.level}-${level.price.toFixed(2)}`;
        
        if (!levelHistory.has(key)) {
          levelHistory.set(key, []);
        }
        
        const history = levelHistory.get(key)!;
        history.push(level.quantity);
        if (history.length > windowSize * 3) {
          history.shift();
        }

        if (history.length >= windowSize) {
          let cancelCount = 0;
          for (let i = 1; i < history.length; i++) {
            if (history[i - 1] > 10 && history[i] === 0) {
              cancelCount++;
            }
          }

          if (cancelCount >= threshold) {
            anomalies.push({
              id: generateId(),
              type: 'duplicate_cancellation',
              severity: 4,
              description: `撤单重复：${isBid ? '买' : '卖'}${level.level}档价格${level.price.toFixed(2)}在${(windowSize * expectedInterval / 1000).toFixed(1)}s内撤单${cancelCount}次`,
              impact: ANOMALY_DESCRIPTIONS.duplicate_cancellation.impact,
              recommendation: ANOMALY_DESCRIPTIONS.duplicate_cancellation.recommendation,
              dataPoint: {
                timestamp: snapshot.timestamp,
                level: level.level,
                price: level.price,
                value: cancelCount,
                expected: threshold,
              },
              detectedAt: Date.now(),
              snapshotIndex,
              timestamp: snapshot.timestamp,
              level: level.level,
              side: isBid ? 'bid' : 'ask',
              suggestions: ['追踪挂单量变化模式', '检查是否存在短时间频繁撤单重挂', '结合成交数据分析意图'],
              rawData: { cancelCount, threshold, windowSize, history: [...history] },
            });
            
            levelHistory.set(key, []);
          }
        }
      };

      snapshot.bids.forEach(level => processLevel(level, true));
      snapshot.asks.forEach(level => processLevel(level, false));
    });

    return anomalies;
  }

  private detectNullValues(snapshots: OrderBookSnapshot[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    snapshots.forEach((snapshot, snapshotIndex) => {
      if (snapshot.lastPrice === 0 || snapshot.lastPrice === null || isNaN(snapshot.lastPrice)) {
        anomalies.push({
          id: generateId(),
          type: 'null_value',
          severity: 2,
          description: `空值数据：快照${snapshotIndex + 1}最新价字段为空或无效`,
          impact: ANOMALY_DESCRIPTIONS.null_value.impact,
          recommendation: ANOMALY_DESCRIPTIONS.null_value.recommendation,
          dataPoint: {
            timestamp: snapshot.timestamp,
          },
          detectedAt: Date.now(),
          snapshotIndex,
          timestamp: snapshot.timestamp,
          level: 0,
          side: 'both',
          suggestions: ['使用前后快照插值填充', '检查数据采集API是否正常', '验证价格字段映射配置'],
          rawData: { lastPrice: snapshot.lastPrice, timestamp: snapshot.timestamp },
        });
      }

      const checkLevels = (levels: PriceLevel[], isBid: boolean) => {
        levels.forEach((level, levelIndex) => {
          const issues: string[] = [];
          
          if (level.price === null || isNaN(level.price)) {
            issues.push('价格');
          }
          if (level.quantity === null || isNaN(level.quantity)) {
            issues.push('挂单量');
          }

          if (issues.length > 0) {
            anomalies.push({
              id: generateId(),
              type: 'null_value',
              severity: issues.length > 1 ? 2 : 1,
              description: `空值数据：快照${snapshotIndex + 1} ${isBid ? '买' : '卖'}${level.level}档${issues.join('、')}为空`,
              impact: ANOMALY_DESCRIPTIONS.null_value.impact,
              recommendation: ANOMALY_DESCRIPTIONS.null_value.recommendation,
              dataPoint: {
                timestamp: snapshot.timestamp,
                level: level.level,
              },
              detectedAt: Date.now(),
              snapshotIndex,
              timestamp: snapshot.timestamp,
              level: level.level,
              side: isBid ? 'bid' : 'ask',
              suggestions: ['使用线性插值填充空值', '检查数据采集程序是否正常', '标记空值位置便于追溯'],
              rawData: { price: level.price, quantity: level.quantity, issues, level: level.level },
            });
          }
        });
      };

      checkLevels(snapshot.bids, true);
      checkLevels(snapshot.asks, false);
    });

    return anomalies;
  }

  private detectDuplicateEntries(snapshots: OrderBookSnapshot[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const seen = new Map<number, number[]>();

    snapshots.forEach((snapshot, index) => {
      const key = snapshot.timestamp;
      
      if (seen.has(key)) {
        const prevIndices = seen.get(key)!;
        anomalies.push({
          id: generateId(),
          type: 'duplicate_entry',
          severity: 2,
          description: `重复项：第${index + 1}条记录与第${prevIndices.map(i => i + 1).join('、')}条时间戳完全相同`,
          impact: ANOMALY_DESCRIPTIONS.duplicate_entry.impact,
          recommendation: ANOMALY_DESCRIPTIONS.duplicate_entry.recommendation,
          dataPoint: {
            timestamp: key,
          },
          detectedAt: Date.now(),
          snapshotIndex: index,
          timestamp: key,
          level: 0,
          side: 'both',
          suggestions: ['保留最新记录，删除重复项', '检查数据源是否有重复上报', '添加去重逻辑'],
          rawData: { duplicateIndices: [...prevIndices, index], timestamp: key },
        });
        prevIndices.push(index);
      } else {
        seen.set(key, [index]);
      }
    });

    return anomalies;
  }

  private detectBoundaryExtremes(snapshots: OrderBookSnapshot[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const { outlierSigma } = this.config;

    const allQuantities: number[] = [];
    snapshots.forEach(snapshot => {
      snapshot.bids.forEach(level => allQuantities.push(level.quantity));
      snapshot.asks.forEach(level => allQuantities.push(level.quantity));
    });

    if (allQuantities.length === 0) return anomalies;

    const mean = allQuantities.reduce((a, b) => a + b, 0) / allQuantities.length;
    const std = Math.sqrt(
      allQuantities.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / allQuantities.length
    );
    const upperThreshold = mean + outlierSigma * std;
    const lowerThreshold = Math.max(0, mean - outlierSigma * std);

    snapshots.forEach((snapshot, snapshotIndex) => {
      const checkLevels = (levels: PriceLevel[], isBid: boolean) => {
        levels.forEach((level, levelIndex) => {
          if (level.quantity > upperThreshold || level.quantity < lowerThreshold) {
            const severity: AnomalySeverity = 
              level.quantity > mean + outlierSigma * 2 * std ? 5 :
              level.quantity > mean + outlierSigma * 1.5 * std ? 4 : 3;

            anomalies.push({
              id: generateId(),
              type: 'boundary_extreme',
              severity,
              description: `边界极值：快照${snapshotIndex + 1} ${isBid ? '买' : '卖'}${level.level}档挂单量${level.quantity}，均值${mean.toFixed(0)}，标准差${std.toFixed(0)}`,
              impact: ANOMALY_DESCRIPTIONS.boundary_extreme.impact,
              recommendation: ANOMALY_DESCRIPTIONS.boundary_extreme.recommendation,
              dataPoint: {
                timestamp: snapshot.timestamp,
                level: level.level,
                value: level.quantity,
                expected: mean,
              },
              detectedAt: Date.now(),
              snapshotIndex,
              timestamp: snapshot.timestamp,
              level: level.level,
              side: isBid ? 'bid' : 'ask',
              suggestions: ['使用3σ原则验证异常值', '检查数据源是否正确', '如为真实数据则单独标记分析'],
              rawData: { quantity: level.quantity, mean, std, upperThreshold, lowerThreshold, level: level.level },
            });
          }
        });
      };

      checkLevels(snapshot.bids, true);
      checkLevels(snapshot.asks, false);
    });

    return anomalies;
  }

  private calculateStats(anomalies: Anomaly[]): AnomalyDetectionResult['stats'] {
    const byType: Record<AnomalyType, number> = {
      price_misalignment: 0,
      duplicate_cancellation: 0,
      time_grain_chaos: 0,
      null_value: 0,
      duplicate_entry: 0,
      boundary_extreme: 0,
      time_reversal: 0,
      missing_snapshot: 0,
    };

    const bySeverity: Record<AnomalySeverity, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    anomalies.forEach(anomaly => {
      byType[anomaly.type]++;
      bySeverity[anomaly.severity]++;
    });

    return {
      total: anomalies.length,
      byType,
      bySeverity,
    };
  }

  updateConfig(config: Partial<AnomalyDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  updateDataConfig(config: Partial<DataProcessingConfig>): void {
    this.dataConfig = { ...this.dataConfig, ...config };
  }
}

export const anomalyDetector = new AnomalyDetector();
