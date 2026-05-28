export interface GameParams {
  flightPath: {
    offsetX: number;
    offsetY: number;
    curvature: number;
  };
  sampling: {
    interval: number;
    count: number;
    apertureSize: number;
  };
  noise: {
    level: number;
    type: 'gaussian' | 'speckle' | 'impulse';
  };
  sceneId: string;
}

export interface CalculationStep {
  formula: string;
  inputs: Record<string, number>;
  intermediate: Record<string, number>;
  result: number;
}

export interface ScoreDetail {
  value: number;
  weight: number;
  calculation: CalculationStep[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export type ErrorType = 'insufficient_sampling' | 'track_deviation' | 'excessive_noise';
export type Severity = 'low' | 'medium' | 'high';

export interface ErrorAnalysis {
  type: ErrorType;
  severity: Severity;
  impact: string;
  calculation: CalculationStep[];
  suggestion: string;
}

export interface ImagingResult {
  rawEcho: number[][];
  processedImage: number[][];
  scores: {
    trackAccuracy: ScoreDetail;
    samplingAdequacy: ScoreDetail;
    noiseControl: ScoreDetail;
    imageClarity: ScoreDetail;
    totalScore: number;
  };
  errors: ErrorAnalysis[];
  params: GameParams;
  timestamp: number;
}

export interface SceneConfig {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  targetImage: number[][];
  idealParams: {
    trackOffset: { x: number; y: number };
    samplingInterval: number;
    noiseThreshold: number;
  };
  thresholds: {
    sampling: { warning: number; critical: number };
    track: { warning: number; critical: number };
    noise: { warning: number; critical: number };
  };
}

export type GamePhase = 'playing' | 'processing' | 'review';
