export type OperationType = 'book' | 'live' | 'shop' | 'shortvideo';

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export type WeekDay = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Position {
  id: OperationType;
  name: string;
  description: string;
  icon: string;
  color: string;
  weeklyHours: number;
  estimatedWeeks: number;
  overview: string;
  careerPath: string[];
  salaryRange: string;
  marketDemand: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  level: SkillLevel;
  category: string;
  positionIds: OperationType[];
  prerequisites: string[];
  estimatedHours: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  isComputerBasics?: boolean;
  resources: SkillResource[];
}

export interface SkillResource {
  type: 'video' | 'article' | 'course' | 'tool' | 'book';
  title: string;
  url: string;
  description: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  detailedSteps: string[];
  skillId: string;
  positionId: OperationType;
  level: SkillLevel;
  estimatedMinutes: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
  weekNumber: number;
  dayOfWeek: WeekDay;
  tags: string[];
  deliverables: string[];
  tips: string[];
  isComputerBasics?: boolean;
}

export interface Term {
  id: string;
  term: string;
  definition: string;
  examples: string[];
  category: string;
  relatedTerms: string[];
  positionIds: OperationType[];
}

export interface UserProgress {
  id: string;
  positionId: OperationType;
  selectedAt: string;
  currentWeek: number;
  skills: SkillProgress[];
  tasks: TaskProgress[];
  dailyCheckIns: DailyCheckIn[];
}

export interface SkillProgress {
  skillId: string;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  completedAt?: string;
  progressPercentage: number;
  notes: string;
}

export interface TaskProgress {
  taskId: string;
  status: TaskStatus;
  startedAt?: string;
  completedAt?: string;
  actualMinutes: number;
  deliverableUrls: string[];
  notes: string;
  rating?: 1 | 2 | 3 | 4 | 5;
}

export interface DailyCheckIn {
  date: string;
  checkedIn: boolean;
  mood: 'great' | 'good' | 'neutral' | 'bad';
  studyMinutes: number;
  notes: string;
  completedTaskIds: string[];
}