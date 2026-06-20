import type { FullDataset } from '@/types';

export function toJSON(data: FullDataset, pretty = true): string {
  return JSON.stringify(data, null, pretty ? 2 : 0);
}

export function downloadJSON(data: FullDataset, filename = '盾构刀盘工单回放-导出.json'): void {
  const blob = new Blob([toJSON(data)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseDataset(text: string): FullDataset | { error: string } {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') {
      return { error: 'JSON 解析结果不是对象' };
    }
    const wo = Array.isArray(parsed.workorders) ? parsed.workorders : [];
    const sp = Array.isArray(parsed.spare_parts) ? parsed.spare_parts : [];
    const rr = Array.isArray(parsed.recall_records) ? parsed.recall_records : [];
    return { workorders: wo, spare_parts: sp, recall_records: rr };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `JSON 解析失败：${msg}` };
  }
}
