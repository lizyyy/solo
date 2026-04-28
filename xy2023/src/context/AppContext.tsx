import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type {
  UserProfile,
  CycleRecord,
  DiaryEntry,
  DiarySettings,
  CheckInRecord,
  PainLevelRecord,
  Post,
  Comment,
  ConstitutionType
} from '@/types';
import { defaultUserProfile, samplePosts, sampleComments } from '@/data/mockData';
import { storage, STORAGE_KEYS, hashPassword, verifyPassword } from '@/utils/storage';
import { generateId, calculateConstitution } from '@/utils/date';

interface AppState {
  userProfile: UserProfile;
  cycleRecords: CycleRecord[];
  diaryEntries: DiaryEntry[];
  diarySettings: DiarySettings;
  checkIns: CheckInRecord[];
  painRecords: PainLevelRecord[];
  posts: Post[];
  comments: Comment[];
  constitutionAnswers: Record<number, string>;
  isDiaryUnlocked: boolean;
}

type AppAction =
  | { type: 'SET_USER_PROFILE'; payload: Partial<UserProfile> }
  | { type: 'ADD_CYCLE_RECORD'; payload: CycleRecord }
  | { type: 'UPDATE_CYCLE_RECORD'; payload: CycleRecord }
  | { type: 'ADD_DIARY_ENTRY'; payload: DiaryEntry }
  | { type: 'UPDATE_DIARY_ENTRY'; payload: DiaryEntry }
  | { type: 'DELETE_DIARY_ENTRY'; payload: string }
  | { type: 'SET_DIARY_SETTINGS'; payload: Partial<DiarySettings> }
  | { type: 'SET_DIARY_UNLOCKED'; payload: boolean }
  | { type: 'ADD_CHECK_IN'; payload: CheckInRecord }
  | { type: 'UPDATE_CHECK_IN'; payload: CheckInRecord }
  | { type: 'ADD_PAIN_RECORD'; payload: PainLevelRecord }
  | { type: 'ADD_POST'; payload: Post }
  | { type: 'UPDATE_POST'; payload: Post }
  | { type: 'ADD_COMMENT'; payload: Comment }
  | { type: 'SET_CONSTITUTION_ANSWER'; payload: { questionId: number; answer: string } }
  | { type: 'COMPLETE_CONSTITUTION_TEST'; payload: ConstitutionType }
  | { type: 'RESET_STATE' };

const initialState: AppState = {
  userProfile: defaultUserProfile,
  cycleRecords: [],
  diaryEntries: [],
  diarySettings: { enabled: false },
  checkIns: [],
  painRecords: [],
  posts: samplePosts,
  comments: sampleComments,
  constitutionAnswers: {},
  isDiaryUnlocked: false
};

