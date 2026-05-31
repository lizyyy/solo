export type SourceType = 'lighting' | 'note' | 'inventory';
export type ChangeType = 'material-only' | 'conclusion-change';
export type ProcessingStatus = 'confirmed' | 'pending' | 'manual-modified';
export type TabType = 'timeline' | 'schedule' | 'exhibition';

export interface Artwork {
  id: string;
  code: string;
  title: string;
  artist: string;
  dimensions: string;
  dimensionUnit: string;
  dimensionSource: SourceType;
}

export interface TimelineRecord {
  id: string;
  sourceType: SourceType;
  timestamp: Date;
  content: string;
  artworkId: string;
  isManual: boolean;
}

export interface ResidencyRecord {
  id: string;
  artworkId: string;
  artwork: Artwork;
  changeType: ChangeType;
  judgmentReason: string;
  issueDescription: string;
  nextStep: string;
  responsiblePerson: string;
  status: string;
  isAutoJudged: boolean;
  unitError?: {
    hasError: boolean;
    source: SourceType;
    expectedUnit: string;
    actualUnit: string;
  };
}

export interface ExhibitionItem {
  id: string;
  artwork: Artwork;
  processingStatus: ProcessingStatus;
  processingNote: string;
  lastModified?: Date;
}

export interface AppState {
  activeTab: TabType;
  timelineRecords: TimelineRecord[];
  artworks: Artwork[];
  residencyRecords: ResidencyRecord[];
  exhibitionItems: ExhibitionItem[];
}
