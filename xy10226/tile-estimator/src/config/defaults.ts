import type { LossModel, InputData, Tile, RoomDimensions } from '../types';

// 默认损耗模型
export const DEFAULT_LOSS_MODEL: LossModel = {
  standard: 5,
  diagonal: 10,
  complexShapes: 5,
  batchDifference: 5,
  wasteUsage: true,
};

// 默认瓷砖尺寸（60x60标准砖）
export const DEFAULT_TILE: Tile = {
  id: 'default-60x60',
  name: '标准抛光砖 60×60cm',
  width: 60,
  height: 60,
  pricePerBox: 128,
  tilesPerBox: 4,
  batch: 'A2024001',
  colorTolerance: 0,
};

// 默认房间尺寸
export const DEFAULT_ROOM: RoomDimensions = {
  width: 400, // 4米
  length: 500, // 5米
  height: 280, // 2.8米
};

// 默认缝宽（厘米）
export const DEFAULT_GROUT_WIDTH = 0.3;

// 默认输入数据
export const DEFAULT_INPUT_DATA: InputData = {
  room: DEFAULT_ROOM,
  openings: [],
  tile: DEFAULT_TILE,
  layoutDirection: 'horizontal',
  layoutPattern: 'straight',
  groutWidth: DEFAULT_GROUT_WIDTH,
  lossModel: DEFAULT_LOSS_MODEL,
  batchOptions: {
    allowMultipleBatches: true,
    preferredBatches: [],
    colorTolerance: 0.1,
  },
};

// 批次颜色匹配分数阈值
export const COLOR_MATCH_THRESHOLDS = {
  perfect: 0.05,
  good: 0.15,
  acceptable: 0.3,
  poor: 0.5,
};

// 损耗计算规则
export const LOSS_CALCULATION_RULES = {
  diagonalMultiplier: 1.414,
  brickPatternExtra: 1.02,
  herringboneExtra: 1.15,
  openingWasteFactor: 1.1,
  minimumWasteTiles: 2,
};

// 常用瓷砖尺寸预设
export const TILE_PRESETS: Tile[] = [
  { id: '30x30', name: '小地砖 30×30cm', width: 30, height: 30, pricePerBox: 45, tilesPerBox: 12 },
  { id: '40x40', name: '中地砖 40×40cm', width: 40, height: 40, pricePerBox: 68, tilesPerBox: 8 },
  { id: '60x60', name: '标准砖 60×60cm', width: 60, height: 60, pricePerBox: 128, tilesPerBox: 4 },
  { id: '80x80', name: '大规格砖 80×80cm', width: 80, height: 80, pricePerBox: 198, tilesPerBox: 3 },
  { id: '120x60', name: '长条砖 120×60cm', width: 120, height: 60, pricePerBox: 320, tilesPerBox: 2 },
  { id: '120x60-wall', name: '墙砖 120×60cm', width: 120, height: 60, pricePerBox: 280, tilesPerBox: 2 },
];
