export interface ShipmentItem {
  id: string;
  batchId: string;
  sampleId: string;
  sampleName: string;
  sampleBrand: string;
  sampleValue: number;
  influencerId: string;
  influencerName: string;
  shipDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  status: 'shipped' | 'returned' | 'damaged' | 'overdue';
  returnPhotos?: string[];
  damageDescription?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Influencer {
  id: string;
  name: string;
  platform: string;
  followers: number;
  contact: string;
  address: string;
  level: 'A' | 'B' | 'C';
  depositAmount: number;
  createdAt: string;
}

export interface UploadBatch {
  id: string;
  fileName: string;
  uploadTime: string;
  itemCount: number;
  processed: boolean;
}

export type ProcessingStatus = 'normal' | 'pending' | 'failed';

export interface ProcessedItem {
  original: ShipmentItem;
  status: ProcessingStatus;
  issues: string[];
  suggestions: string[];
}

export interface ProcessingResult {
  batchId: string;
  normalItems: ProcessedItem[];
  pendingItems: ProcessedItem[];
  failedItems: ProcessedItem[];
  statistics: {
    total: number;
    normal: number;
    pending: number;
    failed: number;
  };
}

export interface Rule {
  id: string;
  name: string;
  check: (item: ShipmentItem, context: RuleContext) => RuleResult;
}

export interface RuleResult {
  hasIssue: boolean;
  status: ProcessingStatus;
  issues: string[];
  suggestions: string[];
}

export interface RuleContext {
  influencers: Map<string, Influencer>;
  existingShipments: ShipmentItem[];
  currentBatchShipments: ShipmentItem[];
  currentDate: Date;
}

export interface ReportDetail {
  shipmentId: string;
  batchId: string;
  sampleInfo: {
    id: string;
    name: string;
    brand: string;
    value: number;
  };
  influencerInfo: {
    id: string;
    name: string;
    platform: string;
  };
  timeline: {
    shipDate: string;
    expectedReturnDate: string;
    actualReturnDate?: string;
  };
  issues: string[];
  suggestions: string[];
  finalStatus: ProcessingStatus;
  photos?: string[];
}
