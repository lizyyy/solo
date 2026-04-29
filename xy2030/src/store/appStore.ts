import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  User,
  ChatMessage,
  CommunityPost,
  TreeHolePost,
  DiaryEntry,
  Plant,
  SocialTask,
  PracticeRecord,
  QuestionOption,
} from '@/types';

import {
  defaultUser,
  initialCommunityPosts,
  initialTreeHolePosts,
  initialDiaryEntries,
  initialPlant,
  socialTasks,
} from '@/data/mockData';

interface AppState {
  user: User;
  communityPosts: CommunityPost[];
  treeHolePosts: TreeHolePost[];
  diaryEntries: DiaryEntry[];
  plant: Plant;
  practiceRecords: PracticeRecord[];
  currentTestStep: number;
  testAnswers: Record<string, QuestionOption>;
  selectedTasks: SocialTask[];
  chatMessages: ChatMessage[];
  currentChatScenario: string | null;
  savedScripts: string[];
  completedTasks: string[];
  activeTab: string;
  
  updateUser: (updates: Partial<User>) => void;
  updatePersonalityType: (type: 'I' | 'E', iScore: number, eScore: number, concentration: number) => void;
  
  setCurrentTestStep: (step: number) => void;
  setTestAnswer: (questionId: string, option: QuestionOption) => void;
  clearTest: () => void;
  
  togglePostLike: (postId: string) => void;
  togglePostSave: (postId: string) => void;
  addCommunityPost: (content: string, tags: string[], isAnonymous: boolean) => void;
  addCommunityComment: (postId: string, content: string) => void;
  toggleCommentLike: (postId: string, commentId: string) => void;
  
  toggleTreeHoleLike: (postId: string) => void;
  addTreeHolePost: (content: string, emotion: string) => void;
  addTreeHoleComment: (postId: string, content: string) => void;
  
  addDiaryEntry: (entry: Omit<DiaryEntry, 'id'>) => void;
  
  waterPlant: () => void;
  fertilizePlant: () => void;
  updatePlantName: (name: string) => void;
  
  selectTask: (task: SocialTask) => void;
  completeTask: (taskId: string) => void;
  
  startChat: (scenarioId: string, initialMessage: ChatMessage) => void;
  addChatMessage: (message: ChatMessage) => void;
  endChat: () => void;
  
  toggleScriptSave: (scriptId: string) => void;
  
  addPracticeRecord: (record: Omit<PracticeRecord, 'id'>) => void;
  
  setActiveTab: (tab: string) => void;
  addSocialSteps: (steps: number) => void;
  incrementStreak: () => void;
  incrementCompletedPractices: () => void;
  resetAllData: () => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: defaultUser,
      communityPosts: initialCommunityPosts,
      treeHolePosts: initialTreeHolePosts,
      diaryEntries: initialDiaryEntries,
      plant: initialPlant,
      practiceRecords: [],
      currentTestStep: 0,
      testAnswers: {},
      selectedTasks: [],
      chatMessages: [],
      currentChatScenario: null,
      savedScripts: [],
      completedTasks: [],
      activeTab: 'home',
      
      updateUser: (updates) => set((state) => ({
        user: { ...state.user, ...updates },
      })),
      
      updatePersonalityType: (type, iScore, eScore, concentration) => set((state) => ({
        user: {
          ...state.user,
          personalityType: type,
          iScore,
          eScore,
          socialConcentration: concentration,
        },
      })),
      
      setCurrentTestStep: (step) => set({ currentTestStep: step }),
      
      setTestAnswer: (questionId, option) => set((state) => ({
        testAnswers: { ...state.testAnswers, [questionId]: option },
      })),
      
      clearTest: () => set({ currentTestStep: 0, testAnswers: {} }),
      
      togglePostLike: (postId) => set((state) => ({
        communityPosts: state.communityPosts.map((post) =>
          post.id === postId
            ? {
                ...post,
                isLiked: !post.isLiked,
                likes: post.isLiked ? post.likes - 1 : post.likes + 1,
              }
            : post
        ),
      })),
      
