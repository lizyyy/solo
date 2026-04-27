import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PackingList, PackingItem, Member, GenerateListParams } from '../types';
import { 
  createNewList, 
  saveListsToStorage, 
  loadListsFromStorage, 
  generateShareCode,
  createNewMember,
  generateId 
} from '../utils';
import { 
  getItemsByActivity, 
  adjustItemsByWeather, 
  adjustItemsByDays 
} from '../data/templates';

// 上下文类型定义
interface PackingListContextType {
  lists: PackingList[];
  currentList: PackingList | null;
  currentMember: Member | null;
  
  // 清单操作
  createList: (params: GenerateListParams & { title: string }) => PackingList;
  getListById: (id: string) => PackingList | undefined;
  updateList: (list: PackingList) => void;
  deleteList: (id: string) => void;
  
  // 物品操作
  addItem: (listId: string, item: Omit<Omit<PackingItem, 'id' | 'completed'>, 'completedBy'>) => void;
  updateItem: (listId: string, itemId: string, updates: Partial<PackingItem>) => void;
  deleteItem: (listId: string, itemId: string) => void;
  toggleItem: (listId: string, itemId: string, memberId?: string) => void;
  
  // 成员操作
  addMember: (listId: string, name: string) => void;
  removeMember: (listId: string, memberId: string) => void;
  setCurrentMember: (member: Member | null) => void;
  
  // 分享功能
  generateShareCodeForList: (listId: string) => string;
  joinListByShareCode: (code: string, memberName: string) => PackingList | null;
}

// 创建上下文
const PackingListContext = createContext<PackingListContextType | undefined>(undefined);

// 自定义Hook
export const usePackingList = (): PackingListContextType => {
  const context = useContext(PackingListContext);
  if (!context) {
    throw new Error('usePackingList must be used within a PackingListProvider');
  }
  return context;
};

// Provider组件
interface PackingListProviderProps {
  children: ReactNode;
}

export const PackingListProvider: React.FC<PackingListProviderProps> = ({ children }) => {
  const [lists, setLists] = useState<PackingList[]>([]);
  const [currentList, setCurrentList] = useState<PackingList | null>(null);
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  
  // 从本地存储加载数据
  useEffect(() => {
    const savedLists = loadListsFromStorage();
    setLists(savedLists);
  }, []);
  
  // 保存数据到本地存储
  useEffect(() => {
    if (lists.length > 0) {
      saveListsToStorage(lists);
    }
  }, [lists]);
  
  // 创建新清单
  const createList = (params: GenerateListParams & { title: string }): PackingList => {
    // 根据参数智能生成物品
    let items = getItemsByActivity(params.activity);
    items = adjustItemsByWeather(items, params.weather);
    items = adjustItemsByDays(items, params.days);
    
    const newList = createNewList(
      params.title,
      params.departureLocation,
      params.destination,
      params.days,
      params.weather,
      params.activity,
      items
    );
    
    setLists(prev => [...prev, newList]);
    setCurrentList(newList);
    
    return newList;
  };
  
  // 根据ID获取清单
  const getListById = (id: string): PackingList | undefined => {
    return lists.find(list => list.id === id);
  };
  
  // 更新清单
  const updateList = (updatedList: PackingList): void => {
    setLists(prev => prev.map(list => 
      list.id === updatedList.id 
        ? { ...updatedList, updatedAt: new Date() } 
        : list
    ));
    
    if (currentList && currentList.id === updatedList.id) {
      setCurrentList({ ...updatedList, updatedAt: new Date() });
    }
  };
  
  // 删除清单
  const deleteList = (id: string): void => {
    setLists(prev => prev.filter(list => list.id !== id));
    
    if (currentList && currentList.id === id) {
      setCurrentList(null);
    }
  };
  
  // 添加物品
  const addItem = (listId: string, item: Omit<Omit<PackingItem, 'id' | 'completed'>, 'completedBy'>): void => {
    setLists(prev => prev.map(list => {
      if (list.id === listId) {
        const newItem: PackingItem = {
          ...item,
          id: generateId(), // 使用唯一ID生成
          completed: false,
        };
        
        return {
          ...list,
          items: [...list.items, newItem],
          updatedAt: new Date(),
        };
      }
      return list;
    }));
  };
  
  // 更新物品
  const updateItem = (listId: string, itemId: string, updates: Partial<PackingItem>): void => {
    setLists(prev => prev.map(list => {
      if (list.id === listId) {
        return {
          ...list,
          items: list.items.map(item => 
            item.id === itemId ? { ...item, ...updates } : item
          ),
          updatedAt: new Date(),
        };
      }
      return list;
    }));
  };
  
  // 删除物品
  const deleteItem = (listId: string, itemId: string): void => {
    setLists(prev => prev.map(list => {
      if (list.id === listId) {
        return {
          ...list,
          items: list.items.filter(item => item.id !== itemId),
          updatedAt: new Date(),
        };
      }
      return list;
    }));
  };
  
  // 切换物品完成状态
  const toggleItem = (listId: string, itemId: string, memberId?: string): void => {
    setLists(prev => prev.map(list => {
      if (list.id === listId) {
        return {
          ...list,
          items: list.items.map(item => {
            if (item.id === itemId) {
              // 如果已经完成，则取消完成
              if (item.completed) {
                return {
                  ...item,
                  completed: false,
                  completedBy: undefined,
                };
              }
              // 如果未完成，则标记为完成
              return {
                ...item,
                completed: true,
                completedBy: memberId,
              };
            }
            return item;
          }),
          updatedAt: new Date(),
        };
      }
      return list;
    }));
  };
  
  // 添加成员
  const addMember = (listId: string, name: string): void => {
    const newMember = createNewMember(name);
    
    setLists(prev => prev.map(list => {
      if (list.id === listId) {
        return {
          ...list,
          members: [...list.members, newMember],
          updatedAt: new Date(),
        };
      }
      return list;
    }));
  };
  
  // 移除成员
  const removeMember = (listId: string, memberId: string): void => {
    setLists(prev => prev.map(list => {
      if (list.id === listId) {
        return {
          ...list,
          members: list.members.filter(member => member.id !== memberId),
          updatedAt: new Date(),
        };
      }
      return list;
    }));
  };
  
  // 为清单生成分享码
  const generateShareCodeForList = (listId: string): string => {
    const code = generateShareCode();
    
    setLists(prev => prev.map(list => {
      if (list.id === listId) {
        return {
          ...list,
          shareCode: code,
          updatedAt: new Date(),
        };
      }
      return list;
    }));
    
    return code;
  };
  
  // 通过分享码加入清单
  const joinListByShareCode = (code: string, memberName: string): PackingList | null => {
    const list = lists.find(l => l.shareCode === code);
    
    if (list) {
      // 添加新成员
      const newMember = createNewMember(memberName);
      
      const updatedList = {
        ...list,
        members: [...list.members, newMember],
        updatedAt: new Date(),
      };
      
      setLists(prev => prev.map(l => 
        l.id === list.id ? updatedList : l
      ));
      
      setCurrentList(updatedList);
      setCurrentMember(newMember);
      
      return updatedList;
    }
    
    return null;
  };
  
  const value: PackingListContextType = {
    lists,
    currentList,
    currentMember,
    createList,
    getListById,
    updateList,
    deleteList,
    addItem,
    updateItem,
    deleteItem,
    toggleItem,
    addMember,
    removeMember,
    setCurrentMember,
    generateShareCodeForList,
    joinListByShareCode,
  };
  
  return (
    <PackingListContext.Provider value={value}>
      {children}
    </PackingListContext.Provider>
  );
};
