import { produce } from 'immer';
import {
  OrderBookSnapshot,
  PriceLevel,
  Cube3D,
  DataRange,
  DataProcessingConfig,
  ProcessingResult,
  ProcessingStats,
} from '../types/data';
import { Anomaly } from '../types/anomaly';
import { getQuantityColor, getLevelOpacity, getAnomalyColor } from '../utils/colorMapping';

const DEFAULT_CONFIG: DataProcessingConfig = {
  tickSize: 0.2,
  expectedInterval: 100,
  priceLevels: 10,
  handleNullValues: 'interpolate',
  handleDuplicates: 'keep_latest',
  outlierSigma: 3,
};

export class DataProcessor {
  private config: DataProcessingConfig;

  constructor(config: Partial<DataProcessingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  process(
    rawSnapshots: OrderBookSnapshot[],
    externalAnomalies: Anomaly[] = []
  ): ProcessingResult {
    const stats: ProcessingStats = {
      totalSnapshots: rawSnapshots.length,
      validSnapshots: 0,
      nullValues: 0,
      duplicates: 0,
      outliers: 0,
      interpolatedValues: 0,
      misalignments: 0,
    };

    let snapshots = [...rawSnapshots];

    snapshots = this.sortByTimestamp(snapshots);

    const { snapshots: deduped, duplicates } = this.removeDuplicates(snapshots);
    snapshots = deduped;
    stats.duplicates = duplicates;

    const { snapshots: cleaned, nullCount, interpolatedCount } = this.handleNullValues(snapshots);
    snapshots = cleaned;
    stats.nullValues = nullCount;
    stats.interpolatedValues = interpolatedCount;

    const { snapshots: aligned, misalignmentCount } = this.alignPriceLevels(snapshots);
    snapshots = aligned;
    stats.misalignments = misalignmentCount;

    const { snapshots: final, outlierCount } = this.detectAndMarkOutliers(snapshots);
    snapshots = final;
    stats.outliers = outlierCount;

    snapshots = this.interpolateMissingSnapshots(snapshots);

    stats.validSnapshots = snapshots.length;

    const { cubes, dataRange } = this.convertTo3DCubes(snapshots, externalAnomalies);

    return { snapshots, cubes, dataRange, stats };
  }

  private sortByTimestamp(snapshots: OrderBookSnapshot[]): OrderBookSnapshot[] {
    return produce(snapshots, draft => {
      draft.sort((a, b) => a.timestamp - b.timestamp);
    });
  }

  private removeDuplicates(
    snapshots: OrderBookSnapshot[]
  ): { snapshots: OrderBookSnapshot[]; duplicates: number } {
    const seen = new Map<number, OrderBookSnapshot>();
    let duplicates = 0;

    const result = produce(snapshots, draft => {
      return draft.filter(snapshot => {
        const key = snapshot.timestamp;
        if (seen.has(key)) {
          duplicates++;
          if (this.config.handleDuplicates === 'keep_latest') {
            seen.set(key, snapshot);
          }
          return false;
        }
        seen.set(key, snapshot);
        return true;
      });
    });

    if (this.config.handleDuplicates === 'keep_latest') {
      return { snapshots: Array.from(seen.values()), duplicates };
    }

    return { snapshots: result, duplicates };
  }

  private handleNullValues(
    snapshots: OrderBookSnapshot[]
  ): { snapshots: OrderBookSnapshot[]; nullCount: number; interpolatedCount: number } {
    let nullCount = 0;
    let interpolatedCount = 0;

    const result = produce(snapshots, draft => {
      draft.forEach((snapshot, snapshotIndex) => {
        if (snapshot.lastPrice === 0 || snapshot.lastPrice === null || isNaN(snapshot.lastPrice)) {
          nullCount++;
          if (this.config.handleNullValues === 'interpolate' && snapshotIndex > 0 && snapshotIndex < draft.length - 1) {
            const prevPrice = draft[snapshotIndex - 1].lastPrice;
            const nextPrice = draft[snapshotIndex + 1].lastPrice;
            if (prevPrice > 0 && nextPrice > 0) {
              snapshot.lastPrice = (prevPrice + nextPrice) / 2;
              interpolatedCount++;
            }
          } else if (this.config.handleNullValues === 'zero') {
            snapshot.lastPrice = 0;
          }
        }

        const processLevels = (levels: PriceLevel[], isBid: boolean) => {
          levels.forEach((level, levelIndex) => {
            if (level.price === null || isNaN(level.price) || level.quantity === null || isNaN(level.quantity)) {
              nullCount++;
              
              if (this.config.handleNullValues === 'interpolate') {
                const prevLevel = levels[levelIndex - 1];
                const nextLevel = levels[levelIndex + 1];
                const snapPrev = draft[snapshotIndex - 1];
                const snapNext = draft[snapshotIndex + 1];
                
                const sameSidePrevLevels = snapPrev?.[isBid ? 'bids' : 'asks'];
                const sameSideNextLevels = snapNext?.[isBid ? 'bids' : 'asks'];
                const sameLevelPrev = sameSidePrevLevels?.[levelIndex];
                const sameLevelNext = sameSideNextLevels?.[levelIndex];

                if (level.price === null || isNaN(level.price)) {
                  if (prevLevel && nextLevel) {
                    level.price = isBid 
                      ? (prevLevel.price + nextLevel.price) / 2
                      : (prevLevel.price + nextLevel.price) / 2;
                    interpolatedCount++;
                  } else if (sameLevelPrev && sameLevelNext) {
                    level.price = (sameLevelPrev.price + sameLevelNext.price) / 2;
                    interpolatedCount++;
                  }
                }
                
                if (level.quantity === null || isNaN(level.quantity)) {
                  if (sameLevelPrev && sameLevelNext) {
                    level.quantity = Math.round((sameLevelPrev.quantity + sameLevelNext.quantity) / 2);
                    interpolatedCount++;
                  } else if (prevLevel && nextLevel) {
                    const avgNeighbors = (prevLevel.quantity + nextLevel.quantity) / 2;
                    level.quantity = Math.round(avgNeighbors * (1 - level.level * 0.05));
                    interpolatedCount++;
                  }
                }
              } else if (this.config.handleNullValues === 'zero') {
                if (level.price === null || isNaN(level.price)) level.price = 0;
                if (level.quantity === null || isNaN(level.quantity)) level.quantity = 0;
              }
            }
          });
        };

        processLevels(snapshot.bids, true);
        processLevels(snapshot.asks, false);
      });
    });

    return { snapshots: result, nullCount, interpolatedCount };
  }

  private alignPriceLevels(
    snapshots: OrderBookSnapshot[]
  ): { snapshots: OrderBookSnapshot[]; misalignmentCount: number } {
    let misalignmentCount = 0;
    const { tickSize } = this.config;

    const result = produce(snapshots, draft => {
      draft.forEach(snapshot => {
        const sortLevels = (levels: PriceLevel[], ascending: boolean) => {
          return [...levels].sort((a, b) => 
            ascending ? a.price - b.price : b.price - a.price
          );
        };

        const sortedBids = sortLevels(snapshot.bids, false);
        const sortedAsks = sortLevels(snapshot.asks, true);

        const checkMisalignment = (levels: PriceLevel[], isBid: boolean) => {
          const corrected: PriceLevel[] = [];
          
          for (let i = 0; i < levels.length; i++) {
            const level = levels[i];
            const expectedPrice = isBid
              ? sortedBids[0].price - i * tickSize
              : sortedAsks[0].price + i * tickSize;

            const actualPrice = level.price;
            const deviation = Math.abs(actualPrice - expectedPrice);

            if (deviation > tickSize * 0.5) {
              misalignmentCount++;
              
              if (i === 0) {
                corrected.push({ ...level });
              } else {
                const prevCorrected = corrected[i - 1];
                const newPrice = isBid
                  ? prevCorrected.price - tickSize
                  : prevCorrected.price + tickSize;
                
                corrected.push({
                  ...level,
                  price: Math.round(newPrice / tickSize) * tickSize,
                });
              }
            } else {
              corrected.push({ ...level });
            }
          }
          
          return corrected;
        };

        snapshot.bids = checkMisalignment(sortedBids, true);
        snapshot.asks = checkMisalignment(sortedAsks, false);
      });
    });

    return { snapshots: result, misalignmentCount };
  }

  private detectAndMarkOutliers(
    snapshots: OrderBookSnapshot[]
  ): { snapshots: OrderBookSnapshot[]; outlierCount: number } {
    let outlierCount = 0;
    const { outlierSigma } = this.config;

    const allQuantities: number[] = [];
    snapshots.forEach(snapshot => {
      snapshot.bids.forEach(level => allQuantities.push(level.quantity));
      snapshot.asks.forEach(level => allQuantities.push(level.quantity));
    });

    const mean = allQuantities.reduce((a, b) => a + b, 0) / allQuantities.length;
    const std = Math.sqrt(
      allQuantities.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / allQuantities.length
    );
    const threshold = mean + outlierSigma * std;

    const result = produce(snapshots, draft => {
      draft.forEach(snapshot => {
        const markOutliers = (levels: PriceLevel[]) => {
          levels.forEach(level => {
            if (level.quantity > threshold) {
              outlierCount++;
              (level as PriceLevel & { isOutlier?: boolean }).isOutlier = true;
            }
          });
        };

        markOutliers(snapshot.bids);
        markOutliers(snapshot.asks);
      });
    });

    return { snapshots: result, outlierCount };
  }

  private interpolateMissingSnapshots(
    snapshots: OrderBookSnapshot[]
  ): OrderBookSnapshot[] {
    if (snapshots.length < 2) return snapshots;

    const { expectedInterval } = this.config;
    const result: OrderBookSnapshot[] = [snapshots[0]];

    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1];
      const curr = snapshots[i];
      const gap = curr.timestamp - prev.timestamp;

      if (gap > expectedInterval * 2) {
        const missingCount = Math.floor(gap / expectedInterval) - 1;
        
        for (let j = 1; j <= missingCount; j++) {
          const ratio = j / (missingCount + 1);
          const interpTimestamp = prev.timestamp + j * expectedInterval;
          
          const interpolateLevels = (prevLevels: PriceLevel[], currLevels: PriceLevel[], isBid: boolean): PriceLevel[] => {
            return prevLevels.map((prevLevel, idx) => {
              const currLevel = currLevels[idx] || prevLevel;
              return {
                id: `interp-${interpTimestamp}-${isBid ? 'bid' : 'ask'}-${idx}`,
                side: isBid ? 'bid' : 'ask',
                level: prevLevel.level,
                price: prevLevel.price + (currLevel.price - prevLevel.price) * ratio,
                quantity: Math.round(prevLevel.quantity + (currLevel.quantity - prevLevel.quantity) * ratio),
                orderCount: prevLevel.orderCount,
                rawData: { interpolated: true, fromId: prev.id, toId: curr.id },
              };
            });
          };

          const interpolated: OrderBookSnapshot = {
            id: `snapshot-interp-${interpTimestamp}`,
            timestamp: interpTimestamp,
            symbol: prev.symbol,
            lastPrice: prev.lastPrice + (curr.lastPrice - prev.lastPrice) * ratio,
            volume: Math.round(prev.volume + (curr.volume - prev.volume) * ratio),
            openInterest: Math.round(prev.openInterest + (curr.openInterest - prev.openInterest) * ratio),
            bids: interpolateLevels(prev.bids, curr.bids, true),
            asks: interpolateLevels(prev.asks, curr.asks, false),
            trades: [],
            rawData: { interpolated: true, fromId: prev.id, toId: curr.id },
          };
          
          result.push(interpolated);
        }
      }

      result.push(curr);
    }

