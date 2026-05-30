export interface PriceLevel {
  id: string;
  side: 'bid' | 'ask';
  level: number;
  price: number;
  quantity: number;
  orderCount?: number;
  rawData?: Record<string, unknown>;
}

export interface TradeRecord {
  id: string;
  tradeTime: number;
  price: number;
  quantity: number;
  direction: 'buy' | 'sell';
  isLiquidation?: boolean;
}

export interface OrderBookSnapshot {
  id: string;
  timestamp: number;
  symbol: string;
  lastPrice: number;
  volume: number;
  openInterest: number;
  bids: PriceLevel[];
  asks: PriceLevel[];
  trades: TradeRecord[];
  rawData?: Record<string, unknown>;
}

export interface Cube3D {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  color: string;
  opacity: number;
  isBid: boolean;
  timestamp: number;
  price: number;
  quantity: number;
  level: number;
  snapshotId: string;
  isSelected: boolean;
  isHighlighted: boolean;
  isAnomaly: boolean;
  anomalySeverity: number;
}

export interface DataRange {
  minPrice: number;
  maxPrice: number;
  minTime: number;
  maxTime: number;
  minQuantity: number;
  maxQuantity: number;
}

export interface DataProcessingConfig {
  tickSize: number;
  expectedInterval: number;
  priceLevels: number;
  handleNullValues: 'interpolate' | 'drop' | 'zero';
  handleDuplicates: 'keep_latest' | 'keep_first' | 'merge';
  outlierSigma: number;
}

export interface ProcessingResult {
  snapshots: OrderBookSnapshot[];
  cubes: Cube3D[];
  dataRange: DataRange;
  stats: ProcessingStats;
}

export interface ProcessingStats {
  totalSnapshots: number;
  validSnapshots: number;
  nullValues: number;
  duplicates: number;
  outliers: number;
  interpolatedValues: number;
  misalignments: number;
}
