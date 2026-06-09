import { store } from '../data/store.js';
import type {
  ScheduleListFilters,
  FilterSignaturePayload,
  ScheduleItem,
  ScheduleBatch,
} from '../../shared/types.js';

function crc32Hash(str: string): string {
  let crc = 0xffffffff;
  const table: number[] = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  for (let i = 0; i < str.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ str.charCodeAt(i)) & 0xff];
  }
  const result = ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
  return result;
}

function base64Encode(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64');
}

function base64Decode(str: string): string | null {
  try {
    return Buffer.from(str, 'base64').toString('utf-8');
  } catch {
    return null;
  }
}

export function signFilters(
  filters: ScheduleListFilters,
  matchedItemIds: string[],
): FilterSignaturePayload {
  const ts = Date.now();
  const payloadObj = { filters, matchedItemIds, ts };
  const jsonStr = JSON.stringify(payloadObj);
  const hash = crc32Hash(jsonStr);
  const combined = jsonStr + '|' + hash;
  const signature = base64Encode(combined);

  const exportedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');

  const payload: FilterSignaturePayload = {
    signature,
    filters,
    matchedItemIds,
    exportedAt,
  };

  store.signatures.push(payload);
  return payload;
}

export function retrieveBySignature(
  sig: string,
): FilterSignaturePayload | { filters: ScheduleListFilters; matchedItemIds: string[]; decoded: true } | null {
  const stored = store.signatures.find((s) => s.signature === sig);
  if (stored) {
    return stored;
  }

  const decoded = base64Decode(sig);
  if (!decoded) return null;

  const pipeIdx = decoded.lastIndexOf('|');
  if (pipeIdx === -1) return null;

  const jsonPart = decoded.slice(0, pipeIdx);
  try {
    const parsed = JSON.parse(jsonPart) as {
      filters: ScheduleListFilters;
      matchedItemIds: string[];
      ts: number;
    };
    return {
      filters: parsed.filters,
      matchedItemIds: parsed.matchedItemIds,
      decoded: true,
    };
  } catch {
    return null;
  }
}

function csvEscape(value: string | number | boolean | undefined | null): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function toCSV(items: ScheduleItem[], batches: ScheduleBatch[]): string {
  const batchMap = new Map(batches.map((b) => [b.batchId, b]));
  const overrideMap = new Map(store.overrides.map((o) => [o.id, o]));

  const headers = [
    '批次号',
    '版本',
    '电梯号',
    '故障码',
    '故障描述',
    '推荐备件号',
    '推荐备件名',
    '推荐数量',
    '最终备件号',
    '最终备件名',
    '最终数量',
    '是否改判',
    '改判人',
    '月度影响(前)',
    '月度影响(后)',
    '后补说明',
  ];

  const rows: string[][] = [];
  rows.push(headers);

  for (const item of items) {
    const batch = batchMap.get(item.batchId);
    const override = item.overrideId ? overrideMap.get(item.overrideId) : undefined;

    rows.push([
      csvEscape(item.batchId),
      csvEscape(batch?.version ?? item.version),
      csvEscape(item.elevatorNo),
      csvEscape(item.faultCode),
      csvEscape(item.faultDescription),
      csvEscape(item.recommendedPartNo),
      csvEscape(item.recommendedPartName),
      csvEscape(item.recommendedQty),
      csvEscape(item.finalPartNo),
      csvEscape(item.finalPartName),
      csvEscape(item.finalQty),
      csvEscape(item.isOverridden ? '是' : '否'),
      csvEscape(override?.createdBy ?? ''),
      csvEscape(item.monthlyImpactBefore),
      csvEscape(item.monthlyImpactAfter),
      csvEscape(item.lateNote ?? ''),
    ]);
  }

  const csvContent = rows.map((r) => r.join(',')).join('\r\n');
  const BOM = '\uFEFF';
  return BOM + csvContent;
}
