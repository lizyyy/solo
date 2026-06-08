import type { DogRecord, SnapshotData, DiffItem } from '@/types';

export const formatDate = (d: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const anomalyLabelMap: Record<string, string> = {
  late_attachment: '晚到附件',
  weight_unit_mixed: '体重单位混写',
  conclusion_changed: '结论改判',
  manual_confirm: '人工确认',
  fuzzy_attachment: '附件模糊',
};

export const statusChipClass = (tag: string) => {
  switch (tag) {
    case 'normal': return 'chip-normal';
    case 'supplement': return 'chip-supplement';
    case 'anomaly': return 'chip-anomaly';
    case 'verdict': return 'chip-verdict';
    default: return 'chip-normal';
  }
};

export const weightUnitLabel: Record<string, string> = {
  kg: 'kg (公斤)',
  lb: 'lb (磅)',
  jin: '斤 (市斤)',
};

// deep clone snapshot
export function cloneSnapshot(s: SnapshotData): SnapshotData {
  return JSON.parse(JSON.stringify(s));
}

// Label map for field path
const labelMap: Record<string, string> = {
  'dogName': '犬只姓名',
  'breed': '品种',
  'gender': '性别',
  'age': '年龄',
  'weight': '体重数值',
  'weightUnit': '体重单位',
  'ownerName': '主人姓名',
  'ownerPhone': '联系电话',
  'conclusion': '寄养结论',
};

function fieldLabel(path: string): string {
  if (labelMap[path]) return labelMap[path];
  if (path.startsWith('vaccines[')) {
    const m = path.match(/vaccines\[(\d+)\]\.(.+)/);
    if (m) {
      const idx = Number(m[1]) + 1;
      const sub = m[2];
      const subMap: Record<string, string> = {
        name: '疫苗名称',
        date: '接种日期',
        expireDate: '有效期至',
        attachmentUrl: '附件链接',
        attachmentName: '附件名称',
        attachmentNote: '附件备注',
        attachmentArrivedLate: '是否晚到',
      };
      return `第${idx}针疫苗 · ${subMap[sub] || sub}`;
    }
  }
  if (path.startsWith('supplements[')) {
    const m = path.match(/supplements\[(\d+)\]\.(.+)/);
    if (m) {
      const idx = Number(m[1]) + 1;
      const sub = m[2];
      const subMap: Record<string, string> = {
        time: '时间',
        content: '内容',
        operator: '操作人',
      };
      return `第${idx}条补录备注 · ${subMap[sub] || sub}`;
    }
  }
  return path;
}

export function computeDiff(a: unknown, b: unknown, prefix = ''): DiffItem[] {
  const out: DiffItem[] = [];
  if (a === b) return out;

  const isObj = (v: unknown) => v !== null && typeof v === 'object';

  if (Array.isArray(a) && Array.isArray(b)) {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const path = `${prefix}[${i}]`;
      if (i >= a.length) {
        pushAdded(out, path, b[i]);
      } else if (i >= b.length) {
        pushRemoved(out, path, a[i]);
      } else {
        out.push(...computeDiff(a[i], b[i], path));
      }
    }
    return out;
  }

  if (isObj(a) && isObj(b) && !Array.isArray(a) && !Array.isArray(b)) {
    const keys = new Set([...Object.keys(a as Record<string, unknown>), ...Object.keys(b as Record<string, unknown>)]);
    for (const k of keys) {
      const path = prefix ? `${prefix}.${k}` : k;
      const av = (a as Record<string, unknown>)[k];
      const bv = (b as Record<string, unknown>)[k];
      if (av === undefined && bv !== undefined) {
        pushAdded(out, path, bv);
      } else if (bv === undefined && av !== undefined) {
        pushRemoved(out, path, av);
      } else {
        out.push(...computeDiff(av, bv, path));
      }
    }
    return out;
  }

  // primitive change
  out.push({
    path: prefix,
    label: fieldLabel(prefix),
    oldValue: a,
    newValue: b,
    kind: 'changed',
  });
  return out;
}

function pushAdded(out: DiffItem[], path: string, value: unknown) {
  if (typeof value === 'object' && value !== null) {
    // expand leaf fields of object/array additions
    out.push(...flattenInto(path, value, 'added'));
  } else {
    out.push({ path, label: fieldLabel(path), oldValue: undefined, newValue: value, kind: 'added' });
  }
}

function pushRemoved(out: DiffItem[], path: string, value: unknown) {
  if (typeof value === 'object' && value !== null) {
    out.push(...flattenInto(path, value, 'removed'));
  } else {
    out.push({ path, label: fieldLabel(path), oldValue: value, newValue: undefined, kind: 'removed' });
  }
}

function flattenInto(prefix: string, value: unknown, kind: 'added' | 'removed'): DiffItem[] {
  const out: DiffItem[] = [];
  const add = (path: string, v: unknown) => {
    if (Array.isArray(v)) {
      v.forEach((item, i) => add(`${path}[${i}]`, item));
    } else if (v !== null && typeof v === 'object') {
      for (const [k, vv] of Object.entries(v as Record<string, unknown>)) add(`${path}.${k}`, vv);
    } else {
      out.push({
        path,
        label: fieldLabel(path),
        oldValue: kind === 'added' ? undefined : v,
        newValue: kind === 'added' ? v : undefined,
        kind,
      });
    }
  };
  add(prefix, value);
  return out;
}

export function summarizeDiffs(diffs: DiffItem[]): string[] {
  const summary: string[] = [];
  for (const d of diffs) {
    if (d.kind === 'added') summary.push(`新增「${d.label}」= ${formatValue(d.newValue)}`);
    else if (d.kind === 'removed') summary.push(`删除「${d.label}」(原值 ${formatValue(d.oldValue)})`);
    else summary.push(`「${d.label}」由 ${formatValue(d.oldValue)} → ${formatValue(d.newValue)}`);
  }
  return summary;
}

export function formatValue(v: unknown): string {
  if (v === undefined || v === null) return '—';
  if (typeof v === 'boolean') return v ? '是' : '否';
  if (typeof v === 'string' && v.length > 24) return `"${v.slice(0, 24)}…"`;
  return typeof v === 'string' ? `"${v}"` : String(v);
}

export function findManualConfirmPair(record: DogRecord) {
  if (!record.manualConfirm) return null;
  const before = record.versionHistory.find(h => h.version === record.manualConfirm!.before);
  const after = record.versionHistory.find(h => h.version === record.manualConfirm!.after);
  return before && after ? { before, after } : null;
}

// "为什么没有按正常记录走" 的模板
export function anomalyExplanation(record: DogRecord): string[] {
  const reasons: string[] = [];
  for (const h of record.versionHistory) {
    if (h.anomaly === 'weight_unit_mixed') reasons.push(`v${h.version} · 体重单位由「斤」改为「kg」，但数值未同步换算 → 系统识别为异常。`);
    if (h.anomaly === 'late_attachment') reasons.push(`v${h.version} · 主人延迟 2 天提交狂犬疫苗附件 → 原 v${h.version - 1} 结论按缺失判定为「需补打」，补录后改判。`);
    if (h.anomaly === 'fuzzy_attachment') reasons.push(`v${h.version} · 首次上传疫苗本截图分辨率不足，关键章印无法辨识 → 按「待审核」处理。`);
    if (h.anomaly === 'conclusion_changed') reasons.push(`v${h.version} · 结论变更：由 v${h.version - 1} 快照值改判。`);
  }
  return reasons;
}
