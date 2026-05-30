
import { InventoryItem, Mineral } from '../types';
import { GAME_CONFIG } from '../data/config';

export function addToInventory(
  inventory: InventoryItem[],
  mineral: Mineral,
  quantity: number,
  targetSlot: number | null = null
): {
  newInventory: InventoryItem[];
  isMixed: boolean;
  actualAdded: number;
  currentTotal: number;
} {
  const actualQuantity = Math.min(quantity, GAME_CONFIG.INVENTORY_CAPACITY);
  let isMixed = false;

  const existingIndex = inventory.findIndex(
    (item) => item.mineralId === mineral.id && !item.isMixed
  );

  let newInventory: InventoryItem[];

  if (targetSlot !== null && targetSlot >= 0 && targetSlot < inventory.length) {
    const targetItem = inventory[targetSlot];
    if (targetItem.mineralId !== mineral.id) {
      isMixed = true;
      newInventory = inventory.map((item, index) => {
        if (index === targetSlot) {
          return {
            ...item,
            quantity: item.quantity + actualQuantity,
            isMixed: true
          };
        }
        return item;
      });
    } else {
      newInventory = inventory.map((item, index) => {
        if (index === targetSlot) {
          return {
            ...item,
            quantity: item.quantity + actualQuantity
          };
        }
        return item;
      });
    }
  } else if (existingIndex !== -1) {
    newInventory = inventory.map((item, index) => {
      if (index === existingIndex) {
        return {
          ...item,
          quantity: item.quantity + actualQuantity
        };
      }
      return item;
    });
  } else {
    newInventory = [
      ...inventory,
      {
        mineralId: mineral.id,
        mineralName: mineral.nameCn,
        quantity: actualQuantity,
        isMixed: false,
        unitValue: mineral.value
      }
    ];
  }

  const currentTotal = newInventory.reduce((sum, item) => {
    const spaceMultiplier = item.isMixed ? 2 : 1;
    return sum + item.quantity * spaceMultiplier;
  }, 0);

  return {
    newInventory,
    isMixed,
    actualAdded: actualQuantity,
    currentTotal
  };
}

export function calculateInventoryValue(inventory: InventoryItem[]): number {
  return inventory.reduce((total, item) => {
    const valueMultiplier = item.isMixed ? GAME_CONFIG.MIXED_INVENTORY_FACTOR : 1;
    return total + item.quantity * item.unitValue * valueMultiplier;
  }, 0);
}

export function calculateInventorySpace(inventory: InventoryItem[]): number {
  return inventory.reduce((sum, item) => {
    const spaceMultiplier = item.isMixed ? 2 : 1;
    return sum + item.quantity * spaceMultiplier;
  }, 0);
}

export function canAddToInventory(
  inventory: InventoryItem[],
  quantity: number
): boolean {
  const currentSpace = calculateInventorySpace(inventory);
  return currentSpace + quantity <= GAME_CONFIG.INVENTORY_CAPACITY;
}
