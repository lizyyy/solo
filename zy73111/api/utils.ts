import crypto from 'node:crypto';

export function uid(prefix = ''): string {
  const rand = crypto.randomBytes(4).toString('hex');
  const t = Date.now().toString(36);
  return `${prefix}${t}${rand}`;
}

export function md5(str: string): string {
  return crypto.createHash('md5').update(str, 'utf8').digest('hex');
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function pad(num: number, size = 2): string {
  let s = String(num);
  while (s.length < size) s = '0' + s;
  return s;
}

export function formatCollisionSeq(seq: number): string {
  const d = new Date();
  return `CP-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(seq, 5)}`;
}

export interface DiffEntry {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export function diffFields(
  oldObj: any,
  newObj: any,
  fields: string[],
): DiffEntry[] {
  const result: DiffEntry[] = [];
  for (const f of fields) {
    const ov = oldObj[f];
    const nv = newObj[f];
    const eq = JSON.stringify(ov) === JSON.stringify(nv);
    if (!eq) result.push({ field: f, oldValue: ov ?? null, newValue: nv ?? null });
  }
  return result;
}

export function materialTypeLabel(t: string): string {
  switch (t) {
    case 'bim_note':
      return 'BIM模型备注';
    case 'boundary_sample':
      return '边界样本';
    case 'verbal_note':
      return '口头说明';
    case 'supplement':
      return '补录材料';
    default:
      return t;
  }
}

export function statusLabel(s: string): string {
  switch (s) {
    case 'pending':
      return '待处理';
    case 'processing':
      return '处理中';
    case 'resolved':
      return '已解决';
    case 'waived':
      return '已豁免';
    default:
      return s;
  }
}

export function changeTypeLabel(c: string): { label: string; color: string } {
  switch (c) {
    case 'remark':
      return { label: '修改备注', color: '#2563eb' };
    case 'conclusion':
      return { label: '改判结论', color: '#e67e22' };
    case 'status':
      return { label: '修改状态', color: '#7c3aed' };
    case 'abnormal':
      return { label: '标记异常', color: '#dc2626' };
    case 'material_add':
      return { label: '新增材料', color: '#059669' };
    case 'material_modify':
      return { label: '修改材料口径', color: '#d97706' };
    default:
      return { label: c, color: '#6b7280' };
  }
}
