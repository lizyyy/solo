export interface Note {
  pitch: number;
  duration: number;
  startTime: number;
  velocity?: number;
}

export interface ContourCode {
  relative: number[];
  direction: ('up' | 'down' | 'flat')[];
  intervals: number[];
  rawSequence: string;
}

export interface RhythmCode {
  normalized: number[];
  pattern: string;
  stretchFactor: number;
}

export interface MelodySegment {
  id: string;
  workId: string;
  notes: Note[];
  pitches: number[];
  durations: number[];
  startBeat: number;
  endBeat: number;
  contour: ContourCode;
  rhythm: RhythmCode;
}

export interface Work {
  id: string;
  title: string;
  studentName: string;
  tags: string[];
  keySignature: string;
  remarks: string;
  segments: MelodySegment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DTWResult {
  distance: number;
  normalizedDistance: number;
  path: [number, number][];
  costMatrix: number[][];
}

export interface EditDistanceResult {
  distance: number;
  normalizedDistance: number;
  operations: string[];
}

export interface RetrievalParams {
  contourWeight: number;
  rhythmWeight: number;
  transpositionTolerance: number;
  stretchThreshold: number;
  minMatchScore: number;
  maxResults: number;
}

export interface ScoreBreakdown {
  contour: {
    raw: number;
    normalized: number;
    weight: number;
    weighted: number;
    details: DTWResult;
  };
  rhythm: {
    raw: number;
    normalized: number;
    weight: number;
    weighted: number;
    details: EditDistanceResult;
  };
  overall: number;
}

export interface RetrievalResult {
  id: string;
  querySegment: MelodySegment;
  targetSegment: MelodySegment;
  targetWork: Work;
  scores: ScoreBreakdown;
  transposition: number;
  timeStretch: number;
  matched: boolean;
  calculationDetails: CalculationDetails;
}

export interface CalculationDetails {
  parameters: RetrievalParams;
  contourEncoding: {
    input: number[];
    output: string;
    steps: string[];
  };
  rhythmNormalization: {
    input: number[];
    output: number[];
    stretchFactor: number;
  };
  similarityCalc: {
    contourDTW: {
      distance: number;
      path: [number, number][];
    };
    rhythmEdit: {
      distance: number;
      operations: string[];
    };
  };
}

export interface RetrievalRecord {
  id: string;
  queryTitle: string;
  resultsCount: number;
  highSimilarityCount: number;
  parameters: RetrievalParams;
  createdAt: Date;
}

export interface RetrievalReport {
  id: string;
  title: string;
  recordIds: string[];
  parameters: RetrievalParams;
  summary: {
    totalComparisons: number;
    matchesFound: number;
    averageScore: number;
    highestScore: number;
  };
  results: RetrievalResult[];
  exportFormat: 'pdf' | 'json';
  createdAt: Date;
}
