export function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
      d.getHours(),
    )}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } catch {
    return iso;
  }
}

export function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.round(diff / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return `${min}分钟前`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h}小时前`;
    const d = Math.round(h / 24);
    if (d < 30) return `${d}天前`;
    const mo = Math.round(d / 30);
    return `${mo}个月前`;
  } catch {
    return iso;
  }
}

export function severityColor(s: 'mild' | 'moderate' | 'severe') {
  switch (s) {
    case 'mild':
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        dot: 'bg-health',
        ring: 'ring-emerald-100',
      };
    case 'moderate':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-warn',
        ring: 'ring-amber-100',
      };
    case 'severe':
      return {
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
        dot: 'bg-danger',
        ring: 'ring-rose-100',
      };
  }
}

export function statusColor(s: 'pending' | 'in_progress' | 'resolved' | 'follow_up') {
  switch (s) {
    case 'pending':
      return { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400' };
    case 'in_progress':
      return { bg: 'bg-brand-50', text: 'text-brand-700', dot: 'bg-brand-500' };
    case 'follow_up':
      return { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' };
    case 'resolved':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-health' };
  }
}

export function timelineTypeColor(t: string) {
  switch (t) {
    case 'judgment_created':
      return { line: 'bg-slate-300', dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-700' };
    case 'judgment_rerun':
      return { line: 'bg-brand-300', dot: 'bg-brand-500', chip: 'bg-brand-50 text-brand-700' };
    case 'note_added':
      return { line: 'bg-sky-300', dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-700' };
    case 'vaccine_photo_uploaded':
      return { line: 'bg-teal-300', dot: 'bg-teal-500', chip: 'bg-teal-50 text-teal-700' };
    case 'medication_changed':
      return { line: 'bg-amber-300', dot: 'bg-warn', chip: 'bg-amber-50 text-amber-700' };
    case 'material_supplemented':
      return { line: 'bg-violet-300', dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700' };
    case 'status_updated':
      return { line: 'bg-emerald-300', dot: 'bg-health', chip: 'bg-emerald-50 text-emerald-700' };
    default:
      return { line: 'bg-slate-300', dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-700' };
  }
}
