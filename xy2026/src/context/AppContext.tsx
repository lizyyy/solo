import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { 
  AppState, 
  EmotionCheckin, 
  DiaryEntry, 
  UserArtwork, 
  TestResult, 
  CommunityPost,
  Music,
  Playlist
} from '../types';
import { mockUser } from '../data/mockData';

// 初始状态
const initialState: AppState = {
  user: mockUser,
  currentMusic: null,
  isPlaying: false,
  currentVolume: 0.8,
  checkins: [],
  diaries: [],
  userArtworks: [],
  testResults: [],
  communityPosts: [],
  favoriteMusicIds: [],
  favoritePlaylistIds: [],
  darkMode: false,
  likedPostIds: []
};

// Action 类型
type Action =
  | { type: 'SET_CURRENT_MUSIC'; payload: Music | null }
  | { type: 'TOGGLE_PLAYING' }
  | { type: 'SET_VOLUME'; payload: number }
  | { type: 'ADD_CHECKIN'; payload: EmotionCheckin }
  | { type: 'ADD_DIARY'; payload: DiaryEntry }
  | { type: 'UPDATE_DIARY'; payload: DiaryEntry }
  | { type: 'DELETE_DIARY'; payload: string }
  | { type: 'ADD_ARTWORK'; payload: UserArtwork }
  | { type: 'DELETE_ARTWORK'; payload: string }
  | { type: 'TOGGLE_ARTWORK_PRIVACY'; payload: string }
  | { type: 'ADD_TEST_RESULT'; payload: TestResult }
  | { type: 'ADD_COMMUNITY_POST'; payload: CommunityPost }
  | { type: 'LIKE_POST'; payload: string }
  | { type: 'TOGGLE_LIKE_POST'; payload: string }
  | { type: 'ADD_COMMENT'; payload: { postId: string; comment: CommunityPost['comments'][0] } }
  | { type: 'TOGGLE_MUSIC_FAVORITE'; payload: string }
  | { type: 'TOGGLE_PLAYLIST_FAVORITE'; payload: string }
  | { type: 'TOGGLE_DARK_MODE' }
  | { type: 'LOAD_STATE'; payload: Partial<AppState> };