const loadInitialState = (): AppState => {
  const savedProfile = storage.get<UserProfile | null>(STORAGE_KEYS.USER_PROFILE, null);
  const savedCycles = storage.get<CycleRecord[]>(STORAGE_KEYS.CYCLE_RECORDS, []);
  const savedDiaries = storage.get<DiaryEntry[]>(STORAGE_KEYS.DIARY_ENTRIES, []);
  const savedDiarySettings = storage.get<DiarySettings>(STORAGE_KEYS.DIARY_SETTINGS, { enabled: false });
  const savedCheckIns = storage.get<CheckInRecord[]>(STORAGE_KEYS.CHECK_INS, []);
  const savedPainRecords = storage.get<PainLevelRecord[]>(STORAGE_KEYS.PAIN_RECORDS, []);
  const savedPosts = storage.get<Post[]>(STORAGE_KEYS.POSTS, samplePosts);
  const savedComments = storage.get<Comment[]>(STORAGE_KEYS.COMMENTS, sampleComments);
  const savedConstitutionAnswers = storage.get<Record<number, string>>(STORAGE_KEYS.CONSTITUTION_ANSWERS, {});

  return {
    userProfile: savedProfile || defaultUserProfile,
    cycleRecords: savedCycles,
    diaryEntries: savedDiaries,
    diarySettings: savedDiarySettings,
    checkIns: savedCheckIns,
    painRecords: savedPainRecords,
    posts: savedPosts,
    comments: savedComments,
    constitutionAnswers: savedConstitutionAnswers,
    isDiaryUnlocked: false
  };
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_USER_PROFILE':
      return { ...state, userProfile: { ...state.userProfile, ...action.payload } };

    case 'ADD_CYCLE_RECORD':
      return { ...state, cycleRecords: [...state.cycleRecords, action.payload] };

    case 'UPDATE_CYCLE_RECORD':
      return {
        ...state,
        cycleRecords: state.cycleRecords.map(r =>
          r.id === action.payload.id ? action.payload : r
        )
      };

    case 'ADD_DIARY_ENTRY':
      return { ...state, diaryEntries: [...state.diaryEntries, action.payload] };

    case 'UPDATE_DIARY_ENTRY':
      return {
        ...state,
        diaryEntries: state.diaryEntries.map(d =>
          d.id === action.payload.id ? action.payload : d
        )
      };

    case 'DELETE_DIARY_ENTRY':
      return {
        ...state,
        diaryEntries: state.diaryEntries.filter(d => d.id !== action.payload)
      };

    case 'SET_DIARY_SETTINGS':
      return { ...state, diarySettings: { ...state.diarySettings, ...action.payload } };

    case 'SET_DIARY_UNLOCKED':
      return { ...state, isDiaryUnlocked: action.payload };

    case 'ADD_CHECK_IN':
      return { ...state, checkIns: [...state.checkIns, action.payload] };

    case 'UPDATE_CHECK_IN':
      return {
        ...state,
        checkIns: state.checkIns.map(c =>
          c.id === action.payload.id ? action.payload : c
        )
      };

    case 'ADD_PAIN_RECORD':
      return { ...state, painRecords: [...state.painRecords, action.payload] };

    case 'ADD_POST':
      return { ...state, posts: [action.payload, ...state.posts] };

    case 'UPDATE_POST':
      return {
        ...state,
        posts: state.posts.map(p =>
          p.id === action.payload.id ? action.payload : p
        )
      };

    case 'ADD_COMMENT':
      return { ...state, comments: [...state.comments, action.payload] };

    case 'SET_CONSTITUTION_ANSWER':
      return {
        ...state,
        constitutionAnswers: {
          ...state.constitutionAnswers,
          [action.payload.questionId]: action.payload.answer
        }
      };

    case 'COMPLETE_CONSTITUTION_TEST':
      return {
        ...state,
        userProfile: {
          ...state.userProfile,
          constitutionType: action.payload,
          constitutionTestCompleted: true
        }
      };

    case 'RESET_STATE':
      return initialState;

    default:
      return state;
  }
};

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  addCycleRecord: (startDate: string) => void;
  endCurrentCycle: (endDate: string) => void;
  addDiaryEntry: (entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateDiaryEntry: (id: string, updates: Partial<DiaryEntry>) => void;
  deleteDiaryEntry: (id: string) => void;
  setDiaryPassword: (password: string, hint?: string) => void;
  verifyDiaryPassword: (password: string) => boolean;
  toggleCheckIn: (type: string, date: string) => void;
  addPainRecord: (record: Omit<PainLevelRecord, 'id'>) => void;
  addPost: (post: Omit<Post, 'id' | 'createdAt' | 'likes' | 'isLiked' | 'commentCount'>) => void;
  togglePostLike: (postId: string) => void;
  addComment: (comment: Omit<Comment, 'id' | 'createdAt' | 'likes' | 'isLiked' | 'replies'>) => void;
  setConstitutionAnswer: (questionId: number, answer: string) => void;
  completeConstitutionTest: () => ConstitutionType | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, undefined, loadInitialState);

  useEffect(() => {
    storage.set(STORAGE_KEYS.USER_PROFILE, state.userProfile);
  }, [state.userProfile]);

  useEffect(() => {
    storage.set(STORAGE_KEYS.CYCLE_RECORDS, state.cycleRecords);
  }, [state.cycleRecords]);

  useEffect(() => {
    storage.set(STORAGE_KEYS.DIARY_ENTRIES, state.diaryEntries);
  }, [state.diaryEntries]);

  useEffect(() => {
    storage.set(STORAGE_KEYS.DIARY_SETTINGS, state.diarySettings);
  }, [state.diarySettings]);

  useEffect(() => {
    storage.set(STORAGE_KEYS.CHECK_INS, state.checkIns);
  }, [state.checkIns]);

  useEffect(() => {
    storage.set(STORAGE_KEYS.PAIN_RECORDS, state.painRecords);
  }, [state.painRecords]);

  useEffect(() => {
    storage.set(STORAGE_KEYS.POSTS, state.posts);
  }, [state.posts]);

  useEffect(() => {
    storage.set(STORAGE_KEYS.COMMENTS, state.comments);
  }, [state.comments]);

  useEffect(() => {
    storage.set(STORAGE_KEYS.CONSTITUTION_ANSWERS, state.constitutionAnswers);
  }, [state.constitutionAnswers]);

  const addCycleRecord = useCallback((startDate: string) => {
    const newRecord: CycleRecord = {
      id: generateId(),
      startDate,
      endDate: null,
      duration: 0,
      symptoms: [],
      painLevels: [],
      checkIns: [],
      notes: ''
    };
    dispatch({ type: 'ADD_CYCLE_RECORD', payload: newRecord });
    dispatch({
      type: 'SET_USER_PROFILE',
      payload: { lastPeriodStart: startDate }
    });
  }, []);

  const endCurrentCycle = useCallback((endDate: string) => {
    const sortedCycles = [...state.cycleRecords].sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
    const currentCycle = sortedCycles.find(c => !c.endDate);

    if (currentCycle) {
      const start = new Date(currentCycle.startDate);
      const end = new Date(endDate);
      const duration = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;

      dispatch({
        type: 'UPDATE_CYCLE_RECORD',
        payload: { ...currentCycle, endDate, duration }
      });
    }
  }, [state.cycleRecords]);

  const addDiaryEntry = useCallback((entry: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const newEntry: DiaryEntry = {
      ...entry,
      id: generateId(),
      createdAt: now,
      updatedAt: now
    };
    dispatch({ type: 'ADD_DIARY_ENTRY', payload: newEntry });
  }, []);

  const updateDiaryEntry = useCallback((id: string, updates: Partial<DiaryEntry>) => {
    const entry = state.diaryEntries.find(d => d.id === id);
    if (entry) {
      dispatch({
        type: 'UPDATE_DIARY_ENTRY',
        payload: { ...entry, ...updates, updatedAt: new Date().toISOString() }
      });
    }
  }, [state.diaryEntries]);

  const deleteDiaryEntry = useCallback((id: string) => {
    dispatch({ type: 'DELETE_DIARY_ENTRY', payload: id });
  }, []);

  const setDiaryPassword = useCallback((password: string, hint?: string) => {
    dispatch({
      type: 'SET_DIARY_SETTINGS',
      payload: {
        enabled: true,
        passwordHash: hashPassword(password),
        hint
      }
    });
  }, []);

  const verifyDiaryPassword = useCallback((password: string): boolean => {
    if (!state.diarySettings.passwordHash) return true;
    return verifyPassword(password, state.diarySettings.passwordHash);
  }, [state.diarySettings.passwordHash]);

  const toggleCheckIn = useCallback((type: string, date: string) => {
    const existing = state.checkIns.find(c => c.type === type && c.date === date);
    if (existing) {
      dispatch({
        type: 'UPDATE_CHECK_IN',
        payload: { ...existing, completed: !existing.completed }
      });
    } else {
      dispatch({
        type: 'ADD_CHECK_IN',
        payload: {
          id: generateId(),
          type: type as any,
          date,
          completed: true
        }
      });
    }
  }, [state.checkIns]);

  const addPainRecord = useCallback((record: Omit<PainLevelRecord, 'id'>) => {
    dispatch({
      type: 'ADD_PAIN_RECORD',
      payload: { ...record, id: generateId() }
    });
  }, []);

  const addPost = useCallback((post: Omit<Post, 'id' | 'createdAt' | 'likes' | 'isLiked' | 'commentCount'>) => {
    dispatch({
      type: 'ADD_POST',
      payload: {
        ...post,
        id: generateId(),
        createdAt: new Date().toISOString(),
        likes: 0,
        isLiked: false,
        commentCount: 0
      }
    });
  }, []);

  const togglePostLike = useCallback((postId: string) => {
    const post = state.posts.find(p => p.id === postId);
    if (post) {
      dispatch({
        type: 'UPDATE_POST',
        payload: {
          ...post,
          isLiked: !post.isLiked,
          likes: post.isLiked ? post.likes - 1 : post.likes + 1
        }
      });
    }
  }, [state.posts]);

  const addComment = useCallback((comment: Omit<Comment, 'id' | 'createdAt' | 'likes' | 'isLiked' | 'replies'>) => {
    dispatch({
      type: 'ADD_COMMENT',
      payload: {
        ...comment,
        id: generateId(),
        createdAt: new Date().toISOString(),
        likes: 0,
        isLiked: false,
        replies: []
      }
    });

    const post = state.posts.find(p => p.id === comment.postId);
    if (post) {
      dispatch({
        type: 'UPDATE_POST',
        payload: { ...post, commentCount: post.commentCount + 1 }
      });
    }
  }, [state.posts]);

  const setConstitutionAnswer = useCallback((questionId: number, answer: string) => {
    dispatch({
      type: 'SET_CONSTITUTION_ANSWER',
      payload: { questionId, answer }
    });
  }, []);

  const completeConstitutionTest = useCallback((): ConstitutionType | null => {
    const type = calculateConstitution(state.constitutionAnswers);
    if (type !== 'unknown') {
      dispatch({ type: 'COMPLETE_CONSTITUTION_TEST', payload: type });
      return type;
    }
    return null;
  }, [state.constitutionAnswers]);

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        addCycleRecord,
        endCurrentCycle,
        addDiaryEntry,
        updateDiaryEntry,
        deleteDiaryEntry,
        setDiaryPassword,
        verifyDiaryPassword,
        toggleCheckIn,
        addPainRecord,
        addPost,
        togglePostLike,
        addComment,
        setConstitutionAnswer,
        completeConstitutionTest
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