      togglePostSave: (postId) => set((state) => ({
        communityPosts: state.communityPosts.map((post) =>
          post.id === postId ? { ...post, isSaved: !post.isSaved } : post
        ),
      })),
      
      addCommunityPost: (content, tags, isAnonymous) => set((state) => {
        const newPost: CommunityPost = {
          id: generateId(),
          userId: state.user.id,
          userName: isAnonymous ? '匿名用户' : state.user.name,
          userAvatar: isAnonymous
            ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=anonymous'
            : state.user.avatar,
          content,
          tags,
          likes: 0,
          comments: 0,
          isAnonymous,
          createdAt: new Date().toISOString(),
          isLiked: false,
          isSaved: false,
          commentList: [],
        };
        return {
          communityPosts: [newPost, ...state.communityPosts],
        };
      }),
      
      addCommunityComment: (postId, content) => set((state) => {
        const { user } = state;
        const newComment = {
          id: generateId(),
          postId,
          userId: user.id,
          userName: user.name,
          userAvatar: user.avatar,
          content,
          createdAt: new Date().toISOString(),
          likes: 0,
          isLiked: false,
        };
        return {
          communityPosts: state.communityPosts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  comments: post.comments + 1,
                  commentList: [...(post.commentList || []), newComment],
                }
              : post
          ),
        };
      }),
      
      toggleCommentLike: (postId, commentId) => set((state) => ({
        communityPosts: state.communityPosts.map((post) =>
          post.id === postId
            ? {
                ...post,
                commentList: (post.commentList || []).map((comment) =>
                  comment.id === commentId
                    ? {
                        ...comment,
                        isLiked: !comment.isLiked,
                        likes: comment.isLiked ? comment.likes - 1 : comment.likes + 1,
                      }
                    : comment
                ),
              }
            : post
        ),
      })),
      
      toggleTreeHoleLike: (postId) => set((state) => ({
        treeHolePosts: state.treeHolePosts.map((post) =>
          post.id === postId
            ? {
                ...post,
                isLiked: !post.isLiked,
                likes: post.isLiked ? post.likes - 1 : post.likes + 1,
              }
            : post
        ),
      })),
      
      addTreeHolePost: (content, emotion) => set((state) => {
        const newPost: TreeHolePost = {
          id: generateId(),
          content,
          emotion: emotion as TreeHolePost['emotion'],
          likes: 0,
          comments: 0,
          createdAt: new Date().toISOString(),
          isLiked: false,
          commentList: [],
        };
        return {
          treeHolePosts: [newPost, ...state.treeHolePosts],
        };
      }),
      
      addTreeHoleComment: (postId, content) => set((state) => {
        const { user } = state;
        const newComment = {
          id: generateId(),
          postId,
          userId: user.id,
          userName: '匿名用户',
          userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=holecomment',
          content,
          createdAt: new Date().toISOString(),
          likes: 0,
          isLiked: false,
        };
        return {
          treeHolePosts: state.treeHolePosts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  comments: post.comments + 1,
                  commentList: [...(post.commentList || []), newComment],
                }
              : post
          ),
        };
      }),
      
      addDiaryEntry: (entry) => set((state) => {
        const newEntry: DiaryEntry = {
          ...entry,
          id: generateId(),
        };
        return {
          diaryEntries: [newEntry, ...state.diaryEntries],
        };
      }),
      
      waterPlant: () => set((state) => {
        const now = new Date().toISOString();
        const newWater = Math.min(100, state.plant.water + 30);
        const growthBoost = state.plant.water < 30 ? 5 : 2;
        const newGrowth = Math.min(100, state.plant.growth + growthBoost);
        
        let newType: Plant['type'] = state.plant.type;
        if (newGrowth >= 80 && state.plant.type !== 'blooming') newType = 'blooming';
        else if (newGrowth >= 60 && state.plant.type === 'young') newType = 'adult';
        else if (newGrowth >= 35 && state.plant.type === 'sprout') newType = 'young';
        else if (newGrowth >= 10 && state.plant.type === 'seed') newType = 'sprout';
        
        return {
          plant: {
            ...state.plant,
            water: newWater,
            growth: newGrowth,
            type: newType,
            lastWateredAt: now,
            careLogs: [
              ...state.plant.careLogs,
              { id: generateId(), action: 'water', timestamp: now, effect: growthBoost },
            ],
          },
        };
      }),
      
      fertilizePlant: () => set((state) => {
        const now = new Date().toISOString();
        const newFertilizer = Math.min(100, state.plant.fertilizer + 25);
        const growthBoost = state.plant.fertilizer < 20 ? 10 : 5;
        const newGrowth = Math.min(100, state.plant.growth + growthBoost);
        
        let newType: Plant['type'] = state.plant.type;
        if (newGrowth >= 80 && state.plant.type !== 'blooming') newType = 'blooming';
        else if (newGrowth >= 60 && state.plant.type === 'young') newType = 'adult';
        else if (newGrowth >= 35 && state.plant.type === 'sprout') newType = 'young';
        else if (newGrowth >= 10 && state.plant.type === 'seed') newType = 'sprout';
        
        return {
          plant: {
            ...state.plant,
            fertilizer: newFertilizer,
            growth: newGrowth,
            type: newType,
            lastFertilizedAt: now,
            careLogs: [
              ...state.plant.careLogs,
              { id: generateId(), action: 'fertilize', timestamp: now, effect: growthBoost },
            ],
          },
        };
      }),
      
      updatePlantName: (name) => set((state) => ({
        plant: { ...state.plant, name },
      })),
      
      selectTask: (task) => set((state) => ({
        selectedTasks: [...state.selectedTasks, task],
      })),
      
      completeTask: (taskId) => set((state) => {
        const task = socialTasks.find((t) => t.id === taskId);
        if (task) {
          get().addSocialSteps(task.reward);
        }
        return {
          completedTasks: [...state.completedTasks, taskId],
          selectedTasks: state.selectedTasks.filter((t) => t.id !== taskId),
        };
      }),
      
      startChat: (scenarioId, initialMessage) => set({
        currentChatScenario: scenarioId,
        chatMessages: [initialMessage],
      }),
      
      addChatMessage: (message) => set((state) => ({
        chatMessages: [...state.chatMessages, message],
      })),
      
      endChat: () => set({
        currentChatScenario: null,
        chatMessages: [],
      }),
      
      toggleScriptSave: (scriptId) => set((state) => ({
        savedScripts: state.savedScripts.includes(scriptId)
          ? state.savedScripts.filter((id) => id !== scriptId)
          : [...state.savedScripts, scriptId],
      })),
      
      addPracticeRecord: (record) => set((state) => ({
        practiceRecords: [
          { ...record, id: generateId() },
          ...state.practiceRecords,
        ],
      })),
      
      setActiveTab: (tab) => set({ activeTab: tab }),
      
      addSocialSteps: (steps) => set((state) => ({
        user: {
          ...state.user,
          totalSocialSteps: state.user.totalSocialSteps + steps,
        },
      })),
      
      incrementStreak: () => set((state) => ({
        user: {
          ...state.user,
          streakDays: state.user.streakDays + 1,
        },
      })),
      
      incrementCompletedPractices: () => set((state) => ({
        user: {
          ...state.user,
          completedPractices: state.user.completedPractices + 1,
        },
      })),
      
      resetAllData: () => {
        localStorage.removeItem('i-to-e-training-store');
        set({
          user: defaultUser,
          communityPosts: initialCommunityPosts,
          treeHolePosts: initialTreeHolePosts,
          diaryEntries: initialDiaryEntries,
          plant: initialPlant,
          practiceRecords: [],
          currentTestStep: 0,
          testAnswers: {},
          selectedTasks: [],
          chatMessages: [],
          currentChatScenario: null,
          savedScripts: [],
          completedTasks: [],
          activeTab: 'home',
        });
      },
    }),
    {
      name: 'i-to-e-training-store',
      partialize: (state) => ({
        user: state.user,
        communityPosts: state.communityPosts,
        treeHolePosts: state.treeHolePosts,
        diaryEntries: state.diaryEntries,
        plant: state.plant,
        practiceRecords: state.practiceRecords,
        savedScripts: state.savedScripts,
        completedTasks: state.completedTasks,
      }),
    }
  )
);
