import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { Item, Message, UserCreation, CategoryType, Reply } from '../types';
import { initialItems } from '../data/items';

interface AppState {
  items: Item[];
  userCreations: UserCreation[];
  dailyItem: Item | null;
  todayDate: string;
  hasDrawnToday: boolean;
  lotteryResult: Item | null;
  isLotterySpinning: boolean;
  likedMessages: Set<string>;
}

interface AppContextType extends AppState {
  getItemById: (id: string) => Item | undefined;
  getItemsByCategory: (category: CategoryType) => Item[];
  toggleFavorite: (itemId: string) => void;
  addMessage: (itemId: string, content: string, author: string) => void;
  likeMessage: (itemId: string, messageId: string) => void;
  hasLikedMessage: (messageId: string) => boolean;
  replyMessage: (itemId: string, messageId: string, content: string, author: string) => void;
  addCreation: (creation: Omit<UserCreation, 'id' | 'timestamp'>) => void;
  getDailyItem: () => Item;
  drawLottery: () => void;
  resetLottery: () => void;
  getDefects: () => { itemName: string; itemId: string; defects: Item['defects'] }[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const generateDailyItem = (items: Item[]): Item => {
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const index = seed % items.length;
  return items[index];
};

const getTodayString = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [userCreations, setUserCreations] = useState<UserCreation[]>(() => {
    try {
      const saved = localStorage.getItem('little-factory-creations');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [todayDate] = useState<string>(getTodayString());
  const [dailyItem] = useState<Item>(() => generateDailyItem(initialItems));
  const [hasDrawnToday, setHasDrawnToday] = useState(false);
  const [lotteryResult, setLotteryResult] = useState<Item | null>(null);
  const [isLotterySpinning, setIsLotterySpinning] = useState(false);
  const [likedMessages, setLikedMessages] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('little-factory-likes');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('little-factory-likes', JSON.stringify([...likedMessages]));
    } catch {
      // ignore
    }
  }, [likedMessages]);

  useEffect(() => {
    try {
      localStorage.setItem('little-factory-creations', JSON.stringify(userCreations));
    } catch {
      // ignore
    }
  }, [userCreations]);

  const getItemById = useCallback((id: string) => {
    return items.find(item => item.id === id);
  }, [items]);

  const getItemsByCategory = useCallback((category: CategoryType) => {
    return items.filter(item => item.category === category);
  }, [items]);

  const toggleFavorite = useCallback((itemId: string) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, favorite: !item.favorite } : item
    ));
  }, []);

  const addMessage = useCallback((itemId: string, content: string, author: string) => {
    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      itemId,
      itemName: items.find(i => i.id === itemId)?.name || '',
      content,
      author: author || '匿名用户',
      timestamp: Date.now(),
      likes: 0
    };
    setItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, messages: [newMessage, ...item.messages] }
        : item
    ));
  }, [items]);

  const hasLikedMessage = useCallback((messageId: string) => {
    return likedMessages.has(messageId);
  }, [likedMessages]);

  const likeMessage = useCallback((itemId: string, messageId: string) => {
    if (likedMessages.has(messageId)) {
      return;
    }
    
    setLikedMessages(prev => new Set([...prev, messageId]));
    
    setItems(prev => prev.map(item => 
      item.id === itemId 
        ? { 
            ...item, 
            messages: item.messages.map(msg => 
              msg.id === messageId ? { ...msg, likes: msg.likes + 1 } : msg
            )
          }
        : item
    ));
  }, [likedMessages]);

  const replyMessage = useCallback((itemId: string, messageId: string, content: string, author: string) => {
    const newReply: Reply = {
      id: `reply-${Date.now()}`,
      content,
      author: author || '匿名用户',
      timestamp: Date.now(),
    };
    setItems(prev => prev.map(item => 
      item.id === itemId 
        ? { 
            ...item, 
            messages: item.messages.map(msg => 
              msg.id === messageId 
                ? { ...msg, replies: [...(msg.replies || []), newReply] }
                : msg
            )
          }
        : item
    ));
  }, []);

  const addCreation = useCallback((creation: Omit<UserCreation, 'id' | 'timestamp'>) => {
    const newCreation: UserCreation = {
      ...creation,
      id: `creation-${Date.now()}`,
      timestamp: Date.now()
    };
    setUserCreations(prev => [newCreation, ...prev]);
    
    setItems(prev => prev.map(item => 
      item.id === creation.itemId ? { ...item, created: true } : item
    ));
  }, []);

  const getDailyItem = useCallback(() => {
    return dailyItem;
  }, [dailyItem]);

  const drawLottery = useCallback(() => {
    if (hasDrawnToday) return;
    
    setIsLotterySpinning(true);
    
    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * items.length);
      setLotteryResult(items[randomIndex]);
      setHasDrawnToday(true);
      setIsLotterySpinning(false);
    }, 2000);
  }, [hasDrawnToday, items]);

  const resetLottery = useCallback(() => {
    setLotteryResult(null);
  }, []);

  const getDefects = useCallback(() => {
    return items
      .filter(item => item.defects.length > 0)
      .map(item => ({
        itemName: item.name,
        itemId: item.id,
        defects: item.defects
      }));
  }, [items]);

  const value: AppContextType = {
    items,
    userCreations,
    dailyItem,
    todayDate,
    hasDrawnToday,
    lotteryResult,
    isLotterySpinning,
    likedMessages,
    getItemById,
    getItemsByCategory,
    toggleFavorite,
    addMessage,
    likeMessage,
    hasLikedMessage,
    replyMessage,
    addCreation,
    getDailyItem,
    drawLottery,
    resetLottery,
    getDefects
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};