export type Subject = '语文' | '数学' | '英语' | '生物' | '地理' | '物理' | '化学' | '历史' | '政治';

export type Familiarity = '认识' | '模糊' | '忘记';

export interface Question {
  id: string;
  subject: Subject;
  content: string;
  blanks: Blank[];
  answer: string;
  explanation?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Blank {
  id: string;
  position: number;
  length: number;
  answer: string;
  hint?: string;
}

export interface ReviewRecord {
  id: string;
  questionId: string;
  familiarity: Familiarity;
  reviewedAt: string;
  nextReviewDate: string;
  reviewCount: number;
  easeFactor: number;
  interval: number;
}

export interface ReviewSettings {
  id: string;
  userId: string;
  algorithm: 'ebbinghaus' | 'custom';
  customIntervals: number[];
  createdAt: string;
  updatedAt: string;
}

export interface MindMapNode {
  id: string;
  label: string;
  type: 'root' | 'branch' | 'leaf';
  questionIds: string[];
  children: MindMapNode[];
  position?: { x: number; y: number };
}

export interface MindMap {
  id: string;
  title: string;
  type: 'curve' | 'tree';
  root: MindMapNode;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  name: string;
  avatar?: string;
  totalQuestions: number;
  reviewedQuestions: number;
  streakDays: number;
  createdAt: string;
}

export interface AppState {
  questions: Question[];
  reviewRecords: ReviewRecord[];
  reviewSettings: ReviewSettings;
  mindMaps: MindMap[];
  user: User;
  theme: 'light' | 'dark';
  loading: boolean;
  error: string | null;
}
