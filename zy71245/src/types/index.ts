export type ClueCategory = 'paper' | 'seal' | 'calligraphy' | 'restoration' | 'report';

export interface Clue {
  id: string;
  category: ClueCategory;
  title: string;
  description: string;
  image?: string;
  originalValue: string;
  isAnomaly: boolean;
  anomalyId?: string;
  position?: { x: number; y: number };
}

export interface Anomaly {
  id: string;
  name: string;
  description: string;
  riskLevel: 1 | 2 | 3;
  correctExplanation: string;
  relatedClueIds: string[];
}

export interface ExpertComment {
  id: string;
  expertName: string;
  avatar?: string;
  content: string;
}

export interface Level {
  id: string;
  title: string;
  paintingImage: string;
  description: string;
  correctDynasty: string;
  difficulty: 1 | 2 | 3;
  clues: Clue[];
  anomalies: Anomaly[];
  expertComments: ExpertComment[];
}

export interface PlayerChoice {
  id: string;
  clueId: string;
  markedAsAnomaly: boolean;
  riskRating?: number;
  timestamp: number;
}

export interface PlayerNote {
  id: string;
  clueId: string;
  content: string;
  timestamp: number;
}

export type GameStatus = 'playing' | 'completed' | 'abandoned';

export interface GameSession {
  id: string;
  levelId: string;
  startTime: number;
  endTime?: number;
  status: GameStatus;
  playerChoices: PlayerChoice[];
  playerNotes: PlayerNote[];
  dynastyGuess?: string;
  reasoningNotes?: string;
  score?: Score;
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface Score {
  accuracyScore: number;
  discoveryScore: number;
  logicScore: number;
  totalScore: number;
  grade: Grade;
}

export interface ExportReport {
  summary: {
    levelTitle: string;
    playTime: number;
    totalScore: number;
    grade: Grade;
    keyFindings: string[];
    learningPoints: string[];
  };
  details: GameSession & {
    levelData: Level;
    timestamp: number;
  };
}

export type GameStep = 'intro' | 'clues' | 'dynasty' | 'risk' | 'submit';