    return result;
  }

  private convertTo3DCubes(
    snapshots: OrderBookSnapshot[],
    anomalies: Anomaly[]
  ): { cubes: Cube3D[]; dataRange: DataRange } {
    const prices: number[] = [];
    const quantities: number[] = [];
    const timestamps: number[] = [];

    snapshots.forEach(snapshot => {
      timestamps.push(snapshot.timestamp);
      prices.push(snapshot.lastPrice);
      snapshot.bids.forEach(l => {
        prices.push(l.price);
        quantities.push(l.quantity);
      });
      snapshot.asks.forEach(l => {
        prices.push(l.price);
        quantities.push(l.quantity);
      });
    });

    const dataRange: DataRange = {
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      minTime: Math.min(...timestamps),
      maxTime: Math.max(...timestamps),
      minQuantity: Math.min(...quantities),
      maxQuantity: Math.max(...quantities),
    };

    const priceSpan = dataRange.maxPrice - dataRange.minPrice || 1;
    const timeSpan = dataRange.maxTime - dataRange.minTime || 1;
    const qtySpan = dataRange.maxQuantity - dataRange.minQuantity || 1;

    const priceScale = 10 / priceSpan;
    const timeScale = 10 / Math.max(snapshots.length - 1, 1);
    const qtyScale = 5 / qtySpan;

    const anomalyMap = new Map<string, Anomaly[]>();
    anomalies.forEach(anomaly => {
      const key = `${anomaly.dataPoint.timestamp}-${anomaly.dataPoint.level}`;
      if (!anomalyMap.has(key)) {
        anomalyMap.set(key, []);
      }
      anomalyMap.get(key)!.push(anomaly);
    });

    const cubes: Cube3D[] = [];

    snapshots.forEach((snapshot, timeIdx) => {
      const y = timeIdx * timeScale - 5;

      const processLevel = (level: PriceLevel, isBid: boolean) => {
        const x = (level.price - dataRange.minPrice) * priceScale - 5;
        const z = (level.quantity - dataRange.minQuantity) * qtyScale / 2 + 0.1;

        const anomalyKey = `${snapshot.timestamp}-${level.level}`;
        const levelAnomalies = anomalyMap.get(anomalyKey) || [];
        const hasAnomaly = levelAnomalies.length > 0;
        const maxSeverity = hasAnomaly 
          ? Math.max(...levelAnomalies.map(a => a.severity))
          : 0;

        const cube: Cube3D = {
          id: `cube-${snapshot.timestamp}-${isBid ? 'bid' : 'ask'}-${level.level}`,
          x,
          y,
          z: z / 2,
          width: 0.9 * priceScale * this.config.tickSize,
          height: 0.9 * timeScale,
          depth: z,
          color: hasAnomaly 
            ? getAnomalyColor(maxSeverity)
            : getQuantityColor(level.quantity, dataRange.minQuantity, dataRange.maxQuantity, isBid),
          opacity: hasAnomaly ? 0.95 : getLevelOpacity(level.level, 10),
          isBid,
          timestamp: snapshot.timestamp,
          price: level.price,
          quantity: level.quantity,
          level: level.level,
          snapshotId: snapshot.id,
          isSelected: false,
          isHighlighted: hasAnomaly,
          isAnomaly: hasAnomaly,
          anomalySeverity: maxSeverity,
        };

        cubes.push(cube);
      };

      snapshot.bids.forEach(level => processLevel(level, true));
      snapshot.asks.forEach(level => processLevel(level, false));
    });

    return { cubes, dataRange };
  }

  updateCubeColors(cubes: Cube3D[], dataRange: DataRange): Cube3D[] {
    return cubes.map(cube => {
      if (cube.isAnomaly) {
        return {
          ...cube,
          color: getAnomalyColor(cube.anomalySeverity),
        };
      }
      return {
        ...cube,
        color: getQuantityColor(cube.quantity, dataRange.minQuantity, dataRange.maxQuantity, cube.isBid),
      };
    });
  }
}

export const dataProcessor = new DataProcessor();
