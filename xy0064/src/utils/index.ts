import { v4 as uuidv4 } from 'uuid';
import { PackingList, PackingItem, Member } from '../types';

// 生成唯一ID
export const generateId = (): string => {
  return uuidv4();
};

// 生成6位分享码
export const generateShareCode = (): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
};

// 生成随机颜色（用于成员标签）
export const generateRandomColor = (): string => {
  const colors = [
    '#3498db', // 蓝色
    '#27ae60', // 绿色
    '#f39c12', // 橙色
    '#e74c3c', // 红色
    '#9b59b6', // 紫色
    '#1abc9c', // 青色
    '#f1c40f', // 黄色
    '#e67e22', // 深橙色
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// 创建新的行李清单
export const createNewList = (
  title: string,
  departureLocation: string,
  destination: string,
  days: number,
  weather: string,
  activity: string,
  items: Omit<Omit<PackingItem, 'id' | 'completed' | 'completedBy'>, 'notes'>[]
): PackingList => {
  const now = new Date();
  
  // 为每个物品生成ID和默认状态
  const packingItems: PackingItem[] = items.map(item => ({
    ...item,
    id: generateId(),
    completed: false,
  }));
  
  return {
    id: generateId(),
    title,
    departureLocation,
    destination,
    days,
    weather: weather as any,
    activity: activity as any,
    items: packingItems,
    members: [],
    createdAt: now,
    updatedAt: now,
  };
};

// 创建新成员
export const createNewMember = (name: string): Member => {
  return {
    id: generateId(),
    name,
    color: generateRandomColor(),
  };
};

// 生成文字清单（用于分享）
export const generateTextList = (list: PackingList): string => {
  let text = `【${list.title}】\n`;
  text += `📍 出发地：${list.departureLocation}\n`;
  text += `✈️ 目的地：${list.destination}\n`;
  text += `📅 天数：${list.days}天\n`;
  text += `🌤️ 天气：${list.weather}\n`;
  text += `🎯 活动：${list.activity}\n\n`;
  
  // 按分类分组
  const itemsByCategory: Record<string, PackingItem[]> = {};
  list.items.forEach(item => {
    if (!itemsByCategory[item.category]) {
      itemsByCategory[item.category] = [];
    }
    itemsByCategory[item.category].push(item);
  });
  
  // 统计完成情况
  const completedItems = list.items.filter(item => item.completed).length;
  const totalItems = list.items.length;
  text += `📊 进度：${completedItems}/${totalItems} 已完成\n\n`;
  
  // 未完成的物品
  const uncompletedItems = list.items.filter(item => !item.completed);
  if (uncompletedItems.length > 0) {
    text += `⚠️ 未完成物品：\n`;
    uncompletedItems.forEach((item, index) => {
      text += `${index + 1}. ${item.name} (${item.quantity}件)\n`;
    });
    text += `\n`;
  }
  
  // 所有物品
  text += `📝 完整清单：\n`;
  Object.entries(itemsByCategory).forEach(([category, items]) => {
    text += `\n【${category}】\n`;
    items.forEach(item => {
      const status = item.completed ? '✅' : '⬜';
      text += `${status} ${item.name} (${item.quantity}件)\n`;
    });
  });
  
  // 添加分享码
  if (list.shareCode) {
    text += `\n🔗 分享码：${list.shareCode}\n`;
  }
  
  text += `\n—— 来自旅行行李清单应用`;
  
  return text;
};

// 复制到剪贴板
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
};

// 格式化日期
export const formatDate = (date: Date): string => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}`;
};

// 计算完成进度
export const calculateProgress = (items: PackingItem[]): number => {
  if (items.length === 0) return 0;
  const completed = items.filter(item => item.completed).length;
  return Math.round((completed / items.length) * 100);
};

// 按分类分组物品
export const groupItemsByCategory = (items: PackingItem[]): Record<string, PackingItem[]> => {
  const groups: Record<string, PackingItem[]> = {};
  
  items.forEach(item => {
    if (!groups[item.category]) {
      groups[item.category] = [];
    }
    groups[item.category].push(item);
  });
  
  return groups;
};

// 本地存储操作
const STORAGE_KEY = 'packing_lists';

export const saveListsToStorage = (lists: PackingList[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
};

export const loadListsFromStorage = (): PackingList[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data).map((list: any) => ({
        ...list,
        createdAt: new Date(list.createdAt),
        updatedAt: new Date(list.updatedAt),
      }));
    }
  } catch (err) {
    console.error('Failed to load from localStorage:', err);
  }
  return [];
};
