import { v4 as uuidv4 } from 'uuid';
import { Resources, ResourcesDelta, InventoryItem, GameState } from '../types';

export const generateId = (): string => uuidv4();

export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

export const applyResourceDelta = (
  current: Resources,
  delta: ResourcesDelta,
  max: Resources
): Resources => {
  return {
    food: clamp(current.food + (delta.food || 0), 0, max.food),
    water: clamp(current.water + (delta.water || 0), 0, max.water),
    energy: clamp(current.energy + (delta.energy || 0), 0, max.energy),
    spirit: clamp(current.spirit + (delta.spirit || 0), 0, max.spirit),
    toolDurability: clamp(
      current.toolDurability + (delta.toolDurability || 0),
      0,
      max.toolDurability
    ),
    safety: clamp(current.safety + (delta.safety || 0), 0, max.safety),
  };
};

export const addToInventory = (
  inventory: InventoryItem[],
  item: { itemId: string; quantity: number }
): InventoryItem[] => {
  const existing = inventory.find((i) => i.id === item.itemId);
  if (existing) {
    return inventory.map((i) =>
      i.id === item.itemId ? { ...i, quantity: i.quantity + item.quantity } : i
    );
  }
  const newItem: InventoryItem = {
    id: item.itemId,
    name: getItemName(item.itemId),
    description: getItemDescription(item.itemId),
    quantity: item.quantity,
    type: getItemType(item.itemId),
  };
  return [...inventory, newItem];
};

export const removeFromInventory = (
  inventory: InventoryItem[],
  item: { itemId: string; quantity: number }
): InventoryItem[] => {
  return inventory
    .map((i) => {
      if (i.id === item.itemId) {
        return { ...i, quantity: i.quantity - item.quantity };
      }
      return i;
    })
    .filter((i) => i.quantity > 0);
};

export const hasInventoryItem = (
  inventory: InventoryItem[],
  itemId: string,
  quantity: number
): boolean => {
  const item = inventory.find((i) => i.id === itemId);
  return item ? item.quantity >= quantity : false;
};

const ITEM_NAMES: Record<string, string> = {
  wood: '木材',
  tinder: '引火物',
  metal: '金属片',
  rope: '绳索',
  seeds: '种子',
  fishing_rod: '钓鱼竿',
  water_bottle: '水壶',
  medicine: '草药',
  cloth: '布料',
};

const ITEM_DESCRIPTIONS: Record<string, string> = {
  wood: '用于建造和生火的木材',
  tinder: '容易燃烧的材料，用于生火',
  metal: '从沉船残骸中找到的金属片',
  rope: '结实的绳索，用途广泛',
  seeds: '可以种植的作物种子',
  fishing_rod: '用木材和绳索制作的钓鱼竿',
  water_bottle: '装水用的容器',
  medicine: '从森林中采集的草药',
  cloth: '从沉船中找到的布料',
};

const ITEM_TYPES: Record<string, 'material' | 'tool' | 'food' | 'medicine' | 'special'> = {
  wood: 'material',
  tinder: 'material',
  metal: 'material',
  rope: 'material',
  seeds: 'material',
  fishing_rod: 'tool',
  water_bottle: 'tool',
  medicine: 'medicine',
  cloth: 'material',
};

const getItemName = (id: string): string => ITEM_NAMES[id] || id;
const getItemDescription = (id: string): string => ITEM_DESCRIPTIONS[id] || '未知物品';
const getItemType = (id: string): 'material' | 'tool' | 'food' | 'medicine' | 'special' =>
  ITEM_TYPES[id] || 'material';

export const getInitialInventory = (): InventoryItem[] => [
  {
    id: 'wood',
    name: '木材',
    description: '用于建造和生火的木材',
    quantity: 10,
    type: 'material',
  },
  {
    id: 'tinder',
    name: '引火物',
    description: '容易燃烧的材料，用于生火',
    quantity: 3,
    type: 'material',
  },
  {
    id: 'rope',
    name: '绳索',
    description: '结实的绳索',
    quantity: 2,
    type: 'material',
  },
];

export const checkGameOver = (state: GameState): { gameOver: boolean; reason?: string } => {
  if (state.rescueSuccess) {
    return { gameOver: true, reason: '你成功获救了！' };
  }
  
  if (state.resources.food <= 0 && state.resources.energy <= 0) {
    return { gameOver: true, reason: '你因饥饿和体力耗尽而死亡。' };
  }
  
  if (state.resources.water <= 0 && state.resources.energy <= 0) {
    return { gameOver: true, reason: '你因缺水和体力耗尽而死亡。' };
  }
  
  if (state.resources.spirit <= 0) {
    return { gameOver: true, reason: '你的精神彻底崩溃了，无法继续在岛上生存。' };
  }
  
  if (state.resources.safety <= -20) {
    return { gameOver: true, reason: '你遭遇了致命的危险，无法幸存。' };
  }
  
  if (state.currentDay >= 100) {
    return { gameOver: true, reason: '你在岛上生活了100天，但最终还是没能等到救援。' };
  }
  
  return { gameOver: false };
};

export const formatDate = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const resourceDeltaToString = (delta: ResourcesDelta): string => {
  const parts: string[] = [];
  if (delta.food) parts.push(`食物${delta.food > 0 ? '+' : ''}${delta.food}`);
  if (delta.water) parts.push(`水${delta.water > 0 ? '+' : ''}${delta.water}`);
  if (delta.energy) parts.push(`体力${delta.energy > 0 ? '+' : ''}${delta.energy}`);
  if (delta.spirit) parts.push(`精神${delta.spirit > 0 ? '+' : ''}${delta.spirit}`);
  if (delta.toolDurability) parts.push(`工具耐久${delta.toolDurability > 0 ? '+' : ''}${delta.toolDurability}`);
  if (delta.safety) parts.push(`安全值${delta.safety > 0 ? '+' : ''}${delta.safety}`);
  return parts.join(', ');
};