// Reducer
function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_CURRENT_MUSIC':
      return { ...state, currentMusic: action.payload };
    case 'TOGGLE_PLAYING':
      return { ...state, isPlaying: !state.isPlaying };
    case 'SET_VOLUME':
      return { ...state, currentVolume: action.payload };
    case 'ADD_CHECKIN':
      return { ...state, checkins: [...state.checkins, action.payload] };
    case 'ADD_DIARY':
      return { ...state, diaries: [...state.diaries, action.payload] };
    case 'UPDATE_DIARY':
      return {
        ...state,
        diaries: state.diaries.map(d => 
          d.id === action.payload.id ? action.payload : d
        )
      };
    case 'DELETE_DIARY':
      return {
        ...state,
        diaries: state.diaries.filter(d => d.id !== action.payload)
      };
    case 'ADD_ARTWORK':
      return { ...state, userArtworks: [...state.userArtworks, action.payload] };
    case 'DELETE_ARTWORK':
      return {
        ...state,
        userArtworks: state.userArtworks.filter(a => a.id !== action.payload)
      };
    case 'TOGGLE_ARTWORK_PRIVACY':
      return {
        ...state,
        userArtworks: state.userArtworks.map(a =>
          a.id === action.payload ? { ...a, isPrivate: !a.isPrivate } : a
        )
      };
    case 'ADD_TEST_RESULT':
      return { ...state, testResults: [...state.testResults, action.payload] };
    case 'ADD_COMMUNITY_POST':
      return { ...state, communityPosts: [action.payload, ...state.communityPosts] };
    case 'LIKE_POST':
      return {
        ...state,
        communityPosts: state.communityPosts.map(p =>
          p.id === action.payload ? { ...p, likes: p.likes + 1 } : p
        ),
        likedPostIds: state.likedPostIds.includes(action.payload)
          ? state.likedPostIds
          : [...state.likedPostIds, action.payload]
      };
    case 'TOGGLE_LIKE_POST':
      {
        const isLiked = state.likedPostIds.includes(action.payload);
        return {
          ...state,
          communityPosts: state.communityPosts.map(p =>
            p.id === action.payload 
              ? { ...p, likes: isLiked ? p.likes - 1 : p.likes + 1 } 
              : p
          ),
          likedPostIds: isLiked
            ? state.likedPostIds.filter(id => id !== action.payload)
            : [...state.likedPostIds, action.payload]
        };
      }
    case 'ADD_COMMENT':
      return {
        ...state,
        communityPosts: state.communityPosts.map(p =>
          p.id === action.payload.postId
            ? { ...p, comments: [...p.comments, action.payload.comment] }
            : p
        )
      };
    case 'TOGGLE_MUSIC_FAVORITE':
      return {
        ...state,
        favoriteMusicIds: state.favoriteMusicIds.includes(action.payload)
          ? state.favoriteMusicIds.filter(id => id !== action.payload)
          : [...state.favoriteMusicIds, action.payload]
      };
    case 'TOGGLE_PLAYLIST_FAVORITE':
      return {
        ...state,
        favoritePlaylistIds: state.favoritePlaylistIds.includes(action.payload)
          ? state.favoritePlaylistIds.filter(id => id !== action.payload)
          : [...state.favoritePlaylistIds, action.payload]
      };
    case 'TOGGLE_DARK_MODE':
      return {
        ...state,
        darkMode: !state.darkMode
      };
    case 'LOAD_STATE':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  // 辅助方法
  addCheckin: (checkin: Omit<EmotionCheckin, 'id' | 'timestamp'>) => void;
  addDiary: (diary: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateDiary: (diary: DiaryEntry) => void;
  deleteDiary: (id: string) => void;
  addArtwork: (artwork: Omit<UserArtwork, 'id' | 'createdAt'>) => void;
  deleteArtwork: (id: string) => void;
  toggleArtworkPrivacy: (id: string) => void;
  addTestResult: (result: Omit<TestResult, 'id' | 'timestamp'>) => void;
  addCommunityPost: (post: Omit<CommunityPost, 'id' | 'createdAt' | 'likes' | 'comments'>) => void;
  likePost: (id: string) => void;
  toggleLikePost: (id: string) => void;
  addComment: (postId: string, comment: Omit<CommunityPost['comments'][0], 'id' | 'createdAt'>) => void;
  toggleMusicFavorite: (id: string) => void;
  togglePlaylistFavorite: (id: string) => void;
  toggleDarkMode: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider 组件
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // 从 localStorage 加载状态
  useEffect(() => {
    const savedState = localStorage.getItem('artTherapyState');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        dispatch({ type: 'LOAD_STATE', payload: parsed });
      } catch (e) {
        console.error('Failed to load state:', e);
      }
    }
  }, []);

  // 保存状态到 localStorage
  useEffect(() => {
    const { user, ...stateToSave } = state;
    localStorage.setItem('artTherapyState', JSON.stringify(stateToSave));
  }, [state]);

  // 应用深色模式
  useEffect(() => {
    if (state.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.darkMode]);

  // 辅助方法
  const addCheckin = (checkin: Omit<EmotionCheckin, 'id' | 'timestamp'>) => {
    dispatch({
      type: 'ADD_CHECKIN',
      payload: {
        ...checkin,
        id: `checkin-${Date.now()}`,
        timestamp: Date.now()
      }
    });
  };

  const addDiary = (diary: Omit<DiaryEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    dispatch({
      type: 'ADD_DIARY',
      payload: {
        ...diary,
        id: `diary-${now}`,
        createdAt: now,
        updatedAt: now
      }
    });
  };

  const updateDiary = (diary: DiaryEntry) => {
    dispatch({
      type: 'UPDATE_DIARY',
      payload: { ...diary, updatedAt: Date.now() }
    });
  };

  const deleteDiary = (id: string) => {
    dispatch({ type: 'DELETE_DIARY', payload: id });
  };

  const addArtwork = (artwork: Omit<UserArtwork, 'id' | 'createdAt'>) => {
    dispatch({
      type: 'ADD_ARTWORK',
      payload: {
        ...artwork,
        id: `artwork-${Date.now()}`,
        createdAt: Date.now()
      }
    });
  };

  const deleteArtwork = (id: string) => {
    dispatch({ type: 'DELETE_ARTWORK', payload: id });
  };

  const toggleArtworkPrivacy = (id: string) => {
    dispatch({ type: 'TOGGLE_ARTWORK_PRIVACY', payload: id });
  };

  const addTestResult = (result: Omit<TestResult, 'id' | 'timestamp'>) => {
    dispatch({
      type: 'ADD_TEST_RESULT',
      payload: {
        ...result,
        id: `result-${Date.now()}`,
        timestamp: Date.now()
      }
    });
  };

  const addCommunityPost = (post: Omit<CommunityPost, 'id' | 'createdAt' | 'likes' | 'comments'>) => {
    dispatch({
      type: 'ADD_COMMUNITY_POST',
      payload: {
        ...post,
        id: `post-${Date.now()}`,
        createdAt: Date.now(),
        likes: 0,
        comments: []
      }
    });
  };

  const likePost = (id: string) => {
    dispatch({ type: 'LIKE_POST', payload: id });
  };

  const toggleLikePost = (id: string) => {
    dispatch({ type: 'TOGGLE_LIKE_POST', payload: id });
  };

  const addComment = (postId: string, comment: Omit<CommunityPost['comments'][0], 'id' | 'createdAt'>) => {
    dispatch({
      type: 'ADD_COMMENT',
      payload: {
        postId,
        comment: {
          ...comment,
          id: `comment-${Date.now()}`,
          createdAt: Date.now()
        }
      }
    });
  };

  const toggleMusicFavorite = (id: string) => {
    dispatch({ type: 'TOGGLE_MUSIC_FAVORITE', payload: id });
  };

  const togglePlaylistFavorite = (id: string) => {
    dispatch({ type: 'TOGGLE_PLAYLIST_FAVORITE', payload: id });
  };

  const toggleDarkMode = () => {
    dispatch({ type: 'TOGGLE_DARK_MODE' });
  };

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        addCheckin,
        addDiary,
        updateDiary,
        deleteDiary,
        addArtwork,
        deleteArtwork,
        toggleArtworkPrivacy,
        addTestResult,
        addCommunityPost,
        likePost,
        toggleLikePost,
        addComment,
        toggleMusicFavorite,
        togglePlaylistFavorite,
        toggleDarkMode
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// Hook
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
