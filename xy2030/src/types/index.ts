export interface User {
  id: string;
  name: string;
  avatar: string;
  personalityType: 'I' | 'E' | null;
  iScore: number;
  eScore: number;
  socialConcentration: number;
  personalityScore: number | null;
  joinDate: string;
  streakDays: number;
  totalSocialSteps: number;
  completedPractices: number;
  badges: Badge[];
  savedPosts: string[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string;
}

export interface Question {
  id: string;
  text: string;
  options: QuestionOption[];
}

export interface QuestionOption {
  id: string;
  text: string;
  type: 'I' | 'E';
  weight: number;
}

export interface TestResult {
  userId: string;
  type: 'I' | 'E';
  concentration: number;
  description: string;
  tips: string[];
  completedAt: string;
}

export interface SocialScript {
  id: string;
  category: 'opening' | 'rescue' | 'reject';
  title: string;
  content: string;
  tags: string[];
  usage: string;
}

export interface SocialTask {
  id: string;
  title: string;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  category: 'small_talk' | 'interaction' | 'initiative' | 'challenge';
  reward: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
  emotion?: string;
}

export interface ChatScenario {
  id: string;
  title: string;
  description: string;
  initialMessage: string;
  difficulty: 'easy' | 'medium' | 'hard';
  icon: string;
}

export interface ResponseTemplate {
  id: string;
  category: string;
  title: string;
  scenario: string;
  scripts: {
    casual: string;
    polite: string;
    humorous: string;
  };
  tips: string[];
}

export interface CommunityPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  images?: string[];
  tags: string[];
  likes: number;
  comments: number;
  isAnonymous: boolean;
  createdAt: string;
  isLiked: boolean;
  isSaved: boolean;
  commentList?: Comment[];
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  createdAt: string;
  likes: number;
  isLiked: boolean;
}

export interface DiaryEntry {
  id: string;
  date: string;
  mood: 'great' | 'good' | 'neutral' | 'bad';
  content: string;
  socialSteps: number;
  challenges: string[];
  achievements: string[];
  images?: string[];
}

export interface TreeHolePost {
  id: string;
  content: string;
  emotion: 'anxiety' | 'stress' | 'confusion' | 'relief' | 'excitement' | 'other';
  likes: number;
  comments: number;
  createdAt: string;
  isLiked: boolean;
  commentList?: Comment[];
}

export interface Plant {
  id: string;
  userId: string;
  name: string;
  type: 'seed' | 'sprout' | 'young' | 'adult' | 'blooming';
  growth: number;
  water: number;
  fertilizer: number;
  health: number;
  lastWateredAt: string | null;
  lastFertilizedAt: string | null;
  careLogs: PlantCareLog[];
}

export interface PlantCareLog {
  id: string;
  action: 'water' | 'fertilize' | 'prune';
  timestamp: string;
  effect: number;
}

export interface RelaxSound {
  id: string;
  name: string;
  icon: string;
  duration: number;
  isLooping: boolean;
}

export interface TimerSession {
  id: string;
  startTime: string;
  endTime: string | null;
  duration: number;
  isRunning: boolean;
  isPaused: boolean;
  remainingTime: number;
  soundId: string | null;
}

export interface PosterData {
  date: string;
  socialSteps: number;
  concentration: number;
  type: 'I' | 'E' | null;
  achievements: string[];
  mood: string;
}

export interface PracticeRecord {
  id: string;
  type: 'script' | 'task' | 'chat' | 'relax';
  title: string;
  description: string;
  completedAt: string;
  reward: number;
  details?: Record<string, unknown>;
}
