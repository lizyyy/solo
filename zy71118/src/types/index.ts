export interface SkuSlot {
  id: string;
  skuId: string;
  skuName: string;
  category: string;
  position: number;
  width: number;
  isOutOfStock: boolean;
  color: string;
}

export interface ShelfLayer {
  index: number;
  height: number;
  isGolden: boolean;
  capacity: number;
  slots: SkuSlot[];
}

export interface Shelf {
  id: string;
  type: 'normal' | 'endcap';
  x: number;
  z: number;
  rotation: number;
  width: number;
  height: number;
  depth: number;
  layers: ShelfLayer[];
  isEndcap: boolean;
  isBlocked?: boolean;
}

export interface HeatmapPoint {
  x: number;
  z: number;
  intensity: number;
}

export interface Store {
  id: string;
  name: string;
  width: number;
  depth: number;
  shelves: Shelf[];
  heatmapData: HeatmapPoint[];
}

export type IssueType = 'duplicate_sku' | 'golden_layer_violation' | 'endcap_blocked' | 'out_of_stock';

export interface InspectionIssue {
  id: string;
  type: IssueType;
  severity: 'high' | 'medium' | 'low';
  description: string;
  shelfId: string;
  layerIndex?: number;
  skuId?: string;
  position?: { x: number; z: number };
}

export interface HistorySnapshot {
  id: string;
  timestamp: number;
  label: string;
  store: Store;
  issues: InspectionIssue[];
}

export interface CameraPreset {
  name: string;
  position: [number, number, number];
  target: [number, number, number];
}

export interface AppState {
  store: Store | null;
  initialStore: Store | null;
  selectedShelfId: string | null;
  selectedSkuId: string | null;
  selectedSkuSlotId: string | null;
  issues: InspectionIssue[];
  currentTime: number;
  isPlaying: boolean;
  showHeatmap: boolean;
  showGoldenLayer: boolean;
  showIssues: boolean;
  filterCategory: string | null;
  history: HistorySnapshot[];
  historyIndex: number;
  draggedSku: { shelfId: string; layerIndex: number; slotId: string } | null;
}

export interface AppActions {
  loadSampleData: () => void;
  setSelectedShelf: (id: string | null) => void;
  setSelectedSku: (skuId: string | null, slotId?: string | null) => void;
  setShowHeatmap: (show: boolean) => void;
  setShowGoldenLayer: (show: boolean) => void;
  setShowIssues: (show: boolean) => void;
  setFilterCategory: (category: string | null) => void;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setDraggedSku: (sku: { shelfId: string; layerIndex: number; slotId: string } | null) => void;
  moveSku: (
    fromShelfId: string,
    fromLayerIndex: number,
    fromSlotId: string,
    toShelfId: string,
    toLayerIndex: number,
    toPosition: number
  ) => void;
  saveSnapshot: (label: string) => void;
  goToSnapshot: (index: number) => void;
  resetState: () => void;
  runInspection: () => void;
  exportReport: () => Promise<void>;
  getCategories: () => string[];
  getShelfById: (id: string) => Shelf | undefined;
  getSkuSlotById: (slotId: string) => { shelf: Shelf; layer: ShelfLayer; slot: SkuSlot } | null;
}

export type AppStore = AppState & AppActions;
