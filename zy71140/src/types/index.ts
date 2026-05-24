export interface ColdStorage {
  id: string;
  name: string;
  dimensions: { width: number; height: number; depth: number };
}

export interface Layer {
  id: string;
  name: string;
  level: number;
  tempRange: string;
  color: string;
  minTemp: number;
  maxTemp: number;
}

export interface Slot {
  id: string;
  code: string;
  position: { x: number; y: number; z: number };
  layerId: string;
  status: 'normal' | 'misplaced' | 'conflict';
  isOccupied: boolean;
}

export interface SKU {
  id: string;
  name: string;
  code: string;
  batchNo: string;
  expiryDate: string;
  inboundDate: string;
  slotId: string;
  layerId: string;
  quantity: number;
  category: string;
}

export interface InventoryReport {
  id: string;
  generatedAt: string;
  totalSlots: number;
  occupiedSlots: number;
  misplacedItems: number;
  expiringItems: number;
  layerStats: LayerStat[];
  skuDetails: SKU[];
}

export interface LayerStat {
  layerId: string;
  layerName: string;
  totalSlots: number;
  occupiedSlots: number;
  misplacedCount: number;
  expiringCount: number;
}

export type CameraView = 'overview' | 'front' | 'side' | 'top' | 'free';

export interface AppState {
  coldStorage: ColdStorage;
  layers: Layer[];
  slots: Slot[];
  skus: SKU[];
  selectedLayerIds: string[];
  selectedSlotId: string | null;
  searchQuery: string;
  expiryFilterDays: number;
  cameraView: CameraView;
  timestamp: number;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
}

export interface AppActions {
  setSelectedLayers: (layerIds: string[]) => void;
  toggleLayer: (layerId: string) => void;
  setSelectedSlot: (slotId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setExpiryFilterDays: (days: number) => void;
  setCameraView: (view: CameraView) => void;
  loadSampleData: () => void;
  resetState: () => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  generateReport: () => InventoryReport;
  exportReportJSON: () => void;
  exportReportCSV: () => void;
}

export type StoreType = AppState & AppActions;
