import { 
  StorageSlot, 
  StoredContainer, 
  ContainerType,
  Recipe
} from '@shared/types';

export interface StoragePlanOptions {
  prioritizeFrozen: boolean;
  considerExpiry: boolean;
}

export function checkStorageAvailability(
  slots: StorageSlot[],
  containerTypeId: string,
  quantity: number = 1
): {
  available: boolean;
  recommendedSlot: StorageSlot | null;
  totalAvailable: number;
} {
  let totalAvailable = 0;
  let recommendedSlot: StorageSlot | null = null;
  let maxAvailable = 0;

  for (const slot of slots) {
    const available = slot.maxCapacity - slot.currentContainers.length;
    totalAvailable += available;
    
    if (available > maxAvailable && available >= quantity) {
      maxAvailable = available;
      recommendedSlot = slot;
    }
  }

  return {
    available: totalAvailable >= quantity,
    recommendedSlot,
    totalAvailable
  };
}

export function findOptimalSlot(
  slots: StorageSlot[],
  storageType: 'refrigerated' | 'frozen',
  options: StoragePlanOptions = { prioritizeFrozen: false, considerExpiry: false }
): StorageSlot | null {
  const suitableSlots = slots.filter(s => s.storageType === storageType);
  
  if (suitableSlots.length === 0) {
    return null;
  }

  const sortedSlots = [...suitableSlots].sort((a, b) => {
    const availableA = a.maxCapacity - a.currentContainers.length;
    const availableB = b.maxCapacity - b.currentContainers.length;
    
    return availableA - availableB;
  });

  return sortedSlots[0];
}

export function addContainerToSlot(
  slots: StorageSlot[],
  slotId: string,
  container: StoredContainer
): {
  success: boolean;
  updatedSlots: StorageSlot[];
  message: string;
} {
  const slotIndex = slots.findIndex(s => s.id === slotId);
  
  if (slotIndex === -1) {
    return {
      success: false,
      updatedSlots: slots,
      message: `未找到格位：${slotId}`
    };
  }

  const slot = slots[slotIndex];
  const currentCount = slot.currentContainers.length;

  if (currentCount >= slot.maxCapacity) {
    return {
      success: false,
      updatedSlots: slots,
      message: `格位「${slot.name}」已满`
    };
  }

  const updatedSlots = [...slots];
  updatedSlots[slotIndex] = {
    ...slot,
    currentContainers: [...slot.currentContainers, { ...container, slotId }]
  };

  return {
    success: true,
    updatedSlots,
    message: `成功添加到格位「${slot.name}」`
  };
}

export function removeContainerFromSlot(
  slots: StorageSlot[],
  containerId: string
): {
  success: boolean;
  updatedSlots: StorageSlot[];
  removedContainer: StoredContainer | null;
} {
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const containerIndex = slot.currentContainers.findIndex(c => c.id === containerId);
    
    if (containerIndex !== -1) {
      const removedContainer = slot.currentContainers[containerIndex];
      const updatedContainers = [...slot.currentContainers];
      updatedContainers.splice(containerIndex, 1);

      const updatedSlots = [...slots];
      updatedSlots[i] = {
        ...slot,
        currentContainers: updatedContainers
      };

      return {
        success: true,
        updatedSlots,
        removedContainer
      };
    }
  }

  return {
    success: false,
    updatedSlots: slots,
    removedContainer: null
  };
}

export function generateStoragePlan(
  recipes: Recipe[],
  selectedRecipes: { recipeId: string; targetServings: number }[],
  slots: StorageSlot[],
  containerTypes: ContainerType[]
): {
  containers: StoredContainer[];
  warnings: string[];
} {
  const containers: StoredContainer[] = [];
  const warnings: string[] = [];
  const today = new Date().toISOString().split('T')[0];

  const totalRefrigeratedCapacity = slots
    .filter(s => s.storageType === 'refrigerated')
    .reduce((sum, s) => sum + s.maxCapacity, 0);
  
  const totalFrozenCapacity = slots
    .filter(s => s.storageType === 'frozen')
    .reduce((sum, s) => sum + s.maxCapacity, 0);

  let refrigeratedNeeded = 0;
  let frozenNeeded = 0;

  for (const selected of selectedRecipes) {
    const recipe = recipes.find(r => r.id === selected.recipeId);
    if (!recipe) continue;

    const storageType = recipe.storageInstructions.storageType;
    const shelfLifeDays = recipe.storageInstructions.shelfLifeDays;
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + shelfLifeDays);

    const containerType = containerTypes[0];
    
    const container: StoredContainer = {
      id: `container-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      containerTypeId: containerType.id,
      recipeId: recipe.id,
      recipeName: recipe.name,
      portionCount: selected.targetServings,
      storedDate: today,
      expiryDate: expiryDate.toISOString().split('T')[0],
      slotId: '',
      notes: `目标份数：${selected.targetServings}份`
    };

    containers.push(container);

    if (storageType === 'refrigerated') {
      refrigeratedNeeded++;
    } else if (storageType === 'frozen') {
      frozenNeeded++;
    }
  }

  if (refrigeratedNeeded > totalRefrigeratedCapacity) {
    warnings.push(`冷藏空间不足：需要 ${refrigeratedNeeded} 个位置，当前可用 ${totalRefrigeratedCapacity} 个`);
  }

  if (frozenNeeded > totalFrozenCapacity) {
    warnings.push(`冷冻空间不足：需要 ${frozenNeeded} 个位置，当前可用 ${totalFrozenCapacity} 个`);
  }

  return { containers, warnings };
}

export function getStorageSummary(slots: StorageSlot[]): {
  totalCapacity: number;
  usedCapacity: number;
  availableCapacity: number;
  byType: {
    refrigerated: { total: number; used: number; available: number };
    frozen: { total: number; used: number; available: number };
  };
} {
  let totalCapacity = 0;
  let usedCapacity = 0;
  
  const byType = {
    refrigerated: { total: 0, used: 0, available: 0 },
    frozen: { total: 0, used: 0, available: 0 }
  };

  for (const slot of slots) {
    const used = slot.currentContainers.length;
    const total = slot.maxCapacity;
    const available = total - used;

    totalCapacity += total;
    usedCapacity += used;

    if (slot.storageType === 'refrigerated') {
      byType.refrigerated.total += total;
      byType.refrigerated.used += used;
      byType.refrigerated.available += available;
    } else if (slot.storageType === 'frozen') {
      byType.frozen.total += total;
      byType.frozen.used += used;
      byType.frozen.available += available;
    }
  }

  return {
    totalCapacity,
    usedCapacity,
    availableCapacity: totalCapacity - usedCapacity,
    byType
  };
}

export function getExpiringContainers(
  containers: StoredContainer[],
  daysThreshold: number = 3
): StoredContainer[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return containers.filter(container => {
    const expiryDate = new Date(container.expiryDate);
    expiryDate.setHours(0, 0, 0, 0);
    
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysUntilExpiry <= daysThreshold;
  }).sort((a, b) => {
    return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
  });
}
