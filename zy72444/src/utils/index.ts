import type { AttendanceRecord, DiffSegment, TicketType } from '@/types';

export const generateHash = (content: string): string => {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
};

export const detectMixedType = (records: AttendanceRecord[]): boolean => {
  const types = new Set(records.map(r => r.type));
  return types.has('free') && types.has('paid');
};

export const countByType = (records: AttendanceRecord[]): { free: number; paid: number } => {
  return records.reduce(
    (acc, r) => {
      acc[r.type]++;
      return acc;
    },
    { free: 0, paid: 0 }
  );
};

export const diffContent = (oldStr: string, newStr: string): DiffSegment[] => {
  if (oldStr === newStr) {
    return [{ type: 'same', content: oldStr }];
  }

  const oldChars = oldStr.split('');
  const newChars = newStr.split('');
  const result: DiffSegment[] = [];

  let i = 0;
  let j = 0;

  while (i < oldChars.length && j < newChars.length) {
    if (oldChars[i] === newChars[j]) {
      let sameContent = '';
      while (i < oldChars.length && j < newChars.length && oldChars[i] === newChars[j]) {
        sameContent += oldChars[i];
        i++;
        j++;
      }
      result.push({ type: 'same', content: sameContent });
    } else {
      let found = false;
      for (let k = j + 1; k < Math.min(j + 5, newChars.length); k++) {
        if (oldChars[i] === newChars[k]) {
          result.push({ type: 'added', content: newChars.slice(j, k).join('') });
          j = k;
          found = true;
          break;
        }
      }
      if (!found) {
        for (let k = i + 1; k < Math.min(i + 5, oldChars.length); k++) {
          if (oldChars[k] === newChars[j]) {
            result.push({ type: 'removed', content: oldChars.slice(i, k).join('') });
            i = k;
            found = true;
            break;
          }
        }
        if (!found) {
          result.push({ type: 'removed', content: oldChars[i] });
          result.push({ type: 'added', content: newChars[j] });
          i++;
          j++;
        }
      }
    }
  }

  if (i < oldChars.length) {
    result.push({ type: 'removed', content: oldChars.slice(i).join('') });
  }
  if (j < newChars.length) {
    result.push({ type: 'added', content: newChars.slice(j).join('') });
  }

  return result;
};

export const formatDateTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDate = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const getTicketTypeLabel = (type: TicketType): string => {
  return type === 'free' ? '赠票' : '售票';
};

export const getTicketTypeColor = (type: TicketType): string => {
  return type === 'free' ? 'bg-sky-100 text-sky-800' : 'bg-emerald-100 text-emerald-800';
};

export const getRoleLabel = (role: 'recorder' | 'copyright'): string => {
  return role === 'recorder' ? '录音师' : '版权运营小鹿';
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11);
};
