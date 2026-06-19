import type { AttendanceRecord, DiffSegment, TicketType, ParsedPhotoRow, ParsedTicketRow } from '@/types';

export const generateHash = (content: string): string => {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
};

export const generateMaterialFingerprint = (sourceType: 'photo' | 'ticket', content: string): string => {
  const normalized = content.trim().replace(/\r\n/g, '\n').replace(/\s+/g, ' ');
  const hash = generateHash(normalized);
  return `mat-${sourceType}-${hash}`;
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

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
};

export const parsePhotoCSV = (content: string): ParsedPhotoRow[] => {
  const lines = content.trim().split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0].toLowerCase());
  const nameIdx = headers.findIndex(h => h.includes('姓名') || h.includes('name'));
  const typeIdx = headers.findIndex(h => h.includes('类型') || h.includes('票种') || h.includes('type'));
  const refIdx = headers.findIndex(h => h.includes('位置') || h.includes('照片') || h.includes('ref') || h.includes('photo'));
  const remarkIdx = headers.findIndex(h => h.includes('备注') || h.includes('remark') || h.includes('说明'));

  if (nameIdx === -1) {
    return lines.slice(1).map((line, i) => {
      const cols = parseCSVLine(line);
      return {
        name: cols[0] || `学员${i + 1}`,
        type: (cols[1]?.includes('赠') || cols[1]?.includes('free') ? 'free' : 'paid') as TicketType,
        sourcePhotoRef: cols[2] || `row-${i + 1}`,
        remark: cols[3] || '',
      };
    });
  }

  return lines.slice(1).map((line) => {
    const cols = parseCSVLine(line);
    const typeStr = (cols[typeIdx] || '').toLowerCase();
    return {
      name: cols[nameIdx] || '',
      type: (typeStr.includes('赠') || typeStr.includes('free') ? 'free' : 'paid') as TicketType,
      sourcePhotoRef: cols[refIdx] || '',
      remark: cols[remarkIdx] || '',
    };
  }).filter(r => r.name);
};

export const parseTicketCSV = (content: string): ParsedTicketRow[] => {
  const lines = content.trim().split('\n').filter(l => l.trim());
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0].toLowerCase());
  const noIdx = headers.findIndex(h => h.includes('票号') || h.includes('ticket') || h.includes('no'));
  const typeIdx = headers.findIndex(h => h.includes('类型') || h.includes('票种') || h.includes('type'));
  const purchaserIdx = headers.findIndex(h => h.includes('购票人') || h.includes('purchaser') || h.includes('姓名'));
  const refIdx = headers.findIndex(h => h.includes('位置') || h.includes('ref') || h.includes('行号'));

  if (noIdx === -1) {
    return lines.slice(1).map((line, i) => {
      const cols = parseCSVLine(line);
      return {
        ticketNo: cols[0] || `T${i + 1}`,
        type: (cols[1]?.includes('赠') || cols[1]?.includes('free') ? 'free' : 'paid') as TicketType,
        purchaser: cols[2] || '',
        sourceExportRef: cols[3] || `row-${i + 1}`,
      };
    });
  }

  return lines.slice(1).map((line) => {
    const cols = parseCSVLine(line);
    const typeStr = (cols[typeIdx] || '').toLowerCase();
    return {
      ticketNo: cols[noIdx] || '',
      type: (typeStr.includes('赠') || typeStr.includes('free') ? 'free' : 'paid') as TicketType,
      purchaser: cols[purchaserIdx] || '',
      sourceExportRef: cols[refIdx] || '',
    };
  }).filter(r => r.ticketNo);
};
