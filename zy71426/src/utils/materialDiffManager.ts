import type { MaterialUpdate, UpdatedItem, ChangeType, EvidenceType } from '../types';

export const detectChanges = (
  oldItem: any,
  newItem: any,
  type: EvidenceType
): { hasChanges: boolean; diffContent: string; changeType: ChangeType } => {
  if (!oldItem) {
    return {
      hasChanges: true,
      diffContent: `新增${getTypeLabel(type)}: ${newItem.description || newItem.content || newItem.mainInfo || ''}`,
      changeType: 'new'
    };
  }

  if (JSON.stringify(oldItem) === JSON.stringify(newItem)) {
    return {
      hasChanges: false,
      diffContent: `重复提交${getTypeLabel(type)}，内容与之前完全一致`,
      changeType: 'duplicate'
    };
  }

  const diffs: string[] = [];
  
  if (type === 'photo') {
    if (oldItem.description !== newItem.description) {
      diffs.push(`描述变更: "${oldItem.description}" → "${newItem.description}"`);
    }
    if (oldItem.shootingTime !== newItem.shootingTime) {
      diffs.push(`拍摄时间变更: ${oldItem.shootingTime} → ${newItem.shootingTime}`);
    }
    if (oldItem.isNewDamage !== newItem.isNewDamage) {
      diffs.push(`损伤性质变更: ${oldItem.isNewDamage === null ? '未判定' : oldItem.isNewDamage ? '新损' : '旧损'} → ${newItem.isNewDamage === null ? '未判定' : newItem.isNewDamage ? '新损' : '旧损'}`);
    }
  } else if (type === 'clause') {
    if (oldItem.content !== newItem.content) {
      diffs.push(`条款内容变更`);
    }
    if (oldItem.isExemption !== newItem.isExemption) {
      diffs.push(`条款性质变更: ${oldItem.isExemption ? '免责条款' : '保障条款'} → ${newItem.isExemption ? '免责条款' : '保障条款'}`);
    }
  } else if (type === 'accident') {
    if (oldItem.mainInfo !== newItem.mainInfo) {
      diffs.push(`主信息变更`);
    }
    if (oldItem.description !== newItem.description) {
      diffs.push(`描述变更`);
    }
    if (oldItem.claimAmount !== newItem.claimAmount) {
      diffs.push(`索赔金额变更: ${oldItem.claimAmount} → ${newItem.claimAmount}`);
    }
  }

  return {
    hasChanges: true,
    diffContent: diffs.join('；') || '内容有变更',
    changeType: 'modified'
  };
};

export const getTypeLabel = (type: EvidenceType): string => {
  const labels: Record<EvidenceType, string> = {
    'accident': '事故卡',
    'clause': '保单条款',
    'photo': '照片证据'
  };
  return labels[type] || type;
};

export const getChangeTypeLabel = (changeType: ChangeType): string => {
  const labels: Record<ChangeType, string> = {
    'new': '新增',
    'modified': '修改',
    'duplicate': '重复'
  };
  return labels[changeType] || changeType;
};

export const getChangeTypeColor = (changeType: ChangeType): string => {
  const colors: Record<ChangeType, string> = {
    'new': 'text-emerald-500',
    'modified': 'text-amber-500',
    'duplicate': 'text-gray-500'
  };
  return colors[changeType] || 'text-gray-500';
};

export const getChangeTypeBgColor = (changeType: ChangeType): string => {
  const colors: Record<ChangeType, string> = {
    'new': 'bg-emerald-500/20 border-emerald-500/30',
    'modified': 'bg-amber-500/20 border-amber-500/30',
    'duplicate': 'bg-gray-500/20 border-gray-500/30'
  };
  return colors[changeType] || 'bg-gray-500/20 border-gray-500/30';
};

export const highlightDifferences = (
  oldText: string,
  newText: string
): { oldHtml: string; newHtml: string } => {
  const oldWords = oldText.split('');
  const newWords = newText.split('');
  
  const oldResult: string[] = [];
  const newResult: string[] = [];
  
  let i = 0, j = 0;
  
  while (i < oldWords.length || j < newWords.length) {
    if (i < oldWords.length && j < newWords.length && oldWords[i] === newWords[j]) {
      oldResult.push(oldWords[i]);
      newResult.push(newWords[j]);
      i++;
      j++;
    } else {
      let foundMatch = false;
      
      for (let k = j + 1; k < Math.min(j + 5, newWords.length); k++) {
        if (i < oldWords.length && oldWords[i] === newWords[k]) {
          while (j < k) {
            newResult.push(`<span class="bg-emerald-500/30 text-emerald-400">${newWords[j]}</span>`);
            j++;
          }
          foundMatch = true;
          break;
        }
      }
      
      if (!foundMatch) {
        for (let k = i + 1; k < Math.min(i + 5, oldWords.length); k++) {
          if (j < newWords.length && oldWords[k] === newWords[j]) {
            while (i < k) {
              oldResult.push(`<span class="bg-red-500/30 text-red-400 line-through">${oldWords[i]}</span>`);
              i++;
            }
            foundMatch = true;
            break;
          }
        }
      }
      
      if (!foundMatch) {
        if (i < oldWords.length) {
          oldResult.push(`<span class="bg-red-500/30 text-red-400 line-through">${oldWords[i]}</span>`);
          i++;
        }
        if (j < newWords.length) {
          newResult.push(`<span class="bg-emerald-500/30 text-emerald-400">${newWords[j]}</span>`);
          j++;
        }
      }
    }
  }
  
  return {
    oldHtml: oldResult.join(''),
    newHtml: newResult.join('')
  };
};

export const createUpdatedItem = (
  type: EvidenceType,
  itemId: string,
  oldItem: any,
  newItem: any
): UpdatedItem => {
  const { diffContent, changeType } = detectChanges(oldItem, newItem, type);
  
  return {
    type,
    itemId,
    changeType,
    diffContent
  };
};

export const applyMaterialUpdate = <T extends { id: string }>(
  existingItems: T[],
  updateItems: T[],
  type: EvidenceType
): { updatedList: T[]; changes: UpdatedItem[] } => {
  const changes: UpdatedItem[] = [];
  const existingMap = new Map(existingItems.map(item => [item.id, item]));
  const updatedList: T[] = [...existingItems];
  
  updateItems.forEach(newItem => {
    const oldItem = existingMap.get(newItem.id);
    const change = createUpdatedItem(type, newItem.id, oldItem, newItem);
    changes.push(change);
    
    if (change.changeType === 'new' || change.changeType === 'modified') {
      const index = updatedList.findIndex(item => item.id === newItem.id);
      if (index >= 0) {
        updatedList[index] = newItem;
      } else {
        updatedList.push(newItem);
      }
    }
  });
  
  return { updatedList, changes };
};
