// 情绪类型
export type EmotionType = 'anxiety' | 'insomnia' | 'depression' | 'fatigue' | 'irritability';

// 音乐类型
export interface Music {
  id: string;
  title: string;
  artist: string;
  duration: number; // 秒
  emotionType: EmotionType;
  coverImage: string;
  audioUrl: string;
  isFavorite: boolean;
  category: 'emotion' | 'white-noise';
  description?: string;
}

// 歌单
export interface Playlist {
  id: string;
  name: string;
  emotionType: EmotionType;
  description: string;
  coverImage: string;
  musicIds: string[];
  isFavorite: boolean;
}

// 舞蹈类型
export interface Dance {
  id: string;
  title: string;
  category: 'beginner' | 'stretch' | 'breathing' | 'sleep';
  duration: number; // 秒
  description: string;
  thumbnail: string;
  difficulty: 'easy' | 'medium' | 'hard';
  steps: DanceStep[];
}

// 舞蹈步骤
export interface DanceStep {
  order: number;
  instruction: string;
  duration: number;
  animationHint: string;
}

// 绘画类型
export interface Painting {
  id: string;
  title: string;
  artist: string;
  era: string;
  description: string;
  imageUrl: string;
  category: 'classic' | 'coloring' | 'canvas';
  aiConversation?: AIConversation[];
  colors?: string[];
}

// AI对话
export interface AIConversation {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: number;
}

// 用户绘画作品
export interface UserArtwork {
  id: string;
  title: string;
  imageData: string; // base64
  createdAt: number;
  isPrivate: boolean;
  colors: string[];
  emotionAnalysis?: EmotionAnalysis;
}

// 情绪分析
export interface EmotionAnalysis {
  dominantEmotion: EmotionType;
  confidence: number;
  description: string;
  suggestions: string[];
  colorPalette: string[];
}

// 情绪打卡
export interface EmotionCheckin {
  id: string;
  date: string; // YYYY-MM-DD
  emotionType: EmotionType;
  intensity: number; // 1-10
  note?: string;
  timestamp: number;
}

// 心理测试
export interface PsychologicalTest {
  id: string;
  title: string;
  description: string;
  category: 'emotion' | 'stress' | 'anxiety' | 'sleep';
  questions: TestQuestion[];
}

// 测试问题
export interface TestQuestion {
  id: string;
  text: string;
  options: TestOption[];
}

// 测试选项
export interface TestOption {
  id: string;
  text: string;
  score: number;
}

// 测试结果
export interface TestResult {
  id: string;
  testId: string;
  totalScore: number;
  level: 'mild' | 'moderate' | 'severe';
  description: string;
  suggestions: string[];
  timestamp: number;
}

// 日记
export interface DiaryEntry {
  id: string;
  title: string;
  content: string;
  emotionType: EmotionType;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  imageUrl?: string;
  isPrivate: boolean;
}

// 社区帖子
export interface CommunityPost {
  id: string;
  userId: string;
  userName: string;
  content: string;
  imageUrl?: string;
  likes: number;
  comments: Comment[];
  createdAt: number;
  isAnonymous: boolean;
}

// 评论
export interface Comment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  isEncouraging: boolean;
  createdAt: number;
}

// 用户
export interface User {
  id: string;
  name: string;
  avatar: string;
  bio?: string;
  privatePassword?: string; // 用于私密作品集
  createdAt: number;
  preferences: UserPreferences;
}

// 用户偏好
export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  defaultEmotion: EmotionType;
  notifications: {
    dailyCheckin: boolean;
    meditationReminder: boolean;
    newContent: boolean;
  };
}

// 冥想引导
export interface Meditation {
  id: string;
  title: string;
  duration: number;
  category: 'breathing' | 'body-scan' | 'loving-kindness' | 'sleep';
  description: string;
  audioUrl: string;
  steps: MeditationStep[];
}

// 冥想步骤
export interface MeditationStep {
  order: number;
  instruction: string;
  duration: number;
  breathingHint?: 'inhale' | 'exhale' | 'hold';
}

// 白噪音
export interface WhiteNoise {
  id: string;
  name: string;
  icon: string;
  audioUrl: string;
  category: 'rain' | 'forest' | 'wind' | 'stream';
  volume: number;
}

// 应用状态
export interface AppState {
  user: User | null;
  currentMusic: Music | null;
  isPlaying: boolean;
  currentVolume: number;
  checkins: EmotionCheckin[];
  diaries: DiaryEntry[];
  userArtworks: UserArtwork[];
  testResults: TestResult[];
  communityPosts: CommunityPost[];
  favoriteMusicIds: string[];
  favoritePlaylistIds: string[];
  darkMode: boolean;
  likedPostIds: string[];
}
