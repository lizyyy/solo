import crypto from 'crypto';
import moment from 'moment';

export function generateBatchNo(): string {
  const dateStr = moment().format('YYYYMMDD');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BATCH-${dateStr}-${random}`;
}

export function generateDetailNo(): string {
  const dateStr = moment().format('YYYYMMDD');
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `DETAIL-${dateStr}-${random}`;
}

export function calculateMaterialHash(materials: Array<{
  material_type: string;
  waybill_no?: string;
  content?: string;
}>): string {
  const sorted = materials
    .map(m => `${m.material_type}|${m.waybill_no || ''}|${m.content || ''}`)
    .sort()
    .join('||');
  return crypto.createHash('sha256').update(sorted).digest('hex');
}

export function nowTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

export function formatTimestamp(ts: number): string {
  return moment.unix(ts).format('YYYY-MM-DD HH:mm:ss');
}

export function buildPaginationResponse<T>(
  items: T[],
  total: number,
  page: number,
  page_size: number
) {
  return {
    items,
    pagination: {
      page,
      page_size,
      total,
      total_pages: Math.ceil(total / page_size),
    },
  };
}
